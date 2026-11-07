# 游戏开发中文文档

面向中文开发者整理的游戏开发技术文档合集，目前收录 Mirror、FishNet、Microsoft Orleans、PureMVC 和 Unity MCP 五个项目，共七套中文网页文档，另附四册 PureMVC 中文 PDF 书籍。

**[进入中文文档导航首页](https://scc172fly.github.io/game-dev-docs-zh/)**

## 在线文档

| 项目 | 中文文档 | 官方源码仓库 | 官方文档 |
| --- | --- | --- | --- |
| Mirror Networking | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/mirror-networking/) | [MirrorNetworking/Mirror](https://github.com/MirrorNetworking/Mirror) | [mirror-networking.gitbook.io/docs](https://mirror-networking.gitbook.io/docs/) |
| FishNet | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/fish-net/) | [FirstGearGames/FishNet](https://github.com/FirstGearGames/FishNet) | [fish-networking.gitbook.io/docs](https://fish-networking.gitbook.io/docs/) |
| Microsoft Orleans 10.4.0 | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/orleans/) | [dotnet/orleans](https://github.com/dotnet/orleans) | [dotnet.github.io/orleans/docs](https://dotnet.github.io/orleans/docs/) |
| PureMVC 三编文档 | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/puremvc/trilogy/) | [PureMVC](https://github.com/PureMVC) | [puremvc.org](https://puremvc.org/) |
| PureMVC ActionScript 开发者指南 | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/puremvc/actionscript-developers-guide/) | [PureMVC](https://github.com/PureMVC) | [puremvc.org](https://puremvc.org/) |
| PureMVC PDF 书籍合集 | [在线阅读与下载](https://scc172fly.github.io/game-dev-docs-zh/puremvc/books/) | [PureMVC](https://github.com/PureMVC) | [puremvc.org](https://puremvc.org/) |
| MCP for Unity 官方文档中文整理 | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/unity-mcp/official-docs/) | [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp) | [官方仓库文档](https://github.com/CoplayDev/unity-mcp#readme) |
| ChatGPT × Unity 6 MCP 接入实战指南 | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/unity-mcp/chatgpt-unity6-guide/) | [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp) | [官方仓库文档](https://github.com/CoplayDev/unity-mcp#readme) |

## 目录结构

同一项目有多套文档时，按文档主题划分子目录；每套文档统一使用 `index.html`，通过目录地址访问。

```text
game-dev-docs-zh/
├── index.html                         # 文档导航首页
├── README.md
├── site-icon.svg                      # 站点图标
├── mirror-networking/index.html
├── fish-net/index.html
├── orleans/index.html
├── puremvc/
│   ├── trilogy/index.html
│   ├── actionscript-developers-guide/index.html
│   └── books/
│       ├── index.html                 # PDF 书架，按推荐阅读顺序排列
│       ├── reader.html                # 在线阅读器入口
│       ├── files/                     # 四册 PDF，保留原文件内容
│       ├── covers/                    # 从 PDF 首页生成的封面预览
│       └── translation-notes.txt      # 原译本说明与文件名对应表
├── assets/pdfjs/                      # 本地 PDF.js 阅读组件与许可证
└── unity-mcp/
    ├── official-docs/index.html        # MCP for Unity 官方文档中文整理
    └── chatgpt-unity6-guide/index.html # ChatGPT × Unity 6 接入实战指南
```

## Unity MCP 阅读顺序

建议先阅读 [MCP for Unity 官方文档中文整理](https://scc172fly.github.io/game-dev-docs-zh/unity-mcp/official-docs/)，了解安装配置、工作原理与工具参考；使用 ChatGPT Windows 桌面版连接 Unity 6 时，再参照[接入实战指南](https://scc172fly.github.io/game-dev-docs-zh/unity-mcp/chatgpt-unity6-guide/)完成连接验证与故障排查。

接入实战指南记录了已成功的只读调用验证，写入能力仍标注为待测试；具体适用范围与验证边界以文档正文为准。

## PureMVC 阅读顺序

建议先阅读[三编文档](https://scc172fly.github.io/game-dev-docs-zh/puremvc/trilogy/)，建立架构与角色协作的整体认识，再阅读 [ActionScript 开发者指南](https://scc172fly.github.io/game-dev-docs-zh/puremvc/actionscript-developers-guide/)中的完整章节与代码示例。

- 第一编：概念架构与介绍。
- 第二编：框架概述与 UML，涵盖核心角色、类图与接口。
- 第三编：实现惯例与最佳实践。
- 三编共 37 个正文小节，另附 33 节 UML 从入门到实践教程、C# 示例与技术校订勘误。
- 开发者指南：保留原书全 10 章结构与代码示例。

### PDF 书籍

[PDF 书籍合集](https://scc172fly.github.io/game-dev-docs-zh/puremvc/books/)保留原有排版、插图、代码和中文目录书签，支持浏览器内阅读、搜索、缩放、目录跳转与下载。阅读顺序如下：

| 阅读顺序 | 书籍 | 页数 | 文件 |
| --- | --- | --- | --- |
| 1 | 概念示意图与简介 | 1 | [PureMVC_概念示意图与简介.pdf](puremvc/books/files/PureMVC_概念示意图与简介.pdf) |
| 2 | 框架概览与 UML 图解 | 14 | [PureMVC_框架概览与UML图解.pdf](puremvc/books/files/PureMVC_框架概览与UML图解.pdf) |
| 3 | 实现惯用法与最佳实践 | 46 | [PureMVC_实现惯用法与最佳实践.pdf](puremvc/books/files/PureMVC_实现惯用法与最佳实践.pdf) |
| 4 | ActionScript 开发者指南 | 262 | [PureMVC_ActionScript开发者指南.pdf](puremvc/books/files/PureMVC_ActionScript开发者指南.pdf) |

PDF 文件名去掉了原有编号及末尾的“中文”后缀，文件内容不变，合计 323 页。译本说明、勘误与校验记录见[随书说明](puremvc/books/translation-notes.txt)。

在线阅读器使用随仓库部署的 [Mozilla PDF.js](assets/pdfjs/README.md)，支持现代浏览器，所有阅读资源从本站加载。新增内容与现有网页一起由 GitHub Pages 发布，不需要额外的后端服务。开发时请通过静态 HTTP 服务器预览；直接双击本地 HTML 文件无法加载 PDF.js 的模块与 Worker。

## 免责声明与版权

本仓库为非官方中文整理项目，仅用于学习与技术交流，不代表 Mirror、FishNet、Microsoft 或其他原作者及组织。

原始文档、商标、图片与代码示例的版权归各自权利人所有，并遵循其原有许可协议。本项目中的中文翻译与整理不改变原内容的版权归属。涉及版本、API、安全配置或生产环境部署时，请同时查阅对应项目的最新官方文档。
