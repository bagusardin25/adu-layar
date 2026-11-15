import type { Store, ZMember } from './store.ts';

/**
 * A Store kept in memory, for tests and the local preview. It records which keys were given an
 * expiry, so tests can check that nothing about a player is kept forever.
 */
export function createMemoryStore(): Store & {
  expiries: Map<string, number>;
  keys(): string[];
} {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const zsets = new Map<string, Map<string, number>>();
  const expiries = new Map<string, number>();

  const hash = (key: string): Map<string, string> => {
    let h = hashes.get(key);
    if (!h) hashes.set(key, (h = new Map()));
    return h;
  };
  const zset = (key: string): Map<string, number> => {
    let z = zsets.get(key);
    if (!z) zsets.set(key, (z = new Map()));
    return z;
  };

  return {
    expiries,
    keys: () => [...strings.keys(), ...hashes.keys(), ...zsets.keys()],

    async get(key) {
      return strings.get(key);
    },
    async set(key, value) {
      strings.set(key, value);
    },
    async mGet(keys) {
      return keys.map((k) => strings.get(k) ?? null);
    },
    async del(...keys) {
      for (const k of keys) {
        strings.delete(k);
        hashes.delete(k);
        zsets.delete(k);
        expiries.delete(k);
      }
    },
    async expire(key, seconds) {
      expiries.set(key, seconds);
    },
    async incrBy(key, value) {
      const next = Number(strings.get(key) ?? 0) + value;
      strings.set(key, String(next));
      return next;
    },

    async hGet(key, field) {
      return hashes.get(key)?.get(field);
    },
    async hSet(key, fieldValues) {
      const h = hash(key);
      for (const [f, v] of Object.entries(fieldValues)) h.set(f, v);
    },
    async hSetNX(key, field, value) {
      const h = hash(key);
      if (h.has(field)) return 0;
      h.set(field, value);
      return 1;
    },
    async hGetAll(key) {
      return Object.fromEntries(hashes.get(key) ?? []);
    },
    async hIncrBy(key, field, value) {
      const h = hash(key);
      const next = Number(h.get(field) ?? 0) + value;
      h.set(field, String(next));
      return next;
    },
    async hDel(key, fields) {
      const h = hashes.get(key);
      for (const f of fields) h?.delete(f);
    },

    async zAdd(key, ...members) {
      const z = zset(key);
      for (const m of members) z.set(m.member, m.score);
    },
    async zIncrBy(key, member, value) {
      const z = zset(key);
      const next = (z.get(member) ?? 0) + value;
      z.set(member, next);
      return next;
    },
    async zCard(key) {
      return zsets.get(key)?.size ?? 0;
    },
    async zScore(key, member) {
      return zsets.get(key)?.get(member);
    },
    async zRange(key, start, stop, options) {
      const all: ZMember[] = [...(zsets.get(key) ?? [])].map(
        ([member, score]) => ({ member, score })
      );
      // Redis orders equal scores by member name.
      all.sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : 1));
      if (options.reverse) all.reverse();
      const end = stop < 0 ? all.length + stop + 1 : stop + 1;
      return all.slice(start, end);
    },
  };
}
