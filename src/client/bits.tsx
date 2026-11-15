/** The mark: a red-and-white fighter kite. */
export function KiteMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="kite-mark"
      width={size}
      height={size * 1.3}
      viewBox="0 0 30 39"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 1 L28 15 L15 30 Z" fill="#D7263D" />
      <path d="M15 1 L2 15 L15 30 Z" fill="#FFFFFF" />
      <path
        d="M15 1 L15 30 M2 15 Q15 8 28 15"
        fill="none"
        stroke="#3a1a10"
        strokeWidth="1.2"
      />
      <path
        d="M15 30 q3 3 0 5 q-3 2 0 4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/** A coin: the game's only currency, earned by flying and spent on looks. */
export function Coin({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="coin"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="7.2" fill="#F2C230" stroke="#B07A2A" />
      <circle
        cx="8"
        cy="8"
        r="4.8"
        fill="none"
        stroke="#B07A2A"
        strokeWidth="0.9"
      />
      <path d="M8 4.6 L10.4 8 L8 11.4 L5.6 8 Z" fill="#B07A2A" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <KiteMark />
      Adu Layangan
    </span>
  );
}
