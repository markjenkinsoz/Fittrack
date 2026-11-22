#!/usr/bin/env python3
"""Attach USDA nutrient detail and add everyday foods.

Existing search rows (name, calories, protein, portions) stay as they are.
New everyday foods go in data/foods/common.json. Per-100 g nutrients for both
the existing names and the new names go in data/nutrition.json.

Numbers are copied from public-domain USDA FoodData Central releases already
used by tools/generate_foods.py:

  SR Legacy, April 2018
  Foundation Foods, December 18, 2025

A nutrient that is not in the chosen record is stored as null. Nothing here
is estimated. Run after generate_foods.py:

  python3 tools/build_nutrition.py
"""

from __future__ import annotations

import importlib.util
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
SR_ZIP = CACHE / "sr.zip"
FD_ZIP = CACHE / "foundation.zip"

gen_spec = importlib.util.spec_from_file_location(
    "generate_foods", Path(__file__).with_name("generate_foods.py")
)
gen = importlib.util.module_from_spec(gen_spec)
gen_spec.loader.exec_module(gen)

# id in nutrient.csv -> field. Vitamin D IU is converted to micrograms only
# when the microgram value was not published (1 mcg = 40 IU).
FIELDS = {
    "1008": "kcal",
    "2047": "kcal_alt",
    "2048": "kcal_alt2",
    "1003": "pro",
    "1004": "fat",
    "1258": "sat",
    "1257": "trans",
    "1005": "carb",
    "1079": "fiber",
    "2000": "sugar",
    "1063": "sugar_alt",
    "1235": "added",
    "1093": "na",
    "1253": "chol",
    "1092": "k",
    "1087": "ca",
    "1089": "fe",
    "1114": "vd",
    "1110": "vd_iu",
}

NUTRIENT_KEYS = [
    "fat",
    "sat",
    "trans",
    "carb",
    "fiber",
    "sugar",
    "added",
    "na",
    "chol",
    "k",
    "ca",
    "fe",
    "vd",
]


def clean(name: str) -> str:
    return gen.clean_name(name)


def round_num(value: float) -> float:
    return round(float(value), 3)


def load_zip(path: Path, src: str, data_type: str | None) -> list[dict]:
    records = []
    with zipfile.ZipFile(path) as zf:
        food_name = gen.member(zf, "food.csv")
        foods = {}
        categories = {}
        for row in gen.read_csv(zf, "food.csv"):
            if data_type and row.get("data_type") != data_type:
                continue
            foods[row["fdc_id"]] = row.get("description") or ""
            categories[row["fdc_id"]] = row.get("food_category_id") or ""
        nutrients: dict[str, dict] = {}
        for row in gen.read_csv(zf, "food_nutrient.csv"):
            fid = row["fdc_id"]
            if fid not in foods:
                continue
            field = FIELDS.get(row["nutrient_id"])
            if not field:
                continue
            try:
                amount = float(row["amount"])
            except (TypeError, ValueError):
                continue
            nutrients.setdefault(fid, {})[field] = amount
        portions = gen.collect_csv_portions(zf, set(foods))
        for fid, desc in foods.items():
            raw = nutrients.get(fid) or {}
            kcal = raw.get("kcal", raw.get("kcal_alt", raw.get("kcal_alt2")))
            pro = raw.get("pro")
            if kcal is None or pro is None:
                continue
            sugar = raw.get("sugar", raw.get("sugar_alt"))
            vd = raw.get("vd")
            if vd is None and raw.get("vd_iu") is not None:
                vd = raw["vd_iu"] / 40.0
            packed = {
                "fat": raw.get("fat"),
                "sat": raw.get("sat"),
                "trans": raw.get("trans"),
                "carb": raw.get("carb"),
                "fiber": raw.get("fiber"),
                "sugar": sugar,
                "added": raw.get("added"),
                "na": raw.get("na"),
                "chol": raw.get("chol"),
                "k": raw.get("k"),
                "ca": raw.get("ca"),
                "fe": raw.get("fe"),
                "vd": vd,
            }
            records.append(
                {
                    "fdc": fid,
                    "src": src,
                    "desc": clean(desc),
                    "cat": categories.get(fid) or "",
                    "kcal": kcal,
                    "pro": pro,
                    "portions": gen.keep_portions(portions.get(fid, [])),
                    "n": packed,
                }
            )
    return records


