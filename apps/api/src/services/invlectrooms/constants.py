from __future__ import annotations

CHECKPOINT_LEVEL_KEYWORDS = {
    "bronze": {"bronze"},
    "silver": {"silver", "silber"},
    "gold": {"gold"},
}

CHECKPOINT_IMAGE_PATTERNS = {
    "bronze": ("platypusbronze",),
    "silver": ("platypussilver", "platypussilber"),
    "gold": ("platypusgold",),
}

CHECKPOINT_MARKER_ASSETS = {
    "bronze": "Bronze.webp",
    "silver": "Silber.webp",
    "gold": "Gold.webp",
}

# Matches the front-end content map sprite scaling rules.
CONTENT_MAP_SPRITE_SCALE_FACTOR = 0.2

# Matches the front-end content map sprite scaling rules.
CHECKPOINT_MARKER_SCALES = {
    "bronze": 1.8,
    "silver": 1.8,
    "gold": 1.8,
}
