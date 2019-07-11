import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { Config } from './colcon_config';
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
        let newTask = new vscode.Task(
            { type: colcon_ns, task: task, group: group },
            vscode.TaskScope.Workspace,
            task,
            colcon_ns,
            new vscode.ProcessExecution(executable, args, taskOptions),
            // TODO: problemMatcher
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
    taskList.push(makeColconTask('build', [buildCmd].concat(config.buildArgs), vscode.TaskGroup.Build));
    taskList.push(makeColconTask('test', [testCmd].concat(config.testArgs), vscode.TaskGroup.Test));
    // TODO: test-result dependsOn test by default? Maybe an option
    taskList.push(makeColconTask('test-results', [testResultCmd].concat(config.testResultArgs)));
    taskList.push(makeTask(config.cleanCommand, 'clean', config.cleanArgs, vscode.TaskGroup.Clean));

    if (config.runFile != "") {
        taskList.push(makeTask(config.runCommand, 'run', config.runArgs.concat(config.runFile)));
    } else {
        config.warn("Run file is undefined");
        // TODO: option whether notify about missing run file or not
        // vscode.window.showWarningMessage(extName + ": Run file is undefined");
    }
    config.log("Complete aquire colcon tasks")
    return taskList;
}
