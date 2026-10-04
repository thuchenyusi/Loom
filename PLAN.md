# Loom - Interactive Diagram Library 实施计划

> 实施进度（2026-10-04）：Phase 1–7 已完成。当前支持 Decision DSL / Function DSL → 校验 → IR → G6 / JSXGraph，以及路径高亮、可折叠嵌套分组、自动初始化和 Jekyll。实际 API 签名、返回值和使用方式以 README.md 及 docs/api.md 为准，后续章节保留原始设计目标。

| 阶段 | 实际交付 | 验收结果 |
| --- | --- | --- |
| Phase 1 | TypeScript、Vite library build、Vitest、ESM / IIFE bundle、类型声明和静态 HTML 示例 | 构建、类型检查、两种加载方式通过 |
| Phase 2 | Decision Schema、语义校验、Parser、GraphIR、G6 antv-dagre 及平移缩放 | 14 节点静态决策图完整渲染 |
| Phase 3 | samples、选择器、highlightPath、clearHighlight、高亮及淡化 | Alice / Bob 切换及清除恢复通过 |
| Phase 4 | groups、嵌套 parent、G6 Combo、collapse / expand / focus、分组按钮及点击交互 | 折叠隐藏内部节点，外部边连接分组；展开恢复；隐藏子分组状态和 sample 高亮通过 |
| Phase 5 | Function Schema、受限数学表达式解析、FunctionIR、JSXGraph 曲线 / 坐标轴 / glider / 坐标 / change | 鼠标拖动与键盘调整通过，坐标符合 y = x² / 10 |
| Phase 6 | initDiagrams / Diagram.init、同页多图、去重、取消、destroy、自动 resize、逐图错误 | 并发及重复初始化、取消加载、销毁后重建、HTTP / DSL 错误隔离、窗口缩放通过 |
| Phase 7 | Jekyll include、全局布局、Markdown 最小示例、baseurl 支持 | 本机 Jekyll 4.4.1 成功构建；/jekyll/ 静态页面的决策图与函数图正常运行 |

验证记录：

- `npm test`：57 项单元测试通过（Parser、Validator、表达式、分组、适配器、事件和自动初始化）。
- `npm run build:jekyll`：类型检查、ESM / IIFE 构建、示例资产复制和真实 Jekyll 构建通过。
- `npm run test:browser`：8 项真实 Microsoft Edge 测试通过，使用构建后的静态产物；包含 Jekyll 生成页面。
- 已检查完整图、折叠/展开、路径高亮、函数拖动和 Jekyll 页面截图；截图生成在 test-results/。
- 分组显示修复：折叠外框统一为 184×56，移除折叠内边距叠加；分组与普通节点使用相同的 13px 常规字重；折叠标题居中，并显示“▸ 展开”，展开标题使用分组可用宽度并显示“▾ 收起”。切换不自动放大，浏览器回归测试覆盖静态示例及 Jekyll 的比例、标题位置和字号稳定性。
- 分组交互意符：展开标题使用带边框的操作样式，分组及标题具有手形光标和悬停反馈。新增浏览器检查直接点击图内意符，验证展开、收起和常规字重。
- 已提供 01–05 五个静态示例和 integrations/jekyll/example。依赖安装审计为 0 个漏洞。
- JSXGraph 自带 JessieCode 源码产生 eval 构建提示；Loom DSL 不调用它，表达式由受限解析器求值。当前 bundle 未验证严格 CSP，详见 README。

Git：Phase 1–3 首次提交 `ac82b8c`；Phase 4–7 单独提交。构建产物、缓存和运行截图不进入 Git，可按命令重新生成。

## 1. 项目目标

开发一个独立的纯前端交互图渲染库，用于在 Jekyll、普通 HTML 页面及未来其他前端环境中，以声明式 DSL 定义并渲染交互图。

第一阶段主要支持：

1. 决策图 / 决策树；
2. 函数图；
3. 示例驱动的决策路径高亮；
4. 决策图节点及子图的折叠/展开；
5. 函数图上的拖动、坐标显示等交互；
6. Jekyll 博客中的低成本嵌入。

核心设计原则：

