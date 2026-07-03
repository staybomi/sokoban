import { useReducer, useEffect, useState, useCallback, useRef } from 'react';
import { LEVELS } from './levels.js';
import {
  parseLevel,
  move,
  isSolved,
  appleDropCells,
  APPLE_DROP_CHANCE,
} from './game.js';
import { loadApples, saveApples } from './supabase.js';
import Board from './components/Board.jsx';

const STORAGE_KEY = 'cave-sokoban-progress';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ---------------- 진행 상황 저장 ---------------- */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        unlocked: clamp(p.unlocked ?? 0, 0, LEVELS.length - 1),
        completed: Array.isArray(p.completed) ? p.completed : [],
        last: clamp(p.last ?? 0, 0, LEVELS.length - 1),
      };
    }
  } catch {
    /* 무시하고 초기값 사용 */
  }
  return { unlocked: 0, completed: [], last: 0 };
}

/* ---------------- 게임 상태 (useReducer) ---------------- */
// applesSeed: 주운 사과 개수는 레벨/새로고침을 넘어 누적되는 인벤토리이므로
// 새 레벨을 시작할 때도 0으로 되돌리지 않고 이전 값을 이어받는다.
function initGame(levelIndex, applesSeed = 0) {
  const { staticData, state } = parseLevel(LEVELS[levelIndex].rows);
  return {
    levelIndex,
    staticData,
    player: state.player,
    boxes: state.boxes,
    dir: 'down',
    apples: [],                  // 바닥에 떨어져 있는 사과들 { id, r, c }
    applesCollected: applesSeed, // 주운 사과 개수 (전역 누적, Supabase 저장)
    nextAppleId: 0,              // 사과 React key용 (단조 증가)
    history: [],
    moves: 0,
    won: false,
  };
}

function reducer(game, action) {
  switch (action.type) {
    case 'LOAD':
      // 레벨을 바꿔도 누적 사과 개수는 유지한다.
      return initGame(action.levelIndex, game.applesCollected);
    case 'RESTART':
      // 다시하기도 사과 인벤토리는 유지한다.
      return initGame(game.levelIndex, game.applesCollected);
    case 'SET_APPLES':
      // Supabase 에서 불러온 저장값으로 현재 사과 개수를 맞춘다.
      return { ...game, applesCollected: action.count };
    case 'UNDO': {
      if (game.history.length === 0) return game;
      const prev = game.history[game.history.length - 1];
      return {
        ...game,
        player: prev.player,
        boxes: prev.boxes,
        dir: prev.dir,
        apples: prev.apples,
        applesCollected: prev.applesCollected,
        history: game.history.slice(0, -1),
        moves: game.moves - 1,
        won: false,
      };
    }
    case 'MOVE': {
      if (game.won) return game;
      const next = move(
        { player: game.player, boxes: game.boxes },
        game.staticData,
        action.dir
      );
      if (!next) return game; // 벽/상자에 막힘 — 변화 없음

      // 도착한 칸에 사과가 있으면 줍는다 (개수 +1)
      let apples = game.apples;
      let applesCollected = game.applesCollected;
      const landedKey = `${next.player.r},${next.player.c}`;
      const picked = apples.findIndex((a) => `${a.r},${a.c}` === landedKey);
      if (picked !== -1) {
        apples = apples.filter((_, i) => i !== picked);
        applesCollected += 1;
      }

      // 이동할 때 10% 확률로 빈 바닥에 사과가 떨어진다.
      // 무작위 값은 dispatch 시점에 만들어 넘기므로 reducer는 순수하게 유지된다.
      let nextAppleId = game.nextAppleId;
      if (action.roll < APPLE_DROP_CHANCE) {
        const cells = appleDropCells(
          { player: next.player, boxes: next.boxes, apples },
          game.staticData
        );
        if (cells.length > 0) {
          const cell = cells[Math.floor(action.pick * cells.length)];
          apples = [...apples, { id: nextAppleId, r: cell.r, c: cell.c }];
          nextAppleId += 1;
        }
      }

      return {
        ...game,
        player: next.player,
        boxes: next.boxes,
        dir: action.dir,
        apples,
        applesCollected,
        nextAppleId,
        history: [
          ...game.history,
          {
            player: game.player,
            boxes: game.boxes,
            dir: game.dir,
            apples: game.apples,
            applesCollected: game.applesCollected,
          },
        ],
        moves: game.moves + 1,
        won: isSolved(next, game.staticData),
      };
    }
    default:
      return game;
  }
}

