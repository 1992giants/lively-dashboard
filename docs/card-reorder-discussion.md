# 카드 순서 자유 이동 — 설계 논의

## 배경

현재 카드 순서는 HTML에 하드코딩되어 있다.
사용자가 자신의 업무 우선순위에 맞게 카드를 재배치하고 싶다는 요구.

대상 카드: **오늘 일정 / 빠른 링크 / D-day 타이머** (할일, 메모, 헤더 제외)

---

## 제약 조건

| 항목 | 내용 |
|------|------|
| 환경 | CEF (Chromium Embedded Framework), file:/// |
| 금지 | drag & drop (CEF에서 불안정) |
| 금지 | 외부 라이브러리 추가 |
| 유지 | 기존 `data-card` 속성 기반 visibleCards 구조 |
| 유지 | `card-full-width` 카드(메모)는 항상 전폭 고정 |

---

## 방안 비교

### 방안 A — 위/아래 이동 버튼 (링크 카드와 동일 방식)

카드 우측 상단에 ▲ ▼ 버튼 표시 (편집 모드에서만).
`state.settings.cardOrder = ["schedule", "todos", "dday", "memo", "links"]` 배열로 순서 저장.
렌더링 시 배열 순서대로 카드 DOM을 재배치.

**장점:**
- 이미 링크 카드에서 동일 패턴 구현됨 → 코드 일관성
- CEF 완벽 호환
- 구현 단순 (배열 index 교환)

**단점:**
- 카드 간 이동마다 ▲▼ 2번 클릭 필요 (느림)
- 그리드 3컬럼 레이아웃에서 "한 칸 이동"이 열(column) 이동인지 행(row) 이동인지 불명확

**구현 예시:**
```js
// state에 추가
cardOrder: ["schedule", "todos", "dday", "memo", "links"]

// 렌더링 시
function applyCardOrder() {
  const grid = document.querySelector('.grid');
  state.settings.cardOrder.forEach(cardId => {
    const el = grid.querySelector(`[data-card="${cardId}"]`);
    if (el) grid.appendChild(el); // 순서대로 재삽입
  });
}
```

---

### 방안 B — 설정 패널 내 순서 편집 (드래그 없이)

설정 모달 "카드" 탭에 카드 목록을 표시.
각 항목에 ▲ ▼ 버튼 → 저장 후 적용.

**장점:**
- 메인 화면 UI 오염 없음
- 설정 모달에 이미 카드 관리 탭 존재 → 자연스러운 위치
- 순서 변경이 "설정"으로 명확히 분리됨

**단점:**
- 결과를 바로 볼 수 없음 (설정 닫은 후 확인)
- 설정 탭 UI가 복잡해짐

**구현 예시:**
```js
// 설정 탭 "카드" 섹션에 카드 목록 + 순서 버튼 추가
// 저장 버튼 클릭 시 state.settings.cardOrder 업데이트 → renderAll()
```

---

### 방안 C — 편집 모드에서 카드 헤더 클릭 후 위치 선택

편집 모드에서 카드 제목 클릭 → "여기로 이동" 드롭다운 표시.
`[1번째 위치] [2번째 위치] [3번째 위치]` 선택.

**장점:**
- 직관적 UX

**단점:**
- 구현 복잡
- CEF에서 드롭다운 위치 계산 이슈 가능성

---

## 권장 방안

**방안 A + B 혼합:**
1. `state.settings.cardOrder` 배열로 순서 관리
2. 편집 모드에서 각 카드 우측 상단에 ▲▼ 버튼 (즉시 적용)
3. 설정 패널 카드 탭에도 동일 순서 반영 (확인 및 수정 가능)

---

## 구현 범위

### state 변경
```js
// getDefaultState()에 추가
settings: {
  ...
  cardOrder: ["schedule", "todos", "dday", "memo", "links"]
}
```

### validateState() 추가
```js
if (!Array.isArray(s.settings.cardOrder)) {
  s.settings.cardOrder = def.settings.cardOrder;
}
```

### 새 함수
```js
// 카드 순서 DOM 적용
function applyCardOrder() { ... }

// 카드 이동 (dir: -1 위로, +1 아래로)
function moveCard(cardId, dir) {
  const order = state.settings.cardOrder;
  const idx = order.indexOf(cardId);
  if (idx < 0) return;
  const target = idx + dir;
  if (target < 0 || target >= order.length) return;
  [order[idx], order[target]] = [order[target], order[idx]];
  saveState();
  applyCardOrder();
}
```

### CSS 추가
```css
/* 편집 모드에서 카드 이동 버튼 */
.card-move-btn {
  background: transparent; border: none;
  color: var(--text-muted); font-size: 0.7rem;
  cursor: pointer; padding: 3px 5px; border-radius: 6px;
}
.card-move-btn:hover:not(:disabled) {
  background: var(--surface-hover); color: var(--text-main);
}
.card-move-btn:disabled { opacity: 0.2; cursor: default; }
```

### HTML 변경
- 각 카드 `.card-title` 옆에 `.card-move-btns` 추가 (edit-only 클래스)

---

## 주의사항

- `card-full-width` 카드(메모)는 이동 시 항상 전폭 유지
- statusPanel (기본 숨김)은 순서 배열에서 제외
- 헤더/summaryBar는 이동 대상 아님
- 3컬럼 레이아웃에서 이동은 "배열 순서" 기준 (좌→우→다음행 순서)

---

## 작업 우선순위

다른 안정화 작업 완료 후 진행 권장.
예상 작업량: app.js 50줄, style.css 20줄, index.html 각 카드 버튼 추가.
