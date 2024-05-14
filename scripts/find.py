import json
from pathlib import Path

FOLDER = Path(__file__).parent.parent / "res"


def to_item(path: Path):
    return {
        "name": path.stem,
        "imagePath": path.relative_to(FOLDER).as_posix(),
        "description": "",
        "points": 0,
    }


folder_name_map = {
    "种族": "species",
    "性别": "genders",
    "世界局势": "worldSituations",
    "开局状态": "initialStatuses",
    "居民风貌": "residentStyles",
    "特质": "traits",
}

basic_ability_name_map = {
    "力量": "power",
    "魔力": "magic",
    "智力": "intelligence",
    "体质": "physique",
    "魅力": "charm",
    "运气": "luck",
}

final = {
    "version": 0,
    "fonts": [],
    "species": [],
    "genders": [],
    "worldSituations": [],
    "initialStatuses": [],
    "residentStyles": [],
    "basicAbilities": {},
    "traits": [],
}

for i, path in enumerate((x for x in (FOLDER / "fonts").iterdir() if x.is_file()), 1):
    final["fonts"].append(
        {
            "name": f"Custom{i}",
            "path": path.relative_to(FOLDER).as_posix(),
        }
    )

for folder_name, key in folder_name_map.items():
    folder = FOLDER / folder_name
    items = [to_item(path) for path in folder.glob("*.png")]
    final[key] = items

for ability_name, key in basic_ability_name_map.items():
    folder = FOLDER / "基础能力" / ability_name
    items = [to_item(path) for path in folder.glob("*.png")]
    final["basicAbilities"][key] = items

(FOLDER / "manifest_base.json").write_text(
    json.dumps(final, ensure_ascii=False, indent=2),
    "u8",
)
