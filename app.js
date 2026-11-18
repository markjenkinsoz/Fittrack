/* FitTrack — on-device calorie, protein, and workout tracker */
(() => {
  "use strict";

  const STORAGE_KEY = "fittrack-v1";
  const APP_VERSION = 1;

  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }
  function isToday(key) {
    return key === dateKey();
  }
  function formatDate(key, style = "medium") {
    if (style === "title") {
      if (isToday(key)) return "Today";
      if (key === addDays(dateKey(), -1)) return "Yesterday";
    }
    const opts =
      style === "full"
        ? { weekday: "long", month: "long", day: "numeric" }
        : style === "short"
          ? { month: "short", day: "numeric" }
          : { weekday: "short", month: "short", day: "numeric" };
    return parseKey(key).toLocaleDateString("en-US", opts);
  }
  function weekdayNarrow(key) {
    return parseKey(key).toLocaleDateString("en-US", { weekday: "narrow" });
  }
  function weekStartSunday(keyOrDate) {
    const d = typeof keyOrDate === "string" ? parseKey(keyOrDate) : new Date(keyOrDate);
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    copy.setDate(copy.getDate() - copy.getDay());
    return dateKey(copy);
  }
  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function fmtNum(n, digits = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return x.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }
  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }
  function numOrZero(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function emptyData() {
    return {
      version: APP_VERSION,
      settings: { calorieGoal: 2200, proteinGoal: 160 },
      days: {},
      favorites: [],
      recents: [],
      exerciseNames: [],
      workouts: [],
    };
  }

  function normalize(raw) {
    const data = emptyData();
    if (!raw || typeof raw !== "object") return data;
    if (raw.settings) {
      const c = Number(raw.settings.calorieGoal);
      const p = Number(raw.settings.proteinGoal);
      if (c > 0) data.settings.calorieGoal = Math.round(c);
      if (p > 0) data.settings.proteinGoal = p;
    }
    if (raw.days && typeof raw.days === "object") data.days = raw.days;
    if (Array.isArray(raw.favorites)) data.favorites = raw.favorites;
    if (Array.isArray(raw.recents)) data.recents = raw.recents;
    if (Array.isArray(raw.exerciseNames)) data.exerciseNames = raw.exerciseNames;
    if (Array.isArray(raw.workouts)) data.workouts = raw.workouts;
    return data;
  }

  const store = {
    data: emptyData(),
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        this.data = raw ? normalize(JSON.parse(raw)) : emptyData();
      } catch (err) {
        console.warn("FitTrack: could not read saved data", err);
        this.data = emptyData();
      }
    },
    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    },
    exportPayload() {
      return Object.assign({}, this.data, {
        exportedAt: new Date().toISOString(),
        version: APP_VERSION,
      });
    },
    importPayload(obj) {
      this.data = normalize(obj);
      this.save();
    },
    foodsOn(date) {
      return (this.data.days[date] && this.data.days[date].foods) || [];
    },
    totals(date) {
      return this.foodsOn(date).reduce(
        (acc, food) => ({
          calories: acc.calories + numOrZero(food.calories),
          protein: acc.protein + numOrZero(food.protein),
        }),
        { calories: 0, protein: 0 }
      );
    },
    addFood(date, food) {
      if (!this.data.days[date]) this.data.days[date] = { foods: [] };
      const item = {
        id: uid(),
        name: String(food.name || "").trim(),
        calories: numOrZero(food.calories),
        protein: numOrZero(food.protein),
        createdAt: Date.now(),
      };
      this.data.days[date].foods.push(item);
      this._touchRecent(item);
      if (food.favorite) this._ensureFavorite(item);
      this.save();
      return item;
    },
    updateFood(date, id, patch) {
      const item = this.foodsOn(date).find((food) => food.id === id);
      if (!item) return;
      if (patch.name != null) item.name = String(patch.name).trim();
      if (patch.calories != null) item.calories = numOrZero(patch.calories);
      if (patch.protein != null) item.protein = numOrZero(patch.protein);
      this.save();
    },
    deleteFood(date, id) {
      const day = this.data.days[date];
      if (!day) return;
      day.foods = day.foods.filter((food) => food.id !== id);
      this.save();
    },
    _touchRecent(item) {
      const rec = { name: item.name, calories: item.calories, protein: item.protein };
      this.data.recents = [
        rec,
        ...this.data.recents.filter((r) => r.name.toLowerCase() !== rec.name.toLowerCase()),
      ].slice(0, 16);
    },
    _ensureFavorite(item) {
      const key = item.name.toLowerCase();
      const existing = this.data.favorites.find((f) => f.name.toLowerCase() === key);
      if (existing) {
        existing.calories = item.calories;
        existing.protein = item.protein;
      } else {
        this.data.favorites.push({
          id: uid(),
          name: item.name,
          calories: item.calories,
          protein: item.protein,
        });
      }
    },
    isFavorite(name) {
      return this.data.favorites.some((f) => f.name.toLowerCase() === name.toLowerCase());
    },
    toggleFavorite(item) {
      const key = item.name.toLowerCase();
      const idx = this.data.favorites.findIndex((f) => f.name.toLowerCase() === key);
      if (idx >= 0) this.data.favorites.splice(idx, 1);
      else this._ensureFavorite(item);
      this.save();
    },
    setGoals(calorieGoal, proteinGoal) {
      this.data.settings.calorieGoal = Math.max(1, Math.round(numOrZero(calorieGoal) || 2200));
      this.data.settings.proteinGoal = Math.max(1, numOrZero(proteinGoal) || 160);
      this.save();
    },
    rememberExercise(name) {
      const n = String(name || "").trim();
      if (!n) return;
      this.data.exerciseNames = [
        n,
        ...this.data.exerciseNames.filter((x) => x.toLowerCase() !== n.toLowerCase()),
      ].slice(0, 80);
    },
    getWorkout(id) {
      return this.data.workouts.find((w) => w.id === id) || null;
    },
    listWorkouts() {
      return this.data.workouts.slice().sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
    },
    createWorkout(date) {
      const w = {
        id: uid(),
        date,
        notes: "",
        exercises: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.data.workouts.push(w);
      this.save();
      return w;
    },
    updateWorkout(id, patch) {
      const w = this.getWorkout(id);
      if (!w) return;
      if (patch.notes != null) w.notes = patch.notes;
      if (patch.date != null) w.date = patch.date;
      w.updatedAt = Date.now();
      this.save();
    },
    deleteWorkout(id) {
      this.data.workouts = this.data.workouts.filter((w) => w.id !== id);
      this.save();
    },
    addExercise(workoutId, name) {
      const w = this.getWorkout(workoutId);
      if (!w) return null;
      const ex = { id: uid(), name: String(name || "").trim(), sets: [] };
      if (!ex.name) return null;
      w.exercises.push(ex);
      w.updatedAt = Date.now();
      this.rememberExercise(ex.name);
      this.save();
      return ex;
    },
    deleteExercise(workoutId, exId) {
      const w = this.getWorkout(workoutId);
      if (!w) return;
      w.exercises = w.exercises.filter((e) => e.id !== exId);
      w.updatedAt = Date.now();
      this.save();
    },
    addSet(workoutId, exId, set) {
      const w = this.getWorkout(workoutId);
      if (!w) return;
      const ex = w.exercises.find((e) => e.id === exId);
      if (!ex) return;
      ex.sets.push({
        id: uid(),
        reps: numOrZero(set && set.reps),
        weight: numOrZero(set && set.weight),
      });
      w.updatedAt = Date.now();
      this.save();
    },
    updateSet(workoutId, exId, setId, patch) {
      const w = this.getWorkout(workoutId);
      if (!w) return;
      const ex = w.exercises.find((e) => e.id === exId);
      if (!ex) return;
      const s = ex.sets.find((x) => x.id === setId);
      if (!s) return;
      if (patch.reps != null) s.reps = numOrZero(patch.reps);
      if (patch.weight != null) s.weight = numOrZero(patch.weight);
      w.updatedAt = Date.now();
      this.save();
    },
    deleteSet(workoutId, exId, setId) {
      const w = this.getWorkout(workoutId);
      if (!w) return;
      const ex = w.exercises.find((e) => e.id === exId);
      if (!ex) return;
      ex.sets = ex.sets.filter((s) => s.id !== setId);
      w.updatedAt = Date.now();
      this.save();
    },
    lastTimeFor(exerciseName, beforeWorkoutId) {
      const key = String(exerciseName || "").trim().toLowerCase();
      if (!key) return null;
      const current = this.getWorkout(beforeWorkoutId);
      const currentDate = current ? current.date : dateKey();
      const currentCreated = current ? current.createdAt : Date.now();
      const matches = this.data.workouts
        .filter((w) => w.id !== beforeWorkoutId)
        .map((w) => {
          const ex = (w.exercises || []).find((e) => e.name.toLowerCase() === key);
          return ex && ex.sets && ex.sets.length ? { workout: w, exercise: ex } : null;
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.workout.date !== b.workout.date) return a.workout.date < b.workout.date ? 1 : -1;
          return (b.workout.createdAt || 0) - (a.workout.createdAt || 0);
        });
      return (
        matches.find(
          (m) =>
            m.workout.date < currentDate ||
            (m.workout.date === currentDate && (m.workout.createdAt || 0) < currentCreated)
        ) ||
        matches[0] ||
        null
      );
    },
    applyLastSets(workoutId, exId) {
      const w = this.getWorkout(workoutId);
      if (!w) return;
      const ex = w.exercises.find((e) => e.id === exId);
      if (!ex) return;
      const last = this.lastTimeFor(ex.name, workoutId);
      if (!last) return;
      ex.sets = last.exercise.sets.map((s) => ({
        id: uid(),
        reps: s.reps,
        weight: s.weight,
      }));
      w.updatedAt = Date.now();
      this.save();
    },
    workoutsInRange(startKey, endKey) {
      return this.data.workouts.filter((w) => w.date >= startKey && w.date <= endKey);
    },
  };

  const ui = {
    tab: "today",
    date: dateKey(),
    workoutId: null,
    historyRange: 7,
    sheet: null,
  };

  const els = {
    main: document.getElementById("main"),
    overlay: document.getElementById("overlay"),
    sheet: document.getElementById("sheet"),
    toast: document.getElementById("toast"),
    importFile: document.getElementById("import-file"),
  };

  let toastTimer = 0;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2200);
  }

  function closeSheet() {
    ui.sheet = null;
    els.sheet.hidden = true;
    els.sheet.innerHTML = "";
    els.overlay.hidden = true;
  }

  function openSheet(innerHtml) {
    els.sheet.innerHTML = `<div class="sheet-handle"></div>${innerHtml}`;
    els.sheet.hidden = false;
    els.overlay.hidden = false;
    const first = els.sheet.querySelector("input, textarea, select, button.btn");
    if (first && first.tagName !== "BUTTON") setTimeout(() => first.focus(), 50);
  }

  function chevron(dir) {
    if (dir === "left") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5 1.5-1.5L11 12l5-5-1.5-1.5Z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 8 7l5 5-5 5 1.5 1.5L16 12 9.5 5.5Z"/></svg>';
  }

  function ringCard(kind, value, goal, unit) {
    const r = 46;
    const c = 2 * Math.PI * r;
    const pct = goal > 0 ? clamp(value / goal, 0, 1) : 0;
    const offset = c * (1 - pct);
    const over = value > goal + 0.049;
    const left = goal - value;
    const color = kind === "cal" ? "var(--cal)" : "var(--pro)";
    const label = kind === "cal" ? "Calories" : "Protein";
    const digits = kind === "cal" ? 0 : 1;
    let metaClass = over ? "over" : kind === "cal" ? "left-cal" : "left-pro";
    let meta = over
      ? `${fmtNum(value - goal, digits)} over`
      : `${fmtNum(left, digits)}${kind === "pro" ? " g" : ""} left`;
    return `
      <article class="ring-card" data-testid="ring-${kind}">
        <div class="ring-wrap">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="track" cx="60" cy="60" r="${r}"></circle>
            <circle class="value" cx="60" cy="60" r="${r}"
              stroke="${color}"
              stroke-dasharray="${c.toFixed(2)}"
              stroke-dashoffset="${offset.toFixed(2)}"></circle>
          </svg>
          <div class="ring-center">
            <div class="num">${fmtNum(value, digits)}</div>
            <div class="unit">of ${fmtNum(goal, digits)}${unit}</div>
          </div>
        </div>
        <div class="ring-label">${label}</div>
        <div class="ring-meta ${metaClass}">${esc(meta)}</div>
      </article>`;
  }

  function quickAdds() {
    const favIds = new Set(store.data.favorites.map((f) => f.name.toLowerCase()));
    const merged = [];
    const seen = new Set();
    for (const item of [...store.data.favorites, ...store.data.recents]) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ item, fav: favIds.has(key) });
    }
    if (!merged.length) return "";
    return `
      <div class="section-head"><h3>Quick add</h3></div>
      <div class="chip-row" data-testid="quick-add">
        ${merged
          .map(
            ({ item, fav }) => `
          <button type="button" class="chip ${fav ? "fav" : ""}" data-act="quick-add"
            data-name="${esc(item.name)}" data-calories="${esc(item.calories)}" data-protein="${esc(item.protein)}">
            <span class="name">${esc(item.name)}</span>
            <span class="meta">${fmtNum(item.calories)} cal · ${fmtNum(item.protein, 1)} g</span>
          </button>`
          )
          .join("")}
      </div>`;
  }

  function renderToday() {
    const date = ui.date;
    const foods = store.foodsOn(date);
    const totals = store.totals(date);
    const { calorieGoal, proteinGoal } = store.data.settings;
    const nextDisabled = isToday(date) ? "disabled" : "";
    return `
      <div class="date-nav">
        <button type="button" class="icon-btn" data-act="prev-day" aria-label="Previous day">${chevron("left")}</button>
        <div class="date-block">
          <h2 data-testid="date-title">${esc(formatDate(date, "title"))}</h2>
          <div class="sub">${esc(formatDate(date, "full"))}</div>
        </div>
        <button type="button" class="icon-btn" data-act="next-day" aria-label="Next day" ${nextDisabled}>${chevron("right")}</button>
      </div>
      <div class="rings">
        ${ringCard("cal", totals.calories, calorieGoal, "")}
        ${ringCard("pro", totals.protein, proteinGoal, " g")}
      </div>
      ${quickAdds()}
      <div class="section-head">
        <h3>Food log</h3>
        <span class="sub">${foods.length} item${foods.length === 1 ? "" : "s"}</span>
      </div>
      ${
        foods.length
          ? `<div class="food-list" data-testid="food-list">${foods
              .map(
                (food) => `
            <div class="food-row" data-id="${esc(food.id)}">
              <div>
                <div class="name">${esc(food.name)}</div>
                <div class="meta">${fmtNum(food.calories)} cal · ${fmtNum(food.protein, 1)} g protein</div>
              </div>
              <div class="food-actions">
                <button type="button" class="icon-btn" data-act="toggle-fav" data-id="${esc(food.id)}"
                  aria-label="${store.isFavorite(food.name) ? "Remove favorite" : "Save favorite"}" title="Favorite">
                  ${store.isFavorite(food.name) ? "★" : "☆"}
                </button>
                <button type="button" class="icon-btn" data-act="edit-food" data-id="${esc(food.id)}" aria-label="Edit ${esc(food.name)}">✎</button>
                <button type="button" class="icon-btn" data-act="delete-food" data-id="${esc(food.id)}" aria-label="Delete ${esc(food.name)}">✕</button>
              </div>
            </div>`
              )
              .join("")}</div>`
          : `<div class="empty" data-testid="food-empty"><strong>No food logged</strong>Add a meal or use a quick-add favorite.</div>`
      }
      <div style="height:12px"></div>
      <button type="button" class="btn primary" data-act="add-food">+ Add food</button>
    `;
  }

  function formatSets(sets) {
    return sets.map((s) => `${fmtNum(s.reps)}×${fmtNum(s.weight, 1)}`).join(", ");
  }

  function workoutSummary(w) {
    const exCount = (w.exercises || []).length;
    const setCount = (w.exercises || []).reduce((n, e) => n + (e.sets || []).length, 0);
    const note = (w.notes || "").trim();
    const title = note ? note.split("\n")[0] : "Workout";
    return { title, exCount, setCount };
  }

  function renderWorkoutList() {
    const list = store.listWorkouts();
    return `
      <h2 class="page-title">Workouts</h2>
      <p class="sub">Log sets in pounds, and FitTrack will remember the last time you did an exercise.</p>
      <div style="height:8px"></div>
      <button type="button" class="btn wo" data-act="start-workout">Start workout</button>
      <div class="section-head"><h3>History</h3></div>
      ${
        list.length
          ? `<div class="wo-list" data-testid="workout-list">${list
              .map((w) => {
                const s = workoutSummary(w);
                return `
                <button type="button" class="wo-row" data-act="open-workout" data-id="${esc(w.id)}">
                  <div>
                    <div class="title">${esc(s.title)}</div>
                    <div class="meta">${esc(formatDate(w.date))} · ${s.exCount} exercise${s.exCount === 1 ? "" : "s"} · ${s.setCount} set${s.setCount === 1 ? "" : "s"}</div>
                  </div>
                  <span class="chev">›</span>
                </button>`;
              })
              .join("")}</div>`
          : `<div class="empty"><strong>No workouts yet</strong>Start one for today or a previous day.</div>`
      }
    `;
  }

  function renderWorkoutDetail() {
    const w = store.getWorkout(ui.workoutId);
    if (!w) {
      ui.workoutId = null;
      return renderWorkoutList();
    }
    const names = store.data.exerciseNames;
    return `
      <div class="detail-head">
        <button type="button" class="icon-btn" data-act="close-workout" aria-label="Back to workouts">${chevron("left")}</button>
        <h2>Workout</h2>
        <button type="button" class="icon-btn danger" data-act="delete-workout" aria-label="Delete workout">✕</button>
      </div>
      <div class="stack">
        <div class="field">
          <label for="wo-date">Date</label>
          <input id="wo-date" type="date" value="${esc(w.date)}" data-act="wo-date" />
        </div>
        <div class="field">
          <label for="wo-notes">Notes</label>
          <textarea id="wo-notes" data-act="wo-notes" placeholder="Push day, how it felt…">${esc(w.notes || "")}</textarea>
        </div>
      </div>
      <div class="section-head"><h3>Exercises</h3></div>
      <div class="ex-list" data-testid="exercise-list">
        ${(w.exercises || [])
          .map((ex) => {
            const last = store.lastTimeFor(ex.name, w.id);
            return `
            <article class="ex-card" data-ex-id="${esc(ex.id)}">
              <div class="ex-head">
                <h4>${esc(ex.name)}</h4>
                <button type="button" class="icon-btn danger" data-act="delete-exercise" data-ex-id="${esc(ex.id)}" aria-label="Remove ${esc(ex.name)}">✕</button>
              </div>
              ${
                last
                  ? `<div class="last-time" data-testid="last-time">
                      <span class="label">Last time</span>
                      ${esc(formatDate(last.workout.date, "short"))}: ${esc(formatSets(last.exercise.sets))}
                      <div style="margin-top:6px">
                        <button type="button" class="btn secondary" style="min-height:40px;width:auto;padding:0 12px" data-act="use-last" data-ex-id="${esc(ex.id)}">Use last sets</button>
                      </div>
                    </div>`
                  : ""
              }
              ${
                (ex.sets || []).length
                  ? `<div class="set-head" aria-hidden="true"><span>#</span><span>Reps</span><span>Weight (lb)</span><span></span></div>`
                  : ""
              }
              ${(ex.sets || [])
                .map(
                  (s, i) => `
                <div class="set-row" data-set-id="${esc(s.id)}">
                  <div class="idx">${i + 1}</div>
                  <div>
                    <label class="sr-only" for="reps-${esc(s.id)}">Reps</label>
                    <input id="reps-${esc(s.id)}" type="number" inputmode="numeric" min="0" step="1" value="${esc(s.reps)}"
                      data-act="set-reps" data-ex-id="${esc(ex.id)}" data-set-id="${esc(s.id)}" placeholder="Reps" />
                  </div>
                  <div>
                    <label class="sr-only" for="wt-${esc(s.id)}">Weight (lb)</label>
                    <input id="wt-${esc(s.id)}" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(s.weight)}"
                      data-act="set-weight" data-ex-id="${esc(ex.id)}" data-set-id="${esc(s.id)}" placeholder="lb" />
                  </div>
                  <button type="button" class="icon-btn" data-act="delete-set" data-ex-id="${esc(ex.id)}" data-set-id="${esc(s.id)}" aria-label="Delete set">✕</button>
                </div>`
                )
                .join("")}
              <button type="button" class="btn secondary" data-act="add-set" data-ex-id="${esc(ex.id)}">+ Add set</button>
            </article>`;
          })
          .join("")}
      </div>
      <div style="height:12px"></div>
      <button type="button" class="btn wo" data-act="add-exercise">+ Add exercise</button>
      ${
        names.length
          ? `<datalist id="exercise-names">${names.map((n) => `<option value="${esc(n)}"></option>`).join("")}</datalist>`
          : `<datalist id="exercise-names"></datalist>`
      }
    `;
  }

  function renderWorkouts() {
    return ui.workoutId ? renderWorkoutDetail() : renderWorkoutList();
  }

  function daysBack(n) {
    const keys = [];
    const today = dateKey();
    for (let i = n - 1; i >= 0; i--) keys.push(addDays(today, -i));
    return keys;
  }

  function chart(keys, values, goal, kind) {
    const max = Math.max(goal || 0, ...values, 1);
    const goalTop = 100 - (goal / max) * 100;
    return `
      <div class="chart" data-testid="chart-${kind}">
        <div class="goal-line" style="top:${goalTop}%"></div>
        ${keys
          .map((key, i) => {
            const v = values[i];
            const h = Math.max(v > 0 ? 4 : 2, (v / max) * 100);
            const cls = v > 0 ? kind : "empty";
            const label = keys.length > 14 ? (i === 0 || i === keys.length - 1 || parseKey(key).getDate() === 1 ? String(parseKey(key).getDate()) : "") : weekdayNarrow(key);
            return `<div class="chart-col" title="${esc(formatDate(key))}: ${fmtNum(v, kind === "pro" ? 1 : 0)}">
              <div class="bar-track"><div class="bar ${cls}" style="height:${h}%"></div></div>
              <div class="lbl">${esc(label)}</div>
            </div>`;
          })
          .join("")}
      </div>`;
  }

  function weekBuckets(count) {
    const buckets = [];
    let start = weekStartSunday(dateKey());
    for (let i = 0; i < count; i++) {
      const end = addDays(start, 6);
      buckets.unshift({ start, end });
      start = addDays(start, -7);
    }
    return buckets;
  }

  function renderHistory() {
    const range = ui.historyRange;
    const keys = daysBack(range);
    const calGoal = store.data.settings.calorieGoal;
    const proGoal = store.data.settings.proteinGoal;
    const cals = keys.map((k) => store.totals(k).calories);
    const pros = keys.map((k) => store.totals(k).protein);
    const logged = keys.filter((_, i) => store.foodsOn(keys[i]).length > 0);
    const avgCal = logged.length ? cals.filter((_, i) => store.foodsOn(keys[i]).length).reduce((a, b) => a + b, 0) / logged.length : 0;
    const avgPro = logged.length ? pros.filter((_, i) => store.foodsOn(keys[i]).length).reduce((a, b) => a + b, 0) / logged.length : 0;
    const hitCal = keys.filter((k, i) => store.foodsOn(k).length && cals[i] >= calGoal).length;
    const hitPro = keys.filter((k, i) => store.foodsOn(k).length && pros[i] >= proGoal).length;
    const weeks = weekBuckets(8);
    const weekCounts = weeks.map((w) => {
      const ids = new Set();
      store.workoutsInRange(w.start, w.end).forEach((x) => ids.add(x.id));
      return ids.size;
    });
    const thisWeek = weekCounts[weekCounts.length - 1] || 0;

    return `
      <h2 class="page-title">History</h2>
      <div class="seg" role="group" aria-label="Range">
        <button type="button" data-act="range" data-range="7" aria-pressed="${range === 7}">7 days</button>
        <button type="button" data-act="range" data-range="30" aria-pressed="${range === 30}">30 days</button>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">Avg calories</div><div class="v">${fmtNum(avgCal)}</div></div>
        <div class="stat"><div class="k">Avg protein</div><div class="v">${fmtNum(avgPro, 1)} g</div></div>
        <div class="stat"><div class="k">Days hit cal goal</div><div class="v">${hitCal}/${logged.length || 0}</div></div>
        <div class="stat"><div class="k">Days hit protein</div><div class="v">${hitPro}/${logged.length || 0}</div></div>
      </div>
      <div class="stack">
        <section class="chart-card">
          <h3>Calories vs goal</h3>
          <div class="chart-avg">Goal ${fmtNum(calGoal)} · last ${range} days</div>
          ${chart(keys, cals, calGoal, "cal")}
        </section>
        <section class="chart-card">
          <h3>Protein vs goal</h3>
          <div class="chart-avg">Goal ${fmtNum(proGoal, 1)} g · last ${range} days</div>
          ${chart(keys, pros, proGoal, "pro")}
        </section>
        <section class="chart-card">
          <h3>Workouts per week</h3>
          <div class="chart-avg">${thisWeek} this week (Sun–Sat)</div>
          <div class="chart" data-testid="chart-wo">
            ${weeks
              .map((w, i) => {
                const max = Math.max(5, ...weekCounts);
                const v = weekCounts[i];
                const h = Math.max(v > 0 ? 8 : 2, (v / max) * 100);
                const label = String(parseKey(w.start).getMonth() + 1) + "/" + String(parseKey(w.start).getDate());
                return `<div class="chart-col" title="${esc(formatDate(w.start, "short"))}: ${v}">
                  <div class="bar-track"><div class="bar ${v ? "wo" : "empty"}" style="height:${h}%"></div></div>
                  <div class="lbl">${esc(label)}</div>
                </div>`;
              })
              .join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderSettings() {
    const s = store.data.settings;
    return `
      <h2 class="page-title">Settings</h2>
      <div class="stack">
        <section class="settings-card">
          <h3 style="margin:0 0 12px">Daily goals</h3>
          <div class="field-row">
            <div class="field">
              <label for="goal-cal">Calories</label>
              <input id="goal-cal" type="number" inputmode="numeric" min="1" step="1" value="${esc(s.calorieGoal)}" data-act="goal-cal" />
            </div>
            <div class="field">
              <label for="goal-pro">Protein (g)</label>
              <input id="goal-pro" type="number" inputmode="decimal" min="1" step="1" value="${esc(s.proteinGoal)}" data-act="goal-pro" />
            </div>
          </div>
          <p class="hint">Goals save automatically and drive the rings and history charts.</p>
        </section>
        <section class="settings-card">
          <h3 style="margin:0 0 8px">Backup</h3>
          <p class="hint">All data stays on this device. Export a JSON backup regularly and keep it in Files or iCloud so it isn’t lost.</p>
          <div class="stack" style="margin-top:12px">
            <button type="button" class="btn primary" data-act="export">Export backup</button>
            <button type="button" class="btn secondary" data-act="import">Import backup</button>
          </div>
        </section>
        <section class="settings-card">
          <h3 style="margin:0 0 8px">Add to iPhone Home Screen</h3>
          <ol class="install-steps">
            <li>Open this page in Safari (not Chrome or in-app browsers).</li>
            <li>Tap the Share button, then <strong style="color:var(--text)">Add to Home Screen</strong>.</li>
            <li>Open FitTrack from its icon so it runs full-screen and keeps its own saved data.</li>
          </ol>
        </section>
        <section class="settings-card">
          <h3 style="margin:0 0 8px">About this data</h3>
          <p class="hint">iOS can clear Safari website data if the phone is low on storage or a site hasn’t been used in a long time. A Home Screen app is more persistent, but a backup is still the only sure way to keep your log. Safari and the Home Screen icon can also have separate data — log from the icon once you add it.</p>
        </section>
      </div>
    `;
  }

  function setTabSelected() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.setAttribute("aria-selected", tab.getAttribute("data-tab") === ui.tab ? "true" : "false");
    });
  }

  function render() {
    setTabSelected();
    const view =
      ui.tab === "today"
        ? renderToday()
        : ui.tab === "workouts"
          ? renderWorkouts()
          : ui.tab === "history"
            ? renderHistory()
            : renderSettings();
    els.main.innerHTML = view;
    els.main.scrollTop = 0;
  }

  function openFoodSheet(existing) {
    const isEdit = Boolean(existing);
    ui.sheet = { type: "food", id: existing && existing.id };
    openSheet(`
      <h3>${isEdit ? "Edit food" : "Add food"}</h3>
      <form id="food-form" class="stack">
        <div class="field">
          <label for="food-name">Food</label>
          <input id="food-name" name="name" required maxlength="80" placeholder="Greek yogurt" value="${esc(existing ? existing.name : "")}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="food-cal">Calories</label>
            <input id="food-cal" name="calories" type="number" inputmode="numeric" min="0" step="1" required value="${esc(existing ? existing.calories : "")}" />
          </div>
          <div class="field">
            <label for="food-pro">Protein (g)</label>
            <input id="food-pro" name="protein" type="number" inputmode="decimal" min="0" step="0.1" required value="${esc(existing ? existing.protein : "")}" />
          </div>
        </div>
        ${
          isEdit
            ? ""
            : `<label class="check"><input type="checkbox" id="food-fav" /> Save as favorite</label>`
        }
        <div class="sheet-actions">
          <button type="button" class="btn secondary" data-act="close-sheet">Cancel</button>
          <button type="submit" class="btn primary">${isEdit ? "Save" : "Add"}</button>
        </div>
      </form>
    `);
  }

  function openExerciseSheet() {
    ui.sheet = { type: "exercise" };
    const names = store.data.exerciseNames;
    openSheet(`
      <h3>Add exercise</h3>
      <form id="ex-form" class="stack">
        <div class="field">
          <label for="ex-name">Exercise name</label>
          <input id="ex-name" name="name" required maxlength="80" list="sheet-ex-names" placeholder="Bench press" autocomplete="off" />
          <datalist id="sheet-ex-names">${names.map((n) => `<option value="${esc(n)}"></option>`).join("")}</datalist>
        </div>
        <div class="sheet-actions">
          <button type="button" class="btn secondary" data-act="close-sheet">Cancel</button>
          <button type="submit" class="btn wo">Add</button>
        </div>
      </form>
    `);
  }

  function openStartWorkoutSheet() {
    ui.sheet = { type: "start-workout" };
    openSheet(`
      <h3>Start workout</h3>
      <form id="start-wo-form" class="stack">
        <div class="field">
          <label for="start-wo-date">Date</label>
          <input id="start-wo-date" type="date" required value="${esc(dateKey())}" max="${esc(dateKey())}" />
        </div>
        <div class="sheet-actions">
          <button type="button" class="btn secondary" data-act="close-sheet">Cancel</button>
          <button type="submit" class="btn wo">Start</button>
        </div>
      </form>
    `);
  }

  function saveGoalsFromInputs() {
    const cal = document.getElementById("goal-cal");
    const pro = document.getElementById("goal-pro");
    if (!cal || !pro) return;
    store.setGoals(cal.value, pro.value);
  }

  async function exportBackup() {
    const payload = JSON.stringify(store.exportPayload(), null, 2);
    const filename = `fittrack-backup-${dateKey()}.json`;
    const blob = new Blob([payload], { type: "application/json" });
    const file = new File([blob], filename, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "FitTrack backup" });
        toast("Backup shared");
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup downloaded");
  }

  function importBackupFile(file) {
    const reader = new FileReader();
    reader.onerror = () => toast("Could not read that file");
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (!obj || typeof obj !== "object") throw new Error("Invalid");
        if (!obj.settings && !obj.days && !obj.workouts) throw new Error("Not a FitTrack backup");
        if (!confirm("Replace all FitTrack data on this device with the backup?")) return;
        store.importPayload(obj);
        ui.date = dateKey();
        ui.workoutId = null;
        closeSheet();
        render();
        toast("Backup imported");
      } catch (err) {
        toast("That file isn’t a valid FitTrack backup");
      }
    };
    reader.readAsText(file);
  }

  function onClick(event) {
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");

    if (act === "tab") {
      ui.tab = btn.getAttribute("data-tab");
      if (ui.tab !== "workouts") ui.workoutId = null;
      closeSheet();
      render();
      return;
    }
    if (act === "prev-day") {
      ui.date = addDays(ui.date, -1);
      render();
      return;
    }
    if (act === "next-day") {
      const next = addDays(ui.date, 1);
      if (next <= dateKey()) {
        ui.date = next;
        render();
      }
      return;
    }
    if (act === "add-food") {
      openFoodSheet(null);
      return;
    }
    if (act === "edit-food") {
      const food = store.foodsOn(ui.date).find((f) => f.id === btn.getAttribute("data-id"));
      if (food) openFoodSheet(food);
      return;
    }
    if (act === "delete-food") {
      const id = btn.getAttribute("data-id");
      const food = store.foodsOn(ui.date).find((f) => f.id === id);
      if (food && confirm(`Delete “${food.name}”?`)) {
        store.deleteFood(ui.date, id);
        render();
      }
      return;
    }
    if (act === "toggle-fav") {
      const food = store.foodsOn(ui.date).find((f) => f.id === btn.getAttribute("data-id"));
      if (food) {
        store.toggleFavorite(food);
        render();
      }
      return;
    }
    if (act === "quick-add") {
      store.addFood(ui.date, {
        name: btn.getAttribute("data-name"),
        calories: btn.getAttribute("data-calories"),
        protein: btn.getAttribute("data-protein"),
      });
      render();
      toast("Added " + btn.getAttribute("data-name"));
      return;
    }
    if (act === "close-sheet") {
      closeSheet();
      return;
    }
    if (act === "start-workout") {
      openStartWorkoutSheet();
      return;
    }
    if (act === "open-workout") {
      ui.workoutId = btn.getAttribute("data-id");
      render();
      return;
    }
    if (act === "close-workout") {
      ui.workoutId = null;
      render();
      return;
    }
    if (act === "delete-workout") {
      if (confirm("Delete this workout?")) {
        store.deleteWorkout(ui.workoutId);
        ui.workoutId = null;
        render();
        toast("Workout deleted");
      }
      return;
    }
    if (act === "add-exercise") {
      openExerciseSheet();
      return;
    }
    if (act === "delete-exercise") {
      store.deleteExercise(ui.workoutId, btn.getAttribute("data-ex-id"));
      render();
      return;
    }
    if (act === "add-set") {
      const exId = btn.getAttribute("data-ex-id");
      const w = store.getWorkout(ui.workoutId);
      const ex = w && w.exercises.find((e) => e.id === exId);
      const lastSet = ex && ex.sets.length ? ex.sets[ex.sets.length - 1] : { reps: 0, weight: 0 };
      store.addSet(ui.workoutId, exId, lastSet);
      render();
      return;
    }
    if (act === "delete-set") {
      store.deleteSet(ui.workoutId, btn.getAttribute("data-ex-id"), btn.getAttribute("data-set-id"));
      render();
      return;
    }
    if (act === "use-last") {
      store.applyLastSets(ui.workoutId, btn.getAttribute("data-ex-id"));
      render();
      toast("Copied last sets");
      return;
    }
    if (act === "range") {
      ui.historyRange = Number(btn.getAttribute("data-range")) === 30 ? 30 : 7;
      render();
      return;
    }
    if (act === "export") {
      exportBackup();
      return;
    }
    if (act === "import") {
      els.importFile.value = "";
      els.importFile.click();
      return;
    }
  }

  function onChange(event) {
    const el = event.target;
    const act = el.getAttribute && el.getAttribute("data-act");
    if (!act) return;
    if (act === "goal-cal" || act === "goal-pro") {
      saveGoalsFromInputs();
      return;
    }
    if (act === "wo-date") {
      const val = el.value;
      if (val) store.updateWorkout(ui.workoutId, { date: val });
      return;
    }
    if (act === "wo-notes") {
      store.updateWorkout(ui.workoutId, { notes: el.value });
      return;
    }
    if (act === "set-reps") {
      store.updateSet(ui.workoutId, el.getAttribute("data-ex-id"), el.getAttribute("data-set-id"), {
        reps: el.value,
      });
      return;
    }
    if (act === "set-weight") {
      store.updateSet(ui.workoutId, el.getAttribute("data-ex-id"), el.getAttribute("data-set-id"), {
        weight: el.value,
      });
    }
  }

  function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "food-form") {
      event.preventDefault();
      const name = form.name.value;
      const calories = form.calories.value;
      const protein = form.protein.value;
      const fav = form.querySelector("#food-fav");
      if (ui.sheet && ui.sheet.id) {
        store.updateFood(ui.date, ui.sheet.id, { name, calories, protein });
        toast("Food updated");
      } else {
        store.addFood(ui.date, { name, calories, protein, favorite: fav && fav.checked });
        toast("Food added");
      }
      closeSheet();
      render();
      return;
    }
    if (form.id === "ex-form") {
      event.preventDefault();
      const name = form.name.value;
      const ex = store.addExercise(ui.workoutId, name);
      closeSheet();
      if (ex) {
        store.addSet(ui.workoutId, ex.id, { reps: 0, weight: 0 });
        render();
      }
      return;
    }
    if (form.id === "start-wo-form") {
      event.preventDefault();
      const date = document.getElementById("start-wo-date").value || dateKey();
      const w = store.createWorkout(date);
      ui.workoutId = w.id;
      closeSheet();
      render();
    }
  }

  function syncThemeColor() {
    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const light = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (light && !dark) meta.setAttribute("content", "#eef1f6");
    else meta.setAttribute("content", "#0b0e13");
  }

  function init() {
    store.load();
    ui.date = dateKey();
    syncThemeColor();
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColor);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("submit", onSubmit);
    els.overlay.addEventListener("click", closeSheet);
    els.importFile.addEventListener("change", () => {
      const file = els.importFile.files && els.importFile.files[0];
      if (file) importBackupFile(file);
    });
    render();
    if ("serviceWorker" in navigator) {
      // Relative script and scope follow the page, so /Fittrack/ on GitHub Pages
      // registers https://…/Fittrack/sw.js with scope https://…/Fittrack/.
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((err) => {
        console.warn("FitTrack: service worker did not register", err);
      });
    }
  }

  init();
})();
