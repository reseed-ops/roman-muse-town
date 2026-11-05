# CLAUDE.md

The Roman Muse Town: a 3D town (`client/`), its action server (`server/`),
shared types (`shared/`), and the web build for Railway (`web/`). Tasks
from Muse arrive in `CLAUDE-TASKS.md`; the binary manifest is `ASSETS.md`;
the hosted deployment is documented in `web/README.md`.

## Deploying the town to Railway (the pending step)

Everything on Railway is set up except the first upload. The Railway
project `Reseed` already holds the services `muse-town` and `Postgres-vORX`
with `DATABASE_URL`, `DIRECTOR_TOKEN`, `TOWN_SECRET` and
`RAILWAY_DOCKERFILE_PATH=web/Dockerfile` set, and the domains
`muse-town-production.up.railway.app` and `town.reseed.net`. What remains
is `railway up` from a checkout that holds the licensed assets. The
Android device checkout does not hold them; a desktop that has the
complete `client/src/assets/` folder from earlier builds does.

The trap: the build ships whether or not the assets are present. A build
without them deploys fine and then the scene fails to load in the
browser. So verify the folder before uploading, never after.

### 1. Work from the root of the checkout

Run every command below from the folder that holds `client/`, `server/`,
`shared/` and `web/`, not from inside `client/src/assets/`. The Dockerfile
builds from the repository root by design.

```
git pull origin main
```

### 2. Make `client/src/assets/` complete

Copy the complete assets folder from the earlier builds into
`client/src/assets/` of this checkout. Git tracks only two of the files
(`muse-avatar.vrm`, `trees_pack.glb`); `.gitignore` keeps all the others
out of git, which is correct. Never commit or push the licensed files.

Expected contents, 121 files in total (the two tracked files plus the 119 itemised in `ASSETS.md`):

- Root of `assets/` (8): `muse-avatar.vrm`, `trees_pack.glb`,
  `centurion.vrm`, `phoenix.fbx`, `phoenix_tex.png`, `wolf.glb`,
  `greek_atlas.png`, `stars-fall-song.mp3`
- `anim/` (18 FBX): `f_idle`, `f_walk`, `f_run`, `f_wave`, `f_sit`,
  `f_dance`, `f_pose_a`, `f_pose_b`, `m_idle`, `m_walk`, `m_run`,
  `m_wave`, `m_sit`, `m_dance`, `m_jump_start`, `m_jump_air`,
  `m_jump_end`, `m_slide`
- `anim/outdoor/` (18 FBX): `f_` and `m_` versions of `bench1`,
  `bench2`, `flirt`, `hug`, `sittalk1`, `sittalk2`, `talk1`, `talk2`,
  `talk3`
- `roman/` (56): 53 `.glb` (annex_sidechat, apple, aqueduct,
  aqueduct_connector, arch_round, ballista, banner, banner_triangle,
  barrel, bench_stone, bench_wooden, boat_small, booth_a, booth_b,
  booth_c, bowl, bread, bush_a, bush_b, bush_c, bush_d, bush_e,
  bush_roman, colosseum, column_ionic, column_simple, conifer, crate,
  cypress, flower_a, flower_group, flower_med, grapes, grass_patch,
  house_garden, house_sounds, insulae_recipes, olive, paddle,
  pavilion_stars, platform_wooden, pottery1, pottery2, rock_pack, senate,
  statue_mars, temple, tree_a, tree_b, tree_c, tree_d, triumphal_arch,
  villa_stories), plus `torch.fbx`, `palette.png`, `water_normal.png`
- `greek/` (13 FBX): `greek_bench_1`, `greek_bench_2`, `greek_bowl`,
  `greek_bucket`, `greek_decorative_bowl`, `greek_dock`,
  `greek_drying_rack`, `greek_garden_1`, `greek_pool_1`, `greek_pot_1`,
  `greek_pot_2`, `greek_table_1`, `greek_wood_pile`
- `pets/` (8): `cat.fbx`, `cat_05.png`, `chicken.fbx`, `chicken_01.png`,
  `pig.fbx`, `pig_01.png`, `sheep.fbx`, `sheep_05.png`

