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

## 安装

Nexusnote 支持以下四种安装方式，按推荐程度从高到低排列。

### 方式一：社区插件市场（推荐，待上架）

1. Obsidian 设置 → **社区插件** → 关闭「安全模式」。
2. 点击 **浏览**，搜索 `Nexusnote`。
3. 点击 **安装**，完成后点击 **启用**。

> 当前版本尚未提交至官方市场，请先用下方方式二 / 方式三。

### 方式二：BRAT 安装（Beta Reviewer's Auto-update Tool）

1. 在社区插件市场安装 **BRAT** 并启用。
2. BRAT 设置 → **Add Beta plugin**。
3. 输入仓库地址：`shuixiande/Nexusnote`。
4. 点击 **Add Plugin**，完成后启用 Nexusnote。
5. 更新：BRAT 设置 → **Update all beta plugins**。

### 方式三：手动安装（从 GitHub Release 下载）

1. 打开 Releases：<https://github.com/shuixiande/Nexusnote/releases>
2. 下载最新版本的 `main.js`、`manifest.json`、`styles.css`。
3. 复制到 Vault 插件目录（没有则新建）：
   `VaultFolder/.obsidian/plugins/Nexusnote/`
4. 设置 → **社区插件** → 关闭「安全模式」→ 启用 **Nexusnote**。

> `.obsidian` 是隐藏目录。Windows 在地址栏输入路径；macOS 按 `Cmd+Shift+.` 显示隐藏文件。

### 方式四：从源码构建（开发者）

```bash
git clone https://github.com/shuixiande/Nexusnote.git
cd Nexusnote
npm install
npm run build
```

构建产物 `main.js` 生成在根目录，与 `manifest.json`、`styles.css` 一起复制到 `VaultFolder/.obsidian/plugins/Nexusnote/`（同方式三第 3–4 步）。

> 本仓库已纳入 `main.js`，可直接获取；但发布版本请以 GitHub Release 的三文件为准，确保与 `manifest.json` 版本一致。

### 知识库目录结构约定

首次使用时，在仪表盘点击 **一键部署知识库**，会自动创建四层目录（与 `agent.md` 规则一致）：

| 层级 | 文件夹 | 用途 |
|------|--------|------|
| 1 | `1_原始资料（不可变原料）` | 导入的原始素材，保持不可变 |
| 2 | `2_创意想法（灵感燃料）` | 灵感与半成品 |
| 3 | `3_知识库（AI接管Wiki）` | 结构化知识 |
| 4 | `4_输出（成品出口）` | 最终成品 |

模板文件存放于 `templater/`。

### 首次使用建议

1. 命令面板（`Ctrl/Cmd + P`）运行 **Nexusnote: 打开仪表盘**。
2. 点击 **一键部署知识库**，生成四层目录与 `agent.md`。
3. 用 **新笔记 / 灵感 / 新素材** 填充内容。
4. 用 **素材入库** 调用 Claudian 插件对原料层做智能处理。

### 常见问题

- **启用提示「未通过安全模式」？** 设置 → 社区插件 → 关闭「安全模式」再启用。
- **仪表盘打不开？** 确认 Obsidian ≥ 1.8.0（manifest 的 `minAppVersion`）。
- **更新后界面没变化？** BRAT 用户运行「Update all beta plugins」；手动用户重新下载三文件覆盖并重启 Obsidian。
- **能删 `agent.md` 吗？** 能，重新点击「一键部署知识库」会重新生成。

### 卸载

设置 → 社区插件 → 已安装 → Nexusnote → **禁用 / 卸载**。插件不删除 Vault 内容，仅移除仪表盘功能与生成的 `templater/`、`agent.md`。

## 发布新版本

1. 在 `manifest.json` 更新版本号与所需最低 Obsidian 版本。
2. 在 `versions.json` 增加 `"新版本号": "最低obsidian版本"` 条目。
3. 以版本号作为 Tag 创建 GitHub Release，上传 `manifest.json`、`main.js`、`styles.css`。

## API 文档

参见 https://docs.obsidian.md
