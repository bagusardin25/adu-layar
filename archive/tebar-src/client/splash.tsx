import './styles/theme.css';
import './styles/base.css';
import './styles/board.css';
import './styles/game.css';

import { requestExpandedMode } from '@devvit/web/client';
import type { BoardResponse } from '../shared/api.ts';
import { dayLabel } from '../shared/days.ts';
import { starsFor } from '../shared/puzzle.ts';
import { LevelChip, StarRow, Wordmark } from './bits.tsx';
import { Board } from './board/Board.tsx';
import { readLocalResult } from './lib/localResult.ts';
import { mount } from './lib/mount.tsx';
import { useBoard } from './lib/useBoard.ts';

/** The card shown in the feed: what the game is, the post's board, one way in. */
export function Splash() {
  const state = useBoard();
  const board = state.status === 'ready' ? state.board : null;

  return (
    <main className="splash">
      <header className="splash__head">
        <Wordmark />
        {board && (
          <p className="splash__day">
            <span className="num">Day {board.day}</span> · {dayLabel(board.day)}
          </p>
        )}
      </header>

      <p className="splash__pitch">
        {board ? `${board.picks} picks. ` : ''}Sow the seeds, relay, capture.
        How many can you bring home?
      </p>

      <div className="splash__board">
        {board ? (
          <Board
            board={board.cells}
            goal={board.perfect}
            orientation="wide"
            label={`The board for day ${board.day}`}
          />
        ) : (
          <p
            className="waiting__note"
            role={state.status === 'failed' ? 'alert' : undefined}
          >
            {state.status === 'failed'
              ? state.message
              : 'Setting out today’s seeds…'}
          </p>
        )}
      </div>

      <div className="splash__foot">
        {board ? <Standing board={board} /> : <span />}
        <button
          type="button"
          className="btn btn--primary splash__play"
          onClick={(e) =>
            state.status === 'failed'
              ? state.retry()
              : requestExpandedMode(e.nativeEvent, 'game')
          }
        >
          {state.status === 'failed' ? 'Try again' : playLabel(board)}
        </button>
      </div>
    </main>
  );
}

function resultOf(board: BoardResponse) {
  return (
    board.result ??
    (board.player.name === null ? readLocalResult(board.day) : null)
  );
}

function playLabel(board: BoardResponse | null): string {
  if (!board) return 'Play';
  if (board.day !== board.today) return 'Open this board';
  return resultOf(board) ? 'Open the board' : 'Play today’s board';
}

/** One line under the board: the player's result, or how many have played. */
function Standing({ board }: { board: BoardResponse }) {
  const result = resultOf(board);
  if (result) {
    return (
      <p className="splash__result">
        <StarRow stars={starsFor(result.score, board.perfect)} />
        <span className="num">
          You brought home {result.score} of {board.perfect}
        </span>
      </p>
    );
  }
  if (board.day !== board.today)
    return <span className="chip chip--explore">Past board</span>;
  return (
    <p className="splash__result">
      <LevelChip level={board.level} />
      {board.stats.players > 0 && (
        <span className="num">
          {board.stats.players}{' '}
          {board.stats.players === 1 ? 'player' : 'players'} today
        </span>
      )}
    </p>
  );
}

mount(<Splash />);
