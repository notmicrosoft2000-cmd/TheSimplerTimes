# THE SIMPLER TIMES

A 1993 floppy disk that is very aware it is running on your machine.

The website is the game's own corner of the internet — a 1990s portal
rendered through a CRT monitor. Press the power button. It boots itself.

- **Site:** https://notmicrosoft2000-cmd.github.io/TheSimplerTimes/
- **Game repo:** https://github.com/notmicrosoft2000-cmd/TheQuestionGame (the game lives at `games/firstcopy`)
- **Downloads:** Windows `.exe`, macOS `.dmg`, Linux — attached to [Releases](https://github.com/notmicrosoft2000-cmd/TheSimplerTimes/releases)

## Building the game

The game source stays in `notmicrosoft2000-cmd/TheQuestionGame` at
`games/firstcopy`. The build workflows in `.github/workflows/` check that
repo out, package the game, and upload the artifacts to this repo's
Releases. Run them from the **Actions** tab (manual `workflow_dispatch`),
or they trigger automatically when a new release/tag is published.

| Platform | Artifact | How |
|----------|----------|-----|
| Linux    | `TheSimplerTimes-linux.tar.gz` | PyInstaller on `ubuntu-latest` |
| Windows  | `TheSimplerTimes-Windows.zip` (contains `.exe`) | PyInstaller on `windows-latest` |
| macOS    | `TheSimplerTimes-macOS.dmg` | PyInstaller + `hdiutil` on `macos-14` |

Requirements: Python 3.12, `pygame`, `numpy`.

## This site

No build step. Static files:

- `index.html` — the portal (views: home, the disk, the bulletin, the inbox, download)
- `css/style.css` — CRT monitor, bezel, scanlines, glitches
- `js/main.js` — boot sequence, power, keyboard nav (TAB / ENTER / digits), the entity's interference
- `img/windowq.png` — icon (shared with the Question Game site)

> THE FIRST COPY WAS NEVER THE DISK. THE FIRST COPY WAS YOU.
