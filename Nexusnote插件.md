

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