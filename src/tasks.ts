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

export function getBuildTaskForPackage(packageName: string | string[]): vscode.Task | undefined {
    if (config.buildArgs.includes('--packages-select')) {
        // FIXME: in case of build-current we must not just concat packages-select, but replace if it is already exist
        config.error('Cannot add build task for current package, because there is already `--packages-select` option.');
    } else {

        let descriptor = typeof(packageName) == 'string' ? `'${packageName}'` : 'selected';

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
    config.log(executable + " " + localArgs.join(' '));

    let taskOptions = colconOptions;

    let newTask = new vscode.Task(
        { type: colcon_ns, task: task, group: group },
        config.currentWsFolder,
        task,
        colcon_ns,
        new vscode.ProcessExecution(executable, args, taskOptions),
        [] // TODO: problemMatcher
    );

    newTask.presentationOptions = taskPresentation;
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
        if (wsFolder.name in packages) {
            packages[wsFolder.name].forEach(pkg => {
                if (active && pkg.path != '' && active.document.uri.path.startsWith(pkg.path)) {

                        config.log('check ' + pkg.path);
                        pushIfNotUndefined(getBuildTaskForPackage(pkg.name));
                }
            });
        }

        if (active.document.uri.path.endsWith('.launch.py')) {
            let fileName = active.document.fileName;
            if (fileName.startsWith(wsFolder.uri.fsPath)) {
                // get path relative to wsFolder, because absolute paths somehow could not be treaten by ros2 launch
                let basename = '.' + fileName.substr(wsFolder.uri.fsPath.length);
                let currentRunArgs = ['launch'];

                if (config.runArgs.includes('--debug')) currentRunArgs = currentRunArgs.concat('--debug');
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