def nova_from_name(desc: str, cat: str) -> int:
    """Processing group for foods that are not in the everyday list.

    1 whole or minimally processed, 2 culinary ingredient, 3 processed,
    4 ultra-processed. This is a name rule, documented in the README.
    """
    d = desc.lower()
    if any(
        token in d
        for token in (
            "fast food",
            "candy",
            "candies",
            "carbonated",
            "soft drink",
            "cookie",
            "doughnut",
            "donut",
            "toaster pastry",
            "frosted",
            "fruit drink",
            "sports drink",
            "energy drink",
            "milk shake",
            "milkshake",
            "nugget",
            "battered or breaded",
            "breaded",
            "frozen novelties",
            "ice cream",
            "ice creams",
            "pudding",
            "ready-to-eat",
            "sweetened",
            "chocolate coated",
            "candy coated",
            "honey roasted",
            "breakfast bar",
            "granola bar",
            "snack bar",
            "potato chips",
            "tortilla chips",
            "cracker",
            "frankfurter",
            "bologna",
            "luncheon",
            "hot dog",
            "margarine",
            "shortening",
            "whipped topping",
            "coffee creamer",
            "fruit punch",
            "lemonade",
            "artificially sweetened",
            "low calorie",
            "with sugar",
        )
    ) or re.search(r"\bdiet\b", d):
        return 4
    if cat == "4" or any(
        token in d
        for token in (
            "oil,",
            "oil ",
            "shortening",
            "lard",
            "butter,",
            "butter ",
            "sugars,",
            "honey",
            "syrup",
            "flour,",
            "flour ",
            "salt,",
            "vinegar",
            "spices,",
        )
    ):
        if "margarine" in d or "sweetened" in d:
            return 4
        return 2
    if any(
        token in d
        for token in (
            "canned",
            "cheese",
            "bread,",
            "bread ",
            "yogurt",
            "sausage",
            "ham,",
            "ham ",
            "bacon",
            "smoked",
            "cured",
            "pickled",
            "salted",
            "jam",
            "sauce,",
            "dressing",
            "fermented",
        )
    ):
        if d.startswith("yogurt, greek, plain") or d.startswith("yogurt, plain"):
            return 1
        if "breaded" in d or "sweetened" in d:
            return 4
        return 3
    return 1


