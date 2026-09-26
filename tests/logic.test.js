// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

// Deterministic random for repeatable tests.
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

test('factKey treats a×b and b×a as the same fact', () => {
  assert.equal(L.factKey(7, 3), '3x7');
  assert.equal(L.factKey(3, 7), '3x7');
});

test('factsOfTable returns 10 distinct facts', () => {
  const keys = L.factsOfTable(7);
  assert.equal(keys.length, 10);
  assert.equal(new Set(keys).size, 10);
});

test('single-table round uses only that table as first factor', () => {
  const round = L.buildRound([7], 10, seeded(1));
  assert.equal(round.length, 10);
  round.forEach((q) => {
    assert.equal(q.a, 7);
    assert.equal(q.answer, q.a * q.b);
  });
});

test('mixed round covers every selected table about equally', () => {
  const round = L.buildRound([3, 6, 7], 30, seeded(2));
  const counts = { 3: 0, 6: 0, 7: 0 };
  round.forEach((q) => { counts[q.table]++; });
  assert.deepEqual(counts, { 3: 10, 6: 10, 7: 10 });
  round.forEach((q) => assert.ok(q.a === q.table || q.b === q.table));
});

test('a mixed round is shuffled, not grouped table by table', () => {
  const round = L.buildRound([3, 6, 7], 10, seeded(3));
  const tables = new Set(round.slice(0, 5).map((q) => q.table));
  assert.ok(tables.size > 1);
});

test('no fact is asked twice in a row', () => {
  for (let s = 1; s < 50; s++) {
    const round = L.buildRound([2], 20, seeded(s));
    for (let i = 1; i < round.length; i++) assert.notEqual(round[i].key, round[i - 1].key);
  }
  let prev = null;
  const rnd = seeded(9);
  for (let i = 0; i < 200; i++) {
    const q = L.nextQuestion([1], prev, rnd);
    assert.notEqual(q.key, prev);
    prev = q.key;
  }
});

test('updateFact: fast correct goes up, slow stays, wrong drops to 1', () => {
  let s = L.updateFact(null, true, 1000);
  assert.equal(s.level, 1);
  s = L.updateFact(s, true, 1000);
  assert.equal(s.level, 2);
  s = L.updateFact(s, true, 5000);
  assert.equal(s.level, 2);
  s = L.updateFact(s, false, 1000);
  assert.equal(s.level, 1);
  assert.equal(s.attempts, 4);
  assert.equal(s.correct, 3);
  for (let i = 0; i < 10; i++) s = L.updateFact(s, true, 500);
  assert.equal(s.level, L.MAX_LEVEL);
});

test('stars: 0 → 1 → 2 → 3', () => {
  const stats = {};
  assert.equal(L.computeStars(stats, 7, false), 0);
  stats[L.factKey(7, 1)] = L.updateFact(null, false, 1000);
  assert.equal(L.computeStars(stats, 7, false), 1);
  L.factsOfTable(7).forEach((k) => {
    let s = stats[k];
    for (let i = 0; i < 2; i++) s = L.updateFact(s, true, 5000);
    stats[k] = s;
  });
  assert.equal(L.computeStars(stats, 7, false), 2);
  assert.equal(L.computeStars(stats, 7, true), 3);
  L.factsOfTable(7).forEach((k) => {
    let s = stats[k];
    for (let i = 0; i < 4; i++) s = L.updateFact(s, true, 500);
    stats[k] = s;
  });
  assert.equal(L.computeStars(stats, 7, false), 3);
});

test('no stars for a table that was never played', () => {
  const stats = { '3x4': L.updateFact(null, true, 1000) };
  assert.equal(L.computeStars(stats, 4, false, false), 0);
  assert.equal(L.computeStars(stats, 3, false, true), 1);
});

