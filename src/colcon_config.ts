import * as vscode from 'vscode';
import { colcon_ns, extName } from './common';

const envProperty = "env";
const globalSetupProperty = "globalSetup";
const workspaceSetupProperty = "workspaceSetup";
const colconCwdProperty = "colconCwd";
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
const runFileArgsProperty = "runFileArgs";
const defaultEnvsProperty = "defaultEnvironment";

enum OutputLevel {
    Info = 0,
    Warning = 1,
    Error = 2,
    None = 3,
}

// in order to keep the same channel if config will be overwritten
let outputChannel: vscode.OutputChannel | undefined = undefined;

interface LogOptions {
    forcePopup?: boolean;
    forceConsole?: boolean;
}

export class Config {
    env: string;
    globalSetup: string[] = [];
    workspaceSetup: string[] = [];
    colconCwd: string;
    currentWsFolder: vscode.WorkspaceFolder;

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
    runFileArgs: string[];

    shell: string;
    wsConf: vscode.WorkspaceConfiguration;
    resConf: vscode.WorkspaceConfiguration;

    constructor(wsFolder: vscode.WorkspaceFolder | undefined = undefined) {

        this.shell = this.getCurrentShell();

        // separate workspace and document configs to avoid warnings
        this.wsConf = vscode.workspace.getConfiguration(colcon_ns, null);
        // Provide configuration for current document if it is possible
        this.resConf = (wsFolder)
            ? vscode.workspace.getConfiguration(colcon_ns, wsFolder.uri)
            : ((vscode.window.activeTextEditor)
                ? vscode.workspace.getConfiguration(colcon_ns, vscode.window.activeTextEditor.document.uri)
                : this.wsConf);

        if (!this.wsConf)
            throw new Error("Missed colcon configuration");

        this.provideTasks = this.resConf.get(provideTasksProperty, false);
        this.debugLog = this.wsConf.get(debugLogProperty, false);

        if (this.debugLog && outputChannel == undefined)
            outputChannel = vscode.window.createOutputChannel(extName);

        let outputLevelStr = this.wsConf.get(outputLevelProperty, "error");

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

        // deduce current workspace folder
        if (vscode.workspace.workspaceFolders == undefined) {
            let msg = "Can't find workspace";
            this.warn(msg);
            // should I throw error or try to softely disable extension?
            // Since this is important setting we want it to be correctly set up
            // TODO: handle in catch?
            throw new Error(msg);
        }

        if (wsFolder == undefined && vscode.window.activeTextEditor) {
            wsFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
        }
        this.currentWsFolder = (wsFolder) ? wsFolder : vscode.workspace.workspaceFolders[0];
        this.log("Current workspace dir: " + this.currentWsFolder.uri.path);

        this.colconCwd = this.resConf.get(colconCwdProperty, "${workspaceFolder}");

        if (!this.colconCwd.startsWith("/")) {
            this.colconCwd = this.resolvePath(this.colconCwd);
        }

        // use concat to handle both string and array values
        this.globalSetup = [].concat(this.resConf.get(globalSetupProperty, []));
        this.workspaceSetup = [].concat(this.resConf.get(workspaceSetupProperty, []));

        if (this.provideTasks) {
            // if there is no workspace setup
            this.updateIfNotExist(
                workspaceSetupProperty,
                this.resolveShellExtension(this.workspaceSetup),
                vscode.ConfigurationTarget.WorkspaceFolder
            );
        }

        this.env = this.resolvePath(this.resConf.get(envProperty, ".vscode/colcon.env"));

        this.refreshOnStart = this.wsConf.get(refreshOnStartProperty, true);
        this.refreshOnTasksOpened = this.wsConf.get(refreshOnTasksOpenedProperty, false);
        this.refreshOnConfigurationChanged = this.wsConf.get(refreshOnConfigurationChangedProperty, false);

        this.buildArgs = this.resConf.get(buildArgsProperty, []);
        this.testArgs = this.resConf.get(testArgsProperty, []);
        this.testResultArgs = this.resConf.get(testResultArgsProperty, []);
        this.cleanCommand = this.resConf.get(cleanCommandProperty, "");
        this.cleanArgs = this.resConf.get(cleanArgsProperty, []);
        this.cleanCommand = this.resConf.get(cleanCommandProperty, "");
        this.cleanArgs = this.resConf.get(cleanArgsProperty, []);
        this.runCommand = this.resConf.get(runCommandProperty, "");
        this.runArgs = this.resConf.get(runArgsProperty, []);
        this.runFile = this.resConf.get(runFileProperty, "");
        this.runFileArgs = this.resConf.get(runFileArgsProperty, []);
        this.defaultEnvs = this.resConf.get(defaultEnvsProperty, {});
    }

