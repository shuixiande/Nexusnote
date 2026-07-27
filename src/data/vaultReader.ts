/* ============================================================
   Nexusnote — Vault 数据读取层
   读取当前 Obsidian Vault 的真实数据，替代 mock 数据
   ============================================================ */

import { App, TFile, TFolder } from 'obsidian';

export interface VaultStats {
	totalNotes: number;
	totalFolders: number;
	healthScore: number;
	healthDelta: string;
}

export interface TaskStats {
	completionRate: number;
	todayTotal: number;
	overdue: number;
}

export interface CategoryCount {
	name: string;
	count: number;
	color: string;
}

export interface ParsedTask {
	title: string;
	status: 'done' | 'doing' | 'todo';
	tag: string;
	due: string;
}

export interface SeriesPoint {
	date: string; // YYYY-MM-DD
	count: number; // 当天新建笔记数
}

const CATEGORY_COLORS = ['#5ba4fc', '#a78bfa', '#4ade80', '#fbbf24', '#fb923c', '#a78bfa', '#8bc34a', '#60a5fa'];

/* ---------- 仓库健康度 ---------- */
export function getVaultStats(app: App): VaultStats {
	const files = app.vault.getMarkdownFiles();
	const allFiles = app.vault.getAllLoadedFiles();
	const folders = allFiles.filter(f => f instanceof TFolder).length;

	// 健康分 mock：基于文件数量 + 文件夹数量计算一个简单指标
	const healthScore = Math.min(100, Math.round(50 + files.length * 0.3 + folders * 0.5));

	return {
		totalNotes: files.length,
		totalFolders: folders,
		healthScore,
		healthDelta: `共 ${files.length} 篇笔记`,
	};
}

/* ---------- 四层架构统计（对齐《个人知识库系统-升级版.md》） ---------- */
export interface KbLayerCounts {
	/** 1_原始资料（不可变原料）下的笔记数 */
	raw: number;
	/** 2_创意想法（灵感燃料）下的笔记数 */
	idea: number;
	/** 3_知识库（AI接管Wiki）下的笔记数 */
	knowledge: number;
	/** 4_输出（成品出口）下的笔记数 */
	output: number;
	/** 知识库层下的分类（直接子文件夹）数 */
	knowledgeCategories: number;
}

export function getKbLayerCounts(app: App, folders: string[]): KbLayerCounts {
	const files = app.vault.getMarkdownFiles();
	const countUnder = (prefix?: string) =>
		prefix ? files.filter(f => f.path.startsWith(prefix + '/')).length : 0;

	const knowledgePrefix = folders[2];
	const subs = new Set<string>();
	files.forEach(f => {
		if (knowledgePrefix && f.path.startsWith(knowledgePrefix + '/')) {
			const parts = f.path.split('/');
			if (parts.length > 2) subs.add(parts[1]!);
		}
	});

	return {
		raw: countUnder(folders[0]),
		idea: countUnder(folders[1]),
		knowledge: countUnder(folders[2]),
		output: countUnder(folders[3]),
		knowledgeCategories: subs.size,
	};
}

/* ---------- 任务统计 ---------- */
export function getTaskStats(app: App): TaskStats {
	const files = app.vault.getMarkdownFiles();

	// 搜索 tasks
	let total = 0;
	let done = 0;
	let overdue = 0;
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	files.forEach(f => {
		// 简单解析 frontmatter 或正文中的任务 - [ ] / - [x]
		// 这里用简化版：搜索常见格式
		const cache = app.metadataCache.getFileCache(f);
		if (!cache) return;

		// list items (tasks)
		const items = cache.listItems || [];
		items.forEach(item => {
			if (!item.task) return;
			// task status: x=done, ' '=todo
			total++;
			if (item.task === 'x' || item.task === 'X') done++;
		});

		// 检查是否 overdue（此处简化：所有 todo 若文件较早则可能 overdue）
	});

	return {
		completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
		todayTotal: total,
		overdue,
	};
}

/* ---------- 今日任务（从 today daily note 解析） ---------- */
export async function getTodayTasks(app: App): Promise<ParsedTask[]> {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');

	// 从 Daily Notes 核心插件读取路径配置，fallback 常见格局
	const patterns = getDailyNotePatterns(app, now, pad);

	const tasks: ParsedTask[] = [];

	for (const p of patterns) {
		const file = app.vault.getAbstractFileByPath(p);
		if (!(file instanceof TFile)) continue;
		const cache = app.metadataCache.getFileCache(file);
		if (!cache?.listItems) continue;

		const rawContent = await app.vault.read(file);
		const lines = rawContent.split('\n');

		// 解析标题区域作为 tag 来源
		const sections = parseSections(lines);

		cache.listItems.filter(li => li.task).slice(0, 10).forEach(li => {
			const lineNum = li.position.start.line;
			const rawLine = lines[lineNum] || '';
			// 提取 task 文本：去掉 `- [ ] ` 或 `- [x] ` 前缀
			const title = extractTaskTitle(rawLine) || `任务 #${lineNum + 1}`;
			const status: 'done' | 'doing' | 'todo' =
				li.task === 'x' || li.task === 'X' ? 'done' : 'todo';
			tasks.push({
				title,
				status,
				tag: getSectionForLine(sections, lineNum),
				due: '今天',
			});
		});
		break;
	}

	return tasks;
}

/** 生成可能的日记路径模式 */
function getDailyNotePatterns(_app: App, now: Date, pad: (n: number) => string): string[] {
	const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	// 按优先级排列常见日记路径格局（后续可从设置中自定义）
	return [
		`日记/${dateStr}.md`,
		`Daily/${dateStr}.md`,
		`daily/${dateStr}.md`,
		`${dateStr}.md`,
	];
}

