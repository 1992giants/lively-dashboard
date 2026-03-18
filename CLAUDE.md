# Lively 업무 대시보드 — CLAUDE.md

## 프로젝트 개요

Windows 바탕화면 위에 떠 있는 **생산성 대시보드 위젯**.
Lively Wallpaper 앱이 CEF(Chromium Embedded Framework)로 이 HTML 페이지를 렌더링한다.
서버 없음, npm 없음, 빌드 없음. 순수 HTML + CSS + Vanilla JS + localStorage.

**실행 경로**: `...wptmp/1w4miwuf.k5g/index.html`
**GitHub**: https://github.com/1992giants/lively-dashboard

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `index.html` | 마크업 (7개 카드 + 설정 모달 4탭) |
| `app.js` | 상태 관리, 렌더링, 이벤트 바인딩 전체 |
| `style.css` | CSS 변수 기반 스타일, 라이트/다크 테마 |
| `LivelyProperties.json` | Lively 패널 노출 속성 정의 (읽기 전용 참고) |
| `LivelyInfo.json` | 앱 메타데이터 (수정 불필요) |

---

## CEF 환경 제약 — 반드시 지켜야 할 규칙

| 금지 패턴 | 이유 | 대체 방법 |
|----------|------|---------|
| `alert()` / `confirm()` | CEF에서 차단될 수 있음 | `showToast()` / `requireConfirm()` |
| `URL.createObjectURL` + `a.click()` | 다운로드 미지원 가능 | try-catch 후 textarea fallback |
| `navigator.clipboard.writeText()` | 구형 CEF 미지원 | try-catch 후 textarea fallback |
| 외부 CDN 의존 (운영 중 변경 금지) | 오프라인 환경 고려 | 현재 CDN URL 유지 |

**절대 지켜야 하는 패턴:**
```js
// ✅ 알림
showToast("메시지", "success" | "error" | "warn" | "info");

// ✅ 파괴적 작업 확인 (버튼 재클릭 패턴)
requireConfirm(btn, "⚠️ 정말 삭제할까요?", () => { /* 실행 */ });
```

---

## State 스키마

`localStorage` 키: `"desktop-dashboard-state-v1"`

```js
{
  settings: {
    showSeconds: boolean,           // 시계 초 표시
    visibleCards: {                 // 각 카드 표시 여부
      priority, links, dday, schedule, todos, memo, statusPanel
    },
    themeMode: "light" | "dark",
    dailyReset: {                   // 자정 리셋 여부
      schedule, todos, priority
    },
    quickAddItems: string[],        // Quick Add 버튼 목록 (최대 8개)
    visual: {
      accentPreset: "pink" | "lavender" | "mint" | "yellow" |
                    "peach" | "sky" | "sage" | "neutral" | "custom",
      accentCustom: "#rrggbb",      // accentPreset === "custom" 일 때만 사용
      cardOpacity: 10~100,          // 카드 불투명도 (%)
      bgBlur: 0~60,                 // 블러 강도 (px)
      wallpaperBg: 0 | 1,           // 0=자체배경, 1=투명
      dashScale: 50~150,            // 크기 배율 (%)
      topMargin: 0~500,             // 상단 간격 (px)
      alignPos: 0 | 1 | 2           // 0=중앙, 1=왼쪽, 2=오른쪽
    }
  },
  status: { current: string, accent: "#rrggbb" },
  priority: ["", "", ""],           // 항상 길이 3 고정
  links:    [{ id, title, url }],
  ddays:    [{ id, title, date }],  // date: "YYYY-MM-DD"
  schedule: [{ id, time, text }],   // time: "HH:mm"
  todos:    [{ id, text, done }],
  memo: string,
  meta: { lastDate: string, version: "1.1.0" }
}
```

**state 수정 후 반드시 `saveState()` 호출.**
새 키 추가 시 `getDefaultState()`와 `validateState()` 양쪽 모두 업데이트.

---

## 주요 함수 목록

### 초기화 흐름
```
init() → loadState() → applyThemeMode() → applyVisualSettings()
       → updateClock() → bindEvents() → renderAll()
```

### 상태 관리
| 함수 | 설명 |
|------|------|
| `getDefaultState()` | 기본값 스키마 반환 |
| `validateState(s)` | 손상된 state 복구. 모든 키 타입 검증 + 누락 키 기본값 |
| `loadState()` | localStorage 로드. 구버전 마이그레이션 포함 |
| `saveState()` | localStorage 저장. QuotaExceededError 처리 |

### UI 적용
| 함수 | 설명 |
|------|------|
| `applyThemeMode()` | `body[data-theme]` 변경 |
| `applyVisualSettings()` | `state.settings.visual` → CSS 변수 일괄 적용 |
| `applyCSSColorTheme(hex)` | hex → RGB 분해 → `--accent-*` 변수 설정 |
| `applyViewMode()` | 편집/보기 모드 전환, 카드 표시/숨김 |

### 렌더링
| 함수 | 설명 |
|------|------|
| `renderAll()` | 모든 렌더링 함수 일괄 호출 |
| `renderStatus()` | 상태 배지 + 버튼 active 갱신 |
| `renderPriority()` | 우선순위 3개 입력 필드 |
| `renderLinks()` | 링크 그리드 + favicon (실패 시 이니셜) |
| `renderDdays()` | 미래/지난 항목 분리 + 접기 토글 |
| `renderSchedule()` | 시간순 정렬 일정 |
| `renderTodos()` | 미완료/완료 분리 + 완료 섹션 접기 토글 |
| `renderQuickAdd()` | Quick Add 버튼 그룹 |
| `renderSummaryBar()` | 헤더 아래 요약 칩 (일정 수 / 할일 진행률 / D-day) |

