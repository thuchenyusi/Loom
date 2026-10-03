# Loom

用 JSON 描述浏览器中的交互决策图，可在纯静态 HTML 中运行。Phase 1–3 已实现：TypeScript、ESM / browser bundle、Decision DSL → GraphIR → G6、自动布局、平移缩放，以及 sample 路径选择、高亮和淡化。

## 运行

需要 Node.js 22.19+ 和 npm。

```sh
npm install
npm run dev
```

开发示例：`http://127.0.0.1:5173`。

验证构建后的独立静态页面：

```sh
npm run build
npm run demo
```

访问 `http://127.0.0.1:4173`。服务只提供静态文件；示例也可用任意静态 HTTP server 打开，需保留 `dist/` 和 `examples/` 的相对目录。

- `examples/01-basic-decision.html`：ESM，完整的 14 节点决策图。
- `examples/02-sample-highlight.html`：browser bundle，Alice / Bob / Guest 路径切换。
- `examples/decision.json`：两个示例共用的 DSL。

## Browser bundle

`dist/diagram.min.js` 内置 G6 和校验器，无需 CDN、框架或后端。

```html
<div id="diagram"></div>
<script src="./dist/diagram.min.js"></script>
<script>
  Diagram.renderDiagram(document.querySelector('#diagram'), './decision.json')
    .then(instance => { window.diagram = instance; })
    .catch(error => { console.error(error); });
</script>
```

## ESM

```js
import { renderDiagram } from './dist/diagram.js';

const instance = await renderDiagram(document.querySelector('#diagram'), spec, {
  height: 560,
  showSampleSelector: true,
});
await instance.highlightPath(['network', 'account', 'role', 'mfa', 'allow-admin']);
await instance.clearHighlight();
await instance.resize();
instance.destroy();
```

`renderDiagram(container, specOrUrl, options?)` 返回 `Promise<GraphDiagramInstance>`。字符串被视为 JSON URL，其他输入按照 DSL 校验。调用者负责处理错误和按需调用 `resize()`。容器应已有可测量的宽度。

`highlightPath()` 接受非空且边连续的节点列表，支持局部路径；无效路径在修改图之前拒绝。`clearHighlight()` 恢复所有节点和边。两者及 `resize()` 返回 Promise，快速连续调用按顺序处理。`destroy()` 释放画布及选择器事件，可重复调用；销毁后其他操作拒绝。库创建自己的子容器，不删除调用者原有的内容。

默认完整展示图；存在 samples 时显示选择器。选中 sample 后其节点、相邻边高亮，其余元素淡化；切回完整图恢复全部分支。如果同一节点的 yes/no 指向同一目标，节点路径无法区分分支，两个边都高亮。

## Decision DSL

```json
{
  "type": "decision",
  "start": "check",
  "nodes": {
    "check": { "type": "decision", "label": "有权限？", "yes": "allow", "no": "deny" },
    "allow": { "type": "result", "label": "允许" },
    "deny": { "type": "result", "label": "拒绝" }
  },
  "samples": {
    "alice": { "label": "Alice", "path": ["check", "allow"] },
    "guest": { "label": "Guest", "path": ["check", "deny"] }
  }
}
```

支持可选 `$schema`、`id` 和节点 `metadata`。节点以对象 key 标识，JSON 解析前应避免重复 key（普通 JSON.parse 会保留最后一个值）。Schema 在 `schemas/decision.schema.json`，总入口在 `schemas/diagram.schema.json`。DSL 不包含 G6 样式或坐标，渲染器只接收 IR。

`validateDecisionDSL(input)` 返回 `{ valid, errors }`；`parseDecisionDSL(input)` 返回 `GraphIR`，校验失败则抛出 `DiagramValidationError`。错误含 `code`、`message`、JSON Pointer `path`，覆盖 `SCHEMA_VALIDATION_ERROR`、`START_NODE_NOT_FOUND`、`TARGET_NODE_NOT_FOUND` 和 `INVALID_SAMPLE_PATH`。sample 必须从 start 出发，沿有效边连接，最终到达 result。普通图允许共享结果节点和环，不执行业务规则。

## 验证

```sh
npm test
npm run build
npm run test:browser
```

单元测试覆盖 schema / 语义校验、IR 转换、适配器状态与生命周期、URL 错误。浏览器测试默认使用本机 Microsoft Edge，打开构建后的 ESM 和 IIFE 静态页面，检查真实 G6 画布、路径切换及清除、平移缩放、resize 和销毁；截图保存在 `test-results/`。无 Edge 时可将 `playwright.config.ts` 的 channel 改为已安装的 Chromium 通道。

## 后续阶段

Phase 4–7 尚未实现：Group / Combo、Function DSL / JSXGraph、`initDiagrams()` / `Diagram.init()`、多实例自动管理及 Jekyll include。当前 Schema 会拒绝这些尚未支持的字段，避免静默忽略需求。公共接口不暴露 G6 实例或 G6 数据类型。完整实施范围见 `PLAN.md`。
