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

## The director (Task 94)

The tour photographs places. The director stages a *moment*, films it, checks its own frames and
reshoots on a note. It adds files to this folder and changes nothing in the tour or the town.

```bash
tools/tour/direct.sh tools/tour/scenes/wedding-arch.json                       # stage, film, check, report
tools/tour/direct.sh tools/tour/scenes/wedding-arch.json --note "closer, zoom the camera"
tools/tour/direct.sh tools/tour/scenes/terrace-dusk.json --note night --dry    # try a note without saving it
DIRECT_BUILD=1 tools/tour/direct.sh ...                                        # rebuild web/dist first
```

**The script is the scene file** (`scenes/*.json`): Gaius's spot and heading, Aelia's mark (and `via`
waypoints she walks through, e.g. a doorway), the clock (`rome` "HH:MM", `golden`, or `elev` = the
evening sun's elevation in degrees), the weather, the wedding dressing (`wedding`, `celebrate`), the
camera (`zoom`, `pitch`, `yawOffset`) and what must be in frame (`require`, with extra `subjects`).
A note edits that file in place (`closer`, `wider`, `lower`, `higher`, `left`, `right`, `night`,
`midday`, `dusk`, `rain`...) and keeps the note and what it changed in `notes`; a note the director
does not understand reshoots the scene unchanged and says so. `--dry` leaves the file alone.

**What it does:** puts the page in walk mode with a visit open (so Aelia takes `goto`), sets the sky
(Date shim, as the tour), places Gaius through `restoreResume` (collision-resolved, camera set), walks
Aelia to her mark, waits for the network to go quiet, hides every overlay, and shoots a burst of 4
frames (`takeN-f1..4.png`, plus a GIF clip when ffmpeg is on the box).

**What it checks before it reports** (`director-log.md`, `director-log.json`):

| check | flags |
|---|---|
| black / flat / near-black / blown-out frame | the tour's thresholds, plus "over half the frame is chalk white" |
| nothing happening | the burst's frames do not move (mean luma difference under 0.06%) |
| subject out of frame, cut by the edge, behind the camera, too small | Gaius, Aelia and extra subjects are projected with the walk camera's own model (fov 52, 4.0 m back, 1.85 m up, 1.2 m look-ahead on a landscape frame) |
| one person hidden behind the other | their screen centres are under 8% of the width apart |
| Gaius not visible where he stands | his deep-red cloak is missing from the shoulder or hem band of his projected body: scenery stands between the camera and him |
| Aelia not at her mark | more than 2.5 m off (she stops short when her path is blocked) |

A flagged take is **reshot automatically** where there is a fix (pull the zoom back for a subject out of
frame, closer for a tiny one, close in past scenery, move Aelia's mark away from his line), up to
`--retries` (2). A reshoot that works is saved into the scene file as "(director's own reshoot)". A frame
that still fails ends the run as **FLAGGED, do not show as a good frame** (exit code 1).

**What it cannot see:** it knows where the subjects are, not what the scene looks like. Scenery
covering Aelia is invisible to it (only Gaius's cloak is a known colour), and so is a blown-out stone
face, an ugly sky or a creature standing in the shot (a wolf stood beside them on the terrace). The
log is the first review, a human glance at the frames is still the last.

Tests: `bun test tools/tour` (and `python3 -I tools/tour/director.py --self-test`): a black frame, a
flat frame, a subject out of frame, a person hidden behind the other, a frame where nothing moves and
a missing cloak are each caught; a good frame passes; notes edit the script.
