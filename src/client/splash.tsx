import './styles/theme.css';
import './styles/base.css';
import './styles/game.css';

import { requestExpandedMode } from '@devvit/web/client';
import { useMemo, useState } from 'react';
import { dayLabel, dayNumber } from '../shared/days.ts';
import { skyForDay } from '../shared/sim/sky.ts';
import { Arena } from './arena/Arena.tsx';
import { lookOf } from './arena/design.ts';
import { loadMood } from './arena/mood.ts';
import { nameOf } from '../shared/kite.ts';
import { quickProfile } from './lib/profile.ts';
import { Wordmark } from './bits.tsx';
import { windLabel } from './lib/labels.ts';
import { mount } from './lib/mount.tsx';

/** The card in the feed: the day's sky playing itself, and one way in. */
export function Splash() {
  const [day] = useState(() => dayNumber(Date.now()));
  const sky = useMemo(() => skyForDay(day), [day]);
  const [mood] = useState(loadMood);
  const [player] = useState(() => {
    const p = quickProfile();
    return { look: lookOf(p.design), name: nameOf(p.name) };
  });

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
            Day {day} · {dayLabel(day)} · {sky.rivals.length} rivals ·{' '}
            {windLabel(sky.windX)}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
          >
            Fly today’s sky
          </button>
        </div>
      </div>
    </main>
  );
}

mount(<Splash />);
