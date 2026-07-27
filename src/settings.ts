import { App, PluginSettingTab, Setting } from 'obsidian';
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
}

export const DEFAULT_SETTINGS: NexusnoteSettings = {
	brandName: 'Nexusnote',
	dashboardTitle: 'AiteSn的知识库仪表盘',
	newNoteFolder: '2_创意想法（灵感燃料）',
	newMaterialFolder: '1_原始资料（不可变原料）',
	inspireFolder: '2_创意想法（灵感燃料）',
	templaterFolder: 'templater',
	reportFolder: 'Reports',
};

export class NexusnoteSettingTab extends PluginSettingTab {
	plugin: NexusnotePlugin;

	constructor(app: App, plugin: NexusnotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

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
	}
}
