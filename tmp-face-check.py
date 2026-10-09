import re
from pathlib import Path

text = Path(r"c:\project\eat-eat\src\utils\face.ts").read_text(encoding="utf-8")
serif = re.search(r"const SERIF = '(.*)'", text).group(1)
sans = re.search(r"const SANS = '(.*)'", text).group(1)
mono = re.search(r"const MONO = '(.*)'", text).group(1)
samples = ["编辑", "分类", "管理分类", "简介", "先不归", "写下这道菜", "0 步", "简介和步骤至少写一项", "‹"]
for sample in samples:
    for name, bag in (("serif", serif), ("sans", sans), ("mono", mono)):
        miss = "".join(ch for ch in sample if ch not in " \n" and ch not in bag)
        print(f"{name:5} {sample} {'OK' if not miss else 'MISS ' + miss}")
