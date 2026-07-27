/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string -- external API JSON responses have inherently dynamic types */
/* ============================================================
   Nexusnote — 外部数据拉取层
   负责从 GitHub / Hacker News / RSS 拉取数据
   必须经用户确认后才可发起网络请求

   TODO: 当前 fetchGitHubFeed / fetchHackerNews 暂无调用方，
   待 Dashboard 媒体卡片接入真实数据后启用。
   ============================================================ */

import { requestUrl } from 'obsidian';

export interface GitHubRepo {
	name: string;
	desc: string;
	stars: number;
	url: string;
	updated: string;
}

export interface HNStory {
	title: string;
	url: string;
	score: number;
	updated: string;
}

export interface RSSItem {
	title: string;
	link: string;
	date: string;
	desc: string;
}

/* ---------- GitHub Feed ---------- */
export async function fetchGitHubFeed({ query = 'ai+agent', maxItems = 5 }: {
	query?: string;
	maxItems?: number;
} = {}): Promise<GitHubRepo[]> {
	const res = await requestUrl({
		url: `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${maxItems}`,
		headers: { 'Accept': 'application/vnd.github.v3+json' },
	});

	const data = res.json;
	return (data.items || []).slice(0, maxItems).map((repo: Record<string, unknown>) => ({
		name: String(repo.full_name || ''),
		desc: String(repo.description || '').slice(0, 80),
		stars: Number(repo.stargazers_count) || 0,
		url: String(repo.html_url || ''),
		updated: timeAgo(new Date(String(repo.updated_at || ''))),
	}));
}

/* ---------- Hacker News ---------- */
export async function fetchHackerNews({ maxItems = 5 }: {
	maxItems?: number;
} = {}): Promise<HNStory[]> {
	const idsRes = await requestUrl({
		url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
	});
	const ids: number[] = idsRes.json;
	const topIds = ids.slice(0, maxItems + 5); // extra for errors

	const stories = await Promise.all(
		topIds.map(id =>
			requestUrl({
				url: `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
			}).then(r => r.json).catch(() => null),
		),
	);

	return stories
		.filter(Boolean)
		.slice(0, maxItems)
		.map((raw) => {
			const s = raw as Record<string, unknown>;
			const id = String(s.id ?? '');
			return {
				title: String(s.title ?? ''),
				url: String(s.url ?? `https://news.ycombinator.com/item?id=${id}`),
				score: Number(s.score) || 0,
				updated: timeAgo(new Date(Number(s.time) * 1000)),
			};
		});
}

/* ---------- 时间格式化 ---------- */
export function timeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return '刚刚';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} 分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} 天前`;
	const months = Math.floor(days / 30);
	return `${months} 个月前`;
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-base-to-string -- restore lints for non-API code */
