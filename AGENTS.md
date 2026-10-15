# EatEat 项目说明

当前正在开发的是**微信小程序**（uni-app，目标平台 `mp-weixin`）。页面运行在微信开发者工具模拟器里，不是浏览器里的 H5。

## 查看页面

需要查看、验收、截图或操作页面时，使用 **wechat-devtools MCP**（配置名 `wechat-devtools`，命名空间 `project-0-eat-eat-wechat-devtools`），并先阅读 `.agents/skills/wechatide-skill/SKILL.md`，再按场景进入对应子技能。

- 编译、打开页面、刷新模拟器：`compiler`
- 点击、输入、滚动、断言：`automator`
- console、network、截图：`debugger`

不要用浏览器工具打开 H5 开发服务器，也不要把 H5 页面当成验收结果。`dev:h5`、localhost 网页预览、cursor-ide-browser 都不用于查看本项目页面。

## 样式

页面样式尽量用 UnoCSS 写在 `class` 上（`presetUni`，可用 `rpx`，如 `px-42rpx`、`text-29rpx`）。`<style>` 只保留原子类表达不了的部分：`@font-face`、`page` 选择器，以及必须具名的 `hover-class`。具名类用 `--at-apply` 组合工具类。

文本输入一律用 `textarea`，不要用 `input`。微信小程序里给 `input` 设置的字体不会作用到已输入的文字；单行也用 `textarea`，用 `auto-height` 或固定高度收成一行。

## 设计稿与代码

会改变页面展示的改动（布局、文案、组件外观、新增或去掉界面上的一块），先在设计稿 `design/design.pen` 上设计，等用户确认没问题后再写页面代码。不改变页面上能看到的内容时，直接改代码。

设计时使用 pencil MCP（命名空间 `project-0-eat-eat-pencil`）：先调用 `read_skill` 阅读设计技能并按它执行，再改设计稿。`.pen` 只能通过该 MCP 读写，不要用 Read、Grep 直接打开。

用户确认设计之后，再改对应的页面代码。
