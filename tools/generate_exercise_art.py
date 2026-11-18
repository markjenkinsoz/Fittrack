#!/usr/bin/env python3
"""Write original FitTrack line drawings for the home-plan exercises.

These SVGs are drawn for this app. They are not copied from a textbook or a
photo. Each plan exercise name is mapped to one drawing.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "images" / "exercises"
PLANS = ROOT / "data" / "plans.json"
DEMOS = ROOT / "data" / "exercise-demos.json"

# keyword, demo id. First match wins.
RULES = [
    ("halo", "halo"),
    ("hammer", "curl"),
    ("clam", "clam"),
    ("bird dog", "bird-dog"),
    ("dead bug", "dead-bug"),
    ("heel slide", "dead-bug"),
    ("glute bridge", "bridge"),
    ("figure-4", "figure4"),
    ("hip flexor", "hip-flexor"),
    ("hamstring", "hamstring"),
    ("cat-cow", "cat-cow"),
    ("open book", "open-book"),
    ("thoracic", "thoracic"),
    ("knee rock", "knee-rock"),
    ("wind-down", "side-lie"),
    ("ankle", "ankle"),
    ("breath", "breathe"),
    ("bike", "bike"),
    ("push-up", "pushup"),
    ("floor press", "bench"),
    ("bench press", "bench"),
    ("press", "press"),
    ("row", "row"),
    ("farmer", "carry"),
    ("suitcase", "carry"),
    ("hinge", "hinge"),
    ("deadlift", "hinge"),
    ("romanian", "hinge"),
    ("split squat", "split"),
    ("rear-foot", "split"),
    ("squat", "squat"),
]

VIDEOS = {
    "squat": ("https://www.youtube.com/watch?v=sOUCmU27mjE", "Whole Body Workout for Beginners", "OPEX Bristol"),
    "row": ("https://www.youtube.com/watch?v=sOUCmU27mjE", "Whole Body Workout for Beginners", "OPEX Bristol"),
    "hinge": ("https://www.youtube.com/watch?v=ZEnWV4kguKc", "How to do romanian deadlifts safely", "Jack Hanrahan Fitness"),
    "bird-dog": ("https://www.youtube.com/watch?v=99ewh8IACrA", "Ultimate Ab & Core Workout: Bird Dog, Dead Bug, & Bridge", "Andrew's Fitness Training"),
    "dead-bug": ("https://www.youtube.com/watch?v=99ewh8IACrA", "Ultimate Ab & Core Workout: Bird Dog, Dead Bug, & Bridge", "Andrew's Fitness Training"),
    "bridge": ("https://www.youtube.com/watch?v=99ewh8IACrA", "Ultimate Ab & Core Workout: Bird Dog, Dead Bug, & Bridge", "Andrew's Fitness Training"),
    "cat-cow": ("https://www.youtube.com/watch?v=Dq1XBAkIZEM", "Adaptive Yoga for Kids", "National Center on Health, Physical Activity and Disability"),
    "halo": ("https://www.youtube.com/watch?v=Sci3lijQBmk", "Kettlebell Halo Tutorial", "Brittany van Schravendijk"),
    "carry": ("https://www.youtube.com/watch?v=y1r9toPQNkM", "8 Best Dumbbell Exercises Ever", "ATHLEAN-X"),
    "split": ("https://www.youtube.com/watch?v=EAO2twIivhs", "35 Min Strength Training at Home Full Body Workout with Dumbbells", "HASfit"),
}


def svg(shapes: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" role="img">
  <rect width="160" height="120" rx="12" fill="#12161e"/>
  <g fill="none" stroke="#e8edf5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    {shapes}
  </g>
  <g fill="none" stroke="#3ee0b0" stroke-width="3" stroke-linecap="round">
    {{accent}}
  </g>
</svg>'''


def draw(lines, circles, accent="") -> str:
    body = []
    for x1, y1, x2, y2 in lines:
        body.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"/>')
    for cx, cy, r in circles:
        body.append(f'<circle cx="{cx}" cy="{cy}" r="{r}"/>')
    text = svg("\n    ".join(body))
    return text.replace("{accent}", accent)


POSES = {
    "squat": draw(
        [(70, 38, 70, 62), (70, 48, 48, 58), (70, 48, 92, 58), (70, 62, 52, 82), (52, 82, 48, 100), (70, 62, 90, 82), (90, 82, 98, 100)],
        [(70, 26, 8)],
        '<rect x="40" y="98" width="36" height="6" rx="2" stroke="#ff9b6b"/>',
    ),
    "bench": draw(
        [(78, 42, 110, 48), (78, 48, 78, 70), (78, 58, 58, 50), (58, 50, 46, 62), (78, 58, 100, 66)],
        [(118, 46, 8)],
        '<rect x="28" y="62" width="70" height="8" rx="2" stroke="#ff9b6b"/>',
    ),
    "row": draw(
        [(40, 70, 100, 46), (100, 46, 118, 40), (70, 58, 70, 78), (70, 78, 86, 96)],
        [(124, 36, 8)],
        '<rect x="24" y="66" width="28" height="8" rx="2" stroke="#ff9b6b"/>',
    ),
    "hinge": draw(
        [(48, 78, 100, 50), (100, 50, 108, 36), (78, 64, 78, 96), (70, 70, 96, 92)],
        [(112, 28, 8)],
    ),
    "press": draw(
        [(80, 36, 80, 78), (80, 48, 58, 40), (80, 48, 102, 32), (80, 78, 64, 104), (80, 78, 96, 104)],
        [(80, 24, 8)],
        '<rect x="52" y="102" width="50" height="6" rx="2" stroke="#ff9b6b"/>',
    ),
    "dead-bug": draw(
        [(40, 70, 110, 70), (70, 70, 48, 48), (70, 70, 100, 52), (70, 66, 70, 50)],
        [(112, 66, 8)],
    ),
    "figure4": draw(
        [(36, 74, 100, 74), (78, 74, 96, 56), (96, 56, 78, 48), (70, 70, 70, 56)],
        [(108, 70, 8)],
    ),
    "bike": draw(
        [(36, 78, 120, 78), (50, 78, 50, 58), (50, 58, 86, 52), (86, 52, 100, 68), (70, 60, 70, 46)],
        [(78, 40, 8)],
        '<circle cx="46" cy="86" r="10"/><circle cx="104" cy="86" r="10"/>',
    ),
    "open-book": draw(
        [(40, 70, 110, 62), (70, 66, 96, 40), (70, 66, 60, 86)],
        [(116, 58, 8)],
    ),
    "split": draw(
        [(78, 34, 78, 70), (78, 70, 48, 96), (78, 70, 108, 96), (78, 46, 60, 58), (78, 46, 96, 40)],
        [(78, 22, 8)],
    ),
    "pushup": draw(
        [(36, 78, 120, 62), (48, 76, 48, 96), (96, 66, 96, 96), (110, 60, 124, 52)],
        [(130, 48, 8)],
        '<rect x="28" y="92" width="80" height="6" rx="2" stroke="#ff9b6b"/>',
    ),
    "bridge": draw(
        [(36, 86, 70, 58), (70, 58, 112, 86), (88, 70, 100, 54)],
        [(108, 50, 8)],
    ),
    "carry": draw(
        [(80, 32, 80, 74), (80, 48, 58, 70), (80, 48, 104, 70), (80, 74, 66, 104), (80, 74, 96, 104)],
        [(80, 20, 8)],
        '<line x1="50" y1="70" x2="50" y2="86" stroke="#ff9b6b"/><line x1="112" y1="70" x2="112" y2="86" stroke="#ff9b6b"/>',
    ),
    "bird-dog": draw(
        [(40, 78, 110, 70), (50, 78, 46, 96), (96, 72, 100, 96), (70, 74, 96, 52), (78, 74, 52, 96)],
        [(116, 66, 8)],
    ),
    "hip-flexor": draw(
        [(70, 36, 70, 78), (70, 78, 48, 104), (70, 78, 104, 96), (70, 48, 96, 40)],
        [(70, 24, 8)],
    ),
    "ankle": draw(
        [(80, 30, 80, 78), (80, 78, 70, 104), (80, 46, 100, 58)],
        [(80, 18, 8)],
        '<rect x="60" y="104" width="30" height="5" rx="1" stroke="#ff9b6b"/>',
    ),
    "curl": draw(
        [(78, 34, 78, 80), (78, 50, 108, 62), (108, 62, 100, 46), (78, 80, 64, 104), (78, 80, 94, 104)],
        [(78, 22, 8)],
    ),
    "clam": draw(
        [(40, 80, 110, 70), (70, 76, 96, 52), (70, 76, 100, 84)],
        [(116, 66, 8)],
    ),
    "hamstring": draw(
        [(30, 78, 90, 78), (70, 78, 96, 48), (90, 74, 90, 60)],
        [(98, 74, 8)],
    ),
    "breathe": draw(
        [(36, 78, 110, 78), (80, 78, 80, 62)],
        [(116, 74, 8)],
        '<ellipse cx="78" cy="70" rx="16" ry="8"/>',
    ),
    "halo": draw(
        [(80, 40, 80, 86), (80, 52, 58, 66), (80, 52, 102, 66), (80, 86, 66, 108), (80, 86, 96, 108)],
        [(80, 28, 8)],
        '<path d="M62 24c18-16 36 0 36 12" />',
    ),
    "cat-cow": draw(
        [(40, 78, 110, 70), (48, 78, 48, 98), (100, 72, 100, 98)],
        [(118, 64, 8)],
        '<path d="M52 74c16 10 32 10 48-4"/>',
    ),
    "knee-rock": draw(
        [(30, 80, 120, 80), (80, 80, 70, 58), (70, 58, 90, 50), (86, 78, 100, 60)],
        [(124, 76, 8)],
    ),
    "thoracic": draw(
        [(44, 78, 108, 70), (52, 78, 52, 98), (96, 72, 96, 98), (70, 74, 96, 48)],
        [(114, 66, 8)],
    ),
    "side-lie": draw(
        [(36, 78, 112, 70), (80, 74, 100, 52)],
        [(118, 66, 8)],
    ),
}


def demo_for(name: str) -> str:
    lowered = name.lower()
    for needle, demo in RULES:
        if needle in lowered:
            return demo
    raise SystemExit(f"No illustration for {name}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for demo, markup in POSES.items():
        (OUT / f"{demo}.svg").write_text(markup, encoding="utf-8")
    plans = json.loads(PLANS.read_text(encoding="utf-8"))
    names = {}
    for session in plans["sessions"]:
        for exercise in session["exercises"]:
            for key in ("name", "regression", "progression", "advanced"):
                value = exercise.get(key)
                if value:
                    names[value] = demo_for(value)
    demos = {}
    for demo in POSES:
        video = VIDEOS.get(demo)
        entry = {
            "title": demo.replace("-", " "),
            "image": f"images/exercises/{demo}.svg",
        }
        if video:
            entry["video"] = video[0]
            entry["videoTitle"] = video[1]
            entry["videoBy"] = video[2]
        demos[demo] = entry
    payload = {
        "attribution": "Line drawings were created for FitTrack and are original. Demo links open YouTube videos that were checked with YouTube oEmbed on 2026-11-18. Some links are full routines that include the movement, not a single-move clip.",
        "demos": demos,
        "names": names,
    }
    DEMOS.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"{len(POSES)} drawings, {len(names)} names")


if __name__ == "__main__":
    main()
