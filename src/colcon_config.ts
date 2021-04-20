import * as vscode from 'vscode';
import * as path from 'path';
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
const rosInstallPathProperty = "rosInstallPath";
const shellProperty = "shell";
const shellTypeProperty = "shellType";

/**
 * Recognizable shell types
 */
type ShellType = 'cmd' | 'powershell' | 'bash' | 'zsh';

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

interface version {
    label: string;
    code?: string;
    detail?: string;
    global?: boolean;
    // installed?: boolean;
    description?: string;
};

export class Config {
    /**
     * Path to resulting environment file (colcon.env by default)
     */
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

    defaultEnvs?: NodeJS.ProcessEnv;

    /**
     * Path to shell processor
     */
    shell: string;

    /**
     * Configuration for current workspace
     */
    wsConf: vscode.WorkspaceConfiguration;

    /**
     * Configuration for current document
     */
    resConf: vscode.WorkspaceConfiguration;

    constructor(wsFolder: vscode.WorkspaceFolder | undefined = undefined) {

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

        this.shell = this.getCurrentShell();
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
        this.log("Current workspace dir: " + this.currentWsFolder.uri.fsPath);

        this.colconCwd = this.resConf.get(colconCwdProperty, "${workspaceFolder}");

        if (!this.colconCwd.startsWith("/")) {
            this.colconCwd = this.resolvePath(this.colconCwd);
        }

        // use concat to handle both string and array values
        this.globalSetup = [].concat(this.resConf.get(globalSetupProperty, []));
        this.workspaceSetup = [].concat(this.resConf.get(workspaceSetupProperty, []));

        this.env = this.resolvePath(this.resConf.get(envProperty, ".vscode/colcon.env"));

        this.refreshOnStart = this.wsConf.get(refreshOnStartProperty, true);
        this.refreshOnTasksOpened = this.wsConf.get(refreshOnTasksOpenedProperty, false);
        this.refreshOnConfigurationChanged = this.wsConf.get(refreshOnConfigurationChangedProperty, false);

        let envs = this.resConf.get(defaultEnvsProperty, {});
        if (Object.keys(envs).length > 0)
        {
            // leave undefined if there is no envs defined
            this.defaultEnvs = envs;
        }
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
        let actualCwd: string = cwd || this.currentWsFolder.uri.fsPath;

        // replace common VS Code substitution variable
        if (actualCwd != "") {
            result = result.replace("${workspaceFolder}", actualCwd);
        }

        if (path.isAbsolute(result))
            return result;

        // else - consider fileName a relative path
        // if workspace is still empty - not a clue
        return path.join(actualCwd, result);
    }

    async enableTasks() {
        let conf = vscode.workspace.getConfiguration(colcon_ns, this.currentWsFolder.uri);
        let provideTasks = conf.get(provideTasksProperty, false);
        conf.update(provideTasksProperty, this.provideTasks = true);

        let prop = conf.inspect(workspaceSetupProperty);
        if (prop && prop.workspaceFolderValue == undefined) {
            // if there is no workspace folder setup

            // ask user and automatically setup ROS version
            let rosVersions = this.listRosVersions();
            let selectedVersion = await vscode.window.showQuickPick(rosVersions);
            if (!selectedVersion) return;

            if (selectedVersion.label === "Other ..." || !selectedVersion.code) {
                // letting user to list what they need
                vscode.commands.executeCommand("workbench.action.openWorkspaceSettings");
                return;
            } else {
                // pushing the right one
                this.workspaceSetup = [this.resolveRosPath(selectedVersion.code)].concat(this.workspaceSetup);
            }

            this.updateIfNotExist(
                workspaceSetupProperty,
                this.resolveShellExtension(this.workspaceSetup),
                vscode.ConfigurationTarget.WorkspaceFolder
            );

            if (!rosVersions.every(entry => !entry.global))
                this.warn("Selected ROS version differs from that listed in global setup. Please check your configuration.", {forcePopup: true} );
        }

        this.log(`Tasks detection ${provideTasks ? "already " : ""}enabled`, { forcePopup: true });
    }

