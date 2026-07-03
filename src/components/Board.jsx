import { useRef } from 'react';
import { key } from '../game.js';

const SWIPE_THRESHOLD = 22;

export default function Board({ game, cell, onSwipe }) {
  const { staticData, boxes, player, dir, apples, moves } = game;
  const { walls, goals, width, height } = staticData;
  const startRef = useRef(null);

  const handleTouchStart = (e) => {
    const t = e.changedTouches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e) => {
    const s = startRef.current;
    if (!s) return;
    startRef.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < SWIPE_THRESHOLD) return;
    if (ax > ay) onSwipe(dx > 0 ? 'right' : 'left');
    else onSwipe(dy > 0 ? 'down' : 'up');
  };

  // 정적 타일 (벽 / 바닥 / 목표)
  const tiles = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const k = key(r, c);
      let cls = 'tile floor';
      if (walls.has(k)) cls = 'tile wall';
      else if (goals.has(k)) cls = 'tile goal';
      tiles.push(
        <div
          key={k}
          className={cls}
          style={{
            width: cell,
            height: cell,
            transform: `translate(${c * cell}px, ${r * cell}px)`,
          }}
        />
      );
    }
  }

  return (
    <div className="board-wrap">
      <div
        className="board"
        style={{ width: width * cell, height: height * cell }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {tiles}

        {apples.map((a) => (
          <div
            key={a.id}
            className="entity apple"
            style={{
              width: cell,
              height: cell,
              transform: `translate(${a.c * cell}px, ${a.r * cell}px)`,
            }}
          >
            <span className="apple-emoji" style={{ fontSize: cell * 0.6 }}>
              🍎
            </span>
          </div>
        ))}

        {boxes.map((b) => {
          const onGoal = goals.has(key(b.r, b.c));
          return (
            <div
              key={b.id}
              className={`entity box${onGoal ? ' on-goal' : ''}`}
              style={{
                width: cell,
                height: cell,
                transform: `translate(${b.c * cell}px, ${b.r * cell}px)`,
              }}
            />
          );
        })}

        <div
          className={`entity player dir-${dir}`}
          style={{
            width: cell,
            height: cell,
            transform: `translate(${player.c * cell}px, ${player.r * cell}px)`,
          }}
        >
          {/* 바깥 div는 slide, 안쪽 body는 발걸음(스텝) 모션 담당.
             이동할 때마다 key(=moves)가 바뀌어 스텝 애니메이션이 다시 재생된다. */}
          <span key={moves} className="player-body" />
        </div>
      </div>
    </div>
  );
}
