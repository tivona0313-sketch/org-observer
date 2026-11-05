# 组织前沿

科技公司组织、人才、文化与 AI 资讯网站。

网站地址：https://tivona0313-sketch.github.io/org-observer/

## 订阅更新

配置 GitHub Actions 后，计划在北京时间每天 00:17、06:17、12:17、18:17 检查微软、Google、OpenAI、Meta 四个官方 RSS 并重新发布。GitHub 排队可能延迟；运行状态以仓库 Actions 为准。

- 单个来源失败保留旧内容与最近成功时间；全部来源失败或列表翻译失败时保留原站。单篇正文失败不阻止其他正文发布。
- 资讯标题、摘要与阅读详情同时呈现中文和英文，支持中英文搜索；机器译文标明，保留原始来源链接。
- 阅读页新增核心观点提炼、可溯源的原文段落及完整中文译文，支持中文、中英对照、原文三种阅读模式。正文按需加载，无需跳出网站。
- 正文使用 Defuddle 清理导航广告，保留文字、小标题和列表；图片、视频及交互内容保留在原站。核心观点为自动选择的原文关键句，附段落定位。
- 来源拒绝访问、正文不足或翻译未完成时明确显示状态，不以摘要冒充全文。已成功获取的正文会缓存保留。
- 关键词初筛；最多累计保留 500 条候选，9 篇精选原始内容不自动改写。
- 新增和变更文本自动翻译，相同文本复用 `bilingual.json` 缓存。新译文使用 Argos Open Tech 1.9 离线模型，保留已有的 Google 译文缓存，不依赖在线免费翻译接口。
- 网页刷新读取已发布数据；手动采集在 Actions 运行 `Update news and publish`。
- 收藏、阅读记录和学习笔记仅保存在访问者自己的浏览器，不上传到仓库。

## 文件与维护

`org-news-public` 是唯一发布目录。`org-news/server.py` 提供 RSS 读取与分类；`scripts/update_feed.py` 执行单次采集；`scripts/translate_feed.py` 维护双语译文；`.github/workflows/update.yml` 负责定时更新与 Pages 发布。详细部署说明见 [GITHUB-ACTIONS.md](GITHUB-ACTIONS.md)。

```sh
python3 scripts/update_feed.py
python3 -m http.server 8767 --directory org-news-public
```

打开 http://localhost:8767。需要 Python 3.9+ 和 Node.js 22+。首次运行前执行 `npm ci --prefix scripts`、`python3 -m pip install -r scripts/requirements-content.txt`、`python3 scripts/offline_translate.py` 安装正文提取和离线翻译依赖。模型缓存在用户缓存目录，云端由 Actions cache 保留。

修改定时时间时同步修改 workflow cron 和 `scripts/update_feed.py` 的 `next_schedule`。`main` 是默认分支，工作流需要 contents 写权限和 Pages 发布权限；限制直接写入分支的规则可能导致快照保存失败。
