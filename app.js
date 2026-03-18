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

function getDefaultState() {
  return {
    settings: {
      showSeconds: true,
      // statusPanel: 헤더에 미니 버튼이 생겨서 기본 숨김. 설정에서 다시 켤 수 있음
      visibleCards: { priority: true, links: true, dday: true, schedule: true, todos: true, memo: true, statusPanel: false },
      themeMode: "light",
      dailyReset: { schedule: true, todos: true, priority: false },
      quickAddItems: ["💧 물 마시기", "🤸 스트레칭", "🪟 환기"],
      visual: {
        accentPreset: "pink",
        accentCustom: "#f4a2b9",
        cardOpacity: 55,
        bgBlur: 24,
        wallpaperBg: 0,
        dashScale: 100,
        topMargin: 40,
        alignPos: 0
      }
    },
    status: {
      current: "👨‍💻 집중 업무",
      accent: "#f4a2b9"
    },
    priority: ["", "", ""],
    links: [
      { id: Date.now(), title: "Lively", url: "https://rocksdanister.github.io/lively/" }
    ],
    ddays: [],
    schedule: [],
    todos: [
      { id: Date.now(), text: "회의 자료 준비", done: false }
    ],
    memo: "",
    meta: {
      lastDate: new Date().toDateString(),
      version: "1.1.0"
    }
  };
}

let state = null;
let isEditMode = false;
let userAccentColor = null;
let isCompletedCollapsed = true;  // 완료 할 일 접기 (true = 숨김)
let isDdayPastCollapsed = true;   // 지난 D-day 접기 (true = 숨김)

/* ==================================================
   validateState(s)
   손상된 state 객체를 복구하는 함수.
   각 키가 올바른 타입인지 확인하고, 누락된 키는 기본값으로 채움.
   loadState() / 복원(import) 후 항상 호출.
   ================================================== */
function validateState(s) {
  const def = getDefaultState();
  if (!s || typeof s !== 'object') return def;

  // 최상위 배열 키 검증
  if (!Array.isArray(s.priority) || s.priority.length !== 3) s.priority = def.priority;
  if (!Array.isArray(s.links))    s.links    = def.links;
  if (!Array.isArray(s.ddays))    s.ddays    = def.ddays;
  if (!Array.isArray(s.schedule)) s.schedule = def.schedule;
  if (!Array.isArray(s.todos))    s.todos    = def.todos;
  if (typeof s.memo !== 'string') s.memo     = def.memo;

  // settings 검증
  if (!s.settings || typeof s.settings !== 'object') s.settings = def.settings;
  s.settings.visibleCards  = Object.assign({}, def.settings.visibleCards,  s.settings.visibleCards);
  s.settings.dailyReset    = Object.assign({}, def.settings.dailyReset,    s.settings.dailyReset);
  if (!Array.isArray(s.settings.quickAddItems)) s.settings.quickAddItems = def.settings.quickAddItems;
  if (typeof s.settings.showSeconds !== 'boolean') s.settings.showSeconds = def.settings.showSeconds;
  if (!s.settings.themeMode) s.settings.themeMode = def.settings.themeMode;
  if (!s.settings.visual || typeof s.settings.visual !== 'object') {
    s.settings.visual = def.settings.visual;
  } else {
    s.settings.visual = Object.assign({}, def.settings.visual, s.settings.visual);
  }

  // status 검증
  if (!s.status || typeof s.status !== 'object') s.status = def.status;
  if (typeof s.status.current !== 'string') s.status.current = def.status.current;
  if (typeof s.status.accent  !== 'string') s.status.accent  = def.status.accent;

  // meta 검증
  if (!s.meta || typeof s.meta !== 'object') s.meta = def.meta;
  if (typeof s.meta.lastDate !== 'string') s.meta.lastDate = def.meta.lastDate;
  if (!s.meta.version) s.meta.version = def.meta.version;

  // 배열 내부 아이템 기본 검증 (id 없는 항목 제거)
  s.links    = s.links.filter(l => l && l.id && l.title && l.url);
  s.ddays    = s.ddays.filter(d => d && d.id && d.title && d.date);
  s.schedule = s.schedule.filter(sc => sc && sc.id && sc.time && sc.text);
  s.todos    = s.todos.filter(t => t && t.id && typeof t.text === 'string');

  return s;
}