/** 提取 task 标题：去掉 `- [ ] ` 或 `- [x] ` 前缀 */
function extractTaskTitle(line: string): string | null {
	const match = line.match(/^\s*- \[[ xX]\]\s+(.+)/);
	return match?.[1]?.trim() ?? null;
}

/** 解析 Markdown 文档中的标题区域 */
function parseSections(lines: string[]): { line: number; title: string }[] {
	const sections: { line: number; title: string }[] = [];
	lines.forEach((l, i) => {
		const m = l.match(/^##\s+(.+)/);
		if (m?.[1]) sections.push({ line: i, title: m[1] });
	});
	return sections;
}

/** 根据行号找到所属的标题区域 */
function getSectionForLine(
	sections: { line: number; title: string }[],
	lineNum: number,
): string {
	for (let i = sections.length - 1; i >= 0; i--) {
		const section = sections[i];
		if (section && section.line < lineNum) return section.title;
	}
	return '无分类';
}

/* ---------- 分类分布 ---------- */
export function getCategoryDistribution(app: App): CategoryCount[] {
	const files = app.vault.getMarkdownFiles();
	const counts: Record<string, number> = {};

	files.forEach(f => {
		const topFolder = f.path.split('/')[0]!;
		counts[topFolder] = (counts[topFolder] || 0) + 1;
	});

	const entries = Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8);

	return entries.map(([name, count], i) => ({
		name,
		count,
		color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
	}));
}

/* ---------- 通用日期格式化（本地时区） ---------- */
function toLocalDateStr(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------- 笔记创建趋势（按天序列，用于折线图） ---------- */
/**
 * 返回最近 days 天（含今天）每日新建笔记数量，用于折线图展示。
 * 日期按本地时区计算，避免 UTC 偏移导致跨天错位。
 * @param days 统计天数（如 7 / 30 / 180 / 365）
 */
export function getNoteActivitySeries(app: App, days: number): SeriesPoint[] {
	const files = app.vault.getMarkdownFiles();
	const countMap: Record<string, number> = {};

	files.forEach(f => {
		const d = new Date(f.stat.ctime);
		if (isNaN(d.getTime())) return;
		const key = toLocalDateStr(d);
		countMap[key] = (countMap[key] || 0) + 1;
	});

	const result: SeriesPoint[] = [];
	// 归一化到当天 00:00:00，避免 end/start 毫秒差导致循环少算最后一天（今天）
	const end = new Date();
	end.setHours(0, 0, 0, 0);
	const start = new Date(end);
	start.setDate(start.getDate() - (days - 1));

	for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
		const key = toLocalDateStr(d);
		result.push({ date: key, count: countMap[key] || 0 });
	}

	return result;
}

/* ---------- 按日期查询笔记（日历点击使用） ---------- */
export interface NoteRef {
	path: string;
	basename: string;
	mtime: number;
	ctime: number;
}

/**
 * 查询某天创建或修改过的所有笔记。
 * 日期用本地时区避免 UTC 偏移导致跨天错位。
 * @param dateStr 形如 "YYYY-MM-DD"
 */
export function getNotesForDate(app: App, dateStr: string): NoteRef[] {
	const [y, m, d] = dateStr.split('-').map(Number);
	if (!y || !m || !d) return [];

	// 当天 00:00:00.000（本地）至次日 00:00:00.000（本地）
	const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
	const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();

	return app.vault.getMarkdownFiles()
		.filter(f => {
			const c = f.stat.ctime;
			const mTime = f.stat.mtime;
			// 创建时间或修改时间落在当天内
			return (c >= start && c < end) || (mTime >= start && mTime < end);
		})
		.map(f => ({
			path: f.path,
			basename: f.basename,
			mtime: f.stat.mtime,
			ctime: f.stat.ctime,
		}))
		.sort((a, b) => b.ctime - a.ctime); // 新创建的在前
}

/**
 * 返回某月哪些天有笔记（按本地时区）。
 * @param year  4 位年份
 * @param month 1-12
 */
export function getNoteDaysInMonth(app: App, year: number, month: number): Set<number> {
	const daysInMonth = new Date(year, month, 0).getDate(); // month 是 1-based，传 month 即下一个月第 0 天
	const start = new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
	const end = new Date(year, month - 1, daysInMonth + 1, 0, 0, 0, 0).getTime();

	const set = new Set<number>();
	app.vault.getMarkdownFiles().forEach(f => {
		const c = f.stat.ctime;
		const mTime = f.stat.mtime;
		const ts = (c >= start && c < end) ? c : ((mTime >= start && mTime < end) ? mTime : -1);
		if (ts < 0) return;
		const d = new Date(ts);
		set.add(d.getDate());
	});
	return set;
}

/* ---------- 最近更新的笔记（用于"最近更新"卡片） ---------- */
export interface RecentNote {
	path: string;   // 完整路径
	title: string;  // basename 去 .md
	folder: string; // 顶层文件夹名，顶层文件记为 '（根目录）'
	mtime: number;  // 修改时间（毫秒时间戳）
}

/**
 * 返回最近修改的若干 Markdown 笔记，用于仪表盘「最近更新」卡片。
 * @param limit 最多返回条数
 */
export function getRecentNotes(app: App, limit = 8): RecentNote[] {
	return app.vault.getMarkdownFiles()
		.map(f => {
			const parts = f.path.split('/');
			const folder = parts.length > 1 ? parts[0]! : '（根目录）';
			return { path: f.path, title: f.basename, folder, mtime: f.stat.mtime };
		})
		.sort((a, b) => b.mtime - a.mtime)
		.slice(0, limit);
}
