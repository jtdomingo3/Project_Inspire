# Windows Installer Guide

This guide explains how to create a new Windows installer for Project INSPIRE after making app changes.

## What the installer does

- Builds the Electron desktop installer for Windows.
- Uses a high-resolution taskbar/app icon generated from `frontend/public/icon.png`.
- Offers an assisted install flow where the user can choose a per-user or per-machine installation.
- Starts the app after installation so the built-in first-run setup screen can create either:
  - one admin account only, or
  - one admin account plus one teacher/user account.

The initial account creation is handled by the app itself on first launch. That is where the admin/user account setup happens.

## Recommended build flow

Run these commands from the repository root:

```powershell
npm install
npm run build:installer
```

That command sequence will:

1. Generate `frontend/public/icon-taskbar.ico` from `frontend/public/icon.png`.
2. Build the Angular frontend.
3. Package the Windows installer with electron-builder.

## Output location

The installer is written to:

```text
dist/installer-output/
```

The file name follows the version in `package.json`, for example:

```text
Project INSPIRE-Setup-1.0.0.exe
```

## Before creating a new installer version

1. Update the app version in `package.json`.
2. Make sure the icon source still exists at `frontend/public/icon.png`.
3. Re-run:

```powershell
npm run build:installer
```

## Installer behavior notes

- The installer is assisted, not one-click.
- The user can select installation mode during setup:
  - install for the current user
  - install for all users with elevation
- If the app is opened for the first time with no accounts, the first-run setup screen appears automatically.
- The setup screen supports:
  - Admin only
  - Admin + user
- Reference documents and the difficulty library remain part of the app by default because they are packaged with the app and loaded on first run.

## If you change the icon

If `frontend/public/icon.png` changes, regenerate the Windows ICO before packaging:

```powershell
npm run icon:win
npm run build:installer
```

## Troubleshooting

- If the installer build fails because the app version was already installed, uninstall the old version and rebuild.
- If icon changes do not appear, delete `frontend/public/icon-taskbar.ico` and re-run `npm run icon:win`.
- If the app launches without the setup screen, remove the local app data directory for Project INSPIRE and launch again so first-run setup can initialize.