function loadState() {
  const def = getDefaultState();
  const savedV1  = localStorage.getItem(STORAGE_KEY);
  const oldLegacy = localStorage.getItem("desktop-dashboard-state");

  if (savedV1) {
    // ── v1 저장 데이터 로드 ──
    try {
      const parsed = JSON.parse(savedV1);
      state = validateState(Object.assign({}, def, parsed));
    } catch (e) {
      // JSON 파싱 실패 → 기본값으로 복구
      console.warn("[대시보드] 저장 데이터 파싱 실패, 기본값으로 복구:", e);
      state = def;
      // 손상된 데이터 백업 후 제거
      localStorage.setItem(STORAGE_KEY + "-broken-backup", savedV1);
      localStorage.removeItem(STORAGE_KEY);
    }
  } else if (oldLegacy) {
    // ── 구버전(legacy) 마이그레이션 ──
    try {
      const legacy = JSON.parse(oldLegacy);
      if (typeof legacy.status === 'string') def.status.current = legacy.status;
      if (Array.isArray(legacy.quickLinks))  def.links    = legacy.quickLinks.map(l => ({ id: l.id, title: l.name, url: l.url }));
      if (Array.isArray(legacy.priorities))  def.priority = legacy.priorities;
      if (Array.isArray(legacy.ddays))       def.ddays    = legacy.ddays.map(d => ({ id: d.id, title: d.title, date: d.targetDate }));
      if (Array.isArray(legacy.todaySchedule)) def.schedule = legacy.todaySchedule;
      if (Array.isArray(legacy.todos))       def.todos    = legacy.todos;
      if (typeof legacy.memo === 'string')   def.memo     = legacy.memo;
      state = validateState(def);
      saveState(); // v1 포맷으로 저장
    } catch (e) {
      state = def;
    }
  } else {
    state = def;
  }

  // 자정 이후 일과 리셋
  const todayStr = new Date().toDateString();
  if (state.meta.lastDate !== todayStr) {
    if (state.settings.dailyReset.schedule) state.schedule = [];
    if (state.settings.dailyReset.todos)    state.todos    = [];
    if (state.settings.dailyReset.priority) state.priority = ["", "", ""];
    state.meta.lastDate = todayStr;
    saveState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage 용량 초과 또는 접근 불가
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showToast("저장 공간이 부족합니다. 메모나 목록을 줄여주세요.", "error");
    } else {
      console.warn("[대시보드] 저장 실패:", e);
    }
  }
}

// 저장된 themeMode를 body에 적용
// init()에서 호출 → 재시작 후에도 마지막 테마 유지
function applyThemeMode() {
  const mode = state.settings.themeMode || "light";
  document.body.setAttribute("data-theme", mode);
}

// 저장된 시각 설정(visual)을 CSS에 즉시 반영
// Lively livelyPropertyListener가 override하면 그쪽이 우선 (userAccentColor)
function applyVisualSettings() {
  const v = state.settings.visual;

  // 색상: Lively accentColor로 이미 덮인 경우 건드리지 않음
  if (!userAccentColor) {
    const hex = v.accentPreset === "custom"
      ? v.accentCustom
      : (COLOR_PRESETS[v.accentPreset] || COLOR_PRESETS.pink);
    applyCSSColorTheme(hex);
  }

  document.documentElement.style.setProperty("--card-opacity", (v.cardOpacity / 100).toString());
  document.documentElement.style.setProperty("--glass-blur-amt", `${v.bgBlur}px`);
  document.body.setAttribute("data-bg-style", v.wallpaperBg === 1 ? "transparent" : "normal");
  document.documentElement.style.setProperty("--dashboard-scale", (v.dashScale / 100).toString());
  document.documentElement.style.setProperty("--dashboard-margin-top", `${v.topMargin}px`);

  const wrapper = document.querySelector(".dashboard-wrapper");
  if (wrapper) {
    if (v.alignPos === 1) {
      wrapper.style.justifyContent = "flex-start";
      wrapper.style.paddingLeft = "40px";
      wrapper.style.paddingRight = "0";
    } else if (v.alignPos === 2) {
      wrapper.style.justifyContent = "flex-end";
      wrapper.style.paddingLeft = "0";
      wrapper.style.paddingRight = "40px";
    } else {
      wrapper.style.justifyContent = "center";
      wrapper.style.paddingLeft = "";
      wrapper.style.paddingRight = "";
    }
  }
}

/* ==================================================
   showToast(message, type)
   alert() 대체 함수 — CEF/브라우저 모두 안전
   type: 'info'(기본) | 'success' | 'error' | 'warn'
   ================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // 3초 후 제거
  setTimeout(() => { toast.remove(); }, 3000);
}

/* ==================================================
   requireConfirm(btn, confirmText, onConfirm)
   confirm() 대체 함수 — 버튼을 한 번 더 클릭해야 실행
   3초 안에 재클릭 없으면 자동 취소
   ================================================== */
function requireConfirm(btn, confirmText, onConfirm) {
  if (btn.dataset.confirming) return; // 이미 대기 중이면 무시
  const originalText = btn.textContent;
  const originalClass = btn.className;

  btn.textContent = confirmText;
  btn.classList.add("btn-confirming");
  btn.dataset.confirming = "true";

  const timeoutId = setTimeout(() => {
    // 3초 후 자동 취소
    btn.textContent = originalText;
    btn.className = originalClass;
    delete btn.dataset.confirming;
  }, 3000);

  btn.addEventListener("click", function handler() {
    clearTimeout(timeoutId);
    btn.textContent = originalText;
    btn.className = originalClass;
    delete btn.dataset.confirming;
    btn.removeEventListener("click", handler);
    onConfirm();
  }, { once: true });
}

