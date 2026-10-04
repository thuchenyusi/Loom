# API 与配置参考

快速接入见 [README](../README.md)。本页列出图配置、JavaScript 接口、事件和生命周期。

## 自动初始化

```html
<div data-diagram data-src="./decision.json" data-height="640"></div>
<div data-diagram data-src="./function.json" data-height="420"></div>
<script src="./dist/diagram.min.js"></script>
<script>
  Diagram.init().then(results => {
    for (const result of results) {
      if (result.error) console.error(result.error);
    }
  });
</script>
```

`Diagram.init` 是 `initDiagrams` 的别名。ESM 使用 `import { initDiagrams, destroyDiagrams } from './dist/diagram.js'`。

`initDiagrams(root = document, options?)` 扫描 `[data-diagram]`，也包含 root 本身。每个容器必须有 `data-src`；可选 `data-height` 覆盖 options.height。返回 `Promise<InitDiagramResult[]>`，每项包含 `container` 和成功的 `instance` 或失败的 `error`。一个图失败不会阻止其他图；错误以文本显示在容器内，并触发 DOM `diagram:error` 事件。状态记录在 `data-diagram-state`（loading / ready / error）。

重复或并发调用复用初始化任务及实例。调用 `destroyDiagrams(root?)` 会取消正在加载的图、释放实例、移除错误并清除状态；之后可重新初始化或重试失败的 URL。也可单独调用结果实例的 `destroy()`。移除容器前应销毁对应实例。

## 手动渲染和生命周期

```js
import { renderDiagram } from './dist/diagram.js';

const instance = await renderDiagram(document.querySelector('#diagram'), './decision.json', {
  height: 560,
  showSampleSelector: true,
});
if (instance.kind === 'graph') {
  await instance.highlightPath(['check', 'allow']);
  await instance.clearHighlight();
}
await instance.resize();
instance.destroy();
```

`renderDiagram(container, specOrUrl, options?)` 校验 DSL、转换 IR，再选择适配器。传入字符串时加载 JSON URL；未知类型或无效 DSL 会拒绝。已知 DecisionDSL / FunctionDSL 有精确的返回类型，URL / unknown 输入返回可用 `kind` 区分的联合类型。直接调用手动渲染会创建新实例，自动初始化的去重只针对 `initDiagrams()`。

所有实例自动监听容器尺寸及 window resize。容器须在 DOM 中并拥有可测量的宽度；需要时也可手动 `resize()`。`destroy()` 可重复调用，释放画布、事件、ResizeObserver 和 resize 监听器。销毁后其他实例操作拒绝或抛错。库仅移除自己的子容器。可选 `options.signal` 支持取消加载、取消挂载及销毁已挂载实例。

## 渲染选项

`renderDiagram()` 和 `initDiagrams()` 接受以下选项：

| 选项 | 默认值 | 用途 |
| --- | --- | --- |
| `height` | `560` | 画布高度，单位为像素，必须是正的有限数 |
| `showSampleSelector` | `true` | 决策图有 samples 时是否显示路径选择器 |
| `signal` | 无 | 用 AbortSignal 取消加载、挂载或销毁已挂载的图 |

## 决策图配置

```json
{
  "type": "decision",
  "start": "check",
  "groups": {
    "auth": { "label": "Authentication", "collapsed": false },
    "verify": { "label": "Verification", "parent": "auth", "collapsed": true }
  },
  "nodes": {
    "check": { "type": "decision", "label": "有权限？", "group": "verify", "yes": "allow", "no": "deny" },
    "allow": { "type": "result", "label": "允许" },
    "deny": { "type": "result", "label": "拒绝" }
  },
  "samples": {
    "alice": { "label": "Alice", "path": ["check", "allow"] },
    "guest": { "label": "Guest", "path": ["check", "deny"] }
  }
}
```

支持可选 `$schema`、`id` 和节点 `metadata`。节点和分组 ID 共用命名空间。分组通过 `parent` 嵌套，禁止循环关系；节点的 `group` 引用必须存在。JSON 的重复 key 应在输入文件中避免，普通 JSON.parse 会保留最后一个值。DSL 保持语义，不包含 G6 像素坐标或样式。Schema 见 [decision.schema.json](../schemas/decision.schema.json)。

