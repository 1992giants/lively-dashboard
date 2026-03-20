const STORAGE_KEY = "desktop-dashboard-state-v1";

const COLOR_PRESETS = {
  pink:     "#f4a2b9",
  lavender: "#b8a7db",
  mint:     "#aaccce",
  yellow:   "#f4c979",
  peach:    "#f4b8a0",
  sky:      "#a7c4db",
  sage:     "#9fc4a0",
  neutral:  "#c8c8c8"
};

// 기본 업무 모드 프리셋
const DEFAULT_MODES = [
  { id: "focus",   label: "👨‍💻 집중 업무", color: "#f4a2b9" },
  { id: "meeting", label: "👥 회의 중",    color: "#b8a7db" },
  { id: "break",   label: "☕ 휴식",       color: "#aaccce" },
  { id: "outside", label: "🏃 외근",       color: "#f4c979" }
];

// 컨디션 프리셋
const DEFAULT_CONDITIONS = [
  { id: "great",  label: "😊 좋음" },
  { id: "normal", label: "😐 보통" },
  { id: "tired",  label: "😴 피곤" },
  { id: "bad",    label: "😰 힘듦" }
];

function getDefaultState() {
  return {
    settings: {
      showSeconds: true,
      visibleCards: {
        // 'priority' 카드는 todos에 통합됨 (별도 카드 없음)
        links: true, dday: true, schedule: true, todos: true, memo: true, statusPanel: false
      },
      themeMode: "light",
      dailyReset: { schedule: true, todos: true, priority: false },
      quickAddItems: ["💧 물 마시기", "🤸 스트레칭", "🪟 환기"],
      // 카드 순서: 편집 모드에서 ▲▼ 버튼으로 변경 가능
      cardOrder: ["schedule", "todos", "dday", "memo", "links"],
      visual: {
        accentPreset: "pink",
        accentCustom: "#f4a2b9",
        cardOpacity: 55,
        bgBlur: 24,
        wallpaperBg: 0,
        dashScale: 100,
        topMargin: 20,
        alignPos: 0
      }
    },
    status: {
      currentModeId: "focus",
      currentConditionId: "normal",
      presets: {
        modes: [...DEFAULT_MODES],
        conditions: [...DEFAULT_CONDITIONS]
      }
    },
    // todos: 오늘 우선순위 Top 3 + 일반 할 일 통합
    todos: {
      priority: ["", "", ""],
      general: [
        { id: Date.now(), text: "회의 자료 준비", done: false }
      ],
      collapsedCompleted: true
    },
    // notesMatrix: 긴급도 × 중요도 4분면
    notesMatrix: {
      urgentImportant:           [],
      importantNotUrgent:        [],
      urgentNotImportant:        [],
      neitherUrgentNorImportant: []
    },
    links:    [{ id: Date.now() + 1, title: "Lively", url: "https://rocksdanister.github.io/lively/" }],
    ddays:    [],
    schedule: [],
    memo:     "",   // 하위 호환 보존 (UI 표시 안 함)
    meta: {
      lastDate: new Date().toDateString(),
      version:  "2.0.0"
    }
  };
}

let state = null;
let isEditMode = false;
let userAccentColor = null;
let isDdayPastCollapsed = true;

/* ==================================================
   validateState(s)
   구버전(v1) → 현재(v2) 자동 마이그레이션 + 손상 복구
   ================================================== */
function validateState(s) {
  const def = getDefaultState();
  if (!s || typeof s !== 'object') return def;

  /* ── 구버전 마이그레이션 ── */

  // v1: status = { current: "👨‍💻 집중 업무", accent: "#..." }
  if (s.status && typeof s.status.current === 'string' && !s.status.currentModeId) {
    const labelToId = {};
    DEFAULT_MODES.forEach(m => { labelToId[m.label] = m.id; });
    s.status = {
      currentModeId:     labelToId[s.status.current] || "focus",
      currentConditionId: "normal",
      presets: { modes: [...DEFAULT_MODES], conditions: [...DEFAULT_CONDITIONS] }
    };
  }

  // v1: todos = flat array, priority = top-level string[3]
  if (Array.isArray(s.todos)) {
    const oldGeneral  = s.todos;
    const oldPriority = Array.isArray(s.priority) && s.priority.length === 3
      ? s.priority : ["", "", ""];
    s.todos = {
      priority: oldPriority,
      general:  oldGeneral.filter(t => t && t.id && typeof t.text === 'string'),
      collapsedCompleted: true
    };
    delete s.priority;
  }

  /* ── settings 검증 ── */
  if (!s.settings || typeof s.settings !== 'object') s.settings = def.settings;
  s.settings.visibleCards = Object.assign({}, def.settings.visibleCards, s.settings.visibleCards);
  s.settings.dailyReset   = Object.assign({}, def.settings.dailyReset,   s.settings.dailyReset || {});
  if (!Array.isArray(s.settings.quickAddItems))          s.settings.quickAddItems = def.settings.quickAddItems;
  if (typeof s.settings.showSeconds !== 'boolean')        s.settings.showSeconds   = def.settings.showSeconds;
  if (!s.settings.themeMode)                             s.settings.themeMode     = def.settings.themeMode;
  if (!s.settings.visual || typeof s.settings.visual !== 'object') {
    s.settings.visual = def.settings.visual;
  } else {
    s.settings.visual = Object.assign({}, def.settings.visual, s.settings.visual);
  }

  // cardOrder 검증: 5개 카드 ID가 모두 있어야 유효
  const CARD_IDS = ["schedule", "todos", "dday", "memo", "links"];
  if (!Array.isArray(s.settings.cardOrder) ||
      s.settings.cardOrder.length !== CARD_IDS.length ||
      !CARD_IDS.every(c => s.settings.cardOrder.includes(c))) {
    s.settings.cardOrder = [...CARD_IDS];
  }

  /* ── status 검증 ── */
  if (!s.status || typeof s.status !== 'object') {
    s.status = def.status;
  } else {
    if (typeof s.status.currentModeId      !== 'string') s.status.currentModeId      = def.status.currentModeId;
    if (typeof s.status.currentConditionId !== 'string') s.status.currentConditionId = def.status.currentConditionId;
    if (!s.status.presets || typeof s.status.presets !== 'object') {
      s.status.presets = def.status.presets;
    } else {
      if (!Array.isArray(s.status.presets.modes)      || s.status.presets.modes.length === 0)
        s.status.presets.modes = [...DEFAULT_MODES];
      if (!Array.isArray(s.status.presets.conditions) || s.status.presets.conditions.length === 0)
        s.status.presets.conditions = [...DEFAULT_CONDITIONS];
    }
  }

  /* ── todos 검증 ── */
  if (!s.todos || typeof s.todos !== 'object' || Array.isArray(s.todos)) {
    s.todos = def.todos;
  } else {
    if (!Array.isArray(s.todos.priority) || s.todos.priority.length !== 3) s.todos.priority = ["", "", ""];
    if (!Array.isArray(s.todos.general))                                    s.todos.general  = [];
    if (typeof s.todos.collapsedCompleted !== 'boolean')                    s.todos.collapsedCompleted = true;
    s.todos.general = s.todos.general.filter(t => t && t.id && typeof t.text === 'string');
  }

  /* ── notesMatrix 검증 ── */
  if (!s.notesMatrix || typeof s.notesMatrix !== 'object') {
    s.notesMatrix = def.notesMatrix;
  } else {
    ["urgentImportant","importantNotUrgent","urgentNotImportant","neitherUrgentNorImportant"].forEach(q => {
      if (!Array.isArray(s.notesMatrix[q])) {
        s.notesMatrix[q] = [];
      } else {
        s.notesMatrix[q] = s.notesMatrix[q].filter(i => i && i.id && typeof i.text === 'string');
      }
    });
  }

  /* ── 기타 배열/값 검증 ── */
  if (!Array.isArray(s.links))    s.links    = def.links;
  if (!Array.isArray(s.ddays))    s.ddays    = def.ddays;
  if (!Array.isArray(s.schedule)) s.schedule = def.schedule;
  if (typeof s.memo !== 'string') s.memo     = def.memo;

  s.links    = s.links.filter(l => l && l.id && l.title && l.url);
  s.ddays    = s.ddays.filter(d => d && d.id && d.title && d.date);
  s.schedule = s.schedule.filter(sc => sc && sc.id && sc.time && sc.text);

  /* ── meta 검증 ── */
  if (!s.meta || typeof s.meta !== 'object') s.meta = def.meta;
  if (typeof s.meta.lastDate !== 'string')   s.meta.lastDate = def.meta.lastDate;
  if (!s.meta.version)                       s.meta.version  = def.meta.version;

  return s;
}

