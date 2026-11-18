#!/usr/bin/env python3
"""Build data/foods.json from USDA FoodData Central SR Legacy.

Source (public domain / CC0):
  U.S. Department of Agriculture, Agricultural Research Service.
  FoodData Central: SR Legacy, April 2018.
  https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip

Nutrient amounts in that release are per 100 g. This script picks one household
serving when the portion file has one, otherwise 100 g, and writes calories and
protein for that serving. Baby foods and infant formula are left out so the
file stays a compact list of common foods.

Usage:
  python3 tools/generate_foods.py
  python3 tools/generate_foods.py --zip /path/to/FoodData_Central_sr_legacy_food_csv_2018-04.zip
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "foods.json"
CACHE = Path(__file__).resolve().parent / ".cache"
DEFAULT_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
ZIP_NAME = "FoodData_Central_sr_legacy_food_csv_2018-04.zip"

KCAL_ID = "1008"
KCAL_FALLBACK_ID = "2047"
PROTEIN_ID = "1003"
SKIP_NAME = re.compile(r"^(babyfood|infant formula|human milk)\b", re.I)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"Using cached {dest}")
        return
    print(f"Downloading {url}")
    urllib.request.urlretrieve(url, dest)


def member(zf: zipfile.ZipFile, name: str) -> str:
    matches = [n for n in zf.namelist() if n.rsplit("/", 1)[-1] == name]
    if not matches:
        raise SystemExit(f"Missing {name} in zip")
    return matches[0]


def read_csv(zf: zipfile.ZipFile, name: str):
    with zf.open(member(zf, name)) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8", newline="")
        yield from csv.DictReader(text)


def portion_score(amount: float, modifier: str, grams: float) -> float | None:
    if grams < 8 or grams > 500:
        return None
    m = modifier.lower()
    score = 0.0
    if "medium" in m:
        score += 120
    if re.search(r"\b3 oz\b", m):
        score += 95
    if re.search(r"\boz\b", m):
        score += 70
    if "nlea" in m:
        score += 68
    if "breast" in m:
        score += 80
    if re.search(r"\bslice\b", m):
        score += 60
    if "piece" in m or "patty" in m:
        score += 55
    if "fillet" in m or "steak" in m or re.search(r"\bchop\b", m):
        score += 50
    if "cup" in m:
        score += 40
    if "tbsp" in m or "tablespoon" in m:
        score += 28
    if "tsp" in m or "teaspoon" in m:
        score += 8
    if "yield from" in m:
        score -= 45
    if "chopped" in m or "diced" in m or "mashed" in m or "sliced" in m:
        score -= 20
    if "extra small" in m or "extra large" in m:
        score -= 8
    if grams < 40 and not any(word in m for word in ("medium", "tbsp", "tablespoon", "tsp", "teaspoon", "egg")):
        score -= 40
    score -= abs(grams - 110) / 25
    if abs(amount - 1) > 0.05:
        score -= 6
    return score


def serving_label(amount: float, modifier: str) -> str:
    mod = re.sub(r"\s+", " ", modifier).strip()
    if abs(amount - 1) < 0.05:
        label = mod
    else:
        amt = int(amount) if abs(amount - round(amount)) < 1e-6 else round(amount, 2)
        label = f"{amt} {mod}"
    return label[:80]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", type=Path, default=CACHE / ZIP_NAME)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    download(args.url, args.zip)

    foods: dict[str, str] = {}
    portions: dict[str, list[tuple[float, str, float, float]]] = {}
    nutrients: dict[str, dict[str, float]] = {}

    with zipfile.ZipFile(args.zip) as zf:
        for row in read_csv(zf, "food.csv"):
            if row.get("data_type") not in (None, "", "sr_legacy_food"):
                continue
            desc = re.sub(r"\s+", " ", row.get("description") or "").strip()
            if not desc or SKIP_NAME.search(desc):
                continue
            foods[row["fdc_id"]] = desc

        for row in read_csv(zf, "food_portion.csv"):
            fid = row["fdc_id"]
            if fid not in foods:
                continue
            try:
                grams = float(row["gram_weight"] or 0)
                amount = float(row["amount"] or 1)
            except ValueError:
                continue
            modifier = row.get("modifier") or row.get("portion_description") or ""
            scored = portion_score(amount, modifier, grams)
            if scored is None:
                continue
            portions.setdefault(fid, []).append((scored, modifier, grams, amount))

        for row in read_csv(zf, "food_nutrient.csv"):
            fid = row["fdc_id"]
            if fid not in foods:
                continue
            nid = row["nutrient_id"]
            if nid not in (KCAL_ID, KCAL_FALLBACK_ID, PROTEIN_ID):
                continue
            try:
                amount = float(row["amount"])
            except (TypeError, ValueError):
                continue
            slot = nutrients.setdefault(fid, {})
            if nid == PROTEIN_ID:
                slot["protein"] = amount
            elif nid == KCAL_ID:
                slot["kcal"] = amount
            elif "kcal" not in slot:
                slot["kcal_fallback"] = amount

    rows = []
    for fid, name in foods.items():
        nut = nutrients.get(fid) or {}
        kcal_100 = nut.get("kcal", nut.get("kcal_fallback"))
        protein_100 = nut.get("protein")
        if kcal_100 is None or protein_100 is None:
            continue
        chosen = portions.get(fid) or []
        if chosen:
            chosen.sort(key=lambda item: item[0], reverse=True)
            _score, modifier, grams, amount = chosen[0]
            label = serving_label(amount, modifier)
        else:
            grams = 100.0
            label = "100 g"
        factor = grams / 100.0
        calories = int(round(kcal_100 * factor))
        protein = round(protein_100 * factor, 1)
        grams_out = int(round(grams)) if abs(grams - round(grams)) < 0.05 else round(grams, 1)
        rows.append([name, label, grams_out, max(calories, 0), max(protein, 0)])

    rows.sort(key=lambda item: item[0].casefold())
    # Identical names: keep the first household serving we already sorted alphabetically
    # and prefer the earlier row only. Duplicates are rare; drop later exact name matches.
    deduped = []
    seen = set()
    for row in rows:
        key = row[0].casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)

    payload = {
        "source": "USDA FoodData Central SR Legacy (April 2018), public domain",
        "url": DEFAULT_URL,
        "per": "Values are calories and protein grams for one serving.",
        "fields": ["name", "serving", "grams", "calories", "protein"],
        "f": deduped,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    args.out.write_text(text, encoding="utf-8")

    banana = next((row for row in deduped if row[0] == "Bananas, raw"), None)
    print(f"Wrote {len(deduped)} foods, {len(text)} bytes -> {args.out}")
    if banana:
        print(f"Check Bananas, raw -> serving {banana[1]!r}, {banana[2]} g, {banana[3]} kcal, {banana[4]} g protein")
    if banana is None or not (70 <= banana[3] <= 160):
        raise SystemExit("Banana calorie check failed; nutrient scaling looks wrong.")
    if len(deduped) < 2000:
        raise SystemExit(f"Expected a few thousand foods, got {len(deduped)}")
    if len(text.encode("utf-8")) > 2 * 1024 * 1024:
        raise SystemExit("foods.json is over 2 MB")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
