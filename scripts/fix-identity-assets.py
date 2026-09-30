import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "static"
UA = (
    "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) "
    "AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1"
)


def download_font() -> None:
    text = urllib.parse.quote("Eat谁来开这间厨房我做饭点餐")
    css_url = "https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=" + text
    css = urllib.request.urlopen(
        urllib.request.Request(css_url, headers={"User-Agent": UA}),
        timeout=40,
    ).read().decode()
    start = css.index("url(") + 4
    end = css.index(")", start)
    font_url = css[start:end].strip("\"'")
    data = urllib.request.urlopen(
        urllib.request.Request(font_url, headers={"User-Agent": UA}),
        timeout=60,
    ).read()
    path = STATIC / "fonts" / "ma-shan-zheng.ttf"
    path.write_bytes(data)
    print("font", len(data))


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
