#!/usr/bin/env python3
"""Original two-step exercise diagrams for the FitTrack home plans.

Each SVG is drawn for this app (not traced from a photo or textbook). A filled
figure, clothing, and the real piece of equipment are shown in a start position
and a finish position, with an arrow and a short form cue. Colors follow the
phone's light or dark setting.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "images" / "exercises"
PLANS = ROOT / "data" / "plans.json"
DEMOS = ROOT / "data" / "exercise-demos.json"

# Body-space angle: 0 is up, 90 is toward the chest side, 180 is down.
TORSO = 54
NECK = 9
HEAD = 15
THIGH = 48
SHIN = 44
UPPER = 32
FORE = 28

RULES = [
    ("halo", "halo"),
    ("hammer", "curl"),
    ("clam", "clam"),
    ("bird dog", "bird-dog"),
    ("heel slide", "heel-slide"),
    ("dead bug", "dead-bug"),
    ("dumbbell glute", "db-bridge"),
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
    ("floor press", "floor-press"),
    ("bench press", "bench"),
    ("half-kneeling", "half-kneel-press"),
    ("press", "press"),
    ("row", "row"),
    ("suitcase", "suitcase"),
    ("farmer", "carry"),
    ("two-dumbbell deadlift", "hinge"),
    ("romanian", "hinge"),
    ("kettlebell deadlift", "kb-deadlift"),
    ("deadlift", "kb-deadlift"),
    ("hinge", "hinge"),
    ("rear-foot", "rfess"),
    ("split squat", "split"),
    ("bodyweight squat", "air-squat"),
    ("squat to a bench", "air-squat"),
    ("squat", "squat"),
]

VIDEOS = {
    "squat": ("https://www.youtube.com/watch?v=sOUCmU27mjE", "Whole Body Workout for Beginners", "OPEX Bristol"),
    "air-squat": ("https://www.youtube.com/watch?v=sOUCmU27mjE", "Whole Body Workout for Beginners", "OPEX Bristol"),
    "row": ("https://www.youtube.com/watch?v=sOUCmU27mjE", "Whole Body Workout for Beginners", "OPEX Bristol"),
    "hinge": ("https://www.youtube.com/watch?v=ZEnWV4kguKc", "How to do romanian deadlifts safely", "Jack Hanrahan Fitness"),
    "kb-deadlift": ("https://www.youtube.com/watch?v=ZEnWV4kguKc", "How to do romanian deadlifts safely", "Jack Hanrahan Fitness"),
    "bird-dog": ("https://www.youtube.com/watch?v=99ewh8IACrA", "Ultimate Ab & Core Workout: Bird Dog, Dead Bug, & Bridge", "Andrew's Fitness Training"),
    "dead-bug": ("https://www.youtube.com/watch?v=99ewh8IACrA", "Ultimate Ab & Core Workout: Bird Dog, Dead Bug, & Bridge", "Andrew's Fitness Training"),
    "heel-slide": ("https://www.youtube.com/watch?v=99ewh8IACrA", "Ultimate Ab & Core Workout: Bird Dog, Dead Bug, & Bridge", "Andrew's Fitness Training"),
    "bridge": ("https://www.youtube.com/watch?v=99ewh8IACrA", "Ultimate Ab & Core Workout: Bird Dog, Dead Bug, & Bridge", "Andrew's Fitness Training"),
    "db-bridge": ("https://www.youtube.com/watch?v=99ewh8IACrA", "Ultimate Ab & Core Workout: Bird Dog, Dead Bug, & Bridge", "Andrew's Fitness Training"),
    "cat-cow": ("https://www.youtube.com/watch?v=Dq1XBAkIZEM", "Adaptive Yoga for Kids", "National Center on Health, Physical Activity and Disability"),
    "halo": ("https://www.youtube.com/watch?v=Sci3lijQBmk", "Kettlebell Halo Tutorial", "Brittany van Schravendijk"),
    "carry": ("https://www.youtube.com/watch?v=y1r9toPQNkM", "8 Best Dumbbell Exercises Ever", "ATHLEAN-X"),
    "suitcase": ("https://www.youtube.com/watch?v=y1r9toPQNkM", "8 Best Dumbbell Exercises Ever", "ATHLEAN-X"),
    "split": ("https://www.youtube.com/watch?v=EAO2twIivhs", "35 Min Strength Training at Home Full Body Workout with Dumbbells", "HASfit"),
    "rfess": ("https://www.youtube.com/watch?v=EAO2twIivhs", "35 Min Strength Training at Home Full Body Workout with Dumbbells", "HASfit"),
}


def direction(deg: float) -> tuple[float, float]:
    rad = math.radians(deg)
    return (math.sin(rad), -math.cos(rad))


def add(p, d, length=1.0):
    return (p[0] + d[0] * length, p[1] + d[1] * length)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def chest_normal(torso_dir, sign, supine):
    x, y = torso_dir
    normal = (-y, x) if sign > 0 else (y, -x)
    if supine:
        normal = (-normal[0], -normal[1])
    return normal


def solve(pose, facing="right"):
    sign = 1 if facing == "right" else -1
    supine = bool(pose.get("supine"))

    def ang(key, default):
        return pose.get(key, default) * sign

    hip = (pose.get("x", 0.0), pose.get("y", 0.0) - pose.get("lift", 0))
    torso_dir = direction(ang("torso", 0))
    front = chest_normal(torso_dir, sign, supine)
    shoulder = add(hip, torso_dir, TORSO)
    neck = add(shoulder, torso_dir, NECK)
    head_dir = direction(ang("head", pose.get("torso", 0)))
    head = add(neck, head_dir, HEAD)
    knee = add(hip, direction(ang("thigh", 175)), THIGH)
    ankle = add(knee, direction(ang("shin", 178)), SHIN)
    elbow = add(shoulder, direction(ang("arm", 168)), UPPER)
    hand = add(elbow, direction(ang("forearm", 172)), FORE)
    far = add((0, 0), (-front[0], -front[1]), 11)
    far_hip = (hip[0] + far[0], hip[1] + far[1])
    far_shoulder = (shoulder[0] + far[0], shoulder[1] + far[1])
    far_knee = add(far_hip, direction(ang("far_thigh", pose.get("thigh", 178))), THIGH)
    far_ankle = add(far_knee, direction(ang("far_shin", pose.get("shin", 180))), SHIN)
    far_elbow = add(far_shoulder, direction(ang("far_arm", pose.get("arm", 188))), UPPER)
    far_hand = add(far_elbow, direction(ang("far_forearm", pose.get("forearm", 188))), FORE)
    foot_dir = (front[0], front[1])
    return {
        "hip": hip,
        "shoulder": shoulder,
        "neck": neck,
        "head": head,
        "knee": knee,
        "ankle": ankle,
        "elbow": elbow,
        "hand": hand,
        "far_hip": far_hip,
        "far_shoulder": far_shoulder,
        "far_knee": far_knee,
        "far_ankle": far_ankle,
        "far_elbow": far_elbow,
        "far_hand": far_hand,
        "front": front,
        "torso": torso_dir,
        "sign": sign,
        "supine": supine,
        "bow": pose.get("bow", 0),
    }


POINT_KEYS = {
    "hip", "shoulder", "neck", "head", "knee", "ankle", "elbow", "hand",
    "far_hip", "far_shoulder", "far_knee", "far_ankle", "far_elbow", "far_hand",
}


def translate(body, dx, dy):
    moved = {}
    for key, value in body.items():
        if key in POINT_KEYS:
            moved[key] = (value[0] + dx, value[1] + dy)
        else:
            moved[key] = value
    return moved


def lowest(body):
    ys = [body[key][1] for key in POINT_KEYS]
    ys.append(body["ankle"][1] + 14)
    ys.append(body["far_ankle"][1] + 14)
    return max(ys)


def fmt(n):
    return f"{n:.1f}"


def line(a, b, width, klass):
    return (
        f'<line x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(b[0])}" y2="{fmt(b[1])}" '
        f'stroke-width="{width}" class="{klass}"/>'
    )


def circle(c, r, klass, extra=""):
    return f'<circle cx="{fmt(c[0])}" cy="{fmt(c[1])}" r="{r}" class="{klass}" {extra}/>'


def limb(a, b, width, klass, shade):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy) or 1
    nx, ny = -dy / length, dx / length
    shift = width * 0.22
    hi_a = (a[0] + nx * shift, a[1] + ny * shift)
    hi_b = (b[0] + nx * shift, b[1] + ny * shift)
    return line(a, b, width, klass) + line(hi_a, hi_b, max(2.5, width * 0.28), shade)


def torso_path(body):
    hip, shoulder, front = body["hip"], body["shoulder"], body["front"]
    back = (-front[0], -front[1])
    hip_w, sh_w = (11, 14) if body.get("supine") else (16, 20)
    bow = body.get("bow", 0)
    hb = add(hip, back, hip_w)
    back_mid = add(lerp(hip, shoulder, 0.5), back, 6 + bow)
    hf = add(hip, front, hip_w * 0.85)
    sb = add(shoulder, back, sh_w * 0.75)
    sf = add(shoulder, front, sh_w)
    mid = lerp(hip, shoulder, 0.55)
    chest = add(mid, front, sh_w * 1.15 - bow * 0.35)
    upper = lerp(hip, shoulder, 0.28)
    belly = add(upper, front, hip_w * 0.95)
    return (
        f'M {fmt(hb[0])} {fmt(hb[1])} '
        f'Q {fmt(back_mid[0])} {fmt(back_mid[1])} '
        f'{fmt(sb[0])} {fmt(sb[1])} '
        f'L {fmt(sf[0])} {fmt(sf[1])} '
        f'Q {fmt(chest[0])} {fmt(chest[1])} {fmt(belly[0])} {fmt(belly[1])} '
        f'L {fmt(hf[0])} {fmt(hf[1])} Z'
    )


def head_shapes(body):
    center = body["head"]
    front = body["front"]
    up = body["torso"]
    parts = []
    hair_c = add(add(center, up, 3), (-front[0], -front[1]), 3)
    parts.append(circle(hair_c, HEAD + 1.5, "hair"))
    parts.append(circle(center, HEAD, "skin-fill"))
    ear = add(center, (-front[0], -front[1]), 8)
    parts.append(circle(ear, 4.2, "skin-fill"))
    parts.append(circle(ear, 2.2, "skin-line"))
    eye = add(add(center, front, 7), up, 2)
    parts.append(circle(eye, 1.5, "ink-fill"))
    nose = add(add(center, front, HEAD - 1), (0, 0), 0)
    parts.append(circle(nose, 2.4, "skin-shade"))
    mouth = add(add(center, front, 8), (-up[0], -up[1]), 5)
    parts.append(circle(mouth, 1.1, "ink-fill"))
    return "".join(parts)


def shoe(ankle, front, sign):
    toe = add(ankle, front, 18)
    heel = add(ankle, (-front[0], -front[1]), 7)
    sole = (0, 5)
    a = (heel[0], heel[1] + 2)
    b = (toe[0], toe[1] + 6)
    return (
        f'<path d="M {fmt(a[0])} {fmt(a[1])} Q {fmt(lerp(a, b, 0.5)[0])} {fmt(lerp(a, b, 0.5)[1] - 6)} '
        f'{fmt(b[0])} {fmt(b[1])} L {fmt(b[0])} {fmt(b[1] + 4)} L {fmt(a[0])} {fmt(a[1] + 5)} Z" class="shoe"/>'
    )


def draw_body(body):
    parts = []
    # Far side first.
    parts.append(limb(body["far_hip"], lerp(body["far_hip"], body["far_knee"], 0.45), 16, "shorts-line", "shorts-hi"))
    parts.append(limb(lerp(body["far_hip"], body["far_knee"], 0.4), body["far_knee"], 13, "shorts-line", "shorts-hi"))
    parts.append(limb(body["far_knee"], body["far_ankle"], 10, "skin-line", "skin-hi"))
    parts.append(limb(body["far_shoulder"], body["far_elbow"], 10, "shirt-line", "shirt-hi"))
    parts.append(limb(body["far_elbow"], body["far_hand"], 8, "skin-line", "skin-hi"))
    parts.append(circle(body["far_hand"], 4.5, "skin-fill"))
    parts.append(f'<path d="{torso_path(body)}" class="shirt-fill"/>')
    parts.append(limb(body["hip"], body["neck"], 8, "skin-line", "skin-hi"))
    parts.append(head_shapes(body))
    parts.append(limb(body["hip"], lerp(body["hip"], body["knee"], 0.42), 18, "shorts-line", "shorts-hi"))
    parts.append(limb(lerp(body["hip"], body["knee"], 0.38), body["knee"], 14, "skin-line", "skin-hi"))
    parts.append(limb(body["knee"], body["ankle"], 11, "skin-line", "skin-hi"))
    parts.append(circle(body["knee"], 6, "skin-fill"))
    parts.append(shoe(body["ankle"], body["front"], body["sign"]))
    parts.append(shoe(body["far_ankle"], body["front"], body["sign"]))
    parts.append(limb(body["shoulder"], body["elbow"], 12, "shirt-line", "shirt-hi"))
    parts.append(limb(lerp(body["shoulder"], body["elbow"], 0.55), body["elbow"], 11, "skin-line", "skin-hi"))
    parts.append(limb(body["elbow"], body["hand"], 9, "skin-line", "skin-hi"))
    parts.append(circle(body["elbow"], 5.5, "skin-fill"))
    parts.append(circle(body["hand"], 5.5, "skin-fill"))
    return "".join(parts)


def dumbbell(hand, along, scale=1.0):
    dx, dy = along
    length = math.hypot(dx, dy) or 1
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    gap = 11 * scale
    plate = 7 * scale
    a = (hand[0] - ux * gap, hand[1] - uy * gap)
    b = (hand[0] + ux * gap, hand[1] + uy * gap)
    return (
        line(a, b, 3.5 * scale, "metal")
        + circle(a, plate, "metal-fill")
        + circle(b, plate, "metal-fill")
        + circle(a, plate * 0.45, "metal-hi")
        + circle(b, plate * 0.45, "metal-hi")
    )


def kettlebell(hand, sign=1):
    bell = (hand[0], hand[1] + 16)
    return (
        f'<path d="M {fmt(hand[0] - 8)} {fmt(hand[1])} '
        f'Q {fmt(hand[0] - 10)} {fmt(hand[1] - 16)} {fmt(hand[0])} {fmt(hand[1] - 18)} '
        f'Q {fmt(hand[0] + 10)} {fmt(hand[1] - 16)} {fmt(hand[0] + 8)} {fmt(hand[1])}" class="kb-handle"/>'
        + circle(bell, 13, "kb-fill")
        + circle((bell[0] - 3, bell[1] - 3), 4, "kb-hi")
    )


def bench(x, y, length=92, incline=0):
    # y is the top of the pad. incline raises the head end (positive x).
    rise = incline
    return (
        f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{length}" height="12" rx="4" class="bench-pad" '
        f'transform="rotate({-rise} {fmt(x)} {fmt(y)})"/>'
        f'<rect x="{fmt(x + 10)}" y="{fmt(y + 12)}" width="8" height="28" class="bench-leg"/>'
        f'<rect x="{fmt(x + length - 18)}" y="{fmt(y + 12)}" width="8" height="28" class="bench-leg"/>'
    )


def mat(x, y, width=210):
    return f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{width}" height="10" rx="4" class="mat"/>'


def bike(x, y):
    # x,y is the seat contact. Recumbent: seat bucket, backrest, frame, pedals, wheels.
    return f'''
    <circle cx="{fmt(x - 48)}" cy="{fmt(y + 36)}" r="18" class="bike"/>
    <circle cx="{fmt(x - 48)}" cy="{fmt(y + 36)}" r="4" class="metal-fill"/>
    <circle cx="{fmt(x + 78)}" cy="{fmt(y + 30)}" r="14" class="bike"/>
    <path d="M {fmt(x - 48)} {fmt(y + 36)} L {fmt(x + 10)} {fmt(y + 8)} L {fmt(x + 70)} {fmt(y + 18)} L {fmt(x + 78)} {fmt(y + 30)}" class="bike"/>
    <path d="M {fmt(x - 6)} {fmt(y + 4)} L {fmt(x + 36)} {fmt(y - 8)}" class="bike"/>
    <rect x="{fmt(x - 8)}" y="{fmt(y - 8)}" width="34" height="10" rx="4" class="bench-pad"/>
    <path d="M {fmt(x - 6)} {fmt(y - 6)} L {fmt(x - 28)} {fmt(y - 36)}" class="bike"/>
    <rect x="{fmt(x - 40)}" y="{fmt(y - 48)}" width="22" height="28" rx="6" class="bench-pad" transform="rotate(-18 {fmt(x - 28)} {fmt(y - 30)})"/>
    <circle cx="{fmt(x + 46)}" cy="{fmt(y + 8)}" r="7" class="metal-fill"/>
    <line x1="{fmt(x + 46)}" y1="{fmt(y + 8)}" x2="{fmt(x + 58)}" y2="{fmt(y - 2)}" class="metal"/>
    '''


def place_gear(body, gear):
    chunks = []
    hand = body["hand"]
    along = (hand[0] - body["elbow"][0], hand[1] - body["elbow"][1])
    for item in gear:
        if item == "dumbbell":
            chunks.append(dumbbell(hand, along))
        elif item == "goblet":
            chunks.append(dumbbell((hand[0], hand[1] - 2), (0, -1), 1.05))
        elif item == "two-dumbbells":
            chunks.append(dumbbell(hand, (0, 1), 0.9))
            chunks.append(dumbbell(body["far_hand"], (0, 1), 0.85))
        elif item == "press-bells":
            chunks.append(dumbbell(hand, along, 0.8))
            far_along = (body["far_hand"][0] - body["far_elbow"][0], body["far_hand"][1] - body["far_elbow"][1])
            chunks.append(dumbbell(body["far_hand"], far_along, 0.75))
        elif item == "kettlebell":
            chunks.append(kettlebell(hand, body["sign"]))
        elif item == "halo-front":
            chunks.append(kettlebell((body["head"][0] + body["front"][0] * 20, body["head"][1] - 8)))
        elif item == "halo-back":
            chunks.append(kettlebell((body["head"][0] - body["front"][0] * 18, body["head"][1] - 4)))
    return "".join(chunks)


def scene_props(kind, origin_x, ground):
    if kind == "bench":
        return bench(origin_x - 40, ground - 36, 148)
    if kind == "bench-low":
        return bench(origin_x + 20, ground - 46, 110)
    if kind == "bench-behind":
        return bench(origin_x - 78, ground - 52, 70)
    if kind == "incline-bench":
        return bench(origin_x + 8, ground - 78, 100, 0)
    if kind == "mat":
        return mat(origin_x - 120, ground - 6, 240)
    if kind == "mat-short":
        return mat(origin_x - 70, ground - 6, 160)
    if kind == "bike":
        return bike(origin_x, ground - 48)
    if kind == "step":
        return bench(origin_x - 108, ground - 36, 52)
    return ""


def arrow(start, end):
    # The two figures sit 350px apart. Use the pose change, not the panel gap.
    dx, dy = end[0] - start[0] - 350, end[1] - start[1]
    length = math.hypot(dx, dy) or 1
    if length < 6:
        return ""
    ux, uy = dx / length, dy / length
    tip = end
    tail = (end[0] - ux * min(32, length), end[1] - uy * min(32, length))
    left = (tip[0] - ux * 8 - uy * 5, tip[1] - uy * 8 + ux * 5)
    right = (tip[0] - ux * 8 + uy * 5, tip[1] - uy * 8 - ux * 5)
    return (
        f'<line x1="{fmt(tail[0])}" y1="{fmt(tail[1])}" x2="{fmt(tip[0])}" y2="{fmt(tip[1])}" class="arrow"/>'
        f'<path d="M {fmt(left[0])} {fmt(left[1])} L {fmt(tip[0])} {fmt(tip[1])} L {fmt(right[0])} {fmt(right[1])}" class="arrow-head"/>'
    )


def halo_arrow(head):
    return (
        f'<path d="M {fmt(head[0] + 22)} {fmt(head[1] + 4)} '
        f'C {fmt(head[0] + 26)} {fmt(head[1] - 28)} {fmt(head[0] - 26)} {fmt(head[1] - 28)} {fmt(head[0] - 22)} {fmt(head[1] + 2)}" class="arrow"/>'
    )


STYLE = """
<style>
  .bg { fill: #eef3f8; }
  .panel { fill: #ffffff; }
  .ink { fill: #1d2836; }
  .muted { fill: #5c6b7e; }
  .skin-fill, .skin-line { fill: #f0c3a0; stroke: #f0c3a0; }
  .skin-shade { fill: #d9a47c; stroke: #d9a47c; }
  .skin-hi { stroke: #f6d8c0; fill: none; }
  .hair { fill: #4a342c; stroke: #4a342c; }
  .ink-fill { fill: #2a211c; stroke: none; }
  .shirt-fill, .shirt-line { fill: #3c72d4; stroke: #3c72d4; }
  .shirt-hi { stroke: #8eb0ee; fill: none; }
  .shorts-line { fill: #243246; stroke: #243246; }
  .shorts-hi { stroke: #66758a; fill: none; }
  .shoe { fill: #2c333c; stroke: none; }
  .metal, .metal-fill { fill: #667381; stroke: #4d5968; stroke-width: 3; stroke-linecap: round; }
  .metal-hi { fill: #c5ced8; stroke: none; }
  .kb-fill { fill: #3e4652; stroke: #2c333c; stroke-width: 2; }
  .kb-hi { fill: #8d97a6; stroke: none; }
  .kb-handle { fill: none; stroke: #3e4652; stroke-width: 4; stroke-linecap: round; }
  .bench-pad { fill: #31445c; stroke: none; }
  .bench-leg { fill: #243140; stroke: none; }
  .mat { fill: #1f9d8d; stroke: none; }
  .bike { fill: none; stroke: #314052; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
  .ground { stroke: #d5deea; stroke-width: 2; }
  .arrow { fill: none; stroke: #e15d2c; stroke-width: 3; stroke-linecap: round; }
  .arrow-head { fill: none; stroke: #e15d2c; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .cue { fill: #9a3b16; }
  text { font-family: "Segoe UI", Helvetica, Arial, sans-serif; }
  line, path { stroke-linecap: round; stroke-linejoin: round; }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #121820; }
    .panel { fill: #1b2430; }
    .ink { fill: #e7eef8; }
    .muted { fill: #a9b6c9; }
    .skin-fill, .skin-line { fill: #e7b892; stroke: #e7b892; }
    .skin-shade { fill: #c48b62; stroke: #c48b62; }
    .skin-hi { stroke: #f3d2b6; }
    .hair { fill: #6b4b3e; stroke: #6b4b3e; }
    .ink-fill { fill: #1a120f; }
    .shirt-fill, .shirt-line { fill: #6d97e8; stroke: #6d97e8; }
    .shirt-hi { stroke: #d5e3fb; }
    .shorts-line { fill: #d5deea; stroke: #d5deea; }
    .shorts-hi { stroke: #ffffff; }
    .shoe { fill: #dfe6f0; }
    .metal, .metal-fill { fill: #aeb8c6; stroke: #d5deea; }
    .metal-hi { fill: #eef3f8; }
    .kb-fill { fill: #c5ced8; stroke: #eef3f8; }
    .kb-hi { fill: #ffffff; }
    .kb-handle { stroke: #d5deea; }
    .bench-pad { fill: #8ea0b8; }
    .bench-leg { fill: #c5d0de; }
    .mat { fill: #3dbead; }
    .bike { stroke: #c5d2e2; }
    .ground { stroke: #314056; }
    .arrow, .arrow-head { stroke: #ffb089; }
    .cue { fill: #ffc2a4; }
  }
</style>
"""


def fit_body(pose, facing, anchor_x, ground):
    body = solve(pose, facing)
    if pose.get("anchor") == "back":
        back_y = max(body["hip"][1], body["shoulder"][1])
        drop = ground - 20 - back_y
    else:
        drop = ground - (lowest(body) + 4)
    return translate(body, anchor_x - body["hip"][0], drop)


def panel(title, body, gear, props, arrows, ox):
    parts = [f'<rect x="{ox + 8}" y="36" width="336" height="250" rx="16" class="panel"/>']
    parts.append(f'<text x="{ox + 24}" y="28" class="ink" font-size="15" font-weight="700">{title}</text>')
    ground = 268
    parts.append(f'<clipPath id="clip{ox}"><rect x="{ox + 10}" y="40" width="332" height="224" rx="12"/></clipPath>')
    parts.append(f'<g clip-path="url(#clip{ox})">')
    parts.append(f'<line x1="{ox + 24}" y1="{ground}" x2="{ox + 328}" y2="{ground}" class="ground"/>')
    for prop in props:
        if prop == "rear-foot-bench":
            parts.append(bench(body["far_ankle"][0] - 18, body["far_ankle"][1] - 4, 50))
        else:
            parts.append(scene_props(prop, body["hip"][0], ground))
    parts.append(draw_body(body))
    parts.append(place_gear(body, gear))
    parts.append("</g>")
    return "".join(parts), body


def build(exercise):
    ground = 268
    facing = exercise.get("facing", "right")
    start = fit_body(exercise["start"], facing, 150, ground)
    end = fit_body(exercise["end"], facing, 500, ground)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 320" role="img">', STYLE]
    svg.append('<rect width="680" height="320" rx="18" class="bg"/>')
    start_svg, start_body = panel("1  Start", start, exercise.get("gear", []), exercise.get("props", []), [], 0)
    end_svg, end_body = panel("2  Finish", end, exercise.get("end_gear", exercise.get("gear", [])), exercise.get("end_props", exercise.get("props", [])), [], 336)
    svg.append(start_svg)
    svg.append(end_svg)
    svg.append('<clipPath id="clip-cues"><rect x="0" y="0" width="680" height="286"/></clipPath>')
    svg.append('<g clip-path="url(#clip-cues)">')
    if exercise.get("halo"):
        svg.append(halo_arrow(end_body["head"]))
    for joint in exercise.get("arrows", ["hand"]):
        if joint in start_body and joint in end_body:
            svg.append(arrow(start_body[joint], end_body[joint]))
    svg.append("</g>")
    cue = exercise["cue"].replace("&", "&amp;")
    svg.append(f'<text x="340" y="308" text-anchor="middle" class="cue" font-size="13" font-weight="700">{cue}</text>')
    svg.append("</svg>")
    return "".join(svg)


def P(**kwargs):
    return kwargs


EXERCISES = [
    {
        "id": "squat",
        "title": "Goblet squat",
        "cue": "Sit between the hips. Knees over mid-foot.",
        "props": ["bench-behind"],
        "gear": ["goblet"],
        "arrows": ["hip", "knee"],
        "start": P(torso=4, head=2, arm=112, forearm=18, thigh=172, shin=176, far_arm=120, far_forearm=24),
        "end": P(torso=24, head=12, arm=100, forearm=8, thigh=112, shin=188, far_thigh=118, far_shin=190, far_arm=108, far_forearm=12),
    },
    {
        "id": "air-squat",
        "title": "Squat to a bench",
        "cue": "Reach the hips back toward the bench.",
        "props": ["bench-behind"],
        "gear": [],
        "arrows": ["hip"],
        "start": P(torso=2, arm=150, forearm=160, thigh=174, shin=176),
        "end": P(torso=28, head=16, arm=128, forearm=150, thigh=114, shin=186, far_thigh=120, far_shin=188),
    },
    {
        "id": "bench",
        "title": "Dumbbell bench press",
        "cue": "Feet down. Lower until the arms near the bench.",
        "props": ["bench"],
        "gear": ["press-bells"],
        "arrows": ["hand"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=155, forearm=-15, thigh=200, shin=130, far_arm=158, far_forearm=-12, far_thigh=198, far_shin=128),
        "end": P(torso=90, head=90, supine=True, anchor="back", arm=-8, forearm=-8, thigh=200, shin=130, far_arm=-4, far_forearm=-4, far_thigh=198, far_shin=128),
    },
    {
        "id": "floor-press",
        "title": "Dumbbell floor press",
        "cue": "Elbows stop on the mat.",
        "props": ["mat"],
        "gear": ["press-bells"],
        "arrows": ["hand"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=175, forearm=10, thigh=125, shin=35, far_arm=172, far_forearm=12, far_thigh=128, far_shin=38),
        "end": P(torso=90, head=90, supine=True, anchor="back", arm=35, forearm=10, thigh=125, shin=35, far_arm=38, far_forearm=12, far_thigh=128, far_shin=38),
    },
    {
        "id": "row",
        "title": "One-arm dumbbell row",
        "cue": "Pull the elbow to the hip, not the ceiling.",
        "props": ["bench-low"],
        "gear": ["dumbbell"],
        "arrows": ["elbow", "hand"],
        "start": P(torso=82, head=74, arm=168, forearm=172, thigh=168, shin=176, far_arm=125, far_forearm=145),
        "end": P(torso=82, head=74, arm=220, forearm=300, thigh=168, shin=176, far_arm=125, far_forearm=145),
    },
    {
        "id": "hinge",
        "title": "Dumbbell Romanian deadlift",
        "cue": "Soft knees. Push the hips back.",
        "props": [],
        "gear": ["two-dumbbells"],
        "arrows": ["hip", "hand"],
        "start": P(torso=6, arm=175, forearm=175, thigh=170, shin=176),
        "end": P(torso=68, head=62, arm=172, forearm=176, thigh=152, shin=170, far_arm=176, far_forearm=180, far_thigh=156, far_shin=172),
    },
    {
        "id": "kb-deadlift",
        "title": "Kettlebell deadlift",
        "cue": "Hinge, stand tall, set the bell down.",
        "props": [],
        "gear": ["kettlebell"],
        "arrows": ["hip", "hand"],
        "start": P(torso=68, head=62, arm=145, forearm=150, thigh=148, shin=170),
        "end": P(torso=3, arm=170, forearm=174, thigh=174, shin=176),
    },
    {
        "id": "press",
        "title": "Seated dumbbell press",
        "cue": "Sit tall. Press without shrugging.",
        "props": ["bench"],
        "gear": ["press-bells"],
        "arrows": ["hand"],
        "start": P(torso=-2, arm=95, forearm=8, thigh=112, shin=174, far_arm=100, far_forearm=10),
        "end": P(torso=-2, arm=2, forearm=2, thigh=112, shin=174, far_arm=6, far_forearm=6),
    },
    {
        "id": "half-kneel-press",
        "title": "Half-kneeling one-arm press",
        "cue": "Tall torso. Ribs stay down.",
        "props": ["mat-short"],
        "gear": ["dumbbell"],
        "arrows": ["hand"],
        "start": P(torso=2, arm=100, forearm=12, thigh=122, shin=174, far_thigh=-115, far_shin=-8, far_arm=172, far_forearm=176),
        "end": P(torso=2, arm=2, forearm=2, thigh=122, shin=174, far_thigh=-115, far_shin=-8, far_arm=172, far_forearm=176),
    },
    {
        "id": "dead-bug",
        "title": "Dead bug",
        "cue": "Low back stays gently down. Small reach.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["hand", "ankle"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=2, forearm=2, thigh=2, shin=-88, far_arm=6, far_forearm=4, far_thigh=6, far_shin=-84),
        "end": P(torso=90, head=90, supine=True, anchor="back", arm=85, forearm=85, thigh=145, shin=155, far_arm=4, far_forearm=4, far_thigh=4, far_shin=-86),
    },
    {
        "id": "heel-slide",
        "title": "Heel slide",
        "cue": "Slide the heel. Keep the range small.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["ankle"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=165, forearm=170, thigh=118, shin=42, far_thigh=122, far_shin=44),
        "end": P(torso=90, head=90, supine=True, anchor="back", arm=165, forearm=170, thigh=160, shin=168, far_thigh=122, far_shin=44),
    },
    {
        "id": "figure4",
        "title": "Figure-4 stretch",
        "cue": "Ankle over the knee. Do not press hard.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["ankle"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=50, forearm=30, thigh=115, shin=25, far_thigh=128, far_shin=48),
        "end": P(torso=90, head=90, supine=True, anchor="back", arm=240, forearm=210, thigh=108, shin=8, far_thigh=126, far_shin=46),
    },
    {
        "id": "bike",
        "title": "Recumbent bike",
        "cue": "Easy spin. You should be able to talk.",
        "props": ["bike"],
        "gear": [],
        "arrows": ["ankle"],
        "start": P(torso=-48, head=-40, arm=70, forearm=80, thigh=115, shin=40, far_thigh=70, far_shin=150, x=10),
        "end": P(torso=-48, head=-40, arm=70, forearm=80, thigh=70, shin=150, far_thigh=115, far_shin=40, x=10),
    },
    {
        "id": "open-book",
        "title": "Open book rotation",
        "cue": "Open the top arm only as far as the ribs allow.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["hand"],
        "start": P(torso=94, head=98, supine=True, anchor="back", arm=85, forearm=85, thigh=132, shin=38, far_arm=88, far_forearm=86, far_thigh=136, far_shin=40),
        "end": P(torso=94, head=60, supine=True, anchor="back", arm=-8, forearm=-8, thigh=132, shin=38, far_arm=88, far_forearm=86, far_thigh=136, far_shin=40),
    },
    {
        "id": "split",
        "title": "Split squat",
        "cue": "Short step. Front heel stays down.",
        "props": [],
        "gear": [],
        "end_gear": ["two-dumbbells"],
        "arrows": ["hip"],
        "start": P(torso=4, arm=168, forearm=172, thigh=128, shin=172, far_thigh=55, far_shin=125),
        "end": P(torso=8, arm=168, forearm=172, thigh=108, shin=176, far_thigh=42, far_shin=108),
    },
    {
        "id": "rfess",
        "title": "Rear-foot elevated split squat",
        "cue": "Back toes on the bench. Stay tall.",
        "props": ["rear-foot-bench"],
        "gear": [],
        "arrows": ["hip"],
        "start": P(torso=4, arm=172, forearm=176, thigh=128, shin=172, far_thigh=-78, far_shin=15),
        "end": P(torso=8, arm=172, forearm=176, thigh=108, shin=176, far_thigh=-95, far_shin=8),
    },
    {
        "id": "pushup",
        "title": "Incline push-up",
        "cue": "Body in one line. Bend the arms, then press.",
        "props": ["incline-bench"],
        "gear": [],
        "arrows": ["elbow"],
        "start": P(torso=52, head=48, arm=138, forearm=148, thigh=232, shin=230, far_arm=140, far_forearm=150, far_thigh=234, far_shin=232),
        "end": P(torso=56, head=52, arm=175, forearm=205, thigh=236, shin=232, far_arm=178, far_forearm=208, far_thigh=238, far_shin=234),
    },
    {
        "id": "bridge",
        "title": "Glute bridge",
        "cue": "Drive through the heels. Ribs stay down.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["hip"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=185, forearm=180, thigh=45, shin=155, far_thigh=48, far_shin=158),
        "end": P(torso=125, head=115, supine=True, anchor="back", arm=190, forearm=185, thigh=60, shin=165, far_thigh=64, far_shin=168),
    },
    {
        "id": "db-bridge",
        "title": "Dumbbell glute bridge",
        "cue": "The bell rests on the hips. Skip it if the abdomen strains.",
        "props": ["mat"],
        "gear": ["dumbbell"],
        "arrows": ["hip"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=160, forearm=150, thigh=45, shin=155, far_thigh=48, far_shin=158),
        "end": P(torso=125, head=115, supine=True, anchor="back", arm=165, forearm=155, thigh=60, shin=165, far_thigh=64, far_shin=168),
    },
    {
        "id": "carry",
        "title": "Farmer march",
        "cue": "Tall posture. Short steps. Modest load.",
        "props": [],
        "gear": ["two-dumbbells"],
        "arrows": ["ankle"],
        "start": P(torso=2, arm=172, forearm=176, thigh=155, shin=170, far_thigh=195, far_shin=185),
        "end": P(torso=2, arm=172, forearm=176, thigh=198, shin=184, far_thigh=152, far_shin=168),
    },
    {
        "id": "suitcase",
        "title": "Suitcase march",
        "cue": "One kettlebell. Do not lean over.",
        "props": [],
        "gear": ["kettlebell"],
        "arrows": ["ankle"],
        "start": P(torso=0, arm=174, forearm=176, thigh=158, shin=170, far_arm=176, far_thigh=196, far_shin=184),
        "end": P(torso=0, arm=174, forearm=176, thigh=196, shin=184, far_thigh=156, far_shin=170),
    },
    {
        "id": "bird-dog",
        "title": "Bird dog",
        "cue": "Hips level. Reach only as far as the back stays quiet.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["hand", "ankle"],
        "start": P(torso=90, head=82, arm=175, forearm=178, thigh=175, shin=-85, far_arm=176, far_forearm=178, far_thigh=176, far_shin=-82),
        "end": P(torso=90, head=78, arm=72, forearm=70, thigh=-78, shin=-74, far_arm=176, far_forearm=178, far_thigh=176, far_shin=-82),
    },
    {
        "id": "hip-flexor",
        "title": "Hip flexor stretch",
        "cue": "Half kneeling. A small pelvic tuck. Skip if it pulls.",
        "props": ["mat-short"],
        "gear": [],
        "arrows": ["hip"],
        "start": P(torso=6, arm=165, forearm=150, thigh=122, shin=174, far_thigh=-115, far_shin=-8),
        "end": P(torso=0, arm=155, forearm=140, thigh=120, shin=174, far_thigh=-125, far_shin=-6),
    },
    {
        "id": "ankle",
        "title": "Ankle rocks",
        "cue": "Hold the bench. Knee tracks over the toes.",
        "props": ["bench-low"],
        "gear": [],
        "arrows": ["knee"],
        "start": P(torso=4, arm=80, forearm=70, thigh=165, shin=175, far_arm=150, far_thigh=172),
        "end": P(torso=16, arm=78, forearm=68, thigh=130, shin=155, far_arm=150, far_thigh=172),
    },
    {
        "id": "curl",
        "title": "Seated hammer curl",
        "cue": "Elbows stay near the ribs.",
        "props": ["bench"],
        "gear": ["two-dumbbells"],
        "arrows": ["hand"],
        "start": P(torso=-2, arm=165, forearm=170, thigh=112, shin=174, far_arm=168, far_forearm=172),
        "end": P(torso=-2, arm=150, forearm=40, thigh=112, shin=174, far_arm=155, far_forearm=45),
    },
    {
        "id": "clam",
        "title": "Side-lying clam",
        "cue": "Hips stacked. Heels together. Small lift.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["knee"],
        "start": P(torso=96, head=100, supine=True, anchor="back", arm=40, forearm=30, thigh=130, shin=40, far_thigh=134, far_shin=42),
        "end": P(torso=96, head=100, supine=True, anchor="back", arm=40, forearm=30, thigh=70, shin=20, far_thigh=134, far_shin=42),
    },
    {
        "id": "hamstring",
        "title": "Hamstring stretch",
        "cue": "Hold the thigh. Keep a small bend in the knee.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["hand"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=150, forearm=130, thigh=120, shin=160, far_thigh=125, far_shin=165),
        "end": P(torso=90, head=90, supine=True, anchor="back", arm=230, forearm=210, thigh=250, shin=230, far_thigh=125, far_shin=165),
    },
    {
        "id": "breathe",
        "title": "Quiet breathing",
        "cue": "One hand on the belly. Easy breaths, no brace.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["hand"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=155, forearm=210, thigh=50, shin=155, far_thigh=52, far_shin=158),
        "end": P(torso=90, head=90, supine=True, anchor="back", arm=150, forearm=200, thigh=50, shin=155, far_thigh=52, far_shin=158, bow=-8),
    },
    {
        "id": "halo",
        "title": "Kettlebell halo",
        "cue": "Circle the bell slowly. Keep the ribs stacked.",
        "props": [],
        "gear": ["halo-front"],
        "end_gear": ["halo-back"],
        "halo": True,
        "arrows": [],
        "start": P(torso=0, arm=70, forearm=20, thigh=174, shin=176, far_arm=80, far_forearm=30),
        "end": P(torso=0, arm=40, forearm=-20, thigh=174, shin=176, far_arm=50, far_forearm=-10),
    },
    {
        "id": "cat-cow",
        "title": "Cat-cow",
        "cue": "Hands under shoulders. Move with the breath.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["head"],
        "start": P(torso=90, head=140, arm=175, forearm=178, thigh=175, shin=-85, far_arm=176, far_forearm=178, far_thigh=176, far_shin=-82, bow=26),
        "end": P(torso=88, head=35, arm=175, forearm=178, thigh=175, shin=-85, far_arm=176, far_forearm=178, far_thigh=176, far_shin=-82, bow=-22),
    },
    {
        "id": "knee-rock",
        "title": "Supine knee rocks",
        "cue": "Knees bent. Rock them a small way side to side.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["knee"],
        "start": P(torso=90, head=90, supine=True, anchor="back", arm=20, forearm=15, thigh=55, shin=155, far_thigh=58, far_shin=158),
        "end": P(torso=100, head=105, supine=True, anchor="back", arm=25, forearm=18, thigh=80, shin=175, far_thigh=70, far_shin=165),
    },
    {
        "id": "thoracic",
        "title": "Thoracic reach",
        "cue": "On all fours. Rotate only as far as the neck stays easy.",
        "props": ["mat"],
        "gear": [],
        "arrows": ["hand"],
        "start": P(torso=90, head=82, arm=175, forearm=178, thigh=175, shin=-85, far_arm=176, far_forearm=178, far_thigh=176, far_shin=-82),
        "end": P(torso=90, head=40, arm=-15, forearm=-10, thigh=175, shin=-85, far_arm=176, far_forearm=178, far_thigh=176, far_shin=-82),
    },
    {
        "id": "side-lie",
        "title": "Side-lying wind-down",
        "cue": "Top knee bent on the mat. Breathe, then switch.",
        "props": ["mat"],
        "gear": [],
        "arrows": [],
        "start": P(torso=94, head=96, supine=True, anchor="back", arm=40, forearm=30, thigh=130, shin=40, far_thigh=150, far_shin=165),
        "end": P(torso=94, head=100, supine=True, anchor="back", arm=25, forearm=18, thigh=125, shin=35, far_thigh=155, far_shin=168),
    },
]


def demo_for(name: str) -> str:
    lowered = name.lower()
    for needle, demo in RULES:
        if needle in lowered:
            return demo
    raise SystemExit(f"No illustration for {name}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ids = []
    for exercise in EXERCISES:
        markup = build(exercise)
        (OUT / f"{exercise['id']}.svg").write_text(markup, encoding="utf-8")
        ids.append(exercise["id"])
    # Drop any previous stick-figure file that this set no longer uses.
    for path in OUT.glob("*.svg"):
        if path.stem not in ids:
            path.unlink()
    plans = json.loads(PLANS.read_text(encoding="utf-8"))
    names = {}
    for session in plans["sessions"]:
        for exercise in session["exercises"]:
            for key in ("name", "regression", "progression", "advanced"):
                value = exercise.get(key)
                if value:
                    names[value] = demo_for(value)
    demos = {}
    for exercise in EXERCISES:
        video = VIDEOS.get(exercise["id"])
        entry = {"title": exercise["title"], "image": f"images/exercises/{exercise['id']}.svg"}
        if video:
            entry["video"] = video[0]
            entry["videoTitle"] = video[1]
            entry["videoBy"] = video[2]
        demos[exercise["id"]] = entry
    payload = {
        "attribution": "Form diagrams were drawn for FitTrack. They are original filled illustrations, not copied photos. Demo links open YouTube videos checked with YouTube oEmbed on 2026-11-18. Some links are full routines that include the movement.",
        "demos": demos,
        "names": names,
    }
    DEMOS.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    sizes = [(OUT / f"{i}.svg").stat().st_size for i in ids]
    print(f"{len(ids)} diagrams, {len(names)} names, largest {max(sizes)} bytes, total {sum(sizes)} bytes")


if __name__ == "__main__":
    main()
