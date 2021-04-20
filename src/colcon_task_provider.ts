import * as fs from 'fs';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { colcon_ns, colcon_exec } from "./common";
import { config, actualizeConfig } from './extension';
import { getColconTasks } from './tasks';

export class ColconTaskDefinition {
    type: string = colcon_ns;
    name: string;

    /** command to run */
    command: string;

    /** arguments */
    args: string[];

    constructor(taskName: string, command: string, args: string[]) {
        this.name = taskName;
        this.args = args;
        this.command = command;

        if (!args) {
            config.error(`args must be specified for task \`${taskName}\``)
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
                    _task.scope ?? vscode.TaskScope.Workspace,
                    definition.name ?? _task.name,
                    definition.type,
                    new vscode.ProcessExecution(
                        definition.command ?? colcon_exec,
                        definition.args ?? [],
                        execOptions),
                    []
                );
            }

            return undefined;
        }
    };
}
