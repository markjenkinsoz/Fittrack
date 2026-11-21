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
      settings: { calorieGoal: 2200, proteinGoal: 160, weightGoal: null, planLevel: 1, levelSnoozeAt: 0 },
      days: {},
      favorites: [],
      recents: [],
      exerciseNames: [],
      workouts: [],
      weights: {},
      foodUses: {},
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
      const w = Number(raw.settings.weightGoal);
      if (w > 0) data.settings.weightGoal = Math.round(w * 10) / 10;
      const level = Number(raw.settings.planLevel);
      if (level >= 1 && level <= 5) data.settings.planLevel = Math.round(level);
      const snooze = Number(raw.settings.levelSnoozeAt);
      if (snooze > 0) data.settings.levelSnoozeAt = Math.round(snooze);
    }
    if (raw.days && typeof raw.days === "object") data.days = raw.days;
    if (Array.isArray(raw.favorites)) data.favorites = raw.favorites;
    if (Array.isArray(raw.recents)) data.recents = raw.recents;
    if (Array.isArray(raw.exerciseNames)) data.exerciseNames = raw.exerciseNames;
    if (Array.isArray(raw.workouts)) data.workouts = raw.workouts;
    if (raw.weights && typeof raw.weights === "object") {
      Object.keys(raw.weights).forEach((date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const entry = raw.weights[date];
        const lb = Number(entry && entry.lb);
        if (!(lb > 0)) return;
        data.weights[date] = {
          lb: Math.round(lb * 10) / 10,
          note: entry.note ? String(entry.note).slice(0, 140) : "",
          updatedAt: Number(entry.updatedAt) || 0,
        };
      });
    }
    if (raw.foodUses && typeof raw.foodUses === "object") {
      Object.keys(raw.foodUses).forEach((key) => {
        const use = raw.foodUses[key];
        const amount = Number(use && use.amount);
        if (!(amount > 0) || !use.unit) return;
        data.foodUses[String(key).slice(0, 180)] = {
          amount,
          unit: String(use.unit).slice(0, 24),
        };
      });
    }
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
      const items = copyFoodItems(food.items);
      if (items && items.length) {
        item.items = items;
        item.meal = true;
      } else if (food.qty && food.qty.quantityLabel) {
        item.qty = {
          amount: numOrZero(food.qty.amount),
          unit: String(food.qty.unit || ""),
          unitLabel: String(food.qty.unitLabel || ""),
          quantityLabel: String(food.qty.quantityLabel || ""),
          grams: numOrZero(food.qty.grams),
        };
      }
      this.data.days[date].foods.push(item);
      this._touchRecent(item);
      if (food.favorite) this._ensureFavorite(item);
      this.save();
      return item;
    },
    rememberFoodUse(name, use) {
      const key = String(name || "").trim().toLowerCase();
      const amount = Number(use && use.amount);
      if (!key || !(amount > 0) || !use.unit) return;
      const ordered = {};
      ordered[key] = { amount, unit: String(use.unit) };
      Object.keys(this.data.foodUses).forEach((item) => {
        if (item !== key && Object.keys(ordered).length < 200) ordered[item] = this.data.foodUses[item];
      });
      this.data.foodUses = ordered;
      this.save();
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
      if (item.items) rec.items = item.items;
      if (item.qty) rec.qty = item.qty;
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
        if (item.items) existing.items = item.items;
        else delete existing.items;
        if (item.qty) existing.qty = item.qty;
      } else {
        const fav = {
          id: uid(),
          name: item.name,
          calories: item.calories,
          protein: item.protein,
        };
        if (item.items) fav.items = item.items;
        if (item.qty) fav.qty = item.qty;
        this.data.favorites.push(fav);
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
    setGoals(calorieGoal, proteinGoal, weightGoal) {
      this.data.settings.calorieGoal = Math.max(1, Math.round(numOrZero(calorieGoal) || 2200));
      this.data.settings.proteinGoal = Math.max(1, numOrZero(proteinGoal) || 160);
      if (weightGoal === "" || weightGoal == null) this.data.settings.weightGoal = null;
      else {
        const w = Math.round(Number(weightGoal) * 10) / 10;
        this.data.settings.weightGoal = w > 0 ? w : null;
      }
      this.save();
    },
    setPlanLevel(level) {
      const n = Math.round(Number(level));
      this.data.settings.planLevel = Math.min(5, Math.max(1, n || 1));
      this.save();
    },
    setLevelSnooze(streak) {
      this.data.settings.levelSnoozeAt = Math.max(0, Math.round(Number(streak) || 0));
      this.save();
    },
    logWeight(date, lb, note) {
      const n = Math.round(Number(lb) * 10) / 10;
      if (!date || !(n > 0)) return;
      this.data.weights[date] = {
        lb: n,
        note: String(note || "").trim().slice(0, 140),
        updatedAt: Date.now(),
      };
      this.save();
    },
    deleteWeight(date) {
      if (!this.data.weights[date]) return;
      delete this.data.weights[date];
      this.save();
    },
    weightEntries() {
      return Object.keys(this.data.weights)
        .sort()
        .map((date) => Object.assign({ date }, this.data.weights[date]));
    },
    createPlannedWorkout(date, built) {
      const w = {
        id: uid(),
        date,
        notes: built.notes,
        exercises: built.exercises.map((ex) => ({
          id: uid(),
          name: ex.name,
          cue: ex.cue || "",
          target: ex.target || "",
          sets: ex.sets.map((set) => ({ id: uid(), reps: set.reps, weight: 0 })),
        })),
        planId: built.sessionId,
        planName: built.planName,
        level: built.level,
        rpe: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.data.workouts.push(w);
      built.exercises.forEach((ex) => this.rememberExercise(ex.name));
      this.save();
      return w;
    },
    setRpe(id, rpe) {
      const w = this.getWorkout(id);
      if (!w) return;
      if (rpe !== "easy" && rpe !== "right" && rpe !== "hard") return;
      w.rpe = rpe;
      w.updatedAt = Date.now();
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
    weightRange: "30",
    workoutsMode: "list",
    planSession: null,
    sheet: null,
    foodBase: null,
  };

  const PLAN_LEVELS = [
    { id: 1, name: "Level 1", label: "Beginner", sets: 2, reps: 8, repLabel: "8", rest: "90s", tempo: "3-1-1", rounds: 2, bikeSteady: 12, intervals: "4 rounds · 1 min harder / 2 min easy", intervalRounds: 4 },
    { id: 2, name: "Level 2", label: "Easy", sets: 2, reps: 10, repLabel: "10", rest: "75s", tempo: "3-1-1", rounds: 3, bikeSteady: 18, intervals: "5 rounds · 1 min harder / 2 min easy", intervalRounds: 5 },
    { id: 3, name: "Level 3", label: "Moderate", sets: 3, reps: 10, repLabel: "8–12", rest: "75s", tempo: "3-1-2", rounds: 3, bikeSteady: 25, intervals: "5 rounds · 2 min harder / 2 min easy", intervalRounds: 5 },
    { id: 4, name: "Level 4", label: "Steady", sets: 3, reps: 8, repLabel: "8–10", rest: "60s", tempo: "3-1-1", rounds: 4, bikeSteady: 30, intervals: "6 rounds · 2 min harder / 1 min easy", intervalRounds: 6 },
    { id: 5, name: "Level 5", label: "Advanced", sets: 4, reps: 8, repLabel: "6–10", rest: "60s", tempo: "2-1-1", rounds: 5, bikeSteady: 40, intervals: "6 rounds · 3 min harder / 1 min easy", intervalRounds: 6 },
  ];
  const OFF_QUERY =
    "app_name=FitTrack&app_version=1.0&app_url=" + encodeURIComponent("https://markjenkinsoz.github.io/Fittrack/");

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

  let scanStop = null;
  function stopScan() {
    const stop = scanStop;
    scanStop = null;
    if (!stop) return;
    try {
      stop();
    } catch (err) {
      /* camera already stopped */
    }
  }

  function closeSheet() {
    stopScan();
    ui.sheet = null;
    ui.foodBase = null;
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

  function copyFoodItems(items) {
    if (!Array.isArray(items) || !items.length) return null;
    return items.map((item) => ({
      name: String(item.name || ""),
      amount: numOrZero(item.amount),
      unit: String(item.unit || ""),
      unitLabel: String(item.unitLabel || ""),
      quantityLabel: String(item.quantityLabel || ""),
      grams: numOrZero(item.grams),
      calories: numOrZero(item.calories),
      protein: numOrZero(item.protein),
    }));
  }

  const GRAMS_PER_OZ = 28.3495;

  function fmtLb(n) {
    return (Math.round(Number(n) * 10) / 10).toFixed(1);
  }
  function round1(n) {
    return Math.round(Number(n) * 10) / 10;
  }
  function finiteOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function daysBetween(a, b) {
    return Math.round((parseKey(b) - parseKey(a)) / 86400000);
  }
  function planLevel() {
    return PLAN_LEVELS.find((level) => level.id === store.data.settings.planLevel) || PLAN_LEVELS[0];
  }
  function easyStreak() {
    const rated = store.data.workouts
      .filter((w) => w.planId && w.rpe)
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    let streak = 0;
    for (const workout of rated) {
      if (workout.rpe !== "easy") break;
      streak += 1;
    }
    return streak;
  }
  function hardStreak() {
    const rated = store.data.workouts
      .filter((w) => w.planId && w.rpe)
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    let streak = 0;
    for (const workout of rated) {
      if (workout.rpe !== "hard") break;
      streak += 1;
    }
    return streak;
  }

  let restaurantsCache = null;
  let restaurantsLoading = null;
  function ensureRestaurants() {
    if (restaurantsCache) return Promise.resolve(restaurantsCache);
    if (!restaurantsLoading) {
      restaurantsLoading = fetch("./data/restaurants.json")
        .then((res) => {
          if (!res.ok) throw new Error("restaurants");
          return res.json();
        })
        .then((data) => {
          restaurantsCache = data.restaurants || [];
          return restaurantsCache;
        })
        .catch((err) => {
          restaurantsLoading = null;
          throw err;
        });
    }
    return restaurantsLoading;
  }

  let demosCache = null;
  let demosLoading = null;
  function ensureDemos() {
    if (demosCache) return Promise.resolve(demosCache);
    if (!demosLoading) {
      demosLoading = fetch("./data/exercise-demos.json")
        .then((res) => {
          if (!res.ok) throw new Error("demos");
          return res.json();
        })
        .then((data) => {
          demosCache = data;
          return data;
        })
        .catch((err) => {
          demosLoading = null;
          throw err;
        });
    }
    return demosLoading;
  }

  function demoFrames(demo) {
    if (demo.frames && demo.frames.length) return demo.frames;
    const webp = demo.webp || String(demo.image).replace(/\.jpe?g$/, ".webp");
    return [{ image: demo.image, webp, cue: "" }];
  }

  function exerciseFigure(name) {
    if (!demosCache || !name) return "";
    const demoId = demosCache.names && demosCache.names[name];
    const demo = demoId && demosCache.demos[demoId];
    if (!demo) return "";
    const frames = demoFrames(demo);
    const total = frames.length;
    const frame = frames[0];
    const webp = frame.webp || String(frame.image).replace(/\.jpe?g$/, ".webp");
    const video = demo.video
      ? `<a class="demo-link" href="${esc(demo.video)}" target="_blank" rel="noopener noreferrer">Watch demo</a>`
      : `<span class="hint">Illustration only</span>`;
    const credit = demo.videoTitle ? `<span class="hint">${esc(demo.videoTitle)}</span>` : "";
    const dots = frames
      .map(
        (_, i) =>
          `<button type="button" class="frame-dot${i === 0 ? " on" : ""}" data-act="frame-dot" data-index="${i}" aria-label="Step ${i + 1} of ${total}"${i === 0 ? ' aria-current="step"' : ""}></button>`
      )
      .join("");
    return `<figure class="demo" data-testid="exercise-demo" data-demo-id="${esc(demoId)}" data-step="0">
      <div class="demo-stage">
        <button type="button" class="demo-shot" data-act="frame-next" aria-label="Next step">
          <picture>
            <source srcset="${esc(webp)}" type="image/webp" />
            <img src="${esc(frame.image)}" alt="${esc(demo.title)}. Step 1 of ${total}. ${esc(frame.cue)}" width="720" height="720" loading="lazy" decoding="async" />
          </picture>
        </button>
      </div>
      <div class="frame-nav">
        <button type="button" class="icon-btn" data-act="frame-prev" aria-label="Previous step">${chevron("left")}</button>
        <div class="frame-meta">
          <span class="frame-count">Step 1 of ${total}</span>
          <span class="frame-dots">${dots}</span>
        </div>
        <button type="button" class="icon-btn" data-act="frame-next" aria-label="Next step">${chevron("right")}</button>
      </div>
      <p class="frame-cue">${esc(frame.cue)}</p>
      <figcaption>${video}${credit}</figcaption>
    </figure>`;
  }

  function paintDemoFrame(fig, step) {
    if (!fig || !demosCache) return;
    const demo = demosCache.demos[fig.getAttribute("data-demo-id")];
    if (!demo) return;
    const frames = demoFrames(demo);
    const total = frames.length;
    const index = ((step % total) + total) % total;
    const frame = frames[index];
    const webp = frame.webp || String(frame.image).replace(/\.jpe?g$/, ".webp");
    fig.setAttribute("data-step", String(index));
    const img = fig.querySelector("img");
    const source = fig.querySelector("source");
    if (img) {
      img.src = frame.image;
      img.alt = `${demo.title}. Step ${index + 1} of ${total}. ${frame.cue}`;
    }
    if (source) source.srcset = webp;
    const count = fig.querySelector(".frame-count");
    if (count) count.textContent = `Step ${index + 1} of ${total}`;
    const cue = fig.querySelector(".frame-cue");
    if (cue) cue.textContent = frame.cue || "";
    fig.querySelectorAll(".frame-dot").forEach((dot, i) => {
      const on = i === index;
      dot.classList.toggle("on", on);
      if (on) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
  }

  let foodsCache = null;
  let foodsLoading = null;
  function ensureFoods() {
    if (foodsCache) return Promise.resolve(foodsCache);
    if (!foodsLoading) {
      foodsLoading = fetch("./data/foods/index.json")
        .then((res) => {
          if (!res.ok) throw new Error("foods");
          return res.json();
        })
        .then((index) =>
          Promise.all(
            (index.shards || []).map((shard) =>
              fetch("./data/foods/" + shard + ".json").then((res) => {
                if (!res.ok) throw new Error("shard");
                return res.json();
              })
            )
          )
        )
        .then((parts) => {
          const list = [];
          parts.forEach((part) => {
            (part.f || []).forEach((row) => {
              const portions = (row[3] || []).map((portion) => ({
                label: portion[0],
                grams: Number(portion[1]) || 0,
              }));
              list.push({
                name: row[0],
                kcal100: Number(row[1]) || 0,
                pro100: Number(row[2]) || 0,
                portions,
                hay: String(row[0]).toLowerCase(),
              });
            });
          });
          foodsCache = list;
          return list;
        })
        .catch((err) => {
          foodsLoading = null;
          throw err;
        });
    }
    return foodsLoading;
  }

  let plansCache = null;
  let plansLoading = null;
  function ensurePlans() {
    if (plansCache) return Promise.resolve(plansCache);
    if (!plansLoading) {
      plansLoading = fetch("./data/plans.json")
        .then((res) => {
          if (!res.ok) throw new Error("plans");
          return res.json();
        })
        .then((data) => {
          plansCache = data;
          return data;
        })
        .catch((err) => {
          plansLoading = null;
          throw err;
        });
    }
    return plansLoading;
  }

  function searchFoods(query, list) {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!tokens.length || !list) return [];
    const hits = [];
    for (const food of list) {
      if (!tokens.every((token) => food.hay.includes(token))) continue;
      let score = 0;
      if (food.hay.startsWith(tokens[0])) score += 4;
      const words = food.hay.split(/[^a-z0-9]+/);
      if (tokens.every((token) => words.includes(token))) score += 2;
      const asks = tokens.join(" ");
      if (/\bns as to\b/.test(food.hay) && !asks.includes("ns")) score -= 4;
      if (/with cheese|with meat|with vegetable/.test(food.hay) && !/cheese|meat|vegetable/.test(asks)) score -= 3;
      if (/fast food|restaurant/.test(food.hay) && !/restaurant|fast/.test(asks)) score -= 1;
      if (/no added fat/.test(food.hay) && !/butter|oil|margarine|fat/.test(asks)) score += 4;
      score -= food.name.length / 90;
      hits.push({ food, score });
    }
    hits.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name));
    return hits.slice(0, 8).map((hit) => hit.food);
  }

  function productToBase(product) {
    if (!product || typeof product !== "object") return null;
    const nutriments = product.nutriments || {};
    const brand = String(product.brands || "").split(",")[0].trim();
    const productName = String(product.product_name || product.product_name_en || "").trim();
    const name = (brand && productName ? brand + " " + productName : productName || brand).slice(0, 140);
    if (!name) return null;
    const grams = finiteOrNull(product.serving_quantity);
    let calories = finiteOrNull(nutriments["energy-kcal_serving"]);
    let protein = finiteOrNull(nutriments["proteins_serving"]);
    let serving = product.serving_size ? String(product.serving_size) : "";
    let gramOut = grams && grams > 0 ? grams : 0;
    if (!(calories > 0)) {
      const per100 = finiteOrNull(nutriments["energy-kcal_100g"]);
      if (!(per100 > 0)) return null;
      if (!(gramOut > 0)) gramOut = 100;
      calories = (per100 * gramOut) / 100;
      const protein100 = finiteOrNull(nutriments["proteins_100g"]);
      protein = protein100 == null ? 0 : (protein100 * gramOut) / 100;
      if (!serving) serving = gramOut + " g";
    } else if (protein == null) {
      const protein100 = finiteOrNull(nutriments["proteins_100g"]);
      protein = gramOut > 0 && protein100 != null ? (protein100 * gramOut) / 100 : 0;
    }
    const gramsEach = gramOut ? gramOut : 100;
    const kcal100 = gramsEach > 0 ? (calories * 100) / gramsEach : calories;
    const pro100 = gramsEach > 0 ? ((protein || 0) * 100) / gramsEach : protein || 0;
    return {
      name,
      kcal100,
      pro100,
      portions: [{ label: serving || "1 serving", grams: Math.round(gramsEach) }],
      calories: Math.round(calories),
      protein: round1(protein || 0),
      grams: Math.round(gramsEach),
      serving: serving || "1 serving",
    };
  }

  function unitsFor(food) {
    const units = [];
    (food.portions || []).forEach((portion, index) => {
      if (portion.grams > 0) units.push({ key: "p" + index, label: portion.label, gramsEach: portion.grams });
    });
    units.push({ key: "g", label: "grams", gramsEach: 1 });
    units.push({ key: "oz", label: "oz", gramsEach: GRAMS_PER_OZ });
    const cup = (food.portions || []).find((portion) => /\bcups?\b/i.test(portion.label) && !/fl oz/i.test(portion.label));
    const floz = (food.portions || []).find((portion) => /fl oz/i.test(portion.label));
    if (cup && cup.grams > 0) units.push({ key: "cup", label: "cup", gramsEach: cup.grams });
    if (floz && floz.grams > 0) units.push({ key: "floz", label: "fl oz", gramsEach: floz.grams });
    else if (cup && cup.grams > 0 && /milk|juice|broth|beverage|drink|coffee|tea|water|wine|beer|soda|egg white/i.test(food.name || "")) {
      units.push({ key: "floz", label: "fl oz", gramsEach: cup.grams / 8 });
    }
    return units;
  }

  function quantityLabel(amount, unit) {
    if (!unit) return String(amount);
    if (unit.key === "g") return trimAmount(amount) + " g";
    if (unit.key === "oz") return trimAmount(amount) + " oz";
    if (unit.key === "floz") return trimAmount(amount) + " fl oz";
    if (unit.key === "cup") return trimAmount(amount) + " cup";
    return trimAmount(amount) + " × " + unit.label;
  }
  function trimAmount(amount) {
    const rounded = round1(amount);
    return String(rounded);
  }

  function defaultPortion(food) {
    return (food.portions && food.portions[0]) || { label: "100 g", grams: 100 };
  }
  function foodHitButton(food, source) {
    if (food.restaurant) {
      const label = food.restaurant + " " + food.name;
      return `<button type="button" class="food-hit" data-act="pick-food" data-source="restaurant" data-fixed="1"
        data-name="${esc(label)}" data-cal="${esc(food.calories)}" data-pro="${esc(food.protein)}"
        data-serving="${esc(food.serving || "1 serving")}">
        <span class="tag">${esc(food.restaurant)}</span>
        <span class="name">${esc(food.name)}</span>
        <span class="meta">${esc(food.serving || "1 serving")} · ${fmtNum(food.calories)} cal · ${fmtNum(food.protein, 1)} g protein</span>
      </button>`;
    }
    const portion = defaultPortion(food);
    const calories = Math.round((food.kcal100 * portion.grams) / 100);
    const protein = round1((food.pro100 * portion.grams) / 100);
    return `<button type="button" class="food-hit" data-act="pick-food" data-source="${esc(source)}"
      data-name="${esc(food.name)}" data-kcal100="${esc(food.kcal100)}" data-pro100="${esc(food.pro100)}"
      data-cal="${esc(calories)}" data-pro="${esc(protein)}" data-grams="${esc(portion.grams)}"
      data-serving="${esc(portion.label)}" data-portions="${esc(JSON.stringify(food.portions || []))}">
      <span class="name">${esc(food.name)}</span>
      <span class="meta">${esc(portion.label)} · ${esc(portion.grams)} g · ${fmtNum(calories)} cal · ${fmtNum(protein, 1)} g</span>
    </button>`;
  }

  let searchTimer = 0;
  let searchSeq = 0;
  function scheduleFoodSearch(value) {
    const query = String(value || "").trim();
    renderUsdaMatches(query);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchBrands(query), 250);
  }

  async function renderUsdaMatches(query) {
    const box = document.getElementById("usda-results");
    if (!box) return;
    if (query.length < 2) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `<p class="hint">Looking up common foods…</p>`;
    try {
      const list = await ensureFoods();
      const current = document.getElementById("food-search");
      if (!current || current.value.trim() !== query) return;
      const place = document.getElementById("food-place");
      const placeId = place ? place.value : "";
      const hits = placeId ? [] : searchFoods(query, list);
      box.innerHTML = hits.length
        ? `<p class="result-label">Common foods</p>${hits.map((food) => foodHitButton(food, "usda")).join("")}`
        : placeId
          ? ""
          : `<p class="hint">No common foods match.</p>`;
      renderRestaurantMatches(query, placeId);
    } catch (err) {
      box.innerHTML = `<p class="hint">Common foods could not be loaded. You can still type the food below.</p>`;
    }
  }

  function renderRestaurantMatches(query, placeId) {
    const box = document.getElementById("restaurant-results");
    if (!box) return;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!restaurantsCache) {
      box.innerHTML = "";
      ensureRestaurants()
        .then(() => {
          const current = document.getElementById("food-search");
          if (current && current.value.trim().toLowerCase() === query.toLowerCase()) {
            fillRestaurantFilter();
            renderRestaurantMatches(query, placeId);
          }
        })
        .catch(() => {
          box.innerHTML = "";
        });
      return;
    }
    fillRestaurantFilter();
    const hits = [];
    restaurantsCache.forEach((restaurant) => {
      if (placeId && restaurant.id !== placeId) return;
      restaurant.items.forEach((item) => {
        const hay = (restaurant.name + " " + item.name).toLowerCase();
        if (!tokens.every((token) => hay.includes(token))) return;
        let score = 0;
        if (item.name.toLowerCase().startsWith(tokens[0])) score += 3;
        score -= item.name.length / 80;
        hits.push({ score, food: Object.assign({ restaurant: restaurant.name }, item) });
      });
    });
    hits.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name));
    const top = hits.slice(0, 8).map((hit) => hit.food);
    box.innerHTML = top.length
      ? `<p class="result-label">Restaurant menus</p>${top.map((food) => foodHitButton(food, "restaurant")).join("")}`
      : `<p class="hint">No restaurant items match.</p>`;
  }

  function fillRestaurantFilter() {
    const select = document.getElementById("food-place");
    if (!select || select.dataset.ready === "1" || !restaurantsCache) return;
    const current = select.value;
    select.innerHTML =
      `<option value="">All restaurants and common foods</option>` +
      restaurantsCache
        .map((restaurant) => `<option value="${esc(restaurant.id)}">${esc(restaurant.name)}</option>`)
        .join("");
    select.value = current;
    select.dataset.ready = "1";
  }

  async function searchBrands(query) {
    const status = document.getElementById("brand-status");
    const box = document.getElementById("brand-results");
    if (!status || !box) return;
    if (query.length < 2) {
      status.textContent = "";
      box.innerHTML = "";
      return;
    }
    if (typeof navigator.onLine === "boolean" && navigator.onLine === false) {
      status.textContent = "You're offline. Brand search needs a connection. Common foods still work.";
      box.innerHTML = "";
      return;
    }
    const seq = ++searchSeq;
    status.textContent = "Searching brands…";
    box.innerHTML = "";
    try {
      const url =
        "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" +
        encodeURIComponent(query) +
        "&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,brands,nutriments,serving_size,serving_quantity&" +
        OFF_QUERY;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (seq !== searchSeq) return;
      if (!res.ok) throw new Error("brand search");
      const data = await res.json();
      const hits = (Array.isArray(data.products) ? data.products : []).map(productToBase).filter(Boolean).slice(0, 8);
      if (!hits.length) {
        status.textContent = "No brand matches.";
        box.innerHTML = "";
        return;
      }
      status.textContent = "Brands from Open Food Facts";
      box.innerHTML = hits.map((food) => foodHitButton(food, "off")).join("");
    } catch (err) {
      if (seq !== searchSeq) return;
      status.textContent = "Brand search is unavailable right now. Common foods and manual entry still work.";
      box.innerHTML = "";
    }
  }

  async function lookupBarcode(raw) {
    const status = document.getElementById("barcode-status");
    const code = String(raw || "").replace(/\D/g, "");
    if (status) status.textContent = "";
    if (code.length < 8) {
      if (status) status.textContent = "Enter a barcode with at least 8 digits.";
      return;
    }
    if (typeof navigator.onLine === "boolean" && navigator.onLine === false) {
      if (status) status.textContent = "You're offline. Barcode lookup needs a connection.";
      return;
    }
    if (status) status.textContent = "Looking up that barcode…";
    try {
      const url =
        "https://world.openfoodfacts.org/api/v2/product/" +
        encodeURIComponent(code) +
        ".json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity,status&" +
        OFF_QUERY;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("barcode");
      const data = await res.json();
      const base = productToBase(data && data.product);
      if (!base || data.status === 0) {
        if (status) status.textContent = "No product found for that barcode. Enter the food manually.";
        return;
      }
      applyFoodBase(base);
      if (status) status.textContent = "Filled from the barcode.";
    } catch (err) {
      if (status) status.textContent = "Barcode lookup is unavailable. Enter the food manually.";
    }
  }

  function applyFoodBase(base) {
    if (base.fixed) {
      const serving = base.serving || "1 serving";
      const units = [{ key: "each", label: serving, gramsEach: 0 }];
      ui.foodBase = {
        name: base.name,
        fixed: true,
        perCalories: Number(base.calories) || 0,
        perProtein: Number(base.protein) || 0,
        servingLabel: serving,
        units,
      };
      const name = document.getElementById("food-name");
      const box = document.getElementById("serving-adjust");
      const unitSelect = document.getElementById("food-unit");
      const amount = document.getElementById("food-servings");
      if (name) name.value = base.name;
      if (unitSelect) {
        unitSelect.innerHTML = `<option value="each">${esc(serving)}</option>`;
        unitSelect.disabled = false;
        unitSelect.value = "each";
      }
      if (amount) {
        amount.disabled = false;
        const remembered = store.data.foodUses[String(base.name).toLowerCase()];
        amount.value = remembered && remembered.unit === "each" ? String(remembered.amount) : "1";
      }
      if (box) box.hidden = false;
      refreshQty();
      return;
    }
    let portions = base.portions;
    if ((!portions || !portions.length) && base.grams) {
      portions = [{ label: base.serving || "1 serving", grams: Number(base.grams) }];
    }
    const kcal100 = base.kcal100 != null ? Number(base.kcal100) : portions && portions[0] ? (Number(base.calories) * 100) / portions[0].grams : Number(base.calories) || 0;
    const pro100 = base.pro100 != null ? Number(base.pro100) : portions && portions[0] ? (Number(base.protein) * 100) / portions[0].grams : Number(base.protein) || 0;
    const food = { name: base.name, kcal100, pro100, portions: portions || [] };
    const units = unitsFor(food);
    ui.foodBase = { name: food.name, kcal100, pro100, units };
    const name = document.getElementById("food-name");
    const box = document.getElementById("serving-adjust");
    const unitSelect = document.getElementById("food-unit");
    const amount = document.getElementById("food-servings");
    if (name) name.value = food.name;
    if (unitSelect) {
      unitSelect.innerHTML = units
        .map((unit) => `<option value="${esc(unit.key)}">${esc(unit.label)}</option>`)
        .join("");
      unitSelect.disabled = false;
    }
    const remembered = store.data.foodUses[food.name.toLowerCase()];
    let unitKey = units[0] ? units[0].key : "g";
    let startAmount = 1;
    if (remembered && units.some((unit) => unit.key === remembered.unit)) {
      unitKey = remembered.unit;
      startAmount = remembered.amount;
    }
    if (unitSelect) unitSelect.value = unitKey;
    if (amount) {
      amount.disabled = false;
      amount.value = String(startAmount);
    }
    if (box) box.hidden = false;
    refreshQty();
  }

  function selectedUnit() {
    if (!ui.foodBase) return null;
    const unitSelect = document.getElementById("food-unit");
    const key = unitSelect ? unitSelect.value : "";
    return ui.foodBase.units.find((unit) => unit.key === key) || ui.foodBase.units[0] || null;
  }
  function refreshQty() {
    if (!ui.foodBase) return;
    const amountEl = document.getElementById("food-servings");
    const amount = Number(amountEl && amountEl.value);
    const unit = selectedUnit();
    const cal = document.getElementById("food-cal");
    const pro = document.getElementById("food-pro");
    const label = document.getElementById("serving-label");
    if (!(amount > 0) || !unit) return;
    if (ui.foodBase.fixed) {
      const calories = Math.round(ui.foodBase.perCalories * amount);
      const protein = round1(ui.foodBase.perProtein * amount);
      if (cal) cal.value = String(calories);
      if (pro) pro.value = String(protein);
      if (label) label.textContent = quantityLabel(amount, unit) + " · " + calories + " cal · " + protein + " g protein";
      return;
    }
    const grams = unit.gramsEach * amount;
    const calories = Math.round((ui.foodBase.kcal100 * grams) / 100);
    const protein = round1((ui.foodBase.pro100 * grams) / 100);
    if (cal) cal.value = String(calories);
    if (pro) pro.value = String(protein);
    if (label) {
      label.textContent =
        quantityLabel(amount, unit) +
        " · " +
        round1(grams) +
        " g · " +
        calories +
        " cal · " +
        protein +
        " g protein";
    }
  }
  function currentQty() {
    if (!ui.foodBase) return null;
    const amount = Number((document.getElementById("food-servings") || {}).value);
    const unit = selectedUnit();
    if (!(amount > 0) || !unit) return null;
    if (ui.foodBase.fixed) {
      return {
        name: ui.foodBase.name,
        amount,
        unit: unit.key,
        unitLabel: unit.label,
        quantityLabel: quantityLabel(amount, unit),
        grams: 0,
        calories: Math.round(ui.foodBase.perCalories * amount),
        protein: round1(ui.foodBase.perProtein * amount),
      };
    }
    const grams = unit.gramsEach * amount;
    return {
      name: ui.foodBase.name,
      amount,
      unit: unit.key,
      unitLabel: unit.label,
      quantityLabel: quantityLabel(amount, unit),
      grams: round1(grams),
      calories: Math.round((ui.foodBase.kcal100 * grams) / 100),
      protein: round1((ui.foodBase.pro100 * grams) / 100),
    };
  }
  function currentLine() {
    const qty = currentQty();
    if (qty) return qty;
    const nameEl = document.getElementById("food-name");
    const name = nameEl ? nameEl.value.trim() : "";
    if (!name) return null;
    return {
      name,
      amount: 1,
      unit: "manual",
      unitLabel: "",
      quantityLabel: name,
      grams: 0,
      calories: numOrZero((document.getElementById("food-cal") || {}).value),
      protein: numOrZero((document.getElementById("food-pro") || {}).value),
    };
  }
  function renderMeal() {
    const box = document.getElementById("meal-lines");
    const total = document.getElementById("meal-total");
    const nameWrap = document.getElementById("meal-name-wrap");
    if (!box || !total) return;
    const items = ui.mealItems || [];
    box.innerHTML = items
      .map(
        (item, index) => `<div class="meal-line">
          <span>${esc(item.quantityLabel)} · ${esc(item.name)}</span>
          <span>${fmtNum(item.calories)} cal · ${fmtNum(item.protein, 1)} g</span>
          <button type="button" class="icon-btn" data-act="remove-meal-item" data-index="${index}" aria-label="Remove ${esc(item.name)} from meal">✕</button>
        </div>`
      )
      .join("");
    const calories = items.reduce((sum, item) => sum + item.calories, 0);
    const protein = round1(items.reduce((sum, item) => sum + item.protein, 0));
    total.hidden = items.length === 0;
    total.textContent = items.length ? "Meal total " + fmtNum(calories) + " cal · " + fmtNum(protein, 1) + " g protein" : "";
    if (nameWrap) nameWrap.hidden = items.length === 0;
  }
  function clearPicker() {
    ui.foodBase = null;
    ["food-name", "food-cal", "food-pro", "food-search"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const box = document.getElementById("serving-adjust");
    if (box) box.hidden = true;
    const usda = document.getElementById("usda-results");
    const brands = document.getElementById("brand-results");
    const status = document.getElementById("brand-status");
    if (usda) usda.innerHTML = "";
    if (brands) brands.innerHTML = "";
    if (status) status.textContent = "";
  }

  function loadZXing() {
    if (window.ZXing && window.ZXing.BrowserMultiFormatReader) return Promise.resolve(window.ZXing);
    if (!window.__fittrackZxing) {
      window.__fittrackZxing = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "vendor/zxing.min.js";
        script.onload = () => {
          if (window.ZXing && window.ZXing.BrowserMultiFormatReader) resolve(window.ZXing);
          else reject(new Error("zxing"));
        };
        script.onerror = () => reject(new Error("zxing"));
        document.head.appendChild(script);
      });
    }
    return window.__fittrackZxing;
  }

  async function startScan() {
    const panel = document.getElementById("scan-panel");
    const status = document.getElementById("scan-status");
    const video = document.getElementById("scan-video");
    if (!panel || !video || !status) return;
    stopScan();
    panel.hidden = false;
    status.textContent = "Starting the camera…";
    let stream = window.FitTrackFakeStream || null;
    if (!stream) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = "This browser has no camera access. Type the barcode instead.";
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        status.textContent = "The camera could not start. Type the barcode instead.";
        return;
      }
    }
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute("playsinline", "");
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") playPromise.catch(() => {});
    let stopped = false;
    const stopTracks = () => {
      stopped = true;
      stream.getTracks().forEach((track) => track.stop());
      if (video.srcObject === stream) video.srcObject = null;
    };
    scanStop = stopTracks;
    const onCode = (raw) => {
      if (!raw || stopped) return;
      stopped = true;
      stopScan();
      panel.hidden = true;
      const input = document.getElementById("food-barcode");
      if (input) input.value = String(raw);
      lookupBarcode(raw);
    };
    const Detector = window.FitTrackBarcodeDetector || window.BarcodeDetector;
    if (!window.FitTrackForceZxing && typeof Detector === "function") {
      let detector = null;
      try {
        detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
        });
      } catch (err) {
        try {
          detector = new Detector();
        } catch (err2) {
          detector = null;
        }
      }
      if (detector) {
        status.textContent = "Point the camera at a barcode.";
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            if (codes && codes.length && codes[0].rawValue) {
              onCode(codes[0].rawValue);
              return;
            }
          } catch (err) {
            /* keep scanning */
          }
          setTimeout(tick, 200);
        };
        tick();
        return;
      }
    }
    status.textContent = "Loading the barcode scanner…";
    try {
      const ZXing = await loadZXing();
      if (stopped) return;
      const reader = new ZXing.BrowserMultiFormatReader();
      status.textContent = "Point the camera at a barcode.";
      const controls = await reader.decodeFromStream(stream, video, (result) => {
        if (result && result.getText) onCode(result.getText());
      });
      const prev = scanStop;
      scanStop = () => {
        try {
          if (controls && controls.stop) controls.stop();
        } catch (err) {
          /* already stopped */
        }
        try {
          if (reader.reset) reader.reset();
        } catch (err) {
          /* already reset */
        }
        if (prev) prev();
      };
    } catch (err) {
      if (!stopped) status.textContent = "The barcode scanner could not start. Type the barcode instead.";
    }
  }

  function chosenExerciseName(ex, level) {
    if (ex.mode === "hold" || ex.mode === "minutes" || ex.mode === "intervals" || ex.mode === "fixed") return ex.name;
    if (level.id <= 1) return ex.regression || ex.name;
    if (level.id === 4) return ex.progression || ex.name;
    if (level.id >= 5) return ex.advanced || ex.progression || ex.name;
    return ex.name;
  }
  function exercisePrescription(ex, level) {
    if (ex.mode === "minutes") {
      const minutes = ex.scale === "bike-steady" ? level.bikeSteady : ex.minutes;
      return minutes + " min";
    }
    if (ex.mode === "intervals") return level.intervals;
    if (ex.mode === "rounds") return level.rounds + " rounds × " + level.repLabel + " · rest " + level.rest;
    if (ex.mode === "hold") return (ex.seconds || 30) + " seconds";
    if (ex.mode === "fixed") return (ex.sets || 1) + " × " + ex.reps;
    return level.sets + " sets × " + level.repLabel + " · rest " + level.rest + " · tempo " + level.tempo;
  }
  function exerciseSets(ex, level) {
    if (ex.mode === "minutes") {
      const minutes = ex.scale === "bike-steady" ? level.bikeSteady : ex.minutes;
      return [{ reps: minutes }];
    }
    if (ex.mode === "intervals") return [{ reps: level.intervalRounds }];
    if (ex.mode === "rounds") return Array.from({ length: level.rounds }, () => ({ reps: level.reps }));
    if (ex.mode === "hold") return [{ reps: ex.seconds || 30 }];
    if (ex.mode === "fixed") return Array.from({ length: ex.sets || 1 }, () => ({ reps: ex.reps }));
    return Array.from({ length: level.sets }, () => ({ reps: level.reps }));
  }
  function suggestionLine(ex) {
    const bits = [];
    if (ex.regression) bits.push("Easier: " + ex.regression);
    if (ex.progression) bits.push("Harder: " + ex.progression);
    if (ex.advanced) bits.push("Level 5: " + ex.advanced);
    return bits.join(" · ");
  }
  function sessionById(id) {
    if (!plansCache) return null;
    return (plansCache.sessions || []).find((session) => session.id === id) || null;
  }
  function buildPlanWorkout(session, level) {
    const exercises = (session.exercises || []).map((ex) => {
      const name = chosenExerciseName(ex, level);
      const target = exercisePrescription(ex, level);
      let cue = ex.cue || "";
      if (ex.mode === "minutes") cue = cue + " Log minutes in the reps box. Leave weight at 0.";
      if (ex.mode === "hold") cue = cue + " Log the hold in the reps box, in seconds.";
      if (ex.mode === "intervals") cue = cue + " " + level.intervals + ". Log how many rounds you finish in the reps box.";
      return { name, cue: cue.trim(), target, sets: exerciseSets(ex, level) };
    });
    return {
      sessionId: session.id,
      planName: session.plan,
      level: level.id,
      notes:
        session.plan +
        " · " +
        session.name +
        " · Level " +
        level.id +
        "\nRest " +
        level.rest +
        ". Tempo " +
        level.tempo +
        ". " +
        level.label +
        ".\nEase into the load. Stop for sharp pain or pulling around a healing incision.",
      exercises,
    };
  }

  function weightTodayCard() {
    const entry = store.data.weights[ui.date];
    return `
      <section class="weight-today" data-testid="weight-today">
        <div>
          <div class="k">Weight</div>
          <div class="v">${entry ? esc(fmtLb(entry.lb)) + " lb" : "Not logged"}</div>
        </div>
        <button type="button" class="btn secondary slim" data-act="log-weight" aria-label="${entry ? "Edit today's weight" : "Log weight"}">${entry ? "Edit" : "Log"}</button>
      </section>`;
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
      ${weightTodayCard()}
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
                ${
                  food.items && food.items.length
                    ? `<div data-testid="meal-lines">${food.items
                        .map(
                          (item) =>
                            `<div class="meta">${esc(item.quantityLabel)} · ${esc(item.name)} · ${fmtNum(item.calories)} cal · ${fmtNum(item.protein, 1)} g</div>`
                        )
                        .join("")}</div>`
                    : food.qty && food.qty.quantityLabel
                      ? `<div class="meta">${esc(food.qty.quantityLabel)}</div>`
                      : ""
                }
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
      <button type="button" class="btn secondary" data-act="open-plans">Home plans</button>
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
              ${ex.target ? `<p class="ex-target">${esc(ex.target)}</p>` : ""}
              ${ex.cue ? `<p class="ex-cue">${esc(ex.cue)}</p>` : ""}
              ${exerciseFigure(ex.name)}
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
      ${rpeBar(w)}
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
    if (ui.workoutId) return renderWorkoutDetail();
    if (ui.workoutsMode === "plans") return renderPlans();
    return renderWorkoutList();
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
          <div class="field" style="margin-top:10px">
            <label for="goal-weight">Goal weight (lb, optional)</label>
            <input id="goal-weight" type="number" inputmode="decimal" min="0" step="0.1" placeholder="Optional" value="${s.weightGoal ? esc(fmtLb(s.weightGoal)) : ""}" data-act="goal-weight" />
          </div>
          <p class="hint">Calorie and protein goals drive the rings. A goal weight draws a line on the weight chart. Leave it blank to hide the line.</p>
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

  function rpeBar(workout) {
    if (!workout.planId) return "";
    const current = workout.rpe || "";
    return `
      <div class="rpe" data-testid="rpe">
        <div class="label">How did this session feel?</div>
        <div class="seg" role="group" aria-label="Session effort">
          <button type="button" data-act="rpe" data-rpe="easy" aria-pressed="${current === "easy"}">Too easy</button>
          <button type="button" data-act="rpe" data-rpe="right" aria-pressed="${current === "right"}">Just right</button>
          <button type="button" data-act="rpe" data-rpe="hard" aria-pressed="${current === "hard"}">Too hard</button>
        </div>
      </div>`;
  }

  function renderPlanExercise(ex, level) {
    const name = chosenExerciseName(ex, level);
    const suggest = suggestionLine(ex);
    return `
      <article class="plan-ex">
        <h4>${esc(name)}</h4>
        <p class="meta">${esc(exercisePrescription(ex, level))}</p>
        <p class="ex-cue" data-testid="plan-cue">${esc(ex.cue || "")}</p>
        ${exerciseFigure(name)}
        ${suggest ? `<p class="hint">${esc(suggest)}</p>` : ""}
      </article>`;
  }

  function renderPlans() {
    const level = planLevel();
    if (!plansCache) {
      return `
        <div class="detail-head">
          <button type="button" class="icon-btn" data-act="close-plans" aria-label="Back to workouts">${chevron("left")}</button>
          <h2>Home plans</h2>
        </div>
        <p class="hint">Loading plans…</p>`;
    }
    const session = ui.planSession ? sessionById(ui.planSession) : null;
    if (session) {
      return `
        <div class="detail-head">
          <button type="button" class="icon-btn" data-act="plans-back" aria-label="Back to plans">${chevron("left")}</button>
          <h2>${esc(session.name)}</h2>
        </div>
        <p class="sub">${esc(session.plan)} · ${esc(session.equipment || "")}</p>
        <p>${esc(session.blurb || "")}</p>
        <p class="level-line" data-testid="level-summary">Level ${level.id} · ${esc(level.label)} · rest ${esc(level.rest)} · tempo ${esc(level.tempo)}</p>
        <div class="plan-blocks">
          ${(session.exercises || []).map((ex) => renderPlanExercise(ex, level)).join("")}
        </div>
        <button type="button" class="btn wo" data-act="start-plan" data-session="${esc(session.id)}">Start this workout</button>`;
    }
    const streak = easyStreak();
    const showUp = streak >= 3 && streak > (store.data.settings.levelSnoozeAt || 0) && level.id < 5;
    const showDown = hardStreak() >= 2 && level.id > 1;
    const byId = {};
    (plansCache.sessions || []).forEach((item) => {
      byId[item.id] = item;
    });
    return `
      <div class="detail-head">
        <button type="button" class="icon-btn" data-act="close-plans" aria-label="Back to workouts">${chevron("left")}</button>
        <h2>Home plans</h2>
      </div>
      <div class="disclaimer" data-testid="plan-disclaimer">${esc(plansCache.disclaimer || "")}</div>
      <div class="section-head"><h3>Difficulty</h3></div>
      <div class="seg" role="group" aria-label="Difficulty" data-testid="plan-levels">
        ${PLAN_LEVELS.map(
          (item) =>
            `<button type="button" data-act="plan-level" data-level="${item.id}" aria-label="${esc(item.name)}" aria-pressed="${item.id === level.id}">${item.id}</button>`
        ).join("")}
      </div>
      <p class="level-line" data-testid="level-summary">${esc(level.name)} · ${esc(level.label)} · ${level.sets} sets · ${esc(level.repLabel)} reps · rest ${esc(level.rest)} · tempo ${esc(level.tempo)} · bike ${level.bikeSteady} min</p>
      ${
        showUp
          ? `<div class="level-prompt" data-testid="level-up">
              <p>Your last few sessions felt comfortable. You can move to Level ${level.id + 1} when you want. No rush.</p>
              <div class="sheet-actions">
                <button type="button" class="btn secondary" data-act="level-stay">Stay at Level ${level.id}</button>
                <button type="button" class="btn primary" data-act="level-up">Move to Level ${level.id + 1}</button>
              </div>
            </div>`
          : ""
      }
      ${
        showDown
          ? `<div class="level-prompt" data-testid="level-down">
              <p>The last sessions felt too hard. You can drop a level and keep the same exercises easier.</p>
              <button type="button" class="btn secondary" data-act="level-down">Drop to Level ${level.id - 1}</button>
            </div>`
          : ""
      }
      <div class="section-head"><h3>This week</h3></div>
      <p class="hint">${esc(plansCache.weekNote || "")}</p>
      <div class="wo-list" data-testid="week-plan">
        ${(plansCache.week || [])
          .map((day) => {
            const item = day.session ? byId[day.session] : null;
            return `<div class="wo-row static">
              <div>
                <div class="title">${esc(day.day)}</div>
                <div class="meta">${item ? esc(item.name) + " · " + esc(item.plan) : "Rest"}</div>
              </div>
              ${
                item
                  ? `<button type="button" class="btn secondary slim" data-act="start-plan" data-session="${esc(item.id)}">Start ${esc(item.name)}</button>`
                  : ""
              }
            </div>`;
          })
          .join("")}
      </div>
      <div class="section-head"><h3>All sessions</h3></div>
      <div class="wo-list">
        ${(plansCache.sessions || [])
          .map(
            (item) => `<button type="button" class="wo-row" data-act="open-session" data-session="${esc(item.id)}" aria-label="Open ${esc(item.name)}">
              <div>
                <div class="title">${esc(item.name)}</div>
                <div class="meta">${esc(item.plan)} · ${esc(item.equipment || "")}</div>
              </div>
              <span class="chev">›</span>
            </button>`
          )
          .join("")}
      </div>`;
  }

  function weightChart(shown, all, goal, range) {
    if (!shown.length) return `<div class="empty" data-testid="weight-chart"><strong>No weigh-ins in this range</strong>Log a weight and it will show up here.</div>`;
    const today = dateKey();
    let x0 = shown[0].date;
    let x1 = shown[shown.length - 1].date;
    if (range !== "all") {
      const days = range === "90" ? 90 : range === "365" ? 365 : 30;
      x0 = addDays(today, -(days - 1));
      x1 = today;
    }
    const ma = shown.map((entry) => ({ date: entry.date, lb: movingAverage(all, entry.date) }));
    const ys = shown.map((entry) => entry.lb).concat(ma.map((entry) => entry.lb));
    if (goal) ys.push(goal);
    let min = Math.min.apply(null, ys);
    let max = Math.max.apply(null, ys);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.15;
    min -= pad;
    max += pad;
    const left = 36;
    const top = 12;
    const width = 280;
    const height = 120;
    const span = Math.max(daysBetween(x0, x1), 0);
    const xPos = (date) => (span <= 0 ? left + width / 2 : left + (daysBetween(x0, date) / span) * width);
    const yPos = (lb) => top + (1 - (lb - min) / (max - min)) * height;
    const line = (points) => points.map((point) => xPos(point.date).toFixed(1) + "," + yPos(point.lb).toFixed(1)).join(" ");
    const goalY = goal ? yPos(goal) : null;
    return `
      <svg class="weight-chart" data-testid="weight-chart" viewBox="0 0 320 150" role="img" aria-label="Weight over time">
        <line x1="${left}" y1="${top + height}" x2="${left + width}" y2="${top + height}" class="axis"></line>
        ${
          goalY != null
            ? `<line data-testid="weight-goal-line" x1="${left}" y1="${goalY.toFixed(1)}" x2="${left + width}" y2="${goalY.toFixed(1)}" class="goal"></line>`
            : ""
        }
        <polyline data-testid="weight-ma" points="${line(ma)}" class="ma"></polyline>
        <polyline data-testid="weight-line" points="${line(shown)}" class="actual"></polyline>
        ${shown
          .map(
            (entry) =>
              `<circle cx="${xPos(entry.date).toFixed(1)}" cy="${yPos(entry.lb).toFixed(1)}" r="2.5" class="dot"><title>${esc(entry.date)} ${esc(fmtLb(entry.lb))} lb</title></circle>`
          )
          .join("")}
      </svg>`;
  }

  function movingAverage(all, date) {
    const start = addDays(date, -6);
    const windowEntries = all.filter((entry) => entry.date >= start && entry.date <= date);
    if (!windowEntries.length) return null;
    const avg = windowEntries.reduce((sum, entry) => sum + entry.lb, 0) / windowEntries.length;
    return round1(avg);
  }

  function renderWeight() {
    const range = ui.weightRange || "30";
    const all = store.weightEntries();
    const today = dateKey();
    let shown = all;
    if (range !== "all") {
      const days = range === "90" ? 90 : range === "365" ? 365 : 30;
      const start = addDays(today, -(days - 1));
      shown = all.filter((entry) => entry.date >= start && entry.date <= today);
    }
    const latest = all.length ? all[all.length - 1] : null;
    const change = shown.length >= 2 ? round1(shown[shown.length - 1].lb - shown[0].lb) : null;
    const goal = store.data.settings.weightGoal;
    const changeText = change == null ? "—" : (change > 0 ? "+" : "") + change.toFixed(1) + " lb";
    const ranges = [
      ["30", "30 days"],
      ["90", "90 days"],
      ["365", "1 year"],
      ["all", "All"],
    ];
    return `
      <h2 class="page-title">Weight</h2>
      <div class="stats">
        <div class="stat"><div class="k">Current</div><div class="v" data-testid="weight-current">${latest ? esc(fmtLb(latest.lb)) + " lb" : "—"}</div></div>
        <div class="stat"><div class="k">Change in view</div><div class="v" data-testid="weight-change">${esc(changeText)}</div></div>
      </div>
      <div class="seg" role="group" aria-label="Weight range">
        ${ranges
          .map(
            ([id, label]) =>
              `<button type="button" data-act="weight-range" data-range="${id}" aria-pressed="${range === id}">${label}</button>`
          )
          .join("")}
      </div>
      <section class="chart-card">
        <h3>Weight</h3>
        <div class="chart-avg">${goal ? "Goal " + esc(fmtLb(goal)) + " lb · " : ""}Line is each weigh-in. Blue is the 7-day average.</div>
        ${weightChart(shown, all, goal, range)}
      </section>
      <div class="section-head"><h3>Entries</h3></div>
      ${
        shown.length
          ? `<div class="food-list" data-testid="weight-list">${shown
              .slice()
              .reverse()
              .map(
                (entry) => `<div class="food-row">
                  <div>
                    <div class="name">${esc(fmtLb(entry.lb))} lb</div>
                    <div class="meta">${esc(formatDate(entry.date))}${entry.note ? " · " + esc(entry.note) : ""}</div>
                  </div>
                  <div class="food-actions">
                    <button type="button" class="icon-btn" data-act="edit-weight" data-date="${esc(entry.date)}" aria-label="Edit weight ${esc(entry.date)}">✎</button>
                    <button type="button" class="icon-btn" data-act="delete-weight" data-date="${esc(entry.date)}" aria-label="Delete weight ${esc(entry.date)}">✕</button>
                  </div>
                </div>`
              )
              .join("")}</div>`
          : `<div class="empty" data-testid="weight-empty"><strong>No weigh-ins yet</strong>One entry per day. Logging the same day again replaces it.</div>`
      }
      <div style="height:12px"></div>
      <button type="button" class="btn primary" data-act="log-weight">Log weight</button>`;
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
            : ui.tab === "weight"
              ? renderWeight()
              : renderSettings();
    els.main.innerHTML = view;
    els.main.scrollTop = 0;
  }

  function openFoodSheet(existing) {
    const isEdit = Boolean(existing);
    ui.sheet = { type: "food", id: existing && existing.id };
    ui.foodBase = null;
    ui.mealItems = [];
    openSheet(`
      <h3>${isEdit ? "Edit food" : "Add food"}</h3>
      ${
        isEdit
          ? ""
          : `<div class="field">
              <label for="food-search">Search foods</label>
              <input id="food-search" placeholder="Chicken, banana, brand name…" autocomplete="off" enterkeyhint="search" />
              <p class="hint">Common foods are from USDA FoodData Central and show immediately. Restaurant items are official menu servings. Brand names search Open Food Facts when you are online.</p>
            </div>
            <div class="field">
              <label for="food-place">Restaurant</label>
              <select id="food-place" data-act="food-place">
                <option value="">All restaurants and common foods</option>
              </select>
            </div>
            <div id="restaurant-results" data-testid="restaurant-results"></div>
            <div id="usda-results" data-testid="usda-results"></div>
            <p id="brand-status" class="hint" data-testid="brand-status"></p>
            <div id="brand-results" data-testid="brand-results"></div>
            <div class="barcode-row">
              <div class="field grow">
                <label for="food-barcode">Barcode</label>
                <input id="food-barcode" inputmode="numeric" autocomplete="off" placeholder="Type or scan" />
              </div>
              <button type="button" class="btn secondary slim" data-act="lookup-barcode">Look up</button>
              <button type="button" class="btn secondary slim" data-act="scan-barcode">Scan barcode</button>
            </div>
            <p id="barcode-status" class="hint" data-testid="barcode-status"></p>
            <div id="scan-panel" class="scan-panel" hidden>
              <video id="scan-video" playsinline muted autoplay></video>
              <p id="scan-status" class="hint" data-testid="scan-status"></p>
              <button type="button" class="btn secondary" data-act="stop-scan">Close camera</button>
            </div>`
      }
      <form id="food-form" class="stack">
        <div id="serving-adjust" class="serving-adjust" data-testid="serving-adjust" hidden>
          <p id="serving-label" class="hint"></p>
          <div class="field-row">
            <div class="field">
              <label for="food-servings">Amount</label>
              <input id="food-servings" type="number" inputmode="decimal" min="0" step="any" value="1" disabled />
            </div>
            <div class="field">
              <label for="food-unit">Unit</label>
              <select id="food-unit" data-act="food-unit"></select>
            </div>
          </div>
          <button type="button" class="btn secondary" data-act="add-to-meal">Add to meal</button>
        </div>
        <div id="meal-builder" data-testid="meal-builder">
          <div id="meal-lines"></div>
          <p id="meal-total" class="meal-total" data-testid="meal-total" hidden></p>
          <div class="field" id="meal-name-wrap" hidden>
            <label for="meal-name">Meal name</label>
            <input id="meal-name" maxlength="80" placeholder="Breakfast" />
          </div>
        </div>
        <div class="field">
          <label for="food-name">Food</label>
          <input id="food-name" name="name" maxlength="140" placeholder="Greek yogurt" value="${esc(existing ? existing.name : "")}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="food-cal">Calories</label>
            <input id="food-cal" name="calories" type="number" inputmode="numeric" min="0" step="1" value="${esc(existing ? existing.calories : "")}" />
          </div>
          <div class="field">
            <label for="food-pro">Protein (g)</label>
            <input id="food-pro" name="protein" type="number" inputmode="decimal" min="0" step="0.1" value="${esc(existing ? existing.protein : "")}" />
          </div>
        </div>
        ${isEdit ? "" : `<label class="check"><input type="checkbox" id="food-fav" /> Save as favorite</label>`}
        <div class="sheet-actions">
          <button type="button" class="btn secondary" data-act="close-sheet">Cancel</button>
          <button type="submit" class="btn primary">${isEdit ? "Save" : "Add"}</button>
        </div>
      </form>
    `);
    if (!isEdit) ensureRestaurants().then(() => fillRestaurantFilter()).catch(() => {});
  }

  function openWeightSheet(date) {
    const key = date || ui.date || dateKey();
    const entry = store.data.weights[key];
    ui.sheet = { type: "weight", date: key };
    openSheet(`
      <h3>${entry ? "Edit weight" : "Log weight"}</h3>
      <form id="weight-form" class="stack">
        <div class="field">
          <label for="weight-date">Date</label>
          <input id="weight-date" type="date" required max="${esc(dateKey())}" value="${esc(key)}" />
        </div>
        <div class="field">
          <label for="weight-lb">Weight (lb)</label>
          <input id="weight-lb" type="number" inputmode="decimal" min="1" max="800" step="0.1" required value="${entry ? esc(fmtLb(entry.lb)) : ""}" />
        </div>
        <div class="field">
          <label for="weight-note">Note</label>
          <input id="weight-note" maxlength="140" placeholder="Morning, after coffee…" value="${esc(entry ? entry.note || "" : "")}" />
        </div>
        <p class="hint">One entry per day. Saving this date again replaces it.</p>
        <div class="sheet-actions">
          <button type="button" class="btn secondary" data-act="close-sheet">Cancel</button>
          <button type="submit" class="btn primary">Save weight</button>
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
    const weight = document.getElementById("goal-weight");
    if (!cal || !pro) return;
    store.setGoals(cal.value, pro.value, weight ? weight.value : store.data.settings.weightGoal);
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

    if (act === "frame-next" || act === "frame-prev" || act === "frame-dot") {
      const fig = btn.closest(".demo");
      if (!fig) return;
      const current = Number(fig.getAttribute("data-step")) || 0;
      const next = act === "frame-dot" ? Number(btn.getAttribute("data-index")) || 0 : current + (act === "frame-next" ? 1 : -1);
      paintDemoFrame(fig, next);
      return;
    }

    if (act === "tab") {
      const next = btn.getAttribute("data-tab");
      if (next === "workouts" && ui.tab === "workouts") {
        ui.workoutsMode = "list";
        ui.planSession = null;
        ui.workoutId = null;
      }
      ui.tab = next;
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
      const name = btn.getAttribute("data-name");
      const fav = store.data.favorites.find((item) => item.name === name);
      const recent = store.data.recents.find((item) => item.name === name);
      const src = fav || recent;
      store.addFood(ui.date, {
        name,
        calories: src ? src.calories : btn.getAttribute("data-calories"),
        protein: src ? src.protein : btn.getAttribute("data-protein"),
        items: src && src.items,
        qty: src && src.qty,
      });
      render();
      toast("Added " + name);
      return;
    }
    if (act === "close-sheet") {
      closeSheet();
      return;
    }
    if (act === "pick-food") {
      if (btn.getAttribute("data-fixed") === "1") {
        applyFoodBase({
          fixed: true,
          name: btn.getAttribute("data-name"),
          calories: Number(btn.getAttribute("data-cal")),
          protein: Number(btn.getAttribute("data-pro")),
          serving: btn.getAttribute("data-serving") || "1 serving",
        });
        return;
      }
      let portions = [];
      try {
        portions = JSON.parse(btn.getAttribute("data-portions") || "[]");
      } catch (err) {
        portions = [];
      }
      applyFoodBase({
        name: btn.getAttribute("data-name"),
        kcal100: Number(btn.getAttribute("data-kcal100")),
        pro100: Number(btn.getAttribute("data-pro100")),
        portions,
        calories: Number(btn.getAttribute("data-cal")),
        protein: Number(btn.getAttribute("data-pro")),
        grams: Number(btn.getAttribute("data-grams")) || 0,
        serving: btn.getAttribute("data-serving") || "",
      });
      return;
    }
    if (act === "add-to-meal") {
      const line = currentLine();
      if (!line || !line.name) {
        toast("Choose a food first");
        return;
      }
      ui.mealItems = ui.mealItems || [];
      ui.mealItems.push(line);
      if (line.unit && line.unit !== "manual") store.rememberFoodUse(line.name, { amount: line.amount, unit: line.unit });
      renderMeal();
      clearPicker();
      const search = document.getElementById("food-search");
      if (search) search.focus();
      return;
    }
    if (act === "remove-meal-item") {
      const index = Number(btn.getAttribute("data-index"));
      if (ui.mealItems && index >= 0) ui.mealItems.splice(index, 1);
      renderMeal();
      return;
    }
    if (act === "lookup-barcode") {
      const input = document.getElementById("food-barcode");
      lookupBarcode(input ? input.value : "");
      return;
    }
    if (act === "scan-barcode") {
      startScan();
      return;
    }
    if (act === "stop-scan") {
      stopScan();
      const panel = document.getElementById("scan-panel");
      if (panel) panel.hidden = true;
      return;
    }
    if (act === "log-weight") {
      openWeightSheet(ui.tab === "today" ? ui.date : dateKey());
      return;
    }
    if (act === "edit-weight") {
      openWeightSheet(btn.getAttribute("data-date"));
      return;
    }
    if (act === "delete-weight") {
      const date = btn.getAttribute("data-date");
      if (date && confirm("Delete the weigh-in on " + formatDate(date) + "?")) {
        store.deleteWeight(date);
        render();
      }
      return;
    }
    if (act === "weight-range") {
      ui.weightRange = btn.getAttribute("data-range") || "30";
      render();
      return;
    }
    if (act === "open-plans") {
      ui.workoutId = null;
      ui.planSession = null;
      ui.workoutsMode = "plans";
      render();
      Promise.all([plansCache ? Promise.resolve() : ensurePlans(), demosCache ? Promise.resolve() : ensureDemos()])
        .then(() => {
          if (ui.workoutsMode === "plans") render();
        })
        .catch(() => toast("Could not load plans"));
      return;
    }
    if (act === "close-plans") {
      ui.workoutsMode = "list";
      ui.planSession = null;
      render();
      return;
    }
    if (act === "plans-back") {
      ui.planSession = null;
      render();
      return;
    }
    if (act === "open-session") {
      ui.planSession = btn.getAttribute("data-session");
      render();
      return;
    }
    if (act === "plan-level") {
      store.setPlanLevel(btn.getAttribute("data-level"));
      render();
      return;
    }
    if (act === "level-up") {
      const streak = easyStreak();
      store.setPlanLevel(planLevel().id + 1);
      store.setLevelSnooze(streak);
      render();
      return;
    }
    if (act === "level-stay") {
      store.setLevelSnooze(easyStreak());
      render();
      return;
    }
    if (act === "level-down") {
      store.setPlanLevel(planLevel().id - 1);
      render();
      return;
    }
    if (act === "start-plan") {
      const session = sessionById(btn.getAttribute("data-session"));
      if (!session) {
        toast("That plan is still loading");
        return;
      }
      const level = planLevel();
      const workout = store.createPlannedWorkout(dateKey(), buildPlanWorkout(session, level));
      ui.workoutId = workout.id;
      ui.workoutsMode = "list";
      ui.planSession = null;
      ui.tab = "workouts";
      render();
      toast("Workout ready to log");
      return;
    }
    if (act === "rpe") {
      store.setRpe(ui.workoutId, btn.getAttribute("data-rpe"));
      render();
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
    if (act === "food-place") {
      const search = document.getElementById("food-search");
      if (search) scheduleFoodSearch(search.value);
      return;
    }
    if (act === "food-unit") {
      refreshQty();
      return;
    }
    if (act === "goal-cal" || act === "goal-pro" || act === "goal-weight") {
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
      const fav = form.querySelector("#food-fav");
      if (ui.sheet && ui.sheet.id) {
        if (!String(form.name.value || "").trim()) {
          toast("Enter a food name");
          return;
        }
        store.updateFood(ui.date, ui.sheet.id, {
          name: form.name.value,
          calories: form.calories.value,
          protein: form.protein.value,
        });
        toast("Food updated");
      } else if (ui.mealItems && ui.mealItems.length) {
        const pending = currentLine();
        const items = ui.mealItems.slice();
        if (pending && pending.name) items.push(pending);
        const mealName = ((document.getElementById("meal-name") || {}).value || items[0].name || "Meal").trim();
        const calories = items.reduce((sum, item) => sum + item.calories, 0);
        const protein = round1(items.reduce((sum, item) => sum + item.protein, 0));
        items.forEach((item) => {
          if (item.unit && item.unit !== "manual") store.rememberFoodUse(item.name, { amount: item.amount, unit: item.unit });
        });
        store.addFood(ui.date, {
          name: mealName,
          calories,
          protein,
          items,
          favorite: fav && fav.checked,
        });
        toast("Meal added");
      } else {
        if (!String(form.name.value || "").trim()) {
          toast("Enter a food name");
          return;
        }
        const line = currentQty();
        if (line) store.rememberFoodUse(line.name, { amount: line.amount, unit: line.unit });
        store.addFood(ui.date, {
          name: form.name.value,
          calories: form.calories.value,
          protein: form.protein.value,
          favorite: fav && fav.checked,
          qty: line,
        });
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
      return;
    }
    if (form.id === "weight-form") {
      event.preventDefault();
      const date = document.getElementById("weight-date").value;
      const lb = document.getElementById("weight-lb").value;
      const note = document.getElementById("weight-note").value;
      if (date > dateKey()) {
        toast("Pick today or an earlier date");
        return;
      }
      store.logWeight(date, lb, note);
      closeSheet();
      if (ui.tab === "today") ui.date = date;
      render();
      toast("Weight saved");
    }
  }

  function onInput(event) {
    const el = event.target;
    if (!el || !el.id) return;
    if (el.id === "food-search") {
      scheduleFoodSearch(el.value);
      return;
    }
    if (el.id === "food-servings") {
      refreshQty();
      return;
    }
    if (el.id === "weight-date") {
      const entry = store.data.weights[el.value];
      const lb = document.getElementById("weight-lb");
      const note = document.getElementById("weight-note");
      if (!lb || !note) return;
      if (entry) {
        lb.value = fmtLb(entry.lb);
        note.value = entry.note || "";
      } else {
        lb.value = "";
        note.value = "";
      }
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
    let framePointer = null;
    document.addEventListener("pointerdown", (event) => {
      const stage = event.target.closest(".demo-stage");
      if (!stage) return;
      framePointer = { x: event.clientX, y: event.clientY, stage };
    });
    document.addEventListener("pointerup", (event) => {
      if (!framePointer) return;
      const start = framePointer;
      framePointer = null;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      const fig = start.stage.closest(".demo");
      const current = Number(fig && fig.getAttribute("data-step")) || 0;
      paintDemoFrame(fig, current + (dx < 0 ? 1 : -1));
      const stop = (ev) => {
        ev.stopPropagation();
        start.stage.removeEventListener("click", stop, true);
      };
      start.stage.addEventListener("click", stop, true);
    });
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("submit", onSubmit);
    els.overlay.addEventListener("click", closeSheet);
    els.importFile.addEventListener("change", () => {
      const file = els.importFile.files && els.importFile.files[0];
      if (file) importBackupFile(file);
    });
    render();
    ensurePlans().catch(() => {});
    ensureDemos().catch(() => {});
    ensureRestaurants().catch(() => {});
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
