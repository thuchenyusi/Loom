# 开发指南

本指南面向修改 Loom 源码、运行仓库示例或参与开发的人。网页接入方法见 [README](../README.md)，接口和配置见 [API 参考](api.md)。

## 准备环境

使用 Node.js 22.19+ 和 npm。在仓库根目录安装依赖：

```sh
npm ci
```

## 开发与预览

```sh
npm run dev
```

开发服务器运行在 `http://127.0.0.1:5173`。

预览构建后的独立静态示例：

```sh
npm run build
npm run demo
```

访问 `http://127.0.0.1:4173`，默认页面是同页多图示例。其他示例位于 `/examples/`。静态服务只负责提供文件，图的交互由浏览器执行。

## 构建产物

`npm run build` 执行类型检查、打包和类型声明生成。

- `dist/diagram.min.js`：全局对象为 `Diagram` 的浏览器脚本。
- `dist/diagram.js`：ES Module。
- `dist/index.d.ts`：TypeScript 类型入口。

两种脚本均包含图形渲染与校验依赖。`dist/` 和生成的示例资源不提交到 Git。

## Jekyll 示例

需要 Ruby 和 Jekyll 4.4。依赖声明在 [示例 Gemfile](../integrations/jekyll/example/Gemfile)，也可在该目录运行 `bundle install`。

在仓库根目录运行：

```sh
npm run build:jekyll
npm run demo
```

访问 `http://127.0.0.1:4173/jekyll/`。构建流程将正式 include、浏览器脚本和 JSON 复制进示例，再生成静态页面。示例使用 `baseurl: /jekyll`；接入实际博客时使用博客自己的配置。

## 检查修改

```sh
npm test
npm run build:jekyll
npm run test:browser
```

单元测试覆盖配置校验、路径、分组、表达式、事件和初始化。浏览器测试使用 Microsoft Edge，检查构建产物、图内操作、函数拖动、多图生命周期和 Jekyll 页面。截图保存在 `test-results/`。

Playwright 的浏览器配置见 [playwright.config.ts](../playwright.config.ts)。完整浏览器验收前需要构建 Jekyll 示例。

构建时 JSXGraph 自带的 JessieCode 会产生 `eval` 提示。Loom 的函数表达式由独立解析器处理，不使用该代码路径。部署相关的 CSP 限制见 [API 参考](api.md#部署注意事项)。

原始设计与实施记录见 [PLAN.md](../PLAN.md)。
