# Nexusnote

Obsidian 个人知识库仪表盘插件（Agent 操作中心）。在 Obsidian 内部提供一站式知识库概览与快速操作入口，帮助你以「四层知识库」结构管理个人资料。

## 功能特性

- **仪表盘概览**：仓库健康、原始资料、知识库、任务情况、输出 五项统计，一屏总览 Vault 状态。
- **笔记创建趋势**：股市风格折线图，支持近 7 天 / 30 天 / 6 个月 / 1 年切换，悬停查看每日新建笔记数。
- **最近更新**：列出 Vault 中最近修改的笔记，点击直达。
- **日历视图**：按日查看笔记创建情况；点击日期可查看当天笔记，或一键新建当天日记。
- **一键部署知识库**：首次点击自动创建四层知识库目录，并在仓库根目录生成 `agent.md` 规则文件（目录结构见下）。
- **快速新建**：
  - 新笔记 / 灵感 —— 基于模板在「创意想法」文件夹创建；
  - 新素材 —— 支持「模板新建 / 从文件夹导入 / 从文件导入」三种方式，复制到原始资料层。
- **素材入库**：一键打开 Claudian 插件并将原料层交给它处理（提取知识 → 知识库、灵感 → 创意想法、产出 → 输出，原始素材保持不变）。
- **设置入口**：仪表盘内直接跳转插件设置页面。

## 知识库目录结构约定

知识库采用四层结构（与 `agent.md` 规则一致）：

1. `1_原始资料（不可变原料）` —— 导入的原始素材，保持不可变。
2. `2_创意想法（灵感燃料）` —— 灵感与半成品。
3. `3_知识库（AI接管Wiki）` —— 结构化知识。
4. `4_输出（成品出口）` —— 最终成品。

模板文件存放于 `templater/` 文件夹。

## 开发

本项目使用 TypeScript 提供类型检查与文档。

- `npm install` —— 安装依赖
- `npm run dev` —— esbuild watch 开发模式（监听 `src/` 改动并编译到 `main.js`）
- `npm run build` —— 类型检查 + 生产构建（输出 `main.js`）
- `npm run lint` —— ESLint 检查（含 `eslint-plugin-obsidianmd` 规则）

## 手动安装插件

将以下三个文件复制到你的 Vault：`VaultFolder/.obsidian/plugins/Nexusnote/`

- `main.js`
- `manifest.json`
- `styles.css`

> 注：本仓库 `.gitignore` 忽略 `main.js`（构建产物）。发布时请通过 GitHub Release 上传这三个文件，并将 `manifest.json` 同时放在仓库根与 Release 中。

## 发布新版本

1. 在 `manifest.json` 更新版本号与所需最低 Obsidian 版本。
2. 在 `versions.json` 增加 `"新版本号": "最低obsidian版本"` 条目。
3. 以版本号作为 Tag 创建 GitHub Release，上传 `manifest.json`、`main.js`、`styles.css`。

## API 文档

参见 https://docs.obsidian.md
