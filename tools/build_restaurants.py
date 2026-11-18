#!/usr/bin/env python3
"""Build data/restaurants.json from official restaurant nutrition PDFs.

Numbers are copied from the PDFs. A row is skipped when calories or protein
cannot be read. Do not hand-edit the item values; re-download the PDFs and
rerun this script.

  Culver's Nutrition & Allergen Guide (© 2025)
    https://cdn.culvers.com/menu/docs/guide-nutrition-allergen.pdf
  Braum's "2018 Nutritional Chart" PDF hosted by Braum's
    https://www.braums.com/wp-content/uploads/2022/08/2018-Nutritional-Chart-for-web.pdf
  Chipotle US nutrition facts paper menu (March 2025 file)
    https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf
  Panera Bread nutrition guide, effective 9/2/2026
    https://www.panerabread.com/content/dam/panerabread/documents/c8-26-nutrition-guide.pdf
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "restaurants.json"
PDF_DIR = Path("/tmp/menus")

NUM = re.compile(r"^(?:<\s*1|\d+(?:\.\d+)?)$")


def tokens_of(line: str) -> list[str]:
    return re.sub(r"\s+", " ", line).strip().split(" ")


def is_num(token: str) -> bool:
    return bool(NUM.match(token.replace(" ", ""))) or token.replace(" ", "") in {"<1", "< 1"}


def as_float(token: str) -> float | None:
    token = token.replace(" ", "")
    if token in {"<1", "<"}:
        return None
    try:
        return float(token)
    except ValueError:
        return None


def split_numeric_tail(line: str, count: int) -> tuple[str, list[float]] | None:
    parts = tokens_of(line)
    if len(parts) <= count:
        return None
    # Join a split "< 1" token.
    joined: list[str] = []
    i = 0
    while i < len(parts):
        if parts[i] == "<" and i + 1 < len(parts) and parts[i + 1] == "1":
            joined.append("<1")
            i += 2
        else:
            joined.append(parts[i])
            i += 1
    tail = joined[-count:]
    if not all(is_num(token) for token in tail):
        return None
    values = []
    for token in tail:
        number = as_float(token)
        if number is None:
            return None
        values.append(number)
    name = " ".join(joined[:-count]).strip(" -")
    if len(name) < 3 or name.isupper() and " " not in name:
        return None
    return name, values


def add_item(items: list, seen: set, name: str, serving: str, calories: float, protein: float) -> None:
    name = re.sub(r"\s+", " ", name).replace("®", "").replace("*", "").strip(" -")
    if not re.match(r"[A-Za-z]", name) or len(name) < 3 or name.lower() in {"about", "with"}:
        return
    if not name or calories < 0 or protein < 0 or calories > 4000 or protein > 200:
        return
    key = name.lower()
    if key in seen:
        return
    seen.add(key)
    items.append(
        {
            "name": name,
            "serving": serving,
            "calories": int(round(calories)),
            "protein": int(protein) if abs(protein - round(protein)) < 0.05 else round(protein, 1),
        }
    )


def parse_culvers() -> list[dict]:
    reader = PdfReader(str(PDF_DIR / "culvers.pdf"))
    items: list[dict] = []
    seen: set[str] = set()
    for page in reader.pages[2:7]:
        for raw in (page.extract_text() or "").splitlines():
            parsed = split_numeric_tail(raw, 10)
            if not parsed:
                continue
            name, values = parsed
            # calories, fat, sat, trans, chol, sodium, carb, fiber, sugar, protein
            add_item(items, seen, name, "1 serving", values[0], values[9])
    return items


def parse_braums() -> list[dict]:
    reader = PdfReader(str(PDF_DIR / "braums.pdf"))
    items: list[dict] = []
    seen: set[str] = set()
    for page in reader.pages:
        for raw in (page.extract_text() or "").splitlines():
            parsed = split_numeric_tail(raw, 12)
            if not parsed:
                continue
            name, values = parsed
            grams, calories, protein = values[0], values[1], values[11]
            if grams <= 0:
                continue
            serving = f"1 serving ({int(round(grams))} g)"
            add_item(items, seen, name, serving, calories, protein)
    return items


def parse_chipotle() -> list[dict]:
    reader = PdfReader(str(PDF_DIR / "chipotle.pdf"))
    items: list[dict] = []
    seen: set[str] = set()
    portion = re.compile(r"^(?P<name>.+?)\s+(?P<amount>\d+(?:\.\d+)?)\s+(?P<unit>fl oz|oz|ea)\s+(?P<rest>.+)$", re.I)
    for page in reader.pages[1:]:
        for raw in (page.extract_text() or "").splitlines():
            match = portion.match(re.sub(r"\s+", " ", raw).strip())
            if not match:
                continue
            parsed = split_numeric_tail("Item " + match.group("rest"), 11)
            if not parsed:
                continue
            _unused, values = parsed
            serving = f"{match.group('amount')} {match.group('unit')}"
            add_item(items, seen, match.group("name"), serving, values[0], values[10])
    return items


def parse_panera() -> list[dict]:
    reader = PdfReader(str(PDF_DIR / "panera.pdf"))
    items: list[dict] = []
    seen: set[str] = set()
    for page in reader.pages:
        for raw in (page.extract_text() or "").splitlines():
            line = re.sub(r"\s+", " ", raw).strip()
            if not line or line.endswith("N/A") is False and not re.search(r"\d", line):
                continue
            parts = line.split(" ")
            if parts[-1] == "N/A":
                numeric = parts[-12:-1]
                prefix = parts[:-12]
            elif is_num(parts[-1]):
                numeric = parts[-12:]
                prefix = parts[:-12]
            else:
                continue
            if len(numeric) != 11 or not all(is_num(token) for token in numeric):
                continue
            values = []
            ok = True
            for token in numeric:
                number = as_float(token)
                if number is None:
                    ok = False
                    break
                values.append(number)
            if not ok or len(prefix) < 2:
                continue
            # Serving is the short count + unit at the end of the prefix when present.
            serving = "1 serving"
            name = " ".join(prefix)
            if len(prefix) >= 2 and prefix[-2][:1].isdigit():
                serving = prefix[-2] + " " + prefix[-1]
                name = " ".join(prefix[:-2])
            add_item(items, seen, name, serving, values[0], values[10])
    return items


def main() -> None:
    restaurants = [
        {
            "id": "culvers",
            "name": "Culver's",
            "source": "https://cdn.culvers.com/menu/docs/guide-nutrition-allergen.pdf",
            "asOf": "2025",
            "note": "Nutrition & Allergen Guide, copyright 2025 Culver Franchising System, LLC. Protein is the last nutrition column.",
            "items": parse_culvers(),
        },
        {
            "id": "braums",
            "name": "Braum's",
            "source": "https://www.braums.com/wp-content/uploads/2022/08/2018-Nutritional-Chart-for-web.pdf",
            "asOf": "2018 chart, file hosted by Braum's (path dated 2022-08)",
            "note": "Official Braum's nutritional chart. Calories are the second number and protein is the last. A few current menu pages still show the same calories and protein for the quarter-pound and double quarter-pound cheeseburgers.",
            "items": parse_braums(),
        },
        {
            "id": "chipotle",
            "name": "Chipotle",
            "source": "https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf",
            "asOf": "2025-03",
            "note": "US nutrition facts paper menu. Values are for the stated portion of each ingredient, not a built burrito.",
            "items": parse_chipotle(),
        },
        {
            "id": "panera",
            "name": "Panera",
            "source": "https://www.panerabread.com/content/dam/panerabread/documents/c8-26-nutrition-guide.pdf",
            "asOf": "2026-09-02",
            "note": "Panera Bread nutrition guide, effective 9/2/2026, edition 1. Protein is the column before caffeine.",
            "items": parse_panera(),
        },
    ]
    for restaurant in restaurants:
        print(f"{restaurant['name']}: {len(restaurant['items'])} items")
        for item in restaurant["items"][:3]:
            print(" ", item)
    payload = {"restaurants": restaurants}
    OUT.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print("bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()
