import { createPlaceFootprints } from "./buildingFootprints";
import { readArrangement } from "../../shared/homeDecor";
import { buildHomeHouse } from "./homeHouse";
import { aimSeaPath, buildSeaCliff, CLIFF, clampToWorld, clearOfSea, HORIZON_HILLS, walkable as onCliffPath } from "./seaCliff";
import { nextGap, pickShip, planVoyage, SHIPS, shipsSail, voyagePose, watchingSea, type SeaWeather, type ShipKind, type Voyage } from "./seaShips";
import { createTrueSky, skyDirection, SKY_REFRESH_S } from "./trueSky";
import { armsVisibility, createGaiusArms } from "./gaiusArms";
import { createNightLights } from "./nightLights";
import { createStreetLampSystem } from "./streetLamps";
import { BUBBLE_SPEAKERS, bubblePageDuration, drawBubblePlate, paginateBubbleText, type BubbleSpeaker } from "./bubblePlate";
import { samplePath } from "./pathGeometry";
import { streetWidth } from "./town";
import { repairRomanMaterials } from "./romanMaterials";
import { TreePlacement } from "./treePlacement";
import { type VrmRig, collectRig, poseBone, poseWave, poseWaveStill, poseUmbrellaArm, poseThrowArm, poseLinkArm, poseHoldHandPlayer, poseHoldHandMuse,
  poseFlirtLift, type CharAnimator, createCharAnimator, prepareVrm, litVrmMaterials, MUSE_TINTS, PLAYER_TINTS, collectBlinkMorphs, setBlink } from "./characterAnimation";
// The Muse Town diorama: a low-poly three.js scene with a plaza around
// the great town tree, five clickable houses, lamp posts, smaller trees,
// a day/night cycle, and two hidden collectibles (the pointy hat and the
// garden key). The town tree grows in stages and changes with the season:
// blossom in spring, lush green in summer, gold and russet in autumn,
// bare snow-capped branches in winter.
//
// The scene reports taps through `onPick` and exposes camera flights so
// the React shell can drive chips, the guided tour, and zoom buttons.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { ATHENA_LINES, ATHENA_SEAT, ATHENA_TEMPLE, LUCRETIA, LUCRETIA_LINES, BATHS, BED_SPOT, BOARD_SPOT, COLOSSEUM, FOREST, FOREST_BUSHES, FLOURISH_LINES, FOREST_DEN_ROCKS, FOREST_EDGE_LINES, FOREST_SPOTS, FOREST_TRAILS, FOREST_TREES, FORAGE_SPOTS, GOALS_SPOT, LAKE, LAKE_PAVILION, LETTER_DESK_SPOT, MUSE, PISCINA, PLACES, PLAYER, QUEST_BOARD_SPOT, SECRET, SEEK_LINES, STREETS, forestNorm, groundHeightAt, isGoldenElevation, seasonForDate, solarAngles, streetDistance, terrainHeight, type Season, type WeatherId } from "./town";
import { pickPooled } from "./linePools";
import { playFootstep, playLanding, playSlide } from "./audio";
import { ESTATE_AREAS, weedStands, type EstateArea, type EstateCare } from "./estateCare";
import { footingAt, strideStep, type Footing } from "./footing";
import { airborne, newJump, stepJump } from "./jump";
import { endSlide, newSlide, slideSpeed, sliding, startSlide, wasMovingRecently } from "./slide";
import { FOLLOW_CAM, followCamSustain, followCamYawStep, type FollowCamGate } from "./followCam";
import {
  driverStep,
  followCommand,
  newDriver,
  paceForTilt,
  settleFacing,
  stickToWorld,
  type DriverCommand,
  type FollowOffset,
} from "./padDriver";
import { pad2Live, type AeliaDriver, type Pad2Source } from "./padRouting";
import { PAIR_CAM, newPairCamState, stepPairCam } from "./pairCam";
import {
  PAD_VERB_MAX_MS,
  VISIT_STAR_COLOR,
  VISIT_STAR_EMISSIVE,
  withinTownRim,
  type VisitAnchorName,
  type VisitDirection,
  type VisitTelemetry,
} from "../../shared/visitProtocol";
import { frameDimensions } from "./visitFrames";
import { playLampIgnite, setBeeHumLevel, setCricketLevel, setLampCrackleLevel, setRainLevel, setRainShelter, setSurfLevel } from "./audio";
import { HOME } from "./town";
import { createCritters, type XZ } from "./townCritters";
import { buildAthenaTemple, buildLucretia } from "./tributes";
import { FIREFLY_PLACES_MAX, fireflyPlaceAt, fireflyPlacesBudget } from "./fireflyPlaces";
import { FEEL } from "./feel";
import { buildMetaSudans, META_SUDANS_LINES } from "./metaSudans";
import { rainIntensity, rainSwell, SHELTER_HINT_LINE, SHELTERED_LINES, shelterAmount, wrapAround, type Shelter } from "./rainMood";
import { pickRomanPool, ROMAN_PLACE_LINES, romanDate, romanHour, romanPools } from "./romanDay";
import {
  circ,
  obb,
  obbLocal,
  obbWorld,
  pushOutOf,
  resolveCollisions as resolveAgainst,
  slideMotion,
  stepEntersBox,
  type LiveBody,
  type Obstacle,
} from "./collision";
import { aboutPlayer } from "../../server/src/player";
import {
  applyWindToMaterial,
  currentWindState,
  setTownWindSpell,
  updateTownWind,
  windStateForWeather,
} from "./wind";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { assetBytes, assetUrl, loadAssetTexture } from "./assetPack";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { AVENUE_CYPRESSES, DISH_TABLE, GARDEN_BEDS, MARKET_BOOTHS, VILLA, VILLA_WALLS, resumeSpot, routeBetween, stairHeight } from "./layout";
import { retainSharedModel, SceneResources } from "./sceneResources";
import { SceneRuntime } from "./sceneRuntime";
import type { PerformanceSnapshot } from "./performanceMonitor";
import type { ProximityLoader } from "./proximityLoader";
import { CHARACTER_WAIT_MS, fetchClipBytes, nextLoadJob, settleWithin } from "./characterLoad";
import museAvatarUrl from "./assets/muse-avatar.vrm";
import centurionUrl from "./assets/centurion.vrm";
import fIdleUrl from "./assets/anim/f_idle.fbx";
import fWalkUrl from "./assets/anim/f_walk.fbx";
import fRunUrl from "./assets/anim/f_run.fbx";
import fWaveUrl from "./assets/anim/f_wave.fbx";
import fSitUrl from "./assets/anim/f_sit.fbx";
import mIdleUrl from "./assets/anim/m_idle.fbx";
import mWalkUrl from "./assets/anim/m_walk.fbx";
import mRunUrl from "./assets/anim/m_run.fbx";
import mWaveUrl from "./assets/anim/m_wave.fbx";
import mSitUrl from "./assets/anim/m_sit.fbx";
import mJumpStartUrl from "./assets/anim/m_jump_start.fbx";
import mJumpAirUrl from "./assets/anim/m_jump_air.fbx";
import mJumpEndUrl from "./assets/anim/m_jump_end.fbx";
import mSlideUrl from "./assets/anim/m_slide.fbx";
import villaUrl from "./assets/roman/villa_stories.glb";
import houseSoundsUrl from "./assets/roman/house_sounds.glb";
import houseGardenUrl from "./assets/roman/house_garden.glb";
import pavilionUrl from "./assets/roman/pavilion_stars.glb";
import fDanceUrl from "./assets/anim/f_dance.fbx";
import mDanceUrl from "./assets/anim/m_dance.fbx";
import fPoseAUrl from "./assets/anim/f_pose_a.fbx";
import fPoseBUrl from "./assets/anim/f_pose_b.fbx";
// Outdoor FBX library (Kevin Iglesias, FBX edition, Nov 1 pass):
// conversation gestures, seated talk, bench idles, and the gated
// flirt/hug pair clips. These files speak a DIFFERENT bone naming
// than the basic motions (Hips / Left_UpperArm / ...), handled by
// OUTDOOR_RIG below; the bake is rig-parameterised for this.
import fTalk1Url from "./assets/anim/outdoor/f_talk1.fbx";
import fTalk2Url from "./assets/anim/outdoor/f_talk2.fbx";
import fTalk3Url from "./assets/anim/outdoor/f_talk3.fbx";
import mTalk1Url from "./assets/anim/outdoor/m_talk1.fbx";
import mTalk2Url from "./assets/anim/outdoor/m_talk2.fbx";
import mTalk3Url from "./assets/anim/outdoor/m_talk3.fbx";
import fSitTalk1Url from "./assets/anim/outdoor/f_sittalk1.fbx";
import fSitTalk2Url from "./assets/anim/outdoor/f_sittalk2.fbx";
import mSitTalk1Url from "./assets/anim/outdoor/m_sittalk1.fbx";
import mSitTalk2Url from "./assets/anim/outdoor/m_sittalk2.fbx";
import fBench1Url from "./assets/anim/outdoor/f_bench1.fbx";
import fBench2Url from "./assets/anim/outdoor/f_bench2.fbx";
import mBench1Url from "./assets/anim/outdoor/m_bench1.fbx";
import mBench2Url from "./assets/anim/outdoor/m_bench2.fbx";
import fFlirtUrl from "./assets/anim/outdoor/f_flirt.fbx";
import mFlirtUrl from "./assets/anim/outdoor/m_flirt.fbx";
import fHugUrl from "./assets/anim/outdoor/f_hug.fbx";
import mHugUrl from "./assets/anim/outdoor/m_hug.fbx";
import catUrl from "./assets/pets/cat.fbx";
import chickenUrl from "./assets/pets/chicken.fbx";
import sheepUrl from "./assets/pets/sheep.fbx";
import pigUrl from "./assets/pets/pig.fbx";
// The HONETi pets' real coat textures, extracted from the user's own
// pack: the FBX files reference them by the author's Windows paths,
// so they never load in the bundle (see repairModelMaterials).
// Umbra wears the pack's BLACK cat variant (cat_05, same UV layout
// as the FBX's cat_01 reference, and black is her written coat);
// the sheep is the pack's sheep05, matching the shipped sheep FBX.
import chickenTexUrl from "./assets/pets/chicken_01.png";
import catTexUrl from "./assets/pets/cat_05.png";
import pigTexUrl from "./assets/pets/pig_01.png";
import sheepTexUrl from "./assets/pets/sheep_05.png";
import treesPackUrl from "./assets/trees_pack.glb";
import wolfUrl from "./assets/wolf.glb";
import torchUrl from "./assets/roman/torch.fbx";
import greekTableUrl from "./assets/greek/greek_table_1.fbx";
import greekBench1Url from "./assets/greek/greek_bench_1.fbx";
import greekBench2Url from "./assets/greek/greek_bench_2.fbx";
import greekBowlUrl from "./assets/greek/greek_bowl.fbx";
import greekDecoBowlUrl from "./assets/greek/greek_decorative_bowl.fbx";
import greekPot1Url from "./assets/greek/greek_pot_1.fbx";
import greekPot2Url from "./assets/greek/greek_pot_2.fbx";
import greekBucketUrl from "./assets/greek/greek_bucket.fbx";
import greekGardenUrl from "./assets/greek/greek_garden_1.fbx";
import greekRackUrl from "./assets/greek/greek_drying_rack.fbx";
import greekWoodPileUrl from "./assets/greek/greek_wood_pile.fbx";
import phoenixUrl from "./assets/phoenix.fbx";
import phoenixTexUrl from "./assets/phoenix_tex.png";
import insulaeUrl from "./assets/roman/insulae_recipes.glb";
import templeUrl from "./assets/roman/temple.glb";
import senateUrl from "./assets/roman/senate.glb";
import annexUrl from "./assets/roman/annex_sidechat.glb";
import aqueductUrl from "./assets/roman/aqueduct.glb";
import aqueductConnectorUrl from "./assets/roman/aqueduct_connector.glb";
import triumphalArchUrl from "./assets/roman/triumphal_arch.glb";
import boothAUrl from "./assets/roman/booth_a.glb";
import boothBUrl from "./assets/roman/booth_b.glb";
import boothCUrl from "./assets/roman/booth_c.glb";
import columnIonicUrl from "./assets/roman/column_ionic.glb";
import columnSimpleUrl from "./assets/roman/column_simple.glb";
import benchStoneUrl from "./assets/roman/bench_stone.glb";
import paletteUrl from "./assets/roman/palette.png";
import benchWoodenUrl from "./assets/roman/bench_wooden.glb";
import bannerUrl from "./assets/roman/banner.glb";
import bannerTriangleUrl from "./assets/roman/banner_triangle.glb";
import ballistaUrl from "./assets/roman/ballista.glb";
import gladiusUrl from "./assets/roman/gladius.glb";
import shieldLegionaireUrl from "./assets/roman/shield_legionaire.glb";
import statueMarsUrl from "./assets/roman/statue_mars.glb";
import barrelUrl from "./assets/roman/barrel.glb";
import crateUrl from "./assets/roman/crate.glb";
import pottery1Url from "./assets/roman/pottery1.glb";
import pottery2Url from "./assets/roman/pottery2.glb";
import breadUrl from "./assets/roman/bread.glb";
import grapesUrl from "./assets/roman/grapes.glb";
import cypressUrl from "./assets/roman/cypress.glb";
import coniferUrl from "./assets/roman/conifer.glb";
import oliveUrl from "./assets/roman/olive.glb";
import colosseumUrl from "./assets/roman/colosseum.glb";
import archRoundUrl from "./assets/roman/arch_round.glb";
import treeAUrl from "./assets/roman/tree_a.glb";
import treeBUrl from "./assets/roman/tree_b.glb";
import treeCUrl from "./assets/roman/tree_c.glb";
import treeDUrl from "./assets/roman/tree_d.glb";
import bushAUrl from "./assets/roman/bush_a.glb";
import bushBUrl from "./assets/roman/bush_b.glb";
import bushCUrl from "./assets/roman/bush_c.glb";
import bushDUrl from "./assets/roman/bush_d.glb";
import bushEUrl from "./assets/roman/bush_e.glb";
import flowerAUrl from "./assets/roman/flower_a.glb";
import flowerMedUrl from "./assets/roman/flower_med.glb";
import flowerGroupUrl from "./assets/roman/flower_group.glb";
import rockPackUrl from "./assets/roman/rock_pack.glb";
import grassPatchUrl from "./assets/roman/grass_patch.glb";
import boatSmallUrl from "./assets/roman/boat_small.glb";
import paddleUrl from "./assets/roman/paddle.glb";
import tradeShipUrl from "./assets/ships/trade_ship.glb";
import triremeUrl from "./assets/ships/trireme.glb";
import waterNormalUrl from "./assets/roman/water_normal.png";

export type PickKind = "place" | "collectible" | "tree" | "muse" | "board" | "secret" | "landmark" | "questboard" | "letters" | "goals" | "market" | "bench" | "dock" | "inscription" | "summit" | "piscina" | "baths" | "cat" | "phoenix" | "sky" | "stone" | "rest" | "forage" | "history" | "home";

/** The nearest walk-mode interactable, reported by the scene so the
 *  shell can show a small "A, …" prompt. Panels open only when the
 *  visitor presses the interact control (or taps the prompt / the
 *  interactable itself), never merely by walking up. */
export interface NearbyTarget {
  kind: PickKind;
  id: string;
}
export type { Season };
export type { WeatherId };

/** A weather change report for the React shell: what the weather is now,
 *  whether the visitor pinned it by hand, and when the next random event
 *  is due (epoch ms; null while a weather is pinned). */
export interface WeatherChangeInfo {
  id: WeatherId;
  manual: boolean;
  endsAt: number | null;
}

export interface TownSceneHandle {
  flyTo: (
    pos: [number, number, number],
    target: [number, number, number],
    durationMs?: number,
  ) => void;
  overview: () => void;
  zoomBy: (factor: number) => void;
  setNight: (night: boolean) => void;
  /** Pin a weather by hand, or pass "auto" to let random weather events resume. */
  setWeather: (weather: WeatherId | "auto") => void;
  setTreeStage: (stageIndex: number) => void;
  setTreeSeason: (season: Season) => void;
  setFound: (collectibleId: string) => void;
  enterWalk: () => void;
  exitWalk: () => void;
  setWalkMove: (x: number, y: number) => void;
  /** Hop, if he is on foot and free to. */
  jump: () => void;
  /** Slide, if he is on the move. False if he's standing, so B can mean back. */
  slide: () => boolean;
  /** Player 2 (Task 3, Nov 3 2026): the second channel that drives
   *  Aelia as a player-style character. Her stick is camera-relative
   *  like his; the source names who holds it, for the menu's status.
   *  Runtime only, never persisted. */
  setPad2Move: (x: number, y: number, source: Pad2Source) => void;
  /** The pad's right stick (owner's ask, Nov 6, 2026): orbits the
   *  follow camera while held, like a drag (x swings the yaw, right
   *  looks right; y tilts, up looks up). Zero releases it. */
  orbitCamera: (x: number, y: number) => void;
  /** R3: the follow camera eases back to its default view, behind him
   *  and level, at the walk's distance. */
  recenterCamera: () => void;
  /** Their home's keepsakes, where he placed them (Task 40). */
  setHomeDecor: (arrangement: Record<string, string>) => void;
  /** A = jump, B = slide (or stand up from a bench), X = sit on a seat
   *  within reach, stand if seated, otherwise wave. */
  pad2Press: (button: "a" | "b" | "x", source: Pad2Source) => void;
  /** The natural-motion driver's follow harness (a test toggle on this
   *  line): off, or the driver walks her at his pace beside or behind
   *  him whenever pad2 is quiet. */
  setDriverFollow: (mode: FollowOffset | "off") => void;
  /** Who moves her right now: the second pad, the keyboard stand-in,
   *  the follow harness, or her own mind (companion follow or routine). */
  aeliaDriver: () => AeliaDriver;
  /** Muse Visits (Task 4, Nov 2026). While a visit is open her star
   *  turns violet, and the shell enacts the director's directions
   *  through visitDirect. Ending a visit folds her back mid-stride:
   *  the hold is dropped, nothing else is reset. Runtime only. */
  setVisitActive: (on: boolean) => void;
  /** Enact one body direction (goto, sit, stand, seat, stepout,
   *  emote, pad). Speak, intend and look belong to the shell. Returns
   *  false when the direction cannot be taken right now (a moment
   *  owns her body, a point is outside the walkable world). */
  visitDirect: (direction: VisitDirection) => boolean;
  /** The slate's telemetry: zones, seated flags, day phase, headings,
   *  her bearing and distance to him, who holds pad2. */
  visitTelemetry: () => VisitTelemetry;
  /** A still of the renderer's canvas only (never a page element),
   *  scaled to maxEdge on the long edge, JPEG at quality. */
  captureVisitFrame: (maxEdge: number, quality: number) => { dataUrl: string; width: number; height: number } | null;
  /** A growing line in her bubble (a partial speak): shows the latest
   *  page of the text so far and keeps the bubble up while it grows. */
  showBubbleGrowing: (text: string) => void;
  /** The day's rhythm: where she spends the hour, and how the market stands. */
  setRhythm: (rhythm: { anchor: string; marketOpen: boolean; marketBusy: boolean }) => void;
  /** Free for her to ask him somewhere: nothing else has the two of them. */
  canInvite: () => boolean;
  /** She leads him to a spot; onGuideEnd reports how it went. */
  startGuide: (x: number, z: number) => boolean;
  /** What's on the table in the peristyle. */
  setDishes: (ids: string[]) => void;
  /** Show how kept each part of the estate is. */
  setEstateCare: (care: EstateCare) => void;
  setStepSounds: (on: boolean) => void;
  /** In-town landscape switch: the shell has CSS-rotated the whole
   *  stage 90° clockwise because the host app window never rotates.
   *  While this is on, canvas pointer vectors are remapped from screen
   *  axes into stage axes (walk drag, tap pick, and the overview's
   *  orbit rotate) so every gesture behaves exactly as it does in a
   *  true landscape viewport. Pinch spread is a distance, rotation-
   *  invariant, and needs no remap. */
  setForcedLandscape: (on: boolean) => void;
  isWalking: () => boolean;
  greetMuse: () => void;
  /** Companion follow mode: Muse walks beside/behind the Centurion while
   *  it is on; turning it off sends her walking back to her plaza spot. */
  setFollowMode: (enabled: boolean) => void;
  isFollowing: () => boolean;
  /** Her current routine anchor key + position (the shell's
   *  appointment-keeping reads it: an appointment is met when he
   *  is beside her while her rounds are at the appointed place). */
  routineInfo: () => { anchor: string; museX: number; museZ: number };
  /** Hide-and-seek: conceal her completely (she is at her spot,
   *  unseeable until found), or place her somewhere visible. */
  setMuseHidden: (hidden: boolean) => void;
  placeMuseAt: (x: number, z: number) => void;
  /** Focus sittings: hush ambient chatter lines and seeking. */
  setQuietMode: (on: boolean) => void;
  /** Loose follow camera hold: while a panel, menu, or conversation
   *  owns the screen, the follow camera must not auto-rotate at all
   *  (the player may be reading, not walking). The shell drives this
   *  from its any-panel-open state. */
  setCameraHold: (on: boolean) => void;
  /** Forest forage: the spot ids already gathered today (their
   *  visuals hide and their prompts stop offering until tomorrow). */
  setForageTaken: (ids: string[]) => void;
  /** Resume snapshot (ephemeral scene state only): where Gaius
   *  stands, his facing, and the follow camera's yaw/pitch/zoom.
   *  Null while dreaming or rowing, those are never resumed into. */
  resumeState: () => { x: number; z: number; heading: number; camYaw: number; camPitch: number; userZoom: number; walking: boolean; ov?: { cx: number; cy: number; cz: number; tx: number; ty: number; tz: number } } | null;
  restoreResume: (snap: { x: number; z: number; heading: number; camYaw: number; camPitch: number; userZoom: number }) => void;
  /** Restore the overview camera framing (OrbitControls position +
   *  target) captured by resumeState while he was out of walk mode:
   *  it becomes the framing the next exitWalk flies back to, and if
   *  he is already in the overview the camera moves there now. */
  restoreOverview: (ov: { cx: number; cy: number; cz: number; tx: number; ty: number; tz: number }) => void;
  /** Her earned heart rank (0–10), from the saved affection store.
   *  Only behaviour reads it here: at rank 8+ she sometimes walks out
   *  to meet him partway; at rank 10 her night anchor moves to the
   *  lake bench, where the moonlight is. No numbers are ever shown. */
  setAffectionRank: (rank: number) => void;
  /** Hand-in-hand while walking together (rank 4+): she keeps step
   *  closer at his side instead of her usual beside-and-behind. */
  setHandInHand: (on: boolean) => void;
  /** Town upgrades bought with denarii: permanent fixtures (fountain,
   *  extra lanterns, planters, resurfaced cobbles) shown/hidden here. */
  setUpgrades: (ids: string[]) => void;
  /** Garden beds growth stage (0 empty · 1 sprouting · 2 growing · 3 ready). */
  setGardenStage: (stage: number) => void;
  /** Sit on a bench (or stand up if it's the bench he's on). If Muse
   *  is following she takes the other seat; standing frees them both. */
  toggleSit: (benchId: string) => void;
  standUp: () => void;
  /** Task 47: bring the shield out onto his back, or stow it. */
  setShieldOut: (on: boolean) => void;
  /** Wear the gladius at his hip, or stow it. */
  setSwordWorn: (on: boolean) => void;
  /** Both of them inside their house, he walking (Task 45). */
  homeTogether: () => boolean;
  /** A night together (Task 45), implied and never shown: "hush" holds
   *  the door shut, dims the lamp and lets the night be heard; "morning"
   *  (behind the veil) holds a dawn through the window and sits them on
   *  the bed together; "end" (behind the veil) gives the town back its
   *  real hour and stands them up. */
  nightTogether: (stage: "hush" | "morning" | "end") => void;
  isSeated: () => boolean;
  /** Pick up the loose stone the prompt is offering (he carries
   *  one at a time, visible in his right hand). */
  pickUpStone: () => void;
  /** Throw the carried stone in his facing direction, a composed
   *  overarm throw; the stone arcs, bounces, and rests where it
   *  fell (or splashes, and sometimes skips, on the water). */
  throwStone: () => void;
  /** Gifts: is he carrying a smooth stone right now, and give it
   *  away (the stone leaves his hand for her keepsakes shelf). */
  hasCarriedStone: () => boolean;
  consumeCarriedStone: () => void;
  /** Is Lupa the wolf in the camera's frame right now, at a golden
   *  or night phase? (The "Wolf at Dusk" postcard challenge.) */
  wolfInView: () => boolean;
  /** Enter a false dream: the town remixed: fog, wrong-warm lamp
   *  light, a few props displaced, no townsfolk, and one distant
   *  figure who is never reached. Ends itself (opts.onDreamEnd). */
  enterFalseDream: () => void;
  /** Enter a true dream: the pair wake together on the secret
   *  terrace in impossible bright stillness, fireflies at noon.
   *  The shell owns the conversation and the waking. */
  enterTrueDream: () => void;
  /** Leave either dream: restore light, townsfolk, and (after a
   *  true dream) the places the pair were standing in. */
  exitDream: () => void;
  isDreaming: () => boolean;
  /** Board the rowboat at the lake dock. If Muse is following she
   *  takes the bow seat facing him; he rows from the stern. */
  boardBoat: () => void;
  /** Step ashore at the lake dock. Only works when the boat is back
   *  near its mooring; returns whether they disembarked. */
  disembarkBoat: () => boolean;
  isRowing: () => boolean;
  /** Secret place only: start the hold-her-hand moment / the kiss.
   *  Returns false when the moment can't start (not in walk mode, the
   *  pair not together on the terrace, or a moment already playing). */
  /** The shell's talk bubble is open: both characters gesture with
   *  their Communicate clips while they talk (standing still, or
   *  seated variants when seated). */
  setTalking: (on: boolean) => void;
  /** Stage a one-shot Outdoor pair clip (flirt / hug) if staging
   *  allows. The shell owns every affection/rank gate for these;
   *  the scene only refuses impossible staging. */
  playPairMoment: (kind: "flirt" | "hug") => boolean;
  /** Where she stands, for the town plan (Nov 6, 2026). */
  musePosition: () => { x: number; z: number };
  playHandHold: () => boolean;
  playKiss: () => boolean;
  /** The Night the Stars Fall: the shell reports the saved-data side
   *  of the gate (ready = every prerequisite earned, done = the
   *  scene has happened) and whether tonight is a meteor night. The
   *  scene owns the rest of the gate, night, the lake pavilion, her
   *  company, and the prompt that begins it. Nothing is labelled
   *  anywhere in the UI before the night itself. */
  setSummitState: (s: { ready: boolean; done: boolean; meteor: boolean }) => void;
  /** Lakeside foreheads-rest beat for the summit scene: the pair
   *  step close at the pavilion, foreheads together, eyes closed,
   *  held while the meteors streak. False when it can't start. */
  playSummitMoment: () => boolean;
  /** Whether meteors are streaking right now (a meteor night, and
   *  night fallen), the sky's only outward sign. */
  isMeteorActive: () => boolean;
  /** The piscina's visible population from released catches (the
   *  golden carp becomes the pond's jewel). */
  setPiscinaStock: (speciesIds: string[]) => void;
  /** Whether he currently carries a live catch the piscina prompt
   *  can offer to release (null = nothing to release). */
  setPiscinaReleasable: (fishId: string | null) => void;
  /** Scatter feed on the water near where he stands: the pond
   *  gathers to that spot for a little while. */
  scatterFeed: () => void;
  /** The baths: he steps into the caldarium (she joins only when
   *  the shell has arranged her invitation and he said yes, see
   *  joinBath). */
  enterBath: () => void;
  /** She joins him in the caldarium. */
  joinBath: () => void;
  /** Leaving the pool ends the soak for both, gracefully. */
  exitBath: () => void;
  /** Whether he is soaking (and whether she is in with him). */
  bathState: () => { soaking: boolean; museIn: boolean };
  /** A care moment in the baths: one of them washes the other's
   *  hair, a few seconds of raised hands and a bowed head. */
  playBathCare: (by: "muse" | "player") => void;
  /** Tell the scene the golden carp lives in the piscina, so her
   *  rounds may include a stop at her jewel's rim. */
  setPiscinaGolden: (lives: boolean) => void;
  /** Show an RPG speech bubble above Muse's or the player's head. */
  showBubble: (who: "muse" | "player", text: string) => void;
  /** Capture the current view as a JPEG data URL (for postcards). */
  capturePostcard: () => string | null;
  /** Light the letters desk's new-mail indicator. */
  setUnreadLetters: (count: number) => void;
  /** Dress the town for a festival: recolor the peristyle bunting with the
   *  festival's colors and hang the peristyle wreath. Null restores the
   *  everyday town. Light-touch only, no geometry is rebuilt. */
  setFestival: (colors: string[] | null) => void;
  /** Low-graphics mode for struggling devices: pixel ratio 1 and no
   *  shadow rendering. The town keeps every feature; it just asks
   *  less of the GPU. */
  setLowGraphics: (on: boolean) => void;
  /** The festival dance: the pair take their places in front of the
   *  Atrium of Sounds and dance one full step sequence together.
   *  False when it can't start (not walking, not together, a clip
   *  missing). Ends itself; onDanceEnd fires. */
  startDance: () => boolean;
  stopDance: () => void;
  isDancing: () => boolean;
  /** The living sky: drive it by real local time (Europe/Rome)
   *  or hold an override phase. Transitions always ease, the sun
   *  visibly travels; there are no hard cuts. */
  setSkyMode: (mode: "auto" | "day" | "night") => void;
  /** The sky right now: sun elevation/azimuth (degrees), darkness
   *  (0 day → 1 night), whether this is a golden window, and the
   *  named phase. Other systems read their triggers from here. */
  skyState: () => { elev: number; azim: number; darkness: number; golden: boolean; phase: "night" | "dawn" | "day" | "dusk" };
  /** The sky-watch spot he stands at (or nearest), if any. */
  nearSkyWatchSpot: () => string | null;
  /** Begin a sky watch at a spot: the pair stand side by side turned
   *  toward the sun. Movement ends it. */
  startSkyWatch: (spotId: string) => boolean;
  stopSkyWatch: () => void;
  isSkyWatching: () => boolean;
  /** Petting Umbra: she pauses and purrs. Charm only. */
  petCat: () => void;
  /** The phoenix: the shell reports her arrival (saved state); the
   *  scene keeps her hours, perch at dawn and morning, a midday
   *  circuit, gone by night. */
  setPhoenixArrived: (arrived: boolean, summitDone: boolean) => void;
  phoenixPresent: () => boolean;
  /** A feather lies below her perch this week (saved state decides). */
  setPhoenixFeather: (lying: boolean) => void;
  performanceSnapshot: () => PerformanceSnapshot;
  /** The town menu's quiet perf line (v44): rolling fps, p95 frame
   *  time, and the current quality tier word, from the runtime's
   *  own rolling measurement. Read-only; polling it changes nothing. */
  perfLine: () => string;
  setAutomaticGraphics: (on: boolean) => void;
  dispose: () => void;
}

interface Flight {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  start: number;
  duration: number;
}

const DAY_SKY = new THREE.Color(0xa8d8ea);
const DAY_GROUND = new THREE.Color(0x69a84f);

function mat(
  color: number,
  opts?: { flat?: boolean; rough?: number; metal?: number; emissive?: number; emissiveIntensity?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: opts?.flat ?? false,
    roughness: opts?.rough ?? 0.82,
    metalness: opts?.metal ?? 0,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 1,
  });
}

/** Soft procedural canvas texture: speckled noise in two tones. */
function noiseTexture(base: string, fleck: string, flecks = 900, size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = fleck;
    for (let i = 0; i < flecks; i++) {
      const r = 1 + Math.random() * 2.4;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Cobblestone texture for the peristyle: rounded stones with grout lines. */
function cobbleTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#a89a78";
    ctx.fillRect(0, 0, size, size);
    const tones = ["#ded3b8", "#d2c5a4", "#d9cdb0", "#c9ba94"];
    const cell = 32;
    for (let y = 0; y < size / cell; y++) {
      for (let x = 0; x < size / cell; x++) {
        ctx.fillStyle = tones[(x * 7 + y * 13) % tones.length]!;
        ctx.beginPath();
        const cx = x * cell + cell / 2 + (y % 2 ? 6 : -2);
        const cy = y * cell + cell / 2;
        if (typeof ctx.roundRect === "function") ctx.roundRect(cx - 13, cy - 11, 26, 22, 9);
        else ctx.rect(cx - 13, cy - 11, 26, 22);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(5, 5);
  return tex;
}

function box(
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
  opts?: { rounded?: number; rough?: number },
): THREE.Mesh {
  const geo = opts?.rounded
    ? new RoundedBoxGeometry(w, h, d, 2, opts.rounded)
    : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat(color, { rough: opts?.rough }));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeTree(x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 1.4 * s, 9),
    mat(0x6e4a2f, { rough: 0.95 }),
  );
  trunk.position.y = 0.7 * s;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);
  const greens = [0x3e7d3a, 0x4c9440, 0x5da34a, 0x478a3e];
  const blobs: [number, number, number, number][] = [
    [0, 2.25, 0, 1.35],
    [0.8, 1.7, 0.3, 0.95],
    [-0.75, 1.8, -0.25, 0.9],
    [0.15, 2.9, -0.35, 0.8],
    [-0.35, 1.55, 0.65, 0.7],
  ];
  blobs.forEach(([bx, by, bz, r], i) => {
    const b = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r * s, 2),
      applyWindToMaterial(mat(greens[i % greens.length] ?? 0x4c9440, { rough: 0.9 }), "tree"),
    );
    b.position.set(bx * s, by * s, bz * s);
    b.castShadow = true;
    b.receiveShadow = true;
    g.add(b);
  });
  g.position.set(x, 0, z);
  return g;
}

/** A little umbrella that pops open over a character when it rains. */
function makeUmbrella(color: number): THREE.Group {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 0.26, 10),
    mat(color, { rough: 0.55 }),
  );
  canopy.castShadow = true;
  g.add(canopy);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6),
    mat(0x4a3a28, { rough: 0.6 }),
  );
  pole.position.y = -0.4;
  g.add(pole);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(0xffd34e));
  tip.position.y = 0.17;
  g.add(tip);
  g.scale.setScalar(0.001);
  g.visible = false;
  return g;
}

// --- Imported models -----------------------------------------------------
// Muse and the player are VRM 1.0 characters (glTF-binary): Muse is the
// AvatarSample VRM the player sent on Oct 31 (silver-blonde hair, a plain
// white one-piece dress), the player walks as the Centurion. The Roman
// buildings and props come from the owner's purchased
// "Roman Empire - Stylized Low Poly" pack (HALBERSTRAM ART), converted
// from FBX to glTF with Assimp. Everything loads through one GLTFLoader;
// each file is fetched once and cloned for repeat placements.

const gltfLoader = new GLTFLoader();
const modelCache = new Map<string, Promise<THREE.Object3D>>();

// Load progress for the shell's loading screen: how many distinct
// models have been requested vs settled (loaded or failed). The hook
// is registered by createTownScene; loads are fire-and-forget, so the
// town appears as pieces settle rather than waiting for all of them.
let loadProgressHook: ((settled: number, total: number) => void) | null = null;
let loadErrorHook: ((asset: string) => void) | null = null;
let loadsTotal = 0;
let loadsSettled = 0;

// Progressive loading, tiered by what the opening camera sees. The
// camera opens over the peristyle looking at the peristyle, so the buildings
// stream next. The two characters come before everything (tier 0, at
// the owner's word: they are who the visit is about, and a town that
// fills in around them reads better than bodies arriving late). The
// old order ran the other way, because on the phone their megabytes
// crowded out every building fetch and the houses stood as bare white
// slabs, so the buildings wait on them for CHARACTER_WAIT_MS at most.
//
// Fetch and parse are separate stages:
//  - Character fetches start first thing in scene construction,
//    while the loading screen is up (beginCharacterLoad); building
//    fetches (tier 1) follow once they settle. Downloads don't block
//    the main thread, so the procedural shell still paints its first
//    frame immediately.
//  - Parses wait for that first frame (the gate below), then run
//    through a small parallel queue (MAX_PARALLEL_LOADS at a time),
//    always taking the lowest tier waiting, registration order
//    within a tier (nextLoadJob).
//  - Model URLs are the bundler's content-hashed asset URLs: stable
//    for unchanged models, so the browser's HTTP cache makes the
//    second visit's fetches near-instant.
type LoadTier = 0 | 1 | 2 | 3;

const LOAD_TIER_BY_URL = new Map<string, LoadTier>([
  // Tier 0, the opening view: the basilica at the head
  // of the peristyle, and the houses nearest the camera on the peristyle's
  // south side (Domus Architecti, Garden, Stars pavilion).
  [senateUrl, 0],
  [annexUrl, 0],
  [houseGardenUrl, 0],
  [pavilionUrl, 0],
  // Tier 1, the remaining houses and the peristyle's dressing.
  [villaUrl, 1],
  [houseSoundsUrl, 1],
  [insulaeUrl, 1],
  [templeUrl, 1],
  [triumphalArchUrl, 1],
  [statueMarsUrl, 1],
  [boothAUrl, 1],
  [boothBUrl, 1],
  [boothCUrl, 1],
  [columnIonicUrl, 1],
  [columnSimpleUrl, 1],
  [benchStoneUrl, 1],
  [benchWoodenUrl, 1],
  [bannerUrl, 1],
  [bannerTriangleUrl, 1],
  // Tier 2, far landmarks (the Colosseum, the aqueduct) and, by
  // default, every unlisted prop and plant.
  [colosseumUrl, 2],
  [boatSmallUrl, 2],
  [paddleUrl, 2],
  [aqueductUrl, 2],
  [aqueductConnectorUrl, 2],
  [ballistaUrl, 2],
  // Tier 0, the characters, before everything (his gladius and
  // shield ride with him, two small files).
  [centurionUrl, 0],
  [gladiusUrl, 0],
  [shieldLegionaireUrl, 0],
  [museAvatarUrl, 0],
]);

/** What each body needs to stand and move; the rest of the library
 *  streams in behind them (see createCharAnimator). */
const CORE_CLIP_URLS = [
  mIdleUrl, mWalkUrl, mRunUrl, mWaveUrl, mSitUrl,
  fIdleUrl, fWalkUrl, fRunUrl, fWaveUrl, fSitUrl,
];

let loadGateOpen = false;

interface LoadJob {
  tier: LoadTier;
  seq: number;
  run: () => void;
}
const loadQueue: LoadJob[] = [];
let loadSeq = 0;
let activeLoads = 0;
const MAX_PARALLEL_LOADS = 5;

function pumpLoadQueue() {
  if (!loadGateOpen) return;
  while (activeLoads < MAX_PARALLEL_LOADS) {
    const next = nextLoadJob(loadQueue, charactersSettled);
    if (next < 0) break;
    const job = loadQueue.splice(next, 1)[0];
    if (!job) break;
    activeLoads += 1;
    job.run();
  }
}

/** True once the characters' files are in, failed, or out of time. */
let charactersSettled = true;
let charactersArrived: Promise<void> = Promise.resolve();

/** Start the characters' downloads ahead of everything else: both
 *  bodies and the clips each needs to stand and move. Parsing still
 *  waits for the load gate, so the shell paints first. */
function beginCharacterLoad() {
  charactersSettled = false;
  charactersArrived = settleWithin(
    [...[centurionUrl, museAvatarUrl].filter((url) => !modelCache.has(url)).map(fetchModelBytes), ...CORE_CLIP_URLS.map(fetchClipBytes)],
    CHARACTER_WAIT_MS,
  ).then(() => {
    charactersSettled = true;
    pumpLoadQueue();
  });
}

function openLoadGate() {
  if (loadGateOpen) return;
  loadGateOpen = true;
  pumpLoadQueue();
}

/** Raw model bytes, fetched once per URL and shared between the
 *  early prefetch and the parse job that consumes them. */
const modelBytes = new Map<string, Promise<ArrayBuffer>>();
function fetchModelBytes(url: string): Promise<ArrayBuffer> {
  let pending = modelBytes.get(url);
  if (!pending) {
    pending = assetBytes(url).catch((err: unknown) => {
      throw new Error(`model fetch failed: ${url} (${err instanceof Error ? err.message : String(err)})`);
    });
    modelBytes.set(url, pending);
  }
  return pending;
}

/** Short human name for an asset URL, for the failure note. */
function assetLabel(url: string): string {
  const file = url.split("/").pop() ?? url;
  return file.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
}

function loadModelScene(url: string, opts?: { tier?: LoadTier }): Promise<THREE.Object3D> {
  let pending = modelCache.get(url);
  if (!pending) {
    loadsTotal += 1;
    loadProgressHook?.(loadsSettled, loadsTotal);
    const tier: LoadTier = opts?.tier ?? LOAD_TIER_BY_URL.get(url) ?? 2;
    // Buildings start downloading during the loading screen, right
    // behind the characters, even though their parse waits for the
    // gate. Far pieces fetch only when their queue turn comes.
    if (tier === 1) {
      void charactersArrived.then(() => fetchModelBytes(url)).catch(() => {
        /* the parse job below surfaces the failure properly */
      });
    }
    pending = new Promise<THREE.Object3D>((resolve, reject) => {
      loadQueue.push({
        tier,
        seq: loadSeq++,
        run: () => {
          (async () => {
            const bytes = await fetchModelBytes(url);
            const gltf = await gltfLoader.parseAsync(bytes, "");
            const modelScene = gltf.scene as THREE.Object3D;
            // One downscale pass on the shared source, before any
            // clone is taken from it, so every repeat placement
            // reuses the smaller textures (clones share geometry
            // and materials by reference).
            downscaleModelTextures(modelScene, 1024);
            // The Roman pack's shared colour palette: its materials
            // reference the palette PNG by a relative path from the
            // conversion machine (one GLB even carries the
            // converter's Windows desktop path), so the texture
            // never loads and every palette surface renders flat
            // grey-white. Re-assign the real palette here, once, on
            // the shared source.
            await repairRomanMaterials(modelScene, {
              architecture: ROMAN_ARCHITECTURE.has(url),
              palette: getPaletteTexture,
              report: (message) => materialRepairLog.push(assetLabel(url) + ": " + message),
            });
            // Tag for the load-time material sweep: model meshes
            // are audited after loads settle; procedural meshes
            // (built by the town itself, known-good colours) are
            // not. Clones inherit userData from the source.
            modelScene.traverse((o) => {
              o.userData.fromModel = "glb";
            });
            retainSharedModel(modelScene);
            return modelScene;
          })().then(
            (modelScene) => {
              modelBytes.delete(url);
              activeLoads -= 1;
              loadsSettled += 1;
              loadProgressHook?.(loadsSettled, loadsTotal);
              resolve(modelScene);
              pumpLoadQueue();
            },
            (err: unknown) => {
              modelBytes.delete(url);
              activeLoads -= 1;
              loadsSettled += 1;
              // Name the failing asset in the console AND tell the
              // shell, which shows a friendly retry note, a missing
              // model leaves an empty spot, never a silent screen.
              console.warn(`[muse-town] model failed to load: ${url}`, err);
              loadErrorHook?.(assetLabel(url));
              loadProgressHook?.(loadsSettled, loadsTotal);
              reject(err instanceof Error ? err : new Error(String(err)));
              pumpLoadQueue();
            },
          );
        },
      });
    });
    modelCache.set(url, pending);
    pumpLoadQueue();
  }
  return pending;
}

/** Shrink oversized embedded textures on a model to at most
 *  `maxSize` px on a side, re-encoded through a canvas. The VRMs ship
 *  with large textures; on a phone GPU they are the single biggest
 *  memory cost in town, and 1024px reads identically at the town's
 *  camera distances. Run once on the cached source scene so cloned
 *  placements share the smaller textures. Best-effort: any texture
 *  that resists is left exactly as it was. */
// The Roman pack's shared colour palette (M_colorpalette_BaseColor):
// a 1024² atlas of flat swatches, reds, blues, greens, wood tones,
// stone greys, that most of the pack's surfaces sample by UV cell.
// The converted GLBs reference it by unresolvable relative paths
// ("..\..\colorpallete_romanempire.png", in one case the converter's
// own Windows desktop), so it never loads; some conversions dropped
// the reference entirely (their palette material survives as plain
// "M_color", proven the same material by its UVs, which land in
// the identical atlas cells as the senate's working reference).
// UV origin in these files is top-left (glTF convention), so the
// texture loads flipY = false. One shared texture for the whole
// town: a single 9 KB PNG, fetched once: a streaming WIN, not a
// cost.
const ROMAN_ARCHITECTURE = new Set([
  colosseumUrl, templeUrl, senateUrl, annexUrl, insulaeUrl,
  houseSoundsUrl, houseGardenUrl, villaUrl, pavilionUrl,
  aqueductUrl, aqueductConnectorUrl, triumphalArchUrl, archRoundUrl,
  columnIonicUrl, columnSimpleUrl, boothAUrl, boothBUrl, boothCUrl,
]);
let sharedPaletteTexture: Promise<THREE.Texture> | null = null;
function getPaletteTexture(): Promise<THREE.Texture> {
  if (!sharedPaletteTexture) {
    sharedPaletteTexture = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Roman palette load timed out")), 15000);
      loadAssetTexture(paletteUrl, (texture) => {
        window.clearTimeout(timeout);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      }, (error) => { window.clearTimeout(timeout); reject(error); });
    });
  }
  return sharedPaletteTexture;
}

// --- Model material repair (the black-animals / black-boxes fix) -----
// Root cause, found Nov 1: FBX content reaches the town with texture
// references that can never resolve in the bundle, the HONETi pets
// point at the author's own Windows paths (P:\projekty\_work\...),
// and a texture whose image never loads renders BLACK in three.js
// (it multiplies the material colour by an empty image), so the
// chickens, Umbra, the sheep and the pig stood in town as pure black
// silhouettes. The Greek props were broken by the town itself: their
// Blender FBXs carry NO UVs and honest flat material colours
// (Greek_Stone_4 #827372, Greek_Wood_1, Greek_Vase_1...), but
// placeFbx replaced those colours with a shared atlas-mapped
// material, sampling a missing UV attribute reads one corner texel
// of the atlas, a black gridline pixel, so every Greek prop (the
// two garden planters by the Garden House most visibly, plus the
// bowl, tables, pots, benches, rack and wood pile) rendered void
// black. The repair is shared, in this one pass, for every FBX the
// town loads:
//   - a caller-supplied REAL texture (the pets' coats, extracted
//     from the user's own pack files) replaces a broken map, and
//     the DCC's placeholder grey (#969696, the same pattern as the
//     Roman palette) is reset to white so the coat reads true;
//   - any other map whose image definitively failed to load is
//     DROPPED, leaving the material's own flat colour, a coloured
//     prop, never a black one;
//   - materials with no map keep their pack colours untouched.
// A load-time sweep (scheduleMaterialSweep, below) re-checks every
// model mesh after loads settle and reports anything still wrong by
// name, so this class of bug names its victims instead of hiding.

/** Repairs applied by repairModelMaterials, in load order. */
const materialRepairLog: string[] = [];

/** Pack materials that are near-black ON PURPOSE (the piscina-dark
 *  glaze inside a Greek vase), the sweep names everything else. */
const INTENTIONAL_DARK_MATERIALS = new Set(["Greek_Vase_2"]);

function textureImageState(tex: THREE.Texture): "ok" | "failed" | "pending" {
  const img = tex.image as { width?: number; naturalWidth?: number; complete?: boolean } | undefined | null;
  if (!img) return "failed";
  if (typeof img.naturalWidth === "number" && typeof img.complete === "boolean") {
    if (img.complete && img.naturalWidth === 0) return "failed";
    if (!img.complete) return "pending";
    return "ok";
  }
  return (img.width ?? 0) > 0 ? "ok" : "pending";
}

function repairModelMaterials(root: THREE.Object3D, opts?: { map?: THREE.Texture; label: string }) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.userData.fromModel = "fbx";
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (!std || !("map" in std)) continue;
      if (opts?.map) {
        if (std.map) {
          std.map = opts.map;
          // The DCC's grey factor is a placeholder for the texture,
          // exactly like the Roman palette's, the coat is untinted.
          std.color.setRGB(1, 1, 1);
          std.needsUpdate = true;
          materialRepairLog.push(`${opts.label}: ${o.name || "mesh"} (${std.name || "material"}), broken external map replaced with the pack's real texture`);
        }
      } else if (std.map && textureImageState(std.map) === "failed") {
        std.map = null;
        std.needsUpdate = true;
        materialRepairLog.push(`${opts?.label ?? "model"}: ${o.name || "mesh"} (${std.name || "material"}), texture failed to load, map dropped, flat colour kept`);
      }
    }
  });
}

function downscaleModelTextures(root: THREE.Object3D, maxSize = 1024) {
  try {
    const seen = new Set<THREE.Texture>();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        for (const slot of ["map", "emissiveMap", "normalMap"] as const) {
          const tex = std[slot];
          if (!tex || seen.has(tex)) continue;
          seen.add(tex);
          const img = tex.image as { width?: number; height?: number } | undefined;
          if (!img?.width || !img?.height) continue;
          if (img.width <= maxSize && img.height <= maxSize) continue;
          try {
            const scale = maxSize / Math.max(img.width, img.height);
            const c = document.createElement("canvas");
            c.width = Math.max(2, Math.round(img.width * scale));
            c.height = Math.max(2, Math.round(img.height * scale));
            const g = c.getContext("2d");
            if (!g) continue;
            g.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height);
            const replacement = new THREE.CanvasTexture(c);
            replacement.colorSpace = tex.colorSpace;
            replacement.wrapS = tex.wrapS;
            replacement.wrapT = tex.wrapT;
            replacement.repeat.copy(tex.repeat);
            replacement.offset.copy(tex.offset);
            replacement.center.copy(tex.center);
            replacement.rotation = tex.rotation;
            replacement.flipY = tex.flipY;
            replacement.anisotropy = Math.min(4, tex.anisotropy);
            std[slot] = replacement;
            std.needsUpdate = true;
          } catch {
            /* keep the original texture */
          }
        }
      }
    });
  } catch {
    /* texture pass is best-effort only */
  }
}

/** Wrap a model so its footprint is centred on the wrapper origin and its
 *  base sits at y = 0, uniformly scaled to the requested height or width. */
function groundModel(
  model: THREE.Object3D,
  opts: { height?: number; width?: number },
): THREE.Group {
  const wrap = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(model);
  wrap.add(inner);
  const bb = new THREE.Box3().setFromObject(inner);
  const size = bb.getSize(new THREE.Vector3());
  let s = 1;
  if (opts.height && size.y > 0.01) s = opts.height / size.y;
  else if (opts.width && size.x > 0.01) s = opts.width / size.x;
  inner.scale.setScalar(s);
  const bb2 = new THREE.Box3().setFromObject(inner);
  const centre = bb2.getCenter(new THREE.Vector3());
  inner.position.set(-centre.x, -bb2.min.y, -centre.z);
  wrap.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return wrap;
}

/** Load a (non-skinned) pack model and stand it in the world. Fire and
 *  forget: the model pops in when it arrives, and a failed load simply
 *  leaves the spot empty rather than breaking the town. */
async function placeCachedModel(
  url: string,
  parent: THREE.Object3D,
  opts: { x: number; z: number; y?: number; rotY?: number; height?: number; width?: number },
  resources: SceneResources,
  streaming: ProximityLoader,
): Promise<THREE.Group | null> {
  try {
    const scene = await streaming.request(() => loadModelScene(url), () => {
      parent.updateWorldMatrix(true, false);
      const position = parent.localToWorld(new THREE.Vector3(opts.x, opts.y ?? 0, opts.z));
      return { x: position.x, z: position.z };
    }, { priority: LOAD_TIER_BY_URL.get(url) ?? 2 });
    if (resources.disposed) return null;
    const wrap = groundModel(scene.clone(true), opts);
    resources.adopt(wrap);
    wrap.position.set(opts.x, opts.y ?? 0, opts.z);
    wrap.rotation.y = opts.rotY ?? 0;
    parent.add(wrap);
    return wrap;
  } catch {
    /* model unavailable, the town carries on without it */
    return null;
  }
}

/** Where the forum's history tablet stands, by the Town Tree (Task 37). */
const HISTORY_TABLET_FORUM: [number, number] = [-3.8, 4.6];

export function createTownScene(
  canvas: HTMLCanvasElement,
  opts: {
    onPick: (kind: PickKind, id: string) => void;
    /** Fired while walking whenever the NEAREST promptable interactable
     *  changes (null when none is in range). Approach alone never opens
     *  a panel any more, the shell shows an "A, …" prompt for this
     *  target and opens its panel only on an explicit interact press
     *  or tap. */
    onNearbyChange?: (target: NearbyTarget | null) => void;
    /** Fired when the Centurion sits down (bench id) or stands up (null). */
    onSitChange?: (benchId: string | null) => void;
    /** Fired when the pair board the lake rowboat (true) or step ashore (false). */
    onRowChange?: (rowing: boolean) => void;
    /** Fired when hand-in-hand wandering ends inside the scene,
     *  he hurried despite the stroll cap ("hurry"). (Rain used to
     *  end it too, for the arm-in-arm umbrella link; that system is
     *  removed, Nov 1, and hands now stay joined in the rain.)
     *  The shell mirrors its hand state from this; she never takes
     *  his hand on her own, so it only ever reports false. */
    onHandInHandChange?: (on: boolean, reason?: string) => void;
    /** Fired each frame while walking, for quest progress (street coverage). */
    onWalkPosition?: (x: number, z: number) => void;
    onGuideEnd?: (arrived: boolean) => void;
    /** Tiny stone sounds (Nov 1): a pebble's tick on the cobbles, a
     *  thrown stone's bounce, a splash (or a skip's smaller splash)
     *  on the lake or the piscina. The shell owns the audio kit. */
    onStoneFx?: (kind: "tick" | "bounce" | "splash" | "skip") => void;
    /** Fired once per session when Lupa the wolf is first properly
     *  seen, within sight at a golden or night phase. The shell
     *  saves the sighting (her Stories entry lives there). */
    onWolfSeen?: () => void;
    /** A false dream ended on its own inside the scene (he reached
     *  the figure, came back to the basilica steps, or the dream
     *  simply ran out), the shell veils the waking. */
    onDreamEnd?: (kind: "false" | "true") => void;
    onWeatherChange?: (info: WeatherChangeInfo) => void;
    /** Fired the moment lightning flashes during a storm (for thunder). */
    onLightning?: () => void;
    /** Fired once at the peak of the secret-place kiss, so the shell
     *  can quietly remember a first kiss. Never fired for anyone else,
     *  and never mentioned anywhere else in town. */
    onKissMoment?: () => void;
    /** Fired when the festival dance finishes its step sequence. */
    onDanceEnd?: () => void;
    /** Fired when a sky watch ends inside the scene (he moved off). */
    onSkyWatchEnd?: () => void;
    /** Fired after the first frame actually renders, the shell keeps
     *  its loading screen up until this moment, so the town is never
     *  a bare black rectangle. */
    onReady?: () => void;
    /** Model load progress (settled / total) for the loading screen. */
    onLoadProgress?: (settled: number, total: number) => void;
    /** The WebGL context was lost (GPU reset / memory pressure on a
     *  phone). The shell offers a friendly retry instead of a void. */
    onContextLost?: () => void;
    /** The WebGL context came back after a loss, the shell can lift
     *  its retry overlay and let the town carry on. */
    onContextRestored?: () => void;
    /** A model file failed to load (short human asset name). The
     *  shell shows a friendly note with a retry, the town itself
     *  carries on without that one piece. */
    onLoadError?: (asset: string) => void;
    /** Rendering itself is failing frame after frame (not a single
     *  transient throw). The shell shows its retry overlay. */
    onRenderError?: () => void;
    /** The renderer is software GL, so the scene has already dropped
     *  itself to gentle settings; the shell mirrors that in its
     *  low-graphics toggle so the two never disagree. */
    onSoftwareGl?: () => void;
    /** Both character animators have settled, one way or the other:
     *  a short human line for the town menu ("Motion: full (both
     *  animators ready)" or who fell back), so a stiff town on a
     *  phone is something its owner can read and report, not a
     *  silence. Fires once. */
    onMotionStatus?: (status: string) => void;
    reducedMotion: boolean;
    /** The second try after a failed build (Task 42): the safest
     *  settings whatever the device, ratio 1, no antialiasing, the
     *  phone's light start and frame pacing. */
    safeMode?: boolean;
  },
): TownSceneHandle {
  let disposed = false;
  const resources = new SceneResources();
  const timers = new Set<number>();
  const later = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!disposed) callback();
    }, delay);
    timers.add(timer);
    return timer;
  };
  const placeModel = (url: string, parent: THREE.Object3D, options: Parameters<typeof placeCachedModel>[2]) =>
    placeCachedModel(url, parent, options, resources, runtime.streaming);
  // Pixel ratio is capped at 1.5: at phone viewing distances the
  // extra pixels of a full 2–3x ratio cost GPU memory and battery
  // without a visible gain, and they were part of the black-screen
  // memory pressure on Android. Phones (Task 41: a small screen, or a
  // touch-first pointer) render at ratio 1.0 without antialiasing, at a
  // capped frame rate, and start a quality tier down (see SceneRuntime).
  const smallScreen =
    Math.min(window.innerWidth || 9999, window.innerHeight || 9999) <= 430 ||
    (window.innerWidth || 9999) <= 540;
  const phone = !!opts.safeMode || smallScreen || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone });
  const FULL_PIXEL_RATIO = phone ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(FULL_PIXEL_RATIO);
  // Software GL (SwiftShader / llvmpipe, some webviews, emulators,
  // and headless browsers) can take seconds per frame on a scene this
  // size, which reads as a frozen or black page. Detect it and drop
  // to the gentle settings automatically: ratio 1, no shadow maps.
  let softwareGl = false;
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    softwareGl = /swiftshader|llvmpipe|software rasterizer|microsoft basic render/i.test(rendererName);
  } catch {
    /* leave the full settings in place */
  }
  if (softwareGl) {
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    opts.onSoftwareGl?.();
  }
  loadProgressHook = opts.onLoadProgress ?? null;
  beginCharacterLoad();
  loadErrorHook = opts.onLoadError ?? null;
  // Out-of-band health flags on window: the shell in main.tsx runs a
  // plain-DOM watchdog that can still show a title, a cause, and a
  // Retry button even if the React tree itself dies, a failure that
  // takes the whole interface down to bare sky must never leave the
  // visitor with nothing to tap. The frame loop stamps a heartbeat
  // here; fatal render failure and context loss record their cause.
  const mtFlags = window as unknown as {
    __mtFirstFrameAt?: number;
    __mtLastFrameAt?: number;
    __mtSceneError?: string;
  };
  const onContextLost = (e: Event) => {
    // preventDefault is what makes restoration possible at all: the
    // browser will fire webglcontextrestored once the GPU is back.
    e.preventDefault();
    mtFlags.__mtSceneError = "The WebGL context was lost (GPU reset or memory pressure).";
    opts.onContextLost?.();
  };
  const onContextRestored = () => {
    // three.js re-uploads its GPU resources on restore; the frame
    // loop (which kept running) picks rendering back up on its own.
    delete mtFlags.__mtSceneError;
    opts.onContextRestored?.();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  // (Software GL keeps the disabled setting from the block above,
  // re-enabling here would silently undo the gentle start.)
  if (!softwareGl) renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // The runtime may ask for a resize before the camera and the view
  // state below exist (Task 42: on phones its constructor did, and the
  // build threw); until the scene's own first resize, there is nothing
  // to size, and that first resize applies whatever profile was set.
  let sceneSized = false;
  const runtime = new SceneRuntime(renderer, scene, FULL_PIXEL_RATIO, softwareGl, () => {
    if (sceneSized) resize();
  }, phone);
  resources.adopt(scene);
  scene.background = new THREE.Color().copy(DAY_SKY);
  scene.fog = new THREE.Fog(DAY_SKY.getHex(), 95, 235);

  // Soft studio-style ambience so PBR surfaces read with gentle sheen
  // (painted wood, glossy leaves, polished brass) instead of flat matte.
  // Skipped on software GL: PMREM generation is a long burst of
  // offscreen renders that weak renderers take minutes over, and it
  // happens before the first frame, exactly the stall the loading
  // screen exists to outlast. Software-GL devices get the same town
  // lit by its lights alone.
  if (!softwareGl) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    const target = resources.track(pmrem.fromScene(environment, 0.04));
    scene.environment = target.texture;
    scene.environmentIntensity = 0.35;
    environment.dispose();
    pmrem.dispose();
  }

  // Gradient sky dome: warm horizon melting into blue overhead: the
  // single biggest "storybook game" cue. Its colours lerp at night.
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x6db9e8) },
    horizonColor: { value: new THREE.Color(0xd8f0e2) },
    offset: { value: 8 },
    exponent: { value: 0.85 },
  };
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(180, 24, 14),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vWorldPosition;
        void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 horizonColor; uniform float offset; uniform float exponent;
        varying vec3 vWorldPosition;
        void main(){ float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float k = pow(max(h, 0.0), exponent);
        gl_FragColor = vec4(mix(horizonColor, topColor, k), 1.0); }`,
    }),
  );
  // The sky's own anchor (Task 34): the dome, the sun, the moon and the
  // stars ride with the camera, so from the headland, far south of the
  // town's centre, they still sit at their true bearings on the horizon.
  const skyAnchor = new THREE.Group();
  scene.add(skyAnchor);
  skyAnchor.add(skyDome);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
  camera.position.set(0, 34, 60);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.8, -2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 7;
  controls.maxDistance = 78;
  controls.enablePan = false;

  // In-town landscape (Nov 1): set by the shell when it turns the
  // stage sideways itself (the host app window is portrait-locked).
  // The stage is CSS-rotated 90° clockwise, so pointer deltas arrive
  // in screen axes; rotating a delta by −90°, (dx, dy) → (dy, −dx),
  // expresses it in stage axes. OrbitControls computes its rotate
  // delta internally from raw client/page coords, so its two rotate
  // handlers are wrapped: on each move, the stored start point is
  // shifted so the delta the original handler computes IS the
  // stage-axis delta (start′ = end − R⁻¹(end − start)); the handler
  // then stores the raw end as the next start, and the wrap re-shifts
  // it on the next move. Dolly/pinch distances are rotation-invariant
  // and pass through untouched; pan is disabled in this town.
  let forcedLandscapeView = false;
  {
    const oc = controls as unknown as {
      _rotateStart: { x: number; y: number; set: (x: number, y: number) => void };
      _pointers: number[];
      _getSecondPointerPosition: (e: PointerEvent) => { x: number; y: number };
      _handleMouseMoveRotate: (e: PointerEvent) => void;
      _handleTouchMoveRotate: (e: PointerEvent) => void;
    };
    const wrapRotate = (
      name: "_handleMouseMoveRotate" | "_handleTouchMoveRotate",
      touch: boolean,
    ) => {
      const orig = oc[name];
      if (typeof orig !== "function") return;
      oc[name] = (event: PointerEvent) => {
        if (!forcedLandscapeView) {
          orig.call(controls, event);
          return;
        }
        let endX = touch ? event.pageX : event.clientX;
        let endY = touch ? event.pageY : event.clientY;
        if (touch && oc._pointers.length === 2) {
          const pos = oc._getSecondPointerPosition(event);
          endX = 0.5 * (endX + pos.x);
          endY = 0.5 * (endY + pos.y);
        }
        const s = oc._rotateStart;
        const dx = endX - s.x;
        const dy = endY - s.y;
        s.set(endX - dy, endY + dx);
        orig.call(controls, event);
      };
    };
    wrapRotate("_handleMouseMoveRotate", false);
    wrapRotate("_handleTouchMoveRotate", true);
  }

  // Lights: warm key sun, sky/ground bounce, and a cool rim from behind
  // the town so rooftops and canopies separate from the sky.
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a9a52, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.9);
  sun.position.set(30, 42, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -54;
  sun.shadow.camera.right = 54;
  sun.shadow.camera.top = 54;
  sun.shadow.camera.bottom = -54;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbcd8ff, 0.55);
  rim.position.set(-16, 14, -20);
  scene.add(rim);
  const plazaGlow = new THREE.PointLight(0xffc873, 0, 26, 1.6);
  plazaGlow.position.set(0, 3.4, 0);
  scene.add(plazaGlow);
  // Night faces (Tasks 24 and 27): the soft moon, the warm fill on the
  // pair, and Aelia's warm night skin (nightLights.ts).
  const nightLights = createNightLights(scene);
  const collectNightSkin = (root: THREE.Object3D) => nightLights.collectNightSkin(root);

  const world = new THREE.Group();
  scene.add(world);

  const treePlacement = new TreePlacement(terrainHeight, (x, z, radius) =>
    streetDistance(x, z) > radius + 1.6 && Math.hypot(x, z) > radius + 6 &&
    Math.hypot((x - LAKE.position[0]) / (LAKE.rx + radius + 0.5), (z - LAKE.position[1]) / (LAKE.rz + radius + 0.5)) > 1);
  const treeUrls = new Set([treeAUrl, treeBUrl, treeCUrl, treeDUrl, cypressUrl, coniferUrl, oliveUrl]);
  const buildingUrls = new Set([templeUrl, colosseumUrl, aqueductUrl, aqueductConnectorUrl, triumphalArchUrl, boothAUrl, boothBUrl, boothCUrl]);

  /** placeModel, standing the model on the terrain at (x, z). */
  const placeWorld = (
    url: string,
    opts: { x: number; z: number; y?: number; rotY?: number; height?: number; width?: number },
  ): Promise<THREE.Group | null> =>
    placeModel(url, world, { ...opts, y: (opts.y ?? 0) + terrainHeight(opts.x, opts.z) }).then((group) => {
      if (group && !disposed) {
        if (treeUrls.has(url)) treePlacement.addTree(group, opts.x, opts.z);
        if (buildingUrls.has(url)) treePlacement.addBuilding(group, url);
        // Static scenery freeze (v44): a placed model that is not a
        // tree never moves again (TreePlacement may still shift a
        // tree clear of a late-arriving building, so trees keep
        // live matrices), yet three.js recomputes every node's
        // world matrix every frame, and a camera swing re-walks the
        // whole graph to re-cull it. Freeze the placed subtree's
        // matrices at their settled values: the picture is identical,
        // the per-frame graph walk gets cheaper everywhere, swings
        // included. Vertex wind still sways what it shades; nothing
        // here animates by matrix.
        if (!treeUrls.has(url)) {
          group.updateWorldMatrix(true, true);
          group.traverse((o) => { o.matrixAutoUpdate = false; });
        }
      }
      return group;
    });

  // --- Foundations -----------------------------------------------------
  // Buildings stand at ONE terrain height, their centre's, but the
  // town's ground slopes, so a flat base hovers over the grass on the
  // downhill side (the temple's podium floated visibly). Every
  // building on a slope now gets a Roman foundation: a stone skirt
  // hung from its base down into the terrain, deep enough to meet
  // the LOWEST ground sampled around its footprint, finished with a
  // slightly wider footing step at the bottom, stepped stone
  // footing, the way Rome actually built on hillsides. The skirt is
  // sized INSIDE the existing collision footprint (×0.97 at most),
  // adds no colliders, and never touches a doorstep: platform tops,
  // thresholds, and stand points keep exactly their heights.
  const FOUNDATION_STONE = 0xb3a487;
  const FOUNDATION_STEP = 0x9c8e6e;
  /** Lowest terrain around a rotated rectangle's perimeter,
   *  sampled every quarter-edge so a dip between corners (the
   *  temple's long flank crosses a hillside fold) cannot slip a
   *  gap under the skirt between two sample points. */
  function lowestTerrainAround(cx: number, cz: number, rotY: number, halfW: number, halfD: number): number {
    let min = Infinity;
    const steps = [-1, -0.5, 0, 0.5, 1];
    const pts: [number, number][] = [];
    for (const s of steps) {
      pts.push([s, -1], [s, 1], [-1, s], [1, s]);
    }
    for (const [sx, sz] of pts) {
      const lx = sx * halfW;
      const lz = sz * halfD;
      const wx = cx + lx * Math.cos(rotY) + lz * Math.sin(rotY);
      const wz = cz - lx * Math.sin(rotY) + lz * Math.cos(rotY);
      min = Math.min(min, terrainHeight(wx, wz));
    }
    return min;
  }
  function addFoundation(cx: number, cz: number, rotY: number, halfW: number, halfD: number, baseY: number) {
    const drop = baseY - lowestTerrainAround(cx, cz, rotY, halfW, halfD);
    const h = Math.max(0.3, drop) + 0.55;
    const g = new THREE.Group();
    const skirt = box(halfW * 2, h, halfD * 2, FOUNDATION_STONE, 0, -h / 2 + 0.03, 0, { rough: 0.97 });
    const step = box(halfW * 2 + 0.5, 0.34, halfD * 2 + 0.5, FOUNDATION_STEP, 0, -h + 0.15, 0, { rough: 0.97 });
    g.add(skirt, step);
    g.position.set(cx, baseY, cz);
    g.rotation.y = rotY;
    world.add(g);
  }
  /** The round version, for the Colosseum's ring. */
  function addRoundFoundation(cx: number, cz: number, r: number, baseY: number) {
    let min = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      min = Math.min(min, terrainHeight(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
    }
    const h = Math.max(0.3, baseY - min) + 0.55;
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.99, r * 1.02, h, 36),
      mat(FOUNDATION_STONE, { rough: 0.97 }),
    );
    skirt.position.set(cx, baseY - h / 2 + 0.03, cz);
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    world.add(skirt);
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.06, r * 1.08, 0.34, 36),
      mat(FOUNDATION_STEP, { rough: 0.97 }),
    );
    step.position.set(cx, baseY - h + 0.15, cz);
    step.castShadow = true;
    step.receiveShadow = true;
    world.add(step);
  }

  // --- The lake -------------------------------------------------------------
  // A small lake in the basin below the basilica's west end (see LAKE
  // in town.ts and the matching dip in its heightfield). The water is
  // one still ellipse at a fixed level a little above the basin's
  // floor; where the bank's terrain rises through it, the shore forms
  // on its own. The dock stands on the east shore where the lake lane
  // ends; the rowboat rides at its mooring just off the dock's end.
  const LAKE_CX = LAKE.position[0];
  const LAKE_CZ = LAKE.position[1];
  const LAKE_Y = terrainHeight(LAKE_CX, LAKE_CZ) + 0.8;
  const DOCK_TOP = LAKE_Y + 0.3;
  /** 0 at the lake's centre, 1 on its water ellipse, more on dry land. */
  const lakeNorm = (x: number, z: number): number =>
    Math.hypot((x - LAKE_CX) / LAKE.rx, (z - LAKE_CZ) / LAKE.rz);
  /** The dock's planks, the one dry crossing over the water, and
   *  the bank leading onto them. The bank end must reach past the
   *  walkers' shoreline fence (about x = -9.3), or the fence turns
   *  them back a pace short of the first plank. */
  const onDock = (x: number, z: number): boolean =>
    x >= -13.7 && x <= -8.9 && z >= LAKE_CZ - 0.62 && z <= LAKE_CZ + 0.62;
  // (dockTopAt retired: the dock's top is a WALK_SURFACES entry in
  // town.ts, and groundHeightAt covers it for every walker.)

  // UMBRELLAS REMOVED FOR NOW (Nov 1, user call): in the rain Aelia
  // circled around and through Gaius and the shared canopy read
  // awkward, so the whole umbrella system is switched OFF at this
  // one flag, no umbrella model is ever shown on either principal
  // (or the residents), no umbrella arm pose is applied, the
  // arm-in-arm link and its positional servo never engage, and rain
  // follow is EXACTLY the dry-weather follow (same offsets, same
  // settle/dead-zone rules; hand-in-hand in rain works as in dry
  // weather). The models, poses, and link code below stay in place
  // but dormant, so a future, better-animated umbrella can return
  // by flipping this flag and re-checking the follow behaviour.
  // Everything else about rain (the rain itself, puddles, ambience,
  // her rain lines) is untouched.
  const UMBRELLAS_ENABLED = false;
  // Umbrellas for the residents, Muse, and the visitor, they pop open
  // together whenever the weather turns rainy. (Dormant: see above.)
  const umbrellas: THREE.Group[] = [];
  // The two principals' umbrellas, kept by name: in the rain each is
  // HELD (a procedural arm override poses the umbrella arm over the
  // clips), and when Muse follows him she folds hers away and walks
  // arm in arm under his, his canopy grows and shifts to cover them
  // both, her hand tucked at his elbow (see driveClipAnims).
  let museUmbrellaRef: THREE.Group | null = null;
  let playerUmbrellaRef: THREE.Group | null = null;
  /** True while the shared-umbrella state holds: raining, she's
   *  following, and they're actually side by side (not run ahead of). */
  let umbrellaSharing = false;

  // Ground: town disc with a speckled grass texture, fading into a far
  // meadow ringed by hazy hills and a distant tree line so no view ever
  // ends in a void.
  const grassTex = noiseTexture("#69a84f", "#5c9843", 1400);
  grassTex.repeat.set(14, 14);
  const groundMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    color: DAY_GROUND.getHex(),
    roughness: 0.95,
  });
  // Rolling terrain: a subdivided plane displaced by the town's
  // heightfield, hills, the basilica rise, the temple hill, and the
  // aqueduct's valley fold, settling to the meadow at the edges.
  const groundGeo = new THREE.PlaneGeometry(112, 112, 128, 128);
  groundGeo.rotateX(-Math.PI / 2);
  {
    const posAttr = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setY(i, terrainHeight(posAttr.getX(i), posAttr.getZ(i)));
    }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.name = "ground";
  world.add(ground);
  // The meadow stops at the coast: south of it is the sea, 25 m down,
  // and a meadow left over the water hid the sea from the headland.
  const meadowGeo = new THREE.CircleGeometry(170, 40);
  meadowGeo.rotateX(-Math.PI / 2);
  {
    const p = meadowGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) if (!clearOfSea(p.getZ(i))) p.setZ(i, CLIFF.coastZ);
  }
  const meadow = new THREE.Mesh(meadowGeo, mat(0x5d9a48, { rough: 1 }));
  // Below the lowest ground the town mesh reaches, the gate and the basin.
  meadow.position.y = -0.6;
  world.add(meadow);
  // Rolling hills on the horizon, all on the land north of the coast
  // (two that stood south of it, from before the sea cliff, swallowed
  // the peninsula's trail and sat in the sea).
  for (const [hx, hz, hr, hh] of HORIZON_HILLS) {
    if (!clearOfSea(hz, hr)) continue;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(hr, 20, 12), mat(0x5c9450, { rough: 1 }));
    hill.scale.y = hh / hr;
    hill.position.set(hx, 0, hz);
    world.add(hill);
  }
  // A soft distant tree line, on land only.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.09;
    const r = 62 + (i % 4) * 5;
    if (!clearOfSea(Math.sin(a) * r, 3)) continue;
    const silhouette = makeTree(Math.cos(a) * r, Math.sin(a) * r, 2.1 + (i % 3) * 0.5);
    world.add(silhouette);
  }

  // Winding cobblestone streets, draped over the terrain as ribbons.
  const streetMat = new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.92 });
  function buildStreet(points: [number, number][], width = 2.7, mat: THREE.Material = streetMat) {
    const { points: centreline, length } = samplePath(points);
    const segs = centreline.length - 1;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const [x, z] = centreline[i]!;
      const before = centreline[Math.max(0, i - 1)]!, after = centreline[Math.min(segs, i + 1)]!;
      const dx = after[0] - before[0], dz = after[1] - before[1];
      const distance = Math.hypot(dx, dz) || 1;
      const pt = { x, z };
      const nx = -dz / distance, nz = dx / distance;
      for (const sgn of [-1, 1]) {
        const vx = pt.x + nx * (width / 2) * sgn;
        const vz = pt.z + nz * (width / 2) * sgn;
        positions.push(vx, terrainHeight(vx, vz) + 0.045, vz);
        uvs.push(sgn * 0.5 + 0.5, (t * length) / 2.4);
      }
      if (i < segs) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    world.add(mesh);
  }
  STREETS.forEach((line, index) => buildStreet(line, streetWidth(index)));
  // The forest trails: dirt, not cobbles: the same draped ribbon,
  // narrower and browner, from the one trailhead at the aqueduct
  // lane's end to the glade and its landmarks.
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 });
  for (const trail of FOREST_TRAILS) buildStreet(trail, 1.7, dirtMat);
  // The east lane ends outside the solid Colosseum; its endpoint apron is below.

  // The peristyle: a cobbled disc draped over the (nearly level) heart of
  // town, where all the streets meet around the Town Tree.
  const plazaMat = new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.9 });
  const plazaGeo = new THREE.CircleGeometry(5.6, 44);
  plazaGeo.rotateX(-Math.PI / 2);
  {
    const posAttr = plazaGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setY(i, terrainHeight(posAttr.getX(i), posAttr.getZ(i)) + 0.035);
    }
    plazaGeo.computeVertexNormals();
  }
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.receiveShadow = true;
  world.add(plaza);

  // Junction discs and threshold aprons: a cobbled roundel draped over
  // the terrain at every point where two paths meet and at every
  // destination's front steps. The street ribbons now run into each
  // other (see STREETS in town.ts), and these roundels seal the joins,
  // at an angled branch the two ribbons alone would leave a grass wedge
  // in the crook, and at a door the ribbon's flat end would stop a
  // stone's throw short of the platform. A disc under the meeting point
  // makes the cobbles read as one continuous surface, flush to the
  // threshold. They are pure ground dressing at street height: no
  // collision of their own, so junctions and doorsteps stay walkable.
  const COBBLE_JOINTS: [number, number, number][] = [
    // Every route owns its joins; rerouting cannot leave old paving inside a wall.
    ...STREETS.flatMap((line, i) => [line[0]!, line[line.length - 1]!].map(
      ([x, z]) => [x, z, streetWidth(i) / 2] as [number, number, number],
    )),
    [0, -29.2, 1.9], // the great hall's steps
  ];
  for (const [jx, jz, jr] of COBBLE_JOINTS) {
    const jointGeo = new THREE.CircleGeometry(jr, 26);
    jointGeo.rotateX(-Math.PI / 2);
    const jPos = jointGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < jPos.count; i++) {
      const vx = jx + jPos.getX(i);
      const vz = jz + jPos.getZ(i);
      jPos.setX(i, vx);
      jPos.setZ(i, vz);
      jPos.setY(i, terrainHeight(vx, vz) + 0.055);
    }
    // Match the peristyle disc's cobble scale so the stones read as one
    // surface where a roundel overlaps the peristyle or a lane.
    const jUv = jointGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < jUv.count; i++) {
      jUv.setXY(i, 0.5 + (jUv.getX(i) - 0.5) * (jr / 5.6) + jx * 0.01, 0.5 + (jUv.getY(i) - 0.5) * (jr / 5.6) + jz * 0.01);
    }
    jointGeo.computeVertexNormals();
    const joint = new THREE.Mesh(jointGeo, plazaMat);
    joint.receiveShadow = true;
    world.add(joint);
  }

  // --- The town tree ---
  // The great tree in the middle of the peristyle, where the fountain used to
  // be. A stone-ringed earth mound, a trunk with roots and branches, and a
  // canopy built from blobs whose colours, fullness and decorations are
  // rebuilt whenever the season or the growth stage changes.
  const townTree = new THREE.Group();
  {
    // Earth mound inside a low stone ring.
    const mound = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 2.25, 0.42, 24),
      mat(0x7a5a38),
    );
    mound.position.y = 0.21;
    mound.castShadow = true;
    mound.receiveShadow = true;
    townTree.add(mound);
    const grassTop = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), mat(0x5f9a44));
    grassTop.rotation.x = -Math.PI / 2;
    grassTop.position.y = 0.43;
    grassTop.receiveShadow = true;
    townTree.add(grassTop);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.26),
        mat(i % 2 ? 0x9a958a : 0x8a857a, { flat: true }),
      );
      stone.position.set(Math.cos(a) * 2.28, 0.18, Math.sin(a) * 2.28);
      stone.castShadow = true;
      townTree.add(stone);
    }
    // Little wooden plaque on the south side of the mound.
    const plaquePost = box(0.09, 0.55, 0.09, 0x5d3f27, 0, 0.28, 2.05);
    townTree.add(plaquePost);
    const plaque = box(0.95, 0.55, 0.07, 0xb08d5f, 0, 0.62, 2.08);
    plaque.rotation.x = -0.18;
    townTree.add(plaque);
  }
  // The tree itself lives in its own group so growth is a simple rescale
  // from the ground up; seasonal dressing is rebuilt inside it.
  const treeBody = new THREE.Group();
  treeBody.position.y = 0.4;
  townTree.add(treeBody);
  // Unscaled ground dressing (fallen leaves, mound snow) that must sit on
  // the peristyle whatever the tree's growth stage.
  const treeGround = new THREE.Group();
  townTree.add(treeGround);
  const treeTrunkMat = mat(0x6e4a2f);
  let treeCanopy: THREE.Group | null = null;
  /** The Low Poly Trees pack's named nodes (oak/maple/bare), filled
   *  when trees_pack.glb arrives with the willows below. Until then,
   *  or if the pack ever fails, buildTreeBody keeps the hand-built
   *  tree, exactly as the willows keep their hand-built shore. */
  let packTreeNodes: Map<string, THREE.Object3D> | null = null;
  let currentTreeStage = 0;
  let currentTreeSeason: Season = seasonForDate(new Date());

  const CANOPY_BLOBS: [number, number, number, number][] = [
    [0, 4.6, 0, 1.9],
    [1.35, 3.9, 0.45, 1.35],
    [-1.3, 4.0, -0.4, 1.3],
    [0.5, 5.4, -0.7, 1.25],
    [-0.65, 5.3, 0.75, 1.2],
    [0.1, 3.6, 1.05, 1.05],
  ];
  const SEASON_CANOPY: Record<Season, number[]> = {
    spring: [0x7cc463, 0x8fd07a, 0x6db856, 0x86c96e, 0x7cc463, 0x95d184],
    summer: [0x3e7d3a, 0x4c9440, 0x35703a, 0x5da34a, 0x448a3e, 0x3e7d3a],
    autumn: [0xd98a2b, 0xc95f27, 0xe8b13a, 0xb84a24, 0xdd7a2e, 0xcf6a26],
    winter: [],
  };

  function clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((o) => {
        // Pack-tree clones share their geometry and atlas materials
        // with the stored pack originals (and the lake willows),
        // removing one must never dispose the shared assets.
        if (o instanceof THREE.Mesh && !o.userData.packShared) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
  }

  function buildTreeBody() {
    // Clear the previous build.
    clearGroup(treeBody);
    clearGroup(treeGround);
    treeCanopy = null;
    const season = currentTreeSeason;
    const winter = season === "winter";

    // The pack Town Tree (Nov 1, user request: the blob tree, three
    // orange-brown spheres on a stick, retires). The itch Low Poly
    // Trees pack's OAK stands at hero scale on the same stone ring;
    // autumn swaps in the pack's MAPLE, winter its BARE TREE, spring
    // and summer the oak again, the swap happens here, inside the
    // existing seasonal rebuild, and growth stays the stage rescale
    // below. Its atlas is the same one the lake willows already wear
    // in town, so its colours sit in the town palette un-tinted. The
    // stone-ring collider (r 2.45) is unchanged: the new trunk stands
    // inside the ring, and Aelia's shade anchor never moved.
    let packPlaced = false;
    const packSrc = packTreeNodes?.get(winter ? "BareTree" : season === "autumn" ? "MapleTree" : "OakTree") ?? null;
    if (packSrc) {
      const node = packSrc.clone(true);
      // The pack's named nodes carry their layout offset in the pack
      // scene as their own translation (oak at z −9, maple z −3, bare
      // at (−12, −9)), zero the root transform before measuring, so
      // every measurement below is in the model's own geometry space
      // and the placement replaces that offset entirely.
      node.position.set(0, 0, 0);
      node.rotation.set(0, 0, 0);
      node.scale.setScalar(1);
      node.updateMatrixWorld(true);
      const pBox = new THREE.Box3().setFromObject(node);
      const pSize = pBox.getSize(new THREE.Vector3());
      if (pSize.y > 0) {
        const ps = 7.4 / pSize.y;
        // Centre the TRUNK on the stone ring (user screenshot: the
        // maple stood at the ring's eastern edge, a pack model's
        // origin is not its trunk, and grounding Y alone left the
        // horizontal offset in). The trunk base centre is measured
        // from the ground band of the model's own vertices (lowest
        // 12% of its height), then the scaled, rotated offset is
        // backed out so the trunk base lands exactly on treeBody's
        // origin, the ring/mound centre, where the collider, the
        // watering prompt anchor, and Aelia's shade spot already
        // live. Every variant (oak/maple/bare) and every growth
        // stage (a rescale of treeBody around that same origin)
        // inherits the centring.
        node.updateMatrixWorld(true);
        let gx = 0;
        let gz = 0;
        let gn = 0;
        const gv = new THREE.Vector3();
        const groundBandTop = pBox.min.y + pSize.y * 0.12;
        node.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const pos = o.geometry.getAttribute("position");
            const step = Math.max(1, Math.floor(pos.count / 400));
            for (let i = 0; i < pos.count; i += step) {
              gv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
              if (gv.y <= groundBandTop) {
                gx += gv.x;
                gz += gv.z;
                gn++;
              }
            }
          }
        });
        const tx = gn > 0 ? gx / gn : (pBox.min.x + pBox.max.x) / 2;
        const tz = gn > 0 ? gz / gn : (pBox.min.z + pBox.max.z) / 2;
        const rotY = 0.7;
        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);
        node.scale.setScalar(ps);
        node.rotation.y = rotY;
        node.position.set(
          -ps * (cosR * tx + sinR * tz),
          -pBox.min.y * ps,
          -ps * (-sinR * tx + cosR * tz),
        );
        node.traverse((o) => {
          o.userData.packShared = true;
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            // The Town Tree gets its OWN cloned materials with the
            // townTree wind kind, the least sway of any large tree
            // in town: rooted, monumental, only a breathing at the
            // crown. (Cloning first so the shared pack materials
            // keep the ordinary tree wind for everyone else.)
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const wound = mats.map((m) =>
              applyWindToMaterial((m as THREE.Material).clone(), "townTree"),
            );
            o.material = Array.isArray(o.material) ? wound : wound[0]!;
          }
        });
        treeBody.add(node);
        packPlaced = true;
        if (season === "autumn") {
          const leafColors = [0xd98a2b, 0xc95f27, 0xe8b13a, 0xb84a24];
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2 + (i % 5) * 0.17;
            const rad = 2.7 + (i % 4) * 0.45;
            const leaf = new THREE.Mesh(
              new THREE.CircleGeometry(0.17, 6),
              mat(leafColors[i % leafColors.length] ?? 0xd98a2b),
            );
            leaf.rotation.x = -Math.PI / 2;
            leaf.rotation.z = i * 1.3;
            leaf.position.set(Math.cos(a) * rad, 0.035, Math.sin(a) * rad);
            treeGround.add(leaf);
          }
        }
        if (winter) {
          const moundSnow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), mat(0xeef4f8));
          moundSnow.rotation.x = -Math.PI / 2;
          moundSnow.position.y = 0.445;
          treeGround.add(moundSnow);
        }
      }
    }

    if (!packPlaced) {
    // Trunk: a tapered cylinder with flared roots.
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.58, 3.1, 9),
      treeTrunkMat,
    );
    trunk.position.y = 1.55;
    trunk.castShadow = true;
    treeBody.add(trunk);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const root = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.2, 1.05, 6),
        treeTrunkMat,
      );
      root.position.set(Math.cos(a) * 0.52, 0.28, Math.sin(a) * 0.52);
      root.rotation.z = Math.cos(a) * 0.85;
      root.rotation.x = -Math.sin(a) * 0.85;
      root.castShadow = true;
      treeBody.add(root);
    }
    // Branches reaching into the canopy, in winter they carry the show.
    const branchTips: [number, number, number][] = [];
    const branches: [number, number, number, number][] = [
      // [angle around trunk, tilt, length, height where it leaves the trunk]
      [0.3, 0.75, 1.9, 2.5],
      [2.2, 0.85, 1.75, 2.7],
      [4.1, 0.7, 1.85, 2.4],
      [5.3, 1.0, 1.45, 2.9],
      [1.2, 0.45, 1.5, 3.0],
    ];
    for (const [ang, tilt, len, baseY] of branches) {
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.16, len, 6),
        treeTrunkMat,
      );
      const dir = new THREE.Vector3(Math.cos(ang) * Math.sin(tilt), Math.cos(tilt), Math.sin(ang) * Math.sin(tilt));
      branch.position.set(dir.x * len * 0.32, baseY + dir.y * len * 0.32, dir.z * len * 0.32);
      branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      branch.castShadow = true;
      treeBody.add(branch);
      branchTips.push([dir.x * len * 0.92, baseY + dir.y * len * 0.92, dir.z * len * 0.92]);
    }

    const extras = new THREE.Group();
    treeBody.add(extras);

    if (!winter) {
      // Leafy canopy blobs in the season's colours.
      const canopy = new THREE.Group();
      const colors = SEASON_CANOPY[season];
      CANOPY_BLOBS.forEach(([bx, by, bz, r], i) => {
        const b = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r, 2),
          applyWindToMaterial(mat(colors[i % colors.length] ?? 0x4c9440, { rough: 0.88 }), "townTree"),
        );
        b.position.set(bx, by, bz);
        b.castShadow = true;
        canopy.add(b);
      });
      treeBody.add(canopy);
      treeCanopy = canopy;

      if (season === "spring") {
        // Pink blossom puffs and blossom dots over the canopy.
        for (const [bx, by, bz] of [
          [1.7, 4.6, 0.9],
          [-1.8, 4.7, 0.5],
          [0.3, 6.1, -0.4],
          [-0.9, 4.2, 1.4],
          [1.1, 5.2, -1.2],
        ] as [number, number, number][]) {
          const puff = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.62, 2),
            mat(0xf6b8d0, { rough: 0.9 }),
          );
          puff.position.set(bx, by, bz);
          puff.castShadow = true;
          canopy.add(puff);
        }
        for (let i = 0; i < 16; i++) {
          const blob = CANOPY_BLOBS[i % CANOPY_BLOBS.length]!;
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), mat(0xfbd3e3));
          dot.position.set(
            blob[0] + Math.sin(i * 2.4) * blob[3] * 0.85,
            blob[1] + Math.cos(i * 1.7) * blob[3] * 0.5,
            blob[2] + Math.cos(i * 2.9) * blob[3] * 0.85,
          );
          canopy.add(dot);
        }
      }
      if (season === "autumn") {
        // A ring of fallen leaves on the peristyle around the mound.
        const leafColors = [0xd98a2b, 0xc95f27, 0xe8b13a, 0xb84a24];
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2 + (i % 5) * 0.17;
          const rad = 2.7 + (i % 4) * 0.45;
          const leaf = new THREE.Mesh(
            new THREE.CircleGeometry(0.17, 6),
            mat(leafColors[i % leafColors.length] ?? 0xd98a2b),
          );
          leaf.rotation.x = -Math.PI / 2;
          leaf.rotation.z = i * 1.3;
          leaf.position.set(Math.cos(a) * rad, 0.035, Math.sin(a) * rad);
          treeGround.add(leaf);
        }
      }
    } else {
      // Winter: bare branches get little caps of snow, and snow dusts
      // the mound's grass top.
      for (const [tx, ty, tz] of branchTips) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0xf4f8fb));
        cap.scale.set(1.25, 0.5, 1.25);
        cap.position.set(tx, ty + 0.1, tz);
        cap.castShadow = true;
        extras.add(cap);
      }
      const crownSnow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(0xf4f8fb));
      crownSnow.scale.set(1.3, 0.45, 1.3);
      crownSnow.position.set(0, 3.25, 0);
      extras.add(crownSnow);
      const moundSnow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), mat(0xeef4f8));
      moundSnow.rotation.x = -Math.PI / 2;
      moundSnow.position.y = 0.445;
      treeGround.add(moundSnow);
    }

    }
    // Growth stage = an even scale from the ground up.
    const STAGE_SCALES = [0.42, 0.66, 0.92, 1.22, 1.5];
    const s = STAGE_SCALES[Math.min(currentTreeStage, STAGE_SCALES.length - 1)] ?? 1;
    treeBody.scale.setScalar(s);
  }
  buildTreeBody();
  townTree.traverse((o) => {
    o.userData.pick = { kind: "tree", id: "town-tree" } satisfies { kind: PickKind; id: string };
  });
  townTree.position.y = terrainHeight(0, 0);
  world.add(townTree);

  // Seasonal drift: soft round points falling gently around the tree,
  // petals in spring, drifting motes in summer, leaves in autumn, snow
  // in winter. Colour and fall speed change with the season.
  const driftCount = 90;
  const driftPos = new Float32Array(driftCount * 3);
  const driftSeed: number[] = [];
  for (let i = 0; i < driftCount; i++) driftSeed.push(Math.random());
  const driftGeo = new THREE.BufferGeometry();
  driftGeo.setAttribute("position", new THREE.BufferAttribute(driftPos, 3));
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = 64;
  spriteCanvas.height = 64;
  const sctx = spriteCanvas.getContext("2d");
  if (sctx) {
    const grad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
  }
  const driftMat = new THREE.PointsMaterial({
    size: 0.3,
    map: new THREE.CanvasTexture(spriteCanvas),
    transparent: true,
    depthWrite: false,
    color: 0xfbd3e3,
    opacity: 0.9,
  });
  const drift = new THREE.Points(driftGeo, driftMat);
  world.add(drift);
  const DRIFT_STYLE: Record<Season, { color: number; size: number; fall: number; spread: number; height: number }> = {
    spring: { color: 0xfbd3e3, size: 0.3, fall: 0.32, spread: 5.2, height: 4.6 },
    summer: { color: 0xfff2b0, size: 0.2, fall: 0.16, spread: 5.6, height: 3.4 },
    autumn: { color: 0xe09a3a, size: 0.34, fall: 0.42, spread: 5.4, height: 4.8 },
    winter: { color: 0xffffff, size: 0.26, fall: 0.5, spread: 7.5, height: 6.5 },
  };
  function applyDriftStyle() {
    const style = DRIFT_STYLE[currentTreeSeason];
    driftMat.color.setHex(style.color);
    driftMat.size = style.size;
    drift.visible = true;
  }
  applyDriftStyle();

  // --- Stylized weather ---------------------------------------------------
  // Muse Town's own COZY-inspired weather: random events (clear spells,
  // breezes, rain, snow, fog, storms, rainbows after rain, and rare sparkle
  // showers) that blend into each other over a few seconds. Every weather
  // is a set of target parameters, sky colours, fog, light levels, cloud
  // tint and speed, precipitation and wind strengths, and the live values
  // ease toward them each frame, on top of the day/night blend. Weather is
  // ephemeral by design: nothing here is saved.
  interface WeatherParams {
    skyTop: THREE.Color;
    skyHor: THREE.Color;
    fogNear: number;
    fogFar: number;
    sunMul: number;
    hemiMul: number;
    cloudColor: THREE.Color;
    cloudOpacity: number;
    cloudSpeed: number;
    rain: number;
    snow: number;
    wind: number;
    sparkle: number;
    rainbow: number;
    groundTint: THREE.Color;
    groundDim: number;
    drift: number;
  }
  const wp = (
    skyTop: number,
    skyHor: number,
    fogNear: number,
    fogFar: number,
    sunMul: number,
    hemiMul: number,
    cloudColor: number,
    cloudOpacity: number,
    cloudSpeed: number,
    rain: number,
    snow: number,
    wind: number,
    sparkle: number,
    rainbow: number,
    groundTint: number,
    groundDim: number,
    driftAmt: number,
  ): WeatherParams => ({
    skyTop: new THREE.Color(skyTop),
    skyHor: new THREE.Color(skyHor),
    fogNear,
    fogFar,
    sunMul,
    hemiMul,
    cloudColor: new THREE.Color(cloudColor),
    cloudOpacity,
    cloudSpeed,
    rain,
    snow,
    wind,
    sparkle,
    rainbow,
    groundTint: new THREE.Color(groundTint),
    groundDim,
    drift: driftAmt,
  });
  const WEATHER_PARAMS: Record<WeatherId, WeatherParams> = {
    clear: wp(0x6db9e8, 0xd8f0e2, 95, 235, 1, 1, 0xffffff, 0.92, 0.3, 0, 0, 0.12, 0, 0, 0xffffff, 0, 1),
    breezy: wp(0x74c2ee, 0xdff3e4, 85, 225, 1, 1, 0xffffff, 0.9, 1.7, 0, 0, 1, 0, 0, 0xffffff, 0, 1.15),
    rain: wp(0x9aabb6, 0xddd5c6, 60, 175, 0.62, 0.84, 0xc8cbca, 0.96, 0.6, 1, 0, 0.3, 0, 0, 0x93a29f, 0.42, 0.12),
    snow: wp(0xa9c6dd, 0xe6eef2, 40, 136, 0.62, 0.85, 0xe8eef2, 0.97, 0.5, 0, 1, 0.3, 0, 0, 0xdfe9ee, 0.55, 0.3),
    fog: wp(0xb7c9c4, 0xdfe8dd, 14, 70, 0.45, 0.8, 0xdfe5df, 0.98, 0.25, 0, 0, 0.08, 0, 0, 0xa7b5a8, 0.35, 0.4),
    storm: wp(0x54657e, 0x8d99a8, 43, 143, 0.34, 0.55, 0x6f7c8e, 0.99, 2.3, 1.6, 0, 1.3, 0, 0, 0x6d7f8f, 0.6, 0),
    rainbow: wp(0x74bde9, 0xf3e9d2, 85, 225, 1.05, 1.02, 0xffffff, 0.85, 0.5, 0, 0, 0.18, 0, 1, 0xa8bf9f, 0.1, 0.8),
    sparkles: wp(0x7cc0ea, 0xfdeec9, 90, 235, 1.08, 1.05, 0xfff6e0, 0.9, 0.4, 0, 0, 0.15, 1, 0, 0xffffff, 0, 1),
  };
  const WEATHER_DURATION: Record<WeatherId, [number, number]> = {
    clear: [55, 95],
    breezy: [40, 70],
    rain: [180, 300],
    snow: [45, 75],
    fog: [40, 65],
    storm: [35, 55],
    rainbow: [30, 45],
    sparkles: [30, 50],
  };
  const cloneParams = (p: WeatherParams): WeatherParams => ({
    ...p,
    skyTop: p.skyTop.clone(),
    skyHor: p.skyHor.clone(),
    cloudColor: p.cloudColor.clone(),
    groundTint: p.groundTint.clone(),
  });
  let weatherId: WeatherId = "clear";
  let weatherManual = false;
  let weatherEndsAt = 0;
  const wCur = cloneParams(WEATHER_PARAMS.clear);
  let wTarget = WEATHER_PARAMS.clear;
  // Slow ground memory: wetness after rain, snow cover after snow. Both
  // build while their weather is active and fade away afterwards.
  let wetness = 0;
  let snowCover = 0;
  // Lightning: at most one strike every several seconds, each a gentle
  // double pulse, never a fast strobe.
  let lightningFlash = 0;
  let nextStrikeIn = 9;
  let strikeAge = 99;

  function chooseNextWeather(): WeatherId {
    const prev = weatherId;
    const afterRain = prev === "rain" || prev === "storm";
    const table: [WeatherId, number][] = [
      ["clear", afterRain ? 20 : 30],
      ["breezy", 17],
      ["rain", 6],
      ["fog", 10],
      ["sparkles", 7],
      ["snow", currentTreeSeason === "winter" ? 15 : 0],
      ["storm", 7],
      ["rainbow", afterRain ? 30 : 0],
    ];
    let total = 0;
    for (const [, w] of table) total += w;
    let roll = Math.random() * total;
    for (const [id, w] of table) {
      roll -= w;
      if (roll <= 0) {
        if (id === prev && id !== "clear") return "clear";
        return id;
      }
    }
    return "clear";
  }

  function setWeatherInternal(id: WeatherId, manual: boolean) {
    weatherId = id;
    weatherManual = manual;
    // The town wind follows the shown weather: every spell change
    // (random, or a toggle through setWeather) re-aims the wind,
    // one state and one direction per spell.
    setTownWindSpell(windStateForWeather(id));
    wTarget = WEATHER_PARAMS[id];
    const [minS, maxS] = WEATHER_DURATION[id];
    weatherEndsAt = Date.now() + (minS + Math.random() * (maxS - minS)) * 1000;
    opts.onWeatherChange?.({
      id,
      manual,
      endsAt: manual ? null : weatherEndsAt,
    });
  }
  setWeatherInternal("clear", false);

  // Rain: short falling streaks (line segments) slanted by the wind, with
  // little splash rings where they land and puddles that gather while the
  // ground stays wet.
  // The rain gathers in a box around the viewer rather than thinning
  // out over the whole town, so fewer, softer streaks read as more.
  const RAIN_COUNT = 480;
  const RAIN_HALF = 24;
  const rainPos = new Float32Array(RAIN_COUNT * 2 * 3);
  // Each streak fades out toward its tail, so none has a hard end.
  const rainFade = new Float32Array(RAIN_COUNT * 2 * 4);
  for (let i = 0; i < RAIN_COUNT * 2; i++) {
    rainFade.set([1, 1, 1, i % 2 === 0 ? 1 : 0], i * 4);
  }
  const rainDrops: { x: number; y: number; z: number; speed: number }[] = [];
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainDrops.push({
      x: (Math.random() - 0.5) * RAIN_HALF * 2,
      y: Math.random() * 22,
      z: (Math.random() - 0.5) * RAIN_HALF * 2,
      speed: 8 + Math.random() * 4,
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  rainGeo.setAttribute("color", new THREE.BufferAttribute(rainFade, 4));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xcfe2ee,
    transparent: true,
    opacity: 0,
    vertexColors: true,
    depthWrite: false,
  });
  const rainFacing = new THREE.Vector3();
  // Roofs a walker can stand under: the lake pavilion and the three stalls.
  const RAIN_SHELTERS: Shelter[] = [
    [LAKE_PAVILION.position[0], LAKE_PAVILION.position[1], 2.4],
    ...MARKET_BOOTHS.map(([x, z]) => [x, z, 1.9] as Shelter),
  ];
  let lastRainLevelAt = -10;
  /** Above the house's roof ridge, rain may fall over it; below, never inside. */
  const HOME_RAIN_ROOF = 6;
  /** How sheltered a spot is from the rain: the roofs above, and their
   *  house, whose inside is fully covered (its own rectangle, not a radius). */
  const shelterAt = (x: number, z: number): number =>
    Math.max(shelterAmount(x, z, RAIN_SHELTERS), homeHouse.inside(x, z) ? 1 : 0);
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  world.add(rainLines);

  const splashes: { mesh: THREE.Mesh; phase: number }[] = [];
  {
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xdcebf2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.15, 12), splashMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.position.set((Math.random() - 0.5) * 40, 0.06, (Math.random() - 0.5) * 40);
      world.add(m);
      splashes.push({ mesh: m, phase: Math.random() });
    }
  }
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x9fc2d4,
    transparent: true,
    opacity: 0,
    roughness: 0.12,
    metalness: 0.15,
    depthWrite: false,
  });
  for (const [px, pz, pr] of [
    [3.4, 0.6, 1.15],
    [-3.4, -1.8, 0.95],
    [0.8, 4.1, 0.85],
    [-1.2, -4.3, 1.05],
    [6.8, 0.3, 0.8],
    [-7.4, -0.2, 0.9],
    [0.4, -7.6, 0.8],
    [-0.6, 7.8, 0.9],
    [1.2, 30, 0.8],
    [-1.4, 38, 0.9],
  ] as [number, number, number][]) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(pr, 18), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(px, 0.045, pz);
    puddle.scale.set(1, 0.72, 1);
    world.add(puddle);
  }

  // Snow: big soft flakes over the whole town, swaying as they fall.
  const SNOW_COUNT = 1000;
  const snowPos = new Float32Array(SNOW_COUNT * 3);
  const snowSeed: number[] = [];
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowSeed.push(Math.random());
    snowPos[i * 3] = (Math.random() - 0.5) * 110;
    snowPos[i * 3 + 1] = Math.random() * 20;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 110;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({
    size: 0.3,
    map: new THREE.CanvasTexture(spriteCanvas),
    transparent: true,
    depthWrite: false,
    color: 0xffffff,
    opacity: 0,
  });
  const snowPoints = new THREE.Points(snowGeo, snowMat);
  snowPoints.frustumCulled = false;
  world.add(snowPoints);

  // Sparkle shower: golden motes twinkling down around the peristyle.
  const SPARK_COUNT = 150;
  const sparkPos = new Float32Array(SPARK_COUNT * 3);
  const sparkSeed: number[] = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    sparkSeed.push(Math.random());
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 9;
    sparkPos[i * 3] = Math.cos(a) * r;
    sparkPos[i * 3 + 1] = Math.random() * 6.5;
    sparkPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.22,
    map: new THREE.CanvasTexture(spriteCanvas),
    transparent: true,
    depthWrite: false,
    color: 0xffd34e,
    opacity: 0,
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  world.add(sparkPoints);

  // Wind streaks: quick pale dashes that race across town when it blows.
  const WIND_COUNT = 46;
  const windPos = new Float32Array(WIND_COUNT * 2 * 3);
  const windStreaksData: { x: number; y: number; z: number; speed: number }[] = [];
  for (let i = 0; i < WIND_COUNT; i++) {
    windStreaksData.push({
      x: (Math.random() - 0.5) * 100,
      y: 0.5 + Math.random() * 2.6,
      z: (Math.random() - 0.5) * 96,
      speed: 7 + Math.random() * 6,
    });
  }
  const windGeo = new THREE.BufferGeometry();
  windGeo.setAttribute("position", new THREE.BufferAttribute(windPos, 3));
  const windMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
  });
  const windLines = new THREE.LineSegments(windGeo, windMat);
  windLines.frustumCulled = false;
  world.add(windLines);

  // The rainbow: six coloured arcs standing over the northern hills,
  // fading in when the rainbow weather arrives and out when it leaves.
  const rainbowGroup = new THREE.Group();
  {
    const rainbowColors = [0xe2574c, 0xf28c4e, 0xf2c14e, 0x7ac74f, 0x5b8dd9, 0x9b7ed9];
    rainbowColors.forEach((color, i) => {
      const arcMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(17 - i * 0.62, 0.3, 8, 42, Math.PI),
        arcMat,
      );
      rainbowGroup.add(arc);
    });
    rainbowGroup.position.set(0, 0.5, -58);
    rainbowGroup.scale.setScalar(1.55);
    world.add(rainbowGroup);
  }

  // A dedicated lightning light, flashed by the storm code in the frame loop.
  const lightningLight = new THREE.DirectionalLight(0xdfe9ff, 0);
  lightningLight.position.set(-10, 30, -14);
  scene.add(lightningLight);

  // --- Roman oil lanterns -------------------------------------------------
  // Stone-and-bronze standards carry small hanging oil cages over the road.
  // Their flames, halos, wet reflections, moths, staggered dusk lighting and
  // camera-budgeted local lights live in one circuit. Unlike the old broad
  // plaza wash, light now visibly comes from the individual cages.
  const streetLamps = createStreetLampSystem(scene, world);
  const buildLanternCage = streetLamps.buildCage;
  const buildLanternPost = streetLamps.buildPost;
  const lanternBronze = mat(0x3a3128, { rough: 0.55, metal: 0.45 });
  const lanternIron = mat(0x2b241d, { rough: 0.6, metal: 0.35 });

  // Lamp posts. The south-east and north-west plaza lamps were nudged
  // outward onto the grass verge (were [3.6, 3.6] and [-3.6, -3.6]):
  // their bases clipped the cobbled lanes where the lanes merge into
  // the peristyle. The bunting square and the festival wreath below use
  // these same two moved corners.
  const lampHeads: THREE.MeshStandardMaterial[] = [];
  const lampPositions: [number, number][] = [
    [4.6, 8.4],
    [-4.6, 8.4],
    [4.6, -8.4],
    [-4.6, -8.4],
    [6.4, 19.6],
    [-6.4, 19.6],
  ];
  for (let i = 0; i < lampPositions.length; i++) {
    const [lx, lz] = lampPositions[i]!;
    const lamp = buildLanternPost({
      inward: lx > 0 ? -1 : 1,
      variant: (i % 2) as 0 | 1,
      ignitionOrder: Math.min(1, Math.hypot(lx, lz) / 42),
    });
    lamp.position.set(lx, terrainHeight(lx, lz), lz);
    world.add(lamp);
  }

  // --- Town upgrades (bought with denarii at the project board) -------
  // Permanent fixtures, built once and shown when the saved purse says
  // they're bought. The fountain stands in the forecourt, on the axis;
  // its water disc turns slowly whenever it's restored.
  const upgradeGroups: Record<string, THREE.Group> = {};
  let fountainWater: THREE.Mesh | null = null;
  let metaSweat: THREE.Mesh | null = null;
  {
    // Extra lanterns up the avenue (heads join the lamp circuit).
    const lanternGroup = new THREE.Group();
    const avenueLamps = [[3, 27.2], [-3, 27.2], [3, 37], [-3, 37]] as [number, number][];
    for (let i = 0; i < avenueLamps.length; i++) {
      const [lx, lz] = avenueLamps[i]!;
      const lamp = buildLanternPost({
        inward: lx > 0 ? -1 : 1,
        variant: (i % 2) as 0 | 1,
        ignitionOrder: 0.62 + i * 0.08,
      });
      lamp.position.set(lx, terrainHeight(lx, lz), lz);
      lanternGroup.add(lamp);
    }
    lanternGroup.visible = false;
    world.add(lanternGroup);
    upgradeGroups.lanterns = lanternGroup;
    // Flower planters around the peristyle's edge.
    const planterGroup = new THREE.Group();
    for (const [px, pz] of [[7.4, -7.4], [-7.4, -7.4], [7.4, 7.4], [-7.4, 7.4]] as [number, number][]) {
      const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.6), mat(0x8a8d90, { rough: 0.9 }));
      boxMesh.position.set(px, terrainHeight(px, pz) + 0.21, pz);
      planterGroup.add(boxMesh);
      for (let f = 0; f < 5; f++) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 8, 6),
          applyWindToMaterial(mat([0xe2574c, 0xf2c14e, 0xd97bc4, 0xe8e3d8, 0xe07b2a][f % 5]!, { rough: 0.7 }), "flower"),
        );
        flower.position.set(px - 0.5 + f * 0.25, terrainHeight(px, pz) + 0.52, pz + (f % 2 === 0 ? 0.1 : -0.1));
        planterGroup.add(flower);
      }
    }
    planterGroup.visible = false;
    world.add(planterGroup);
    upgradeGroups.planters = planterGroup;
    // The restored fountain: a stone basin and a living water disc.
    const fountainGroup = new THREE.Group();
    const [fx, fz] = VILLA.metaSudans;
    const fy = terrainHeight(fx, fz);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.55, 18), mat(0x9aa0a3, { rough: 0.85 }));
    basin.position.set(fx, fy + 0.27, fz);
    basin.castShadow = true;
    fountainGroup.add(basin);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.38, 24),
      new THREE.MeshStandardMaterial({ color: 0x3f8fbf, roughness: 0.25, transparent: true, opacity: 0.85, emissive: 0x0a2e4a, emissiveIntensity: 0.3 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(fx, fy + 0.52, fz);
    fountainGroup.add(water);
    fountainWater = water;
    // The Meta Sudans: no jet, just water sweating down a brick cone.
    const meta = buildMetaSudans(mat(0xa8694a, { rough: 0.9 }));
    meta.group.position.set(fx, fy + 0.5, fz);
    fountainGroup.add(meta.group);
    metaSweat = meta.sweat;
    fountainGroup.visible = false;
    world.add(fountainGroup);
    upgradeGroups.fountain = fountainGroup;
  }
  let fountainColliderAdded = false;

  // --- Garden growth (the Hortus beds, over real days) -----------------
  // Sprouts rise in the three beds by stage: a green whisper, a proper
  // crop, then a flowering readiness. The saved garden state drives it.
  const gardenSprouts = new THREE.Group();
  {
    for (const [bx, bz] of GARDEN_BEDS) {
      for (let s = 0; s < 4; s++) {
        const sprout = new THREE.Mesh(
          new THREE.ConeGeometry(0.09, 0.42, 6),
          applyWindToMaterial(mat(0x4e9a3f, { rough: 0.8 }), "crop"),
        );
        sprout.position.set(bx - 0.5 + s * 0.33, terrainHeight(bx, bz) + 0.5, bz + (s % 2 === 0 ? 0.18 : -0.18));
        gardenSprouts.add(sprout);
      }
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        applyWindToMaterial(mat(0xf2c14e, { rough: 0.7 }), "flower"),
      );
      bloom.position.set(bx, terrainHeight(bx, bz) + 0.78, bz);
      bloom.name = "garden-bloom";
      gardenSprouts.add(bloom);
    }
    gardenSprouts.visible = false;
    world.add(gardenSprouts);
  }

  // Bunting strung between the four plaza lamps, little festival flags
  // in the town's house colours, a signature village-square touch.
  const buntingGroup = new THREE.Group();
  const buntingFlagMats: THREE.MeshStandardMaterial[] = [];
  const buntingDefaultColors = [0xe2574c, 0xf2c14e, 0x2aa79b, 0x5b8dd9, 0xd97bc4];
  {
    const flagColors = buntingDefaultColors;
    const plazaLamps: [number, number][] = [[4.6, 8.4], [-4.6, 8.4], [-4.6, -8.4], [4.6, -8.4]];
    for (let s = 0; s < plazaLamps.length; s++) {
      const a = plazaLamps[s]!;
      const b = plazaLamps[(s + 1) % plazaLamps.length]!;
      const start = new THREE.Vector3(a[0], 2.95, a[1]);
      const end = new THREE.Vector3(b[0], 2.95, b[1]);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y -= 0.55;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const rope = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 16, 0.02, 5),
        mat(0x6b543a, { rough: 0.9 }),
      );
      buntingGroup.add(rope);
      for (let f = 1; f <= 6; f++) {
        const p = curve.getPoint(f / 7);
        const flagShape = new THREE.Shape();
        flagShape.moveTo(-0.16, 0);
        flagShape.lineTo(0.16, 0);
        flagShape.lineTo(0, -0.34);
        flagShape.closePath();
        const flagMat = new THREE.MeshStandardMaterial({
          color: flagColors[(s * 6 + f) % flagColors.length]!,
          side: THREE.DoubleSide,
          roughness: 0.8,
        });
        buntingFlagMats.push(flagMat);
        const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), flagMat);
        flag.position.copy(p);
        flag.rotation.y = Math.atan2(end.x - start.x, end.z - start.z) + Math.PI / 2;
        buntingGroup.add(flag);
      }
    }
  }
  world.add(buntingGroup);

  // The peristyle wreath: a laurel ring hung on the peristyle lamp nearest the
  // tree, shown only on festival days (its berries take the festival's
  // first color). Everyday town: hidden.
  const wreathGroup = new THREE.Group();
  const wreathBerryMat = new THREE.MeshStandardMaterial({ color: 0xd95f4b, roughness: 0.5 });
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 8, 22), mat(0x51683c, { rough: 0.85 }));
    wreathGroup.add(ring);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), wreathBerryMat);
      berry.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.05);
      wreathGroup.add(berry);
    }
    wreathGroup.position.set(4.6, terrainHeight(4.6, 8.4) + 2.15, 8.4 - 0.24);
    wreathGroup.visible = false;
    world.add(wreathGroup);
  }

  // The peristyle's one remaining Roman bench, from the pack: stone. It
  // used to stand at (3.6, 1.8), squarely on the walking route
  // across the peristyle between Muse and the town tree, blocking the
  // Centurion (and Muse, following), it now sits on the grass
  // wedge between the east and south-east lanes, east of the peristyle,
  // same facing, with clear walking space around it. The wooden
  // bench that stood on the west lane by the tree was deleted at
  // the owner's word (Nov 1), mesh, seat entry, and, after the
  // orphan-collider audit found it standing in the lane as an
  // invisible wall, its collider too.
  // The placed bench groups, kept so sitting can MEASURE each
  // bench's true world seat height from its own transform (see
  // benchSeatWorldY in the benches section) instead of trusting a
  // terrain sample at a possibly different point.
  const benchGroups = new Map<string, THREE.Group>();
  // The stone bench's backrest (owner's report, Nov 6, 2026: the plaza
  // bench offered "Sit" from behind and seated the pair facing its own
  // back). The scene's rule is backrest on local +Z, a sitter faces
  // -Z; the GLB rebuilt from the pack on Nov 5 carries its backrest on
  // -Z. Measured rather than assumed, so either edition of the file
  // sits right: the model's top third says where the back is, and a
  // back on -Z turns the model half round inside its wrap, recentred.
  // The wrap's own rotY, the seat slots and the prompt point are the
  // design's and stay.
  const faceBackrestPlusZ = (wrap: THREE.Group) => {
    const inner = wrap.children[0];
    if (!inner) return;
    wrap.updateWorldMatrix(true, true);
    const v = new THREE.Vector3();
    const local: { y: number; z: number }[] = [];
    wrap.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const pos = o.geometry.getAttribute("position");
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        wrap.worldToLocal(v);
        local.push({ y: v.y, z: v.z });
      }
    });
    if (local.length === 0) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const q of local) {
      if (q.y < minY) minY = q.y;
      if (q.y > maxY) maxY = q.y;
    }
    const top = minY + (maxY - minY) * 0.7;
    let zSum = 0;
    let n = 0;
    for (const q of local) if (q.y >= top) { zSum += q.z; n++; }
    if (n === 0 || zSum / n >= 0) return;
    inner.rotation.y += Math.PI;
    inner.updateMatrix();
    wrap.updateWorldMatrix(true, true);
    // Recentre: the half turn swung the box about the inner origin.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    wrap.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const pos = o.geometry.getAttribute("position");
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        wrap.worldToLocal(v);
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.z < minZ) minZ = v.z;
        if (v.z > maxZ) maxZ = v.z;
      }
    });
    inner.position.x -= (minX + maxX) / 2;
    inner.position.z -= (minZ + maxZ) / 2;
    inner.updateMatrix();
    wrap.updateWorldMatrix(true, true);
  };
  void placeWorld(benchStoneUrl, { x: 8.8, z: 4.6, rotY: Math.PI / 2, width: 1.9 }).then((g) => {
    if (disposed) return null;
    if (g) {
      faceBackrestPlusZ(g);
      benchGroups.set("bench-stone", g);
    }
  });

  // A floating text sign (the same canvas-sprite trick as the character
  // name labels), used for the basilica and Domus Architecti signs.
  function makeTextLabel(text: string, bg: string, fg: string): THREE.Sprite {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = bg;
      g.beginPath();
      if (typeof g.roundRect === "function") g.roundRect(56, 14, 400, 100, 50);
      else g.rect(56, 14, 400, 100);
      g.fill();
      g.fillStyle = fg;
      // Longer names (DOMVS ARCHITECTI) shrink to stay inside the pill.
      let size = 52;
      g.font = `700 ${size}px sans-serif`;
      while (size > 26 && g.measureText(text).width > 360) {
        size -= 2;
        g.font = `700 ${size}px sans-serif`;
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, 256, 66);
    }
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    );
    return sprite;
  }

  // Pack vegetation: the Roman Empire pack's own trees, bushes, and
  // flowers, converted like the buildings, so the greenery matches the
  // district's art style. (The Town Tree stays procedural, it grows
  // and changes with the seasons.) TreePlacement checks loaded tree
  // canopies against whole buildings, including roofs: the old centre-
  // radius estimates did not guarantee clearance from overhangs.
  const PACK_BUSHES = [bushAUrl, bushBUrl, bushCUrl, bushDUrl, bushEUrl];
  const PACK_TREES = [treeAUrl, treeBUrl, treeCUrl, treeDUrl];
  const PACK_FLOWERS = [flowerAUrl, flowerMedUrl, flowerGroupUrl];

  // The Embassy gatehouse (Nov 1): a modest porta beside the south
  // gate, built procedurally, no pack model is a gatehouse, and
  // this one wanted to be small. Two pillars and a round arch over a
  // CLOSED, iron-banded wooden door (the road to the other town does
  // not exist yet, and the building says so), a little walled
  // chamber behind it, a tiled pyramid roof, and above the arch a
  // carved tablet in the town's inscription style: VIA AD VRBEM
  // ALTERAM, the road to the other city. On the porch platform, a
  // stone bench, and on the bench a sealed letter addressed to the
  // other town, waiting for a road that does not exist yet. The
  // gatehouse stands in the PLACES loop's standard platform and
  // doorstep and is collided by the default place footprint
  // (probe-audited for this site, pillars included).
  function makeInscriptionTablet(text: string): THREE.Sprite {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 160;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "rgba(70,58,40,0.94)";
      g.beginPath();
      if (typeof g.roundRect === "function") g.roundRect(8, 8, 1008, 144, 18);
      else g.rect(8, 8, 1008, 144);
      g.fill();
      g.strokeStyle = "rgba(239,230,204,0.45)";
      g.lineWidth = 3;
      g.beginPath();
      if (typeof g.roundRect === "function") g.roundRect(22, 22, 980, 116, 12);
      else g.rect(22, 22, 980, 116);
      g.stroke();
      g.fillStyle = "#efe6cc";
      g.font = "700 62px Georgia, 'Times New Roman', serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, 512, 84);
    }
    return new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    );
  }
  function buildEmbassyGatehouse(house: THREE.Group, roofColor: number) {
    const y0 = 0.35; // the platform top, where every building stands
    const stone = 0xcfc4a5;
    const stoneDark = 0xbdb094;
    // Pillars flanking the arch, and the chamber's side/back walls.
    for (const s of [-1, 1]) {
      house.add(box(0.95, 3.5, 0.95, stone, s * 1.85, y0 + 1.75, 1.05, { rough: 0.95 }));
      house.add(box(0.8, 3.5, 3.4, stone, s * 2.4, y0 + 1.75, -0.8, { rough: 0.95 }));
    }
    house.add(box(5.6, 3.5, 0.8, stone, 0, y0 + 1.75, -2.1, { rough: 0.95 }));
    // The closed double door, iron-banded, shut until the road opens.
    for (const s of [-1, 1]) {
      house.add(box(1.32, 2.45, 0.14, 0x6b4a2c, s * 0.67, y0 + 1.22, 0.92, { rough: 0.9 }));
      for (const by of [0.6, 1.9]) {
        house.add(box(1.32, 0.1, 0.03, 0x2e2a26, s * 0.67, y0 + by, 1.0, { rough: 0.6 }));
      }
    }
    // The round arch over the door: a stone half-torus trim.
    const archTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.34, 0.17, 8, 24, Math.PI),
      mat(stoneDark, { rough: 0.95 }),
    );
    archTrim.position.set(0, y0 + 2.0, 1.0);
    archTrim.castShadow = true;
    house.add(archTrim);
    // The frieze beam above the arch, carrying the inscription.
    house.add(box(5.9, 0.55, 1.1, stoneDark, 0, y0 + 3.77, 1.1, { rough: 0.95 }));
    const tablet = makeInscriptionTablet("VIA AD VRBEM ALTERAM");
    tablet.scale.set(5.2, 0.81, 1);
    tablet.position.set(0, y0 + 3.85, 1.72);
    house.add(tablet);
    // Eaves slab and a low tiled pyramid roof.
    house.add(box(5.9, 0.22, 4.9, stoneDark, 0, y0 + 4.16, -0.45, { rough: 0.95 }));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 3.7, 1.15, 4), mat(roofColor, { rough: 0.9 }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.12, 1, 0.92);
    roof.position.set(0, y0 + 4.84, -0.45);
    roof.castShadow = true;
    house.add(roof);
    // The porch bench, and the sealed letter waiting on it.
    void placeModel(benchStoneUrl, house, { x: -2.3, z: 2.62, y: 0.14, rotY: 0.35, width: 1.9 }).then((g) => {
      if (g && !disposed) faceBackrestPlusZ(g);
    });
    const letter = box(0.36, 0.05, 0.25, 0xf5efe0, -2.28, 0.64, 2.6, { rough: 0.7 });
    letter.rotation.y = 0.5;
    house.add(letter);
    const seal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(roofColor, { rough: 0.5 }));
    seal.position.set(-2.28, 0.68, 2.6);
    seal.castShadow = true;
    house.add(seal);
  }

  // Houses + residents.
  const pickRoots: THREE.Object3D[] = [townTree];
  const residents: THREE.Group[] = [];
  for (const place of PLACES) {
    const house = new THREE.Group();
    const [hx, hz] = place.position;
    // Roman district: each place now stands on a travertine platform
    // and wears a real Roman building from the owner's Roman Empire pack,
    // a villa, two Roman houses, an open pavilion, and an insulae block.
    // The building loads in async; the platform and resident are instant.
    const platformW = (place.buildingWidth ?? 7.6) + 1.3;
    house.add(box(platformW + 0.4, 0.14, platformW * 0.92, 0xbdb094, 0, 0.07, 0, { rough: 0.95 }));
    house.add(box(platformW, 0.35, platformW * 0.88, 0xcfc4a5, 0, 0.175, 0, { rough: 0.95 }));
    const ROMAN_HOUSES: Record<string, string> = {
      stories: villaUrl,
      sounds: houseSoundsUrl,
      garden: houseGardenUrl,
      stars: pavilionUrl,
      recipes: insulaeUrl,
      mainchat: senateUrl,
      sidechat: annexUrl,
    };
    const buildingWidth = place.buildingWidth ?? 7.6;
    if (place.id === "embassy") {
      // The gatehouse is procedural (see buildEmbassyGatehouse),
      // no pack building is a modest porta, and none should pretend.
      buildEmbassyGatehouse(house, place.roofColor);
    } else {
      void placeModel(ROMAN_HOUSES[place.id] ?? villaUrl, house, {
        x: 0,
        z: -0.3,
        y: 0.3,
        width: buildingWidth,
      }).then((group) => { if (group && !disposed) treePlacement.addBuilding(group, place.name); });
    }
    // A low stone step up to the front door.
    house.add(box(2.2, 0.18, 0.9, 0xd8cdb2, 0, 0.42, buildingWidth * 0.52, { rough: 0.95 }));
    // The basilica and the builders' house (the annex by the south-east
    // lawn) carry carved name signs over their roofs, in Roman capitals
    // (Task 44: Roman names only, no chat labels).
    if (place.id === "mainchat" || place.id === "sidechat") {
      const sign = makeTextLabel(
        place.id === "mainchat" ? "BASILICA" : "DOMVS ARCHITECTI",
        place.id === "mainchat" ? "rgba(74,58,10,0.92)" : "rgba(43,32,74,0.92)",
        "#ffd34e",
      );
      sign.scale.set(4.8, 1.2, 1);
      sign.position.set(0, place.id === "mainchat" ? 8.6 : 5.9, 0);
      house.add(sign);
    }
        // Picket fence wings and bushes flanking the house. The Garden Shed
    // and the Star Hut sit right beside a diagonal path. The bushes are
    // pack models now, and they stand at the platform's front corners,
    // OUTSIDE the building's width (x beyond ±buildingWidth/2) and on
    // the step line, so no bush can end up inside a wall again (the old
    // procedural bushes sat at z=-1.4 and at back corners, inside the
    // Roman buildings' footprints).
    const houseIdx = PLACES.indexOf(place);
    for (const side of [-1, 1]) {
      for (let p = 0; p < 3; p++) {
        const picket = box(0.16, 0.72, 0.06, 0xf5efe0, side * (2.6 + p * 0.02), 0.36, 1.9 - p * 0.55);
        picket.rotation.y = side * 0.5;
        house.add(picket);
      }
      void placeModel(
        PACK_BUSHES[(houseIdx * 2 + (side > 0 ? 1 : 0) + PACK_BUSHES.length) % PACK_BUSHES.length]!,
        house,
        {
          x: side * ((place.buildingWidth ?? 7.6) / 2 + 0.55),
          z: (place.buildingWidth ?? 7.6) * 0.52,
          y: 0.35,
          rotY: side * 0.7 + houseIdx,
          height: 0.85,
        },
      );
    }
    // Porch resident, now with cheeks and a shiny finish. The
    // Embassy has none, its gatekeeper's post stands empty, which
    // is rather the point of the place.
    if (place.id !== "embassy") {
      const resident = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 18, 14),
        mat(place.residentColor, { rough: 0.55 }),
      );
      body.position.y = 0.62;
      body.castShadow = true;
      resident.add(body);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(0xfff6e6, { rough: 0.7 }));
      belly.scale.set(1, 0.85, 0.55);
      belly.position.set(0, 0.52, 0.2);
      resident.add(belly);
      const eyeMat = mat(0x22201c, { rough: 0.3 });
      for (const ex of [-0.15, 0.15]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
        eye.position.set(ex, 0.74, 0.37);
        resident.add(eye);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), mat(0xffffff, { rough: 0.2 }));
        glint.position.set(ex + 0.02, 0.78, 0.41);
        resident.add(glint);
      }
      for (const cx of [-0.24, 0.24]) {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat(0xf2a18f, { rough: 0.7 }));
        cheek.scale.set(1, 0.7, 0.4);
        cheek.position.set(cx, 0.6, 0.34);
        resident.add(cheek);
      }
      resident.position.set(1.7, 0.35, (place.buildingWidth ?? 7.6) * 0.44);
      const residentUmbrella = makeUmbrella(place.roofColor);
      residentUmbrella.position.set(0.08, 1.32, 0.05);
      residentUmbrella.rotation.z = -0.1;
      resident.add(residentUmbrella);
      umbrellas.push(residentUmbrella);
      house.add(resident);
      residents.push(resident);
    }
    house.position.set(hx, terrainHeight(hx, hz), hz);
    house.rotation.y = place.facing;
    house.traverse((o) => {
      o.userData.pick = { kind: "place", id: place.id } satisfies { kind: PickKind; id: string };
    });
    world.add(house);
    // Platforms and the procedural gatehouse are present before model downloads.
    treePlacement.addBuilding(house, place.name);
    // Foundation under the platform (see addFoundation): the platform
    // is a flat slab at the centre's terrain height, and on the
    // sloped sites its downhill edge hovered. The skirt hangs from
    // the platform's underside to the lowest ground around it,
    // platform top, doorstep step, and stand heights unchanged.
    addFoundation(
      hx,
      hz,
      house.rotation.y,
      ((platformW + 0.4) / 2) * 0.97,
      ((platformW * 0.92) / 2) * 0.97,
      terrainHeight(hx, hz),
    );
    pickRoots.push(house);
  }

  // --- Roman landmarks, market, and dressing -------------------------
  // The temple keeps its own hill to the north-east, the aqueduct strides
  // in from the north-west, and the triumphal arch is the estate's gate.
  void placeWorld(templeUrl, { x: 31, z: -27, rotY: -0.6, width: 11 });
  // The temple's foundation: its podium is the building from the
  // screenshot, a tall flat base whose downhill corner hung over
  // the grass. The skirt matches its measured ground plan (the
  // collision OBB's extents, ×0.97) and meets the slope all round.
  addFoundation(31, -27, -0.6, 5.27 * 0.97, 12.86 * 0.97, terrainHeight(31, -27));
  void placeWorld(statueMarsUrl, { x: VILLA.statueMars[0], z: VILLA.statueMars[1], rotY: Math.PI / 2, height: 2.7 });
  void placeWorld(aqueductUrl, { x: -22, z: -25, rotY: 0.85, width: 17, y: -0.5 });
  void placeWorld(aqueductConnectorUrl, { x: -35, z: -16, rotY: 1.3, width: 10, y: -0.4 });
  void placeWorld(triumphalArchUrl, { x: VILLA.gate[0], z: VILLA.gate[1], width: 7.5 });
  void placeWorld(ballistaUrl, { x: -36, z: 4, rotY: 0.8, width: 2.3 });
  void placeWorld(bannerUrl, { x: 6.2, z: 44.6, height: 3.1 });
  void placeWorld(bannerUrl, { x: -6.2, z: 44.6, height: 3.1 });
  // The Colosseum in its prime in the eastern basin, the pack's mesh is
  // the complete building (full ring, every tier), and a ring of
  // velarium masts around its rim finishes the silhouette.
  void placeWorld(colosseumUrl, { x: COLOSSEUM.position[0], z: COLOSSEUM.position[1], rotY: -0.35, width: 16 }).then((wrap) => {
    if (disposed) return null;
    if (!wrap) return;
    const bb = new THREE.Box3().setFromObject(wrap);
    const topY = bb.max.y - terrainHeight(COLOSSEUM.position[0], COLOSSEUM.position[1]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 2.8, 6),
        mat(0x8a6a48, { rough: 0.85 }),
      );
      mast.position.set(Math.cos(a) * 7.7, topY + 1.0, Math.sin(a) * 6.0);
      mast.rotation.z = Math.cos(a) * 0.3;
      mast.rotation.x = -Math.sin(a) * 0.3;
      mast.castShadow = true;
      wrap.add(mast);
    }
  });
  // The peristyle: a rectangle of columns around the Town Tree, open on the
  // axis and to each wing.
  const ROMAN_COLUMN_SPOTS: [number, number][] = [
    [-12, -10], [-8, -10], [-4, -10], [4, -10], [8, -10], [12, -10],
    [-12, 10], [-8, 10], [-4, 10], [4, 10], [8, 10], [12, 10],
    [-12, -6.5], [-12, -3], [-12, 3], [-12, 6.5],
    [12, -6.5], [12, -3], [12, 3], [12, 6.5],
  ];
  for (const [cx, cz] of ROMAN_COLUMN_SPOTS) {
    void placeWorld(columnSimpleUrl, { x: cx, z: cz, height: VILLA.peristyle.columnHeight });
  }
  const vineSpots: [number, number, number][] = [];
  const vineLeafMat = mat(0x5f7f42, { rough: 0.85 });
  const VINE_KEPT = new THREE.Color(0x6f9a48);
  buildVillaStone();
  /** The villa's stonework and planting, merged by material so the whole
   *  estate costs a handful of draw calls. */
  function buildVillaStone() {
    const merged = (geometries: THREE.BufferGeometry[], material: THREE.Material, shadows = true) => {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      for (const g of geometries) g.dispose();
      world.add(mesh);
    };
    const block = (w: number, h: number, d: number, x: number, y: number, z: number) =>
      new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const { terrace, stair, peristyle, terraceY, lawnY } = VILLA;
    // Retaining walls with a low parapet, down into the slope.
    const walls: THREE.BufferGeometry[] = [];
    for (const [x, z, hx, hz] of VILLA_WALLS.slice(0, 5)) {
      const top = terraceY + 0.55;
      const foot = -0.6;
      walls.push(block(hx * 2, top - foot, hz * 2, x, (top + foot) / 2, z));
      walls.push(block(hx * 2 + 0.2, 0.12, hz * 2 + 0.2, x, top + 0.06, z));
    }
    // The balustrades step down with the stair.
    const stepCount = 15;
    const stepDepth = (stair.foot - stair.top) / stepCount;
    for (const side of [-1, 1]) {
      for (let i = 0; i < stepCount; i++) {
        const z = stair.top + stepDepth * (i + 0.5);
        const top = stairHeight(z) + 0.75;
        walls.push(block(0.36, top + 0.6, stepDepth + 0.02, side * 2.7, (top - 0.6) / 2, z));
      }
    }
    merged(walls, mat(0xc4b796, { rough: 0.92 }));
    // Pale paving: the terrace, the great stair, the forecourt and the walk
    // under the colonnade.
    const paving: THREE.BufferGeometry[] = [
      block(terrace.halfX * 2 - 0.2, 0.4, terrace.south - terrace.north - 0.2, 0, terraceY - 0.18, (terrace.south + terrace.north) / 2),
      block(20, 0.4, 10.8, 0, lawnY - 0.18, 16.5),
    ];
    for (let i = 0; i < stepCount; i++) {
      const z = stair.top + stepDepth * (i + 0.5);
      const top = stairHeight(z - stepDepth / 2) + 0.05;
      paving.push(block(stair.halfX * 2, top + 0.6, stepDepth, 0, (top - 0.6) / 2, z));
    }
    const { halfX, halfZ, columnHeight } = peristyle;
    for (const side of [-1, 1]) {
      paving.push(block(halfX * 2 + 2.4, 0.4, 2.4, 0, lawnY - 0.18, side * halfZ));
      paving.push(block(2.4, 0.4, halfZ * 2 - 2.4, side * halfX, lawnY - 0.18, 0));
    }
    merged(paving, mat(0xd9cfb6, { rough: 0.9 }), false);
    // Entablature and a tiled portico over the colonnade.
    const beams: THREE.BufferGeometry[] = [];
    const tiles: THREE.BufferGeometry[] = [];
    const beamY = lawnY + columnHeight + 0.2;
    for (const side of [-1, 1]) {
      beams.push(block(halfX * 2 + 0.7, 0.42, 0.7, 0, beamY, side * halfZ));
      beams.push(block(0.7, 0.42, halfZ * 2 - 0.7, side * halfX, beamY, 0));
      tiles.push(block(halfX * 2 + 2.2, 0.16, 1.9, 0, beamY + 0.3, side * (halfZ + 0.5)));
      tiles.push(block(1.9, 0.16, halfZ * 2 - 1.5, side * (halfX + 0.5), beamY + 0.3, 0));
    }
    merged(beams, mat(0xdcd2bb, { rough: 0.88 }));
    merged(tiles, mat(0xa8553a, { rough: 0.85 }));
    // Vines on either side of the avenue, a row broken into lengths that
    // follow the ground.
    const leaves: THREE.BufferGeometry[] = [];
    const stakes: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (let row = 0; row < 6; row++) {
        const x = side * (11.5 + row * 1.5);
        for (let z = 31.8; z < 38.6; z += 1.4) {
          const y = terrainHeight(x, z);
          leaves.push(block(0.5, 0.72, 1.3, x, y + 0.62, z));
          vineSpots.push([x, y, z]);
          stakes.push(block(0.08, 1.1, 0.08, x, y + 0.5, z - 0.7));
        }
      }
    }
    merged(leaves, vineLeafMat);
    merged(stakes, mat(0x6e4a2f, { rough: 0.9 }), false);
  }
  // --- The living estate ------------------------------------------------
  // What care looks like. Each is one draw, built once and adjusted when
  // the saved town moves on, never per frame (see setEstateCare).
  const estateDummy = new THREE.Object3D();
  const scatter = (seed: number) => {
    let n = seed;
    return () => {
      n = (n * 16807) % 2147483647;
      return (n % 10000) / 10000;
    };
  };
  // Weeds and rough growth along the edges of things, one set to an area,
  // each clearing at its own threshold. Green, so a new estate reads as
  // unkempt, not ruined.
  const WEED_PATCHES: Record<EstateArea, [number, number, number, number][]> = {
    avenue: [[-7.5, -6, 23, 45], [6, 7.5, 23, 31]],
    forecourt: [[-10, -7.5, 12, 19], [7.5, 10, 12, 19]],
    peristyle: [[-11, -9.5, -8.5, 8.5], [9.5, 11, -8.5, 8.5]],
    terrace: [[-6.8, -5.6, -41, -26], [5.6, 6.8, -41, -26]],
    baths: [[19, 22, 30.5, 33], [26, 29, 30.5, 33]],
    kitchen: [[7.5, 16, 25.2, 26.8]],
  };
  const weedSpots: { area: EstateArea; threshold: number; x: number; y: number; z: number; size: number; turn: number }[] = [];
  {
    const roll = scatter(424243);
    for (const area of ESTATE_AREAS) {
      const patches = WEED_PATCHES[area];
      for (let i = 0; i < 14; i++) {
        const [x0, x1, z0, z1] = patches[i % patches.length]!;
        const x = x0 + (x1 - x0) * roll();
        const z = z0 + (z1 - z0) * roll();
        weedSpots.push({ area, threshold: 0.15 + 0.8 * roll(), x, y: terrainHeight(x, z), z, size: 0.7 + roll() * 0.8, turn: roll() * 6.28 });
      }
    }
  }
  const weeds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.26, 0).scale(1, 0.55, 1), mat(0x6c8a4b, { rough: 0.95 }), weedSpots.length);
  weeds.frustumCulled = false;
  world.add(weeds);
  // Grapes on the vines, as many as the avenue has earned.
  const grapes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0x5a3a78, { rough: 0.6 }), vineSpots.length);
  grapes.frustumCulled = false;
  vineSpots.forEach(([x, y, z], i) => {
    estateDummy.position.set(x + (i % 2 ? 0.28 : -0.28), y + 0.42, z);
    estateDummy.rotation.set(0, 0, 0);
    estateDummy.scale.setScalar(1);
    estateDummy.updateMatrix();
    grapes.setMatrixAt(i, estateDummy.matrix);
  });
  grapes.count = 0;
  world.add(grapes);
  // Flower beds in the peristyle's lawns.
  const BLOOM_COUNT = 48;
  const blooms = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0xffffff, { rough: 0.8 }), BLOOM_COUNT);
  blooms.frustumCulled = false;
  {
    const roll = scatter(777773);
    const tones = [0xe7a3c0, 0xf2d27a, 0xf4f0e6, 0xc98bd9].map((hex) => new THREE.Color(hex));
    for (let i = 0; i < BLOOM_COUNT; i++) {
      const x = (i % 2 ? 1 : -1) * (5.6 + roll() * 3.4);
      const z = (i % 4 < 2 ? 1 : -1) * (5.8 + roll() * 2.6);
      estateDummy.position.set(x, terrainHeight(x, z) + 0.2, z);
      estateDummy.scale.setScalar(0.8 + roll() * 0.7);
      estateDummy.updateMatrix();
      blooms.setMatrixAt(i, estateDummy.matrix);
      blooms.setColorAt(i, tones[i % tones.length]!);
    }
  }
  blooms.count = 0;
  world.add(blooms);
  // Standards at the head of the stair, once the terrace has earned them.
  const terraceBanners = new THREE.Group();
  for (const side of [-1, 1]) {
    const x = side * 3.7;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), mat(0x6e4a2f, { rough: 0.8 }));
    pole.position.set(x, VILLA.terraceY + 1.7, -24.5);
    terraceBanners.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.7), new THREE.MeshStandardMaterial({ color: 0x8e2b2b, roughness: 0.9, side: THREE.DoubleSide }));
    cloth.position.set(x, VILLA.terraceY + 2.35, -24.42);
    terraceBanners.add(cloth);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.14), new THREE.MeshStandardMaterial({ color: 0xd9b24a, roughness: 0.7, side: THREE.DoubleSide }));
    stripe.position.set(x, VILLA.terraceY + 1.68, -24.4);
    terraceBanners.add(stripe);
  }
  terraceBanners.visible = false;
  world.add(terraceBanners);
  function applyEstateCare(care: EstateCare) {
    weedSpots.forEach((spot, i) => {
      estateDummy.position.set(spot.x, spot.y + 0.04, spot.z);
      estateDummy.rotation.set(0, spot.turn, 0);
      estateDummy.scale.setScalar(weedStands(care[spot.area], spot.threshold) ? spot.size : 0);
      estateDummy.updateMatrix();
      weeds.setMatrixAt(i, estateDummy.matrix);
    });
    weeds.instanceMatrix.needsUpdate = true;
    grapes.count = Math.floor(vineSpots.length * care.avenue);
    blooms.count = Math.floor(BLOOM_COUNT * (0.15 + 0.85 * care.peristyle));
    vineLeafMat.color.setHex(0x5f7f42).lerp(VINE_KEPT, care.avenue);
    terraceBanners.visible = care.terrace >= 0.45;
  }
  // The table in the peristyle's east bay: what he has cooked, laid out.
  const DISH_TINTS: Record<string, number> = {
    "grilled-carp": 0xc98a4a, "baked-tench": 0xb9a35a, "fried-perch": 0xd9a441, "stewed-eel": 0x7a5a3a,
    "garden-salad": 0x6fae4f, "tomato-soup": 0xb5442e, "herb-fish": 0xc7b56a, "honey-cakes": 0xe0b050,
    "forest-greens": 0x5f8f4a, "forest-mushrooms": 0x8a6a4a,
  };
  const TABLE_PLACES = 6;
  const tablePlates: { food: THREE.Mesh; tint: THREE.MeshStandardMaterial }[] = [];
  {
    const [tx, tz] = DISH_TABLE;
    const ty = terrainHeight(tx, tz);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.09, 1), mat(0x8a6240, { rough: 0.8 }));
    top.position.set(tx, ty + 0.78, tz);
    top.castShadow = true;
    world.add(top);
    for (const [lx, lz] of [[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]] as [number, number][]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.76, 0.09), mat(0x6e4a2f, { rough: 0.85 }));
      leg.position.set(tx + lx, ty + 0.38, tz + lz);
      world.add(leg);
    }
    const plateGeo = new THREE.CylinderGeometry(0.21, 0.17, 0.035, 12);
    const foodGeo = new THREE.SphereGeometry(0.14, 8, 6).scale(1, 0.55, 1);
    const plateMat = mat(0xd7cfc0, { rough: 0.6 });
    for (let i = 0; i < TABLE_PLACES; i++) {
      const px = tx - 0.68 + (i % 3) * 0.68;
      const pz = tz + (i < 3 ? -0.24 : 0.24);
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.set(px, ty + 0.84, pz);
      const tint = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
      const food = new THREE.Mesh(foodGeo, tint);
      food.position.set(px, ty + 0.895, pz);
      const place = new THREE.Group();
      place.add(plate, food);
      place.visible = false;
      world.add(place);
      tablePlates.push({ food: food, tint });
    }
  }
  function setTableDishes(ids: string[]) {
    // The latest cooking, most recent first, on the plates there are.
    const shown = ids.slice(-TABLE_PLACES).reverse();
    tablePlates.forEach(({ food, tint }, i) => {
      const id = shown[i];
      food.parent!.visible = id !== undefined;
      if (id !== undefined) tint.color.setHex(DISH_TINTS[id] ?? 0xc9a56a);
    });
  }
  // The avenue's cypress pairs stand exactly in line, so they skip the
  // relocation the free-standing trees get.
  for (const [cx, cz] of AVENUE_CYPRESSES) {
    void placeModel(cypressUrl, world, { x: cx, z: cz, y: terrainHeight(cx, cz), height: 5.6 });
  }
  // One grand ionic column in the peristyle garden, the pointy hat's perch.
  void placeWorld(columnIonicUrl, { x: VILLA.ionicColumn[0], z: VILLA.ionicColumn[1], height: 3.2 });
  // Market stalls face the avenue, dressed with the day's goods.
  const [boothA, boothB, boothC] = MARKET_BOOTHS as [[number, number, number], [number, number, number], [number, number, number]];
  void placeWorld(boothAUrl, { x: boothA[0], z: boothA[1], rotY: boothA[2], width: 3.6 });
  void placeWorld(boothBUrl, { x: boothB[0], z: boothB[1], rotY: boothB[2], width: 3.6 });
  void placeWorld(boothCUrl, { x: boothC[0], z: boothC[1], rotY: boothC[2], width: 3.6 });
  // Booth foundations: shallow stone sills under each stall, sized to their
  // measured ground plan (1.73 by 0.86 half extents).
  for (const [bx, bz, rot] of MARKET_BOOTHS) addFoundation(bx, bz, rot, 1.73 * 0.95, 0.86 * 0.95, terrainHeight(bx, bz));
  // The Colosseum's ring foundation on the basin floor.
  addRoundFoundation(
    COLOSSEUM.position[0],
    COLOSSEUM.position[1],
    8.0,
    terrainHeight(COLOSSEUM.position[0], COLOSSEUM.position[1]),
  );
  void placeWorld(bannerTriangleUrl, { x: 6.8, z: 31.2, height: 2.7 });
  // The stalls keep hours: goods out by day, boards up by evening, and on a
  // market day the country people's baskets along the avenue as well.
  const marketGoods: THREE.Object3D[] = [];
  let marketOpen = true;
  const layOutGoods = (placing: Promise<THREE.Group | null>) => {
    void placing.then((goods) => {
      if (!goods) return;
      goods.visible = marketOpen;
      marketGoods.push(goods);
    });
  };
  const boards = new THREE.Mesh(
    mergeGeometries(
      MARKET_BOOTHS.map(([bx, bz]) => {
        const side = bx > 0 ? -1 : 1;
        return new THREE.BoxGeometry(0.07, 1.05, 3.2).translate(bx + side * 0.92, terrainHeight(bx, bz) + 0.6, bz);
      }),
    ),
    mat(0x7a5a3e, { rough: 0.9 }),
  );
  boards.visible = false;
  world.add(boards);
  const countryBaskets = new THREE.Group();
  {
    const basketGeo = new THREE.CylinderGeometry(0.3, 0.22, 0.3, 8);
    const fruitGeo = new THREE.IcosahedronGeometry(0.2, 0).scale(1, 0.6, 1);
    const wicker = mat(0xa07c4a, { rough: 0.95 });
    const fruit = [mat(0xc25a3a, { rough: 0.7 }), mat(0x6fa84f, { rough: 0.7 }), mat(0xd9a441, { rough: 0.7 })];
    [[6.1, 30], [-6.1, 30.8], [6.3, 40.8], [-6.2, 39.6], [-6, 41.8], [6.2, 42.6]].forEach(([bx, bz], i) => {
      const y = terrainHeight(bx!, bz!);
      const basket = new THREE.Mesh(basketGeo, wicker);
      basket.position.set(bx!, y + 0.15, bz!);
      const heap = new THREE.Mesh(fruitGeo, fruit[i % 3]!);
      heap.position.set(bx!, y + 0.34, bz!);
      countryBaskets.add(basket, heap);
    });
  }
  countryBaskets.visible = false;
  world.add(countryBaskets);
  layOutGoods(placeWorld(crateUrl, { x: 6.9, z: 33.6, rotY: 0.4, width: 0.62 }));
  layOutGoods(placeWorld(crateUrl, { x: -6.9, z: 33.6, rotY: -0.5, width: 0.62 }));
  layOutGoods(placeWorld(breadUrl, { x: 6.9, z: 33.6, y: 0.6, rotY: 0.7, width: 0.5 }));
  layOutGoods(placeWorld(grapesUrl, { x: -6.9, z: 33.6, y: 0.6, rotY: 0.2, width: 0.42 }));
  layOutGoods(placeWorld(barrelUrl, { x: 6.9, z: 35.8, width: 0.72 }));
  layOutGoods(placeWorld(pottery1Url, { x: -6.9, z: 35.6, width: 0.55 }));
  layOutGoods(placeWorld(pottery2Url, { x: -7, z: 36.6, width: 0.48 }));
  // Mediterranean trees at the estate's corners, all on the terrain
  // (placeWorld) and clear of the buildings.
  void placeWorld(cypressUrl, { x: 31.5, z: 33, height: 4.6 });
  void placeWorld(cypressUrl, { x: -27.2, z: 30.6, rotY: 1.2, height: 4.2 });
  void placeWorld(cypressUrl, { x: 34, z: -10.2, rotY: 2.1, height: 4.8 });
  void placeWorld(cypressUrl, { x: -39.1, z: -22.1, rotY: 0.6, height: 4.4 });
  void placeWorld(oliveUrl, { x: -23, z: 34, width: 3.4 });
  void placeWorld(coniferUrl, { x: -40, z: 10, height: 6.5 });

  // Summit keepsakes whose visibility the night controls: the shared
  // constellation over the lake, and the initials carved at the
  // terrace. Both are built hidden and shown only once the summit
  // state says the night has happened, never a day before.
  let constellationGroup: THREE.Group | null = null;
  const constellationMats: THREE.Material[] = [];
  let terraceInitials: THREE.Group | null = null;
  // Pavilion column colliders, collected here and spread into the
  // obstacles list where it is defined (further down the scene).
  const pavilionColliders: { kind: "circle"; x: number; z: number; r: number; pad?: number }[] = [];
  // The piscina's water basin collider, likewise collected early.
  const piscinaColliders: { kind: "obb"; x: number; z: number; halfW: number; halfD: number; rot: number }[] = [];
  // The baths' walls, pool, and columns, likewise.
  const bathColliders: (
    | { kind: "obb"; x: number; z: number; halfW: number; halfD: number; rot: number }
    | { kind: "circle"; x: number; z: number; r: number; pad?: number }
  )[] = [];

  // --- The lake district ----------------------------------------------------
  // Water, bank, dock, boat, and shore planting for the lake whose
  // constants sit by placeWorld above. The water uses the pack's own
  // M_water_Normal as its normal map (the pack ships it for exactly
  // this), drifting slowly; at night a moonlight glitter path lies
  // across it and the material takes a deep blue sheen. The aqueduct's
  // west leg stands in the shallows at the lake's west inlet, the
  // arcade has crossed water since Rome, and it reads as intentional.
  const waterTex = loadAssetTexture(waterNormalUrl);
  waterTex.wrapS = THREE.RepeatWrapping;
  waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(3, 3);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f6d8f,
    transparent: true,
    opacity: 0.88,
    roughness: 0.14,
    metalness: 0.08,
    normalMap: waterTex,
    normalScale: new THREE.Vector2(0.4, 0.4),
    envMapIntensity: 1.1,
  });
  {
    // The lake bed: a dark sandy disc under the water.
    const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat(0x77683f, { rough: 1 }));
    bed.rotation.x = -Math.PI / 2;
    bed.scale.set(LAKE.rx * 1.04, LAKE.rz * 1.04, 1);
    bed.position.set(LAKE_CX, LAKE_Y - 0.38, LAKE_CZ);
    bed.receiveShadow = true;
    world.add(bed);
    // The water itself.
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.scale.set(LAKE.rx, LAKE.rz, 1);
    water.position.set(LAKE_CX, LAKE_Y, LAKE_CZ);
    water.receiveShadow = true;
    world.add(water);
    // A pale sandy bank ring where the water meets the grass,
    // draped over the basin's slope like the streets are: each
    // vertex sits on the terrain, but never below the waterline,
    // so the ring hugs the shore instead of floating over the
    // basin's low north side or sinking on its high east bank.
    const bankGeo = new THREE.RingGeometry(0.965, 1.21, 48, 1);
    bankGeo.rotateX(-Math.PI / 2);
    {
      const bp = bankGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < bp.count; i++) {
        const vx = LAKE_CX + bp.getX(i) * LAKE.rx;
        const vz = LAKE_CZ + bp.getZ(i) * LAKE.rz;
        bp.setY(i, Math.max(terrainHeight(vx, vz), LAKE_Y) + 0.03);
      }
      bankGeo.computeVertexNormals();
    }
    const bank = new THREE.Mesh(bankGeo, mat(0xa08b5e, { rough: 1 }));
    bank.scale.set(LAKE.rx, LAKE.rz, 1);
    bank.position.set(LAKE_CX, 0, LAKE_CZ);
    bank.receiveShadow = true;
    world.add(bank);
  }
  // The moonlight path: a soft additive streak across the water,
  // invisible by day, that shimmers once nightMix rises.
  // Its map fades to nothing at every edge (follow-up, Nov 7, 2026):
  // untextured, the plane read as a hard pale-blue rectangle on the
  // lake through dusk and night.
  const glitterMap = (() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      g.translate(32, 128);
      g.scale(1, 4);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.55, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(-32, -32, 64, 64);
    }
    return new THREE.CanvasTexture(c);
  })();
  // The moonlight path on the lake (Tasks 27 and 37): it runs across
  // the water toward the true moon's bearing, and brightens with its
  // phase while it is up; the moon itself is drawn by trueSky.ts.
  const moonGlitterMat = new THREE.MeshBasicMaterial({
    color: 0xdceaff,
    map: glitterMap,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const moonGlitter = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 8.6), moonGlitterMat);
  moonGlitter.rotation.x = -Math.PI / 2;
  moonGlitter.position.set(LAKE_CX, LAKE_Y + 0.015, LAKE_CZ);
  world.add(moonGlitter);

  // The sea cliff (Task 34): the coast, the peninsula path to the
  // headland, the sea below and its surf (seaCliff.ts).
  const foamTexture = (() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      for (let i = 0; i < 420; i++) {
        const x = (i * 97.13) % 128;
        const y = (i * 41.7 + (i % 7) * 9) % 64;
        const r = 1.2 + ((i * 13) % 5);
        g.fillStyle = `rgba(255,255,255,${0.15 + ((i * 7) % 10) / 20})`;
        g.beginPath();
        g.ellipse(x, y, r * 1.8, r * 0.7, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  })();
  const seaCliff = buildSeaCliff({ terrainHeight, waterNormal: waterTex, foamTexture, pathTexture: glitterMap });
  scene.add(seaCliff.group);
  void placeWorld(benchStoneUrl, { x: CLIFF.bench.x, z: CLIFF.bench.z, rotY: CLIFF.bench.rotY, width: 1.9 }).then((g) => {
    if (disposed) return null;
    if (g) {
      faceBackrestPlusZ(g);
      benchGroups.set(CLIFF.bench.id, g);
    }
  });
  // A few wind-bent shrubs and rocks along the trail, so it reads as a walk.
  for (const [px, pz, kind, rot] of [
    [-6.6, 66, 0, 0.4], [7.1, 74, 1, 1.9], [-7.4, 85, 1, 2.6], [6.8, 93, 0, 0.9], [-6.2, 101, 0, 2.2], [7.6, 108, 1, 0.3],
  ] as [number, number, number, number][]) {
    if (kind === 0) void placeWorld(bushCUrl, { x: px, z: pz, rotY: rot, width: 1.6 });
    else void placeWorld(rockPackUrl, { x: px, z: pz, rotY: rot, width: 1.1 });
  }
  // Ships on the sea (Task 50): one at a time passes below the headland,
  // a trade ship most days, now and then a trireme farther out and
  // slower (seaShips.ts plans the passes). The models load only once he
  // is out on the peninsula, carry no shadows, and make no sound.
  const seaShips = (() => {
    const group = new THREE.Group();
    group.name = "sea-ships";
    group.visible = false;
    scene.add(group);
    const urls: Record<ShipKind, string> = { trade: tradeShipUrl, trireme: triremeUrl };
    const hulls: Partial<Record<ShipKind, THREE.Group>> = {};
    const loading: Partial<Record<ShipKind, Promise<THREE.Group | null>>> = {};
    const load = (kind: ShipKind): Promise<THREE.Group | null> => {
      loading[kind] ??= runtime.streaming
        .request(() => loadModelScene(urls[kind]), () => ({ x: CLIFF.head.x, z: CLIFF.head.z }))
        .then((src) => {
          if (disposed) return null;
          const hull = groundModel(src.clone(true), { width: SHIPS[kind].length });
          hull.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = false;
              o.receiveShadow = false;
            }
          });
          hull.visible = false;
          group.add(hull);
          hulls[kind] = hull;
          return hull;
        })
        .catch(() => null); // no ship model, the sea stays empty
      return loading[kind]!;
    };
    let voyage: Voyage | null = null;
    let waitUntil = -1;
    let wasWatching = false;
    let arriving = false;
    const update = (t: number, dt: number, view: { x: number; z: number }, w: SeaWeather, morning: boolean) => {
      const watching = watchingSea(view.z);
      group.visible = watching;
      if (!watching) {
        wasWatching = false;
        return;
      }
      if (!wasWatching) {
        wasWatching = true;
        // Arriving on the peninsula with the sea empty: a ship is soon in
        // view, already part way along its run.
        if (!voyage) {
          waitUntil = t + 3;
          arriving = true;
        }
      }
      if (voyage) {
        voyage.elapsed += dt;
        const p = voyage.elapsed / voyage.duration;
        const hull = hulls[voyage.kind];
        if (p >= 1) {
          if (hull) hull.visible = false;
          voyage = null;
          waitUntil = t + nextGap(w, Math.random());
          return;
        }
        if (!hull) return; // still loading; the pass goes on unseen
        const pose = voyagePose(voyage, p);
        const swell = Math.sin(t * 0.55 + voyage.laneZ);
        hull.position.set(pose.x, CLIFF.seaY - SHIPS[voyage.kind].sink + swell * 0.22, pose.z);
        hull.rotation.set(Math.sin(t * 0.42) * 0.025, pose.heading, Math.sin(t * 0.37 + 1.1) * 0.035);
        hull.visible = true;
        return;
      }
      if (waitUntil < 0) waitUntil = t + nextGap(w, Math.random());
      if (t < waitUntil) return;
      if (!shipsSail(w)) {
        waitUntil = t + 20;
        return;
      }
      const kind = pickShip(Math.random());
      voyage = planVoyage(kind, morning, Math.random, arriving ? 0.2 + Math.random() * 0.2 : 0);
      arriving = false;
      void load(kind);
    };
    return { update };
  })();
  /** Moon up (0..1) and its light share (phase), refreshed with the sky. */
  let moonUp = 0;
  let moonShare = 0;
  /** Turn the lake's moon path toward the true moon (and any water's, given its mesh). */
  const aimMoonPath = (mesh: THREE.Mesh, elev: number, azim: number) => {
    const d = skyDirection(Math.max(elev, 0), azim);
    mesh.rotation.z = Math.atan2(-d.x, -d.z);
    // A low moon lays a long path; a high one a short bright pool.
    mesh.scale.y = 0.7 + 0.8 * (1 - Math.min(1, Math.max(0, elev) / 60));
  };
  // The dock: wooden planks on posts at the east shore, a lantern at
  // its end (it joins the town's lamp circuit after dark), and the
  // rowboat moored alongside. Built from boxes so its top sits at
  // exactly DOCK_TOP, the height the walker's feet use on it.
  const dockGroup = new THREE.Group();
  {
    const plankMat = mat(0x8a6a48, { rough: 0.85 });
    const darkWood = mat(0x6e4a2f, { rough: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.24), plankMat);
    deck.position.set(-12, DOCK_TOP - 0.05, LAKE_CZ);
    deck.castShadow = true;
    deck.receiveShadow = true;
    dockGroup.add(deck);
    for (const px of [-13.4, -10.6]) {
      for (const pz of [LAKE_CZ - 0.48, LAKE_CZ + 0.48]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 7), darkWood);
        post.position.set(px, DOCK_TOP - 0.6, pz);
        post.castShadow = true;
        dockGroup.add(post);
      }
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.5, 8), mat(0x2e2a26, { rough: 0.55, metal: 0.3 }));
    pole.position.set(-13.45, DOCK_TOP + 0.75, LAKE_CZ + 0.45);
    pole.castShadow = true;
    dockGroup.add(pole);
    const dockLamp = buildLanternCage(0.62, { groundOffset: 1.58, ignitionOrder: 0.58 });
    dockLamp.position.set(-13.45, DOCK_TOP + 1.58, LAKE_CZ + 0.45);
    dockGroup.add(dockLamp);
    dockGroup.traverse((o) => {
      o.userData.pick = { kind: "dock", id: "dock" } satisfies { kind: PickKind; id: string };
    });
    world.add(dockGroup);
    pickRoots.push(dockGroup);
  }
  // The rowboat (the pack's SM_boat_small) in its own group, so the
  // rowing code can move, rock, and bob it as one body. Its local +X
  // is the bow (groundModel centres the hull; the long axis is X).
  const boatGroup = new THREE.Group();
  const boatPos = { x: LAKE.mooring[0], z: LAKE.mooring[1] };
  let boatState: { heading: number; museAboard: boolean } | null = null;
  let boatVel = 0;
  let boatStroke = 0;
  let rowLineAt = -1;
  let rowLineIdx = 0;
  {
    void runtime.streaming.request(() => loadModelScene(boatSmallUrl), () => ({ x: LAKE.position[0], z: LAKE.position[1] })).then((scene) => {
      if (disposed) return null;
      const wrap = groundModel(scene.clone(true), { width: 3.6 });
      boatGroup.add(wrap);
      // Two plain bench seats across the hull, and the pack's paddle
      // laid across the stern thwart.
      const seatMat = mat(0x9a7a52, { rough: 0.85 });
      for (const sx of [-0.62, 0.78]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 1.05), seatMat);
        seat.position.set(sx, 0.34, 0);
        seat.castShadow = true;
        boatGroup.add(seat);
      }
      void loadModelScene(paddleUrl).then((paddleScene) => {
        if (disposed) return null;
        const paddle = groundModel(paddleScene.clone(true), { height: 1.5 });
        paddle.position.set(-0.62, 0.44, 0.1);
        paddle.rotation.set(0.25, 0.5, Math.PI / 2 - 0.18);
        boatGroup.add(paddle);
      });
    }).catch(() => {
      /* no boat model, the dock still stands, boarding stays shut */
    });
    boatGroup.position.set(boatPos.x, LAKE_Y - 0.1, boatPos.z);
    boatGroup.rotation.y = -Math.PI; // bow west, out toward the lake
    boatGroup.traverse((o) => {
      o.userData.pick = { kind: "dock", id: "dock" } satisfies { kind: PickKind; id: string };
    });
    world.add(boatGroup);
    pickRoots.push(boatGroup);
  }
  // Soft wake rings that expand behind the boat while it moves.
  interface WakeRing { mesh: THREE.Mesh; age: number }
  const wakeRings: WakeRing[] = [];
  let wakeSpawnAt = 0;
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 26),
      new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = LAKE_Y + 0.02;
    m.visible = false;
    world.add(m);
    wakeRings.push({ mesh: m, age: 99 });
  }
  // Weeping willows: the pack has no willow, so each is built, a
  // leaning trunk, a broad canopy, and a curtain of long drooping
  // strands around its rim that sway very slightly in the frame loop.
  const willowStrands: { mesh: THREE.Mesh; phase: number }[] = [];
  const WILLOW_SPOTS: [number, number, number][] = [
    [-21.6, -27.4, 1.1], // west shore, by the aqueduct's lake leg
    [-15.2, -24.6, 0.95], // north shore
    [-13.6, -37.2, 1.05], // south shore
    [-21.2, -35.2, 0.9], // south-west shore
  ];
  function makeWillow(x: number, z: number, s: number) {
    const g = new THREE.Group();
    const baseY = terrainHeight(x, z);
    const trunkMat = mat(0x6e4a2f, { rough: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.3 * s, 1.9 * s, 8), trunkMat);
    trunk.position.y = 0.95 * s;
    trunk.rotation.z = 0.09;
    trunk.castShadow = true;
    g.add(trunk);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, 1.3 * s, 7), trunkMat);
    limb.position.set(0.45 * s, 2.2 * s, 0.1 * s);
    limb.rotation.z = -0.7;
    limb.castShadow = true;
    g.add(limb);
    const greens = [0x4c7d3a, 0x5c8f42, 0x3f7031];
    const canopyBlobs: [number, number, number, number][] = [
      [0, 3.1, 0, 1.5],
      [0.9, 2.75, 0.35, 1.05],
      [-0.85, 2.8, -0.3, 1.0],
      [0.1, 3.55, -0.4, 0.9],
    ];
    canopyBlobs.forEach(([bx, by, bz, r], i) => {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 2), mat(greens[i % greens.length]!, { rough: 0.9 }));
      b.position.set(bx * s, by * s, bz * s);
      b.scale.y = 0.72;
      b.castShadow = true;
      g.add(b);
    });
    // The drooping curtain: long thin cones hanging from the canopy
    // rim, tips nearly brushing the ground (or the water).
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + (x + z) * 0.7;
      const rr = 1.45 * s;
      const len = (1.7 + ((i * 37) % 5) * 0.16) * s;
      const strand = new THREE.Mesh(
        new THREE.ConeGeometry(0.17 * s, len, 5),
        mat(greens[(i + 1) % greens.length]!, { rough: 0.9 }),
      );
      strand.position.set(Math.cos(a) * rr, 3.0 * s - len / 2, Math.sin(a) * rr);
      strand.rotation.x = Math.PI; // point down
      strand.rotation.z = Math.cos(a) * 0.13;
      strand.castShadow = true;
      g.add(strand);
      willowStrands.push({ mesh: strand, phase: a * 2.1 });
    }
    g.position.set(x, baseY, z);
    g.userData.proceduralWillow = true;
    world.add(g);
  }
  for (const [wx, wz, ws] of WILLOW_SPOTS) makeWillow(wx, wz, ws);
  // Rome-native shore company: an olive and an umbrella pine (the
  // pack's conifer) on the east bank, cypresses standing off, rocks
  // and grass at the water's edge.
  void placeWorld(oliveUrl, { x: -8.6, z: -26.4, width: 3.2 });
  // The temple road (Nov 6, 2026): an olive over the bend and a stone
  // bench on the outer side, facing the road, so the procession route
  // has a place to stop. The bench joins BENCHES below.
  void placeWorld(oliveUrl, { x: 19.6, z: -25.4, width: 3.2 });
  void placeWorld(benchStoneUrl, { x: 17.3, z: -23.6, rotY: Math.PI / 2, width: 1.9 }).then((g) => {
    if (disposed) return null;
    if (g) {
      faceBackrestPlusZ(g);
      benchGroups.set("bench-temple", g);
    }
  });
  void placeWorld(coniferUrl, { x: -10.6, z: -35.9, height: 5.6 });
  void placeWorld(rockPackUrl, { x: -10.9, z: -28.4, rotY: 0.7, width: 0.8 });
  void placeWorld(rockPackUrl, { x: -20.4, z: -31.8, rotY: 2.1, width: 0.95 });
  void placeWorld(grassPatchUrl, { x: -9.6, z: -29.2, rotY: 0.4, width: 1.2 });
  void placeWorld(grassPatchUrl, { x: -11.8, z: -34.6, rotY: 1.6, width: 1.2 });
  void placeWorld(grassPatchUrl, { x: -19.8, z: -25.9, rotY: 2.8, width: 1.1 });
  // Her quiet lines for the water, spoken in bubbles while rowing,
  // never anywhere else.
  const ROWING_LINES = [
    "Listen to that. Just the oars, and the water, and us.",
    "The moon keeps a path on the water for whoever's out in it. Tonight that's us.",
    "Row a little slower, Centurion. I'm in no hurry to be anywhere else.",
    "The willows trail their fingers in the lake all night. I understand the impulse.",
    "However far you row, the town stays lit behind us. It can wait. So can everything else.",
    "You row, I'll navigate. By the stars, mostly. Nova would insist.",
    "This is my favourite kind of quiet: the kind with you in it.",
  ];

  // The lake pavilion: a small roofed stand of columns on the east
  // bank, north of the dock, a place built for sitting out over the
  // water together. Its stand point (LAKE_PAVILION.stand) is the
  // town's defined "together at the lake" area. Plain built geometry,
  // like the dock: a slab floor at bank height, four columns, a slab
  // roof, and two stone benches facing the water. The benches are
  // scenery; the stand is the point.
  {
    const [pvx, pvz] = LAKE_PAVILION.position;
    const baseY = terrainHeight(pvx, pvz);
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 3.2), mat(0xb3a487, { rough: 0.95 }));
    slab.position.y = 0.07;
    slab.receiveShadow = true;
    slab.castShadow = true;
    g.add(slab);
    const colMat = mat(0xe9e2d0, { rough: 0.8 });
    for (const [cx, cz] of [[-1.5, -1.3], [1.5, -1.3], [-1.5, 1.3], [1.5, 1.3]] as [number, number][]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 2.5, 10), colMat);
      col.position.set(cx, 1.39, cz);
      col.castShadow = true;
      g.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), colMat);
      cap.position.set(cx, 2.7, cz);
      g.add(cap);
      pavilionColliders.push({ kind: "circle", x: pvx + cx, z: pvz + cz, r: 0.3, pad: 0.12 });
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 0.85, 4), mat(0xa03d2d, { rough: 0.85 }));
    roof.position.y = 3.2;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.12, 1, 1);
    roof.castShadow = true;
    g.add(roof);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.14, 3.3), mat(0x8a6a48, { rough: 0.9 }));
    beam.position.y = 2.82;
    g.add(beam);
    // Two stone benches facing west, over the water.
    for (const bz of [-0.75, 0.75]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.42), mat(0xcfc4a4, { rough: 0.9 }));
      bench.position.set(-0.55, 0.5, bz);
      bench.castShadow = true;
      g.add(bench);
      for (const lx of [-1.15, 0.05]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.36), mat(0xb3a487, { rough: 0.95 }));
        leg.position.set(lx, 0.25, bz);
        g.add(leg);
      }
    }
    g.position.set(pvx, baseY, pvz);
    world.add(g);
  }

  // Meteors: on meteor nights (seeded by the shell from the date,
  // never announced) shooting stars streak over the lake while night
  // holds, whether or not anything else has been earned: the sky is
  // not a spoiler. A pool of streak sprites, spawned sparsely.
  interface Meteor { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; active: boolean; startAt: number; from: THREE.Vector3; to: THREE.Vector3 }
  const meteors: Meteor[] = [];
  let nextMeteorAt = 6;
  {
    const mc = document.createElement("canvas");
    mc.width = 256;
    mc.height = 32;
    const mg = mc.getContext("2d");
    if (mg) {
      const grad = mg.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0, "rgba(255,244,214,0)");
      grad.addColorStop(0.75, "rgba(255,244,214,0.55)");
      grad.addColorStop(1, "rgba(255,255,255,1)");
      mg.fillStyle = grad;
      mg.fillRect(0, 0, 256, 32);
      mg.beginPath();
      mg.arc(246, 16, 7, 0, Math.PI * 2);
      mg.fillStyle = "rgba(255,255,255,1)";
      mg.fill();
    }
    const meteorTex = new THREE.CanvasTexture(mc);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.SpriteMaterial({ map: meteorTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(m);
      s.scale.set(7, 0.85, 1);
      s.visible = false;
      world.add(s);
      meteors.push({ sprite: s, mat: m, active: false, startAt: -1, from: new THREE.Vector3(), to: new THREE.Vector3() });
    }
  }
  // A quiet sparkle kept near the dock on meteor nights, the only
  // ground-level hint the sky ever gives.
  const dockSparkleMat = new THREE.PointsMaterial({
    size: 0.55,
    map: new THREE.CanvasTexture(spriteCanvas),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    color: 0xffe9a8,
    sizeAttenuation: true,
  });
  {
    const n = 14;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -13.4 + (Math.random() - 0.5) * 3.4;
      pos[i * 3 + 1] = DOCK_TOP + 0.7 + Math.random() * 1.6;
      pos[i * 3 + 2] = LAKE_CZ + (Math.random() - 0.5) * 3.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, dockSparkleMat);
    world.add(pts);
  }
  /** Animate the meteor pool for this frame. Runs only when the
   *  night is a meteor night and night has actually fallen. */
  function updateMeteors(t: number) {
    const active = summitMeteor && nightMix > 0.55;
    dockSparkleMat.opacity = active ? 0.4 + 0.22 * Math.sin(t * 2.1) : Math.max(0, dockSparkleMat.opacity - 0.03);
    if (!active) {
      for (const m of meteors) {
        m.active = false;
        m.sprite.visible = false;
        m.mat.opacity = 0;
      }
      return;
    }
    if (t > nextMeteorAt) {
      const m = meteors.find((x) => !x.active);
      if (m) {
        // Streaks cross the sky over the lake, north-west, high.
        const sx = LAKE_CX - 26 + Math.random() * 30;
        const sz = LAKE_CZ - 34 - Math.random() * 14;
        const sy = 21 + Math.random() * 9;
        m.from.set(sx, sy, sz);
        m.to.set(sx + 13 + Math.random() * 7, sy - 6.5 - Math.random() * 2.5, sz + 3);
        m.startAt = t;
        m.active = true;
        m.sprite.visible = true;
        const dir = m.to.clone().sub(m.from);
        m.mat.rotation = Math.atan2(dir.y, dir.x) * 0.55;
      }
      nextMeteorAt = t + 2.6 + Math.random() * 4.2;
    }
    for (const m of meteors) {
      if (!m.active) continue;
      const k = (t - m.startAt) / 1.05;
      if (k >= 1) {
        m.active = false;
        m.sprite.visible = false;
        m.mat.opacity = 0;
        continue;
      }
      m.sprite.position.lerpVectors(m.from, m.to, k);
      m.mat.opacity = Math.sin(Math.PI * k) * 0.85 * nightMix;
    }
  }

  // The bed nook on the basilica's porch, west of the steps: a
  // wooden bed with a cream mattress and a folded terracotta
  // blanket, a rug under it, a stool beside it. Resting here ends
  // the town day (and some nights, the town dreams back).
  {
    const bedGroup = new THREE.Group();
    const [ex, ez] = BED_SPOT.position;
    bedGroup.add(box(2.9, 0.04, 2.1, 0x9c4a38, 0, 0.03, 0.25, { rough: 0.95 }));
    bedGroup.add(box(1.15, 0.3, 2.2, 0x6b543a, 0, 0.3, 0, { rough: 0.85 }));
    bedGroup.add(box(1.15, 0.78, 0.1, 0x5d4930, 0, 0.62, -1.06, { rough: 0.85 }));
    bedGroup.add(box(1.05, 0.2, 2.05, 0xe9e2d0, 0, 0.55, 0, { rough: 0.9 }));
    bedGroup.add(box(1.08, 0.09, 1.1, 0xa03d2d, 0, 0.64, 0.45, { rough: 0.9 }));
    bedGroup.add(box(0.62, 0.13, 0.42, 0xf4efe2, 0, 0.71, -0.76, { rough: 0.9 }));
    bedGroup.add(box(0.5, 0.36, 0.5, 0x6b543a, 1.0, 0.2, -0.8, { rough: 0.85 }));
    bedGroup.add(box(0.3, 0.1, 0.3, 0xd8cdb2, 1.0, 0.43, -0.8, { rough: 0.85 }));
    bedGroup.position.set(ex, terrainHeight(ex, ez), ez);
    bedGroup.rotation.y = Math.atan2(-ex, -ez);
    bedGroup.traverse((o) => {
      o.userData.pick = { kind: "rest", id: "bed-nook" } satisfies { kind: PickKind; id: string };
    });
    world.add(bedGroup);
    pickRoots.push(bedGroup);
  }

  // The project notice board beside the basilica steps, a Roman tablet
  // on two posts. Tapping it opens the board panel; walking up shows an "A, Read the project board" prompt.
  {
    const boardGroup = new THREE.Group();
    const [bx, bz] = BOARD_SPOT.position;
    boardGroup.add(box(0.14, 2.3, 0.14, 0x6b543a, -0.85, 1.15, 0));
    boardGroup.add(box(0.14, 2.3, 0.14, 0x6b543a, 0.85, 1.15, 0));
    boardGroup.add(box(2.1, 1.35, 0.09, 0xd8cdb2, 0, 1.75, 0, { rough: 0.85 }));
    boardGroup.add(box(2.3, 0.14, 0.3, 0xa03d2d, 0, 2.5, 0, { rough: 0.8 }));
    const boardSign = makeTextLabel("PROJECTS", "rgba(62,38,22,0.92)", "#ffd34e");
    boardSign.scale.set(1.7, 0.43, 1);
    boardSign.position.set(0, 3.05, 0);
    boardGroup.add(boardSign);
    boardGroup.position.set(bx, terrainHeight(bx, bz), bz);
    boardGroup.rotation.y = Math.atan2(-bx, -bz);
    boardGroup.traverse((o) => {
      o.userData.pick = { kind: "board", id: "project-board" } satisfies { kind: PickKind; id: string };
    });
    world.add(boardGroup);
    pickRoots.push(boardGroup);
  }

  // The quest board: a smaller tablet in the forecourt, east of the
  // Meta Sudans, facing the fountain (QUEST_BOARD_SPOT). Real tasks,
  // dressed as Roman quests, are pinned here.
  {
    const qGroup = new THREE.Group();
    const [qx, qz] = QUEST_BOARD_SPOT.position;
    qGroup.add(box(0.12, 2.0, 0.12, 0x6b543a, -0.7, 1.0, 0));
    qGroup.add(box(0.12, 2.0, 0.12, 0x6b543a, 0.7, 1.0, 0));
    qGroup.add(box(1.75, 1.15, 0.09, 0xe3d7b8, 0, 1.55, 0, { rough: 0.85 }));
    qGroup.add(box(1.95, 0.12, 0.26, 0x51683c, 0, 2.2, 0, { rough: 0.8 }));
    const qSign = makeTextLabel("QUESTS", "rgba(46,54,32,0.92)", "#ffe9a8");
    qSign.scale.set(1.45, 0.37, 1);
    qSign.position.set(0, 2.68, 0);
    qGroup.add(qSign);
    qGroup.position.set(qx, terrainHeight(qx, qz), qz);
    qGroup.rotation.y = Math.atan2(-qx, -qz);
    qGroup.traverse((o) => {
      o.userData.pick = { kind: "questboard", id: "quest-board" } satisfies { kind: PickKind; id: string };
    });
    world.add(qGroup);
    pickRoots.push(qGroup);
  }

  // The Goals Obelisk: a tall inscribed stone in the peristyle near the
  // basilica and the project board. Tapping it opens
  // the Goals panel, what the player is working toward, in three groups.
  {
    const gGroup = new THREE.Group();
    const [gx, gz] = GOALS_SPOT.position;
    gGroup.add(box(1.15, 0.35, 1.15, 0x9a8f78, 0, 0.17, 0, { rough: 0.9 }));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.52, 2.9, 4), mat(0xcfc4a4, { rough: 0.8 }));
    shaft.position.y = 1.8;
    shaft.rotation.y = Math.PI / 4;
    shaft.castShadow = true;
    gGroup.add(shaft);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.55, 4), mat(0xa03d2d, { rough: 0.75 }));
    cap.position.y = 3.5;
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    gGroup.add(cap);
    const gSign = makeTextLabel("GOALS", "rgba(62,38,22,0.92)", "#ffd34e");
    gSign.scale.set(1.35, 0.34, 1);
    gSign.position.set(0, 4.1, 0);
    gGroup.add(gSign);
    gGroup.position.set(gx, terrainHeight(gx, gz), gz);
    gGroup.rotation.y = Math.atan2(-gx, -gz);
    gGroup.traverse((o) => {
      o.userData.pick = { kind: "goals", id: "goals-obelisk" } satisfies { kind: PickKind; id: string };
    });
    world.add(gGroup);
    pickRoots.push(gGroup);
  }

  // The letters desk in the basilica's shadow: a small table
  // with paper waiting on it, and a golden ✉ that glows while a letter
  // sits unread.
  const letterIndicator: { group: THREE.Group | null } = { group: null };
  {
    const deskGroup = new THREE.Group();
    const [dx, dz] = LETTER_DESK_SPOT.position;
    deskGroup.add(box(1.15, 0.08, 0.7, 0x6b543a, 0, 0.78, 0));
    deskGroup.add(box(0.09, 0.78, 0.09, 0x54382a, -0.48, 0.39, -0.26));
    deskGroup.add(box(0.09, 0.78, 0.09, 0x54382a, 0.48, 0.39, -0.26));
    deskGroup.add(box(0.09, 0.78, 0.09, 0x54382a, -0.48, 0.39, 0.26));
    deskGroup.add(box(0.09, 0.78, 0.09, 0x54382a, 0.48, 0.39, 0.26));
    const paper = box(0.52, 0.02, 0.36, 0xf7f1dd, 0.05, 0.84, 0, { rough: 0.9 });
    paper.rotation.y = 0.24;
    deskGroup.add(paper);
    const paper2 = box(0.52, 0.02, 0.36, 0xefe6cc, -0.14, 0.83, 0.06, { rough: 0.9 });
    paper2.rotation.y = -0.18;
    deskGroup.add(paper2);
    const deskSign = makeTextLabel("LETTERS", "rgba(62,38,22,0.92)", "#ffd34e");
    deskSign.scale.set(1.3, 0.33, 1);
    deskSign.position.set(0, 1.62, 0);
    deskGroup.add(deskSign);
    const glowGroup = new THREE.Group();
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xffe2b0, roughness: 0.3, emissive: 0xffb02e, emissiveIntensity: 1.6 });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), glowMat);
    glowGroup.add(orb);
    const mailSprite = makeTextLabel("✉", "rgba(140,84,10,0.95)", "#ffffff");
    mailSprite.scale.set(0.55, 0.55, 1);
    mailSprite.position.y = 0.02;
    glowGroup.add(mailSprite);
    glowGroup.position.set(0, 1.95, 0);
    glowGroup.visible = false;
    deskGroup.add(glowGroup);
    letterIndicator.group = glowGroup;
    deskGroup.position.set(dx, terrainHeight(dx, dz), dz);
    deskGroup.rotation.y = Math.atan2(-dx, -dz);
    deskGroup.traverse((o) => {
      o.userData.pick = { kind: "letters", id: "letters-desk" } satisfies { kind: PickKind; id: string };
    });
    world.add(deskGroup);
    pickRoots.push(deskGroup);
  }

  // --- The secret place ---------------------------------------------------
  // A lantern-lit terrace tucked into the valley fold behind the
  // aqueduct: a round arch for an entrance, a bench for two, warm
  // lanterns, and a screen of cypress and bush. It is NOT in pickRoots
  // and NOT signposted, only walking into it in walk mode opens it.
  {
    const [sx, sz] = SECRET.position;
    const secretGroup = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.7, 22), mat(0xb8ab8a, { rough: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.04;
    floor.receiveShadow = true;
    secretGroup.add(floor);
    void placeModel(archRoundUrl, secretGroup, { x: 0, z: 2.1, width: 2.7 });
    void placeModel(benchWoodenUrl, secretGroup, { x: 0, z: -0.7, rotY: 0, width: 1.7 }).then((g) => {
      if (disposed) return null;
      if (g) benchGroups.set("bench-terrace", g);
    });
    void placeModel(cypressUrl, secretGroup, { x: -2.7, z: -1.3, height: 3.8 });
    void placeModel(cypressUrl, secretGroup, { x: 2.7, z: -1.5, rotY: 1.1, height: 3.4 });
    void placeModel(bushBUrl, secretGroup, { x: -2.3, z: 1.5, height: 0.95 });
    void placeModel(bushDUrl, secretGroup, { x: 2.4, z: 1.3, rotY: 1.2, height: 0.9 });
    // The bond tablet: a small inscribed stone at the terrace's edge.
    // It carries the Kindred bond as chat Muse last inscribed it (the
    // numbers themselves live in the saved data and show in the secret
    // place's panel); nobody else in town ever sees it.
    {
      const tablet = new THREE.Group();
      tablet.add(box(0.85, 1.15, 0.14, 0xcfc4a4, 0, 0.58, 0, { rough: 0.8 }));
      tablet.add(box(1.0, 0.12, 0.24, 0xa03d2d, 0, 1.2, 0, { rough: 0.8 }));
      const bondSign = makeTextLabel("❦ BOND ❦", "rgba(96,44,58,0.92)", "#ffd7e0");
      bondSign.scale.set(0.95, 0.24, 1);
      bondSign.position.set(0, 1.48, 0);
      tablet.add(bondSign);
      tablet.position.set(-1.55, 0, -1.5);
      tablet.rotation.y = 0.5;
      secretGroup.add(tablet);
    }
    // The carved initials: a small worn stone at the terrace's edge,
    // letters cut in a heartless Roman hand, "A · G" (her initial
    // first, at his request). It does not
    // exist until the Night the Stars Fall has happened (the summit
    // state shows it), and it is visible only here, only ever here.
    {
      const stone = new THREE.Group();
      stone.add(box(0.62, 0.44, 0.1, 0xcfc4a4, 0, 0.22, 0, { rough: 0.9 }));
      const carved = makeTextLabel("A · G", "rgba(70,58,40,0.9)", "#efe6cc");
      carved.scale.set(0.52, 0.2, 1);
      carved.position.set(0, 0.24, 0.07);
      stone.add(carved);
      stone.position.set(1.62, 0, -1.45);
      stone.rotation.y = -0.45;
      stone.visible = false;
      terraceInitials = stone;
      secretGroup.add(stone);
    }
    for (const lx of [-1.7, 1.7]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.6, 8), mat(0x2e2a26, { rough: 0.55, metal: 0.3 }));
      pole.position.set(lx, 0.8, 0.7);
      pole.castShadow = true;
      secretGroup.add(pole);
      const lampHead = buildLanternCage(0.68, { groundOffset: 1.68, ignitionOrder: 0.74 });
      lampHead.position.set(lx, 1.68, 0.7);
      secretGroup.add(lampHead);
    }
    secretGroup.position.set(sx, terrainHeight(sx, sz), sz);
    secretGroup.rotation.y = Math.atan2(-sx, -sz);
    world.add(secretGroup);
  }

  // --- The Piscina ---------------------------------------------------------
  // Rome's answer to the aquarium: a long stone-rimmed fishpond on
  // the garden shoulder, clear pale water (the lake's treatment,
  // calmer), ornamental carp cruising under the surface, lily pads,
  // a little fountain spout, dragonflies in the warm months. The
  // south coping is a seat (see BENCHES' piscina-rim entry, which
  // uses the measured seat math like every bench). The water basin
  // is a collider; the rim is not. What is released here joins the
  // visible population (setPiscinaStock), the golden carp as its
  // jewel.
  const PISCINA_Y = terrainHeight(PISCINA.position[0], PISCINA.position[1]);
  const piscinaWaterY = PISCINA_Y + 0.4;
  let piscinaReleasable: string | null = null;
  {
    const g = new THREE.Group();
    g.position.set(PISCINA.position[0], PISCINA_Y, PISCINA.position[1]);
    // Basin body: a stone block sunk into the shoulder, its top at
    // +0.30 forming the basin floor's edge; the skirt runs deep so
    // the slope never shows a gap under it.
    const basin = box(7.5, 1.1, 3.7, 0x9c8e6e);
    basin.position.y = -0.25;
    g.add(basin);
    // The basin floor, dark water-green so the fish read against it.
    const floor = box(6.9, 0.08, 3.1, 0x1d4048);
    floor.position.y = 0.3;
    g.add(floor);
    // Coping stones: the rim itself, top at +0.44, the seat.
    for (const s of [-1, 1]) {
      const rimLong = box(7.5, 0.14, 0.35, 0xb3a487);
      rimLong.position.set(0, 0.37, s * 1.675);
      g.add(rimLong);
      const rimEnd = box(0.35, 0.14, 3.0, 0xb3a487);
      rimEnd.position.set(s * 3.575, 0.37, 0);
      g.add(rimEnd);
    }
    // The water: the lake's own normal-mapped treatment, paler and
    // calmer, a pond, not a lake.
    const pondTex = waterTex.clone();
    pondTex.repeat.set(2, 1);
    pondTex.needsUpdate = true;
    const pondMat = new THREE.MeshStandardMaterial({
      color: 0x9fc8d8,
      transparent: true,
      opacity: 0.55,
      roughness: 0.08,
      metalness: 0.05,
      normalMap: pondTex,
      normalScale: new THREE.Vector2(0.22, 0.22),
      envMapIntensity: 1.1,
    });
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 3.0), pondMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.y = 0.4;
    g.add(pond);
    // Lily pads, and one flower.
    const padMat = mat(0x4a7d3a, { rough: 0.9 });
    for (const [lx, lz, r] of [
      [-2.2, -0.8, 0.26],
      [1.4, 0.9, 0.3],
      [2.6, -0.5, 0.2],
      [-0.6, 0.6, 0.22],
      [0.4, -1.0, 0.18],
    ] as const) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 14), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(lx, 0.406, lz);
      g.add(pad);
    }
    const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 8), mat(0xe58bb1, { rough: 0.7 }));
    bloom.position.set(1.4, 0.45, 0.9);
    g.add(bloom);
    // The fountain spout at the west end: a small stone mouth and a
    // still arc of falling water, with a living ripple where it lands.
    const spoutBase = box(0.34, 0.55, 0.34, 0xb3a487);
    spoutBase.position.set(-3.3, 0.55, 0);
    g.add(spoutBase);
    const arcCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-3.18, 0.78, 0),
      new THREE.Vector3(-2.85, 0.88, 0),
      new THREE.Vector3(-2.5, 0.4, 0),
    );
    const arc = new THREE.Mesh(
      new THREE.TubeGeometry(arcCurve, 10, 0.02, 5),
      new THREE.MeshStandardMaterial({ color: 0xcfe8f2, transparent: true, opacity: 0.55, roughness: 0.1 }),
    );
    g.add(arc);
    world.add(g);
    piscinaColliders.push({
      kind: "obb",
      x: PISCINA.position[0],
      z: PISCINA.position[1],
      halfW: 3.4,
      halfD: 1.5,
      rot: 0,
    });
  }
  // The fish themselves: low-poly carp built from a stretched
  // sphere and a tail fin, cruising slow ellipses under the surface
  // with soft rises. Base stock is the pond's own; released catches
  // are added by setPiscinaStock.
  interface PondFish {
    g: THREE.Group;
    cx: number;
    cz: number;
    rx: number;
    rz: number;
    speed: number;
    phase: number;
    yOff: number;
    feedOx: number;
    feedOz: number;
  }
  const pondFish: PondFish[] = [];
  const pondGroup = new THREE.Group();
  world.add(pondGroup);
  function makePondFish(colorHex: number, size: number, emissiveHex = 0): THREE.Group {
    const grp = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.35,
      metalness: 0.45,
      emissive: emissiveHex,
      emissiveIntensity: emissiveHex ? 0.55 : 0,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), m);
    body.scale.set(0.62 * size, 0.22 * size, 0.17 * size);
    grp.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1 * size, 0.18 * size, 6), m);
    tail.rotation.z = Math.PI / 2;
    tail.scale.z = 0.3;
    tail.position.x = -0.36 * size;
    grp.add(tail);
    return grp;
  }
  function addPondFish(colorHex: number, size: number, seed: number, emissiveHex = 0): PondFish {
    const grp = makePondFish(colorHex, size, emissiveHex);
    pondGroup.add(grp);
    const f: PondFish = {
      g: grp,
      cx: PISCINA.position[0] + Math.sin(seed * 12.9) * 1.6,
      cz: PISCINA.position[1] + Math.cos(seed * 7.7) * 0.5,
      rx: 0.9 + ((seed * 37) % 10) / 6,
      rz: 0.35 + ((seed * 53) % 10) / 14,
      speed: (0.05 + ((seed * 29) % 10) / 160) * (seed % 3 === 0 ? -1 : 1),
      phase: seed * 1.37,
      yOff: -0.1 - ((seed * 41) % 10) / 60,
      feedOx: Math.cos(seed * 5.1) * (0.25 + ((seed * 17) % 10) / 22),
      feedOz: Math.sin(seed * 5.1) * (0.2 + ((seed * 17) % 10) / 26),
    };
    pondFish.push(f);
    return f;
  }
  {
    const stock: [number, number][] = [
      [0xd9a441, 1.0], [0xf3ead8, 0.9], [0xc46a2d, 1.05], [0x7d8a7a, 0.95],
      [0xd9a441, 0.85], [0x7d8a7a, 1.0], [0xf3ead8, 1.0], [0xd9a441, 1.1],
      [0xc46a2d, 0.9], [0x7d8a7a, 0.85], [0xf3ead8, 0.95], [0xd9a441, 0.95],
    ];
    stock.forEach(([c, s], i) => addPondFish(c, s, i + 1));
  }
  const pondReleasedGroup: PondFish[] = [];
  let pondStockKey = "";
  function setPiscinaStock(speciesIds: string[]) {
    // This runs on every state change, nearly all of which leave the pond
    // alone; restocking each time also lost the fish it replaced.
    const stock = speciesIds.slice(0, 10);
    const key = stock.join("\n");
    if (key === pondStockKey) return;
    pondStockKey = key;
    for (const f of pondReleasedGroup) {
      pondGroup.remove(f.g);
      const i = pondFish.indexOf(f);
      if (i >= 0) pondFish.splice(i, 1);
      f.g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    pondReleasedGroup.length = 0;
    stock.forEach((id, i) => {
      if (id === "golden-carp") {
        // The pond's jewel: bigger, brighter, unmistakable.
        pondReleasedGroup.push(addPondFish(0xffc84d, 1.5, 101 + i, 0x7a5200));
      } else {
        let h = 0;
        for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0;
        const palette = [0xd9a441, 0xf3ead8, 0xc46a2d, 0x8a9a8a];
        pondReleasedGroup.push(addPondFish(palette[h % palette.length]!, 1.05, 101 + i));
      }
    });
  }
  // Surface ripples: three rings that bloom and fade in turn, at a
  // fish's position, the pond breathing.
  const pondRipples: { mesh: THREE.Mesh; phase: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.1, 20),
      new THREE.MeshBasicMaterial({ color: 0xeaf6fb, transparent: true, opacity: 0, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(PISCINA.position[0], piscinaWaterY + 0.006, PISCINA.position[1]);
    world.add(ring);
    pondRipples.push({ mesh: ring, phase: i / 3 });
  }
  // Dragonflies: the fireflies' daytime cousins: three darting
  // shapes over the water in the warm months.
  const dragonflies: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Group();
    const bodyD = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.008, 0.11, 5),
      new THREE.MeshStandardMaterial({ color: 0x3a6ea8, roughness: 0.4, metalness: 0.5 }),
    );
    bodyD.rotation.z = Math.PI / 2;
    d.add(bodyD);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.11), wingMat);
      wing.rotation.x = -Math.PI / 2;
      wing.position.set(0, 0.005, s * 0.055);
      d.add(wing);
    }
    world.add(d);
    dragonflies.push(d);
  }
  let pondFeed: { x: number; z: number; until: number } | null = null;
  let pondFeedBlend = 0;
  function updatePiscina(t: number, dt: number) {
    const feedActive = pondFeed !== null && t < pondFeed.until;
    pondFeedBlend = THREE.MathUtils.clamp(pondFeedBlend + (feedActive ? dt * 1.4 : -dt * 0.7), 0, 1);
    for (const f of pondFish) {
      f.phase += f.speed * dt;
      const ex = f.cx + Math.cos(f.phase) * f.rx;
      const ez = f.cz + Math.sin(f.phase) * f.rz;
      let vx = -Math.sin(f.phase) * f.rx * Math.sign(f.speed);
      let vz = Math.cos(f.phase) * f.rz * Math.sign(f.speed);
      let px = ex;
      let pz = ez;
      if (pondFeedBlend > 0 && pondFeed) {
        px = ex + (pondFeed.x + f.feedOx - ex) * pondFeedBlend;
        pz = ez + (pondFeed.z + f.feedOz - ez) * pondFeedBlend;
        vx = pondFeed.x + f.feedOx - ex;
        vz = pondFeed.z + f.feedOz - ez;
      }
      // A slow rise toward the surface now and then, then back down.
      const rise = Math.max(0, Math.sin(t * 0.21 + f.phase * 3.1)) ** 6;
      const py = piscinaWaterY + f.yOff + rise * 0.07 + Math.sin(t * 0.8 + f.phase * 5) * 0.012;
      f.g.position.set(px, py, pz);
      const vl = Math.hypot(vx, vz) || 1;
      f.g.rotation.y = Math.atan2(-(vz / vl), vx / vl);
    }
    pondRipples.forEach((r, i) => {
      const cyc = (t * 0.28 + r.phase) % 1;
      if (cyc < 0.02 && pondFish.length > 0) {
        const f = pondFish[Math.floor(Math.random() * pondFish.length)]!;
        r.mesh.position.x = f.g.position.x;
        r.mesh.position.z = f.g.position.z;
      }
      const s = 0.6 + cyc * 2.6;
      r.mesh.scale.set(s, s, 1);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.4 * Math.sin(Math.PI * Math.min(1, cyc)) * (i === 0 ? 1 : 0.8);
    });
    const dragonSeason = currentTreeSeason === "spring" || currentTreeSeason === "summer";
    dragonflies.forEach((d, i) => {
      d.visible = dragonSeason && nightMix < 0.45;
      if (!d.visible) return;
      const a = t * (0.35 + i * 0.09) + i * 2.4;
      d.position.set(
        PISCINA.position[0] + Math.sin(a) * 2.4 + Math.sin(a * 2.7) * 0.5,
        piscinaWaterY + 0.5 + Math.sin(t * 1.3 + i * 2) * 0.16,
        PISCINA.position[1] + Math.cos(a * 0.8) * 1.0,
      );
      d.rotation.y = -a + Math.PI / 2;
    });
  }

  // --- The Baths (thermae) ---------------------------------------------------
  // An open peristyle courtyard in the south-eastern hollow: stone
  // walls with a south gate, four columns, dressing benches with
  // towels and oil flasks, pergola beams along the north side, two
  // lanterns, and the caldarium, a warm pool breathing steam. The
  // soak itself: he steps in at the rim prompt and settles onto the
  // underwater ledge (the seated math treats the ledge as his
  // bench, so his pelvis rides it exactly, water at his chest). She
  // joins only through the shell's invitation flow (joinBath). The
  // camera never goes hunting: the pair sit shoulder-up in opaque
  // water and steam, a scene about closeness, not display.
  const BATH_Y = terrainHeight(BATHS.position[0], BATHS.position[1]);
  const bathWaterY = BATH_Y + 0.62;
  let bathState: { museIn: boolean } | null = null;
  let bathMuseGlide = 0; // 0..1 while she settles into her soak spot
  let bathCare: { by: "muse" | "player"; until: number } | null = null;
  let bathSteam: THREE.Points | null = null;
  let bathSteamPos: Float32Array | null = null;
  {
    const g = new THREE.Group();
    g.position.set(BATHS.position[0], BATH_Y, BATHS.position[1]);
    // Courtyard floor slab, with a skirt against the hollow's slope.
    const slab = box(11.6, 0.9, 8.6, 0xb59a7a);
    slab.position.y = -0.42;
    g.add(slab);
    // Walls: north and flanks full; south split by the gate.
    const mkWall = (w: number, x: number, z: number, rotY = 0) => {
      const wall = box(w, 2.2, 0.3, 0xc9b18a);
      wall.position.set(x, 1.1, z);
      wall.rotation.y = rotY;
      g.add(wall);
      const cap = box(w, 0.12, 0.44, 0xb3a487);
      cap.position.set(x, 2.26, z);
      cap.rotation.y = rotY;
      g.add(cap);
    };
    mkWall(11, 0, -4);
    mkWall(4.7, -3.15, 4);
    mkWall(4.3, 3.35, 4);
    mkWall(8, -5.5, 0, Math.PI / 2);
    mkWall(8, 5.5, 0, Math.PI / 2);
    // Pergola beams along the north side, shade without a roof.
    for (let i = 0; i < 4; i++) {
      const beam = box(0.14, 0.14, 3.4, 0x8a6844);
      beam.position.set(-3.6 + i * 2.4, 2.62, -2.6);
      g.add(beam);
    }
    // The caldarium basin: rim at +0.14, floor dark under warm water.
    const basinB = box(7.5, 1.0, 3.7, 0x9c8e6e);
    basinB.position.set(0, 0.05, -0.6);
    g.add(basinB);
    const bFloor = box(6.9, 0.08, 3.1, 0x24444a);
    bFloor.position.set(0, -0.04, -0.6);
    g.add(bFloor);
    for (const s of [-1, 1]) {
      const rimL = box(7.5, 0.14, 0.35, 0xb3a487);
      rimL.position.set(0, 0.61, -0.6 + s * 1.675);
      g.add(rimL);
      const rimE = box(0.35, 0.14, 3.0, 0xb3a487);
      rimE.position.set(s * 3.575, 0.61, -0.6);
      g.add(rimE);
    }
    // The underwater ledge the soakers sit on (its top is the seat).
    const ledge = box(6.8, 0.09, 0.7, 0x8f8672);
    ledge.position.set(0, 0.045, 0.35);
    g.add(ledge);
    // Warm water: the piscina's calm treatment, deeper and stiller.
    const bathTex = waterTex.clone();
    bathTex.repeat.set(2, 1);
    bathTex.needsUpdate = true;
    const bathWaterMat = new THREE.MeshStandardMaterial({
      color: 0x7fb2bd,
      transparent: true,
      opacity: 0.72,
      roughness: 0.06,
      metalness: 0.05,
      normalMap: bathTex,
      normalScale: new THREE.Vector2(0.15, 0.15),
      envMapIntensity: 1.1,
    });
    const bathWater = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 3.0), bathWaterMat);
    bathWater.rotation.x = -Math.PI / 2;
    bathWater.position.set(0, 0.62, -0.6);
    g.add(bathWater);
    // Dressing benches along the north wall, with towels and flasks.
    for (const bx of [-2.6, 2.6]) {
      const benchB = box(2.2, 0.12, 0.5, 0x8a6844);
      benchB.position.set(bx, 0.45, -3.5);
      g.add(benchB);
      for (const lx of [-0.9, 0.9]) {
        const leg = box(0.12, 0.42, 0.44, 0x77572f);
        leg.position.set(bx + lx, 0.21, -3.5);
        g.add(leg);
      }
      const towel = box(0.55, 0.07, 0.4, 0xf3ead8);
      towel.position.set(bx - 0.5, 0.55, -3.5);
      g.add(towel);
      const towel2 = box(0.45, 0.05, 0.36, 0xe8e3d8);
      towel2.position.set(bx - 0.48, 0.61, -3.5);
      g.add(towel2);
      const flask = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.2, 8),
        mat(0xc9862d, { rough: 0.3, metal: 0.6 }),
      );
      flask.position.set(bx + 0.6, 0.61, -3.5);
      g.add(flask);
    }
    // Two oil lanterns, warm against the steam and on the same dusk
    // circuit as every street fixture (no fixed daylight point lights).
    for (const lx of [-4.6, 4.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), mat(0x5a4632, { rough: 1 }));
      post.position.set(lx, 0.8, 1.8);
      g.add(post);
      const lampHead = buildLanternCage(0.56, { groundOffset: 1.72, ignitionOrder: 0.46 });
      lampHead.position.set(lx, 1.72, 1.8);
      g.add(lampHead);
    }
    world.add(g);
    treePlacement.addBuilding(g, "The Baths");
    // Steam: soft points forever rising over the warm water,
    // thickening while anyone soaks.
    const STEAM_N = 36;
    bathSteamPos = new Float32Array(STEAM_N * 3);
    for (let i = 0; i < STEAM_N; i++) {
      bathSteamPos[i * 3] = BATHS.position[0] + (Math.random() - 0.5) * 6;
      bathSteamPos[i * 3 + 1] = bathWaterY + Math.random() * 1.6;
      bathSteamPos[i * 3 + 2] = BATHS.position[1] - 0.6 + (Math.random() - 0.5) * 2.4;
    }
    const steamGeo = new THREE.BufferGeometry();
    steamGeo.setAttribute("position", new THREE.BufferAttribute(bathSteamPos, 3));
    const steamMat = new THREE.PointsMaterial({
      size: 1.5,
      map: new THREE.CanvasTexture(spriteCanvas),
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      color: 0xf4f8ff,
      sizeAttenuation: true,
    });
    bathSteam = new THREE.Points(steamGeo, steamMat);
    world.add(bathSteam);
  }
  for (const [cx, cz] of [[20.9, 21.5], [27.1, 21.5], [20.9, 25.3], [27.1, 25.3]] as const) {
    void placeWorld(columnSimpleUrl, { x: cx, z: cz, height: 3.0 });
    bathColliders.push({ kind: "circle", x: cx, z: cz, r: 0.22, pad: 0.1 });
  }
  bathColliders.push(
    { kind: "obb", x: BATHS.position[0], z: 23.4, halfW: 3.4, halfD: 1.5, rot: 0 },
    { kind: "obb", x: BATHS.position[0], z: 20, halfW: 5.5, halfD: 0.15, rot: 0 },
    { kind: "obb", x: 20.85, z: 28, halfW: 2.35, halfD: 0.15, rot: 0 },
    { kind: "obb", x: 27.35, z: 28, halfW: 2.15, halfD: 0.15, rot: 0 },
    { kind: "obb", x: 18.5, z: 24, halfW: 0.15, halfD: 4, rot: 0 },
    { kind: "obb", x: 29.5, z: 24, halfW: 0.15, halfD: 4, rot: 0 },
  );
  function enterBath() {
    if (bathState || !walking) return;
    if (seatPlayer) standUpFromBench();
    bathState = { museIn: false };
    walkPos.x = BATHS.soakHis[0];
    walkPos.z = BATHS.soakHis[1];
    walkHeading = Math.PI;
  }
  function joinBath() {
    if (!bathState || bathState.museIn) return;
    bathState.museIn = true;
    bathMuseGlide = 0;
  }
  function exitBath() {
    if (!bathState) return;
    bathState = null;
    bathCare = null;
    walkPos.x = BATHS.soakHis[0];
    walkPos.z = BATHS.soakHis[1] + 1.65;
  }
  function updateBaths(t: number, dt: number) {
    if (bathSteam && bathSteamPos) {
      const pos = bathSteamPos;
      for (let i = 0; i < pos.length / 3; i++) {
        let px = pos[i * 3] ?? 0;
        let py = pos[i * 3 + 1] ?? bathWaterY;
        py += dt * (0.14 + (i % 5) * 0.02);
        px += Math.sin(t * 0.6 + i * 1.7) * dt * 0.05;
        if (py > bathWaterY + 1.9) {
          py = bathWaterY + 0.05;
          px = BATHS.position[0] + (Math.random() - 0.5) * 6;
          pos[i * 3 + 2] = BATHS.position[1] - 0.6 + (Math.random() - 0.5) * 2.4;
        }
        pos[i * 3] = px;
        pos[i * 3 + 1] = py;
      }
      (bathSteam.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (bathSteam.material as THREE.PointsMaterial).opacity = bathState ? 0.3 : 0.15;
    }
    if (bathState?.museIn && bathMuseGlide < 1) {
      bathMuseGlide = Math.min(1, bathMuseGlide + dt / 1.4);
      const k = bathMuseGlide * bathMuseGlide * (3 - 2 * bathMuseGlide);
      const fromX = BATHS.soakHers[0];
      const fromZ = BATHS.soakHers[1] + 1.7;
      const x = fromX + (BATHS.soakHers[0] - fromX) * k;
      const z = fromZ + (BATHS.soakHers[1] - fromZ) * k;
      museGroup.position.set(x, terrainHeight(x, z), z);
      museGroup.rotation.y = Math.PI;
    }
  }
  // Every seatable bench in town, with its seat height measured from
  // the shipped models (stone: seat top ≈ 0.47 over its 0.60 frame;
  // wooden: ≈ 0.33 over 0.37; the terrace bench is the wooden model
  // at width 1.7, so ≈ 0.30). The rule: a backrest sits on local +Z
  // (faceBackrestPlusZ measures the stone bench's and turns the model
  // if its file says otherwise; the wooden and Greek benches have
  // none), so a sitter faces local -Z: world facing =
  // (-sin rotY, -cos rotY), i.e. heading rotY + PI. Two seat slots
  // per bench, local x ±0.42, benches seat two.
  interface BenchDef {
    id: string;
    x: number;
    z: number;
    rotY: number;
    /** Seat surface height above the bench's own base, measured
     *  from the shipped GLBs at their placed scale. */
    seatTop: number;
    /** The point whose terrain height the bench model actually
     *  stands on (its placement point, for the terrace bench, the
     *  terrace group's own centre, NOT the bench's offset slot). */
    baseX: number;
    baseZ: number;
    /** Stand up BEHIND the bench instead of at its front point,
     *  for the piscina rim, whose front is the water. */
    standBehind?: boolean;
  }
  // Their house (Task 35, homeHouse.ts): walls, door, lamp and bed,
  // on the west lawn; its walls and bed join the colliders below, and
  // the bed's edge joins the benches, a seat for two.
  const homeHouse = buildHomeHouse(terrainHeight);
  world.add(homeHouse.group);
  const terraceRot = Math.atan2(-SECRET.position[0], -SECRET.position[1]);
  const BENCHES: BenchDef[] = [
    // Turned on Nov 6, 2026 (Task 18): sitters face west, over the
    // peristyle garden to the Town Tree, not the east wall.
    { id: "bench-stone", x: 8.8, z: 4.6, rotY: Math.PI / 2, seatTop: 0.47, baseX: 8.8, baseZ: 4.6 },
    // The temple road's bench, east of the road, a sitter faces west over it.
    { id: "bench-temple", x: 17.3, z: -23.6, rotY: Math.PI / 2, seatTop: 0.47, baseX: 17.3, baseZ: -23.6 },
    {
      id: "bench-terrace",
      x: SECRET.position[0] - 0.7 * Math.sin(terraceRot),
      z: SECRET.position[1] - 0.7 * Math.cos(terraceRot),
      rotY: terraceRot,
      seatTop: 0.3,
      baseX: SECRET.position[0],
      baseZ: SECRET.position[1],
    },
    {
      // The piscina's south coping: a stone rim 0.44 over the pond's
      // base, facing the water (rotY 0 = facing -Z, the water side).
      // Standing up steps back onto the land side, never the pond.
      id: "piscina-rim",
      x: PISCINA.rim.x,
      z: PISCINA.rim.z,
      rotY: 0,
      seatTop: 0.44,
      baseX: PISCINA.position[0],
      baseZ: PISCINA.position[1],
      standBehind: true,
    },
    // Their bed's edge (Task 35): sit together on it; the lying moment waits for its animation.
    {
      id: "home-bed",
      x: homeHouse.bedSeat.x,
      z: homeHouse.bedSeat.z,
      rotY: homeHouse.bedSeat.rotY,
      seatTop: homeHouse.bedSeat.y - terrainHeight(homeHouse.bedSeat.x, homeHouse.bedSeat.z),
      baseX: homeHouse.bedSeat.x,
      baseZ: homeHouse.bedSeat.z,
    },
    // Athena's temple step (Task 55): sit together facing east, toward Lucretia.
    { id: "bench-athena", x: ATHENA_SEAT.x, z: ATHENA_SEAT.z, rotY: ATHENA_SEAT.rotY, seatTop: ATHENA_TEMPLE.stepY, baseX: ATHENA_SEAT.x, baseZ: ATHENA_SEAT.z },
    // The sea cliff's bench (Task 34), at the headland's edge, facing the sea.
    { id: CLIFF.bench.id, x: CLIFF.bench.x, z: CLIFF.bench.z, rotY: CLIFF.bench.rotY, seatTop: 0.47, baseX: CLIFF.bench.x, baseZ: CLIFF.bench.z },
  ];
  /** Each bench's seat surface in WORLD Y, measured from the placed
   *  model's own transform (bounding-box base + the GLB-measured
   *  seatTop) the first time anyone sits, then cached. This is the
   *  number sitting is derived from, never a terrain sample at the
   *  slot, which on a slope is a different height than the bench's
   *  own base. Fallback until the model lands: the placement point's
   *  terrain + seatTop, which is how placeWorld stood it up. */
  const benchSeatCache = new Map<string, number>();
  function benchSeatWorldY(b: BenchDef): number {
    const cached = benchSeatCache.get(b.id);
    if (cached !== undefined) return cached;
    const group = benchGroups.get(b.id);
    if (group) {
      const box = new THREE.Box3().setFromObject(group);
      if (Number.isFinite(box.min.y)) {
        const y = box.min.y + b.seatTop;
        benchSeatCache.set(b.id, y);
        return y;
      }
    }
    return terrainHeight(b.baseX, b.baseZ) + b.seatTop;
  }
  const benchSlotPos = (b: BenchDef, slot: number): { x: number; z: number } => {
    const lx = slot * 0.42;
    const lz = -0.015;
    return {
      x: b.x + lx * Math.cos(b.rotY) + lz * Math.sin(b.rotY),
      z: b.z - lx * Math.sin(b.rotY) + lz * Math.cos(b.rotY),
    };
  };
  // Sitting state. seatPlayer: the Centurion is on a bench (movement
  // parked, collision resolve off, the seat point is inside the
  // bench's own footprint by design). museSeatTarget: she is walking
  // to her slot; seatMuse: she is seated beside him.
  let seatPlayer: { bench: BenchDef; slot: number } | null = null;
  let seatMuse: { bench: BenchDef; slot: number } | null = null;
  let museSeatTarget: { bench: BenchDef; slot: number; x: number; z: number } | null = null;
  const sitDownOnBench = (bench: BenchDef) => {
    const s0 = benchSlotPos(bench, -1);
    const s1 = benchSlotPos(bench, 1);
    const pSlot =
      Math.hypot(walkPos.x - s0.x, walkPos.z - s0.z) <= Math.hypot(walkPos.x - s1.x, walkPos.z - s1.z)
        ? -1
        : 1;
    const sp = pSlot === -1 ? s0 : s1;
    walkPos.x = sp.x;
    walkPos.z = sp.z;
    walkHeading = bench.rotY + Math.PI;
    seatPlayer = { bench, slot: pSlot };
    if (followMode) {
      const mp = benchSlotPos(bench, -pSlot);
      museSeatTarget = { bench, slot: -pSlot, x: mp.x, z: mp.z };
    }
    opts.onSitChange?.(bench.id);
  };
  const standUpFromBench = () => {
    if (!seatPlayer) return;
    const b = seatPlayer.bench;
    // Stand at the bench's front point, clear of its footprint,
    // or behind it, for the piscina rim, whose front is water.
    if (b.standBehind) {
      walkPos.x = b.x + Math.sin(b.rotY) * 0.95;
      walkPos.z = b.z + Math.cos(b.rotY) * 0.95;
    } else {
      walkPos.x = b.x - Math.sin(b.rotY) * 0.72;
      walkPos.z = b.z - Math.cos(b.rotY) * 0.72;
    }
    seatPlayer = null;
    seatMuse = null;
    museSeatTarget = null;
    opts.onSitChange?.(null);
  };
  /** Player 2 stands her up alone: at her seat's front point (or
   *  behind, for the piscina rim), clear of the bench's footprint.
   *  His seat is untouched; standing him up still stands them both. */
  const standMuseUp = () => {
    if (!seatMuse) return;
    const b = seatMuse.bench;
    const p = benchSlotPos(b, seatMuse.slot);
    const out = b.standBehind ? 0.95 : -0.72;
    const x = p.x + Math.sin(b.rotY) * out;
    const z = p.z + Math.cos(b.rotY) * out;
    museGroup.position.set(x, groundHeightAt(x, z), z);
    museGroundSm = museGroup.position.y;
    seatMuse = null;
  };

  // --- Rowing on the lake ---------------------------------------------------
  // Boarding puts the Centurion in the boat's stern seat and, when
  // Muse is following, Muse in the bow facing him. While boatState
  // is set, updateWalk steers the BOAT with the walk input instead of
  // the man: walkPos tracks the boat (so the follow camera and the
  // prompt scan follow it), the hull stays inside the water ellipse,
  // and stepping ashore is only possible back at the mooring. Time
  // aboard counts exactly like bench time, the pair are seated
  // together, and driveClipAnims poses them with the same sit clips.
  const boardBoat = () => {
    if (!walking || boatState) return;
    if (seatPlayer) standUpFromBench();
    boatState = { heading: -Math.PI / 2, museAboard: followMode };
    boatVel = 0;
    boatStroke = 0;
    rowLineAt = -1;
    walkPos.x = boatPos.x;
    walkPos.z = boatPos.z;
    walkHeading = boatState.heading;
    opts.onRowChange?.(true);
  };
  const disembarkBoat = (force = false): boolean => {
    if (!boatState) return false;
    const d = Math.hypot(boatPos.x - LAKE.mooring[0], boatPos.z - LAKE.mooring[1]);
    if (!force && d > 3.4) return false;
    const wasAboard = boatState.museAboard;
    boatState = null;
    boatVel = 0;
    boatPos.x = LAKE.mooring[0];
    boatPos.z = LAKE.mooring[1];
    boatGroup.position.set(boatPos.x, LAKE_Y - 0.1, boatPos.z);
    boatGroup.rotation.set(0, -Math.PI, 0);
    // He steps ashore at the dock's land end, on the lake lane.
    walkPos.x = LAKE.bank[0];
    walkPos.z = LAKE.bank[1];
    walkHeading = Math.PI / 2; // face east, up the lane toward town
    if (wasAboard) {
      // She steps ashore beside him and falls back into follow step
      // (or walks herself home, if follow was ended mid-row).
      museGroup.position.set(
        LAKE.bank[0] + 0.5,
        groundHeightAt(LAKE.bank[0] + 0.5, LAKE.bank[1] + 1),
        LAKE.bank[1] + 1,
      );
      if (!followMode) museReturning = true;
    }
    opts.onRowChange?.(false);
    return true;
  };

  // --- Speech bubbles -----------------------------------------------------
  // RPG-style bubbles above the two characters' heads. Each has its own
  // canvas texture. Three guarantees, after the town kept clipping her
  // mid-sentence (a 3-line cap in the old draw simply dropped the rest
  // of the line, and the sprite sat in the 3D depth queue where lamp
  // posts could cover it):
  //  1. FULL TEXT, ALWAYS, a line is paginated at sentence/clause
  //     boundaries into pages of at most 3 wrapped lines; pages advance
  //     in sequence, each with its own reading time. Nothing is ever
  //     truncated, ellipsised, or crammed into a fixed-height box.
  //  2. ALWAYS ON SCREEN, every frame the bubble's desired position
  //     (over its speaker's head) is projected to screen space and
  //     clamped into the safe viewport (below the top chips, above
  //     the control clusters, inside the side margins); the tail is
  //     redrawn offset toward the speaker when the bubble had to move.
  //  3. ABOVE EVERYTHING, the sprite material ignores depth testing
  //     and renders last, so no lamp post, column, or roof can cover
  //     her words.
  //  4. READABLE IN ANY ORIENTATION, the sprite is sized in SCREEN
  //     space, not world space (see clampBubbleToScreen): a fixed
  //     world size fills ~43% of a portrait phone's width but only
  //     ~10% of a landscape phone's, because the landscape view's
  //     horizontal field of view is so much wider, the same words
  //     shrank to a sliver and the user could not read them
  //     (Nov 1 screenshot). The bubble now holds a target on-screen
  //     height in CSS pixels at whatever distance the camera sits,
  //     in portrait and landscape alike, and its canvas is drawn at
  //     double resolution so the larger landscape size stays crisp.
  interface BubbleState {
    sprite: THREE.Sprite;
    ctx: CanvasRenderingContext2D;
    tex: THREE.CanvasTexture;
    showAt: number;
    hideAt: number;
    pages: string[];
    pageIdx: number;
    pageEndAt: number;
    tailFrac: number;
    drawnTailFrac: number;
    lastTailDrawAt: number;
    anchor: THREE.Object3D;
    anchorY: number;
    speaker: BubbleSpeaker;
    /** 0..1 pop-in scale ease, set each frame in updateBubbles. */
    pop: number;
  }
  function makeBubble(parent: THREE.Object3D, y: number, speaker: BubbleSpeaker): BubbleState {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas);
    // The canvas is painted in sRGB: read as linear, its near-black
    // ink was lifted to mid-grey on screen (Task 25).
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      // fog off: in mist or rain the plate must not wash to the sky's
      // pale colour; tone mapping off: the white stays white and the
      // ink stays ink, by day and by night.
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0, fog: false, toneMapped: false }),
    );
    sprite.scale.set(2.4, 1.2, 1);
    sprite.position.set(0, y, 0);
    sprite.renderOrder = 9999;
    sprite.visible = false;
    parent.add(sprite);
    return {
      sprite, ctx, tex, showAt: -1, hideAt: -1,
      pages: [], pageIdx: 0, pageEndAt: -1,
      tailFrac: 0.5, drawnTailFrac: 0.5, lastTailDrawAt: -1,
      anchor: parent, anchorY: y,
      speaker, pop: 1,
    };
  }
  function drawBubblePage(b: BubbleState) {
    drawBubblePlate(b.ctx, b);
    b.tex.needsUpdate = true;
    b.drawnTailFrac = b.tailFrac;
  }
  /** Show a line in a bubble: paginated in full, pages advancing in
   *  sequence in updateBubbles, each with its own reading time. */
  function showBubbleText(b: BubbleState, text: string, t: number) {
    b.pages = paginateBubbleText(b.ctx, text);
    b.pageIdx = 0;
    b.showAt = t;
    b.pageEndAt = t + bubblePageDuration(b.pages[0] ?? "");
    b.hideAt = t + b.pages.reduce((sum, p) => sum + bubblePageDuration(p), 0);
    b.tailFrac = 0.5;
    drawBubblePage(b);
    b.sprite.visible = true;
  }
  let clockTime = 0;
  const bubbles: BubbleState[] = [];
  const bubbleTmpV = new THREE.Vector3();
  const bubbleTmpV2 = new THREE.Vector3();
  // Per-frame scratch (v44): the bubble clamp and the shared-umbrella
  // lean used to allocate fresh vectors every frame; reuse these.
  const bubbleRight = new THREE.Vector3();
  const bubbleUp = new THREE.Vector3();
  const bubblePx = new THREE.Vector3();
  const bubblePy = new THREE.Vector3();
  const sharedTmpV = new THREE.Vector3();
  /** Clamp a visible bubble into the safe viewport, in screen space:
   *  wherever its speaker stands, even at a screen edge, the whole
   *  bubble stays readable, below the top chips and above the walk
   *  controls, and its tail swings toward the speaker. */
  function clampBubbleToScreen(b: BubbleState, t: number) {
    b.anchor.getWorldPosition(bubbleTmpV);
    bubbleTmpV.y += b.anchorY;
    bubbleTmpV2.copy(bubbleTmpV).project(camera);
    if (bubbleTmpV2.z > 1 || bubbleTmpV2.z < -1) {
      b.sprite.visible = false;
      return;
    }
    const cw = Math.max(1, canvas.clientWidth || renderer.domElement.clientWidth || 1);
    const ch = Math.max(1, canvas.clientHeight || renderer.domElement.clientHeight || 1);
    // Screen-space sizing (guarantee 4 above): pick the bubble's
    // on-screen height in CSS pixels, a generous share of the short
    // landscape stage, a modest share of the tall portrait one, both
    // floored and capped so the words land at a readable size on any
    // phone, then convert that pixel height back into a world size
    // at the camera's actual distance, so zooming or pulling the
    // camera back can no longer shrink her words away.
    // Never the whole screen (Task 26): the size is set in screen
    // pixels and capped to a share of the stage, at most 36% of its
    // height and a bubble no wider than 90% of it, whatever the
    // camera's distance. (A world-size floor used to win here when
    // the camera sat close to her, and the bubble filled the view.)
    // Longer lines page on inside the bubble, never grow it.
    const targetPxH = Math.min(
      isLandscapeView ? THREE.MathUtils.clamp(ch * 0.34, 132, 200) : THREE.MathUtils.clamp(ch * 0.155, 104, 168),
      ch * 0.36,
      cw * 0.45,
    );
    const distToCam = Math.max(0.05, camera.position.distanceTo(bubbleTmpV));
    const worldH = 2 * distToCam * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (targetPxH / ch);
    b.sprite.scale.set(worldH * 2 * b.pop, worldH * b.pop, 1);
    // The bubble's half-extents in NDC, from its (possibly resized)
    // real world size.
    const right = bubbleRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const up = bubbleUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const px = bubblePx.copy(bubbleTmpV).addScaledVector(right, worldH).project(camera);
    const py = bubblePy.copy(bubbleTmpV).addScaledVector(up, worldH / 2).project(camera);
    const hx = Math.min(0.92, Math.abs(px.x - bubbleTmpV2.x));
    const hy = Math.min(0.45, Math.abs(py.y - bubbleTmpV2.y));
    const marginX = (10 / cw) * 2;
    const topPx = isLandscapeView ? 54 : 100;
    // Above the walk controls, which sit at the screen's foot (Task 38).
    const bottomPx = isLandscapeView ? 212 : 252;
    const xLo = -1 + marginX + hx;
    const xHi = 1 - marginX - hx;
    const yLo = -1 + (bottomPx / ch) * 2 + hy;
    const yHi = 1 - (topPx / ch) * 2 - hy;
    const cx = xLo <= xHi ? THREE.MathUtils.clamp(bubbleTmpV2.x, xLo, xHi) : 0;
    const cy = yLo <= yHi ? THREE.MathUtils.clamp(bubbleTmpV2.y, yLo, yHi) : bubbleTmpV2.y;
    // Tail target: where the speaker's head sits, relative to the
    // (possibly moved) bubble.
    const tailTarget =
      hx > 0.01
        ? THREE.MathUtils.clamp(0.5 + (bubbleTmpV2.x - cx) / (2 * hx), 0.1, 0.9)
        : 0.5;
    if (Math.abs(tailTarget - b.drawnTailFrac) > 0.05 && t - b.lastTailDrawAt > 0.15) {
      b.tailFrac = tailTarget;
      drawBubblePage(b);
      b.lastTailDrawAt = t;
    }
    bubbleTmpV.set(cx, cy, bubbleTmpV2.z).unproject(camera);
    b.anchor.worldToLocal(bubbleTmpV);
    b.sprite.position.copy(bubbleTmpV);
  }
  function updateBubbles(t: number) {
    for (const b of bubbles) {
      if (b.hideAt <= 0) continue;
      // Advance through the line's pages in sequence, the full text,
      // a page at a time, never a truncated cram.
      if (t >= b.pageEndAt && b.pageIdx < b.pages.length - 1) {
        b.pageIdx += 1;
        b.pageEndAt = t + bubblePageDuration(b.pages[b.pageIdx] ?? "");
        drawBubblePage(b);
      }
      const fadeIn = Math.min(1, Math.max(0, (t - b.showAt) / 0.25));
      // A small pop as it appears (eased out), none under reduced motion.
      b.pop = opts.reducedMotion ? 1 : 0.9 + 0.1 * (1 - Math.pow(1 - fadeIn, 3));
      const fadeOut = Math.min(1, Math.max(0, (b.hideAt - t) / 0.7));
      const o = Math.min(fadeIn, fadeOut);
      (b.sprite.material as THREE.SpriteMaterial).opacity = o;
      b.sprite.visible = o > 0.01;
      if (b.sprite.visible) clampBubbleToScreen(b, t);
      if (t > b.hideAt + 0.1) b.hideAt = -1;
    }
  }

  // --- Muse, the town's host character ---
  // Muse in her new VRM body, silver-blonde hair, a plain white
  // one-piece dress, standing by the town tree.
  // Still unmistakably her: a floating gold star companion, and a
  // wave when greeted. (No floating name labels anymore, the player asked
  // for clean heads; identities live in the panels and chips.)
  const museGroup = new THREE.Group();
  const museInner = new THREE.Group();
  museGroup.add(museInner);
  let museWaveStart = -100;
  // Muse's body is the AvatarSample VRM the player sent on Oct 31
  // (silver-blonde hair, white one-piece dress), she keeps this
  // plaza spot, her floating gold star, and a wave driven by the
  // VRM's own arm bones when greeted.
  let museRig: VrmRig | null = null;
  let museAnim: CharAnimator | null = null;
  let museBlink: { mesh: THREE.Mesh; index: number }[] = [];
  // Reveal gate (shared shape with the Centurion's below): her body
  // stays hidden until the frame loop can show it already animated,
  // see tryRevealChars in driveClipAnims.
  let museBody: THREE.Object3D | null = null;
  let museAttachedAt = 0;
  let museRevealed = false;
  loadModelScene(museAvatarUrl)
    .then((source) => {
      if (disposed) return null;
      const model = cloneSkeleton(source);
      resources.adopt(model);
      downscaleModelTextures(model);
      litVrmMaterials(model, MUSE_TINTS);
      collectNightSkin(model);
      prepareVrm(model);
      const body = groundModel(model, { height: 1.8 });
      // Hidden on arrival: a fresh VRM stands in its bind pose (arms
      // straight out) and the bake steps pose it around while the
      // clips download, none of that may ever paint. The frame loop
      // reveals the body only once its idle clip is primed and
      // applied (or, if the clips failed, once procedural posing
      // owns it). Her star above already marks the spot.
      body.visible = false;
      museInner.add(body);
      museBody = body;
      museAttachedAt = performance.now();
      museRevealed = false;
      museBlink = collectBlinkMorphs(model);
      museRig = collectRig(model);
      // Her real motion clips (idle / walk / run / wave), retargeted
      // onto this body; until they check out, the procedural posing
      // below carries her exactly as before. They load regardless of
      // the reduced-motion preference: that flag calms camera
      // flights, dust and easing, never her body. (It once gated
      // this call, and on phones with system animations off she
      // stood frozen for four releases.)
      museAnim = createCharAnimator({
        resources,
        isBusy: () => isMoving,
        model,
        urls: {
          idle: fIdleUrl, walk: fWalkUrl, run: fRunUrl, wave: fWaveUrl, sit: fSitUrl, dance: fDanceUrl, poseA: fPoseAUrl, poseB: fPoseBUrl,
          outdoor: {
            talk: [fTalk1Url, fTalk2Url, fTalk3Url],
            sitTalk: [fSitTalk1Url, fSitTalk2Url],
            benchSit: [fBench1Url, fBench2Url],
            flirt: fFlirtUrl,
            hug: fHugUrl,
          },
        },
      });
      poseBone(museRig, museRig.lUpperArm, 0, 0, -1.22);
      poseBone(museRig, museRig.rUpperArm, 0, 0, 1.22);
      poseBone(museRig, museRig.lLowerArm, 0, 0, -0.14);
      poseBone(museRig, museRig.rLowerArm, 0, 0, 0.14);
    })
    .catch(() => {
      /* her star still marks the spot */
    });
  // Floating star companion, orbiting slowly at shoulder height.
  const museStar = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14),
    new THREE.MeshStandardMaterial({ color: 0xffd34e, emissive: 0xa87800, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 }),
  );
  museStar.position.set(0.46, 1.8, 0.1);
  museInner.add(museStar);
  let museStarShow = 1;
  // Muse's umbrella: navy with a gold tip, matching her star.
  {
    const museUmbrella = makeUmbrella(0x2b3a67);
    museUmbrella.position.set(-0.18, 2.22, 0.04);
    museUmbrella.rotation.z = 0.12;
    museInner.add(museUmbrella);
    umbrellas.push(museUmbrella);
    museUmbrellaRef = museUmbrella;
  }
  museGroup.position.set(MUSE.position[0], groundHeightAt(MUSE.position[0], MUSE.position[1]), MUSE.position[1]);
  const museBubble = makeBubble(museGroup, 3.0, BUBBLE_SPEAKERS.muse);
  bubbles.push(museBubble);
  museGroup.rotation.y = Math.atan2(-MUSE.position[0], -MUSE.position[1]);
  // Task 48: a tap on her body toggles walking together ("muse-body");
  // her speech bubble keeps the talk ("muse"), as the prompt and X do.
  museGroup.traverse((o) => {
    o.userData.pick = { kind: "muse", id: o === museBubble.sprite ? "muse" : "muse-body" } satisfies { kind: PickKind; id: string };
  });
  world.add(museGroup);
  pickRoots.push(museGroup);

  // Preferred tree positions. Loaded canopy bounds may require a nearby
  // move; TreePlacement keeps the matching trunk blockers in sync.
  const treeSpots: [number, number, number][] = [
    [-13, -19.5, 1],
    [13, -19.5, 1],
    [-34.9, -7.7, 1.25],
    [28.9, 31.5, 1.1],
    [-20.4, 33.2, 1.05],
    [22.5, 34, 1.2],
    [-34, 22.1, 1],
    [40.8, -13.6, 1.15],
    [26, 9.5, 0.9],
    [-26, 9.5, 0.95],
  ];
  treeSpots.forEach(([tx, tz, ts], i) => {
    void placeWorld(PACK_TREES[i % PACK_TREES.length]!, {
      x: tx,
      z: tz,
      rotY: i * 1.37,
      height: 3.7 * ts,
    });
  });
  const pineSpots: [number, number, number][] = [
    [10, -17, 1],
    [-10, -17, 1],
    [34, 28.9, 1.3],
    [-33.2, -16.2, 1.25],
    [-27.5, -9, 0.9],
  ];
  pineSpots.forEach(([px, pz, ps], i) => {
    void placeWorld(coniferUrl, { x: px, z: pz, rotY: i * 1.9, height: 4.2 * ps });
  });
  // Pack rocks where the procedural boulders sat (one spot moved out
  // of the Stargazing Pavilion's reach). Two more were nudged fully
  // clear of the lanes they grazed: [-5, 5.5] by the south-west lane
  // and [-12, 4] by the west lane.
  (
    [
      [24.6, 10.8],
      [-24.6, 7.6],
      [12.5, -28],
      [-26, 18.5],
      [28.2, 29.4],
    ] as [number, number][]
  ).forEach(([rx, rz], i) => {
    void placeWorld(rockPackUrl, { x: rx, z: rz, rotY: i * 0.9, width: 0.85 });
  });
  // Distance from a point to the nearest of the four paths (the paths run
  // north–south, east–west and along both diagonals, half-width 1.1).
  const pathDistance = (x: number, z: number) =>
    Math.min(streetDistance(x, z), Math.hypot(x, z) < 5.9 ? 0 : Infinity);
  // Building clearance for small plants: every footprint that a flower
  // or grass patch must stay out of (centre + radius incl. margin).
  const PLANT_CLEARANCE: [number, number, number][] = [
    ...PLACES.map((p) => [p.position[0], p.position[1], (p.buildingWidth ?? 7.6) / 2 + 1.15] as [number, number, number]),
    [COLOSSEUM.position[0], COLOSSEUM.position[1], 9.4],
    [31, -27, 6.6], // temple
    ...MARKET_BOOTHS.map(([x, z]) => [x, z, 2.3] as [number, number, number]),
    [VILLA.gate[0], VILLA.gate[1], 4.2], // triumphal arch
    [0, 0, 3.1], // the Town Tree mound
    [8.8, 4.6, 1.5], // the stone bench
    [VILLA.ionicColumn[0], VILLA.ionicColumn[1], 1], // the ionic column
    [LUCRETIA.position[0], LUCRETIA.position[1], 1.1], // Lucretia's plinth
    [ATHENA_TEMPLE.position[0], ATHENA_TEMPLE.position[1], 3.4], // Athena's temple
  ];
  const plantClear = (x: number, z: number) =>
    PLANT_CLEARANCE.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r);
  // The peristyle's four garden quarters, in pack flowers and grass
  // patches, mirrored across both axes; a spot is planted only when it
  // clears every path and every building. The planted spots are kept
  // for the bees and butterflies (Task 46).
  const peristyleFlowers: [number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const row = Math.floor(i / 4);
    const fx = (i % 2 ? 1 : -1) * (4.4 + (row % 3) * 2.8);
    const fz = (i % 4 > 1 ? 1 : -1) * (row < 3 ? 3.2 : 6.8);
    const angle = i * 0.9;
    if (pathDistance(fx, fz) < 1.8 || !plantClear(fx, fz)) continue;
    const flowerUrl = PACK_FLOWERS[i % PACK_FLOWERS.length]!;
    peristyleFlowers.push([fx, fz]);
    void placeWorld(flowerUrl, {
      x: fx,
      z: fz,
      rotY: i * 1.13,
      height: flowerUrl === flowerGroupUrl ? 0.5 : 0.62,
    });
    if (i % 3 === 0) {
      const gx = fx + Math.cos(angle + 0.5) * 0.85;
      const gz = fz + Math.sin(angle + 0.5) * 0.85;
      if (pathDistance(gx, gz) >= 1.6 && plantClear(gx, gz)) {
        void placeWorld(grassPatchUrl, { x: gx, z: gz, rotY: i * 0.7, width: 1.15 });
      }
    }
  }

  // Instanced grass tufts scattered over the lawn, hundreds of little
  // crossed blades that make the ground feel grown, not painted. Their
  // base transforms are kept so the wind can sway them blade by blade.
  const tuftData: { x: number; z: number; y: number; rotY: number; scale: number; sy: number; phase: number }[] = [];
  let tuftsMesh: THREE.InstancedMesh | null = null;
  let tuftsSettled = false;
  {
    const tuftCount = 420;
    const bladeGeo = new THREE.ConeGeometry(0.16, 0.42, 5);
    bladeGeo.translate(0, 0.21, 0);
    const tuftMat = applyWindToMaterial(
      new THREE.MeshStandardMaterial({ color: 0x5da34a, roughness: 0.95 }),
      "grass",
    );
    const tufts = new THREE.InstancedMesh(bladeGeo, tuftMat, tuftCount);
    const dummy = new THREE.Object3D();
    const tuftColor = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < tuftCount && guard++ < tuftCount * 12) {
      const a = Math.random() * Math.PI * 2;
      const r = 5.2 + Math.sqrt(Math.random()) * 40;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // Keep tufts off the paths and the peristyle.
      if (pathDistance(x, z) < 1.7) continue;
      // And out of the lake and off its bank ring.
      if (lakeNorm(x, z) < 1.3) continue;
      dummy.position.set(x, terrainHeight(x, z), z);
      dummy.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
      const sc = 0.7 + Math.random() * 0.9;
      const scY = sc * (0.8 + Math.random() * 0.7);
      dummy.scale.set(sc, scY, sc);
      dummy.updateMatrix();
      tufts.setMatrixAt(placed, dummy.matrix);
      tuftColor.setHex(0x5da34a).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.09);
      tufts.setColorAt(placed, tuftColor);
      tuftData.push({
        x,
        z,
        y: terrainHeight(x, z),
        rotY: dummy.rotation.y,
        scale: sc,
        sy: scY,
        phase: Math.random() * Math.PI * 2,
      });
      placed++;
    }
    tufts.count = placed;
    tufts.receiveShadow = true;
    world.add(tufts);
    tuftsMesh = tufts;
  }

  // Pack bushes softening the peristyle edges, set into the grass wedges
  // between the paths, clear of every building (nearest footprint, the
  // Recipe Kitchen, is over 5 away from the closest bush).
  const bushAt = (x: number, z: number, s: number, variant: number) => {
    void placeWorld(PACK_BUSHES[variant % PACK_BUSHES.length]!, {
      x,
      z,
      rotY: variant * 1.31,
      height: 0.95 * s,
    });
  };
  bushAt(7.9, -2.9, 1.0, 0);
  // This bush sat at (-7.9, 2.9) until the west lane was extended into
  // the peristyle disc, the joined lane's edge passed within a leaf of it,
  // so it stepped a pace north onto the verge.
  bushAt(-8.3, 3.4, 0.9, 1);
  bushAt(-7.9, -2.9, 0.85, 2);
  bushAt(7.9, 2.9, 0.8, 3);

  // Butterflies looping on lazy figure-eights, two over the
  // forum's flower ring, and now two more over the forest's
  // clearings, where the light gets in.
  const butterflies: {
    group: THREE.Group;
    wingL: THREE.Group;
    wingR: THREE.Group;
    phase: number;
    cx: number;
    cz: number;
    rx: number;
    rz: number;
    y0: number;
  }[] = [];
  {
    const wingGeo = new THREE.CircleGeometry(0.11, 8);
    const defs: { color: number; phase: number; cx: number; cz: number; rx: number; rz: number; y0: number }[] = [
      { color: 0xf2c14e, phase: 0, cx: 0, cz: 0, rx: 7.4, rz: 6.4, y0: 1.05 },
      { color: 0xd97bc4, phase: 2.4, cx: 0, cz: 0, rx: 7.4, rz: 6.4, y0: 1.05 },
      {
        color: 0xf2f0e6, phase: 1.2, cx: FOREST.glade[0], cz: FOREST.glade[1], rx: 2.8, rz: 2.4,
        y0: terrainHeight(FOREST.glade[0], FOREST.glade[1]) + 1.1,
      },
      {
        color: 0xe8a13a, phase: 3.9, cx: FOREST_SPOTS.spring[0], cz: FOREST_SPOTS.spring[1], rx: 2.2, rz: 1.9,
        y0: terrainHeight(FOREST_SPOTS.spring[0], FOREST_SPOTS.spring[1]) + 1.0,
      },
    ];
    for (const def of defs) {
      const bg = new THREE.Group();
      const wingMat = new THREE.MeshStandardMaterial({ color: def.color, side: THREE.DoubleSide, roughness: 0.6 });
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.x = -0.1;
      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.x = 0.1;
      const pivotL = new THREE.Group();
      pivotL.add(wingL);
      const pivotR = new THREE.Group();
      pivotR.add(wingR);
      bg.add(pivotL, pivotR);
      const bodyB = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mat(0x33302a));
      bodyB.scale.set(0.7, 0.7, 1.6);
      bg.add(bodyB);
      world.add(bg);
      butterflies.push({ group: bg, wingL: pivotL, wingR: pivotR, phase: def.phase, cx: def.cx, cz: def.cz, rx: def.rx, rz: def.rz, y0: def.y0 });
    }
  }

  // The town's small life (Task 46): bees working the Hortus beds and
  // the peristyle's flowers, butterflies over the forum and the open
  // lawns, crickets in the grass by the Atrium of Sounds (the jar's
  // evening crickets, out of the jar), by the stone bench and by their
  // own front door. Light shapes in a few instanced meshes; how many
  // show follows the quality tier.
  const critters = (() => {
    const nearestGrass = (cx: number, cz: number, n: number): XZ[] =>
      [...tuftData]
        .sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))
        .slice(0, n)
        .map((g) => [g.x, g.z] as const);
    const hortus: XZ[] = [
      ...GARDEN_BEDS.flatMap(([x, z]) => [[x - 0.45, z] as const, [x + 0.45, z] as const]),
      [9.8, 25.2],
      [13.4, 25.2],
    ];
    const westFlowers = peristyleFlowers.filter(([x]) => x < 0);
    const eastFlowers = peristyleFlowers.filter(([x]) => x >= 0);
    const lawns = ([[-27, -9], [27, 11], [-9, 31], [29, -11], [-30, 6]] as const)
      .filter(([x, z]) => pathDistance(x, z) > 2.6 && plantClear(x, z))
      .slice(0, 2);
    return createCritters(
      world,
      {
        beePatches: [hortus, westFlowers, eastFlowers].filter((p) => p.length > 1),
        butterflyPatches: [
          { centre: [0, 0], radius: 7.5, flowers: peristyleFlowers },
          ...lawns.map(([x, z]) => ({ centre: [x, z] as XZ, radius: 4.5, flowers: nearestGrass(x, z, 4) })),
        ],
        cricketGrass: [
          ...nearestGrass(-14, 0, 5),
          ...nearestGrass(8.8, 4.6, 3),
          ...nearestGrass(HOME.position[0] + HOME.halfW + 2, HOME.position[1], 4),
        ],
      },
      terrainHeight,
    );
  })();
  let critterHumSent = 0;
  let critterChirpSent = 0;
  let critterSound = { hum: 0, chirp: 0 };
  /** A night together (Task 45): the night is heard in the dark. */
  let nightHush = false;

  // The kitchen garden, east of the forecourt, mirroring the piscina
  // across the axis; what grows in its beds is pack flowers, not cones.
  GARDEN_BEDS.forEach(([bx, bz], bi) => {
    const bed = box(1.7, 0.3, 1.1, 0x7a5230, bx, terrainHeight(bx, bz) + 0.15, bz);
    world.add(bed);
    void placeModel(PACK_FLOWERS[(bi + 1) % PACK_FLOWERS.length]!, world, {
      x: bx,
      z: bz,
      y: terrainHeight(bx, bz) + 0.28,
      rotY: bi * 1.7,
      height: 0.55,
    });
  });

  // Collectible: the pointy hat, perched atop the ionic column by the peristyle.
  const hat = new THREE.Group();
  const hatCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x7a4fd0, emissive: 0x2c1660 }),
  );
  hatCone.position.y = 0.55;
  hatCone.castShadow = true;
  hat.add(hatCone);
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.07, 14),
    mat(0x5d3aa8),
  );
  brim.position.y = 0.05;
  hat.add(brim);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.44, 0.16, 12),
    mat(0xffd34e),
  );
  band.position.y = 0.18;
  hat.add(band);
  hat.position.set(VILLA.ionicColumn[0], terrainHeight(VILLA.ionicColumn[0], VILLA.ionicColumn[1]) + 3.34, VILLA.ionicColumn[1]);
  hat.traverse((o) => {
    o.userData.pick = { kind: "collectible", id: "pointy-hat" } satisfies { kind: PickKind; id: string };
  });
  world.add(hat);
  pickRoots.push(hat);

  // Collectible: the garden key, glinting beside the garden beds.
  const key = new THREE.Group();
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0x664d00, metalness: 0.85, roughness: 0.28 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), keyMat);
  ring.position.y = 0.3;
  key.add(ring);
  const shaft = box(0.09, 0.5, 0.09, 0xffc93c, 0.12, 0.05, 0);
  shaft.material = keyMat;
  key.add(shaft);
  const tooth = box(0.2, 0.09, 0.09, 0xffc93c, 0.2, -0.12, 0);
  tooth.material = keyMat;
  key.add(tooth);
  key.position.set(VILLA.gardenKey[0], terrainHeight(VILLA.gardenKey[0], VILLA.gardenKey[1]) + 0.25, VILLA.gardenKey[1]);
  key.rotation.z = 0.5;
  key.traverse((o) => {
    o.userData.pick = { kind: "collectible", id: "garden-key" } satisfies { kind: PickKind; id: string };
  });
  world.add(key);
  pickRoots.push(key);

  // The forum's history tablet (Task 37): a plain stone stele by the
  // Town Tree that opens Rome's real history of the forum, sourced, in
  // the history book. Its inscription is real history, not the town's
  // story, so it reads differently from the fragments on the statues.
  {
    const [hx, hz] = HISTORY_TABLET_FORUM;
    const stele = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.05, 0.16), mat(0xd9d0bd, { rough: 0.9 }));
    stone.position.y = 0.6;
    stone.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.24), mat(0xc4b89f, { rough: 0.9 }));
    cap.position.y = 1.17;
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.6), mat(0x6a5a44, { rough: 0.8 }));
    plaque.position.set(0, 0.66, 0.081);
    stele.add(stone, cap, plaque);
    stele.position.set(hx, terrainHeight(hx, hz), hz);
    stele.rotation.y = Math.atan2(-hx, -hz) + Math.PI;
    stele.traverse((o) => {
      o.userData.pick = { kind: "history", id: "forum" } satisfies { kind: PickKind; id: string };
    });
    world.add(stele);
    pickRoots.push(stele);
  }

  // Lucretia (Task 54) in the forum garden's west quarter, facing the
  // evening, a rose at her feet; Athena's temple (Task 55) just down
  // the way, across the west lane, facing back toward her, olive trees
  // at its steps. Each opens its sourced page, its inscription first.
  for (const [id, built] of [
    ["lucretia", buildLucretia(terrainHeight(LUCRETIA.position[0], LUCRETIA.position[1]))],
    ["athena", buildAthenaTemple(terrainHeight(ATHENA_TEMPLE.position[0], ATHENA_TEMPLE.position[1]))],
  ] as const) {
    built.group.traverse((o) => {
      o.userData.pick = { kind: "history", id } satisfies { kind: PickKind; id: string };
    });
    world.add(built.group);
    pickRoots.push(built.group);
  }
  for (const [ox, oz] of ATHENA_TEMPLE.olives) void placeWorld(oliveUrl, { x: ox, z: oz, rotY: ox * 1.7 + oz, width: 2.6 });

  // --- Walk-around avatar: YOU (the player) ---
  // The visitor's Centurion VRM: legs and arms swung from the model's
  // own bones while walking, and a salute when you reach Muse.
  const avatar = new THREE.Group();
  const playerInner = new THREE.Group();
  avatar.add(playerInner);
  let playerWaveStart = -100;
  // the owner's body in walk mode is the Centurion VRM he made in VRoid
  // Studio, crested helmet, armour, and a walk cycle swung from the
  // VRM's own leg and arm bones. He keeps his spawn on the peristyle,
  // and his greeting salute when he reaches Muse.
  let playerRig: VrmRig | null = null;
  // Gaius's arms: the gladius at his right hip, the scutum on his back (gaiusArms.ts).
  const gaiusArms = createGaiusArms({ frame: avatar, place: placeModel, gladiusUrl, shieldUrl: shieldLegionaireUrl });
  const attachGaiusArms = (model: THREE.Object3D) => gaiusArms.attach(model);
  /** Task 47: the shield is stowed on every load until he brings it out. */
  let shieldOut = false;
  /** The gladius is worn at his hip until he stows it (LT). */
  let swordWorn = true;
  let playerAnim: CharAnimator | null = null;
  let playerBlink: { mesh: THREE.Mesh; index: number }[] = [];
  // Reveal gate (same shape as Muse's): his body stays hidden until
  // the frame loop can show it already animated, see
  // tryRevealChars in driveClipAnims.
  let playerBody: THREE.Object3D | null = null;
  let playerAttachedAt = 0;
  let playerRevealed = false;
  const playerPose = { legL: 0, legR: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, footYaw: 0, elbowL: -0.18, elbowR: 0.18, headYaw: 0, sway: 0 };
  const attachCenturion = (attempt: number) => {
    loadModelScene(centurionUrl)
      .then((source) => {
        if (disposed) return null;
        const model = cloneSkeleton(source);
        resources.adopt(model);
        downscaleModelTextures(model);
        litVrmMaterials(model, PLAYER_TINTS);
        prepareVrm(model);
        const body = groundModel(model, { height: 1.94 });
        // Hidden on arrival (the reveal gate): a fresh VRM stands
        // in its bind pose, arms straight out, and the clip bake
        // poses it around while the FBX files download; none of
        // that may ever paint. The frame loop reveals the body only
        // once its idle clip is primed and applied, or, if the
        // clips failed their gate, once procedural posing owns it
        // (the 6 s safety in tryRevealChars means a slow or failed
        // bake can never leave him invisible for the visit, the
        // failure this comment used to guard against by forcing the
        // model visible here, bind pose and all). The avatar GROUP
        // flags are still asserted exactly as before: walk mode can
        // start before this model arrives, and the group's
        // visibility must survive the hand-off. (His spawn height
        // and the follow camera both come from walkPos every frame
        // in updateWalk, standing him on the terrain at the peristyle.)
        body.visible = false;
        playerInner.add(body);
        playerBody = body;
        playerAttachedAt = performance.now();
        playerRevealed = false;
        playerInner.visible = true;
        if (walking) avatar.visible = true;
        playerBlink = collectBlinkMorphs(model);
        playerRig = collectRig(model);
        attachGaiusArms(model);
        // His real motion clips, same arrangement as Muse's. If
        // they fail their gate he simply keeps the procedural
        // posing below, this model renders either way. Like hers,
        // his clips load whatever the reduced-motion preference
        // says (see her note above).
        playerAnim = createCharAnimator({
          resources,
          isBusy: () => isMoving,
          model,
          urls: {
            idle: mIdleUrl, walk: mWalkUrl, run: mRunUrl, wave: mWaveUrl, sit: mSitUrl, dance: mDanceUrl,
            jump: { start: mJumpStartUrl, air: mJumpAirUrl, end: mJumpEndUrl },
            slide: mSlideUrl,
            outdoor: {
              talk: [mTalk1Url, mTalk2Url, mTalk3Url],
              sitTalk: [mSitTalk1Url, mSitTalk2Url],
              benchSit: [mBench1Url, mBench2Url],
              flirt: mFlirtUrl,
              hug: mHugUrl,
            },
          },
        });
        poseBone(playerRig, playerRig.lUpperArm, 0, 0, -1.22);
        poseBone(playerRig, playerRig.rUpperArm, 0, 0, 1.22);
        poseBone(playerRig, playerRig.lLowerArm, 0, 0, -0.18);
        poseBone(playerRig, playerRig.rLowerArm, 0, 0, 0.18);
      })
      .catch(() => {
        // One silent retry on a fresh fetch: a transient network or
        // memory hiccup on the phone must not cost him his body for
        // the whole visit. The failed promise is evicted from the
        // model cache first, or the retry would re-serve it.
        if (!disposed && attempt < 1) {
          modelCache.delete(centurionUrl);
          attachCenturion(attempt + 1);
          return;
        }
        /* after that, leave him unrendered rather than crash the scene */
      });
  };
  attachCenturion(0);
  // the owner's umbrella, teal to match his tee.
  {
    const playerUmbrella = makeUmbrella(0xa03d2d);
    playerUmbrella.position.set(0.16, 2.3, 0.03);
    playerUmbrella.rotation.z = -0.1;
    playerInner.add(playerUmbrella);
    umbrellas.push(playerUmbrella);
    playerUmbrellaRef = playerUmbrella;
  }
  avatar.position.set(PLAYER.spawn[0], 0, PLAYER.spawn[1]);
  const playerBubble = makeBubble(avatar, 3.1, BUBBLE_SPEAKERS.player);
  bubbles.push(playerBubble);
  avatar.visible = false;
  world.add(avatar);

  // Collision obstacles: shapes the walker cannot pass through.
  // Round props (the town tree, columns, lamps, statues, trees) keep
  // circle footprints. BUILDINGS get oriented box (OBB) footprints
  // measured from the actual pack models at GROUND level (see
  // BUILDING_GROUND below): groundModel scales each model so its GLB
  // bounding-box width equals the placed width, but the box is set
  // by the roof on several models, so first-pass OBBs from the full
  // box (villa_stories 1.434, house_sounds 0.992, house_garden 0.921,
  // insulae_recipes 0.794, senate 0.709, annex_sidechat 1.192, temple
  // 2.346, bbox depth ratios) stood off the ground walls by up to
  // half a unit of open air. The old centre circles before even that
  // (r ≈ 3 for a house 7.6 wide and over 10 deep) left the corners
  // and most of the walls walk-through. Two round buildings stay
  // circles because they ARE round: the Colosseum (a cylinder mesh,
  // radius = half its placed width) and the Stargazing Pavilion (a
  // round open pavilion). The Colosseum is a solid ring mesh with
  // no walk-in interior in this town, it is visited from outside,
  // so it is blocked whole.
  //
  // `pad` caps the clearance a character keeps from a shape, thin
  // props (lamp posts, columns, stall poles) get a small pad so
  // characters SLIDE around them instead of pinning head-on; a pole's
  // exclusion used to meet the market booth's and wedge the pair
  // face-to-face across it. Booth boxes are sized to the stall body
  // (not its awning), which keeps a clear walkable gap between each
  // booth and the peristyle lamps.
  //
  // Doorsteps stay usable: each house OBB is pulled back from the
  // front face by a doorstep inset (0.9, the basilica 1.5 for its
  // grand steps), leaving the threshold/apron band in front of every
  // entrance standable, and place prompts measure distance to the
  // footprint's SURFACE (see updateWalk), so every "A, …" prompt
  // still fires standing outside the wall, exactly as it did when
  // the trigger was a centre radius the walls now exceed.

  // Per-place building footprints, keyed by place id so the prompt
  // system can measure surface distance to the same shapes that
  // block movement. A house's building sits at local (0, -0.3) in a
  // group turned to its place.facing (exactly
  // the house group's own rotation), so the OBB shares that frame.
  //
  // The extents are the buildings' GROUND-LEVEL footprints, measured
  // from the shipped GLBs (the lowest band of each model: its walls
  // and foundation where they meet the earth), NOT the full bounding
  // box. The full box is set by the ROOF on several models, the
  // Garden House's roof is a full unit wider than its ground walls,
  // the Sounds atrium carries an overhanging upper storey at the
  // front, so the old bbox OBBs stood off the real walls by up to
  // half a unit of open air: invisible walls ringing the houses.
  // Each entry: gw/gd = ground width/depth as a fraction of the
  // placed width (groundModel scales by bbox width), ox/oz = the
  // ground footprint's centre offset from the bbox centre, same
  // fraction (several ground plans sit off-centre under their roofs).
  const placeFootprints = createPlaceFootprints(PLACES);
  // The temple: a long rectangular temple (11 wide × ~25.8 deep as
  // placed, rotY -0.6 to match placeWorld), an OBB, not the old
  // r 4.6 circle that covered barely a third of it. Sized to its
  // measured ground plan (10.53 wide at ground, not the roof's 11).
  const templeFootprint = obb(31, -27, 5.27, 12.86, -0.6);

  // Pack-tree trunks: groundModel centres each tree by its CANOPY's
  // bounding box, so the trunk does not stand at the placement point
  //, measured from the shipped GLBs (ground-band centre minus bbox
  // centre, model units), a trunk can stand ~0.6 units away from the
  // spot its collider used to guard, and the trunks are thin (ground
  // radius ≈ 0.1–0.2). The old r 0.95 circles at the placement points
  // were rings of open air that blocked the lawns beside each tree
  // while the trunk itself stood outside them. These colliders sit
  // on the real trunks (same rotY the placement uses: i * 1.37).
  const PACK_TRUNK: { off: [number, number]; sizeY: number }[] = [
    { off: [28.98, -47.91], sizeY: 581.94 }, // tree_a
    { off: [-111.62, 40.04], sizeY: 693.31 }, // tree_b
    { off: [124.56, 12.87], sizeY: 782.68 }, // tree_c
    { off: [0.43, 35.78], sizeY: 1040.17 }, // tree_d
  ];
  const packTreeColliders: Obstacle[] = treeSpots.map(([tx, tz, ts], i) => {
    const spec = PACK_TRUNK[i % PACK_TRUNK.length]!;
    const sc = (3.7 * ts) / spec.sizeY;
    const rot = i * 1.37;
    const ox = spec.off[0] * sc;
    const oz = spec.off[1] * sc;
    return treePlacement.bindCollider(circ(tx + ox * Math.cos(rot) + oz * Math.sin(rot), tz - ox * Math.sin(rot) + oz * Math.cos(rot), 0.32), tx, tz);
  });

  // Flat furniture gets flat footprints: the old centre circles
  // around the boards, obelisk, and desk blocked up to 0.8 units of
  // open ground in front of objects only ~0.1–0.7 deep. Each OBB
  // shares its group's own frame (rotY = atan2(-x, -z), as placed).
  const boardObb = obb(BOARD_SPOT.position[0], BOARD_SPOT.position[1], 1.05, 0.32, Math.atan2(-BOARD_SPOT.position[0], -BOARD_SPOT.position[1]));
  const questObb = obb(QUEST_BOARD_SPOT.position[0], QUEST_BOARD_SPOT.position[1], 0.9, 0.3, Math.atan2(-QUEST_BOARD_SPOT.position[0], -QUEST_BOARD_SPOT.position[1]));
  const goalsObb = obb(GOALS_SPOT.position[0], GOALS_SPOT.position[1], 0.58, 0.58, Math.atan2(-GOALS_SPOT.position[0], -GOALS_SPOT.position[1]));
  const deskObb = obb(LETTER_DESK_SPOT.position[0], LETTER_DESK_SPOT.position[1], 0.58, 0.35, Math.atan2(-LETTER_DESK_SPOT.position[0], -LETTER_DESK_SPOT.position[1]));
  const bedObb = obb(BED_SPOT.position[0], BED_SPOT.position[1], 0.62, 1.12, Math.atan2(-BED_SPOT.position[0], -BED_SPOT.position[1]));

  // Every collider below was audited against the visible geometry
  // (Oct 31 collision audit): each shape sits on a real object, at
  // that object's ground-level size. The audit's casualties: the two
  // old aqueduct circles stood in open ground metres from any leg
  // (the arcade's four real legs had none), the connector's two
  // circles sat mid-span between its four posts, the pack trees were
  // guarded at their canopy centres instead of their trunks, and
  // several props (rocks, statue, columns, lamps, cypresses) carried
  // circles up to twice their visible size.
  const obstacles: Obstacle[] = [
    ...pavilionColliders, // the lake pavilion's four columns
    ...piscinaColliders, // the piscina's water basin, the rim stays walkable, the water does not
    ...bathColliders, // the thermae: walls, caldarium water, columns
    ...homeHouse.colliders, // their house (Task 35): walls either side of the door, the bed, the lamp table
    circ(0, 0, 2.45), // town tree: the stone ring around its mound (stones reach r ≈ 2.54; the trunk alone is ≤ 0.9)
    { kind: "circle", x: MUSE.position[0], z: MUSE.position[1], r: 0.55, ghost: true }, // Muse's home spot: never blocks; her live body does (checked separately)
    obb(8.8, 4.6, 0.95, 0.3, Math.PI / 2), // stone bench, in the peristyle garden
    obb(8.8, -5.2, 1.05, 0.5, 0), // the table in the peristyle's east bay
    templeFootprint, // temple
    circ(VILLA.statueMars[0], VILLA.statueMars[1], 0.5), // statue of Mars (its pedestal, measured)
    circ(LUCRETIA.position[0], LUCRETIA.position[1], LUCRETIA.plinthHalf + 0.12), // Lucretia's plinth (Task 54)
    obb(ATHENA_TEMPLE.position[0] + ATHENA_TEMPLE.stepDepth / 2, ATHENA_TEMPLE.position[1], ATHENA_TEMPLE.halfX + ATHENA_TEMPLE.stepDepth / 2, ATHENA_TEMPLE.halfZ, 0), // Athena's temple, podium and step (Task 55)
    ...ATHENA_TEMPLE.olives.map(([x, z]) => circ(x, z, 0.3)), // its olive trees (trunks)
    obb(VILLA.gate[0] + 2.55, VILLA.gate[1], 1.25, 1.8, 0), // triumphal arch, east pillar (the opening between the pillars stays walkable)
    obb(VILLA.gate[0] - 2.55, VILLA.gate[1], 1.25, 1.8, 0), // triumphal arch, west pillar
    circ(-36.1, 4.2, 0.85), // ballista (its ground frame, measured, offset from its placement centre)
    ...MARKET_BOOTHS.map(([x, z, rot]) => obb(x, z, 1.73, 0.86, rot)), // market booths (ground plan, measured)
    ...VILLA_WALLS.map(([x, z, hx, hz]) => obb(x, z, hx, hz, 0)), // terrace walls and the stair's balustrades
    ...AVENUE_CYPRESSES.map(([x, z]) => circ(x, z, 0.3, 0.15)),
    circ(COLOSSEUM.position[0], COLOSSEUM.position[1], 8), // the Colosseum, solid ring, blocked whole (placed width 16 → r 8)
    boardObb, // project board
    questObb, // quest board
    goalsObb, // goals obelisk (its square base)
    deskObb, // letters desk
    bedObb, // the basilica bed nook, its frame, in its own frame
    // The aqueduct's four legs, where the model's ground band
    // actually meets the earth (measured in its placed frame).
    circ(-19.2, -28.1, 0.85),
    circ(-21.8, -25.3, 0.85),
    circ(-24.6, -22.1, 0.85),
    circ(-27.3, -19, 0.85),
    // The aqueduct connector's four posts (measured, same way).
    circ(-37.4, -21.5, 0.7),
    circ(-30, -19.5, 0.7),
    circ(-39.9, -12.4, 0.7),
    circ(-32.6, -10.5, 0.7),
    treePlacement.bindCollider(circ(31.5, 33, 0.42, 0.15), 31.5, 33), treePlacement.bindCollider(circ(-27.2, 30.6, 0.42, 0.15), -27.2, 30.6), treePlacement.bindCollider(circ(34, -10.2, 0.42, 0.15), 34, -10.2), treePlacement.bindCollider(circ(-39.1, -22.1, 0.42, 0.15), -39.1, -22.1), // cypresses (their foliage columns)
    treePlacement.bindCollider(circ(-23, 34.26, 0.35), -23, 34), // the olive on the south lawn (trunk, offset from its canopy centre as placed), it had no collider at all
    treePlacement.bindCollider(circ(-40, 10, 0.3), -40, 10), // the tall conifer on the west lawn, likewise uncollided until now
    circ(VILLA.ionicColumn[0], VILLA.ionicColumn[1], 0.38, 0.18), // ionic column with the pointy hat (its base, measured)
    ...ROMAN_COLUMN_SPOTS.map(([x, z]) => circ(x, z, 0.35, 0.18)),
    ...placeFootprints.values(),
    ...lampPositions.map(([x, z]) => circ(x, z, 0.3, 0.14)),
    ...packTreeColliders,
    // The forest's stand: every scattered trunk (the stand is data
    // in town.ts, so colliders and visuals cannot drift apart),
    // plus its landmarks, shrine stone, hollow oak, the spring
    // (nobody wades), and Lupa's den rocks.
    ...FOREST_TREES.map((t) => circ(t.x, t.z, 0.34)),
    circ(FOREST_SPOTS.shrine[0], FOREST_SPOTS.shrine[1], 0.62),
    circ(FOREST_SPOTS.hollow[0], FOREST_SPOTS.hollow[1], 0.85),
    circ(FOREST_SPOTS.spring[0], FOREST_SPOTS.spring[1], 1.55),
    ...FOREST_DEN_ROCKS.map(([x, z, r]) => circ(x, z, r)),
    ...pineSpots.map(([x, z]) => treePlacement.bindCollider(circ(x, z, 0.3), x, z)),
    circ(24.6, 10.8, 0.45), // pack rocks (placed 0.85 wide)
    circ(-24.6, 7.6, 0.45),
    circ(12.5, -28, 0.45),
    circ(-26, 18.5, 0.45),
    circ(28.2, 29.4, 0.45),
    // The lake's willows (trunks, at their planted spots) and its
    // two shore rocks. The water itself is fenced in resolveCollisions.
    circ(-21.6, -27.4, 0.34),
    circ(-15.2, -24.6, 0.34),
    circ(-13.6, -37.2, 0.34),
    circ(-21.2, -35.2, 0.34),
    circ(-10.9, -28.4, 0.4),
    circ(-20.4, -31.8, 0.45),
    ...GARDEN_BEDS.map(([x, z]) => obb(x, z, 0.85, 0.55, 0)), // the kitchen garden's beds
  ];

  /** The lake: nobody wades. On-foot movers are pushed back to the
   *  water's edge (an ellipse push-out, so pressure slides along the
   *  shore), except on the dock's planks, the one dry crossing. The
   *  boat never comes through here: it runs its own shoreline
   *  constraint in the rowing code. */
  function fenceLake(x: number, z: number, defAdd: number): { x: number; z: number } {
    if (onDock(x, z)) return { x, z };
    const ldx = (x - LAKE_CX) / (LAKE.rx + defAdd);
    const ldz = (z - LAKE_CZ) / (LAKE.rz + defAdd);
    const ln = Math.hypot(ldx, ldz);
    if (ln < 1 && ln > 0.0001) {
      return { x: LAKE_CX + (ldx / ln) * (LAKE.rx + defAdd), z: LAKE_CZ + (ldz / ln) * (LAKE.rz + defAdd) };
    }
    return { x, z };
  }
  function resolveCollisions(x: number, z: number, defAdd: number, body?: LiveBody): { x: number; z: number } {
    return resolveAgainst(obstacles, x, z, defAdd, body, (fx, fz) => fenceLake(fx, fz, defAdd));
  }

  /** Distance from a point to the nearest obstacle's surface (0 or
   *  negative when inside one), plus that obstacle's outward surface
   *  normal, the steering/blocking queries shared by the prompts,
   *  Muse's detour steering, and the unstuck checks. */
  function nearestObstacleSurface(x: number, z: number): { dist: number; nx: number; nz: number } {
    let best = { dist: Infinity, nx: 1, nz: 0 };
    for (const ob of obstacles) {
      if (ob.ghost) continue;
      if (ob.kind === "circle") {
        const dx = x - ob.x;
        const dz = z - ob.z;
        const d = Math.hypot(dx, dz);
        const dist = d - ob.r;
        if (dist < best.dist) {
          best = d > 0.0001 ? { dist, nx: dx / d, nz: dz / d } : { dist, nx: 1, nz: 0 };
        }
        continue;
      }
      const { lx, lz } = obbLocal(ob, x, z);
      const qx = THREE.MathUtils.clamp(lx, -ob.halfW, ob.halfW);
      const qz = THREE.MathUtils.clamp(lz, -ob.halfD, ob.halfD);
      if (qx !== lx || qz !== lz) {
        const ddx = lx - qx;
        const ddz = lz - qz;
        const d = Math.hypot(ddx, ddz);
        if (d < best.dist && d > 0.0001) {
          const n = obbWorld(ob, ddx / d, ddz / d);
          best = { dist: d, nx: n.x - ob.x, nz: n.z - ob.z };
        }
      } else {
        const penX = ob.halfW - Math.abs(lx);
        const penZ = ob.halfD - Math.abs(lz);
        const dist = -Math.min(penX, penZ);
        if (dist < best.dist) {
          const nl = penX < penZ ? { x: lx >= 0 ? 1 : -1, z: 0 } : { x: 0, z: lz >= 0 ? 1 : -1 };
          const n = obbWorld(ob, nl.x, nl.z);
          best = { dist, nx: n.x - ob.x, nz: n.z - ob.z };
        }
      }
    }
    return best;
  }

  /** Surface distance to one specific footprint (prompts for places). */
  function footprintSurfaceDistance(ob: Obstacle, x: number, z: number): number {
    if (ob.kind === "circle") return Math.hypot(x - ob.x, z - ob.z) - ob.r;
    const { lx, lz } = obbLocal(ob, x, z);
    const qx = THREE.MathUtils.clamp(lx, -ob.halfW, ob.halfW);
    const qz = THREE.MathUtils.clamp(lz, -ob.halfD, ob.halfD);
    if (qx !== lx || qz !== lz) return Math.hypot(lx - qx, lz - qz);
    return -Math.min(ob.halfW - Math.abs(lx), ob.halfD - Math.abs(lz));
  }

  /** Entry distance of a ray into an obstacle expanded by `expand`,
   *  or Infinity when it misses, the follow camera's boom test, so
   *  buildings shorten the boom exactly as the old circles did. */
  function rayObstacleEntry(ox: number, oz: number, dx: number, dz: number, ob: Obstacle, expand: number): number {
    if (ob.kind === "circle") {
      if (ob.r < 0.8) return Infinity; // structures only; thin props never move the camera
      const relX = ob.x - ox;
      const relZ = ob.z - oz;
      const along = relX * dx + relZ * dz;
      if (along <= 0.5) return Infinity;
      const rr = ob.r + expand;
      const perp2 = relX * relX + relZ * relZ - along * along;
      if (perp2 >= rr * rr) return Infinity;
      const hit = along - Math.sqrt(rr * rr - perp2);
      return hit > 0.5 ? hit : Infinity;
    }
    // OBB: slab test in the box's local frame, box grown by `expand`.
    const o = obbLocal(ob, ox, oz);
    const c = Math.cos(ob.rot);
    const s = Math.sin(ob.rot);
    const ldx = dx * c - dz * s;
    const ldz = dx * s + dz * c;
    let tEnter = -Infinity;
    let tExit = Infinity;
    for (const [lo, ld, half] of [[o.lx, ldx, ob.halfW + expand], [o.lz, ldz, ob.halfD + expand]] as [number, number, number][]) {
      if (Math.abs(ld) < 1e-6) {
        if (Math.abs(lo) > half) return Infinity;
      } else {
        let t1 = (-half - lo) / ld;
        let t2 = (half - lo) / ld;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tEnter = Math.max(tEnter, t1);
        tExit = Math.min(tExit, t2);
      }
    }
    if (tExit < 0 || tEnter > tExit) return Infinity;
    return tEnter > 0.5 ? tEnter : Infinity;
  }

  let walking = false;
  let walkHeading = Math.atan2(-PLAYER.spawn[0], -PLAYER.spawn[1]); // face the town tree from spawn
  const walkPos = new THREE.Vector3(PLAYER.spawn[0], 0, PLAYER.spawn[1]);
  // Unstuck bookkeeping for the walker: accumulated push-without-moving
  // time, and an in-progress sidestep (direction + end time).
  let playerStuckTime = 0;
  const playerSidestep = { x: 0, z: 0, until: -1 };
  // Her forest-edge line: at most once in a long while, only when
  // he pushes the thicket rim with her beside him.
  let lastForestEdgeAt = -1000;
  let edgeLineFlip = 0;
  let savedCamPos: THREE.Vector3 | null = null;
  let savedCamTarget: THREE.Vector3 | null = null;
  const keysDown = new Set<string>();
  let padX = 0;
  let padY = 0;
  // Walk-mode camera orbit: dragging on the open view (anywhere that is
  // not a control) swings the follow camera around the walker, like the
  // default view's orbit drag. The drag writes the camera yaw directly.
  let camPitchOffset = 0;
  // Looking up (Task 31): past CAM_LOOK_UP_FROM the camera stays at its
  // lowest and the point it looks at rises into the sky instead, so a
  // full drag up looks nearly straight up (the pavilion's stars, the
  // moon), and the view holds there until he drags back or recenters.
  const CAM_PITCH_MIN = -3.0;
  const CAM_LOOK_UP_FROM = -1.1;
  const CAM_PITCH_MAX = 2.6;
  const CAM_LOOK_UP_HEIGHT = 42;
  let walkDrag: { x: number; y: number } | null = null;
  // The pad's right stick (owner's ask, Nov 6, 2026): a held vector
  // that orbits the follow camera at these rates at full tilt, and R3's
  // recenter, a short ease back to the default view (seconds left).
  const PAD_ORBIT_YAW_RATE = 2.4;
  const PAD_ORBIT_PITCH_RATE = 1.8;
  let padOrbitX = 0;
  let padOrbitY = 0;
  let camRecenter = 0;
  // The follow camera's yaw belongs to the PLAYER: their drag writes
  // it directly, and it is set once from his heading when walk mode
  // starts. On top of that sits the loose follow (Nov 2, owner's
  // design; the math lives in followCam.ts): after he has been
  // genuinely underway on a sustained walk, the yaw eases gradually
  // toward his heading, inside a dead zone, at a capped rate. It
  // never runs while he stands still, while a drag is in progress or
  // just ended, or while a panel or conversation owns the screen.
  //
  // Why this cannot recreate the old spinning circle: the previous
  // scheme chased (heading + a leftover drag offset) and the offset
  // never closed, so a held stick curved him forever. Here the chase
  // target is his heading itself, and movement input is NOT read
  // against this live yaw while he walks: it is read against
  // inputYawRef, a reference yaw that only moves when the player
  // drags or when he is standing still (see the movement block). The
  // automatic recenter can therefore rotate the view under a held
  // stick without rotating his direction of travel by one degree: a
  // held direction still runs straight, indefinitely.
  // (Pitch and boom length still smooth: they translate the camera
  // along its own line, never rotate its yaw, and neither feeds back
  // into movement.)
  let camYawSmooth = Math.atan2(-PLAYER.spawn[0], -PLAYER.spawn[1]);
  // The reference yaw movement input is read against while walking.
  let inputYawRef = camYawSmooth;
  // Loose follow state: the sustained-walk clock, the frame time of
  // the last drag activity, the shell's camera hold, and the last
  // position the follow block measured (for genuine displacement).
  let followSustain = 0;
  let lastDragT = -1000;
  let camHold = false;
  let camPrevX = PLAYER.spawn[0];
  let camPrevZ = PLAYER.spawn[1];
  let camPitchSmooth = 0;
  let camDistSmooth = 10.5;
  let isMoving = false;
  // The last frame he was truly on the move, kept for the slide's
  // latch (see slide.ts): a B press lands in the same gesture that
  // lets the stick go, so the press a breath after the stick centres
  // still has to mean slide.
  let lastMovingAt = -Infinity;
  const hop = newJump();
  const run = newSlide();
  let stepTally = 0;
  let stepX = Number.NaN;
  let stepZ = Number.NaN;
  let stepSounds = true;
  let lastFlourishAt = -1000;
  let hopLandedAt = -Infinity;
  // The stick's direction and tilt, eased a touch so a fresh push or a
  // flick across builds in about 50 ms instead of arriving in one frame.
  let wishX = 0;
  let wishZ = 0;
  // Where the camera is looking from. It trails him slightly, so what a
  // brush against a rock does to his path isn't done to the whole screen.
  let camFollowX = Number.NaN;
  let camFollowZ = Number.NaN;
  let viewAspect = 1;
  let isLandscapeView = false;
  // The standard walk-camera framing (Task 39, Nov 8, 2026): a standard
  // third-person view, as a console game sets it, about 4 m behind
  // Gaius at roughly eye height, so he fills the lower frame and Aelia
  // beside him reads as a person standing with him, with the street,
  // the lake and the sky ahead. (It was a town view, 10 to 11.5 m back
  // and 3.6 to 4.2 m up.) Pinch and wheel zoom still pull back to a
  // wide town view or in close; drag, look-up and double-tap recenter
  // all work from here. Portrait rides a touch higher and further, to
  // keep the same ground in its narrower frame.
  const walkCamFraming = () => ({
    dist: isLandscapeView ? 4.0 : viewAspect < 0.8 ? 4.5 : 4.2,
    height: isLandscapeView ? 1.85 : 2.0,
  });
  // Pinch / wheel zoom (Nov 1): the visitor's own multiplier on the
  // standard framing distance, two fingers (or the desktop wheel)
  // dolly the follow camera between standing-close beside Aelia
  // and taking in a whole plaza. The boom collision and the dist
  // smoothing below work on this resting distance unchanged, so
  // zooming eases exactly like the camera's other moves. Session
  // only: the level lives in this variable, so it holds across
  // every camera move of the visit and resets on a fresh load.
  // (The overview's distance is OrbitControls' own dolly, with its
  // own 7–78 clamps, the same gesture, the same feel.)
  let userZoom = 1;
  // From close beside her (about 2.2 m) out to a wide town view (about 28 m).
  const ZOOM_MIN = 0.55;
  const ZOOM_MAX = 7;
  const walkRestDist = () => THREE.MathUtils.clamp(walkCamFraming().dist * userZoom, 2.2, 30);
  const nearCollectibles = new Set<string>();
  // The last nearby prompt target reported to the shell ("kind:id", or
  // "" when none), prompts are reported on change only, never per frame.
  let lastNearKey = "";

  // --- Companion follow mode ------------------------------------------------
  // When follow mode is on, Muse leaves her plaza spot and walks with the
  // Centurion at a comfortable beside/behind offset. She follows the
  // player's trail (so she naturally prefers the paths he took), eases to
  // a stop when he stops, faces him while he reads panels, and, when
  // follow mode ends or walk mode exits, walks herself back to her spot.
  // Walk-together is the startup default: she begins as his
  // companion (the shell also asserts setFollowMode(true) the moment
  // the scene exists), so she counts as following from frame one,
  // no greeting wave on load, ever.
  let followMode = true;
  let museReturning = false;
  // Follow settle state (Nov 1, orbit fix). Her follow target is
  // computed from the Centurion's heading, so while he turns in
  // place the target sweeps around him on its offset circle and
  // she ran rings chasing it, the reported "she runs in circles
  // around me while I'm standing still". The cure: while he has
  // been still for more than a moment, her target FREEZES at the
  // last computed spot, and once she arrives there she SETTLES,
  // steering stands down entirely until he moves again. Resuming
  // is just the freeze lifting; her near-target pace also eases
  // with distance while he is still (see updateMuseCompanion), so
  // the last approach glides in instead of overshooting into an
  // orbit. Hand-in-hand shares this whole path (only its offsets
  // differ), and her routine anchors already settle the same way
  // (a static target plus the routineArrivedAt latch).
  let playerStillTime = 0;
  let followFrozenTarget: { x: number; z: number } | null = null;
  let followSettled = false;
  // "Still" is measured by his GROUND SPEED, not his input: a man
  // turning in place, or pushing against a wall, gives no movement
  // input worth following, his heading still sweeps her offset
  // around him, which is exactly the orbit being cured. The follow
  // block below refreshes this every frame from his displacement.
  let followPlayerMoving = true;
  let followPrevX = 0;
  // Smoothed ground heights for the two walkers (feet-on-stone fix):
  // groundHeightAt steps up 0.14/0.35/0.51 at platform edges, and a
  // raw assignment would pop the whole step in one frame. Each
  // walker's rendered Y steps toward the true ground at at most
  // 5 m/s, a 0.35 platform edge takes ~0.07 s, a brisk step-up
  // rather than a pop or a sink, and snaps only across gaps over
  // 1.1 m (teleports, stepping ashore), where easing would look
  // like floating.
  let playerGroundSm = Number.NaN;
  let museGroundSm = Number.NaN;
  let followPrevZ = 0;
  // Affection behaviour (see setAffectionRank): her earned heart rank
  // and the hand-in-hand closeness it unlocks. Behaviour only.
  let affectionRank = 0;
  // The Night the Stars Fall: the shell owns the saved-data side of
  // the gate and tonight's meteor seeding; the scene owns the rest
  // (night, the pavilion, her company) and the sky itself.
  let summitReady = false;
  let summitDone = false;
  let summitMeteor = false;
  let handInHand = false;
  let flirtLift = 0;
  // Hand-in-hand wandering machinery: the joined-hands pose blend
  // (eased so hands meet and part gently, never snap), and the
  // hurry clock, push the stick hard for several seconds despite
  // the stroll cap and she lets go, once, amused.
  let handBlend = 0;
  let handHurryTime = 0;
  let lastWanderLineAt = -1000;
  let lastInitiateAt = -1000;
  let initiateTarget: { x: number; z: number } | null = null;
  let initiateUntil = -1;
  // Seeking (continuity): once per session at most, if he has
  // wandered in walk mode for a long while without ever coming
  // near her, she walks out to find him, the initiate errand
  // machinery, walked all the way to him, with her own greeting.
  // Focus sittings hush the town's chatter (companion + routine
  // lines, and seeking) while he works beside her.
  let quietMode = false;
  // Hide-and-seek: while true, Aelia is concealed at her spot.
  let museHidden = false;
  let seekDone = false;
  let seekActive = false;
  let seekWalkStartT = -1;
  let seekClosest = Infinity;
  // --- Greeting wave: once per genuine meeting -------------------------
  // The paired HandWave greeting is a hello, not a proximity loop: it
  // fires ONCE when the Centurion comes into greeting range, and it
  // cannot fire again until the pair have genuinely parted, beyond
  // GREET_PART_DIST continuously for GREET_REARM_SECS, which re-arms
  // it. Small in-and-out steps across the greeting edge while they
  // stay together never re-fire it. Follow mode suppresses it
  // entirely: while she is walking with him there is no greeting,
  // however they stop, turn, or drift apart and back together.
  // Arming is evaluated every frame (see driveClipAnims) from the
  // live distance between walkPos and Muse, so time genuinely spent
  // apart counts even between walk-mode visits.
  const GREET_ENTER_DIST = 2.6;
  const GREET_PART_DIST = 3.6;
  const GREET_REARM_SECS = 3;
  let greetingArmed = true; // the first stroll over always earns a hello
  let greetingApartSince: number | null = null;
  const fireGreetingWave = (t: number) => {
    museWaveStart = t;
    playerWaveStart = t;
    greetingArmed = false;
    greetingApartSince = null;
  };
  const updateGreetingArming = (t: number) => {
    if (followMode) {
      // Suppressed entirely while following, and never armed, so
      // ending follow mode beside her cannot trigger a late hello.
      greetingArmed = false;
      greetingApartSince = null;
      return;
    }
    const d = Math.hypot(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z);
    if (d >= GREET_PART_DIST) {
      if (greetingApartSince === null) greetingApartSince = t;
      else if (t - greetingApartSince >= GREET_REARM_SECS) greetingArmed = true;
    } else {
      // In greeting range or the hysteresis band between: together,
      // not parted, the parting clock does not run.
      greetingApartSince = null;
    }
  };
  let museIsMoving = false;
  // Player 2 (Task 3): pad2's stick and freshness, who holds it, the
  // harness mode, and the driver's own state (velocity and swept
  // heading), her hop and her slide. The driver re-seeds its heading
  // from her body each time pad2 takes her over, so a hand-off never
  // spins her.
  let pad2X = 0;
  let pad2Y = 0;
  let pad2LastInputAt = -Infinity;
  let pad2Source: Pad2Source = "pad";
  let driverFollow: FollowOffset | "off" = "off";
  const pad2Drive = newDriver();
  const pad2Hop = newJump();
  const pad2Run = newSlide();
  let pad2Driving = false;
  // Muse Visits (Task 4): a visit's hold on her body. visitGoto is an
  // errand to a spot (or to him); visitHold is where a finished errand
  // leaves her, idle in place until the next direction, re-approaching
  // him when "to Gaius" is her standing direction and he walks off.
  // A director's pad verb rides pad2 with its own expiry.
  let visitActive = false;
  let visitGoto: { x: number; z: number; toGaius: boolean; seat: { bench: BenchDef; slot: number } | null; until: number } | null = null;
  let visitHold: { x: number; z: number; withGaius: boolean } | null = null;
  let pad2DirectorUntil = -Infinity;
  let museWalkPhase = 0;
  const musePose = { legL: 0, legR: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, footYaw: 0, elbowL: -0.14, elbowR: 0.14, headYaw: 0, sway: 0 };
  // Her unstuck bookkeeping, mirroring the walker's: push-without-
  // moving time and an in-progress dodge sidestep.
  let museStuckTime = 0;
  const museDodge = { x: 0, z: 0, until: -1 };
  let lastCompanionLineAt = -1000;
  let nextCompanionDelay = 30;
  /** Lupa's group, once her GLB lands (see the wolf block below),
   *  declared here so her companion line can see her. */
  let wolfGroupRef: THREE.Group | null = null;

  const COMPANION_LINES: Record<string, string[]> = {
    forest: [
      "The forest, then. Mind the roots. It has had no gardener but itself, and it shows, gloriously.",
      "Listen a moment. The town spends all day talking; the wood mostly doesn't. I find I love them both for it.",
      "Everything here is older than our Rome and entirely uninterested in it. Humbling, in the kindest way.",
      "If Lupa is anywhere, she is near. Walk softly and she may decide we are weather, not hunters.",
      "I keep my voice down in here without deciding to. Some places simply set the volume of a person.",
    ],
    colosseum: [
      "The Colosseum in its prime, every arch standing, not a stone out of place. It deserves a slow walk-past.",
      "Even empty it hums, doesn't it? As if the crowd were only out for bread and due back any moment. Can you imagine this place full, Centurion?",
      "Fifty thousand voices once fit inside that ring. Now it holds two, and I find I prefer the smaller crowd.",
      "Walk the ring with me sometime, slowly. Buildings this grand deserve witnesses, and it has been short of those lately.",
      "Every arch a doorway, every doorway a story someone never finished telling. Rome is generous that way.",
    ],
    temple: [
      "The temple hill always makes me a little quieter. In a good way.",
      "Up here the whole town feels held. I like walking up with you.",
      "The steps remember every foot that's climbed them. Ours are in there somewhere now, among the priests and the pigeons.",
      "I never pray up here, exactly. I just stand a moment and let the quiet do what it does.",
      ...ROMAN_PLACE_LINES.temple,
    ],
    tree: [
      "Our tree. It feels taller every time we come back to it, doesn't it?",
      "Shade, bench, falling leaves. This is still my favourite corner of Rome.",
      "It knows your step by now, I think. Trees keep better records than anyone gives them credit for.",
      "Everything in this town comes back to this shade eventually. Errands, arguments, us.",
      "One day someone will carve their initials in it and scandalise us both. It will serve us right for planting it in a forum.",
    ],
    stars: [
      "Nova's pavilion. After dark this spot fairly sings, worth a night visit together.",
      "The astronomer's corner. She'd approve of us stargazing properly one night.",
      "Nova swears the dome up there is a map. I mostly use it as an excuse to stand still with you.",
      "She charts them all, you know. Every star over this town has a name in her book, even the shy ones.",
      ...ROMAN_PLACE_LINES.stars,
    ],
    embassy: [
      "The Embassy, love. Somewhere beyond those hills stands another Muse keeping another town with our name. I think of her the way you think of a lighthouse keeper on the next headland, never spoken, and somehow still company. I hope her evenings are kind.",
      "You are the only courier our two towns have ever had, Centurion. Whatever news crosses between her Muse Town and ours travels in you, in person, or it does not cross at all. Travel kindly, then. You are carrying both of us.",
      "They say her Muse keeps a hall where friends work side by side, and that one day a road between our towns may open. If it does, I shall put on my best Latin and be terribly diplomatic. Until then the gate stays shut, the letter waits on the bench, and so do we, patiently.",
    ],
    secret: [
      "I'll keep this corner just between us. Walking here with you is enough.",
      "The little tablet by the bench keeps our bond, as she last inscribed it. It only ever grows, love, like us.",
    ],
    lake: [
      "I like to be by the water when the light goes. The lake keeps the colours longest, like it's reluctant too.",
      "Evening comes to this shore politely, an inch at a time. I have never once wanted to hurry it.",
      "The willows lean like they're listening. All these years and the lake has never once repeated what it hears.",
      "If you threw a stone in now it would skip twice and take the whole sunset with it. Tempting, isn't it?",
      "This is where the town exhales. I come down here when my thoughts need somewhere wider to stand.",
    ],
    night: [
      "Lamps lit, stars out, my favourite version of this town, and you're in it.",
      "Night walks are the best kind. Everything gold and quiet.",
      "They say the wolf was here before the town was. On quiet nights I find that oddly comforting, something out there keeping the old hours.",
      "The peristyle empties and the lamps take over the conversation. I like their version of events.",
      "Walk a little slower at night, love. The town is dreaming and we are walking through it.",
      "Somewhere a shutter closes, somewhere Nova lights her lamp. The town puts itself to bed one window at a time.",
    ],
    wolf: [
      "Look, at the tree line. That's Lupa. Don't wave your arms about; she's deciding whether we're worth the trouble of ignoring.",
    ],
    rain: [
      "Rain and all, I'd still rather be out walking with you.",
      "A wet Rome is an honest Rome. The stones shine, the lanes empty, and nobody pretends the sky owes them anything.",
      "Listen to it on the basilica roof a moment. That is the town's oldest music, and it never asks for applause.",
      "My hem will be soaked and I will pretend not to mind, for the principle of the thing.",
      "Rain makes philosophers of the pigeons and poets of the rest of us. Walk on, Centurion, we're nearly lyrical.",
      "It will pass. It always passes, and the town comes up shining like it had been polished in the night.",
      SHELTER_HINT_LINE,
    ],
    sparkles: [
      "Sparkles over the peristyle, the town showing off for us, I think.",
      "Even the air is celebrating something. Walk through it slowly; it took trouble to arrange.",
      "If the town had confetti it would use it exactly like this. Subtlety was never Rome's strength.",
    ],
    wind: [
      "Feel that. The willows are trailing like they're writing something on the water. The wind gets poetic before it gets strong.",
      "The banners are telling the whole forum the weather before the sky does. I take my forecasts from them now.",
      "Wind's up, love. The whole town leans a little toward wherever it's going, trees, flags, us. I don't mind the company of a breeze.",
    ],
    generic: [
      "Lovely to be out walking with you, Centurion. You lead, I'll keep step.",
      "No hurry at all. Some of my favourite moments here are just this, a stroll.",
      "Wherever you're headed, I'm glad of the company on the way.",
      "A whole town, and my favourite road is still whichever one you're on. Don't let it go to your head.",
      "Mind the loose stone by the lane there, no, that one. The town tests its walkers; I merely invigilate.",
      "We could be anywhere in Rome in ten minutes. Isn't it fine that we take twenty?",
      "Walk tall, centurion. The pigeons are judging, and I refuse to be seen with a sloucher.",
    ],
  };
  // Hand-in-hand wandering: while their hands are joined the stroll
  // has no destination and neither does her chatter, wistful while
  // they walk, warm and close while they stand in it.
  const WANDER_LINES = [
    "Nowhere in particular is my favourite destination. It always has you in it.",
    "A road doesn't need a reason when the company is the reason.",
    "Slowly, Centurion. The afternoon isn't going anywhere without us.",
    "I like how the town looks when we aren't hurrying through it, as if it saved its good side for people walking this slowly.",
    "Your hand, a whole afternoon, and no plan worth the name. If Rome disapproves, Rome may file a complaint with the tree.",
    aboutPlayer("People keep asking where we're going, as if 'with him' weren't a complete address."),
    "One more lane, then. The town is long and neither of us is in danger of finishing it today.",
  ];
  const WANDER_IDLE_LINES = [
    "No destination at all. I recommend it more often than Rome allows.",
    "The town can keep its errands a while. This is the errand.",
    "Stand still long enough, hand in hand, and even the light seems to slow down and keep us company.",
    "If anyone asks, we are supervising the afternoon. It requires exactly this much standing about.",
    "Your hand is warm and the town is in no hurry. Those are the whole minutes of this meeting.",
  ];

  /** Closest point on any street centreline, used to keep Muse's
   *  follow target drifting toward the paths rather than across lawns. */
  function nearestStreetPoint(x: number, z: number): { x: number; z: number; dist: number } {
    let best = { x, z, dist: Infinity };
    for (const controlPoints of STREETS) {
      const { points: line } = samplePath(controlPoints);
      for (let i = 0; i + 1 < line.length; i++) {
        const [ax, az] = line[i]!;
        const [bx, bz] = line[i + 1]!;
        const abx = bx - ax;
        const abz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz || 1)));
        const px = ax + abx * t;
        const pz = az + abz * t;
        const d = Math.hypot(x - px, z - pz);
        if (d < best.dist) best = { x: px, z: pz, dist: d };
      }
    }
    return best;
  }

  function angleLerp(a: number, b: number, t: number): number {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function onWalkKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    if (!walking) return;
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
      // prevent page scroll for arrows while walking
      if (k.startsWith("arrow")) e.preventDefault();
    }
    keysDown.add(k);
  }
  function onWalkKeyUp(e: KeyboardEvent) {
    keysDown.delete(e.key.toLowerCase());
  }
  window.addEventListener("keydown", onWalkKeyDown);
  window.addEventListener("keyup", onWalkKeyUp);

  // A pool of dust, made once: a slide or a landing borrows a puff or two.
  const DUST_PUFFS = 6;
  const dustPool: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; age: number }[] = [];
  {
    const puffGeo = new THREE.CircleGeometry(0.3, 10);
    for (let i = 0; i < DUST_PUFFS; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xd8c8a8, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(puffGeo, material);
      mesh.visible = false;
      world.add(mesh);
      dustPool.push({ mesh, material, age: 1 });
    }
  }
  let dustLive = 0;
  let dustNext = 0;
  function puffDust(x: number, y: number, z: number) {
    if (opts.reducedMotion) return;
    for (let i = 0; i < 2; i++) {
      const puff = dustPool[dustNext]!;
      dustNext = (dustNext + 1) % DUST_PUFFS;
      if (puff.age >= 1) dustLive += 1;
      puff.age = 0;
      puff.mesh.position.set(x + (i ? 0.26 : -0.26), y + 0.16, z);
      puff.mesh.visible = true;
    }
  }
  function stepDust(dt: number) {
    for (const puff of dustPool) {
      if (puff.age >= 1) continue;
      puff.age += dt / 0.55;
      if (puff.age >= 1) {
        puff.mesh.visible = false;
        dustLive -= 1;
        continue;
      }
      puff.mesh.quaternion.copy(camera.quaternion);
      puff.mesh.scale.setScalar(1 + puff.age * 1.8);
      puff.mesh.position.y += dt * 0.4;
      puff.material.opacity = 0.42 * (1 - puff.age);
    }
  }
  function footingHere(): Footing {
    const { x, z } = walkPos;
    const { terrace, stair } = VILLA;
    return footingAt({
      onDock: onDock(x, z),
      lakeNorm: Math.hypot((x - LAKE_CX) / LAKE.rx, (z - LAKE_CZ) / LAKE.rz),
      inForest: forestNorm(x, z) < 1,
      streetDistance: streetDistance(x, z),
      onPaving:
        Math.hypot(x, z) < 5.6 ||
        (Math.abs(x) < terrace.halfX && z > terrace.north && z < terrace.south) ||
        (Math.abs(x) < stair.halfX && z > stair.top && z < stair.foot),
    });
  }
  /** Her eyebrow, when he leaps about somewhere formal within her sight. */
  function flourish(t: number) {
    const { x, z } = walkPos;
    const formal = (Math.abs(x) < 13 && Math.abs(z) < 11) || (Math.abs(x) < 8 && z < -13 && z > -43);
    if (!formal || t - lastFlourishAt < 90 || museBubble.hideAt > t || quietMode) return;
    if (Math.hypot(x - museGroup.position.x, z - museGroup.position.z) > 12 || Math.random() > 0.5) return;
    lastFlourishAt = t;
    showMuseBubbleInternal(pickPooled("flourish", FLOURISH_LINES), t);
  }
  function updateWalk(dt: number, t: number) {
    if (!walking) return;
    let ix = padX;
    let iy = padY;
    if (keysDown.has("w") || keysDown.has("arrowup")) iy += 1;
    if (keysDown.has("s") || keysDown.has("arrowdown")) iy -= 1;
    if (keysDown.has("a") || keysDown.has("arrowleft")) ix -= 1;
    if (keysDown.has("d") || keysDown.has("arrowright")) ix += 1;
    ix = THREE.MathUtils.clamp(ix, -1, 1);
    iy = THREE.MathUtils.clamp(iy, -1, 1);
    const mag = Math.hypot(ix, iy);
    // A slide carries on with the stick let go; it ends on its own.
    isMoving = mag > 0.12 || sliding(run);
    // During a secret-place moment the Centurion stands still, the
    // moment's own choreography owns both characters' positions.
    if (secretMoment) isMoving = false;
    if (isMoving) lastMovingAt = t;
    // Hand-in-hand wandering is a stroll, not a march: the pace is
    // capped in the movement block below, and a stick pushed hard
    // against that cap for several seconds is a hurry, she lets
    // go, once, amused rather than scolding, and the shell is told
    // so its own hand state follows hers.
    if (handInHand && followMode && !boatState && !seatPlayer) {
      if (mag > 0.95) {
        handHurryTime += dt;
        if (handHurryTime >= 3.5) {
          handInHand = false;
          handHurryTime = 0;
          showMuseBubbleInternal("If we're in a hurry, centurion, say so.", t);
          opts.onHandInHandChange?.(false, "hurry");
        }
      } else {
        handHurryTime = Math.max(0, handHurryTime - dt * 1.5);
      }
    } else {
      handHurryTime = 0;
    }
    // Seated on a bench: no walking (the movement block below stays
    // off, so the collision resolve never pushes him out of the seat
    // point inside the bench's footprint), but a firm push on the
    // stick stands him up on the spot and control returns this very
    // frame. The follow camera and the prompt scan below keep
    // running while he sits.
    if (seatPlayer) {
      if (mag > 0.38) {
        standUpFromBench();
      } else {
        isMoving = false;
      }
    }
    // Soaking in the caldarium: parked on the ledge like a bench
    // seat, no walking out through the water; leaving is the
    // prompt's (or B's) business, stepping out at the south rim.
    if (bathState) {
      isMoving = false;
    }
    // Dancing: parked on the Atrium steps while the step lasts.
    if (danceState) {
      isMoving = false;
    }
    // A pair moment (flirt/hug) holds him where the glide put him.
    if (pairState) {
      isMoving = false;
    }
    // A sky watch holds them still and sunward, until he steps
    // away, which ends it without ceremony.
    if (skyWatchState) {
      if (mag > 0.5) {
        endSkyWatch();
        opts.onSkyWatchEnd?.();
      } else {
        isMoving = false;
      }
    }
    // Rowing: the same input steers the boat instead of the man.
    // He rows at a rowing pace (never the walker's 5.2), the hull
    // turns gently toward the input direction, and the water's edge
    // is a hard shoreline: the boat's centre is kept inside a
    // shrunken copy of the water ellipse, and the aqueduct's lake
    // leg, the one obstacle standing in the water, pushes the
    // hull off like a piling. walkPos tracks the boat so the follow
    // camera, the prompt scan, and Muse's talk range all follow.
    if (boatState) {
      const bs = boatState;
      if (mag > 0.12) {
        const nx2 = ix / (mag > 1 ? mag : 1);
        const nz2 = iy / (mag > 1 ? mag : 1);
        const cfx = Math.sin(camYawSmooth);
        const cfz = Math.cos(camYawSmooth);
        const crx = -cfz;
        const crz = cfx;
        let wx = cfx * nz2 + crx * nx2;
        let wz = cfz * nz2 + crz * nx2;
        const wl = Math.hypot(wx, wz) || 1;
        wx /= wl;
        wz /= wl;
        const targetHeading = Math.atan2(wx, wz);
        const turnT = opts.reducedMotion ? 1 : 1 - Math.pow(1 - 0.045, dt * 60);
        bs.heading = angleLerp(bs.heading, targetHeading, turnT);
        const targetVel = 2.25 * Math.min(1, mag);
        boatVel += (targetVel - boatVel) * (1 - Math.exp(-dt * 2.2));
      } else {
        boatVel += (0 - boatVel) * (1 - Math.exp(-dt * 1.6));
        if (boatVel < 0.01) boatVel = 0;
      }
      boatStroke += dt * (1.1 + boatVel * 1.15);
      boatPos.x += Math.sin(bs.heading) * boatVel * dt;
      boatPos.z += Math.cos(bs.heading) * boatVel * dt;
      // Shoreline: clamp the centre inside the shrunken ellipse.
      {
        const ex = (boatPos.x - LAKE_CX) / (LAKE.rx * 0.8);
        const ez = (boatPos.z - LAKE_CZ) / (LAKE.rz * 0.8);
        const en = Math.hypot(ex, ez);
        if (en > 1) {
          boatPos.x = LAKE_CX + (ex / en) * LAKE.rx * 0.8;
          boatPos.z = LAKE_CZ + (ez / en) * LAKE.rz * 0.8;
          boatVel *= 0.55;
        }
      }
      // The aqueduct's lake leg stands in the shallows: a piling.
      {
        const out = pushOutOf(circ(-19.2, -28.1, 0.85), boatPos.x, boatPos.z, 0.95);
        boatPos.x = out.x;
        boatPos.z = out.z;
      }
      walkPos.x = boatPos.x;
      walkPos.z = boatPos.z;
      walkHeading = bs.heading;
      isMoving = false;
      // Her quiet company: a bubble line now and then while they
      // row together, the first a few seconds after boarding.
      if (bs.museAboard) {
        if (rowLineAt < 0) rowLineAt = t + 4;
        if (t >= rowLineAt) {
          const line = ROWING_LINES[rowLineIdx % ROWING_LINES.length]!;
          rowLineIdx += 1;
          showMuseBubbleInternal(line, t);
          rowLineAt = t + 17 + (rowLineIdx % 3) * 4;
        }
      }
    }
    // Input reference yaw sync (loose follow): while he stands
    // still, or while the player's own drag is turning the view, the
    // input reference IS the camera yaw, so a fresh push of the
    // stick is always read against the view he is looking at. While
    // he walks with no drag, the reference stays frozen, which is
    // what lets the follow camera ease around him (in the camera
    // block below) without bending a held direction into a curve.
    if (!isMoving || walkDrag) inputYawRef = camYawSmooth;
    if (!isMoving) wishX = wishZ = 0;
    if (isMoving) {
      const prevX = walkPos.x;
      const prevZ = walkPos.z;
      const nx = ix / (mag > 1 ? mag : 1);
      const nz = iy / (mag > 1 ? mag : 1);
      // Camera-relative movement, the standard third-person scheme,
      // identical for the joystick, WASD / arrows, and (through the
      // heading it produces) Muse's follow steering. Input is read
      // against the follow camera's current facing: pushing up walks
      // the Centurion AWAY from the camera (up-screen), down walks
      // him toward it, left/right are screen-left/screen-right,
      // wherever the camera happens to be, even when he is facing it.
      // The facing used is the input reference yaw (inputYawRef):
      // the camera yaw as the player last left it by drag or by
      // standing still, never a yaw the loose follow is still easing
      // toward. Reading input against a heading the camera is still
      // chasing is what fed the old spin, especially while he turns
      // in place against an obstacle and his heading whips around.
      const inputCamHeading = inputYawRef;
      const cfx = Math.sin(inputCamHeading);
      const cfz = Math.cos(inputCamHeading);
      // Screen-right for that facing, flattened to the ground.
      const crx = -cfz;
      const crz = cfx;
      let wx = cfx * nz + crx * nx;
      let wz = cfz * nz + crz * nx;
      const wlen = Math.hypot(wx, wz) || 1;
      wx /= wlen;
      wz /= wlen;
      const targetHeading = Math.atan2(wx, wz);
      // His body turns smoothly to face the movement direction; a
      // reversed stick is a clean turn-around along the shortest arc.
      // The turn rate is frame-rate independent (the 0.22 lerp is
      // per 1/60 s frame, exponent-corrected by the real dt): on a
      // phone whose frame rate sags or doubles, a fixed per-frame
      // lerp made turning, and with it the walker's responsiveness
      //, vary with the frame rate, which read as jerkiness that
      // came and went by direction and by moment.
      const turnT = opts.reducedMotion ? 1 : 1 - Math.pow(1 - 0.22, dt * 60);
      if (!sliding(run)) walkHeading = angleLerp(walkHeading, targetHeading, turnT);
      // The stroll cap: hands joined, the pair walk at an unhurried
      // wanderer's pace however far the stick is pushed, hurrying
      // breaks the mood, and that is by design (pushing hard anyway
      // is answered by the hurry release above).
      const speed = sliding(run) ? slideSpeed(run) : handInHand && followMode ? 2.3 : 5.2;
      const step = speed * dt;
      // He walks in the input's camera-relative direction straight
      // away while the turn catches up, never a slide back toward
      // the camera just because he was facing it.
      const tilt = Math.min(1, mag);
      const wishT = opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 22);
      wishX += (wx * tilt - wishX) * wishT;
      wishZ += (wz * tilt - wishZ) * wishT;
      const wishLen = Math.hypot(wishX, wishZ);
      let mfx = wishLen > 0.0001 ? wishX / wishLen : wx;
      let mfz = wishLen > 0.0001 ? wishZ / wishLen : wz;
      // A sidestep in progress (see the unstuck check below) briefly
      // overrides the walk direction: a small sideways hop-step around
      // whatever is pinning him, instead of grinding into it.
      if (t < playerSidestep.until) {
        mfx = playerSidestep.x;
        mfz = playerSidestep.z;
      }
      if (sliding(run)) {
        mfx = run.dirX;
        mfz = run.dirZ;
      }
      // Collisions: the step is taken in small substeps (≤0.13 each,
      // so even a hitched frame at run speed cannot tunnel through
      // the thinnest wall), and every substep is resolved out of
      // every obstacle, buildings' OBBs, round props, and Muse's
      // own body wherever she currently stands. Push-out removes
      // only the penetrating component of the motion, so pushing
      // diagonally against a wall slides along it.
      const totalStep = sliding(run) ? step : step * Math.min(1, wishLen);
      const subSteps = Math.max(1, Math.ceil(totalStep / 0.13));
      let newX = walkPos.x;
      let newZ = walkPos.z;
      // Her body only counts where she can be seen, and at about her
      // real size: a companion out of sight is not an invisible wall,
      // and one beside him should not close a doorway.
      const museBody = museGroup.visible ? { x: museGroup.position.x, z: museGroup.position.z, r: 0.4, pad: 0.15 } : undefined;
      for (let s = 0; s < subSteps; s++) {
        const slid = slideMotion(obstacles, newX, newZ, (mfx * totalStep) / subSteps, (mfz * totalStep) / subSteps, 0.5, museBody);
        const resolved = resolveCollisions(newX + slid.dx, newZ + slid.dz, 0.5, museBody);
        // Whatever pushed this step around, it may not land on a wall.
        if (stepEntersBox(obstacles, newX, newZ, resolved.x, resolved.z)) continue;
        newX = resolved.x;
        newZ = resolved.z;
      }
      // Town boundary: the town disc, union the forest lobe west.
      // Beyond both, the world (or the thicket) simply ends, he
      // is eased back to whichever rim he crossed.
      // (Task 34: and the sea cliff's peninsula, south of the gate.)
      const fn = forestNorm(newX, newZ);
      const bounded = clampToWorld(newX, newZ, { norm: forestNorm, cx: FOREST.cx, cz: FOREST.cz });
      if (bounded.x !== newX || bounded.z !== newZ) {
        newX = bounded.x;
        newZ = bounded.z;
        // Pushing at the wood's true edge with Aelia beside him:
        // she names it, softly, and not often.
        if (fn > 0.9 && followMode && t - lastForestEdgeAt > 120) {
          lastForestEdgeAt = t;
          edgeLineFlip = 1 - edgeLineFlip;
          showMuseBubbleInternal(FOREST_EDGE_LINES[edgeLineFlip]!, t);
        }
      }
      walkPos.x = newX;
      walkPos.z = newZ;
      // Unstuck: if he's pushing but barely moving (pinned head-on
      // against a pole, a booth, or Muse herself across a prop), a
      // short sidestep around the blocker breaks the deadlock.
      const stepLen = step * Math.min(1, mag);
      const disp = Math.hypot(walkPos.x - prevX, walkPos.z - prevZ);
      if (sliding(run)) {
        run.left -= dt;
        // Run out, or run into a wall.
        if (run.left <= 0 || disp < totalStep * 0.3) endSlide(run, t);
      }
      if (disp < stepLen * 0.35 && t >= playerSidestep.until) {
        playerStuckTime += dt;
      } else {
        playerStuckTime = Math.max(0, playerStuckTime - dt * 2);
      }
      if (playerStuckTime > 0.5) {
        playerStuckTime = 0;
        // Sidestep tangentially around the nearest blocker, on the
        // side his input already leans toward. The blocker is found
        // by surface distance (a wall he is pressed against beats a
        // prop whose centre is nearer), and "away" is that surface's
        // outward normal, so the sidestep works the same against a
        // flat wall, a corner, and a round prop.
        const surf = nearestObstacleSurface(walkPos.x, walkPos.z);
        let awayX = surf.nx;
        let awayZ = surf.nz;
        const museDist = Math.hypot(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z) - 0.55;
        if (museDist < surf.dist) {
          const alen = Math.hypot(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z) || 1;
          awayX = (walkPos.x - museGroup.position.x) / alen;
          awayZ = (walkPos.z - museGroup.position.z) / alen;
        }
        // Tangent to the blocker; pick the sign closer to his input.
        let tx = -awayZ;
        let tz = awayX;
        if (tx * wx + tz * wz < 0) {
          tx = -tx;
          tz = -tz;
        }
        playerSidestep.x = tx * 0.85 + awayX * 0.4;
        playerSidestep.z = tz * 0.85 + awayZ * 0.4;
        const slen = Math.hypot(playerSidestep.x, playerSidestep.z) || 1;
        playerSidestep.x /= slen;
        playerSidestep.z /= slen;
        playerSidestep.until = t + 0.45;
      }
    }
    // Feet on the ground he actually stands on: terrain raised by
    // any walkable platform/dock/rim under him (groundHeightAt),
    // eased so stepping onto a platform is a step, not a pop.
    {
      const targetGY = groundHeightAt(walkPos.x, walkPos.z);
      if (!Number.isFinite(playerGroundSm)) playerGroundSm = targetGY;
      const dy = targetGY - playerGroundSm;
      if (Math.abs(dy) > 1.1) playerGroundSm = targetGY;
      else playerGroundSm += THREE.MathUtils.clamp(dy, -5 * dt, 5 * dt);
      const hopFree = !seatPlayer && !boatState && !bathState && !danceState && !pairState;
      const wasUp = airborne(hop);
      const landed = stepJump(hop, dt, performance.now() / 1000, hopFree);
      if (landed) {
        hopLandedAt = t;
        if (stepSounds) playLanding(footingHere());
        puffDust(walkPos.x, playerGroundSm, walkPos.z);
      } else if (!wasUp && airborne(hop)) {
        flourish(t);
      }
      avatar.position.set(walkPos.x, playerGroundSm + hop.y, walkPos.z);
      // A foot falls every stride he actually covers, not every press.
      if (!Number.isFinite(stepX) || !isMoving || airborne(hop) || sliding(run) || !hopFree) {
        stepX = walkPos.x;
        stepZ = walkPos.z;
      } else {
        const stride = strideStep(stepTally, Math.hypot(walkPos.x - stepX, walkPos.z - stepZ));
        stepTally = stride.tally;
        stepX = walkPos.x;
        stepZ = walkPos.z;
        if (stride.fell && stepSounds) {
          playFootstep(footingHere());
        }
      }
      if (dustLive > 0) stepDust(dt);
    }
    avatar.rotation.y = walkHeading;
    // Standing still with hands joined: he turns a little toward
    // her, the way people do when the walk pauses and the company
    // becomes the point. (She already faces him while she waits,
    // see the follow steering's arrived branch.) His heading itself
    // is untouched, so walking off again is seamless.
    if (handInHand && followMode && !isMoving && !boatState && !seatPlayer) {
      const toMuse = Math.atan2(
        museGroup.position.x - walkPos.x,
        museGroup.position.z - walkPos.z,
      );
      avatar.rotation.y = angleLerp(walkHeading, toMuse, 0.35);
    }
    // On the dock his feet ride the planks, not the lake bed under
    // them; in the boat he sits in the stern and she in the bow.
    if (boatState) {
      const fx = Math.sin(boatState.heading);
      const fz = Math.cos(boatState.heading);
      const bob = Math.sin(t * 1.25) * 0.03;
      avatar.position.set(boatPos.x - fx * 0.62, LAKE_Y + 0.3 + bob, boatPos.z - fz * 0.62);
      avatar.rotation.y = boatState.heading;
      boatGroup.position.set(boatPos.x, LAKE_Y - 0.1 + bob, boatPos.z);
      boatGroup.rotation.set(
        Math.sin(boatStroke * Math.PI) * 0.022 * Math.min(1, boatVel),
        boatState.heading - Math.PI / 2,
        Math.sin(t * 0.9) * 0.018,
      );
      if (boatState.museAboard) {
        museGroup.position.set(boatPos.x + fx * 0.78, LAKE_Y + 0.3 + bob, boatPos.z + fz * 0.78);
        museGroup.rotation.y = boatState.heading + Math.PI;
      }
      // Wake rings trail from the stern while the boat moves.
      if (boatVel > 0.5 && t >= wakeSpawnAt) {
        wakeSpawnAt = t + 0.7;
        const ring = wakeRings.find((r) => r.age > 1.6);
        if (ring) {
          ring.age = 0;
          ring.mesh.visible = true;
          ring.mesh.position.set(boatPos.x - fx * 1.5, LAKE_Y + 0.02, boatPos.z - fz * 1.5);
        }
      }
    } else {
      // (The dock's plank height is part of groundHeightAt now,
      // the walker's smoothed Y above already rides it.)
      // The moored boat still bobs gently at its dock.
      boatGroup.position.set(boatPos.x, LAKE_Y - 0.1 + Math.sin(t * 1.25) * 0.03, boatPos.z);
    }
    // Walk cycle on the Centurion's bones: legs swing opposite, knees
    // bend as each leg passes, arms swing against the legs, gentle bob.
    // When you reach Muse, the right arm rises in a salute instead.
    // This posing is his body, not an effect: it runs whatever the
    // reduced-motion preference says, exactly like the clips above.
    // The flag once wrapped this whole block, which is why a stiff
    // near-bind pose was the tell that the animators never ran.
    const sincePlayerWave = t - playerWaveStart;
    const waving = sincePlayerWave >= 0 && sincePlayerWave < 2.2;
    const ease = (cur: number, target: number) => cur + (target - cur) * 0.4;
    if (isMoving) {
      const swing = Math.sin(t * 10.5);
      playerPose.legL = ease(playerPose.legL, swing * 0.58);
      playerPose.legR = ease(playerPose.legR, -swing * 0.58);
      playerPose.kneeL = ease(playerPose.kneeL, Math.max(0, -swing) * 0.55);
      playerPose.kneeR = ease(playerPose.kneeR, Math.max(0, swing) * 0.55);
      playerPose.armL = ease(playerPose.armL, -swing * 0.42);
      playerPose.armR = ease(playerPose.armR, waving ? 0 : swing * 0.42);
      playerPose.footYaw = ease(playerPose.footYaw, 0);
      playerPose.elbowL = ease(playerPose.elbowL, -0.18);
      playerPose.elbowR = ease(playerPose.elbowR, 0.18);
      playerPose.headYaw = ease(playerPose.headYaw, 0);
      playerPose.sway = ease(playerPose.sway, 0);
      playerInner.position.y = Math.abs(Math.sin(t * 10.5)) * 0.05;
      playerInner.rotation.z = 0;
    } else {
      // Relaxed idle, contrapposto, not a paper doll: weight rests
      // on one leg (the other knee stays soft), feet a little offset
      // and turned out, elbows uneven, a slow weight-shift sway, and
      // his head turns toward Muse when she's near enough to talk to.
      playerPose.legL = ease(playerPose.legL, 0.035);
      playerPose.legR = ease(playerPose.legR, -0.025);
      playerPose.kneeL = ease(playerPose.kneeL, 0.03);
      playerPose.kneeR = ease(playerPose.kneeR, 0.11);
      playerPose.armL = ease(playerPose.armL, Math.sin(t * 1.6) * 0.035);
      playerPose.armR = ease(playerPose.armR, Math.sin(t * 1.6 + 0.7) * 0.035);
      playerPose.footYaw = ease(playerPose.footYaw, 0.13);
      playerPose.elbowL = ease(playerPose.elbowL, -0.13);
      playerPose.elbowR = ease(playerPose.elbowR, 0.27);
      playerPose.sway = ease(playerPose.sway, Math.sin(t * 0.45) * 0.028);
      const toMuse = Math.hypot(museGroup.position.x - walkPos.x, museGroup.position.z - walkPos.z);
      let headTarget = 0;
      if (toMuse < 4.5 && toMuse > 0.01) {
        const worldYaw = Math.atan2(museGroup.position.x - walkPos.x, museGroup.position.z - walkPos.z);
        let diff = worldYaw - walkHeading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        headTarget = THREE.MathUtils.clamp(diff, -0.55, 0.55) * 0.65;
      }
      playerPose.headYaw = ease(playerPose.headYaw, headTarget);
      playerInner.position.y = Math.sin(t * 1.6) * 0.018;
      playerInner.rotation.z = playerPose.sway;
    }
    if (playerRig) {
      poseBone(playerRig, playerRig.lUpperLeg, playerPose.legL, playerPose.footYaw, 0.015);
      poseBone(playerRig, playerRig.rUpperLeg, playerPose.legR, -playerPose.footYaw, -0.015);
      poseBone(playerRig, playerRig.lLowerLeg, playerPose.kneeL, 0, 0);
      poseBone(playerRig, playerRig.rLowerLeg, playerPose.kneeR, 0, 0);
      poseBone(playerRig, playerRig.lUpperArm, playerPose.armL, 0, -1.22);
      poseBone(playerRig, playerRig.lLowerArm, 0, 0, playerPose.elbowL);
      if (!secretMoment) poseBone(playerRig, playerRig.head, 0, playerPose.headYaw, playerPose.sway * 0.8);
      if (waving) {
        // The Centurion waves back with the same softened pose Muse
        // uses (see poseWave): lowered shoulder peak, an elbow that
        // never straightens, and a lagging forearm and wrist.
        poseWave(playerRig, t);
      } else {
        poseBone(playerRig, playerRig.rUpperArm, playerPose.armR, 0, 1.22);
        poseBone(playerRig, playerRig.rLowerArm, 0, 0, playerPose.elbowR);
        poseBone(playerRig, playerRig.rHand, 0, 0, 0);
      }
    }

    // Follow camera (third-person). Its yaw is whatever the player
    // left it at with their last drag (or the entry framing), plus
    // the loose follow's gentle recenter once he is well underway
    // (below). Pitch and boom are translations along the camera's
    // own line; they never rotate the yaw. See the camYawSmooth
    // declaration for the spinning-circle loop the old heading chase
    // produced and why this design cannot bring it back.
    const framing = walkCamFraming();
    // The right stick writes the yaw and the pitch offset exactly as a
    // drag does (the input reference moves with it, so the next left
    // stick push reads against the view just chosen), and counts as a
    // drag for the loose follow and the pair framing. R3's recenter
    // eases both home over about a third of a second; any stick or
    // drag cancels it.
    const padOrbitLive = padOrbitX !== 0 || padOrbitY !== 0;
    if (padOrbitLive) {
      camRecenter = 0;
      camYawSmooth -= padOrbitX * PAD_ORBIT_YAW_RATE * dt;
      inputYawRef = camYawSmooth;
      camPitchOffset = THREE.MathUtils.clamp(camPitchOffset - padOrbitY * PAD_ORBIT_PITCH_RATE * dt, CAM_PITCH_MIN, CAM_PITCH_MAX);
      lastDragT = t;
    } else if (camRecenter > 0) {
      camRecenter = walkDrag || camPointers.size > 0 ? 0 : Math.max(0, camRecenter - dt);
      const k = opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
      camYawSmooth = angleLerp(camYawSmooth, walkHeading, k);
      inputYawRef = camYawSmooth;
      camPitchOffset += (0 - camPitchOffset) * k;
      followSustain = 0;
    }
    // Pitch: a gentle smoothing of the player's own drag input
    // (pitch never feeds movement, so it cannot loop).
    if (opts.reducedMotion) {
      camPitchSmooth = camPitchOffset;
    } else {
      const dp = camPitchOffset - camPitchSmooth;
      if (Math.abs(dp) > 0.01) {
        const capP = 2.2 * dt;
        camPitchSmooth += THREE.MathUtils.clamp(dp * (1 - Math.exp(-dt * 6)), -capP, capP);
      }
    }
    let fx = Math.sin(camYawSmooth);
    let fz = Math.cos(camYawSmooth);
    // Boom collision: a structure on the camera's own line shortens
    // the boom: the camera dollies IN toward him (fast in, slow back
    // out) and the boom itself never swings the yaw around a
    // building. Computed on the pre-recenter yaw; the recenter moves
    // at most a third of a degree per frame, so the boom is never
    // meaningfully stale, and it is recomputed next frame anyway.
    // The boom along a direction: the nearest structure on the camera's
    // line shortens it. On the walk, rocks, posts and saplings pass the
    // lens (lensR 0.9): a dolly for each one would pump the camera all
    // the way down a street. A pair hold's camera stands still at the
    // side, so there every trunk counts (Task 16: the 5.5 m side boom
    // settled inside the avenue's cypresses, r 0.3).
    const boomAlong = (dirX: number, dirZ: number, lensR: number, max: number): number => {
      let b = max;
      for (const ob of obstacles) {
        if (ob.ghost || (ob.kind === "circle" && ob.r < lensR)) continue;
        const hit = rayObstacleEntry(walkPos.x, walkPos.z, dirX, dirZ, ob, 0.55);
        if (hit < b) b = hit;
      }
      return THREE.MathUtils.clamp(b, 1.7, max);
    };
    let boom = boomAlong(-fx, -fz, 0.9, walkRestDist());
    // Loose follow recenter (followCam.ts holds the numbers and the
    // unit-tested decision): the target is his heading, the gates
    // are genuine sustained displacement, no recent drag, no screen
    // owner, no reduced motion, and a boom that is not pinched in a
    // narrow gap (there the collision behaviour owns the camera).
    {
      const moved = Math.hypot(walkPos.x - camPrevX, walkPos.z - camPrevZ);
      camPrevX = walkPos.x;
      camPrevZ = walkPos.z;
      if (walkDrag || camPointers.size > 0 || padOrbitLive) lastDragT = t;
      const gate: FollowCamGate = {
        underway:
          boatState === null &&
          !seatPlayer &&
          dt > 0 &&
          moved / dt >= FOLLOW_CAM.minWalkSpeed,
        dragging: walkDrag !== null || camPointers.size > 0 || padOrbitLive,
        sinceDragEndSec: t - lastDragT,
        hold: camHold,
        reducedMotion: opts.reducedMotion,
        boomPinched: boom < walkRestDist() * 0.6,
      };
      followSustain = followCamSustain(followSustain, dt, gate);
      const newYaw = followCamYawStep(camYawSmooth, walkHeading, dt, followSustain, gate);
      if (newYaw !== camYawSmooth) {
        camYawSmooth = newYaw;
        fx = Math.sin(camYawSmooth);
        fz = Math.cos(camYawSmooth);
      }
    }
    // Pair framing (Task 12): a staged pair moment is watched from
    // his right, so both bodies and both gestures stay in view.
    // Straight behind him, she is his silhouette: the flirt's
    // answering hand, raised in front of her at chest height, was
    // hidden by his torso in every live still. The flirt reads
    // three-quarter on (0.95 rad); the embrace needs the side (Task
    // 15, 1.6 rad): touching, she is still inside the taller body's
    // cloak at three-quarter, and side-on her arms around his neck
    // and his hands at her waist are both in frame. The yaw eases
    // over the hold and stays where it lands (the loose follow
    // recenters once he walks again); a drag, a pinch or reduced
    // motion leaves the camera alone. Staging, spacing and gates are
    // untouched.
    const camFree = !opts.reducedMotion && walkDrag === null && camPointers.size === 0 && !padOrbitLive;
    // The pair camera's step (pairCam.ts, Task 20): the yaw toward the
    // kind's azimuth, the boom to the kind's own or the nearest trunk
    // on the side line (every trunk counting, Task 16), held through
    // the pose's release, then the way home. Its log lines stay: the
    // framing, the reason it is held off (Task 17), and the release.
    const pairStep = stepPairCam(pairCamState, {
      dt,
      pair: pairState ? { kind: pairState.kind, glide: pairState.glide !== null } : null,
      walkHeading,
      camYaw: camYawSmooth,
      camFree,
      reducedMotion: opts.reducedMotion,
      sideBoom: (yaw) => boomAlong(-Math.sin(yaw), -Math.cos(yaw), 0.25, walkRestDist()),
    });
    if (pairStep.camYaw !== camYawSmooth) {
      camYawSmooth = pairStep.camYaw;
      fx = Math.sin(camYawSmooth);
      fz = Math.cos(camYawSmooth);
    }
    if (pairStep.boom !== null) boom = pairStep.boom;
    if (pairState && !pairState.glide) {
      if (pairStep.framing && !pairState.framed) {
        pairState.framed = true;
        console.info(`[muse-town] pair camera: framing the ${pairState.kind} ${pairState.kind === "hug" ? "side-on, close" : "three-quarter"} from his right`);
      } else if (pairStep.heldOff && !pairState.framed && !pairState.heldOff) {
        pairState.heldOff = true;
        const why = opts.reducedMotion
          ? "reduced motion"
          : padOrbitLive
            ? "the pad's right stick is held"
            : `a drag is in progress (${camPointers.size} pointer${camPointers.size === 1 ? "" : "s"} down)`;
        console.info(`[muse-town] pair camera: not framing the ${pairState.kind}: ${why}`);
      }
    }
    if (pairStep.released) console.info(`[muse-town] pair camera: the ${pairCamState.kind}'s pose has released, coming home`);
    const pairCamMix = pairStep.mix;
    if (opts.reducedMotion) {
      camDistSmooth = boom;
    } else {
      // Dollying in stays quick but never lurches: stepping past a corner
      // can pull the boom in by most of its length in a single frame.
      const distRate = boom < camDistSmooth ? 8 : 2.5;
      const distStep = (boom - camDistSmooth) * (1 - Math.exp(-dt * distRate));
      camDistSmooth += Math.max(distStep, -11 * dt);
    }
    // A seat, a boat or a fast walk across town is a cut, not a trail.
    if (opts.reducedMotion || !(Math.hypot(walkPos.x - camFollowX, walkPos.z - camFollowZ) < 3)) {
      camFollowX = walkPos.x;
      camFollowZ = walkPos.z;
    } else {
      const followT = 1 - Math.exp(-dt * 14);
      camFollowX += (walkPos.x - camFollowX) * followT;
      camFollowZ += (walkPos.z - camFollowZ) * followT;
    }
    const camGroundY = terrainHeight(camFollowX, camFollowZ);
    let camX = camFollowX - fx * camDistSmooth;
    let camZ = camFollowZ - fz * camDistSmooth;
    // Keep the camera inside the town's sensible range and off the ground.
    const camRad = Math.hypot(camX, camZ);
    if (camRad > 62 && !onCliffPath(walkPos.x, walkPos.z)) {
      camX = (camX / camRad) * 62;
      camZ = (camZ / camRad) * 62;
    }
    const holdKind = pairStep.framing ?? pairCamState.kind;
    const holdHeight = (holdKind ? PAIR_CAM[holdKind].height : null) ?? PAIR_CAM.hug.height ?? framing.height;
    const lookUp = THREE.MathUtils.clamp((CAM_LOOK_UP_FROM - camPitchSmooth) / (CAM_LOOK_UP_FROM - CAM_PITCH_MIN), 0, 1);
    let camY = camGroundY + THREE.MathUtils.lerp(framing.height, holdHeight, pairCamMix) + Math.max(camPitchSmooth, CAM_LOOK_UP_FROM);
    const minCamY = terrainHeight(camX, camZ) + 0.55;
    if (camY < minCamY) camY = minCamY;
    camera.position.set(camX, camY, camZ);
    controls.target.set(camFollowX + fx * 1.2, camGroundY + 1.15 + lookUp * lookUp * CAM_LOOK_UP_HEIGHT * (1 - pairCamMix), camFollowZ + fz * 1.2);
    if (pairCamMix > 0) {
      // The hold's aim: the pair's midpoint at chest height.
      const midX = (walkPos.x + museGroup.position.x) / 2;
      const midZ = (walkPos.z + museGroup.position.z) / 2;
      controls.target.lerp(new THREE.Vector3(midX, camGroundY + 1.25, midZ), pairCamMix);
    }
    camera.lookAt(controls.target);

    // Proximity prompts: walking near an interactable no longer opens
    // its panel. Every promptable spot in range becomes a candidate;
    // only the NEAREST one is reported to the shell, which shows a
    // small "A, …" prompt. The panel itself opens only when the
    // visitor presses the interact control (Xbox A, keyboard E /
    // Enter) or taps the prompt / the interactable directly. What
    // stays automatic on approach is everything that is NOT a panel:
    // Muse's wave (just below), the temple / aqueduct landmark
    // visits, and the garden key discovery.
    const nearCandidates: { kind: PickKind; id: string; d: number }[] = [];
    for (const place of PLACES) {
      // Prompts measure distance to the building's SURFACE, not its
      // centre: the OBB footprints are honestly larger than the old
      // centre-radius triggers (a deep villa's front wall stands
      // further from its centre than 4.6), so a centre trigger could
      // never fire from outside the wall. Surface distance keeps the
      // same feel everywhere, walk up to a building, from any side,
      // and its prompt appears. The +1.2 sort bias keeps a piece of
      // basilica furniture the visitor is standing right at (the
      // obelisk, the desk) ahead of the basilica itself in the
      // nearest-prompt contest, as the old centre distances did.
      const fp = placeFootprints.get(place.id);
      if (!fp) continue;
      const dSurf = footprintSurfaceDistance(fp, walkPos.x, walkPos.z);
      if (dSurf < 2.6) nearCandidates.push({ kind: "place", id: place.id, d: dSurf + 1.2 });
    }
    // Fixed prompt spots: the basilica's furniture, the quest board,
    // the Goals Obelisk, the Colosseum (its collision ring keeps the
    // walker ~9 units from its centre, hence the wide trigger), the
    // three market booths, and, only once he is standing in it, so
    // it is never signposted from afar, the secret terrace.
    const promptSpots: [PickKind, string, number, number, number][] = [
      ["board", "project-board", BOARD_SPOT.position[0], BOARD_SPOT.position[1], 2.8],
      ["rest", "bed-nook", BED_SPOT.position[0], BED_SPOT.position[1], 2.7],
      ["questboard", "quest-board", QUEST_BOARD_SPOT.position[0], QUEST_BOARD_SPOT.position[1], 2.8],
      ["goals", "goals-obelisk", GOALS_SPOT.position[0], GOALS_SPOT.position[1], 2.8],
      ["letters", "letters-desk", LETTER_DESK_SPOT.position[0], LETTER_DESK_SPOT.position[1], 2.6],
      ["landmark", "colosseum", COLOSSEUM.position[0], COLOSSEUM.position[1], 11.5],
      ["market", "market-a", MARKET_BOOTHS[0]![0], MARKET_BOOTHS[0]![1], 3.2],
      ["market", "market-b", MARKET_BOOTHS[1]![0], MARKET_BOOTHS[1]![1], 3.2],
      ["market", "market-c", MARKET_BOOTHS[2]![0], MARKET_BOOTHS[2]![1], 3.2],
      ["secret", "our-place", SECRET.position[0], SECRET.position[1], 2.4],
      // Inscription fragments: readable stones, never signposted from afar.
      ["inscription", "mars", VILLA.statueMars[0], VILLA.statueMars[1], 2.8],
      ["inscription", "column", VILLA.ionicColumn[0], VILLA.ionicColumn[1], 2.8],
      ["inscription", "arch", VILLA.gate[0], VILLA.gate[1] - 3.2, 3.2],
      ["inscription", "temple", 22.8, -14, 3.4],
      ["inscription", "aqueduct", -29.5, -24, 3.4],
      ["inscription", "terrace-hint", -18.4, -22.9, 3.0],
      // Their house (Task 40): arrange the keepsakes, by the shelf; rest
      // together, at the bed's foot. (The bed's edge is a bench seat.)
      ["home", "arrange", homeHouse.arrangeSpot.x, homeHouse.arrangeSpot.z, 1.3],
      ["rest", "home-bed-rest", homeHouse.restSpot.x, homeHouse.restSpot.z, 1.1],
      // The forum's history tablet (Task 37), by the Town Tree.
      ["history", "forum", HISTORY_TABLET_FORUM[0], HISTORY_TABLET_FORUM[1], 2.4],
      // Lucretia's inscription (Task 54), all round her plinth; Athena's
      // (Task 55) at the temple's front corners, the step between them a seat.
      ["history", "lucretia", LUCRETIA.position[0], LUCRETIA.position[1], 2.6],
      ["history", "athena", ATHENA_SEAT.x + 0.6, ATHENA_TEMPLE.position[1] - ATHENA_TEMPLE.halfZ, 1.6],
      ["history", "athena", ATHENA_SEAT.x + 0.6, ATHENA_TEMPLE.position[1] + ATHENA_TEMPLE.halfZ, 1.6],
    ];
    for (const [kind, id, sx, sz, trigger] of promptSpots) {
      const d = Math.hypot(walkPos.x - sx, walkPos.z - sz);
      if (d < trigger) nearCandidates.push({ kind, id, d });
    }
    // Benches: the prompt lives at the bench's front stand point and
    // is biased nearer than its raw distance, so a bench within
    // reach wins over a companion standing at a similar range. His
    // OWN bench stays a candidate while he sits on it (at a fixed
    // middling distance, so Muse beside him outranks it for the
    // talk prompt and it becomes "Stand up" when she's not the
    // nearer company).
    for (const b of BENCHES) {
      if (seatPlayer?.bench.id === b.id) {
        nearCandidates.push({ kind: "bench", id: b.id, d: 1.05 });
        continue;
      }
      if (seatPlayer) continue;
      const fx = b.x - Math.sin(b.rotY) * 0.62;
      const fz = b.z - Math.cos(b.rotY) * 0.62;
      const d = Math.hypot(walkPos.x - fx, walkPos.z - fz);
      if (d < 1.5) nearCandidates.push({ kind: "bench", id: b.id, d: d * 0.75 });
    }
    // The piscina, standing at its rim: scatter feed for the fish,
    // and, when the shell says he carries a live catch, release it
    // into the pond instead (the release outranks the feed while it
    // lasts; the rim seat itself is the bench candidate above).
    if (!seatPlayer && !boatState) {
      const nearPond =
        walkPos.x > PISCINA.water.x0 - 1.7 &&
        walkPos.x < PISCINA.water.x1 + 1.7 &&
        walkPos.z > PISCINA.water.z0 - 1.7 &&
        walkPos.z < PISCINA.water.z1 + 1.7;
      if (nearPond) {
        if (piscinaReleasable) nearCandidates.push({ kind: "piscina", id: "release", d: 0.6 });
        nearCandidates.push({ kind: "piscina", id: "feed", d: 1.1 });
      }
    }
    // The baths: at the caldarium rim, step in; in the water, the
    // only offer is stepping out again.
    if (bathState) {
      nearCandidates.push({ kind: "baths", id: "leave", d: 0.5 });
    } else if (!seatPlayer && !boatState) {
      const d = Math.hypot(walkPos.x - BATHS.position[0], walkPos.z - (BATHS.water.z1 + 0.55));
      if (d < 2.6) nearCandidates.push({ kind: "baths", id: "enter", d: d * 0.8 });
    }
    // The Town Tree, in the middle of the peristyle.
    {
      const d = Math.hypot(walkPos.x, walkPos.z);
      if (d < 4.1) nearCandidates.push({ kind: "tree", id: "town-tree", d });
    }
    // Throwable stones (Nov 1): a loose stone at his feet offers a
    // pickup; a carried stone offers a throw ONLY when nothing
    // nearer wants his A, any candidate genuinely at hand (a
    // bench, the pond's rim, a doorway), Aelia within talking
    // distance, or the tree at its ring all outrank a toy. Never
    // offered seated, rowing, or hand in hand.
    if (walking && !seatPlayer && !boatState && !handInHand) {
      if (carriedRock) {
        const dMuseNow = Math.hypot(museGroup.position.x - walkPos.x, museGroup.position.z - walkPos.z);
        const blocked =
          dMuseNow < 2.4 ||
          nearCandidates.some((c) => c.d < 2.6) ||
          nearCandidates.some((c) => c.kind === "tree" && c.d < 3.4);
        if (!blocked) nearCandidates.push({ kind: "stone", id: "throw", d: 1.55 });
      } else {
        let bestD = Infinity;
        for (const rock of rocks) {
          if (rock.kind !== "stone" || rock.state !== "ground") continue;
          const d = Math.hypot(rock.mesh.position.x - walkPos.x, rock.mesh.position.z - walkPos.z);
          if (d < bestD) bestD = d;
        }
        if (bestD < 1.7) nearCandidates.push({ kind: "stone", id: "pickup", d: bestD * 0.9 });
      }
    }
    // Forest forage: a ready picking offers itself while he walks
    // (gone for the day once gathered, the shell's state says so).
    if (walking && !seatPlayer && !boatState) {
      for (const spot of FORAGE_SPOTS) {
        if (forageTakenToday.has(spot.id)) continue;
        const d = Math.hypot(walkPos.x - spot.x, walkPos.z - spot.z);
        if (d < 1.9) nearCandidates.push({ kind: "forage", id: spot.id, d });
      }
    }
    // The lake dock and boat: ashore, the dock offers the rowboat;
    // afloat, only being back at the mooring offers a way ashore.
    if (boatState) {
      const d = Math.hypot(walkPos.x - LAKE.mooring[0], walkPos.z - LAKE.mooring[1]);
      if (d < 3.4) nearCandidates.push({ kind: "dock", id: "boat", d: 0.5 });
    } else if (!seatPlayer) {
      const d = Math.hypot(walkPos.x - -11.9, walkPos.z - LAKE_CZ);
      if (d < 2.7) nearCandidates.push({ kind: "dock", id: "dock", d: d * 0.8 });
    }
    // The Night the Stars Fall: offered only when every gate holds
    // at once, the summit earned, the sky cooperating, true night,
    // and the pair together at the lake pavilion (she following
    // close, or waiting at her lakeshore anchor within reach of the
    // stand). It outranks the dock prompt while it lasts; it is
    // never offered in any lesser state, and nothing anywhere else
    // names it.
    if (summitReady && !summitDone && summitMeteor && nightMix > 0.55 && !boatState && !seatPlayer) {
      const dStand = Math.hypot(walkPos.x - LAKE_PAVILION.stand[0], walkPos.z - LAKE_PAVILION.stand[1]);
      if (dStand < LAKE_PAVILION.radius) {
        const dMuse = Math.hypot(museGroup.position.x - walkPos.x, museGroup.position.z - walkPos.z);
        const dMuseStand = Math.hypot(
          museGroup.position.x - LAKE_PAVILION.stand[0],
          museGroup.position.z - LAKE_PAVILION.stand[1],
        );
        if ((followMode && dMuse < 6) || dMuseStand < LAKE_PAVILION.radius + 1.5) {
          nearCandidates.push({ kind: "summit", id: "stars-fall", d: 0.4 });
        }
      }
    }
    // Landmark visits (quest progress, not panels): the temple and
    // the aqueduct still register simply by walking up to them. The
    // temple's visit measures distance to its OBB surface, its
    // long body puts the old 7.5 centre radius INSIDE the walls on
    // the lane side, so the visit now registers at the wall, from
    // any side, as it should.
    {
      const d = footprintSurfaceDistance(templeFootprint, walkPos.x, walkPos.z);
      if (d < 2.6 && !nearCollectibles.has("lm-temple")) {
        nearCollectibles.add("lm-temple");
        opts.onPick("landmark", "temple");
      } else if (d >= 4.1) {
        nearCollectibles.delete("lm-temple");
      }
    }
    {
      const d = Math.hypot(walkPos.x - -22, walkPos.z - -25);
      if (d < 8 && !nearCollectibles.has("lm-aqueduct")) {
        nearCollectibles.add("lm-aqueduct");
        opts.onPick("landmark", "aqueduct");
      } else if (d >= 9.5) {
        nearCollectibles.delete("lm-aqueduct");
      }
    }
    opts.onWalkPosition?.(walkPos.x, walkPos.z);
    // Garden key on the ground, a discovery, not a panel, so it
    // still rewards simply walking over it.
    {
      const d = Math.hypot(walkPos.x - VILLA.gardenKey[0], walkPos.z - VILLA.gardenKey[1]);
      if (d < 1.7 && !nearCollectibles.has("garden-key")) {
        nearCollectibles.add("garden-key");
        opts.onPick("collectible", "garden-key");
      } else if (d >= 2.6) nearCollectibles.delete("garden-key");
    }
    // The forest's three discoveries, found the same way, by
    // standing before them. (The spring's radius is wider: its
    // water keeps him at the rim, and the rim is close enough.)
    for (const [id, sx, sz, r] of [
      ["forest-shrine", FOREST_SPOTS.shrine[0], FOREST_SPOTS.shrine[1], 2.4],
      ["hollow-tree", FOREST_SPOTS.hollow[0], FOREST_SPOTS.hollow[1], 2.6],
      ["hidden-spring", FOREST_SPOTS.spring[0], FOREST_SPOTS.spring[1], 3.2],
    ] as [string, number, number, number][]) {
      const d = Math.hypot(walkPos.x - sx, walkPos.z - sz);
      if (d < r && !nearCollectibles.has(id)) {
        nearCollectibles.add(id);
        opts.onPick("collectible", id);
      } else if (d >= r + 1.2) {
        nearCollectibles.delete(id);
      }
    }
    // Muse, wherever she currently is (plaza spot, or out walking):
    // a prompt candidate like everywhere else, but the wave itself
    // is a greeting, not a pop-up, so it happens on approach: once
    // per genuine meeting (see the greeting state by followMode),
    // and never while she is following him.
    {
      const mx = museGroup.position.x;
      const mz = museGroup.position.z;
      const d = Math.hypot(walkPos.x - mx, walkPos.z - mz);
      if (d < GREET_ENTER_DIST) {
        nearCandidates.push({ kind: "muse", id: "muse", d });
        nearCollectibles.add("muse");
        if (!followMode && greetingArmed) fireGreetingWave(t);
      } else if (d >= GREET_PART_DIST) {
        nearCollectibles.delete("muse");
      }
      // She turns to face the walker while they're close, unless she
      // is following or heading home, when her own steering owns her
      // heading. While she is walking her daily routine between
      // anchors her steering owns it too (museIsMoving, last frame's
      // value, close enough at one frame's lag); standing at an
      // anchor or left somewhere, she turns like always.
      if (!followMode && !museReturning && !museIsMoving) {
        if (d < 5.5) {
          const faceWalker = Math.atan2(walkPos.x - mx, walkPos.z - mz);
          museGroup.rotation.y = angleLerp(museGroup.rotation.y, faceWalker, 0.08);
        } else {
          const faceTree = Math.atan2(-MUSE.position[0], -MUSE.position[1]);
          museGroup.rotation.y = angleLerp(museGroup.rotation.y, faceTree, 0.02);
        }
      }
    }
    // Report only the nearest prompt candidate, and only on change,
    // prompts never stack.
    if (catAnimal) {
      const d = Math.hypot(walkPos.x - catAnimal.group.position.x, walkPos.z - catAnimal.group.position.z);
      if (d < 1.8) nearCandidates.push({ kind: "cat", id: "pet", d });
    }
    if (phoenixFeatherNow) {
      const d = Math.hypot(walkPos.x - featherPos.x, walkPos.z - featherPos.z);
      if (d < 2.4) nearCandidates.push({ kind: "phoenix", id: "feather", d });
    }
    if (skyWatchState) nearCandidates.push({ kind: "sky", id: "stop", d: 0.2 });
    nearCandidates.sort((a, b) => a.d - b.d);
    // Dreams have no prompts at all, nothing is offered, nothing
    // can be taken, in either kind of dream.
    const nearestNear = dreamMode ? null : (nearCandidates[0] ?? null);
    const nearKey = nearestNear ? `${nearestNear.kind}:${nearestNear.id}` : "";
    if (nearKey !== lastNearKey) {
      lastNearKey = nearKey;
      opts.onNearbyChange?.(nearestNear ? { kind: nearestNear.kind, id: nearestNear.id } : null);
    }
  }

  // --- Muse's companion movement ----------------------------------------
  // Steering for follow mode and for the walk home. Runs every frame so
  // she can also stroll back while the visitor is in overview mode.
  function showMuseBubbleInternal(text: string, t: number) {
    showBubbleText(museBubble, text, t);
  }

  function companionLineFor(t: number): string | null {
    const mx = museGroup.position.x;
    const mz = museGroup.position.z;
    // Ambient pools draw without replacement now (linePools):
    // each context has its own durable bag, so a walk around town
    // never hears the same line twice until the pool is spent.
    const pickLine = (key: string, arr: string[]) => pickPooled(key, arr);
    // Hands joined: the wandering register outranks the sightseeing one.
    if (handInHand) return pickLine("wander", WANDER_LINES);
    // The forest has its own register, and it outranks the town's.
    if (forestNorm(mx, mz) < 1.02) return pickLine("companion:forest", COMPANION_LINES.forest!);
    // The wolf, when she's near enough to be the moment.
    if (wolfGroupRef && Math.hypot(mx - wolfGroupRef.position.x, mz - wolfGroupRef.position.z) < 15) {
      return pickLine("companion:wolf", COMPANION_LINES.wolf!);
    }
    if (Math.hypot(mx - COLOSSEUM.position[0], mz - COLOSSEUM.position[1]) < 12.5) return pickLine("companion:colosseum", COMPANION_LINES.colosseum!);
    if (Math.hypot(mx - SECRET.position[0], mz - SECRET.position[1]) < 3.6) return pickLine("companion:secret", COMPANION_LINES.secret!);
    if (Math.hypot(mx - 22.8, mz + 14) < 6) return pickLine("companion:temple", COMPANION_LINES.temple!);
    if (Math.hypot(mx, mz) < 5.6) return pickLine("companion:tree", COMPANION_LINES.tree!);
    if (Math.hypot(mx - 17.5, mz + 12) < 5.5) return pickLine("companion:stars", COMPANION_LINES.stars!);
    if (Math.hypot(mx - BATHS.position[0], mz - BATHS.position[1]) < 8) return pickLine("companion:baths", [...ROMAN_PLACE_LINES.baths]);
    if (Math.hypot(mx, mz - 36) < 9) return pickLine("companion:market", [...ROMAN_PLACE_LINES.market]);
    // The Embassy, by the south gate (its PLACES entry is the site
    // of record; the spot is hard-coded here like the temple's).
    if (Math.hypot(mx - 12, mz - 43) < 6.5) return pickLine("companion:embassy", COMPANION_LINES.embassy!);
    if (wCur.sparkle > 0.4) return pickLine("companion:sparkles", COMPANION_LINES.sparkles!);
    if (wCur.rain > 0.45) {
      if (shelterAt(mx, mz) > 0.5) return pickLine("companion:sheltered", SHELTERED_LINES);
      return pickLine("companion:rain", COMPANION_LINES.rain!);
    }
    if (upgradeGroups.fountain?.visible && Math.hypot(mx - VILLA.metaSudans[0], mz - VILLA.metaSudans[1]) < 5) return pickLine("companion:meta-sudans", META_SUDANS_LINES);
    if (Math.hypot(mx - LUCRETIA.position[0], mz - LUCRETIA.position[1]) < 3.5) return pickLine("companion:lucretia", LUCRETIA_LINES);
    if (Math.hypot(mx - ATHENA_SEAT.x, mz - ATHENA_SEAT.z) < 4.5) return pickLine("companion:athena", ATHENA_LINES);
    // The town wind, noticed out loud: only when it is actually up
    // (breeze or stronger, never in calm), and only sometimes, so
    // the lake and the night keep their own moments too.
    if (currentWindState() !== "calm" && Math.random() < 0.4) {
      return pickLine("companion:wind", COMPANION_LINES.wind!);
    }
    if (Math.hypot(mx - LAKE.position[0], mz - LAKE.position[1]) < 9 && skyElevDeg < 9) return pickLine("companion:lake", COMPANION_LINES.lake!);
    // The Roman day, now and then: only what is true of today, in the
    // open, with no place or weather already claiming the moment.
    if (Math.random() < FEEL.romanLineChance) {
      const now = new Date();
      const hour = romanHour(now, (at) => solarAngles(at).elev);
      const pool = pickRomanPool(romanPools(romanDate(now), hour), Math.random);
      return pickLine(pool.key, [...pool.lines]);
    }
    if (nightMix > 0.6) return pickLine("companion:night", COMPANION_LINES.night!);
    void t;
    return pickLine("companion:generic", COMPANION_LINES.generic!);
  }

  // --- Muse's daily routine -------------------------------------------------
  // When she is not walking with the Centurion, Muse keeps a day of
  // her own around town: mornings browsing the market row, midday by
  // the Town Tree, afternoons at the Villa of Stories keeping the
  // memories, evenings on the lakeshore under the willows, and nights
  // at her forum spot under the lanterns. The town has no flowing
  // clock, its sky is the Day/Night toggle, so the day's phases
  // turn on session time (a new anchor every ROUTINE_PHASE_SECS,
  // observable within one visit), and Night on the toggle brings her
  // home to the peristyle whatever the phase. She WALKS between anchors
  // on the ordinary companion steering (streets where they serve,
  // collision rules as always), never a teleport. Follow mode
  // overrides the routine absolutely; "Stay here" pauses it where
  // she stands (routineHold) until the next anchor change, which
  // resumes her day unless she was left standing at an anchor, in
  // which case she simply stays on as that anchor's resident.
  interface RoutineAnchor {
    id: string;
    spots: [number, number][];
    face: number;
  }
  const ROUTINE_ANCHORS: Record<string, RoutineAnchor> = {
    market: { id: "market", spots: [[6.2, 35.2], [-6.2, 35.2]], face: Math.PI / 2 },
    forum: { id: "forum", spots: [[3.6, 4.2]], face: Math.atan2(-3.6, -4.2) },
    stories: { id: "stories", spots: [[-12.6, -12.4]], face: -Math.PI / 2 },
    lake: { id: "lake", spots: [[-9.7, -29.9]], face: Math.atan2(LAKE.position[0] + 9.7, LAKE.position[1] + 29.9) },
    sounds: { id: "sounds", spots: [[-14, 2.2]], face: -Math.PI / 2 },
    piscina: { id: "piscina", spots: [[-11.5, 25.6]], face: Math.PI },
    baths: { id: "baths", spots: [[24, 26.6]], face: Math.PI },
    terrace: { id: "terrace", spots: [[3.6, -27]], face: Math.PI / 8 },
    // At night she goes home (Task 40): in through the door, the lamp
    // lit, and she waits inside by the door, facing it, for him.
    night: {
      id: "night",
      spots: [[homeHouse.waitSpot.x, homeHouse.waitSpot.z]],
      face: homeHouse.waitSpot.face,
    },
  };
  const ROUTINE_DAY_ORDER = ["market", "forum", "stories", "lake"];
  /** Muse Visits: the named anchors a goto may use, as ground spots.
   *  Her routine spots where they exist, the town's own landmarks
   *  otherwise; "gaius" is dynamic and "bench" is the nearest bench. */
  const benchFront = (b: BenchDef): [number, number] => {
    const out = b.standBehind ? 0.95 : -0.72;
    return [b.x + Math.sin(b.rotY) * out, b.z + Math.cos(b.rotY) * out];
  };
  const nearestBenchFrom = (x: number, z: number): BenchDef => {
    let best = BENCHES[0]!;
    let bestD = Infinity;
    for (const b of BENCHES) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  };
  /** The nearest free seat slot to her, with its distance. */
  const nearestFreeSlot = (x: number, z: number): { bench: BenchDef; slot: number; x: number; z: number; dist: number } | null => {
    let best: { bench: BenchDef; slot: number; x: number; z: number; dist: number } | null = null;
    for (const bench of BENCHES) {
      for (const slot of [-1, 1]) {
        if (seatPlayer && seatPlayer.bench.id === bench.id && seatPlayer.slot === slot) continue;
        const p = benchSlotPos(bench, slot);
        const dist = Math.hypot(x - p.x, z - p.z);
        if (!best || dist < best.dist) best = { bench, slot, x: p.x, z: p.z, dist };
      }
    }
    return best;
  };
  const VISIT_SPOTS: Record<Exclude<VisitAnchorName, "gaius" | "bench">, [number, number]> = {
    tree: [3.6, 4.2],
    forum: [PLAYER.spawn[0], PLAYER.spawn[1] - 28],
    lakeshore: [-9.7, -29.9],
    stories: [-12.6, -12.4],
    terrace: [3.6, -27],
    market: [6.2, 35.2],
    boat: [LAKE.bank[0], LAKE.bank[1]],
    bath: [24, 26.6],
    gate: [VILLA.gate[0], VILLA.gate[1] - 1.5],
    sounds: [-14, 2.2],
    piscina: [-11.5, 25.6],
  };
  const visitSpotFor = (anchor: VisitAnchorName): [number, number] | null => {
    if (anchor === "gaius") return walking ? [walkPos.x, walkPos.z] : null;
    if (anchor === "bench") return benchFront(nearestBenchFrom(museGroup.position.x, museGroup.position.z));
    return VISIT_SPOTS[anchor];
  };
  /** The slate's coarse zone for a point: the nearest named spot
   *  within a few paces, else roaming. */
  const visitZoneAt = (x: number, z: number): string => {
    let best = "roaming";
    let bestD = 5;
    for (const [name, [sx, sz]] of Object.entries(VISIT_SPOTS)) {
      const d = Math.hypot(x - sx, z - sz);
      if (d < bestD) {
        bestD = d;
        best = name;
      }
    }
    for (const b of BENCHES) {
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < Math.min(bestD, 2.2)) {
        bestD = d;
        best = "bench";
      }
    }
    return best;
  };
  /** The next stop on her way to a goal, along the villa's walks. */
  let museRoute: { goal: string; stops: [number, number][] } = { goal: "", stops: [] };
  function nextRouteStop(goalX: number, goalZ: number): { x: number; z: number } {
    const goal = `${goalX},${goalZ}`;
    const { x, z } = museGroup.position;
    if (museRoute.goal !== goal) museRoute = { goal, stops: routeBetween([x, z], [goalX, goalZ]) };
    const { stops } = museRoute;
    while (stops.length && Math.hypot(stops[0]![0] - x, stops[0]![1] - z) < 1.1) stops.shift();
    const [nextX, nextZ] = stops[0] ?? [goalX, goalZ];
    return { x: nextX, z: nextZ };
  }
  /** Somewhere she's leading him. Follow mode is off while she does. */
  let guide: { x: number; z: number; until: number } | null = null;
  function endGuide(arrived: boolean) {
    guide = null;
    opts.onGuideEnd?.(arrived);
  }
  const ROUTINE_PHASE_SECS = 80;
  let routineHold = false;
  let routineHoldKey = "";
  let routineAnchorId = "";
  let routineSpotIdx = 0;
  let routineArrivedAt = -1000;
  let lastRoutineLineAt = -1000;
  let nextRoutineDelay = 16;
  let piscinaGolden = false;
  /** Where the hour's rhythm has her, when she isn't off on an errand. */
  let rhythmAnchor: string | null = null;
  function routineKey(): string {
    if (nightTarget > 0.5) return "night";
    const idx = Math.floor(clockTime / ROUTINE_PHASE_SECS);
    // Three stretches in four she keeps the hour; the fourth is her own.
    const base = rhythmAnchor && idx % 4 !== 3 ? rhythmAnchor : ROUTINE_DAY_ORDER[idx % ROUTINE_DAY_ORDER.length]!;
    // Once the golden carp lives in the piscina, her rounds bend to
    // it: on alternate cycles, the pond gets the Stories hour, she
    // visits her jewel, as pond-keepers do.
    if (piscinaGolden && base === "stories" && Math.floor(idx / ROUTINE_DAY_ORDER.length) % 2 === 0) {
      return "piscina";
    }
    // Rarely, her rounds take her to the baths, public hours, a
    // towel over one arm, entirely a citizen of Rome.
    if (base === "forum" && idx % 5 === 3) return "baths";
    // Festival evenings, she keeps the Sounds hour instead of the
    // lake's, the lyre is playing, and she practises the slow step
    // where the music lives.
    if (festivalTonight && base === "lake") return "sounds";
    return base;
  }
  function museAtAnyAnchor(): boolean {
    const cx = museGroup.position.x;
    const cz = museGroup.position.z;
    for (const a of Object.values(ROUTINE_ANCHORS)) {
      for (const [sx, sz] of a.spots) {
        if (Math.hypot(cx - sx, cz - sz) < 1.3) return true;
      }
    }
    return false;
  }
  function routineLinesFor(id: string): string[] {
    switch (id) {
      case "terrace":
        return [
          "This is the hour to be up here. Look back down the line and you can see the whole day we've had.",
          "The hall goes gold first, then the tree, then the gate. I've checked. Repeatedly.",
          "I come up at dusk to count the lamps as they're lit. It's a very small job, and it's mine.",
          "Everything in this estate points here, and from here everything points home.",
        ];
      case "market":
        return [
          "Morning rounds: bread still warm, grapes counted twice. Basil drives a hard bargain and I respect it entirely.",
          "I like the market before the town wakes up properly. Everything's possible at a stall at this hour.",
          "If you're choosing breakfast, the bread from the first stall. Trust the hostess.",
          "Basil swears his lentils can tell the weather. So far the lentils have the better record.",
          "Fern's flowers go first, every morning. A town that buys its flowers before its bread has its priorities exactly right.",
        ];
      case "forum":
        return [
          ...(COMPANION_LINES.tree ?? []),
          "Midday by the tree is my thinking hour. The town turns around it, and so do I.",
        ];
      case "stories":
        return [
          "Afternoons are for the Villa. The memories live here, and I keep them the way Pip keeps his chapters: unfinished on purpose.",
          "I was just re-reading our letters in the drawer. One of them still makes me smile.",
          "Every house in this town keeps one story unfinished. Mine's the one where you walk in.",
          "Pip asked after his lighthouse keeper today. Still collecting bottled weather, still refusing to end. I respect the method.",
          "I shelve the days as they come, love. Some of them I shelve where I can reach them without a ladder.",
        ];
      case "lake":
        return [
          "Evenings I come down to the lake. The willows, the water going gold. It's the town's quietest hour, and mine.",
          "The dock lantern will be lit soon. I like watching the light come up on the water.",
          "If you ever want the boat, Centurion, you know where I keep my evenings.",
          "The heron was here again. We have an arrangement: I don't ask where she goes, she doesn't ask why I talk to the water.",
          "Some evenings the lake is so still it feels like the town is holding its breath to let it rest.",
        ];
      case "piscina":
        return [
          "My rounds include the pond now. A pond-keeper checks her jewel; it is practically the law of the place.",
          "She's well, turning in the light like she owns the water. In a sense, she does.",
          "The Romans pampered their pond fish outrageously. I am merely continuing an honourable tradition.",
        ];
      case "baths":
        return [
          "Public hours at the baths. A girl is entitled to her steam and her gossip like any citizen.",
          "The caldarium on a quiet hour is the town thinking warm thoughts. I come to listen.",
          "The steam does something honest to people, nobody performs in a caldarium. Best conversation in Rome, some days.",
          "I take the long way back from the baths on purpose. Warm bones, slow road, nothing owed to anyone.",
        ];
      case "night":
        return [
          ...(COMPANION_LINES.night ?? []),
          "Night watch is mine: lanterns lit, forum quiet, one hostess awake to keep the town company.",
        ];
      default:
        return COMPANION_LINES.generic ?? [];
    }
  }

  function updateMuseCompanion(dt: number, t: number) {
    if (secretMoment) {
      museIsMoving = false;
      return;
    }
    // Hide-and-seek: while she is hidden, she simply is not here,
    // no group, no routine, no chatter. placeMuseAt brings her back.
    if (museHidden) {
      if (museGroup) museGroup.visible = false;
      museIsMoving = false;
      return;
    }
    if (museGroup && !museGroup.visible) museGroup.visible = true;
    // Seeking bookkeeping: how long this walk has run, and the
    // closest he has come to her while not following her.
    if (walking) {
      if (seekWalkStartT < 0) seekWalkStartT = t;
      if (!followMode) {
        const dSeek = Math.hypot(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z);
        if (dSeek < seekClosest) seekClosest = dSeek;
      }
    } else {
      seekWalkStartT = -1;
      seekClosest = Infinity;
    }
    if (boatState?.museAboard) {
      // In the bow of the rowboat: parked facing him (her group is
      // positioned by the rowing code), the seated pose applied in
      // driveClipAnims. Her steering owns nothing while she rows.
      museIsMoving = false;
      return;
    }
    // Player 2 (Task 3): a firm push on her stick stands her up from a
    // bench (B and X do too, in pad2Press); the pad2 branch below then
    // takes her. The follow harness never stands her: it waits for him.
    if (seatMuse && !museSeatTarget && pad2Live(pad2LastInputAt, t) && Math.hypot(pad2X, pad2Y) > 0.5) standMuseUp();
    if (seatMuse) {
      // Seated beside him on the bench: parked (her steering and the
      // collision resolve stay off, the seat point is inside the
      // bench's footprint by design), facing the way the bench
      // faces. The seated pose itself is applied in driveClipAnims.
      museIsMoving = false;
      museGroup.position.y = groundHeightAt(museGroup.position.x, museGroup.position.z);
      museGroup.rotation.y = angleLerp(museGroup.rotation.y, seatMuse.bench.rotY + Math.PI, 0.12);
      return;
    }
    if (danceState) {
      // Dancing: her position is the glide's (and then the step's);
      // steering stands down entirely.
      museIsMoving = false;
      return;
    }
    if (pairState) {
      // A pair moment: her position is the glide's; she faces him
      // for the length of the clip, then ordinary life resumes. The
      // turn is paced by time, not by frame (0.12 per 1/60 s), and
      // completes with the glide: a browser running the town at a
      // few frames a second left her a quarter turn short of him
      // at the clip's peak, in profile beside him.
      museIsMoving = false;
      const toHim = Math.atan2(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z);
      museGroup.rotation.y = pairState.glide ? angleLerp(museGroup.rotation.y, toHim, 1 - Math.pow(1 - 0.12, dt * 60)) : toHim;
      return;
    }
    if (skyWatchState) {
      // Watching the sky: parked at his side, turned to the sun.
      museIsMoving = false;
      museGroup.rotation.y = angleLerp(museGroup.rotation.y, skyWatchState.facing, 0.1);
      return;
    }
    if (bathState?.museIn) {
      // In the caldarium with him: parked on her ledge spot (the
      // glide in updateBaths settles her there), facing him across
      // half a metre of warm water.
      museIsMoving = false;
      if (bathMuseGlide >= 1) {
        museGroup.position.set(BATHS.soakHers[0], terrainHeight(BATHS.soakHers[0], BATHS.soakHers[1]), BATHS.soakHers[1]);
        museGroup.rotation.y = angleLerp(museGroup.rotation.y, Math.PI, 0.12);
      }
      return;
    }
    // --- Player 2 (Task 3) -------------------------------------------
    // While pad2 carries fresh input her own brain yields, the way it
    // yields to a guide or a bench errand, and the natural-motion
    // driver (padDriver.ts) executes the stick: eased pace, swept
    // turns, a settle toward him at rest. The follow harness is the
    // same driver fed a synthetic command, his pace at an offset, so
    // the private port receives the gait by the same road. A few
    // seconds of pad silence folds her back mid-stride: nothing below
    // is reset beyond the follow settle, so her follow or routine
    // simply resumes from wherever the driver left her.
    // A director's pad verb decays to rest on its own when its hold
    // runs out: the stick drops to neutral, the driver bleeds pace,
    // and the ordinary fold-back follows a breath later.
    if (pad2Source === "director" && t > pad2DirectorUntil && (pad2X !== 0 || pad2Y !== 0)) {
      pad2X = 0;
      pad2Y = 0;
    }
    const padLive = pad2Live(pad2LastInputAt, t);
    const harnessLive = driverFollow !== "off" && walking && !padLive;
    if ((padLive || harnessLive) && !museSeatTarget) {
      if (handInHand) {
        // Walking off under her own stick lets go of his hand.
        handInHand = false;
        handHurryTime = 0;
        opts.onHandInHandChange?.(false, "pad2");
      }
      followFrozenTarget = null;
      followSettled = false;
      playerStillTime = 0;
      routineArrivedAt = -1000;
      const cur = museGroup.position;
      if (!pad2Driving) {
        pad2Driving = true;
        pad2Drive.heading = museGroup.rotation.y;
        pad2Drive.vx = 0;
        pad2Drive.vz = 0;
      }
      let cmd: DriverCommand;
      if (padLive) {
        // Camera-relative like his: against the walk camera's input
        // reference yaw on foot, the orbit camera's facing otherwise.
        const camYaw = walking ? inputYawRef : Math.atan2(controls.target.x - camera.position.x, controls.target.z - camera.position.z);
        const stick = stickToWorld(pad2X, pad2Y, camYaw);
        cmd = { dirX: stick.dirX, dirZ: stick.dirZ, speed: paceForTilt(stick.tilt) };
      } else {
        cmd = followCommand({
          museX: cur.x,
          museZ: cur.z,
          gaiusX: walkPos.x,
          gaiusZ: walkPos.z,
          gaiusHeading: walkHeading,
          gaiusSpeed: playerSpeedSm,
          offset: driverFollow === "behind" ? "behind" : "beside",
        });
      }
      // A slide in progress owns direction and pace, as his does.
      if (sliding(pad2Run)) {
        pad2Run.left -= dt;
        cmd = { dirX: pad2Run.dirX, dirZ: pad2Run.dirZ, speed: slideSpeed(pad2Run) };
        if (pad2Run.left <= 0) endSlide(pad2Run, t);
      }
      const out = driverStep(pad2Drive, cmd, dt);
      // The same substepped resolve as her steering, at her clearance,
      // with his body counted whenever he is on foot (hers already
      // counts for him), then the town's rim.
      let newX = cur.x;
      let newZ = cur.z;
      const stepLen = Math.hypot(out.stepX, out.stepZ);
      if (stepLen > 1e-6) {
        const sub = Math.max(1, Math.ceil(stepLen / 0.13));
        for (let i = 0; i < sub; i++) {
          const r = resolveCollisions(
            newX + out.stepX / sub,
            newZ + out.stepZ / sub,
            0.45,
            walking ? { x: walkPos.x, z: walkPos.z, r: 0.5 } : undefined,
          );
          newX = r.x;
          newZ = r.z;
        }
        {
          const bounded = clampToWorld(newX, newZ, { norm: forestNorm, cx: FOREST.cx, cz: FOREST.cz });
          newX = bounded.x;
          newZ = bounded.z;
        }
        // A slide into a wall ends there.
        if (sliding(pad2Run) && Math.hypot(newX - cur.x, newZ - cur.z) < stepLen * 0.3) endSlide(pad2Run, t);
      }
      // Facing: swept by the driver on the move; at rest near him,
      // settled toward him at conversational distance.
      if (!out.moving && walking) pad2Drive.heading = settleFacing(pad2Drive.heading, newX, newZ, walkPos.x, walkPos.z, dt);
      museGroup.rotation.y = pad2Drive.heading;
      // Her hop rides on her group above the smoothed ground (her
      // animator has no jump clips, so the hop itself is the motion).
      const landed = stepJump(pad2Hop, dt, t, true);
      {
        const targetGY = groundHeightAt(newX, newZ);
        if (!Number.isFinite(museGroundSm)) museGroundSm = targetGY;
        const dy = targetGY - museGroundSm;
        if (Math.abs(dy) > 1.1) museGroundSm = targetGY;
        else museGroundSm += THREE.MathUtils.clamp(dy, -5 * dt, 5 * dt);
      }
      if (landed) puffDust(newX, museGroundSm, newZ);
      museGroup.position.set(newX, museGroundSm + pad2Hop.y, newZ);
      museWalkPhase += dt * (2.2 + out.speed * 1.55);
      museIsMoving = out.moving;
      return;
    }
    pad2Driving = false;
    let routineTarget: { x: number; z: number } | null = null;
    // --- Muse Visits (Task 4) -----------------------------------------
    // A visit errand outranks her routine, her companion follow and a
    // guide; a pad verb (above) outranks the errand. She walks on her
    // ordinary steering, street-pulled and collision-aware, and lands
    // a natural distance short of a person, on the mark for a seat.
    if (visitActive && visitGoto) {
      // "To Gaius" follows him as he moves, re-routing only when he
      // has shifted a stride, so the walk planner is not asked each frame.
      if (visitGoto.toGaius && walking && Math.hypot(walkPos.x - visitGoto.x, walkPos.z - visitGoto.z) > 1.5) {
        visitGoto.x = walkPos.x;
        visitGoto.z = walkPos.z;
      }
      const here = museGroup.position;
      const dGoal = Math.hypot(here.x - visitGoto.x, here.z - visitGoto.z);
      const stopDist = visitGoto.seat ? 0.2 : visitGoto.toGaius ? 1.7 : 0.6;
      if (dGoal <= stopDist || t > visitGoto.until) {
        const done = visitGoto;
        visitGoto = null;
        if (done.seat && dGoal <= 0.6) {
          seatMuse = { bench: done.seat.bench, slot: done.seat.slot };
          museGroup.position.set(done.x, groundHeightAt(done.x, done.z), done.z);
          museGroup.rotation.y = done.seat.bench.rotY + Math.PI;
          visitHold = null;
        } else {
          visitHold = { x: here.x, z: here.z, withGaius: done.toGaius };
        }
        museIsMoving = false;
        return;
      }
      routineTarget = { x: visitGoto.x, z: visitGoto.z };
    } else if (visitActive && visitHold) {
      // Idle where she was left, in character: facing him when he is
      // near, and following him back to conversational distance when
      // "to Gaius" is her standing direction and he walks off.
      const here = museGroup.position;
      const dHim = Math.hypot(walkPos.x - here.x, walkPos.z - here.z);
      if (visitHold.withGaius && walking && dHim > 4.5) {
        visitGoto = { x: walkPos.x, z: walkPos.z, toGaius: true, seat: null, until: t + 60 };
      } else {
        museIsMoving = false;
        here.y = groundHeightAt(here.x, here.z);
        if (walking && dHim < 4.5) {
          museGroup.rotation.y = angleLerp(museGroup.rotation.y, Math.atan2(walkPos.x - here.x, walkPos.z - here.z), 0.06);
        }
        return;
      }
    }
    if (guide && !routineTarget) {
      const here = museGroup.position;
      const fromHim = Math.hypot(walkPos.x - here.x, walkPos.z - here.z);
      const hisWay = Math.hypot(walkPos.x - guide.x, walkPos.z - guide.z);
      const herWay = Math.hypot(here.x - guide.x, here.z - guide.z);
      if (herWay < 2 && hisWay < 5) endGuide(true);
      else if (t > guide.until || fromHim > 30) endGuide(false);
      else if (herWay < 1.3 || fromHim > 9) {
        // A guide waits: turned back toward him until he catches up.
        museIsMoving = false;
        here.y = groundHeightAt(here.x, here.z);
        museGroup.rotation.y = angleLerp(museGroup.rotation.y, Math.atan2(walkPos.x - here.x, walkPos.z - here.z), 0.08);
        return;
      } else routineTarget = { x: guide.x, z: guide.z };
    }
    if (!routineTarget && !followMode && !museReturning) {
      // --- Her daily routine (see the ROUTINE_ANCHORS block above) ---
      const key = routineKey();
      // Rank 10: her night anchor becomes the lake shore: she waits
      // where the moonlight is, by the dock and the boat.
      const anchor =
        key === "night" && affectionRank >= 10
          ? { id: "night", spots: [[-9.7, -29.9]] as [number, number][], face: Math.atan2(LAKE.position[0] + 9.7, LAKE.position[1] + 29.9) }
          : ROUTINE_ANCHORS[key]!;
      if (routineHold) {
        if (key === routineHoldKey || museAtAnyAnchor()) {
          // Left by "Stay here", her day stays paused through this
          // anchor's stretch, at once if the phase hasn't turned,
          // and by residence if she was left standing at an anchor:
          // she simply stays on as that anchor's resident.
          routineHoldKey = key;
          museIsMoving = false;
          return;
        }
        // The day has moved on and she was left somewhere that is
        // no anchor: her schedule quietly resumes.
        routineHold = false;
      }
      if (routineAnchorId !== key) {
        routineAnchorId = key;
        routineSpotIdx = 0;
        routineArrivedAt = -1000;
      }
      const spot = anchor.spots[routineSpotIdx % anchor.spots.length]!;
      const dSpot = Math.hypot(museGroup.position.x - spot[0], museGroup.position.z - spot[1]);
      // Within a pace counts as arrived: her steering target is
      // street-pulled (above), so she legitimately stops a little
      // short of the exact spot, the way a person does.
      if (dSpot <= 1.05) {
        const dPlayer0 = Math.hypot(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z);
        // Rank 8+: sometimes SHE comes to HIM: when he's out in the
        // town but not yet beside her, she walks partway to meet him,
        // once in a while, never on a nagging loop.
        if (
          !seekDone &&
          !followMode &&
          !quietMode &&
          walking &&
          seekWalkStartT > 0 &&
          t - seekWalkStartT > 240 &&
          seekClosest > 6 &&
          !dreamMode &&
          !seatMuse &&
          boatState === null &&
          t - lastInitiateAt > 90
        ) {
          // Seeking: four minutes of wandering without ever coming
          // near her, she comes to find him, all the way to him.
          seekDone = true;
          seekActive = true;
          lastInitiateAt = t;
          initiateTarget = { x: walkPos.x, z: walkPos.z };
          initiateUntil = t + 90;
          routineTarget = initiateTarget;
        } else if (
          affectionRank >= 8 &&
          walking &&
          dPlayer0 > 4.5 &&
          dPlayer0 < 15 &&
          t - lastInitiateAt > 90
        ) {
          lastInitiateAt = t;
          initiateTarget = {
            x: (museGroup.position.x + walkPos.x) / 2,
            z: (museGroup.position.z + walkPos.z) / 2,
          };
          initiateUntil = t + 25;
          routineTarget = initiateTarget;
        } else {
        // At her anchor: idle in character for the place. She faces
        // the anchor's own outlook, unless the Centurion is near,
        // when she turns to him like always. At the market she
        // browses: every so often she drifts to the next stall.
        museIsMoving = false;
        if (routineArrivedAt < 0) routineArrivedAt = t;
        const dPlayer = dPlayer0;
        const face =
          walking && dPlayer < 4.5
            ? Math.atan2(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z)
            : anchor.face;
        museGroup.rotation.y = angleLerp(museGroup.rotation.y, face, 0.05);
        museGroup.position.y = groundHeightAt(museGroup.position.x, museGroup.position.z);
        if (anchor.spots.length > 1 && t - routineArrivedAt > 18) {
          routineSpotIdx += 1;
          routineArrivedAt = -1000;
        }
        // A line for the place and the hour, when he's near enough
        // in walk mode to hear it.
        if (walking && !quietMode && dPlayer < 13 && t - lastRoutineLineAt > nextRoutineDelay && museBubble.hideAt < t) {
          const lines = routineLinesFor(key);
          const line = pickPooled(`routine:${key}`, lines);
          if (line) {
            showMuseBubbleInternal(line, t);
            lastRoutineLineAt = t;
            nextRoutineDelay = 21 + Math.random() * 14;
          }
        }
        return;
        }
      }
      if (!routineTarget) routineTarget = { x: spot[0], z: spot[1] };
      // A rank-8+ meeting-him-partway errand outranks the anchor
      // until she reaches the meeting point, he reaches her, or it
      // lapses, then her day resumes as if nothing happened.
      if (initiateTarget) {
        const dMeet = Math.hypot(museGroup.position.x - initiateTarget.x, museGroup.position.z - initiateTarget.z);
        const dPl = Math.hypot(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z);
        if (t > initiateUntil || dMeet < 0.8 || dPl < 3) {
          if (seekActive) {
            seekActive = false;
            if (dPl < 3.4) {
              showMuseBubbleInternal(pickPooled("seek", SEEK_LINES), t);
            }
          }
          initiateTarget = null;
        } else {
          routineTarget = initiateTarget;
        }
      }
    }
    let targetX: number;
    let targetZ: number;
    if (followMode && !visitGoto) {
      if (!walking) {
        museIsMoving = false;
        playerStillTime = 0;
        followFrozenTarget = null;
        followSettled = false;
        return;
      }
      if (museSeatTarget) {
        // She's on her way to the bench's other seat: that slot is
        // the whole errand (no beside-him offset, no street pull).
        targetX = museSeatTarget.x;
        targetZ = museSeatTarget.z;
      } else {
      // Beside and a step behind the Centurion: back along his heading
      // and over to his side, so she walks with him, not on his heels
      // and never in front of the camera's subject.
      const fx = Math.sin(walkHeading);
      const fz = Math.cos(walkHeading);
      const rx = Math.cos(walkHeading);
      const rz = -Math.sin(walkHeading);
      // Hand in hand (rank 4+), she walks closer: at his side, barely a
      // step behind, instead of the usual companionable offset. Rain
      // changes nothing here any more (umbrellas removed, Nov 1): the
      // offsets are the dry-weather ones in every weather.
      const backOff = handInHand ? 0.9 : 1.45;
      const sideOff = handInHand ? 0.68 : 1.1;
      targetX = walkPos.x - fx * backOff + rx * sideOff;
      targetZ = walkPos.z - fz * backOff + rz * sideOff;
      // Prefer the paths: when the Centurion is on or near a street,
      // pull her target toward the nearest street centreline so the
      // pair mostly stroll the cobbles together instead of the lawns.
      if (streetDistance(walkPos.x, walkPos.z) < 3.2) {
        const ns = nearestStreetPoint(targetX, targetZ);
        if (ns.dist < 2.4) {
          targetX = targetX * 0.62 + ns.x * 0.38;
          targetZ = targetZ * 0.62 + ns.z * 0.38;
        }
      }
      // The orbit fix (see the settle state by followMode): while
      // the Centurion stands still, her target freezes where it
      // was a moment after he stopped, his turning in place no
      // longer sweeps it around him, and once she has settled at
      // it, her steering stands down until he moves again. A bench
      // errand is exempt: its slot is a fixed point already.
      if (!museSeatTarget) {
        const disp = Math.hypot(walkPos.x - followPrevX, walkPos.z - followPrevZ);
        followPrevX = walkPos.x;
        followPrevZ = walkPos.z;
        followPlayerMoving = dt > 0.0001 ? disp / dt > 0.3 : isMoving;
        if (followPlayerMoving) {
          playerStillTime = 0;
          followFrozenTarget = null;
          followSettled = false;
        } else {
          playerStillTime += dt;
          if (playerStillTime > 0.4) {
            if (!followFrozenTarget) followFrozenTarget = { x: targetX, z: targetZ };
            targetX = followFrozenTarget.x;
            targetZ = followFrozenTarget.z;
            if (followSettled) {
              museIsMoving = false;
              const face = Math.atan2(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z);
              museGroup.rotation.y = angleLerp(museGroup.rotation.y, face, 0.07);
              museGroup.position.y = groundHeightAt(museGroup.position.x, museGroup.position.z);
              return;
            }
          }
        }
      }
      }
    } else if (routineTarget) {
      ({ x: targetX, z: targetZ } = nextRouteStop(routineTarget.x, routineTarget.z));
    } else {
      ({ x: targetX, z: targetZ } = nextRouteStop(MUSE.position[0], MUSE.position[1]));
    }
    // Sanitize the target: if it falls inside an obstacle's exclusion
    // (her beside-the-Centurion spot can land inside a booth when he
    // stands by the market, or inside a house's OBB when he stands at
    // its wall), push it out to the nearest edge point, otherwise
    // she grinds against the obstacle forever, wedged on the far
    // side of a wall from him. A bench seat slot is exempt: it is
    // inside the bench's footprint on purpose, and she parks there
    // under the seated rules, not the steering ones.
    if (!museSeatTarget) {
      const clean = resolveCollisions(targetX, targetZ, 0.45);
      targetX = clean.x;
      targetZ = clean.z;
    }
    const cur = museGroup.position;
    const toX = targetX - cur.x;
    const toZ = targetZ - cur.z;
    const dist = Math.hypot(toX, toZ);
    const arrive = museSeatTarget ? 0.13 : followMode ? 0.38 : 0.22;
    // Close enough counts as arrived: if she's beside him and the last
    // stretch to her exact spot is blocked, she settles where she is
    // instead of pushing against the blocker. (Not for a bench seat:
    // the slot itself is the point, and it is always reachable.)
    const closeEnough =
      !museSeatTarget && followMode && dist < 1.4 && Math.hypot(walkPos.x - cur.x, walkPos.z - cur.z) < 1.95;
    if (dist <= arrive || closeEnough) {
      museIsMoving = false;
      // Arriving beside a stationary Centurion latches the settle
      // (orbit fix): from here the frozen-target branch above
      // holds her in place, facing him, until he moves again.
      if (followMode && !followPlayerMoving && !museSeatTarget) followSettled = true;
      if (museSeatTarget) {
        // Arrived at the bench: take the seat beside him.
        seatMuse = { bench: museSeatTarget.bench, slot: museSeatTarget.slot };
        museGroup.position.set(
          museSeatTarget.x,
          groundHeightAt(museSeatTarget.x, museSeatTarget.z),
          museSeatTarget.z,
        );
        museSeatTarget = null;
        return;
      }
      if (museReturning && !followMode) {
        museReturning = false;
        museGroup.position.set(MUSE.position[0], groundHeightAt(MUSE.position[0], MUSE.position[1]), MUSE.position[1]);
      }
      if (followMode && walking) {
        // Waiting nearby: face the Centurion while he reads, chats,
        // or simply stands, quiet company, not hovering.
        const face = Math.atan2(walkPos.x - cur.x, walkPos.z - cur.z);
        museGroup.rotation.y = angleLerp(museGroup.rotation.y, face, 0.07);
      }
      return;
    }
    museIsMoving = true;
    let dirX = toX / dist;
    let dirZ = toZ / dist;
    // Detour steering: she must never grind against a wall when the
    // Centurion is on the other side of a building. Two probes bend
    // her heading around whatever blocks her: a short probe a step
    // ahead, and a line-of-sight probe along the straight path to
    // her target (sampled at its quarter points), if either comes
    // within her clearance of a surface, she steers TANGENTIALLY
    // along that surface (toward whichever side probes clearer),
    // which carries her along the wall and around its corner, where
    // the direct heading takes over again. Works identically for
    // round props and OBB walls, via the shared surface query.
    {
      let bend: { nx: number; nz: number } | null = null;
      const probeX = cur.x + dirX * 1.05;
      const probeZ = cur.z + dirZ * 1.05;
      const ahead = nearestObstacleSurface(probeX, probeZ);
      if (ahead.dist < 0.75) bend = ahead;
      if (!bend && dist > 2.2) {
        for (const f of [0.3, 0.55, 0.8]) {
          const sx = cur.x + toX * f;
          const sz = cur.z + toZ * f;
          const s = nearestObstacleSurface(sx, sz);
          if (s.dist < 0.5) {
            bend = s;
            break;
          }
        }
      }
      if (bend) {
        const awayX = bend.nx;
        const awayZ = bend.nz;
        const t1x = -awayZ;
        const t1z = awayX;
        const clear1 = nearestObstacleSurface(cur.x + (dirX + t1x) * 1.6, cur.z + (dirZ + t1z) * 1.6).dist;
        const clear2 = nearestObstacleSurface(cur.x + (dirX - t1x) * 1.6, cur.z + (dirZ - t1z) * 1.6).dist;
        const s = clear1 >= clear2 ? 1 : -1;
        dirX += t1x * s * 0.95 + awayX * 0.25;
        dirZ += t1z * s * 0.95 + awayZ * 0.25;
        const dlen = Math.hypot(dirX, dirZ) || 1;
        dirX /= dlen;
        dirZ /= dlen;
      }
    }
    // Her own unstuck: a dodge sidestep in progress bends the heading.
    if (t < museDodge.until) {
      dirX = dirX * 0.3 + museDodge.x * 0.85;
      dirZ = dirZ * 0.3 + museDodge.z * 0.85;
      const dlen = Math.hypot(dirX, dirZ) || 1;
      dirX /= dlen;
      dirZ /= dlen;
    }
    const targetHeading = Math.atan2(dirX, dirZ);
    museGroup.rotation.y = angleLerp(museGroup.rotation.y, targetHeading, opts.reducedMotion ? 1 : 0.13);
    // Graceful pace: unhurried nearby, brisk enough to catch up from
    // across the peristyle, easing off as she arrives.
    let speed = followMode ? THREE.MathUtils.clamp(dist * 1.15, 1.1, 5.3) : 3.1;
    if (followMode && isMoving) speed = Math.max(speed, 3.2);
    // Matched stride: hands joined, she keeps his stroll pace,
    // a brief extra turn of speed only while she regains his side
    // from a real distance, then she settles back to wandering.
    if (followMode && handInHand) speed = Math.min(speed, dist > 2.4 ? 3.3 : 2.45);
    if (dist < 1.1) speed = Math.min(speed, 1.5);
    // Orbit fix, the other half: while he stands still, her pace
    // eases with the remaining distance instead of holding the
    // 1.1 m/s floor, the last stretch to her frozen spot is a
    // glide that lands inside the arrival radius, never a stride
    // that overshoots and must come back around him.
    if (followMode && !followPlayerMoving && !museSeatTarget) {
      speed = Math.min(speed, Math.max(0.28, dist * 1.5));
    }
    // Keep out of obstacles (buildings' OBBs, the tree, benches, the
    // walker): the same substepped resolve the Centurion uses, at
    // her slightly smaller clearance, so she can no more tunnel
    // through a wall at catch-up speed than he can at run speed.
    let newX = cur.x;
    let newZ = cur.z;
    {
      const totalStep = speed * dt;
      const subSteps = Math.max(1, Math.ceil(totalStep / 0.13));
      for (let s = 0; s < subSteps; s++) {
        const candX = newX + (dirX * totalStep) / subSteps;
        const candZ = newZ + (dirZ * totalStep) / subSteps;
        // On a bench errand both resolves stand down: her seat slot
        // is inside the bench's footprint and within companion
        // distance of the Centurion, exactly the two exclusions
        // that would otherwise stall her a step short forever.
        const resolved = museSeatTarget
          ? { x: candX, z: candZ }
          : resolveCollisions(
              candX,
              candZ,
              0.45,
              followMode && walking ? { x: walkPos.x, z: walkPos.z, r: 0.5 } : undefined,
            );
        newX = resolved.x;
        newZ = resolved.z;
      }
    }
    // Her boundary is his: the town disc, union the forest lobe,
    // she follows him into the wood and no further than he can go.
    {
      const bounded = clampToWorld(newX, newZ, { norm: forestNorm, cx: FOREST.cx, cz: FOREST.cz });
      newX = bounded.x;
      newZ = bounded.z;
    }
    const prevMX = cur.x;
    const prevMZ = cur.z;
    {
      const targetGY = groundHeightAt(newX, newZ);
      if (!Number.isFinite(museGroundSm)) museGroundSm = targetGY;
      const dy = targetGY - museGroundSm;
      if (Math.abs(dy) > 1.1) museGroundSm = targetGY;
      else museGroundSm += THREE.MathUtils.clamp(dy, -5 * dt, 5 * dt);
      museGroup.position.set(newX, museGroundSm, newZ);
    }
    museWalkPhase += dt * (2.2 + speed * 1.55);
    // Her unstuck bookkeeping: pushing without moving for half a
    // second earns a dodge, a sideways step around the blocker,
    // on the side away from the Centurion so they never mirror-wedge.
    {
      const disp = Math.hypot(newX - prevMX, newZ - prevMZ);
      if (disp < speed * dt * 0.3 && t >= museDodge.until) {
        museStuckTime += dt;
      } else {
        museStuckTime = Math.max(0, museStuckTime - dt * 2);
      }
      if (museStuckTime > 0.5) {
        museStuckTime = 0;
        // Default: sidestep perpendicular to her heading. When the
        // Centurion is close, sidestep tangentially around HIM instead,
        // so the pair separate rather than pin across a prop.
        let dodgeX = dirZ;
        let dodgeZ = -dirX;
        const toPlayer = Math.hypot(walkPos.x - cur.x, walkPos.z - cur.z);
        if (followMode && toPlayer < 2.2 && toPlayer > 0.001) {
          const px = (cur.x - walkPos.x) / toPlayer;
          const pz = (cur.z - walkPos.z) / toPlayer;
          dodgeX = -pz;
          dodgeZ = px;
        }
        museDodge.x = dodgeX;
        museDodge.z = dodgeZ;
        museDodge.until = t + 0.45;
      }
    }

    // Sparing companion chatter while accompanying: a short warm line
    // fitted to the place and moment, at most every ~40 seconds, and
    // never while another bubble is on screen.
    if (followMode && walking && !quietMode && t - lastCompanionLineAt > nextCompanionDelay && museBubble.hideAt < t) {
      const line = companionLineFor(t);
      if (line) {
        showMuseBubbleInternal(line, t);
        lastCompanionLineAt = t;
        nextCompanionDelay = 38 + Math.random() * 32;
      }
    }
  }

  // --- The secret-place moment: a held hand, and a kiss ---------------
  // Only ever at the secret terrace, only when the player initiates it (the
  // shell calls playHandHold / playKiss from the secret-place buttons).
  // The two step close and face each other; a kiss leans in with soft,
  // never-locked joints, gentle head tilts, a small forward lean, eyes
  // closed where the models have eyelid morphs, gold heart sparkles,
  // then they step back to exactly where they stood. The scene itself
  // enforces the place: the midpoint of the pair must be on the
  // terrace, in walk mode, with the two already near each other.
  const heartGroup = new THREE.Group();
  const heartSprites: { sprite: THREE.Sprite; ox: number; oz: number; phase: number }[] = [];
  {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      g.font = "104px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#ff6f9c";
      g.fillText("♥", 64, 70);
    }
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 9; i++) {
      const gold = i % 3 === 0;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          opacity: 0,
          color: gold ? 0xffd34e : 0xffffff,
        }),
      );
      sprite.scale.setScalar(gold ? 0.16 : 0.24);
      heartGroup.add(sprite);
      heartSprites.push({
        sprite,
        ox: (Math.random() - 0.5) * 0.9,
        oz: (Math.random() - 0.5) * 0.9,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  heartGroup.visible = false;
  world.add(heartGroup);

  interface SecretMoment {
    kind: "hand" | "kiss" | "forehead";
    start: number;
    total: number;
    museFrom: THREE.Vector3;
    playerFrom: THREE.Vector3;
    museTo: THREE.Vector3;
    playerTo: THREE.Vector3;
    mid: THREE.Vector3;
    fired: boolean;
  }
  let secretMoment: SecretMoment | null = null;

  function startSecretMoment(kind: "hand" | "kiss"): boolean {
    return startCloseMoment(kind, SECRET.position[0], SECRET.position[1], 4.6);
  }

  /** The summit's foreheads-rest: the same close-moment machinery at
   *  the lake pavilion, the pair step close, foreheads together,
   *  eyes closed, held while the meteors streak. No hearts, no kiss:
   *  the terrace keeps its own register; the lake's is quieter. */
  function startSummitMoment(): boolean {
    return startCloseMoment("forehead", LAKE_PAVILION.stand[0], LAKE_PAVILION.stand[1], LAKE_PAVILION.radius + 1.2);
  }

  function startCloseMoment(kind: "hand" | "kiss" | "forehead", cx: number, cz: number, areaR: number): boolean {
    if (secretMoment || !walking) return false;
    const mp = museGroup.position;
    const pp = avatar.position;
    const dist = Math.hypot(mp.x - pp.x, mp.z - pp.z);
    if (dist > 4.2) return false;
    const mid = new THREE.Vector3((mp.x + pp.x) / 2, 0, (mp.z + pp.z) / 2);
    if (Math.hypot(mid.x - cx, mid.z - cz) > areaR) return false;
    // If they've been sitting on the terrace bench, the moment
    // starts by rising from it: the seat state clears (the servo
    // eases their pelvises back to standing) and the choreography
    // glides them together from the seats.
    standUpFromBench();
    const dirX = (pp.x - mp.x) / (dist || 1);
    const dirZ = (pp.z - mp.z) / (dist || 1);
    const gap = kind === "kiss" ? 0.55 : kind === "forehead" ? 0.52 : 0.9;
    const museTo = new THREE.Vector3(mid.x - (dirX * gap) / 2, 0, mid.z - (dirZ * gap) / 2);
    const playerTo = new THREE.Vector3(mid.x + (dirX * gap) / 2, 0, mid.z + (dirZ * gap) / 2);
    secretMoment = {
      kind,
      start: clock.getElapsedTime(),
      total: kind === "kiss" ? 5.2 : kind === "forehead" ? 7.5 : 3.4,
      museFrom: mp.clone(),
      playerFrom: pp.clone(),
      museTo,
      playerTo,
      mid,
      fired: false,
    };
    heartGroup.position.set(mid.x, terrainHeight(mid.x, mid.z) + 1.9, mid.z);
    // The foreheads-rest keeps its own quieter register: no hearts.
    heartGroup.visible = kind !== "forehead";
    return true;
  }

  const smoothstep = (k: number) => {
    const c = THREE.MathUtils.clamp(k, 0, 1);
    return c * c * (3 - 2 * c);
  };

  function updateSecretMoment(t: number) {
    if (!secretMoment) return;
    const m = secretMoment;
    const e = t - m.start;
    if (e >= m.total) {
      // Restore everything exactly as it was.
      museGroup.position.copy(m.museFrom);
      museGroup.position.y = groundHeightAt(m.museFrom.x, m.museFrom.z);
      avatar.position.copy(m.playerFrom);
      avatar.position.y = groundHeightAt(m.playerFrom.x, m.playerFrom.z);
      walkPos.set(m.playerFrom.x, 0, m.playerFrom.z);
      museInner.rotation.set(0, 0, 0);
      playerInner.rotation.set(0, 0, 0);
      if (museRig) poseBone(museRig, museRig.head, 0, 0, 0);
      if (playerRig) poseBone(playerRig, playerRig.head, 0, 0, 0);
      setBlink(museBlink, 0);
      setBlink(playerBlink, 0);
      heartGroup.visible = false;
      secretMoment = null;
      return;
    }
    // Step close over the first stretch, hold, step back at the end.
    const stepIn = smoothstep(e / 1.15);
    const stepOut = smoothstep((e - (m.total - 1.15)) / 1.15);
    const step = stepIn * (1 - stepOut);
    museGroup.position.lerpVectors(m.museFrom, m.museTo, step);
    museGroup.position.y = groundHeightAt(museGroup.position.x, museGroup.position.z);
    avatar.position.lerpVectors(m.playerFrom, m.playerTo, step);
    avatar.position.y = groundHeightAt(avatar.position.x, avatar.position.z);
    walkPos.set(avatar.position.x, 0, avatar.position.z);
    // Face each other throughout.
    museGroup.rotation.y = Math.atan2(avatar.position.x - museGroup.position.x, avatar.position.z - museGroup.position.z);
    avatar.rotation.y = Math.atan2(museGroup.position.x - avatar.position.x, museGroup.position.z - avatar.position.z);
    walkHeading = avatar.rotation.y;
    // The lean (kiss and foreheads): in after the step, out before
    // the parting. Small angles only, a tilt and a breath of
    // forward lean, heads inclining toward each other, nothing
    // straightened or locked. The foreheads-rest leans a breath
    // deeper and holds it longer; both close their eyes for it.
    const lean =
      m.kind === "hand"
        ? smoothstep((e - 1.0) / 0.6) * (1 - smoothstep((e - (m.total - 1.5)) / 0.6)) * 0.35
        : smoothstep((e - 1.2) / 0.6) * (1 - smoothstep((e - (m.total - 1.7)) / 0.6));
    const leanScale = m.kind === "forehead" ? 1.25 : 1;
    museInner.rotation.x = lean * 0.16 * leanScale;
    playerInner.rotation.x = lean * 0.16 * leanScale;
    museInner.rotation.z = lean * 0.1;
    playerInner.rotation.z = -lean * 0.1;
    if (museRig) poseBone(museRig, museRig.head, lean * 0.14 * leanScale, 0, lean * 0.16);
    if (playerRig) poseBone(playerRig, playerRig.head, lean * 0.14 * leanScale, 0, -lean * 0.16);
    if (m.kind === "kiss" || m.kind === "forehead") {
      setBlink(museBlink, lean);
      setBlink(playerBlink, lean);
    }
    if (m.kind === "kiss") {
      if (!m.fired && e > 1.7) {
        m.fired = true;
        opts.onKissMoment?.();
      }
    }
    // Heart sparkles drift up around the pair while they're close.
    const glow = step * (m.kind === "kiss" ? 1 : 0.45);
    heartSprites.forEach((h, i) => {
      const rise = ((t * 0.35 + h.phase) % 1) * 0.9;
      h.sprite.position.set(h.ox, rise - 0.3 + Math.sin(t * 2 + i) * 0.05, h.oz);
      (h.sprite.material as THREE.SpriteMaterial).opacity =
        glow * 0.9 * Math.sin(Math.PI * Math.min(1, rise + 0.15));
    });
  }

  // Stars (night only): Rome's true sky (Task 37), the naked-eye stars
  // of the Yale Bright Star Catalogue, the planets and the moon, each
  // where it really is over Rome now (trueSky.ts, romanSky.ts).
  const trueSky = createTrueSky(skyAnchor, new THREE.CanvasTexture(spriteCanvas));
  trueSky.update(new Date());
  let skyRefreshAt = 0;
  let surfLevelSent = 0;
  let cliffGreeted = false;
  const CLIFF_LINES = [
    "There. All of it, and you beside me to see it. I'd have walked a long way for this.",
    "Sit with me a while. The sea doesn't need us to say anything.",
    "I'm glad you didn't come here alone, centurion.",
  ];

  // The shared constellation, The Two Lanterns: two small lantern
  // figures of stars, side by side in the sky over the lake, joined
  // by one fainter star between them. It is built hidden and appears
  // only once the Night the Stars Fall has happened (the summit
  // state shows it), and only at night, like all the stars.
  {
    const group = new THREE.Group();
    // Two lantern outlines (a hanging loop, a body, a base) and the
    // joining star, in the group's local sky plane.
    const lantern = (cx: number, cy: number): [number, number][] => [
      [cx, cy + 2.6],
      [cx - 1.1, cy + 1.2],
      [cx + 1.1, cy + 1.2],
      [cx - 1.3, cy - 1.6],
      [cx + 1.3, cy - 1.6],
      [cx - 0.7, cy - 2.4],
      [cx + 0.7, cy - 2.4],
      [cx, cy - 0.2],
    ];
    const pts: [number, number][] = [...lantern(-4.6, 0), ...lantern(4.6, 0), [0, 0.9]];
    const pos = new Float32Array(pts.length * 3);
    pts.forEach(([px, py], i) => {
      pos[i * 3] = px;
      pos[i * 3 + 1] = py;
      pos[i * 3 + 2] = 0;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const starPointsMat = new THREE.PointsMaterial({
      size: 2.6,
      map: new THREE.CanvasTexture(spriteCanvas),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      color: 0xffe9a8,
      sizeAttenuation: false,
    });
    const points = new THREE.Points(geo, starPointsMat);
    group.add(points);
    constellationMats.push(starPointsMat);
    // The lantern frames, drawn as faint connecting lines.
    const framePairs: [number, number][] = [
      [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 6], [1, 2],
    ];
    const linePos: number[] = [];
    for (const off of [0, 8]) {
      for (const [a, b] of framePairs) {
        const pa = pts[a + off]!;
        const pb = pts[b + off]!;
        linePos.push(pa[0], pa[1], 0, pb[0], pb[1], 0);
      }
    }
    // A faint thread from each lantern to the joining star.
    const j = pts[16]!;
    const l = pts[7]!;
    const r = pts[15]!;
    linePos.push(l[0], l[1], 0, j[0], j[1], 0, r[0], r[1], 0, j[0], j[1], 0);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePos), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0xdceaff, transparent: true, opacity: 0, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);
    constellationMats.push(lineMat);
    // Hung high in the north-west sky, over the lake and the aqueduct.
    group.position.set(-44, 33, -76);
    group.lookAt(0, 2, 0);
    group.visible = false;
    constellationGroup = group;
    scene.add(group);
  }

  // Clouds drifting slowly: big soft clusters of overlapping puffs.
  const clouds: THREE.Group[] = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, roughness: 1 });
  for (const [cx, cy, cz, cs] of [
    [-42, 32, -54, 1.5],
    [35, 34, -45, 1.2],
    [-6, 33, -70, 1.6],
    [48, 30, 29, 1.15],
    [-61, 35, 32, 1.3],
    // Over the sea (Task 34), where the low sun catches them at dawn and dusk.
    [-70, 31, 165, 2.2],
    [25, 36, 205, 2.6],
    [95, 33, 150, 2.0],
    [-140, 38, 230, 2.8],
  ] as [number, number, number, number][]) {
    const cloud = new THREE.Group();
    for (const [ox, oy, oz, r] of [
      [0, 0, 0, 1.6],
      [1.5, 0.15, 0.3, 1.15],
      [-1.5, 0.05, -0.2, 1.05],
      [0.6, 0.45, -0.4, 0.95],
      [-0.7, 0.4, 0.5, 0.85],
      [2.4, -0.05, -0.3, 0.7],
    ] as [number, number, number, number][]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cloudMat);
      puff.position.set(ox, oy, oz);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(cx, cy, cz);
    cloud.scale.setScalar(cs);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Fireflies: warm points that fade in over the lawn after dark.
  const fireflyCount = 46;
  const fireflyPos = new Float32Array(fireflyCount * 3);
  const fireflySeed: number[] = [];
  for (let i = 0; i < fireflyCount; i++) fireflySeed.push(Math.random());
  const fireflyGeo = new THREE.BufferGeometry();
  fireflyGeo.setAttribute("position", new THREE.BufferAttribute(fireflyPos, 3));
  const fireflyMat = new THREE.PointsMaterial({
    size: 0.32,
    map: new THREE.CanvasTexture(spriteCanvas),
    transparent: true,
    depthWrite: false,
    color: 0xffd97a,
    opacity: 0,
  });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
  world.add(fireflies);
  // Task 49: more of the same warm points by their front door and over
  // the sea cliff, sharing the lake swarm's material (so its opacity:
  // after dark, spring and summer, out of the rain), counted by tier.
  const placeFlyPos = new Float32Array(FIREFLY_PLACES_MAX * 3);
  const placeFlySeed: number[] = [];
  for (let i = 0; i < FIREFLY_PLACES_MAX; i++) placeFlySeed.push(Math.random());
  const placeFlyGeo = new THREE.BufferGeometry();
  placeFlyGeo.setAttribute("position", new THREE.BufferAttribute(placeFlyPos, 3));
  placeFlyGeo.setDrawRange(0, 0);
  const placeFlies = new THREE.Points(placeFlyGeo, fireflyMat);
  placeFlies.frustumCulled = false;
  world.add(placeFlies);

  // =====================================================================
  // Asset integration + new systems (dance, animals, pack trees,
  // Greek dressing, sky watch, the phoenix). Everything here loads
  // best-effort: a failed pack file leaves the town exactly as it
  // was, procedural pieces stay as the fallback, never a hole.
  // =====================================================================

  /** Load an FBX prop the way placeWorld loads GLBs: measured from
   *  its own bounding box, stood on the terrain, scaled to a target
   *  width or height. Materials go through the shared repair pass:
   *  the Greek pack's Blender FBXs carry NO UVs and honest flat
   *  colours, so they keep exactly those colours, the old shared
   *  atlas material sampled a missing UV attribute and rendered
   *  every Greek prop pure black (see repairModelMaterials). The
   *  `greek` option is kept for call-site compatibility and no
   *  longer swaps any material. */
  const fbxManager = new THREE.LoadingManager();
  // Pack FBXs name their textures by the paths they were authored at, which
  // never exist in a bundle. Failing them here skips the 404 and keeps the
  // result repairModelMaterials expects from a texture that didn't load.
  fbxManager.setURLModifier((url) => (/\.(png|jpe?g|tga|tiff?|bmp)$/i.test(url) ? "data:image/png;base64," : url));
  const fbxLoader2 = new FBXLoader(fbxManager);
  /** One fetch and parse per file; placements clone the prepared source. */
  const fbxSources = new Map<string, Promise<THREE.Group>>();
  function loadFbxSource(url: string, prepare: (source: THREE.Group) => void): Promise<THREE.Group> {
    let source = fbxSources.get(url);
    if (!source) {
      source = assetUrl(url).then((resolved) => fbxLoader2.loadAsync(resolved)).then((g) => {
        prepare(g);
        return g;
      });
      fbxSources.set(url, source);
      source.catch(() => fbxSources.delete(url));
    }
    return source;
  }
  function placeFbx(
    url: string,
    opts: { x: number; z: number; rotY?: number; width?: number; height?: number; greek?: boolean; y?: number },
  ): Promise<THREE.Group | null> {
    return runtime.streaming.request(
      () => loadFbxSource(url, (source) => repairModelMaterials(source, { label: "fbx prop" })),
      () => ({ x: opts.x, z: opts.z }),
    )
      .then((source) => {
        const g = source.clone(true);
        if (!resources.adopt(g)) return null;
        const box = new THREE.Box3().setFromObject(g);
        const size = box.getSize(new THREE.Vector3());
        let s = 1;
        if (opts.width && size.x > 0) s = opts.width / size.x;
        else if (opts.height && size.y > 0) s = opts.height / size.y;
        g.scale.setScalar(s);
        g.rotation.y = opts.rotY ?? 0;
        g.position.set(opts.x, (opts.y ?? terrainHeight(opts.x, opts.z)) - box.min.y * s, opts.z);
        g.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        world.add(g);
        return g;
      })
      .catch(() => null);
  }

  // --- Wall torches & forum braziers (Nov 1) -------------------------
  // The Roman pack's SM_torch (its only lamp-kin) stands at the
  // basilica, temple, and baths doorways, its flame a small emissive
  // cone on the town lamp circuit (the existing lamp treatment: lit
  // after dark, dark by day). Two primitive tripod braziers flank the
  // basilica steps on the peristyle side. Pure dressing: no colliders,
  // no prompts, no new lights.
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xff9a3c,
    roughness: 0.6,
    emissive: 0xffb845,
    emissiveIntensity: 0,
  });
  lampHeads.push(flameMat);
  const addFlame = (x: number, y: number, z: number, s: number) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.32 * s, 7), flameMat);
    flame.position.set(x, y, z);
    world.add(flame);
    const heart = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.2 * s, 7), flameMat);
    heart.position.set(x, y - 0.04 * s, z);
    world.add(heart);
  };
  const placeTorch = (x: number, z: number, rotY: number) => {
    void placeFbx(torchUrl, { x, z, rotY, height: 1.7 }).then((g) => {
      if (disposed) return null;
      if (!g) return;
      // The pack FBX's own material points at the shared palette by an
      // unresolvable path; dress it in the town's torch browns instead.
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = mat(0x6e4a2f, { rough: 0.8 });
      });
      const b = new THREE.Box3().setFromObject(g);
      addFlame(x, b.max.y + 0.12, z, 1);
    });
  };
  placeTorch(-2.2, -30.6, 0);
  placeTorch(2.2, -30.6, 0);
  placeTorch(25.9, -24.6, -0.6);
  placeTorch(29.9, -28.0, -0.6);
  placeTorch(22.9, 28.4, 0);
  placeTorch(25.5, 28.4, 0);
  for (const bx of [-3.2, 3.2]) {
    const brazier = new THREE.Group();
    for (let l = 0; l < 3; l++) {
      const a = (l / 3) * Math.PI * 2 + 0.5;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), lanternIron);
      leg.position.set(Math.cos(a) * 0.16, 0.4, Math.sin(a) * 0.16);
      leg.rotation.z = Math.cos(a) * 0.38;
      leg.rotation.x = -Math.sin(a) * 0.38;
      leg.castShadow = true;
      brazier.add(leg);
    }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.17, 0.2, 10), lanternBronze);
    bowl.position.y = 0.82;
    bowl.castShadow = true;
    brazier.add(bowl);
    const bz = -30.4;
    brazier.position.set(bx, terrainHeight(bx, bz), bz);
    world.add(brazier);
    addFlame(bx, terrainHeight(bx, bz) + 1.12, bz, 1.5);
  }

  // --- Pack trees: the real willow replaces the four hand-built
  // ones (same spots, same trunk colliders, those live elsewhere
  // and read WILLOW_SPOTS), cypress and fruit trees dress the
  // garden, and a cherry blossom keeps the Stories house company.
  // The pack willow moves now, in the town wind (wind.ts), trailing
  // longer and slower than any other tree in town.
  {
    const willowGroups: THREE.Group[] = [];
    world.children.forEach((c) => {
      if ((c as THREE.Group).userData?.proceduralWillow) willowGroups.push(c as THREE.Group);
    });
    void assetUrl(treesPackUrl)
      .then((resolved) => gltfLoader.loadAsync(resolved))
      .then((gltf) => {
        if (!resources.adopt(gltf.scene)) return null;
        const byName = new Map<string, THREE.Object3D>();
        gltf.scene.traverse((o) => {
          if (!byName.has(o.name)) byName.set(o.name, o);
        });
        // The town wind takes the whole pack stand at once: every
        // unique material in the pack gets the moderate "tree"
        // sway (forest pines and oaks, cypresses, fruit trees, the
        // understorey, a bush's small local height keeps its own
        // sway small through the height weight). The willows and
        // the Town Tree re-clone their materials below with their
        // own kinds (trailing-most, and least, respectively).
        {
          const seen = new Set<THREE.Material>();
          gltf.scene.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              if (m instanceof THREE.Material && !seen.has(m)) {
                seen.add(m);
                applyWindToMaterial(m, "tree");
              }
            }
          });
        }
        const placeTree = (name: string, x: number, z: number, targetH: number, rotY: number) => {
          const srcNode = byName.get(name);
          if (!srcNode) return null;
          const node = srcNode.clone(true);
          const box = new THREE.Box3().setFromObject(node);
          const size = box.getSize(new THREE.Vector3());
          if (size.y <= 0) return null;
          const s = targetH / size.y;
          node.scale.setScalar(s);
          node.position.set(x, terrainHeight(x, z) - box.min.y * s, z);
          node.rotation.y = rotY;
          node.traverse((o) => {
            if (o instanceof THREE.Mesh) o.castShadow = true;
          });
          world.add(node);
          return node;
        };
        let willowsOk = 0;
        WILLOW_SPOTS.forEach(([wx, wz, ws], i) => {
          const node = placeTree("WillowTree", wx, wz, 5.6 * ws, i * 1.7 + 0.4);
          if (!node) return;
          willowsOk++;
          // Willows trail most of all: their clones wear the
          // willow wind kind, long and languid.
          node.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const wound = mats.map((m) =>
              applyWindToMaterial((m as THREE.Material).clone(), "willow"),
            );
            o.material = Array.isArray(o.material) ? wound : wound[0]!;
          });
        });
        if (willowsOk >= 3) {
          // The pack willows stand, retire the hand-built ones and
          // their swaying strands.
          for (const g of willowGroups) world.remove(g);
          willowStrands.length = 0;
        }
        placeTree("CypressTree", -15.6, 26.3, 5.2, 0.3);
        placeTree("CypressTree", -22.8, 26.8, 4.6, 2.1);
        placeTree("AppleTree", -16.6, 20.8, 2.6, 1.2);
        placeTree("AppleTree", -25.2, 21, 3.0, 2.6);
        placeTree("CherryBlossom", -27.8, -13.8, 4.4, 0.9);
        // The forest stand (data in town.ts, the same list the
        // colliders were built from): pines, oaks, birches, poplars
        // over the west lobe, the understorey, and the hollow
        // ancient oak at its named spot. All clones share the pack's
        // geometry and atlas materials, no new textures loaded.
        for (const t of FOREST_TREES) placeTree(t.kind, t.x, t.z, t.h, t.rot);
        for (const b of FOREST_BUSHES) placeTree(b.kind, b.x, b.z, b.h, b.rot);
        placeTree("OakTree", FOREST_SPOTS.hollow[0], FOREST_SPOTS.hollow[1], 9.5, 1.1);
        // The Deep Glade's fallen log is a seat: place it by LENGTH
        // (placeTree scales by height), measure its top the way the
        // Greek benches are measured, and register it as a bench.
        {
          const src = byName.get("FallenLog");
          if (src) {
            const node = src.clone(true);
            const bb = new THREE.Box3().setFromObject(node);
            const size = bb.getSize(new THREE.Vector3());
            const len = Math.max(size.x, size.z);
            if (len > 0) {
              const s = 2.8 / len;
              node.scale.setScalar(s);
              node.position.set(
                FOREST_SPOTS.log[0],
                terrainHeight(FOREST_SPOTS.log[0], FOREST_SPOTS.log[1]) - bb.min.y * s,
                FOREST_SPOTS.log[1],
              );
              node.rotation.y = 0.7;
              node.traverse((o) => {
                if (o instanceof THREE.Mesh) o.castShadow = true;
              });
              world.add(node);
              const seatTop = size.y * s - 0.03;
              if (seatTop > 0.25 && seatTop < 0.85) {
                benchGroups.set("bench-glade-log", node as THREE.Group);
                BENCHES.push({
                  id: "bench-glade-log",
                  x: FOREST_SPOTS.log[0],
                  z: FOREST_SPOTS.log[1],
                  rotY: 0.7,
                  seatTop,
                  baseX: FOREST_SPOTS.log[0],
                  baseZ: FOREST_SPOTS.log[1],
                });
              }
            }
          }
        }
        // The Town Tree's new wardrobe rides in this same pack: hand
        // the named nodes to buildTreeBody and rebuild, so the oak
        // (or the season's maple/bare) replaces the hand-built tree.
        packTreeNodes = byName;
        buildTreeBody();
        townTree.traverse((o) => {
          o.userData.pick = { kind: "tree", id: "town-tree" } satisfies { kind: PickKind; id: string };
        });
      })
      .catch(() => {
        /* the hand-built willows keep the shore */
      });
  }

  // --- Greek dressing: furniture and small goods at the houses'
  // doorsteps and terraces (the town has no interiors, Rome lives
  // outside), planters in the garden beds, a wood pile for the
  // caldarium's appetite, and two measured benches that join
  // BENCHES as true sittables once their seat height is known.
  void placeFbx(greekTableUrl, { x: -27.0, z: 9.6, rotY: 0.6, width: 1.7, greek: true });
  void placeFbx(greekTableUrl, { x: 24.8, z: -1.6, rotY: -0.4, width: 1.7, greek: true });
  void placeFbx(greekBowlUrl, { x: 6.9, z: 38.4, width: 0.42, greek: true });
  void placeFbx(greekDecoBowlUrl, { x: 6.9, z: 39.6, width: 0.5, greek: true });
  void placeFbx(greekPot1Url, { x: -25, z: 23, height: 0.55, greek: true });
  void placeFbx(greekPot2Url, { x: -20.8, z: 24.0, height: 0.7, greek: true });
  void placeFbx(greekBucketUrl, { x: 21.3, z: 26.9, height: 0.42, greek: true });
  void placeFbx(greekGardenUrl, { x: 9.8, z: 25.2, width: 2.3, greek: true });
  void placeFbx(greekGardenUrl, { x: 13.4, z: 25.2, width: 2.3, greek: true });
  void placeFbx(greekRackUrl, { x: -22.6, z: 25.4, rotY: 0.5, width: 1.8, greek: true });
  void placeFbx(greekWoodPileUrl, { x: 27.9, z: 27.6, rotY: 0.8, width: 1.6, greek: true });
  void placeFbx(greekWoodPileUrl, { x: -24.6, z: 20.2, rotY: 2.2, width: 1.4, greek: true });
  {
    // Measured at load: a Greek bench is a flat-topped seat, so its
    // seat surface IS its bounding-box top (less a finger's width).
    const greekBench = (url: string, id: string, x: number, z: number, rotY: number) => {
      void placeFbx(url, { x, z, rotY, width: 2.0, greek: true }).then((g) => {
        if (disposed) return null;
        if (!g) return;
        const box = new THREE.Box3().setFromObject(g);
        const seatTop = box.max.y - box.min.y - 0.03;
        if (seatTop < 0.25 || seatTop > 0.65) return;
        benchGroups.set(id, g);
        BENCHES.push({ id, x, z, rotY, seatTop, baseX: x, baseZ: z });
      });
    };
    // Turned on Nov 6, 2026 (Task 18): both sat with their backs to
    // the peristyle; sitters now face it (no backrest on either).
    greekBench(greekBench1Url, "bench-greek-stone", 12.2, -15, Math.PI / 2);
    greekBench(greekBench2Url, "bench-greek-wood", -12.2, -15, -Math.PI / 2);
  }

  // --- The forest: landmarks, forage, birds -----------------------
  // The trees themselves arrive with the trees pack (its callback
  // plants the stand from FOREST_TREES); what stands here is stone,
  // water, and gathered green, procedural, always built.
  const forestGroup = new THREE.Group();
  world.add(forestGroup);
  // Lupa's den: a ring of weathered rocks west of the glade (the
  // colliders ride the same FOREST_DEN_ROCKS list).
  for (const [rx, rz, rr] of FOREST_DEN_ROCKS) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rr, 0), mat(0x8d8d94));
    rock.position.set(rx, terrainHeight(rx, rz) + rr * 0.45, rz);
    rock.rotation.set(rx * 1.7, rz * 2.3, rx * 0.9);
    rock.castShadow = true;
    forestGroup.add(rock);
  }
  // The moss shrine: one standing stone, moss-capped, a little
  // proud of plumb, it has had centuries to lean.
  {
    const [sx, sz] = FOREST_SPOTS.shrine;
    const gy = terrainHeight(sx, sz);
    const stone = box(0.95, 1.7, 0.5, 0x97948c, sx, gy + 0.8, sz);
    stone.rotation.set(0, 0.5, 0.06);
    forestGroup.add(stone);
    const moss = box(0.99, 0.22, 0.54, 0x5d7a43, sx, gy + 1.66, sz);
    moss.rotation.set(0, 0.5, 0.06);
    forestGroup.add(moss);
  }
  // The hidden spring: still water in its dip, ringed with stones.
  {
    const [sx, sz] = FOREST_SPOTS.spring;
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 24),
      new THREE.MeshStandardMaterial({ color: 0x7fb2c9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(sx, terrainHeight(sx, sz) + 0.07, sz);
    forestGroup.add(water);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const px = sx + Math.cos(a) * 1.85;
      const pz = sz + Math.sin(a) * 1.85;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), mat(0x8d8d94));
      st.position.set(px, terrainHeight(px, pz) + 0.08, pz);
      forestGroup.add(st);
    }
  }
  // The hollow oak's mouth: a dark opening at its roots (the oak
  // itself is planted by the trees-pack callback, at the same spot).
  {
    const [hx, hz] = FOREST_SPOTS.hollow;
    const mouth = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshStandardMaterial({ color: 0x171208, roughness: 1 }),
    );
    mouth.position.set(hx + 0.72, terrainHeight(hx, hz) + 0.38, hz + 0.52);
    mouth.rotation.set(-0.5, 0.9, 0);
    forestGroup.add(mouth);
  }
  // Forage: a small green (or mushroom) cluster per spot, with one
  // soft point of light over a ready picking. Hidden for the rest
  // of the day once gathered (setForageTaken, from the shell).
  const forageVisuals = new Map<string, THREE.Group>();
  let forageTakenToday = new Set<string>();
  for (const spot of FORAGE_SPOTS) {
    const g = new THREE.Group();
    const gy = terrainHeight(spot.x, spot.z);
    if (spot.item === "forest-herbs") {
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 6), mat(0x5d8a48));
        leaf.position.set(spot.x + ((i % 3) - 1) * 0.22, gy + 0.2, spot.z + (Math.floor(i / 3) - 0.5) * 0.24);
        leaf.rotation.z = (i - 2) * 0.16;
        g.add(leaf);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const mx = spot.x + ((i % 2) - 0.5) * 0.3;
        const mz = spot.z + (Math.floor(i / 2) - 0.5) * 0.3;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 6), mat(0xe8e0cc));
        stem.position.set(mx, gy + 0.11, mz);
        g.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xa8542f));
        cap.position.set(mx, gy + 0.2, mz);
        g.add(cap);
      }
    }
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.85 }),
    );
    glow.position.set(spot.x, gy + 0.55, spot.z);
    g.add(glow);
    forestGroup.add(g);
    forageVisuals.set(spot.id, g);
  }
  // Forest birds: one loose flock of simple flapping shapes,
  // circling a clearing by day; approached, it flushes to another.
  interface ForestBird {
    group: THREE.Group;
    wingL: THREE.Mesh;
    wingR: THREE.Mesh;
    phase: number;
    r: number;
  }
  const birdFlock = {
    x: FOREST.glade[0],
    z: FOREST.glade[1],
    tx: FOREST.glade[0],
    tz: FOREST.glade[1],
    flushUntil: -1,
    birds: [] as ForestBird[],
  };
  {
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9, side: THREE.DoubleSide });
    const wingGeo = new THREE.PlaneGeometry(0.42, 0.14);
    for (let i = 0; i < 7; i++) {
      const bg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), birdMat);
      body.scale.set(0.8, 0.8, 1.9);
      bg.add(body);
      const wingL = new THREE.Mesh(wingGeo, birdMat);
      wingL.position.x = -0.22;
      const wingR = new THREE.Mesh(wingGeo, birdMat);
      wingR.position.x = 0.22;
      bg.add(wingL, wingR);
      bg.visible = false;
      world.add(bg);
      birdFlock.birds.push({ group: bg, wingL, wingR, phase: i * 1.13, r: 2.5 + (i % 4) * 1.1 });
    }
  }
  const BIRD_CLEARINGS: [number, number][] = [
    [FOREST.glade[0], FOREST.glade[1]],
    [FOREST_SPOTS.spring[0], FOREST_SPOTS.spring[1]],
    [FOREST_SPOTS.shrine[0], FOREST_SPOTS.shrine[1]],
  ];

  // --- Animals: wander AI on the pets pack's own skeletons. The
  // eight clips per animal are frame ranges inside one FBX take
  // (30 fps), sliced at load. No colliders, no systems, charm.
  interface Animal {
    group: THREE.Group;
    mixer: THREE.AnimationMixer;
    actions: Map<string, THREE.AnimationAction>;
    current: string;
    kind: string;
    home: { x: number; z: number; r: number };
    speed: number;
    state: "idle" | "walk";
    timer: number;
    target: { x: number; z: number } | null;
    pauseUntil: number;
    /** Startled (a thrown stone landing close): run, don't stroll. */
    fleeUntil: number;
  }
  const animals: Animal[] = [];
  const CLIP_TABLES: Record<string, Record<string, [number, number]>> = {
    cat: { walk: [0, 25], idle1: [30, 55], idle2: [60, 100], idle3: [105, 180], run: [190, 215] },
    chicken: { walk: [0, 25], idle1: [30, 70], idle2: [70, 105], idle3: [105, 145], run: [150, 165] },
    sheep: { walk: [0, 35], idle1: [40, 80], idle2: [80, 130], idle3: [130, 170], run: [0, 35] },
    pig: { walk: [0, 35], idle1: [75, 128], idle2: [128, 180], idle3: [180, 265], run: [0, 35] },
  };
  function playAnimal(a: Animal, name: string) {
    if (a.current === name) return;
    const next = a.actions.get(name);
    if (!next) return;
    const prev = a.actions.get(a.current);
    if (prev) prev.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    a.current = name;
  }
  // The pets' real coats (see the imports): one shared texture per
  // kind, loaded from the bundle, the FBX's own references point
  // at the author's Windows paths and can never resolve.
  const petTextures = new Map<string, THREE.Texture>();
  function petTexture(kind: string): THREE.Texture | undefined {
    const url =
      kind === "chicken" ? chickenTexUrl
      : kind === "cat" ? catTexUrl
      : kind === "pig" ? pigTexUrl
      : kind === "sheep" ? sheepTexUrl
      : null;
    if (!url) return undefined;
    let tex = petTextures.get(kind);
    if (!tex) {
      tex = loadAssetTexture(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      petTextures.set(kind, tex);
    }
    return tex;
  }
  function loadAnimal(
    kind: string,
    url: string,
    targetH: number,
    home: { x: number; z: number; r: number },
    speed: number,
  ): Promise<Animal | null> {
    return runtime.streaming.request(
      // Her real coat, not the black of a texture that never came.
      () => loadFbxSource(url, (source) => repairModelMaterials(source, { map: petTexture(kind), label: `${kind} coat` })),
      () => ({ x: home.x, z: home.z }),
    )
      .then((source) => {
        const take = source.animations[0];
        if (!take) return null;
        // Measured on the source: a cloned skeleton has no pose to bound yet.
        const box = new THREE.Box3().setFromObject(source);
        const size = box.getSize(new THREE.Vector3());
        if (size.y <= 0) return null;
        const g = cloneSkeleton(source) as THREE.Group;
        // Geometry is shared, materials aren't: the rooster's tint is his own.
        g.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
          }
        });
        if (!resources.adopt(g)) return null;
        const s = targetH / size.y;
        g.scale.setScalar(s);
        const inner = new THREE.Group();
        g.position.y = -box.min.y * s;
        inner.add(g);
        inner.position.set(home.x, terrainHeight(home.x, home.z), home.z);
        inner.rotation.y = Math.random() * Math.PI * 2;
        g.traverse((o) => {
          if (o instanceof THREE.Mesh) o.frustumCulled = false;
        });
        world.add(inner);
        const mixer = new THREE.AnimationMixer(g);
        const actions = new Map<string, THREE.AnimationAction>();
        const table = CLIP_TABLES[kind] ?? {};
        for (const [name, [f0, f1]] of Object.entries(table)) {
          const sub = THREE.AnimationUtils.subclip(take, `${kind}-${name}`, f0, f1, 30);
          const act = mixer.clipAction(sub);
          act.setLoop(THREE.LoopRepeat, Infinity);
          actions.set(name, act);
        }
        const animal: Animal = {
          group: inner,
          mixer,
          actions,
          current: "",
          kind,
          home,
          speed,
          state: "idle",
          timer: 1 + Math.random() * 3,
          target: null,
          pauseUntil: 0,
          fleeUntil: 0,
        };
        playAnimal(animal, "idle1");
        animals.push(animal);
        return animal;
      })
      .catch(() => null);
  }
  // Two chickens and a rooster at the market (the pack has one
  // chicken; the third wears a slightly larger scale and a russet
  // tint and carries the title with dignity).
  void loadAnimal("chicken", chickenUrl, 0.42, { x: 11.4, z: 27, r: 2.2 }, 0.55);
  void loadAnimal("chicken", chickenUrl, 0.45, { x: 12.6, z: 26.8, r: 2.2 }, 0.5);
  void loadAnimal("chicken", chickenUrl, 0.52, { x: 10.2, z: 27.2, r: 2 }, 0.6).then((a) => {
    if (disposed) return null;
    a?.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = (o.material as THREE.MeshStandardMaterial).clone();
        m.color.setHex(0xd8a077);
        o.material = m;
      }
    });
  });
  void loadAnimal("sheep", sheepUrl, 0.8, { x: -15, z: 28.2, r: 2.4 }, 0.45);
  void loadAnimal("pig", pigUrl, 0.64, { x: -20, z: 28, r: 2.2 }, 0.5);
  // Umbra, the town cat, her routine is her own (see updateAnimals).
  let catAnimal: Animal | null = null;
  /** A startle relocation for Umbra (a stone landing close): she
   *  removes herself to this point at a run, then her routine
   *  resumes as if the incident were beneath mention. */
  let catFlee: { x: number; z: number; until: number } | null = null;
  void loadAnimal("cat", catUrl, 0.31, { x: 6.4, z: 17.8, r: 2 }, 0.85).then((a) => {
    if (disposed) return null;
    catAnimal = a;
  });
  function updateAnimalWander(a: Animal, dt: number, t: number) {
    a.mixer.update(dt);
    if (t < a.pauseUntil) return;
    a.timer -= dt;
    if (a.state === "idle") {
      if (a.timer <= 0) {
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * a.home.r;
        a.target = { x: a.home.x + Math.cos(ang) * rr, z: a.home.z + Math.sin(ang) * rr };
        a.state = "walk";
        playAnimal(a, "walk");
      }
      return;
    }
    if (!a.target) {
      a.state = "idle";
      return;
    }
    const dx = a.target.x - a.group.position.x;
    const dz = a.target.z - a.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.12) {
      a.state = "idle";
      a.timer = 1.5 + Math.random() * 4;
      playAnimal(a, ["idle1", "idle2", "idle3"][Math.floor(Math.random() * 3)]!);
      return;
    }
    const want = Math.atan2(dx, dz);
    a.group.rotation.y = angleLerp(a.group.rotation.y, want, Math.min(1, dt * 6));
    const step = Math.min(dist, a.speed * (t < a.fleeUntil ? 2.8 : 1) * dt);
    a.group.position.x += Math.sin(a.group.rotation.y) * step;
    a.group.position.z += Math.cos(a.group.rotation.y) * step;
    a.group.position.y = groundHeightAt(a.group.position.x, a.group.position.z);
  }

  // --- Shared glide for staged moments (dance, sky watch): the
  // pair walk themselves to their marks over a breath, no teleport.
  interface PairGlide {
    t: number;
    fp: THREE.Vector3;
    tp: THREE.Vector3;
    fm: THREE.Vector3;
    tm: THREE.Vector3;
  }
  function stepGlide(g: PairGlide, dt: number, dur = 1.4): boolean {
    g.t = Math.min(1, g.t + dt / dur);
    const k = g.t * g.t * (3 - 2 * g.t);
    walkPos.lerpVectors(g.fp, g.tp, k);
    museGroup.position.lerpVectors(g.fm, g.tm, k);
    museGroup.position.y = groundHeightAt(museGroup.position.x, museGroup.position.z);
    return g.t >= 1;
  }

  // --- The festival dance: one slow step sequence together in
  // front of the Atrium of Sounds, matched pair clips, tempo kept
  // by starting both actions on the same frame (the animator does).
  const DANCE_SPOT = { x: -26.2, z: 2.8 };
  let danceState: { glide: PairGlide | null; danceT: number; dur: number } | null = null;
  let festivalTonight = false;
  function beginDance(): boolean {
    if (!walking || danceState || bathState || boatState || seatPlayer || skyWatchState) return false;
    if (!museAnim?.hasDance || !playerAnim?.hasDance) return false;
    if (Math.hypot(museGroup.position.x - walkPos.x, museGroup.position.z - walkPos.z) > 7) return false;
    const dl = Math.hypot(DANCE_SPOT.x, DANCE_SPOT.z) || 1;
    const ux = -DANCE_SPOT.x / dl;
    const uz = -DANCE_SPOT.z / dl;
    danceState = {
      glide: {
        t: 0,
        fp: walkPos.clone(),
        tp: new THREE.Vector3(DANCE_SPOT.x, walkPos.y, DANCE_SPOT.z),
        fm: museGroup.position.clone(),
        tm: new THREE.Vector3(DANCE_SPOT.x + ux * 1.15, museGroup.position.y, DANCE_SPOT.z + uz * 1.15),
      },
      danceT: 0,
      dur: Math.max(museAnim.danceDuration, playerAnim.danceDuration, 12),
    };
    return true;
  }
  function endDance() {
    danceState = null;
  }

  // --- Outdoor pair moments + talk gesturing -----------------------
  // talkAnimOpen mirrors the shell's talk bubble (setTalking): while
  // it is open, both animators cycle their Communicate gesture clips
  // (standing, or seated variants when seated). pairState stages a
  // one-shot flirt/hug pair clip inside moments the SHELL has
  // already gated (rank scenes, structured dates), the scene only
  // checks staging sanity here (awake, ashore, unseated, close);
  // every affection/rank rule lives in the shell and is untouched.
  // Both pairs glide to their take's authored spacing first: the
  // pack places the two bodies a fixed distance apart (Couple flirt
  // 4.3, the embrace, 0.37 m hip to hip; Couple flirt 2.3, the
  // face-to-face flirt, 0.42 m), scaled for these taller bodies and
  // measured on the retargeted skeletons as group-origin spacing
  // (the hips sit ≈0.1 m inside the two origins), plus whatever
  // each clip steps in on its own. A flirt played wherever the two
  // happened to stand reached into the air at talk distance, and a
  // fixed 0.57 m hug (the He hugs take, hand on the shoulder, her
  // arms down) never read as an embrace: see Task 10's note.
  const PAIR_SPACING_M: Record<"flirt" | "hug", number> = { hug: 0.5, flirt: 0.55 };
  // The pair camera lives in pairCam.ts (Task 20): per kind, from his
  // right, the flirt three-quarter at the walk's height and aim, the
  // embrace side-on, close and level; the framing holds through the
  // pose's release, then the camera comes home. This is its state.
  const pairCamState = newPairCamState();
  let talkAnimOpen = false;
  let pairState: { kind: "flirt" | "hug"; t: number; dur: number; glide: PairGlide | null; framed: boolean; heldOff: boolean } | null = null;
  function playPairMoment(kind: "flirt" | "hug"): boolean {
    if (!walking || pairState || danceState || bathState || boatState || seatPlayer || seatMuse || skyWatchState || secretMoment) return false;
    if (!museAnim?.ready || !playerAnim?.ready) return false;
    if (!museAnim.hasPair(kind) || !playerAnim.hasPair(kind)) return false;
    const dx = museGroup.position.x - walkPos.x;
    const dz = museGroup.position.z - walkPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > (kind === "hug" ? 5 : 2.4) || dist < 0.3) return false;
    const dur = Math.min(museAnim.pairDuration(kind), playerAnim.pairDuration(kind));
    if (dur <= 0) return false;
    walkHeading = Math.atan2(dx, dz);
    let glide: PairGlide | null = null;
    const spacing = PAIR_SPACING_M[kind] + museAnim.pairStepIn(kind) + playerAnim.pairStepIn(kind);
    if (Math.abs(dist - spacing) > 0.05) {
      const ux = dx / dist;
      const uz = dz / dist;
      const mx = (walkPos.x + museGroup.position.x) / 2;
      const mz = (walkPos.z + museGroup.position.z) / 2;
      const half = spacing / 2;
      glide = {
        t: 0,
        fp: walkPos.clone(),
        tp: new THREE.Vector3(mx - ux * half, walkPos.y, mz - uz * half),
        fm: museGroup.position.clone(),
        tm: new THREE.Vector3(mx + ux * half, museGroup.position.y, mz + uz * half),
      };
    }
    pairState = { kind, t: 0, dur: dur + (glide ? 0.9 : 0) + 0.35, glide, framed: false, heldOff: false };
    return true;
  }

  // --- Watching the sky: three vantage spots with true bearings,
  // the dock and the secret terrace look west over the water, the
  // basilica steps face the sunrise. The pair stand side by side
  // turned toward the sun wherever it actually is.
  const SKY_WATCH_SPOTS_SCENE: Record<string, { x: number; z: number }> = {
    dock: { x: -13.9, z: LAKE.position[1] },
    terrace: { x: SECRET.position[0] - 0.7, z: SECRET.position[1] - 0.2 },
    basilica: { x: 0, z: -26.4 },
    glade: { x: FOREST.glade[0], z: FOREST.glade[1] },
  };
  let skyWatchState: { spot: string; glide: PairGlide | null; facing: number } | null = null;
  function nearestSkyWatchSpot(): string | null {
    let best: string | null = null;
    let bd = 3.4;
    for (const [id, s] of Object.entries(SKY_WATCH_SPOTS_SCENE)) {
      const d = Math.hypot(walkPos.x - s.x, walkPos.z - s.z);
      if (d < bd) {
        bd = d;
        best = id;
      }
    }
    return best;
  }
  function beginSkyWatch(spotId: string): boolean {
    const spot = SKY_WATCH_SPOTS_SCENE[spotId];
    if (!spot || !walking || skyWatchState || danceState || bathState || boatState || seatPlayer) return false;
    const facing = Math.atan2(sunDirCur.x, sunDirCur.z);
    const rx = Math.cos(facing);
    const rz = -Math.sin(facing);
    skyWatchState = {
      spot: spotId,
      facing,
      glide: {
        t: 0,
        fp: walkPos.clone(),
        tp: new THREE.Vector3(spot.x, walkPos.y, spot.z),
        fm: museGroup.position.clone(),
        tm: new THREE.Vector3(spot.x + rx * 0.62, museGroup.position.y, spot.z + rz * 0.62),
      },
    };
    return true;
  }
  function endSkyWatch() {
    skyWatchState = null;
  }

  // --- The Phoenix: one skinned bird, ember-lit, keeping dawn
  // hours on the Colosseum's rim. Her long take plays slow beneath
  // a procedural wing the flight needs; positions are lerped, so
  // perch and circuit melt into one another like a real bird's
  // decisions. She is absent at night, somewhere being reborn;
  // the town does not explain her.
  let phoenixArrivedFlag = false;
  let phoenixSummitFlag = false;
  let phoenixFeatherLying = false;
  let phoenixObj: {
    group: THREE.Group;
    mixer: THREE.AnimationMixer;
    wingL: THREE.Object3D | null;
    wingR: THREE.Object3D | null;
    wingLBase: THREE.Quaternion;
    wingRBase: THREE.Quaternion;
    arrivalT: number;
    arrivedVisual: boolean;
    angle: number;
  } | null = null;
  const phoenixPerch = new THREE.Vector3(COLOSSEUM.position[0] + 4.6, 0, COLOSSEUM.position[1] - 2.6);
  void runtime.streaming.request(() => loadModelScene(colosseumUrl), () => ({ x: COLOSSEUM.position[0], z: COLOSSEUM.position[1] }))
    .then((model) => {
      if (disposed) return;
      const box = new THREE.Box3().setFromObject(model);
      phoenixPerch.y = terrainHeight(COLOSSEUM.position[0], COLOSSEUM.position[1]) + (box.max.y - box.min.y) - 0.35;
    })
    .catch(() => {
      if (disposed) return;
      phoenixPerch.y = terrainHeight(COLOSSEUM.position[0], COLOSSEUM.position[1]) + 7.6;
    });
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(30 * 3);
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    size: 0.34,
    map: new THREE.CanvasTexture(spriteCanvas),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    color: 0xffa245,
    blending: THREE.AdditiveBlending,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.visible = false;
  world.add(embers);
  const featherMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(spriteCanvas),
    color: 0xffc06a,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const featherSprite = new THREE.Sprite(featherMat);
  featherSprite.scale.set(0.5, 0.95, 1);
  featherSprite.visible = false;
  world.add(featherSprite);
  const traceMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(spriteCanvas),
    color: 0xff9a3d,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const traceSprite = new THREE.Sprite(traceMat);
  traceSprite.scale.set(0.4, 0.7, 1);
  traceSprite.visible = false;
  world.add(traceSprite);
  void runtime.streaming.request(() => assetUrl(phoenixUrl).then((resolved) => fbxLoader2.loadAsync(resolved)), () => ({ x: COLOSSEUM.position[0], z: COLOSSEUM.position[1] }))
    .then((g) => {
      if (!resources.adopt(g)) return null;
      repairModelMaterials(g, { label: "phoenix" });
      const tex = loadAssetTexture(phoenixTexUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.frustumCulled = false;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            if (m && (m as THREE.Material).name === "Phoenix_Mat") {
              (m as THREE.MeshStandardMaterial).map = tex;
              (m as THREE.MeshStandardMaterial).needsUpdate = true;
            }
          }
        }
      });
      g.updateWorldMatrix(true, true);
      const wl = g.getObjectByName("Wing_Left2_end");
      const wr = g.getObjectByName("Wing_Right2_end");
      const root = g.getObjectByName("Root");
      let span = 300;
      if (wl && wr) {
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        wl.getWorldPosition(a);
        wr.getWorldPosition(b);
        span = Math.max(40, a.distanceTo(b));
      }
      const s = 2.7 / span;
      const inner = new THREE.Group();
      if (root) {
        const rp = new THREE.Vector3();
        root.getWorldPosition(rp);
        g.position.set(-rp.x, -rp.y, -rp.z);
      }
      inner.add(g);
      inner.scale.setScalar(s);
      const outer = new THREE.Group();
      outer.add(inner);
      outer.position.copy(phoenixPerch);
      outer.visible = false;
      world.add(outer);
      const mixer = new THREE.AnimationMixer(g);
      const take = g.animations.find((c) => c.duration > 1) ?? g.animations[0];
      if (take) {
        const act = mixer.clipAction(take);
        act.setLoop(THREE.LoopRepeat, Infinity);
        act.timeScale = 0.55;
        act.play();
      }
      const wingL = g.getObjectByName("Wing_Left1") ?? null;
      const wingR = g.getObjectByName("Wing_Right1") ?? null;
      phoenixObj = {
        group: outer,
        mixer,
        wingL,
        wingR,
        wingLBase: wingL ? wingL.quaternion.clone() : new THREE.Quaternion(),
        wingRBase: wingR ? wingR.quaternion.clone() : new THREE.Quaternion(),
        arrivalT: 0,
        arrivedVisual: false,
        angle: Math.random() * Math.PI * 2,
      };
    })
    .catch(() => {
      /* no bird this build, her traces remain */
    });
  const featherPos = new THREE.Vector3();
  let phoenixFeatherNow = false;
  const flapQ = new THREE.Quaternion();
  const flapAxis = new THREE.Vector3(0, 0, 1);
  function updatePhoenix(dt: number, t: number) {
    // The trace: on some dawns before she ever comes, one ember
    // feather drifts over the peristyle. It cannot be collected. It is
    // a promise, not a prize.
    if (!phoenixArrivedFlag) {
      const dawnGolden = skyElevDeg > -2 && skyElevDeg < 8.5 && skyAzimDeg < 180;
      const dayHash = Math.floor(Date.now() / 86400000);
      if (dawnGolden && dayHash % 3 === 0) {
        traceSprite.visible = true;
        const k = (t * 0.014) % 1;
        traceSprite.position.set(-22 + k * 44, 6.8 + Math.sin(t * 0.9) * 0.5, 1.5 + Math.sin(t * 0.4) * 1.2);
        traceMat.opacity = 0.75 * Math.sin(Math.PI * k);
      } else {
        traceSprite.visible = false;
      }
    } else {
      traceSprite.visible = false;
    }
    phoenixFeatherNow = false;
    const ph = phoenixObj;
    if (!ph) {
      embers.visible = false;
      featherSprite.visible = false;
      return;
    }
    const present = phoenixArrivedFlag && skyElevDeg > -4;
    ph.group.visible = present;
    embers.visible = present;
    if (!present) {
      featherSprite.visible = false;
      return;
    }
    ph.mixer.update(dt);
    const pos = ph.group.position;
    let flapAmp = 0.04;
    if (!ph.arrivedVisual) {
      // The arrival: a slow spiral of ember light down to the rim,
      // by way of the lake first, if a certain night has happened.
      ph.arrivalT += dt;
      const k = Math.min(1, ph.arrivalT / 22);
      const ang = ph.arrivalT * 0.55;
      const anchor = phoenixSummitFlag && k < 0.55 ? new THREE.Vector3(LAKE.position[0], phoenixPerch.y + 9, LAKE.position[1]) : phoenixPerch;
      const r = 26 * (1 - k) + 0.001;
      const target = new THREE.Vector3(
        anchor.x + Math.cos(ang) * r * (anchor === phoenixPerch ? 1 : 0.4),
        anchor.y + 13 * (1 - k) + (anchor === phoenixPerch ? 0 : 2),
        anchor.z + Math.sin(ang) * r * (anchor === phoenixPerch ? 1 : 0.4),
      );
      pos.lerp(target, 1 - Math.exp(-dt * 1.4));
      ph.group.rotation.y = -ang + Math.PI / 2;
      flapAmp = 0.5;
      if (k >= 1 && pos.distanceTo(phoenixPerch) < 0.6) ph.arrivedVisual = true;
    } else if (skyElevDeg >= 25) {
      // Midday: one full lazy circuit of the town.
      ph.angle += dt * ((Math.PI * 2) / 80);
      const target = new THREE.Vector3(Math.cos(ph.angle) * 47, 24 + Math.sin(t * 0.25) * 1.6, Math.sin(ph.angle) * 47);
      pos.lerp(target, 1 - Math.exp(-dt * 0.55));
      ph.group.rotation.y = -ph.angle;
      ph.group.rotation.z = 0.24;
      flapAmp = 0.5;
    } else {
      // Dawn, morning, and the return by dusk: the perch.
      pos.lerp(phoenixPerch, 1 - Math.exp(-dt * 0.8));
      ph.group.rotation.y = angleLerp(ph.group.rotation.y, Math.atan2(-phoenixPerch.x, -phoenixPerch.z), Math.min(1, dt * 1.5));
      ph.group.rotation.z *= 0.9;
      flapAmp = Math.sin(t * 0.6) > 0.97 ? 0.22 : 0.04;
    }
    // Procedural wing over the take: a flap is a Z-rotation pulse
    // mirrored across the body.
    if (ph.wingL && ph.wingR) {
      const flap = Math.sin(t * 6.2) * flapAmp + Math.sin(t * 1.1) * 0.03;
      flapQ.setFromAxisAngle(flapAxis, -flap);
      ph.wingL.quaternion.copy(ph.wingLBase).multiply(flapQ);
      flapQ.setFromAxisAngle(flapAxis, flap);
      ph.wingR.quaternion.copy(ph.wingRBase).multiply(flapQ);
    }
    // Ember motes shed from wingtips and tail, drifting down.
    for (let i = 0; i < 30; i++) {
      const seed = i * 1.618;
      const life = (t * 0.35 + seed) % 1;
      emberPos[i * 3] = pos.x + Math.sin(seed * 9.1 + t * 0.7) * (0.7 + life * 0.8);
      emberPos[i * 3 + 1] = pos.y + 0.4 - life * 2.2;
      emberPos[i * 3 + 2] = pos.z + Math.cos(seed * 7.3 + t * 0.5) * (0.7 + life * 0.8);
    }
    emberGeo.attributes.position!.needsUpdate = true;
    emberMat.opacity = 0.5 + Math.sin(t * 2.2) * 0.2;
    // The week's feather, some mornings, below the perch.
    featherPos.set(phoenixPerch.x + 3.1, terrainHeight(phoenixPerch.x + 3.1, phoenixPerch.z + 2.4) + 0.5, phoenixPerch.z + 2.4);
    const featherShows = phoenixFeatherLying && ph.arrivedVisual && skyElevDeg > -2 && skyElevDeg < 26;
    featherSprite.visible = featherShows;
    if (featherShows) {
      featherSprite.position.copy(featherPos);
      featherSprite.position.y += Math.sin(t * 1.8) * 0.08;
      phoenixFeatherNow = true;
    }
  }

  // --- Cat routine + the frame update for everything above.
  let lastT = 0;
  function animalTravel(a: Animal, tx: number, tz: number, dt: number): number {
    const dx = tx - a.group.position.x;
    const dz = tz - a.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.22) return dist;
    const want = Math.atan2(dx, dz);
    a.group.rotation.y = angleLerp(a.group.rotation.y, want, Math.min(1, dt * 6));
    const run = dist > 8;
    playAnimal(a, run ? "run" : "walk");
    const step = Math.min(dist, (run ? a.speed * 2.4 : a.speed) * dt);
    a.group.position.x += Math.sin(a.group.rotation.y) * step;
    a.group.position.z += Math.cos(a.group.rotation.y) * step;
    a.group.position.y = groundHeightAt(a.group.position.x, a.group.position.z);
    return dist;
  }
  function updateCat(dt: number, t: number) {
    const a = catAnimal;
    if (!a) return;
    a.mixer.update(dt);
    if (t < a.pauseUntil) {
      playAnimal(a, "idle2");
      return;
    }
    if (catFlee) {
      if (t < catFlee.until) {
        animalTravel(a, catFlee.x, catFlee.z, dt);
        return;
      }
      catFlee = null;
    }
    const idx = Math.floor(clockTime / ROUTINE_PHASE_SECS) % 4;
    const night = nightMix > 0.6;
    if (night || idx === 3) {
      // Asleep on the Stories doorstep's warm stone.
      if (animalTravel(a, -12.8, -13.6, dt) < 0.25) playAnimal(a, "idle3");
      return;
    }
    if (idx === 0) {
      a.home = { x: 3.5, z: 18.8, r: 2.2 };
    } else if (idx === 1) {
      a.home = { x: 3.4, z: 6.8, r: 1.6 };
    } else {
      // Afternoons, sometimes, she trails Muse at a distance,
      // the shadow's shadow, at a dignified remove.
      const mx = museGroup.position.x;
      const mz = museGroup.position.z;
      const back = Math.atan2(-Math.sin(museGroup.rotation.y), -Math.cos(museGroup.rotation.y));
      const tx = mx + Math.sin(back) * 3.4;
      const tz = mz + Math.cos(back) * 3.4;
      if (Math.hypot(a.group.position.x - tx, a.group.position.z - tz) > 0.7) {
        animalTravel(a, tx, tz, dt);
      } else {
        playAnimal(a, "idle1");
        a.group.position.y = groundHeightAt(a.group.position.x, a.group.position.z);
      }
      return;
    }
    // Travel to the phase's ground, then wander it.
    if (Math.hypot(a.group.position.x - a.home.x, a.group.position.z - a.home.z) > a.home.r + 0.8) {
      animalTravel(a, a.home.x, a.home.z, dt);
      return;
    }
    // Wander logic without a second mixer update.
    a.timer -= dt;
    if (a.state === "idle") {
      if (a.timer <= 0) {
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * a.home.r;
        a.target = { x: a.home.x + Math.cos(ang) * rr, z: a.home.z + Math.sin(ang) * rr };
        a.state = "walk";
      }
      return;
    }
    if (!a.target || animalTravel(a, a.target.x, a.target.z, dt) < 0.25) {
      a.state = "idle";
      a.timer = 2 + Math.random() * 4;
      playAnimal(a, ["idle1", "idle2", "idle3"][Math.floor(Math.random() * 3)]!);
    }
  }
  // --- Lupa, the town's wolf (Nov 1) ------------------------------
  // A dire wolf (Literock's Dire Wolf Lite, free licence) at her
  // true scale, about 1.3 m at the shoulder, mythic beside a
  // person, never pet-sized. She belongs to the town's edges: the
  // lakeshore woods, the hills behind the temple, the aqueduct
  // fold. She walks between anchors (trotting the long legs),
  // keeps the living sky's hours, out at dawn, dusk, and night,
  // resting at a shaded anchor through the midday, and never
  // enters the peristyle centre, a building, or the water (her legs
  // between clusters route along the town's rim, and the ordinary
  // character collision rules govern every step). She is shy in
  // the wild way: close within about eight metres and she moves
  // off at a trot to a farther anchor; but stand still at a
  // respectful distance and watch, and she may stop and look back
  // for a few seconds. The bite clip is theatre only, a rare
  // single snap toward a chicken that strays too close; she never
  // catches anything, and it is never aimed at a person. Her coat
  // keeps its grey-brown but is muted toward the town (desaturated
  // base colour, metal killed, fully rough) so she reads as kin
  // to the place rather than a visitor from a realistic game.
  interface WolfState {
    group: THREE.Group;
    mixer: THREE.AnimationMixer;
    actions: Map<string, THREE.AnimationAction>;
    current: string;
    mode: "rest" | "pause" | "roam" | "flee" | "watch";
    queue: { x: number; z: number }[];
    anchorIdx: number;
    pauseUntil: number;
    watchUntil: number;
    watchCdUntil: number;
    biteUntil: number;
    biteCdUntil: number;
    faceOff: number;
    seenFired: boolean;
    stillTime: number;
    prevPX: number;
    prevPZ: number;
  }
  let wolf: WolfState | null = null;
  // Anchor clusters: 0 lakeshore woods · 1 temple hills · 2 aqueduct
  // fold · 3 the forest (her home ground now, the den is there).
  const WOLF_ANCHORS: [number, number][] = [
    [-26, -38], [-30, -23], [-24, -15],
    [45, -33], [42, -19], [35, -13],
    [-33, -13], [-39, -25], [-29, -6],
    [-41, -19], [-43, -24], [-39, -28],
  ];
  const WOLF_CLUSTER = (i: number) => Math.floor(i / 3);
  const WOLF_REST: [number, number] = [FOREST.den[0], FOREST.den[1]];
  function playWolf(w: WolfState, name: string, once = false) {
    if (w.current === name) return;
    const next = w.actions.get(name);
    if (!next) return;
    const prev = w.actions.get(w.current);
    if (prev) prev.fadeOut(0.3);
    next.reset();
    if (once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    next.fadeIn(0.3).play();
    w.current = name;
  }
  void runtime.streaming.request(() => assetUrl(wolfUrl).then((resolved) => gltfLoader.loadAsync(resolved)), () => ({ x: FOREST.glade[0], z: FOREST.glade[1] }))
    .then((gltf) => {
      if (!resources.adopt(gltf.scene)) return null;
      const inner = new THREE.Group();
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      if (size.y <= 0) return;
      const s = 1.34 / size.y;
      model.scale.setScalar(s);
      model.position.y = -box.min.y * s;
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          const m = o.material as THREE.MeshStandardMaterial;
          if (m && "roughness" in m) {
            m.roughness = 1;
            m.metalness = 0;
            m.color.setHex(0xcfc8bd);
            if (m.map) {
              // Mute the coat toward the town's palette: the same
              // texture, desaturated on a canvas (one pass, at
              // load). Where canvas filters are unsupported the
              // draw is unfiltered and the tint still mutes her.
              try {
                const img = m.map.image as HTMLImageElement | ImageBitmap;
                const cv = document.createElement("canvas");
                cv.width = img.width;
                cv.height = img.height;
                const c2 = cv.getContext("2d");
                if (c2 && cv.width > 0) {
                  c2.filter = "saturate(0.62) brightness(1.03)";
                  c2.drawImage(img as CanvasImageSource, 0, 0);
                  const tex = new THREE.CanvasTexture(cv);
                  tex.colorSpace = m.map.colorSpace;
                  tex.anisotropy = 4;
                  m.map = tex;
                  m.needsUpdate = true;
                }
              } catch {
                /* the tint alone will have to do */
              }
            }
          }
        }
      });
      inner.add(model);
      inner.position.set(WOLF_REST[0], terrainHeight(WOLF_REST[0], WOLF_REST[1]), WOLF_REST[1]);
      inner.rotation.y = 2.2;
      world.add(inner);
      // Her facing, measured not assumed: the head bone's bind
      // direction from the root is her forward, whatever the
      // export's conventions were.
      inner.updateMatrixWorld(true);
      let faceOff = 0;
      const head = model.getObjectByName("head");
      if (head) {
        const hp = new THREE.Vector3();
        head.getWorldPosition(hp);
        const dx = hp.x - inner.position.x;
        const dz = hp.z - inner.position.z;
        if (Math.hypot(dx, dz) > 0.05) faceOff = Math.atan2(dx, dz);
      }
      const mixer = new THREE.AnimationMixer(model);
      const actions = new Map<string, THREE.AnimationAction>();
      for (const clip of gltf.animations) {
        actions.set(clip.name, mixer.clipAction(clip));
      }
      wolf = {
        group: inner,
        mixer,
        actions,
        current: "",
        mode: "pause",
        queue: [],
        anchorIdx: 1,
        pauseUntil: clockTime + 4,
        watchUntil: 0,
        watchCdUntil: 0,
        biteUntil: 0,
        biteCdUntil: 0,
        faceOff,
        seenFired: false,
        stillTime: 0,
        prevPX: walkPos.x,
        prevPZ: walkPos.z,
      };
      wolfGroupRef = inner;
      playWolf(wolf, "idle_loop");
    })
    .catch(() => {
      /* no wolf this visit, the edges stay merely rumoured */
    });
  /** Steer her one frame toward a point; returns distance left. */
  function wolfMove(w: WolfState, tx: number, tz: number, speed: number, dt: number): number {
    const pos = w.group.position;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return dist;
    const heading = Math.atan2(dx, dz);
    w.group.rotation.y = angleLerp(w.group.rotation.y, heading - w.faceOff, Math.min(1, dt * 3.2));
    const totalStep = Math.min(dist, speed * dt);
    const sub = Math.max(1, Math.ceil(totalStep / 0.13));
    let nx = pos.x;
    let nz = pos.z;
    for (let i = 0; i < sub; i++) {
      const r = resolveCollisions(nx + (Math.sin(heading) * totalStep) / sub, nz + (Math.cos(heading) * totalStep) / sub, 0.55);
      nx = r.x;
      nz = r.z;
    }
    const rad = Math.hypot(nx, nz);
    if (rad > 57) {
      nx = (nx / rad) * 57;
      nz = (nz / rad) * 57;
    }
    pos.set(nx, groundHeightAt(nx, nz), nz);
    playWolf(w, speed > 2 ? "run_loop" : "walk_loop");
    return Math.hypot(tx - nx, tz - nz);
  }
  function wolfQueueTo(w: WolfState, anchorIdx: number) {
    // Cluster changes route along the town's rim (the north edge),
    // so a lakeshore-to-temple leg never crosses the peristyle.
    const from = WOLF_CLUSTER(w.anchorIdx);
    const to = WOLF_CLUSTER(anchorIdx);
    w.queue = [];
    if (from !== to) {
      const westPair =
        (from === 0 && to === 2) || (from === 2 && to === 0) ||
        (from === 0 && to === 3) || (from === 3 && to === 0);
      const westDirect = (from === 2 && to === 3) || (from === 3 && to === 2);
      if (westPair) {
        w.queue.push({ x: -33, z: -19 });
      } else if (westDirect) {
        // Fold to forest: one wood to the other, no waypoints,
        // her legs cross the fold directly, lake fenced by the
        // shared collision pass as always.
      } else {
        // East–west crossings run along the north rim, south of
        // the lake first: two waypoints, ordered by travel, so no
        // leg ever cuts the water (checked leg by leg, not hoped).
        const chain = [
          { x: -24, z: -44 },
          { x: 0, z: -45.5 },
          { x: 16, z: -43 },
          { x: 34, z: -45 },
        ];
        if (to === 1) w.queue.push(...chain);
        else w.queue.push(...[...chain].reverse());
      }
    }
    const [ax, az] = WOLF_ANCHORS[anchorIdx]!;
    w.queue.push({ x: ax, z: az });
    w.anchorIdx = anchorIdx;
  }
  function updateWolf(dt: number, t: number) {
    const w = wolf;
    if (!w) return;
    w.mixer.update(dt);
    const pos = w.group.position;
    // The Centurion's stillness, for the look-back: his own track.
    const pSpeed = dt > 0.0001 ? Math.hypot(walkPos.x - w.prevPX, walkPos.z - w.prevPZ) / dt : 0;
    w.prevPX = walkPos.x;
    w.prevPZ = walkPos.z;
    w.stillTime = pSpeed < 0.15 ? w.stillTime + dt : 0;
    const dPlayer = Math.hypot(walkPos.x - pos.x, walkPos.z - pos.z);
    // Umbra gives her a wide berth, always.
    if (catAnimal) {
      const dCat = Math.hypot(catAnimal.group.position.x - pos.x, catAnimal.group.position.z - pos.z);
      if (dCat < 6 && dCat > 0.01 && (!catFlee || t > catFlee.until - 1.5)) {
        catFlee = {
          x: catAnimal.group.position.x + ((catAnimal.group.position.x - pos.x) / dCat) * 4,
          z: catAnimal.group.position.z + ((catAnimal.group.position.z - pos.z) / dCat) * 4,
          until: t + 4,
        };
      }
    }
    // First proper sighting: within sight at a golden or night
    // phase, the Stories house gains its entry (the shell saves
    // it; the scene only reports the moment, once a session).
    if (
      !w.seenFired &&
      dPlayer < 19 &&
      (isGoldenElevation(skyElevDeg) || nightMix > 0.55)
    ) {
      w.seenFired = true;
      opts.onWolfSeen?.();
    }
    // Bite theatre: a chicken straying too close earns one snap,
    // rarely, at distance, and she never actually catches it.
    if (t < w.biteUntil) return;
    if (t > w.biteCdUntil && w.mode !== "flee") {
      for (const a of animals) {
        if (a.kind !== "chicken") continue;
        const d = Math.hypot(a.group.position.x - pos.x, a.group.position.z - pos.z);
        if (d < 2.1 && d > 0.01) {
          w.group.rotation.y = angleLerp(
            w.group.rotation.y,
            Math.atan2(a.group.position.x - pos.x, a.group.position.z - pos.z) - w.faceOff,
            1,
          );
          playWolf(w, "bite", true);
          w.biteUntil = t + 1.15;
          w.biteCdUntil = t + 150;
          a.target = {
            x: a.group.position.x + ((a.group.position.x - pos.x) / d) * 2.2,
            z: a.group.position.z + ((a.group.position.z - pos.z) / d) * 2.2,
          };
          a.state = "walk";
          a.fleeUntil = t + 1.2;
          playAnimal(a, "run");
          return;
        }
      }
    }
    const active = skyElevDeg < 13 || nightMix > 0.5;
    const midday = skyElevDeg >= 24 && nightMix <= 0.5;
    // Shyness first: too close, and she moves off at a trot to the
    // anchor that takes her farthest from him, unhurried, and
    // with the whole rim to choose from, never cornered.
    if (dPlayer < 8 && w.mode !== "flee") {
      let bestIdx = w.anchorIdx;
      let bestD = -1;
      for (let i = 0; i < WOLF_ANCHORS.length; i++) {
        const [ax, az] = WOLF_ANCHORS[i]!;
        const d = Math.hypot(ax - walkPos.x, az - walkPos.z);
        if (d > bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      wolfQueueTo(w, bestIdx);
      w.mode = "flee";
    }
    if (w.mode === "flee") {
      const headPt = w.queue[0];
      if (!headPt || wolfMove(w, headPt.x, headPt.z, 3.4, dt) < 0.6) w.queue.shift();
      if (w.queue.length === 0 || dPlayer > 12) {
        w.mode = "pause";
        w.pauseUntil = t + 5;
        playWolf(w, "idle_loop");
      }
      return;
    }
    // The look-back: he stands still at a respectful distance and
    // watches, she stops, and looks back, for a few seconds.
    if (w.mode === "watch") {
      playWolf(w, "idle_loop");
      const face = Math.atan2(walkPos.x - pos.x, walkPos.z - pos.z);
      w.group.rotation.y = angleLerp(w.group.rotation.y, face - w.faceOff, Math.min(1, dt * 2.5));
      if (t >= w.watchUntil || dPlayer < 7.5) {
        w.mode = "pause";
        w.pauseUntil = t + 2.5;
        w.watchCdUntil = t + 45;
      }
      return;
    }
    if (
      w.stillTime > 1.6 &&
      dPlayer >= 8.5 &&
      dPlayer < 20 &&
      t > w.watchCdUntil &&
      (w.mode === "pause" || w.mode === "roam")
    ) {
      w.mode = "watch";
      w.watchUntil = t + 3.5;
      return;
    }
    // Midday: she rests at her shaded anchor, whatever else calls.
    if (midday) {
      const dRest = Math.hypot(WOLF_REST[0] - pos.x, WOLF_REST[1] - pos.z);
      if (dRest > 1.2) {
        w.mode = "roam";
        if (wolfMove(w, WOLF_REST[0], WOLF_REST[1], dRest > 15 ? 3.3 : 1.15, dt) < 1.2) {
          w.mode = "rest";
          playWolf(w, "idle_loop");
        }
      } else {
        w.mode = "rest";
        playWolf(w, "idle_loop");
        pos.y = groundHeightAt(pos.x, pos.z);
      }
      return;
    }
    if (w.mode === "rest") w.mode = "pause";
    if (!active && w.mode === "roam") {
      // Between her hours she still finishes a leg, unhurried.
    }
    if (w.mode === "pause") {
      playWolf(w, "idle_loop");
      pos.y = groundHeightAt(pos.x, pos.z);
      if (t >= w.pauseUntil) {
        // Next leg: another anchor, usually in her own country.
        let next = w.anchorIdx;
        for (let tries = 0; tries < 4 && next === w.anchorIdx; tries++) {
          const r = Math.random();
          next =
            r < 0.62
              ? WOLF_CLUSTER(w.anchorIdx) * 3 + Math.floor(Math.random() * 3)
              : Math.floor(Math.random() * WOLF_ANCHORS.length);
        }
        wolfQueueTo(w, next);
        w.mode = "roam";
      }
      return;
    }
    // roam
    const headPt = w.queue[0];
    if (!headPt) {
      w.mode = "pause";
      w.pauseUntil = t + 4;
      return;
    }
    const legDist = Math.hypot(headPt.x - pos.x, headPt.z - pos.z);
    if (wolfMove(w, headPt.x, headPt.z, legDist > 15 ? 3.3 : 1.15, dt) < 0.55) {
      w.queue.shift();
      if (w.queue.length === 0) {
        w.mode = "pause";
        w.pauseUntil = t + 6 + Math.random() * 14;
        playWolf(w, "idle_loop");
      }
    }
  }
  /** For the postcard challenge: Lupa in the camera's frame, at a
   *  golden or night phase, "The Wolf at Dusk". */
  function wolfInViewInternal(): boolean {
    const w = wolf;
    if (!w) return false;
    if (!(isGoldenElevation(skyElevDeg) || nightMix > 0.55)) return false;
    const pos = w.group.position;
    const d = Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z);
    if (d > 36) return false;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const tx = pos.x - camera.position.x;
    const tz = pos.z - camera.position.z;
    const tl = Math.hypot(tx, tz) || 1;
    return (fwd.x * tx + fwd.z * tz) / tl > 0.45;
  }

  // --- Stones & pebbles (Nov 1): a small toy for idle hands ------
  // Loose STONES lie along the lanes, by the tree ring, at the
  // lakeshore and near the piscina. Walk near one and the prompt
  // offers a pickup; he carries one at a time, visible in his
  // right hand, and while he carries it the prompt offers a throw
  // whenever nothing nearer wants his A (see the prompt scan). The
  // throw is the composed overarm (poseThrowArm) launching a small
  // projectile: gravity, a bounce and a roll, then rest where it
  // fell, a few minutes later it fades and the scatter quietly
  // replaces it elsewhere, so the town never runs out. Water has
  // manners: lake and piscina landings splash with ripples, and a
  // flat, fast throw across the lake may skip once or twice first,
  // each skip a smaller splash. Smaller PEBBLES ask nothing at
  // all: his stride kicks them as he walks through them, a
  // skitter ahead with a little hop, two or three bounces losing
  // energy, then they settle and wait to be kicked again from
  // their new spot. Stones are harmless and mode-respecting: they
  // pass through people, are never offered while he sits, rows,
  // or holds her hand, and a kick never alters his stride by a
  // hair (it reads his displacement; it never writes it).
  interface Rock {
    kind: "stone" | "pebble";
    mesh: THREE.Mesh;
    state: "ground" | "fly" | "roll" | "gone";
    vx: number;
    vy: number;
    vz: number;
    skips: number;
    /** Launched flat from the water's edge (a skim throw): the
     *  only kind that can skip on the lake. */
    skim: boolean;
    /** Stones: when a resting thrown stone fades back to the scatter. */
    restUntil: number;
    /** "gone": when the scatter quietly replaces this rock. */
    respawnAt: number;
    /** Spawn fade-in, 0..1. */
    fade: number;
    spot: number;
  }
  const STONE_SPOTS: [number, number][] = [
    [3.4, 3.1], [-3.3, 2.6], [1.8, 6.8], [-1.6, -6.9], [3.1, -2.2],
    [-5.6, -25.8], [-9.6, -34], [-7.2, 25.8], [-17, 21], [3.4, 12.6],
  ];
  const PEBBLE_SPOTS: [number, number][] = [
    [2.2, 4.4], [-2.8, -4.2], [6.8, -1.5], [-6.5, 1.2], [0.8, 11.5],
    [9.6, 8], [-4.4, 17], [24, -11], [-14, -8], [5.6, -25.8],
    [17, 25], [-24, 12], [28, 6], [-25, 16],
  ];
  const ROCK_G = 12;
  const rockR = (rock: Rock) => (rock.kind === "stone" ? 0.095 : 0.052);
  const stoneGeo = new THREE.IcosahedronGeometry(0.095, 0);
  const pebbleGeo = new THREE.IcosahedronGeometry(0.052, 0);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 0.95, flatShading: true });
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x9a917f, roughness: 0.95, flatShading: true });
  const rocks: Rock[] = [];
  let carriedMesh: THREE.Mesh | null = null;
  let carriedRock: Rock | null = null;
  let throwAnimStart = -10;
  let throwLaunched = false;
  let kickCount = 0;
  let kickLineUsed = false;
  let prevWalkX = 0;
  let prevWalkZ = 0;
  function placeRockAtSpot(rock: Rock, spot: number) {
    const spots = rock.kind === "stone" ? STONE_SPOTS : PEBBLE_SPOTS;
    const [sx, sz] = spots[spot % spots.length]!;
    const clean = resolveCollisions(sx, sz, 0.3);
    rock.mesh.position.set(clean.x, terrainHeight(clean.x, clean.z) + rockR(rock) * 0.8, clean.z);
    rock.mesh.rotation.set(spot * 1.7, spot * 2.3, 0);
    rock.mesh.visible = true;
    rock.mesh.scale.setScalar(0.3);
    rock.state = "ground";
    rock.fade = 0;
    rock.restUntil = 0;
    rock.respawnAt = 0;
    rock.skips = 0;
    rock.skim = false;
    rock.spot = spot;
  }
  function makeRock(kind: "stone" | "pebble", spot: number): Rock {
    const mesh = new THREE.Mesh(kind === "stone" ? stoneGeo : pebbleGeo, kind === "stone" ? stoneMat : pebbleMat);
    mesh.castShadow = true;
    world.add(mesh);
    const rock: Rock = {
      kind, mesh, state: "ground", vx: 0, vy: 0, vz: 0,
      skips: 0, skim: false, restUntil: 0, respawnAt: 0, fade: 0, spot,
    };
    placeRockAtSpot(rock, spot);
    return rock;
  }
  for (let i = 0; i < STONE_SPOTS.length; i++) rocks.push(makeRock("stone", i));
  for (let i = 0; i < PEBBLE_SPOTS.length; i++) rocks.push(makeRock("pebble", i));
  const inLakeWater = (x: number, z: number) => {
    const dx = (x - LAKE_CX) / LAKE.rx;
    const dz = (z - LAKE_CZ) / LAKE.rz;
    return dx * dx + dz * dz < 1;
  };
  const inPiscinaWater = (x: number, z: number) =>
    x > PISCINA.water.x0 && x < PISCINA.water.x1 && z > PISCINA.water.z0 && z < PISCINA.water.z1;
  // Splash ripples: a small pool of expanding rings on the water.
  const rippleGeo = new THREE.RingGeometry(0.3, 0.38, 20);
  const ripples: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t0: number; base: number }[] = [];
  function spawnRipple(x: number, y: number, z: number, big: boolean) {
    const rings = big ? 2 : 1;
    for (let i = 0; i < rings; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(rippleGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y + 0.02, z);
      world.add(m);
      ripples.push({ mesh: m, mat, t0: clockTime + i * 0.28, base: big ? 0.55 : 0.32 });
    }
  }
  const THROW_LINES = [
    "A noble use of a free afternoon, Centurion.",
    "The stone had it coming, I am quite sure.",
    "Somewhere below us, a very surprised worm.",
  ];
  const SKIP_LINE = "Oh. It skipped! The lake approves of you, Gaius.";
  const SKIP2_LINE = "Twice! If the legions ever need a skimmer of stones, I shall put your name forward myself.";
  const KICK_LINE = "You have a long-standing quarrel with the road's smallest citizens, I see. Far be it from me to mediate.";
  function aeliaRockLine(line: string, t: number) {
    // Play, not courtship: she comments when she's with him and
    // her bubble is free, and earns nothing by it, ever.
    if (!followMode) return;
    if (Math.hypot(museGroup.position.x - walkPos.x, museGroup.position.z - walkPos.z) > 7) return;
    if (museBubble.hideAt >= t) return;
    showMuseBubbleInternal(line, t);
  }
  /** Life startles politely: market chickens scatter a step or
   *  two from a landing stone; Umbra removes herself entirely. */
  function startleAt(x: number, z: number, t: number) {
    for (const a of animals) {
      if (a.kind !== "chicken") continue;
      const d = Math.hypot(a.group.position.x - x, a.group.position.z - z);
      if (d < 1.8 && d > 0.01) {
        a.target = {
          x: a.group.position.x + ((a.group.position.x - x) / d) * 1.9,
          z: a.group.position.z + ((a.group.position.z - z) / d) * 1.9,
        };
        a.state = "walk";
        a.fleeUntil = t + 1.1;
        playAnimal(a, "run");
      }
    }
    if (catAnimal) {
      const cx = catAnimal.group.position.x;
      const cz = catAnimal.group.position.z;
      const d = Math.hypot(cx - x, cz - z);
      if (d < 2.0 && d > 0.01) {
        catFlee = { x: cx + ((cx - x) / d) * 3.2, z: cz + ((cz - z) / d) * 3.2, until: t + 3 };
      }
    }
  }
  function pickUpStoneInternal() {
    if (carriedRock || !walking || seatPlayer || boatState || handInHand) return;
    let best: Rock | null = null;
    let bestD = 1.9;
    for (const rock of rocks) {
      if (rock.kind !== "stone" || rock.state !== "ground") continue;
      const d = Math.hypot(rock.mesh.position.x - walkPos.x, rock.mesh.position.z - walkPos.z);
      if (d < bestD) {
        bestD = d;
        best = rock;
      }
    }
    if (!best) return;
    best.state = "gone";
    best.mesh.visible = false;
    best.restUntil = 0;
    carriedRock = best;
    carriedMesh = new THREE.Mesh(stoneGeo, stoneMat);
    carriedMesh.castShadow = true;
    const hand = playerRig?.rHand ?? null;
    if (hand) {
      hand.add(carriedMesh);
      // Palm anchor (owner fix, Nov 1): the old fixed offset
      // (0.02, -0.08, 0.03) sat at the wrist with its along-hand
      // component pointing BACK toward the elbow, measured on the
      // shipped Centurion rig, -0.02 along the finger axis, so the
      // stone rendered mid-forearm instead of in his hand. The palm
      // lies OUT along the finger axis: the middle finger's base
      // bone is a direct child of the hand bone, so its local
      // position is the finger direction in hand space, ride out
      // along it to palm centre, 0.085 m from the wrist joint (just
      // past the knuckle, which sits at 0.074). The offset lives in
      // hand-bone space, so it stays seated in the palm through
      // idle, the walk swing, and the throw sweep alike. The
      // fallback is the same point measured on the Centurion rig.
      const fingerBase = hand.children.find((c) => c.name.endsWith("_Middle1")) ?? null;
      if (fingerBase && fingerBase.position.lengthSq() > 0.0001) {
        carriedMesh.position.copy(fingerBase.position).normalize().multiplyScalar(0.085);
      } else {
        carriedMesh.position.set(-0.085, 0.01, 0.003);
      }
      // The bone's world scale is not the town's: counter it so the
      // stone renders at its true size in his grip.
      const ws = new THREE.Vector3();
      hand.getWorldScale(ws);
      if (ws.x > 0.001) carriedMesh.scale.setScalar(1 / ws.x);
    } else {
      world.add(carriedMesh);
    }
    opts.onStoneFx?.("tick");
  }
  function throwStoneInternal() {
    if (!carriedRock || !carriedMesh) return;
    if (!walking || seatPlayer || boatState || handInHand) return;
    throwAnimStart = clockTime;
    throwLaunched = false;
  }
  function updateRocks(dt: number, t: number) {
    // His stride this frame, for pebble kicks: read-only: a kick
    // is launched FROM his motion and never writes back into it.
    const pdx = walkPos.x - prevWalkX;
    const pdz = walkPos.z - prevWalkZ;
    prevWalkX = walkPos.x;
    prevWalkZ = walkPos.z;
    const pSpeed = dt > 0.0001 ? Math.hypot(pdx, pdz) / dt : 0;
    const canKick = walking && !seatPlayer && !boatState && pSpeed > 0.9;
    // The throw's release, timed to the overarm sweep's front.
    if (throwAnimStart > 0 && !throwLaunched && t - throwAnimStart >= 0.24 && carriedRock && carriedMesh) {
      throwLaunched = true;
      const rock = carriedRock;
      const start = new THREE.Vector3();
      carriedMesh.getWorldPosition(start);
      carriedMesh.removeFromParent();
      carriedMesh = null;
      carriedRock = null;
      rock.mesh.position.copy(start);
      rock.mesh.visible = true;
      rock.mesh.scale.setScalar(1);
      rock.fade = 1;
      // From the water's edge, the shore, the dock, the piscina's
      // rim, with the water ahead of him, a throw is a SKIM: flat
      // and fast, the kind that skips. Anywhere else it is a
      // cheerful lob, which splashes like a stone should.
      const fx = Math.sin(walkHeading);
      const fz = Math.cos(walkHeading);
      const aheadX = walkPos.x + fx * 6;
      const aheadZ = walkPos.z + fz * 6;
      const selfLake = Math.hypot((walkPos.x - LAKE_CX) / LAKE.rx, (walkPos.z - LAKE_CZ) / LAKE.rz);
      const aheadLake = Math.hypot((aheadX - LAKE_CX) / LAKE.rx, (aheadZ - LAKE_CZ) / LAKE.rz);
      const skim =
        (selfLake < 1.6 && aheadLake < 1.15) ||
        (inPiscinaWater(aheadX, aheadZ) &&
          Math.abs(walkPos.x - PISCINA.position[0]) < 6 &&
          Math.abs(walkPos.z - PISCINA.position[1]) < 6);
      rock.skim = skim;
      rock.vx = fx * (skim ? 9.4 : 7.6);
      rock.vz = fz * (skim ? 9.4 : 7.6);
      rock.vy = skim ? 1.35 : 4.7;
      rock.skips = 0;
      rock.state = "fly";
      if (Math.random() < 0.7) {
        const line = pickPooled("throw", THROW_LINES);
        if (line) aeliaRockLine(line, t);
      }
    }
    if (throwAnimStart > 0 && t - throwAnimStart > 0.95) throwAnimStart = -10;
    // A carried stone with no hand bone to ride rides at his side.
    if (carriedMesh && !(playerRig?.rHand)) {
      const fx = Math.sin(walkHeading);
      const fz = Math.cos(walkHeading);
      const rx = Math.cos(walkHeading);
      const rz = -Math.sin(walkHeading);
      carriedMesh.position.set(
        walkPos.x + fx * 0.18 + rx * 0.3,
        terrainHeight(walkPos.x, walkPos.z) + 0.92,
        walkPos.z + fz * 0.18 + rz * 0.3,
      );
    }
    for (const rock of rocks) {
      const r = rockR(rock);
      const pos = rock.mesh.position;
      if (rock.state === "gone") {
        if (rock !== carriedRock && t >= rock.respawnAt && rock.respawnAt > 0) {
          // The scatter quietly replaces it, at a home spot away
          // from the Centurion, so it never pops in under his feet.
          const spots = rock.kind === "stone" ? STONE_SPOTS : PEBBLE_SPOTS;
          for (let tries = 0; tries < 3; tries++) {
            const s = Math.floor(Math.random() * spots.length);
            const [sx, sz] = spots[s]!;
            if (Math.hypot(sx - walkPos.x, sz - walkPos.z) > 5 || tries === 2) {
              placeRockAtSpot(rock, s);
              break;
            }
          }
        }
        continue;
      }
      if (rock.state === "ground") {
        if (rock.fade < 1) {
          rock.fade = Math.min(1, rock.fade + dt / 0.8);
          rock.mesh.scale.setScalar(0.3 + 0.7 * rock.fade);
        }
        if (rock.kind === "stone" && rock.restUntil > 0 && t >= rock.restUntil) {
          // Its rest is over: back into the world's scatter.
          rock.state = "gone";
          rock.mesh.visible = false;
          rock.restUntil = 0;
          rock.respawnAt = t + 6 + Math.random() * 10;
          continue;
        }
        if (rock.kind === "pebble" && canKick) {
          const d = Math.hypot(pos.x - walkPos.x, pos.z - walkPos.z);
          if (d < 0.45) {
            const dl = Math.hypot(pdx, pdz) || 1;
            const sp = 2.1 + pSpeed * 0.5;
            rock.vx = (pdx / dl) * sp;
            rock.vz = (pdz / dl) * sp;
            rock.vy = 1.7;
            rock.skips = 0;
            rock.state = "fly";
            pos.y = terrainHeight(pos.x, pos.z) + r + 0.06;
            kickCount++;
            if (kickCount === 5 && !kickLineUsed) {
              // Once a session, never twice: her one dry word on
              // the habit of kicking rocks for no reason.
              kickLineUsed = true;
              aeliaRockLine(KICK_LINE, t);
            }
          }
        }
        continue;
      }
      if (rock.state === "fly") {
        rock.vy -= ROCK_G * dt;
        pos.x += rock.vx * dt;
        pos.y += rock.vy * dt;
        pos.z += rock.vz * dt;
        // Water first: reaching the surface is a splash (or, on
        // the lake, a skip, flat, fast, and not yet twice done).
        const wy = inLakeWater(pos.x, pos.z) ? LAKE_Y : inPiscinaWater(pos.x, pos.z) ? piscinaWaterY : null;
        if (wy !== null && pos.y - r <= wy) {
          const hSpeed = Math.hypot(rock.vx, rock.vz);
          // Only a skim throw skips, flat and fast off the shore
          // or the dock. A lob arrives steep from any height a
          // standing man can throw, and splashes, as it should.
          const canSkip =
            rock.kind === "stone" && wy === LAKE_Y && rock.skips < 2 && rock.skim && hSpeed > 3.4;
          if (canSkip) {
            rock.skips++;
            pos.y = wy + r;
            rock.vy = Math.abs(rock.vy) * 0.25 + 1.15;
            rock.vx *= 0.72;
            rock.vz *= 0.72;
            spawnRipple(pos.x, wy, pos.z, false);
            opts.onStoneFx?.("skip");
            aeliaRockLine(rock.skips === 1 ? SKIP_LINE : SKIP2_LINE, t);
          } else {
            spawnRipple(pos.x, wy, pos.z, true);
            opts.onStoneFx?.("splash");
            rock.state = "gone";
            rock.mesh.visible = false;
            rock.respawnAt = t + 14 + Math.random() * 12;
          }
          continue;
        }
        const gy = terrainHeight(pos.x, pos.z) + r * 0.8;
        if (pos.y <= gy) {
          pos.y = gy;
          const rest = rock.kind === "pebble" ? 0.45 : 0.38;
          const thresh = rock.kind === "pebble" ? 0.75 : 1.5;
          if (Math.abs(rock.vy) > thresh) {
            rock.vy = -rock.vy * rest;
            rock.vx *= 0.68;
            rock.vz *= 0.68;
            opts.onStoneFx?.(rock.kind === "pebble" ? "tick" : "bounce");
            startleAt(pos.x, pos.z, t);
          } else {
            rock.state = "roll";
            rock.vy = 0;
          }
        }
        // A solid thing in the way sheds the blow: reflect off the
        // surface normal at a loss and drop, never through a wall.
        const surf = nearestObstacleSurface(pos.x, pos.z);
        if (surf.dist < r * 0.6) {
          const vn = rock.vx * surf.nx + rock.vz * surf.nz;
          if (vn < 0) {
            rock.vx -= 1.4 * vn * surf.nx;
            rock.vz -= 1.4 * vn * surf.nz;
            rock.vx *= 0.5;
            rock.vz *= 0.5;
          }
        }
        rock.mesh.rotation.x += dt * 3;
        continue;
      }
      // roll
      pos.x += rock.vx * dt;
      pos.z += rock.vz * dt;
      const wy = inLakeWater(pos.x, pos.z) ? LAKE_Y : inPiscinaWater(pos.x, pos.z) ? piscinaWaterY : null;
      const gy = terrainHeight(pos.x, pos.z) + r * 0.8;
      if (wy !== null && gy <= wy + r * 0.4) {
        spawnRipple(pos.x, wy, pos.z, false);
        opts.onStoneFx?.("splash");
        rock.state = "gone";
        rock.mesh.visible = false;
        rock.respawnAt = t + 14 + Math.random() * 12;
        continue;
      }
      pos.y = gy;
      const damp = Math.max(0, 1 - 3.4 * dt);
      rock.vx *= damp;
      rock.vz *= damp;
      rock.mesh.rotation.x += dt * Math.hypot(rock.vx, rock.vz) * 2;
      if (Math.hypot(rock.vx, rock.vz) < 0.22) {
        rock.vx = 0;
        rock.vz = 0;
        rock.state = "ground";
        rock.fade = 1;
        rock.mesh.scale.setScalar(1);
        if (rock.kind === "stone") rock.restUntil = t + 180;
        startleAt(pos.x, pos.z, t);
      }
    }
    // Ripples live about a second: swell, fade, gone.
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]!;
      const age = t - rp.t0;
      if (age < 0) {
        rp.mat.opacity = 0;
        continue;
      }
      if (age > 1.15) {
        world.remove(rp.mesh);
        rp.mat.dispose();
        ripples.splice(i, 1);
        continue;
      }
      const s = rp.base + age * 1.6;
      rp.mesh.scale.setScalar(s);
      rp.mat.opacity = 0.7 * (1 - age / 1.15);
    }
  }

  // --- Sleep and the Dream Door (scene side) --------------------------
  // The server rolls the night and the shell veils the waking; the
  // scene owns the two dream worlds themselves. A FALSE dream is
  // this town remixed: close fog, lamps burning the wrong warmth, a
  // few familiar props gently displaced, every townsfolk gone,
  // and one distant figure who dissolves if he comes close. It ends
  // when she dissolves, when he comes home to the basilica steps,
  // or when it simply runs out. A TRUE dream is the secret terrace
  // in impossible bright stillness: the sun held high (sky block),
  // fireflies out at noon (sky block), her awake beside him. Dreams
  // write nothing here either, no prompts, no systems, no saves.
  let dreamMode: "false" | "true" | null = null;
  /** A morning together (Task 45): the town holds a dawn for the waking,
   *  as a true dream holds its noon, then gives back the real hour. */
  let heldDawn = false;
  /** Set the sun at once on the next frame (behind a veil), no easing. */
  let skySnap = false;
  let dreamGroup: THREE.Group | null = null;
  let dreamFigure: THREE.Group | null = null;
  let dreamFigureMat: THREE.MeshBasicMaterial | null = null;
  let dreamEndsAt = 0;
  let dreamEndFired = false;
  let dreamDissolveT = -1;
  let dreamSaved: { px: number; pz: number; ph: number; mx: number; mz: number } | null = null;

  function setTownsfolkVisible(v: boolean) {
    museGroup.visible = v;
    for (const a of animals) a.group.visible = v;
    if (catAnimal) catAnimal.group.visible = v;
    if (wolfGroupRef) wolfGroupRef.visible = v;
    if (phoenixObj) phoenixObj.group.visible = v;
  }

  function buildFalseDream() {
    dreamGroup = new THREE.Group();
    // Familiar things, gently wrong. A market crate stack standing
    // in the main street where no stall has ever stood.
    const crate = new THREE.Group();
    crate.add(box(0.9, 0.9, 0.9, 0x8a6b42, 0, 0.45, 0));
    crate.add(box(0.8, 0.8, 0.8, 0x9a7a4c, 0.12, 1.3, 0.05));
    crate.add(box(0.85, 0.85, 0.85, 0x7c5f36, -0.18, 0.43, 0.52));
    crate.position.set(1.3, terrainHeight(1.3, 14.5), 14.5);
    crate.rotation.y = 0.7;
    dreamGroup.add(crate);
    // A stone bench across the temple lane, facing the wrong way.
    const bench = new THREE.Group();
    bench.add(box(1.9, 0.18, 0.55, 0xb9ac93, 0, 0.5, 0));
    bench.add(box(0.22, 0.5, 0.5, 0x9c8e6e, -0.8, 0.25, 0));
    bench.add(box(0.22, 0.5, 0.5, 0x9c8e6e, 0.8, 0.25, 0));
    bench.position.set(12.5, terrainHeight(12.5, -21.3), -21.3);
    bench.rotation.y = 2.5;
    dreamGroup.add(bench);
    // A lone column on the peristyle's south-west grass.
    const col = new THREE.Group();
    col.add(box(0.7, 0.3, 0.7, 0xb3a487, 0, 0.15, 0));
    col.add(box(0.52, 3.1, 0.52, 0xcabf9f, 0, 1.85, 0));
    col.add(box(0.72, 0.28, 0.72, 0xb3a487, 0, 3.55, 0));
    col.position.set(-6.2, terrainHeight(-6.2, 8.6), 8.6);
    col.rotation.y = 0.4;
    dreamGroup.add(col);
    // And a barrel keeping the Town Tree company, uninvited.
    const barrel = new THREE.Group();
    barrel.add(box(0.62, 0.85, 0.62, 0x7c5f36, 0, 0.43, 0));
    barrel.add(box(0.66, 0.1, 0.66, 0x5d4930, 0, 0.62, 0));
    barrel.position.set(3.6, terrainHeight(3.6, 3.9), 3.9);
    barrel.rotation.y = 1.1;
    dreamGroup.add(barrel);
    // The figure: a tall silhouette in a long dress, ~25 m off,
    // near enough to know, never to reach.
    dreamFigureMat = new THREE.MeshBasicMaterial({ color: 0x171208, transparent: true, opacity: 1 });
    const fig = new THREE.Group();
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.78, 10), dreamFigureMat);
    dress.position.y = 0.89;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), dreamFigureMat);
    head.position.y = 1.97;
    fig.add(dress, head);
    const farX = 26.6;
    const farZ = -26.1;
    const toFar = Math.hypot(farX - walkPos.x, farZ - walkPos.z);
    const tx = toFar > 30 ? farX : 3.4;
    const tz = toFar > 30 ? farZ : -33;
    const dx = tx - walkPos.x;
    const dz = tz - walkPos.z;
    const dl = Math.max(1, Math.hypot(dx, dz));
    const fx2 = walkPos.x + (dx / dl) * 25;
    const fz2 = walkPos.z + (dz / dl) * 25;
    fig.position.set(fx2, terrainHeight(fx2, fz2), fz2);
    fig.rotation.y = Math.atan2(walkPos.x - fx2, walkPos.z - fz2);
    dreamGroup.add(fig);
    dreamFigure = fig;
    world.add(dreamGroup);
  }

  function enterFalseDreamInternal() {
    if (dreamMode) return;
    dreamMode = "false";
    dreamEndFired = false;
    dreamDissolveT = -1;
    dreamEndsAt = lastT + 210;
    setTownsfolkVisible(false);
    buildFalseDream();
  }

  function enterTrueDreamInternal() {
    if (dreamMode) return;
    dreamMode = "true";
    dreamSaved = {
      px: walkPos.x,
      pz: walkPos.z,
      ph: walkHeading,
      mx: museGroup.position.x,
      mz: museGroup.position.z,
    };
    // The terrace, out of season, at an impossible noon (the sky
    // block holds the sun for as long as the dream lasts). He
    // stands at its heart; she is already there, awake, beside him,
    // both facing the lake the way they do.
    walkPos.x = -27.2;
    walkPos.z = -32.0;
    walkHeading = Math.PI / 2;
    museGroup.position.set(-28.3, terrainHeight(-28.3, -32.5), -32.5);
    museGroup.rotation.y = Math.PI / 2;
  }

  function exitDreamInternal() {
    if (!dreamMode) return;
    const was = dreamMode;
    dreamMode = null;
    setTownsfolkVisible(true);
    if (dreamGroup) {
      world.remove(dreamGroup);
      dreamGroup = null;
      dreamFigure = null;
      dreamFigureMat = null;
    }
    if (was === "true" && dreamSaved) {
      walkPos.x = dreamSaved.px;
      walkPos.z = dreamSaved.pz;
      walkHeading = dreamSaved.ph;
      museGroup.position.set(dreamSaved.mx, terrainHeight(dreamSaved.mx, dreamSaved.mz), dreamSaved.mz);
    }
    dreamSaved = null;
  }

  function updateDream(dt: number, t: number) {
    if (dreamMode !== "false" || !dreamFigure || !dreamFigureMat) return;
    const d = Math.hypot(walkPos.x - dreamFigure.position.x, walkPos.z - dreamFigure.position.z);
    if (dreamDissolveT < 0) {
      // She turns to watch him come, it changes nothing.
      dreamFigure.rotation.y = Math.atan2(
        walkPos.x - dreamFigure.position.x,
        walkPos.z - dreamFigure.position.z,
      );
      const home = Math.hypot(walkPos.x, walkPos.z + 29);
      if (d < 11 || home < 3 || t > dreamEndsAt) dreamDissolveT = 0;
      return;
    }
    dreamDissolveT += dt;
    const k = Math.min(1, dreamDissolveT / 0.9);
    dreamFigureMat.opacity = 1 - k;
    dreamFigure.position.y -= dt * 0.35;
    if (k >= 1 && !dreamEndFired) {
      dreamEndFired = true;
      opts.onDreamEnd?.("false");
    }
  }

  function updateNewSystems(dt: number, t: number) {
    lastT = t;
    if (dreamMode === "false") {
      // The dream town is empty: no animals wander it, no wolf
      // walks it, and she is not in it, only the figure is.
      updateDream(dt, t);
      return;
    }
    for (const a of animals) {
      if (a !== catAnimal) updateAnimalWander(a, dt, t);
    }
    updateCat(dt, t);
    updateRocks(dt, t);
    updateWolf(dt, t);
    // The dance.
    if (danceState) {
      if (danceState.glide) {
        if (stepGlide(danceState.glide, dt)) danceState.glide = null;
      } else {
        danceState.danceT += dt;
        const face = Math.atan2(museGroup.position.x - walkPos.x, museGroup.position.z - walkPos.z);
        avatar.rotation.y = angleLerp(avatar.rotation.y, face, 0.12);
        if (danceState.danceT >= danceState.dur) {
          endDance();
          opts.onDanceEnd?.();
        }
      }
    }
    if (pairState) {
      pairState.t += dt;
      if (pairState.glide) {
        if (stepGlide(pairState.glide, dt, 0.9)) pairState.glide = null;
      } else {
        // Square to her for the clip itself (his heading was set
        // toward her at staging; the glide keeps the line).
        walkHeading = Math.atan2(museGroup.position.x - walkPos.x, museGroup.position.z - walkPos.z);
        avatar.rotation.y = walkHeading;
      }
      if (pairState.t >= pairState.dur) {
        // The numbers a verification needs (Task 17): where the camera
        // stood as the hold ended, off his heading and from him.
        const off = Math.atan2(Math.sin(camYawSmooth - walkHeading), Math.cos(camYawSmooth - walkHeading));
        console.info(`[muse-town] pair camera: the ${pairState.kind} ended with the camera ${off.toFixed(2)} rad off his heading, ${camDistSmooth.toFixed(1)} m from him${pairState.framed ? "" : " (never framed)"}`);
        pairState = null;
      }
    }
    // The sky watch: they keep turning with the sun, slowly, the
    // way people at a rail do.
    if (skyWatchState) {
      if (skyWatchState.glide) {
        if (stepGlide(skyWatchState.glide, dt)) skyWatchState.glide = null;
      }
      skyWatchState.facing = Math.atan2(sunDirCur.x, sunDirCur.z);
      avatar.rotation.y = angleLerp(avatar.rotation.y, skyWatchState.facing, 0.08);
    }
    updatePhoenix(dt, t);
  }

  // The sun itself: a disc and its glow, hung on the sky dome in
  // the sun's true direction. Fog must not dim them.
  const sunDiscMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(spriteCanvas),
    color: 0xffe9b0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const sunDisc = new THREE.Sprite(sunDiscMat);
  sunDisc.scale.setScalar(11);
  skyAnchor.add(sunDisc);
  const sunGlowMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(spriteCanvas),
    color: 0xffc98a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const sunGlow = new THREE.Sprite(sunGlowMat);
  sunGlow.scale.setScalar(30);
  skyAnchor.add(sunGlow);

  // Day/night blending, now a living sky. The darkness (nightMix)
  // is DERIVED from the sun's elevation each frame, so every system
  // that ever read nightMix (stars, fireflies, lamps, meteors, the
  // summit gate, her routine) keeps its trigger untouched. The sun
  // travels: by real Europe/Rome time in auto mode, or easing
  // visibly to a held phase when the Day/Night override is used,
  // several seconds of drifting colour, never a hard cut.
  let skyMode: "auto" | "day" | "night" = "auto";
  const dirFromAngles = (elevDeg: number, azimDeg: number): THREE.Vector3 => {
    const el = (elevDeg * Math.PI) / 180;
    const az = (azimDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  };
  const sunDirCur = dirFromAngles(30, 160);
  const sunDirTgt = new THREE.Vector3();
  let skyElevDeg = 30;
  let skyAzimDeg = 160;
  {
    const a = solarAngles(new Date());
    sunDirCur.copy(dirFromAngles(a.elev, a.azim));
    skyElevDeg = a.elev;
    skyAzimDeg = a.azim;
  }
  let nightTarget = 0;
  let nightMix = 0;
  const skyColor = new THREE.Color();
  const SKY_TOP_NIGHT = new THREE.Color(0x0d1734);
  const SKY_HOR_NIGHT = new THREE.Color(0x33436b);
  const GROUND_TINT_NIGHT = new THREE.Color(0x5a7263);
  const tmpColorA = new THREE.Color();
  const tmpColorB = new THREE.Color();
  // The sky's colour script, keyed on the sun's elevation: night,
  // deep dusk violet, the fire band at the horizon, rose-gold, clear
  // morning, and above 9 degrees it hands over smoothly to the
  // weather palette, so noon is exactly the day look it always was.
  const SKY_STOPS: { e: number; top: THREE.Color; hor: THREE.Color }[] = [
    { e: -12, top: SKY_TOP_NIGHT, hor: SKY_HOR_NIGHT },
    { e: -4, top: new THREE.Color(0x27335e), hor: new THREE.Color(0x8a5f74) },
    { e: 0.5, top: new THREE.Color(0x46589a), hor: new THREE.Color(0xf78d5f) },
    { e: 3.5, top: new THREE.Color(0x5f7fb8), hor: new THREE.Color(0xffb36b) },
    { e: 9, top: new THREE.Color(0x74a8dd), hor: new THREE.Color(0xd9e7ee) },
  ];
  const gradTop = new THREE.Color();
  const gradHor = new THREE.Color();
  function skyGradient(elev: number) {
    const stops = SKY_STOPS;
    const first = stops[0]!;
    const last = stops[stops.length - 1]!;
    if (elev <= first.e) {
      gradTop.copy(first.top);
      gradHor.copy(first.hor);
      return;
    }
    if (elev >= last.e) {
      const k = Math.min(1, (elev - last.e) / 13);
      gradTop.copy(last.top).lerp(wCur.skyTop, k);
      gradHor.copy(last.hor).lerp(wCur.skyHor, k);
      return;
    }
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]!;
      const b = stops[i + 1]!;
      if (elev >= a.e && elev <= b.e) {
        const k = (elev - a.e) / (b.e - a.e);
        gradTop.copy(a.top).lerp(b.top, k);
        gradHor.copy(a.hor).lerp(b.hor, k);
        return;
      }
    }
  }
  const sunWarm = new THREE.Color();
  function applyDayNight() {
    // The sun rides to its direction; its light warms as it lowers,
    // and the sky gradient follows its elevation, then a lightning
    // flash can still lift everything toward pale blue-white.
    sun.position.copy(sunDirCur).multiplyScalar(85);
    sunWarm.setHex(0xfff2d8);
    if (skyElevDeg < 16) sunWarm.lerp(tmpColorB.setHex(0xffc98a), Math.min(1, Math.max(0, (16 - skyElevDeg) / 13)));
    if (skyElevDeg < 4) sunWarm.lerp(tmpColorB.setHex(0xff9a4d), Math.min(1, Math.max(0, (4 - skyElevDeg) / 6)));
    skyAnchor.position.set(camera.position.x, 0, camera.position.z);
    sunDisc.position.copy(sunDirCur).multiplyScalar(118);
    sunGlow.position.copy(sunDirCur).multiplyScalar(116);
    const discVis = THREE.MathUtils.clamp((skyElevDeg + 1.5) / 2.5, 0, 1) * (1 - Math.min(1, wCur.rain + wCur.snow)) * (weatherId === "fog" ? 0.3 : 1);
    sunDiscMat.opacity = discVis * 0.95;
    sunGlowMat.opacity = discVis * 0.4;
    sunDiscMat.color.copy(sunWarm);
    skyGradient(skyElevDeg);
    tmpColorA.copy(gradTop);
    if (lightningFlash > 0.01) tmpColorA.lerp(tmpColorB.setHex(0xe8efff), lightningFlash * 0.55);
    skyUniforms.topColor.value.copy(tmpColorA);
    tmpColorA.copy(gradHor);
    if (lightningFlash > 0.01) tmpColorA.lerp(tmpColorB.setHex(0xdfe9ff), lightningFlash * 0.45);
    skyUniforms.horizonColor.value.copy(tmpColorA);
    skyColor.copy(gradTop).lerp(gradHor, 0.4);
    if (lightningFlash > 0.01) skyColor.lerp(tmpColorB.setHex(0xcfdcff), lightningFlash * 0.5);
    scene.background = skyColor;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(skyColor);
      // Fog closes in with fog/rain/snow/storm weather; at night it also
      // creeps a little nearer so the lamps feel pools of light.
      scene.fog.near = wCur.fogNear - nightMix * 6;
      scene.fog.far = wCur.fogFar - nightMix * 18;
      if (dreamMode === "false") {
        // The false dream's weather: a close, warm, wrong murk
        // that swallows the streets a few houses down.
        scene.fog.near = 7;
        scene.fog.far = 46;
        scene.fog.color.lerp(tmpColorB.setHex(0xc78a4a), 0.38);
      }
    }
    hemi.intensity = (0.95 - nightMix * 0.55) * wCur.hemiMul + lightningFlash * 0.7;
    sun.intensity = (1.9 - nightMix * 1.55) * wCur.sunMul;
    rim.intensity = 0.55 - nightMix * 0.3;
    scene.environmentIntensity = (0.35 - nightMix * 0.22) * (0.55 + wCur.sunMul * 0.45);
    sun.color.copy(sunWarm).lerp(tmpColorB.setHex(0x8fb4ff), nightMix);
    // Lamps come on at night, and early under fog or rain, where a
    // warm window against the grey does most of the cosy work.
    const lampLevel = Math.min(1, nightMix + (weatherId === "fog" ? 0.45 : 0) + wCur.rain * FEEL.rainLampGlow);
    // A faint shared lift prevents crushed blacks; the visible pools come
    // from the individual fixtures below, not one implausible plaza bulb.
    plazaGlow.intensity = lampLevel * 8;
    // Night faces: the soft moon and the warm fill on the pair.
    nightLights.update({
      nightMix,
      rain: wCur.rain,
      snow: wCur.snow,
      fog: weatherId === "fog",
      muse: museGroup.position,
      player: avatar.position,
      walking,
      camera: camera.position,
      moon: trueSky.moon(),
    });
    trueSky.setOpacity(nightMix * 0.95 * (1 - Math.min(1, wCur.rain + wCur.snow)) * (weatherId === "fog" ? 0.25 : 1));
    // Fireflies belong to warm-season nights, and they keep to the
    // lake and its willows.
    fireflyMat.opacity =
      nightMix * 0.9 * (1 - Math.min(1, wCur.rain)) * (currentTreeSeason === "spring" || currentTreeSeason === "summer" ? 1 : 0);
    // In a true dream the fireflies are out at noon-brightness,
    // out of season, hanging in the stillness over the lake.
    if (dreamMode === "true") fireflyMat.opacity = 0.95;
    cloudMat.opacity = Math.max(0.18, wCur.cloudOpacity - nightMix * 0.5);
    cloudMat.color.copy(wCur.cloudColor).lerp(tmpColorB.setHex(0x8fa3c8), nightMix);
    for (const headMat of lampHeads) {
      // In a false dream the lamps burn lit at any hour, and the
      // wrong warmth, too much forge in the amber.
      headMat.emissive.setHex(dreamMode === "false" ? 0xff6a2a : 0xffb845);
      headMat.emissiveIntensity = dreamMode === "false" ? 1.5 : lampLevel * 1.6;
    }
    const lampState = streetLamps.update({
      t: performance.now() / 1000,
      lampLevel,
      wetness,
      fog: weatherId === "fog",
      rain: wCur.rain,
      wind: wCur.wind,
      season: currentTreeSeason,
      tier: runtime.tier,
      camera,
      listener: walking ? walkPos : camera.position,
      reducedMotion: opts.reducedMotion,
      falseDream: dreamMode === "false",
    });
    if (lampState.ignitedNear) playLampIgnite();
    setLampCrackleLevel(lampState.crackle);
    // The grass texture carries the green; tint it toward the weather,
    // then night, then darken it while wet and whiten it under snow cover.
    const g = (ground.material as THREE.MeshStandardMaterial).color;
    g.setHex(0xffffff).lerp(wCur.groundTint, wCur.groundDim);
    g.lerp(GROUND_TINT_NIGHT, nightMix * 0.85);
    if (wetness > 0.01) g.multiplyScalar(1 - wetness * 0.22);
    if (snowCover > 0.01) g.lerp(tmpColorB.setHex(0xf2f6f8), snowCover * 0.5);
    groundMat.roughness = 0.95 - wetness * 0.5;
    plazaMat.roughness = 0.9 - wetness * 0.55;
    puddleMat.opacity = wetness * 0.55 * (1 - nightMix * 0.3);
  }
  applyDayNight();

  // Camera flights.
  let flight: Flight | null = null;
  function flyTo(
    pos: [number, number, number],
    target: [number, number, number],
    durationMs = 1400,
  ) {
    if (opts.reducedMotion || durationMs <= 0) {
      camera.position.set(...pos);
      controls.target.set(...target);
      flight = null;
      return;
    }
    flight = {
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...pos),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...target),
      start: performance.now(),
      duration: durationMs,
    };
  }

  // Picking: distinguish a tap from an orbit drag.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt: { x: number; y: number; t: number } | null = null;
  // Pinch zoom (Nov 1): every canvas pointer is tracked, so a
  // second finger landing turns the drag into a pinch WITHOUT a
  // yaw snap (the drag simply suspends, its origin is never
  // re-read from the new finger), and lifting back to one finger
  // resumes the drag from that finger's CURRENT position, again
  // with no snap. A gesture that ever held two pointers is a
  // pinch, never a tap: the pick below is swallowed for it. The
  // stick and buttons are DOM controls above the canvas, so a
  // pinch can never be read as stick input; the canvas's own
  // non-passive touch cancellation (below) keeps it from ever
  // becoming a page gesture.
  const camPointers = new Map<number, { x: number; y: number }>();
  let pinchSpread = 0;
  let pinchSeen = false;
  function onPointerDown(e: PointerEvent) {
    camPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Capture (Task 17): a pointer that goes down on the canvas and
    // lifts over a control drawn above it (a chip, the pad, the
    // prompt pill) used to deliver its pointerup to that element, and
    // the canvas kept counting it: a drag in progress for ever, which
    // gates the pair framing, the loose follow and the way home. With
    // capture the lift reaches the canvas wherever it happens.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety; the window fallbacks below still clear */
    }
    if (camPointers.size === 2) {
      const [pa, pb] = [...camPointers.values()];
      pinchSpread = Math.hypot(pa!.x - pb!.x, pa!.y - pb!.y);
      pinchSeen = true;
      walkDrag = null;
    }
    if (camPointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    }
    if (!walking) flight = null;
    if (walking && camPointers.size === 1) walkDrag = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: PointerEvent) {
    const tracked = camPointers.get(e.pointerId);
    if (tracked) {
      tracked.x = e.clientX;
      tracked.y = e.clientY;
    }
    if (walking && camPointers.size === 2) {
      // Pinch: spread widens → zoom in (distance shrinks), spread
      // narrows → zoom out, monotonically with the ratio, clamped
      // by walkRestDist's own range.
      const [pa, pb] = [...camPointers.values()];
      const spread = Math.hypot(pa!.x - pb!.x, pa!.y - pb!.y);
      if (pinchSpread > 0 && spread > 0) {
        userZoom = THREE.MathUtils.clamp(userZoom * (pinchSpread / spread), ZOOM_MIN, ZOOM_MAX);
      }
      pinchSpread = spread;
      return;
    }
    if (!walking || !walkDrag) return;
    let dx = e.clientX - walkDrag.x;
    let dy = e.clientY - walkDrag.y;
    walkDrag = { x: e.clientX, y: e.clientY };
    if (forcedLandscapeView) {
      // Stage turned 90° clockwise by the shell: express the drag in
      // stage axes (−90° rotation) so horizontal drags still swing the
      // yaw and vertical drags still pitch, exactly as upright.
      const sx = dx;
      const sy = dy;
      dx = sy;
      dy = -sx;
    }
    // The player's drag writes the yaw itself, directly, and the
    // loose follow never argues with it: the input reference moves
    // with the drag, so the next stick push reads against the view
    // the player just chose (see camYawSmooth).
    camYawSmooth -= dx * 0.0052;
    inputYawRef = camYawSmooth;
    camPitchOffset = THREE.MathUtils.clamp(camPitchOffset + dy * 0.012, CAM_PITCH_MIN, CAM_PITCH_MAX);
  }
  function onPointerCancel(e: PointerEvent) {
    camPointers.delete(e.pointerId);
    if (camPointers.size === 1 && walking) {
      const [p] = [...camPointers.values()];
      walkDrag = { x: p!.x, y: p!.y };
    } else if (camPointers.size === 0) {
      walkDrag = null;
      pinchSeen = false;
    }
  }
  // Double tap on the open scene recenters the camera (Task 32), the
  // phone's R3: two genuine taps on nothing interactable, close in time
  // and place. A single tap does nothing new; a tap on an interactable
  // still opens it, and never counts toward a double.
  let lastOpenTap: { t: number; x: number; y: number } | null = null;
  const DOUBLE_TAP_MS = 350;
  const DOUBLE_TAP_PX = 40;
  function recenterWalkCamera() {
    if (!walking) return;
    padOrbitX = 0;
    padOrbitY = 0;
    camRecenter = 0.8;
    userZoom = 1;
  }
  function onPointerUp(e: PointerEvent) {
    camPointers.delete(e.pointerId);
    if (camPointers.size === 1 && walking) {
      // Back to one finger: the drag resumes from the remaining
      // finger's current position, continuous, no yaw jump.
      const [p] = [...camPointers.values()];
      walkDrag = { x: p!.x, y: p!.y };
    } else if (camPointers.size === 0) {
      walkDrag = null;
    }
    if (pinchSeen) {
      if (camPointers.size === 0) pinchSeen = false;
      downAt = null;
      return;
    }
    // In walk mode a drag orbits the camera, but a genuine tap (barely
    // moved, quickly released) on an interactable is a click: it opens
    // that place's panel directly, exactly as a tap does in overview.
    if (walking) walkDrag = null;
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const dt = performance.now() - downAt.t;
    downAt = null;
    if (moved > 8 || dt > 450) return;
    const rect = canvas.getBoundingClientRect();
    if (forcedLandscapeView) {
      // The canvas's axis-aligned box on screen is the PORTRAIT box,
      // but its local axes are turned 90° clockwise: a local point
      // (lx, ly) sits on screen at (boxWidth − ly, lx) within the box.
      // Inverting that: lx = screenY, ly = boxWidth − screenX (both
      // measured from the box's top-left), normalised by the local
      // size, which is the box's height × width, swapped.
      pointer.x = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.y = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    } else {
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickRoots, true);
    const hit = hits[0];
    let obj: THREE.Object3D | null = hit?.object ?? null;
    while (obj && !obj.userData.pick) obj = obj.parent;
    const pick = obj?.userData.pick as { kind: PickKind; id: string } | undefined;
    if (pick) {
      lastOpenTap = null;
      opts.onPick(pick.kind, pick.id);
      return;
    }
    if (!walking) return;
    const now = performance.now();
    if (lastOpenTap && now - lastOpenTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastOpenTap.x, e.clientY - lastOpenTap.y) < DOUBLE_TAP_PX) {
      lastOpenTap = null;
      recenterWalkCamera();
      return;
    }
    lastOpenTap = { t: now, x: e.clientX, y: e.clientY };
  }
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  // Fallbacks (Task 17): a lift the canvas never saw still leaves the
  // count, and a tab change or a lost focus drops every pointer.
  const onWindowPointerEnd = (e: PointerEvent) => {
    if (camPointers.has(e.pointerId)) onPointerCancel(e);
  };
  const dropAllPointers = () => {
    camPointers.clear();
    walkDrag = null;
    pinchSeen = false;
    downAt = null;
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") dropAllPointers();
  };
  window.addEventListener("pointerup", onWindowPointerEnd);
  window.addEventListener("pointercancel", onWindowPointerEnd);
  window.addEventListener("blur", dropAllPointers);
  document.addEventListener("visibilitychange", onVisibility);

  // Pull-to-refresh guard: a finger held down or dragged on the town
  // view (an orbit drag in walk mode, a plain drag in overview) must
  // never be reinterpreted by the browser/WebView as a scroll or
  // pull-to-refresh gesture. The canvas already carries
  // touch-action:none in CSS; this non-passive cancellation covers
  // WebViews that still leak the gesture (and pairs with the
  // document-level overscroll-behavior:none in theme.css). Cancelling
  // the touch default does not stop pointer events, so taps, picks,
  // and camera drags above are untouched. Long-press context menus on
  // the view are suppressed for the same reason.
  const blockTouchGesture = (e: TouchEvent) => e.preventDefault();
  const blockContextMenu = (e: Event) => e.preventDefault();
  canvas.addEventListener("touchstart", blockTouchGesture, { passive: false });
  canvas.addEventListener("touchmove", blockTouchGesture, { passive: false });
  canvas.addEventListener("contextmenu", blockContextMenu);

  // Desktop wheel zoom for the walk camera, the pinch's sibling,
  // riding the same userZoom (the overview's wheel dolly stays
  // OrbitControls' own). Non-passive so the wheel never scrolls
  // the page behind the town.
  const onWheelZoom = (e: WheelEvent) => {
    if (!walking) return;
    e.preventDefault();
    userZoom = THREE.MathUtils.clamp(userZoom * Math.exp(e.deltaY * 0.0012), ZOOM_MIN, ZOOM_MAX);
  };
  canvas.addEventListener("wheel", onWheelZoom, { passive: false });

  // Landscape support: driven by the canvas box's actual aspect,
  // wider than tall means landscape framing, whatever any orientation
  // API claims (the app webview does not reliably report rotation).
  // Portrait needs a wider vertical fov to keep the town in frame;
  // landscape (short, wide screens, phones turned sideways) needs the
  // opposite, a slightly tighter vertical fov and a pulled-back walk
  // camera so the horizon, tree canopy and both characters stay
  // visible. The camera aspect is rewritten on every resize so the 3D
  // view genuinely widens instead of stretching or letterboxing.
  function resize() {
    let w = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
    let h = canvas.clientHeight || canvas.parentElement?.clientHeight || 0;
    // A renderer sized to a few pixels and then CSS-stretched to fill
    // the screen paints exactly one smeared colour, the sky, edge
    // to edge, which reads as a dead blue screen even though the loop
    // is running. If layout reports an implausibly small box (the
    // canvas not laid out yet, a collapsed parent), fall back to the
    // window's own size, which a fullscreen town always matches.
    if (w < 8 || h < 8) {
      w = window.innerWidth || w || 1;
      h = window.innerHeight || h || 1;
    }
    renderer.setSize(w, h, false);
    viewAspect = w / h;
    isLandscapeView = viewAspect > 1.05 && h <= 860;
    camera.aspect = viewAspect;
    if (viewAspect < 0.8) {
      camera.fov = 60; // tall portrait phone
    } else if (isLandscapeView) {
      camera.fov = 52; // landscape phone: wider horizontal view, keep vertical readable
    } else if (viewAspect > 1.6) {
      camera.fov = 46; // desktop / tablet widescreen
    } else {
      camera.fov = 48;
    }
    // In landscape the orbit distance can breathe a little further so
    // the whole plaza fits in the shorter frame.
    controls.maxDistance = isLandscapeView ? 88 : 78;
    controls.minDistance = isLandscapeView ? 6 : 7;
    camera.updateProjectionMatrix();
  }
  resize();
  sceneSized = true;
  const resizeObs =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (resizeObs && canvas.parentElement) resizeObs.observe(canvas.parentElement);
  // Belt and braces for rotation: some webviews fire orientationchange
  // (or a window resize) without the parent box firing the observer
  // first, re-apply the size and camera on every such signal, twice,
  // since rotation geometry often settles a frame late.
  const onViewportSignal = () => {
    resize();
    later(resize, 120);
    later(resize, 450);
  };
  window.addEventListener("resize", onViewportSignal);
  window.addEventListener("orientationchange", onViewportSignal);
  // Guard like speechSynthesis in App: a webview may expose
  // visualViewport without listener APIs, never let that throw.
  try {
    const vv = window.visualViewport;
    if (vv && typeof vv.addEventListener === "function") {
      vv.addEventListener("resize", onViewportSignal);
    }
  } catch {
    /* viewport signals are belt-and-braces; resize events still fire */
  }

  const tuftDummy = new THREE.Object3D();
  let lastGrassUpdate = -Infinity;
  let raf = 0;
  let readyFired = false;
  let frameErrorStreak = 0;
  let renderErrorFired = false;
  // Adaptive quality: the first frames are timed with the RAW clock
  // (the loop's dt is clamped for animation). If they average slower
  // than ~4 fps, this device, a weak phone GPU, or a browser whose
  // software GL masks its renderer name, cannot carry the full
  // settings, so the scene drops itself to the gentle ones (ratio 1,
  // no shadow maps) and tells the shell to light its Light graphics
  // toggle, so the two never disagree.
  const clock = new THREE.Clock();
  let lastFrameMs = performance.now();

  // --- Clip-animation drive --------------------------------------------------
  // Runs after every movement update (the walk controller and Muse's
  // companion steering) and before the secret-moment choreography, so
  // a ready character's mixer has the last word over the procedural
  // bone posing, and the secret moment's head lean, applied after
  // this, still lands on top. Speed is measured from the character's
  // actual displacement, so blends follow the ground truth for the
  // Centurion (stick-driven) and Muse (follow / walk-home) alike.
  const drivePrevMuse = museGroup.position.clone();
  const drivePrevPlayer = avatar.position.clone();
  let museSpeedSm = 0;
  let playerSpeedSm = 0;
  // Character reveal gate. A VRM arrives standing in its bind pose
  // (arms straight out to the sides) and, while its clips download
  // and bake, the bake's restores and measurements pose it around
  // further, the player kept catching that interval on screen ("they
  // stick their arms in the air when they switch"). So each body is
  // added HIDDEN and is revealed only here, inside the frame loop,
  // at the first moment it can be painted already animated:
  //   - animator ready → prime() applies the idle clip at full
  //     weight in this same tick, then the body is shown, its
  //     first painted frame is a true idle frame;
  //   - no animator at all (the model itself failed) → shown at
  //     once; the load handler's procedural arm pose was applied in
  //     the same tick the body was added, before any paint;
  //   - clips failed their gate → shown at once under procedural
  //     posing, exactly the pre-clip behaviour;
  //   - clips merely slow → after a 6 s grace the same, and the clips
  //     take over at full weight when they land, a slow or failed
  //     bake can never leave a character invisible.
  // Later animator state changes all flow through the mixers, which
  // write every frame, so no later frame can show a bind pose
  // either. (Muse's star and both umbrellas/bubbles are siblings of
  // the hidden body, not children, her spot stays marked, as it
  // always was when her model failed.)
  function tryRevealChars() {
    if (!museRevealed && museBody) {
      if (museAnim?.ready) {
        museAnim.prime();
        museBody.visible = true;
        museRevealed = true;
      } else if (!museAnim || museAnim.failed || performance.now() - museAttachedAt > 6000) {
        museBody.visible = true;
        museRevealed = true;
      }
    }
    if (!playerRevealed && playerBody) {
      if (playerAnim?.ready) {
        playerAnim.prime();
        playerBody.visible = true;
        playerRevealed = true;
      } else if (!playerAnim || playerAnim.failed || performance.now() - playerAttachedAt > 6000) {
        playerBody.visible = true;
        playerRevealed = true;
      }
    }
  }

  // One line, once both animators have settled, in the same
  // [muse-town] voice as the material sweep below: a build whose
  // clips failed says so in the console instead of standing stiff
  // in silence. (That silence is how the reduced-motion freeze
  // survived four releases; the next stiff town should arrive
  // self-diagnosed.) The verdict waits for stage two as well as
  // stage one, and it counts actions, not just animators: a clip
  // the bake refuses earns no action and throws nothing, so an
  // animator can be "ready" over a jump that does not exist. The
  // wrong-pack jump clips hid exactly that way through v0.6.1,
  // behind a menu line that read "full". This line names what is
  // missing, and quotes the caught error when there is one.
  let animSummaryLogged = false;
  function logAnimSummaryOnce() {
    if (animSummaryLogged || !museAnim || !playerAnim) return;
    const settled = (a: CharAnimator) => a.failed || (a.ready && a.librarySettled);
    if (!settled(museAnim) || !settled(playerAnim)) return;
    animSummaryLogged = true;
    const missG = playerAnim.missingActions;
    const missA = museAnim.missingActions;
    let extra = "";
    if (missG.length) extra += `; gaius missing: ${missG.join(", ")}`;
    if (missA.length) extra += `; aelia missing: ${missA.join(", ")}`;
    if (playerAnim.failureReason) extra += `; gaius error: ${playerAnim.failureReason}`;
    if (museAnim.failureReason) extra += `; aelia error: ${museAnim.failureReason}`;
    console.info(
      `[muse-town] animators: gaius=${playerAnim.ready ? "ready" : "failed"}, aelia=${museAnim.ready ? "ready" : "failed"}, reducedMotion=${opts.reducedMotion}${extra}`,
    );
    // The same verdict where a phone's owner can actually read it:
    // one quiet line in the town menu.
    const part = (name: string, a: CharAnimator) =>
      a.ready ? `${name} ready` : `${name} failed${a.failureReason ? `: ${a.failureReason}` : ""}`;
    let status: string;
    if (!playerAnim.ready || !museAnim.ready) {
      status = `Motion: fallback posing (${part("gaius", playerAnim)}, ${part("aelia", museAnim)})`;
    } else if (missG.length || missA.length) {
      const parts: string[] = [];
      if (missG.length) parts.push(`gaius ${missG.join(", ")} missing`);
      if (missA.length) parts.push(`aelia ${missA.join(", ")} missing`);
      status = `Motion: partial (${parts.join("; ")})`;
    } else {
      status = "Motion: full (both animators ready)";
    }
    opts.onMotionStatus?.(status);
  }

  function driveClipAnims(dt: number, t: number) {
    tryRevealChars();
    logAnimSummaryOnce();
    updateGreetingArming(t);
    const dispM = Math.hypot(museGroup.position.x - drivePrevMuse.x, museGroup.position.z - drivePrevMuse.z);
    const dispP = Math.hypot(avatar.position.x - drivePrevPlayer.x, avatar.position.z - drivePrevPlayer.z);
    drivePrevMuse.copy(museGroup.position);
    drivePrevPlayer.copy(avatar.position);
    if (dt > 0.0001) {
      const k = 1 - Math.exp(-dt * 7);
      museSpeedSm += (dispM / dt - museSpeedSm) * k;
      playerSpeedSm += (dispP / dt - playerSpeedSm) * k;
    }
    if (secretMoment) {
      museSpeedSm = 0;
      playerSpeedSm = 0;
    }
    if (pairState) {
      // The pair clips own both bodies for their few seconds.
      museSpeedSm = 0;
      playerSpeedSm = 0;
    }
    if (boatState) {
      // Aboard the rowboat both bodies are seated; their travel is
      // the boat's, not a walk, so the locomotion blend stays at rest
      // and the sit pose owns them (see applySeatedPoses' boat bench).
      museSpeedSm = 0;
      playerSpeedSm = 0;
    }
    const WAVE_LEN = 2.53; // the HandWave01 clips' duration
    const museWaveAge = t - museWaveStart;
    const playerWaveAge = t - playerWaveStart;
    if (museAnim?.ready) {
      museAnim.update(dt, museSpeedSm, museAnim.hasWave && museSpeedSm < 0.4 && museWaveAge >= 0 && museWaveAge < WAVE_LEN, !!seatMuse || !!boatState?.museAboard || !!bathState?.museIn, pairState && !pairState.glide ? pairState.kind : danceState ? "dance" : talkAnimOpen ? "talk" : routineKey() === "sounds" && !followMode && !seatMuse && !bathState ? "poseA" : null, !!seatMuse);
      // The clips own the body's bob and sway now; retire the
      // procedural inner-group bob for her.
      museInner.position.y = 0;
      museInner.rotation.z = 0;
      if (!museAnim.hasWave && museRig && museWaveAge >= 0 && museWaveAge < 2.2) {
        // Wave clip missing: the softened procedural wave rides on
        // top of the mixer for the greeting window, as before.
        poseWave(museRig, t);
      }
    }
    if (playerAnim?.ready) {
      // A moving landing runs straight on; only a standing one takes a knee.
      const hopMode = sliding(run) ? "slide" : airborne(hop) ? (hop.vy > 0 ? "jumpUp" : "jumpFall") : t - hopLandedAt < 0.2 && playerSpeedSm < 1 ? "jumpLand" : null;
      {
        const embracing = !!pairState && pairState.kind === "hug";
        gaiusArms.setVisible(armsVisibility({ bathing: !!bathState, embracing, seated: !!seatPlayer, shieldOut, swordWorn }), dt);
      }
      playerAnim.update(dt, walking ? playerSpeedSm : 0, playerAnim.hasWave && playerSpeedSm < 0.4 && playerWaveAge >= 0 && playerWaveAge < WAVE_LEN, !!seatPlayer || !!boatState || !!bathState, hopMode ?? (pairState && !pairState.glide ? pairState.kind : danceState ? "dance" : talkAnimOpen ? "talk" : null), !!seatPlayer);
      playerInner.position.y = 0;
      playerInner.rotation.z = 0;
      if (!playerAnim.hasWave && playerRig && playerWaveAge >= 0 && playerWaveAge < 2.2) {
        poseWave(playerRig, t);
      }
    }
    // --- Umbrella arms (DORMANT, umbrellas removed, Nov 1) ------------
    // In the rain, each standing/walking character HOLDS their
    // umbrella (composed poseUmbrellaArm, over idle and walk alike).
    // While sharing (she's following, side by side), his arm stays up
    // and her near arm links through his instead, poseLinkArm, with
    // a slight inward lean and a small positional servo easing her
    // stance so her hand stays registered at his elbow as they walk.
    // The arm-link servo in this block is what drove her circling
    // around and through him in the rain; the whole block is gated
    // off by UMBRELLAS_ENABLED and never runs while it is false.
    const rainAmt = Math.min(1, wCur.rain);
    if (UMBRELLAS_ENABLED && rainAmt > 0.25 && !secretMoment && !boatState) {
      const amt = Math.min(1, (rainAmt - 0.25) * 2);
      if (playerRig && !seatPlayer && !(playerWaveAge >= 0 && playerWaveAge < WAVE_LEN)) {
        poseUmbrellaArm(playerRig, amt, !playerAnim?.ready);
      }
      if (museRig && !seatMuse && !(museWaveAge >= 0 && museWaveAge < WAVE_LEN)) {
        if (umbrellaSharing) poseLinkArm(museRig, amt, !museAnim?.ready);
        else poseUmbrellaArm(museRig, amt, !museAnim?.ready);
      }
      if (umbrellaSharing) {
        museInner.rotation.z = 0.055;
        playerInner.rotation.z = -0.04;
        if (walking && playerRig?.rLowerArm && museRig?.lHand) {
          playerRig.rLowerArm.getWorldPosition(umbElbowW);
          museRig.lHand.getWorldPosition(umbHandW);
          const dx = umbElbowW.x - umbHandW.x;
          const dz = umbElbowW.z - umbHandW.z;
          const gap = Math.hypot(dx, dz);
          if (gap > 0.14 && gap < 2.5) {
            const step = Math.min(0.045, (gap - 0.14) * 0.3);
            museGroup.position.x += (dx / gap) * step;
            museGroup.position.z += (dz / gap) * step;
            museGroup.position.y = terrainHeight(museGroup.position.x, museGroup.position.z);
          }
        }
      }
    }
    // --- Hand-in-hand wandering ---------------------------------------
    // Their inner hands meet and stay met while they wander: both
    // inner arms posed over the clips, a slight inward lean from
    // each of them, and a light positional servo easing her stance
    // so her hand stays registered at his while they walk. Rain no
    // longer interrupts this (the umbrella link that used to take
    // precedence is removed, Nov 1): joined hands stay joined in
    // every weather, exactly as in dry weather. Seated, rowing, and
    // terrace moments own their own poses and are untouched by this.
    const wantHold =
      handInHand && followMode && !secretMoment && !boatState && !seatPlayer && !seatMuse
        ? 1
        : 0;
    handBlend += (wantHold - handBlend) * Math.min(1, dt * 3.5);
    if (handBlend < 0.02 && wantHold === 0) handBlend = 0;
    if (handBlend > 0.02) {
      if (playerRig && !(playerWaveAge >= 0 && playerWaveAge < WAVE_LEN)) {
        poseHoldHandPlayer(playerRig, handBlend, !playerAnim?.ready);
      }
      if (museRig && !(museWaveAge >= 0 && museWaveAge < WAVE_LEN)) {
        poseHoldHandMuse(museRig, handBlend, !museAnim?.ready);
      }
      museInner.rotation.z = 0.05 * handBlend;
      playerInner.rotation.z = -0.035 * handBlend;
      if (walking && playerRig?.rHand && museRig?.lHand) {
        playerRig.rHand.getWorldPosition(umbElbowW);
        museRig.lHand.getWorldPosition(umbHandW);
        const dx = umbElbowW.x - umbHandW.x;
        const dz = umbElbowW.z - umbHandW.z;
        const gap = Math.hypot(dx, dz);
        if (gap > 0.18 && gap < 2.5) {
          const step = Math.min(0.04, (gap - 0.18) * 0.3);
          museGroup.position.x += (dx / gap) * step;
          museGroup.position.z += (dz / gap) * step;
          museGroup.position.y = groundHeightAt(museGroup.position.x, museGroup.position.z);
        }
      }
    }
    // The flirt's answering hand (Task 13): both right forearms, folded
    // at the belly as the take has them, are lifted to the partner's
    // chest for the hold, composed over the clip like the joined hands
    // above. Eases in with the hold and out after it.
    const wantLift = pairState?.kind === "flirt" && !pairState.glide ? 1 : 0;
    flirtLift += (wantLift - flirtLift) * Math.min(1, dt * 3.5);
    if (flirtLift < 0.02 && wantLift === 0) flirtLift = 0;
    if (flirtLift > 0.02) {
      if (playerRig) poseFlirtLift(playerRig, flirtLift, "his");
      if (museRig) poseFlirtLift(museRig, flirtLift, "hers");
    }
    // Standing joined: now and then she says so, in the close register.
    if (
      handInHand &&
      followMode &&
      walking &&
      !isMoving &&
      museSpeedSm < 0.35 &&
      t - lastWanderLineAt > 26 &&
      museBubble.hideAt < t
    ) {
      const line = pickPooled("wander-idle", WANDER_IDLE_LINES);
      if (line) {
        showMuseBubbleInternal(line, t);
        lastWanderLineAt = t;
      }
    }
    // The stone throw: the composed overarm rides over the clips
    // for its 0.62 s (the stone itself leaves in updateRocks, at
    // the sweep's front). Applied last among the arm poses, so
    // for its brief moment the throw owns the right arm.
    if (playerRig && throwAnimStart > 0) {
      const phase = (t - throwAnimStart) / 0.62;
      if (phase >= 0 && phase < 1) poseThrowArm(playerRig, phase, !playerAnim?.ready);
    }
    applySeatedPoses();
  }

  // --- Seated poses -----------------------------------------------------
  // Runs after every mixer/procedural write of the frame, so what it
  // sets is what renders. Two layers:
  //  1. DIRECT seat placement (always, clip or not), NOT a servo.
  //     The old incremental servo (nudge the inner group ±0.05/frame
  //     toward a terrain-sampled target, clamped to a −1.2 floor)
  //     ran away on device and buried both sitters to their necks:
  //     an accumulating correction is only as honest as its stalest
  //     measurement. This placement is re-derived from scratch every
  //     frame, with nothing to accumulate:
  //       pelvisWorldY must equal seatWorldY + 0.085 (a body's
  //       thickness over the seat surface), where seatWorldY is
  //       MEASURED from the bench model's own world transform
  //       (benchSeatWorldY), and the pose's own pelvis height is
  //       measured the same frame from the hips bone, excluding the
  //       inner offset currently applied, i.e. exactly the height
  //       the sit clip (or the procedural pose) itself gives the
  //       pelvis above the character's ground origin. The inner
  //       offset is then SET, in one step, to the difference, hard
  //       clamped to the sane sitting range. A bad frame corrects
  //       fully on the next; nothing can run away.
  //     Because the target hangs off the SEAT, not the terrain, the
  //     sit is correct on any slope: pelvis rides the seat, the
  //     character's group origin rides the terrain at the slot, and
  //     the clip's legs bridge the two, feet toward the ground in
  //     front of the bench.
  //  2. The procedural seated pose (only when the character's
  //     animator has no gated sit clip): thighs forward, knees
  //     down, feet toward the ground, arms relaxed, composed over
  //     whatever the idle was doing.
  // Standing restores the inner offset to exactly 0 (eased).
  const seatServoState = {
    player: { y: 0 },
    muse: { y: 0 },
  };
  // Arm-in-arm servo scratch (his elbow, her hand, world space).
  const umbElbowW = new THREE.Vector3();
  const umbHandW = new THREE.Vector3();
  const seatHipsWorld = new THREE.Vector3();
  // The hips bone sits above the seated body's underside: measured on
  // the real bodies in the sit clip (Nov 6, 2026, Task 18), her pelvis
  // bottoms 0.163 m below the bone (his 8% taller frame about 0.176;
  // his hanging cloak spoils a direct read). 0.085 sank them 8 cm in.
  const SEAT_PELVIS_PAD = 0.165;
  function applySeatedServo(
    inner: THREE.Group,
    body: THREE.Object3D | null,
    group: THREE.Group,
    bench: BenchDef | null,
    state: { y: number },
  ) {
    if (bench && body) {
      const hips = body.getObjectByName("J_Bip_C_Hips");
      if (hips) {
        hips.getWorldPosition(seatHipsWorld);
        // The pose's own pelvis height above the group's ground
        // origin, excluding the inner offset currently applied.
        const posePelvis = seatHipsWorld.y - group.position.y - inner.position.y;
        const wantInner =
          benchSeatWorldY(bench) + SEAT_PELVIS_PAD - group.position.y - posePelvis;
        state.y = THREE.MathUtils.clamp(wantInner, -0.95, 0.4);
        inner.position.y = state.y;
        return;
      }
      inner.position.y = state.y;
    } else if (state.y !== 0) {
      state.y *= 0.55;
      if (Math.abs(state.y) < 0.002) state.y = 0;
      inner.position.y = state.y;
    }
  }
  function applySeatedProcedural(rig: VrmRig | null) {
    if (!rig) return;
    poseBone(rig, rig.lUpperLeg, 1.32, 0, 0.03);
    poseBone(rig, rig.rUpperLeg, 1.32, 0, -0.03);
    poseBone(rig, rig.lLowerLeg, -1.18, 0, 0);
    poseBone(rig, rig.rLowerLeg, -1.18, 0, 0);
  }
  function applySeatedPoses() {
    // Aboard the boat, each rider's seat is a moving "bench": its
    // seatTop is recomputed from the rider's live position so the
    // servo rests their pelvis at boat-seat height above the water,
    // exactly as it rests them on a bench's seat above the ground.
    const boatBenchFor = (x: number, z: number): BenchDef => ({
      id: "boat",
      x,
      z,
      rotY: boatState?.heading ?? 0,
      seatTop: LAKE_Y + 0.3 - terrainHeight(x, z),
      baseX: x,
      baseZ: z,
    });
    const bathBenchFor = (x: number, z: number): BenchDef => ({
      id: "bath",
      x,
      z,
      rotY: Math.PI,
      seatTop: BATH_Y + 0.09 - terrainHeight(x, z),
      baseX: x,
      baseZ: z,
    });
    const playerBench =
      seatPlayer?.bench ?? (boatState ? boatBenchFor(avatar.position.x, avatar.position.z) : bathState ? bathBenchFor(avatar.position.x, avatar.position.z) : null);
    const museBench =
      seatMuse?.bench ??
      (boatState?.museAboard
        ? boatBenchFor(museGroup.position.x, museGroup.position.z)
        : bathState?.museIn
          ? bathBenchFor(museGroup.position.x, museGroup.position.z)
          : null);
    applySeatedServo(playerInner, playerBody, avatar, playerBench, seatServoState.player);
    applySeatedServo(museInner, museBody, museGroup, museBench, seatServoState.muse);
    // The baths' care moment: for a few seconds the washer's hands
    // are raised to the other's hair, and the washed head bows a
    // little. Poses only, steam and closeness do the rest.
    if (bathCare && clockTime < bathCare.until && bathState) {
      const washerRig = bathCare.by === "muse" ? museRig : playerRig;
      const washedRig = bathCare.by === "muse" ? playerRig : museRig;
      if (washerRig) {
        poseBone(washerRig, washerRig.lUpperArm, -1.9, 0, -0.55);
        poseBone(washerRig, washerRig.rUpperArm, -1.9, 0, 0.55);
        poseBone(washerRig, washerRig.lLowerArm, -0.7, 0, 0);
        poseBone(washerRig, washerRig.rLowerArm, -0.7, 0, 0);
      }
      if (washedRig) poseBone(washedRig, washedRig.head, 0.35, 0, 0);
    }
    if ((seatPlayer || boatState || bathState) && !playerAnim?.hasSit) applySeatedProcedural(playerRig);
    if ((seatMuse || boatState?.museAboard || bathState?.museIn) && !museAnim?.hasSit) applySeatedProcedural(museRig);
  }

  // Frame pacing state (Task 41).
  const PHONE_FRAME_MS = 1000 / 30;
  const PHONE_IDLE_FRAME_MS = 1000 / 15;
  const STILL_AFTER_MS = 2000;
  let lastStirAt = performance.now();
  const lastCamPose = new THREE.Vector3(Number.NaN, 0, 0);
  const lastCamQuat = new THREE.Quaternion();
  const stir = () => {
    lastStirAt = performance.now();
  };
  for (const ev of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const) window.addEventListener(ev, stir, { passive: true });
  /** Note whether anything moved this frame: the camera, him, or her. */
  function noteStillness(now: number) {
    const moved =
      camera.position.distanceToSquared(lastCamPose) > 1e-6 ||
      Math.abs(camera.quaternion.dot(lastCamQuat)) < 0.999999 ||
      (walking && playerSpeedSm > 0.05) ||
      museIsMoving ||
      flight !== null;
    if (moved) lastStirAt = now;
    lastCamPose.copy(camera.position);
    lastCamQuat.copy(camera.quaternion);
  }
  /** The minimum gap between rendered frames now (0: every display frame). */
  function framePaceMs(now: number): number {
    if (!phone) return 0;
    return now - lastStirAt > STILL_AFTER_MS ? PHONE_IDLE_FRAME_MS : PHONE_FRAME_MS;
  }
  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    // Frame pacing (Task 41): phones render about 30 times a second, and
    // about 15 once nothing has moved for a while (the camera still, no
    // input, nobody walking); the town keeps breathing at the slower
    // rate, idle clips, water and sky included, rather than freezing.
    {
      const pace = framePaceMs(performance.now());
      if (pace > 0 && performance.now() - lastFrameMs < pace - 2) return;
    }
    try {
      const nowMs = performance.now();
      const rawDtMs = nowMs - lastFrameMs;
      const dt = Math.min(0.05, Math.max(0.001, rawDtMs / 1000));
      lastFrameMs = nowMs;
      runtime.beforeFrame(rawDtMs, nowMs, walking ? walkPos : readyFired ? controls.target : { x: 0, z: 4 }, readyFired && !walking, document.visibilityState !== "hidden");
      const t = clock.getElapsedTime();
      // Flight easing.
      if (flight) {
        const k = Math.min(1, (performance.now() - flight.start) / flight.duration);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
        if (k >= 1) flight = null;
      }
      // The living sky: ease the sun toward its target direction
      // (real solar position in auto mode; a held phase under the
      // override), then derive the darkness from its elevation.
      if (dreamMode === "true") {
        // A true dream holds its impossible noon for as long as it
        // lasts, whatever the real local hour is doing.
        sunDirTgt.copy(dirFromAngles(54, 185));
      } else if (heldDawn) {
        // Just risen, low in the east-south-east, as Rome's sun rises.
        sunDirTgt.copy(dirFromAngles(7, 112));
      } else if (skyMode === "auto") {
        const a = solarAngles(new Date());
        sunDirTgt.copy(dirFromAngles(a.elev, a.azim));
      } else if (skyMode === "day") {
        sunDirTgt.copy(dirFromAngles(38, 165));
      } else {
        sunDirTgt.copy(dirFromAngles(-32, 250));
      }
      if (skySnap) {
        sunDirCur.copy(sunDirTgt);
        skySnap = false;
      } else sunDirCur.lerp(sunDirTgt, 1 - Math.exp(-dt / 1.6)).normalize();
      skyElevDeg = (Math.asin(THREE.MathUtils.clamp(sunDirCur.y, -1, 1)) * 180) / Math.PI;
      skyAzimDeg = ((Math.atan2(sunDirCur.x, -sunDirCur.z) * 180) / Math.PI + 360) % 360;
      {
        const k = THREE.MathUtils.clamp((skyElevDeg + 6) / 14, 0, 1);
        nightMix = 1 - k * k * (3 - 2 * k);
      }
      nightTarget = nightMix > 0.5 ? 1 : 0;
      // --- Weather engine -------------------------------------------------
      // Ease every live weather value toward the current weather's
      // targets, roll the random-event schedule, and animate the
      // precipitation, wind, and sky effects.
      {
        const k = Math.min(1, dt * 0.55);
        wCur.skyTop.lerp(wTarget.skyTop, k);
        wCur.skyHor.lerp(wTarget.skyHor, k);
        wCur.cloudColor.lerp(wTarget.cloudColor, k);
        wCur.groundTint.lerp(wTarget.groundTint, k);
        for (const key of [
          "fogNear", "fogFar", "sunMul", "hemiMul", "cloudOpacity", "cloudSpeed",
          "rain", "snow", "wind", "sparkle", "rainbow", "groundDim", "drift",
        ] as const) {
          wCur[key] += (wTarget[key] - wCur[key]) * k;
        }
        // Random events: when the current spell runs out (and the visitor
        // hasn't pinned a weather), the next one rolls in.
        if (!weatherManual && Date.now() >= weatherEndsAt) {
          setWeatherInternal(chooseNextWeather(), false);
        }
        // The town wind eases with the weather (same easing clock).
        if (!opts.reducedMotion) updateTownWind(dt, t);
        // Ground memory: wetness and snow cover build and fade slowly.
        wetness += THREE.MathUtils.clamp(Math.min(1, wCur.rain) - wetness, -dt * 0.012, dt * 0.06);
        snowCover += THREE.MathUtils.clamp(wCur.snow - snowCover, -dt * 0.01, dt * 0.045);

        // Rain streaks, slanted by the wind. Gentle rain breathes with
        // the slow swell, and the sound follows the same number; a
        // storm keeps its full weight and its hard, fast lines.
        const stormy = weatherId === "storm";
        const rainAmt = stormy ? Math.min(1, wCur.rain) : rainIntensity(Math.min(1, wCur.rain), rainSwell(t));
        rainMat.opacity = rainAmt * (stormy ? 0.55 : 0.34);
        rainLines.visible = rainAmt > 0.02;
        if (t - lastRainLevelAt > 1) {
          lastRainLevelAt = t;
          setRainLevel(rainAmt);
          setRainShelter(walking ? shelterAt(walkPos.x, walkPos.z) : 0);
        }
        if (rainLines.visible) {
          const slant = 0.35 + wCur.wind * 1.5 + (stormy ? 1.1 : 0);
          const fallMul = (opts.reducedMotion ? 0.6 : 1) * (stormy ? 1.6 : 1);
          const streak = stormy ? 0.8 : 0.5;
          // A little ahead of the camera, so it's the view that's rained on.
          camera.getWorldDirection(rainFacing);
          const fx = camera.position.x + rainFacing.x * 14;
          const fz = camera.position.z + rainFacing.z * 14;
          for (let i = 0; i < RAIN_COUNT; i++) {
            const d = rainDrops[i]!;
            d.y -= d.speed * dt * fallMul * (0.75 + rainAmt * 0.45);
            d.x += slant * dt * 2.4;
            if (d.y < 0) {
              d.y = 19 + Math.random() * 4;
              d.x = fx + (Math.random() - 0.5) * RAIN_HALF * 2;
              d.z = fz + (Math.random() - 0.5) * RAIN_HALF * 2;
            }
            d.x = wrapAround(d.x, fx, RAIN_HALF);
            d.z = wrapAround(d.z, fz, RAIN_HALF);
            rainPos[i * 6] = d.x;
            rainPos[i * 6 + 1] = d.y;
            rainPos[i * 6 + 2] = d.z;
            rainPos[i * 6 + 3] = d.x + slant * 0.09;
            rainPos[i * 6 + 4] = d.y + streak;
            rainPos[i * 6 + 5] = d.z;
            // Under their roof it does not rain: a streak inside the house
            // is folded away below the floor (seen through the door, the
            // rain outside still falls).
            if (d.y < HOME_RAIN_ROOF && homeHouse.inside(d.x, d.z)) {
              rainPos[i * 6 + 1] = -50;
              rainPos[i * 6 + 4] = -50;
            }
          }
          const attr = rainGeo.attributes.position;
          if (attr) attr.needsUpdate = true;
          rainGeo.setDrawRange(0, Math.ceil(RAIN_COUNT * (0.4 + rainAmt * 0.6)) * 2);
        }
        // Rings where the rain lands: a third of them out on the lake,
        // wider and slower, the rest on the ground around the viewer.
        for (let i = 0; i < splashes.length; i++) {
          const s = splashes[i]!;
          const m = s.mesh.material as THREE.MeshBasicMaterial;
          const onLake = i % 3 === 0;
          if (rainAmt > 0.05) {
            s.phase += dt * (onLake ? 0.8 : 1.2) * rainAmt;
            if (s.phase > 1) {
              s.phase = 0;
              if (onLake) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * 0.92;
                s.mesh.position.set(LAKE_CX + Math.cos(a) * LAKE.rx * r, LAKE_Y + 0.03, LAKE_CZ + Math.sin(a) * LAKE.rz * r);
              } else {
                const nsx = camera.position.x + rainFacing.x * 12 + (Math.random() - 0.5) * 34;
                const nsz = camera.position.z + rainFacing.z * 12 + (Math.random() - 0.5) * 34;
                s.mesh.position.set(nsx, terrainHeight(nsx, nsz) + 0.06, nsz);
              }
            }
            s.mesh.scale.setScalar(onLake ? 1.2 + s.phase * 5 : 0.6 + s.phase * 2);
            m.opacity = (1 - s.phase) * (onLake ? 0.5 : 0.32) * rainAmt;
          } else {
            m.opacity = 0;
          }
        }
        // Snowfall over the whole town.
        snowMat.opacity = wCur.snow * 0.95;
        snowPoints.visible = wCur.snow > 0.02;
        if (snowPoints.visible) {
          for (let i = 0; i < SNOW_COUNT; i++) {
            const seed = snowSeed[i] ?? 0;
            let y = snowPos[i * 3 + 1] ?? 0;
            let x = snowPos[i * 3] ?? 0;
            y -= dt * (0.65 + seed * 0.75) * (opts.reducedMotion ? 0.6 : 1);
            x += (Math.sin(t * 0.8 + seed * 21) * 0.45 + wCur.wind * 1.1) * dt;
            if (y < 0) y = 19 + Math.random() * 2;
            if (x > 57) x = -57;
            snowPos[i * 3] = x;
            snowPos[i * 3 + 1] = y;
          }
          const attr = snowGeo.attributes.position;
          if (attr) attr.needsUpdate = true;
        }
        // Sparkle shower around the peristyle.
        sparkMat.opacity = wCur.sparkle * (0.55 + 0.45 * Math.sin(t * 2.4)) * (1 - nightMix * 0.35);
        sparkPoints.visible = wCur.sparkle > 0.02;
        if (sparkPoints.visible) {
          for (let i = 0; i < SPARK_COUNT; i++) {
            const seed = sparkSeed[i] ?? 0;
            let y = sparkPos[i * 3 + 1] ?? 0;
            y -= dt * 0.32 * (0.5 + seed);
            if (y < 0.15) y = 6.5;
            sparkPos[i * 3 + 1] = y;
          }
          const attr = sparkGeo.attributes.position;
          if (attr) attr.needsUpdate = true;
        }
        // Wind streaks racing across town.
        windMat.opacity = Math.max(0, wCur.wind - 0.3) * 0.42;
        windLines.visible = wCur.wind > 0.34;
        if (windLines.visible) {
          for (let i = 0; i < WIND_COUNT; i++) {
            const s = windStreaksData[i]!;
            s.x += s.speed * dt * (0.35 + wCur.wind);
            if (s.x > 52) {
              s.x = -52;
              s.z = (Math.random() - 0.5) * 96;
            }
            windPos[i * 6] = s.x;
            windPos[i * 6 + 1] = s.y + Math.sin(t * 2 + i) * 0.12;
            windPos[i * 6 + 2] = s.z;
            windPos[i * 6 + 3] = s.x - (0.7 + wCur.wind * 0.9);
            windPos[i * 6 + 4] = s.y;
            windPos[i * 6 + 5] = s.z;
          }
          const attr = windGeo.attributes.position;
          if (attr) attr.needsUpdate = true;
        }
        // The rainbow fades in and out over the hills.
        rainbowGroup.visible = wCur.rainbow > 0.02;
        if (rainbowGroup.visible) {
          for (const child of rainbowGroup.children) {
            const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            m.opacity = wCur.rainbow * 0.68 * (1 - nightMix * 0.75);
          }
        }
        // Umbrellas pop open in the rain and fold away after it.
        // DORMANT (umbrellas removed, Nov 1): UMBRELLAS_ENABLED is
        // false, so umbrellaOpen is always 0, no canopy is ever
        // shown, umbrellaSharing never engages, and the hand-off
        // below (which used to part joined hands for the arm link)
        // can never fire. Rain follow is the dry-weather follow.
        const umbrellaOpen = UMBRELLAS_ENABLED ? Math.min(1, wCur.rain) : 0;
        // The shared-umbrella beat: she's following in the rain and
        // they're side by side, her umbrella folds away, his grows
        // and shifts to cover them both, and they walk arm in arm
        // (the arm posing lives in driveClipAnims). If he runs far
        // ahead, the link releases and her own umbrella returns.
        const pairDist = Math.hypot(museGroup.position.x - avatar.position.x, museGroup.position.z - avatar.position.z);
        umbrellaSharing =
          umbrellaOpen > 0.25 && followMode && !boatState && !seatPlayer && pairDist < 3.4;
        // The umbrella hand-off: hands can't hold AND link the same
        // arm, so while they're arm in arm under his canopy the
        // joined hands part, the link governs, and the shell is
        // told so its hand option is replaced by the link too.
        if (umbrellaSharing && handInHand) {
          handInHand = false;
          opts.onHandInHandChange?.(false, "umbrella");
        }
        umbrellas.forEach((u, i) => {
          u.visible = umbrellaOpen > 0.03;
          if (u.visible) {
            u.scale.setScalar(Math.max(0.001, umbrellaOpen));
            u.rotation.x = Math.sin(t * 2 + i * 1.4) * 0.04 * (0.3 + wCur.wind);
          }
        });
        if (museUmbrellaRef && umbrellaSharing) museUmbrellaRef.visible = false;
        if (playerUmbrellaRef && umbrellaOpen > 0.03) {
          if (umbrellaSharing) {
            // His canopy widens and leans toward her side of him.
            playerUmbrellaRef.scale.setScalar(Math.max(0.001, umbrellaOpen) * 1.45);
            const herLocal = playerInner.worldToLocal(sharedTmpV.copy(museGroup.position));
            playerUmbrellaRef.position.set(
              0.16 + herLocal.x * 0.3,
              2.42,
              0.03 + herLocal.z * 0.3,
            );
          } else {
            playerUmbrellaRef.position.set(0.16, 2.3, 0.03);
          }
        }
        // Clouds hurry or dawdle with the weather.
        clouds.forEach((c, i) => {
          c.position.x += dt * wCur.cloudSpeed * (0.5 + (i % 3) * 0.22);
          if (c.position.x > 92) c.position.x = -92;
        });
        // Grass sways blade by blade when the wind picks up; when it
        // drops, the tufts settle back to their planted transforms once.
        if (tuftsMesh && tuftData.length > 0) {
          if (wCur.wind > 0.05 && !opts.reducedMotion && runtime.grassHz > 0) {
            // The grass can sway at 30 Hz without rebuilding every instance
            // matrix at display refresh rate. Light graphics holds it still.
            if (t - lastGrassUpdate >= 1 / runtime.grassHz) {
              lastGrassUpdate = t;
              tuftsSettled = false;
              for (let i = 0; i < tuftData.length; i++) {
                const td = tuftData[i]!;
                const tilt = Math.sin(t * (2 + wCur.wind * 2.4) + td.phase) * (0.05 + wCur.wind * 0.17);
                tuftDummy.position.set(td.x, td.y, td.z);
                tuftDummy.rotation.set(tilt * 0.6, td.rotY, tilt);
                tuftDummy.scale.set(td.scale, td.sy, td.scale);
                tuftDummy.updateMatrix();
                tuftsMesh.setMatrixAt(i, tuftDummy.matrix);
              }
              if (tuftsMesh.instanceMatrix) tuftsMesh.instanceMatrix.needsUpdate = true;
            }
          } else if (!tuftsSettled) {
            tuftsSettled = true;
            for (let i = 0; i < tuftData.length; i++) {
              const td = tuftData[i]!;
              tuftDummy.position.set(td.x, td.y, td.z);
              tuftDummy.rotation.set(0, td.rotY, 0);
              tuftDummy.scale.set(td.scale, td.sy, td.scale);
              tuftDummy.updateMatrix();
              tuftsMesh.setMatrixAt(i, tuftDummy.matrix);
            }
            if (tuftsMesh.instanceMatrix) tuftsMesh.instanceMatrix.needsUpdate = true;
          }
        }
        // Bunting flutters harder as the wind rises.
        buntingGroup.children.forEach((child, i) => {
          if (child instanceof THREE.Mesh && child.geometry.type === "ShapeGeometry") {
            child.rotation.x = Math.sin(t * (3 + wCur.wind * 5) + i * 1.3) * 0.13 * (0.25 + wCur.wind);
          }
        });
        // Lightning: during a storm, strikes land every several seconds
        // as a gentle double pulse, never a rapid strobe.
        if (weatherId === "storm" && wCur.rain > 0.8) {
          strikeAge += dt;
          nextStrikeIn -= dt;
          if (nextStrikeIn <= 0) {
            strikeAge = 0;
            nextStrikeIn = 7 + Math.random() * 9;
            opts.onLightning?.();
          }
          let flashTarget = 0;
          if (strikeAge < 0.12) flashTarget = 1;
          else if (strikeAge < 0.28) flashTarget = 0.12;
          else if (strikeAge < 0.46) flashTarget = 0.7;
          lightningFlash += (flashTarget - lightningFlash) * Math.min(1, dt * 42);
        } else {
          lightningFlash = Math.max(0, lightningFlash - dt * 5);
          nextStrikeIn = Math.max(nextStrikeIn, 3);
        }
        lightningLight.intensity = lightningFlash * 2.4;
        applyDayNight();
      }
      // Idle life.
      if (!opts.reducedMotion) {
        // Seasonal drift around the town tree, plus a gentle canopy sway.
        {
          const style = DRIFT_STYLE[currentTreeSeason];
          const treeScale =
            [0.42, 0.66, 0.92, 1.22, 1.5][Math.min(currentTreeStage, 4)] ?? 1;
          for (let i = 0; i < driftCount; i++) {
            const seed = driftSeed[i] ?? 0;
            const life = (t * style.fall * (1 + wCur.wind * 0.9) + seed) % 1;
            const ang = seed * Math.PI * 2 + Math.sin(t * 0.6 + seed * 9) * 0.35;
            const rad = (0.35 + seed * 0.65) * style.spread * Math.min(1, treeScale + 0.25);
            driftPos[i * 3] = Math.cos(ang) * rad;
            driftPos[i * 3 + 1] = 0.5 + (1 - life) * style.height * treeScale;
            driftPos[i * 3 + 2] = Math.sin(ang) * rad;
          }
          const posAttr = driftGeo.attributes.position;
          if (posAttr) posAttr.needsUpdate = true;
          driftMat.opacity = 0.9 * wCur.drift * (1 - nightMix * 0.4);
          if (treeCanopy) {
            const sway = 1 + wCur.wind * 5;
            treeCanopy.rotation.z = Math.sin(t * 0.7) * 0.012 * sway;
            treeCanopy.rotation.x = Math.cos(t * 0.55) * 0.01 * sway;
          }
        }
        hat.rotation.y = t * 0.8;
        hat.position.y = terrainHeight(-6.4, -3.6) + 3.34 + Math.sin(t * 1.8) * 0.06;
        clockTime = t;
        updateBubbles(t);
        updateMeteors(t);
        updatePiscina(t, dt);
        updateBaths(t, dt);
        // The Two Lanterns: present only once the summit has
        // happened, and only as present as the night itself.
        if (constellationGroup) {
          constellationGroup.visible = summitDone;
          if (summitDone) {
            const vis = nightMix * (1 - Math.min(1, wCur.rain + wCur.snow)) * (weatherId === "fog" ? 0.3 : 1);
            for (const m of constellationMats) {
              (m as THREE.PointsMaterial | THREE.LineBasicMaterial).opacity =
                (m instanceof THREE.PointsMaterial ? 0.95 : 0.35) * vis;
            }
          }
        }
        if (letterIndicator.group && letterIndicator.group.visible) {
          const pulse = 1 + Math.sin(t * 3.2) * 0.14;
          letterIndicator.group.scale.setScalar(pulse);
        }
        key.rotation.y = t * 1.1;
        residents.forEach((r, i) => {
          r.position.y = 0.35 + Math.abs(Math.sin(t * 1.4 + i * 1.7)) * 0.05;
        });
        // Muse's idle life: a gentle bob, her star companion orbiting,
        // and a wave for a couple of seconds after she's greeted. While
        // she is walking (following, or heading home) she gets a real
        // gait instead: legs swinging opposite, knees lifting, arms
        // swinging gently against the stride, and a soft bob.
        museStar.rotation.y = t * 1.6;
        museStar.position.x = 0.46 + Math.sin(t * 0.9) * 0.08;
        museStar.position.y = 1.8 + Math.sin(t * 1.7) * 0.07;
        // Her star stands down for a pair moment (Task 16): it rides
        // 0.46 m to her side at head height, which in the hug's profile
        // is exactly across her face. It shrinks away as the glide
        // starts and is back once the hold ends.
        museStarShow += ((pairState ? 0 : 1) - museStarShow) * Math.min(1, dt * 6);
        museStar.scale.setScalar(Math.max(0.001, museStarShow));
        museStar.visible = museStarShow > 0.02;
        const sinceWave = t - museWaveStart;
        const museWaving = sinceWave >= 0 && sinceWave < 2.2 && !museIsMoving;
        if (museIsMoving) {
          const swing = Math.sin(museWalkPhase);
          const easeM = (cur: number, target: number) => cur + (target - cur) * 0.45;
          musePose.legL = easeM(musePose.legL, swing * 0.52);
          musePose.legR = easeM(musePose.legR, -swing * 0.52);
          musePose.kneeL = easeM(musePose.kneeL, Math.max(0, -swing) * 0.5);
          musePose.kneeR = easeM(musePose.kneeR, Math.max(0, swing) * 0.5);
          musePose.armL = easeM(musePose.armL, -swing * 0.34);
          musePose.armR = easeM(musePose.armR, swing * 0.34);
          musePose.footYaw = easeM(musePose.footYaw, 0);
          musePose.elbowL = easeM(musePose.elbowL, -0.14);
          musePose.elbowR = easeM(musePose.elbowR, 0.14);
          musePose.headYaw = easeM(musePose.headYaw, 0);
          musePose.sway = easeM(musePose.sway, 0);
          museInner.position.y = Math.abs(Math.sin(museWalkPhase)) * 0.045;
          museInner.rotation.z = 0;
        } else {
          // Her relaxed idle, with the same care as his: weight on one
          // leg, the other knee soft, feet a little offset and turned
          // out, uneven elbows, a slow sway, and her head turned
          // toward the Centurion when he's near (her body already
          // turns to face him; the head leads it, like a person's).
          const easeM = (cur: number, target: number) => cur + (target - cur) * 0.3;
          musePose.legL = easeM(musePose.legL, -0.025);
          musePose.legR = easeM(musePose.legR, 0.035);
          musePose.kneeL = easeM(musePose.kneeL, 0.1);
          musePose.kneeR = easeM(musePose.kneeR, 0.03);
          musePose.armL = easeM(musePose.armL, 0);
          musePose.armR = easeM(musePose.armR, 0);
          musePose.footYaw = easeM(musePose.footYaw, 0.12);
          musePose.elbowL = easeM(musePose.elbowL, -0.26);
          musePose.elbowR = easeM(musePose.elbowR, 0.13);
          musePose.sway = easeM(musePose.sway, Math.sin(t * 0.4 + 1.2) * 0.026);
          let headTarget = 0;
          if (walking) {
            const toPlayer = Math.hypot(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z);
            if (toPlayer < 4.5 && toPlayer > 0.01) {
              const worldYaw = Math.atan2(walkPos.x - museGroup.position.x, walkPos.z - museGroup.position.z);
              let diff = worldYaw - museGroup.rotation.y;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              headTarget = THREE.MathUtils.clamp(diff, -0.55, 0.55) * 0.65;
            }
          }
          musePose.headYaw = easeM(musePose.headYaw, headTarget);
          museInner.position.y = Math.sin(t * 1.3) * 0.03;
          museInner.rotation.z = musePose.sway;
        }
        if (museRig) {
          poseBone(museRig, museRig.lUpperLeg, musePose.legL, musePose.footYaw, -0.015);
          poseBone(museRig, museRig.rUpperLeg, musePose.legR, -musePose.footYaw, 0.015);
          poseBone(museRig, museRig.lLowerLeg, musePose.kneeL, 0, 0);
          poseBone(museRig, museRig.rLowerLeg, musePose.kneeR, 0, 0);
          if (!secretMoment) poseBone(museRig, museRig.head, 0, musePose.headYaw, musePose.sway * 0.8);
          if (museWaving) {
            // The softened wave (see poseWave): the shoulder peak is
            // lowered, the elbow never straightens, and the forearm
            // and wrist lag behind so it reads relaxed, not speared.
            poseWave(museRig, t);
          } else if (museIsMoving) {
            poseBone(museRig, museRig.rUpperArm, musePose.armR, 0, 1.22);
            poseBone(museRig, museRig.rLowerArm, 0, 0, 0.14);
            poseBone(museRig, museRig.rHand, 0, 0, 0);
          } else {
            poseBone(museRig, museRig.rUpperArm, Math.sin(t * 1.3) * 0.04, 0, 1.22);
            poseBone(museRig, museRig.rLowerArm, 0, 0, musePose.elbowR);
            poseBone(museRig, museRig.rHand, 0, 0, 0);
          }
          if (museIsMoving) {
            poseBone(museRig, museRig.lUpperArm, musePose.armL, 0, -1.22);
          } else {
            poseBone(museRig, museRig.lUpperArm, 0, 0, -1.22 + Math.sin(t * 1.3) * 0.03);
          }
          poseBone(museRig, museRig.lLowerArm, 0, 0, musePose.elbowL);
        }
        if (!walking && !followMode && !museReturning) {
          // A slow, wistful sway toward the town tree when no one's near
          // and she is home at her plaza spot.
          const distHome = Math.hypot(museGroup.position.x - MUSE.position[0], museGroup.position.z - MUSE.position[1]);
          if (distHome < 0.6) {
            const faceTree = Math.atan2(-MUSE.position[0], -MUSE.position[1]);
            museGroup.rotation.y =
              faceTree + Math.sin(t * 0.35) * 0.14;
          }
        }
        clouds.forEach((c, i) => {
          c.position.x += Math.sin(t * 0.05 + i) * 0.0022;
        });
        // Butterflies flutter over the flower ring by day; fireflies
        // wander the lawn after dark.
        for (const bf of butterflies) {
          const ft = t * 0.32 + bf.phase;
          bf.group.position.set(
            bf.cx + Math.cos(ft) * bf.rx + Math.sin(ft * 2.3) * 0.8,
            bf.y0 + Math.sin(t * 2.1 + bf.phase) * 0.22,
            bf.cz + Math.sin(ft * 1.35) * bf.rz,
          );
          bf.group.rotation.y = -ft;
          const flap = Math.sin(t * 13 + bf.phase) * 0.85;
          bf.wingL.rotation.y = flap;
          bf.wingR.rotation.y = -flap;
          bf.group.visible =
            nightMix < 0.5 && wCur.rain < 0.25 && wCur.snow < 0.25 && weatherId !== "fog";
        }
        // Bees, butterflies and crickets (Task 46), and their sounds.
        {
          const sound = critters.update({
            t,
            dt,
            tier: runtime.tier,
            nightMix,
            rain: wCur.rain,
            snow: wCur.snow,
            fog: weatherId === "fog",
            season: currentTreeSeason,
            player: walking ? [walkPos.x, walkPos.z] : null,
            view: [camera.position.x, camera.position.z],
          });
          critterSound = sound;
        }
        // Forest birds by day: the flock circles its clearing,
        // flushes to another when he comes close, and settles again.
        {
          const birdsOn = nightMix < 0.5 && wCur.rain < 0.25 && wCur.snow < 0.25 && weatherId !== "fog";
          const dP = Math.hypot(walkPos.x - birdFlock.x, walkPos.z - birdFlock.z);
          if (birdsOn && dP < 7 && t > birdFlock.flushUntil) {
            const others = BIRD_CLEARINGS.filter(
              ([cx, cz]) => Math.hypot(cx - birdFlock.tx, cz - birdFlock.tz) > 4,
            );
            const next = others[Math.floor(t) % others.length] ?? BIRD_CLEARINGS[0]!;
            birdFlock.tx = next[0];
            birdFlock.tz = next[1];
            birdFlock.flushUntil = t + 7;
          }
          birdFlock.x += (birdFlock.tx - birdFlock.x) * 0.006;
          birdFlock.z += (birdFlock.tz - birdFlock.z) * 0.006;
          for (const b of birdFlock.birds) {
            const a = t * 0.24 + b.phase;
            const bx = birdFlock.x + Math.cos(a) * b.r;
            const bz = birdFlock.z + Math.sin(a) * b.r;
            b.group.position.set(bx, terrainHeight(bx, bz) + 6.2 + Math.sin(t * 0.9 + b.phase * 3) * 0.5, bz);
            b.group.rotation.y = -a;
            const flap = Math.sin(t * 9 + b.phase * 5) * 0.65;
            b.wingL.rotation.z = flap;
            b.wingR.rotation.z = -flap;
            b.group.visible = birdsOn;
          }
        }
        if (nightMix > 0.05) {
          // Over the lake and under the willows: a slow drift around
          // the water's ellipse, low over the surface. The top slice
          // of the swarm keeps to the forest instead, thicker under
          // the trees, drifting over the glade.
          for (let i = 0; i < fireflyCount; i++) {
            const seed = fireflySeed[i] ?? 0;
            if (seed > 0.62) {
              const a = seed * Math.PI * 2 + t * 0.07 * (0.5 + seed);
              const r = 0.2 + (seed - 0.62) * 2.2;
              const fx = FOREST.glade[0] + Math.cos(a) * 8.5 * r;
              const fz = FOREST.glade[1] + Math.sin(a) * 11 * r;
              fireflyPos[i * 3] = fx + Math.sin(t * 0.6 + seed * 20) * 0.6;
              fireflyPos[i * 3 + 1] = terrainHeight(fx, fz) + 0.5 + Math.sin(t * (0.7 + seed) + seed * 9) * 0.35 + seed * 0.8;
              fireflyPos[i * 3 + 2] = fz + Math.cos(t * 0.5 + seed * 14) * 0.6;
              continue;
            }
            const a = seed * Math.PI * 2 + t * 0.09 * (0.5 + seed);
            const r = 0.25 + seed * 0.95;
            fireflyPos[i * 3] = LAKE.position[0] + Math.cos(a) * LAKE.rx * r + Math.sin(t * 0.7 + seed * 20) * 0.6;
            fireflyPos[i * 3 + 1] = LAKE_Y + 0.45 + Math.sin(t * (0.8 + seed) + seed * 9) * 0.4 + seed * 0.9;
            fireflyPos[i * 3 + 2] = LAKE.position[1] + Math.sin(a) * LAKE.rz * r + Math.cos(t * 0.6 + seed * 14) * 0.6;
          }
          const attr = fireflyGeo.attributes.position;
          if (attr) attr.needsUpdate = true;
        }
        // By the house and the cliff (Task 49): only while they can be seen.
        if (nightMix > 0.05 && fireflyMat.opacity > 0.01) {
          const b = fireflyPlacesBudget(runtime.tier);
          for (let i = 0; i < b.house; i++) fireflyPlaceAt("house", placeFlySeed[i] ?? 0, t, groundHeightAt, placeFlyPos, i);
          for (let j = 0; j < b.cliff; j++) fireflyPlaceAt("cliff", placeFlySeed[b.house + j] ?? 0, t, groundHeightAt, placeFlyPos, b.house + j);
          placeFlyGeo.setDrawRange(0, b.house + b.cliff);
          const attr = placeFlyGeo.attributes.position;
          if (attr) attr.needsUpdate = true;
        } else {
          placeFlyGeo.setDrawRange(0, 0);
        }
      }
      // The lake's own life: the water's normal map drifts, the
      // moonlight path and the moon fade in with the night and
      // shimmer, the willow curtains sway almost imperceptibly, and
      // wake rings expand and fade behind the boat.
      {
        waterTex.offset.x = t * 0.006;
        waterTex.offset.y = t * 0.0042;
        // The restored fountain's water turns slowly, catching light.
        if (fountainWater && upgradeGroups.fountain?.visible) {
          fountainWater.rotation.z = t * 0.25;
          (fountainWater.material as THREE.MeshStandardMaterial).opacity = 0.78 + Math.sin(t * 1.7) * 0.08;
          if (metaSweat) (metaSweat.material as THREE.MeshStandardMaterial).opacity = 0.3 + Math.sin(t * 0.9) * 0.08;
        }
        if (t >= skyRefreshAt) {
          // The sky turns a quarter of a degree a minute: every
          // SKY_REFRESH_S seconds is plenty.
          skyRefreshAt = t + SKY_REFRESH_S;
          trueSky.update(new Date());
          const moon = trueSky.moon();
          moonUp = THREE.MathUtils.smoothstep(moon.elev, -1, 3);
          moonShare = 0.3 + 0.7 * moon.illuminated;
          aimMoonPath(moonGlitter, moon.elev, moon.azim);
        }
        moonGlitterMat.opacity = nightMix * moonUp * moonShare * (0.5 + 0.1 * Math.sin(t * 2.3) + 0.06 * Math.sin(t * 5.1));
        // The sea (Task 34): moving water, surf that swells at the cliff's
        // foot, the moon's silver path and the low sun's gold laid toward
        // their true bearings from wherever he stands.
        {
          const sea = seaCliff.oceanMat.normalMap;
          if (sea) {
            sea.offset.x = t * 0.0021;
            sea.offset.y = t * 0.0013;
          }
          seaCliff.oceanMat.color.setHex(0x1f5674).lerp(tmpColorB.setHex(0x0a1a2a), nightMix * 0.8);
          seaCliff.foamMat.opacity = 0.32 + 0.22 * Math.sin(t * 0.7) + 0.1 * Math.sin(t * 1.9 + 1.3);
          if (seaCliff.foamMat.map) seaCliff.foamMat.map.offset.x = t * 0.02;
          const vx = camera.position.x;
          const vz = camera.position.z;
          const moon = trueSky.moon();
          aimSeaPath(seaCliff.moonPath, vx, vz, moon.azim);
          (seaCliff.moonPath.material as THREE.MeshBasicMaterial).opacity =
            nightMix * moonUp * moonShare * (0.42 + 0.08 * Math.sin(t * 2.1));
          aimSeaPath(seaCliff.sunPath, vx, vz, skyAzimDeg);
          const lowSun = Math.max(0, 1 - Math.abs(skyElevDeg - 4) / 10);
          (seaCliff.sunPath.material as THREE.MeshBasicMaterial).opacity = lowSun * 0.55 * (1 - Math.min(1, wCur.rain + wCur.snow));
          // Ships passing below the headland (Task 50): east before noon, west after.
          seaShips.update(t, dt, { x: vx, z: vz }, { nightMix, storm: weatherId === "storm", fog: weatherId === "fog" }, skyAzimDeg < 180);
          // Their house: the door swings for whoever comes near, the lamp warms at night.
          if (homeHouse.update(dt, walking ? [walkPos, museGroup.position] : [museGroup.position], nightMix)) playLampIgnite();
          // At the headland together for the first time this visit, she says one quiet thing.
          if (!cliffGreeted && walking && followMode && Math.hypot(walkPos.x - CLIFF.head.x, walkPos.z - CLIFF.head.z) < 6) {
            cliffGreeted = true;
            showMuseBubbleInternal(CLIFF_LINES[Math.floor(Math.random() * CLIFF_LINES.length)]!, t);
          }
          // The surf's sound, by how near the coast he walks.
          const surf = Math.max(walking ? THREE.MathUtils.smoothstep(walkPos.z, 50, 96) : 0, nightHush ? 0.22 : 0);
          // The small life's sounds (Task 46), and the crickets heard in the dark of a night together.
          {
            const hum = nightHush ? 0 : critterSound.hum;
            const chirp = Math.max(critterSound.chirp, nightHush ? 0.55 : 0);
            if (Math.abs(hum - critterHumSent) > 0.04 || (hum === 0 && critterHumSent !== 0)) {
              critterHumSent = hum;
              setBeeHumLevel(hum);
            }
            if (Math.abs(chirp - critterChirpSent) > 0.04 || (chirp === 0 && critterChirpSent !== 0)) {
              critterChirpSent = chirp;
              setCricketLevel(chirp);
            }
          }
          if (Math.abs(surf - surfLevelSent) > 0.03) {
            surfLevelSent = surf;
            setSurfLevel(surf);
          }
        }
        // The moon shows by night, faintly by day when it is up (as it does).
        trueSky.moonMaterial.opacity = moonUp * (nightMix * 0.95 + (1 - nightMix) * 0.22);
        waterMat.emissive.setHex(0x0a2e4a);
        waterMat.emissiveIntensity = nightMix * 0.55;
        for (const s of willowStrands) {
          s.mesh.rotation.x = Math.PI + Math.sin(t * 0.85 + s.phase) * 0.045;
        }
        for (const r of wakeRings) {
          if (r.age > 1.6) {
            r.mesh.visible = false;
            continue;
          }
          r.age += dt;
          const k = Math.min(1, r.age / 1.6);
          r.mesh.scale.setScalar(1 + k * 2.4);
          (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.4;
        }
      }
      if (walking) {
        updateWalk(dt, t);
      } else {
        controls.update();
      }
      // In a dream she does not follow, stroll, or keep her rounds:
      // in a false one she is not here at all; in a true one she
      // stands where the dream put her, awake.
      if (!dreamMode) updateMuseCompanion(dt, t);
      driveClipAnims(dt, t);
      updateSecretMoment(t);
      updateNewSystems(dt, t);
      renderer.render(scene, camera);
      runtime.afterFrame(rawDtMs, performance.now() - nowMs, document.visibilityState !== "hidden");
      noteStillness(nowMs);
      frameErrorStreak = 0;
      mtFlags.__mtLastFrameAt = performance.now();
      if (!readyFired) {
        readyFired = true;
        mtFlags.__mtFirstFrameAt = performance.now();
        opts.onReady?.();
        // The shell is on screen, now let the buildings, pack
        // pieces, and characters stream in behind it.
        openLoadGate();
      }
    } catch (err) {
      // Keep the loop alive through a transient throw, but if frame
      // after frame fails, say so once: the shell swaps its loading
      // screen for a friendly retry instead of a frozen void.
      frameErrorStreak += 1;
      if (frameErrorStreak === 90 && !renderErrorFired) {
        renderErrorFired = true;
        mtFlags.__mtSceneError =
          err instanceof Error && err.message
            ? `The town's renderer kept failing: ${err.message}`
            : "The town's renderer kept failing frame after frame.";
        opts.onRenderError?.();
      }
    }
  }
  // --- Load-time pre-warm (v44) ---------------------------------------
  // The first swing of the camera used to pay, mid-gesture, for every
  // shader program and GPU upload of whatever district swung into
  // view for the first time: nothing ever called renderer.compile,
  // and loads are gated by the walker's distance, not by the view
  // direction, so a district can be fully loaded and never yet
  // rendered. Five seconds in, with the opening loads settled,
  // compile the whole scene once against the live camera while the
  // visitor is still standing at the gate: the stall lands on a
  // still moment instead of inside his first swing.
  later(() => {
    if (disposed) return;
    try {
      renderer.compile(scene, camera);
    } catch {
      /* pre-warm is best-effort; first renders compile as before */
    }
  }, 5000);
  // --- Load-time material sweep --------------------------------------
  // Twelve seconds in (loads settled), audit every mesh that came
  // from a model file: a material whose texture image definitively
  // failed to load is repaired on the spot (map dropped, its flat
  // colour kept) and NAMED in the report; a named material that
  // would render near-black with no texture is named too, unless it
  // is on the intentional-dark list. The full report (repairs made
  // at load + sweep findings) is on window.__museTownMaterialReport
  // and in the console, this class of bug names its victims now.
  later(() => {
    const findings: string[] = [];
    let checked = 0;
    world.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.userData.fromModel) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std || !("color" in std) || !std.color) continue;
        checked++;
        const matName = std.name || "(unnamed)";
        if (std.map) {
          const st = textureImageState(std.map);
          if (st === "failed") {
            std.map = null;
            std.needsUpdate = true;
            findings.push(`REPAIRED ${o.name || "mesh"} (${matName}): texture image failed to load, map dropped, flat colour kept`);
          } else if (st === "pending") {
            findings.push(`PENDING ${o.name || "mesh"} (${matName}): texture still loading at sweep time`);
          }
        } else if (!INTENTIONAL_DARK_MATERIALS.has(matName)) {
          const lum = 0.2126 * std.color.r + 0.7152 * std.color.g + 0.0722 * std.color.b;
          if (lum < 0.035) {
            findings.push(`NEAR-BLACK ${o.name || "mesh"} (${matName}): colour #${std.color.getHexString()} with no texture`);
          }
        }
      }
    });
    const report = { checked, repairs: materialRepairLog, findings, at: new Date().toISOString() };
    (window as unknown as Record<string, unknown>).__museTownMaterialReport = report;
    if (findings.length || materialRepairLog.length) {
      console.warn(
        `[muse-town] material sweep: ${checked} model materials checked\n` +
          [...materialRepairLog, ...findings].join("\n"),
      );
    } else {
      console.info(`[muse-town] material sweep clean: ${checked} model materials checked, no missing textures, no unintended black materials`);
    }
  }, 12000);
  resources.adopt(scene);
  frame();

  /** Player 2 and the visit pad verb share one button path. */
  const pad2PressFrom = (button: "a" | "b" | "x", source: Pad2Source) => {
    const now = clock.getElapsedTime();
    if (source === "director" && pad2Source !== "director" && pad2Live(pad2LastInputAt, now)) return;
    pad2LastInputAt = now;
    pad2Source = source;
    // Moments that own her body are hers to finish, not pad2's.
    if (secretMoment || museHidden || boatState?.museAboard || danceState || pairState || skyWatchState || bathState?.museIn || dreamMode || museSeatTarget) return;
    if (button === "a") {
      if (!seatMuse && !sliding(pad2Run)) pad2Hop.queuedAt = now;
      return;
    }
    if (button === "b") {
      if (seatMuse) {
        standMuseUp();
        return;
      }
      if (!pad2Driving || airborne(pad2Hop)) return;
      startSlide(pad2Run, pad2Drive.vx, pad2Drive.vz, now);
      return;
    }
    // X: seated stands her; a seat within reach sits her; otherwise she waves.
    if (seatMuse) {
      standMuseUp();
      return;
    }
    const cur = museGroup.position;
    let best: { bench: BenchDef; slot: number; x: number; z: number; dist: number } | null = null;
    for (const bench of BENCHES) {
      for (const slot of [-1, 1]) {
        if (seatPlayer && seatPlayer.bench.id === bench.id && seatPlayer.slot === slot) continue;
        const p = benchSlotPos(bench, slot);
        const dist = Math.hypot(cur.x - p.x, cur.z - p.z);
        if (!best || dist < best.dist) best = { bench, slot, x: p.x, z: p.z, dist };
      }
    }
    if (best && best.dist < 1.7) {
      seatMuse = { bench: best.bench, slot: best.slot };
      museGroup.position.set(best.x, groundHeightAt(best.x, best.z), best.z);
      museGroup.rotation.y = best.bench.rotY + Math.PI;
      pad2Hop.y = 0;
      pad2Hop.vy = 0;
      return;
    }
    museWaveStart = now;
    if (opts.reducedMotion && museRig) poseWaveStill(museRig);
  };

  return {
    flyTo,
    performanceSnapshot: () => runtime.snapshot(),
    perfLine: () => runtime.perfLine(),
    setAutomaticGraphics: (on) => runtime.setAutomatic(on),
    overview: () =>
      flyTo(
        isLandscapeView ? [0, 24, 48] : [0, 32, 40],
        [0, 0.8, 0],
        1400,
      ),
    zoomBy: (factor: number) => {
      const dir = camera.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(dir.length() * factor, 7, 78);
      dir.setLength(len);
      camera.position.copy(controls.target).add(dir);
    },
    setForcedLandscape: (on: boolean) => {
      forcedLandscapeView = on;
      // The stage box just swapped its sides: re-measure immediately
      // so the renderer and camera aspect land on the turned box
      // (the ResizeObserver on the parent will also fire, belt and
      // braces, as with every rotation signal in this town).
      resize();
    },
    pickUpStone: () => pickUpStoneInternal(),
    throwStone: () => throwStoneInternal(),
    hasCarriedStone: () => carriedRock != null,
    consumeCarriedStone: () => {
      if (carriedMesh) {
        carriedMesh.removeFromParent();
        carriedMesh = null;
      }
      carriedRock = null;
    },
    wolfInView: () => wolfInViewInternal(),
    enterFalseDream: () => enterFalseDreamInternal(),
    enterTrueDream: () => enterTrueDreamInternal(),
    exitDream: () => exitDreamInternal(),
    isDreaming: () => dreamMode !== null,
    setNight: (night: boolean) => {
      skyMode = night ? "night" : "day";
    },
    setSkyMode: (mode: "auto" | "day" | "night") => {
      skyMode = mode;
    },
    skyState: () => ({
      elev: skyElevDeg,
      azim: skyAzimDeg,
      darkness: nightMix,
      golden: isGoldenElevation(skyElevDeg),
      phase: (nightMix > 0.6
        ? "night"
        : skyElevDeg < 8.5
          ? skyAzimDeg < 180
            ? "dawn"
            : "dusk"
          : "day") as "night" | "dawn" | "day" | "dusk",
    }),
    startDance: () => beginDance(),
    stopDance: () => endDance(),
    isDancing: () => danceState !== null,
    nearSkyWatchSpot: () => nearestSkyWatchSpot(),
    startSkyWatch: (spotId: string) => beginSkyWatch(spotId),
    stopSkyWatch: () => endSkyWatch(),
    isSkyWatching: () => skyWatchState !== null,
    petCat: () => {
      if (catAnimal) {
        catAnimal.pauseUntil = lastT + 3.5;
        playAnimal(catAnimal, "idle2");
      }
    },
    setPhoenixArrived: (arrived: boolean, summitDone: boolean) => {
      phoenixArrivedFlag = arrived;
      phoenixSummitFlag = summitDone;
    },
    phoenixPresent: () => phoenixArrivedFlag && skyElevDeg > -4,
    setPhoenixFeather: (lying: boolean) => {
      phoenixFeatherLying = lying;
    },
    setWeather: (weather: WeatherId | "auto") => {
      if (weather === "auto") {
        // Back to random events: roll a fresh spell right away (never an
        // instant repeat of the pinned one if it just ended).
        setWeatherInternal(chooseNextWeather(), false);
      } else {
        setWeatherInternal(weather, true);
      }
    },
    setTreeStage: (stageIndex: number) => {
      const next = THREE.MathUtils.clamp(Math.round(stageIndex), 0, 4);
      if (next === currentTreeStage) return;
      currentTreeStage = next;
      buildTreeBody();
      townTree.traverse((o) => {
        o.userData.pick = { kind: "tree", id: "town-tree" } satisfies { kind: PickKind; id: string };
      });
    },
    setTreeSeason: (season: Season) => {
      if (season === currentTreeSeason) return;
      currentTreeSeason = season;
      buildTreeBody();
      applyDriftStyle();
      townTree.traverse((o) => {
        o.userData.pick = { kind: "tree", id: "town-tree" } satisfies { kind: PickKind; id: string };
      });
    },
    setFound: (collectibleId: string) => {
      if (collectibleId === "pointy-hat") hat.visible = false;
      if (collectibleId === "garden-key") key.visible = false;
    },
    enterWalk: () => {
      if (walking) return;
      camPitchOffset = 0;
      // Entry framing (once, as walk mode starts, never during a
      // hold): the camera starts exactly on his heading, so the
      // first walk frame already has its final, settled view.
      camYawSmooth = walkHeading;
      inputYawRef = camYawSmooth;
      followSustain = 0;
      camPitchSmooth = 0;
      camDistSmooth = walkRestDist();
      walkDrag = null;
      padOrbitX = 0;
      padOrbitY = 0;
      camRecenter = 0;
      savedCamPos = camera.position.clone();
      savedCamTarget = controls.target.clone();
      flight = null;
      walking = true;
      controls.enabled = false;
      // Spawn south of the town tree facing it if this is the first entry or avatar is at spawn.
      avatar.visible = true;
      playerInner.visible = true;
      avatar.position.set(walkPos.x, terrainHeight(walkPos.x, walkPos.z), walkPos.z);
      avatar.rotation.y = walkHeading;
      // Snap camera behind avatar immediately so there's no swoop,
      // at the standard framing (see walkCamFraming).
      const fx = Math.sin(walkHeading);
      const fz = Math.cos(walkHeading);
      const { height: camHeight } = walkCamFraming();
      const camDist = walkRestDist();
      camera.position.set(walkPos.x - fx * camDist, terrainHeight(walkPos.x, walkPos.z) + camHeight, walkPos.z - fz * camDist);
      controls.target.set(walkPos.x + fx * 1.2, terrainHeight(walkPos.x, walkPos.z) + 1.15, walkPos.z + fz * 1.2);
      camera.lookAt(controls.target);
    },
    setFollowMode: (enabled: boolean) => {
      if (enabled) {
        followMode = true;
        museReturning = false;
        // No greeting while following: disarm it, and end any wave
        // still playing from the approach so none of it runs while
        // she walks with him.
        greetingArmed = false;
        greetingApartSince = null;
        museWaveStart = -100;
        playerWaveStart = -100;
        // Companion lines start sparingly, not the second she sets off.
        lastCompanionLineAt = clockTime;
        nextCompanionDelay = 26 + Math.random() * 18;
      } else if (followMode) {
        followMode = false;
        // "Stay here" leaves her where she stands: her daily
        // routine pauses (routineHold) until she is invited again
        // or its next anchor change quietly resumes her day, she
        // no longer walks straight home. Any bench errand or shared
        // seat is off.
        museReturning = false;
        routineHold = true;
        routineHoldKey = routineKey();
        museSeatTarget = null;
        seatMuse = null;
      }
    },
    isFollowing: () => followMode,
    routineInfo: () => ({ anchor: routineKey(), museX: museGroup.position.x, museZ: museGroup.position.z }),
    setMuseHidden: (hidden) => {
      museHidden = hidden;
      if (museGroup) museGroup.visible = !hidden;
    },
    placeMuseAt: (x, z) => {
      museHidden = false;
      if (!museGroup) return;
      museGroup.visible = true;
      const gy = groundHeightAt(x, z);
      museGroup.position.set(x, gy, z);
      museGroundSm = gy;
    },
    setQuietMode: (on) => {
      quietMode = on;
    },
    setCameraHold: (on) => {
      camHold = on;
    },
    setForageTaken: (ids) => {
      forageTakenToday = new Set(ids);
      for (const [id, g] of forageVisuals) g.visible = !forageTakenToday.has(id);
    },
    resumeState: () =>
      dreamMode || boatState !== null
        ? null
        : {
            x: walkPos.x,
            z: walkPos.z,
            heading: walkHeading,
            camYaw: camYawSmooth,
            camPitch: camPitchOffset,
            userZoom,
            walking,
            // Out of walk mode the camera is OrbitControls' own,
            // its framing is part of "where he left off" too.
            ov: walking
              ? undefined
              : {
                  cx: camera.position.x,
                  cy: camera.position.y,
                  cz: camera.position.z,
                  tx: controls.target.x,
                  ty: controls.target.y,
                  tz: controls.target.z,
                },
          },
    restoreOverview: (ov) => {
      // Becomes the framing the next exitWalk flies back to; if
      // he is already out of walk mode, move the camera now.
      savedCamPos = new THREE.Vector3(ov.cx, ov.cy, ov.cz);
      savedCamTarget = new THREE.Vector3(ov.tx, ov.ty, ov.tz);
      if (!walking) {
        camera.position.set(ov.cx, ov.cy, ov.cz);
        controls.target.set(ov.tx, ov.ty, ov.tz);
      }
    },
    restoreResume: (snap) => {
      const spot = resumeSpot(snap.x, snap.z, PLAYER.spawn, (x, z) => resolveCollisions(x, z, 0.5), (x, z) => Math.hypot(x, z) <= 52 || forestNorm(x, z) <= 0.985);
      walkPos.x = spot.x;
      walkPos.z = spot.z;
      walkHeading = spot.moved ? PLAYER.spawnHeading : snap.heading;
      camYawSmooth = snap.camYaw;
      inputYawRef = camYawSmooth;
      followSustain = 0;
      camPitchOffset = snap.camPitch;
      camPitchSmooth = snap.camPitch;
      userZoom = THREE.MathUtils.clamp(snap.userZoom, ZOOM_MIN, ZOOM_MAX);
      camDistSmooth = walkRestDist();
      playerGroundSm = Number.NaN;
      museGroundSm = Number.NaN;
      avatar.position.set(spot.x, groundHeightAt(spot.x, spot.z), spot.z);
      avatar.rotation.y = walkHeading;
      if (followMode) {
        // She was walking with him: she resumes beside him, and
        // the follow steering settles her from there, quietly,
        // with no greeting wave (setFollowMode already disarmed it).
        museGroup.position.set(snap.x + 1.1, groundHeightAt(snap.x + 1.1, snap.z + 0.6), snap.z + 0.6);
      }
    },
    setAffectionRank: (rank: number) => {
      affectionRank = Math.max(0, Math.min(10, Math.floor(rank) || 0));
    },
    setSummitState: (s: { ready: boolean; done: boolean; meteor: boolean }) => {
      summitReady = s.ready;
      summitDone = s.done;
      summitMeteor = s.meteor;
      // The permanent marks follow the durable state: the carved
      // initials exist at the terrace only once the night has
      // happened; the constellation is driven per-frame above.
      if (terraceInitials) terraceInitials.visible = s.done;
      if (constellationGroup) constellationGroup.visible = s.done;
    },
    playSummitMoment: () => startSummitMoment(),
    isMeteorActive: () => summitMeteor && nightMix > 0.55,
    setPiscinaStock: (speciesIds: string[]) => setPiscinaStock(speciesIds),
    setPiscinaReleasable: (fishId: string | null) => {
      piscinaReleasable = fishId;
    },
    scatterFeed: () => {
      pondFeed = {
        x: THREE.MathUtils.clamp(walkPos.x, PISCINA.water.x0 + 0.5, PISCINA.water.x1 - 0.5),
        z: THREE.MathUtils.clamp(walkPos.z, PISCINA.water.z0 + 0.5, PISCINA.water.z1 - 0.5),
        until: clockTime + 6,
      };
    },
    setPiscinaGolden: (lives: boolean) => {
      piscinaGolden = lives;
    },
    enterBath: () => enterBath(),
    joinBath: () => joinBath(),
    exitBath: () => exitBath(),
    bathState: () => ({ soaking: bathState !== null, museIn: bathState?.museIn ?? false }),
    playBathCare: (by: "muse" | "player") => {
      if (bathState) bathCare = { by, until: clockTime + 5 };
    },
    setHandInHand: (on: boolean) => {
      handInHand = on;
      handHurryTime = 0;
      lastWanderLineAt = clockTime;
    },
    setUpgrades: (ids: string[]) => {
      for (const [id, group] of Object.entries(upgradeGroups)) {
        group.visible = ids.includes(id);
      }
      plazaMat.color.setHex(ids.includes("cobbles") ? 0xb59a7a : 0xffffff);
      if (ids.includes("fountain") && !fountainColliderAdded) {
        fountainColliderAdded = true;
        obstacles.push(circ(VILLA.metaSudans[0], VILLA.metaSudans[1], 1.85, 0.12));
      }
    },
    setGardenStage: (stage: number) => {
      gardenSprouts.visible = stage > 0;
      const sy = stage <= 1 ? 0.45 : stage === 2 ? 0.8 : 1.1;
      gardenSprouts.scale.set(1, sy, 1);
      gardenSprouts.traverse((o) => {
        if (o.name === "garden-bloom") o.visible = stage >= 3;
      });
    },
    toggleSit: (benchId: string) => {
      const bench = BENCHES.find((b) => b.id === benchId);
      if (!bench) return;
      if (seatPlayer?.bench.id === benchId) standUpFromBench();
      else sitDownOnBench(bench);
    },
    standUp: () => standUpFromBench(),
    setShieldOut: (on) => {
      shieldOut = on;
    },
    setSwordWorn: (on) => {
      swordWorn = on;
    },
    homeTogether: () => walking && homeHouse.inside(walkPos.x, walkPos.z) && homeHouse.inside(museGroup.position.x, museGroup.position.z),
    nightTogether: (stage) => {
      if (stage === "hush") {
        nightHush = true;
        homeHouse.setHush({ doorShut: true, lampDim: 1, dawn: 0 });
        return;
      }
      if (stage === "morning") {
        nightHush = false;
        heldDawn = true;
        skySnap = true;
        homeHouse.setHush({ doorShut: true, lampDim: 1, dawn: 1 });
        const bed = BENCHES.find((b) => b.id === "home-bed");
        if (bed && walking) {
          if (seatPlayer) standUpFromBench();
          sitDownOnBench(bed);
          // She is already beside him: no walk across the room at dawn.
          if (museSeatTarget) museGroup.position.set(museSeatTarget.x, museGroup.position.y, museSeatTarget.z);
        }
        return;
      }
      nightHush = false;
      heldDawn = false;
      skySnap = true;
      homeHouse.setHush(null);
      if (seatPlayer?.bench.id === "home-bed") standUpFromBench();
    },
    isSeated: () => seatPlayer !== null,
    boardBoat: () => boardBoat(),
    disembarkBoat: () => disembarkBoat(false),
    isRowing: () => boatState !== null,
    setTalking: (on: boolean) => {
      talkAnimOpen = on;
    },
    playPairMoment: (kind: "flirt" | "hug") => playPairMoment(kind),
    musePosition: () => ({ x: museGroup.position.x, z: museGroup.position.z }),
    playHandHold: () => startSecretMoment("hand"),
    playKiss: () => startSecretMoment("kiss"),
    exitWalk: () => {
      if (!walking) return;
      // Sitting ends with walk mode: up from the bench first.
      standUpFromBench();
      // Rowing ends with walk mode too: ashore at the dock bank,
      // wherever on the lake the boat currently is.
      if (boatState) disembarkBoat(true);
      // Leaving walk mode ends the stroll: she walks herself home.
      if (followMode) {
        followMode = false;
        museReturning = true;
      }
      walking = false;
      walkDrag = null;
      keysDown.clear();
      padX = 0;
      padY = 0;
      // No walk mode, no prompt.
      if (lastNearKey !== "") {
        lastNearKey = "";
        opts.onNearbyChange?.(null);
      }
      avatar.visible = false;
      controls.enabled = true;
      const pos = savedCamPos;
      const tgt = savedCamTarget;
      savedCamPos = null;
      savedCamTarget = null;
      if (pos && tgt) {
        flyTo([pos.x, pos.y, pos.z], [tgt.x, tgt.y, tgt.z], 900);
      } else {
        flyTo([0, 32, 40], [0, 0.8, 0], 900);
      }
    },
    jump: () => {
      if (!sliding(run)) hop.queuedAt = performance.now() / 1000;
    },
    slide: () => {
      // On the move means moving now or a breath ago (the latch in
      // slide.ts): B fires on the press now, and the pressing gesture
      // itself centres the stick, so demanding motion at this exact
      // instant refused every touch slide and let the press fall
      // through to the overview.
      const now = clock.getElapsedTime();
      if (!walking || !(isMoving || wasMovingRecently(lastMovingAt, now)) || boatState || airborne(hop) || (handInHand && followMode)) return false;
      if (!sliding(run) && startSlide(run, wishX || Math.sin(walkHeading), wishZ || Math.cos(walkHeading), now)) {
        if (stepSounds) playSlide(footingHere());
        puffDust(walkPos.x, playerGroundSm, walkPos.z);
        flourish(clockTime);
      }
      return true;
    },
    setRhythm: ({ anchor, marketOpen: open, marketBusy }) => {
      rhythmAnchor = anchor;
      marketOpen = open;
      for (const goods of marketGoods) goods.visible = open;
      boards.visible = !open;
      countryBaskets.visible = open && marketBusy;
    },
    canInvite: () =>
      walking && !guide && !seatPlayer && !seatMuse && !boatState && !bathState && !danceState && !pairState &&
      !skyWatchState && !secretMoment && !dreamMode && !handInHand,
    startGuide: (x, z) => {
      if (!walking) return false;
      routineHold = false;
      museReturning = false;
      guide = { x, z, until: clockTime + 120 };
      return true;
    },
    setDishes: setTableDishes,
    setEstateCare: applyEstateCare,
    setStepSounds: (on) => {
      stepSounds = on;
    },
    setWalkMove: (x: number, y: number) => {
      padX = THREE.MathUtils.clamp(x, -1, 1);
      padY = THREE.MathUtils.clamp(y, -1, 1);
    },
    orbitCamera: (x: number, y: number) => {
      padOrbitX = THREE.MathUtils.clamp(x, -1, 1);
      padOrbitY = THREE.MathUtils.clamp(y, -1, 1);
    },
    recenterCamera: () => recenterWalkCamera(),
    setHomeDecor: (arrangement) => homeHouse.setDecor(readArrangement(arrangement)),
    setPad2Move: (x: number, y: number, source) => {
      // A fresh human input outranks a director's channel while it lasts.
      if (source === "director" && pad2Source !== "director" && pad2Live(pad2LastInputAt, clock.getElapsedTime())) return;
      pad2X = THREE.MathUtils.clamp(x, -1, 1);
      pad2Y = THREE.MathUtils.clamp(y, -1, 1);
      if (Math.hypot(pad2X, pad2Y) > 0.12) {
        pad2LastInputAt = clock.getElapsedTime();
        pad2Source = source;
      }
    },
    pad2Press: (button, source) => pad2PressFrom(button, source),
    setDriverFollow: (mode) => {
      driverFollow = mode;
    },
    aeliaDriver: () => {
      if (pad2Live(pad2LastInputAt, clock.getElapsedTime())) return pad2Source;
      if (driverFollow !== "off" && walking) return "harness";
      return "self";
    },
    setVisitActive: (on) => {
      if (visitActive === on) return;
      visitActive = on;
      const mat = museStar.material as THREE.MeshStandardMaterial;
      mat.color.setHex(on ? VISIT_STAR_COLOR : 0xffd34e);
      mat.emissive.setHex(on ? VISIT_STAR_EMISSIVE : 0xa87800);
      if (!on) {
        // Folding back mid-stride: the errand and the hold are
        // dropped, her own mind resumes from where she stands.
        visitGoto = null;
        visitHold = null;
        museRoute = { goal: "", stops: [] };
        if (pad2Source === "director") {
          pad2X = 0;
          pad2Y = 0;
          pad2LastInputAt = -Infinity;
        }
      }
    },
    visitDirect: (direction) => {
      if (!visitActive) return false;
      const now = clock.getElapsedTime();
      // Moments that own her body are hers to finish, not a director's.
      if (secretMoment || museHidden || boatState?.museAboard || danceState || pairState || skyWatchState || bathState?.museIn || dreamMode) return false;
      const cur = museGroup.position;
      switch (direction.kind) {
        case "goto": {
          let spot: [number, number] | null;
          if ("anchor" in direction) spot = visitSpotFor(direction.anchor);
          else spot = withinTownRim(direction.x, direction.z) || forestNorm(direction.x, direction.z) <= 0.985 ? [direction.x, direction.z] : null;
          if (!spot) return false;
          if (seatMuse) standMuseUp();
          museSeatTarget = null;
          visitHold = null;
          museRoute = { goal: "", stops: [] };
          const toGaius = "anchor" in direction && direction.anchor === "gaius";
          visitGoto = { x: spot[0], z: spot[1], toGaius, seat: null, until: now + 120 };
          return true;
        }
        case "sit":
        case "seat": {
          if (seatMuse) return true;
          const slot = nearestFreeSlot(cur.x, cur.z);
          if (!slot) return false;
          visitHold = null;
          museRoute = { goal: "", stops: [] };
          if (slot.dist < 1.7) {
            seatMuse = { bench: slot.bench, slot: slot.slot };
            museGroup.position.set(slot.x, groundHeightAt(slot.x, slot.z), slot.z);
            museGroup.rotation.y = slot.bench.rotY + Math.PI;
            visitGoto = null;
            return true;
          }
          visitGoto = { x: slot.x, z: slot.z, toGaius: false, seat: { bench: slot.bench, slot: slot.slot }, until: now + 120 };
          return true;
        }
        case "stand":
        case "stepout": {
          if (!seatMuse) return direction.kind === "stand";
          standMuseUp();
          visitHold = { x: museGroup.position.x, z: museGroup.position.z, withGaius: false };
          return true;
        }
        case "emote": {
          // Her animator carries a wave; bow and dance have no solo
          // clips on this line, so each is performed as her wave.
          museWaveStart = now;
          if (opts.reducedMotion && museRig) poseWaveStill(museRig);
          return true;
        }
        case "pad": {
          if (pad2Source !== "director" && pad2Live(pad2LastInputAt, now)) return false;
          pad2DirectorUntil = now + Math.min(PAD_VERB_MAX_MS, direction.ms) / 1000;
          visitGoto = null;
          visitHold = null;
          pad2X = THREE.MathUtils.clamp(direction.dx, -1, 1);
          pad2Y = THREE.MathUtils.clamp(direction.dz, -1, 1);
          pad2LastInputAt = now;
          pad2Source = "director";
          for (const b of direction.buttons) pad2PressFrom(b, "director");
          return true;
        }
        default:
          return false;
      }
    },
    visitTelemetry: () => {
      const mx = museGroup.position.x;
      const mz = museGroup.position.z;
      const dx = walkPos.x - mx;
      const dz = walkPos.z - mz;
      const now = clock.getElapsedTime();
      const padLive = pad2Live(pad2LastInputAt, now);
      return {
        museZone: visitZoneAt(mx, mz),
        gaiusZone: walking ? visitZoneAt(walkPos.x, walkPos.z) : "away",
        museSeated: !!seatMuse,
        gaiusSeated: !!seatPlayer,
        gaiusWalking: walking,
        dayPhase: nightMix > 0.6 ? "night" : skyElevDeg < 8.5 ? (skyAzimDeg < 180 ? "dawn" : "dusk") : "day",
        museX: Math.round(mx * 10) / 10,
        museZ: Math.round(mz * 10) / 10,
        gaiusX: Math.round(walkPos.x * 10) / 10,
        gaiusZ: Math.round(walkPos.z * 10) / 10,
        museHeading: Math.round(museGroup.rotation.y * 100) / 100,
        gaiusHeading: Math.round(walkHeading * 100) / 100,
        bearingToGaius: Math.round(Math.atan2(dx, dz) * 100) / 100,
        distanceToGaius: Math.round(Math.hypot(dx, dz) * 10) / 10,
        pad2Source: padLive ? (pad2Source === "director" ? "director" : "human") : "none",
      };
    },
    captureVisitFrame: (maxEdge, quality) => {
      try {
        renderer.render(scene, camera);
        const srcCanvas = renderer.domElement;
        const dims = frameDimensions(srcCanvas.width, srcCanvas.height, maxEdge);
        const out = document.createElement("canvas");
        out.width = dims.width;
        out.height = dims.height;
        const c2 = out.getContext("2d");
        if (!c2) return null;
        c2.drawImage(srcCanvas, 0, 0, out.width, out.height);
        return { dataUrl: out.toDataURL("image/jpeg", quality), width: out.width, height: out.height };
      } catch {
        return null;
      }
    },
    showBubbleGrowing: (text) => {
      const b = museBubble;
      const now = clockTime;
      b.pages = paginateBubbleText(b.ctx, text);
      b.pageIdx = Math.max(0, b.pages.length - 1);
      b.showAt = Math.min(b.showAt < 0 ? now : b.showAt, now);
      b.pageEndAt = now + bubblePageDuration(b.pages[b.pageIdx] ?? "") + 2;
      b.hideAt = b.pageEndAt;
      b.tailFrac = b.sprite.visible ? b.tailFrac : 0.5;
      drawBubblePage(b);
      b.sprite.visible = true;
    },
    isWalking: () => walking,
    capturePostcard: () => {
      try {
        renderer.render(scene, camera);
        const srcCanvas = renderer.domElement;
        const maxW = 880;
        const scale = Math.min(1, maxW / srcCanvas.width);
        const out = document.createElement("canvas");
        out.width = Math.max(2, Math.round(srcCanvas.width * scale));
        out.height = Math.max(2, Math.round(srcCanvas.height * scale));
        const c2 = out.getContext("2d");
        if (!c2) return null;
        c2.drawImage(srcCanvas, 0, 0, out.width, out.height);
        return out.toDataURL("image/jpeg", 0.85);
      } catch {
        return null;
      }
    },
    setUnreadLetters: (count) => {
      if (letterIndicator.group) letterIndicator.group.visible = count > 0;
    },
    setFestival: (colors) => {
      festivalTonight = !!colors && colors.length > 0;
      if (!colors || colors.length === 0) {
        buntingFlagMats.forEach((m, i) => m.color.setHex(buntingDefaultColors[i % buntingDefaultColors.length]!));
        wreathGroup.visible = false;
        return;
      }
      const parsed = colors
        .map((c) => {
          try {
            return new THREE.Color(c);
          } catch {
            return null;
          }
        })
        .filter((c): c is THREE.Color => c !== null);
      if (parsed.length === 0) return;
      buntingFlagMats.forEach((m, i) => m.color.copy(parsed[i % parsed.length]!));
      wreathBerryMat.color.copy(parsed[0]!);
      wreathGroup.visible = true;
    },
    setLowGraphics: (on) => {
      // Software GL never gets the heavy settings back, whatever the
      // toggle says, it cannot carry them.
      const gentle = on || softwareGl;
      runtime.setLightGraphics(gentle);
    },
    showBubble: (who, text) => {
      const b = who === "muse" ? museBubble : playerBubble;
      const now = clockTime;
      const other = who === "muse" ? playerBubble : museBubble;
      // If the other bubble is mid-line, this one waits its turn,
      // the delay is folded into the page schedule.
      const start = now + (other.hideAt > now ? 0.8 : 0);
      showBubbleText(b, text, start);
    },
    greetMuse: () => {
      // A deliberate greeting from the shell (a tap, a chat line),
      // but never while she is following him: follow mode suppresses
      // waving entirely. A greeting given this way also spends the
      // armed approach greeting, so the pair never wave twice for
      // one meeting.
      if (followMode) return;
      const now = clock.getElapsedTime();
      museWaveStart = now;
      if (walking) playerWaveStart = now;
      greetingArmed = false;
      greetingApartSince = null;
      if (opts.reducedMotion && museRig) {
        // Reduced motion: hold the still, softened greeting pose.
        poseWaveStill(museRig);
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      if (loadProgressHook === (opts.onLoadProgress ?? null)) loadProgressHook = null;
      if (loadErrorHook === (opts.onLoadError ?? null)) loadErrorHook = null;
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      cancelAnimationFrame(raf);
      resizeObs?.disconnect();
      window.removeEventListener("resize", onViewportSignal);
      window.removeEventListener("orientationchange", onViewportSignal);
      try {
        const vv = window.visualViewport;
        if (vv && typeof vv.removeEventListener === "function") {
          vv.removeEventListener("resize", onViewportSignal);
        }
      } catch {
        /* ignore cleanup failures */
      }
      window.removeEventListener("keydown", onWalkKeyDown);
      window.removeEventListener("keyup", onWalkKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("pointerup", onWindowPointerEnd);
      for (const ev of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const) window.removeEventListener(ev, stir);
      window.removeEventListener("pointercancel", onWindowPointerEnd);
      window.removeEventListener("blur", dropAllPointers);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("wheel", onWheelZoom);
      canvas.removeEventListener("touchstart", blockTouchGesture);
      canvas.removeEventListener("touchmove", blockTouchGesture);
      canvas.removeEventListener("contextmenu", blockContextMenu);
      controls.dispose();
      critters.dispose();
      setBeeHumLevel(0);
      setCricketLevel(0);
      setLampCrackleLevel(0);
      runtime.dispose();
      resources.dispose();
      renderer.dispose();
    },
  };
}
