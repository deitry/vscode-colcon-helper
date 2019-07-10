import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { Config } from './colcon_config';
import { colcon_ns, colcon_exec } from './common';

const buildCmd = 'build';
const testCmd = 'test';
const testResultCmd = 'test-result';

let colconOptions: vscode.ShellExecutionOptions = {
    shellArgs: ['-i', '-c'],
    executable: "/usr/bin/zsh"
}

// Get all possible colcon tasks
export function getColconTasks(config: Config) {

    config.log("Start to aquire colcon tasks")

    // 'Build' single colcon command
    function makeColconTask(task: string, args: string[]) {

        config.log("Making task:" + task)

        let taskOptions = colconOptions;

        return new vscode.Task(
            { type: colcon_ns, task: task },
            vscode.TaskScope.Workspace,
            task,
            colcon_ns,
            new vscode.ProcessExecution(colcon_exec, args, taskOptions)
            // TODO: problemMatcher
        );
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

    let taskList = [];
    taskList.push(makeColconTask('build', [buildCmd].concat(config.buildArgs)));
    taskList.push(makeColconTask('test', [testCmd].concat(config.testArgs)));
    taskList.push(makeColconTask('test-results', [testResultCmd].concat(config.testResultArgs)));

    config.log("Complete aquire colcon tasks")
    return taskList;
}