    listRosVersions(): version[] {
        let versions: version[] = [
            { label: "Dashing Diademata", code: "dashing" },
            { label: "Eloquent Elusor", code: "eloquent" },
            { label: "Foxy Fitzroy", code: "foxy" },
            { label: "Configure ...", detail: "open `settings.json`" }
        ];

        versions.forEach(version => {
            // mark version if it present in globalSetup
            this.globalSetup.forEach(globalEntry => {
                if (version.code && globalEntry.includes(version.code)) {
                    version.global = true;
                    version.description = [version.description].concat("global").join(' ');
                }
            });

            // TODO: mark versions listed in `rosInstallPath` as installed
        });

        return versions;
    }

    resolveRosPath(rosVersion: string) {
        return (<string> vscode.workspace
            .getConfiguration(`${colcon_ns}.${rosInstallPathProperty}`, this.currentWsFolder.uri)
            .get(this.getCurrentPlatform(), "/opt/ros/${version}/"))
            .replace("${version}", rosVersion) + 'setup.sh';
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

    getCurrentPlatform() : "osx" | "windows" | "linux" {
        switch (process.platform) {
            case "darwin": return "osx";
            case "win32": return "windows";
            default: return "linux";
        }
    }

    /**
     *
     * @returns Path to shell used to process colcon tasks
     */
    getCurrentShell() : string {
        // get integratedTerminal shell setting
        let confColcon = vscode.workspace.getConfiguration(colcon_ns + "." + shellProperty);
        let platform = this.getCurrentPlatform();

        let colconShell = confColcon.get(platform, "");
        if (colconShell)
            return colconShell;

        let confGlobal = vscode.workspace.getConfiguration("terminal.integrated.shell");

        switch (platform)
        {
            case 'windows':
                return confGlobal.get(platform, 'C:\\Windows\\System32\\cmd.exe');
            case 'linux':
            case 'osx':
            default:
                return confGlobal.get(platform, '/usr/bin/bash');
        }
    }

    getCurrentShellType() : ShellType
    {
        let confColcon = vscode.workspace.getConfiguration(colcon_ns + "." + shellProperty);
        let colconShell = confColcon.get(shellTypeProperty, "");

        switch (colconShell)
        {
            case "powershell":
            case "cmd":
            case "bash":
            case "zsh":
                return colconShell;
        }

        if (this.shell.endsWith('powershell.exe') || this.shell.endsWith('pwsh.exe'))
            return 'powershell';

        if (this.shell.endsWith('sh.exe') || this.shell.endsWith('bash'))
            return 'bash';

        if (this.shell.endsWith('cmd.exe')) return 'cmd';
        if (this.shell.endsWith('zsh')) return 'zsh';

        return 'bash';
    }

    // determine extension name for setup files
    determineShellExtension() : string {
        switch (this.getCurrentShellType())
        {
            case 'powershell':
                return 'ps1';
            case 'cmd':
                return 'bat';
            case 'zsh':
                return 'zsh';
            case 'bash':
            default:
                return 'sh';
        }
    }

    getEnvironment() : NodeJS.ProcessEnv | undefined
    {
        if (!this.defaultEnvs)
            return undefined;

        let envs: NodeJS.ProcessEnv = {};
        Object.keys(process.env).forEach(key =>
        {
            envs[key] = process.env[key];
        });

        Object.keys(this.defaultEnvs).forEach(key =>
        {
            envs[key] = this.defaultEnvs![key];
        });

        return envs;
    }

    printEnvironmentListCommand() : string
    {
        let shellType = this.getCurrentShellType();
        switch (shellType)
        {
            case 'cmd':
                return 'set > ' + this.env;
            case 'powershell':
                return `
$targetPath = '${this.env}'
if (Test-Path $targetPath)
{
  Clear-Content $targetPath
}

$envs = Get-ChildItem env:
Foreach ($entry in $envs)
{
  $str = $entry.Name + '=' + $entry.Value
  Add-Content -Path $targetPath -Value "$str"
}
`;
// $str = '\${env:' + $entry.Name + '}=''' + $entry.Value + ''''

            case 'bash':
            case 'zsh':
            default:
                return 'echo -e "$(env)" > ' + this.env + ' ; ';
        }
    }

    getSourceCmd() : string {
        switch (this.getCurrentShellType())
        {
            case 'powershell':
                return "."
            case 'cmd':
                return 'call';
            case 'bash':
            case 'zsh':
            default:
                return 'source';
        }
    }

    /**
     *
     * @returns Shell specific delimiter between commands
     */
    getCmdDelim() {
        switch (this.getCurrentShellType())
        {
            case 'cmd': return '&';
            default: return ';';
        }
    }
}
