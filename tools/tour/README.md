# Town tour (Task 90)

A walkthrough that photographs the town place by place, day and night, so a
build can be looked at without walking it. It writes screenshots and a log; it
does not diff them (the look-at-your-own-output step compares them).

## Run it

```bash
tools/tour/run.sh              # builds web/dist, serves it locally (pglite), tours it, stops the server
tools/tour/run.sh --golden     # adds a golden-hour pass
tools/tour/run.sh --only forum,baths --passes day night    # a quick look
TOUR_SKIP_BUILD=1 tools/tour/run.sh                        # reuse the existing web/dist
```

Needs Playwright (Python) with the box's wrapper `~/work/playwright-syslibs/playwright-env.sh`,
and the complete licensed assets in `client/src/assets/` (the build is of the real town).
A full tour is slow: the software renderer loads the scene in about 1.5 minutes and each
shot takes several seconds.

Output: `tools/tour/out/<stamp>/` (gitignored): `NN-<place>-<pass>.png`, `tour-log.md` and
`tour-log.json`. Exit code 0 means every place got every shot with nothing flagged.

## What it does

- The place list comes from the town's own data (`client/src/tourPlaces.ts`): every house in
  `PLACES`, the scene's named anchors and every bench/seat (`TownSceneHandle.tourData`), plus
  landmarks kept as constants (Colosseum, the temple's cella, home, the cliff path). A new
  place or seat is visited without editing the tour; its camera facing defaults to the town's
  middle until `TOUR_LOOK` names one.
- Gaius is placed through the scene's own collision (`restoreResume`). If he ends up more than
  1.5 m from the requested spot, the place is flagged "walker cannot stand here".
- The clock is overridden in the page (Date shim) and the sun is snapped there
  (`tourSnapSky`), so each pass sets its time instead of waiting: day 12:00, night 23:30 Rome,
  golden = the first evening time with the sun inside the town's golden window. The log's
  "Time and sky" section records the sun elevation and phase the town really reached. If the
  golden window cannot be found that day the pass is skipped and the log says so.
- Weather is pinned to clear for the tour, and the page's overlays (menu, pad, panels) are
  hidden for each shot (`--hud` keeps them).
- Flags: a place that fails to load or shoot, a black or flat frame, a spot the walker cannot reach.

## The hook, and the live site

The page offers `window.__townTour` only when its address has `?tour` (the script adds it). That
is the one change to the town code (`exposeTour` in `tourPlaces.ts`, one call in `App.tsx`, and
`tourData` / `tourSnapSky` on the scene handle). It ships with the next approved deploy.
Pointing the tour at the live site works once that deploy is out:

```bash
python3 tools/tour/tour.py --url https://town.reseed.net/    # via ~/work/playwright-syslibs/playwright-env.sh
```

Before then the live site has no hook and the tour reports "the town did not load" for it.

## Tests

`bun test tools/tour` runs the place-list test and the tour's self-test (`tour.py --self-test`,
no browser): the frame and reach checks, and that a tour over a list writes every shot and says
so in its log.