    // NOTE: forceConsole will be used for extension debug purposes since console.log()
    // can correctly represent objects
    log(msg: any, options?: LogOptions) {
        if (this.outputLevel > OutputLevel.Info) return;
        if (options && options.forcePopup) vscode.window.showInformationMessage(msg);

        if ((options && options.forceConsole) || outputChannel == undefined) {
            console.log(extName + ": " + msg);
        } else {
            outputChannel.appendLine(msg);
        }
    }

    warn(msg: any, options?: LogOptions) {
        if (this.outputLevel > OutputLevel.Warning) return;
        if (options && options.forcePopup) vscode.window.showWarningMessage(msg);

        if ((options && options.forceConsole) || outputChannel == undefined) {
            console.warn(extName + ": " + msg);
        } else {
            outputChannel.appendLine("warn: " + msg);
        }
    }

    error(msg: any, options?: LogOptions) {
        // show popup anyway
        vscode.window.showErrorMessage(extName + ": " + msg);
        if (this.outputLevel > OutputLevel.Error) return;

        if ((options && options.forceConsole) || outputChannel == undefined) {
            console.error(extName + ": " + msg);
        } else {
            outputChannel.appendLine("error: " + msg);
        }
    }

    // cwd argument must be string since we could pass arbitrary string path through configs
    resolvePath(fileName: string, cwd: string | undefined = undefined) {
        let result = fileName;
        let actualCwd: string = cwd || this.currentWsFolder.uri.path;

        // replace common VS Code substitution variable
        if (actualCwd != "") {
            result = result.replace("${workspaceFolder}", actualCwd);
        }

        // check if fileName is absolute path - it can be so by default or after previous step
        if (result.startsWith("/")) return result;

        // else - consider fileName a relative path
        // if workspace is still empty - not a clue
        return actualCwd + "/" + result;
    }

    enableTasks() {
        // TODO: ask user and automatically setup ROS version
        let conf = vscode.workspace.getConfiguration(colcon_ns, this.currentWsFolder.uri);
        let provideTasks = conf.get(provideTasksProperty, false);
        conf.update(provideTasksProperty, this.provideTasks = true);
        this.log(`Tasks detection ${provideTasks ? "already " : ""}enabled`, { forcePopup: true });
    }

    disableTasks() {
        let conf = vscode.workspace.getConfiguration(colcon_ns, this.currentWsFolder.uri);
        let provideTasks = conf.get(provideTasksProperty, false);
        conf.update(provideTasksProperty, this.provideTasks = false);
        this.log(`Tasks detection ${provideTasks ? "" : "already "}disabled`, { forcePopup: true });
    }

    private updateIfNotExist(property: string, value: any, target: vscode.ConfigurationTarget) {
        // TODO: ask if user wants to create this settings
        let conf = vscode.workspace.getConfiguration(colcon_ns, this.currentWsFolder.uri);
        let propertyConf = conf.inspect(property);

        if (propertyConf != undefined
            && propertyConf.globalValue == undefined
            && propertyConf.workspaceValue == undefined
            && propertyConf.workspaceFolderValue == undefined) {

            console.log("here");
            conf.update(property, value, target);
        }
    };

    resolveShellExtension(setupList: string[]) {
        return setupList.map(entry => this.resolveShellExtensionForSingle(entry));
    }

    resolveShellExtensionForSingle(entry: string) {
        let neededExt = this.determineShellExtension();
        let currentExt = entry.split('.').slice(-1).join();
        if (currentExt === neededExt) return entry;
        return entry.replace(RegExp(`${currentExt}\$`), neededExt);
    }

    getCurrentShell() {
        // get integratedTerminal shell setting
        let platform = process.platform;
        let platformName = "linux";
        switch (platform) {
            case "darwin": platformName = "osx"; break;
            case "win32": platformName = "windows"; break;
            default: break;
        }
        return vscode.workspace.getConfiguration("terminal.integrated.shell").get(platformName, "/usr/bin/bash");
    }

    // determine extension name for setup files
    determineShellExtension() {
        if (this.shell.endsWith('bash.exe') || this.shell.endsWith('bash')) return 'bash';
        if (this.shell.endsWith('powershell.exe')) return 'ps1';
        if (this.shell.endsWith('zsh')) return 'zsh';
        // default:
        return "sh";
    }
}
