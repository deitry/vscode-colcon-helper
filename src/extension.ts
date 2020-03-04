import * as vscode from 'vscode';

import { Config } from './colcon_config'
import { refreshEnvironment } from "./environment"
import { getBuildTaskForPackage } from './tasks';
import { extName, colcon_ns, ros2launch } from './common';
import { PackageInfo, getAllPackages } from './packages';
import { createColconTaskProvider } from './colcon_task_provider';
import { createRos2LaunchTaskProvider } from './ros2launch_task_provider';

const enableCmdName = 'enableTasks';
const disableCmdName = 'disableTasks';
const refreshCmdName = 'refreshEnvironment';
const refreshPackageList = 'refreshPackageList';
const buildCurrentPkgCmdName = 'buildCurrentPackage';
const buildSinglePkgCmdName = 'buildSinglePackage';
const buildPkgsUpToCmdName = 'buildPackagesUpTo';
const buildPkgCmdName = 'buildSelectedPackages';

export let packages: { [id: string]: PackageInfo[]; } = {};
export let config: Config;

export function updatePackageList(folder: vscode.WorkspaceFolder | undefined = undefined): boolean {

	let cwd = folder ? folder : config.currentWsFolder;
	let provideTasks = vscode.workspace.getConfiguration("colcon", cwd.uri).inspect("provideTasks");

	if (!provideTasks || !('workspaceFolderValue' in provideTasks) || !provideTasks.workspaceFolderValue) {
		config.log('Will not search for packages due to colcon.provideTasks false setting for workspace folder');
		return false;
	}

	config.log('Refresh package list...' + (cwd.name));
	packages[cwd.name] = getAllPackages(cwd);
	config.log('Package list refreshing done');
	// vscode.window.showInformationMessage(extName + ": List of Packages was Updated");
	return true;
}

function getCurrentWsFolder(): vscode.WorkspaceFolder | undefined {
	if (vscode.window.activeTextEditor) {
		return vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
	}
	return undefined;
}

async function getWorkspaceFolder(forceAsk: boolean = false): Promise<vscode.WorkspaceFolder | undefined> {
	let folder = await getWorkspaceFolderImpl(forceAsk);
	// update packages list for this folder
	if (folder && !(folder.name in packages)) {
		updatePackageList(folder);
	}
	return folder;
}

async function getWorkspaceFolderImpl(forceAsk: boolean = false): Promise<vscode.WorkspaceFolder | undefined> {
	let folderList = vscode.workspace.workspaceFolders;
	if (folderList) {
		if (folderList.length == 1) {
			let folder = folderList[0];
			return folder;
		}
	}

	let currentWsFolder: vscode.WorkspaceFolder | undefined;
	if (!forceAsk) {
		currentWsFolder = getCurrentWsFolder();
		if (currentWsFolder) return currentWsFolder;
	}

	currentWsFolder = await vscode.window.showWorkspaceFolderPick();
	return currentWsFolder;
}

export function actualizeConfig(folder: vscode.WorkspaceFolder | undefined = undefined) {

	config = new Config(folder);
}

export function activate(context: vscode.ExtensionContext) {

	if (vscode.workspace.workspaceFolders == undefined) {
		// Assume that it is not error if there is no workspace at all.
		if (config) config.warn("Can't find workspace");
		return;
	}

	config = new Config();
	config.log(extName + " extension is about to launch");

	let onChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor | undefined) => {
		if (e) {
			let wsFolder = vscode.workspace.getWorkspaceFolder(e.document.uri);
			if (wsFolder && !(wsFolder.name in packages)) {
				updatePackageList(wsFolder);
			}
		}
	});

	let onEnableCmd = vscode.commands.registerCommand(`${colcon_ns}.${enableCmdName}`,
		async () => {
			let folder = await getWorkspaceFolder(false);
			if (!folder) {
				config.error('No workspace folder provided!');
				return;
			}
			actualizeConfig(folder);
			config.enableTasks();
		});

	let onDisableCmd = vscode.commands.registerCommand(`${colcon_ns}.${disableCmdName}`,
		async () => {
			let folder = await getWorkspaceFolder(false);
			if (!folder) {
				config.error('No workspace folder provided!');
				return;
			}
			actualizeConfig(folder);
			config.disableTasks();
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
		let folder = await getWorkspaceFolder(false);
		if (!folder) {
			config.error('No workspace folder provided!');
			return;
		}
		actualizeConfig(folder);
		if (updatePackageList()) vscode.window.showInformationMessage(extName + ": List of Packages was Updated");
	});

	let buildCurrentCmd = vscode.commands.registerCommand(colcon_ns + "." + buildCurrentPkgCmdName, async () => {
		let folder = getCurrentWsFolder();
		if (!folder) {
			config.error('No active workspaceFolder! Cannot build.');
			return;
		}

		actualizeConfig(folder);
		let pkgList = packages[folder.name];

		if (!pkgList || pkgList.length == 0) {
			config.error('Did not find packages for current workspace folder');
			return;
		}

		pkgList.forEach(pkg => {
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
		let folder = await getWorkspaceFolder(true);
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
		let folder = await getWorkspaceFolder(true);
		actualizeConfig(folder);

		if (folder) {
			if (!packages[folder.name]) updatePackageList(folder)

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

	let buildPackagesUpToCmd = vscode.commands.registerCommand(colcon_ns + "." + buildPkgsUpToCmdName, async () => {
		let folder = await getWorkspaceFolder(true);
		actualizeConfig(folder);

		if (folder) {
			if (!packages[folder.name]) updatePackageList(folder)

			vscode.window.showQuickPick(packages[folder.name])
				.then((selectedPackage) => {

					if (selectedPackage) {
						let buildTask = getBuildTaskForPackagesUpTo(selectedPackage.name);
						if (buildTask) {
							vscode.tasks.executeTask(buildTask);
						}
					}
				});
		}
	});

	context.subscriptions.push(onEnableCmd);
	context.subscriptions.push(onDisableCmd);
	context.subscriptions.push(onRefreshCmd);
	context.subscriptions.push(onRefreshListCmd);
	context.subscriptions.push(buildCurrentCmd);
	context.subscriptions.push(buildPackageCmd);
	context.subscriptions.push(buildSinglePackageCmd);
	context.subscriptions.push(buildPackagesUpToCmd);
	context.subscriptions.push(onChangeActiveTextEditor);

	context.subscriptions.push(vscode.tasks.registerTaskProvider(colcon_ns, createColconTaskProvider()));
	context.subscriptions.push(vscode.tasks.registerTaskProvider(ros2launch, createRos2LaunchTaskProvider()));
	// context.subscriptions.push(onConfigChanged);

	if (config.refreshOnStart && config.provideTasks) {
		config.log("Refreshing environment on start")
		refreshEnvironment();
	}
	config.log(extName + " extension is activated");
}

export function deactivate() { }
