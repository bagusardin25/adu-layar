import './styles/theme.css';
import './styles/base.css';
import './styles/game.css';

import { requestExpandedMode } from '@devvit/web/client';
import { useEffect, useMemo, useState } from 'react';
import { dayLabel, dayNumber } from '../shared/days.ts';
import { kampungNews } from '../shared/kampung.ts';
import { nameOf } from '../shared/kite.ts';
import { skyForDay } from '../shared/sim/sky.ts';
import { Arena } from './arena/Arena.tsx';
import { lookOf } from './arena/design.ts';
import { loadMood } from './arena/mood.ts';
import { Wordmark } from './bits.tsx';
import type { FightView } from './lib/fight.ts';
import { windLabel } from './lib/labels.ts';
import { mount } from './lib/mount.tsx';
import { quickProfile } from './lib/profile.ts';

/** The card in the feed: the day's sky playing itself, and one way in. */
export function Splash() {
  const [day] = useState(() => dayNumber(Date.now()));
  const fallback = useMemo(() => skyForDay(day), [day]);
  const [fight, setFight] = useState<FightView | null>(null);
  const sky = fight?.sky ?? fallback;
  const [mood] = useState(loadMood);
  const [player] = useState(() => {
    const p = quickProfile();
    return { look: lookOf(p.design), name: nameOf(p.name) };
  });

  useEffect(() => {
    let current = true;
    fetch('/api/fight')
      .then((res) => (res.ok ? (res.json() as Promise<FightView>) : null))
      .then((view) => {
        if (current && view) setFight(view);
      })
      .catch(() => {
        // The card keeps the day's wind until the fight arrives.
      });
    return () => {
      current = false;
    };
  }, []);

  const king = fight?.king;
  const fliers = fight?.fliers ?? 0;

  return (
    <main className="splash">
      <Arena sky={sky} mode="attract" mood={mood} player={player} />
      <div className="splash__overlay">
        <div>
          <Wordmark />
          <p className="splash__pitch">Fly your kite. Cut their strings.</p>
        </div>
        <div className="splash__foot">
          <p className="splash__meta">
            Day {day} · {dayLabel(day)}
            {king
              ? ` · Raja Langit ${king.name}`
              : ` · ${windLabel(sky.windX)}`}
          </p>
          <p className="splash__meta">
            {fight
              ? [
                  fliers === 0
                    ? 'Be the first to fly today'
                    : `${fliers} ${fliers === 1 ? 'flyer' : 'flyers'} today`,
                  fight.kampungs ? kampungNews(fight.kampungs) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Raising today’s sky…'}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
          >
            Play
          </button>
        </div>
      </div>
    </main>
  );
}

mount(<Splash />);