/* ---------------- D-패드 ---------------- */
function Dpad({ onMove }) {
  const press = (dir) => (e) => {
    e.preventDefault();
    onMove(dir);
  };
  return (
    <div className="dpad">
      <button className="up" onClick={press('up')} aria-label="위로">↑</button>
      <button className="left" onClick={press('left')} aria-label="왼쪽으로">←</button>
      <button className="down" onClick={press('down')} aria-label="아래로">↓</button>
      <button className="right" onClick={press('right')} aria-label="오른쪽으로">→</button>
    </div>
  );
}

/* ---------------- 단계 선택 ---------------- */
function LevelSelect({ progress, current, onPick, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>단계 선택</h2>
        <p className="sub">클리어한 다음 단계까지 열려요</p>
        <div className="level-grid">
          {LEVELS.map((lvl, i) => {
            const locked = i > progress.unlocked;
            const done = progress.completed.includes(i);
            const isCurrent = i === current;
            return (
              <button
                key={i}
                className={`level-cell${locked ? ' locked' : ''}${
                  isCurrent ? ' current' : ''
                }`}
                disabled={locked}
                onClick={() => onPick(i)}
                title={lvl.name}
              >
                {locked ? <span className="lock">🔒</span> : i + 1}
                {done && <span className="check">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="row">
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 클리어 오버레이 ---------------- */
function WinOverlay({ moves, isLast, onNext, onRetry }) {
  return (
    <div className="overlay">
      <div className="modal">
        <div className="clear-emoji">{isLast ? '🏆' : '🎉'}</div>
        <h2>{isLast ? '모든 단계 클리어!' : '단계 클리어!'}</h2>
        <p className="sub">
          {isLast
            ? `${moves}번 이동으로 동굴을 정복했어요`
            : `${moves}번 이동으로 성공!`}
        </p>
        <div className="row">
          <button className="btn" onClick={onRetry}>다시하기</button>
          {!isLast && (
            <button className="btn primary" onClick={onNext}>다음 단계 →</button>
          )}
        </div>
        <p className="key-hint">
          {isLast ? 'Enter ⏎ 다시하기' : 'Enter ⏎ 다음 단계 · R 다시하기'}
        </p>
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [game, dispatch] = useReducer(reducer, progress.last, initGame);
  const [showSelect, setShowSelect] = useState(false);
  const [cell, setCell] = useState(40);
  // Supabase 초기 로드가 끝나기 전에는 저장하지 않도록 하는 플래그
  // (초기값 0 이 저장된 값을 덮어쓰는 것을 방지)
  const applesLoaded = useRef(false);

  // 무작위 값(사과 낙하 여부·위치)을 여기서 만들어 액션에 실어 보낸다 → reducer는 순수.
  const moveDir = useCallback(
    (dir) =>
      dispatch({ type: 'MOVE', dir, roll: Math.random(), pick: Math.random() }),
    []
  );
  const goNext = useCallback(() => {
    if (game.levelIndex + 1 < LEVELS.length) {
      dispatch({ type: 'LOAD', levelIndex: game.levelIndex + 1 });
    }
  }, [game.levelIndex]);

  /* 반응형 셀 크기 계산 */
  useEffect(() => {
    const { width, height } = game.staticData;
    const calc = () => {
      const maxW = Math.min(window.innerWidth - 28, 600);
      const maxH = Math.max(window.innerHeight * 0.52, 220);
      const c = clamp(Math.floor(Math.min(maxW / width, maxH / height)), 20, 56);
      setCell(c);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [game.staticData]);

  /* 키보드 조작 */
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) {
        e.preventDefault();
      }
      // 클리어 오버레이가 떠 있을 때: Enter/Space = 다음 단계(마지막 단계면 다시하기)
      if (game.won) {
        if (k === 'Enter' || k === ' ') {
          e.preventDefault(); // 포커스된 버튼의 중복 클릭 방지
          if (game.levelIndex + 1 < LEVELS.length) goNext();
          else dispatch({ type: 'RESTART' });
        } else if (k === 'r' || k === 'R') {
          dispatch({ type: 'RESTART' });
        } else if (['z', 'Z', 'u', 'U', 'Backspace'].includes(k)) {
          dispatch({ type: 'UNDO' }); // 마지막 수 무르기 — 오버레이도 닫힌다
        }
        return;
      }
      switch (k) {
        case 'ArrowUp': case 'w': case 'W': moveDir('up'); break;
        case 'ArrowDown': case 's': case 'S': moveDir('down'); break;
        case 'ArrowLeft': case 'a': case 'A': moveDir('left'); break;
        case 'ArrowRight': case 'd': case 'D': moveDir('right'); break;
        case 'z': case 'Z': case 'u': case 'U': case 'Backspace': dispatch({ type: 'UNDO' }); break;
        case 'r': case 'R': dispatch({ type: 'RESTART' }); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveDir, game.won, game.levelIndex, goNext]);

  /* 마지막 진행 단계 기록 */
  useEffect(() => {
    setProgress((p) =>
      p.last === game.levelIndex ? p : { ...p, last: game.levelIndex }
    );
  }, [game.levelIndex]);

  /* 클리어 시 다음 단계 해금 + 완료 표시 */
  useEffect(() => {
    if (!game.won) return;
    setProgress((p) => {
      const completed = p.completed.includes(game.levelIndex)
        ? p.completed
        : [...p.completed, game.levelIndex];
      const unlocked = Math.max(
        p.unlocked,
        Math.min(game.levelIndex + 1, LEVELS.length - 1)
      );
      if (completed === p.completed && unlocked === p.unlocked) return p;
      return { ...p, completed, unlocked };
    });
  }, [game.won, game.levelIndex]);

  /* 진행 상황 영속화 */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [progress]);

  /* 사과 개수: 시작 시 Supabase 에서 불러오기 (새로고침해도 유지) */
  useEffect(() => {
    let alive = true;
    loadApples()
      .then((count) => {
        if (alive && count > 0) dispatch({ type: 'SET_APPLES', count });
      })
      .finally(() => {
        applesLoaded.current = true;
      });
    return () => {
      alive = false;
    };
  }, []);

  /* 사과 개수가 바뀔 때마다 Supabase 에 저장 (초기 로드 이후에만) */
  useEffect(() => {
    if (!applesLoaded.current) return;
    saveApples(game.applesCollected);
  }, [game.applesCollected]);

  const isLast = game.levelIndex + 1 >= LEVELS.length;
  // "6단계 · 동굴 광장" → 뱃지 번호(levelIndex+1)와 이름을 분리해 크리스탈 명판에 나눠 담는다
  const levelName = LEVELS[game.levelIndex].name.split('·').pop().trim();

  return (
    <div className="app">
      <h1 className="title">
        <span className="pick">⛏️</span> 동굴 소코반
      </h1>

      <div className="hud">
        {/* 보드의 청록 크리스탈 목표와 운을 맞춘 레벨 뱃지 */}
        <div className="badge">
          <span className="n">{game.levelIndex + 1}</span>
        </div>
        <div className="who">
          <div className="label">단계</div>
          <div className="name">{levelName}</div>
        </div>
        <div className="rule" />
        <div className="stat">
          <div className="label">이동</div>
          <div className="value">{game.moves}</div>
        </div>
        <div className="rule" />
        <div className="stat apple">
          <div className="label">사과</div>
          <div className="value">
            🍎
            <b key={game.applesCollected} className="apple-count">
              {game.applesCollected}
            </b>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn" onClick={() => setShowSelect(true)}>
          단계 선택
        </button>
        <button
          className="btn"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={game.history.length === 0}
        >
          되돌리기
        </button>
        <button className="btn" onClick={() => dispatch({ type: 'RESTART' })}>
          다시하기
        </button>
      </div>

      <Board game={game} cell={cell} onSwipe={moveDir} />

      <Dpad onMove={moveDir} />

      <p className="hint">
        방향키 · WASD · 스와이프로 이동 &nbsp;|&nbsp; Z 되돌리기 · R 다시하기
      </p>

      {game.won && (
        <WinOverlay
          moves={game.moves}
          isLast={isLast}
          onNext={goNext}
          onRetry={() => dispatch({ type: 'RESTART' })}
        />
      )}

      {showSelect && (
        <LevelSelect
          progress={progress}
          current={game.levelIndex}
          onPick={(i) => {
            dispatch({ type: 'LOAD', levelIndex: i });
            setShowSelect(false);
          }}
          onClose={() => setShowSelect(false)}
        />
      )}
    </div>
  );
}
