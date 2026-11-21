# r/AduLayangan

The app players and judges should see is **Adu Layangan**, on **r/AduLayangan**, a public subreddit. The app's name in `devvit.json` is `adu-layangan`. Its private playtest subreddit, made by the Devvit CLI on the first upload, is **r/adu_layangan_dev**; `devvit.json` names it as the dev subreddit, so `npm run dev` never touches the public one.

An app that was already uploaded as `tebar-game` cannot be renamed, and neither can `r/TebarGame`. Leave that install as it is. The next upload, when you choose to publish, creates the new app. This repository does not upload by itself.

## Deploy, in order

The app must run on Reddit to be judged. Uploading and installing are done from this folder with the Devvit CLI, logged in as the app's owner (`npx devvit whoami`).

1. **Create r/AduLayangan** on reddit.com: a public community. It must stay under 200 members while the app is unpublished. The CLI cannot create a subreddit.
2. **Register the app.** Done: the first `npm run deploy` opened the app wizard, registered `adu-layangan` (https://developers.reddit.com/apps/adu-layangan) and made r/adu_layangan_dev. That first upload also rewrites `package.json`'s licence to BSD-3-Clause; it is set back to `UNLICENSED`.
3. **Check and upload.** `npm run deploy` runs the typecheck, the linter and the tests, then `devvit upload`. Upload only; do not run `devvit publish` for the hackathon.
4. **Install it:** `npx devvit install r/AduLayangan`. Installing posts today's sky. If no post appears, use the subreddit menu, **Post today's sky**.
5. **Turn on the settings below**, then open the day's post on a phone and try a flight, **Share**, **Wear as my flair**, **Enter my kite** and **Report a problem**.
6. **Try changes in private first.** `npm run dev` playtests in r/adu_layangan_dev: a fresh build on every save, with the logs streamed. Update r/AduLayangan only with a version that works there, at most once a day: `npm run deploy`, then `npx devvit install r/AduLayangan`.

An install named `tebar-game` on `r/TebarGame` cannot be renamed. Leave it.

## Settings to turn on

- **User flair:** Mod Tools → User flair → turn on user flair, so a player's kampung shows next to their name. The app sets a player's flair only when that player taps **Wear as my flair**.
- **Modmail** stays open: **Report a problem** in the game opens a message to the subreddit's moderators.

## Title

```text
Adu Layangan: a daily kite fight
```

## Description

```text
A daily kite fight over an Indonesian kampung. Every day brings a new sky, the same for everyone. Hold to dart, release to steer, and cross your rivals' strings to cut them. Fly for your kampung, cut down Raja Langit (yesterday's best flight), and vote for the kite it flies tomorrow.
```

## Sidebar

```text
**A daily kite fight over an Indonesian kampung.**

Every day at 00:00 UTC there is a new sky, the same for everyone: a new wind, three rival kite flyers, and Raja Langit, yesterday's best flight played back.

**How to fly**

* **Hold** to dart: your kite goes where its nose points. The arrow shows that direction.
* **Release** to steer: the kite spins until the nose is where you want it.
* Where strings cross, the faster one saws through the slower.

**Scored flights.** Your first three flights each day can earn coins. Your best of those three is the score that is kept. Later flights are practice.

**Share** your flight from the result card. It posts under the day's thread.

**Raja's kite.** Enter your kite from the game. The kite with the most upvotes in the day's kite contest is the one Raja Langit flies tomorrow.

*Adu layangan* is Indonesian for "kite fighting", played from the rooftops every dry season.
```

## Submission text

```text
Share your flight card, the rival who cut you, or a kite you are proud of.
```

## App page

The long description is `README.md`. The one-line description:

```text
A daily kite fight: fly your kite with one finger and cut your rivals' strings over an Indonesian kampung.
```

## Old posts

Posts made while the app was still Tebar keep their old titles. New posts are titled `Adu Layangan · Day N · Cut down {Raja Langit} · {Kampung} won yesterday`; the last part is left out when no kampung won the day before.
