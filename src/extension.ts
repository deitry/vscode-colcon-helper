import * as vscode from 'vscode';

import * as cp from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

import { Config } from './colcon_config'
import { refreshEnvironment } from "./environment"
import { getColconTasks } from './tasks';
import { extName, colcon_ns } from './common';

const refreshCmd = 'refreshEnvironment';
let config: Config;

export function activate(context: vscode.ExtensionContext) {

	config = new Config();

	if (!config.provideTasks) {
		console.log(extName + " extension will not search for colcon tasks due to provideTask configuration");
		return;
	}

	// FIXME: add extension name to all console.log() calls
	if (config.debugLog) console.log(extName + " extension is about to launch");

	// FIXME: track addition or deletion of new colcon packages

	if (config.refreshOnStart) {
		if (config.debugLog) console.log("Refreshing environment on start")

		refreshEnvironment(config);
	}

	const taskProvider = vscode.tasks.registerTaskProvider('colcon', {
		provideTasks: () => {
			return getColconTasks(config);
		},

		resolveTask(_task: vscode.Task): vscode.Task | undefined {
			return undefined;
		}
	});

	let refreshCmdDisposable = vscode.commands.registerCommand(colcon_ns + "." + refreshCmd, () => {
		refreshEnvironment(config);
	});

	context.subscriptions.push(taskProvider);
	context.subscriptions.push(refreshCmdDisposable);

	if (config.debugLog) console.log(extName + " extension is activated");
}
