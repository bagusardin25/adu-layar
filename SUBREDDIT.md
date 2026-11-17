# r/AduLayangan

The app players and judges should see is **Adu Layangan**, on **r/AduLayangan**. The playable name in `devvit.json` is `adu-layangan`, and the dev subreddit is `AduLayangan`.

An app that was already uploaded as `tebar-game` cannot be renamed, and neither can `r/TebarGame`. Leave that install as it is. The next upload, when you choose to publish, creates the new app. This repository does not upload by itself.

## Create the subreddit

`u/bagusardin_` is logged in. **r/AduLayangan does not exist yet**, and Devvit 0.15 has no command that creates a subreddit by itself.

`adu-layangan` is a new app name, so Reddit does not know it yet. Playtest stopped with: the app does not exist until `npx devvit init`. That command opens a browser, gives you a code, and registers the new app. It was not run. `devvit upload` and `devvit publish` were not run either.

After the app exists:

```bash
npx devvit playtest AduLayangan
```

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
Adu Layangan is a daily kite fight over an Indonesian kampung. Every day brings a new sky, the same for everyone: new wind, three rival flyers, and Raja Langit, yesterday's best flight. Hold to dart, release to steer, and cross their strings to cut them. Your best of three scored flights is kept.
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

Posts made while the app was still Tebar keep their old titles. New posts are titled `Adu Layangan · Day N · Cut down {Raja Langit}`.
