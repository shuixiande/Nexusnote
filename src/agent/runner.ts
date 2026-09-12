/* ============================================================
   Nexusnote — Agent 任务运行器
   通过子进程调用本地 CLI 工具
   （Claude Code / Codex CLI / 自定义脚本等）
   必须经用户确认后才可执行

   ⚠️ 依赖 Node.js 子进程能力，移动端不可用。
   已在 manifest.json 设置 isDesktopOnly: true。
   为降低对外部类型定义（@types/node）的依赖，本文件对所用到的
   Node 接口做了最小、显式的本地类型声明。
   ============================================================ */

import { spawn } from 'child_process';

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

/* ---- 本地最小类型：仅覆盖本文件用到的 Node 子进程接口 ----
   这样即使类型环境中缺少 @types/node，也不会退化为 any。 */

/** 子进程可读流：只用到 data 事件 */
interface NodeReadableLike {
	on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
}

/** 子进程对象：只用到 stdout / stderr 与 close / error 事件 */
interface NodeChildLike {
	stdout: NodeReadableLike | null;
	stderr: NodeReadableLike | null;
	on(event: 'close', listener: (code: number | null) => void): unknown;
	on(event: 'error', listener: (err: Error) => void): unknown;
}

interface NodeSpawnOptionsLike {
	cwd?: string;
	shell?: boolean;
}

type NodeSpawnLike = (
	command: string,
	args: string[],
	options: NodeSpawnOptionsLike,
) => NodeChildLike;

// 桌面端调用本地 CLI。显式断言为本地最小接口，使其不依赖 @types/node 的类型解析。
const spawnProcess = spawn as unknown as NodeSpawnLike;

/**
 * 执行一个 Agent 任务，通过回调返回实时输出。
 * 只应在用户明确确认后调用。
 *
 * @param cwd 子进程工作目录（通常传入 vault 根目录）
 */
export function runAgentTask(
	task: AgentTask,
	cwd: string,
	callbacks: {
		onOutput: (line: string) => void;
		onComplete: (result: TaskResult) => void;
		onError: (err: Error) => void;
	},
): void {
	const child = spawnProcess(task.command, task.args, {
		cwd,
		shell: true,
	});

	const output: string[] = [];
	const decoder = new TextDecoder();

	const handleChunk = (chunk: Uint8Array): void => {
		const text = decoder.decode(chunk, { stream: true });
		output.push(text);
		callbacks.onOutput(text);
	};

	child.stdout?.on('data', handleChunk);
	child.stderr?.on('data', handleChunk);

	child.on('close', (code: number | null) => {
		callbacks.onComplete({
			id: task.id,
			success: code === 0,
			output: output.join(''),
			outputFile: task.outputPath,
		});
	});

	child.on('error', (err: Error) => {
		callbacks.onError(err);
	});
}

/**
 * 获取所有可用任务的列表（用于 UI 展示）
 */
export function getAvailableTasks(): AgentTask[] {
	return Object.values(PREDEFINED_TASKS);
}
