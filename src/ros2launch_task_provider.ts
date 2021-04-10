import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { ros2launch } from "./common";
import { config } from './extension';
import { taskPresentation } from './tasks';

export class Ros2LaunchTaskDefinition {
    type: string = ros2launch;
    file: string;

    launchArgs?: string[];
    rosPackage?: string;
    runFileArgs?: string[];

    constructor(file: string) {
        this.file = file;
    }
}

export function createRos2LaunchTaskProvider() {
    return {
        provideTasks: () => {
            let tasks: vscode.Task[] = [];

            // run current launch file
            let active = vscode.window.activeTextEditor;
            if (!active) return;

            let wsFolder = vscode.workspace.getWorkspaceFolder(active.document.uri);
            if (!wsFolder) return

            if (active.document.uri.fsPath && active.document.uri.fsPath.endsWith('.launch.py')) {
                let fileName = active.document.fileName;
                if (fileName.startsWith(wsFolder.uri.fsPath)) {
                    // get path relative to wsFolder, because absolute paths somehow could not be treaten by ros2 launch
                    let basename = '.' + fileName.substr(wsFolder.uri.fsPath.length);
                    let args = ['launch'];
                    let hasDebug = false;

                    config.runArgs.forEach(element => {
                        if (element.includes('--debug')) hasDebug = true;
                    });

                    if (hasDebug) args = args.concat('--debug');
                    args = args.concat(basename).concat(config.runFileArgs);

                    let execOptions: vscode.ProcessExecutionOptions = {};
                    execOptions.env = dotenv.parse(fs.readFileSync(config.env));

                    let task = new vscode.Task(
                        new Ros2LaunchTaskDefinition(fileName),
                        wsFolder, fileName, ros2launch,
                        new vscode.ProcessExecution('ros2', args, execOptions), []);

                    // use same presentation option as base colcon tasks
                    task.presentationOptions = taskPresentation;

                    tasks = tasks.concat(task);
                }
            }

            return tasks;
        },

        resolveTask(_task: vscode.Task) {
            if (_task.definition.type == ros2launch) {
                const definition: Ros2LaunchTaskDefinition = <any>_task.definition;

                let args = ["launch"];
                if (definition.launchArgs) args = args.concat(definition.launchArgs);
                if (definition.rosPackage) args = args.concat(definition.rosPackage);
                args = args.concat(definition.file);
                if (definition.runFileArgs) args = args.concat(definition.runFileArgs);

                let execOptions: vscode.ProcessExecutionOptions = {};
                execOptions.env = dotenv.parse(fs.readFileSync(config.env));

                let task = new vscode.Task(
                    definition,
                    _task.scope ? _task.scope : vscode.TaskScope.Workspace,
                    definition.file,
                    definition.type,
                    new vscode.ProcessExecution(
                        "ros2", args, execOptions
                    ), []
                );

                // use same presentation option as base colcon tasks
                task.presentationOptions = taskPresentation;
                return task;
            }

            return undefined;
        }
    }
}
