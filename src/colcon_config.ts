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

    constructor(wsFolder: vscode.WorkspaceFolder | undefined = undefined) {

        // separate workspace and document configs to avoid warnings
        let wsConf = vscode.workspace.getConfiguration(colcon_ns, null);
        // Provide configuration for current document if it is possible
        let resConf = (wsFolder)
            ? vscode.workspace.getConfiguration(colcon_ns, wsFolder.uri)
            : ((vscode.window.activeTextEditor)
                ? vscode.workspace.getConfiguration(colcon_ns, vscode.window.activeTextEditor.document.uri)
                : wsConf);

        let updateIfNotExist = function (property: string, value: any, target: vscode.ConfigurationTarget) {
            // TODO: ask if user wants to create this settings
            let propertyConf = wsConf.inspect(property);
            if (propertyConf != undefined
                && propertyConf.globalValue == undefined
                && propertyConf.workspaceValue == undefined
                && propertyConf.workspaceFolderValue == undefined) {
                wsConf.update(property, value, target);
            }
        };

        if (!wsConf)
            throw new Error("Missed colcon configuration");

        this.provideTasks = resConf.get(provideTasksProperty, false);
        this.debugLog = wsConf.get(debugLogProperty, false);

        if (this.debugLog && outputChannel == undefined)
            outputChannel = vscode.window.createOutputChannel(extName);

        let outputLevelStr = wsConf.get(outputLevelProperty, "error");

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

        this.colconCwd = resConf.get(colconCwdProperty, "${workspaceFolder}");

        if (!this.colconCwd.startsWith("/")) {
            this.colconCwd = this.resolvePath(this.colconCwd);
        }

        // use concat to handle both string and array values
        this.globalSetup = [].concat(resConf.get(globalSetupProperty, []));
        this.workspaceSetup = [].concat(resConf.get(workspaceSetupProperty, []));

        if (this.provideTasks) {
            updateIfNotExist(globalSetupProperty, this.globalSetup, vscode.ConfigurationTarget.Global);
            // store workspaceSetup setting before we resolve it to absolute path
            // updateIfNotExist(workspaceSetupProperty, this.workspaceSetup);
        }

        this.env = this.resolvePath(resConf.get(envProperty, ".vscode/colcon.env"));

        this.refreshOnStart = wsConf.get(refreshOnStartProperty, true);
        this.refreshOnTasksOpened = wsConf.get(refreshOnTasksOpenedProperty, false);
        this.refreshOnConfigurationChanged = wsConf.get(refreshOnConfigurationChangedProperty, false);

        this.buildArgs = resConf.get(buildArgsProperty, []);
        this.testArgs = resConf.get(testArgsProperty, []);
        this.testResultArgs = resConf.get(testResultArgsProperty, []);
        this.cleanCommand = resConf.get(cleanCommandProperty, "");
        this.cleanArgs = resConf.get(cleanArgsProperty, []);
        this.cleanCommand = resConf.get(cleanCommandProperty, "");
        this.cleanArgs = resConf.get(cleanArgsProperty, []);
        this.runCommand = resConf.get(runCommandProperty, "");
        this.runArgs = resConf.get(runArgsProperty, []);
        this.runFile = resConf.get(runFileProperty, "");
        this.runFileArgs = resConf.get(runFileArgsProperty, []);
        if (this.provideTasks) {
            updateIfNotExist(runFileProperty, this.runFile, vscode.ConfigurationTarget.WorkspaceFolder);
        }
        this.defaultEnvs = resConf.get(defaultEnvsProperty, {});

        // get integratedTerminal shell setting
        let platform = process.platform;
        let platformName = "linux";
        switch (platform) {
            case "darwin": platformName = "osx"; break;
            case "win32": platformName = "windows"; break;
            default: break;
        }
        this.shell = vscode.workspace.getConfiguration("terminal.integrated.shell").get(platformName, "/usr/bin/zsh");
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
}
