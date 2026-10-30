# Show Caller

Offline contest run sheet for calling the show from an iPhone. It is a web app you add to the Home Screen; it opens full screen like a regular app. It never plays sound.

## Google Sheet (Competition Tracker, tab `Sheet1`)

One row per competitor. Row 1 is the header row (already filled in):

| Type | Order | Name | Song 1 Title | Song 1 Length | Song 1 Lighting | Song 2 Title | … up to Song 20 |
|---|---|---|---|---|---|---|---|
| Chorus | 1 | Harmony Heights Chorus | Ballad | 3:20 | Lavender | Uptune | |
| Quartet | 1 | Four Chord Quartet | Ballad | 2:50 | | | |

- **Type**: `Chorus` or `Quartet`. The app shows one type at a time; pick it in the menu.
- **Order**: order of appearance, as a number. Text slots also work: `Mic Tester` always sorts first, and any other text (such as `Swan Set`) sorts after the numbers.
- **Song count** is worked out from how many song titles are filled in.
- **Length**: type `3:20`. Sheets may turn it into a time (3:20:00); the app reads that correctly.
- **Lighting** (optional): the cue sheet color, such as `Blue` or `Light Pink`. It shows under the song name with a color dot. Leave blank for no special lighting.
- Delete the `SAMPLE` rows before contest day.

The sheet must be shared as **Anyone with the link → Viewer** for the phone to read it. Nobody can edit it that way, but anyone holding the link can view it.

The app reads the first tab unless the link in Settings ends in `#gid=…`, which picks that tab. Copy the link while the tab you want is open.

The sheet link is not stored in the code (the GitHub repo is public). Paste it once on the phone: ☰ → Settings → Google Sheet link.

## Hosting (GitHub Pages)

1. Sign in at github.com, click **+** → **New repository**, name it `show-caller`, set it to **Public**, and click **Create repository**.
2. On the empty repo page, click **uploading an existing file**, drag in every file from this folder, and click **Commit changes**.
3. Go to **Settings** → **Pages**. Under **Branch**, pick `main` and `/ (root)`, then **Save**. After 1–2 minutes the app is at `https://YOUR-USERNAME.github.io/show-caller/`.
4. On the iPhone, open that address in Safari, tap **Share** → **Add to Home Screen**, keep **Open as Web App** on, and tap **Add**. Always launch it from the Home Screen icon.

To update later, upload the changed files to the repo the same way.

## Using the app

- **☰ menu**: choose Chorus or Quartet, tap **Sync from Google Sheet**, jump to any competitor. Sync only when you have signal; everything is stored on the phone afterward.
- **Swipe left/right**: next or previous competitor. All four bottom buttons go back to red.
- **Start / Pause / Resume** each song timer. The song name and clock turn red at 0:05 and the timer stops at 0:00. A song with no length counts up from 0:00 instead (no red, no stop). **Reset** appears when a timer is paused or done.
- A timer keeps running if you swipe away; the header shows "▶ Timer running on #N".
- **Bottom buttons**: tap to turn green, tap again to turn back to red.
- **Green dot** next to the menu button means the screen is being kept awake. If it is gray, tap anywhere.

## Updating the app

After changing any file, raise `CACHE` in `sw.js` (for example `showcaller-v9` → `showcaller-v10`) and push. When the open app finds the new version, it shows **Update ready · tap to load** under the competitor name. It never reloads by itself, and running timers survive the reload. If `parseSheet` changes what it stores, also raise `DATA_VERSION` in `app.js`; the app then re-syncs on its own the next time it opens with signal.