```text
DSL
 ↓
Parse / Validate
 ↓
Internal Representation
 ↓
Renderer Adapter
 ├─ G6
 └─ JSXGraph
 ↓
Browser API
 ↓
Integration
 ├─ Plain HTML
 └─ Jekyll
```

业务 DSL 不直接依赖 G6 或 JSXGraph。

---

# 2. 技术选型

第一版采用：

- TypeScript
- AntV G6：决策图、普通关系图、Combo、折叠、路径高亮
- JSXGraph：数学函数图、坐标系、可拖动点
- JSON：DSL 默认序列化格式
- JSON Schema：DSL 校验
- Vite：开发环境及 library build
- Vitest：单元测试

第一版不引入 React。

目标产物应能直接通过：

```html
<script src="diagram.min.js"></script>
```

在纯前端页面使用。

同时应支持 ES Module：

```js
import { renderDiagram } from '@xxx/diagram';
```

---

# 3. 第一阶段范围

## 3.1 Decision DSL

至少支持以下概念：

```json
{
  "$schema": "./decision.schema.json",
  "type": "decision",
  "id": "access-control",
  "start": "network",

  "nodes": {
    "network": {
      "type": "decision",
      "label": "请求来自内部网络？",
      "yes": "role",
      "no": "deny"
    },

    "role": {
      "type": "decision",
      "label": "是否为管理员？",
      "yes": "allow",
      "no": "deny"
    },

    "allow": {
      "type": "result",
      "label": "允许"
    },

    "deny": {
      "type": "result",
      "label": "拒绝"
    }
  },

  "samples": {
    "alice": {
      "label": "Alice",
      "path": [
        "network",
        "role",
        "allow"
      ]
    }
  }
}
```

第一版允许 sample 直接声明 `path`。

不要在第一版实现完整规则执行语言。

后续再考虑：

```json
{
  "condition": {
    "field": "role",
    "op": "eq",
    "value": "admin"
  }
}
```

以及根据 sample input 自动求值。

---

# 4. Group / Combo DSL

支持将多个节点组织为可折叠子图。

建议 DSL：

```json
{
  "groups": {
    "authentication": {
      "label": "身份认证",
      "collapsed": true
    }
  },

  "nodes": {
    "role": {
      "type": "decision",
      "group": "authentication",
      "label": "检查用户角色"
    },

    "mfa": {
      "type": "decision",
      "group": "authentication",
      "label": "检查 MFA"
    }
  }
}
```

转换到 G6 时：

```text
group
 ↓
Combo

node.group
 ↓
node.combo
```

必须验证：

- Group 可以折叠/展开；
- 折叠后内部节点隐藏；
- 与内部节点连接的外部边能正确映射到 Combo；
- 展开后恢复。

---

# 5. Function DSL

第一版支持单变量函数：

```json
{
  "type": "function",
  "id": "risk-function",

  "expression": "x * x / 10",

  "domain": {
    "x": [-5, 5],
    "y": [-2, 5]
  },

  "interactive": {
    "point": {
      "x": 2
    },
    "showCoordinate": true
  }
}
```

Renderer 使用 JSXGraph。

至少实现：

- 坐标轴；
- 函数曲线；
- draggable point；
- point 可限制在函数曲线上；
- 实时显示 `(x, y)`；
- 拖动后发出统一 change event。

注意：

G6 Canvas Coordinate 与函数数学 Coordinate 必须完全分离。

---

# 6. Internal Representation

不要直接：

```text
DSL → G6
```

建立内部 IR。

最低要求定义：

```ts
interface DiagramIR {
  id?: string;
  kind: 'graph' | 'function';
}
```

决策图：

```ts
interface GraphIR extends DiagramIR {
  kind: 'graph';
  nodes: GraphNodeIR[];
  edges: GraphEdgeIR[];
  groups: GraphGroupIR[];
  samples?: GraphSampleIR[];
}
```

例如：

```ts
interface GraphNodeIR {
  id: string;
  kind: 'decision' | 'result' | 'content';
  label: string;
  group?: string;
  metadata?: Record<string, unknown>;
}
```

Renderer 不允许直接依赖原始 DSL。

