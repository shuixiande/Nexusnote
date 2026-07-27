# Nexusnote 代码审查报告

> 审查日期：2026-07-05
> 审查范围：`src/main.ts` / `src/data/vaultReader.ts` / `src/settings.ts` / `styles.css` / `src/data/cacheManager.ts` / `src/data/externalFeeds.ts` / `src/agent/runner.ts` / `src/data/mockData.ts`

---

## 🔴 P0 — Bug（必须修复）

### 1. `vaultReader.ts` 热力图日期偏移 Bug
**位置**：`src/data/vaultReader.ts` 第 270、280 行

```typescript
// ❌ 当前代码 — toISOString() 使用 UTC，东八区晚间会偏移到前一天
const key = d.toISOString().slice(0, 10);
```

**问题**：与日历功能已修复的同类 Bug 相同。当用户在 UTC+8 的 22:00 创建笔记时，`toISOString()` 返回的是 UTC 时间 14:00，日期仍是当天；但如果在 23:30 创建，UTC 时间为 15:30，尚不会偏移。**真正出问题的是 UTC- 时区用户**——他们的本地日期会偏移到下一天。不过对于中国用户，`toISOString()` 在 00:00-07:59 之间会把日期偏移到前一天。

**修复**：
```typescript
// ✅ 使用本地时区格式化
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

**影响**：`getNoteActivityHeatmap()` 返回的热力图数据在 UTC+8 凌晨 0-7 点会有日期偏移，导致热力图显示不准确。

---

## 🟠 P1 — 设计缺陷 / 代码质量（建议修复）

### 2. `main.ts` 日历渲染代码重复
**位置**：`src/main.ts` — `renderCalendar()` 与 `renderCalendarInto()`

**问题**：两个方法包含约 50 行几乎完全相同的日历格子渲染逻辑（星期头、日期格子、CSS 类名计算等）。`renderCalendar()` 构建整个卡片 DOM，`renderCalendarInto()` 往已有容器内渲染——但核心渲染代码是复制粘贴的。

**修复建议**：
- 提取公共方法 `renderCalendarGrid(container: HTMLElement, year: number, month: number): void`
- `renderCalendar()` 和 `renderCalendarInto()` 都调用此方法，仅在外层容器创建上有所不同

### 3. `main.ts` `createNoteForDate` 中的 `void dateObj`
**位置**：`src/main.ts` — `createNoteForDate` 方法

```typescript
const dateObj = new Date(y, m - 1, d);
// ... 从未使用 dateObj ...
void dateObj; // 避免未使用变量警告
```

**问题**：`dateObj` 被创建但未使用，`void dateObj` 是变通写法。实际上 `y`、`m`、`d` 已经从 `parts` 中解析出来，`dateObj` 本身没有被使用。

**修复**：移除 `const dateObj = ...` 和 `void dateObj`，或者如果确实需要日期对象（例如未来功能），添加注释说明。

### 4. `main.ts` `doNewMaterial` / `doCapture` / `doIngest` 未自动创建目标文件夹
**位置**：`src/main.ts` — 三个快捷操作方法

**问题**：
- 如果设置中配置的文件夹（如 `newMaterialFolder`）不存在，`vault.create()` 会失败
- 创建笔记后未自动打开文件（`createNoteForDate` 有自动打开，但这三个方法没有）

**修复建议**：
```typescript
// 自动确保文件夹存在
const folder = this.plugin.settings.newMaterialFolder;
if (folder) {
  const existing = this.app.vault.getAbstractFileByPath(folder);
  if (!existing) {
    await this.app.vault.createFolder(folder);
  }
}
// 创建后自动打开
const file = await this.app.vault.create(filePath, content);
await this.app.workspace.getLeaf(false).openFile(file);
```

### 5. `main.ts` `getTemplateFiles` 直接读取 `.obsidian/` 配置
**位置**：`src/main.ts` — `getTemplateFiles` 方法

**问题**：直接读取 `.obsidian/community-plugins.json` 和 `.obsidian/plugins/templater-obsidian/` 下的配置文件。这种方式：
- 违反 Obsidian 插件开发最佳实践（应使用公开 API）
- 在 Obsidian 未来版本中可能失效
- 在移动端可能有文件权限差异

**修复建议**：
- 检测核心模板插件：使用 `(this.app as any).internalPlugins?.getPluginById('daily-notes')?.enabled`
- 检测 Templater：使用 `this.app.plugins?.plugins['templater-obsidian']`（公开 API）
- 如果以上 API 不可用，至少添加 `try-catch` 保护

### 6. `DayNotesModal` 笔记列表未限制数量
**位置**：`src/main.ts` — `DayNotesModal` 类

**问题**：如果某天有大量笔记（如通过批量导入），列表会非常长，影响用户体验和性能。

**修复建议**：添加分页或限制显示数量（如最多 50 条，超出显示"还有 N 条…"）。

---

## 🟡 P2 — 优化建议（可选改进）

### 7. `externalFeeds.ts` 死代码
**位置**：`src/data/externalFeeds.ts` — `fetchGitHubFeed` / `fetchHackerNews`

**问题**：这两个函数未被 `main.ts` 或任何其他文件导入调用，属于死代码。

**修复建议**：如果计划在未来使用，添加 `// TODO` 注释；否则直接删除。当前 `renderMedia` 使用的是 `MOCK_DATA.media`。

