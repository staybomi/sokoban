// 순수 게임 로직 (렌더링과 분리)
//
// 레벨 문자 규칙 (표준 소코반 포맷):
//   #  벽 (wall)
//   (공백)  바닥 (floor)
//   .  목표 지점 (goal)
//   @  플레이어 (player)
//   +  목표 위 플레이어 (player on goal)
//   $  상자 (box)
//   *  목표 위 상자 (box on goal)

export const DIRECTIONS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export const TILE = { WALL: 'wall', FLOOR: 'floor', GOAL: 'goal' };

export const key = (r, c) => `${r},${c}`;

export function parseLevel(rows) {
  const walls = new Set();
  const goals = new Set();
  const boxes = [];
  let player = null;
  let width = 0;
  let boxId = 0;

  rows.forEach((row, r) => {
    width = Math.max(width, row.length);
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      const k = key(r, c);
      switch (ch) {
        case '#':
          walls.add(k);
          break;
        case '.':
          goals.add(k);
          break;
        case '@':
          player = { r, c };
          break;
        case '+':
          player = { r, c };
          goals.add(k);
          break;
        case '$':
          boxes.push({ id: boxId++, r, c });
          break;
        case '*':
          boxes.push({ id: boxId++, r, c });
          goals.add(k);
          break;
        default:
          break; // 공백 등 = 바닥
      }
    }
  });

  return {
    staticData: { walls, goals, width, height: rows.length },
    state: { player, boxes, dir: 'down' },
  };
}

export function tileAt(staticData, r, c) {
  const k = key(r, c);
  if (staticData.walls.has(k)) return TILE.WALL;
  if (staticData.goals.has(k)) return TILE.GOAL;
  return TILE.FLOOR;
}

// 한 칸 이동 시도. 이동 가능하면 새 상태 { player, boxes }를 반환,
// 벽/상자에 막혀 움직일 수 없으면 null 반환.
export function move(state, staticData, dir) {
  const d = DIRECTIONS[dir];
  if (!d) return null;

  const { player, boxes } = state;
  const tr = player.r + d.dr;
  const tc = player.c + d.dc;
  const targetKey = key(tr, tc);

  // 벽에 막힘
  if (staticData.walls.has(targetKey)) return null;

  const boxIdx = boxes.findIndex((b) => b.r === tr && b.c === tc);

  if (boxIdx !== -1) {
    // 상자를 미는 경우 — 상자 너머 칸을 확인
    const br = tr + d.dr;
    const bc = tc + d.dc;
    const beyondKey = key(br, bc);

    if (staticData.walls.has(beyondKey)) return null; // 벽이 막음
    if (boxes.some((b) => b.r === br && b.c === bc)) return null; // 다른 상자가 막음

    const newBoxes = boxes.map((b, i) =>
      i === boxIdx ? { ...b, r: br, c: bc } : b
    );
    return { player: { r: tr, c: tc }, boxes: newBoxes };
  }

  // 빈 칸으로 이동
  return { player: { r: tr, c: tc }, boxes };
}

export function isSolved(state, staticData) {
  return state.boxes.every((b) => staticData.goals.has(key(b.r, b.c)));
}

// 이동 1회당 사과가 바닥에 떨어질 확률
export const APPLE_DROP_CHANCE = 0.1;

// 지금 사과가 떨어질 수 있는 칸들을 반환한다.
// 플레이어가 실제로 도달할 수 있는 빈 바닥만 후보로 삼는다
// (벽 · 상자 · 목표 · 기존 사과 · 플레이어가 선 칸은 제외).
export function appleDropCells(state, staticData) {
  const { walls, goals, width, height } = staticData;
  const { player, boxes } = state;
  const apples = state.apples || [];

  const blocked = new Set(boxes.map((b) => key(b.r, b.c))); // 상자가 길을 막음
  const taken = new Set(apples.map((a) => key(a.r, a.c)));  // 이미 사과가 있는 칸

  // 플레이어 기준으로 닿을 수 있는 영역을 BFS로 훑는다.
  const seen = new Set([key(player.r, player.c)]);
  const queue = [player];
  const cells = [];

  while (queue.length) {
    const { r, c } = queue.shift();
    for (const d of Object.values(DIRECTIONS)) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nc < 0 || nr >= height || nc >= width) continue;
      const k = key(nr, nc);
      if (seen.has(k) || walls.has(k) || blocked.has(k)) continue;
      seen.add(k);
      queue.push({ r: nr, c: nc });
      // 목표 칸과 사과가 이미 놓인 칸은 후보에서 뺀다.
      if (!goals.has(k) && !taken.has(k)) cells.push({ r: nr, c: nc });
    }
  }
  return cells;
}
