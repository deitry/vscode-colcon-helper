import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { colcon_ns, colcon_exec, extName } from './common';
import { config, packages } from './extension';
import { ColconTaskDefinition } from './colcon_task_provider';

const buildCmd = 'build';
const testCmd = 'test';
const testResultCmd = 'test-result';

let colconExecOptions: vscode.ProcessExecutionOptions = {};

export const taskPresentation: vscode.TaskPresentationOptions = {
    clear: true,
    panel: vscode.TaskPanelKind.Dedicated,
    showReuseMessage: true,
    focus: true,
    reveal: vscode.TaskRevealKind.Always,
    echo: true
};

export function getBuildTaskForPackage(packageName: string | string[]): vscode.Task | undefined {

    let descriptor = typeof (packageName) == 'string'
        ? `'${packageName}'`
        : 'selected';

    return makeColconTask(
        `build ${descriptor}`,
        [buildCmd].concat(config.installTypeArgs).concat('--packages-select', packageName),
        vscode.TaskGroup.Build);
}

export function getBuildTaskForPackagesUpTo(packageName: string | string[]): vscode.Task | undefined {

    let descriptor = typeof (packageName) == 'string'
        ? `'${packageName}'`
        : 'selected';

    return makeColconTask(
        `build ${descriptor}`,
        [buildCmd].concat(config.installTypeArgs).concat('--packages-up-to', packageName),
        vscode.TaskGroup.Build);
}

// 'Build' single colcon command
let makeTask = (
    executable: string,
    taskName: string,
    args: string[],
    group: vscode.TaskGroup | undefined = undefined
) => {
    config.log("Making task: " + taskName);

    let localArgs = args;
    let fullCmd = executable + " " + localArgs.join(' ');
    config.log(fullCmd);

    //Read ExecOptions from colcon.env
    if (fs.existsSync(config.env)) {
        config.log("Parse environment configuration in " + config.env);
        colconExecOptions.env = dotenv.parse(fs.readFileSync(config.env));
    }
    else {
        config.log("Environment file does not exist. Expected: " + config.env);
    }

    let newTask = new vscode.Task(
        new ColconTaskDefinition(taskName, executable, args),
        config.currentWsFolder,
        taskName,
        colcon_ns,
        new vscode.ProcessExecution(executable, args, colconExecOptions),
        [] // TODO: problemMatcher
    );

    newTask.presentationOptions = taskPresentation;
    newTask.group = group;
    return newTask;
}

let makeColconTask = (
    taskName: string,
    args: string[],
    group: vscode.TaskGroup | undefined = undefined
) => {
    return makeTask(config.colconExe, taskName, args, group);
}

// Get all possible colcon tasks
export function getColconTasks(wsFolder: vscode.WorkspaceFolder) {

    if (!config.provideTasks) {
        config.log(extName + " extension will not search for colcon tasks due to provideTask configuration");
        return [];
    }

    config.log("Start to aquire colcon tasks for " + wsFolder.uri.fsPath)

    if (fs.existsSync(config.env)) {
        config.log("Parse environment configuration in " + config.env);
        colconExecOptions.env = dotenv.parse(fs.readFileSync(config.env));
    }
    else {
        config.log("Environment file does not exist. Expected: " + config.env);
    }

    let taskList: vscode.Task[] = [];
    let pushIfNotUndefined = (task: vscode.Task | undefined) => {
        config.log(task);
        if (task) taskList.push(task);
    };

    let active = vscode.window.activeTextEditor;
    if (active) {
        // For active editor we try to add `build current package` and `run current launch file`

        // build current package
        if (wsFolder.name in packages) {
            packages[wsFolder.name].forEach(pkg => {
                if (active
                    && pkg.path != ''
                    && active.document.uri.fsPath.startsWith(config.resolvePath(pkg.path, wsFolder.uri.fsPath))) {
                    // FIXME: startsWith is not the best option, but uri.path is just a string.
                    // Pkg path should be already absolute at the moment, but checking anyway.

                    config.log('check ' + pkg.path);
                    pushIfNotUndefined(getBuildTaskForPackage(pkg.name));
                }
            });
        }
    }

    pushIfNotUndefined(makeColconTask('build', [buildCmd].concat(config.installTypeArgs), vscode.TaskGroup.Build));
    pushIfNotUndefined(makeColconTask('test', [testCmd], vscode.TaskGroup.Test));
    pushIfNotUndefined(makeColconTask('test-result', [testResultCmd, '--verbose']));

    // it seems Clean group is not available actually and raises warning in tasks.json
    pushIfNotUndefined(makeTask('rm', 'clean', ['-r', '--verbose', 'build', 'install']/* , vscode.TaskGroup.Clean */));

    pushIfNotUndefined(makeTask('ros2', 'run', []));

    config.log("Complete aquire colcon tasks")
    return taskList;
}
