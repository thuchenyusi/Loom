# 在 Jekyll 中使用 Loom

将 Loom 接入博客后，可直接在 Markdown 中插入交互式图。图的内容由 JSON 定义，生成的网站仍是静态页面。

## 安装资源

按 [Loom 的构建步骤](../../README.md#获取脚本)获取浏览器脚本，将以下文件放入博客：

| 来源 | 博客中的位置 |
| --- | --- |
| [diagram.html](diagram.html) | `_includes/diagram.html` |
| `dist/diagram.min.js` | `assets/loom/diagram.min.js` |
| 你的图配置 JSON | `assets/diagrams/` |

在公共布局的 `</body>` 前加入一次：

```html
<script src="{{ '/assets/loom/diagram.min.js' | relative_url }}"></script>
<script>Diagram.init();</script>
```

## 在文章中插入图

```liquid
{% include diagram.html src="/assets/diagrams/decision.json" %}
```

可选参数：

| 参数 | 用途 |
| --- | --- |
| `src` | 必填，图配置 JSON 的站点路径 |
| `height` | 画布高度，单位为像素 |
| `view` | `questionnaire` 将决策图显示为可作答问卷，默认显示图 |
| `id` | 容器 ID，方便用 JavaScript 获取该容器 |

例如：

```liquid
{% include diagram.html src="/assets/diagrams/decision.json" height="480" id="access-flow" %}
```

需要逐题作答时：

```liquid
{% include diagram.html src="/assets/diagrams/decision.json" view="questionnaire" %}
```

同一文章可插入多个图。决策图和函数图使用相同的 include，由 JSON 中的 `type` 决定。

include 和脚本路径使用 `relative_url` 适配博客的 `baseurl`，无需在每篇文章里重复添加部署子目录。属性值会经过 HTML 转义。

## 编写图配置

- [最小决策图与函数图](../../README.md#快速接入)
- [完整配置与 API](../../docs/api.md)
- [嵌套分组配置示例](../../examples/combo.json)

如需预览仓库内的 Jekyll 示例，见[开发指南](../../docs/development.md#jekyll-示例)。
