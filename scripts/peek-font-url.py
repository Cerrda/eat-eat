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
data = module.call(
    "/?download_url",
    config,
    method="POST",
    data={"file_list": [{"file_id": "eat/fonts/ma-shan-zheng.ttf", "expire": 600}]},
)
url = data["file_list"][0]["download_url"]
plain = url.split("?")[0]

def peek(label, target):
    request = urllib.request.Request(target, headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-15"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            chunk = response.read(16)
            print(label, response.status, response.headers.get("Content-Type"), chunk[:8])
    except Exception as error:
        print(label, type(error).__name__, error)

peek("signed", url)
peek("plain", plain)
