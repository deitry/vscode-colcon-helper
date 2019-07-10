import * as vscode from 'vscode';
import { colcon_ns, extName } from './common';

const envProperty = "env";
const globalSetupProperty = "globalSetup";
const workspaceSetupProperty = "workspaceSetup";
const workspaceDirProperty = "workspaceDir";
const refreshOnStartProperty = "refreshOnStart";
const refreshOnTasksOpenedProperty = "refreshOnTasksOpened";
const debugLogProperty = "debugLog";
const buildArgsProperty = "buildArgs";
const testArgsProperty = "testArgs";
const testResultArgsProperty = "testResultArgs";
const defaultEnvsProperty = "defaultEnvironment";
const provideTasksProperty = "provideTasks";

export class Config {
    env: string;
    globalSetup: string;
    workspaceSetup: string;
    workspaceDir: string | undefined;

    refreshOnStart: boolean;
    refreshOnTasksOpened: boolean;

    provideTasks: boolean;
    debugLog: boolean;

    buildArgs: string[];
    testArgs: string[];
    testResultArgs: string[];
    defaultEnvs: { [key: string]: string };
    // channel: vscode.OutputChannel;

    constructor() {
        // this.channel = vscode.window.createOutputChannel(extName);

        let conf = vscode.workspace.getConfiguration(colcon_ns);

        if (!conf)
            throw new Error("Missed colcon configuration");

        this.provideTasks = conf.get(provideTasksProperty, false);
        this.debugLog = conf.get(debugLogProperty, false);

        this.env = conf.get(envProperty, ".vscode/colcon.env");
        this.globalSetup = conf.get(globalSetupProperty, "");
        this.workspaceSetup = conf.get(workspaceSetupProperty, "");
        this.workspaceDir = conf.get(workspaceDirProperty);
        if (this.workspaceDir == undefined || this.workspaceDir == "") {
            if (this.debugLog) console.warn("No workspace direcory configuration provided");
            // try to find out where we are - sinse I don't know yet
            // how to resolve ${workspaceFolder} substitution

            // let workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse('.vscode'))
            // if (workspaceFolder != undefined) {
            //     this.workspaceDir = workspaceFolder.uri.path;
            // } else {
                if (vscode.workspace.workspaceFolders == undefined)
                    throw new Error("Can't find workspace");

                this.workspaceDir = vscode.workspace.workspaceFolders[0].uri.path;
            // }
        }
        if (this.debugLog) console.log("Current workspace dir: " + this.workspaceDir);

        this.refreshOnStart = conf.get(refreshOnStartProperty, true);
        this.refreshOnTasksOpened = conf.get(refreshOnTasksOpenedProperty, false);

        this.buildArgs = conf.get(buildArgsProperty, []);
        this.testArgs = conf.get(testArgsProperty, []);
        this.testResultArgs = conf.get(testResultArgsProperty, []);
        this.defaultEnvs = conf.get(defaultEnvsProperty, {});
    }
}
