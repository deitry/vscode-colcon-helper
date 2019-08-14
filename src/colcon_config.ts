import * as vscode from 'vscode';
import { colcon_ns, extName } from './common';
import { config } from 'dotenv';

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
    runFileArgs: string[];

    constructor() {
        // separate workspace and document configs to avoid warnings
        let wsConf = vscode.workspace.getConfiguration(colcon_ns);
        // Provide configuration for current document if it is possible
        let resConf = (vscode.window.activeTextEditor)
            ? vscode.workspace.getConfiguration(colcon_ns, vscode.window.activeTextEditor.document.uri)
            : wsConf;

        let updateIfNotExist = function (property: string, value: any) {
            // TODO: ask if user wants to create this settings
            let propertyConf = wsConf.inspect(property);
            if (propertyConf != undefined
                && propertyConf.globalValue == undefined
                && propertyConf.workspaceValue == undefined
                && propertyConf.workspaceFolderValue == undefined) {
                wsConf.update(property, value, vscode.ConfigurationTarget.WorkspaceFolder);
            }
        };

        if (!wsConf)
            throw new Error("Missed colcon configuration");

        this.provideTasks = resConf.get(provideTasksProperty, false);
        this.debugLog = wsConf.get(debugLogProperty, false);

        if (this.debugLog && outputChannel == undefined)
            outputChannel = vscode.window.createOutputChannel(extName);

        let outputLevelStr = wsConf.get(outputLevelProperty, "error");

        if (vscode.window.activeTextEditor)
            this.warn("DAAAA " + (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri : "NOO") + this.provideTasks);

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

        this.workspaceDir = resConf.get(workspaceDirProperty, "${workspaceFolder}");

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

        // use concat to handle both string and array values
        this.globalSetup = [].concat(resConf.get(globalSetupProperty, []));
        this.workspaceSetup = [].concat(resConf.get(workspaceSetupProperty, []));

        if (this.provideTasks) {
            updateIfNotExist(globalSetupProperty, this.globalSetup);
            // store workspaceSetup setting before we resolve it to absolute path
            updateIfNotExist(workspaceSetupProperty, this.workspaceSetup);
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
            updateIfNotExist(runFileProperty, this.runFile);
        }
        this.defaultEnvs = resConf.get(defaultEnvsProperty, {});
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