# short name, USDA description (cleaned), nova, simple (1 = single food)
EXACT: list[tuple[str, str, int, int]] = [
    ("Chicken breast, roasted", "Chicken, broilers or fryers, breast, meat only, cooked, roasted", 1, 1),
    ("Chicken breast, grilled", "Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled", 1, 1),
    ("Chicken thigh, roasted", "Chicken, broilers or fryers, thigh, meat only, cooked, roasted", 1, 1),
    ("Chicken drumstick, roasted", "Chicken, broilers or fryers, dark meat, drumstick, meat only, cooked, roasted", 1, 1),
    ("Chicken, canned", "Chicken, canned, no broth", 3, 1),
    ("Turkey breast, roasted", "Turkey, whole, breast, meat only, cooked, roasted", 1, 1),
    ("Ground turkey, cooked", "Turkey, Ground, cooked", 1, 1),
    ("Ground beef, 93% lean, broiled", "Beef, ground, 93% lean meat / 7% fat, patty, cooked, broiled", 1, 1),
    ("Ground beef, 90% lean, broiled", "Beef, ground, 90% lean meat / 10% fat, patty, cooked, broiled", 1, 1),
    ("Ground beef, 85% lean, broiled", "Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled", 1, 1),
    ("Ground beef, 80% lean, broiled", "Beef, ground, 80% lean meat / 20% fat, patty, cooked, broiled", 1, 1),
    ("Sirloin steak, broiled", "Beef, top sirloin, steak, separable lean only, trimmed to 0\" fat, choice, cooked, broiled", 1, 1),
    ("Beef tenderloin, broiled", "Beef, tenderloin, steak, separable lean only, trimmed to 1/8\" fat, choice, cooked, broiled", 1, 1),
    ("Pork tenderloin, roasted", "Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted", 1, 1),
    ("Pork chop, broiled", "Pork, fresh, loin, sirloin (chops), bone-in, separable lean only, cooked, broiled", 1, 1),
    ("Ham, roasted", "Pork, cured, ham, extra lean (approximately 4% fat), canned, roasted", 3, 1),
    ("Bacon, cooked", "Pork, cured, bacon, cooked, broiled, pan-fried or roasted, reduced sodium", 3, 1),
    ("Pork sausage, cooked", "Pork sausage, link/patty, cooked, pan-fried", 4, 0),
    ("Turkey sausage, cooked", "Sausage, turkey, fresh, cooked", 4, 0),
    ("Salmon, Atlantic, cooked", "Fish, salmon, Atlantic, farmed, cooked, dry heat", 1, 1),
    ("Salmon, sockeye, cooked", "Fish, salmon, sockeye, cooked, dry heat", 1, 1),
    ("Salmon, canned", "Fish, salmon, pink, canned, drained solids", 3, 1),
    ("Tuna, canned in water", "Fish, tuna, light, canned in water, drained solids", 3, 1),
    ("Cod, cooked", "Fish, cod, Atlantic, cooked, dry heat", 1, 1),
    ("Tilapia, cooked", "Fish, tilapia, cooked, dry heat", 1, 1),
    ("Shrimp, cooked", "Crustaceans, shrimp, mixed species, cooked, moist heat (may contain additives to retain moisture)", 1, 1),
    ("Sardines, canned", "Fish, sardine, Atlantic, canned in oil, drained solids with bone", 3, 1),
    ("Crab, cooked", "Crustaceans, crab, blue, cooked, moist heat", 1, 1),
    ("Lobster, cooked", "Crustaceans, lobster, northern, cooked, moist heat", 1, 1),
    ("Scallops, steamed", "Mollusks, scallop, (bay and sea), cooked, steamed", 1, 1),
    ("Duck, roasted", "Duck, domesticated, meat only, cooked, roasted", 1, 1),
    ("Bison, ground, cooked", "Bison, ground, grass-fed, cooked", 1, 1),
    ("Egg, whole, raw", "Egg, whole, raw, fresh", 1, 1),
    ("Egg, hard-boiled", "Egg, whole, cooked, hard-boiled", 1, 1),
    ("Egg, scrambled", "Egg, whole, cooked, scrambled", 1, 1),
    ("Egg, omelet", "Egg, whole, cooked, omelet", 1, 1),
    ("Egg white, raw", "Egg, white, raw, fresh", 1, 1),
    ("Egg yolk, raw", "Egg, yolk, raw, fresh", 1, 1),
    ("Egg substitute", "Egg substitute, liquid or frozen, fat free", 4, 0),
    ("Tofu, firm", "HOUSE FOODS Premium Firm Tofu", 3, 0),
    ("Tempeh", "Tempeh", 3, 1),
    ("Edamame, prepared", "Edamame, frozen, prepared", 1, 1),
    ("Milk, whole", "Milk, whole, 3.25% milkfat, with added vitamin D", 1, 1),
    ("Milk, 2%", "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D", 1, 1),
    ("Milk, 1%", "Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D", 1, 1),
    ("Milk, skim", "Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)", 1, 1),
    ("Milk, chocolate", "Milk, chocolate, fluid, commercial, reduced fat, with added vitamin A and vitamin D", 4, 0),
    ("Buttermilk", "Milk, buttermilk, fluid, whole", 1, 1),
    ("Greek yogurt, plain nonfat", "Yogurt, Greek, plain, nonfat", 1, 1),
    ("Greek yogurt, plain lowfat", "Yogurt, Greek, plain, lowfat", 1, 1),
    ("Greek yogurt, plain whole milk", "Yogurt, Greek, plain, whole milk", 1, 1),
    ("Yogurt, plain lowfat", "Yogurt, plain, low fat", 1, 1),
    ("Yogurt, vanilla lowfat", "Yogurt, vanilla flavor, lowfat milk, sweetened with low calorie sweetener", 4, 0),
    ("Kefir, plain", "Kefir, lowfat, plain, LIFEWAY", 1, 0),
    ("Cottage cheese, 2%", "Cheese, cottage, lowfat, 2% milkfat", 3, 0),
    ("Cottage cheese, 1%", "Cheese, cottage, lowfat, 1% milkfat", 3, 0),
    ("Cottage cheese, creamed", "Cheese, cottage, creamed, large or small curd", 3, 0),
    ("Cheddar cheese", "Cheese, cheddar", 3, 0),
    ("Mozzarella, part skim", "Cheese, mozzarella, part skim milk", 3, 0),
    ("Swiss cheese", "Cheese, swiss", 3, 0),
    ("Parmesan", "Cheese, parmesan, hard", 3, 0),
    ("Feta", "Cheese, feta", 3, 0),
    ("Ricotta, part skim", "Cheese, ricotta, part skim milk", 3, 0),
    ("Cream cheese", "Cheese, cream", 3, 0),
    ("Goat cheese, soft", "Cheese, goat, soft type", 3, 0),
    ("Blue cheese", "Cheese, blue", 3, 0),
    ("Provolone", "Cheese, provolone", 3, 0),
    ("Monterey cheese", "Cheese, monterey", 3, 0),
    ("Colby cheese", "Cheese, colby", 3, 0),
    ("Sour cream", "Cream, sour, cultured", 3, 0),
    ("Butter, salted", "Butter, salted", 2, 1),
    ("Butter, unsalted", "Butter, without salt", 2, 1),
    ("Heavy cream", "Cream, fluid, heavy whipping", 2, 1),
    ("Half and half", "Cream, fluid, half and half", 2, 1),
    ("Whipped cream", "Cream, whipped, cream topping, pressurized", 4, 0),
    ("Oatmeal, cooked", "Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt", 1, 1),
    ("White rice, cooked", "Rice, white, long-grain, regular, enriched, cooked", 1, 1),
    ("Brown rice, cooked", "Rice, brown, long-grain, cooked", 1, 1),
    ("White rice, dry", "Rice, white, long-grain, regular, raw, enriched", 1, 1),
    ("Quinoa, cooked", "Quinoa, cooked", 1, 1),
    ("Barley, cooked", "Barley, pearled, cooked", 1, 1),
    ("Couscous, cooked", "Couscous, cooked", 1, 1),
    ("Bulgur, cooked", "Bulgur, cooked", 1, 1),
    ("Wild rice, cooked", "Wild rice, cooked", 1, 1),
    ("Pasta, cooked", "Pasta, cooked, enriched, without added salt", 1, 1),
    ("Whole wheat pasta, cooked", "Pasta, whole-wheat, cooked", 1, 1),
    ("Soba noodles, cooked", "Noodles, japanese, soba, cooked", 1, 1),
    ("Whole wheat bread", "Bread, whole-wheat, commercially prepared", 3, 0),
    ("White bread", "Bread, white, commercially prepared (includes soft bread crumbs)", 3, 0),
    ("Rye bread", "Bread, rye", 3, 0),
    ("Sourdough bread", "Bread, french or vienna (includes sourdough)", 3, 0),
    ("Pita, whole wheat", "Bread, pita, whole-wheat", 3, 0),
    ("Pita, white", "Bread, pita, white, enriched", 3, 0),
    ("Naan", "Bread, naan, plain, commercially prepared, refrigerated", 3, 0),
    ("Bagel, plain", "Bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame)", 3, 0),
    ("English muffin", "English muffins, plain, enriched, without calcium propionate(includes sourdough)", 3, 0),
    ("Flour tortilla", "Tortillas, ready-to-bake or -fry, flour, shelf stable", 3, 0),
    ("Corn tortilla", "Tortillas, ready-to-bake or -fry, corn", 3, 0),
    ("Croissant", "Croissants, butter", 4, 0),
    ("Corn muffin", "Muffins, corn, commercially prepared", 4, 0),
    ("Blueberry muffin", "Muffins, blueberry, commercially prepared (Includes mini-muffins)", 4, 0),
    ("Banana bread", "Bread, banana, prepared from recipe, made with margarine", 4, 0),
    ("Pancakes", "Pancakes, plain, prepared from recipe", 3, 0),
    ("Waffles", "Waffles, plain, prepared from recipe", 3, 0),
    ("Cheerios", "Cereals ready-to-eat, GENERAL MILLS, CHEERIOS", 4, 0),
    ("Grits, cooked", "Cereals, corn grits, white, regular and quick, enriched, cooked with water, without salt", 1, 1),
    ("All-purpose flour", "Wheat flour, white, all-purpose, enriched, bleached", 1, 1),
    ("Whole wheat flour", "Wheat flour, whole-grain", 1, 1),
    ("Popcorn, air-popped", "Snacks, popcorn, air-popped", 1, 1),
    ("Popcorn, oil-popped", "Snacks, popcorn, oil-popped, white popcorn, salt added", 3, 0),
    ("Banana", "Bananas, raw", 1, 1),
    ("Apple", "Apples, raw, with skin", 1, 1),
    ("Orange", "Oranges, raw, all commercial varieties", 1, 1),
    ("Strawberries", "Strawberries, raw", 1, 1),
    ("Blueberries", "Blueberries, raw", 1, 1),
    ("Raspberries", "Raspberries, raw", 1, 1),
    ("Blackberries", "Blackberries, raw", 1, 1),
    ("Grapes", "Grapes, red or green (European type, such as Thompson seedless), raw", 1, 1),
    ("Watermelon", "Watermelon, raw", 1, 1),
    ("Cantaloupe", "Melons, cantaloupe, raw", 1, 1),
    ("Honeydew", "Melons, honeydew, raw", 1, 1),
    ("Pineapple", "Pineapple, raw, all varieties", 1, 1),
    ("Mango", "Mangos, raw", 1, 1),
    ("Peach", "Peaches, yellow, raw", 1, 1),
    ("Pear", "Pears, raw", 1, 1),
    ("Plum", "Plums, raw", 1, 1),
    ("Cherries", "Cherries, sweet, raw", 1, 1),
    ("Kiwi", "Kiwifruit, green, raw", 1, 1),
    ("Grapefruit", "Grapefruit, raw, pink and red, all areas", 1, 1),
    ("Lemon", "Lemons, raw, without peel", 1, 1),
    ("Lime", "Limes, raw", 1, 1),
    ("Avocado", "Avocados, raw, all commercial varieties", 1, 1),
    ("Dates", "Dates, deglet noor", 1, 1),
    ("Raisins", "Raisins, dark, seedless", 1, 1),
    ("Prunes", "Plums, dried (prunes), uncooked", 1, 1),
    ("Orange juice", "Orange juice, raw", 1, 1),
    ("Apple juice", "Apple juice, canned or bottled, unsweetened, without added ascorbic acid", 1, 1),
    ("Grape juice", "Grape juice, canned or bottled, unsweetened, without added ascorbic acid", 1, 1),
    ("Cranberry juice cocktail", "Cranberry juice cocktail, bottled", 4, 0),
    ("Lemon juice", "Lemon juice, raw", 1, 1),
    ("Lime juice", "Lime juice, raw", 1, 1),
    ("Broccoli", "Broccoli, raw", 1, 1),
    ("Broccoli, cooked", "Broccoli, cooked, boiled, drained, without salt", 1, 1),
    ("Spinach", "Spinach, raw", 1, 1),
    ("Spinach, cooked", "Spinach, cooked, boiled, drained, without salt", 1, 1),
    ("Kale", "Kale, raw", 1, 1),
    ("Romaine lettuce", "Lettuce, cos or romaine, raw", 1, 1),
    ("Iceberg lettuce", "Lettuce, iceberg (includes crisphead types), raw", 1, 1),
    ("Tomato", "Tomatoes, red, ripe, raw, year round average", 1, 1),
    ("Cucumber", "Cucumber, with peel, raw", 1, 1),
    ("Carrot", "Carrots, raw", 1, 1),
    ("Carrots, cooked", "Carrots, cooked, boiled, drained, without salt", 1, 1),
    ("Red bell pepper", "Peppers, sweet, red, raw", 1, 1),
    ("Green bell pepper", "Peppers, sweet, green, raw", 1, 1),
    ("Onion", "Onions, raw", 1, 1),
    ("Garlic", "Garlic, raw", 1, 1),
    ("Baked potato", "Potatoes, Russet, flesh and skin, baked", 1, 1),
    ("Sweet potato, baked", "Sweet potato, cooked, baked in skin, flesh, without salt", 1, 1),
    ("Corn", "Corn, sweet, yellow, raw", 1, 1),
    ("Green beans", "Beans, snap, green, raw", 1, 1),
    ("Green beans, cooked", "Beans, snap, green, cooked, boiled, drained, without salt", 1, 1),
    ("Green peas", "Peas, green, raw", 1, 1),
    ("Asparagus", "Asparagus, raw", 1, 1),
    ("Cauliflower", "Cauliflower, raw", 1, 1),
    ("Cabbage", "Cabbage, raw", 1, 1),
    ("Brussels sprouts", "Brussels sprouts, raw", 1, 1),
    ("Zucchini", "Squash, summer, zucchini, includes skin, raw", 1, 1),
    ("Mushrooms", "Mushrooms, white, raw", 1, 1),
    ("Celery", "Celery, raw", 1, 1),
    ("Beets", "Beets, raw", 1, 1),
    ("Eggplant", "Eggplant, raw", 1, 1),
    ("Tomato sauce", "Tomato sauce, canned, no salt added", 3, 0),
    ("Salsa", "Sauce, salsa, ready-to-serve", 3, 0),
    ("Black beans, cooked", "Beans, black, mature seeds, cooked, boiled, without salt", 1, 1),
    ("Pinto beans, cooked", "Beans, pinto, mature seeds, cooked, boiled, without salt", 1, 1),
    ("Kidney beans, cooked", "Beans, kidney, red, mature seeds, cooked, boiled, without salt", 1, 1),
    ("Chickpeas, cooked", "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt", 1, 1),
    ("Lentils, cooked", "Lentils, mature seeds, cooked, boiled, without salt", 1, 1),
    ("Black beans, canned", "Beans, black, mature seeds, canned, low sodium", 3, 0),
    ("Chickpeas, canned", "Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained solids", 3, 0),
    ("Refried beans", "Refried beans, canned, traditional style", 3, 0),
    ("Hummus", "Hummus, commercial", 3, 0),
    ("Peanut butter", "Peanut butter, smooth style, without salt", 3, 0),
    ("Peanuts, roasted", "Peanuts, all types, dry-roasted, without salt", 1, 1),
    ("Almonds", "Nuts, almonds", 1, 1),
    ("Walnuts", "Nuts, walnuts, english", 1, 1),
    ("Cashews", "Nuts, cashew nuts, raw", 1, 1),
    ("Pecans", "Nuts, pecans", 1, 1),
    ("Pistachios", "Nuts, pistachio nuts, raw", 1, 1),
    ("Sunflower seeds", "Seeds, sunflower seed kernels, dried", 1, 1),
    ("Pumpkin seeds", "Seeds, pumpkin and squash seed kernels, dried", 1, 1),
    ("Chia seeds", "Seeds, chia seeds, dried", 1, 1),
    ("Flaxseed", "Seeds, flaxseed", 1, 1),
    ("Almond butter", "Nuts, almond butter, plain, without salt added", 3, 0),
    ("Olive oil, cooking", "Oil, olive, salad or cooking", 2, 1),
    ("Canola oil", "Oil, canola", 2, 1),
    ("Avocado oil", "Oil, avocado", 2, 1),
    ("Coconut oil", "Oil, coconut", 2, 1),
    ("Vegetable oil", "Oil, vegetable, soybean, refined", 2, 1),
    ("Sesame oil", "Oil, sesame, salad or cooking", 2, 1),
    ("Peanut oil", "Oil, peanut, salad or cooking", 2, 1),
    ("Mayonnaise", "Salad dressing, mayonnaise, regular", 4, 0),
    ("Yellow mustard", "Mustard, prepared, yellow", 3, 0),
    ("Ketchup", "Catsup", 4, 0),
    ("Soy sauce", "Soy sauce made from soy and wheat (shoyu)", 3, 0),
    ("Hot sauce", "Sauce, ready-to-serve, pepper or hot", 3, 0),
    ("Barbecue sauce", "Sauce, barbecue", 4, 0),
    ("Ranch dressing", "Salad dressing, ranch dressing, regular", 4, 0),
    ("Italian dressing", "Salad dressing, italian dressing, commercial, regular", 4, 0),
    ("Honey", "Honey", 2, 1),
    ("Maple syrup", "Syrups, maple", 2, 1),
    ("Pancake syrup", "Syrups, table blends, pancake", 4, 0),
    ("White sugar", "Sugars, granulated", 2, 1),
    ("Brown sugar", "Sugars, brown", 2, 1),
    ("Molasses", "Molasses", 2, 1),
    ("Jam", "Jams and preserves", 4, 0),
    ("Balsamic vinegar", "Vinegar, balsamic", 2, 1),
    ("Cider vinegar", "Vinegar, cider", 2, 1),
    ("Salt", "Salt, table", 2, 1),
    ("Black pepper", "Spices, pepper, black", 2, 1),
    ("Cinnamon", "Spices, cinnamon, ground", 2, 1),
    ("Basil", "Basil, fresh", 1, 1),
    ("Ginger", "Ginger root, raw", 1, 1),
    ("Potato chips", "Snacks, potato chips, plain, salted", 4, 0),
    ("Tortilla chips", "Snacks, tortilla chips, plain, white corn, salted", 4, 0),
    ("Pretzels", "Snacks, pretzels, hard, plain, salted", 4, 0),
    ("Saltine crackers", "Crackers, saltines (includes oyster, soda, soup)", 4, 0),
    ("Graham crackers", "Cookies, graham crackers, plain or honey (includes cinnamon)", 4, 0),
    ("Rice cake", "Snacks, rice cakes, brown rice, plain, unsalted", 3, 0),
    ("Dark chocolate", "Candies, semisweet chocolate", 4, 0),
    ("Milk chocolate", "Candies, milk chocolate", 4, 0),
    ("Vanilla ice cream", "Ice creams, vanilla", 4, 0),
    ("Chocolate chip cookie", "Cookies, chocolate chip, commercially prepared, regular, higher fat, enriched", 4, 0),
    ("Beef jerky", "Snacks, beef jerky, chopped and formed", 4, 0),
    ("Granola bar", "Snacks, granola bars, hard, plain", 4, 0),
    ("Coffee, brewed", "Beverages, coffee, brewed, prepared with tap water", 1, 1),
    ("Tea, brewed", "Beverages, tea, black, brewed, prepared with tap water", 1, 1),
    ("Green tea, brewed", "Beverages, tea, green, brewed, regular", 1, 1),
    ("Cola", "Beverages, carbonated, cola, regular", 4, 0),
    ("Diet cola", "Beverages, carbonated, low calorie, cola or pepper-type, with aspartame, contains caffeine", 4, 0),
    ("Ginger ale", "Beverages, carbonated, ginger ale", 4, 0),
    ("Root beer", "Beverages, carbonated, root beer", 4, 0),
    ("Lemon-lime soda", "Beverages, carbonated, lemon-lime soda, no caffeine", 4, 0),
    ("Beer", "Alcoholic beverage, beer, regular, all", 3, 0),
    ("Light beer", "Alcoholic beverage, beer, light", 4, 0),
    ("Red wine", "Alcoholic beverage, wine, table, red", 3, 0),
    ("White wine", "Alcoholic beverage, wine, table, white", 3, 0),
    ("Whiskey, 86 proof", "Alcoholic beverage, distilled, whiskey, 86 proof", 2, 1),
    ("Vodka, 80 proof", "Alcoholic beverage, distilled, vodka, 80 proof", 2, 1),
    ("Almond milk, unsweetened", "Beverages, almond milk, unsweetened, shelf stable", 4, 0),
    ("Soy milk, unsweetened", "Soymilk (all flavors), unsweetened, with added calcium, vitamins A and D", 3, 0),
    ("Rice milk, unsweetened", "Beverages, rice milk, unsweetened", 4, 0),
    ("Coconut milk, canned", "Nuts, coconut milk, canned (liquid expressed from grated meat and water)", 3, 0),
    ("Tap water", "Beverages, water, tap, drinking", 1, 1),
    ("Chicken broth", "Soup, chicken broth, ready-to-serve", 3, 0),
    ("Cheese pizza", "Fast Food, Pizza Chain, 14\" pizza, cheese topping, regular crust", 4, 0),
    ("Cheeseburger, fast food", "Fast foods, cheeseburger; single, regular patty, with condiments", 4, 0),
    ("French fries", "Fast foods, potato, french fried in vegetable oil", 4, 0),
    ("Burrito, beans", "Fast foods, burrito, with beans", 4, 0),
    ("Nachos with cheese", "Fast foods, nachos, with cheese", 4, 0),
    ("Chicken noodle soup", "Soup, chicken noodle, canned, condensed", 4, 0),
    ("Tomato soup", "Soup, tomato, canned, condensed", 4, 0),
    ("Lentil soup", "Soup, lentil with ham, canned, ready-to-serve", 4, 0),
    ("Vegetable soup", "Soup, vegetarian vegetable, canned, condensed", 4, 0),
    ("Clam chowder, New England", "Soup, clam chowder, new england, canned, condensed", 4, 0),
    ("Chili with beans", "Chili con carne with beans, canned entree", 4, 0),
    ("Chili, no beans", "Chili, no beans, canned entree", 4, 0),
    ("Beef stew, canned", "Beef stew, canned entree", 4, 0),
    ("Macaroni and cheese, canned", "Macaroni and Cheese, canned entree", 4, 0),
    ("Spaghetti with meat sauce", "Restaurant, Italian, spaghetti with meat sauce", 4, 0),
    ("Lasagna, frozen", "Lasagna, cheese, frozen, prepared", 4, 0),
    ("Chicken pot pie", "Chicken pot pie, frozen entree, prepared", 4, 0),
    ("Fried rice", "Restaurant, Chinese, fried rice, without meat", 4, 0),
    ("Quesadilla, cheese", "Restaurant, Mexican, cheese quesadilla", 4, 0),
]


