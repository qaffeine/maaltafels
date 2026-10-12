// Pure game logic: question generation, mastery, stars.
// No DOM access, so it can be unit-tested with Node (see tests/logic.test.js).
(function (root) {
  'use strict';

  var TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var FAST_MS = 3000;
  var MAX_LEVEL = 5;

  var GROUPS = {
    alles: TABLES.slice(),
    makkelijk: [1, 2, 5, 10],
    moeilijk: [6, 7, 8, 9]
  };

  // Operations: 'x' multiplies (maaltafels), 'd' divides (deeltafels).
  var OPS = ['x', 'd'];

  // a×b and b×a are the same fact.
  function factKey(a, b) {
    return a <= b ? a + 'x' + b : b + 'x' + a;
  }

  // 42 : 7 and 42 : 6 are different facts: one per divisor (deeltafel) and quotient.
  function divKey(divisor, quotient) {
    return (divisor * quotient) + ':' + divisor;
  }

  function factsOfTable(t, op) {
    return TABLES.map(function (b) { return op === 'd' ? divKey(t, b) : factKey(t, b); });
  }

  // "6 × 7 = 42" or "42 : 7 = 6", for lists shown to parents.
  function factLabel(key) {
    var d = key.split(':');
    if (d.length === 2) return d[0] + ' : ' + d[1] + ' = ' + (d[0] / d[1]);
    var m = key.split('x');
    return m[0] + ' × ' + m[1] + ' = ' + (m[0] * m[1]);
  }

  function shuffle(arr, rnd) {
    rnd = rnd || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // Multiplication: table × b (or b × table when swapped).
  // Division: (table·b) : table = b; the table is always the divisor, as in "de deeltafel van 7".
  // fam is the fact family, so 6 × 7 isn't followed by 42 : 7 (which would give the answer away).
  function makeQuestion(table, b, swap, op) {
    if (op === 'd') {
      return { op: 'd', a: table * b, b: table, answer: b, table: table, key: divKey(table, b), fam: factKey(table, b) };
    }
    var x = swap ? b : table;
    var y = swap ? table : b;
    return { op: 'x', a: x, b: y, answer: x * y, table: table, key: factKey(x, y), fam: factKey(x, y) };
  }

  function normalizeOps(ops) {
    var out = OPS.filter(function (o) { return (ops || []).indexOf(o) !== -1; });
    return out.length ? out : ['x'];
  }

  // Balanced round: each selected table (and operation) appears about equally often,
  // questions from different tables are shuffled together, and no fact family repeats back to back.
  function buildRound(tables, n, rnd, ops) {
    rnd = rnd || Math.random;
    tables = normalizeTables(tables);
    ops = normalizeOps(ops);
    var mixed = tables.length > 1;
    var units = [];
    tables.forEach(function (t) { ops.forEach(function (o) { units.push({ t: t, op: o }); }); });
    var slots = [];
    while (slots.length < n) slots = slots.concat(shuffle(units, rnd));
    slots = shuffle(slots.slice(0, n), rnd);

    var bags = {};
    function draw(u) {
      var k = u.op + u.t;
      if (!bags[k] || bags[k].length === 0) bags[k] = shuffle(TABLES, rnd);
      return bags[k].pop();
    }

    var out = [];
    for (var i = 0; i < slots.length; i++) {
      var u = slots[i];
      var prev = out[out.length - 1];
      var q = null;
      for (var tries = 0; tries < 20; tries++) {
        q = makeQuestion(u.t, draw(u), mixed && rnd() < 0.5, u.op);
        if (!prev || q.fam !== prev.fam) break;
      }
      out.push(q);
    }
    return out;
  }

  // Single random question for the time challenge. prevFam: the fact family just asked.
  function nextQuestion(tables, prevFam, rnd, ops) {
    rnd = rnd || Math.random;
    tables = normalizeTables(tables);
    ops = normalizeOps(ops);
    var mixed = tables.length > 1;
    var q;
    for (var tries = 0; tries < 30; tries++) {
      var t = tables[Math.floor(rnd() * tables.length)];
      var b = TABLES[Math.floor(rnd() * TABLES.length)];
      var op = ops[Math.floor(rnd() * ops.length)];
      q = makeQuestion(t, b, mixed && rnd() < 0.5, op);
      if (q.fam !== prevFam) break;
    }
    return q;
  }

  function levelOf(stats, key) {
    return (stats[key] && stats[key].level) || 0;
  }

  // Leitner-style update: fast & correct → up, slow & correct → same, wrong → 1.
  function updateFact(stat, correct, ms) {
    var s = stat ? Object.assign({}, stat) : { attempts: 0, correct: 0, totalMs: 0, lastMs: 0, level: 0 };
    s.attempts += 1;
    s.totalMs += ms;
    s.lastMs = ms;
    if (correct) {
      s.correct += 1;
      if (ms < FAST_MS) s.level = Math.min(MAX_LEVEL, s.level + 1);
      else if (s.level === 0) s.level = 1;
    } else {
      s.level = 1;
    }
    return s;
  }

  // Tables a parent marked as already known count as mastered, unless the
  // child actually struggled with that fact here (real results win).
  // Division: a is the divisor (the deeltafel), b the quotient.
  function effectiveLevel(stats, a, b, known, op) {
    var div = op === 'd';
    var s = stats[div ? divKey(a, b) : factKey(a, b)];
    var lvl = (s && s.level) || 0;
    var isKnown = known && (known.indexOf(a) !== -1 || (!div && known.indexOf(b) !== -1));
    if (!isKnown) return lvl;
    var struggled = s && s.attempts > 0 && lvl <= 2;
    return struggled ? lvl : MAX_LEVEL;
  }

  // Smart practice: ~60% weak (0–2), ~30% medium (3–4), ~10% mastered (5).
  // div: pass { known: [...] } to also ask division facts, with their own known tables.
  function smartRound(stats, n, rnd, known, div) {
    rnd = rnd || Math.random;
    var buckets = { weak: [], medium: [], mastered: [] };
    function add(t, b, op, kn) {
      var lvl = effectiveLevel(stats, t, b, kn, op);
      var bucket = lvl <= 2 ? 'weak' : lvl <= 4 ? 'medium' : 'mastered';
      var key = op === 'd' ? divKey(t, b) : factKey(t, b);
      buckets[bucket].push({ t: t, b: b, op: op, key: key, fam: factKey(t, b) });
    }
    TABLES.forEach(function (t) {
      TABLES.forEach(function (b) {
        if (b >= t) add(t, b, 'x', known); // one entry per fact
        if (div) add(t, b, 'd', div.known);
      });
    });
    var used = {};
    var out = [];
    for (var i = 0; i < n; i++) {
      var r = rnd();
      var order = r < 0.6 ? ['weak', 'medium', 'mastered']
        : r < 0.9 ? ['medium', 'weak', 'mastered']
          : ['mastered', 'medium', 'weak'];
      var prev = out[out.length - 1];
      var q = null;
      for (var k = 0; k < order.length && !q; k++) {
        var notPrev = buckets[order[k]].filter(function (f) { return !prev || prev.fam !== f.fam; });
        var list = notPrev.filter(function (f) { return !used[f.key]; });
        // Few facts left in this bucket: repeat them rather than switch buckets.
        if (!list.length) list = notPrev;
        if (list.length) {
          var f = list[Math.floor(rnd() * list.length)];
          var swap = f.op === 'x' && rnd() < 0.5;
          q = makeQuestion(swap ? f.b : f.t, swap ? f.t : f.b, false, f.op);
        }
      }
      used[q.key] = true;
      out.push(q);
    }
    return out;
  }

  function tableSummary(stats, t, op) {
    var attempts = 0, correct = 0, allStrong = true;
    factsOfTable(t, op).forEach(function (key) {
      var s = stats[key];
      if (s) { attempts += s.attempts; correct += s.correct; }
      if (levelOf(stats, key) < 4) allStrong = false;
    });
    return { attempts: attempts, correct: correct, allStrong: allStrong };
  }

  // 1★ practised, 2★ ≥80% correct (min. 10 attempts), 3★ all facts level ≥4 or a passed test.
  // A table only earns stars once it was actually played; sharing facts (3×4 is
  // also in the table of 4) must not hand out stars to tables the child never chose.
  // Multiplication and division each earn their own stars (op 'x' or 'd').
  function computeStars(stats, t, testPassed, played, op) {
    if (played === false) return 0;
    var s = tableSummary(stats, t, op);
    if (s.allStrong || testPassed) return 3;
    if (s.attempts >= 10 && s.correct / s.attempts >= 0.8) return 2;
    if (s.attempts > 0) return 1;
    return 0;
  }

  // Four plausible options: the answer plus neighbouring products.
  // Division: neighbouring quotients, and the divisor itself (a common slip: 42 : 7 = 7).
  function multipleChoice(q, rnd) {
    rnd = rnd || Math.random;
    var div = q.op === 'd';
    var max = div ? 10 : 100;
    var cands = div
      ? [q.b, q.answer + 1, q.answer - 1, q.answer + 2, q.answer - 2]
      : [
        q.a * (q.b + 1), q.a * (q.b - 1), (q.a + 1) * q.b, (q.a - 1) * q.b,
        q.answer + 1, q.answer - 1, q.answer + 10, q.answer - 10, q.answer + 2
      ];
    var opts = [q.answer];
    shuffle(cands, rnd).forEach(function (c) {
      if (opts.length < 4 && c > 0 && c <= max && opts.indexOf(c) === -1) opts.push(c);
    });
    // Still short (only near 1 or the maximum): fill with close numbers inside 1..max.
    for (var extra = 1; opts.length < 4; extra++) {
      [q.answer + extra, q.answer - extra].forEach(function (c) {
        if (opts.length < 4 && c >= 1 && c <= max && opts.indexOf(c) === -1) opts.push(c);
      });
    }
    return shuffle(opts, rnd);
  }

  function normalizeTables(tables) {
    var seen = {};
    return (tables || []).filter(function (t) {
      if (TABLES.indexOf(t) === -1 || seen[t]) return false;
      seen[t] = true;
      return true;
    }).sort(function (a, b) { return a - b; });
  }

  // Key for personal records. Multiplication keeps its old labels ("7", "6+7+8", "Alles").
  function selectionLabel(tables, ops) {
    tables = normalizeTables(tables);
    ops = normalizeOps(ops);
    var label = tables.length === TABLES.length ? 'Alles' : tables.join('+');
    return ops.length === 1 && ops[0] === 'x' ? label : ops.join('') + ':' + label;
  }

  // Hardest facts: lowest accuracy first, then slowest average.
  function hardest(stats, n) {
    return Object.keys(stats)
      .filter(function (k) { return stats[k].attempts > 0; })
      .map(function (k) {
        var s = stats[k];
        return { key: k, attempts: s.attempts, correct: s.correct, acc: s.correct / s.attempts, avgMs: s.totalMs / s.attempts, level: s.level };
      })
      .filter(function (f) { return f.acc < 1 || f.avgMs >= FAST_MS; })
      .sort(function (x, y) { return x.acc - y.acc || y.avgMs - x.avgMs; })
      .slice(0, n);
  }

  // A trick that builds the answer from an easier, known fact.
  // Picks the friendliest factor as the "anchor"; x is the other factor.
  var HINT_ORDER = [1, 10, 2, 5, 9, 4, 3, 6, 8, 7];
  function hintFor(a, b) {
    var f = HINT_ORDER.filter(function (n) { return n === a || n === b; })[0];
    var x = f === a ? b : a;
    switch (f) {
      case 1: return 'Maal 1 verandert niets: het blijft ' + x + '.';
      case 10: return 'Maal 10: zet een 0 achter ' + x + '. Dat is ' + (x * 10) + '.';
      case 2: return 'Maal 2 is het dubbel: ' + x + ' + ' + x + ' = ' + (2 * x) + '.';
      case 5: return 'Maal 5 is de helft van maal 10: ' + x + ' × 10 = ' + (10 * x) + ', de helft is ' + (5 * x) + '.';
      case 9: return 'Maal 9 is maal 10 min één keer: ' + (10 * x) + ' − ' + x + ' = ' + (9 * x) + '.';
      case 4: return 'Maal 4 is twee keer het dubbel: ' + x + ' × 2 = ' + (2 * x) + ', en ' + (2 * x) + ' + ' + (2 * x) + ' = ' + (4 * x) + '.';
      case 3: return 'Maal 3 is maal 2 plus één keer: ' + (2 * x) + ' + ' + x + ' = ' + (3 * x) + '.';
      case 6: return 'Maal 6 is maal 5 plus één keer: ' + (5 * x) + ' + ' + x + ' = ' + (6 * x) + '.';
      case 8: return 'Maal 8 is het dubbel van maal 4: ' + x + ' × 4 = ' + (4 * x) + ', en ' + (4 * x) + ' + ' + (4 * x) + ' = ' + (8 * x) + '.';
      default: return 'Maal 7 is maal 5 plus maal 2: ' + (5 * x) + ' + ' + (2 * x) + ' = ' + (7 * x) + '.';
    }
  }

  // Division builds on the multiplication fact the child already knows.
  function divHintFor(dividend, divisor) {
    var q = dividend / divisor;
    return 'Hoeveel keer ' + divisor + ' is ' + dividend + '? ' + q + ' × ' + divisor + ' = ' + dividend +
      ', dus ' + dividend + ' : ' + divisor + ' = ' + q + '.';
  }

  function dateKey(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function updateStreak(streak, now) {
    var today = dateKey(now);
    var y = new Date(now); y.setDate(y.getDate() - 1);
    if (!streak || !streak.last) return { count: 1, last: today };
    if (streak.last === today) return streak;
    if (streak.last === dateKey(y)) return { count: streak.count + 1, last: today };
    return { count: 1, last: today };
  }

  var api = {
    TABLES: TABLES, GROUPS: GROUPS, OPS: OPS, FAST_MS: FAST_MS, MAX_LEVEL: MAX_LEVEL,
    factKey: factKey, divKey: divKey, factLabel: factLabel, factsOfTable: factsOfTable, shuffle: shuffle,
    makeQuestion: makeQuestion, normalizeOps: normalizeOps,
    buildRound: buildRound, nextQuestion: nextQuestion, levelOf: levelOf, effectiveLevel: effectiveLevel, updateFact: updateFact,
    smartRound: smartRound, tableSummary: tableSummary, computeStars: computeStars,
    multipleChoice: multipleChoice, normalizeTables: normalizeTables, selectionLabel: selectionLabel,
    hardest: hardest, hintFor: hintFor, divHintFor: divHintFor, dateKey: dateKey, updateStreak: updateStreak
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
