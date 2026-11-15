// A logged-out visitor's result, kept on the device. The server stores nothing about them,
// so this is what lets the result card survive a reload. Logged-in players never need it.

import type { RunResult } from '../../shared/api.ts';

const key = (day: number): string => `tebar.result.${day}`;

export function readLocalResult(day: number): RunResult | null {
  try {
    const raw = localStorage.getItem(key(day));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { line, score } = value as { line?: unknown; score?: unknown };
    if (
      !Array.isArray(line) ||
      !line.every((n) => Number.isInteger(n)) ||
      typeof score !== 'number'
    ) {
      return null;
    }
    return { line, score };
  } catch {
    return null;
  }
}

export function saveLocalResult(day: number, result: RunResult): void {
  try {
    localStorage.setItem(key(day), JSON.stringify(result));
  } catch {
    // Storage can be unavailable. The result then lasts for this visit only.
  }
}