流程必须为：

```text
Decision DSL
     ↓
parseDecisionDSL()
     ↓
GraphIR
     ↓
G6Renderer
```

以及：

```text
Function DSL
     ↓
parseFunctionDSL()
     ↓
FunctionIR
     ↓
JSXGraphRenderer
```

---

# 7. Renderer 接口

定义统一 Renderer 接口。

例如：

```ts
interface DiagramRenderer<T extends DiagramIR> {
  mount(
    container: HTMLElement,
    diagram: T,
    options?: RenderOptions
  ): DiagramInstance;
}
```

实例至少提供：

```ts
interface DiagramInstance {
  destroy(): void;
  resize(): void;
}
```

Graph 实例额外支持：

```ts
interface GraphDiagramInstance extends DiagramInstance {
  highlightPath(path: string[]): void;
  clearHighlight(): void;

  collapse(groupId: string): void;
  expand(groupId: string): void;

  focus(nodeId: string): void;
}
```

不要把以下 API 暴露给最终调用者：

```js
graph.setElementState(...)
graph.updateNodeData(...)
```

这些属于 G6 implementation detail。

---

# 8. 对外 Browser API

目标使用体验：

```js
import { renderDiagram } from '@xxx/diagram';

const instance = await renderDiagram(
  document.querySelector('#diagram'),
  spec
);
```

也支持 URL：

```js
await renderDiagram(
  document.querySelector('#diagram'),
  '/assets/diagrams/access-control.json'
);
```

另外提供：

```js
initDiagrams();
```

自动扫描：

```html
<div
  data-diagram
  data-src="/assets/diagrams/access-control.json">
</div>
```

调用：

```js
initDiagrams();
```

以后自动完成：

```text
DOM scan
 ↓
fetch JSON
 ↓
validate
 ↓
parse
 ↓
render
```

---

# 9. Sample Path UI

Decision Graph 默认展示完整结构。

没有选择 sample 时：

```text
所有节点正常显示。
```

选择 sample 后：

```text
经过的节点、边
→ highlight

未经过的节点、边
→ dim
```

例如：

```json
"samples": {
  "alice": {
    "label": "Alice：内部管理员",
    "path": [
      "network",
      "role",
      "mfa",
      "allow"
    ]
  }
}
```

默认组件顶部提供：

```text
Sample: [ Alice ▼ ]
```

后续可增加：

```text
▶ Play
← Previous
Next →
```

但动画播放不是 MVP 的硬性要求。

---

# 10. G6 Renderer

G6 Renderer 第一版实现：

- directed graph；
- antv-dagre 自动布局；
- node；
- edge；
- edge label；
- Combo；
- Combo collapse / expand；
- drag canvas；
- zoom canvas；
- drag node；
- click node；
- hover；
- path highlight；
- path dim；
- fit view；
- resize。

不允许把：

```text
x / y position
fill
stroke
font size
```

这类 renderer-specific 属性强制进入 DSL。

可以允许后续增加：

```json
"presentation": {}
```

但第一版尽量保持 DSL semantic。

---

# 11. Function Renderer

JSXGraph Renderer 第一版实现：

```text
FunctionIR
   ↓
coordinate system
   ↓
function graph
   ↓
draggable glider
   ↓
coordinate label
```

拖动发生时：

```ts
instance.on('change', event => {
  // event.value.x
  // event.value.y
});
```

事件模型尽量与其他 Diagram 类型统一。

---

# 12. DSL Validation

为以下 DSL 建 JSON Schema：

```text
schemas/
├── diagram.schema.json
├── decision.schema.json
└── function.schema.json
```

至少检查：

Decision DSL：

- `type` 是否正确；
- `start` 是否存在；
- node id 是否唯一；
- yes/no target 是否存在；
- group 引用是否合法；
- sample path 中 node 是否存在。

另外实现 semantic validation，例如：

```text
START_NODE_NOT_FOUND
TARGET_NODE_NOT_FOUND
UNKNOWN_GROUP
INVALID_SAMPLE_PATH
```

错误必须包含：

```ts
{
  code: string;
  message: string;
  path?: string;
}
```

