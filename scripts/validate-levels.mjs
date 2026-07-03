// 각 레벨의 풀이 가능 여부를 push 기반 탐색으로 검증한다.
// (플레이어의 단순 이동은 도달영역으로 정규화하여 상태공간을 크게 줄인다.)
// 실행: node scripts/validate-levels.mjs
import { LEVELS } from '../src/levels.js';

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function parse(rows) {
  const walls = new Set();
  const goals = new Set();
  const boxes = [];
  let player = null;
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      const k = `${r},${c}`;
      if (ch === '#') walls.add(k);
      else if (ch === '.') goals.add(k);
      else if (ch === '@') player = [r, c];
      else if (ch === '+') { player = [r, c]; goals.add(k); }
      else if (ch === '$') boxes.push([r, c]);
      else if (ch === '*') { boxes.push([r, c]); goals.add(k); }
    }
  });
  return { walls, goals, boxes, player };
}

const K = (r, c) => `${r},${c}`;

// 현재 박스 배치에서 플레이어가 도달 가능한 모든 칸을 flood fill.
// 정규화 대표값(가장 작은 칸)과 도달 집합을 반환.
function reachable(walls, boxSet, start) {
  const seen = new Set();
  const stack = [start];
  seen.add(K(start[0], start[1]));
  let rep = start;
  while (stack.length) {
    const [r, c] = stack.pop();
    if (r < rep[0] || (r === rep[0] && c < rep[1])) rep = [r, c];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      const nk = K(nr, nc);
      if (seen.has(nk)) continue;
      if (walls.has(nk) || boxSet.has(nk)) continue;
      seen.add(nk);
      stack.push([nr, nc]);
    }
  }
  return { rep, seen };
}

function boxesKey(boxes) {
  return boxes.map(([r, c]) => K(r, c)).sort().join('|');
}

// 목표가 아닌 단순 코너 데드락 가지치기
function cornerDeadlock(walls, goals, r, c) {
  if (goals.has(K(r, c))) return false;
  const up = walls.has(K(r - 1, c));
  const down = walls.has(K(r + 1, c));
  const left = walls.has(K(r, c - 1));
  const right = walls.has(K(r, c + 1));
  return (up && left) || (up && right) || (down && left) || (down && right);
}

function solve(level) {
  const { walls, goals, boxes, player } = parse(level.rows);
  const allOnGoal = (bs) => bs.every(([r, c]) => goals.has(K(r, c)));
  if (allOnGoal(boxes)) return { solved: true, pushes: 0 };

  const startBoxSet = new Set(boxes.map(([r, c]) => K(r, c)));
  const { rep: startRep } = reachable(walls, startBoxSet, player);

  const visited = new Set();
  const queue = [{ boxes, rep: startRep, pushes: 0 }];
  visited.add(`${K(startRep[0], startRep[1])}#${boxesKey(boxes)}`);

  let explored = 0;
  const LIMIT = 3_000_000;

  while (queue.length) {
    const cur = queue.shift();
    explored++;
    if (explored > LIMIT) return { solved: false, reason: 'limit', explored };

    const boxSet = new Set(cur.boxes.map(([r, c]) => K(r, c)));
    const { seen: reach } = reachable(walls, boxSet, cur.rep);

    for (let bi = 0; bi < cur.boxes.length; bi++) {
      const [br, bc] = cur.boxes[bi];
      for (const [dr, dc] of DIRS) {
        const fromR = br - dr;
        const fromC = bc - dc; // 플레이어가 서야 할 칸
        const toR = br + dr;
        const toC = bc + dc; // 박스가 밀려갈 칸
        if (!reach.has(K(fromR, fromC))) continue; // 플레이어가 못 감
        const toK = K(toR, toC);
        if (walls.has(toK) || boxSet.has(toK)) continue; // 막힘
        if (cornerDeadlock(walls, goals, toR, toC)) continue;

        const newBoxes = cur.boxes.map((b, i) => (i === bi ? [toR, toC] : b));
        if (allOnGoal(newBoxes)) {
          return { solved: true, pushes: cur.pushes + 1, explored };
        }
        const newBoxSet = new Set(newBoxes.map(([r, c]) => K(r, c)));
        const { rep } = reachable(walls, newBoxSet, [br, bc]); // 민 뒤 플레이어 위치
        const stateKey = `${K(rep[0], rep[1])}#${boxesKey(newBoxes)}`;
        if (visited.has(stateKey)) continue;
        visited.add(stateKey);
        queue.push({ boxes: newBoxes, rep, pushes: cur.pushes + 1 });
      }
    }
  }
  return { solved: false, reason: 'exhausted', explored };
}

let allOk = true;
for (let i = 0; i < LEVELS.length; i++) {
  const lvl = LEVELS[i];
  const res = solve(lvl);
  const status = res.solved ? 'OK ' : 'FAIL';
  if (!res.solved) allOk = false;
  console.log(
    `[${status}] ${String(i + 1).padStart(2)} ${lvl.name}  ` +
      (res.solved
        ? `최소 ${res.pushes}번 밀기 (탐색 ${res.explored ?? 0})`
        : `(${res.reason}, 탐색 ${res.explored})`)
  );
}

console.log(allOk ? '\n✅ 모든 레벨 풀이 가능' : '\n❌ 풀 수 없는 레벨이 있습니다');
process.exit(allOk ? 0 : 1);
