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

Common foods ship in `data/foods.json` and load when you search, not on first paint. They are derived from [USDA FoodData Central SR Legacy](https://fdc.nal.usda.gov/) (April 2018), which is public domain. Each row is a name, a serving, grams, calories, and protein. Regenerate it with:

```bash
python3 tools/generate_foods.py
```

Brand search and barcodes use the [Open Food Facts](https://world.openfoodfacts.org) public API. No API key is required. Browsers block a custom `User-Agent` header, so FitTrack identifies itself with `app_name`, `app_version`, and `app_url` on each request (`FitTrack/1.0`, https://markjenkinsoz.github.io/Fittrack/). Barcode scanning uses the iPhone `BarcodeDetector` when it exists, and a vendored [ZXing](https://github.com/zxing-js/library) build otherwise. If you are offline or nothing matches, type the food in by hand.

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