---

# 13. Jekyll Integration

Jekyll 不应该理解 G6。

提供：

```text
integrations/jekyll/diagram.html
```

使用方式：

```liquid
{% include diagram.html src="/assets/diagrams/foo.json" %}
```

最终生成：

```html
<div
  class="interactive-diagram"
  data-diagram
  data-src="/assets/diagrams/foo.json">
</div>
```

页面全局加载：

```html
<script src="/assets/diagram/diagram.min.js"></script>
```

然后：

```js
Diagram.init();
```

Markdown 作者无需：

- 写 JavaScript；
- 理解 G6；
- 理解 JSXGraph；
- 创建 iframe。

---

# 14. 纯 HTML 示例

必须提供 standalone demo：

```html
<!DOCTYPE html>

<div
  data-diagram
  data-src="./decision.json">
</div>

<script src="./diagram.min.js"></script>
<script>
  Diagram.init();
</script>
```

该 demo 必须能够：

```text
直接通过静态 HTTP server
```

运行。

不能依赖后端。

---

# 15. 建议目录结构

第一版不要建立复杂 monorepo。

采用：

```text
interactive-diagram/
├── src/
│   ├── core/
│   │   ├── types.ts
│   │   ├── parser.ts
│   │   ├── validator.ts
│   │   └── events.ts
│   │
│   ├── dsl/
│   │   ├── decision.ts
│   │   └── function.ts
│   │
│   ├── renderers/
│   │   ├── g6/
│   │   │   ├── renderer.ts
│   │   │   ├── nodes.ts
│   │   │   ├── edges.ts
│   │   │   └── styles.ts
│   │   │
│   │   └── jsxgraph/
│   │       └── renderer.ts
│   │
│   ├── browser/
│   │   ├── render.ts
│   │   └── auto-init.ts
│   │
│   └── index.ts
│
├── schemas/
│   ├── decision.schema.json
│   └── function.schema.json
│
├── examples/
│   ├── decision/
│   ├── combo/
│   ├── sample-path/
│   └── function/
│
├── integrations/
│   └── jekyll/
│       └── diagram.html
│
├── tests/
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

后续规模足够大后，再考虑拆分：

```text
@xxx/diagram-core
@xxx/diagram-g6
@xxx/diagram-function
```

第一阶段禁止为了未来可能需求提前拆 package。

---

# 16. 开发阶段

## Phase 1：基础设施

完成：

```text
TypeScript
Vite library build
Vitest
ESM build
browser bundle
basic demo
```

验收：

```js
import { renderDiagram } from '...'
```

以及：

```html
<script src="diagram.min.js"></script>
```

均能运行。

---

## Phase 2：Decision DSL + G6

完成：

```text
Decision JSON
↓
Parser
↓
GraphIR
↓
G6
```

支持：

```text
decision node
result node
yes/no edge
dagre layout
pan
zoom
```

验收：

能够渲染至少一个 10+ 节点的完整决策图。

---

## Phase 3：Sample Path

加入：

```text
samples
sample selector
highlightPath()
clearHighlight()
```

验收：

切换两个不同 sample 后：

```text
对应路径正确高亮；
其他路径淡化；
无需重新加载页面。
```

---

## Phase 4：Combo

加入：

```text
groups
G6 Combo
collapse
expand
nested group 基础支持
```

验收：

至少构造：

```text
外部节点
  ↓
Combo
 ├─ A
 ├─ B
 └─ C
  ↓
