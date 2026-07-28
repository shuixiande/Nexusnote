import { App, ItemView, Modal, Notice, Plugin, TFile, WorkspaceLeaf, setIcon, addIcon } from 'obsidian';
import { NexusnoteSettings, NexusnoteSettingTab, DEFAULT_SETTINGS } from './settings';
import {
	getVaultStats, getKbLayerCounts, getTaskStats,
	getTodayTasks, getCategoryDistribution, getNoteActivitySeries,
	getNotesForDate, getNoteDaysInMonth, getRecentNotes,
} from './data/vaultReader';
import type { CategoryCount, SeriesPoint, NoteRef, ParsedTask, RecentNote, KbLayerCounts } from './data/vaultReader';

const VIEW_TYPE = 'nexusnote-dashboard';
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

/**
 * Nexusnote 专属 ribbon 图标（单色描边，lucide 同款风格，使用 currentColor 跟随主题）。
 * 意象：一张笔记卡片连接几个发散的想法节点 —— 既点出 Note，又体现 Nexus（知识网络枢纽），
 * 与官方插件自带的 layout-dashboard 等图标明显区分。
 */
const NEXUSNOTE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">` +
	`<rect x="5.5" y="6.5" width="11" height="9.5" rx="2"/>` +
	`<line x1="8" y1="9.5" x2="14" y2="9.5"/>` +
	`<line x1="8" y1="12.5" x2="12.5" y2="12.5"/>` +
	`<circle cx="18.5" cy="4" r="1.6"/>` +
	`<circle cx="3.5" cy="18" r="1.6"/>` +
	`<circle cx="19" cy="18.2" r="1.6"/>` +
	`<path d="M15.5 8.5 L17.4 5.2"/>` +
	`<path d="M7.5 15 L5 17"/>` +
	`<path d="M16 15.2 L17.9 17"/>` +
	`</svg>`;

/** 补零工具函数 */
function pad(n: number): string { return String(n).padStart(2, '0'); }

/** 把数值向上取整到"好看"的刻度（1 / 2 / 5 × 10^n） */
function niceCeil(v: number): number {
	if (v <= 3) return 4;
	const pow = Math.pow(10, Math.floor(Math.log10(v)));
	const f = v / pow;
	let nf: number;
	if (f <= 1) nf = 1;
	else if (f <= 2) nf = 2;
	else if (f <= 5) nf = 5;
	else nf = 10;
	return nf * pow;
}

/** 把时间戳格式化为「x 分钟前 / x 小时前 / x 天前」相对时间 */
function timeAgo(ts: number): string {
	const diff = Date.now() - ts;
	const m = Math.floor(diff / 60000);
	if (m < 1) return '刚刚';
	if (m < 60) return `${m} 分钟前`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h} 小时前`;
	const d = Math.floor(h / 24);
	if (d < 30) return `${d} 天前`;
	const mo = Math.floor(d / 30);
	if (mo < 12) return `${mo} 个月前`;
	return `${Math.floor(mo / 12)} 年前`;
}

/* ============================================================
   个人知识库系统（四层架构）相关常量与模板
   依据《个人知识库系统-升级版.md》生成
   ============================================================ */

/** 文档定义的四层架构顶层文件夹 */
const KB_LAYER_FOLDERS = [
	'1_原始资料（不可变原料）',
	'2_创意想法（灵感燃料）',
	'3_知识库（AI接管Wiki）',
	'4_输出（成品出口）',
];

/** 模板文件名 → 内容（占位符 {{title}} / {{date}} / {{time}} 由插件替换） */
const KB_TEMPLATES: { name: string; content: string }[] = [
	{
		name: '概念.md',
		content:
`---
title: {{title}}
created: {{date}}
updated: {{date}}
tags: [概念]
sources: []
---

# {{title}}

## 定义
> 用一句话说清这是什么。

## 理解
- 核心要点
- 与相关概念的区别

## 关联
- 

## 来源
- 
`,
	},
	{
		name: '工具.md',
		content:
`---
title: {{title}}
created: {{date}}
updated: {{date}}
tags: [工具]
sources: []
---

# {{title}}

## 用途
> 这个工具解决什么问题。

## 工作流
1. 
2. 

## 技巧
- 

## 来源
- 
`,
	},
	{
		name: '创意.md',
		content:
`---
title: {{title}}
created: {{date}}
updated: {{date}}
tags: [灵感, 创意]
sources: []
---

# {{title}}

## 灵感来源
> 是什么触发了这个想法？

## 想法描述
- 核心构想
- 为什么有趣 / 有价值

## 下一步
- [ ] 定期回顾，筛选有价值的想法
- [ ] 有价值的想法可升级到 3_知识库（AI接管Wiki）/

## 状态
- 待筛选
`,
	},
	{
		name: '笔记.md',
		content:
`---
title: {{title}}
created: {{date}}
updated: {{date}}
tags: [笔记]
sources: []
---

# {{title}}

## 内容
> {{time}} 记录

## 要点
- 

## 关联
- 
`,
	},
	{
		name: '素材.md',
		content:
`---
title: {{title}}
created: {{date}}
tags: [素材, inbox]
sources: []
---

# {{title}}

## 原文 / 链接
- 

## 摘要
> 简要摘录关键信息

## 待处理
- [ ] 摄入到知识库（3_知识库）
`,
	},
];

/** 生成根目录 agent.md（AI 助手规则文件），日期用当前日期填充 */
function buildAgentMd(): string {
	const today = new Date();
	const d = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
	return `# 个人知识库系统 · Agent 规则

> 本文件由 Nexusnote 一键部署自动生成（${d}）。定义 AI 助手在本知识库中的行为规范，所有操作均遵循以下四层架构与核心流程。

## 一、四层架构

- \`1_原始资料（不可变原料）/\`：固定、高质量、科学的资料。只存不删，AI 只读取不修改。
- \`2_创意想法（灵感燃料）/\`：稀奇古怪的想法、灵感、半成形计划。想到就记，不评判。
- \`3_知识库（AI接管Wiki）/\`：由 AI 维护的结构化知识页面（概念 / 工具 / 创意 / 笔记页），页面间相互链接形成知识图谱。
- \`4_输出（成品出口）/\`：AI 创作的最终结果，可直接分享，无需纳入知识图谱。

## 二、核心操作

1. **Ingest（摄入）**：素材放入 \`1_原始资料\` → 提取关键信息 → 更新 \`3_知识库\` → 自动 git 提交并推送。
2. **Idea Capture（捕捉创意）**：记录想法到 \`2_创意想法\`；定期回顾，有价值的升级到知识库。
3. **Query & Create（查询与创作）**：普通查询读知识库回答；结合创意与知识库创作文案，直接展示给用户（满意的自行保存到 \`4_输出\`）。
4. **Archive（归档）**：存回知识库前，**必须先征求用户同意**。
5. **Lint（巡检）**：每周六 9:00 自动执行；检查一致性 / 完整性 / 时效性 / 结构，生成巡检报告。

## 三、页面规范（3_知识库）

每个页面顶部 frontmatter：

\`\`\`yaml
---
title: 页面标题
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [标签1, 标签2]
sources: [指向 1_原始资料 的链接]
---
\`\`\`

命名约定：概念页 \`概念_xxx.md\`、工具页 \`工具_xxx.md\`、创意页 \`创意_xxx.md\`、笔记页 \`笔记_xxx.md\`。

## 四、操作日志

- 位置：\`3_知识库（AI接管Wiki）/操作日志.md\`
- 格式：以 \`## YYYY-MM-DD\` 为日分组，操作以 \`### [操作类型] 标题\` 记录（时间 / 触发 / 涉及文件 / 摘要 / 结果 / 备注）。
- Ingest、Lint 完成后自动追加；Query & Create 仅记录主题与概要。

## 五、其他要求

- 听到"摄入新资料"→ 读 \`1_原始资料\` 新文件并更新知识库。
- 听到"记录想法 / 捕捉创意"→ 写入 \`2_创意想法\`。
- 听到"帮我写关于 xxx 的文案"→ 结合 \`2_创意想法\` 与 \`3_知识库\` 创作并直接输出。
- 听到"巡检 / 健康检查"→ 立即执行一次 Lint。
- 每周六 9:00 自动 Lint；每次 ingest 后自动 git 提交并推送。
`;
}

/* ---------- 类型别名：避免 TSX 中 `as` 断言的 `>` 解析歧义 ---------- */
type InternalPluginsLike = {
	internalPlugins?: {
		getPluginById?: (id: string) => {
			enabled?: boolean;
			instance?: { options?: { folder?: string } };
		} | undefined;
	};
};
type CommunityPluginsLike = {
	plugins?: {
		plugins?: Record<string, { settings?: { templates_folder?: string } }>;
	};
};

