# Loom

用 JSON 为网页添加交互式决策图和函数图。

Loom 适合在博客、产品文档和知识库中解释决策流程，或展示函数与坐标之间的关系。可直接接入普通 HTML 和 Jekyll，无需前端框架或后端服务。

- **决策流程**：描述判断条件和结果，自动生成可平移、缩放的图。
- **路径对比**：为不同情境定义路径，读者可切换查看对应的节点和分支。
- **分组展开**：将复杂流程分成可展开、收起的嵌套分组。
- **函数探索**：拖动曲线上的点，实时查看数学坐标。
- **静态站点接入**：加载一个脚本，通过 HTML 属性或 JavaScript 初始化。

## 获取脚本

从本仓库构建浏览器脚本，需要 Node.js 22.19+ 和 npm：

```sh
git clone https://github.com/thuchenyusi/Loom.git
cd Loom
npm ci
npm run build
```

构建后可选择以下入口：

| 文件 | 接入方式 |
| --- | --- |
| `dist/diagram.min.js` | 用 `<script>` 加载，通过全局对象 `Diagram` 调用 |
| `dist/diagram.js` | 用 ES Module 导入，适合自行编写初始化代码 |

脚本已包含所需依赖，不必额外引入图形库或样式表。将脚本和图的 JSON 文件复制到你的网站资源目录即可。

## 快速接入

先创建 `decision.json`，描述一个权限判断流程：

```json
{
  "type": "decision",
  "start": "check",
  "nodes": {
    "check": {
      "type": "decision",
      "label": "有访问权限？",
      "yes": "allow",
      "no": "deny"
    },
    "allow": { "type": "result", "label": "允许访问" },
    "deny": { "type": "result", "label": "拒绝访问" }
  },
  "samples": {
    "member": { "label": "有权限的用户", "path": ["check", "allow"] },
    "visitor": { "label": "访客", "path": ["check", "deny"] }
  }
}
```

假设脚本放在 `/assets/loom/diagram.min.js`，JSON 放在 `/assets/diagrams/decision.json`，在页面中加入：

```html
<div data-diagram data-src="/assets/diagrams/decision.json" data-height="480"></div>

<script src="/assets/loom/diagram.min.js"></script>
<script>
  Diagram.init();
</script>
```

页面会显示完整流程和路径选择器。读者可选择“有权限的用户”或“访客”，查看相应路径；选择完整图可恢复所有分支。

`data-src` 指向图的 JSON 文件，`data-height` 设置画布高度，单位为像素。同一页面可以放多个图，调用一次 `Diagram.init()` 即可。通过网站的 HTTP 服务访问页面，以便浏览器加载 JSON；资源路径按你的网站目录调整。

## 多路分支与自定义标记

决策节点可以使用 `branches` 定义任意数量的分支；每个分支必须指定目标 `target` 和显示在连线上的标记 `label`：

```json
{
  "type": "decision",
  "start": "genre",
  "nodes": {
    "genre": {
      "type": "decision",
      "label": "想读哪种小说？",
      "branches": {
        "fantasy": { "label": "奇幻", "target": "lotr" },
        "scifi": { "label": "科幻", "target": "dune" },
        "both": { "label": "两者都想", "target": "dark-tower" }
      }
    },
    "lotr": { "type": "result", "label": "指环王" },
    "dune": { "type": "result", "label": "沙丘" },
    "dark-tower": { "type": "result", "label": "黑暗塔" }
  }
}
```

分支 key 是稳定标识，`label` 是可自定义的文字，两者互相独立。`branches` 至少包含一个分支，key、`target` 和 `label` 都必须是非空字符串。二路选择也可以用 `branches` 自定义标记，例如“机器人 / 火星人”。

原有 `yes` / `no` 写法继续支持，默认标记仍为“是 / Yes”和“否 / No”。同一个节点必须选择一种写法，不能混用；同一张图可以同时包含两种节点。路径仍使用节点 ID，无需添加分支标识；多个分支指向同一目标时，对应的连线都会高亮。

查看[小说推荐配置](examples/multi-branch.json)和[多路分支示例](examples/06-multi-branch.html)。

## 决策问卷

