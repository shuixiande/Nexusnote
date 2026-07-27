### 用 AI Agent 构建 Obsidian Nexusnote 插件



### 实现步骤

#### 1\. 环境初始化

创建一个空白文件夹，在Codex/Claude Code中打开，运行下面这段提示词来初始化项目。

```markdown
你现在位于一个空白文件夹中。这个文件夹将作为一个独立的 Obsidian 插件开发项目仓库，不是 Obsidian Vault，也不在 \`.obsidian/plugins/\` 下面。
目标：基于 Obsidian 官方 sample plugin 初始化一个名为 \`Agent Dashboard\` 的插件项目，并在项目内安装必要的 Agent Skills，创建 \`AGENTS.md\` 和 \`CLAUDE.md\`。
现在，完成以下任务：
1. 基于 Obsidian 官方仓库 \`https://github.com/obsidianmd/obsidian-sample-plugin\` 初始化当前项目。只复制项目源码和配置，不要保留官方仓库的 \`.git\` 历史。可以执行 \`git init\`，但不要创建远程仓库，不要执行 \`git commit\`。
2. 执行 \`npm install\`，然后执行 \`npm run build\`。如果项目中存在 lint 脚本，也执行 \`npm run lint\`。如果构建或 lint 失败，先分析原因，再做最小必要修复，不要重构项目，不要额外添加依赖。
3. 将插件基础信息统一修改为：
* plugin id: \`Nexusnote\`
* display name: \`Nexusnote\`
* npm package name: \`Nexusnote\`
* version: \`0.1.0\`
* minAppVersion: \`1.8.0\`
* description: \`A dashboard for tracking AI agent workflows, sessions, and outputs inside Obsidian.\`
* author: \`Jason\`
* isDesktopOnly: \`false\`
请自行判断并同步修改 \`manifest.json\`、\`package.json\`、\`versions.json\` 等相关文件。要求版本号保持一致，插件 ID 必须是 \`Nexusnote\`，不要改成 \`obsidian-Nexusnote\`。不要修改无关字段，不要额外安装 npm 包。

4. 在当前项目中安装这两个 skill：
\`https://github.com/anthropics/skills/tree/main/skills/frontend-design\`
\`https://github.com/gapmiss/obsidian-plugin-skill\`

5. 创建 \`AGENTS.md\`，再创建内容完全相同的 \`CLAUDE.md\`。内容保持简洁，重点包含以下规则：
* 这是一个 TypeScript 编写的 Obsidian community plugin 项目，不是 Obsidian Vault。
* 插件 ID 是 \`Nexusnote\`，显示名称是 \`Nexusnote\`，版本是 \`0.1.0\`。
* 常用命令是 \`npm install\`、\`npm run dev\`、\`npm run build\`、\`npm run lint\`。
* Obsidian 插件目录中最终只需要 \`main.js\`、\`manifest.json\`、\`styles.css\`。
* 开发时优先使用 Obsidian 官方公开 API，不依赖未公开内部 API。
* 第一版实现保持最小、可测试、可迭代。
* 不要随意新增生产依赖。
* 涉及网络请求、遥测、云同步、删除文件、修改真实 Vault 之前必须先说明并等待确认。
* dashboard UI 相关任务优先参考 \`frontend-design\` skill。
* Obsidian API、生命周期、manifest、安全、无障碍、插件审核规则优先参考 \`obsidian-plugin-skill\` skill。
* 不要提交 API key、token、本地 Vault 路径或私人数据。
* 不要创建 Git remote，不要发布仓库，不要执行 \`git commit\`，除非我明确要求。
* 大范围修改前，先说明目标、涉及文件、最小实现方案。
* 修改代码后，运行 build；如有 lint，也运行 lint；最后总结修改内容和验证方式。

4. 最后再次运行 \`npm run build\`，如果有 lint 脚本也再次运行 \`npm run lint\`。
完成后输出一份初始化摘要，包含：
* 当前项目路径
* 是否成功基于 Obsidian sample plugin 初始化
* 是否执行了 \`git init\`
* \`npm install\`、\`npm run build\`、\`npm run lint\` 的结果
* 插件信息是否已统一为 \`Nexusnote\` / \`Nexusnote\` / \`0.1.0\`
* 两个 skill 是否安装成功
* \`AGENTS.md\` 和 \`CLAUDE.md\` 是否已创建
* 下一步建议

整个过程中不要创建 deploy 脚本，不要创建远程仓库，不要提交 commit，不要额外安装生产依赖。
```