/* ============================================================
   Dashboard ItemView
   ============================================================ */
class NexusnoteDashboardView extends ItemView {
	private plugin: NexusnotePlugin;
	private vaultStats = getVaultStats(this.app);
	private kbLayers: KbLayerCounts = { raw: 0, idea: 0, knowledge: 0, output: 0, knowledgeCategories: 0 };
	private taskStats = getTaskStats(this.app);
	private todayTasks: ParsedTask[] = [];
	private categories: CategoryCount[] = [];
	private activitySeries: SeriesPoint[] = [];
	/** 折线图当前选择的统计周期（天） */
	private chartPeriod = 30;
	/** 最近更新的笔记（用于"最近更新"卡片） */
	private recentNotes: RecentNote[] = [];
	/** 日历当前显示的月份（1-12）和年份 */
	private calYear: number;
	private calMonth: number; // 0-11（JS Date 风格）
	/** 当前日历月份中哪些天有笔记 */
	private calNoteDays: Set<number> = new Set();

	constructor(leaf: WorkspaceLeaf, plugin: NexusnotePlugin) {
		super(leaf);
		this.plugin = plugin;
		const now = new Date();
		this.calYear = now.getFullYear();
		this.calMonth = now.getMonth();
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return this.plugin.settings.brandName || 'Nexusnote'; }
	getIcon(): string { return 'layout-dashboard'; }

	async onOpen(): Promise<void> {
		await this.refreshData();
		this.renderAll();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	/** 从 vault 重新读取所有数据 */
	private async refreshData(): Promise<void> {
		this.vaultStats = getVaultStats(this.app);
		this.kbLayers = getKbLayerCounts(this.app, KB_LAYER_FOLDERS);
		this.taskStats = getTaskStats(this.app);
		this.todayTasks = await getTodayTasks(this.app);
		this.categories = getCategoryDistribution(this.app);
		this.activitySeries = getNoteActivitySeries(this.app, 365);
		this.recentNotes = getRecentNotes(this.app, 8);
		this.calNoteDays = getNoteDaysInMonth(this.app, this.calYear, this.calMonth + 1);
	}

	/** 完整刷新 Dashboard（清空重绘） */
	async reloadDashboard(): Promise<void> {
		await this.refreshData();
		this.renderAll();
	}

	private renderAll(): void {
		const el = this.contentEl;
		el.empty();
		el.classList.add('nexusnote-db');
		const root = el.createDiv('nxdb-root');
		this.renderHeader(root);
		this.renderActions(root);
		this.renderStats(root);
		this.renderCharts(root);
		this.renderLists(root);
		this.renderFooter(root);
	}

	/* ======== Header ======== */
	private renderHeader(root: HTMLElement): void {
		const s = this.plugin.settings;
		const h = root.createDiv('nxdb-header');
		const brand = h.createDiv('nxdb-brand');
		const eyebrow = brand.createDiv('nxdb-brand__eyebrow');
		eyebrow.createSpan('nxdb-brand__dot');
		eyebrow.createSpan({ text: s.brandName || 'Nexusnote' });
		brand.createEl('h1', {
			cls: 'nxdb-brand__title',
			text: s.dashboardTitle || '我的知识库仪表盘',
		});

		const meta = h.createDiv('nxdb-header__meta');
		const liveChip = meta.createEl('button', { cls: 'nxdb-status-chip nxdb-status-chip--live', text: '在线' });
		liveChip.createSpan('nxdb-status-chip__pulse');
		liveChip.addEventListener('click', () => {
			const pressed = liveChip.getAttribute('aria-pressed') === 'true';
			liveChip.setAttribute('aria-pressed', String(!pressed));
		});
		liveChip.setAttribute('aria-pressed', 'true');

		const now = new Date();
		const hh = String(now.getHours()).padStart(2, '0');
		const mm = String(now.getMinutes()).padStart(2, '0');
		meta.createSpan({ cls: 'nxdb-sync-time', text: `上次同步 ${hh}:${mm}` });

		const refreshBtn = meta.createEl('button', { cls: 'nxdb-icon-btn' });
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.createSpan({ text: ' 刷新' });
		refreshBtn.addEventListener('click', () => {
			void this.reloadDashboard();
			const syncEl = root.querySelector('.nxdb-sync-time');
			const n = new Date();
			const nh = String(n.getHours()).padStart(2, '0');
			const nm = String(n.getMinutes()).padStart(2, '0');
			if (syncEl) syncEl.textContent = `上次同步 ${nh}:${nm}`;
			new Notice('Nexusnote · 仪表盘已刷新');
		});

		const deployBtn = meta.createEl('button', { cls: 'nxdb-deploy-btn' });
		setIcon(deployBtn, 'rocket');
		deployBtn.createSpan({ text: ' 一键部署知识库' });
		deployBtn.addEventListener('click', () => {
			void this.deployKnowledgeBase();
		});
	}

	/* ======== Action Bar ======== */
	private renderActions(root: HTMLElement): void {
		const bar = root.createDiv('nxdb-actions');
		const actions = [
			{ id: 'new-note', label: '新笔记', fn: () => this.doNewNote() },
			{ id: 'new-material', label: '新素材', fn: () => this.openNewMaterialModal() },
			{ id: 'inspire', label: '灵感', fn: () => this.doCapture() },
			{ id: 'inbox-ingest', label: '素材入库', fn: () => this.doIngest() },
			{ id: 'vault-lint', label: '仓库体检', fn: () => this.doVaultLint() },
		];
		actions.forEach(a => {
			const btn = bar.createEl('button', { cls: 'nxdb-act-btn', text: a.label });
			btn.addEventListener('click', () => { btn.classList.toggle('nxdb-is-active'); void a.fn(); });
		});
	}

	/* ---------- Action implementations ---------- */
	private async doNewNote(): Promise<void> {
		await this.ensureTemplates();
		const folder = this.inspireFolder();
		const stamp = this.stamp('笔记');
		await this.createFromTemplate(`${this.templaterFolder()}/笔记.md`, folder, stamp);
	}

	/**
	 * 为指定日期创建新笔记。如果有可用模板，先弹模板选择器；否则直接创建空白笔记。
	 * @param dateStr 形如 "YYYY-MM-DD"
	 */
	async createNoteForDate(dateStr: string): Promise<void> {
		const s = this.plugin.settings;
		const now = new Date();
		const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
		const folder = s.newNoteFolder || '笔记';

		// 模板创建笔记时，标题用 "日期-时间" 作为唯一标识
		const noteTitle = `${dateStr}-新笔记 ${timeStr}`;

		// 确保目标文件夹存在
		await this.ensureFolder(folder);

		const templates = await this.getTemplateFiles();
		if (templates.length > 0) {
			new TemplatePickerModal(this.app, templates, async (template) => {
				try {
					let content: string;
					if (template) {
						content = await this.app.vault.read(template);
						content = content.replace(/\{\{title\}\}/g, noteTitle)
							.replace(/\{\{date\}\}/g, dateStr)
							.replace(/\{\{time\}\}/g, timeStr);
					} else {
						content = `# ${noteTitle}\n\n> ${dateStr}\n\n## 内容\n\n`;
					}
					const path = `${folder}/${noteTitle}.md`;
					await this.app.vault.create(path, content);
					new Notice(`已${template ? '从模板' : ''}创建: ${path}`);
					await this.openFile(path);
					void this.reloadDashboard();
				} catch {
					new Notice('创建失败，请检查路径权限');
				}
			}).open();
		} else {
			try {
				const path = `${folder}/${noteTitle}.md`;
				const content = `# ${noteTitle}\n\n> ${dateStr}\n\n## 内容\n\n`;
				await this.app.vault.create(path, content);
				new Notice(`已创建: ${path}`);
				await this.openFile(path);
				void this.reloadDashboard();
			} catch {
				new Notice('创建失败，请检查路径权限');
			}
		}
	}

	/** 为指定日期新建一篇日记（标题 日记_YYYY-MM-DD），已存在则直接打开 */
	async createDiaryForDate(dateStr: string): Promise<void> {
		const s = this.plugin.settings;
		const now = new Date();
		const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
		const folder = s.newNoteFolder || '笔记';
		const title = `日记_${dateStr}`;

		await this.ensureFolder(folder);
		const path = `${folder}/${title}.md`;

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing) {
			new Notice(`当天日记已存在: ${path}`);
			await this.openFile(path);
			return;
		}

		const content =
			`---\n` +
			`title: ${title}\n` +
			`date: ${dateStr}\n` +
			`created: ${now.toISOString().slice(0, 10)}\n` +
			`tags: [日记]\n` +
			`---\n\n` +
			`# ${title}\n\n` +
			`> ${dateStr} ${timeStr}\n\n` +
			`## 今日记录\n\n\n` +
			`## 感悟\n\n`;

		try {
			await this.app.vault.create(path, content);
			new Notice(`已创建当天日记: ${path}`);
			await this.openFile(path);
			void this.reloadDashboard();
		} catch {
			new Notice('创建日记失败，请检查路径权限');
		}
	}