test('multiple choice: 4 unique positive options including the answer', () => {
  const rnd = seeded(4);
  L.TABLES.forEach((a) => L.TABLES.forEach((b) => {
    const q = L.makeQuestion(a, b, false);
    const opts = L.multipleChoice(q, rnd);
    assert.equal(opts.length, 4);
    assert.equal(new Set(opts).size, 4);
    assert.ok(opts.includes(q.answer));
    opts.forEach((o) => assert.ok(o > 0));
  }));
});

test('smart round favours weak facts', () => {
  const stats = {};
  // Master everything except the table of 8.
  L.TABLES.forEach((a) => L.TABLES.forEach((b) => {
    if (a !== 8 && b !== 8) stats[L.factKey(a, b)] = { attempts: 5, correct: 5, totalMs: 5000, lastMs: 1000, level: 5 };
  }));
  const round = L.smartRound(stats, 20, seeded(5));
  assert.equal(round.length, 20);
  const weak = round.filter((q) => q.a === 8 || q.b === 8).length;
  assert.ok(weak >= 8, `expected mostly weak facts, got ${weak}`);
  for (let i = 1; i < round.length; i++) assert.notEqual(round[i].key, round[i - 1].key);
});

test('selectionLabel', () => {
  assert.equal(L.selectionLabel([8, 6, 7]), '6+7+8');
  assert.equal(L.selectionLabel(L.TABLES), 'Alles');
});

test('streak counts consecutive days', () => {
  const d1 = new Date(2026, 8, 24);
  const d2 = new Date(2026, 8, 25);
  const d4 = new Date(2026, 8, 27);
  let s = L.updateStreak(null, d1);
  assert.equal(s.count, 1);
  s = L.updateStreak(s, d1);
  assert.equal(s.count, 1);
  s = L.updateStreak(s, d2);
  assert.equal(s.count, 2);
  s = L.updateStreak(s, d4);
  assert.equal(s.count, 1);
});

test('hardest lists the worst facts first', () => {
  const stats = {
    '7x8': { attempts: 4, correct: 1, totalMs: 20000, level: 1 },
    '6x7': { attempts: 4, correct: 3, totalMs: 8000, level: 2 },
    '2x2': { attempts: 4, correct: 4, totalMs: 4000, level: 4 }
  };
  const h = L.hardest(stats, 10);
  assert.deepEqual(h.map((f) => f.key), ['7x8', '6x7']);
});

test('hint: every fact gets a trick that ends in the right answer', () => {
  L.TABLES.forEach((a) => L.TABLES.forEach((b) => {
    const h = L.hintFor(a, b);
    const nums = h.match(/\d+/g).map(Number);
    assert.equal(nums[nums.length - 1], a * b, `${a}×${b}: ${h}`);
  }));
});

test('hint: uses the friendliest factor', () => {
  assert.match(L.hintFor(7, 9), /^Maal 9/);
  assert.match(L.hintFor(8, 5), /^Maal 5/);
  assert.match(L.hintFor(7, 7), /^Maal 7 is maal 5 plus maal 2: 35 \+ 14 = 49/);
});

test('smart round: known tables only come back now and then', () => {
  const known = [1, 2, 3, 4, 5, 10];
  let fromKnownOnly = 0;
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) {
    L.smartRound({}, 20, seeded(seed), known).forEach((q) => {
      total++;
      if (known.includes(q.a) || known.includes(q.b)) fromKnownOnly++;
    });
  }
  const share = fromKnownOnly / total;
  assert.ok(share > 0.03 && share < 0.2, `share of known facts was ${share}`);
});

test('effective level: known facts count as mastered unless the child struggled', () => {
  assert.equal(L.effectiveLevel({}, 2, 7, [2]), L.MAX_LEVEL);
  assert.equal(L.effectiveLevel({}, 6, 7, [2]), 0);
  const stats = { '2x7': { attempts: 3, correct: 1, totalMs: 9000, level: 1 } };
  assert.equal(L.effectiveLevel(stats, 7, 2, [2]), 1);
});

// ---------- edge cases ----------

