# Change Log

All notable changes to the "colcon-helper" extension will be documented in this file.

## [0.2.0]

- Commands for enabling/disabling task detection for workspace folder with QuickPick for target ROS2 version
- Configuration options `colcon.rosInstallPath.<platform>` for installed ROS2 discovery.
- Simple task resolver implementation.
This eleminates warning popup if you have `colcon` tasks defined in your `tasks.json` while `colcon.provideTasks` is set to `false`.
- Run task (`ros2 launch` by default) and all related configuration options are deprecated in favor of User/Workspace or local level `tasks.json`.
User/Workspace tasks are available since VS Code 1.42
- Default `globalSetup` config option is now empty list.
It is recommended to add global ROS `setup` to your `workspaceSetup` instead, so you can configure several workspaces for different target ROS versions.

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