	/** 确保指定路径的文件夹存在，不存在则递归创建 */
	private async ensureFolder(folderPath: string): Promise<void> {
		if (!folderPath) return;
		const existing = this.app.vault.getAbstractFileByPath(folderPath);
		if (existing) return;
		// 递归确保父目录存在
		const parts = folderPath.split('/');
		for (let i = 1; i <= parts.length; i++) {
			const sub = parts.slice(0, i).join('/');
			if (!sub) continue;
			const subExisting = this.app.vault.getAbstractFileByPath(sub);
			if (!subExisting) {
				await this.app.vault.createFolder(sub);
			}
		}
	}

	/** 创建文件后自动打开 */
	private async openFile(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			await this.app.workspace.getLeaf().openFile(file);
		}
	}

	/** 从 Obsidian 核心模板插件或 Templater 读取模板文件列表（使用公开 API） */
	private async getTemplateFiles(): Promise<TFile[]> {
		const templates: TFile[] = [];
		const seen = new Set<string>();

		// 1. 尝试通过公开 API 检测核心模板插件
		try {
			const coreTemplates = (this.app as unknown as InternalPluginsLike)
				.internalPlugins?.getPluginById?.('templates');
			if (coreTemplates?.enabled) {
				const folder = coreTemplates.instance?.options?.folder;
				if (folder) {
					this.app.vault.getMarkdownFiles()
						.filter(f => f.path.startsWith(folder + '/'))
						.forEach(f => {
							if (!seen.has(f.path)) { templates.push(f); seen.add(f.path); }
						});
				}
			}
		} catch {
			// 核心 templates 插件不可用，尝试回退读取配置
			try {
				const configFile = this.app.vault.getAbstractFileByPath(`${this.app.vault.configDir}/templates.json`);
				if (configFile instanceof TFile) {
					const raw = await this.app.vault.read(configFile);
					const config = JSON.parse(raw) as { folder?: string };
					if (config.folder) {
						this.app.vault.getMarkdownFiles()
							.filter(f => f.path.startsWith(config.folder + '/'))
							.forEach(f => {
								if (!seen.has(f.path)) { templates.push(f); seen.add(f.path); }
							});
					}
				}
			} catch {
				// 核心模板插件未配置
			}
		}

		// 2. 尝试通过公开 API 检测 Templater 插件
		try {
			const templaterPlugin = (this.app as unknown as CommunityPluginsLike)
				.plugins?.plugins?.['templater-obsidian'];
			if (templaterPlugin?.settings?.templates_folder) {
				const folder = templaterPlugin.settings.templates_folder;
				this.app.vault.getMarkdownFiles()
					.filter(f => f.path.startsWith(folder + '/'))
					.forEach(f => {
						if (!seen.has(f.path)) { templates.push(f); seen.add(f.path); }
					});
			}
		} catch {
			// Templater 不可用
		}

		return templates;
	}

	private async doCapture(): Promise<void> {
		await this.ensureTemplates();
		const folder = this.inspireFolder();
		const stamp = this.stamp('创意');
		await this.createFromTemplate(`${this.templaterFolder()}/创意.md`, folder, stamp);
	}

	/** 打开「新素材」选择弹窗：根据模板新建 / 从文件夹导入 / 从文件导入 */
	private openNewMaterialModal(): void {
		new NewMaterialModal(this.app, this).open();
	}

	/** 新素材 → 根据模板新建：弹出 templater 模板选择器，创建到素材（原料）文件夹 */
	public async newMaterialFromTemplate(): Promise<void> {
		const folder = this.materialFolder();
		await this.ensureTemplates();
		const templates = await this.getTemplaterTemplates();
		if (templates.length === 0) {
			await this.createFromTemplate('', folder, this.stamp('素材'));
			return;
		}
		new TemplatePickerModal(this.app, templates, async (tpl) => {
			await this.createFromTemplate(tpl ? tpl.path : '', folder, this.stamp('素材'));
		}).open();
	}

	/* ---------- 素材入库：调用 Claudian 处理原料层素材 ---------- */
	private async doIngest(): Promise<void> {
		// Claudian（嵌入 AI Agent 的 Obsidian 社区插件）plugin id 为 realclaudian
		const CLAUDIAN_ID = 'realclaudian';
		// 部分 obsidian typings 未在 App 上声明 plugins/commands 运行时属性，用交集类型补充
		const app = this.app as App & {
			plugins: { plugins: Record<string, unknown> };
			commands: {
				commands: Record<string, { id: string; name: string }>;
				executeCommandById: (id: string) => void;
			};
		};
		const claudian = app.plugins.plugins[CLAUDIAN_ID];
		if (!claudian) {
			new Notice('未检测到 Claudian 插件。请先在 Obsidian 社区插件市场安装并启用 Claudian，才能一键入库素材。');
			return;
		}

		// 构造处理指令：引用原料层（素材仓库）素材 + 根目录 agent.md 规则
		const folder = this.materialFolder();
		const prompt =
			`请按照 vault 根目录的 agent.md 规则，处理「${folder}」中的素材文件：\n` +
			`· 阅读并理解每篇素材；\n` +
			`· 提取可用知识，整理后写入「3_知识库（AI接管Wiki）」对应分类；\n` +
			`· 灵感 / 待办沉淀到「2_创意想法（灵感燃料）」；\n` +
			`· 需对外产出的归入「4_输出（成品出口）」；\n` +
			`· 原始素材保持在「${folder}」不动，仅新增提炼结果。`;

		// 1) 打开 Claudian 聊天面板（动态查找其「打开/切换聊天」命令，避免硬编码 id 随版本变化）
		const openCmd = Object.keys(app.commands.commands).find((id) => {
			if (!id.startsWith(CLAUDIAN_ID + ':')) return false;
			const name = app.commands.commands[id]?.name ?? '';
			return /chat|open|toggle|panel/i.test(name);
		});
		if (openCmd) app.commands.executeCommandById(openCmd);

		// 2) 等待面板挂载，将指令注入对话框并自动发送；失败则回退剪贴板
		const sent = await this.injectIntoClaudianChat(prompt);
		if (sent) {
			new Notice('已自动将「素材入库」指令填入 Claudian 对话框并发送，正在按 agent.md 处理素材仓库文件。');
		} else {
			try {
				await navigator.clipboard.writeText(prompt);
				new Notice('未能自动填入 Claudian 对话框，已改为复制到剪贴板——请手动粘贴发送。');
			} catch {
				new Notice('请手动将以下指令发送给 Claudian：\n' + prompt);
			}
		}
	}

	/* 将文本注入 Claudian 聊天输入框（兼容 textarea / input / contenteditable），并触发发送 */
	private async injectIntoClaudianChat(text: string): Promise<boolean> {
		// 轮询等待聊天面板挂载（obsidian 视图/模态异步渲染）
		let target: HTMLElement | null = null;
		for (let i = 0; i < 25; i++) {
			target = this.findClaudianInput();
			if (target) break;
			await new Promise((r) => window.setTimeout(r, 100));
		}
		if (!target) return false;

		// 写入文本：textarea/input 用原生 setter + input 事件（兼容 React/Vue 受控组件）；contenteditable 直接写内容
		if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
			const proto = target instanceof HTMLTextAreaElement
				? HTMLTextAreaElement.prototype
				: HTMLInputElement.prototype;
			// eslint-disable-next-line @typescript-eslint/unbound-method -- 需调用原生 value setter 以兼容受控组件
			const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
			setter?.call(target, text);
			target.dispatchEvent(new Event('input', { bubbles: true }));
			target.dispatchEvent(new Event('change', { bubbles: true }));
		} else {
			target.focus();
			target.textContent = text;
			target.dispatchEvent(new Event('input', { bubbles: true }));
		}

		await new Promise((r) => window.setTimeout(r, 80));

		// 触发发送：优先点击「发送」语义按钮，否则回退 Enter 键
		const container = target.closest('.view-content, .modal, .workspace-leaf, form') ?? target.parentElement;
		const all = container?.querySelectorAll<HTMLButtonElement>('button');
		const buttons: HTMLButtonElement[] = all ? Array.from(all) : [];
		const send = buttons.find((b) => {
			const ctx = (
				(b.getAttribute('aria-label') ?? '') + ' ' +
				(b.className ?? '') + ' ' +
				(b.textContent ?? '') + ' ' +
				(b.innerHTML ?? '')
			).toLowerCase();
			return /send|发送|submit|paper[- ]?plane|arrow-up|arrow-right|telegram/i.test(ctx);
		});
		if (send) {
			send.click();
			return true;
		}
		target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
		target.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
		return true;
	}

	/* 在已挂载的 Claudian 视图/模态中定位聊天输入框 */
	private findClaudianInput(): HTMLElement | null {
		const roots = Array.from(
			document.querySelectorAll<HTMLElement>('.workspace-leaf, .modal, .view-content'),
		);
		for (const root of roots) {
			const ta = root.querySelector<HTMLTextAreaElement>('textarea');
			if (ta && this.isVisible(ta)) return ta;
			const inp = root.querySelector<HTMLInputElement>('input[type="text"], input:not([type]), input[type="search"]');
			if (inp && this.isVisible(inp)) return inp;
			const ed = root.querySelector<HTMLElement>('[contenteditable="true"], [contenteditable=""]');
			if (ed && this.isVisible(ed)) return ed;
		}
		return null;
	}

	private isVisible(el: HTMLElement): boolean {
		const style = getComputedStyle(el);
		return (
			style.display !== 'none' &&
			style.visibility !== 'hidden' &&
			(el.offsetWidth > 0 || el.offsetHeight > 0)
		);
	}

	private async doVaultLint(): Promise<void> {
		const s = this.plugin.settings;
		const files = this.app.vault.getMarkdownFiles();
		const issues: string[] = [];
		const deadline = Date.now() - 90 * 24 * 60 * 60 * 1000;

		files.forEach(f => {
			const name = f.basename.toLowerCase();
			if (f.stat.mtime < deadline && !name.includes('index') && !name.includes('目录')) {
				issues.push(`- [ ] ${f.path} — 超过 90 天未更新`);
			}
		});

		const report = `# Vault 体检报告\n\n> 生成时间: ${new Date().toISOString().slice(0, 10)}\n> 总文件数: ${files.length}\n\n## 长时间未更新（>90天）\n\n${issues.slice(0, 20).join('\n')}\n${issues.length > 20 ? `\n... 共 ${issues.length} 项\n` : ''}`;

		try {
			const reportDir = s.reportFolder || 'Reports';
			const existing = this.app.vault.getAbstractFileByPath(reportDir);
			if (!existing) {
				await this.app.vault.createFolder(reportDir);
			}
			const path = `${reportDir}/vault-lint-${new Date().toISOString().slice(0, 10)}.md`;
			await this.app.vault.create(path, report);
			new Notice(`体检报告已生成: ${path}`);
		} catch (e) {
			new Notice(`生成失败: ${String(e)}`);
		}
	}

	/* ======== 知识库部署 / 模板 / 导入 ======== */

	/** 当前素材（原料）文件夹：优先设置，回退到文档的「1_原始资料」 */
	public materialFolder(): string {
		return this.plugin.settings.newMaterialFolder || KB_LAYER_FOLDERS[0]!;
	}
	/** 模板文件夹：优先设置，回退到 templater */
	private templaterFolder(): string {
		return this.plugin.settings.templaterFolder || 'templater';
	}
	/** 灵感 / 新笔记文件夹：优先设置，回退到文档的「2_创意想法」 */
	private inspireFolder(): string {
		return this.plugin.settings.inspireFolder || KB_LAYER_FOLDERS[1]!;
	}
	/** 生成文件名前缀时间戳：前缀_YYYYMMDD-HHmm（避免 Windows 非法字符） */
	private stamp(prefix: string): string {
		const n = new Date();
		return `${prefix}_${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}-${pad(n.getHours())}${pad(n.getMinutes())}`;
	}

	/** 一键部署：创建四层目录 + templater 文件夹 + 根目录 agent.md + 模板，并把设置对齐到文档结构（幂等） */
	private async deployKnowledgeBase(): Promise<void> {
		try {
			for (const f of KB_LAYER_FOLDERS) await this.ensureFolder(f);
			const templater = this.templaterFolder();
			await this.ensureFolder(templater);

			// 根目录规则文件 agent.md（已存在则保留，不覆盖）
			const agentPath = 'agent.md';
			if (!this.app.vault.getAbstractFileByPath(agentPath)) {
				await this.app.vault.create(agentPath, buildAgentMd());
			}

			// 模板（缺失才生成，不覆盖用户自定义）
			await this.ensureTemplates();

			// 把设置对齐到文档的四层结构
			const s = this.plugin.settings;
			s.newMaterialFolder = KB_LAYER_FOLDERS[0]!;
			s.inspireFolder = KB_LAYER_FOLDERS[1]!;
			s.newNoteFolder = KB_LAYER_FOLDERS[1]!;
			s.templaterFolder = templater;
			await this.plugin.saveSettings();

			new Notice('知识库已部署：四层目录 + agent.md + 模板已就绪');
			void this.reloadDashboard();
		} catch (e) {
			new Notice(`部署失败：${String(e)}`);
		}
	}

	/** 确保 templater 文件夹下的 5 个模板存在（幂等，不覆盖） */
	private async ensureTemplates(): Promise<void> {
		const templater = this.templaterFolder();
		await this.ensureFolder(templater);
		for (const t of KB_TEMPLATES) {
			const p = `${templater}/${t.name}`;
			if (!this.app.vault.getAbstractFileByPath(p)) {
				await this.app.vault.create(p, t.content);
			}
		}
	}

	/** 读取 templater 文件夹下的模板文件列表 */
	private async getTemplaterTemplates(): Promise<TFile[]> {
		const folder = this.templaterFolder();
		return this.app.vault.getMarkdownFiles()
			.filter(f => f.path === folder || f.path.startsWith(folder + '/'));
	}

	/**
	 * 依据模板创建笔记（文本类型）。
	 * @param templatePath 模板文件相对路径；为空则创建空白笔记
	 * @param folder 目标文件夹
	 * @param fileName 文件名（不含 .md）
	 */
	private async createFromTemplate(templatePath: string, folder: string, fileName: string): Promise<void> {
		await this.ensureFolder(folder);
		const n = new Date();
		const dateStr = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
		const timeStr = `${pad(n.getHours())}:${pad(n.getMinutes())}`;

		let content = '';
		const tpl = templatePath ? this.app.vault.getAbstractFileByPath(templatePath) : null;
		if (tpl instanceof TFile) {
			let raw = await this.app.vault.read(tpl);
			content = raw
				.replace(/\{\{title\}\}/g, fileName)
				.replace(/\{\{date\}\}/g, dateStr)
				.replace(/\{\{time\}\}/g, timeStr);
		} else {
			content = `# ${fileName}\n\n## 内容\n\n`;
		}

		const path = `${folder}/${fileName}.md`;
		try {
			await this.app.vault.create(path, content);
			new Notice(`已创建: ${path}`);
			await this.openFile(path);
			void this.reloadDashboard();
		} catch {
			new Notice('创建失败，请检查路径权限');
		}
	}

	/** 从文件夹或文件导入 Markdown 到素材（原料）文件夹 */
	public importMarkdown(useFolder: boolean): void {
		const folder = this.materialFolder();
		const input = document.body.createEl('input', { cls: 'nxdb-hidden-file' });
		input.type = 'file';
		input.multiple = true;
		if (useFolder) input.setAttribute('webkitdirectory', '');
		input.accept = '.md,.markdown,text/markdown';
		input.addEventListener('change', () => {
			void (async () => {
				const files = Array.from(input.files ?? []);
				const md = files.filter(f => /\.(md|markdown)$/i.test(f.name));
				if (md.length === 0) {
					new Notice('未选择到 Markdown 文件');
					return;
				}
				let ok = 0;
				let skip = 0;
				for (const f of md) {
					try {
						const content = await f.text();
						const dest = `${folder}/${f.name}`;
						if (this.app.vault.getAbstractFileByPath(dest)) {
							skip++;
							continue;
						}
						await this.app.vault.create(dest, content);
						ok++;
					} catch {
						skip++;
					}
				}
				new Notice(`已导入 ${ok} 个 Markdown 文件${skip ? `，跳过 ${skip} 个已存在` : ''} → ${folder}`);
				void this.reloadDashboard();
			})();
		});
		input.click();
	}

	/* ======== Stat Cards ======== */
	private renderStats(root: HTMLElement): void {
		const row = root.createDiv('nxdb-row nxdb-row--stats');

		this.statCard(row, '仓库健康', String(this.vaultStats.healthScore), `共 ${this.vaultStats.totalNotes} 篇笔记`, 'up', 'activity');
		this.statCard(row, '原始资料', String(this.kbLayers.raw), '1_原始资料（不可变原料）', 'flat', 'archive');
		this.statCard(row, '知识库', String(this.kbLayers.knowledge), `${this.kbLayers.knowledgeCategories} 个分类`, 'up', 'book-open');
		this.statCard(row, '任务情况', `${this.taskStats.completionRate}%`, `${this.taskStats.todayTotal} 个任务`, 'up', 'workflow');
		this.statCard(row, '输出', String(this.kbLayers.output), '4_输出（成品出口）', 'up', 'share-2');
	}

	private statCard(
		row: HTMLElement, label: string, value: string,
		delta: string, trend: 'up' | 'down' | 'flat', icon: string,
	): void {
		const card = row.createDiv('nxdb-card nxdb-stat');
		const tc = trend === 'up' ? 'nxdb-stat__delta--up' : trend === 'down' ? 'nxdb-stat__delta--down' : '';
		const arrow = trend === 'up' ? '▲ ' : trend === 'down' ? '▼ ' : '';
		const head = card.createDiv('nxdb-stat__head');
		head.createSpan({ cls: 'nxdb-stat__label', text: label });
		const iEl = head.createSpan('nxdb-stat__icon');
		setIcon(iEl, icon);
		card.createDiv({ cls: 'nxdb-stat__value', text: value });
		card.createDiv({ cls: `nxdb-stat__delta ${tc}`, text: arrow + delta });
		card.createSpan('nxdb-stat__strip');
	}

	/* ======== Charts Row ======== */
	private renderCharts(root: HTMLElement): void {
		const row = root.createDiv('nxdb-row nxdb-row--charts');
		this.renderLineChart(row);
		this.renderCategoryBars(row);
	}

	/* ---------- 笔记创建趋势折线图（股市风格） ---------- */
	private renderLineChart(row: HTMLElement): void {
		const card = row.createDiv('nxdb-card nxdb-card--linechart');
		const head = card.createDiv('nxdb-card__head');
		const tg = head.createDiv('nxdb-card__title-group');
		tg.createEl('h2', { cls: 'nxdb-card__title', text: '笔记创建趋势' });
		tg.createSpan({ cls: 'nxdb-card__sub', text: '每日新建笔记数' });
		const meta = head.createSpan({ cls: 'nxdb-card__meta' });

		const controls = card.createDiv('nxdb-card__controls');
		const periods: { label: string; days: number }[] = [
			{ label: '近7天', days: 7 },
			{ label: '30天', days: 30 },
			{ label: '6个月', days: 180 },
			{ label: '1年', days: 365 },
		];
		const btns: HTMLElement[] = [];
		periods.forEach(p => {
			const b = controls.createEl('button', {
				cls: 'nxdb-chn-btn' + (p.days === this.chartPeriod ? ' nxdb-chn-btn--active' : ''),
				text: p.label,
			});
			b.addEventListener('click', () => {
				this.chartPeriod = p.days;
				btns.forEach(x => x.classList.remove('nxdb-chn-btn--active'));
				b.classList.add('nxdb-chn-btn--active');
				this.drawLineChart(body, meta);
			});
			btns.push(b);
		});

		const body = card.createDiv('nxdb-card__chart');
		this.drawLineChart(body, meta);
	}

	/** 按当前 chartPeriod 重绘折线图（周长切换时复用，无需整页刷新） */
	private drawLineChart(body: HTMLElement, meta: HTMLElement): void {
		body.empty();
		const series = this.activitySeries.slice(-this.chartPeriod);
		const n = series.length;
		const total = series.reduce((s, p) => s + p.count, 0);
		meta.textContent = `共 ${total} 篇`;

		if (n === 0) {
			body.createSpan({ cls: 'nxdb-linechart__empty', text: '暂无数据' });
			return;
		}

		const W = Math.max(280, Math.floor(body.clientWidth || 480));
		const H = 200;
		const padL = 30, padR = 12, padT = 14, padB = 24;
		const plotW = W - padL - padR;
		const plotH = H - padT - padB;
		const baseline = padT + plotH;

		const maxRaw = Math.max(1, ...series.map(p => p.count));
		const niceMax = niceCeil(maxRaw);
		const xAt = (i: number): number => n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
		const yAt = (c: number): number => baseline - (c / niceMax) * plotH;

		const svgNS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(svgNS, 'svg');
		svg.setAttribute('class', 'nxdb-linechart__svg');
		svg.setAttribute('width', String(W));
		svg.setAttribute('height', String(H));
		svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

		// 渐变填充定义（折线下方面积）
		const defs = document.createElementNS(svgNS, 'defs');
		const grad = document.createElementNS(svgNS, 'linearGradient');
		grad.setAttribute('id', 'nxdb-lc-grad');
		grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
		grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
		const stop1 = document.createElementNS(svgNS, 'stop');
		stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#56c7d8'); stop1.setAttribute('stop-opacity', '0.30');
		const stop2 = document.createElementNS(svgNS, 'stop');
		stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#56c7d8'); stop2.setAttribute('stop-opacity', '0');
		grad.appendChild(stop1); grad.appendChild(stop2); defs.appendChild(grad);
		svg.appendChild(defs);

		// 水平网格线 + Y 轴刻度
		const ticks = 4;
		for (let t = 0; t <= ticks; t++) {
			const val = (niceMax * t) / ticks;
			const y = yAt(val);
			const gl = document.createElementNS(svgNS, 'line');
			gl.setAttribute('x1', String(padL)); gl.setAttribute('x2', String(W - padR));
			gl.setAttribute('y1', y.toFixed(1)); gl.setAttribute('y2', y.toFixed(1));
			gl.setAttribute('class', 'nxdb-linechart__grid');
			svg.appendChild(gl);
			const lb = document.createElementNS(svgNS, 'text');
			lb.setAttribute('x', String(padL - 5)); lb.setAttribute('y', (y + 3).toFixed(1));
			lb.setAttribute('class', 'nxdb-linechart__ylabel');
			lb.setAttribute('text-anchor', 'end');
			lb.textContent = String(Math.round(val));
			svg.appendChild(lb);
		}

		// 折线点集合
		const linePts: string[] = [];
		series.forEach((p, i) => {
			linePts.push(`${xAt(i).toFixed(1)} ${yAt(p.count).toFixed(1)}`);
		});

		// 面积路径
		const areaD = `M ${xAt(0).toFixed(1)} ${baseline.toFixed(1)} L ` +
			linePts.join(' L ') + ` L ${xAt(n - 1).toFixed(1)} ${baseline.toFixed(1)} Z`;
		const area = document.createElementNS(svgNS, 'path');
		area.setAttribute('d', areaD);
		area.setAttribute('class', 'nxdb-linechart__area');
		area.setAttribute('fill', 'url(#nxdb-lc-grad)');
		svg.appendChild(area);

		// 折线路径
		const line = document.createElementNS(svgNS, 'path');
		line.setAttribute('d', 'M ' + linePts.join(' L '));
		line.setAttribute('class', 'nxdb-linechart__line');
		svg.appendChild(line);

		// 末点高亮
		const lastX = xAt(n - 1), lastY = yAt(series[n - 1]!.count);
		const dot = document.createElementNS(svgNS, 'circle');
		dot.setAttribute('cx', lastX.toFixed(1)); dot.setAttribute('cy', lastY.toFixed(1));
		dot.setAttribute('r', '3'); dot.setAttribute('class', 'nxdb-linechart__dot');
		svg.appendChild(dot);

		// X 轴日期标签（最多约 6 个）
		const labelEvery = Math.max(1, Math.ceil(n / 6));
		let lastIdx = -1;
		for (let i = 0; i < n; i++) {
			if (i % labelEvery !== 0 && i !== n - 1) continue;
			if (i === lastIdx) continue;
			lastIdx = i;
			const x = xAt(i);
			const tx = document.createElementNS(svgNS, 'text');
			tx.setAttribute('x', x.toFixed(1));
			tx.setAttribute('y', String(H - 6));
			tx.setAttribute('class', 'nxdb-linechart__xlabel');
			tx.setAttribute('text-anchor', i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle');
			tx.textContent = series[i]!.date.slice(5); // MM-DD
			svg.appendChild(tx);
		}

		// 交互：十字准星 + 悬浮点 + tooltip（tooltip 用 SVG 组，避免直接写 style）
		const cross = document.createElementNS(svgNS, 'line');
		cross.setAttribute('y1', String(padT)); cross.setAttribute('y2', String(baseline));
		cross.setAttribute('class', 'nxdb-linechart__cross');
		svg.appendChild(cross);

		const hoverDot = document.createElementNS(svgNS, 'circle');
		hoverDot.setAttribute('r', '3.5');
		hoverDot.setAttribute('class', 'nxdb-linechart__hover-dot');
		svg.appendChild(hoverDot);

		// tooltip 作为 SVG <g>：背景 rect + 文本，靠 class 控制显隐
		const tip = document.createElementNS(svgNS, 'g');
		tip.setAttribute('class', 'nxdb-linechart__tip');
		const tipBg = document.createElementNS(svgNS, 'rect');
		tipBg.setAttribute('class', 'nxdb-linechart__tip-bg');
		tipBg.setAttribute('rx', '3'); tipBg.setAttribute('height', '17');
		const tipText = document.createElementNS(svgNS, 'text');
		tipText.setAttribute('class', 'nxdb-linechart__tip-text');
		tipText.setAttribute('x', '7'); tipText.setAttribute('y', '12');
		tip.appendChild(tipBg); tip.appendChild(tipText);
		svg.appendChild(tip);

		const move = (ev: MouseEvent) => {
			const rect = svg.getBoundingClientRect();
			const scale = W / rect.width;
			const mx = (ev.clientX - rect.left) * scale;
			let i = n <= 1 ? 0 : Math.round(((mx - padL) / plotW) * (n - 1));
			i = Math.max(0, Math.min(n - 1, i));
			const px = xAt(i), py = yAt(series[i]!.count);
			cross.setAttribute('x1', px.toFixed(1)); cross.setAttribute('x2', px.toFixed(1));
			hoverDot.setAttribute('cx', px.toFixed(1)); hoverDot.setAttribute('cy', py.toFixed(1));

			const label = `${series[i]!.date} · ${series[i]!.count} 篇`;
			tipText.textContent = label;
			const tw = label.length * 7 + 14;
			tipBg.setAttribute('width', tw.toFixed(0));
			const tx = Math.min(Math.max(px - tw / 2, 2), W - tw - 2);
			const ty = Math.max(py - 26, 2);
			tip.setAttribute('transform', `translate(${tx.toFixed(1)}, ${ty.toFixed(1)})`);

			cross.classList.add('nxdb-is-visible');
			hoverDot.classList.add('nxdb-is-visible');
			tip.classList.add('nxdb-is-visible');
		};
		const leave = () => {
			cross.classList.remove('nxdb-is-visible');
			hoverDot.classList.remove('nxdb-is-visible');
			tip.classList.remove('nxdb-is-visible');
		};
		svg.addEventListener('mousemove', move);
		svg.addEventListener('mouseleave', leave);

		body.appendChild(svg);
	}

	private renderCategoryBars(row: HTMLElement): void {
		const card = row.createDiv('nxdb-card nxdb-card--bars');
		const ch = card.createDiv('nxdb-card__head');
		const ctg = ch.createDiv('nxdb-card__title-group');
		ctg.createEl('h2', { cls: 'nxdb-card__title', text: '分类分布' });
		ctg.createSpan({ cls: 'nxdb-card__sub', text: '按文件夹统计笔记数量' });

		const cats = this.categories;
		const total = cats.reduce((s, c) => s + c.count, 0);
		ch.createSpan({ cls: 'nxdb-card__meta', text: `${total} 篇笔记` });

		const list = card.createEl('ul', 'nxdb-barlist');
		if (cats.length === 0) {
			list.createEl('li').createSpan({ text: '暂无分类数据' });
			return;
		}

		const maxCount = Math.max(...cats.map(c => c.count));
		cats.forEach((cat, idx) => {
			const li = list.createEl('li');
			li.createSpan({ cls: 'nxdb-bar__label', text: cat.name });
			const track = li.createDiv('nxdb-bar__track');
			const fill = track.createDiv('nxdb-bar__fill');
			fill.classList.add(`nxdb-bar--c${idx % 8}`);
			li.createSpan({ cls: 'nxdb-bar__count', text: String(cat.count) });
			window.requestAnimationFrame(() => {
				window.setTimeout(() => {
					const pct = (cat.count / maxCount * 100).toFixed(1);
					fill.setAttribute('style', `width:${pct}%;background:${cat.color}`);
				}, 60 + idx * 80);
			});
		});
	}

	/* ======== Lists Row ======== */
	private renderLists(root: HTMLElement): void {
		const row = root.createDiv('nxdb-row nxdb-row--lists');
		this.renderCalendar(row);
		this.renderTasks(row);
		this.renderRecentUpdates(row);
	}

	private renderCalendar(row: HTMLElement): void {
		const card = row.createDiv('nxdb-card nxdb-card--cal');
		this.renderCalendarInto(card);
	}

	/** 切换日历月份，重新读取该月笔记分布并重绘日历部分 */
	private async changeCalendarMonth(delta: number): Promise<void> {
		let m = this.calMonth + delta;
		let y = this.calYear;
		if (m < 0) { m = 11; y--; }
		else if (m > 11) { m = 0; y++; }
		this.calMonth = m;
		this.calYear = y;
		this.calNoteDays = getNoteDaysInMonth(this.app, this.calYear, this.calMonth + 1);
		// 只重绘日历卡片，不刷新整个 dashboard
		const calCard = this.contentEl.querySelector('.nxdb-card--cal');
		if (calCard instanceof HTMLElement) {
			const parent = calCard.parentElement;
			if (parent) {
				const next = calCard.nextElementSibling;
				calCard.remove();
				const newCard = parent.createDiv('nxdb-card nxdb-card--cal');
				// 在原位置插入（next 之前）
				if (next) parent.insertBefore(newCard, next);
				else parent.appendChild(newCard);
				// 渲染到新卡片
				this.renderCalendarInto(newCard);
			}
		}
	}

	/** 回到本月 */
	private async goToTodayMonth(): Promise<void> {
		const now = new Date();
		if (this.calYear === now.getFullYear() && this.calMonth === now.getMonth()) return;
		this.calYear = now.getFullYear();
		this.calMonth = now.getMonth();
		this.calNoteDays = getNoteDaysInMonth(this.app, this.calYear, this.calMonth + 1);
		const calCard = this.contentEl.querySelector('.nxdb-card--cal');
		if (calCard instanceof HTMLElement) {
			const parent = calCard.parentElement;
			if (parent) {
				const next = calCard.nextElementSibling;
				calCard.remove();
				const newCard = parent.createDiv('nxdb-card nxdb-card--cal');
				if (next) parent.insertBefore(newCard, next);
				else parent.appendChild(newCard);
				this.renderCalendarInto(newCard);
			}
		}
	}

	/** 把日历内容渲染到指定容器（供 changeCalendarMonth 复用） */
	private renderCalendarInto(container: HTMLElement): void {
		const ch = container.createDiv('nxdb-card__head');
		const ctg = ch.createDiv('nxdb-card__title-group');
		ctg.createEl('h2', { cls: 'nxdb-card__title', text: `${this.calYear}年${MONTHS[this.calMonth]}` });
		ctg.createSpan({ cls: 'nxdb-card__sub', text: `${this.calNoteDays.size} 个笔记日` });

		const nav = ch.createDiv('nxdb-cal-nav');
		const prevBtn = nav.createEl('button', { cls: 'nxdb-cal-nav__btn' });
		setIcon(prevBtn, 'chevron-left');
		prevBtn.setAttribute('aria-label', '上一月');
		prevBtn.addEventListener('click', () => { void this.changeCalendarMonth(-1); });
		const todayBtn = nav.createEl('button', { cls: 'nxdb-cal-nav__btn nxdb-cal-nav__btn--today', text: '今' });
		todayBtn.setAttribute('aria-label', '回到本月');
		todayBtn.addEventListener('click', () => { void this.goToTodayMonth(); });
		const nextBtn = nav.createEl('button', { cls: 'nxdb-cal-nav__btn' });
		setIcon(nextBtn, 'chevron-right');
		nextBtn.setAttribute('aria-label', '下一月');
		nextBtn.addEventListener('click', () => { void this.changeCalendarMonth(1); });

		const cal = container.createDiv('nxdb-calendar');
		const wdRow = cal.createDiv('nxdb-cal__weekdays');
		['日','一','二','三','四','五','六'].forEach(w => wdRow.createSpan({ text: w }));
		const grid = cal.createDiv('nxdb-cal__grid');

		const firstDay = new Date(this.calYear, this.calMonth, 1).getDay();
		const daysInMonth = new Date(this.calYear, this.calMonth + 1, 0).getDate();
		const now = new Date();
		const isCurrentMonth = now.getFullYear() === this.calYear && now.getMonth() === this.calMonth;
		const today = isCurrentMonth ? now.getDate() : -1;

		for (let i = 0; i < firstDay; i++) {
			grid.createDiv('nxdb-cal__cell nxdb-cal__cell--empty');
		}
		for (let d = 1; d <= daysInMonth; d++) {
			const cell = grid.createDiv('nxdb-cal__cell');
			cell.textContent = String(d);
			if (d === today) cell.classList.add('nxdb-cal__cell--today');
			if (this.calNoteDays.has(d)) {
				cell.classList.add('nxdb-cal__cell--has-notes');
				cell.setAttribute('title', `${this.calYear}-${pad(this.calMonth + 1)}-${pad(d)} 有笔记`);
			}
			cell.classList.add('nxdb-cal__cell--clickable');
			const dateStr = `${this.calYear}-${pad(this.calMonth + 1)}-${pad(d)}`;
			cell.addEventListener('click', () => {
				new DayActionModal(this.app, dateStr, this).open();
			});
		}
	}

	private renderTasks(row: HTMLElement): void {
		const card = row.createDiv('nxdb-card nxdb-card--list');
		const ch = card.createDiv('nxdb-card__head');
		const ctg = ch.createDiv('nxdb-card__title-group');
		ctg.createEl('h2', { cls: 'nxdb-card__title', text: '今日任务' });

		const tasks = this.todayTasks;
		const doneCount = tasks.filter(t => t.status === 'done').length;
		ctg.createSpan({ cls: 'nxdb-card__sub', text: `${tasks.length} 条任务 · ${doneCount} 条已完成` });
		ch.createSpan({ cls: 'nxdb-card__meta', text: '今天' });

		const list = card.createEl('ul', 'nxdb-tasklist');
		const statusText: Record<string, string> = { done: '已完成', doing: '进行中', todo: '待办' };

		if (tasks.length === 0) {
			list.createEl('li').createSpan({ text: '今日暂无任务', cls: 'nxdb-task__title' });
		} else {
			tasks.forEach(t => {
				const li = list.createEl('li', `nxdb-task nxdb-task--${t.status}`);
				li.createSpan('nxdb-task__check');
				const main = li.createDiv('nxdb-task__main');
				main.createDiv({ cls: 'nxdb-task__title', text: t.title });
				const meta = main.createDiv('nxdb-task__meta');
				meta.createSpan({ cls: 'nxdb-tag', text: t.tag });
				meta.createSpan({ text: `截止 ${t.due}` });
				li.createSpan({ cls: `nxdb-badge nxdb-badge--${t.status}`, text: statusText[t.status] });
			});
		}
	}

	private renderRecentUpdates(row: HTMLElement): void {
		const card = row.createDiv('nxdb-card nxdb-card--list');
		const ch = card.createDiv('nxdb-card__head');
		const ctg = ch.createDiv('nxdb-card__title-group');
		ctg.createEl('h2', { cls: 'nxdb-card__title', text: '最近更新' });
		ctg.createSpan({ cls: 'nxdb-card__sub', text: '知识库页面动态' });
		ch.createSpan({ cls: 'nxdb-card__meta', text: `${this.recentNotes.length} 条` });

		if (this.recentNotes.length === 0) {
			card.createDiv({ cls: 'nxdb-empty', text: '暂无笔记' });
			return;
		}

		const list = card.createEl('ul', 'nxdb-recentlist');
		this.recentNotes.forEach(n => {
			const li = list.createEl('li', { cls: 'nxdb-recent' });
			li.addEventListener('click', () => void this.openFile(n.path));
			const mainEl = li.createDiv('nxdb-recent__main');
			mainEl.createDiv({ cls: 'nxdb-recent__title', text: n.title });
			mainEl.createDiv({ cls: 'nxdb-recent__folder', text: n.folder });
			li.createSpan({ cls: 'nxdb-recent__time', text: timeAgo(n.mtime) });
		});
	}

	/* ======== Footer ======== */
	private renderFooter(root: HTMLElement): void {
		const ft = root.createDiv('nxdb-footer');
		ft.createSpan({ text: `Nexusnote · ${this.vaultStats.totalNotes} 篇笔记 · 数据来源: Vault` });
	}
}

