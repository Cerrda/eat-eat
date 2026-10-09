import importlib.util
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location("upload_fonts", Path("scripts/upload-fonts.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

env = module.read_env()
config = {
    "spaceId": env["UNICLOUD_SPACE_ID"],
    "appId": env["UNICLOUD_SPACE_APP_ID"],
    "access": env["UNICLOUD_ACCESS_KEY"],
    "secret": env["UNICLOUD_SECRET_KEY"],
    "endpoint": f"https://{env['UNICLOUD_SPACE_ID']}.api-hz.cloudbasefunction.cn",
}

def peek(name: str) -> None:
    url = f"https://env-00jy6u6u3cps.normal.cloudstatic.cn/eat/fonts/{name}"
    request = urllib.request.Request(url, headers={"Range": "bytes=0-3", "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        print(name, response.status, response.read(4))

for name in (
    "ma-shan-zheng.woff2",
    "lxgw-wenkai.woff2",
    "lxgw-wenkai-medium.woff2",
    "long-cang.woff2",
):
    peek(name)

for name in (
    "ma-shan-zheng.ttf",
    "lxgw-wenkai.ttf",
    "lxgw-wenkai-medium.ttf",
    "long-cang.ttf",
):
    try:
        module.call(f"/{name.replace('.ttf', '') and 'eat/fonts/' + name}", config, method="DELETE")
        print("deleted", name)
    except Exception as error:
        print("delete failed", name, type(error).__name__, error)
