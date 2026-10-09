import urllib.request
from pathlib import Path

DEST = Path("tmp-fonts")
DEST.mkdir(exist_ok=True)
FILES = {
    "ma-shan-zheng.ttf": "https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
    "long-cang.ttf": "https://github.com/google/fonts/raw/main/ofl/longcang/LongCang-Regular.ttf",
    "lxgw-wenkai.ttf": "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf",
    "lxgw-wenkai-medium.ttf": "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Medium.ttf",
}


def download(name: str, url: str) -> None:
    dest = DEST / name
    if dest.exists() and dest.stat().st_size > 100_000:
        print("have", name, dest.stat().st_size)
        return
    print("get", name)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=180) as response:
        dest.write_bytes(response.read())
    print("saved", name, dest.stat().st_size)


for filename, source in FILES.items():
    download(filename, source)