def auto_items(records: list[dict]) -> list[tuple[str, str, int, int]]:
    """Friendly names for plain produce and simply named cooked foods."""
    found: list[tuple[str, str, int, int]] = []
    seen_desc = set()
    for rec in records:
        if rec["src"] != "sr":
            continue
        desc = rec["desc"]
        if desc in seen_desc:
            continue
        low = desc.lower()
        if any(bad in low for bad in ("babyfood", "infant", "toddler", "alaska native", "fast food")):
            continue
        if rec["cat"] in {"9", "11"} and desc.endswith(", raw") and desc.count(",") == 1:
            short = desc[: -len(", raw")]
            if len(short) >= 3:
                found.append((short, desc, 1, 1))
                seen_desc.add(desc)
                continue
        if desc.endswith(", cooked, boiled, drained, without salt"):
            prefix = desc[: -len(", cooked, boiled, drained, without salt")]
            if "," not in prefix and len(prefix) >= 3 and rec["cat"] in {"11", "16", "9"}:
                found.append((prefix + ", cooked", desc, 1, 1))
                seen_desc.add(desc)
                continue
        match = re.match(r"^Fish, ([^,]+), cooked, dry heat$", desc)
        if match and rec["cat"] == "15":
            species = match.group(1)
            if len(species) >= 3:
                found.append((species[0].upper() + species[1:] + ", cooked", desc, 1, 1))
                seen_desc.add(desc)
    return found


