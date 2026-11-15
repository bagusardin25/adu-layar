// The slice of Redis the game uses. Devvit's `redis` client fits this shape as it is; tests and
// the local preview use the in-memory version in memoryStore.ts.

export type ZMember = { member: string; score: number };

export type Store = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<unknown>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  del(...keys: string[]): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  incrBy(key: string, value: number): Promise<number>;

  hGet(key: string, field: string): Promise<string | undefined>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<unknown>;
  /** Sets the field only if it is not there yet. Resolves to 1 when it was set, 0 otherwise. */
  hSetNX(key: string, field: string, value: string): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;
  hDel(key: string, fields: string[]): Promise<unknown>;

  zAdd(key: string, ...members: ZMember[]): Promise<unknown>;
  zIncrBy(key: string, member: string, value: number): Promise<number>;
  zCard(key: string): Promise<number>;
  zScore(key: string, member: string): Promise<number | undefined>;
  /** Members by rank, lowest score first, or highest first with `reverse`. `stop` is inclusive. */
  zRange(
    key: string,
    start: number,
    stop: number,
    options: { by: 'rank'; reverse?: boolean }
  ): Promise<ZMember[]>;
};
