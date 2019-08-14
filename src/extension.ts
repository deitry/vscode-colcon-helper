import * as vscode from 'vscode';

import * as cp from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

import { Config } from './colcon_config'
import { refreshEnvironment } from "./environment"
import { getColconTasks } from './tasks';
import { extName, colcon_ns } from './common';

const refreshCmd = 'refreshEnvironment';
export let config: Config;

export function activate(context: vscode.ExtensionContext) {

	config = new Config();
	config.log(extName + " extension is about to launch");

	// Register configuration change event
	// NOTE: disabled since now we always load actual config before any execution
	// let onConfigChanged = vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
	// 	if (e.affectsConfiguration("colcon")) {
	// 		config.log(extName + " configuration changed.");

	// 		// Reload configuration
	// 		config = new Config();
	// 		if (config.refreshOnConfigurationChanged && config.provideTasks)
	// 			refreshEnvironment();

	// 		// setupExtension(context);
	// 	}
	// });

	let onRefreshCmd = vscode.commands.registerCommand(colcon_ns + "." + refreshCmd, () => {
		config = new Config();
		refreshEnvironment();
	});

	let taskProvider = vscode.tasks.registerTaskProvider('colcon', {
		provideTasks: () => {
			// reload config before making tasks since it may be affected by local folder settings
			config = new Config();
			return getColconTasks();
		},

		resolveTask(_task: vscode.Task): vscode.Task | undefined {
			return undefined;
		}
	});

	if (config.refreshOnStart && config.provideTasks) {
		config.log("Refreshing environment on start")
		refreshEnvironment();
	}

	// setupExtension(context);

	context.subscriptions.push(onRefreshCmd);
	context.subscriptions.push(taskProvider);
	// context.subscriptions.push(onConfigChanged);

	config.log(extName + " extension is activated");
}