#### 2\. 构建 UI Prototype

这一步使用 `frontend-design` skill。

```markdown
使用 frontend-design skill 设计一个 Nexusnote插件的静态 UI 原型。先不写插件功能，只做可预览的前端 prototype。

构建一个单页 仪表盘界面，定位是“面向普通 Obsidian 用户的 AI知识库的控制台”：用户打开后可以看到 vault 状态、[[个人知识库系统]]中三个仓库的主要内容，当天任务、笔记活跃度、Agent 运行状态和外部部分信息流。

页面整体使用深色科技感风格，适合嵌入 Obsidian 深色模式。视觉关键词：dark dashboard、细边框、轻微网格背景、高信息密度、克制的强调色、卡片式布局、等宽字体或接近开发者工具的字体氛围。不要做成普通 SaaS 后台，也不要做成过度花哨的渐变网页。

页面结构如下：

顶部是 Header 区域。左侧显示小标题 \`Nexusnote\`，这个可以修改，主标题显示 \`AiteSn的知识库仪表盘\`，这个文字可以修改。右侧显示状态按钮 \`LIVE\`、同步时间 \`Last sync 09:42\`、刷新按钮 \`刷新\`。

Header 下方是一排操作按钮，不需要 Tab 切换。按钮依次为：\`新笔记\`、\`新素材\`、\`灵感\`、\`GitHub Feeds\`、\`Inbox Ingest\`、\`Vault Lint\`。这些按钮只是 UI，不实现真实功能，但要有 hover 和点击后的 mock 状态。

第一行内容是三个数字卡片，横向三列排列：\`Vault Health Score\` 显示健康分，例如 86 和 \`+4 this week\`；\`Inbox Backlog\` 显示 inbox 未处理数量，例如 17 和 \`9d oldest, 4 need routing\`；\`Task Flow\` 显示任务完成率，例如 67% 和 \`12 today, 3 overdue\`。每个卡片可以带一个简单的线性图标或弱化的视觉装饰。

第二行是一个大卡片：\`热力图\`。它展示一个 GitHub contribution graph 风格的笔记创建热力图，横向按周份排列，格子表示每日笔记创建活跃度。右上角显示统计文案，例如 \`180 active note days, Jul 2025-Jun 2026\`。右下角显示 Less / More 的颜色图例。

第三行是两个并列列表卡片：左侧 \`今日任务\`，展示 5 条今日任务，每条包含任务标题、优先级或状态，例如 done、doing、todo；右侧 \`电影、博客、追剧\`，展示 5 条 最新电影相关信息，每条包含 repo 名称、简短描述、更新时间。所有数据使用 mock data。

现在，在 \`prototype/simple-dashboard/\` 下生成 \`index.html\`、\`styles.css\`、\`mock-data.json\`、\`script.js\`。使用纯 HTML + CSS + Vanilla JS，不引入 React、Tailwind、Bootstrap、shadcn、图表库或外部依赖。热力图、进度、按钮状态都用原生 HTML/CSS 实现。

确保页面可以直接用浏览器打开预览，并在完成后说明如何本地预览。
```

#### 3\. 根据 UI Prototype 编写插件代码

```markdown
根据 \`prototype/simple-dashboard/\` 中的静态 UI 原型，把当前 Obsidian 插件更新为同款 Dashboard 插件界面。

要求保留现有 Obsidian 插件项目结构、manifest、命令注册、ribbon icon 和 ItemView 注册逻辑。

这一步只做 UI 迁移和 mock 交互，不实现真实功能，不读取真实 vault，不接外部 API，不运行脚本。界面应包含：Header 区域、顶部操作按钮、三个数字状态卡片、Vault Note Creation 热力图、Today Tasks 列表、GitHub Feed 列表。

要注意，ui prototype的主题部分作为插件的主题，而目前ui prototype的网状背景板不要写到插件里，主题部分100%填充插件界面。

使用 TypeScript 实现 Obsidian ItemView。样式写入 \`styles.css\`，mock 数据集中放在合适的位置，例如 \`src/data/mockData.ts\`。不要引入 React、Tailwind、Bootstrap、shadcn 或图表库。尽量拆分清晰的 render 函数，例如 renderHeader、renderActions、renderStats、renderHeatmap、renderTasks、renderGitHubFeed。

完成后运行 \`npm run build\`，确保插件可以正常构建。最后汇报修改了哪些文件、是否清理了旧 UI、如何复制到 Obsidian 插件目录测试。
```

