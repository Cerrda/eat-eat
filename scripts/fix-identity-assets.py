from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "static"


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
    underline()
