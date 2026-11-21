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
    expect(swText).toContain("fittrack-v8");
    expect(swText).not.toContain("fittrack-v7");
    expect(swText).not.toContain("fittrack-v6");
    expect(swText).not.toContain("fittrack-v5");
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
        "/Fittrack/data/foods/index.json",
        "/Fittrack/data/restaurants.json",
        "/Fittrack/data/exercise-demos.json",
        "/Fittrack/data/plans.json",
        "/Fittrack/vendor/zxing.min.js",
      ])
    );

    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("searches USDA foods and mocked Open Food Facts brands", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.route("**/world.openfoodfacts.org/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/product/")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            status: 1,
            product: {
              code: "012345678905",
              product_name: "Greek Yogurt",
              brands: "Yoplait",
              serving_size: "150 g",
              serving_quantity: 150,
              nutriments: { "energy-kcal_serving": 120, proteins_serving: 15 },
            },
          }),
        });
        return;
      }
      if (url.includes("zzzznotfood")) {
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ products: [] }) });
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          products: [
            {
              code: "111",
              product_name: "Protein Bar",
              brands: "Clif",
              serving_size: "68 g",
              serving_quantity: 68,
              nutriments: { "energy-kcal_serving": 250, proteins_serving: 10 },
            },
          ],
        }),
      });
    });

    await page.goto("/Fittrack/");
    const foods = await page.request.get("/Fittrack/data/foods/index.json");
    expect(foods.status()).toBe(200);
    const body = await foods.json();
    expect(body.count).toBeGreaterThan(8000);
    expect(body.shards.length).toBeGreaterThan(10);
    expect(body.source).toMatch(/USDA FoodData Central/);
    expect(body.source).toMatch(/Foundation/);
    expect(body.source).toMatch(/FNDDS/);
    const shard = await page.request.get("/Fittrack/data/foods/b.json");
    expect(shard.status()).toBe(200);

    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.locator("#food-search").fill("bananas raw");
    const hit = page.getByTestId("usda-results").getByRole("button").first();
    await expect(hit).toContainText("Bananas, raw");
    expect(Number(await hit.getAttribute("data-cal"))).toBe(105);
    await hit.click();
    await expect(page.getByTestId("serving-adjust")).toBeVisible();
    await page.locator("#food-servings").fill("2");
    await expect(page.locator("#food-cal")).toHaveValue("210");
    await expect(page.locator("#food-pro")).toHaveValue("2.6");
    await expect(page.locator("#serving-label")).toContainText("236 g");
    await page.locator("#food-fav").check();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByTestId("food-list")).toContainText("Bananas, raw");
    await expect(page.getByTestId("food-list")).toContainText("210 cal");
    await expect(page.getByTestId("quick-add")).toContainText("Bananas, raw");

    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.locator("#food-search").fill("zzzznotfood");
    await expect(page.getByTestId("usda-results")).toContainText("No common foods");
    await expect(page.getByTestId("brand-status")).toContainText("No brand matches");
    await page.locator("#food-search").fill("clif");
    await expect(page.getByTestId("brand-results")).toContainText("Clif Protein Bar");
    await page.getByTestId("brand-results").getByRole("button").first().click();
    await expect(page.locator("#food-name")).toHaveValue("Clif Protein Bar");
    await expect(page.locator("#food-cal")).toHaveValue("250");
    await page.getByRole("button", { name: "Cancel" }).click();

    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("looks up a barcode and skips brand search while offline", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.addInitScript(() => {
      window.FitTrackBarcodeDetector = class {
        async detect() {
          return [{ rawValue: "012345678905" }];
        }
      };
    });
    await page.route("**/world.openfoodfacts.org/**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: 1,
          product: {
            code: "012345678905",
            product_name: "Greek Yogurt",
            brands: "Yoplait",
            serving_size: "150 g",
            serving_quantity: 150,
            nutriments: { "energy-kcal_serving": 120, proteins_serving: 15 },
          },
        }),
      });
    });

    await page.goto("/Fittrack/");
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      window.FitTrackFakeStream = canvas.captureStream(5);
    });
    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.getByRole("button", { name: "Scan barcode" }).click();
    await expect(page.locator("#food-name")).toHaveValue("Yoplait Greek Yogurt", { timeout: 8000 });
    await expect(page.locator("#food-cal")).toHaveValue("120");
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    });
    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.locator("#food-search").fill("yogurt");
    await expect(page.getByTestId("brand-status")).toContainText(/offline/i);
    await expect(page.getByTestId("usda-results")).toContainText("Yogurt");
    await page.locator("#food-barcode").fill("012345678905");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByTestId("barcode-status")).toContainText(/offline/i);

    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("uses the ZXing fallback when BarcodeDetector is missing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.addInitScript(() => {
      window.FitTrackForceZxing = true;
    });
    await page.goto("/Fittrack/");
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      window.FitTrackFakeStream = canvas.captureStream(5);
    });
    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.getByRole("button", { name: "Scan barcode" }).click();
    await expect
      .poll(() => page.evaluate(() => !!(window.ZXing && window.ZXing.BrowserMultiFormatReader)))
      .toBe(true);
    await expect(page.getByTestId("scan-status")).toContainText(/barcode|camera|type the barcode/i);
    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("tracks daily weight without dropping existing food logs", async ({ page, context }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    const today = dateKey();
    const weights = {};
    weights[addDays(today, -20)] = { lb: 184.0, note: "start", updatedAt: 1 };
    weights[addDays(today, -10)] = { lb: 182.5, note: "", updatedAt: 2 };
    weights[addDays(today, -1)] = { lb: 181.0, note: "yesterday", updatedAt: 3 };
    await context.addInitScript((payload) => {
      localStorage.setItem("fittrack-v1", JSON.stringify(payload));
    }, {
      version: 1,
      settings: { calorieGoal: 2200, proteinGoal: 160 },
      days: { [today]: { foods: [{ id: "keep-me", name: "Oatmeal", calories: 300, protein: 12, createdAt: 1 }] } },
      favorites: [],
      recents: [],
      exerciseNames: [],
      workouts: [],
      weights,
    });

    await page.goto("/Fittrack/");
    await expect(page.getByTestId("food-list")).toContainText("Oatmeal");
    await expect(page.getByTestId("weight-today")).toContainText("Not logged");
    await page.getByRole("button", { name: "Log weight" }).click();
    await page.locator("#weight-lb").fill("180.5");
    await page.locator("#weight-note").fill("morning");
    await page.getByRole("button", { name: "Save weight" }).click();
    await expect(page.getByTestId("weight-today")).toContainText("180.5");

    await page.getByRole("tab", { name: "Weight" }).click();
    await expect(page.getByTestId("weight-current")).toContainText("180.5");
    await expect(page.getByTestId("weight-change")).toContainText("-3.5");
    await expect(page.getByTestId("weight-chart")).toBeVisible();
    await expect(page.getByTestId("weight-ma")).toBeVisible();
    await expect(page.getByTestId("weight-list").locator(".food-row")).toHaveCount(4);

    await page.getByRole("button", { name: "Log weight" }).click();
    await page.locator("#weight-lb").fill("181.2");
    await page.locator("#weight-note").fill("evening");
    await page.getByRole("button", { name: "Save weight" }).click();
    await expect(page.getByTestId("weight-list").locator(".food-row")).toHaveCount(4);
    await expect(page.getByTestId("weight-current")).toContainText("181.2");
    await expect(page.getByTestId("weight-list")).toContainText("evening");

    await page.getByRole("button", { name: "90 days" }).click();
    await expect(page.getByTestId("weight-chart")).toBeVisible();
    await page.getByRole("button", { name: "1 year" }).click();
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByTestId("weight-list").locator(".food-row")).toHaveCount(4);

    await page.getByRole("tab", { name: "Settings" }).click();
    await page.locator("#goal-weight").fill("175");
    await page.locator("#goal-weight").blur();
    await page.getByRole("tab", { name: "Weight" }).click();
    await expect(page.getByText("Goal 175.0 lb")).toBeVisible();
    await expect(page.getByTestId("weight-goal-line")).toHaveCount(1);

    await page.getByRole("button", { name: "Edit weight " + addDays(today, -20) }).click();
    await page.locator("#weight-note").fill("edited");
    await page.getByRole("button", { name: "Save weight" }).click();
    await expect(page.getByTestId("weight-list")).toContainText("edited");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete weight " + addDays(today, -20) }).click();
    await expect(page.getByTestId("weight-list")).not.toContainText("edited");

    await page.getByRole("tab", { name: "Settings" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export backup" }).click();
    const download = await downloadPromise;
    const tmp = path.join(SCREEN_DIR, "..", "test-results", "weight-backup.json");
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    await download.saveAs(tmp);
    const exported = JSON.parse(fs.readFileSync(tmp, "utf8"));
    expect(exported.weights[today].lb).toBe(181.2);
    expect(exported.settings.weightGoal).toBe(175);
    expect(exported.days[today].foods[0].name).toBe("Oatmeal");

    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("starts a leveled home plan and suggests moving up", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/Fittrack/");
    await page.getByRole("tab", { name: "Workouts" }).click();
    await page.getByRole("button", { name: "Home plans" }).click();
    await expect(page.getByTestId("plan-disclaimer")).toContainText("doctor");
    await expect(page.getByTestId("plan-disclaimer")).toContainText("abdominal surgery");
    await expect(page.getByTestId("week-plan")).toContainText("Strength A");
    await expect(page.getByTestId("week-plan")).toContainText("Rest");
    await page.getByRole("button", { name: "Level 1" }).click();
    await expect(page.getByTestId("level-summary")).toContainText("2 sets");
    await page.getByRole("button", { name: "Open Strength A" }).click();
    await expect(page.getByTestId("plan-cue").first()).not.toHaveText("");
    await expect(page.getByRole("heading", { name: "Squat to a bench" })).toBeVisible();
    await page.getByRole("button", { name: "Start this workout" }).click();
    const easyCard = page.locator(".ex-card", { hasText: "Squat to a bench" });
    await expect(easyCard.locator('input[data-act="set-reps"]')).toHaveCount(2);
    await expect(easyCard.locator('input[data-act="set-reps"]').first()).toHaveValue("8");
    await expect(easyCard).toContainText("Knees track over mid-foot");
    await easyCard.locator('input[data-act="set-weight"]').first().fill("25");
    await easyCard.locator('input[data-act="set-weight"]').first().blur();
    await page.getByRole("button", { name: "Too easy" }).click();
    await page.getByRole("button", { name: "Back to workouts" }).click();

    await page.getByRole("button", { name: "Home plans" }).click();
    await page.getByRole("button", { name: "Start Strength A" }).click();
    await expect(page.locator(".ex-card", { hasText: "Squat to a bench" }).getByTestId("last-time")).toContainText("8×25");
    await page.getByRole("button", { name: "Too easy" }).click();
    await page.getByRole("button", { name: "Back to workouts" }).click();
    await page.getByRole("button", { name: "Home plans" }).click();
    await page.getByRole("button", { name: "Start Strength A" }).click();
    await page.getByRole("button", { name: "Too easy" }).click();
    await page.getByRole("button", { name: "Back to workouts" }).click();
    await page.getByRole("button", { name: "Home plans" }).click();
    await expect(page.getByTestId("level-up")).toContainText("Level 2");
    await page.getByRole("button", { name: "Move to Level 2" }).click();
    await expect(page.getByRole("button", { name: "Level 2" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Level 5" }).click();
    await page.getByRole("button", { name: "Open Strength A" }).click();
    await expect(page.getByRole("heading", { name: "Double dumbbell squat" })).toBeVisible();
    await page.getByRole("button", { name: "Start this workout" }).click();
    const hardCard = page.locator(".ex-card", { hasText: "Double dumbbell squat" });
    await expect(hardCard.locator('input[data-act="set-reps"]')).toHaveCount(4);
    await expect(page.locator(".ex-card", { hasText: "Easy bike spin" })).toContainText("min");

    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("builds a breakfast of 2 scrambled eggs and 6 oz egg whites", async ({ page, context }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    const today = dateKey();
    await context.addInitScript((payload) => {
      localStorage.setItem("fittrack-v1", JSON.stringify(payload));
    }, {
      version: 1,
      settings: { calorieGoal: 2200, proteinGoal: 160 },
      days: {
        [today]: { foods: [{ id: "old-oatmeal", name: "Oatmeal", calories: 300, protein: 10, createdAt: 1 }] },
      },
      favorites: [],
      recents: [],
      exerciseNames: [],
      workouts: [],
    });

    await page.goto("/Fittrack/");
    await expect(page.getByTestId("food-list")).toContainText("Oatmeal");
    await expect(page.getByTestId("food-list")).toContainText("300 cal");

    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.locator("#food-search").fill("scrambled egg");
    const egg = page.getByTestId("usda-results").getByRole("button", { name: /Egg omelet or scrambled egg, no added fat/ });
    await expect(egg).toBeVisible();
    await egg.click();
    await expect(page.locator("#food-unit")).toHaveValue("p0");
    await page.locator("#food-servings").fill("2");
    await expect(page.locator("#serving-label")).toContainText("2 × 1 egg");
    await expect(page.locator("#food-cal")).toHaveValue("143");
    await expect(page.locator("#food-pro")).toHaveValue("12.4");
    await page.getByRole("button", { name: "Add to meal" }).click();
    await expect(page.getByTestId("meal-total")).toContainText("143 cal");

    await page.locator("#food-search").fill("egg white raw");
    const whites = page.getByTestId("usda-results").getByRole("button", { name: /white only, raw/i });
    await expect(whites).toBeVisible();
    await whites.click();
    await page.locator("#food-unit").selectOption("oz");
    await page.locator("#food-servings").fill("6");
    await expect(page.locator("#serving-label")).toContainText("6 oz");
    await expect(page.locator("#food-cal")).toHaveValue("88");
    await expect(page.locator("#food-pro")).toHaveValue("18.2");
    await page.getByRole("button", { name: "Add to meal" }).click();
    await expect(page.getByTestId("meal-total")).toContainText("231 cal");
    await expect(page.getByTestId("meal-total")).toContainText("30.6 g");

    await page.locator("#meal-name").fill("Breakfast");
    await page.locator("#food-fav").check();
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByTestId("food-list")).toContainText("Oatmeal");
    const meal = page.locator(".food-row", { hasText: "Breakfast" });
    await expect(meal.getByTestId("meal-lines")).toContainText("2 × 1 egg");
    await expect(meal.getByTestId("meal-lines")).toContainText("Egg omelet or scrambled egg, no added fat");
    await expect(meal.getByTestId("meal-lines")).toContainText("6 oz");
    await expect(meal.getByTestId("meal-lines")).toContainText("Egg, white only, raw");
    await expect(meal).toContainText("231 cal");
    await expect(meal).toContainText("30.6 g protein");
    await expect(page.getByTestId("quick-add")).toContainText("Breakfast");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete Breakfast" }).click();
    await expect(page.getByTestId("food-list")).not.toContainText("Breakfast");
    await page.getByTestId("quick-add").getByRole("button", { name: /Breakfast/ }).click();
    await expect(page.locator(".food-row", { hasText: "Breakfast" })).toContainText("231 cal");
    await expect(page.getByTestId("food-list")).toContainText("Oatmeal");

    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.locator("#food-search").fill("egg white raw");
    await page.getByTestId("usda-results").getByRole("button", { name: /white only, raw/i }).click();
    await expect(page.locator("#food-unit")).toHaveValue("oz");
    await expect(page.locator("#food-servings")).toHaveValue("6");

    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("finds official restaurant items and shows an exercise drawing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/Fittrack/");
    await page.getByRole("button", { name: "+ Add food" }).click();
    await expect(page.locator("#food-place option")).toHaveCount(5);
    await page.locator("#food-search").fill("butterburger single");
    const burger = page.getByTestId("restaurant-results").getByRole("button", { name: /^Culver's ButterBurger, Single/ });
    await expect(burger).toContainText("Culver's");
    await expect(burger).toContainText("390");
    await expect(burger).toContainText("20");
    await burger.click();
    await expect(page.locator("#food-cal")).toHaveValue("390");
    await expect(page.locator("#food-pro")).toHaveValue("20");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByTestId("food-list")).toContainText("Culver's ButterBurger, Single");
    await expect(page.getByTestId("food-list")).toContainText("390 cal");

    await page.getByRole("button", { name: "+ Add food" }).click();
    await page.locator("#food-place").selectOption("braums");
    await page.locator("#food-search").fill("quarter lb cheeseburger");
    await expect(page.getByTestId("restaurant-results")).toContainText("Braum's");
    await expect(page.getByTestId("restaurant-results")).toContainText("530");
    await expect(page.getByTestId("usda-results")).toBeEmpty();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("tab", { name: "Workouts" }).click();
    await page.getByRole("button", { name: "Home plans" }).click();
    await page.getByRole("button", { name: "Level 1" }).click();
    await page.getByRole("button", { name: "Open Strength A" }).click();
    const squat = page.locator(".plan-ex", { hasText: "Squat to a bench" });
    await expect(squat.locator("img")).toHaveAttribute("src", /images\/exercises\/air-squat-1\.jpg/);
    await expect(squat.locator("source")).toHaveAttribute("type", "image/webp");
    await expect(squat.locator("source")).toHaveAttribute("srcset", /air-squat-1\.webp/);
    await expect(squat.locator("img")).toHaveAttribute("loading", "lazy");
    await expect(squat.locator(".frame-count")).toHaveText("Step 1 of 3");
    await expect(squat.locator(".frame-cue")).toContainText("Stand tall");
    await squat.locator(".frame-nav").getByRole("button", { name: "Next step" }).click();
    await expect(squat.locator(".frame-count")).toHaveText("Step 2 of 3");
    await expect(squat.locator("img")).toHaveAttribute("src", /images\/exercises\/air-squat-2\.jpg/);
    await expect(squat.locator("source")).toHaveAttribute("srcset", /air-squat-2\.webp/);
    await squat.locator(".frame-dot").nth(2).click();
    await expect(squat.locator(".frame-count")).toHaveText("Step 3 of 3");
    await expect(squat.getByRole("link", { name: "Watch demo" })).toHaveAttribute("href", /youtube\.com\/watch\?v=sOUCmU27mjE/);
    const halo = page.locator("body");
    await page.getByRole("button", { name: "Back to plans" }).click();
    await page.getByRole("button", { name: "Open Kettlebell circuit" }).click();
    await expect(page.locator(".plan-ex", { hasText: "Kettlebell halo, very light" }).locator("img")).toHaveAttribute(
      "src",
      /halo-1\.jpg/
    );
    await expect(page.locator(".plan-ex", { hasText: "Kettlebell halo, very light" }).locator(".frame-count")).toHaveText(
      "Step 1 of 3"
    );
    expect(halo).toBeTruthy();

    expect(errors, `JS errors: ${errors.join("\n")}`).toEqual([]);
  });
});
