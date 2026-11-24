# Orleans 中文文档 · 使用说明

本包包含已经生成的完整站点，可以在本地阅读，也可以直接放到 GitHub Pages。阅读和发布均无需安装 Node.js、Python 或运行构建命令。

## Windows：解压后双击打开

1. 右键 ZIP，选择“全部解压”，等待解压完成。
2. 打开解压后的文件夹，双击 `index.html`。
3. 如果系统询问打开方式，选择 Microsoft Edge 或 Google Chrome。

保留 `index.html` 与同一文件夹中的其他文件和子文件夹。移动站点时，请移动整个文件夹。无需启动本地服务器。

中文阅读、中英对照、站内搜索、代码和图表使用包内资源。点击“英文原站”等外部链接时，需要连接互联网。

## GitHub Pages：从仓库根目录发布

1. 将解压后的**全部站点内容**提交到一个 GitHub 仓库。让 `index.html` 直接位于仓库根目录，并一并提交 `.nojekyll`。GitHub Free 账户请使用公开仓库。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment → Source** 选择 **Deploy from a branch**。
4. 选择放置站点的分支，例如 `main`，目录选择 **/(root)**，然后保存。
5. 发布成功后，在同一页面点击 **Visit site**。

通常访问地址为 `https://你的用户名.github.io/仓库名/`。站点使用相对资源路径和 `#/` 导航，可放在项目子路径中，无需修改仓库名配置。分享具体文档时，直接复制浏览器地址栏中的完整地址。

如果把站点内容放在仓库的 `docs/` 文件夹，则在第 4 步选择 **/docs**；`index.html` 和 `.nojekyll` 也应放在 `docs/` 内。

`.nojekyll` 用于让 GitHub Pages 直接发布这些静态文件，请保留它。分支发布的目录与入口要求见 [GitHub 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)；`.nojekyll` 的作用见 [创建 Pages 站点](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。

## 可选：用 GitHub Actions 发布

如果希望使用工作流发布，将包内的 `deploy-pages.yml` 移动到仓库的 `.github/workflows/deploy-pages.yml`，再在 **Settings → Pages → Source** 选择 **GitHub Actions**。默认位置仅作为模板，不会自动触发工作流。

工作流默认发布 `main` 分支的仓库根目录，不执行构建。分支名称不同，修改 `branches`；如果使用源码仓库中已经生成的 `dist/`，把 `SITE_DIR` 改为 `dist`。`SITE_DIR` 指向的目录内必须直接包含 `index.html`。

该工作流使用 GitHub 自动提供的权限，不需要填写个人访问令牌。配置依据 [GitHub 官方静态工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 内容与更新

这是基于固定官方快照制作的非官方中文对照版。来源版本、译审范围、代码校验和上游原文问题，可在站内“来源与审校记录”查看。新版本下载后，请完整解压替换，保持文件属于同一版本，并保留包内许可证。

本次静态版已通过载荷等值性、路径、文件引用及 HTTP 浏览器功能检查，详见 `static-compatibility.json`。测试环境限制了浏览器打开 `file://` 地址，因此本地路径与加载逻辑采用自动化模拟检查，未声称完成真实浏览器的双击验收。

## 最新修订：目录状态与中文控件

- 首次统一展开目录分组，随后记住手动展开／折叠；“收起全部”后刷新保持收起。
- 侧栏已移除“官网首页”，点击顶部Microsoft Orleans标志或文字返回首页。
- 主题选项统一为“深色／浅色／自动”，桌面与手机一致。
- 31项交互回归和针对性浏览器检查通过；完整结果见navigation-state-review.json。

## 上一轮修订：对照图标与原站主题

- 修复中英对照中文侧缺少图标：14 张首页卡片的中英文各有完整官方图标，并修正标题／正文分隔线对齐。
- 主题控件恢复原站 Dark／Light／Auto 下拉样式，复用官方图标。Auto 跟随系统，手动选择和刷新保持正常。手机普通文档的主题入口位于目录侧栏底部，与原站一致。
- 完成 676 项逐列对照检查、24 项首页主题／模式／宽度检查，以及 19 项真实主题源码行为检查。全部通过；本轮 191 个正文数据载荷保持不变。
- 本轮详细范围与限制见 SITE-REVIEW.md、compare-theme-review-report.json；完整逐页结果为 compare-browser-component-report.json。

## 已有内容与功能

- 页头增加官方仓库最新正式版本 **v10.4.2**，点击可打开对应 Release。该版本发布于 2026-10-30，本包于 2026-11-24 核验；“最新”以此核验日期为准，静态文件不会自动联网更新。
- 页头恢复原站透明 Logo 和单行品牌标题，删除“非官方中文对照”副标题。首页恢复原站的双列方角卡片、14 个彩色图标、字号和间距；文档的版本说明默认折叠。
- 全站恢复提示框、标题锚点、链接卡片和示例标签的原站图标与排版，并恢复 81 个只读任务框及原有三幅图片的放大查看。六张正文图补充了中文辅助文本。
- 内容基线已对全部 15,235 页进行源文与生成内容校验，修复 API 名称绑定错误并统一四个 Journaling 标签；本轮通过载荷指纹确认这些内容没有变化。此前中文模式和本轮对照模式分别完成了 338 条路线、桌面和手机各 676 个用例；详细范围、结果与限制见 `SITE-REVIEW.md`、`full-site-review-report.json`。
- 默认首页为官网首页的完整中文版本：官方大标志、三个开始入口、功能、应用场景、编程模型和开始构建区块；可切换中文、英文和中英对照。原先的导览页保留在“中文文档导航”入口。首页专项核验见 `homepage-restoration-report.json`。
- 中文模式显示中文代码注释；英文模式保留原始代码，中英对照并排显示有注释差异的代码块。可执行代码、字符串、API 标识符及格式标记保持原样。
- 页头及浏览器标签页使用原始官方 Orleans 图标。本站仍为非官方中文译站。
- 页面明确显示官方 `main` 文档快照、2026-11-23 快照日期及源码提交。文档示例包基准为 10.2.2，API 与迁移章节有各自的版本语境，详见站内版本说明及 `documentation-version.json`。