function updateClock() {
  const now = new Date();
  const options = { hour: "2-digit", minute: "2-digit", hour12: false };
  const clockEl = document.getElementById("clock");
  if (state.settings.showSeconds) { clockEl.classList.remove("hide-seconds"); options.second = "2-digit"; }
  else { clockEl.classList.add("hide-seconds"); }
  
  clockEl.textContent = now.toLocaleTimeString("ko-KR", options);
  document.getElementById("dateText").textContent = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

function renderStatus() {
  document.getElementById("currentStatusBadge").textContent = state.status.current;
  
  document.querySelectorAll(".status-btn").forEach((btn) => {
    if (btn.dataset.status === state.status.current) {
      btn.classList.add("active");
      state.status.accent = btn.dataset.color || "#f4a2b9";
    } else {
      btn.classList.remove("active");
    }
  });
  if (!userAccentColor) applyCSSColorTheme(state.status.accent);
  document.getElementById("headerCard").classList.add("themed-border");
}

function applyCSSColorTheme(hexStr) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexStr)) return;
  const num = parseInt(hexStr.slice(1), 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  document.documentElement.style.setProperty("--accent-color", hexStr);
  document.documentElement.style.setProperty("--accent-hover", '#' + [r-20, g-20, b-20].map(x => Math.max(0, x).toString(16).padStart(2, '0')).join(''));
  document.documentElement.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
}

function renderPriority() {
  const list = document.getElementById("priorityList");
  list.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const li = document.createElement("li");
    const num = document.createElement("span"); num.className = "priority-num"; num.textContent = i + 1;
    const input = document.createElement("input");
    input.type = "text"; input.className = "priority-input"; input.maxLength = 30;
    input.placeholder = isEditMode ? `${i+1}순위 입력` : "내용 없음";
    input.value = state.priority[i] || "";
    input.addEventListener("change", (e) => { state.priority[i] = e.target.value.trim(); saveState(); });
    li.append(num, input); list.appendChild(li);
  }
}

function renderLinks() {
  const container = document.getElementById("quickLinksContainer");
  container.innerHTML = "";
  if (state.links.length === 0) {
    // 빈 상태 메시지: 편집 모드일 때는 안내, 보기 모드일 때는 조용한 안내
    container.innerHTML = `<div class="empty-state-grid">${isEditMode ? '+ 위 입력란에서 링크를 추가해보세요.' : '등록된 링크가 없습니다.'}</div>`;
    return;
  }
  
  state.links.forEach(link => {
    const aWrap = document.createElement("a");
    aWrap.className = "link-btn";
    aWrap.href = link.url;
    aWrap.target = "_blank";

    // favicon: 로드 실패 시 이니셜 아이콘(span)으로 교체
    const iconWrap = document.createElement("span");
    iconWrap.className = "link-favicon-wrap";

    const imgIcon = document.createElement("img");
    imgIcon.className = "link-favicon";
    imgIcon.alt = "";
    try {
      imgIcon.src = `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`;
      imgIcon.onerror = () => {
        // 실패 시 이름 첫 글자를 아이콘으로
        imgIcon.style.display = "none";
        const initial = document.createElement("span");
        initial.className = "link-favicon-initial";
        initial.textContent = (link.title || "?")[0].toUpperCase();
        iconWrap.appendChild(initial);
      };
    } catch (e) {
      imgIcon.style.display = "none";
    }
    iconWrap.appendChild(imgIcon);

    const spanName = document.createElement("span");
    spanName.textContent = link.title;

    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.className = "link-del";
    delBtn.onclick = (e) => {
      e.preventDefault();
      state.links = state.links.filter(l => l.id !== link.id);
      saveState(); renderLinks();
    };

    aWrap.append(iconWrap, spanName, delBtn);
    container.appendChild(aWrap);
  });
}

function renderDdays() {
  const list = document.getElementById("ddayList");
  list.innerHTML = "";

  if (state.ddays.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-state-li";
    li.textContent = isEditMode ? "+ 위 입력란에서 마감일을 추가해보세요." : "등록된 마감일이 없습니다.";
    list.appendChild(li);
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);

  // 미래/오늘(upcoming)과 지난(past) 항목 분리
  const upcoming = [];
  const past = [];
  state.ddays.forEach(d => {
    if (!d.date) return;
    const target = new Date(d.date); target.setHours(0,0,0,0);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    (diff >= 0 ? upcoming : past).push({ ...d, diff });
  });

  // 가까운 날짜 순 정렬
  upcoming.sort((a, b) => a.diff - b.diff);
  past.sort((a, b) => b.diff - a.diff); // 가장 최근 지난 항목 먼저

  function makeDdayLi(item, isPast) {
    const label = item.diff === 0 ? `D-Day!` : item.diff > 0 ? `D-${item.diff}` : `D+${Math.abs(item.diff)}`;
    const li = document.createElement("li");
    if (isPast) li.className = "dday-past-row";
    li.innerHTML = `<span style="font-weight:600;">${item.title}</span><div style="display:flex;gap:10px;align-items:center;"><span class="dday-badge ${isPast ? 'dday-past' : ''}">${label}</span><button class="delete-btn" data-id="${item.id}">삭제</button></div>`;
    return li;
  }

  // 빈 상태 (upcoming도 past도 없음)
  if (upcoming.length === 0 && past.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-state-li";
    li.textContent = isEditMode ? "+ 위 입력란에서 마감일을 추가해보세요." : "등록된 마감일이 없습니다.";
    list.appendChild(li);
    return;
  }

  // 다가오는 D-day 렌더링
  if (upcoming.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-state-li";
    li.textContent = "다가오는 마감일이 없습니다.";
    list.appendChild(li);
  } else {
    upcoming.forEach(d => list.appendChild(makeDdayLi(d, false)));
  }

  // 지난 D-day: 접기/펼치기
  if (past.length > 0) {
    const toggleLi = document.createElement("li");
    toggleLi.className = "dday-past-header";
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "dday-past-toggle-btn";
    toggleBtn.textContent = isDdayPastCollapsed
      ? `지난 항목 ${past.length}개 보기 ▾`
      : `▴ 지난 항목 숨기기`;
    toggleBtn.onclick = () => { isDdayPastCollapsed = !isDdayPastCollapsed; renderDdays(); };
    toggleLi.appendChild(toggleBtn);
    list.appendChild(toggleLi);

    if (!isDdayPastCollapsed) {
      past.forEach(d => list.appendChild(makeDdayLi(d, true)));
    }
  }

  // 삭제 버튼 이벤트 일괄 바인딩
  list.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = (e) => {
    state.ddays = state.ddays.filter(i => i.id !== Number(e.target.dataset.id));
    saveState(); renderDdays(); renderSummaryBar();
  });
}

