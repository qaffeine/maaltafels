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

  // a×b and b×a are the same fact.
  function factKey(a, b) {
    return a <= b ? a + 'x' + b : b + 'x' + a;
  }

  function factsOfTable(t) {
    return TABLES.map(function (b) { return factKey(t, b); });
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

  function makeQuestion(table, b, swap) {
    var x = swap ? b : table;
    var y = swap ? table : b;
    return { a: x, b: y, answer: x * y, table: table, key: factKey(x, y) };
  }

  // Balanced round: each selected table appears about equally often, questions
  // from different tables are shuffled together, and no fact repeats back to back.
  function buildRound(tables, n, rnd) {
    rnd = rnd || Math.random;
    tables = normalizeTables(tables);
    var mixed = tables.length > 1;
    var slots = [];
    while (slots.length < n) slots = slots.concat(shuffle(tables, rnd));
    slots = shuffle(slots.slice(0, n), rnd);

    var bags = {};
    function draw(t) {
      if (!bags[t] || bags[t].length === 0) bags[t] = shuffle(TABLES, rnd);
      return bags[t].pop();
    }

    var out = [];
    for (var i = 0; i < slots.length; i++) {
      var t = slots[i];
      var prev = out[out.length - 1];
      var q = null;
      for (var tries = 0; tries < 20; tries++) {
        q = makeQuestion(t, draw(t), mixed && rnd() < 0.5);
        if (!prev || q.key !== prev.key) break;
      }
      out.push(q);
    }
    return out;
  }

  // Single random question for the time challenge.
  function nextQuestion(tables, prevKey, rnd) {
    rnd = rnd || Math.random;
    tables = normalizeTables(tables);
    var mixed = tables.length > 1;
    var q;
    for (var tries = 0; tries < 30; tries++) {
      var t = tables[Math.floor(rnd() * tables.length)];
      var b = TABLES[Math.floor(rnd() * TABLES.length)];
      q = makeQuestion(t, b, mixed && rnd() < 0.5);
      if (q.key !== prevKey) break;
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

  // Smart practice: ~60% weak (0–2), ~30% medium (3–4), ~10% mastered (5).
  function smartRound(stats, n, rnd) {
    rnd = rnd || Math.random;
    var buckets = { weak: [], medium: [], mastered: [] };
    TABLES.forEach(function (t) {
      TABLES.forEach(function (b) {
        if (b < t) return; // one entry per fact
        var lvl = levelOf(stats, factKey(t, b));
        var bucket = lvl <= 2 ? 'weak' : lvl <= 4 ? 'medium' : 'mastered';
        buckets[bucket].push([t, b]);
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
        var list = buckets[order[k]].filter(function (p) {
          var key = factKey(p[0], p[1]);
          return !used[key] && (!prev || prev.key !== key);
        });
        if (list.length) {
          var p = list[Math.floor(rnd() * list.length)];
          var swap = rnd() < 0.5;
          q = makeQuestion(swap ? p[1] : p[0], swap ? p[0] : p[1], false);
        }
      }
      if (!q) { used = {}; i--; continue; } // every fact used once: allow repeats
      used[q.key] = true;
      out.push(q);
    }
    return out;
  }

  function tableSummary(stats, t) {
    var attempts = 0, correct = 0, allStrong = true;
    factsOfTable(t).forEach(function (key) {
      var s = stats[key];
      if (s) { attempts += s.attempts; correct += s.correct; }
      if (levelOf(stats, key) < 4) allStrong = false;
    });
    return { attempts: attempts, correct: correct, allStrong: allStrong };
  }

  // 1★ practised, 2★ ≥80% correct (min. 10 attempts), 3★ all facts level ≥4 or a passed test.
  // A table only earns stars once it was actually played; sharing facts (3×4 is
  // also in the table of 4) must not hand out stars to tables the child never chose.
  function computeStars(stats, t, testPassed, played) {
    if (played === false) return 0;
    var s = tableSummary(stats, t);
    if (s.allStrong || testPassed) return 3;
    if (s.attempts >= 10 && s.correct / s.attempts >= 0.8) return 2;
    if (s.attempts > 0) return 1;
    return 0;
  }

  // Four plausible options: the answer plus neighbouring products.
  function multipleChoice(q, rnd) {
    rnd = rnd || Math.random;
    var cands = [
      q.a * (q.b + 1), q.a * (q.b - 1), (q.a + 1) * q.b, (q.a - 1) * q.b,
      q.answer + 1, q.answer - 1, q.answer + 10, q.answer - 10, q.answer + 2
    ];
    var opts = [q.answer];
    shuffle(cands, rnd).forEach(function (c) {
      if (opts.length < 4 && c > 0 && c <= 100 && opts.indexOf(c) === -1) opts.push(c);
    });
    var extra = 1;
    while (opts.length < 4) {
      if (opts.indexOf(q.answer + extra) === -1) opts.push(q.answer + extra);
      extra++;
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

  function selectionLabel(tables) {
    tables = normalizeTables(tables);
    if (tables.length === TABLES.length) return 'Alles';
    return tables.join('+');
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
    TABLES: TABLES, GROUPS: GROUPS, FAST_MS: FAST_MS, MAX_LEVEL: MAX_LEVEL,
    factKey: factKey, factsOfTable: factsOfTable, shuffle: shuffle, makeQuestion: makeQuestion,
    buildRound: buildRound, nextQuestion: nextQuestion, levelOf: levelOf, updateFact: updateFact,
    smartRound: smartRound, tableSummary: tableSummary, computeStars: computeStars,
    multipleChoice: multipleChoice, normalizeTables: normalizeTables, selectionLabel: selectionLabel,
    hardest: hardest, dateKey: dateKey, updateStreak: updateStreak
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