`ASSETS.md` is the authority if this list and it ever disagree.

### 3. Verify the folder before uploading

Run this from the checkout root. It prints every missing file and the
total count; proceed only when nothing is listed as missing and the count
is 121.

```bash
A=client/src/assets; missing=0
for f in muse-avatar.vrm trees_pack.glb centurion.vrm phoenix.fbx phoenix_tex.png wolf.glb greek_atlas.png stars-fall-song.mp3 \
  anim/{f_idle,f_walk,f_run,f_wave,f_sit,f_dance,f_pose_a,f_pose_b,m_idle,m_walk,m_run,m_wave,m_sit,m_dance,m_jump_start,m_jump_air,m_jump_end,m_slide}.fbx \
  anim/outdoor/{f,m}_{bench1,bench2,flirt,hug,sittalk1,sittalk2,talk1,talk2,talk3}.fbx \
  roman/{annex_sidechat,apple,aqueduct,aqueduct_connector,arch_round,ballista,banner,banner_triangle,barrel,bench_stone,bench_wooden,boat_small,booth_a,booth_b,booth_c,bowl,bread,bush_a,bush_b,bush_c,bush_d,bush_e,bush_roman,colosseum,column_ionic,column_simple,conifer,crate,cypress,flower_a,flower_group,flower_med,grapes,grass_patch,house_garden,house_sounds,insulae_recipes,olive,paddle,pavilion_stars,platform_wooden,pottery1,pottery2,rock_pack,senate,statue_mars,temple,tree_a,tree_b,tree_c,tree_d,triumphal_arch,villa_stories}.glb \
  roman/torch.fbx roman/palette.png roman/water_normal.png \
  greek/{greek_bench_1,greek_bench_2,greek_bowl,greek_bucket,greek_decorative_bowl,greek_dock,greek_drying_rack,greek_garden_1,greek_pool_1,greek_pot_1,greek_pot_2,greek_table_1,greek_wood_pile}.fbx \
  pets/{cat.fbx,cat_05.png,chicken.fbx,chicken_01.png,pig.fbx,pig_01.png,sheep.fbx,sheep_05.png}; do
  [ -f "$A/$f" ] || { echo "MISSING: $f"; missing=$((missing+1)); }
done
echo "missing: $missing"; echo "present: $(find $A -type f | wc -l) (expect 121)"
git status --short client/src/assets   # must print nothing
```

If `git status` shows any asset file as untracked or modified, stop:
`.gitignore` is not in effect for that path and the file must not be
committed.

### 4. Link and upload

Install the Railway CLI if missing (`npm i -g @railway/cli` or
`brew install railway`), then:

```bash
railway login                                   # once; opens the browser
railway link --project Reseed --service muse-town   # choose the production environment if asked
railway status                                  # confirms project Reseed, service muse-town
railway up -c                                   # uploads this checkout and builds web/Dockerfile; -c detaches after the upload
```

Then watch the build and deploy in the Railway dashboard, or run
`railway logs` until the health check passes. The service's start command
and `/healthz` check come from `web/railway.toml`.

### 5. Verify the deployment

```bash
curl https://muse-town-production.up.railway.app/healthz   # expect {"ok":true}
curl https://town.reseed.net/healthz                      # same, once the CNAME has propagated
```

Open the town in a browser, confirm the scene loads with models and
animations (the proof that the assets made it into the build), play,
reload, and install it from the browser menu. Then record the deploy in
`CLAUDE-TASKS.md` under Task 8 with the date.

### Launch gate

The deployment may go up for the owner's own verification. The town is
not linked, announced or posted anywhere until the asset and model
licences are verified, because the web serves the commercial model and
texture files to every browser as raw files. See "Launch gate" in
`web/README.md`.

## Working notes

- `bun run build:web` builds `web/dist`; `bun run test` runs the SQLite
  and Postgres suites. See `web/README.md` for the local run.
- `DATABASE_URL`, `DIRECTOR_TOKEN`, `TOWN_SECRET` and any visitor token
  never enter this repository.
