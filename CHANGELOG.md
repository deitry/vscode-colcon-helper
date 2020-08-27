# Change Log

All notable changes to the "colcon-helper" extension will be documented in this file.

## [1.0.2]

- Fixed passing env file when creating tasks, thanks https://github.com/richarddan
- Remove 'experimental' label from 'foxy'

## [1.0.1]

- Merged PR by https://github.com/fpasch that adds additional `--packages-up-to` build command.

## [1.0.0]

- Commands for enabling/disabling task detection for workspace folder with QuickPick for target ROS2 version.
QuickPick is displayed only if you have no workspaceFolder-level `workspaceSetup`.
- Configuration options `colcon.rosInstallPath.<platform>` for installed ROS2 discovery.
- Task resolver implementation.
If you save tasks in `tasks.json`, they will be displayed even with `provideTasks` set to `false`.
- Tasks settings (such as `runCommand` and `buildArgs`) are deprecated in favor of User/Workspace or local level `tasks.json`.
Now you can configure each task individually right in `tasks.json`.
User/Workspace tasks are available since VS Code 1.42
- `ros2 launch` get its own task type instead of `colcon run`.
You can setup more than one `launch` command and configure them more precisely.
- `custom` task type. Now you can create your own command that will use the same environment.
- Default `globalSetup` config option is now empty list.
It is recommended to add global ROS `setup` to your `workspaceSetup` instead, so you can configure several workspaces for different target ROS versions.

- TODO: README.md is not updated yet

## [0.1.3]

- Relative path resolve for new version of `colcon list` output

## [0.1.2]

- No need to choose workspace folder if there is only one.
- Do not show error if there is no opened folders at all.

## [0.1.1]

- Updated manifest
- Do not scan for packages if workspaceFolder `colcon.provideTasks` is not set or false.

## [0.1.0]

- `ros2 launch` on active file if it ends with `.launch.py` and is inside colcon workspace folder

## [0.0.9]

- Build commands now always ask for workspace folder

## [0.0.8]

- Build commands via command panel
- Build task/cmmand for current or arbitrary choosed package

## [0.0.7]

- Ability to build single package in which current opened document is located.

## [0.0.6]

- Description and howtos in README.md
- `colcon` icon

## [0.0.5]

- Improved multi-root workspace support

## [0.0.4]

- Support colcon running in multi-root workspaces.
Almost any folder settings for colcon will be respected.

## [0.0.3]

- Next iteration on possibility to source arbitrary files: `userSetup` is gone,
`workspaceSetup` and `globalSetup` are lists now.
- Separated option to pass arguments to launch file

## [0.0.2]

- Added `userSetup` option as possibility to source arbitrary file like `.bashrc`

## [0.0.1]

- Initial release
