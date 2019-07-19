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
    workspaceDir: string;

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

        let updateIfNotExist = function (property: string, value: any) {
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

        this.workspaceDir = conf.get(workspaceDirProperty, "${workspaceFolder}");

        if (this.workspaceDir == "") {
            this.log("No workspace directory configuration provided. Trying to deduce.");
        }

        if (!this.workspaceDir.startsWith("/")) {
            if (vscode.workspace.workspaceFolders == undefined) {
                let msg = "Can't find workspace";
                this.error(msg);
                // should I throw error or try to softely disable extension?
                // Since this is important setting we want it to be correctly set up
                // TODO: handle in catch?
                throw new Error(msg);
            }

            let mainWorkspaceDir = vscode.workspace.workspaceFolders[0].uri.path;
            this.workspaceDir = this.resolvePath(this.workspaceDir, mainWorkspaceDir);
        }

        this.log("Current workspace dir: " + this.workspaceDir);

        this.globalSetup = conf.get(globalSetupProperty, "");
        this.workspaceSetup = conf.get(workspaceSetupProperty, "");

        if (this.provideTasks) {
            updateIfNotExist(globalSetupProperty, this.globalSetup);
            // store workspaceSetup setting before we resolve it to absolute path
            updateIfNotExist(workspaceSetupProperty, this.workspaceSetup);
        }

        // make absolute paths right away with resolvePath()
        this.workspaceSetup = this.resolvePath(this.workspaceSetup);
        this.env = this.resolvePath(conf.get(envProperty, ".vscode/colcon.env"));

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
        vscode.window.showErrorMessage(extName + ": " + msg);
        if (this.outputLevel > OutputLevel.Error) return;

        if (forceConsole || outputChannel == undefined) {
            console.error(extName + ": " + msg);
        } else {
            outputChannel.appendLine("error: " + msg);
        }
    }

    resolvePath(fileName: string, cwd: string = this.workspaceDir) {
        let result = fileName;

        // replace common VS Code substitution variable
        if (cwd != "") {
            result = result.replace("${workspaceFolder}", cwd);
        }

        // check if fileName is absolute path - it can be so by default or after previous step
        if (result.startsWith("/")) return result;

        // else - consider fileName a relative path
        // if workspace is still empty - not a clue
        return cwd + "/" + result;
    }
}
