import * as vscode from 'vscode';

import { Config } from './colcon_config'
import { refreshEnvironment } from "./environment"
import { getColconTasks, getBuildTaskForPackage} from './tasks';
import { extName, colcon_ns } from './common';
import { PackageInfo, getAllPackages } from './packages';

const refreshCmdName = 'refreshEnvironment';
const refreshPackageList = 'refreshPackageList';
const buildCurrentPkgCmdName = 'buildCurrentPackage';
const buildSinglePkgCmdName = 'buildSinglePackage';
const buildPkgCmdName = 'buildSelectedPackages';

// FIXME: save package list for each workspace folder separately
export let packages: PackageInfo[] = [];
export let config: Config;

export function updatePackageList() {

	config.log('Refresh package list...');
	packages = getAllPackages();
	config.log('Package list refreshing done');
	vscode.window.showInformationMessage(extName + ": List of Packages was Updated");
}

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

	let onRefreshCmd = vscode.commands.registerCommand(colcon_ns + "." + refreshCmdName, () => {

		config = new Config();

		// FIXME: quick pick for workspaceFolder if none
		refreshEnvironment();
	});

	let onRefreshListCmd = vscode.commands.registerCommand(colcon_ns + "." + refreshPackageList, () => {
		config = new Config();
		updatePackageList();
	});

	let buildCurrentCmd = vscode.commands.registerCommand(colcon_ns + "." + buildCurrentPkgCmdName, () => {
		config = new Config();

		packages.forEach(pkg => {
			if (vscode.window.activeTextEditor
				&& pkg.path != ''
				&& vscode.window.activeTextEditor.document.uri.path.startsWith(pkg.path)) {

					config.log('Going to build pkg ' + pkg.name)
					let buildTask = getBuildTaskForPackage(pkg.name);
					if (buildTask) vscode.tasks.executeTask(buildTask);
				}
			});
	});

	let buildPackageCmd = vscode.commands.registerCommand(colcon_ns + "." + buildPkgCmdName, () => {
		config = new Config();

		// FIXME: quick pick for workspaceFolder if none
		let input = vscode.window.createQuickPick<PackageInfo>();
		vscode.window.showQuickPick(packages, {canPickMany: true})
			.then((selectedPackages) => {
				if (selectedPackages && selectedPackages.length > 0) {
					let buildTask = getBuildTaskForPackage(selectedPackages.map(pkg => pkg.name));
					if (buildTask) vscode.tasks.executeTask(buildTask);
				}
			});
	});

	let buildSinglePackageCmd = vscode.commands.registerCommand(colcon_ns + "." + buildSinglePkgCmdName, () => {
		config = new Config();

		// FIXME: quick pick for workspaceFolder if none
		let input = vscode.window.createQuickPick<PackageInfo>();
		vscode.window.showQuickPick(packages)
			.then((selectedPackage) => {
				if (selectedPackage) {
					let buildTask = getBuildTaskForPackage(selectedPackage.name);
					if (buildTask) vscode.tasks.executeTask(buildTask);
				}
			});
	});

	let taskProvider = vscode.tasks.registerTaskProvider('colcon', {
		provideTasks: () => {
			// reload config before making tasks since it may be affected by local folder settings

			let taskList: vscode.Task[] = [];
			let makeTasksForFolder = (wsFolder: vscode.WorkspaceFolder) => {
				config = new Config(wsFolder);
				taskList = taskList.concat(getColconTasks(wsFolder));
			}

			let active = vscode.window.activeTextEditor;
			let activeWsFolder: vscode.WorkspaceFolder | undefined = undefined;
			if (active) {
				activeWsFolder = vscode.workspace.getWorkspaceFolder(active.document.uri);
			}

			if (activeWsFolder) {
				makeTasksForFolder(activeWsFolder);
			} else if (vscode.workspace.workspaceFolders) {
				vscode.workspace.workspaceFolders.forEach(makeTasksForFolder);
			}

			return taskList;
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
	context.subscriptions.push(onRefreshListCmd);
	context.subscriptions.push(buildCurrentCmd);
	context.subscriptions.push(buildPackageCmd);
	context.subscriptions.push(buildSinglePackageCmd);

	context.subscriptions.push(taskProvider);
	// context.subscriptions.push(onConfigChanged);

	config.log(extName + " extension is activated");
}
