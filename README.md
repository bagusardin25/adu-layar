# Adu Layangan

A daily kite fight over an Indonesian kampung, played on Reddit.

## What it is

Every day there is a new sky: a new wind and three rival kite flyers from the kampung. You fly a fighter kite with one finger and use **your own string to cut theirs**. A round lasts 60 seconds, or ends sooner if your string is the one that snaps.

*Adu layangan* is Indonesian for "kite fighting", a game children play from the rooftops every dry season.

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

Tap **Customize** before a round to make the kite yours: pick its shape, its pattern (including the batik motifs *kawung* and *parang*) and its two colours, and the name you fly under, put together from a kampung title and a nickname, like *Bang Petir* or *Neng Cilok*. Names are picked from lists, never typed. Your kite and name are kept on your Reddit account.

## Coins

Your first three flights each day earn coins: 10 for every kite you cut, 15 for lasting the round, 25 for clearing the sky, 20 for your first flight of the day, and a little more for every day in a row you play. You start with 100. Coins buy looks in the **Customize** shop (batik and rainbow patterns, twin, tasselled and lantern tails, and gold, neon and rainbow strings), never speed or strength: everyone flies the same sky, so the score is down to skill. The server counts the coins itself by replaying your round, and coins cannot be bought.

## Scoring

| | Points |
|---|---|
| Cutting a rival's string | 100 |
| Lasting the whole round | 150 |
| Clearing the sky early | 150, plus 5 per second left |

Your string is glass-coated (*benang gelasan*): it takes about twice as much rubbing to cut as a rival's string, and wears theirs down faster than theirs wears yours.

## The rivals

Each day three of the kampung's flyers come out, each with a style:

- **Reckless** comes straight for you from the start.
- **Quick** joins the fight at 0:15.
- **Calm** holds its patch of sky and comes down at 0:30.

## Status

In development for Reddit's Game of the Day Hackathon. Working now: the flight, the strings and cutting, the three rivals, the daily sky with four times of day, your own kite and name, rounds scored on the server, three coin flights a day, the cosmetic shop, the result card, the feed card, and a new post every day. Coming next: daily standings and streaks on the result card, other players' recorded flights as rivals, and yesterday's best player as the day's boss kite.

## What is stored

Your kite and name, your coins and the looks you bought, and your best score of each day. Everything about a player is deleted 30 days after it last changed. The app makes no requests outside Reddit.

## For moderators

Installing the app creates the day's post. To create it by hand, open the subreddit menu and choose **Post today's sky**.

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

Message the moderators of the subreddit where you play.
