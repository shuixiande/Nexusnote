# Nexusnote — Agent Guide

本文件为 AI 协作代理（Agent / Claude 等）在本仓库工作时的约定。`AGENTS.md` 与 `CLAUDE.md` 内容完全一致。

## 项目性质

- 这是一个用 **TypeScript** 编写的 **Obsidian community plugin** 项目仓库，**不是 Obsidian Vault**。
- 仓库内可能存在 `.obsidian/` 目录，仅供本地预览，不要当作插件数据来源，也不要修改其中内容。
- 插件 ID：`Nexusnote`
- 显示名称：`Nexusnote`
- 版本：`0.1.0`
- minAppVersion：`1.8.0`

## 常用命令

- `npm install` — 安装依赖
- `npm run dev` — esbuild watch 开发模式
- `npm run build` — 类型检查 + 生产构建（输出 `main.js`）
- `npm run lint` — ESLint 检查（含 `eslint-plugin-obsidianmd` 规则）

## 构建产物

Obsidian 插件目录最终只需要三个文件：

- `main.js`
- `manifest.json`
- `styles.css`

不要把 `node_modules/`、源码、`.git` 等放入插件目录。

## 开发原则

- 优先使用 Obsidian 官方公开 API，不依赖未公开的内部 API。
- 第一版实现保持最小、可测试、可迭代。
- 不要随意新增生产依赖（`dependencies`）；新增开发依赖前先说明。
- 遵循项目已有代码风格（制表符缩进、`eslint-plugin-obsidianmd` 规则）。

## Skill 参考

本项目已安装两个 skill（位于 `.workbuddy/skills/`）：

- **dashboard UI / 前端视觉**相关任务 → 优先参考 `frontend-design` skill（`.workbuddy/skills/frontend-design/SKILL.md`）。
- **Obsidian API、生命周期、manifest、安全、无障碍、插件审核规则** → 优先参考 `obsidian-plugin-skill` skill（`.workbuddy/skills/obsidian-plugin-skill/SKILL.md`，含 `reference/` 详细文档与 `tools/create-plugin.js` 脚手架工具）。

## 安全与确认

涉及以下操作前，必须先说明意图、涉及文件与影响，并等待明确确认：

- 网络请求、遥测、云同步
- 删除文件
- 修改真实 Vault 内容

不要提交 API key、token、本地 Vault 路径或任何私人数据到仓库。

## Git 约定

- 不要创建 Git remote。
- 不要发布仓库。
- 不要执行 `git commit`，除非明确要求。

## 协作流程

- 大范围修改前，先说明目标、涉及文件、最小实现方案。
- 修改代码后，运行 `npm run build`；如存在 lint 脚本，也运行 `npm run lint`；最后总结修改内容与验证方式。
