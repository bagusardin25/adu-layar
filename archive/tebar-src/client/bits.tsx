import type { Level } from '../shared/generator.ts';
import type { Stars } from '../shared/puzzle.ts';

/** The Tebar mark: seeds in the air, on their way into a hole. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="mark-logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="21.5"
        cy="22"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <ellipse
        cx="5.5"
        cy="21"
        rx="2.6"
        ry="1.9"
        transform="rotate(-70 5.5 21)"
        fill="currentColor"
      />
      <ellipse
        cx="7.5"
        cy="11.5"
        rx="3"
        ry="2.2"
        transform="rotate(-45 7.5 11.5)"
        fill="currentColor"
      />
      <ellipse
        cx="15"
        cy="5.5"
        rx="3.4"
        ry="2.5"
        transform="rotate(-15 15 5.5)"
        fill="currentColor"
      />
      <ellipse
        cx="21.5"
        cy="22"
        rx="3"
        ry="2.2"
        transform="rotate(30 21.5 22)"
        fill="currentColor"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark />
      Tebar
    </span>
  );
}

const LEVEL_NAME: Record<Level, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

export function LevelChip({ level }: { level: Level }) {
  return <span className={`chip chip--${level}`}>{LEVEL_NAME[level]}</span>;
}

/** One kawung flower, the four-petal batik motif carved on the board. Tebar's star. */
function Flower({ lit }: { lit: boolean }) {
  return (
    <svg
      className={`flower${lit ? ' flower--lit' : ''}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="20" cy="10.5" rx="5.6" ry="9" />
      <ellipse cx="20" cy="29.5" rx="5.6" ry="9" />
      <ellipse cx="10.5" cy="20" rx="9" ry="5.6" />
      <ellipse cx="29.5" cy="20" rx="9" ry="5.6" />
    </svg>
  );
}

export function StarRow({ stars }: { stars: Stars }) {
  return (
    <span className="stars" role="img" aria-label={`${stars} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <Flower key={n} lit={n <= stars} />
      ))}
    </span>
  );
}

/** One pip per pick; spent picks are hollow. */
export function Pips({ total, left }: { total: number; left: number }) {
  return (
    <span
      className="pips"
      role="img"
      aria-label={`${left} of ${total} picks left`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`pip${i < total - left ? ' pip--spent' : ''}`}
        />
      ))}
    </span>
  );
}