function loadState() {
  const def       = getDefaultState();
  const savedV1   = localStorage.getItem(STORAGE_KEY);
  const oldLegacy = localStorage.getItem("desktop-dashboard-state");

  if (savedV1) {
    try {
      const parsed = JSON.parse(savedV1);
      state = validateState(Object.assign({}, def, parsed));
    } catch (e) {
      console.warn("[대시보드] 저장 데이터 파싱 실패, 기본값으로 복구:", e);
      state = def;
      localStorage.setItem(`${STORAGE_KEY}-broken-${Date.now()}`, savedV1);
      localStorage.removeItem(STORAGE_KEY);
    }
  } else if (oldLegacy) {
    try {
      const legacy = JSON.parse(oldLegacy);
      if (Array.isArray(legacy.quickLinks))    def.links          = legacy.quickLinks.map(l => ({ id: l.id, title: l.name, url: l.url }));
      if (Array.isArray(legacy.priorities))    def.todos.priority = legacy.priorities;
      if (Array.isArray(legacy.ddays))         def.ddays          = legacy.ddays.map(d => ({ id: d.id, title: d.title, date: d.targetDate }));
      if (Array.isArray(legacy.todaySchedule)) def.schedule       = legacy.todaySchedule;
      if (Array.isArray(legacy.todos))         def.todos.general  = legacy.todos;
      if (typeof legacy.memo === 'string')     def.memo           = legacy.memo;
      state = validateState(def);
      saveState();
    } catch (e) {
      state = def;
    }
  } else {
    state = def;
  }

  // 자정 이후 일과 리셋
  const todayStr = new Date().toDateString();
  if (state.meta.lastDate !== todayStr) {
    if (state.settings.dailyReset.schedule) state.schedule         = [];
    if (state.settings.dailyReset.todos)    state.todos.general    = [];
    if (state.settings.dailyReset.priority) state.todos.priority   = ["", "", ""];
    state.meta.lastDate = todayStr;
    saveState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showToast("저장 공간이 부족합니다. 목록을 줄여주세요.", "error");
    } else {
      console.warn("[대시보드] 저장 실패:", e);
    }
  }
}

function applyThemeMode() {
  document.body.setAttribute("data-theme", state.settings.themeMode || "light");
}

function applyVisualSettings() {
  const v = state.settings.visual;
  if (!userAccentColor) {
    const hex = v.accentPreset === "custom"
      ? v.accentCustom
      : (COLOR_PRESETS[v.accentPreset] || COLOR_PRESETS.pink);
    applyCSSColorTheme(hex);
  }
  document.documentElement.style.setProperty("--card-opacity",           (v.cardOpacity / 100).toString());
  document.documentElement.style.setProperty("--glass-blur-amt",         `${v.bgBlur}px`);
  document.documentElement.style.setProperty("--dashboard-scale",        (v.dashScale / 100).toString());
  document.documentElement.style.setProperty("--dashboard-margin-top",   `${v.topMargin}px`);
  document.body.setAttribute("data-bg-style", v.wallpaperBg === 1 ? "transparent" : "normal");

  const wrapper = document.querySelector(".dashboard-wrapper");
  if (wrapper) {
    if (v.alignPos === 1)      { wrapper.style.justifyContent = "flex-start"; wrapper.style.paddingLeft = "40px"; wrapper.style.paddingRight = "0"; }
    else if (v.alignPos === 2) { wrapper.style.justifyContent = "flex-end";   wrapper.style.paddingLeft = "0";    wrapper.style.paddingRight = "40px"; }
    else                       { wrapper.style.justifyContent = "center";     wrapper.style.paddingLeft = "";     wrapper.style.paddingRight = ""; }
  }
}

