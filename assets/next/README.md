# Next Icon

`assets/next` 保存第二版 2D 图标的参考源、SVG 真源和对比脚本。

## 结构

- `source/icon.png`: 用户提供的 2D 参考图。
- `svg/icon.svg`: 清洁版 SVG 真源。
- `scripts/render-svg.ts`: 将 SVG 渲染为 PNG。
- `scripts/compare-svg.ts`: 渲染并输出对比报告、diff 图和渲染图。
- `out/`: 脚本输出目录。

## 命令

```bash
bun run ./assets/next/scripts/compare-svg.ts
```

默认使用 `mae` 作为通过指标，阈值为 `95`。原因是参考图来自 AI 生成，包含轻微的抗锯齿噪点；`pixelmatch` 的逐像素覆盖率会对这些噪点过度敏感，因此脚本同时输出两组指标：

- `maeSimilarity`: 主判定指标，基于 RGBA 平均绝对误差的归一化相似度。
- `pixelSimilarity`: 辅助诊断指标，基于 `pixelmatch` 的逐像素覆盖率。

当前 `svg/icon.svg` 的基线结果：

- `maeSimilarity`: 约 `97.58%`
- `pixelSimilarity`: 约 `89.47%`

只要 `maeSimilarity >= 95`，脚本就会返回成功退出码并在 `out/report.json` 记录报告。
