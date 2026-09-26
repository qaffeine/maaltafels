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
