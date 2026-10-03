# Jekyll 集成

把 `diagram.html` 复制到博客的 `_includes/diagram.html`，把构建后的 `dist/diagram.min.js` 放到 `assets/diagram/`，将 JSON 放到 `assets/diagrams/`。

Markdown 中写一行：

```liquid
{% include diagram.html src="/assets/diagrams/combo.json" %}
```

可选参数 `height="640"` 和 `id="access-flow"`。路径使用 Jekyll 的 `relative_url`，支持部署在子目录，属性经过 HTML 转义。

在布局的 body 末尾统一加载：

```html
<script src="{{ '/assets/diagram/diagram.min.js' | relative_url }}"></script>
<script>Diagram.init();</script>
```

## 最小示例

从 Loom 仓库根目录运行：

```sh
npm run build:jekyll
npm run demo
```

访问 `http://127.0.0.1:4173/jekyll/`。需要已有 Ruby 和 Jekyll 4.4（也可在 example 目录 `bundle install`）。prepare 脚本将正式 include、bundle 和 JSON 复制进示例，避免维护两套代码。

示例配置 `baseurl: /jekyll`，生成结果可以放到静态网站的 `/jekyll/` 目录。实际博客使用自己的 baseurl。
