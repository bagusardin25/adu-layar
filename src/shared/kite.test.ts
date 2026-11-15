import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COLOURS,
  defaultProfile,
  itemOf,
  keepOwned,
  LINES,
  missingItems,
  SHOP,
  TAILS,
  MOTIFS,
  nameOf,
  NICKS,
  parseProfile,
  randomProfile,
  SHAPES,
  TITLES,
} from './kite.ts';
import { random } from './sim/random.ts';

test('every list has unique ids, and colours are real colours', () => {
  for (const list of [SHAPES, MOTIFS, COLOURS, TITLES, NICKS, TAILS, LINES]) {
    const ids = list.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  for (const c of COLOURS) assert.match(c.hex, /^#[0-9A-F]{6}$/);
});

test('every name fits under a kite', () => {
  for (const title of TITLES)
    for (const nick of NICKS) {
      const name = nameOf({ title: title.id, nick: nick.id });
      assert.ok(name.length <= 14, name);
      assert.equal(name, name.trim());
    }
  assert.equal(nameOf({ title: 'none', nick: 'petir' }), 'Petir');
  assert.equal(nameOf({ title: 'bang', nick: 'petir' }), 'Bang Petir');
});

test('an account always starts with the same kite, and accounts differ', () => {
  assert.deepEqual(defaultProfile('t2_ani'), defaultProfile('t2_ani'));
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const p = defaultProfile(`t2_user${i}`);
    assert.deepEqual(parseProfile(p), p, 'a starting kite is a valid kite');
    assert.notEqual(p.design.main, p.design.trim, 'its motif shows');
    seen.add(JSON.stringify(p));
  }
  assert.ok(seen.size > 35);
});

test('only known choices make a kite', () => {
  const good = randomProfile(random(7));
  assert.deepEqual(parseProfile(good), good);
  assert.equal(parseProfile(null), null);
  assert.equal(parseProfile([]), null);
  assert.equal(parseProfile({ design: good.design }), null);
  assert.equal(
    parseProfile({ ...good, name: { ...good.name, nick: 'Free text' } }),
    null
  );
  assert.equal(
    parseProfile({ ...good, design: { ...good.design, shape: 'box' } }),
    null
  );
  assert.equal(
    parseProfile({ ...good, design: { ...good.design, main: '#FFFFFF' } }),
    null
  );
  const cleaned = parseProfile({
    ...good,
    extra: 1,
    name: { ...good.name, more: 2 },
  });
  assert.deepEqual(cleaned, good);
});

test('the shop sells only looks, each with a price, and starting kites are free', () => {
  const ids = SHOP.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of SHOP) {
    assert.ok(item.price > 0, item.id);
    assert.match(item.id, /^(motif|tail|line):/);
  }
  for (let i = 0; i < 50; i++) {
    const p = randomProfile(random(i));
    assert.deepEqual(missingItems(p.design, []), [], 'nothing to buy');
  }
  assert.equal(itemOf('motif:kawung'), undefined, 'free patterns are not sold');
});

test('kites saved before tails and strings existed get the plain ones', () => {
  const old = {
    design: { shape: 'aduan', motif: 'kawung', main: 'biru', trim: 'putih' },
    name: { title: 'bang', nick: 'petir' },
  };
  const p = parseProfile(old);
  assert.equal(p?.design.tail, 'pita');
  assert.equal(p?.design.line, 'biasa');
  assert.equal(
    parseProfile({ ...old, design: { ...old.design, tail: 'jetpack' } }),
    null
  );
});

test('closing the workshop keeps only what the player owns', () => {
  const before = randomProfile(random(3)).design;
  const tried = {
    ...before,
    motif: 'pelangi',
    tail: 'lampion',
    line: 'emas',
  } as const;
  assert.deepEqual(missingItems(tried, ['tail:lampion']), [
    'motif:pelangi',
    'line:emas',
  ]);
  const kept = keepOwned(tried, before, ['tail:lampion']);
  assert.equal(kept.motif, before.motif);
  assert.equal(kept.tail, 'lampion');
  assert.equal(kept.line, before.line);
});
