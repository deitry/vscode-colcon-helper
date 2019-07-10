import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { Config } from './colcon_config';
import { colcon_ns, colcon_exec } from './common';
import { config } from './extension';

const buildCmd = 'build';
const testCmd = 'test';
const testResultCmd = 'test-result';

let colconOptions: vscode.ShellExecutionOptions = {};

const taskPresentation: vscode.TaskPresentationOptions = {
    clear: true,
    panel: vscode.TaskPanelKind.Dedicated,
    showReuseMessage: false,
    focus: true,
    reveal: vscode.TaskRevealKind.Always,
    echo: true
};

// Get all possible colcon tasks
export function getColconTasks() {

    config.log("Start to aquire colcon tasks")

    // 'Build' single colcon command
    function makeTask(executable: string, task: string, args: string[]) {

        config.log("Making task: " + task);
        config.log(executable + " " + args.join(' '));

        let taskOptions = colconOptions;

        let newTask = new vscode.Task(
            { type: colcon_ns, task: task },
            vscode.TaskScope.Workspace,
            task,
            colcon_ns,
            new vscode.ProcessExecution(executable, args, taskOptions),
            // TODO: problemMatcher
        );

        newTask.presentationOptions = taskPresentation;
        return newTask;
    }

    function makeColconTask(task: string, args: string[]) {
        return makeTask(colcon_exec, task, args);
    }


    if (fs.existsSync(config.env)) {
        let fullEnvPath = config.workspaceDir + "/" + config.env;
        // FIXME: check if config.env is already an absolute path

        config.log("Parse environment configuration in " + fullEnvPath);
        colconOptions.env = dotenv.parse(fs.readFileSync(fullEnvPath));
    }
    else {
        config.log("Environment file does not exist.");
    }

    let taskList: vscode.Task[] = [];
    taskList.push(makeColconTask('build', [buildCmd].concat(config.buildArgs)));
    taskList.push(makeColconTask('test', [testCmd].concat(config.testArgs)));
    taskList.push(makeColconTask('test-results', [testResultCmd].concat(config.testResultArgs)));
    taskList.push(makeTask(config.cleanCommand, 'clean', config.cleanArgs));

    config.log("Complete aquire colcon tasks")
    return taskList;
}
