# 组织前沿 · GitHub Actions 发布

已于 2026-11-05 完成首次云端采集与 GitHub Pages 发布。四个来源均成功，累计 89 条订阅候选；定时工作流已启用。

- 网站：https://tivona0313-sketch.github.io/org-observer/
- 仓库：https://github.com/tivona0313-sketch/org-observer
- 更新与运行记录：https://github.com/tivona0313-sketch/org-observer/actions
- 首次成功运行：https://github.com/tivona0313-sketch/org-observer/actions/runs/41964237185

按北京时间每天 00:17、06:17、12:17、18:17 计划更新。无需保持本机开机；排队可能延迟。下方首次接入步骤可用于重新部署或建立副本。

首页列表和顶部卡片随订阅数据更新，按文章发布日期显示最新内容。官方订阅和精选均采用中英对照，中文在上、英文在下；资讯标题、摘要、阅读要点、学习启发、问题、信息边界及来源标题覆盖两种语言，搜索也同时匹配中英文。RSS 标为待核验，机器译文标明来源；精选中文整理内容保留。页面上的采集时间表示检查来源的时间，不能当作文章发布日期。

## 首次接入

1. 在 GitHub 新建公开仓库，默认分支使用 `main`。建议名称：`org-observer`。公开仓库的代码与订阅数据均可被查看。
2. 将 `org-news-github-actions.zip` 解压后的**全部内容**放到仓库根目录，包括隐藏的 `.github` 文件夹。不要直接上传 ZIP，也不要多套一层目录。macOS Finder 用 `Command + Shift + .` 显示隐藏文件。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 **Actions → Update news and publish → Run workflow** 手动运行一次。首次上传可能已触发运行；若因 Pages 尚未开启而失败，在完成第 3 步后重新运行。
5. 等待 `Publish website` 成功，在该次运行的 `github-pages` 部署链接打开网页。通常为 `https://你的用户名.github.io/org-observer/`。

本配置使用 GitHub 自带的 `GITHUB_TOKEN`，无需填写个人 Token 或 RSS API Key。工作流已声明写入与 Pages 发布权限；如组织策略禁止这些权限，需要仓库管理员放行。若 `main` 要求所有更改通过 PR，机器人直接保存订阅快照会失败，需要按仓库策略调整数据存储方案。

## 仓库结构

```text
.github/workflows/update.yml
scripts/update_feed.py
scripts/translate_feed.py
scripts/update_content.py
scripts/extract_article.mjs
scripts/package.json
scripts/package-lock.json
scripts/offline_translate.py
scripts/requirements-content.txt
org-news/server.py
org-news-public/
  index.html
  styles.css
  app.js
  data.js
  feed.json
  bilingual.json
  content-index.json
  articles/<article-id>.json
README.md
.gitignore
```

只有 `org-news-public` 会发布为网页。此包仅包含网站与采集配置，不包含工作区其他报告或个人浏览器数据。

## 更新规则

- 北京时间每天 **00:17、06:17、12:17、18:17** 计划采集并发布；GitHub 排队可能延迟，高负载时可能跳过，不保证准点。
- 定时任务只从默认分支运行，请保持默认分支为 `main`。公开仓库长期没有活动时 GitHub 可能停用定时任务；发现停更请检查 Actions 是否需要重新启用。
- 微软、Google、OpenAI、Meta 四个官方 RSS 按原有关键词筛选；最多累计保留 500 条，中文精选原始内容不自动改写。
- 中英译文保存在 `bilingual.json`。相同原始文本复用缓存；新增和变更字段自动翻译，避免每次整批重复翻译。英文 RSS 保留英文，配中文译文；中文精选保留中文，配英文译文。
- 新译文使用 Argos Open Tech 1.9 离线模型，通过 CTranslate2 在本地或 Actions 运行，不依赖在线免费翻译接口。已有 Google 译文缓存继续复用。模型覆盖英中、中英、法英，法语先译为英文再译为中文；其他语种明确标为暂不支持。模型首次下载后缓存复用。
- 只有标题、摘要及精选字段的翻译全部完成才保存新的列表快照。此阶段失败时工作流失败，保留旧快照和网站；前端核对列表快照与译文版本，避免发布缓存延迟导致错配。正文逐篇处理，单篇失败不阻止其他正文发布。
- 单个来源失败：保留其旧内容与最近成功时间，其余来源继续更新。
- 全部来源失败：工作流失败，保留旧快照和已发布网站，不能把旧数据标成刚刚更新。
- 网页“刷新”读取最新已发布数据；立即发起采集需到 Actions 手动运行。打开中的网页每分钟检查一次已发布快照。
- 页面时间表示采集时间。是否持续运行应以 Actions 的最新运行记录为准；全部失败时，网站仍显示上次成功发布的状态。
- 收藏、笔记与阅读记录保存在访问者自己的浏览器，不上传到 GitHub。

