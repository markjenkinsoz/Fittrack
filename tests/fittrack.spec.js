const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const SCREEN_DIR = path.join(__dirname, "..", "screenshots");

function pad(n) {
  return String(n).padStart(2, "0");
}
function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dateKey(dt);
}
function uid(i) {
  return "00000000-0000-4000-8000-" + String(100000000000 + i);
}

function buildSeed() {
  const today = dateKey();
  const days = {};
  const dayMenus = [
    // today
    [
      { name: "Eggs and toast", calories: 350, protein: 22 },
      { name: "Greek yogurt", calories: 140, protein: 18 },
      { name: "Chicken breast", calories: 185, protein: 31 },
      { name: "Salmon and rice", calories: 620, protein: 42 },
      { name: "Protein shake", calories: 160, protein: 30 },
      { name: "Apple", calories: 95, protein: 0.5 },
    ],
    // recent days — vary around the goals
    [
      { name: "Oatmeal with berries", calories: 320, protein: 12 },
      { name: "Chicken breast", calories: 420, protein: 62 },
      { name: "Greek yogurt", calories: 140, protein: 18 },
      { name: "Steak and potatoes", calories: 980, protein: 58 },
      { name: "Protein shake", calories: 160, protein: 30 },
      { name: "Ice cream", calories: 280, protein: 5 },
    ],
    [
      { name: "Eggs and toast", calories: 350, protein: 22 },
      { name: "Turkey sandwich", calories: 540, protein: 38 },
      { name: "Protein shake", calories: 160, protein: 30 },
      { name: "Pasta and meatballs", calories: 890, protein: 41 },
    ],
    [
      { name: "Greek yogurt", calories: 140, protein: 18 },
      { name: "Chicken burrito", calories: 780, protein: 48 },
      { name: "Salmon and rice", calories: 620, protein: 42 },
      { name: "Cottage cheese", calories: 180, protein: 25 },
    ],
    [
      { name: "Oatmeal with berries", calories: 320, protein: 12 },
      { name: "Chicken breast", calories: 185, protein: 31 },
      { name: "Rice and veggies", calories: 410, protein: 8 },
      { name: "Protein shake", calories: 160, protein: 30 },
    ],
    [
      { name: "Eggs and toast", calories: 350, protein: 22 },
      { name: "Tuna salad", calories: 430, protein: 40 },
      { name: "Steak and potatoes", calories: 980, protein: 58 },
      { name: "Greek yogurt", calories: 140, protein: 18 },
      { name: "Banana and peanut butter", calories: 280, protein: 8 },
    ],
    [
      { name: "Protein shake", calories: 160, protein: 30 },
      { name: "Chicken breast", calories: 420, protein: 62 },
      { name: "Salmon and rice", calories: 620, protein: 42 },
      { name: "Apple", calories: 95, protein: 0.5 },
      { name: "Almonds", calories: 170, protein: 6 },
    ],
  ];
  for (let i = 13; i >= 0; i--) {
    const key = addDays(today, -i);
    const menu = dayMenus[i === 0 ? 0 : ((i - 1) % (dayMenus.length - 1)) + 1];
    const foods = menu.map((meal, j) => ({
      id: uid(i * 10 + j + 1),
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      createdAt: Date.now() - i * 86400000 + j * 1000,
    }));
    days[key] = { foods };
  }

  const yesterday = addDays(today, -2);
  const lastWeek = addDays(today, -9);
  const workouts = [
    {
      id: uid(5001),
      date: lastWeek,
      notes: "Push day",
      createdAt: Date.now() - 9 * 86400000,
      updatedAt: Date.now() - 9 * 86400000,
      exercises: [
        {
          id: uid(5101),
          name: "Bench press",
          sets: [
            { id: uid(5201), reps: 8, weight: 135 },
            { id: uid(5202), reps: 8, weight: 145 },
            { id: uid(5203), reps: 6, weight: 155 },
          ],
        },
        {
          id: uid(5102),
          name: "Overhead press",
          sets: [
            { id: uid(5204), reps: 8, weight: 75 },
            { id: uid(5205), reps: 8, weight: 75 },
          ],
        },
      ],
    },
    {
      id: uid(5002),
      date: yesterday,
      notes: "Push day",
      createdAt: Date.now() - 2 * 86400000,
      updatedAt: Date.now() - 2 * 86400000,
      exercises: [
        {
          id: uid(5301),
          name: "Bench press",
          sets: [
            { id: uid(5302), reps: 8, weight: 145 },
            { id: uid(5303), reps: 6, weight: 155 },
            { id: uid(5304), reps: 5, weight: 165 },
          ],
        },
        {
          id: uid(5305),
          name: "Incline dumbbell press",
          sets: [
            { id: uid(5306), reps: 10, weight: 50 },
            { id: uid(5307), reps: 10, weight: 50 },
          ],
        },
      ],
    },
    {
      id: uid(5003),
      date: today,
      notes: "Push day",
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
      exercises: [
        {
          id: uid(5401),
          name: "Bench press",
          sets: [
            { id: uid(5402), reps: 8, weight: 145 },
          ],
        },
      ],
    },
  ];

  return {
    version: 1,
    settings: { calorieGoal: 2200, proteinGoal: 160 },
    days,
    favorites: [
      { id: uid(8001), name: "Greek yogurt", calories: 140, protein: 18 },
      { id: uid(8002), name: "Chicken breast", calories: 185, protein: 31 },
      { id: uid(8003), name: "Protein shake", calories: 160, protein: 30 },
    ],
    recents: [
      { name: "Oatmeal with berries", calories: 320, protein: 12 },
      { name: "Chicken breast", calories: 185, protein: 31 },
    ],
    exerciseNames: ["Bench press", "Overhead press", "Incline dumbbell press", "Squat", "Deadlift"],
    workouts,
  };
}

