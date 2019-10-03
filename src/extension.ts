import * as vscode from 'vscode';

import { Config } from './colcon_config'
import { refreshEnvironment } from "./environment"
import { getColconTasks, getBuildTaskForPackage } from './tasks';
import { extName, colcon_ns } from './common';
import { PackageInfo, getAllPackages } from './packages';

const refreshCmdName = 'refreshEnvironment';
const refreshPackageList = 'refreshPackageList';
const buildCurrentPkgCmdName = 'buildCurrentPackage';
const buildSinglePkgCmdName = 'buildSinglePackage';
const buildPkgCmdName = 'buildSelectedPackages';

export let packages: { [id: string] : PackageInfo[]; } = {};
export let config: Config;

export function updatePackageList(folder: vscode.WorkspaceFolder | undefined = undefined) {

	config.log('Refresh package list...' + (folder ? folder.name : ''));
	let cwd = folder ? folder : config.currentWsFolder;
	packages[cwd.name] = getAllPackages(cwd);
	config.log('Package list refreshing done');
	// vscode.window.showInformationMessage(extName + ": List of Packages was Updated");
}

function getCurrentWsFolder(): vscode.WorkspaceFolder | undefined {
	if (vscode.window.activeTextEditor) {
		return vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
	}
	return undefined;
}

async function getWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
	let currentWsFolder = getCurrentWsFolder();
	if (currentWsFolder) return currentWsFolder;

	currentWsFolder = await vscode.window.showWorkspaceFolderPick();
	if (currentWsFolder && !(currentWsFolder.name in packages))
	{
		updatePackageList(currentWsFolder);
	}
	return currentWsFolder;
}

export function actualizeConfig(folder: vscode.WorkspaceFolder | undefined = undefined) {

	config = new Config(folder);
}

export function activate(context: vscode.ExtensionContext) {

	config = new Config();
	config.log(extName + " extension is about to launch");

	let onChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor | undefined) => {
		if (e) {
			let wsFolder = vscode.workspace.getWorkspaceFolder(e.document.uri);
			if (wsFolder && !(wsFolder.name in packages))
			{
				updatePackageList(wsFolder);
			}
		}
	});

	let onRefreshCmd = vscode.commands.registerCommand(colcon_ns + "." + refreshCmdName, async () => {
		let folder = await getWorkspaceFolder();
		if (!folder) {
			config.error('No workspace folder provided!');
			return;
		}
		actualizeConfig(folder);
		refreshEnvironment();
	});

	let onRefreshListCmd = vscode.commands.registerCommand(colcon_ns + "." + refreshPackageList, async () => {
		let folder = await getWorkspaceFolder();
		if (!folder) {
			config.error('No workspace folder provided!');
			return;
		}
		actualizeConfig(folder);
		updatePackageList();
		vscode.window.showInformationMessage(extName + ": List of Packages was Updated");
	});

	let buildCurrentCmd = vscode.commands.registerCommand(colcon_ns + "." + buildCurrentPkgCmdName, async () => {
		let folder = getCurrentWsFolder();
		if (!folder) {
			config.error('No active workspaceFolder! Cannot build.');
			return;
		}

		actualizeConfig(folder);

		packages[folder.name].forEach(pkg => {
			if (vscode.window.activeTextEditor
				&& pkg.path != ''
				&& vscode.window.activeTextEditor.document.uri.path.startsWith(pkg.path)) {

				config.log('Going to build pkg ' + pkg.name)
				let buildTask = getBuildTaskForPackage(pkg.name);
				if (buildTask) vscode.tasks.executeTask(buildTask);
			}
		});
	});

	let buildPackageCmd = vscode.commands.registerCommand(colcon_ns + "." + buildPkgCmdName, async () => {
		let folder = await getWorkspaceFolder();
		actualizeConfig(folder);
		if (folder) {
			vscode.window.showQuickPick(packages[folder.name], { canPickMany: true })
				.then((selectedPackages) => {
					if (selectedPackages && selectedPackages.length > 0) {
						let buildTask = getBuildTaskForPackage(selectedPackages.map(pkg => pkg.name));
						if (buildTask) vscode.tasks.executeTask(buildTask);
					}
				});
		}
	});

	let buildSinglePackageCmd = vscode.commands.registerCommand(colcon_ns + "." + buildSinglePkgCmdName, async () => {
		let folder = await getWorkspaceFolder();
		actualizeConfig(folder);

		if (folder) {
			vscode.window.showQuickPick(packages[folder.name])
				.then((selectedPackage) => {

					if (selectedPackage) {
						let buildTask = getBuildTaskForPackage(selectedPackage.name);
						if (buildTask) {
							vscode.tasks.executeTask(buildTask);
						}
					}
				});
		}
	});

	let taskProvider = vscode.tasks.registerTaskProvider('colcon', {
		provideTasks: () => {
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
	context.subscriptions.push(onChangeActiveTextEditor);

	context.subscriptions.push(taskProvider);
	// context.subscriptions.push(onConfigChanged);

	config.log(extName + " extension is activated");
}
