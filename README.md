# VSENDER Live Chat — Windows app

A thin Windows window around https://app.vsender.in/app/live-chat. No keys or customer data are stored here.

## Build a test installer
GitHub → **Actions** → **Build Windows app** → **Run workflow**. After ~5 minutes open the finished run and download **VSENDER-Live-Chat-Windows** (it contains the Setup .exe).

## Publish a release (this is what installed apps auto-update from)
1. Change `"version"` in `package.json` (e.g. 1.0.1) and commit.
2. Create a tag with the same number: in GitHub Desktop → History → right-click the commit → **Create Tag…** → `v1.0.1` → push.
3. The workflow builds and publishes a GitHub Release with the installer. Installed apps update themselves.

## Notes
- The installer is unsigned: Windows shows "Windows protected your PC" → **More info → Run anyway**.
- The website address is in `app-config.js`.
- The app shows Live Chat only (plus sign-in pages). Other website pages open in your normal browser.
- Closing the window keeps the app running in the tray; use the tray menu → Quit to exit.