/* ============================================================
   Plugin
   ============================================================ */
export default class NexusnotePlugin extends Plugin {
	settings!: NexusnoteSettings;
	private refreshTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE, (leaf) => new NexusnoteDashboardView(leaf, this));

		// 注册专属 ribbon 图标，避免和官方插件的 layout-dashboard 撞脸
		addIcon('nexusnote', NEXUSNOTE_ICON);

		this.addRibbonIcon('nexusnote', '打开仪表盘', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-dashboard',
			name: '打开仪表盘',
			callback: () => void this.activateView(),
		});

		this.addSettingTab(new NexusnoteSettingTab(this.app, this));

		// 监听文件变化，500ms debounce 后自动刷新 Dashboard
		const scheduleRefresh = () => {
			if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
			this.refreshTimer = window.setTimeout(() => this.refreshActiveDashboard(), 500);
		};
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					scheduleRefresh();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					scheduleRefresh();
				}
			}),
		);
	}

	onunload(): void {
		if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<NexusnoteSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE)[0] || null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE, active: true });
			}
		}
		if (leaf) void workspace.revealLeaf(leaf);
	}

	/** 如果 Dashboard 已打开则自动刷新 */
	private refreshActiveDashboard(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof NexusnoteDashboardView) {
				void view.reloadDashboard();
			}
		}
	}
}

