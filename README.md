# Adu Layangan

A daily kite fight over an Indonesian kampung, played on Reddit.

## What it is

Every day there is a new sky: a new wind and three rival kite flyers from the kampung. You fly a fighter kite with one finger and use **your own string to cut theirs**. A round lasts 60 seconds, or ends sooner if your string is the one that snaps.

_Adu layangan_ is Indonesian for "kite fighting", a game children play from the rooftops every dry season.

It is for anyone who wants a one-minute game a day, and for communities that want a daily ritual to play together: players fly for one of three kampungs, yesterday's best flight comes back as today's boss, and scores are shared in the day's thread. For moderators, the app runs itself: it posts a new sky every day at 00:00 UTC, and keeps nothing about a player for more than 30 days.

## How to play

- **Hold** anywhere to pull the string: your kite darts where its nose points.
- **Let go** and the string goes slack: your kite spins slowly and drifts with the wind.
- That is how a real fighter kite is steered: let it spin until the nose points where you want, then pull.
- Where two strings cross, they rub. The string moving faster at the crossing saws through the slower one, so cross a rival's string while you pull, and pull when they rub yours. Strings that are crossed but still do no harm.
- A frayed string never mends. The **String** bar shows how much of yours is left.
- A dive is faster than a climb.
- Dive into the roofs and your kite glances off them, frayed. Let go near the roofs and the warm air lifts you back up.
- The wind is weak just above the roofs and strongest high up. The wisps in the sky and the flag show which way it blows.

At the top of the screen, **Time** is how much of the round is left and **String** is how much of your string is left.

If your kite goes down while rivals are still flying, you can stay and watch them fight it out, or go straight to your result. Watching never changes your score.

Before a round you can pick the time of day the sky is drawn in: morning, noon, dusk or night. It is only a look; the wind, the rivals and the scoring are the same.

## Your kite

Tap **Customize** before a round to make the kite yours: pick its shape, its pattern (including the batik motifs _kawung_ and _parang_) and its two colours, and the name you fly under, put together from a kampung title and a nickname, like _Bang Petir_ or _Neng Cilok_. Names are picked from lists, never typed. Your kite and name are kept on your Reddit account.

## Kampungs

Pick a side: **Kampung Hulu** (up the river), **Kampung Hilir** (down the river) or **Kampung Pesisir** (by the sea). Every scored flight you make adds its points to your kampung for the day, and the kampung with the most points wins it. The ready screen shows how the three stand today and who won yesterday, and the result card says what your flight added.

If you like, you can wear your kampung as your user flair in the subreddit, so it shows next to your name in the comments. The game only sets it when you tap **Wear as my flair**, after showing you what it will look like. You can move to another kampung at any time; points you already earned stay with the kampung you flew for.

## Coins

Your first three flights each day earn coins: 10 for every kite you cut, 15 for lasting the round, 25 for clearing the sky, 20 for your first flight of the day, and a little more for every day in a row you play. You start with 100. Coins buy looks in the **Customize** shop (batik and rainbow patterns, twin, tasselled and lantern tails, and gold, neon and rainbow strings), never speed or strength: everyone flies the same sky, so the score is down to skill. The server counts the coins itself by replaying your round, and coins cannot be bought.

## Scoring

|                                             | Points                      |
| ------------------------------------------- | --------------------------- |
| Cutting a rival's string                    | 100                         |
| Cutting Raja Langit, yesterday's best flyer | 300                         |
| Lasting the whole round                     | 150                         |
| Clearing the sky early                      | 150, plus 5 per second left |

Your string is glass-coated (_benang gelasan_): it takes about twice as much rubbing to cut as a rival's string, and wears theirs down faster than theirs wears yours.

Your first three flights each day are the scored ones. The best of those three is the score that is kept. Later flights are practice: they earn no coins and do not replace anyone's recording.

## The rivals

Each day three of the kampung's flyers come out, each with a style:

- **Reckless** comes straight for you from the start.
- **Quick** joins the fight at 0:15.
- **Calm** holds its patch of sky and comes down at 0:30.

Raja Langit flies with them: yesterday's best scored flight, played back as it was flown. Up to two more of yesterday's flights fly beside the king. On a day with no recordings yet, seeded kampung flyers take those three places, and the highest of them wears the crown. A flight you make today can become someone's rival tomorrow. It does not change the sky you are already flying.

The first time you play, one practice kite crosses the middle with no clock. Hold to dart, release to steer. The arrow on your kite shows where the nose points. That flight is not scored.

## Sharing your flight

The result card can post your flight as a short score card, as your own comment, in reply to the day's pinned thread. Before anything is posted you see the exact text and the account it will be posted from, and nothing is posted until you tap **Post comment**. Each flight is posted at most once.

## Status

Made for Reddit's Game of the Day Hackathon. Everything described above works: the flight, the strings and cutting, the kampung rivals, Raja Langit and recorded flights, the daily sky with four times of day, your own kite and name, rounds scored on the server, three scored flights a day, the kampungs and their flair, the cosmetic shop, the result card with today's standings, the score card under the day's thread, the feed card, and a new post every day.

## What is stored

Your kite and name, your kampung, your coins and the looks you bought, your best score of each day, and the recording of that flight. Everything about a player is deleted 30 days after it last changed. The app makes no requests outside Reddit.

## For moderators

Installing the app creates the day's post. To create it by hand, open the subreddit menu and choose **Post today's sky**.

For kampung flair to show next to names, turn on user flair in the subreddit's settings. The app sets each player's flair only when that player asks for it.

## For developers

Requires Node 22.12 or newer.

```bash
npm install
npm test              # flight, cutting and replay tests
npm run dev:local     # the game in a browser at http://localhost:5180/game.html, without Reddit
npm run dev           # playtest on Reddit (needs `npm run login` first)
npm run build         # the bundle Reddit runs
```

```
src/shared/sim/   the kite fight: flight, wind, strings, rivals, the daily sky (runs in the browser and on the server)
src/client/       the web view: feed card (splash) and game; arena/ draws the sky, the kampung and the kites
src/server/       endpoints that run on Reddit's servers
```

The simulation is deterministic: it uses whole-number angles and its own sine table instead of `Math.sin`, so the same taps always produce the same round on every device. The server uses this to score each round by replaying the player's taps.

The string the simulation tests for a touch is the same curve that is drawn (`src/shared/sim/line.ts`), so sparks always sit on the strings you see.

## Reporting a problem

Tap **Report a problem** on the ready screen or the result card. It opens a message to the moderators of the subreddit where you play, with the day already filled in.