/* ==================================================
   showToast / requireConfirm — CEF 안전 UI
   ================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

function requireConfirm(btn, confirmText, onConfirm) {
  if (btn.dataset.confirming) return;
  const originalText  = btn.textContent;
  const originalClass = btn.className;
  btn.textContent = confirmText;
  btn.classList.add("btn-confirming");
  btn.dataset.confirming = "true";

  const timeoutId = setTimeout(() => {
    btn.textContent = originalText;
    btn.className   = originalClass;
    delete btn.dataset.confirming;
  }, 3000);

  btn.addEventListener("click", function handler() {
    if (!btn.dataset.confirming) return;
    clearTimeout(timeoutId);
    btn.textContent = originalText;
    btn.className   = originalClass;
    delete btn.dataset.confirming;
    onConfirm();
  }, { once: true });
}

function updateClock() {
  const now     = new Date();
  const options = { hour: "2-digit", minute: "2-digit", hour12: false };
  const clockEl = document.getElementById("clock");
  if (state.settings.showSeconds) { clockEl.classList.remove("hide-seconds"); options.second = "2-digit"; }
  else                            { clockEl.classList.add("hide-seconds"); }
  clockEl.textContent = now.toLocaleTimeString("ko-KR", options);
  document.getElementById("dateText").textContent = now.toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long"
  });
}

/* ==================================================
   renderStatus()
   업무 모드 + 컨디션 혼합형
   - .status-mode-btn      [data-mode-id]
   - .status-condition-btn [data-condition-id]
   ================================================== */
function renderStatus() {
  const { currentModeId, currentConditionId, presets } = state.status;
  const currentMode      = presets.modes.find(m => m.id === currentModeId)      || presets.modes[0];
  const currentCondition = presets.conditions.find(c => c.id === currentConditionId) || presets.conditions[0];

  // 헤더 배지: "모드  컨디션"
  const badge = document.getElementById("currentStatusBadge");
  if (badge) badge.textContent = `${currentMode.label}  ${currentCondition.label}`;

  // 모드 버튼 active
  document.querySelectorAll(".status-mode-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.modeId === currentModeId)
  );
  // 컨디션 버튼 active
  document.querySelectorAll(".status-condition-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.conditionId === currentConditionId)
  );

  // accent 색상 = 현재 모드 색상
  if (!userAccentColor) applyCSSColorTheme(currentMode.color);
  document.getElementById("headerCard").classList.add("themed-border");
}

function applyCSSColorTheme(hexStr) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexStr)) return;
  const num = parseInt(hexStr.slice(1), 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  document.documentElement.style.setProperty("--accent-color", hexStr);
  document.documentElement.style.setProperty("--accent-hover",
    '#' + [r-20, g-20, b-20].map(x => Math.max(0, x).toString(16).padStart(2, '0')).join(''));
  document.documentElement.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
}

/* ==================================================
   renderLinks()
   수직 목록 + 편집 모드에서 위/아래 이동 버튼
   ================================================== */
function renderLinks() {
  const container = document.getElementById("quickLinksContainer");
  container.innerHTML = "";

  if (state.links.length === 0) {
    container.innerHTML = `<div class="empty-state-grid">${
      isEditMode ? '+ 위 입력란에서 링크를 추가해보세요.' : '등록된 링크가 없습니다.'
    }</div>`;
    return;
  }

  state.links.forEach((link, idx) => {
    const item = document.createElement("div");
    item.className = "link-item";

    // favicon
    const iconWrap = document.createElement("span");
    iconWrap.className = "link-favicon-wrap";
    const imgIcon = document.createElement("img");
    imgIcon.className = "link-favicon"; imgIcon.alt = "";
    try {
      imgIcon.src = `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`;
      imgIcon.onerror = () => {
        imgIcon.style.display = "none";
        const initial = document.createElement("span");
        initial.className = "link-favicon-initial";
        initial.textContent = (link.title || "?")[0].toUpperCase();
        iconWrap.appendChild(initial);
      };
    } catch (e) { imgIcon.style.display = "none"; }
    iconWrap.appendChild(imgIcon);

    // 링크 앵커
    const anchor = document.createElement("a");
    anchor.className = "link-item-title";
    anchor.href = link.url; anchor.target = "_blank";
    anchor.textContent = link.title;

    // 위/아래/삭제 버튼 (편집 모드에서만 표시)
    const actions = document.createElement("div");
    actions.className = "link-actions edit-only";

    const upBtn = document.createElement("button");
    upBtn.className = "link-order-btn"; upBtn.textContent = "▲"; upBtn.title = "위로";
    upBtn.disabled = idx === 0;
    upBtn.onclick = () => {
      [state.links[idx - 1], state.links[idx]] = [state.links[idx], state.links[idx - 1]];
      saveState(); renderLinks();
    };

    const downBtn = document.createElement("button");
    downBtn.className = "link-order-btn"; downBtn.textContent = "▼"; downBtn.title = "아래로";
    downBtn.disabled = idx === state.links.length - 1;
    downBtn.onclick = () => {
      [state.links[idx + 1], state.links[idx]] = [state.links[idx], state.links[idx + 1]];
      saveState(); renderLinks();
    };

    const delBtn = document.createElement("button");
    delBtn.className = "link-del"; delBtn.textContent = "×";
    delBtn.onclick = (e) => {
      e.preventDefault();
      state.links = state.links.filter(l => l.id !== link.id);
      saveState(); renderLinks();
    };

    actions.append(upBtn, downBtn, delBtn);
    item.append(iconWrap, anchor, actions);
    container.appendChild(item);
  });
}

