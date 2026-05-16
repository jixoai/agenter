# backend-owned-terminal-interaction 原生手动验收

请按下面每一项测试。每一项只需要反馈：

```text
符合 / 不符合
如果不符合：看到的问题是什么
```

推荐启动命令：

```bash
bun agenter shell --backend=ghostty-native --session=native-proof-20260512 --debug=selection,follow,key,scroll
```

## 1. 拖选后滚动

1. 在 shell 里输出一些多屏内容，比如 `cat AGENTS.md`。
2. 用鼠标拖选 shell 里的几行文字。
3. 用滚轮往上或往下滚动。

预期：蓝色选中背景应该跟着那几行内容一起滚动，不应该固定在屏幕原来的位置。

## 2. shell 选中不能越界

1. 在 shell 区域开始拖选。
2. 鼠标拖到滚动条、右侧 dialogue、底部状态栏。

预期：shell 的选中范围只影响 shell 内容，不会选进滚动条、dialogue 或底部状态栏。

## 3. dialogue 选中不能越界

1. 打开 dialogue。
2. 在 dialogue 里拖选文字。
3. 鼠标拖到 shell 区域。

预期：dialogue 的选中范围只影响 dialogue 内容，不会改变 shell 的选中或光标。

## 4. 复制 shell 选中

1. 在 shell 里拖选一段文字。
2. 按 `⌘C` 或 `Ctrl+Shift+C`。
3. 粘贴到外部文本输入框。

预期：粘贴出来的是刚才 shell 里选中的文字。

## 5. 复制 dialogue 选中

1. 在 dialogue 里拖选一段文字。
2. 按 `⌘C` 或 `Ctrl+Shift+C`。
3. 粘贴到外部文本输入框。

预期：粘贴出来的是刚才 dialogue 里选中的文字，不是 shell 里的文字。

## 6. 输入后回到光标位置

1. 在 shell 里输出多屏内容。
2. 往上滚几屏。
3. 输入普通文字，或者按 Enter。

预期：画面应该回到 shell 当前输入光标所在的位置。

## 7. 方向键/Home/End 后回到光标位置

1. 在 shell 里输入一行较长内容，不要提交。
2. 往上滚几屏。
3. 按 Left/Right/Home/End。

预期：画面应该回到 shell 当前输入光标所在的位置，光标位置也应该正确。

## 8. Option+Left / Option+Right

1. 在 shell 里输入一行包含中文、英文和标点的内容。
2. 按 Option+Left 和 Option+Right。

预期：光标应该按“词”跳转，不是只移动一个字符；中文、英文混排时也应该自然。

## 9. 双击选词

1. 在 shell 或 dialogue 里找一段包含中文、英文和标点的文字。
2. 双击某个词。

预期：只选中当前词，不应该把旁边标点或整行都选进去。

## 10. 三击选行

1. 在 shell 或 dialogue 里三击同一行。

预期：选中这一行，不应该选中别的行。

## 11. 双击/三击偏移重置

1. 单击一次某行。
2. 第二次点击故意偏到旁边超过一个字符，或偏到下一行。

预期：这不应该被当成双击/三击；只有同一行、同一位置附近的连续点击才算。

## 12. 中文显示和选中

1. 输出或输入包含中文、emoji、英文混排的内容。
2. 拖选这些内容。

预期：中文宽度应该正常，不应该变成 3 宽；选中后文字仍可见，不应该因为背景变化消失。

## 13. 滚动条点击和拖动

1. 在 shell 里输出多屏内容。
2. 点击滚动条轨道。
3. 拖动滚动条滑块。

预期：内容应该跟着滚动条变化，不应该突然跳到顶部、卡住或明显不同步。

## 14. 调试日志

启动时使用：

```bash
--debug=selection,follow,key,scroll
```

预期：`.agenter-cli-shell-trace.ndjson` 里只保留这些相关日志；每次重新启动后，日志文件应该是本次启动的新内容，不应该混进上次启动的旧内容。
