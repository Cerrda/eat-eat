import re
from pathlib import Path

root = Path(r"c:\project\eat-eat\src")
pat = re.compile(
    r'<image\s+class="([^"]*)"\s+src="/static/underline\.png"\s+mode="widthFix"\s*/>'
)


def repl(m: re.Match[str]) -> str:
    classes = m.group(1).split()
    width = None
    rest: list[str] = []
    for item in classes:
        found = re.fullmatch(r"w-(\d+)rpx", item)
        if found:
            width = found.group(1)
            continue
        if item == "block":
            continue
        rest.append(item)
    if width is None:
        raise SystemExit(f"no width in {m.group(0)}")
    if rest:
        return f'<ink-underline class="{" ".join(rest)}" :width="{width}" />'
    return f'<ink-underline :width="{width}" />'


changed: list[str] = []
for path in root.rglob("*.vue"):
    text = path.read_text(encoding="utf-8")
    new, count = pat.subn(repl, text)
    if count:
        path.write_text(new, encoding="utf-8", newline="\n")
        changed.append(f"{path.relative_to(root)} x{count}")

print("\n".join(changed) if changed else "none")