/* renderDdays: 기존 유지 */
function renderDdays() {
  const list = document.getElementById("ddayList");
  list.innerHTML = "";

  if (state.ddays.length === 0) {
    const li = document.createElement("li"); li.className = "empty-state-li";
    li.textContent = isEditMode ? "+ 위 입력란에서 마감일을 추가해보세요." : "등록된 마감일이 없습니다.";
    list.appendChild(li); return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = [], past = [];
  state.ddays.forEach(d => {
    if (!d.date) return;
    const target = new Date(d.date); target.setHours(0,0,0,0);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    (diff >= 0 ? upcoming : past).push({ ...d, diff });
  });
  upcoming.sort((a, b) => a.diff - b.diff);
  past.sort((a, b) => b.diff - a.diff);

  function makeDdayLi(item, isPast) {
    const label = item.diff === 0 ? `D-Day!` : item.diff > 0 ? `D-${item.diff}` : `D+${Math.abs(item.diff)}`;
    const li = document.createElement("li");
    if (isPast) li.className = "dday-past-row";
    li.innerHTML = `<span class="dday-item-title">${item.title}</span><div class="dday-item-meta"><span class="dday-badge ${isPast ? 'dday-past' : ''}">${label}</span><button class="delete-btn" data-id="${item.id}">삭제</button></div>`;
    return li;
  }

  if (upcoming.length === 0 && past.length === 0) {
    const li = document.createElement("li"); li.className = "empty-state-li";
    li.textContent = "등록된 마감일이 없습니다."; list.appendChild(li); return;
  }

  if (upcoming.length === 0) {
    const li = document.createElement("li"); li.className = "empty-state-li";
    li.textContent = "다가오는 마감일이 없습니다."; list.appendChild(li);
  } else {
    upcoming.forEach(d => list.appendChild(makeDdayLi(d, false)));
  }

  if (past.length > 0) {
    const toggleLi = document.createElement("li");
    toggleLi.className = "dday-past-header";
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "dday-past-toggle-btn";
    toggleBtn.textContent = isDdayPastCollapsed ? `지난 항목 ${past.length}개 보기 ▾` : `▴ 지난 항목 숨기기`;
    toggleBtn.onclick = () => { isDdayPastCollapsed = !isDdayPastCollapsed; renderDdays(); };
    toggleLi.appendChild(toggleBtn); list.appendChild(toggleLi);
    if (!isDdayPastCollapsed) past.forEach(d => list.appendChild(makeDdayLi(d, true)));
  }

  list.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = (e) => {
    state.ddays = state.ddays.filter(i => i.id !== Number(e.target.dataset.id));
    saveState(); renderDdays(); renderSummaryBar();
  });
}

/* renderSchedule: 기존 유지 */
function renderSchedule() {
  const list = document.getElementById("scheduleList");
  list.innerHTML = "";
  const sorted = [...state.schedule].sort((a,b) => a.time.localeCompare(b.time));

  if (sorted.length === 0) {
    const li = document.createElement("li"); li.className = "empty-state-li";
    li.textContent = isEditMode ? "+ 위 입력란에서 일정을 추가해보세요." : "오늘 등록된 일정이 없습니다.";
    list.appendChild(li); return;
  }

  sorted.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<span><span class="schedule-time">${s.time}</span>${s.text}</span><button class="delete-btn" data-id="${s.id}">삭제</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = (e) => {
    state.schedule = state.schedule.filter(i => i.id !== Number(e.target.dataset.id));
    saveState(); renderSchedule();
  });
}

/* ==================================================
   renderTodos()
   상단: 오늘 우선순위 Top 3
   하단: 일반 할 일 (미완료 → 완료 접기)
   ================================================== */
function renderTodos() {
  // ── 우선순위 Top 3 ──
  const priorityList = document.getElementById("priorityList");
  if (priorityList) {
    priorityList.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const li    = document.createElement("li");
      const num   = document.createElement("span");
      num.className = "priority-num"; num.textContent = i + 1;
      const input = document.createElement("input");
      input.type = "text"; input.className = "priority-input"; input.maxLength = 30;
      input.placeholder = isEditMode ? `${i+1}순위 입력` : "내용 없음";
      input.value = state.todos.priority[i] || "";
      input.addEventListener("change", (e) => {
        state.todos.priority[i] = e.target.value.trim();
        saveState();
      });
      li.append(num, input);
      priorityList.appendChild(li);
    }
  }

  // ── 일반 할 일 ──
  const list    = document.getElementById("todoList");
  list.innerHTML = "";
  const pending = state.todos.general.filter(t => !t.done);
  const done    = state.todos.general.filter(t =>  t.done);

  if (state.todos.general.length === 0) {
    const li = document.createElement("li"); li.className = "empty-state-li";
    li.textContent = isEditMode ? "+ 아래 입력란에서 할 일을 추가해보세요." : "할 일이 없습니다.";
    list.appendChild(li);
  } else {
    pending.forEach(t => {
      const li = document.createElement("li");
      li.innerHTML = `<div class="todo-left"><input type="checkbox" class="todo-cb" data-id="${t.id}"><span>${t.text}</span></div><button class="delete-btn" data-id="${t.id}">삭제</button>`;
      list.appendChild(li);
    });

    if (pending.length === 0 && done.length > 0) {
      const li = document.createElement("li"); li.className = "empty-state-li";
      li.textContent = "모든 할 일을 완료했어요! 🎉";
      list.appendChild(li);
    }

    if (done.length > 0) {
      const toggleLi  = document.createElement("li");
      toggleLi.className = "completed-section-header";
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "completed-toggle-btn";
      const collapsed = state.todos.collapsedCompleted;
      toggleBtn.textContent = collapsed
        ? `✓ 완료된 항목 ${done.length}개 보기 ▾`
        : `▴ 완료 항목 숨기기`;
      toggleBtn.onclick = () => {
        state.todos.collapsedCompleted = !state.todos.collapsedCompleted;
        saveState(); renderTodos(); renderSummaryBar();
      };
      toggleLi.appendChild(toggleBtn);
      list.appendChild(toggleLi);

      if (!collapsed) {
        done.forEach(t => {
          const li = document.createElement("li"); li.className = "todo-done-row";
          li.innerHTML = `<div class="todo-left"><input type="checkbox" checked class="todo-cb" data-id="${t.id}"><span class="todo-done">${t.text}</span></div><button class="delete-btn" data-id="${t.id}">삭제</button>`;
          list.appendChild(li);
        });
      }
    }

    list.querySelectorAll('.todo-cb').forEach(cb => cb.onchange = (e) => {
      const todo = state.todos.general.find(i => i.id === Number(e.target.dataset.id));
      if (todo) { todo.done = e.target.checked; saveState(); renderTodos(); renderSummaryBar(); }
    });
    list.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = (e) => {
      state.todos.general = state.todos.general.filter(i => i.id !== Number(e.target.dataset.id));
      saveState(); renderTodos(); renderSummaryBar();
    });
  }
}

function renderQuickAdd() {
  const container = document.getElementById("quickAddContainer");
  container.innerHTML = "";
  state.settings.quickAddItems.forEach(text => {
    const btn = document.createElement("button");
    btn.className = "quick-btn btn btn-ghost";
    btn.textContent = text;
    btn.onclick = () => {
      state.todos.general.push({ id: Date.now(), text, done: false });
      saveState(); renderTodos();
    };
    container.appendChild(btn);
  });
}

