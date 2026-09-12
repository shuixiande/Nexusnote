import { App, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import NexusnotePlugin from './main';

export interface NexusnoteSettings {
	/** 插件品牌名（左上角小标题） */
	brandName: string;
	/** 仪表盘主标题（如 "AiteSn的知识库仪表盘"） */
	dashboardTitle: string;
	/** 新笔记默认存放文件夹 */
	newNoteFolder: string;
	/** 新素材默认存放文件夹（对应四层架构的「1_原始资料」） */
	newMaterialFolder: string;
	/** 灵感笔记默认存放文件夹（对应四层架构的「2_创意想法」） */
	inspireFolder: string;
	/** 模板默认存放文件夹（templater 模板库） */
	templaterFolder: string;
	/** 仓库体检报告存放文件夹 */
	reportFolder: string;
	/** 启动时是否自动检查更新 */
	autoCheckUpdate: boolean;
}

export const DEFAULT_SETTINGS: NexusnoteSettings = {
	brandName: 'Nexusnote',
	dashboardTitle: 'AiteSn的知识库仪表盘',
	newNoteFolder: '2_创意想法（灵感燃料）',
	newMaterialFolder: '1_原始资料（不可变原料）',
	inspireFolder: '2_创意想法（灵感燃料）',
	templaterFolder: 'templater',
	reportFolder: 'Reports',
	autoCheckUpdate: true,
};

export class NexusnoteSettingTab extends PluginSettingTab {
	plugin: NexusnotePlugin;

	constructor(app: App, plugin: NexusnotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * 声明式设置定义（Obsidian 1.13.0+）。
	 *
	 * 1.13.0 起，只要本方法返回非空数组，Obsidian 就改用声明式渲染设置页，
	 * 并把这些条目编入全局「设置搜索」索引；低于 1.13.0 的版本不会调用本方法，
	 * 仍走下面的 display() 回退实现，因此两种版本都能正常工作。
	 *
	 * `control.key` 对应插件 settings 对象上的属性名，读写与保存（saveData）
	 * 由 Obsidian 自动完成，无需在此手动调用 saveSettings()。
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: '品牌与标题',
				items: [
					{
						name: '插件品牌名',
						desc: '显示在仪表盘左上角的小标题，可改成你自己的名字',
						control: {
							type: 'text',
							key: 'brandName',
							placeholder: 'Nexusnote',
							defaultValue: DEFAULT_SETTINGS.brandName,
						},
					},
					{
						name: '仪表盘主标题',
						desc: '显示在品牌名下方的大标题，可改成你的 solo 名、昵称等',
						control: {
							type: 'text',
							key: 'dashboardTitle',
							placeholder: 'AiteSn的知识库仪表盘',
							defaultValue: DEFAULT_SETTINGS.dashboardTitle,
						},
					},
				],
			},
			{
				type: 'group',
				heading: '默认文件夹',
				items: [
					{
						name: '新笔记文件夹',
						desc: '点击"新笔记"按钮时，笔记创建到此文件夹下',
						control: {
							type: 'text',
							key: 'newNoteFolder',
							placeholder: '笔记',
							defaultValue: DEFAULT_SETTINGS.newNoteFolder,
						},
					},
					{
						name: '新素材文件夹',
						desc: '点击"新素材"按钮时，素材创建到此文件夹下（建议对应四层架构的「1_原始资料（不可变原料）」）',
						control: {
							type: 'text',
							key: 'newMaterialFolder',
							placeholder: '1_原始资料（不可变原料）',
							defaultValue: DEFAULT_SETTINGS.newMaterialFolder,
						},
					},
					{
						name: '灵感 / 新笔记文件夹',
						desc: '点击"灵感""新笔记"按钮时，笔记创建到此文件夹下（建议对应「2_创意想法（灵感燃料）」）',
						control: {
							type: 'text',
							key: 'inspireFolder',
							placeholder: '2_创意想法（灵感燃料）',
							defaultValue: DEFAULT_SETTINGS.inspireFolder,
						},
					},
					{
						name: '模板文件夹',
						desc: '一键部署生成的模板存放到此文件夹（建议保持 templater），"根据模板新建"会读取这里的模板',
						control: {
							type: 'text',
							key: 'templaterFolder',
							placeholder: 'templater',
							defaultValue: DEFAULT_SETTINGS.templaterFolder,
						},
					},
					{
						name: '报告文件夹',
						desc: '仓库体检报告等生成内容存放文件夹',
						control: {
							type: 'text',
							key: 'reportFolder',
							placeholder: 'Reports',
							defaultValue: DEFAULT_SETTINGS.reportFolder,
						},
					},
				],
			},
			{
				type: 'group',
				heading: '更新',
				items: [
					{
						name: '自动检查更新',
						desc: 'Obsidian 启动时自动比对 GitHub 最新 Release，发现新版本弹窗提示（不会静默替换文件）',
						control: {
							type: 'toggle',
							key: 'autoCheckUpdate',
							defaultValue: DEFAULT_SETTINGS.autoCheckUpdate,
						},
					},
				],
			},
		];
	}

	/**
	 * 命令式设置页（Obsidian 1.12.x 及以下的回退实现）。
	 * 1.13.0+ 上，只要 getSettingDefinitions() 返回非空数组，本方法即不被调用；
	 * 为支持 minAppVersion=1.8.0，此处保留。
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('品牌与标题').setHeading();

		new Setting(containerEl)
			.setName('插件品牌名')
			.setDesc('显示在仪表盘左上角的小标题，可改成你自己的名字')
			.addText((text) =>
				text
					.setPlaceholder('Nexusnote')
					.setValue(this.plugin.settings.brandName)
					.onChange(async (value) => {
						this.plugin.settings.brandName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('仪表盘主标题')
			.setDesc('显示在品牌名下方的大标题，可改成你的 solo 名、昵称等')
			.addText((text) =>
				text
					.setPlaceholder('AiteSn的知识库仪表盘')
					.setValue(this.plugin.settings.dashboardTitle)
					.onChange(async (value) => {
						this.plugin.settings.dashboardTitle = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('默认文件夹').setHeading();

		new Setting(containerEl)
			.setName('新笔记文件夹')
			.setDesc('点击"新笔记"按钮时，笔记创建到此文件夹下')
			.addText((text) =>
				text
					.setPlaceholder('笔记')
					.setValue(this.plugin.settings.newNoteFolder)
					.onChange(async (value) => {
						this.plugin.settings.newNoteFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('新素材文件夹')
			.setDesc('点击"新素材"按钮时，素材创建到此文件夹下（建议对应四层架构的「1_原始资料（不可变原料）」）')
			.addText((text) =>
				text
					.setPlaceholder('1_原始资料（不可变原料）')
					.setValue(this.plugin.settings.newMaterialFolder)
					.onChange(async (value) => {
						this.plugin.settings.newMaterialFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('灵感 / 新笔记文件夹')
			.setDesc('点击"灵感""新笔记"按钮时，笔记创建到此文件夹下（建议对应「2_创意想法（灵感燃料）」）')
			.addText((text) =>
				text
					.setPlaceholder('2_创意想法（灵感燃料）')
					.setValue(this.plugin.settings.inspireFolder)
					.onChange(async (value) => {
						this.plugin.settings.inspireFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('模板文件夹')
			.setDesc('一键部署生成的模板存放到此文件夹（建议保持 templater），"根据模板新建"会读取这里的模板')
			.addText((text) =>
				text
					.setPlaceholder('templater')
					.setValue(this.plugin.settings.templaterFolder)
					.onChange(async (value) => {
						this.plugin.settings.templaterFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('报告文件夹')
			.setDesc('仓库体检报告等生成内容存放文件夹')
			.addText((text) =>
				text
					.setPlaceholder('Reports')
					.setValue(this.plugin.settings.reportFolder)
					.onChange(async (value) => {
						this.plugin.settings.reportFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('更新').setHeading();

		new Setting(containerEl)
			.setName('自动检查更新')
			.setDesc('Obsidian 启动时自动比对 GitHub 最新 Release，发现新版本弹窗提示（不会静默替换文件）')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.autoCheckUpdate)
					.onChange(async (v) => {
						this.plugin.settings.autoCheckUpdate = v;
						await this.plugin.saveSettings();
					}),
			);
	}
}