async function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test.describe("FitTrack PWA", () => {
  test("adds food, workouts, export/import without JS errors", async ({ page, context }) => {
    const errors = await collectErrors(page);
    await context.addInitScript(() => localStorage.clear());
    await page.goto("/Fittrack/");
    await expect(page.getByTestId("date-title")).toHaveText("Today");
    await expect(page.getByTestId("food-empty")).toBeVisible();

    // Settings goals
    await page.getByRole("tab", { name: "Settings" }).click();
    const cal = page.locator("#goal-cal");
    const pro = page.locator("#goal-pro");
    await cal.fill("2000");
    await pro.fill("150");
    await pro.blur();

    // Add food
    await page.getByRole("tab", { name: "Today" }).click();
    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.locator("#food-name").fill("Chicken breast");
    await page.locator("#food-cal").fill("185");
    await page.locator("#food-pro").fill("31");
    await page.locator("#food-fav").check();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByTestId("food-list")).toContainText("Chicken breast");
    await expect(page.getByTestId("food-list")).toContainText("185 cal");
    await expect(page.getByTestId("ring-cal")).toContainText("185");
    await expect(page.getByTestId("ring-pro")).toContainText("31");
    await expect(page.getByTestId("quick-add")).toContainText("Chicken breast");

    // Quick add favorite
    await page.getByTestId("quick-add").getByRole("button", { name: /Chicken breast/ }).click();
    await expect(page.getByTestId("food-list").locator(".food-row")).toHaveCount(2);

    // Edit one entry
    await page.getByRole("button", { name: "Edit Chicken breast" }).first().click();
    await page.locator("#food-cal").fill("200");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("food-list")).toContainText("200 cal");

    // Delete one
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete Chicken breast" }).first().click();
    await expect(page.getByTestId("food-list").locator(".food-row")).toHaveCount(1);

    // Previous day navigation
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page.getByTestId("date-title")).toHaveText("Yesterday");
    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.locator("#food-name").fill("Oatmeal");
    await page.locator("#food-cal").fill("320");
    await page.locator("#food-pro").fill("12");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByTestId("food-list")).toContainText("Oatmeal");
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.getByTestId("date-title")).toHaveText("Today");
    await expect(page.getByTestId("food-list")).toContainText("Chicken breast");

    // Workout + last time
    await page.getByRole("tab", { name: "Workouts" }).click();
    await page.getByRole("button", { name: "Start workout" }).click();
    const yesterday = addDays(dateKey(), -1);
    await page.locator("#start-wo-date").fill(yesterday);
    await page.locator("#start-wo-form").getByRole("button", { name: "Start" }).click();
    await page.locator("#wo-notes").fill("Push day");
    await page.locator("#wo-notes").blur();
    await page.getByRole("button", { name: "+ Add exercise" }).click();
    await page.locator("#ex-name").fill("Bench press");
    await page.locator("#ex-form").getByRole("button", { name: "Add" }).click();
    await expect(page.getByTestId("exercise-list")).toContainText("Bench press");
    const firstReps = page.locator('input[data-act="set-reps"]').first();
    const firstWt = page.locator('input[data-act="set-weight"]').first();
    await firstReps.fill("8");
    await firstWt.fill("135");
    await firstWt.blur();
    await page.getByRole("button", { name: "+ Add set" }).click();
    await page.locator('input[data-act="set-reps"]').nth(1).fill("8");
    await page.locator('input[data-act="set-weight"]').nth(1).fill("145");
    await page.locator('input[data-act="set-weight"]').nth(1).blur();

    await page.getByRole("button", { name: "Back to workouts" }).click();
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.locator("#start-wo-form").getByRole("button", { name: "Start" }).click();
    await page.getByRole("button", { name: "+ Add exercise" }).click();
    await page.locator("#ex-name").fill("Bench press");
    await page.locator("#ex-form").getByRole("button", { name: "Add" }).click();
    await expect(page.getByTestId("last-time")).toBeVisible();
    await expect(page.getByTestId("last-time")).toContainText("8×135");
    await expect(page.getByTestId("last-time")).toContainText("8×145");
    await page.getByRole("button", { name: "Use last sets" }).click();
    await expect(page.locator('input[data-act="set-weight"]').nth(1)).toHaveValue("145");

    // History renders
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByTestId("chart-cal")).toBeVisible();
    await expect(page.getByTestId("chart-pro")).toBeVisible();
    await expect(page.getByTestId("chart-wo")).toBeVisible();
    await page.getByRole("button", { name: "30 days" }).click();
    await expect(page.getByTestId("chart-cal")).toBeVisible();

    // Export
    await page.getByRole("tab", { name: "Settings" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export backup" }).click();
    const download = await downloadPromise;
    const tmp = path.join(SCREEN_DIR, "..", "test-results", "backup.json");
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    await download.saveAs(tmp);
    const exported = JSON.parse(fs.readFileSync(tmp, "utf8"));
    expect(exported.settings.calorieGoal).toBe(2000);
    expect(exported.settings.proteinGoal).toBe(150);
    expect(exported.workouts.length).toBeGreaterThanOrEqual(2);
    const todayFoods = (exported.days[dateKey()] || { foods: [] }).foods;
    expect(todayFoods.some((f) => f.name === "Chicken breast")).toBeTruthy();

    // Import into a clean storage by replacing with a slightly edited backup
    exported.settings.calorieGoal = 2100;
    const importPath = path.join(SCREEN_DIR, "..", "test-results", "import.json");
    fs.writeFileSync(importPath, JSON.stringify(exported));
    page.once("dialog", (dialog) => dialog.accept());
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import backup" }).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(importPath);
    await expect(page.locator("#goal-cal")).toHaveValue("2100");
    await page.getByRole("tab", { name: "Today" }).click();
    await expect(page.getByTestId("food-list")).toContainText("Chicken breast");

    const serious = errors.filter(
      (e) => !/service worker|favicon|Download is starting/i.test(e)
    );
    expect(serious, `JS errors: ${serious.join("\n")}`).toEqual([]);
  });

  test("takes iPhone screenshots of today, workout, and history", async ({ page, context }) => {
    const errors = await collectErrors(page);
    const seed = buildSeed();
    await context.addInitScript((data) => {
      localStorage.setItem("fittrack-v1", JSON.stringify(data));
    }, seed);
    fs.mkdirSync(SCREEN_DIR, { recursive: true });

    await page.goto("/Fittrack/");
    await expect(page.getByTestId("date-title")).toHaveText("Today");
    await expect(page.getByTestId("food-list")).toContainText("Greek yogurt");
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(SCREEN_DIR, "01-today.png"),
      fullPage: false,
    });

    await page.getByRole("tab", { name: "Workouts" }).click();
    await page.getByRole("button", { name: /Push day/ }).first().click();
    await expect(page.getByTestId("last-time")).toBeVisible();
    await expect(page.getByTestId("exercise-list")).toContainText("Bench press");
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREEN_DIR, "02-workout.png"),
      fullPage: false,
    });

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByTestId("chart-cal")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREEN_DIR, "03-history.png"),
      fullPage: false,
    });

    const serious = errors.filter(
      (e) => !/service worker|favicon|Download is starting/i.test(e)
    );
    expect(serious, `JS errors: ${serious.join("\n")}`).toEqual([]);
  });

  test("loads the manifest and service worker from /Fittrack/", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/Fittrack/");
    await expect(page.getByTestId("date-title")).toHaveText("Today");
    expect(page.url()).toMatch(/\/Fittrack\/?$/);

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    const scriptSrc = await page.locator("script[src]").getAttribute("src");
    const iconSrc = await page.locator("img.brand-icon").getAttribute("src");
    expect(manifestHref).toBe("manifest.json");
    expect(scriptSrc).toBe("app.js");
    expect(iconSrc).toBe("icons/icon-192.png");

    const pageUrl = page.url();
    const manifestUrl = new URL(manifestHref, pageUrl);
    expect(manifestUrl.pathname).toBe("/Fittrack/manifest.json");

    const manifestRes = await page.request.get(manifestUrl.href);
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    const startUrl = new URL(manifest.start_url, manifestUrl);
    const scopeUrl = new URL(manifest.scope, manifestUrl);
    expect(startUrl.pathname).toBe("/Fittrack/");
    expect(scopeUrl.pathname).toBe("/Fittrack/");
    expect(manifest.start_url.startsWith("/")).toBe(false);
    expect(manifest.scope.startsWith("/")).toBe(false);

    for (const icon of manifest.icons) {
      expect(icon.src.startsWith("/")).toBe(false);
      const iconUrl = new URL(icon.src, manifestUrl);
      expect(iconUrl.pathname.startsWith("/Fittrack/icons/")).toBe(true);
      const iconRes = await page.request.get(iconUrl.href);
      expect(iconRes.status(), icon.src).toBe(200);
    }

    const swRes = await page.request.get(new URL("./sw.js", pageUrl).href);
    expect(swRes.status()).toBe(200);
    const swText = await swRes.text();
    expect(swText).toContain("./index.html");
    expect(swText).not.toContain('"/index.html"');
    expect(swText).not.toContain("'/index.html'");

    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const cacheNames = await caches.keys();
      const cache = await caches.open(cacheNames[0]);
      const keys = await cache.keys();
      return {
        scope: reg.scope,
        script: reg.active ? reg.active.scriptURL : "",
        cached: keys.map((request) => request.url),
      };
    });

    expect(new URL(registration.scope).pathname).toBe("/Fittrack/");
    expect(new URL(registration.script).pathname).toBe("/Fittrack/sw.js");
    const cachedPaths = registration.cached.map((url) => new URL(url).pathname);
    expect(cachedPaths).toEqual(
      expect.arrayContaining([
        "/Fittrack/",
        "/Fittrack/index.html",
        "/Fittrack/styles.css",
        "/Fittrack/app.js",
        "/Fittrack/manifest.json",
        "/Fittrack/apple-touch-icon.png",
        "/Fittrack/icons/icon-192.png",
        "/Fittrack/icons/icon-512.png",
        "/Fittrack/icons/icon-192-maskable.png",
        "/Fittrack/icons/icon-512-maskable.png",
      ])
    );

    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });
});
