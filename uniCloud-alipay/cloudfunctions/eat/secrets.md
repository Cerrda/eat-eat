# 云函数密钥

复制 `secrets.example.json` 为同目录的 `secrets.local.json`，填上 `secret` 后随云函数上传。`secrets.local.json` 已被 git 忽略，不要提交。

云函数用 `JSON.parse` 读取 `secrets.local.json`，文件里不能写注释。

环境变量优先于文件：`WX_APPID`、`WX_SECRET`、`WX_MP_STATE` 有值时，会盖过同名字段。

## appid

小程序 AppID。登录时向微信换 openid，发订阅消息时换 access_token。与 `src/manifest.json` 里 `mp-weixin.appid` 保持一致。

## secret

小程序 AppSecret。在微信公众平台「开发 → 开发管理 → 开发设置」查看。登录，以及给做饭的人发「待办事项提醒」，都用它向微信要凭证。只写在 `secrets.local.json` 或云函数环境变量 `WX_SECRET` 里。

## miniprogramState

对方点开订阅消息后进入的小程序版本。不影响消息能不能发出去。

- `developer`：开发版。开发者工具或预览时用这个。不写、写空、或写成这三项以外的值时，也按 `developer`。
- `trial`：体验版。
- `formal`：已发布的正式版。

也可用环境变量 `WX_MP_STATE`。
