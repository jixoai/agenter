# Assets

应用级品牌资产的 canonical source 在这个目录。

- `source/original/`: 原始输入留档
- `source/master/`: 清理后的主源图标，所有平台产物都从这里派生
- `favicon/`: 网站 favicon 套件
- `app/`: Web、PWA、Apple、Android 等平台产物
- `scripts/`: 图标派生脚本

生成命令：

```bash
bun run build:icon-masters
bun run build:icons
```

- `build:icon-masters`: 从原始 Gemini PNG 生成清理后的主源图标。中心背景会按 radial-gradient 保留，边缘背景完全剔除。
- `build:icons`: 从主源图标派生 favicon、PWA、Apple、Android、macOS 产物。

当前脚本依赖：

- `build:icon-masters`: Python 3 + Pillow
- `build:icons`: macOS 自带的 `sips` 与 `iconutil`