function renderSchedule() {
  const list = document.getElementById("scheduleList");
  list.innerHTML = "";
  const sorted = [...state.schedule].sort((a,b) => a.time.localeCompare(b.time));

  if (sorted.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-state-li";
    li.textContent = isEditMode ? "+ 위 입력란에서 일정을 추가해보세요." : "오늘 등록된 일정이 없습니다.";
    list.appendChild(li);
    return;
  }

  sorted.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<span><strong style="color:var(--accent-color); margin-right:8px;">${s.time}</strong> ${s.text}</span> <button class="delete-btn" data-id="${s.id}">삭제</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = (e) => { state.schedule = state.schedule.filter(i => i.id !== Number(e.target.dataset.id)); saveState(); renderSchedule();});
}

function renderTodos() {
  const list = document.getElementById("todoList");
  list.innerHTML = "";

  const pending = state.todos.filter(t => !t.done);  // 미완료
  const done    = state.todos.filter(t =>  t.done);  // 완료

  // 항목이 아예 없을 때
  if (state.todos.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-state-li";
    li.textContent = isEditMode ? "+ 위 입력란에서 할 일을 추가해보세요." : "할 일이 없습니다.";
    list.appendChild(li);
    return;
  }

  // 미완료 항목 먼저 렌더링
  pending.forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="todo-left"><input type="checkbox" class="todo-cb" data-id="${t.id}"><span>${t.text}</span></div><button class="delete-btn" data-id="${t.id}">삭제</button>`;
    list.appendChild(li);
  });

  // 미완료 항목이 없고 완료 항목만 있을 때 축하 메시지
  if (pending.length === 0 && done.length > 0) {
    const li = document.createElement("li");
    li.className = "empty-state-li";
    li.textContent = "모든 할 일을 완료했어요! 🎉";
    list.appendChild(li);
  }

  // 완료 항목: 접기/펼치기 토글
  if (done.length > 0) {
    const toggleLi = document.createElement("li");
    toggleLi.className = "completed-section-header";
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "completed-toggle-btn";
    toggleBtn.textContent = isCompletedCollapsed
      ? `✓ 완료된 항목 ${done.length}개 보기 ▾`
      : `▴ 완료 항목 숨기기`;
    toggleBtn.onclick = () => { isCompletedCollapsed = !isCompletedCollapsed; renderTodos(); renderSummaryBar(); };
    toggleLi.appendChild(toggleBtn);
    list.appendChild(toggleLi);

    // 펼쳐진 상태일 때만 완료 항목 표시
    if (!isCompletedCollapsed) {
      done.forEach(t => {
        const li = document.createElement("li");
        li.className = "todo-done-row";
        li.innerHTML = `<div class="todo-left"><input type="checkbox" checked class="todo-cb" data-id="${t.id}"><span class="todo-done">${t.text}</span></div><button class="delete-btn" data-id="${t.id}">삭제</button>`;
        list.appendChild(li);
      });
    }
  }

  // 체크박스 이벤트 바인딩
  list.querySelectorAll('.todo-cb').forEach(cb => cb.onchange = (e) => {
    const todo = state.todos.find(i => i.id === Number(e.target.dataset.id));
    if (todo) { todo.done = e.target.checked; saveState(); renderTodos(); renderSummaryBar(); }
  });
  // 삭제 버튼 이벤트 바인딩
  list.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = (e) => {
    state.todos = state.todos.filter(i => i.id !== Number(e.target.dataset.id));
    saveState(); renderTodos(); renderSummaryBar();
  });
}

function renderQuickAdd() {
  const container = document.getElementById("quickAddContainer");
  container.innerHTML = "";
  state.settings.quickAddItems.forEach(text => {
    const btn = document.createElement("button"); btn.className = "quick-btn btn btn-ghost"; 
    btn.style.padding = "6px 10px"; btn.style.fontSize = "0.85rem"; btn.style.border = "1px solid var(--border-color)";
    btn.style.borderRadius = "8px";
    btn.textContent = text;
    btn.onclick = () => { state.todos.push({id:Date.now(), text, done:false}); saveState(); renderTodos(); };
    container.appendChild(btn);
  });
}

function renderMemo() {
  document.getElementById("memoInput").value = state.memo;
}

/* ==================================================
   오늘 요약 바
   - 헤더 아래 한 줄 요약 (일정 수 / 할일 진행률 / 가장 가까운 D-day)
   - 상태 변경 시 renderSummaryBar() 호출하면 갱신됨
   ================================================== */
function renderSummaryBar() {
  const bar = document.getElementById("summaryBar");
  if (!bar) return;

  const totalTodos   = state.todos.length;
  const doneTodos    = state.todos.filter(t => t.done).length;
  const pendingTodos = totalTodos - doneTodos;

  // 가장 가까운 미래 D-day 찾기
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingDdays = state.ddays
    .filter(d => d.date)
    .map(d => {
      const target = new Date(d.date); target.setHours(0, 0, 0, 0);
      const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
      return { title: d.title, diff };
    })
    .filter(d => d.diff >= 0)
    .sort((a, b) => a.diff - b.diff);

  // 칩 조합
  const chips = [];

  if (state.schedule.length > 0) {
    chips.push({ text: `🗓️ 오늘 일정 ${state.schedule.length}개`, accent: false });
  }

  if (totalTodos > 0) {
    const allDone = pendingTodos === 0;
    chips.push({
      text: allDone ? `✅ 모든 할 일 완료!` : `✅ 할 일 ${doneTodos}/${totalTodos} 완료`,
      accent: allDone
    });
  }

  if (upcomingDdays.length > 0) {
    const nearest = upcomingDdays[0];
    const label = nearest.diff === 0 ? `D-Day!` : `D-${nearest.diff}`;
    chips.push({ text: `🎯 ${nearest.title} ${label}`, accent: nearest.diff <= 3 });
  }

  // 렌더링
  if (chips.length === 0) {
    bar.innerHTML = `<span class="summary-greeting">오늘도 수고하세요 ☀️</span>`;
  } else {
    bar.innerHTML = chips
      .map(c => `<span class="summary-chip${c.accent ? ' chip-accent' : ''}">${c.text}</span>`)
      .join('');
  }
}

/* ==================================================
   탭형 설정 패널 유틸
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
    const idx = parseInt(e.target.dataset.idx);
    state.settings.quickAddItems.splice(idx, 1);
    saveState(); renderQuickAdd(); renderQuickAddSettings();
  });
}

// state → 설정 패널 전체 UI 동기화 (모달 열 때 호출)
function syncSettingsUI() {
  const v = state.settings.visual;

  // 디자인 탭
  document.querySelectorAll("[data-theme-btn]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.themeBtn === state.settings.themeMode)
  );
  document.querySelectorAll(".color-preset-btn[data-preset]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.preset === v.accentPreset)
  );
  if (document.getElementById("set_accentCustom")) {
    document.getElementById("set_accentCustom").value = v.accentCustom || "#f4a2b9";
  }
  const customSwatch = document.getElementById("customPresetSwatch");
  if (customSwatch && v.accentPreset === "custom") {
    customSwatch.style.background = v.accentCustom || "#f4a2b9";
  }

  const cardOpSlider = document.getElementById("set_cardOpacity");
  if (cardOpSlider) { cardOpSlider.value = v.cardOpacity; document.getElementById("label_cardOpacity").textContent = v.cardOpacity + "%"; }

  const bgBlurSlider = document.getElementById("set_bgBlur");
  if (bgBlurSlider) { bgBlurSlider.value = v.bgBlur; document.getElementById("label_bgBlur").textContent = v.bgBlur + "px"; }

  document.querySelectorAll("[data-bg-btn]").forEach(btn =>
    btn.classList.toggle("active", parseInt(btn.dataset.bgBtn) === v.wallpaperBg)
  );

  // 레이아웃 탭
  const dashScaleSlider = document.getElementById("set_dashScale");
  if (dashScaleSlider) { dashScaleSlider.value = v.dashScale; document.getElementById("label_dashScale").textContent = v.dashScale + "%"; }

  const topMarginSlider = document.getElementById("set_topMargin");
  if (topMarginSlider) { topMarginSlider.value = v.topMargin; document.getElementById("label_topMargin").textContent = v.topMargin + "px"; }

  document.querySelectorAll("[data-align-btn]").forEach(btn =>
    btn.classList.toggle("active", parseInt(btn.dataset.alignBtn) === v.alignPos)
  );

  // 카드 탭
  ["priority", "links", "dday", "schedule", "todos", "memo", "statusPanel"].forEach(k => {
    const el = document.getElementById(`vis_${k}`);
    if (el) el.checked = (state.settings.visibleCards[k] !== false);
  });
  renderQuickAddSettings();

  // 데이터 탭
  document.getElementById("set_showSeconds").checked = state.settings.showSeconds;
  ["schedule", "todos", "priority"].forEach(k =>
    document.getElementById(`reset_${k}`).checked = state.settings.dailyReset[k]
  );
}

function applyViewMode() {
  document.body.classList.toggle("edit-mode", isEditMode);
  const tgBtn = document.getElementById("editModeToggle");
  tgBtn.textContent = isEditMode ? "🔒 편집 완료" : "✏️ 편집";
  tgBtn.className = isEditMode ? "btn btn-primary" : "btn btn-ghost";
  
  const vis = state.settings.visibleCards;
  document.querySelector('[data-card="priority"]').classList.toggle('hidden', !vis.priority);
  document.querySelector('[data-card="links"]').classList.toggle('hidden', !vis.links);
  document.querySelector('[data-card="dday"]').classList.toggle('hidden', !vis.dday);
  document.querySelector('[data-card="schedule"]').classList.toggle('hidden', !vis.schedule);
  document.querySelector('[data-card="todos"]').classList.toggle('hidden', !vis.todos);
  document.querySelector('[data-card="memo"]').classList.toggle('hidden', !vis.memo);
  // 상태 제어판: statusPanel이 undefined(구버전 state)이면 true로 처리
  const showStatusPanel = (vis.statusPanel !== false);
  document.querySelector('[data-card="statusPanel"]').classList.toggle('hidden', !showStatusPanel);
}

function renderAll() {
  renderStatus();
  renderPriority();
  renderLinks();
  renderDdays();
  renderSchedule();
  renderTodos();
  renderQuickAdd();
  renderMemo();
  applyViewMode();
  renderSummaryBar(); // 요약 바는 항상 마지막에 갱신
}

function bindEvents() {
  
  flatpickr("#ddayDate", { locale: "ko", dateFormat: "Y-m-d", disableMobile: true, allowInput: false });
  flatpickr("#scheduleTime", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, disableMobile: true, allowInput: false });

  document.querySelectorAll('input[type="text"], input[type="url"], textarea').forEach(el => {
    el.addEventListener('mousedown', function(e) {
      if (document.activeElement !== this && isEditMode) setTimeout(() => this.focus(), 0);
    });
  });

  document.getElementById("editModeToggle").onclick = () => { isEditMode = !isEditMode; applyViewMode(); renderPriority(); };
  
  document.getElementById("addLinkBtn").onclick = () => {
    const n = document.getElementById("linkName").value.trim();
    let u = document.getElementById("linkUrl").value.trim();
    if(!n || !u) return showToast("이름과 URL을 모두 입력해주세요.", "warn");
    if(!u.startsWith("http")) u = "https://" + u;
    state.links.push({id: Date.now(), title: n, url: u});
    document.getElementById("linkName").value = ""; document.getElementById("linkUrl").value = "";
    saveState(); renderLinks();
  };

  document.getElementById("addDdayBtn").onclick = () => {
    const t = document.getElementById("ddayTitle").value.trim();
    const d = document.getElementById("ddayDate").value;
    if(!t || !d) return showToast("목표와 날짜를 올바르게 선택해주세요.", "warn");
    state.ddays.push({id: Date.now(), title: t, date: d});
    document.getElementById("ddayTitle").value = ""; document.getElementById("ddayDate").value = "";
    saveState(); renderDdays();
  };

  document.getElementById("addScheduleBtn").onclick = () => {
    const time = document.getElementById("scheduleTime").value;
    const txt = document.getElementById("scheduleText").value.trim();
    if(!time || !txt) return showToast("시간과 일정을 모두 입력해주세요.", "warn");
    state.schedule.push({id: Date.now(), time: time, text: txt});
    document.getElementById("scheduleTime").value = ""; document.getElementById("scheduleText").value = "";
    saveState(); renderSchedule();
  };

  document.getElementById("addTodoBtn").onclick = () => {
    const txt = document.getElementById("todoInput").value.trim();
    if(!txt) return;
    state.todos.push({id: Date.now(), text: txt, done: false});
    document.getElementById("todoInput").value = "";
    saveState(); renderTodos();
  };

  document.getElementById("memoInput").oninput = (e) => {
    state.memo = e.target.value; saveState();
  };

  document.getElementById("todoInput").onkeydown = (e) => { if (e.key === "Enter") document.getElementById("addTodoBtn").click(); };
  document.getElementById("scheduleText").onkeydown = (e) => { if (e.key === "Enter") document.getElementById("addScheduleBtn").click(); };

  // 상태 버튼은 편집 모드 없이도 항상 클릭 가능
  // (상태 변경은 데이터 편집이 아닌 빠른 전환 액션이므로)
  document.querySelectorAll(".status-btn").forEach((btn) => {
    btn.onclick = () => { state.status.current = btn.dataset.status; saveState(); renderStatus(); };
  });

  /* ================= Settings Modal Logic ================= */
  const modal = document.getElementById("settingsModal");

  // 모달 열기: state → UI 동기화 후 디자인 탭으로 열림
  document.getElementById("settingsBtn").onclick = () => {
    syncSettingsUI();
    switchSettingsTab("design");
    modal.classList.remove("hidden");
  };

  // 모달 닫기: 단순 닫기 (각 컨트롤에서 즉시 저장됨)
  document.getElementById("closeSettingsBtn").onclick = () => modal.classList.add("hidden");

  // 탭 전환 버튼
  document.querySelectorAll(".settings-tab-btn").forEach(btn =>
    btn.onclick = () => switchSettingsTab(btn.dataset.tab)
  );

  // ── 디자인 탭 이벤트 ──

  // 테마 토글
  document.querySelectorAll("[data-theme-btn]").forEach(btn => btn.onclick = () => {
    const mode = btn.dataset.themeBtn;
    state.settings.themeMode = mode;
    document.querySelectorAll("[data-theme-btn]").forEach(b => b.classList.toggle("active", b.dataset.themeBtn === mode));
    applyThemeMode(); saveState();
  });

  // 색상 프리셋
  document.querySelectorAll(".color-preset-btn[data-preset]").forEach(btn => btn.onclick = () => {
    const preset = btn.dataset.preset;
    if (preset === "custom") {
      // 커스텀: color picker 열기
      document.getElementById("set_accentCustom").click();
      return;
    }
    state.settings.visual.accentPreset = preset;
    document.querySelectorAll(".color-preset-btn[data-preset]").forEach(b => b.classList.toggle("active", b.dataset.preset === preset));
    applyVisualSettings(); saveState();
  });

  // 커스텀 색상 피커
  document.getElementById("set_accentCustom").oninput = function() {
    state.settings.visual.accentPreset = "custom";
    state.settings.visual.accentCustom = this.value;
    document.querySelectorAll(".color-preset-btn[data-preset]").forEach(b => b.classList.toggle("active", b.dataset.preset === "custom"));
    const swatch = document.getElementById("customPresetSwatch");
    if (swatch) swatch.style.background = this.value;
    applyVisualSettings(); saveState();
  };

  // 카드 투명도 슬라이더
  document.getElementById("set_cardOpacity").oninput = function() {
    state.settings.visual.cardOpacity = parseInt(this.value);
    document.getElementById("label_cardOpacity").textContent = this.value + "%";
    applyVisualSettings(); saveState();
  };

  // 블러 강도 슬라이더
  document.getElementById("set_bgBlur").oninput = function() {
    state.settings.visual.bgBlur = parseInt(this.value);
    document.getElementById("label_bgBlur").textContent = this.value + "px";
    applyVisualSettings(); saveState();
  };

  // 배경 스타일 토글
  document.querySelectorAll("[data-bg-btn]").forEach(btn => btn.onclick = () => {
    const val = parseInt(btn.dataset.bgBtn);
    state.settings.visual.wallpaperBg = val;
    document.querySelectorAll("[data-bg-btn]").forEach(b => b.classList.toggle("active", parseInt(b.dataset.bgBtn) === val));
    applyVisualSettings(); saveState();
  });

  // ── 레이아웃 탭 이벤트 ──

  // 크기 배율 슬라이더
  document.getElementById("set_dashScale").oninput = function() {
    state.settings.visual.dashScale = parseInt(this.value);
    document.getElementById("label_dashScale").textContent = this.value + "%";
    applyVisualSettings(); saveState();
  };

  // 상단 간격 슬라이더
  document.getElementById("set_topMargin").oninput = function() {
    state.settings.visual.topMargin = parseInt(this.value);
    document.getElementById("label_topMargin").textContent = this.value + "px";
    applyVisualSettings(); saveState();
  };

  // 화면 정렬 토글
  document.querySelectorAll("[data-align-btn]").forEach(btn => btn.onclick = () => {
    const val = parseInt(btn.dataset.alignBtn);
    state.settings.visual.alignPos = val;
    document.querySelectorAll("[data-align-btn]").forEach(b => b.classList.toggle("active", parseInt(b.dataset.alignBtn) === val));
    applyVisualSettings(); saveState();
  });

  // ── 카드 탭 이벤트 ──

  // 카드 표시/숨김 체크박스 — 즉시 반영
  ["priority", "links", "dday", "schedule", "todos", "memo", "statusPanel"].forEach(k => {
    const el = document.getElementById(`vis_${k}`);
    if (el) el.onchange = function() {
      state.settings.visibleCards[k] = this.checked;
      applyViewMode(); saveState();
    };
  });

  // Quick Add 새 항목 추가
  document.getElementById("addQuickAddBtn").onclick = () => {
    const input = document.getElementById("newQuickAddInput");
    const text = input.value.trim();
    if (!text) return showToast("항목 이름을 입력해주세요.", "warn");
    if (state.settings.quickAddItems.length >= 8) return showToast("Quick Add 항목은 최대 8개까지 가능합니다.", "warn");
    state.settings.quickAddItems.push(text);
    input.value = "";
    saveState(); renderQuickAdd(); renderQuickAddSettings();
  };
  document.getElementById("newQuickAddInput").onkeydown = (e) => {
    if (e.key === "Enter") document.getElementById("addQuickAddBtn").click();
  };

  // ── 데이터 탭 이벤트 ──

  // 시계 초 표시 — 즉시 반영
  document.getElementById("set_showSeconds").onchange = function() {
    state.settings.showSeconds = this.checked;
    saveState(); updateClock();
  };

  // 자동 리셋 규칙 — 즉시 저장
  ["schedule", "todos", "priority"].forEach(k => {
    document.getElementById(`reset_${k}`).onchange = function() {
      state.settings.dailyReset[k] = this.checked;
      saveState();
    };
  });

  // ⬇️ 파일 백업: blob URL 방식 (CEF에서 실패 시 텍스트 복사 영역 노출)
  document.getElementById("exportJsonBtn").onclick = () => {
    const jsonStr = JSON.stringify(state, null, 2);
    const filename = `lively-dashboard-backup-${new Date().toISOString().slice(0,10)}.json`;
    try {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("백업 파일을 저장했습니다.", "success");
    } catch (err) {
      // CEF에서 다운로드 실패 시 텍스트 복사 영역으로 fallback
      document.getElementById("backupTextContent").value = jsonStr;
      document.getElementById("backupTextArea").classList.remove("hidden");
      showToast("파일 저장 실패 — 아래 텍스트를 복사해 저장하세요.", "warn");
    }
  };

  // 📋 텍스트 복사 백업 (clipboard API 또는 수동 fallback)
  document.getElementById("exportCopyBtn").onclick = () => {
    const jsonStr = JSON.stringify(state, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr)
        .then(() => showToast("클립보드에 복사됐습니다. 메모장에 붙여넣어 .json으로 저장하세요.", "success"))
        .catch(() => {
          // clipboard API 실패 시 textarea 표시
          document.getElementById("backupTextContent").value = jsonStr;
          document.getElementById("backupTextArea").classList.remove("hidden");
          showToast("아래 텍스트를 수동으로 복사하세요.", "warn");
        });
    } else {
      // clipboard API 없는 환경
      document.getElementById("backupTextContent").value = jsonStr;
      document.getElementById("backupTextArea").classList.remove("hidden");
    }
  };

  // ⬆️ 복원
  document.getElementById("importJsonBtn").onclick = () => document.getElementById("importFileInput").click();
  document.getElementById("importFileInput").onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.meta || !imported.settings) throw new Error("유효하지 않은 형식입니다.");
        state = validateState(imported); saveState(); renderAll();
        showToast("데이터가 성공적으로 복원됐습니다.", "success");
        modal.classList.add("hidden");
      } catch (err) {
        showToast("복원 실패: " + err.message, "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // 오늘 일과 비우기: 한 번 더 클릭으로 확인
  document.getElementById("clearTodayBtn").onclick = function() {
    requireConfirm(this, "⚠️ 한 번 더 클릭하면 비워집니다", () => {
      state.schedule = []; state.todos = [];
      saveState(); renderAll();
      showToast("오늘 일과를 비웠습니다.", "info");
    });
  };

  // 전체 초기화: 한 번 더 클릭으로 확인
  document.getElementById("factoryResetBtn").onclick = function() {
    requireConfirm(this, "⚠️ 한 번 더 클릭 — 복구 불가!", () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("desktop-dashboard-state");
      state = getDefaultState(); saveState(); renderAll();
      modal.classList.add("hidden");
      showToast("전체 초기화 완료.", "info");
    });
  };
}

function init() {
  loadState();
  applyThemeMode();      // ← 저장된 테마를 먼저 적용 (깜빡임 방지)
  applyVisualSettings(); // ← 저장된 시각 설정 복원
  updateClock(); setInterval(updateClock, 1000);
  bindEvents();
  renderAll();
}

init();

function livelyPropertyListener(name, val) {
  if (val === undefined || val === null) return;
  switch(name) {
    // 기존 처리 항목
    case "accentColor":
      if (/^#[0-9a-fA-F]{6}$/.test(val)) { userAccentColor = val; applyCSSColorTheme(val); }
      break;
    case "theme":
      const themeVal = val === 1 ? 'dark' : 'light';
      document.body.setAttribute('data-theme', themeVal);
      state.settings.themeMode = themeVal; // 재시작 후에도 유지되도록 저장
      saveState();
      break;
    // 아래 항목들은 Lively 패널에서 즉시 CSS 오버라이드만 함.
    // state.settings.visual 저장 안 함 — 대시보드 설정 패널이 단독 소스.
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
      if (val === 1) {
        wrapper.style.justifyContent = 'flex-start';
        wrapper.style.paddingLeft = '40px';
        wrapper.style.paddingRight = '0';
      } else if (val === 2) {
        wrapper.style.justifyContent = 'flex-end';
        wrapper.style.paddingLeft = '0';
        wrapper.style.paddingRight = '40px';
      } else {
        wrapper.style.justifyContent = 'center';
        wrapper.style.paddingLeft = '';
        wrapper.style.paddingRight = '';
      }
      break;
    }
    case "showSeconds":
      // Lively 패널의 "시계 초 단위 표시" 체크박스
      state.settings.showSeconds = (val === true || val === 1);
      saveState();
      updateClock();
      break;
    case "resetDataBtn":
      // Lively 패널의 "모든 입력 데이터 초기화" 버튼
      // confirm() 대신 5초 딜레이 후 자동 실행 (Lively 패널에서 confirm 불가)
      showToast("5초 후 전체 초기화됩니다. 취소하려면 Lively 패널을 닫으세요.", "warn");
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("desktop-dashboard-state");
        state = getDefaultState();
        saveState();
        renderAll();
        showToast("초기화 완료.", "info");
      }, 5000);
      break;
  }
}
