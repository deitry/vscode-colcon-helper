import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as cp from 'child_process';
import * as path from 'path';

import { Config } from './colcon_config';
import { config } from './extension';
import * as vscode from 'vscode';
import { extName } from './common';

const delim = ' ; ';
const sourceCmd = 'source';


// execute standard colcon scripts and output resulting envs to file
export function refreshEnvironment() {
    config.log("Start to refresh environment");

    // FIXME: how it works with multi-root workspaces?
    let cmd = "cd " + config.workspaceDir + delim;

    function sourceIfExists(setting: string, label: string) {
        let source = "";
        let absPath = config.resolvePath(setting);

        // it is strongly recommended to check against absolute path
        if (fs.existsSync(absPath)) {
            source = sourceCmd + ' ' + absPath + delim;
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
    cmd += 'echo -e "$(env)" > ' + config.env + ' ; ';

    // Executing whole command
    try {
        config.log("Trying to execute: " + cmd);

        // get integratedTerminal shell setting
        let platform = process.platform;
        let platformName = "linux";
        switch (platform) {
            case "darwin": platformName = "osx"; break;
            case "win32": platformName = "windows"; break;
            default: break;
        }

        let shell = vscode.workspace.getConfiguration("terminal.integrated.shell").get(platformName, "/usr/bin/zsh");
        config.log("Current shell is " + shell);
        cp.execSync(cmd, { cwd: config.workspaceDir, env: config.defaultEnvs, shell: shell});

        // Set up common options
        let msg = "Environment refreshing done";
        config.log(msg);
        vscode.window.showInformationMessage(extName + ": " + msg);
    }
    catch (e) {
        let err = e as Error;
        config.error("Exception while retrieving colcon environment: \n" + err.message);
    }
}
