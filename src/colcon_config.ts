import * as vscode from 'vscode';
import { colcon_ns, extName } from './common';

const envProperty = "env";
const globalSetupProperty = "globalSetup";
const workspaceSetupProperty = "workspaceSetup";
const workspaceDirProperty = "workspaceDir";
const provideTasksProperty = "provideTasks";
const refreshOnStartProperty = "refreshOnStart";
const refreshOnTasksOpenedProperty = "refreshOnTasksOpened";
const refreshOnConfigurationChangedProperty = "refreshOnConfigurationChanged";
const debugLogProperty = "outputLog"; // FIXME: rename var
const outputLevelProperty = "outputLevel";
const buildArgsProperty = "buildArgs";
const testArgsProperty = "testArgs";
const testResultArgsProperty = "testResultArgs";
const cleanCommandProperty = "cleanCommand";
const cleanArgsProperty = "cleanArgs";
const runCommandProperty = "runCommand";
const runArgsProperty = "runArgs";
const runFileProperty = "runFile";
const defaultEnvsProperty = "defaultEnvironment";

enum OutputLevel {
    Info = 0,
    Warning = 1,
    Error = 2,
    None = 3,
}

// in order to keep the same channel if config will be overwritten
let outputChannel: vscode.OutputChannel | undefined = undefined;

export class Config {
    env: string;
    globalSetup: string;
    workspaceSetup: string;
    workspaceDir: string | undefined;

    refreshOnStart: boolean;
    refreshOnTasksOpened: boolean;
	refreshOnConfigurationChanged: boolean;

    provideTasks: boolean;
    debugLog: boolean;
    outputLevel: OutputLevel;

    buildArgs: string[];
    testArgs: string[];
    testResultArgs: string[];
    defaultEnvs: { [key: string]: string };
    cleanCommand: string;
    cleanArgs: string[];
    runCommand: string;
    runArgs: string[];
    runFile: string;

    constructor() {
        let conf = vscode.workspace.getConfiguration(colcon_ns);

        let updateIfNotExist = function(property: string, value: any) {
            // TODO: ask if user wants to create this settings
            let propertyConf = conf.inspect(property);
            if (propertyConf != undefined
                && propertyConf.globalValue == undefined
                && propertyConf.workspaceValue == undefined
                && propertyConf.workspaceFolderValue == undefined) {
                    conf.update(property, value, vscode.ConfigurationTarget.Workspace);
            }
        };

        if (!conf)
            throw new Error("Missed colcon configuration");

        this.provideTasks = conf.get(provideTasksProperty, false);
        this.debugLog = conf.get(debugLogProperty, false);

        if (this.debugLog && outputChannel == undefined)
            outputChannel = vscode.window.createOutputChannel(extName);

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
            this.warn("No workspace directory configuration provided");

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
        this.log("Current workspace dir: " + this.workspaceDir);

        if (this.provideTasks) {
            updateIfNotExist(globalSetupProperty, this.globalSetup);
            updateIfNotExist(workspaceSetupProperty, this.workspaceSetup);
        }

        this.refreshOnStart = conf.get(refreshOnStartProperty, true);
        this.refreshOnTasksOpened = conf.get(refreshOnTasksOpenedProperty, false);
        this.refreshOnConfigurationChanged = conf.get(refreshOnConfigurationChangedProperty, false);

        this.buildArgs = conf.get(buildArgsProperty, []);
        this.testArgs = conf.get(testArgsProperty, []);
        this.testResultArgs = conf.get(testResultArgsProperty, []);
        this.cleanCommand = conf.get(cleanCommandProperty, "");
        this.cleanArgs = conf.get(cleanArgsProperty, []);
        this.cleanCommand = conf.get(cleanCommandProperty, "");
        this.cleanArgs = conf.get(cleanArgsProperty, []);
        this.runCommand = conf.get(runCommandProperty, "");
        this.runArgs = conf.get(runArgsProperty, []);
        this.runFile = conf.get(runFileProperty, "");
        if (this.provideTasks) {
            updateIfNotExist(runFileProperty, this.runFile);
        }
        this.defaultEnvs = conf.get(defaultEnvsProperty, {});
    }

    // NOTE: forceConsole will be used for extension debug purposes since console.log()
    // can correctly represent objects
    log(msg: any, forceConsole: boolean = false) {
        if (this.outputLevel > OutputLevel.Info) return;

        if (forceConsole || outputChannel == undefined) {
            console.log(extName + ": " + msg);
        } else {
            outputChannel.appendLine(msg);
        }
    }

    warn(msg: any, forceConsole: boolean = false) {
        if (this.outputLevel > OutputLevel.Warning) return;

        if (forceConsole || outputChannel == undefined) {
            console.warn(extName + ": " + msg);
        } else {
            outputChannel.appendLine("warn: " + msg);
        }
    }

    error(msg: any, forceConsole: boolean = false) {
        if (this.outputLevel > OutputLevel.Error) return;

        if (forceConsole || outputChannel == undefined) {
            console.error(extName + ": " + msg);
        } else {
            outputChannel.appendLine("error: " + msg);
        }
    }
}
