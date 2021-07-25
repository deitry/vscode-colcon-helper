import * as cp from 'child_process';
import * as vscode from 'vscode';
import { colcon_exec } from "./common";
import { config } from './extension';

export class PackageInfo implements vscode.QuickPickItem {
    constructor(readonly name: string, readonly path: string, readonly buildSystem: string) {
    }

    get label() { return this.name; }
    get description() { return this.buildSystem; }
    get detail() { return this.path; }
}

export function getAllPackages(folder: vscode.WorkspaceFolder): PackageInfo[] {
    let cmd = [config.colconExe].concat('list');

    var joinedCmd = cmd.join(' ');
    config.log("Get package list with: " + joinedCmd);

    let options: cp.ExecSyncOptionsWithStringEncoding = {
        cwd: folder.uri.fsPath,
        shell: config.shell,
        encoding: 'utf-8',
        env: config.getEnvironment(),
    };

    // FIXME: get rid of execSync
    let packagesRaw: string[] = cp.execSync(
        joinedCmd, options
    ).toString().replace(RegExp('\n$'), '').split('\n');

    // Replace newline at end because after split it gets its own entry in resulting list

    let packages: PackageInfo[] = [];

    // raw `colcon list` command returns list in format 'name \t path \t buildSystem'
    // new version of colcon returns relative path so we must resolve it as asbolute
    packagesRaw.forEach(entry => {
        let packageInfoStrs = entry.split('\t');
        if (packageInfoStrs.length >= 3)
            packages.push(new PackageInfo(
                packageInfoStrs[0],
                config.resolvePath(packageInfoStrs[1], folder.uri.fsPath),
                packageInfoStrs[2]));
    });

    if (packages.length == 0)
    {
        config.warn("No packages was discovered", { forcePopup: true });
        config.log("colcon list output: " + packagesRaw);
    }

    return packages;
}
