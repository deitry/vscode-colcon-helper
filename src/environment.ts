import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';

import { config, updatePackageList } from './extension';
import * as vscode from 'vscode';
import { extName } from './common';

const delim = ' ; ';


// execute standard colcon scripts and output resulting envs to file
export function refreshEnvironment() {
    config.log("Start to refresh environment");

    let cmd = "";

    function sourceIfExists(setting: string, label: string) {
        let source = "";
        // relative paths to setup files should be resolved against colcon working directory
        let absPath = config.resolvePath(setting, config.colconCwd);

        // it is strongly recommended to check against absolute path
        if (fs.existsSync(absPath)) {
            source = config.getSourceCmd() + ' "' + absPath + '" ' + config.getCmdDelim() + ' ';
            config.log("Source " + label + " command: " + absPath);
        }
        else {
            config.log(
                "Missing or invalid " + label + " configuration. Expected: " + absPath);
        }
        return source;
    }

    config.globalSetup.forEach(element => {
        cmd += sourceIfExists(element, "global");
    });

    config.workspaceSetup.forEach(element => {
        cmd += sourceIfExists(element, "workspace");
    });

    if (!fs.existsSync(path.dirname(config.env))) {
        config.log("Making directory" + path.dirname(config.env));

        cmd += 'mkdir  -p ' + path.dirname(config.env) + delim;
    }

    // FIXME: only colcon-related envs should be outputed
    cmd += config.printEnvironmentListCommand();

    // Executing whole command
    try {
        config.log("Trying to execute: " + cmd);
        config.log("Current shell is " + config.shell);
        var output = cp.execSync(cmd,
            {
                cwd: config.currentWsFolder.uri.fsPath,
                env: config.getEnvironment(),
                shell: config.shell,
            }).toString();

        config.log(output);

        updatePackageList();

        let msg = "Environment Refreshing Done";
        config.log(msg);
        vscode.window.showInformationMessage(extName + ": " + msg);
    }
    catch (e) {
        let err = e as Error;
        config.error("Exception while retrieving colcon environment: \n" + err.message);
    }
}
