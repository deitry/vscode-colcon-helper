# Colcon

Extension is intended to simplify use of `colcon` command line tool.

It provides tasks for `colcon` workspace and automatically run setup scripts in order to correctly adjust environment.

## How to use

1. Enable tasks by running command `Colcon: Enable Tasks for current Workspace` or manually set `colcon.provideTasks` to `true`.
2. If default options doesn't suit your workspace, you may configure `colcon.globalSetup` and `colcon.workspaceSetup` lists of `setup` files.
3. Run `Colcon: Refresh Environment` command to complete environment set up for your workspace.
4. Now open yout task list and run any task you want!

### Available tasks

Tasks provided at the moment:

Workspace level:
- `colcon: build`
    Do exactly the same as command-line `colcon build`
- `colcon: test`
- `colcon: test-result`
    similarily to `build`
- `colcon: clean` that is simple call to `rm -f build install`

Two tasks specially for current editor:
- `colcon: build <current package>` - like
- `colcon: launch <current file.launch.py>` that is by default calls `ros2 launch ./<current file>` command

First three commands use `colcon` as executable being launched, yet the last two could be configured with `colcon.runCommand` and `colcon.cleanCommand` settings.

By default tasks are runned using corresponding workspace folder as working directory but this could be configured via `colcon.colconCwd` option.

## Colcon tool

`colcon` (_COLlective CONstruction_) is the command line tool that is known as default build system for ROS2. It may be used as build tool for literally any project (but as far as I know only CMake and Python `setuptools` are supported directly).

- More on `colcon`: https://colcon.readthedocs.io/en/released/
- ROS2 overview page: https://index.ros.org/doc/ros2/
- Building ROS2 packages with `colcon`: https://index.ros.org//doc/ros2/Tutorials/Colcon-Tutorial/


### A little bit on workspaces

Main goal of `colcon` is to build packages in the order based on their dependecies.

`colcon` build system suppose that you separate your source files in the different workspaces while each of those contain any number of packages. As for ROS2, you may consider each ROS2 repo as different `colcon` workspace and work with each individually - or put all repos in the large `src` folder and build them all at once.

When you develop packages in VS Code, you may want to get access to several `colcon` workspaces within single VS Code workspace - it is possible with VS Code multi-root workspace feature. Each `colcon` workspace that you want to work with would be a different workspace folder inside VS Code.

This extension allows you to set up settings for each folder individually, whether you want to use it with `colcon` or not. Any changes to settings in nested folders may override settings for workspace folder, but it is recommended to set up `colcon` only in upper level folders.

### Sourcing workspaces

When you build your workspace (I mean, `colcon` workspace, not VS Code one), there is two folders are being created: `build/` and `install/`. As their names imply, the first one contains build files and the second contains final packages.

In order to make your package discoverable you **must** source special file depending on your platform and shell. There are several files created during `colcon build` command and for Linux with Bash the correct file would be `install/setup.sh`. (See available setup files in `install/` if you use another platform/shell.)

This extension helps you to source workspace with just one command named `Refresh colcon environment`. You may list any necessary workspaces with two settings: `colcon.globalSetup` and `colcon.workspaceSetup`. You can add any setup file paths to either of lists. It is considered that `globalSetup` lists all workspaces that would be used with any colcon workspace - like `/opt/ros/dashing/setup.sh` - while `workspaceSetup` contains only local `install/setup.sh` and other workspaces that are needed to build this exact workspace.

As a special bonus, with this you can specify literally any file, not just `colcon` setups. For example, you may want to source `/home/user/.bashrc` in every your `colcon` workspace and therefore you should add it to your `colcon.globalSetup` list.

By default there is only `/opt/ros/dashing/setup.sh` in the `globalSetup` and `install/setup.sh` in the `workspaceSetup`. If you use e.g. ZSH as your `terminal.integrated.shell`, you must explicitely set corresponding setup file extension as `.zsh`.

---

## More info about extension

### Enabling extension

By default extension do nothing until you explicitly set `"colcon.provideTasks": true` in workspace or folder VS Code settings. If you use multi-root workspace, it is highly recommended to set `colcon` settings in each workspace folder individually.

After you set `provideTask` option, you will get `colcon` tasks in the task list based on the default settings. Tasks are collected only for workspace folder that is parent to document in current editor.

There may be no tasks if you open task list for document outside your workspace, yet there may be tasks for all of your workspace folders if there is no current editor.

### `Refresh colcon environment` command

After you build your project, in order to get your newest packages being discovered you must refresh your environment. This could be done by launching such command in VS Code command panel.

Command sources all of your workspaces that you listed in `colcon.globalSetup` and `colcon.workspaceSetup` then put correct environment variable values in file specified by `colcon.env` configuration setting. This file would be transferred to each task before execution.

If you find out there is some variable missing, you can add it through `colcon.defaultEnvironment` or you may change environment file manually. In the last case your changes would be overwritten in the next `Refresh` command execution.

NOTE that this command may run automatically if either of `colcon.refreshOnStart`, `colcon.refreshOnTasksOpened` or `colcon.refreshOnConfigurationChanged` is set to `true`.

### Tasks configuration via `settings.json`

Each command has corresponding `args` setting like `colcon.buildArgs`. These args are inserted right after
the command. In the case of `build` the default value is `['--symlink-install']` (more on argument meaning see `colcon` documentation or `--help` page).

If you open `*.launch.py` file, you'll get `colcon: launch` command which actually have no relation to `colcon`, but is very useful for ROS2 workspaces. It launches
- `ros2 launch *.launch.py`
    - `ros2` = could be configured with `colcon.runCommand` option
    - `launch` = could be configured with `colcon.runArgs`

### Chaining tasks

By default each task is run independently. But in some cases you may want to run command in chains. You may use VS Code `tasks.json` to customize your `colcon` tasks and integrate with your other tasks. Example on how to automatically run `colcon test` before `test-result` when you run the latter:
```json
{
    "type": "colcon",
    "task": "test-result",
    "problemMatcher": [],
    "dependsOn": [
        {
            "type": "colcon",
            "task": "test"
        }
    ]
}
```

---

## Disclaimer

Extension is in slow development and there may be divergencies between this file, help tooltips and actual code. Feel free to ask anything and open issues.

Contact me at:
- https://github.com/deitry/vscode-colcon-helper/issues
- dm.s.vornychev@gmail.com
