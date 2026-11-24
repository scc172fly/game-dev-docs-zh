# Mermaid 离线经典脚本

`mermaid.bundle.js` 是对本仓库 `vendor/mermaid/` 中已有 JavaScript 模块的重新打包。原始模块来自官方 `dotnet/orleans` 文档发布快照；原模块保持不变，以便检查来源和重建产物。

## 来源记录

- 官方文档：<https://dotnet.github.io/orleans/>
- 官方源代码提交：`6a0e937f544c35ffcf11b37e4c2b7de5a1580a03`
- 下载的官方发布产物 SHA-256：`137cf4e9e193eeb0744cfe286f04d8a4f1824dc3524b0a9ca7a210fdab2e36f8`
- 原始 Mermaid 入口：`MarkdownContent.astro_astro_type_script_index_0_lang.DkVBEdKO.js`
- 原始入口 SHA-256：`21f43efa451f1cbf70fdbc27448775b7822bdfa5872552829ea173cb0133512a`

Mermaid 及其依赖的著作权和许可证沿用各自上游的条款。本文件仅记录来源和本地打包改动，不为第三方代码重新授权。打包器保留输入中已有的法律声明注释；未改写原始 Mermaid 模块的算法或图表源代码。Mermaid 上游项目：<https://github.com/mermaid-js/mermaid>。

## 本地打包改动

1. 将 95 个入口及依赖模块合入一个 IIFE，供普通 `<script>` 使用。
2. 将原 Vite 预加载器替换为内存中的 Promise 加载函数，移除模块预加载列表。所有图表模块均已包含在单一产物中。
3. 移除原文档页面附带的自动图表观察器和图片灯箱启动逻辑；由中文站控制图表渲染。
4. 关闭自动页面加载渲染，并公开 `window.OrleansMermaid`。调用方使用其 `initialize` 和 `render` 方法。

产物不含静态 `import`、动态 `import()`、`import.meta` 或 `modulepreload`。经典脚本语法和无外部模块依赖均在构建时验证。现有 22 幅图表只使用流程图、时序图和状态图；无需远端 JavaScript、CSS、字体或图标。

完整打包保留了上游 ELK 的可选 Worker 分支；站点的现有图表不使用该分支。上游 ELK 中一处与 `-0` 比较的提示属于原有代码，构建器记录此提示并保留原语义，不将其当作新增打包错误。

## 重建

构建需要 Node.js，以及固定版本的 `esbuild@0.25.12` 和 `acorn@8.15.0`。它们仅在构建时使用，不是访问站点时的依赖。可在临时目录安装构建依赖，再从项目根目录运行：

```sh
npm install --prefix /absolute/path/to/temporary-build-tools --no-audit --no-fund --save-exact esbuild@0.25.12 acorn@8.15.0
node scripts/build_mermaid_bundle.mjs --toolchain /absolute/path/to/temporary-build-tools/node_modules
```

默认输入为 `vendor/mermaid/`，默认输出为 `vendor/mermaid.bundle.js`。也可使用 `--source-dir`、`--out` 和 `--report` 显式指定输入、输出及 JSON 构建报告路径。若官方快照入口结构发生变化，构建器会拒绝套用原快照的启动代码边界，要求先审阅更新后的入口。