/* ==================================================
   renderNotesMatrix()
   긴급도 × 중요도 4분면 메모
   - 각 칸: 텍스트 항목 추가/삭제
   - 보기 모드에서 입력/삭제 버튼 숨김
   ================================================== */
const QUADRANTS = [
  { key: "urgentImportant",           label: "🔴 긴급·중요",     desc: "지금 당장" },
  { key: "importantNotUrgent",        label: "🟡 중요·비긴급",   desc: "일정 잡기" },
  { key: "urgentNotImportant",        label: "🟠 긴급·비중요",   desc: "위임·빠르게" },
  { key: "neitherUrgentNorImportant", label: "⚪ 비긴급·비중요", desc: "나중에·제거" }
];

function renderNotesMatrix() {
  const container = document.getElementById("notesMatrixContainer");
  if (!container) return;
  container.innerHTML = "";

  QUADRANTS.forEach(q => {
    const items = state.notesMatrix[q.key] || [];
    const cell  = document.createElement("div");
    cell.className = "matrix-cell";

    // 헤더
    const header = document.createElement("div");
    header.className = "matrix-cell-header";
    header.innerHTML = `<span class="matrix-cell-label">${q.label}</span><span class="matrix-cell-desc">${q.desc}</span>`;

    // 항목 목록
    const ul = document.createElement("ul");
    ul.className = "matrix-item-list";

    if (items.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "matrix-empty";
      emptyLi.textContent = "항목 없음";
      ul.appendChild(emptyLi);
    } else {
      items.forEach(item => {
        const li = document.createElement("li");
        li.className = "matrix-item";
        li.innerHTML = `<span class="matrix-item-text">${item.text}</span><button class="matrix-del-btn delete-btn edit-only" data-quadrant="${q.key}" data-id="${item.id}">×</button>`;
        ul.appendChild(li);
      });
    }

    // 입력 폼 (편집 모드에서만 노출)
    const form = document.createElement("div");
    form.className = "matrix-input-row edit-only";
    const inp = document.createElement("input");
    inp.type = "text"; inp.className = "matrix-input";
    inp.placeholder = "항목 추가..."; inp.maxLength = 30;
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) addMatrixItem(q.key, inp);
    });
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-secondary matrix-add-btn"; addBtn.textContent = "+";
    addBtn.onclick = () => addMatrixItem(q.key, inp);

    form.append(inp, addBtn);
    cell.append(header, ul, form);
    container.appendChild(cell);
  });

  // 삭제 이벤트
  container.querySelectorAll(".matrix-del-btn").forEach(btn => {
    btn.onclick = () => {
      const { quadrant, id } = btn.dataset;
      state.notesMatrix[quadrant] = state.notesMatrix[quadrant].filter(i => i.id !== Number(id));
      saveState(); renderNotesMatrix();
    };
  });
}

function addMatrixItem(quadrantKey, inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  state.notesMatrix[quadrantKey].push({ id: Date.now(), text });
  inputEl.value = "";
  saveState(); renderNotesMatrix();
}

/* ==================================================
   renderSummaryBar() — 새 todos 구조 반영
   ================================================== */
function renderSummaryBar() {
  const bar = document.getElementById("summaryBar");
  if (!bar) return;

  const general      = state.todos.general;
  const totalTodos   = general.length;
  const doneTodos    = general.filter(t => t.done).length;
  const pendingTodos = totalTodos - doneTodos;

  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingDdays = state.ddays
    .filter(d => d.date)
    .map(d => {
      const target = new Date(d.date); target.setHours(0,0,0,0);
      return { title: d.title, diff: Math.ceil((target - today) / (1000*60*60*24)) };
    })
    .filter(d => d.diff >= 0)
    .sort((a, b) => a.diff - b.diff);

  const chips = [];
  if (state.schedule.length > 0) chips.push({ text: `🗓️ 오늘 일정 ${state.schedule.length}개`, accent: false });
  if (totalTodos > 0) {
    const allDone = pendingTodos === 0;
    chips.push({ text: allDone ? `✅ 모든 할 일 완료!` : `✅ 할 일 ${doneTodos}/${totalTodos} 완료`, accent: allDone });
  }
  if (upcomingDdays.length > 0) {
    const n = upcomingDdays[0];
    chips.push({ text: `🎯 ${n.title} ${n.diff === 0 ? 'D-Day!' : `D-${n.diff}`}`, accent: n.diff <= 3 });
  }

  bar.innerHTML = chips.length === 0
    ? `<span class="summary-greeting">오늘도 수고하세요 ☀️</span>`
    : chips.map(c => `<span class="summary-chip${c.accent ? ' chip-accent' : ''}">${c.text}</span>`).join('');
}

/* ==================================================
   설정 패널 유틸
   ================================================== */
function switchSettingsTab(tabName) {
  document.querySelectorAll(".settings-tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tabName)
  );
  document.querySelectorAll(".settings-tab-panel").forEach(p =>
    p.classList.toggle("hidden", p.dataset.tab !== tabName)
  );
}