#### 4\. 实现每个模块的功能：插件、外部数据与智能体调用

UI 原型迁移成 Obsidian 插件之后，下一步就是把 mock data 换成真实数据。这里可以把功能分成三层：读取 Obsidian 库内数据、读取库外数据、运行智能体任务。 这一切都可以要求智能体来实现，不需要你自己写代码。 **以下内容只是讲述原理，不需要深刻理解也不需要死记硬背，一切都交给智能体。**

##### 4.1 读取 Obsidian 库内数据

Obsidian 插件可以通过 `this.app.vault` 访问当前 vault。它可以读取文件、创建文件、修改文件、遍历 Markdown 文件，也可以监听文件变化。和 `.md + DataviewJS` 不同，插件不是只查询索引结果，而是可以直接使用 Obsidian API 操作 vault。

例如读取所有 Markdown 文件：

```ts
const files = this.app.vault.getMarkdownFiles();

const notes = files.map(file => ({
  path: file.path,
  name: file.basename,
  modified: file.stat.mtime,
}));
```

例如创建一篇新笔记：

```ts
await this.app.vault.create(
  \`Inbox/${title}.md\`,
  \`# ${title}\n\n${description}\n\`
);
```

例如修改已有文件：

```ts
const file = this.app.vault.getAbstractFileByPath("Daily/2026-06-20.md");

if (file instanceof TFile) {
  const oldText = await this.app.vault.read(file);
  await this.app.vault.modify(file, oldText + "\n- [ ] 新任务");
}
```

例如监听文件变化，让 Dashboard 自动刷新：

```ts
this.registerEvent(
  this.app.vault.on("modify", file => {
    if (file instanceof TFile && file.extension === "md") {
      this.reloadDashboard();
    }
  })
);
```

所以，Dashboard 上的 `Recent Notes` 、 `Today Tasks` 、 `Inbox Backlog` 、 `Vault Health Score` 、 `Vault Note Creation Heatmap` 等模块，本质上都可以通过扫描 vault 文件、读取文件 metadata、解析 Markdown 内容来实现。比如热力图可以统计每天创建了多少笔记，Inbox 状态可以统计 `Inbox/` 文件夹下有多少未处理文件，Today Tasks 可以从今日 Daily Note 或带日期的 task 中解析出来。

##### 4.2 对 Obsidian 库内做操作

插件不仅能“读”，也能“写”。这就是插件比普通 `.md Dashboard` 更强的地方。

例如 `New Diary` 按钮可以创建今天的日记：

```ts
const today = window.moment().format("YYYY-MM-DD");
await this.app.vault.create(
  \`Daily/${today}.md\`,
  \`# ${today}\n\n## Tasks\n\n## Notes\n\`
);
```

例如 `Inbox Ingest` 可以把一条输入写入 Inbox：

```ts
await this.app.vault.create(
  \`Inbox/${Date.now()}-${title}.md\`,
  \`---\nstatus: inbox\ncreated: ${new Date().toISOString()}\n---\n\n${content}\n\`
);
```

例如 `Vault Lint` 可以扫描全库，找出没有 frontmatter、没有标签、没有链接、长期未更新的笔记，然后生成一个 Markdown 报告：

```ts
const report = \`# Vault Lint Report\n\n- Missing frontmatter: ${count}\n\`;
await this.app.vault.create("Reports/vault-lint.md", report);
```

这里的核心思想是：插件负责把 Obsidian 变成一个可操作的本地系统，而不只是一个 Markdown 展示页面。

##### 4.3 读取库外数据

外部数据一般不直接写在 UI 里，而是先由脚本或服务拉取，再保存成 JSON cache，最后由 Dashboard 读取并展示。

典型流程是：

```text
外部 API / RSS
→ 拉取数据
→ 转成统一 JSON
→ 保存到 dashboard/cache/
→ Dashboard 读取 JSON 并渲染
```

例如拉取 RSS，可以用 `rss-parser` 这类库，把 RSS / Atom feed 转成普通 JS 对象：

```ts
import Parser from "rss-parser";

const parser = new Parser();
const feed = await parser.parseURL("https://example.com/feed.xml");

const items = feed.items.slice(0, 5).map(item => ({
  title: item.title,
  link: item.link,
  date: item.pubDate,
}));
```

例如拉取 GitHub 仓库信息，可以调用 GitHub Search API：

