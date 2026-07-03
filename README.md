# ⛏️ 동굴 소코반 (Cave Sokoban)

[prd.md](./prd.md)를 기반으로 만든 React 소코반 퍼즐 게임. 동굴 테마, 부드러운 이동 애니메이션, 1~10단계로 구성되어 있다.

## 실행 방법

```bash
npm install        # 의존성 설치
npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # 프로덕션 빌드 → dist/
npm run preview    # 빌드 결과 미리보기
```

## 조작

| 동작 | 키보드 | 모바일 |
| --- | --- | --- |
| 이동 | 방향키 / WASD | 화면 스와이프 · 하단 D-패드 |
| 되돌리기 | Z · U · Backspace | 「되돌리기」 버튼 |
| 다시하기 | R | 「다시하기」 버튼 |
| 단계 선택 | — | 「단계 선택」 버튼 |

## 구현된 기능 (PRD 대응)

- **1~10단계** — 상자 수와 동선이 점진적으로 늘어 난이도 상승
- **동굴 테마** — 돌벽/바닥, 빛나는 목표 지점, 나무 상자, 헤드램프를 켠 탐험가
- **부드러운 애니메이션** — 칸 단위가 아닌 미끄러지는 이동 (CSS transform 전환)
- **되돌리기 / 다시하기 / 단계 선택**
- **진행 상황 저장** — `localStorage`에 해금 단계·클리어 기록·마지막 단계 저장
- **한 손 조작** — 스와이프 + 하단 D-패드 (버스·지하철 이용 시나리오)

## 구조

```
src/
  game.js              순수 게임 로직 (레벨 파싱, 이동, 클리어 판정)
  levels.js            10개 레벨 데이터
  App.jsx              상태 관리(useReducer) · 입력 · 진행 저장 · 오버레이
  components/Board.jsx 보드 렌더링 · 스와이프 입력
  index.css            동굴 테마 스타일
scripts/
  validate-levels.mjs  모든 레벨이 풀 수 있는지 검증하는 솔버
```

## 레벨 검증

모든 레벨은 풀이 가능 여부를 솔버로 검증했다.

```bash
node scripts/validate-levels.mjs
```
