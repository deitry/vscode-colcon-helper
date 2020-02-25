import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { colcon_ns, colcon_exec, extName } from './common';
import { config, packages } from './extension';

const buildCmd = 'build';
const testCmd = 'test';
const testResultCmd = 'test-result';

let colconOptions: vscode.ProcessExecutionOptions = {};

const taskPresentation: vscode.TaskPresentationOptions = {
    clear: true,
    panel: vscode.TaskPanelKind.Dedicated,
    showReuseMessage: true,
    focus: true,
    reveal: vscode.TaskRevealKind.Always,
    echo: true
};

export class ColconTaskDefinition {
    type: string = colcon_ns;
    task: string;
    name: string;

    constructor(task: string) {
        this.name = task;
        this.task = task;
    }
}

export function getBuildTaskForPackage(packageName: string | string[]): vscode.Task | undefined {
    let packagesSelected = false;

    config.buildArgs.forEach(element => {
        if (element.includes('--packages-select')) packagesSelected = true;
    });

    if (packagesSelected) {
        // FIXME: in case of build-current we must not just concat packages-select, but replace if it is already exist
        config.error('Cannot add build task for current package, because there is already `--packages-select` option.');
    } else {

        let descriptor = typeof (packageName) == 'string' ? `'${packageName}'` : 'selected';

        return makeColconTask(
            `build ${descriptor}`,
            [buildCmd].concat(config.buildArgs).concat('--packages-select').concat(packageName),
            vscode.TaskGroup.Build);
    }
    return undefined;
}


// 'Build' single colcon command
let makeTask = (
    executable: string,
    task: string,
    args: string[],
    group: vscode.TaskGroup | undefined = undefined
) => {
    let localArgs = args;
    config.log("Making task: " + task);
    let fullCmd = executable + " " + localArgs.join(' ');
    config.log(fullCmd);

    let taskOptions = colconOptions;

    let newTask = new vscode.Task(
        new ColconTaskDefinition(task),
        config.currentWsFolder,
        task,
        colcon_ns,
        new vscode.ProcessExecution(executable, args, taskOptions),
        [] // TODO: problemMatcher
    );

    newTask.presentationOptions = taskPresentation;
    newTask.group = group;
    return newTask;
}

let makeColconTask = (
    task: string,
    args: string[],
    group: vscode.TaskGroup | undefined = undefined
) => {
    return makeTask(colcon_exec, task, args, group);
}

// Get all possible colcon tasks
export function getColconTasks(wsFolder: vscode.WorkspaceFolder) {

    if (!config.provideTasks) {
        config.log(extName + " extension will not search for colcon tasks due to provideTask configuration");
        return [];
    }

    config.log("Start to aquire colcon tasks for " + wsFolder.uri.path)

    if (fs.existsSync(config.env)) {
        config.log("Parse environment configuration in " + config.env);
        colconOptions.env = dotenv.parse(fs.readFileSync(config.env));
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
                    && active.document.uri.path.startsWith(config.resolvePath(pkg.path, wsFolder.uri.path))) {
                    // FIXME: startsWith is not the best option, but uri.path is just a string.
                    // Pkg path should be already absolute at the moment, but checking anyway.

                    config.log('check ' + pkg.path);
                    pushIfNotUndefined(getBuildTaskForPackage(pkg.name));
                }
            });
        }

        // run current launch file
        if (active.document.uri.path && active.document.uri.path.endsWith('.launch.py')) {
            let fileName = active.document.fileName;
            if (fileName.startsWith(wsFolder.uri.fsPath)) {
                // get path relative to wsFolder, because absolute paths somehow could not be treaten by ros2 launch
                let basename = '.' + fileName.substr(wsFolder.uri.fsPath.length);
                let currentRunArgs = ['launch'];
                let hasDebug = false;

                config.runArgs.forEach(element => {
                    if (element.includes('--debug')) hasDebug = true;
                });

                if (hasDebug) currentRunArgs = currentRunArgs.concat('--debug');
                currentRunArgs = currentRunArgs.concat(basename).concat(config.runFileArgs);

                pushIfNotUndefined(makeTask(config.runCommand, `launch '${basename}'`, currentRunArgs));
            }
        }
    }

    pushIfNotUndefined(makeColconTask('build', [buildCmd].concat(config.buildArgs), vscode.TaskGroup.Build));
    pushIfNotUndefined(makeColconTask('test', [testCmd].concat(config.testArgs), vscode.TaskGroup.Test));
    // TODO: test-result dependsOn test by default? Maybe an option
    pushIfNotUndefined(makeColconTask('test-results', [testResultCmd].concat(config.testResultArgs)));
    pushIfNotUndefined(makeTask(config.cleanCommand, 'clean', config.cleanArgs, vscode.TaskGroup.Clean));

    let runArgs = config.runArgs;
    //  NOTE: if "" passed as runFile then it may be considered as invalid arg when executed
    if (config.runFile != "") { runArgs = runArgs.concat(config.runFile); }
    else { config.warn("Run file is undefined"); }
    runArgs = runArgs.concat(config.runFileArgs);
    pushIfNotUndefined(makeTask(config.runCommand, 'run', runArgs));

    config.log("Complete aquire colcon tasks")
    return taskList;
}