默认展示完整图；有 samples 时显示选择器。sample 必须从 start 出发、沿有效边连接并终止于 result。经过的节点、相邻边和所属分组高亮，其余分支淡化；清除后恢复。yes/no 指向同一目标时，节点路径无法区分两条分支，两条边都高亮。支持共享结果节点和环，不执行完整规则引擎。

Graph 实例 API：

| 方法 | 行为 |
| --- | --- |
| highlightPath(path) | 高亮非空、边连续的路径，也允许局部路径 |
| clearHighlight() | 恢复全部节点、边与分组 |
| collapse(groupId) / expand(groupId) | 折叠或展开分组，外部边连接到折叠模块；保留嵌套分组各自的状态。图内显示“▸ 展开 / ▾ 收起”操作标记和手形光标。切换保持当前缩放，内容超出画布时缩小以完整显示 |
| focus(nodeId) | 展开必要的祖先分组并聚焦节点 |
| on('change', listener) | 路径变化事件 `{kind:'graph', value:{path}}`；清除时 path 为 null |
| on('nodeclick', listener) | 点击节点事件 `{nodeId}` |

异步图操作返回 Promise，并按调用顺序执行。未知节点、分组或不连续路径会拒绝。分组也可通过按钮或点击图中 Combo 切换。`on()` 返回取消订阅函数。

## 函数图配置

```json
{
  "type": "function",
  "id": "risk",
  "expression": "x * x / 10",
  "domain": { "x": [-5, 5], "y": [-2, 5] },
  "interactive": { "point": { "x": 2 }, "showCoordinate": true }
}
```

`domain` 两个轴必须是有限、递增的范围。`interactive` 可省略；默认点 x 为域内最接近 0 的值，默认显示坐标。初始点必须在 x 域内且函数值有限。曲线的非有限区间显示为断点，拖动到非有限值时回到前一个有效点。y 域控制显示范围，函数点的 y 由表达式确定。

表达式仅支持：

- 变量 `x`，常数 `pi`、`e`，小数与科学计数法。
- `+`、`-`、`*`、`/`、`^`、`**`、括号；幂右结合，`-2^2 = -4`。
- 单参数函数 `sin`、`cos`、`tan`、`sqrt`、`abs`、`exp`、`log`（自然对数）、`floor`、`ceil`。
- 双参数函数 `min`、`max`、`pow`。

最大 512 字符、256 token、64 层嵌套。DSL 表达式使用自建解析器求值，不传给 JavaScript eval / Function 或 JSXGraph JessieCode。

Function 实例的 `getValue()` 返回数学坐标 `{x,y}`，与 G6 画布坐标独立。拖动点始终限制在曲线上和 x 域内；选中点后左右箭头以 x 域长度的 1% 移动。

```js
if (instance.kind === 'function') {
  const unsubscribe = instance.on('change', event => {
    if (event.kind === 'function') console.log(event.value.x, event.value.y);
  });
  console.log(instance.getValue());
  unsubscribe();
}
```

## 校验和 IR

`validateDecisionDSL(input)` / `validateFunctionDSL(input)` 返回 `{valid, errors}`。`parseDecisionDSL(input)` / `parseFunctionDSL(input)` 返回 GraphIR / FunctionIR，失败抛出 `DiagramValidationError`，其 `errors` 包含 `code`、`message` 和 JSON Pointer `path`。

语义错误覆盖 `START_NODE_NOT_FOUND`、`TARGET_NODE_NOT_FOUND`、`UNKNOWN_GROUP`、`CYCLIC_GROUP`、`DUPLICATE_ELEMENT_ID`、`INVALID_SAMPLE_PATH`、`INVALID_DOMAIN`、`INVALID_POINT`、`INVALID_EXPRESSION`。结构错误为 `SCHEMA_VALIDATION_ERROR`。总 Schema 见 [diagram.schema.json](../schemas/diagram.schema.json)。

## 部署注意事项

通过 HTTP 服务提供页面、脚本和 JSON 文件。相对 JSON 路径按页面 URL 解析；使用跨域 JSON 时，资源服务需允许对应页面的跨域请求。

容器应已加入页面，并具有可测量的宽度。尺寸变化时实例会自动调整。

当前校验器在初始化时生成校验函数，浏览器脚本尚未针对禁止动态代码执行的严格 CSP 验证；如果站点使用该策略，接入前需验证兼容性。