外部节点
```

确认 collapse 前后边连接逻辑正确。

---

## Phase 5：Function Graph

完成：

```text
Function DSL
↓
FunctionIR
↓
JSXGraph
```

实现：

```text
function curve
axes
draggable point
coordinate display
change event
```

验收：

拖动点后：

```text
(x, y)
```

实时更新。

---

## Phase 6：Browser Integration

实现：

```html
<div data-diagram data-src="foo.json"></div>
```

以及：

```js
Diagram.init();
```

支持同一页面多个 diagram。

必须处理：

```text
重复初始化
destroy
window resize
加载失败
DSL validation error
```

---

## Phase 7：Jekyll Integration

实现：

```liquid
{% include diagram.html src="/assets/diagrams/foo.json" %}
```

建立最小 Jekyll 示例。

验收：

Markdown 文件中只需要一行 include，即可展示完整交互图。

---

# 17. 测试要求

至少包含三类测试。

### Parser

输入 DSL：

```text
→ IR 是否正确
```

### Validator

构造：

```text
不存在的 target
不存在的 start
不存在的 group
非法 sample path
```

确认返回明确错误。

### Renderer Smoke Test

至少验证：

```text
mount
destroy
highlightPath
collapse
expand
```

不要求第一版做完整截图测试。

---

# 18. 示例项目

最终至少提供四个 example：

```text
01-basic-decision
02-sample-highlight
03-collapsible-groups
04-interactive-function
```

以及一个综合案例：

```text
05-user-manual
```

用于模拟真实文档：

```text
决策图
+
折叠子图
+
sample selector
+
函数节点/函数图
```

---

# 19. 第一版明确不做

不要实现：

```text
可视化 DSL 编辑器
完整规则引擎
任意 JavaScript expression 执行
后端服务
数据库
用户账户
协同编辑
自动保存
Mermaid compatibility
React component library
Vue component library
复杂 graph algorithm API
PNG/PDF export
```

这些都放到后续阶段。

第一版核心目标只有：

> JSON DSL → 浏览器中的高质量交互图。

---

# 20. API 稳定边界

以下属于 Public API：

```ts
renderDiagram()
initDiagrams()

DiagramInstance

highlightPath()
collapse()
expand()
focus()
destroy()
```

以下不得成为公共 API：

```text
G6 Graph instance
JSXGraph Board instance
G6-specific NodeData
JSXGraph-specific object
```

如果调试确实需要，可以提供：

```ts
instance.debug()
```

或者明确标记：

```ts
instance.__unsafeRendererInstance
```

但不能作为稳定 API。

---

# 21. 完成标准

MVP 完成必须同时满足以下场景。

### 场景 A：Jekyll

Markdown：

```liquid
{% include diagram.html src="/assets/diagrams/access.json" %}
```

页面正常出现决策图。

### 场景 B：样例

页面选择：

```text
Alice
Bob
Guest
```

决策路径动态变化。

### 场景 C：折叠

点击：

```text
Authentication
```

能够：

```text
展开内部决策
↕
折叠成单个模块
```

且外部连线正确。

### 场景 D：函数

显示：

```text
y = f(x)
```

用户拖动点：

```text
P(x, y)
```

坐标实时变化。

### 场景 E：完全静态部署

整个示例目录可以部署至：

```text
GitHub Pages
普通 nginx
任意 static hosting
```

不需要服务器端逻辑。

---

# 22. Agent 执行原则

实现过程中遵守：

1. 优先完成最小垂直链路，不提前抽象未来功能；
2. DSL 与具体 renderer 解耦；
3. 不让 G6 类型泄漏到 Core API；
4. 不让 JSXGraph 类型泄漏到 Core API；
5. DSL 尽量表达语义，不表达像素级样式；
6. 每完成一个 Phase 都确保 example 可以实际运行；
7. 新增 DSL 字段必须同步更新 JSON Schema；
8. 新增 Public API 必须补测试和 README；
9. 如果需求与当前架构冲突，先记录 ADR，再修改架构；
10. 优先保证 Jekyll / plain HTML 场景，而不是 React 等框架集成。

---

# 23. 推荐实施顺序

最重要的第一条可运行链路应当是：

```text
decision.json
     ↓
parse
     ↓
GraphIR
     ↓
G6 renderer
     ↓
basic-decision.html
```

完成以后再依次增加：

```text
sample highlighting
       ↓
Combo
       ↓
auto-init
       ↓
Jekyll
       ↓
JSXGraph
```

不要一开始同时开发所有 DSL、renderer 和 integration。

第一阶段的成功标志不是“架构完整”，而是：

> 能在一个纯静态 HTML 页面中，用一份简洁 JSON 描述一个决策图，由库自动渲染，并选择 sample 高亮路径。

做到这一点之后，再围绕实际需求逐步扩展。
