# 组织前沿

科技公司组织、人才、文化与 AI 资讯网站。

网站地址：https://tivona0313-sketch.github.io/org-observer/

## 订阅更新

配置 GitHub Actions 后，计划在北京时间每天 00:17、06:17、12:17、18:17 检查微软、Google、OpenAI、Meta 四个官方 RSS 并重新发布。GitHub 排队可能延迟；运行状态以仓库 Actions 为准。

- 单个来源失败保留旧内容与最近成功时间；全部失败或翻译失败时保留原站。
- 资讯标题、摘要与阅读详情同时呈现中文和英文，支持中英文搜索；机器译文标明，保留原始来源链接。
- 关键词初筛；最多累计保留 500 条候选，9 篇精选原始内容不自动改写。
- 新增和变更文本自动翻译，相同文本复用 `bilingual.json` 缓存。翻译使用无需 API Key 的 Google Translate 公开端点，可用性不保证。
- 网页刷新读取已发布数据；手动采集在 Actions 运行 `Update news and publish`。
- 收藏、阅读记录和学习笔记仅保存在访问者自己的浏览器，不上传到仓库。

## 文件与维护

`org-news-public` 是唯一发布目录。`org-news/server.py` 提供 RSS 读取与分类；`scripts/update_feed.py` 执行单次采集；`scripts/translate_feed.py` 维护双语译文；`.github/workflows/update.yml` 负责定时更新与 Pages 发布。详细部署说明见 [GITHUB-ACTIONS.md](GITHUB-ACTIONS.md)。

```sh
python3 scripts/update_feed.py
python3 -m http.server 8767 --directory org-news-public
```

打开 http://localhost:8767。需要 Python 3.9+ 和 Node.js，无需第三方依赖。

修改定时时间时同步修改 workflow cron 和 `scripts/update_feed.py` 的 `next_schedule`。`main` 是默认分支，工作流需要 contents 写权限和 Pages 发布权限；限制直接写入分支的规则可能导致快照保存失败。
