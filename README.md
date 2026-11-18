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

Common foods load when you search, not on first paint. They are sharded under `data/foods/` and derived from public-domain [USDA FoodData Central](https://fdc.nal.usda.gov/) releases: SR Legacy (April 2018), Foundation Foods (December 2025), and a broad set of FNDDS survey foods for 2021–2023 (prepared dishes such as scrambled eggs). Each food stores calories and protein per 100 g plus household portions (1 egg, 1 cup, 1 slice) when USDA published them. Regenerate it with:

```bash
python3 tools/generate_foods.py
```

After you pick a food you can measure it in that household portion, grams, ounces, or cups and fluid ounces when a volume portion exists. The last amount and unit are remembered for that food. Several foods can be added to one named meal, with each line and the combined calories and protein, and saved as a favorite for one tap later.

Restaurant menus that could be copied from an official nutrition PDF are included and tagged with the restaurant name. You can filter the search to one restaurant and add an item by serving count, including inside a meal. Sources and dates are in `data/restaurants.json`.

| Restaurant | Source | Date |
| --- | --- | --- |
| Culver's | [Nutrition & Allergen Guide](https://cdn.culvers.com/menu/docs/guide-nutrition-allergen.pdf) | 2025 |
| Braum's | [Nutritional chart PDF](https://www.braums.com/wp-content/uploads/2022/08/2018-Nutritional-Chart-for-web.pdf) | 2018 chart, hosted by Braum's (path dated August 2022) |
| Chipotle | [US nutrition facts paper menu](https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf) | March 2025 |
| Panera | [Nutrition guide](https://www.panerabread.com/content/dam/panerabread/documents/c8-26-nutrition-guide.pdf) | Effective 9/2/2026 |

McDonald's, Chick-fil-A, Wendy's, Taco Bell, Sonic, Subway, and Starbucks are not in the app. Their current U.S. menu numbers were not in a document that could be copied without guessing. Wendy's publishes a core-menu PDF that is a non-U.S. menu (salt in grams, different items), so those values were left out. Chick-fil-A's downloadable PDF found for this pass is the Little Blue Menu guide, not the standard chicken menu.

Home-plan exercises use original FitTrack line drawings. Where a YouTube demonstration was checked with YouTube's oEmbed API on 18 Nov 2026, the plan links to it. Some links are full routines that include the movement. Stretches and a few strength variations have a drawing only, because a matching video was not verified.

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