def choose(index: dict[str, list[dict]], desc: str, target_kcal: float | None) -> dict | None:
    recs = index.get(desc) or []
    if not recs:
        return None
    if target_kcal is None:
        recs = sorted(recs, key=lambda rec: (rec["src"] == "fd", sum(v is not None for v in rec["n"].values())), reverse=True)
        return recs[0]
    close = [rec for rec in recs if abs(rec["kcal"] - target_kcal) <= 2]
    if not close:
        return None
    close.sort(key=lambda rec: (abs(rec["kcal"] - target_kcal), rec["src"] != "fd"))
    return close[0]


def pack(rec: dict, nova: int, how: str, simple: int) -> list:
    nutrients = [None if rec["n"][key] is None else round_num(rec["n"][key]) for key in NUTRIENT_KEYS]
    return [rec["src"], rec["fdc"], nova, how, simple, *nutrients]


def main() -> None:
    if not SR_ZIP.exists() or not FD_ZIP.exists():
        raise SystemExit("Missing USDA caches in tools/.cache. Download SR Legacy and Foundation zips first.")
    sr = load_zip(SR_ZIP, "sr", "sr_legacy_food")
    fd = load_zip(FD_ZIP, "fd", "foundation_food")
    index: dict[str, list[dict]] = {}
    for rec in sr + fd:
        index.setdefault(rec["desc"], []).append(rec)
    print(f"SR records {len(sr)} foundation records {len(fd)}")

    existing_rows = []
    foods_dir = ROOT / "data" / "foods"
    for path in sorted(foods_dir.glob("*.json")):
        if path.name in {"index.json", "common.json"}:
            continue
        existing_rows.extend(json.loads(path.read_text())["f"])
    before = len(existing_rows)
    existing = {row[0]: row for row in existing_rows}
    print(f"Existing foods {before}")

    nutrition: dict[str, list] = {}
    # Long-tail overlays: same cleaned USDA name, calories within 2 of the row we already ship.
    for name, row in existing.items():
        rec = choose(index, name, float(row[1]))
        if not rec:
            continue
        nutrition[name] = pack(rec, nova_from_name(name, rec["cat"]), "name", 0)

    planned = list(EXACT)
    used_shorts = {short.casefold() for short, *_rest in planned}
    for item in auto_items(sr):
        if item[0].casefold() in used_shorts:
            continue
        used_shorts.add(item[0].casefold())
        planned.append(item)

    common = []
    missing = []
    for short, desc, nova, simple in planned:
        rec = choose(index, desc, None)
        if not rec:
            missing.append(f"{short} :: {desc}")
            continue
        existing_row = existing.get(desc)
        overlay = choose(index, desc, float(existing_row[1])) if existing_row else None
        if overlay:
            # Keep the calories and portions already shipped for this USDA name.
            kcal, pro, portions = existing_row[1], existing_row[2], existing_row[3]
            payload = pack(overlay, nova, "listed", simple)
            nutrition[desc] = payload
        else:
            kcal = round(rec["kcal"], 1)
            pro = round(max(rec["pro"], 0), 1)
            portions = rec["portions"]
            payload = pack(rec, nova, "listed", simple)
            if existing_row is None:
                nutrition[desc] = payload
        if short.casefold() == desc.casefold():
            continue
        cited = overlay or rec
        if short in existing:
            # Do not hang one record's nutrients on a different food that only shares a name.
            if abs(float(existing[short][1]) - cited["kcal"]) <= 2:
                nutrition[short] = payload
            continue
        if any(row[0].casefold() == short.casefold() for row in common):
            continue
        common.append([short, kcal, pro, portions])
        nutrition[short] = payload

    if missing:
        print("MISSING", len(missing))
        for line in missing:
            print(" ", line)
        raise SystemExit("Some everyday foods did not match a USDA description")

    common.sort(key=lambda row: row[0].casefold())
    common_path = foods_dir / "common.json"
    common_path.write_text(json.dumps({"f": common}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    meta = {
        "basis": "Values are per 100 g of the cited record.",
        "sources": {
            "sr": "USDA FoodData Central SR Legacy, April 2018. Public domain.",
            "fd": "USDA FoodData Central Foundation Foods, December 18, 2025. Public domain.",
        },
        "fields": ["src", "fdc", "nova", "how", "simple", *NUTRIENT_KEYS],
        "nutrients": "fat, sat, trans, carb, fiber, sugar, added sugar, sodium mg, cholesterol mg, potassium mg, calcium mg, iron mg, vitamin D mcg. Null means not published on that record.",
        "nova": "1 whole or minimally processed, 2 culinary ingredient, 3 processed, 4 ultra-processed. how=listed was assigned for this food. how=name was estimated from the name for the long tail.",
        "count": len(nutrition),
        "foods": nutrition,
    }
    out = ROOT / "data" / "nutrition.json"
    out.write_text(json.dumps(meta, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    index_path = foods_dir / "index.json"
    food_index = json.loads(index_path.read_text())
    shards = [shard for shard in food_index.get("shards", []) if shard != "common"]
    food_index["shards"] = shards + ["common"]
    food_index["count"] = before + len(common)
    food_index["detail"] = "data/nutrition.json has per-100 g fat, saturated fat, trans fat, carbohydrate, fiber, total sugar, added sugar, sodium, cholesterol, potassium, calcium, iron, and vitamin D when USDA published them."
    index_path.write_text(json.dumps(food_index, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    print(f"New everyday foods {len(common)}")
    print(f"Foods after {before + len(common)}")
    print(f"Nutrition records {len(nutrition)}")
    print(f"nutrition.json bytes {out.stat().st_size} common.json bytes {common_path.stat().st_size}")
    banana = nutrition.get("Bananas, raw") or nutrition.get("Banana")
    chicken = nutrition["Chicken breast, roasted"]
    if not banana or abs(existing["Bananas, raw"][1] - 89) > 0.2:
        raise SystemExit("Bananas, raw calories changed or nutrition missing")
    # fat is index 5
    if banana[5] is None or abs(banana[5] - 0.33) > 0.05:
        raise SystemExit(f"Banana fat looks wrong: {banana}")
    if abs(chicken[5] - 3.57) > 0.05:
        raise SystemExit(f"Chicken breast fat looks wrong: {chicken}")
    if len(common) < 300:
        raise SystemExit(f"Expected several hundred new foods, got {len(common)}")


if __name__ == "__main__":
    main()
