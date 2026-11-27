/* FitTrack service worker — network first, cache fallback for offline use.
   Asset URLs are relative to this script (the app directory), not the domain root,
   so the same list works at /Fittrack/ on GitHub Pages. */
const CACHE = "fittrack-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./data/foods/index.json",
  "./data/foods/common.json",
  "./data/nutrition.json",
  "./data/restaurants.json",
  "./data/exercise-demos.json",
  "./data/plans.json",
  "./vendor/zxing.min.js",
  "./images/exercises/air-squat-1.jpg",
  "./images/exercises/air-squat-1.webp",
  "./images/exercises/air-squat-2.jpg",
  "./images/exercises/air-squat-2.webp",
  "./images/exercises/air-squat-3.jpg",
  "./images/exercises/air-squat-3.webp",
  "./images/exercises/ankle-1.jpg",
  "./images/exercises/ankle-1.webp",
  "./images/exercises/ankle-2.jpg",
  "./images/exercises/ankle-2.webp",
  "./images/exercises/bench-1.jpg",
  "./images/exercises/bench-1.webp",
  "./images/exercises/bench-2.jpg",
  "./images/exercises/bench-2.webp",
  "./images/exercises/bike-1.jpg",
  "./images/exercises/bike-1.webp",
  "./images/exercises/bike-2.jpg",
  "./images/exercises/bike-2.webp",
  "./images/exercises/bird-dog-1.jpg",
  "./images/exercises/bird-dog-1.webp",
  "./images/exercises/bird-dog-2.jpg",
  "./images/exercises/bird-dog-2.webp",
  "./images/exercises/bird-dog-3.jpg",
  "./images/exercises/bird-dog-3.webp",
  "./images/exercises/breathe-1.jpg",
  "./images/exercises/breathe-1.webp",
  "./images/exercises/breathe-2.jpg",
  "./images/exercises/breathe-2.webp",
  "./images/exercises/bridge-1.jpg",
  "./images/exercises/bridge-1.webp",
  "./images/exercises/bridge-2.jpg",
  "./images/exercises/bridge-2.webp",
  "./images/exercises/carry-1.jpg",
  "./images/exercises/carry-1.webp",
  "./images/exercises/carry-2.jpg",
  "./images/exercises/carry-2.webp",
  "./images/exercises/carry-3.jpg",
  "./images/exercises/carry-3.webp",
  "./images/exercises/cat-cow-1.jpg",
  "./images/exercises/cat-cow-1.webp",
  "./images/exercises/cat-cow-2.jpg",
  "./images/exercises/cat-cow-2.webp",
  "./images/exercises/cat-cow-3.jpg",
  "./images/exercises/cat-cow-3.webp",
  "./images/exercises/clam-1.jpg",
  "./images/exercises/clam-1.webp",
  "./images/exercises/clam-2.jpg",
  "./images/exercises/clam-2.webp",
  "./images/exercises/curl-1.jpg",
  "./images/exercises/curl-1.webp",
  "./images/exercises/curl-2.jpg",
  "./images/exercises/curl-2.webp",
  "./images/exercises/db-bridge-1.jpg",
  "./images/exercises/db-bridge-1.webp",
  "./images/exercises/db-bridge-2.jpg",
  "./images/exercises/db-bridge-2.webp",
  "./images/exercises/dead-bug-1.jpg",
  "./images/exercises/dead-bug-1.webp",
  "./images/exercises/dead-bug-2.jpg",
  "./images/exercises/dead-bug-2.webp",
  "./images/exercises/dead-bug-3.jpg",
  "./images/exercises/dead-bug-3.webp",
  "./images/exercises/figure4-1.jpg",
  "./images/exercises/figure4-1.webp",
  "./images/exercises/figure4-2.jpg",
  "./images/exercises/figure4-2.webp",
  "./images/exercises/floor-press-1.jpg",
  "./images/exercises/floor-press-1.webp",
  "./images/exercises/floor-press-2.jpg",
  "./images/exercises/floor-press-2.webp",
  "./images/exercises/half-kneel-press-1.jpg",
  "./images/exercises/half-kneel-press-1.webp",
  "./images/exercises/half-kneel-press-2.jpg",
  "./images/exercises/half-kneel-press-2.webp",
  "./images/exercises/halo-1.jpg",
  "./images/exercises/halo-1.webp",
  "./images/exercises/halo-2.jpg",
  "./images/exercises/halo-2.webp",
  "./images/exercises/halo-3.jpg",
  "./images/exercises/halo-3.webp",
  "./images/exercises/hamstring-1.jpg",
  "./images/exercises/hamstring-1.webp",
  "./images/exercises/hamstring-2.jpg",
  "./images/exercises/hamstring-2.webp",
  "./images/exercises/heel-slide-1.jpg",
  "./images/exercises/heel-slide-1.webp",
  "./images/exercises/heel-slide-2.jpg",
  "./images/exercises/heel-slide-2.webp",
  "./images/exercises/hinge-1.jpg",
  "./images/exercises/hinge-1.webp",
  "./images/exercises/hinge-2.jpg",
  "./images/exercises/hinge-2.webp",
  "./images/exercises/hinge-3.jpg",
  "./images/exercises/hinge-3.webp",
  "./images/exercises/hip-flexor-1.jpg",
  "./images/exercises/hip-flexor-1.webp",
  "./images/exercises/hip-flexor-2.jpg",
  "./images/exercises/hip-flexor-2.webp",
  "./images/exercises/kb-deadlift-1.jpg",
  "./images/exercises/kb-deadlift-1.webp",
  "./images/exercises/kb-deadlift-2.jpg",
  "./images/exercises/kb-deadlift-2.webp",
  "./images/exercises/kb-deadlift-3.jpg",
  "./images/exercises/kb-deadlift-3.webp",
  "./images/exercises/knee-rock-1.jpg",
  "./images/exercises/knee-rock-1.webp",
  "./images/exercises/knee-rock-2.jpg",
  "./images/exercises/knee-rock-2.webp",
  "./images/exercises/open-book-1.jpg",
  "./images/exercises/open-book-1.webp",
  "./images/exercises/open-book-2.jpg",
  "./images/exercises/open-book-2.webp",
  "./images/exercises/open-book-3.jpg",
  "./images/exercises/open-book-3.webp",
  "./images/exercises/press-1.jpg",
  "./images/exercises/press-1.webp",
  "./images/exercises/press-2.jpg",
  "./images/exercises/press-2.webp",
  "./images/exercises/pushup-1.jpg",
  "./images/exercises/pushup-1.webp",
  "./images/exercises/pushup-2.jpg",
  "./images/exercises/pushup-2.webp",
  "./images/exercises/rfess-1.jpg",
  "./images/exercises/rfess-1.webp",
  "./images/exercises/rfess-2.jpg",
  "./images/exercises/rfess-2.webp",
  "./images/exercises/rfess-3.jpg",
  "./images/exercises/rfess-3.webp",
  "./images/exercises/row-1.jpg",
  "./images/exercises/row-1.webp",
  "./images/exercises/row-2.jpg",
  "./images/exercises/row-2.webp",
  "./images/exercises/side-lie-1.jpg",
  "./images/exercises/side-lie-1.webp",
  "./images/exercises/side-lie-2.jpg",
  "./images/exercises/side-lie-2.webp",
  "./images/exercises/split-1.jpg",
  "./images/exercises/split-1.webp",
  "./images/exercises/split-2.jpg",
  "./images/exercises/split-2.webp",
  "./images/exercises/split-3.jpg",
  "./images/exercises/split-3.webp",
  "./images/exercises/squat-1.jpg",
  "./images/exercises/squat-1.webp",
  "./images/exercises/squat-2.jpg",
  "./images/exercises/squat-2.webp",
  "./images/exercises/squat-3.jpg",
  "./images/exercises/squat-3.webp",
  "./images/exercises/suitcase-1.jpg",
  "./images/exercises/suitcase-1.webp",
  "./images/exercises/suitcase-2.jpg",
  "./images/exercises/suitcase-2.webp",
  "./images/exercises/suitcase-3.jpg",
  "./images/exercises/suitcase-3.webp",
  "./images/exercises/thoracic-1.jpg",
  "./images/exercises/thoracic-1.webp",
  "./images/exercises/thoracic-2.jpg",
  "./images/exercises/thoracic-2.webp",
  "./images/exercises/thoracic-3.jpg",
  "./images/exercises/thoracic-3.webp",
  "./images/exercises/kb-swing-1.jpg",
  "./images/exercises/kb-swing-1.webp",
  "./images/exercises/kb-swing-2.jpg",
  "./images/exercises/kb-swing-2.webp",
  "./images/exercises/kb-swing-3.jpg",
  "./images/exercises/kb-swing-3.webp",
  "./images/exercises/kb-swing-4.jpg",
  "./images/exercises/kb-swing-4.webp",
  "./images/exercises/step-up-1.jpg",
  "./images/exercises/step-up-1.webp",
  "./images/exercises/step-up-2.jpg",
  "./images/exercises/step-up-2.webp",
  "./images/exercises/step-up-3.jpg",
  "./images/exercises/step-up-3.webp",
  "./images/exercises/db-raise-1.jpg",
  "./images/exercises/db-raise-1.webp",
  "./images/exercises/db-raise-2.jpg",
  "./images/exercises/db-raise-2.webp",
  "./images/exercises/db-raise-3.jpg",
  "./images/exercises/db-raise-3.webp",
  "./images/exercises/sa-press-1.jpg",
  "./images/exercises/sa-press-1.webp",
  "./images/exercises/sa-press-2.jpg",
  "./images/exercises/sa-press-2.webp",
  "./images/exercises/sa-press-3.jpg",
  "./images/exercises/sa-press-3.webp",
];

const SHELL = ASSETS.filter((url) => !url.includes("/images/"));
const PHOTOS = ASSETS.filter((url) => url.includes("/images/"));

function wantsFreshBytes(url, request) {
  if (request.mode === "navigate") return true;
  return /\.(?:html|js|css|json)$/i.test(url.pathname);
}

function dropOldCaches() {
  return caches
    .keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))));
}

let sweptOldCaches = false;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(SHELL).then(() =>
          Promise.all(PHOTOS.map((url) => cache.add(url).catch(() => undefined)))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(dropOldCaches().then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || !sweptOldCaches) {
    sweptOldCaches = true;
    event.waitUntil(dropOldCaches());
  }

  const fresh = wantsFreshBytes(url, request);
  const pulled = fresh
    ? fetch(request, { cache: "no-store" }).catch(() => fetch(request))
    : fetch(request);
  event.respondWith(
    pulled
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return caches.match(request, { ignoreSearch: true }).then((loose) => loose || caches.match("./index.html"));
        })
      )
  );
});
