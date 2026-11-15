import { useEffect, useId, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { SOUTH } from '../../shared/rules.ts';
import type { Board as Cells } from '../../shared/rules.ts';
import { SIZE, STORE } from '../../shared/puzzle.ts';
import { useWidth } from '../lib/prefs.ts';
import {
  canonicalLayout,
  geometry,
  HOLE_R,
  holeSeedOffsets,
  matrix,
  PITCH,
  STORE_RX,
  STORE_RY,
  storeSeedOffsets,
} from './geometry.ts';
import type { Geometry, Orientation } from './geometry.ts';
import type { SowFrame } from './useSowing.ts';

export type BoardProps = {
  board: Cells;
  frame?: SowFrame | null;
  /** Holes (0-based, on your side) that can be picked now. */
  playable?: readonly number[];
  /** The hole currently chosen, waiting to be sown. */
  selected?: number | undefined;
  /** The cell where the chosen hole's first lap ends. */
  landing?: number | undefined;
  onSelect?: (hole: number) => void;
  /** Called when the board is tapped while seeds are being sown. */
  onSkip?: () => void;
  /** The best score any line reaches, written in the far store. */
  goal?: number | undefined;
  /** Force an orientation; by default narrow containers get the upright board. */
  orientation?: Orientation;
  label: string;
};

// Narrower than this, the board stands upright so the holes stay large enough to touch.
const TALL_BELOW = 600;
const FAR_STORE = 15;

export function Board(props: BoardProps) {
  const {
    board,
    frame,
    playable,
    selected,
    landing,
    onSelect,
    onSkip,
    goal,
    label,
  } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const orientation: Orientation =
    props.orientation ??
    // Before the first measurement, the window is the best guess: no flip on load.
    ((width > 0 ? width : window.innerWidth) < TALL_BELOW ? 'tall' : 'wide');
  const geo = useMemo(() => geometry(SIZE, orientation, SOUTH), [orientation]);
  const layout = useMemo(() => canonicalLayout(SIZE), []);
  const id = useId().replace(/:/g, '');
  const shown = frame?.board ?? board;
  const playableSet = new Set(playable ?? []);

  // ── the seed in the air ──
  const flyer = useRef<SVGGElement>(null);
  const flight = frame?.flight;
  useEffect(() => {
    const el = flyer.current;
    if (!el || !flight) return;
    const a = geo.center(flight.from);
    const b = geo.center(flight.to);
    const lift = Math.min(60, 26 + Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
    const anim = el.animate(
      [
        { transform: `translate(${a.x}px, ${a.y}px) scale(1)`, opacity: 1 },
        {
          transform: `translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2 - lift}px) scale(1.45)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(${b.x}px, ${b.y}px) scale(1)`, opacity: 0.2 },
      ],
      { duration: 140, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }
    );
    return () => anim.cancel();
  }, [flight, geo]);

  const style = {
    '--board-ratio': String(geo.width / geo.height),
  } as CSSProperties;

  const pathSet = new Set(frame?.path ?? []);
  const active = frame?.active;
  const selectedCell = selected === undefined || frame ? undefined : selected;
  const landingCell = landing === undefined || frame ? undefined : landing;

  return (
    <div
      ref={wrap}
      className={`board board--${orientation}`}
      style={style}
      role="group"
      aria-label={label}
    >
      <div className="board__frame" onClick={frame ? onSkip : undefined}>
        <svg
          className="board__svg"
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${id}teak`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#A2683B" />
              <stop offset="0.5" stopColor="#7E4C2A" />
              <stop offset="1" stopColor="#5E361B" />
            </linearGradient>
            <radialGradient id={`${id}cup`} cx="0.5" cy="0.38" r="0.62">
              <stop offset="0" stopColor="#140B05" />
              <stop offset="0.6" stopColor="#25150A" />
              <stop offset="0.88" stopColor="#3B2312" />
              <stop offset="1" stopColor="#53321A" />
            </radialGradient>
            <linearGradient id={`${id}lip`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3A200E" />
              <stop offset="1" stopColor="#C38B57" />
            </linearGradient>
            <radialGradient id={`${id}seed`} cx="0.36" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#FFFBF1" />
              <stop offset="0.45" stopColor="#EFE4CC" />
              <stop offset="1" stopColor="#C4AF86" />
            </radialGradient>
          </defs>

          {/* The carved body, drawn once in the canonical frame and turned into place. */}
          <g transform={matrix(geo.transform)}>
            <rect
              x="6"
              y="6"
              width={layout.width - 12}
              height={layout.height - 12}
              rx={layout.height / 2 - 6}
              fill={`url(#${id}teak)`}
            />
            {[0.2, 0.33, 0.47, 0.6, 0.74, 0.86].map((f, i) => (
              <path
                key={f}
                d={`M 70 ${layout.height * f} C ${layout.width * 0.3} ${layout.height * f - 7 + i * 2}, ${layout.width * 0.62} ${layout.height * f + 8 - i}, ${layout.width - 70} ${layout.height * f - 2}`}
                fill="none"
                stroke="#3E220F"
                strokeOpacity="0.2"
                strokeWidth="1.4"
              />
            ))}
            <rect
              x="18"
              y="18"
              width={layout.width - 36}
              height={layout.height - 36}
              rx={layout.height / 2 - 18}
              fill="none"
              stroke="#3A1F0D"
              strokeOpacity="0.55"
              strokeWidth="2"
            />
            <Kawung x={layout.width / 2} y={layout.mid} />
            {layout.stores.map((s) => (
              <g key={s.cell}>
                <ellipse
                  cx={s.x}
                  cy={s.y}
                  rx={STORE_RX + 4}
                  ry={STORE_RY + 4}
                  fill={`url(#${id}lip)`}
                  opacity="0.85"
                />
                <ellipse
                  cx={s.x}
                  cy={s.y}
                  rx={STORE_RX}
                  ry={STORE_RY}
                  fill={`url(#${id}cup)`}
                />
              </g>
            ))}
            {layout.holes.map((h) => (
              <g key={h.cell}>
                <circle
                  cx={h.x}
                  cy={h.y}
                  r={HOLE_R + 3.5}
                  fill={`url(#${id}lip)`}
                  opacity="0.85"
                />
                <circle cx={h.x} cy={h.y} r={HOLE_R} fill={`url(#${id}cup)`} />
              </g>
            ))}
          </g>

          {/* Marks: what can be picked, what is chosen, where the hand is, the path it took. */}
          <g className="board__marks">
            {!frame &&
              [...playableSet].map((hole) => {
                if (hole === selectedCell) return null;
                const c = geo.center(hole);
                return (
                  <circle
                    key={`p${hole}`}
                    className="mark mark--playable"
                    cx={c.x}
                    cy={c.y}
                    r={HOLE_R + 7}
                  />
                );
              })}
            {selectedCell !== undefined && (
              <circle
                className="mark mark--selected"
                cx={geo.center(selectedCell).x}
                cy={geo.center(selectedCell).y}
                r={HOLE_R + 8}
              />
            )}
            {landingCell !== undefined && (
              <LandingMark cell={landingCell} geo={geo} />
            )}
            {geo.cells.map((cell) =>
              pathSet.has(cell) && cell !== active ? (
                <circle
                  key={`t${cell}`}
                  className="mark mark--path"
                  cx={geo.center(cell).x}
                  cy={geo.center(cell).y}
                  r={isStore(cell) ? 30 : HOLE_R + 7}
                />
              ) : null
            )}
            {frame?.capture && (
              <>
                <circle
                  className="mark mark--capture"
                  cx={geo.center(frame.capture.cell).x}
                  cy={geo.center(frame.capture.cell).y}
                  r={HOLE_R + 7}
                />
                <circle
                  className="mark mark--capture"
                  cx={geo.center(frame.capture.from).x}
                  cy={geo.center(frame.capture.from).y}
                  r={HOLE_R + 7}
                />
              </>
            )}
            {active !== undefined && (
              <circle
                className="mark mark--active"
                cx={geo.center(active).x}
                cy={geo.center(active).y}
                r={isStore(active) ? 34 : HOLE_R + 8}
              />
            )}
          </g>

          {/* Seeds. */}
          <g className="board__seeds">
            {geo.cells.map((cell) => {
              const c = geo.center(cell);
              const offsets = isStore(cell)
                ? storeSeedOffsets(cell, shown[cell])
                : holeSeedOffsets(cell, shown[cell]);
              return offsets.map((o, k) => {
                const v = geo.vector(o.dx, o.dy);
                const x = c.x + v.x;
                const y = c.y + v.y;
                return (
                  <ellipse
                    key={`${cell}-${k}`}
                    cx={x}
                    cy={y}
                    rx="7.6"
                    ry="5.9"
                    transform={`rotate(${o.rot} ${x} ${y})`}
                    fill={`url(#${id}seed)`}
                    stroke="#7E6A48"
                    strokeWidth="0.7"
                  />
                );
              });
            })}
          </g>

          {/* Counts. */}
          <g className="board__counts">
            {geo.cells.map((cell) => {
              const p = geo.label(cell);
              const n = shown[cell];
              if (cell === FAR_STORE) return null;
              return cell === STORE ? (
                <g key={`n${cell}`}>
                  <rect
                    x={p.x - 27}
                    y={p.y - 17}
                    width="54"
                    height="34"
                    rx="17"
                    className="count-plate"
                  />
                  <text x={p.x} y={p.y + 1} className="count count--store">
                    {n}
                  </text>
                </g>
              ) : (
                <text
                  key={`n${cell}`}
                  x={p.x}
                  y={p.y + 1}
                  className={`count${n === 0 ? ' count--zero' : ''}`}
                >
                  {n}
                </text>
              );
            })}
          </g>

          {/* The far store is never sown in this game. It holds the score to beat. */}
          {goal !== undefined && <Goal geo={geo} goal={goal} />}

          {/* The hand: how many seeds are still to be sown. */}
          {active !== undefined && frame && frame.hand > 0 && (
            <Hand geo={geo} cell={active} count={frame.hand} />
          )}

          <g ref={flyer} className="board__flyer" style={{ opacity: 0 }}>
            {flight && (
              <ellipse
                cx="0"
                cy="0"
                rx="8.5"
                ry="6.6"
                fill={`url(#${id}seed)`}
                stroke="#7E6A48"
                strokeWidth="0.7"
              />
            )}
          </g>
        </svg>

        {/* Your holes as real buttons, laid over the drawing. */}
        <div className="board__holes">
          {Array.from({ length: SIZE }, (_, hole) => {
            const c = geo.center(hole);
            const canPick = !frame && playableSet.has(hole) && !!onSelect;
            const count = shown[hole];
            const pos: CSSProperties = {
              left: `${((c.x - PITCH / 2) / geo.width) * 100}%`,
              top: `${((c.y - PITCH / 2) / geo.height) * 100}%`,
              width: `${(PITCH / geo.width) * 100}%`,
              height: `${(PITCH / geo.height) * 100}%`,
            };
            return (
              <button
                key={hole}
                type="button"
                className="hole-btn"
                style={pos}
                disabled={!canPick}
                aria-pressed={hole === selectedCell}
                aria-label={`Your hole ${hole + 1}, ${count} ${count === 1 ? 'seed' : 'seeds'}`}
                onClick={() => canPick && onSelect?.(hole)}
              />
            );
          })}
        </div>
      </div>
      <p className="sr-only">
        {`Your store holds ${shown[STORE]}. `}
        {`Your holes, 1 to ${SIZE}: ${shown.slice(0, SIZE).join(', ')}. `}
        {`Far holes, 1 to ${SIZE}: ${shown.slice(8, 8 + SIZE).join(', ')}.`}
        {goal !== undefined ? ` The best possible score is ${goal}.` : ''}
      </p>
    </div>
  );
}

const isStore = (cell: number): boolean => cell === STORE || cell === FAR_STORE;

function Kawung({ x, y }: { x: number; y: number }) {
  return (
    <g fill="none" stroke="#3A1F0D" strokeOpacity="0.6" strokeWidth="1.6">
      <ellipse cx={x} cy={y - 12} rx={6} ry={11} />
      <ellipse cx={x} cy={y + 12} rx={6} ry={11} />
      <ellipse cx={x - 12} cy={y} rx={11} ry={6} />
      <ellipse cx={x + 12} cy={y} rx={11} ry={6} />
      <circle
        cx={x}
        cy={y}
        r={2}
        fill="#3A1F0D"
        fillOpacity="0.6"
        stroke="none"
      />
    </g>
  );
}

function LandingMark({ cell, geo }: { cell: number; geo: Geometry }) {
  const c = geo.center(cell);
  return (
    <g className="landing">
      <circle
        className="mark mark--landing"
        cx={c.x}
        cy={c.y}
        r={isStore(cell) ? 34 : HOLE_R + 8}
      />
      <circle className="landing__dot" cx={c.x} cy={c.y} r="6" />
    </g>
  );
}

function Goal({ geo, goal }: { geo: Geometry; goal: number }) {
  const c = geo.center(FAR_STORE);
  return (
    <g className="goal">
      <text x={c.x} y={c.y - 16} className="goal__caption">
        BEST
      </text>
      <text x={c.x} y={c.y + 13} className="goal__number">
        {goal}
      </text>
    </g>
  );
}

function Hand({
  geo,
  cell,
  count,
}: {
  geo: Geometry;
  cell: number;
  count: number;
}) {
  const c = geo.center(cell);
  // Towards the middle of the board, between the rows.
  const v = isStore(cell)
    ? geo.vector(0, -STORE_RY + 22)
    : geo.vector(0, cell < 8 ? -55 : 55);
  const x = c.x + v.x;
  const y = c.y + v.y;
  return (
    <g className="hand">
      <circle cx={x} cy={y} r="18" />
      <text x={x} y={y + 1}>
        {count}
      </text>
    </g>
  );
}
