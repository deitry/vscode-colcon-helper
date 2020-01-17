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
    let cmd = [colcon_exec].concat('list');

    // FIXME: get rid of execSync
    let packagesRaw: string[] = cp.execSync(
        cmd.join(' '),
        { cwd: folder.uri.path, env: config.defaultEnvs, shell: config.shell }
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
                config.resolvePath(packageInfoStrs[1], folder.uri.path),
                packageInfoStrs[2]));
    });

    return packages;
}
