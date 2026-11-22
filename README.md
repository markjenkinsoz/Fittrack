# FitTrack

A personal iPhone Home Screen web app for daily calories, protein, and workouts. There is no account and no server. Everything is saved in the browser on your device (`localStorage`).

## Features

- Daily calorie and protein goals, with progress rings
- Food log by day, including edit, delete, favorites, and one-tap quick add
- Search a built-in list of common foods, or brand-name foods and barcodes when you are online
- Daily body weight with a trend chart and an optional goal
- Home workout plans (strength, kettlebell, recumbent bike, mobility) with a difficulty level
- Workout log with exercises, sets (reps × lb), notes, and “last time” sets
- 7- and 30-day history vs your goals, plus workouts per week
- Export / import a JSON backup (Share sheet on iOS when available, otherwise a download)

## Food data

Common foods load when you search, not on first paint. They are sharded under `data/foods/` and derived from public-domain [USDA FoodData Central](https://fdc.nal.usda.gov/) releases: SR Legacy (April 2018), Foundation Foods (December 2025), and a broad set of FNDDS survey foods for 2021–2023 (prepared dishes such as scrambled eggs). Each food stores calories and protein per 100 g plus household portions (1 egg, 1 cup, 1 slice) when USDA published them. `data/foods/common.json` adds several hundred everyday names (chicken breast, Greek yogurt, olive oil, and so on) that point at those same USDA records. Regenerate the long list with:

```bash
python3 tools/generate_foods.py
python3 tools/build_nutrition.py
```

`data/nutrition.json` holds the rest of the published per-100 g record when USDA printed it: total fat, saturated fat, trans fat, carbohydrate, fiber, total sugar, added sugar, sodium, cholesterol, potassium, calcium, iron, and vitamin D. A blank in the app means that field was not in the record. Numbers are not estimated. Foundation Foods is preferred for an everyday name when that record is the one cited. If an older search row already uses a different calorie value for the same USDA name, that row keeps its calories and protein, and the extra nutrients are attached only when the calorie values agree within 2 kcal.

## Food grades

Every food gets a letter from F through A+. The letter is half nutrient density and half a clean-food score. It is a guide, not a clinical rating.

Nutrient density uses the published numbers per calorie:

- Protein and fiber raise the score. Fiber is skipped when the food has almost no carbohydrate, so plain meat and oils are not punished for having no fiber.
- Saturated fat, sodium, added sugar, and trans fat lower the score.
- Potassium, calcium, iron, and vitamin D can raise it a little when they are high for the calories. The comparison uses 10% of these Daily Values per 100 kcal as a full bump: potassium 340 mg, calcium 130 mg, iron 1.8 mg, vitamin D 2 mcg.
- Missing values are skipped. They are not treated as zero. Cholesterol is shown and not scored. Total sugar is shown and not scored, so fruit and plain milk are not penalized for natural sugar. Only published added sugar is scored.

The clean score starts from a processing group in the spirit of NOVA:

| Group | Examples | Starts at |
| --- | --- | --- |
| Whole or minimally processed | Fruit, vegetables, eggs, plain meat, fish, milk, cooked grains | 90 |
| Culinary ingredient | Oil, butter, sugar, honey, flour | 72 |
| Processed | Cheese, bread, canned beans, cured meat | 56 |
| Ultra-processed | Soda, chips, candy, fast food, most restaurant dishes | 30 |

Everyday foods in `data/foods/common.json` have a group chosen for that food. The long USDA list uses a name rule, and the explanation says so. A single food, or an ingredient list of three items or fewer with no additives, adds 6 points. Eight or more ingredients subtracts 8. Additives (hydrogenated oils, high-fructose corn syrup, artificial sweeteners and colors, and similar) subtract up to 18. Marking a food or a log **organic** adds 8 points to the clean score only. USDA foods are not assumed to be organic.

Letters: 97 A+, 93 A, 90 A-, 87 B+, 83 B, 80 B-, 77 C+, 73 C, 70 C-, 67 D+, 63 D, 60 D-, below 60 F. When fewer than three nutrient parts are available, the letter is 40% nutrient and 60% clean. Otherwise the two scores count equally. A day or a meal is the calorie-weighted average. Foods under 20 calories still count a little so black coffee is not invisible. The same note is in the app under Settings → How grades work.

After you pick a food you can measure it in that household portion, grams, ounces, or cups and fluid ounces when a volume portion exists. The last amount and unit are remembered for that food. Several foods can be added to one named meal, with each line and the combined calories and protein, and saved as a favorite for one tap later.

Restaurant menus that could be copied from an official nutrition PDF are included and tagged with the restaurant name. You can filter the search to one restaurant and add an item by serving count, including inside a meal. Sources and dates are in `data/restaurants.json`.

| Restaurant | Source | Date |
| --- | --- | --- |
| Culver's | [Nutrition & Allergen Guide](https://cdn.culvers.com/menu/docs/guide-nutrition-allergen.pdf) | 2025 |
| Braum's | [Nutritional chart PDF](https://www.braums.com/wp-content/uploads/2022/08/2018-Nutritional-Chart-for-web.pdf) | 2018 chart, hosted by Braum's (path dated August 2022) |
| Chipotle | [US nutrition facts paper menu](https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf) | March 2025 |
| Panera | [Nutrition guide](https://www.panerabread.com/content/dam/panerabread/documents/c8-26-nutrition-guide.pdf) | Effective 9/2/2026 |

McDonald's, Chick-fil-A, Wendy's, Taco Bell, Sonic, Subway, and Starbucks are not in the app. Their current U.S. menu numbers were not in a document that could be copied without guessing. Wendy's publishes a core-menu PDF that is a non-U.S. menu (salt in grams, different items), so those values were left out. Chick-fil-A's downloadable PDF found for this pass is the Little Blue Menu guide, not the standard chicken menu.

Home-plan exercises use original generated illustrations of one 52-year-old man. Each image shows the start and the finish, the equipment, a short form cue, and a movement arrow. Browsers load a WebP and fall back to JPEG. The pictures load only when a plan is opened, and the light studio background stays readable in dark mode. Where a YouTube demonstration was checked with YouTube's oEmbed API on 18 Nov 2026, the plan links to it. Some links are full routines that include the movement. Stretches and a few strength variations have an illustration only, because a matching video was not verified.

Brand search and barcodes still use the [Open Food Facts](https://world.openfoodfacts.org) public API. No API key is required. Browsers block a custom `User-Agent` header, so FitTrack identifies itself with `app_name`, `app_version`, and `app_url` on each request (`FitTrack/1.0`, https://markjenkinsoz.github.io/Fittrack/). Barcode scanning uses the iPhone `BarcodeDetector` when it exists, and a vendored [ZXing](https://github.com/zxing-js/library) build otherwise. If you are offline or nothing matches, type the food in by hand.

## Weight

Log weight in pounds to one decimal, with an optional note. A day holds one entry; logging that day again replaces it. The Weight tab charts the points and a 7-day moving average for 30 days, 90 days, 1 year, or all history. Set an optional goal weight in Settings to draw a goal line.

## Home plans

Workouts → Home plans is a static program for dumbbells, a bench, kettlebells, a yoga mat, and a recumbent bike. Levels 1–5 change sets, reps, rest, rounds, tempo, and bike work. Each session has a warm-up and a cool-down. Read the note on that screen before you start or before you make the work harder, including after surgery. “Start this workout” fills the logger with the exercises and target sets so you can record the weights you actually used.

## Run locally

From this folder:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open http://127.0.0.1:4173 in a browser. The app is plain HTML, CSS, and JavaScript — no build step.

To preview the GitHub Pages path (the site is not at the domain root):

```bash
python3 tools/serve_pages.py
```

Then open http://127.0.0.1:4173/Fittrack/ . Asset URLs, the manifest `start_url` and `scope`, and the service worker are relative to the app directory, so this subpath and a root server both work. The path is case-sensitive.

## GitHub Pages

The public site is https://markjenkinsoz.github.io/Fittrack/ (capital F). Publish with **Settings → Pages → Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**. `.nojekyll` is included so Pages serves the files as-is.

## Add it to an iPhone Home Screen

The app needs to be served over HTTPS on a real site before your iPhone can use it away from this computer. Once it is hosted:

1. Open the site in **Safari**.
2. Tap Share, then **Add to Home Screen**.
3. Open FitTrack from the new icon so it runs full-screen.

## Back up your data

Export a backup from Settings on a regular basis (weekly is a good habit) and keep the JSON file in the Files app or iCloud Drive.

iOS may clear Safari website data if storage is low or a site has not been opened in a long time. A Home Screen app is more persistent, but a backup is the only sure copy. Safari and the Home Screen icon can also keep **separate** data, so after you add the icon, use that icon going forward.

## Tests

```bash
npm install
npx playwright test
```

Tests use the system Chrome browser at an iPhone viewport, serve the app under `/Fittrack/` (the GitHub Pages path), and write screenshots to `screenshots/`.