```ts
const res = await requestUrl({
  url: "https://api.github.com/search/repositories?q=ai+agent&sort=stars&order=desc"
});

const data = res.json;
const repos = data.items.slice(0, 5).map(repo => ({
  name: repo.full_name,
  stars: repo.stargazers_count,
  url: repo.html_url,
}));
```

例如拉取 Hacker News，可以先取 top stories 的 id，再取每条 item：

```ts
const ids = await requestUrl({
  url: "https://hacker-news.firebaseio.com/v0/topstories.json"
});

const topIds = ids.json.slice(0, 5);

const stories = await Promise.all(
  topIds.map(id =>
    requestUrl({
      url: \`https://hacker-news.firebaseio.com/v0/item/${id}.json\`
    }).then(r => r.json)
  )
);
```

Reddit 要稍微复杂一些。简单公开 JSON 在很多场景下不稳定，更正式的方式通常是 OAuth。对于演示型插件，可以先把 Reddit 放到后续阶段，第一版优先做 RSS、GitHub、Hacker News，因为这几个更容易讲清楚，也更适合公开演示。

##### 4.4 外部数据为什么建议先写入 cache

Dashboard 不应该每次打开都重新请求 GitHub、RSS、HN。更好的方式是本地缓存，例如：

```text
dashboard/cache/github-feed.json
dashboard/cache/rss-feed.json
dashboard/cache/hn-feed.json
dashboard/cache/vault-health.json
```

插件读取 cache：

```ts
const file = this.app.vault.getAbstractFileByPath("dashboard/cache/github-feed.json");

if (file instanceof TFile) {
  const json = await this.app.vault.read(file);
  const data = JSON.parse(json);
  this.renderGitHubFeed(data);
}
```

这样 UI 层和数据抓取层就分开了。插件负责展示，脚本负责抓取，智能体负责总结和分析。

##### 4.5 集成智能体：插件如何运行 Agent 任务

插件集成智能体的核心原理很简单：点击按钮后，插件调用一个本地脚本；脚本再通过命令行运行 Codex、Claude Code、OpenCode 等工具。

例如用户点击 `Deep Research` ，底层可以执行：

```bash
claude -p "使用 frontend-design skill，为我设计一个个人dashboard页面原型，保存在当前文件夹下" --dangerously-skip-permissions
```

或者：

```bash
codex exec "读取 dashboard/cache/github-feed.json，总结今天值得关注的 AI Agent 项目"
```

在 Obsidian 插件里，一般不建议直接把复杂命令写进按钮事件，而是封装成 runner：

```ts
await runAgentTask("deep-research", {
  topic: "MCP server 最新趋势",
  output: "Reports/deep-research.md"
});
```

runner 内部再调用 Node 脚本：

```ts
import { spawn } from "child_process";

const child = spawn("node", [
  "scripts/run-agent-task.mjs",
  "deep-research"
]);

child.stdout.on("data", data => {
  console.log(data.toString());
});

child.stderr.on("data", data => {
  console.error(data.toString());
});
```

脚本里再真正运行智能体命令：

```js
import { spawn } from "node:child_process";

const agent = spawn("claude", [
  "-p",
  "使用 deep-research skill，研究今天的 AI Agent 资讯，并输出 Markdown 报告"
]);

agent.stdout.on("data", chunk => {
  process.stdout.write(chunk);
});
```

这条链路可以理解成：

```text
Dashboard Button
→ Obsidian Plugin
→ 本地 Node Script
→ Claude Code / Codex CLI
→ 生成 Markdown / JSON
→ 写回 Obsidian Vault
→ Dashboard 刷新
```

也就是说，插件本身不一定要“内置 AI 能力”。它只需要成为控制台：负责展示按钮、收集输入、调用脚本、显示任务状态、读取结果文件。真正的智能任务交给命令行智能体执行。

##### 4.6 总结

实现真实功能时，可以按三层推进：第一层是 Obsidian 内部数据，先实现最近笔记、今日任务、Inbox、热力图、Vault 健康度；第二层是外部数据，先接 RSS、GitHub、Hacker News，再考虑 Reddit、邮箱、YouTube 等更复杂数据源；第三层是智能体任务，通过本地脚本调用 `claude -p` 、 `codex exec` 等命令，把研究、整理、归档、总结这些工作变成 Dashboard 上的按钮。

这个架构的重点不是一次性做完所有功能，而是把 UI、数据、脚本、智能体分层。插件负责界面和 Obsidian 集成，脚本负责确定性数据处理，智能体负责复杂理解和生成。