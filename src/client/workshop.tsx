// The workshop: where a player makes their kite their own, picks the name they fly under, and
// spends coins on looks. Every choice comes from a list and shows on the kite straight away.
// Things that cost coins can be tried on first; closing the workshop keeps only what is owned.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  COLOURS,
  itemOf,
  LINES,
  missingItems,
  MOTIFS,
  nameOf,
  NICKS,
  randomName,
  SHAPES,
  TAILS,
  TITLES,
} from '../shared/kite.ts';
import type { ColourId, ItemId, Option, Profile } from '../shared/kite.ts';
import { lookOf } from './arena/design.ts';
import { Coin } from './bits.tsx';
import { KitePreview, KiteThumb, PartThumb } from './kite-art.tsx';
import type { WalletView } from './lib/wallet.ts';

type Part = 'main' | 'trim';
type Tab = 'kite' | 'colour' | 'extras';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'kite', label: 'Kite' },
  { id: 'colour', label: 'Colour' },
  { id: 'extras', label: 'Tail & string' },
];

/** Steps through a list with arrows, wrapping round at the ends. */
function Stepper<Id extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option<Id>[];
  value: Id;
  onChange: (id: Id) => void;
}) {
  const at = Math.max(
    0,
    options.findIndex((o) => o.id === value)
  );
  const move = (by: number) =>
    onChange(options[(at + by + options.length) % options.length].id);
  const shown = options[at].label || 'None';
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__arrow"
        aria-label={`Previous ${label.toLowerCase()}`}
        onClick={() => move(-1)}
      >
        <Chevron flip />
      </button>
      <output className="stepper__value" aria-live="polite">
        {shown}
      </output>
      <button
        type="button"
        className="stepper__arrow"
        aria-label={`Next ${label.toLowerCase()}`}
        onClick={() => move(1)}
      >
        <Chevron />
      </button>
    </div>
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M6 3l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Dice() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="2.5"
        y="2.5"
        width="15"
        height="15"
        rx="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" />
      <circle cx="13" cy="13" r="1.4" fill="currentColor" />
      <circle cx="13" cy="7" r="1.4" fill="currentColor" />
      <circle cx="7" cy="13" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** A choice card: a picture, a label, and the price while it is not owned. */
function Choice({
  picked,
  price,
  label,
  onPick,
  children,
}: {
  picked: boolean;
  /** Coins it costs, or null when it is free or already owned. */
  price: number | null;
  label: string;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="choice"
      aria-pressed={picked}
      aria-label={price === null ? label : `${label}, ${price} coins`}
      onClick={onPick}
    >
      {children}
      <span>{label}</span>
      {price !== null && (
        <span className="choice__price" aria-hidden="true">
          <Coin size={10} />
          {price}
        </span>
      )}
    </button>
  );
}

export function Workshop({
  profile,
  wallet,
  canKeep,
  onChange,
  onBuy,
  onDone,
}: {
  profile: Profile;
  wallet: WalletView | null;
  /** Whether the kite can be kept on the player's Reddit account (they are logged in). */
  canKeep: boolean;
  onChange: (profile: Profile) => void;
  /** Buys an item; resolves to null when bought, or to the reason it was not. */
  onBuy: (item: ItemId) => Promise<string | null>;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>('kite');
  const [part, setPart] = useState<Part>('main');
  const [buying, setBuying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const done = useRef<HTMLButtonElement>(null);
  const { design, name } = profile;
  const look = lookOf(design);
  const owned = wallet?.owned ?? [];
  const coins = wallet && !wallet.guest ? wallet.coins : null;

  const finish = useRef(onDone);
  useEffect(() => {
    finish.current = onDone;
  });
  // Focus lands on Done when the workshop opens, and Escape closes it.
  useEffect(() => {
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setDesign = (change: Partial<Profile['design']>) => {
    setProblem(null);
    onChange({ ...profile, design: { ...design, ...change } });
  };
  const setName = (change: Partial<Profile['name']>) =>
    onChange({ ...profile, name: { ...name, ...change } });
  const paint = (colour: ColourId) =>
    setDesign(part === 'main' ? { main: colour } : { trim: colour });
  /** The price to show on a choice: null when it is free or owned. */
  const priceOf = (id: ItemId): number | null => {
    const item = itemOf(id);
    return item && !owned.includes(item.id) ? item.price : null;
  };

  // Something tried on but not owned: offer to buy it.
  const trying = missingItems(design, owned)
    .map((id) => itemOf(id))
    .find((i) => i !== undefined);
  const buy = async () => {
    if (!trying) return;
    setBuying(true);
    setProblem(await onBuy(trying.id));
    setBuying(false);
  };

  return (
    <div className="overlay overlay--workshop">
      <section
        className="workshop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workshop-title"
      >
        <header className="workshop__head">
          <h2 id="workshop-title" className="workshop__title">
            Your kite
          </h2>
          {coins !== null && (
            <span className="coins" aria-label={`${coins} coins`}>
              <Coin size={16} />
              {coins}
            </span>
          )}
          <button
            ref={done}
            type="button"
            className="btn btn--primary workshop__done"
            onClick={onDone}
          >
            Done
          </button>
        </header>

        <div className="workshop__preview">
          <KitePreview look={look} />
          <p className="workshop__name">{nameOf(name)}</p>
        </div>

        <div className="namer" role="group" aria-label="Name">
          <Stepper
            label="Title"
            options={TITLES}
            value={name.title}
            onChange={(title) => setName({ title })}
          />
          <Stepper
            label="Nickname"
            options={NICKS}
            value={name.nick}
            onChange={(nick) => setName({ nick })}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Random name"
            title="Random name"
            onClick={() => onChange({ ...profile, name: randomName() })}
          >
            <Dice />
          </button>
        </div>

        <div className="tabs" role="tablist" aria-label="What to change">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="tabs__tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="workshop__panel" role="tabpanel">
          {tab === 'kite' && (
            <>
              <div className="field">
                <p className="field__label">Shape</p>
                <div className="choices choices--3">
                  {SHAPES.map((s) => (
                    <Choice
                      key={s.id}
                      picked={design.shape === s.id}
                      price={null}
                      label={s.label}
                      onPick={() => setDesign({ shape: s.id })}
                    >
                      <KiteThumb look={{ ...look, shape: s.id }} size={30} />
                    </Choice>
                  ))}
                </div>
              </div>
              <div className="field">
                <p className="field__label">Pattern</p>
                <div className="choices choices--4">
                  {MOTIFS.map((m) => (
                    <Choice
                      key={m.id}
                      picked={design.motif === m.id}
                      price={priceOf(`motif:${m.id}`)}
                      label={m.label}
                      onPick={() => setDesign({ motif: m.id })}
                    >
                      <KiteThumb look={{ ...look, motif: m.id }} size={28} />
                    </Choice>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'colour' && (
            <div className="field">
              <div className="field__row">
                <p className="field__label">Colour</p>
                <div
                  className="seg"
                  role="group"
                  aria-label="Which part to colour"
                >
                  <button
                    type="button"
                    className="seg__btn"
                    aria-pressed={part === 'main'}
                    onClick={() => setPart('main')}
                  >
                    Body
                  </button>
                  <button
                    type="button"
                    className="seg__btn"
                    aria-pressed={part === 'trim'}
                    onClick={() => setPart('trim')}
                  >
                    Pattern
                  </button>
                </div>
              </div>
              <div
                className="swatches"
                role="group"
                aria-label={part === 'main' ? 'Body colour' : 'Pattern colour'}
              >
                {COLOURS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="swatch-btn"
                    style={{ background: c.hex }}
                    aria-label={c.label}
                    title={c.label}
                    aria-pressed={design[part] === c.id}
                    onClick={() => paint(c.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'extras' && (
            <>
              <div className="field">
                <p className="field__label">Tail</p>
                <div className="choices choices--4">
                  {TAILS.map((t) => (
                    <Choice
                      key={t.id}
                      picked={design.tail === t.id}
                      price={priceOf(`tail:${t.id}`)}
                      label={t.label}
                      onPick={() => setDesign({ tail: t.id })}
                    >
                      <PartThumb
                        look={{ ...look, tail: t.id }}
                        part="tail"
                        size={44}
                      />
                    </Choice>
                  ))}
                </div>
              </div>
              <div className="field">
                <p className="field__label">String</p>
                <div className="choices choices--4">
                  {LINES.map((l) => (
                    <Choice
                      key={l.id}
                      picked={design.line === l.id}
                      price={priceOf(`line:${l.id}`)}
                      label={l.label}
                      onPick={() => setDesign({ line: l.id })}
                    >
                      <PartThumb
                        look={{ ...look, line: l.id }}
                        part="line"
                        size={44}
                      />
                    </Choice>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {trying ? (
          <div className="buy" aria-live="polite">
            <p className="buy__what">
              <strong>{trying.label}</strong>
              <span>
                {problem ??
                  (!canKeep || coins === null
                    ? 'Log in to Reddit to buy it.'
                    : coins < trying.price
                      ? `You need ${trying.price - coins} more coins.`
                      : 'Trying it on. Buy it to keep it.')}
              </span>
            </p>
            {canKeep && coins !== null && (
              <button
                type="button"
                className="btn btn--primary buy__btn"
                disabled={buying || coins < trying.price}
                onClick={() => void buy()}
              >
                <Coin size={14} />
                Buy {trying.price}
              </button>
            )}
          </div>
        ) : (
          <p className="workshop__note">
            {canKeep
              ? 'Earn coins from your first 3 flights each day.'
              : 'Kept on this device. Log in to Reddit to keep it and earn coins.'}
          </p>
        )}
      </section>
    </div>
  );
}