/* ============================================================
   Template Picker Modal
   ============================================================ */
class TemplatePickerModal extends Modal {
	private templates: TFile[];
	private onSelect: (template: TFile | null) => void | Promise<void>;

	constructor(app: App, templates: TFile[], onSelect: (template: TFile | null) => void | Promise<void>) {
		super(app);
		this.templates = templates;
		this.onSelect = onSelect;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('nxdb-modal');
		contentEl.empty();

		contentEl.createEl('h2', { text: '选择模板', cls: 'nxdb-modal__title' });
		contentEl.createEl('p', {
			text: '从以下模板创建新笔记，或选择空白笔记',
			cls: 'nxdb-modal__desc',
		});

		const blankBtn = contentEl.createEl('button', {
			cls: 'nxdb-modal__item',
			text: '空白笔记',
		});
		blankBtn.addEventListener('click', () => {
			void this.onSelect(null);
			this.close();
		});

		contentEl.createDiv({ cls: 'nxdb-modal__divider' });

		this.templates.forEach(t => {
			const item = contentEl.createEl('button', { cls: 'nxdb-modal__item' });
			const iconSpan = item.createSpan({ cls: 'nxdb-modal__icon' });
			setIcon(iconSpan, 'file-text');
			item.createSpan({ text: t.basename });
			item.addEventListener('click', () => {
				void this.onSelect(t);
				this.close();
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/* ============================================================
   New Material Modal — 点击「新素材」后弹出
   选项 1：根据模板新建
   选项 2：从文件夹导入（Markdown）
   选项 3：从文件导入（Markdown）
   ============================================================ */
class NewMaterialModal extends Modal {
	private view: NexusnoteDashboardView;

	constructor(app: App, view: NexusnoteDashboardView) {
		super(app);
		this.view = view;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('nxdb-modal');
		modalEl.addClass('nxdb-modal--material');
		contentEl.empty();

		contentEl.createEl('h2', { text: '新素材', cls: 'nxdb-modal__title' });
		contentEl.createEl('p', {
			text: `选择创建方式，素材将保存到「${this.view.materialFolder()}」`,
			cls: 'nxdb-modal__desc',
		});

		// 选项 1：根据模板新建
		const tplBtn = contentEl.createEl('button', {
			cls: 'nxdb-modal__item nxdb-modal__item--primary',
		});
		const tplIcon = tplBtn.createSpan({ cls: 'nxdb-modal__icon' });
		setIcon(tplIcon, 'file-plus');
		const tplText = tplBtn.createDiv('nxdb-modal__item-text');
		tplText.createDiv({ cls: 'nxdb-modal__item-title', text: '根据模板新建' });
		tplText.createDiv({ cls: 'nxdb-modal__item-sub', text: '从 templater 模板库选择模板创建素材笔记' });
		tplBtn.addEventListener('click', () => {
			this.close();
			void this.view.newMaterialFromTemplate();
		});

		contentEl.createDiv({ cls: 'nxdb-modal__divider' });

		// 选项 2：从文件夹导入
		const folderBtn = contentEl.createEl('button', { cls: 'nxdb-modal__item' });
		const folderIcon = folderBtn.createSpan({ cls: 'nxdb-modal__icon' });
		setIcon(folderIcon, 'folder-input');
		const folderText = folderBtn.createDiv('nxdb-modal__item-text');
		folderText.createDiv({ cls: 'nxdb-modal__item-title', text: '从文件夹导入' });
		folderText.createDiv({ cls: 'nxdb-modal__item-sub', text: '选择文件夹，复制其中所有 Markdown 到原始资料' });
		folderBtn.addEventListener('click', () => {
			this.close();
			this.view.importMarkdown(true);
		});

		// 选项 3：从文件导入
		const fileBtn = contentEl.createEl('button', { cls: 'nxdb-modal__item' });
		const fileIcon = fileBtn.createSpan({ cls: 'nxdb-modal__icon' });
		setIcon(fileIcon, 'file-input');
		const fileText = fileBtn.createDiv('nxdb-modal__item-text');
		fileText.createDiv({ cls: 'nxdb-modal__item-title', text: '从文件导入' });
		fileText.createDiv({ cls: 'nxdb-modal__item-sub', text: '选择 .md 文件复制到原始资料' });
		fileBtn.addEventListener('click', () => {
			this.close();
			this.view.importMarkdown(false);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/* ============================================================
   Day Action Modal — 点击日历某天后弹出
   选项 1：查看当天的所有笔记（默认）
   选项 2：创建当天的新笔记
   ============================================================ */
class DayActionModal extends Modal {
	private dateStr: string;
	private view: NexusnoteDashboardView;

	constructor(app: App, dateStr: string, view: NexusnoteDashboardView) {
		super(app);
		this.dateStr = dateStr;
		this.view = view;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('nxdb-modal');
		contentEl.empty();

		// 标题
		contentEl.createEl('h2', {
			text: this.dateStr,
			cls: 'nxdb-modal__title',
		});

		// 先查询当天笔记数量
		const notes = getNotesForDate(this.app, this.dateStr);
		contentEl.createEl('p', {
			text: `当天有 ${notes.length} 篇笔记`,
			cls: 'nxdb-modal__desc',
		});

		// 选项 1：查看当天所有笔记（默认）
		const viewBtn = contentEl.createEl('button', {
			cls: 'nxdb-modal__item nxdb-modal__item--primary',
		});
		const viewIcon = viewBtn.createSpan({ cls: 'nxdb-modal__icon' });
		setIcon(viewIcon, 'list');
		const viewText = viewBtn.createDiv('nxdb-modal__item-text');
		viewText.createDiv({ cls: 'nxdb-modal__item-title', text: '查看当天的所有笔记' });
		viewText.createDiv({ cls: 'nxdb-modal__item-sub', text: notes.length > 0 ? `${notes.length} 篇笔记` : '暂无笔记' });
		viewBtn.addEventListener('click', () => {
			this.close();
			new DayNotesModal(this.app, this.dateStr, notes, this.view).open();
		});

		// 选项 2：创建当天新笔记
		const createBtn = contentEl.createEl('button', {
			cls: 'nxdb-modal__item',
		});
		const createIcon = createBtn.createSpan({ cls: 'nxdb-modal__icon' });
		setIcon(createIcon, 'file-plus');
		const createText = createBtn.createDiv('nxdb-modal__item-text');
		createText.createDiv({ cls: 'nxdb-modal__item-title', text: '创建当天的新笔记' });
		createText.createDiv({ cls: 'nxdb-modal__item-sub', text: '使用模板或空白笔记' });
		createBtn.addEventListener('click', () => {
			this.close();
			void this.view.createNoteForDate(this.dateStr);
		});

		contentEl.createDiv({ cls: 'nxdb-modal__divider' });

		// 选项 3：新建当天日记
		const diaryBtn = contentEl.createEl('button', {
			cls: 'nxdb-modal__item',
		});
		const diaryIcon = diaryBtn.createSpan({ cls: 'nxdb-modal__icon' });
		setIcon(diaryIcon, 'book-open-check');
		const diaryText = diaryBtn.createDiv('nxdb-modal__item-text');
		diaryText.createDiv({ cls: 'nxdb-modal__item-title', text: '新建当天日记' });
		diaryText.createDiv({ cls: 'nxdb-modal__item-sub', text: `创建 日记_${this.dateStr}.md` });
		diaryBtn.addEventListener('click', () => {
			this.close();
			void this.view.createDiaryForDate(this.dateStr);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/* ============================================================
   Day Notes Modal — 列出某天的所有笔记，点击打开
   ============================================================ */
class DayNotesModal extends Modal {
	private dateStr: string;
	private notes: NoteRef[];
	private view: NexusnoteDashboardView;

	constructor(app: App, dateStr: string, notes: NoteRef[], view: NexusnoteDashboardView) {
		super(app);
		this.dateStr = dateStr;
		this.notes = notes;
		this.view = view;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('nxdb-modal');
		contentEl.empty();

		contentEl.createEl('h2', {
			text: `${this.dateStr} 的笔记`,
			cls: 'nxdb-modal__title',
		});
		contentEl.createEl('p', {
			text: this.notes.length > 0 ? `共 ${this.notes.length} 篇` : '当天没有笔记',
			cls: 'nxdb-modal__desc',
		});

		if (this.notes.length === 0) {
			const emptyBtn = contentEl.createEl('button', {
				cls: 'nxdb-modal__item nxdb-modal__item--primary',
				text: '立即创建一篇',
			});
			emptyBtn.addEventListener('click', () => {
				this.close();
				void this.view.createNoteForDate(this.dateStr);
			});
			return;
		}

		// 笔记列表（最多显示 50 条，防止列表过长）
		const MAX_NOTES = 50;
		const displayed = this.notes.slice(0, MAX_NOTES);
		displayed.forEach(n => {
			const item = contentEl.createEl('button', { cls: 'nxdb-modal__item' });
			const icon = item.createSpan({ cls: 'nxdb-modal__icon' });
			setIcon(icon, 'file-text');
			const text = item.createDiv('nxdb-modal__item-text');
			text.createDiv({ cls: 'nxdb-modal__item-title', text: n.basename });
			const cDate = new Date(n.ctime);
			const timeStr = `${pad(cDate.getHours())}:${pad(cDate.getMinutes())}`;
			text.createDiv({ cls: 'nxdb-modal__item-sub', text: `${timeStr} · ${n.path}` });
			item.addEventListener('click', () => {
				void (async () => {
					const file = this.app.vault.getAbstractFileByPath(n.path);
					if (file instanceof TFile) {
						await this.app.workspace.getLeaf().openFile(file);
					}
					this.close();
				})();
			});
		});
		if (this.notes.length > MAX_NOTES) {
			contentEl.createDiv({
				cls: 'nxdb-modal__desc',
				text: `还有 ${this.notes.length - MAX_NOTES} 条笔记未显示…`,
			});
		}

		// 底部"创建新笔记"按钮
		contentEl.createDiv({ cls: 'nxdb-modal__divider' });
		const createBtn = contentEl.createEl('button', {
			cls: 'nxdb-modal__item nxdb-modal__item--primary',
		});
		const createIcon = createBtn.createSpan({ cls: 'nxdb-modal__icon' });
		setIcon(createIcon, 'file-plus');
		createBtn.createSpan({ text: '为这天创建新笔记' });
		createBtn.addEventListener('click', () => {
			this.close();
			void this.view.createNoteForDate(this.dateStr);
		});

		// 为这天新建日记
		const diaryBtn = contentEl.createEl('button', {
			cls: 'nxdb-modal__item',
		});
		const diaryIcon = diaryBtn.createSpan({ cls: 'nxdb-modal__icon' });
		setIcon(diaryIcon, 'book-open-check');
		diaryBtn.createSpan({ text: `为这天新建日记 (日记_${this.dateStr})` });
		diaryBtn.addEventListener('click', () => {
			this.close();
			void this.view.createDiaryForDate(this.dateStr);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
