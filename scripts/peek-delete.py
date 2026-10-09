import importlib.util
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
for name in (
    "lxgw-wenkai.ttf",
    "lxgw-wenkai-medium.ttf",
    "long-cang.ttf",
):
    result = module.call("/?delete", config, method="POST", data={"file_list": [f"eat/fonts/{name}"]})
    print(name, result["file_list"][0].get("result_message"))