## 站内全文阅读

- 点击资讯后按需读取该篇正文，不要求用户跳转。阅读页包括核心观点、正文、原文链接，原有摘要与学习补充折叠展示，笔记继续保留。
- `scripts/update_content.py` 获取允许来源的公开 HTML，`extract_article.mjs` 用 Defuddle 提取正文，保留段落、小标题、列表和表格文字。移除导航、广告和推荐区；不抓取视频、交互式内容或图片。
- 正文按段翻译，可选中英对照、中文、原文。原始语种单独保留，非英文来源也生成中文及英文译文。翻译不是人工审校。
- 2026-11-09 补齐原先不可用的 57 篇正文，共 1,699 段：53 篇采用发布方官方双语版本，1 篇以官方中文为主并补译末段引语，3 篇使用逐段核对的 AI 译文。页面分别标注正文译文来源；标题与导读摘要仍可能包含机器翻译。
- 本次补采使用可直接浏览的公开页面，保存原始语言快照及段落对应关系。`sources/article-recovery` 保留来源，`scripts/import_recovered_articles.py` 校验并导入；`extract_browser_article.js` 是浏览器页面正文提取辅助脚本。长文保留正文与脚注；视频、图表和交互展开表格仍需查看原站。
- 定时任务复用这些成功正文；浏览器补采并未接入云端自动化。后续新文章仍走现有自动提取和翻译流程，抓取失败时明确显示摘要状态。
- 核心观点采用可追溯的关键句抽取，优先选择与标题相关、包含具体行动或数据的段落；不是独立事实核验或人工深度分析。每条观点可以在页内定位对应正文段落。
- 内容保存为 `articles/<article-id>.json`。成功正文缓存复用；新文章进入提取翻译流程，标题或地址变更后重取。成功正文不会因临时失败被覆盖。此版本不会主动检测网页同标题下的静默正文修改。
- 来源拒绝访问、跳转不安全、正文太短、超过抓取上限等均明确标为不可用；不绕过登录、付费墙或访问限制。获取失败后至少间隔 24 小时再尝试。翻译未完成单独标注，不将短摘要冒充全文。
- 正文失败与标题摘要更新相互隔离，可成功的内容继续发布。网页仅渲染转义后的纯文本，来源 HTML 脚本不执行。
- 首次下载的离线模型固定版本并核对 SHA-256。模型来自 [Argos Open Tech 模型索引](https://www.argosopentech.com/argospm/index/)，只缓存在运行环境，不随网站发布。
- 长句按完整短句或分句翻译后回填原段落，并处理常见 AI 产品名和组织管理术语；仍可能存在用词或语境偏差。维护者调整术语后可运行 `python3 scripts/update_content.py --retranslate`，复用已抓取原文重新生成译文。

## 本地检查

在解压后的仓库目录执行（Python 3.9+ 与 Node.js 22+）：

```sh
npm ci --prefix scripts
python3 -m pip install -r scripts/requirements-content.txt
python3 scripts/offline_translate.py
python3 scripts/update_feed.py
python3 -m http.server 8767 --directory org-news-public
```

打开 `http://localhost:8767`。本地单次采集只更新快照，不代表云端任务已经启用。

## 维护

采集源和分类：修改 `org-news/server.py`。翻译服务：修改 `scripts/translate_feed.py` 的 `translate_text`。定时时间：同时修改工作流 cron 和 `scripts/update_feed.py` 的 `next_schedule`。

检查失败：先看 Actions 日志。全部订阅源无法访问时保留原站；仓库推送冲突时工作流停止发布，在提交结束后重新运行即可，不会强推覆盖他人的修改。