同一份决策图 JSON 可以生成逐题作答的问卷，无需另写问题和答案配置：

```html
<div data-diagram data-src="/assets/diagrams/decision.json" data-view="questionnaire"></div>
<script src="/assets/loom/diagram.min.js"></script>
<script>Diagram.init();</script>
```

读者选择分支后进入下一题，到达 `result` 节点时显示答案。问卷支持：

- 返回上一题，并查看原来的选择。
- 打开流程图，查看已访问路线和当前位置，点击已访问节点返回对应问题。
- 在访问记录中跳到任意已访问步骤，包括之前的结果；循环流程也能按访问次序跳转。
- 返回时保留后续历史；选择原选项继续原路线，改选时更新后续问题与结果。

问卷兼容 `yes/no` 和多路 `branches`。查看[小说推荐问卷示例](examples/07-questionnaire.html)，接口见 [API 参考](docs/api.md#问卷视图)。

## 可展开的分组

在决策图中，用 `groups` 定义分组，用节点的 `group` 指定归属。分组可通过 `parent` 嵌套，`collapsed` 设置初始折叠状态。

图内的“▸ 展开”和“▾ 收起”标记可直接点击。折叠时隐藏内部节点，外部连线仍连接到分组；展开后恢复内部流程。路径高亮也会保留。

查看[嵌套分组配置](examples/combo.json)和[分组示例](examples/03-collapsible-groups.html)。

## 函数图

将以下内容保存为 `function.json`，然后用同样的 `data-diagram` 容器加载：

```json
{
  "type": "function",
  "expression": "x * x / 10",
  "domain": { "x": [-5, 5], "y": [-2, 5] },
  "interactive": {
    "point": { "x": 2 },
    "showCoordinate": true
  }
}
```

读者可拖动曲线上的点查看坐标，或选中点后用左右方向键移动。表达式支持算术运算和常见数学函数，具体语法见 [API 与配置参考](docs/api.md#函数图配置)。

## 用 JavaScript 控制图

需要响应业务交互或自行管理图时，可使用 `renderDiagram()`：

```js
import { renderDiagram } from './assets/loom/diagram.js';

const container = document.querySelector('#diagram');
const graph = await renderDiagram(container, './assets/diagrams/decision.json');

if (graph.kind === 'graph') {
  await graph.highlightPath(['check', 'allow']);
}
```

页面中需提供 `<div id="diagram"></div>`；这段代码应在 ES Module 中执行。函数返回图实例，可用于高亮路径、展开分组、监听变化或读取函数坐标。移除图的容器前调用 `destroy()` 释放资源。

完整参数、事件、错误处理和配置规则见 [API 与配置参考](docs/api.md)。

## 在 Jekyll 中使用

安装 include 并在公共布局中加载脚本后，Markdown 中只需一行：

```liquid
{% include diagram.html src="/assets/diagrams/decision.json" height="480" %}
```

资源路径会自动适配 Jekyll 的 `baseurl`。具体安装步骤见 [Jekyll 接入说明](integrations/jekyll/README.md)。

## 示例与文档

| 示例 | 内容 |
| --- | --- |
| [基础决策图](examples/01-basic-decision.html) | 判断条件与结果 |
| [路径高亮](examples/02-sample-highlight.html) | 在不同情境的路径之间切换 |
| [可展开分组](examples/03-collapsible-groups.html) | 嵌套分组及展开、收起 |
| [交互函数图](examples/04-interactive-function.html) | 拖动点、坐标和变化事件 |
| [同页多图](examples/05-user-manual.html) | 自动初始化决策图与函数图 |
| [多路分支](examples/06-multi-branch.html) | 三路选择与自定义分支标记 |
| [决策问卷](examples/07-questionnaire.html) | 逐题选择、返回与流程图跳转 |

示例链接指向仓库源码，可在构建后通过 HTTP 服务预览。[开发指南](docs/development.md)包含运行示例、构建和测试的步骤。

- [API 与配置参考](docs/api.md)
- [Jekyll 接入说明](integrations/jekyll/README.md)
- [开发指南](docs/development.md)

## 许可证

Loom 采用 GNU Affero General Public License v3.0（AGPL-3.0-only）许可。完整条款见 [LICENSE](LICENSE)。
