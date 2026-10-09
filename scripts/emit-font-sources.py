import base64
from pathlib import Path

root = Path("fonts")
out = Path("src/utils/font-sources.ts")
files = {
    "maShanZheng": "ma-shan-zheng.ttf",
    "lxgwWenKai": "lxgw-wenkai.ttf",
    "lxgwWenKaiMedium": "lxgw-wenkai-medium.ttf",
    "longCang": "long-cang.ttf",
}
parts = []
for name, filename in files.items():
    data = (root / filename).read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    parts.append(f"export const {name} = '{encoded}'\n")
    print(name, len(data), len(encoded))
out.write_text("".join(parts), encoding="utf-8")
print("wrote", out, out.stat().st_size)
