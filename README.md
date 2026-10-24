# 游戏开发中文文档

面向中文开发者整理的游戏开发技术文档合集，目前收录 Mirror、FishNet、Microsoft Orleans、PureMVC 和 Unity MCP 五个项目，共七套中文文档。

**[进入中文文档导航首页](https://scc172fly.github.io/game-dev-docs-zh/)**

## 在线文档

| 项目 | 中文文档 | 官方源码仓库 | 官方文档 |
| --- | --- | --- | --- |
| Mirror Networking | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/mirror-networking/) | [MirrorNetworking/Mirror](https://github.com/MirrorNetworking/Mirror) | [mirror-networking.gitbook.io/docs](https://mirror-networking.gitbook.io/docs/) |
| FishNet | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/fish-net/) | [FirstGearGames/FishNet](https://github.com/FirstGearGames/FishNet) | [fish-networking.gitbook.io/docs](https://fish-networking.gitbook.io/docs/) |
| Microsoft Orleans 10.4.0 | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/orleans/) | [dotnet/orleans](https://github.com/dotnet/orleans) | [dotnet.github.io/orleans/docs](https://dotnet.github.io/orleans/docs/) |
| PureMVC 三编文档 | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/puremvc/trilogy/) | [PureMVC](https://github.com/PureMVC) | [puremvc.org](https://puremvc.org/) |
| PureMVC ActionScript 开发者指南 | [在线阅读](https://scc172fly.github.io/game-dev-docs-zh/puremvc/actionscript-developers-guide/) | [PureMVC](https://github.com/PureMVC) | [puremvc.org](https://puremvc.org/) |
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
│   └── actionscript-developers-guide/index.html
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

## 免责声明与版权

本仓库为非官方中文整理项目，仅用于学习与技术交流，不代表 Mirror、FishNet、Microsoft 或其他原作者及组织。

原始文档、商标、图片与代码示例的版权归各自权利人所有，并遵循其原有许可协议。本项目中的中文翻译与整理不改变原内容的版权归属。涉及版本、API、安全配置或生产环境部署时，请同时查阅对应项目的最新官方文档。
