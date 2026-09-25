# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

纯前端静态数独求解器，无构建工具、无依赖安装、无测试/ lint。核心能力：手动输入/粘贴 81 位数字、图片 OCR 识别、一键全解、逐步逻辑推理（带技巧说明）、历史/收藏（localStorage）。

## 运行方式

无构建步骤。直接用浏览器打开 `index.html` 即可运行基础功能。

OCR 功能依赖 Tesseract.js 的 Web Worker 与本地资源（`lib/worker.min.js`、`lib/core/`、`lib/lang/`），在 `file://` 协议下 worker 可能加载失败。需要 OCR 时请用本地 HTTP 服务：

```bash
python -m http.server 8000   # 然后访问 http://localhost:8000
```

## 架构

三个业务 JS 文件均为 IIFE，通过 `window` 上的全局对象对外暴露；无模块系统，**脚本加载顺序敏感**：

```
index.html 按此顺序加载：
  solver.js  → app.js → lib/tesseract.min.js → ocr.js
```

- `solver.js` — 数独核心算法，纯函数无 DOM 依赖，导出 `window.SudokuSolver`。
- `app.js` — 全部 UI 交互与状态管理，依赖 `window.SudokuSolver`，不导出任何全局。
- `ocr.js` — 图片识别，导出 `window.SudokuOCR`，依赖 `window.Tesseract`。

关键点：`solver.js` 必须先于 `app.js` 加载（`app.js` 启动即调用 `SudokuSolver`）。

## 数据模型（app.js 中的全局状态）

- `board` — `number[9][9]`，`0` 表示空格。
- `givens` — `Set<string>`，key 形如 `"r,c"`，**只记录用户/题目给定的数字**；推理或「一键全解」填出的数字不在此集合内。

区分「题目数字（黑色）」与「求解数字（高亮）」的唯一依据是 `givens` 集合 + `editable` 状态：`renderBoard()` 中，`editable` 为真时所有非零格都当 `given` 渲染；为假时按 `givens.has(key)` 区分 `given` / `solved`。

任何改变盘面的操作都应调用 `renderBoard()` 刷新（它内部顺带更新填格计数、收藏高亮、校验图标、按钮禁用态）。

## 核心接口

`SudokuSolver`（solver.js）：

- `isValid(board, r, c, num)` → boolean
- `isBoardValid(board)` → boolean（整体是否有冲突）
- `countSolutions(board, limit)` → `{ count, solution }`（回溯计数 + 唯一解判定）
- `computeCandidates(board)` → 9×9 候选数组（每格为数字数组）
- `createLogicSolver(board, uniqueAssumption)` → 逐步求解器实例

逻辑求解器实例方法：`nextStep()`、`undo()`、`reset()`、`canUndo()`、`getBoard()`、`getCandidates()`、`isDone()`。

`nextStep()` 返回的 step 对象结构（app.js 依赖此结构渲染高亮与说明）：

```
{ done: bool, kind: 'fill', fill: {r, c}, eliminations: [{r, c}], title, message }
```

返回 `null` 表示无法用基础逻辑继续（需试错）；`done` 为真表示已填满。

`SudokuOCR`（ocr.js）：

- `recognize(image)` → `Promise<81位字符串>`，`0` 表示空格。识别流程：灰度 → 自适应二值化 → 投影找网格线 → 逐格像素密度判空 → Tesseract 单字符识别。

## 注意事项

- OCR 的 `workerPath` / `corePath` / `langPath` 是相对路径（`lib/...`），不要改成绝对路径或 CDN，否则离线可用性会丢失。
- 修改按钮文案可直接改 `index.html`；事件绑定在 `app.js` 中全部按 `id` 引用，改文案不影响逻辑，但改动/删除按钮 `id` 需同步检查 `app.js`。
