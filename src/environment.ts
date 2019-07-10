import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as cp from 'child_process';
import * as path from 'path';

import { Config } from './colcon_config';
import { config } from './extension';

const delim = ' ; ';
const sourceCmd = '.';


// execute standard colcon scripts and output resulting envs to file
export function refreshEnvironment() {
    config.log("Start to refresh environment");

    let cmd = "cd " + config.workspaceDir + delim;

    function sourceIfExists(setting: string, label: string) {
        let source = "";

        if (fs.existsSync(setting)) {
            source = sourceCmd + ' ' + setting + delim;
            config.log("Source " + label + " command: " + source);
        }
        else {
            config.log(
                "Missing or invalid " + label + " configuration. Current is: " + setting);
        }
        return source;
    }

    cmd += sourceIfExists(config.globalSetup, "global");
    cmd += sourceIfExists(config.workspaceDir + "/" + config.workspaceSetup, "workspace");

    if (!fs.existsSync(path.dirname(config.env))) {
        config.log("Making directory" + path.dirname(config.env));

        cmd += 'mkdir  -p ' + path.dirname(config.env) + delim;
    }

    // FIXME: only colcon-related envs should be outputed
    // FIXME: check if config.env is already an absolute path
    cmd += 'echo -e "$(env)" > ' + config.workspaceDir + "/" + config.env + ' ; ';

    // Executing whole command
    try {
        config.log("Trying to execute: " + cmd);

        // FIXME: use of vscode internalTerminal shell
        cp.execSync(cmd, { cwd: config.workspaceDir, env: config.defaultEnvs, shell: "/usr/bin/zsh"});
    }
    catch {
        config.error("Exception while retrieving colcon environment");
        // FIXME: vscode notification
    }
    // Set up common options
    config.log("Environment refreshing done");
}
