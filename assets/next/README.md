# Next Icon System

`assets/next` 现在是第二代图标系统的 canonical source。

## 结构

- `icon-bw.svg`: 19-path 纯色几何真源，保留原始 `path id`
- `icon-color.svg`: 当前 dark brand 参考版
- `masters/`: 由 token + preset 渲染出的正式 master SVG
- `tokens/backgrounds.json`: 画布背景 token
- `tokens/palettes.json`: 品牌/单色配色 token
- `tokens/slots.json`: 顶左、右下、中心三个槽位的预设符号库
- `presets/`: 可直接渲染和导出的变体配置

## 法则

- 几何真源固定来自 `icon-bw.svg`
- 色彩、槽位、语义变体只通过 token / preset 扩展
- `assets/source/master` 中的 PNG 只是导出产物，不再是主源

## 相关命令

```bash
bun run --filter '@agenter/ui-studio' dev
bun run build:icon-masters
bun run build:icons
```

- `@agenter/ui-studio dev`: 启动独立的 icon composer 项目
- `build:icon-masters`: 从 `assets/next` 的 canonical SVG + token + preset 渲染 master SVG，并生成 `assets/source/master` 下的 light/dark PNG 主源
- `build:icons`: 从新的 PNG 主源派生 favicon、Web、PWA、Apple、Android、macOS 产物

## UI Studio

本地可视化组合工具现在是独立项目：

- `packages/ui-studio`

它会直接读取这里的 canonical data，支持：

- 切换 light / dark 与 brand / mono
- 切换 palette token
- 切换 top-left / bottom-right / center 槽位
- 上传自定义 SVG 到槽位
- 导出 SVG / PNG / preset JSON