function renderQuickAddSettings() {
  const list = document.getElementById("quickAddSettingsList");
  if (!list) return;
  list.innerHTML = "";
  state.settings.quickAddItems.forEach((text, i) => {
    const li = document.createElement("li");
    li.className = "quick-add-settings-item";
    li.innerHTML = `<span>${text}</span><button class="delete-btn" data-idx="${i}">×</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll(".delete-btn").forEach(btn => btn.onclick = (e) => {
    state.settings.quickAddItems.splice(parseInt(e.target.dataset.idx), 1);
    saveState(); renderQuickAdd(); renderQuickAddSettings();
  });
}

// state → 설정 패널 UI 전체 동기화 (모달 열기 전 호출)
function syncSettingsUI() {
  const v = state.settings.visual;

  document.querySelectorAll("[data-theme-btn]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.themeBtn === state.settings.themeMode)
  );
  document.querySelectorAll(".color-preset-btn[data-preset]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.preset === v.accentPreset)
  );
  if (document.getElementById("set_accentCustom"))
    document.getElementById("set_accentCustom").value = v.accentCustom || "#f4a2b9";
  const customSwatch = document.getElementById("customPresetSwatch");
  if (customSwatch && v.accentPreset === "custom") customSwatch.style.background = v.accentCustom || "#f4a2b9";

  const cardOpSlider = document.getElementById("set_cardOpacity");
  if (cardOpSlider) { cardOpSlider.value = v.cardOpacity; document.getElementById("label_cardOpacity").textContent = v.cardOpacity + "%"; }
  const bgBlurSlider = document.getElementById("set_bgBlur");
  if (bgBlurSlider) { bgBlurSlider.value = v.bgBlur; document.getElementById("label_bgBlur").textContent = v.bgBlur + "px"; }
  document.querySelectorAll("[data-bg-btn]").forEach(btn =>
    btn.classList.toggle("active", parseInt(btn.dataset.bgBtn) === v.wallpaperBg)
  );

  const dashScaleSlider = document.getElementById("set_dashScale");
  if (dashScaleSlider) { dashScaleSlider.value = v.dashScale; document.getElementById("label_dashScale").textContent = v.dashScale + "%"; }
  const topMarginSlider = document.getElementById("set_topMargin");
  if (topMarginSlider) { topMarginSlider.value = v.topMargin; document.getElementById("label_topMargin").textContent = v.topMargin + "px"; }
  document.querySelectorAll("[data-align-btn]").forEach(btn =>
    btn.classList.toggle("active", parseInt(btn.dataset.alignBtn) === v.alignPos)
  );

  // 카드 탭 (priority 별도 카드 없음)
  ["links", "dday", "schedule", "todos", "memo", "statusPanel"].forEach(k => {
    const el = document.getElementById(`vis_${k}`);
    if (el) el.checked = (state.settings.visibleCards[k] !== false);
  });
  renderQuickAddSettings();

  document.getElementById("set_showSeconds").checked = state.settings.showSeconds;
  ["schedule", "todos", "priority"].forEach(k => {
    const el = document.getElementById(`reset_${k}`);
    if (el) el.checked = state.settings.dailyReset[k];
  });
}

/* ==================================================
   카드 순서 관리
   - applyCardOrder(): state.settings.cardOrder 배열 순서대로 DOM 재배치
   - updateMoveButtons(): ▲▼ 버튼 disabled 상태 갱신
   - moveCard(cardId, dir): dir=-1(위로), dir=+1(아래로)
   ================================================== */
function applyCardOrder() {
  const grid = document.querySelector('.grid');
  if (!grid) return;

  // statusPanel은 항상 맨 마지막 고정
  const statusPanel = grid.querySelector('[data-card="statusPanel"]');

  state.settings.cardOrder.forEach(cardId => {
    const el = grid.querySelector(`[data-card="${cardId}"]`);
    if (el) grid.insertBefore(el, statusPanel); // statusPanel 바로 앞에 순서대로 삽입
  });

  updateMoveButtons();
}

function updateMoveButtons() {
  const order = state.settings.cardOrder;
  order.forEach((cardId, idx) => {
    const card = document.querySelector(`[data-card="${cardId}"]`);
    if (!card) return;
    const upBtn   = card.querySelector('.card-move-up');
    const downBtn = card.querySelector('.card-move-down');
    if (upBtn)   upBtn.disabled   = (idx === 0);
    if (downBtn) downBtn.disabled = (idx === order.length - 1);
  });
}

function moveCard(cardId, dir) {
  const order = state.settings.cardOrder;
  const idx   = order.indexOf(cardId);
  if (idx < 0) return;
  const target = idx + dir;
  if (target < 0 || target >= order.length) return;
  [order[idx], order[target]] = [order[target], order[idx]];
  saveState();
  applyCardOrder();
}

function applyViewMode() {
  document.body.classList.toggle("edit-mode", isEditMode);
  const tgBtn = document.getElementById("editModeToggle");
  tgBtn.textContent = isEditMode ? "🔒 편집 완료" : "✏️ 편집";
  tgBtn.className   = isEditMode ? "btn btn-primary" : "btn btn-ghost";

  const vis = state.settings.visibleCards;
  document.querySelector('[data-card="links"]').classList.toggle('hidden', !vis.links);
  document.querySelector('[data-card="dday"]').classList.toggle('hidden', !vis.dday);
  document.querySelector('[data-card="schedule"]').classList.toggle('hidden', !vis.schedule);
  document.querySelector('[data-card="todos"]').classList.toggle('hidden', !vis.todos);
  document.querySelector('[data-card="memo"]').classList.toggle('hidden', !vis.memo);
  document.querySelector('[data-card="statusPanel"]').classList.toggle('hidden', vis.statusPanel === false);

  // 카드 순서 DOM 반영 + 이동 버튼 상태 갱신
  applyCardOrder();
}

function renderAll() {
  renderStatus();
  renderLinks();
  renderDdays();
  renderSchedule();
  renderTodos();
  renderQuickAdd();
  renderNotesMatrix();
  applyViewMode();
  renderSummaryBar();
}

/* ==================================================
   bindEvents()
   모든 이벤트 핸들러. 중복 바인딩 위험 없도록
   init()에서 단 한 번만 호출됨.
   ================================================== */
function bindEvents() {
  flatpickr("#ddayDate",    { locale: "ko", dateFormat: "Y-m-d", disableMobile: true, allowInput: false });
  flatpickr("#scheduleTime",{ enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, disableMobile: true, allowInput: false });

  // 입력 포커스: 위임 방식 (동적 생성 입력 포함, CEF 한글 IME 호환)
  document.addEventListener('mousedown', (e) => {
    const tag = e.target.tagName;
    if ((tag === 'INPUT' || tag === 'TEXTAREA') && isEditMode) {
      if (document.activeElement !== e.target) setTimeout(() => e.target.focus(), 0);
    }
  }, true);

  // 카드 이동 버튼 (이벤트 위임 — 그리드 전체)
  document.querySelector('.grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.card-move-btn');
    if (!btn || btn.disabled) return;
    const cardId = btn.dataset.cardId;
    const dir    = btn.classList.contains('card-move-up') ? -1 : 1;
    moveCard(cardId, dir);
  });

  // 편집 모드 토글
  document.getElementById("editModeToggle").onclick = () => {
    isEditMode = !isEditMode; applyViewMode(); renderTodos();
  };

  // 링크 추가
  document.getElementById("addLinkBtn").onclick = () => {
    const n = document.getElementById("linkName").value.trim();
    let   u = document.getElementById("linkUrl").value.trim();
    if (!n || !u) return showToast("이름과 URL을 모두 입력해주세요.", "warn");
    if (!u.startsWith("http")) u = "https://" + u;
    state.links.push({ id: Date.now(), title: n, url: u });
    document.getElementById("linkName").value = ""; document.getElementById("linkUrl").value = "";
    saveState(); renderLinks();
  };

  // D-day 추가
  document.getElementById("addDdayBtn").onclick = () => {
    const t = document.getElementById("ddayTitle").value.trim();
    const d = document.getElementById("ddayDate").value;
    if (!t || !d) return showToast("목표와 날짜를 올바르게 선택해주세요.", "warn");
    state.ddays.push({ id: Date.now(), title: t, date: d });
    document.getElementById("ddayTitle").value = ""; document.getElementById("ddayDate").value = "";
    saveState(); renderDdays();
  };

  // 일정 추가
  document.getElementById("addScheduleBtn").onclick = () => {
    const time = document.getElementById("scheduleTime").value;
    const txt  = document.getElementById("scheduleText").value.trim();
    if (!time || !txt) return showToast("시간과 일정을 모두 입력해주세요.", "warn");
    state.schedule.push({ id: Date.now(), time, text: txt });
    document.getElementById("scheduleTime").value = ""; document.getElementById("scheduleText").value = "";
    saveState(); renderSchedule();
  };

  // 할 일 추가
  document.getElementById("addTodoBtn").onclick = () => {
    const txt = document.getElementById("todoInput").value.trim();
    if (!txt) return;
    state.todos.general.push({ id: Date.now(), text: txt, done: false });
    document.getElementById("todoInput").value = "";
    saveState(); renderTodos();
  };

  // IME Enter 안전 처리
  document.getElementById("todoInput").onkeydown     = (e) => { if (e.key === "Enter" && !e.isComposing) document.getElementById("addTodoBtn").click(); };
  document.getElementById("scheduleText").onkeydown  = (e) => { if (e.key === "Enter" && !e.isComposing) document.getElementById("addScheduleBtn").click(); };

  // ── 상태: 모드 버튼 ──
  document.querySelectorAll(".status-mode-btn").forEach(btn => {
    btn.onclick = () => { state.status.currentModeId = btn.dataset.modeId; saveState(); renderStatus(); };
  });
  // ── 상태: 컨디션 버튼 ──
  document.querySelectorAll(".status-condition-btn").forEach(btn => {
    btn.onclick = () => { state.status.currentConditionId = btn.dataset.conditionId; saveState(); renderStatus(); };
  });

  /* ─── 설정 모달 ─── */
  const modal = document.getElementById("settingsModal");
  document.getElementById("settingsBtn").onclick      = () => { syncSettingsUI(); switchSettingsTab("design"); modal.classList.remove("hidden"); };
  document.getElementById("closeSettingsBtn").onclick = () => modal.classList.add("hidden");
  document.querySelectorAll(".settings-tab-btn").forEach(btn => btn.onclick = () => switchSettingsTab(btn.dataset.tab));

  // 디자인 탭
  document.querySelectorAll("[data-theme-btn]").forEach(btn => btn.onclick = () => {
    const mode = btn.dataset.themeBtn;
    state.settings.themeMode = mode;
    document.querySelectorAll("[data-theme-btn]").forEach(b => b.classList.toggle("active", b.dataset.themeBtn === mode));
    applyThemeMode(); saveState();
  });
  document.querySelectorAll(".color-preset-btn[data-preset]").forEach(btn => btn.onclick = () => {
    const preset = btn.dataset.preset;
    if (preset === "custom") { document.getElementById("set_accentCustom").click(); return; }
    state.settings.visual.accentPreset = preset;
    document.querySelectorAll(".color-preset-btn[data-preset]").forEach(b => b.classList.toggle("active", b.dataset.preset === preset));
    applyVisualSettings(); saveState();
  });
  document.getElementById("set_accentCustom").oninput = function() {
    state.settings.visual.accentPreset = "custom"; state.settings.visual.accentCustom = this.value;
    document.querySelectorAll(".color-preset-btn[data-preset]").forEach(b => b.classList.toggle("active", b.dataset.preset === "custom"));
    const swatch = document.getElementById("customPresetSwatch");
    if (swatch) swatch.style.background = this.value;
    applyVisualSettings(); saveState();
  };
  document.getElementById("set_cardOpacity").oninput = function() {
    state.settings.visual.cardOpacity = parseInt(this.value);
    document.getElementById("label_cardOpacity").textContent = this.value + "%";
    applyVisualSettings(); saveState();
  };
  document.getElementById("set_bgBlur").oninput = function() {
    state.settings.visual.bgBlur = parseInt(this.value);
    document.getElementById("label_bgBlur").textContent = this.value + "px";
    applyVisualSettings(); saveState();
  };
  document.querySelectorAll("[data-bg-btn]").forEach(btn => btn.onclick = () => {
    const val = parseInt(btn.dataset.bgBtn);
    state.settings.visual.wallpaperBg = val;
    document.querySelectorAll("[data-bg-btn]").forEach(b => b.classList.toggle("active", parseInt(b.dataset.bgBtn) === val));
    applyVisualSettings(); saveState();
  });

  // 레이아웃 탭
  document.getElementById("set_dashScale").oninput = function() {
    state.settings.visual.dashScale = parseInt(this.value);
    document.getElementById("label_dashScale").textContent = this.value + "%";
    applyVisualSettings(); saveState();
  };
  document.getElementById("set_topMargin").oninput = function() {
    state.settings.visual.topMargin = parseInt(this.value);
    document.getElementById("label_topMargin").textContent = this.value + "px";
    applyVisualSettings(); saveState();
  };
  document.querySelectorAll("[data-align-btn]").forEach(btn => btn.onclick = () => {
    const val = parseInt(btn.dataset.alignBtn);
    state.settings.visual.alignPos = val;
    document.querySelectorAll("[data-align-btn]").forEach(b => b.classList.toggle("active", parseInt(b.dataset.alignBtn) === val));
    applyVisualSettings(); saveState();
  });

  // 카드 탭
  ["links", "dday", "schedule", "todos", "memo", "statusPanel"].forEach(k => {
    const el = document.getElementById(`vis_${k}`);
    if (el) el.onchange = function() { state.settings.visibleCards[k] = this.checked; applyViewMode(); saveState(); };
  });
  document.getElementById("addQuickAddBtn").onclick = () => {
    const input = document.getElementById("newQuickAddInput");
    const text  = input.value.trim();
    if (!text) return showToast("항목 이름을 입력해주세요.", "warn");
    if (state.settings.quickAddItems.length >= 8) return showToast("Quick Add 항목은 최대 8개까지 가능합니다.", "warn");
    state.settings.quickAddItems.push(text);
    input.value = ""; saveState(); renderQuickAdd(); renderQuickAddSettings();
  };
  document.getElementById("newQuickAddInput").onkeydown = (e) => {
    if (e.key === "Enter" && !e.isComposing) document.getElementById("addQuickAddBtn").click();
  };

  // 데이터 탭
  document.getElementById("set_showSeconds").onchange = function() {
    state.settings.showSeconds = this.checked; saveState(); updateClock();
  };
  ["schedule", "todos", "priority"].forEach(k => {
    const el = document.getElementById(`reset_${k}`);
    if (el) el.onchange = function() { state.settings.dailyReset[k] = this.checked; saveState(); };
  });

  // 백업
  document.getElementById("exportJsonBtn").onclick = () => {
    const jsonStr  = JSON.stringify(state, null, 2);
    const filename = `lively-dashboard-backup-${new Date().toISOString().slice(0,10)}.json`;
    try {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("백업 파일을 저장했습니다.", "success");
    } catch (err) {
      document.getElementById("backupTextContent").value = jsonStr;
      document.getElementById("backupTextArea").classList.remove("hidden");
      showToast("파일 저장 실패 — 아래 텍스트를 복사해 저장하세요.", "warn");
    }
  };
  document.getElementById("exportCopyBtn").onclick = () => {
    const jsonStr = JSON.stringify(state, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr)
        .then(() => showToast("클립보드에 복사됐습니다.", "success"))
        .catch(() => {
          document.getElementById("backupTextContent").value = jsonStr;
          document.getElementById("backupTextArea").classList.remove("hidden");
          showToast("아래 텍스트를 수동으로 복사하세요.", "warn");
        });
    } else {
      document.getElementById("backupTextContent").value = jsonStr;
      document.getElementById("backupTextArea").classList.remove("hidden");
    }
  };
  document.getElementById("importJsonBtn").onclick  = () => document.getElementById("importFileInput").click();
  document.getElementById("importFileInput").onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.meta || !imported.settings) throw new Error("유효하지 않은 형식입니다.");
        state = validateState(imported); saveState(); renderAll();
        showToast("데이터가 성공적으로 복원됐습니다.", "success");
        modal.classList.add("hidden");
      } catch (err) { showToast("복원 실패: " + err.message, "error"); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  document.getElementById("clearTodayBtn").onclick = function() {
    requireConfirm(this, "⚠️ 한 번 더 클릭하면 비워집니다", () => {
      state.schedule = []; state.todos.general = [];
      saveState(); renderAll(); showToast("오늘 일과를 비웠습니다.", "info");
    });
  };
  document.getElementById("factoryResetBtn").onclick = function() {
    requireConfirm(this, "⚠️ 한 번 더 클릭 — 복구 불가!", () => {
      localStorage.removeItem(STORAGE_KEY); localStorage.removeItem("desktop-dashboard-state");
      state = getDefaultState(); saveState(); renderAll();
      modal.classList.add("hidden"); showToast("전체 초기화 완료.", "info");
    });
  };
}

function init() {
  try { window.focus(); } catch(e) {}
  loadState();
  applyThemeMode();
  applyVisualSettings();
  updateClock(); setInterval(updateClock, 1000);
  bindEvents();
  renderAll();
}

init();

/* ==================================================
   livelyPropertyListener — Lively 패널 → CSS 즉시 반영
   시각 설정은 CSS만 override, state에 저장하지 않음
   ================================================== */
function livelyPropertyListener(name, val) {
  if (val === undefined || val === null) return;
  switch(name) {
    case "accentColor":
      if (/^#[0-9a-fA-F]{6}$/.test(val)) { userAccentColor = val; applyCSSColorTheme(val); }
      break;
    case "theme":
      const themeVal = val === 1 ? 'dark' : 'light';
      document.body.setAttribute('data-theme', themeVal);
      state.settings.themeMode = themeVal; saveState();
      break;
    case "wallpaperBg":
      document.body.setAttribute('data-bg-style', val === 1 ? 'transparent' : 'normal');
      break;
    case "cardOpacity":
      document.documentElement.style.setProperty("--card-opacity", (val / 100).toString());
      break;
    case "bgBlur":
      document.documentElement.style.setProperty("--glass-blur-amt", `${val}px`);
      break;
    case "dashScale":
      document.documentElement.style.setProperty("--dashboard-scale", (val / 100).toString());
      break;
    case "topMargin":
      document.documentElement.style.setProperty("--dashboard-margin-top", `${val}px`);
      break;
    case "alignPos": {
      const wrapper = document.querySelector('.dashboard-wrapper');
      if (!wrapper) break;
      if      (val === 1) { wrapper.style.justifyContent = 'flex-start'; wrapper.style.paddingLeft = '40px'; wrapper.style.paddingRight = '0'; }
      else if (val === 2) { wrapper.style.justifyContent = 'flex-end';   wrapper.style.paddingLeft = '0';    wrapper.style.paddingRight = '40px'; }
      else                { wrapper.style.justifyContent = 'center';     wrapper.style.paddingLeft = '';     wrapper.style.paddingRight = ''; }
      break;
    }
    case "showSeconds":
      state.settings.showSeconds = (val === true || val === 1); saveState(); updateClock();
      break;
    case "resetDataBtn":
      showToast("5초 후 전체 초기화됩니다. 취소하려면 Lively 패널을 닫으세요.", "warn");
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY); localStorage.removeItem("desktop-dashboard-state");
        state = getDefaultState(); saveState(); renderAll();
        showToast("초기화 완료.", "info");
      }, 5000);
      break;
  }
}