### 8. `mockData.ts` 残留数据
**位置**：`src/data/mockData.ts`

**问题**：99 行文件中只有 `MOCK_DATA.media` 被 `renderMedia` 使用，其余（`vaultStats`、`inboxStatus`、`knowledgeStats`、`taskStats`、`categoryDistribution`、`noteActivity`）已替换为真实 vault 数据读取。

**修复建议**：只保留 `media` 数据，其余删除。或者如果 `renderMedia` 也计划改为真实数据，则整个文件可删除。

### 9. `runner.ts` 移动端不兼容
**位置**：`src/agent/runner.ts`

**问题**：使用 `child_process.spawn`，在 Obsidian 移动端（iOS/Android）不可用。由于 `manifest.json` 中 `isDesktopOnly` 为 `false`，这会导致移动端运行时错误。

**修复建议**：
- 将 `manifest.json` 改为 `"isDesktopOnly": true`，或
- 在 `runner.ts` 入口处添加平台检测，移动端跳过 Agent 功能

### 10. `cacheManager.ts` 缓存路径硬编码
**位置**：`src/data/cacheManager.ts`

**问题**：默认缓存路径 `dashboard/cache/` 硬编码在代码中。如果用户 Vault 中此路径已有其他用途的文件，可能冲突。

**修复建议**：使用 `.obsidian/plugins/Nexusnote/cache/` 或添加到 Settings 中可配置。

### 11. `settings.ts` `authorUrl` / `fundingUrl` 仍指向 obsidian.md
**位置**：`manifest.json`（非 settings.ts 本身）

**问题**：`manifest.json` 的 `authorUrl` 和 `fundingUrl` 仍指向 obsidian.md 官方地址，这是从 sample plugin 遗留的。

**修复建议**：更新为作者自己的 URL 或删除这两个字段。

---

## 📊 审查总结

| 优先级 | 数量 | 说明 |
|--------|------|------|
| 🔴 P0 Bug | 1 | 热力图日期偏移 |
| 🟠 P1 设计缺陷 | 5 | 代码重复、未使用变量、缺文件夹保护、.obsidian 直接读取、列表无限制 |
| 🟡 P2 优化建议 | 5 | 死代码、Mock 残留、移动端不兼容、缓存路径硬编码、manifest 遗留 |

### 建议修复顺序
1. **先修 P0**：`vaultReader.ts` 热力图日期偏移（一行改动）
2. **再修 P1 高影响项**：日历代码重复（重构）、doNewMaterial 等缺文件夹保护、.obsidian 直接读取
3. **最后清理 P2**：死代码删除、Mock 精简、isDesktopOnly 设置
