/* ============================================================
   Nexusnote — 本地缓存管理器
   外部数据先写入 vault 内的 JSON cache 文件，Dashboard 再读取展示
   缓存路径：{configDir}/plugins/Nexusnote/cache/
   （遵循 Obsidian 插件数据存储惯例，不污染 vault 根目录）
   ============================================================ */

import { App, TFile } from 'obsidian';

/** 获取缓存目录路径（使用 Vault#configDir 而非硬编码 `.obsidian`） */
function getCacheDir(app: App): string {
	return `${app.vault.configDir}/plugins/Nexusnote/cache`;
}

export interface CacheEntry<T> {
	updated: string; // ISO timestamp
	data: T;
}

/** 从缓存读取数据 */
export async function readCache<T>(app: App, cacheName: string): Promise<T | null> {
	const path = `${getCacheDir(app)}/${cacheName}`;
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return null;
	try {
		const raw = await app.vault.read(file);
		const entry = JSON.parse(raw) as CacheEntry<T>;
		return entry.data;
	} catch {
		return null;
	}
}

/** 写入缓存（需用户确认后才可调用） */
export async function writeCache<T>(app: App, cacheName: string, data: T): Promise<void> {
	const cacheDir = getCacheDir(app);
	const path = `${cacheDir}/${cacheName}`;
	const entry: CacheEntry<T> = {
		updated: new Date().toISOString(),
		data,
	};

	// 递归确保目录存在
	const parts = cacheDir.split('/');
	for (let i = 1; i <= parts.length; i++) {
		const sub = parts.slice(0, i).join('/');
		if (!sub) continue;
		if (!app.vault.getAbstractFileByPath(sub)) {
			await app.vault.createFolder(sub);
		}
	}

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, JSON.stringify(entry, null, 2));
	} else {
		await app.vault.create(path, JSON.stringify(entry, null, 2));
	}
}

/** 获取上次缓存时间 */
export async function getCacheUpdated(app: App, cacheName: string): Promise<string | null> {
	const path = `${getCacheDir(app)}/${cacheName}`;
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return null;
	try {
		const raw = await app.vault.read(file);
		const entry = JSON.parse(raw) as CacheEntry<unknown>;
		return entry.updated;
	} catch {
		return null;
	}
}
