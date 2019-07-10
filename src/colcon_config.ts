import * as vscode from 'vscode';
import { colcon_ns, extName } from './common';

const envProperty = "env";
const globalSetupProperty = "globalSetup";
const workspaceSetupProperty = "workspaceSetup";
const workspaceDirProperty = "workspaceDir";
const refreshOnStartProperty = "refreshOnStart";
const refreshOnTasksOpenedProperty = "refreshOnTasksOpened";
const debugLogProperty = "outputLog"; // FIXME: rename var
const outputLevelProperty = "outputLevel";
const buildArgsProperty = "buildArgs";
const testArgsProperty = "testArgs";
const testResultArgsProperty = "testResultArgs";
const defaultEnvsProperty = "defaultEnvironment";
const provideTasksProperty = "provideTasks";

enum OutputLevel {
    Info = 0,
    Warning = 1,
    Error = 2,
    None = 3,
}

export class Config {
    env: string;
    globalSetup: string;
    workspaceSetup: string;
    workspaceDir: string | undefined;

    refreshOnStart: boolean;
    refreshOnTasksOpened: boolean;

    provideTasks: boolean;
    debugLog: boolean;
    outputLevel: OutputLevel;

    buildArgs: string[];
    testArgs: string[];
    testResultArgs: string[];
    defaultEnvs: { [key: string]: string };
    private channel: vscode.OutputChannel | undefined;

    constructor() {
        let conf = vscode.workspace.getConfiguration(colcon_ns);

        if (!conf)
            throw new Error("Missed colcon configuration");

        this.provideTasks = conf.get(provideTasksProperty, false);
        this.debugLog = conf.get(debugLogProperty, false);

        if (this.debugLog)
            this.channel = vscode.window.createOutputChannel(extName);

        let outputLevelStr = conf.get(outputLevelProperty, "error");

        if (this.debugLog) {
            switch (outputLevelStr) {
                case "none": this.outputLevel = OutputLevel.None; break;
                case "info": this.outputLevel = OutputLevel.Info; break;
                case "warning": this.outputLevel = OutputLevel.Warning; break;
                case "error": default: this.outputLevel = OutputLevel.Error; break;
            }
        } else {
            this.outputLevel = OutputLevel.None;
        }

        this.env = conf.get(envProperty, ".vscode/colcon.env");
        this.globalSetup = conf.get(globalSetupProperty, "");
        this.workspaceSetup = conf.get(workspaceSetupProperty, "");
        this.workspaceDir = conf.get(workspaceDirProperty);

        if (this.workspaceDir == undefined || this.workspaceDir == "") {
            if (this.debugLog) this.warn("No workspace direcory configuration provided");

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
        if (this.debugLog) this.log("Current workspace dir: " + this.workspaceDir);

        this.refreshOnStart = conf.get(refreshOnStartProperty, true);
        this.refreshOnTasksOpened = conf.get(refreshOnTasksOpenedProperty, false);

        this.buildArgs = conf.get(buildArgsProperty, []);
        this.testArgs = conf.get(testArgsProperty, []);
        this.testResultArgs = conf.get(testResultArgsProperty, []);
        this.defaultEnvs = conf.get(defaultEnvsProperty, {});
    }

    // NOTE: forceConsole will be used for extension debug purposes since console.log()
    // can correctly represent objects
    log(msg: any, forceConsole: boolean = false) {
        if (this.outputLevel > OutputLevel.Info) return;

        if (forceConsole || this.channel == undefined) {
            console.log(extName + ": " + msg);
        } else {
            this.channel.appendLine(msg);
        }
    }

    warn(msg: any, forceConsole: boolean = false) {
        if (this.outputLevel > OutputLevel.Warning) return;

        if (forceConsole || this.channel == undefined) {
            console.warn(extName + ": " + msg);
        } else {
            this.channel.appendLine("warn: " + msg);
        }
    }

    error(msg: any, forceConsole: boolean = false) {
        if (this.outputLevel > OutputLevel.Error) return;

        if (forceConsole || this.channel == undefined) {
            console.error(extName + ": " + msg);
        } else {
            this.channel.appendLine("error: " + msg);
        }
    }
}
