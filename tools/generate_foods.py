#!/usr/bin/env python3
"""Build sharded data/foods/*.json from USDA FoodData Central.

Public domain / CC0 sources (nutrients are per 100 g):

  SR Legacy, April 2018
    https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
  Foundation Foods, December 2025
    https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-12-18.zip
  FNDDS survey foods 2021-2023 (October 2024 release)
    https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip

The survey set is the prepared and mixed dishes people actually log (scrambled
eggs, sandwiches, pizza). Very long combination codes and infant foods are
left out. Names that collide across datasets keep the record with the clearer
source and the better household portions.

Usage:
  python3 tools/generate_foods.py
  python3 tools/generate_foods.py --sr zip --foundation zip --survey zip
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
OUT_DIR = ROOT / "data" / "foods"
CACHE = Path(__file__).resolve().parent / ".cache"

SR_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
FOUNDATION_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-12-18.zip"
SURVEY_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip"

KCAL_IDS = ("1008", "2047")
PROTEIN_ID = "1003"
SKIP_NAME = re.compile(
    r"human milk|baby\s*food|babyfood|infant formula|infant cereal|toddler formula",
    re.I,
)
CLEAN_NOTE = re.compile(
    r"\s*\(Includes foods for USDA's Food Distribution Program\)",
    re.I,
)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"Using cached {dest.name}")
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


def clean_name(name: str) -> str:
    name = CLEAN_NOTE.sub("", name or "")
    name = re.sub(r"\s+", " ", name).strip(" ,")
    return name


def name_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


def pretty_amount(amount: float) -> str:
    if abs(amount - 1) < 0.05:
        return "1"
    if abs(amount - 0.5) < 0.02:
        return "1/2"
    if abs(amount - 0.25) < 0.02:
        return "1/4"
    if abs(amount - round(amount)) < 0.02:
        return str(int(round(amount)))
    return str(round(amount, 2)).rstrip("0").rstrip(".")


def portion_label(amount: float, text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip(" ,")
    if not text or text.lower() in ("undetermined", "quantity not specified"):
        return ""
    if re.match(r"^\d", text) or text.lower().startswith("1/"):
        label = text
    else:
        label = f"{pretty_amount(amount)} {text}"
    label = re.sub(r"\s+", " ", label).strip()
    if "quantity not specified" in label.lower():
        return ""
    return label[:48]


def portion_rank(label: str, grams: float) -> float:
    m = label.lower()
    if grams < 5 or grams > 800:
        return -1
    score = 0.0
    if "medium" in m:
        score += 90
    if "large" in m and "extra large" not in m:
        score += 75
    if re.search(r"\begg\b", m):
        score += 60
    if re.search(r"\bslice\b", m):
        score += 55
    if re.search(r"\bcup\b", m):
        score += 50
    if "fl oz" in m:
        score += 48
    if re.search(r"\boz\b", m):
        score += 40
    if "tbsp" in m or "tablespoon" in m:
        score += 30
    if "piece" in m or "patty" in m or "breast" in m or "fillet" in m:
        score += 35
    if "small" in m:
        score += 20
    if "tsp" in m or "teaspoon" in m:
        score += 10
    if "chopped" in m or "diced" in m or "mashed" in m:
        score -= 15
    if "yield" in m or "not specified" in m:
        score -= 40
    score -= abs(grams - 100) / 40
    return score


def keep_portions(raw: list[tuple[str, float]]) -> list[list]:
    best: dict[str, tuple[float, float]] = {}
    for label, grams in raw:
        rank = portion_rank(label, grams)
        if rank < 0:
            continue
        prev = best.get(label)
        if prev is None or rank > prev[0]:
            best[label] = (rank, grams)
    ranked = sorted(best.items(), key=lambda item: item[1][0], reverse=True)[:5]
    return [[label, round(grams, 1) if abs(grams - round(grams)) > 0.05 else int(round(grams))] for label, (_rank, grams) in ranked]


def add_record(bucket: dict, name: str, kcal: float, protein: float, portions: list, priority: int) -> None:
    name = clean_name(name)
    if not name or SKIP_NAME.search(name) or kcal is None or protein is None:
        return
    if len(name) > 90:
        return
    key = name_key(name)
    if not key:
        return
    score = priority * 10 + min(len(portions), 5)
    row = [name, round(kcal, 1), round(max(protein, 0), 1), portions]
    current = bucket.get(key)
    if current is None or score > current[0] or (score == current[0] and len(name) < len(current[1][0])):
        bucket[key] = (score, row)


def load_measure_units(zf: zipfile.ZipFile) -> dict[str, str]:
    units = {}
    for row in read_csv(zf, "measure_unit.csv"):
        units[row["id"]] = row["name"]
    return units


def collect_csv_portions(zf: zipfile.ZipFile, allowed: set[str]) -> dict[str, list[tuple[str, float]]]:
    units = load_measure_units(zf)
    portions: dict[str, list[tuple[str, float]]] = {}
    for row in read_csv(zf, "food_portion.csv"):
        fid = row["fdc_id"]
        if fid not in allowed:
            continue
        try:
            grams = float(row.get("gram_weight") or 0)
            amount = float(row.get("amount") or 1)
        except ValueError:
            continue
        desc = row.get("portion_description") or ""
        modifier = row.get("modifier") or ""
        unit = units.get(row.get("measure_unit_id") or "", "")
        text = desc or modifier or unit
        label = portion_label(amount or 1, text)
        if label:
            portions.setdefault(fid, []).append((label, grams))
    return portions


def nutrients_for(zf: zipfile.ZipFile, allowed: set[str]) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {}
    for row in read_csv(zf, "food_nutrient.csv"):
        fid = row["fdc_id"]
        if fid not in allowed:
            continue
        nid = row["nutrient_id"]
        if nid not in KCAL_IDS and nid != PROTEIN_ID:
            continue
        try:
            amount = float(row["amount"])
        except (TypeError, ValueError):
            continue
        slot = out.setdefault(fid, {})
        if nid == PROTEIN_ID:
            slot["protein"] = amount
        elif nid == "1008":
            slot["kcal"] = amount
        elif "kcal" not in slot:
            slot["kcal"] = amount
    return out


def load_sr(path: Path, bucket: dict) -> int:
    kept = 0
    with zipfile.ZipFile(path) as zf:
        foods = {}
        for row in read_csv(zf, "food.csv"):
            if row.get("data_type") not in (None, "", "sr_legacy_food"):
                continue
            foods[row["fdc_id"]] = row.get("description") or ""
        portions = collect_csv_portions(zf, set(foods))
        nutrients = nutrients_for(zf, set(foods))
        for fid, desc in foods.items():
            nut = nutrients.get(fid) or {}
            if "kcal" not in nut or "protein" not in nut:
                continue
            before = len(bucket)
            add_record(bucket, desc, nut["kcal"], nut["protein"], keep_portions(portions.get(fid, [])), 1)
            kept += len(bucket) - before
    return kept


def load_foundation(path: Path, bucket: dict) -> int:
    kept = 0
    with zipfile.ZipFile(path) as zf:
        foods = {}
        for row in read_csv(zf, "food.csv"):
            if row.get("data_type") != "foundation_food":
                continue
            foods[row["fdc_id"]] = row.get("description") or ""
        portions = collect_csv_portions(zf, set(foods))
        nutrients = nutrients_for(zf, set(foods))
        for fid, desc in foods.items():
            nut = nutrients.get(fid) or {}
            if "kcal" not in nut or "protein" not in nut:
                continue
            before = len(bucket)
            add_record(bucket, desc, nut["kcal"], nut["protein"], keep_portions(portions.get(fid, [])), 2)
            kept += len(bucket) - before
    return kept


def keep_survey(desc: str) -> bool:
    if not desc or SKIP_NAME.search(desc):
        return False
    if "NS as to fat type" in desc:
        return False
    if len(desc) > 80 and "restaurant" not in desc.lower() and "fast food" not in desc.lower():
        return False
    if len(desc) > 100:
        return False
    return True


def load_survey(path: Path, bucket: dict) -> int:
    kept = 0
    with zipfile.ZipFile(path) as zf:
        name = member(zf, "surveyDownload.json")
        with zf.open(name) as raw:
            data = json.load(io.TextIOWrapper(raw, encoding="utf-8"))
    for food in data.get("SurveyFoods") or []:
        desc = food.get("description") or ""
        if not keep_survey(desc):
            continue
        kcal = None
        protein = None
        for nutrient in food.get("foodNutrients") or []:
            meta = nutrient.get("nutrient") or {}
            nid = str(meta.get("id") or "")
            if nid == "1008":
                kcal = nutrient.get("amount")
            elif nid == "1003":
                protein = nutrient.get("amount")
        if kcal is None or protein is None:
            continue
        raw_portions = []
        for portion in food.get("foodPortions") or []:
            label = portion_label(1, portion.get("portionDescription") or "")
            try:
                grams = float(portion.get("gramWeight") or 0)
            except (TypeError, ValueError):
                continue
            if label:
                raw_portions.append((label, grams))
        before = len(bucket)
        add_record(bucket, desc, float(kcal), float(protein), keep_portions(raw_portions), 3)
        kept += len(bucket) - before
    return kept


def shard_rows(rows: list) -> dict[str, list]:
    shards: dict[str, list] = {}
    for row in rows:
        letter = row[0][0].lower()
        if not letter.isalpha():
            letter = "0"
        shards.setdefault(letter, []).append(row)
    for letter in shards:
        shards[letter].sort(key=lambda item: item[0].casefold())
    return shards


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sr", type=Path, default=CACHE / "FoodData_Central_sr_legacy_food_csv_2018-04.zip")
    parser.add_argument("--foundation", type=Path, default=CACHE / "FoodData_Central_foundation_food_csv_2025-12-18.zip")
    parser.add_argument("--survey", type=Path, default=CACHE / "FoodData_Central_survey_food_json_2024-10-31.zip")
    parser.add_argument("--out", type=Path, default=OUT_DIR)
    args = parser.parse_args()
    download(SR_URL, args.sr)
    download(FOUNDATION_URL, args.foundation)
    download(SURVEY_URL, args.survey)

    bucket: dict = {}
    print("SR Legacy new rows", load_sr(args.sr, bucket))
    print("Foundation new rows", load_foundation(args.foundation, bucket))
    print("FNDDS new rows", load_survey(args.survey, bucket))
    rows = [item[1] for item in bucket.values()]
    rows.sort(key=lambda item: item[0].casefold())
    shards = shard_rows(rows)
    if args.out.exists():
        for old in args.out.glob("*.json"):
            old.unlink()
    args.out.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    for letter, foods in shards.items():
        text = json.dumps({"f": foods}, separators=(",", ":"), ensure_ascii=False)
        (args.out / f"{letter}.json").write_text(text, encoding="utf-8")
        total_bytes += len(text.encode("utf-8"))
    index = {
        "source": "USDA FoodData Central: SR Legacy (Apr 2018), Foundation Foods (Dec 2025), FNDDS 2021-2023. Public domain.",
        "per": "kcal100 and protein100 are per 100 g. Portions are [label, grams].",
        "fields": ["name", "kcal100", "protein100", "portions"],
        "shards": sorted(shards),
        "count": len(rows),
    }
    index_text = json.dumps(index, separators=(",", ":"), ensure_ascii=False)
    (args.out / "index.json").write_text(index_text, encoding="utf-8")
    total_bytes += len(index_text.encode("utf-8"))
    print(f"Wrote {len(rows)} foods in {len(shards)} shards, {total_bytes} bytes -> {args.out}")

    def show(fragment: str) -> None:
        hits = [row for row in rows if fragment.lower() in row[0].lower()][:6]
        for row in hits:
            print(" ", row[0], "per100", row[1], row[2], "portions", row[3][:3])

    print("Eggs:")
    show("scrambled")
    show("white only, raw")
    show("Bananas, raw")
    if len(rows) < 8000:
        raise SystemExit(f"Expected a much larger list than SR Legacy alone, got {len(rows)}")
    if total_bytes > 3 * 1024 * 1024:
        raise SystemExit("Food shards are over 3 MB")
    scrambled = next((row for row in rows if row[0] == "Egg omelet or scrambled egg, no added fat"), None)
    whites = next((row for row in rows if row[0] == "Egg, white only, raw"), None)
    if not scrambled or not any("egg" in p[0].lower() for p in scrambled[3]):
        raise SystemExit("Missing scrambled egg with an egg portion")
    if not whites or abs(whites[1] - 52) > 1:
        raise SystemExit("Egg white per-100g calories look wrong")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
