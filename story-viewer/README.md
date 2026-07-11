# Story Viewer

用于浏览 `JP`、`EN`、`KR`、`LLC_zh-CN` 四套 `StoryData` 的多语言剧情对照页面。

更完整的项目架构和维护说明见：

- [../README.md](../README.md)
- [../docs/architecture.md](../docs/architecture.md)
- [../docs/maintenance.md](../docs/maintenance.md)

## 使用方法

1. 在工作区根目录执行：`node LocalizeLimbusCompany/scripts/build-story-index.mjs`
2. 启动本地静态服务：`node LocalizeLimbusCompany/scripts/serve-story-viewer.mjs`
3. 打开浏览器访问：`http://localhost:4173/story-viewer/`

说明：`story-viewer` 目录与 `LocalizeLimbusCompany` 项目目录平行放置。

## 功能

- 按剧情类别、章节、关卡浏览剧情
- 同页多语言并排显示
- 按剧情行 `id` 对齐，便于逐句对照
- 每一行剧情都有独立语言开关，可逐对话框实时切换显示语言
- 标记缺失语言版本

## 命名规则

- `S`：主线剧情
- `E`：间章剧情
- `ES`：间章8授课剧情
- `P`：瓦夜剧情
- `PC`：方舟联动剧情
- `数字+D`：保留原编号体系，归入其他剧情

## 维护提示

- `data/story-index.json` 是生成文件，不要手写维护。
- 改动本地化数据、剧情编号解析、分类或排序后，重新运行 `build-story-index.mjs`。
- 详情页渲染逻辑在 `story.js`；目录页筛选逻辑在 `app.js`。
- 优化详情页性能时，必须保留“每个对话框独立切换语言”的行为。