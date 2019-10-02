import * as cp from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { colcon_ns, colcon_exec, extName } from './common';
import { config } from './extension';

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

// Get all possible colcon tasks
export function getColconTasks(wsFolder: vscode.WorkspaceFolder) {

    if (!config.provideTasks) {
        config.log(extName + " extension will not search for colcon tasks due to provideTask configuration");
        return [];
    }

    config.log("Start to aquire colcon tasks for " + wsFolder.uri.path)

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

    if (fs.existsSync(config.env)) {
        config.log("Parse environment configuration in " + config.env);
        colconOptions.env = dotenv.parse(fs.readFileSync(config.env));
    }
    else {
        config.log("Environment file does not exist. Expected: " + config.env);
    }

    let taskList: vscode.Task[] = [];
    let pushIfNotUndefined = (task: vscode.Task | undefined) => {
        if (task) taskList.push(task);
    };

    if (vscode.window.activeTextEditor) {
        if (config.buildArgs.includes('--packages-select')) {
            config.error('Cannot add build task for current package, because there is already `--packages-select` option.');
        } else {
            // FIXME: in case of build-current we must not just concat packages-select, but replace if it is already exist
            let buildCurrentArgs = ['--packages-select'];

            // 1. Get list of paths for all available packages
            let packagesList = cp.execSync(
                colcon_exec + ' list --paths-only',
                { cwd: config.currentWsFolder.uri.path, env: config.defaultEnvs, shell: config.shell }
            ).toString().split('\n');

            // 2. Check each path
            packagesList.forEach(path => {
                if (vscode.window.activeTextEditor
                    && path != ''
                    && vscode.window.activeTextEditor.document.uri.path.startsWith(path)) {

                    // 3. Get package name
                    let localPackageName = cp.execSync(
                        colcon_exec + ' list --names-only --base-path ' + path,
                        { cwd: config.currentWsFolder.uri.path, env: config.defaultEnvs, shell: config.shell }
                    ).toString().replace('\n', '');

                    if (localPackageName) {
                        config.log('Found local package ' + localPackageName);

                        pushIfNotUndefined(
                            makeColconTask(
                                `build \`${localPackageName}\``,
                                [buildCmd].concat(config.buildArgs)
                                    .concat(buildCurrentArgs)
                                    .concat(localPackageName),
                                vscode.TaskGroup.Build));
                    } else {
                        config.warn(`Package at the path ${path} was not found`);
                    }
                }
            });
        }
    }

    pushIfNotUndefined(makeColconTask('build', [buildCmd].concat(config.buildArgs), vscode.TaskGroup.Build));
    pushIfNotUndefined(makeColconTask('test', [testCmd].concat(config.testArgs), vscode.TaskGroup.Test));
    // TODO: test-result dependsOn test by default? Maybe an option
    pushIfNotUndefined(makeColconTask('test-results', [testResultCmd].concat(config.testResultArgs)));
    pushIfNotUndefined(makeTask(config.cleanCommand, 'clean', config.cleanArgs, vscode.TaskGroup.Clean));

    let runArgs = config.runArgs;
    //  NOTE: if "" passed then it may be considered as invalid arg when executed
    if (config.runFile != "") { runArgs = runArgs.concat(config.runFile); }
    else { config.warn("Run file is undefined"); }
    runArgs = runArgs.concat(config.runFileArgs);
    pushIfNotUndefined(makeTask(config.runCommand, 'run', runArgs));

    config.log("Complete aquire colcon tasks")
    return taskList;
}
