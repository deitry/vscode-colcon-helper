import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { colcon_ns, colcon_exec } from "./common";
import { config, actualizeConfig } from './extension';
import { getColconTasks } from './tasks';

export class ColconTaskDefinition {
    type: string = colcon_ns;
    task: string;
    name: string;

    command?: string;
    args?: string[];

    constructor(task: string, command?: string, args?: string[]) {
        this.name = task;
        this.task = task;
        this.args = args;

        if (command && command != colcon_exec) {
            this.command = command;
        } else if (this.task == "clean") {
            this.command = "rm";
        }

        if (args) {
            this.args = args;
        } else if (this.task == "build" || this.task == "test" || this.task == "test-result") {
            this.args = [this.task];
        } else if (this.task == "clean") {
            this.args = ["-r", "--verbose", "build", "install"];
        }
    }
}

export function createColconTaskProvider() {
    return {
        provideTasks: () => {
            if (config) config.log("Start providing tasks");

            let taskList: vscode.Task[] = [];
            let makeTasksForFolder = (wsFolder: vscode.WorkspaceFolder) => {
                actualizeConfig(wsFolder);
                taskList = taskList.concat(getColconTasks(wsFolder));
            }

            let active = vscode.window.activeTextEditor;
            let activeWsFolder: vscode.WorkspaceFolder | undefined = undefined;
            if (active) {
                activeWsFolder = vscode.workspace.getWorkspaceFolder(active.document.uri);
            }

            if (activeWsFolder) {
                makeTasksForFolder(activeWsFolder);
            } else if (vscode.workspace.workspaceFolders) {
                vscode.workspace.workspaceFolders.forEach(makeTasksForFolder);
            }

            return taskList;
        },

        resolveTask(_task: vscode.Task) {
            if (_task.definition.type == colcon_ns) {
                const definition: ColconTaskDefinition = <any>_task.definition;

                let execOptions: vscode.ProcessExecutionOptions = {};
                execOptions.env = dotenv.parse(fs.readFileSync(config.env));

                return new vscode.Task(
                    definition,
                    _task.scope ? _task.scope : vscode.TaskScope.Workspace,
                    definition.task,
                    definition.type,
                    new vscode.ProcessExecution(
                        definition.command ? definition.command : colcon_exec,
                        definition.args ? definition.args : [],
                        execOptions),
                    []
                );
            }

            return undefined;
        }
    };
}
