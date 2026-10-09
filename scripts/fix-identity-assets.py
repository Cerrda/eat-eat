import re
import tempfile
import urllib.request
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
STATIC = ROOT / "src" / "static"
UA = "Mozilla/5.0"
STRING_RE = re.compile(r"'([^'\\]{0,200})'|\"([^\"\\]{0,200})\"")
SOURCES = {
    "ma-shan-zheng.ttf": "https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
    "lxgw-wenkai.ttf": "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf",
    "lxgw-wenkai-medium.ttf": "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Medium.ttf",
}


def keep(char: str) -> bool:
    code = ord(char)
    if "0" <= char <= "9" or "A" <= char <= "Z" or "a" <= char <= "z":
        return True
    if char in "·/-—–…，。、！？：；「」『』（）【】✓‹›×":
        return True
    if 0x4E00 <= code <= 0x9FFF or 0x3000 <= code <= 0x303F or 0xFF00 <= code <= 0xFFEF:
        return True
    return False


def ui_text() -> str:
    chars: set[str] = set()
    for path in SRC.rglob("*"):
        if path.suffix not in {".vue", ".ts"}:
            continue
        text = path.read_text(encoding="utf-8")
        chars.update(char for char in text if keep(char) and not char.isascii())
        for match in STRING_RE.finditer(text):
            literal = match.group(1) if match.group(1) is not None else match.group(2)
            chars.update(char for char in literal if keep(char))
    for path in (ROOT / "fonts").glob("*.ttf"):
        cmap = TTFont(path).getBestCmap() or {}
        chars.update(chr(code) for code in cmap if code >= 32 and keep(chr(code)))
    chars.update("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
    return "".join(sorted(chars))


def download(url: str, dest: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=120) as response, dest.open("wb") as handle:
        while True:
            chunk = response.read(1024 * 256)
            if not chunk:
                break
            handle.write(chunk)


def subset_font(source: Path, dest: Path, text: str) -> None:
    font = TTFont(source)
    options = Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recommended_glyphs = True
    options.hinting = False
    subsetter = Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.save(dest)


def download_font() -> None:
    text = ui_text()
    font_dir = ROOT / "fonts"
    with tempfile.TemporaryDirectory() as temporary:
        cache = Path(temporary)
        for name, url in SOURCES.items():
            source = cache / name
            print("download", name)
            download(url, source)
            dest = font_dir / name
            subset_font(source, dest, text)
            cmap = TTFont(dest).getBestCmap() or {}
            missing = "".join(char for char in text if ord(char) not in cmap and not char.isascii())
            print("font", name, dest.stat().st_size, "glyphs", len(cmap), "missing", missing or "-")


def underline() -> None:
    image = Image.open(STATIC / "I0iSI1.png").convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            ink = red + green + blue
            if ink < 28:
                pixels[x, y] = (0, 0, 0, 0)
            elif ink < 110:
                pixels[x, y] = (red, green, blue, int((ink - 28) / 82 * 255))
    box = image.getbbox()
    if box:
        image = image.crop(box)
    dest = STATIC / "underline.png"
    image.save(dest)
    print("underline", image.size, dest.stat().st_size)


if __name__ == "__main__":
    download_font()
    underline()
