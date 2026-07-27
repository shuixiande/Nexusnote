/* ============================================================
   Nexusnote — Agent 任务运行器
   通过 child_process.spawn 调用本地 CLI 工具
   （Claude Code / Codex CLI / 自定义脚本等）
   必须经用户确认后才可执行

   ⚠️ 使用 Node.js API（child_process / path），移动端不可用。
   已在 manifest.json 设置 isDesktopOnly: true。
   若未来需要支持移动端，需改为 Obsidian 公开 API 或条件加载。
   ============================================================ */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

export interface AgentTask {
	id: string;
	label: string;
	command: string;
	args: string[];
	/** 任务产生的输出文件路径（相对于 vault 根目录） */
	outputPath?: string;
}

export interface TaskResult {
	id: string;
	success: boolean;
	output: string;
	error?: string;
	outputFile?: string;
}

/** 预定义的任务配置（不绑定具体用例，只做结构示例） */
export const PREDEFINED_TASKS: Record<string, AgentTask> = {
	'deep-research': {
		id: 'deep-research',
		label: '深度调研',
		command: 'claude',
		args: [
			'-p',
			'使用 research skill，研究并输出 Markdown 报告',
			'--output', '',
		],
		outputPath: 'Reports/deep-research.md',
	},
	'vault-lint': {
		id: 'vault-lint',
		label: '仓库体检',
		command: 'node',
		args: ['scripts/vault-lint.mjs'],
		outputPath: 'Reports/vault-lint-report.md',
	},
	'summarize-inbox': {
		id: 'summarize-inbox',
		label: '素材总结',
		command: 'claude',
		args: [
			'-p',
			'阅读素材仓库中的新文件，提取关键信息，更新知识库',
		],
	},
};

/**
 * 执行一个 Agent 任务，通过回调返回实时输出。
 * 只应在用户明确确认后调用。
 */
export function runAgentTask(
	task: AgentTask,
	callbacks: {
		onOutput: (line: string) => void;
		onComplete: (result: TaskResult) => void;
		onError: (err: Error) => void;
	},
): ChildProcess {
	const child = spawn(task.command, task.args, {
		cwd: path.resolve('.'), // vault root
		shell: true,
		env: { ...process.env },
	});

	const output: string[] = [];

	child.stdout?.on('data', (chunk: Buffer) => {
		const text = chunk.toString();
		output.push(text);
		callbacks.onOutput(text);
	});

	child.stderr?.on('data', (chunk: Buffer) => {
		const text = chunk.toString();
		output.push(text);
		callbacks.onOutput(text);
	});

	child.on('close', (code) => {
		callbacks.onComplete({
			id: task.id,
			success: code === 0,
			output: output.join(''),
			outputFile: task.outputPath,
		});
	});

	child.on('error', (err) => {
		callbacks.onError(err);
	});

	return child;
}

/**
 * 获取所有可用任务的列表（用于 UI 展示）
 */
export function getAvailableTasks(): AgentTask[] {
	return Object.values(PREDEFINED_TASKS);
}
