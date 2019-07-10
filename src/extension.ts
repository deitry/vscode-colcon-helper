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
let taskProvider: vscode.Disposable | undefined = undefined;

function setupExtension(context: vscode.ExtensionContext) {
	// delete old
	if (taskProvider != undefined)
		taskProvider.dispose();

	if (!config.provideTasks) {
		config.log(extName + " extension will not search for colcon tasks due to provideTask configuration");
	} else {

		taskProvider = vscode.tasks.registerTaskProvider('colcon', {
			provideTasks: () => {
				return getColconTasks();
			},

			resolveTask(_task: vscode.Task): vscode.Task | undefined {
				return undefined;
			}
		});

		context.subscriptions.push(taskProvider);
	}
}

export function activate(context: vscode.ExtensionContext) {

	config = new Config();
	config.log(extName + " extension is about to launch");

	// Register configuration change event
	let onConfigChanged = vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
		if (e.affectsConfiguration("colcon")) {
			config.log(extName + " configuration changed.");

			// Reload configuration
			config = new Config();
			if (config.refreshOnConfigurationChanged && config.provideTasks)
				refreshEnvironment();

			setupExtension(context);
		}
	});

	let onRefreshCmd = vscode.commands.registerCommand(colcon_ns + "." + refreshCmd, () => {
		refreshEnvironment();
	});

	if (config.refreshOnStart && config.provideTasks) {
		config.log("Refreshing environment on start")
		refreshEnvironment();
	}

	setupExtension(context);

	context.subscriptions.push(onRefreshCmd);
	context.subscriptions.push(onConfigChanged);

	config.log(extName + " extension is activated");
}
