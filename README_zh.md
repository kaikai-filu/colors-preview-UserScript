# Color Preview Swatch 🎨 — 颜色预览色块

> 一款 Tampermonkey / Violentmonkey 用户脚本，自动检测网页中的颜色代码，并在旁边显示可点击的颜色预览色块。

[English Documentation](README.md)

## ✨ 功能特性

- 🔍 **全面的颜色检测** — 支持 Hex（`#RGB`、`#RRGGBB`、`#RGBA`、`#RRGGBBAA`）、`rgb()`/`rgba()`、`hsl()`/`hsla()` 以及 **148 种 CSS 命名颜色**，命名颜色使用精确白名单 + 反向 Lookbehind 避免误匹配
- 🟦 **内联色块预览** — 在每个检测到的颜色值旁插入 14×14 px 圆角色块。背景直接使用原始颜色字符串（浏览器原生 CSS 引擎解析所有格式）
- 🏁 **透明度展示** — 半透明颜色下方显示棋盘格图案，HSLA/RGBA 的 alpha 通道自然呈现
- 🖱️ **悬停提示** — 显示原始颜色值 + 解析后的 `rgba(R, G, B, A)` 数值（通过 canvas 像素回读）
- 📋 **点击复制** — 点击任意色块即可复制原始颜色值到剪贴板（带绿色闪烁反馈）
- 🌓 **暗黑模式兼容** — 边框颜色根据色块亮度自动调整（亮色块用深色边框，暗色块用浅色边框）
- ⚡ **SPA 适配** — `MutationObserver` + 防抖机制，处理动态加载内容（React、Vue、评论、实时代码等）
- 📝 **代码区域可用** — 在 `<pre>`、`<code>` 和语法高亮区域中正常工作
- 🎛️ **全局开关** — `Alt+C` 或 `Ctrl+Shift+C` 快速切换开关；Tampermonkey 菜单命令并动态显示当前状态
- 💾 **状态持久化** — 开关偏好跨页面刷新保持（通过 `GM_setValue`/`GM_getValue`）
- 🛡️ **精确匹配 & 安全** — 自动跳过 `<script>`、`<style>`、`<input>`、`<textarea>` 和 `contenteditable` 区域。命名颜色使用反向 Lookbehind `(?<![\w-])` 避免在 CSS 类名中误匹配（如 `text-red-500`、`--red`、`non-red`）

## 🎯 支持的颜色格式

| 格式 | 示例 |
|--------|----------|
| Hex 短格式 | `#fff`、`#f0f8` |
| Hex 长格式 | `#ff0000`、`#ff000080` |
| RGB（逗号语法） | `rgb(255, 99, 71)` |
| RGBA（逗号语法） | `rgba(255, 99, 71, 0.8)` |
| RGB/RGBA（空格语法） | `rgb(255 0 0)`、`rgba(97 95 255 / 0.8)` |
| HSL（逗号语法） | `hsl(200, 80%, 60%)` |
| HSLA（逗号语法） | `hsla(200, 80%, 60%, 0.7)`、`hsla(200, 80%, 60%, 50%)` |
| HSL/HSLA（空格语法） | `hsl(200 80% 60%)`、`hsla(200 80% 60% / 0.7)` |
| 命名颜色 | `red`、`blue`、`rebeccapurple`、`transparent` …（共 148 种，白名单精确匹配） |

## 📦 安装方法

1. 为浏览器安装 **[Tampermonkey](https://www.tampermonkey.net/)** 或 **[Violentmonkey](https://violentmonkey.github.io/)**。
2. 打开 [`color-preview-swatch.user.js`](color-preview-swatch.user.js)，点击 **Raw** 按钮，或将文件拖入脚本管理器。
3. 脚本管理器会提示安装 — 确认即可使用！

## ⌨️ 使用方法

| 操作 | 快捷键 / 方式 |
|--------|-------------------|
| **开关切换** | `Alt + C` 或 `Ctrl + Shift + C` |
| **菜单切换** | 点击 Tampermonkey 工具栏图标 → "颜色预览：已开启 ✓" / "颜色预览：已关闭" |
| **复制颜色** | 点击任意颜色旁的色块 |

> **提示：** 当焦点位于输入框、文本框或 contenteditable 区域时，键盘快捷键自动禁用，避免干扰打字。

## 🔧 兼容性

| 脚本管理器 | 支持情况 |
|----------------|-----------|
| Tampermonkey | ✅ 完整支持（菜单命令、状态持久化） |
| Violentmonkey | ✅ 完整支持 |
| Greasemonkey 4+ | ⚠️ 基本可用，但菜单命令可能不显示 |

## 📁 文件结构

```
colors-preview/
├── color-preview-swatch.user.js   # 用户脚本
├── README.md                      # 英文文档
└── README_zh.md                   # 中文文档
```

## 📄 许可证

MIT License
