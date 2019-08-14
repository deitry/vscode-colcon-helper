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
export function getColconTasks() {

    if (!config.provideTasks) {
        config.log(extName + " extension will not search for colcon tasks due to provideTask configuration");
        return [];
    }

    if (vscode.workspace.workspaceFolders == undefined) {
        config.error("No workspace discovered");
        return [];
    }

    config.log("Start to aquire colcon tasks")

    // 'Build' single colcon command
    function makeTask(
        executable: string,
        task: string,
        args: string[],
        group: vscode.TaskGroup | undefined = undefined) {

        let localArgs = args;
        config.log("Making task: " + task);
        config.log(executable + " " + localArgs.join(' '));

        let taskOptions = colconOptions;

        if (vscode.workspace.workspaceFolders == undefined) {
            // NOTE: in fact we checked it earlier, but Typescript force us to check
            // again in order to use vscode.workspace.workspaceFolders[0]
            return undefined;
        }

        // build in workspaceFolder where we are right now
        let ws: vscode.WorkspaceFolder = vscode.workspace.workspaceFolders[0];
        let currentEditor = vscode.window.activeTextEditor;
        if (currentEditor) {
            let currentWsFolder = vscode.workspace.getWorkspaceFolder(currentEditor.document.uri);
            if (currentWsFolder) {
                // fixme: there is config.workspaceDir setting, shouldn't it be used?
                // Maybe we should detect folder only if not set in current workspace folder
                taskOptions.cwd = currentWsFolder.uri.path;
                ws = currentWsFolder;
            }
        }

        let newTask = new vscode.Task(
            { type: colcon_ns, task: task, group: group },
            ws,
            task,
            colcon_ns,
            new vscode.ProcessExecution(executable, args, taskOptions),
            [] // TODO: problemMatcher
        );

        newTask.presentationOptions = taskPresentation;
        return newTask;
    }

    function makeColconTask(task: string, args: string[], group: vscode.TaskGroup | undefined = undefined) {
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