test('buildRound: every question is a valid fact from the selection', () => {
  for (let s = 1; s <= 30; s++) {
    const tables = L.TABLES.filter((t) => (t * s) % 3 !== 0).slice(0, 1 + (s % 10)) || [1];
    const sel = tables.length ? tables : [1];
    L.buildRound(sel, 20, seeded(s)).forEach((q) => {
      assert.ok(sel.includes(q.a) || sel.includes(q.b));
      assert.ok(q.a >= 1 && q.a <= 10 && q.b >= 1 && q.b <= 10);
      assert.equal(q.answer, q.a * q.b);
      assert.equal(q.key, L.factKey(q.a, q.b));
    });
  }
});

test('buildRound: ignores invalid and duplicate tables', () => {
  const round = L.buildRound([7, 7, 0, 11, 'x'], 10, seeded(3));
  round.forEach((q) => assert.equal(q.table, 7));
});

test('single table round covers all 10 multipliers', () => {
  const round = L.buildRound([6], 10, seeded(8));
  assert.deepEqual(round.map((q) => q.b).sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('multiple choice: options stay within 1..100 for all facts', () => {
  for (let s = 1; s <= 200; s++) {
    L.TABLES.forEach((a) => L.TABLES.forEach((b) => {
      L.multipleChoice(L.makeQuestion(a, b, false), seeded(s * 100 + a * 10 + b)).forEach((o) => {
        assert.ok(Number.isInteger(o) && o >= 1 && o <= 100, `${a}×${b}: ${o}`);
      });
    }));
  }
});

test('stars: 2 stars needs at least 10 attempts', () => {
  const stats = {};
  let s = null;
  for (let i = 0; i < 9; i++) s = L.updateFact(s, true, 5000);
  stats[L.factKey(4, 3)] = s;
  assert.equal(L.computeStars(stats, 4, false, true), 1);
  stats[L.factKey(4, 3)] = L.updateFact(s, true, 5000);
  assert.equal(L.computeStars(stats, 4, false, true), 2);
});

test('stars: below 80% correct stays at 1 star', () => {
  let s = null;
  for (let i = 0; i < 7; i++) s = L.updateFact(s, true, 5000);
  for (let i = 0; i < 3; i++) s = L.updateFact(s, false, 5000);
  assert.equal(L.computeStars({ '4x5': s }, 4, false, true), 1);
});

test('streak: crosses month and year boundaries', () => {
  let s = L.updateStreak(null, new Date(2026, 0, 31));
  s = L.updateStreak(s, new Date(2026, 1, 1));
  assert.equal(s.count, 2);
  let y = L.updateStreak(null, new Date(2026, 11, 31));
  y = L.updateStreak(y, new Date(2027, 0, 1));
  assert.equal(y.count, 2);
});

test('dateKey is zero-padded local date', () => {
  assert.equal(L.dateKey(new Date(2026, 2, 5)), '2026-03-05');
});

test('hardest: slow but correct facts are listed, fast correct ones are not', () => {
  const stats = {
    '6x8': { attempts: 3, correct: 3, totalMs: 15000, level: 2 },
    '2x3': { attempts: 3, correct: 3, totalMs: 3000, level: 3 }
  };
  assert.deepEqual(L.hardest(stats, 10).map((f) => f.key), ['6x8']);
});

test('updateFact never exceeds max level or goes below 1 after an attempt', () => {
  let s = null;
  for (let i = 0; i < 50; i++) {
    s = L.updateFact(s, i % 7 !== 0, (i % 3) * 2000);
    assert.ok(s.level >= 1 && s.level <= L.MAX_LEVEL);
  }
});

test('smart round with fully mastered stats still returns 20 questions', () => {
  const stats = {};
  L.TABLES.forEach((a) => L.TABLES.forEach((b) => {
    stats[L.factKey(a, b)] = { attempts: 5, correct: 5, totalMs: 2000, level: 5 };
  }));
  const r = L.smartRound(stats, 20, seeded(4));
  assert.equal(r.length, 20);
  assert.equal(L.smartRound(stats, 20, seeded(4), L.TABLES).length, 20);
});
