import re
from html.parser import HTMLParser
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

PROP_FONT = {
    "screen-head": {"title": "display", "kicker": "body"},
    "ink-load": {"label": "display"},
    "back-bar": {"label": "body"},
}
SLOT_FONT = {
    "stamp-button": "body-medium",
}
STRING_RE = re.compile(r"'([^'\\]{0,120})'|\"([^\"\\]{0,120})\"")


class TemplateParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[list] = []
        self.items: list[tuple[str, str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key: value or "" for key, value in attrs}
        classes = " ".join(value for key, value in attr.items() if "class" in key)
        fonts: list[str] = []
        if "font-display" in classes:
            fonts.append("display")
        if "font-body" in classes:
            fonts.append("body-medium" if "font-medium" in classes else "body")
        self.stack.append([tag, fonts, []])
        for name, font in PROP_FONT.get(tag, {}).items():
            if attr.get(name):
                self.items.append((font, attr[name], "prop"))
            for key in (f":{name}", f"v-bind:{name}"):
                if key in attr:
                    self.items.append((font, attr[key], "bind"))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        if self.stack:
            self.stack[-1][2].append(data)

    def handle_endtag(self, tag: str) -> None:
        while self.stack:
            current, fonts, parts = self.stack.pop()
            text = "".join(parts)
            if fonts and text.strip():
                for font in fonts:
                    self.items.append((font, text, "text"))
            if current == tag and current in SLOT_FONT and text.strip():
                self.items.append((SLOT_FONT[current], text, "slot"))
            if current == tag:
                break


def literals(expr: str) -> list[str]:
    found: list[str] = []
    for match in STRING_RE.finditer(expr):
        found.append(match.group(1) if match.group(1) is not None else match.group(2))
    return found


def keep(char: str) -> bool:
    return ord(char) > 32 and not char.isspace()


def collect_static() -> str:
    chars: set[str] = set()
    for path in SRC.rglob("*"):
        if path.suffix not in {".vue", ".ts"} or "node_modules" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        chars.update(char for char in text if keep(char) and not char.isascii())
        for match in STRING_RE.finditer(text):
            literal = match.group(1) if match.group(1) is not None else match.group(2)
            chars.update(char for char in literal if keep(char))
    chars.update("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
    chars.update("Eat ·/-—–…，。、！？：；「」『』（）()【】[]·✓‹›×")
    return "".join(sorted(chars))


def main() -> None:
    buckets = {"display": set(), "body": set(), "body-medium": set()}
    dynamic: list[tuple[str, str, str]] = []
    for path in SRC.rglob("*.vue"):
        html = path.read_text(encoding="utf-8")
        match = re.search(r"<template>(.*)</template>", html, re.DOTALL)
        if not match:
            continue
        parser = TemplateParser()
        parser.feed(match.group(1))
        parser.close()
        for font, text, kind in parser.items:
            if kind == "bind":
                found = literals(text)
                if found:
                    for item in found:
                        buckets.setdefault(font, set()).update(item)
                else:
                    dynamic.append((font, path.as_posix(), text.strip()[:100]))
                continue
            plain = re.sub(r"\{\{.*?\}\}", "", text, flags=re.DOTALL)
            buckets.setdefault(font, set()).update(plain)
            for expr in re.findall(r"\{\{(.*?)\}\}", text, flags=re.DOTALL):
                found = literals(expr)
                if found:
                    for item in found:
                        buckets.setdefault(font, set()).update(item)
                else:
                    dynamic.append((font, path.as_posix(), " ".join(expr.split())[:100]))

    static = collect_static()
    print("static", len(static))
    print(static)
    print()
    finite = (
        "今天明天后天早上中午晚上待接单已接单已拒绝已取消已完成"
        "做饭的人点餐的人的厨房这间"
        "0123456789-·/✓‹"
        "ABCDEFGHJKLMNPQRSTUVWXYZ"
    )
    buckets["display"].update(finite)
    buckets["body"].update(finite)
    buckets["body-medium"].update(finite)

    loaded = {
        "display": TTFont(ROOT / "fonts/ma-shan-zheng.ttf").getBestCmap() or {},
        "body": TTFont(ROOT / "fonts/lxgw-wenkai.ttf").getBestCmap() or {},
        "body-medium": TTFont(ROOT / "fonts/lxgw-wenkai-medium.ttf").getBestCmap() or {},
    }
    for name, chars in buckets.items():
        needed = {char for char in chars if keep(char)}
        missing = "".join(sorted(char for char in needed if ord(char) not in loaded[name]))
        print(f"=== {name} needed {len(needed)} missing {len(missing)}")
        print(missing)
        print()
    print("--- dynamic ---")
    for font, path, expr in dynamic:
        print(f"{font}\t{path}\t{expr}")


if __name__ == "__main__":
    main()