### 설정 모달
| 함수 | 설명 |
|------|------|
| `syncSettingsUI()` | state → 설정 모달 UI 전체 동기화. 모달 열기 전 반드시 호출 |
| `switchSettingsTab(tabName)` | "design" \| "layout" \| "cards" \| "data" |
| `renderQuickAddSettings()` | 설정 탭 내 Quick Add 목록 렌더링 |

### 유틸리티
| 함수 | 설명 |
|------|------|
| `showToast(msg, type)` | 3초 자동 사라지는 알림 |
| `requireConfirm(btn, text, fn)` | 3초 내 재클릭 확인 패턴 |
| `updateClock()` | 시계 + 날짜 DOM 업데이트 |

---

## CSS 변수

```css
--accent-color          /* 메인 포인트 색상 */
--accent-hover          /* accent -20 어두워진 hover 색 */
--accent-rgb            /* accent의 R, G, B 분해 (rgba 계산용) */
--card-opacity          /* 카드 불투명도 0~1 */
--glass-blur-amt        /* backdrop-filter blur (px) */
--dashboard-scale       /* transform scale 배율 */
--dashboard-margin-top  /* 상단 여백 (px) */
--bg-color, --surface-bg, --surface-hover
--text-main, --text-muted, --border-color
```

다크 테마는 `body[data-theme="dark"]`에서 색상 변수를 오버라이드.

---

## livelyPropertyListener 속성 목록

| 속성 | 타입 | state 저장? | 동작 |
|------|------|------------|------|
| `accentColor` | color | ❌ (CSS만) | `userAccentColor` 플래그 설정 + CSS 적용 |
| `theme` | dropdown | ✅ | `themeMode` 저장 + `applyThemeMode()` |
| `showSeconds` | checkbox | ✅ | `showSeconds` 저장 + `updateClock()` |
| `resetDataBtn` | button | - | 5초 딜레이 후 전체 초기화 |
| `wallpaperBg` | dropdown | ❌ | `data-bg-style` 속성 변경 |
| `cardOpacity` | slider | ❌ | `--card-opacity` CSS 변수 |
| `bgBlur` | slider | ❌ | `--glass-blur-amt` CSS 변수 |
| `dashScale` | slider | ❌ | `--dashboard-scale` CSS 변수 |
| `topMargin` | slider | ❌ | `--dashboard-margin-top` CSS 변수 |
| `alignPos` | dropdown | ❌ | wrapper의 justifyContent + padding |

**정책**: 시각 설정은 대시보드 설정 패널(`state.settings.visual`)이 단독 소스.
Lively 패널은 CSS 즉시 오버라이드만 한다. state에 쓰지 않는다.

---

## 데이터 흐름 원칙

1. **상태 변경** → `state.xxx = ...` → `saveState()` → `render함수()`
2. **설정 모달 열기** → `syncSettingsUI()` → `switchSettingsTab("design")`
3. **설정 컨트롤 변경** → state 즉시 업데이트 → `apply함수()` → `saveState()`
4. **새 state 키 추가** → `getDefaultState()`와 `validateState()` 양쪽 수정 필수

---

## 카드 목록 & data-card 속성

| `data-card` | 카드 이름 | 기본 표시 |
|------------|---------|---------|
| `priority` | 오늘 우선순위 Top 3 | ✅ |
| `links` | 문서/링크 빠른 접근 | ✅ |
| `dday` | D-day 타이머 | ✅ |
| `schedule` | 오늘 일정 | ✅ |
| `todos` | 할 일 목록 | ✅ |
| `memo` | 빠른 메모 | ✅ |
| `statusPanel` | 상태 제어판 | ❌ (헤더 미니 버튼으로 대체됨) |

---

## 알려진 제약 및 주의사항

- **`body { overflow: hidden }`** 유지 필수 (배경 위젯 특성). 내부 스크롤은 `.dashboard-wrapper`에 `overflow-y: auto`로 처리.
- **flatpickr**: `disableMobile: true` 옵션 유지 (터치 UI가 CEF에서 오작동).
- **favicon**: Google S2 API 사용. 실패 시 `onerror`에서 이니셜 뱃지로 대체.
- **구버전 state 호환**: `visibleCards.statusPanel`이 없는 경우 `undefined`를 `true`로 처리 (하위 호환).
- **`userAccentColor` 변수**: Lively 패널에서 색상 지정 시 설정됨. 이 값이 있으면 `applyVisualSettings()`에서 색상 변경을 건너뜀.

---

## 작업 시 체크리스트

새 기능 추가 전:
- [ ] state에 새 키가 필요하다면 `getDefaultState()` + `validateState()` 동시 수정
- [ ] alert/confirm 대신 `showToast` / `requireConfirm` 사용
- [ ] 이벤트 핸들러는 `bindEvents()` 내부에 추가
- [ ] 렌더링은 `renderAll()`에 포함되도록 추가

설정 모달에 새 컨트롤 추가 시:
- [ ] HTML에 컨트롤 추가 (id 필수)
- [ ] `syncSettingsUI()`에 state→UI 동기화 코드 추가
- [ ] `bindEvents()`에 즉시 저장 이벤트 추가
