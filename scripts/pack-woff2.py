from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path("tmp-fonts")
NAMES = [
    "ma-shan-zheng.ttf",
    "long-cang.ttf",
    "lxgw-wenkai.ttf",
    "lxgw-wenkai-medium.ttf",
]

for name in NAMES:
    source = ROOT / name
    dest = source.with_suffix(".woff2")
    print("pack", name, source.stat().st_size)
    font = TTFont(source)
    font.flavor = "woff2"
    font.save(dest)
    font.close()
    print("woff2", dest.name, dest.stat().st_size)
