import { TownMenu } from "./TownMenu";
import { TownMap } from "./TownMap";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTownState } from "./useTownState";
import { TownUtilities } from "./TownUtilities";
import { api } from "./api";
import { linePools, pickPooled } from "./linePools";
import { aboutPlayer } from "../../server/src/player";
import { AchievementGate } from "./achievementGate";
import { downloadAeliaModel, generateLocalAeliaReply, type LocalChatStatus, type AeliaChatTurn, type LocalModelName } from "./aeliaLocalChat";
import { BELIEF_LINES, KITCHEN_MEMORY_LINES, solarAngles } from "./town";
import { chooseInvite, freshMemory, type Invite, type InviteMemory } from "./aeliaInvite";
import { dayRhythm, type Rhythm } from "./dayRhythm";
import { careKey, estateCare } from "./estateCare";
import { arrivalDue, FIRST_TASK, FIRST_TASK_MS, GATE_GREETINGS, GREETING_MS } from "./firstVisit";
import { romanDate, romanHour } from "./romanDay";
import {
ACHIEVEMENTS,
CLOSE_LINES,
COLLECTIBLES,
COLOSSEUM,
DEVOTED_LINES,
DIALOGUE_CHOICES,
DISH_BLURBS,
FISH,
FISHING_LINES_WITH_MUSE,
FLIRT_DEFLECTIONS,
INSCRIPTIONS,
INSCRIPTION_HISTORY,
KNUCKLE_MUSE_LINES,
LAKE,
LAKE_PAVILION,
BATH_ACCEPT_LINE,
BATH_AFTER_LINES,
BATH_CARE_HER_LINE,
BATH_CARE_HIS_LINE,
BATH_CARE_OFFER_LINE,
BATH_DECLINE_LINE,
BATH_FIRST_NIGHT_LINE,
BATH_INVITE_LINE,
BATH_SOLO_LINES,
BATH_TOGETHER_LINES,
PISCINA_FAVOURITE_NAMES,
PISCINA_FEED_LINE,
PISCINA_NAME_LINE,
PISCINA_RELEASE_LINES,
PISCINA_WATCH_LINES,
PISCINA_WATCH_LINES_NAMED,
POST_SUMMIT_LINES,
SUMMIT_CONSTELLATION_NAME,
CAT_MEET_LINE,
CAT_PET_LINES,
CAT_STORIES_ENTRY,
DANCE_END_LINE,
DANCE_LINES,
DANCE_START_LINE,
PHOENIX_FEATHER_LINE,
PHOENIX_HINT_LINE,
PHOENIX_RUMOUR_LINE,
PHOENIX_WATCH_LINES,
SKY_NOT_PERFORMING_LINE,
SKY_WATCH_FIREFLY_LINE,
SKY_WATCH_LINES,
SUMMIT_HINTS,
SUMMIT_METEOR_LINE,
SUMMIT_PRIVATE_NAME,
SUMMIT_SCENE,
SUMMIT_SONG_LINES,
isMeteorNight,
paginateLine,
paginateLines,
type SummitEffect,
POSTCARD_CHALLENGES,
STALL_INGREDIENTS,
FORAGE_DISHES,
FORAGE_SPOTS,
TOWN_UPGRADES,
knuckleThrow,
rollFish,
type Fish,
MUSE,
PLACES,
PLAYER,
FIRST_KISS_LINES,
HAND_HOLD_LINES,
WANDER_HOLD_LINES,
KISS_LINES,
QUESTS,
TRINKET_LINE,
WARMING_LINES,
affectionBandForRank,
isFlirtation,
type DialogueChoiceOption,
type DialogueChoiceSet,
SEASONS,
SECRET,
SECRET_FLIRT_LINES,
SECRET_SWEET_PICKS,
STREETS,
TOUR_STOPS,
TOWN_TREE,
WEATHERS,
scriptedMuseReply,
seasonForDate,
streetIndexAt,
treeGrowth,
weatherInfo,
DREAM_ECHO_LINES,
FALSE_DREAM_MOOD,
MORNING_VISIT_LINE,
TRUE_DREAM_LINES,
type MuseChatContext,
type Place,
type PlaceId,
type Season,
type WeatherId,
AELIA_QUESTIONS,
APPOINTMENT_ACCEPT_LINES,
APPOINTMENT_DECLINE_LINES,
APPOINTMENT_MET_LINES,
APPOINTMENT_MISSED_LINES,
APPOINTMENT_PROPOSE_LINES,
APPOINTMENT_SPOTS,
DIGEST_FOLLOWUP_TEMPLATES,
DIGEST_REFERENCE_TEMPLATES,
FACT_SURFACE_TEMPLATES,
REUNION_LINES,
WEATHER_ASK_AFTER_LINES,
absenceTier,
CELEBRATION_LINES,
EVE_OF_LINES,
FLOWER_REACTION_LINES,
FOCUS_EARLY_LINES,
FOCUS_END_LINES,
LAKE_KEEPS_LINES,
READING_AGAIN_LINES,
READING_CLOSE_LINES,
READING_GATE_RANK,
READING_OPEN_LINES,
READING_PASSAGES,
SEED_LEDGER_FUTURE,
SEED_LEDGER_INTRO,
readingPassageIndex,
OVERDUE_LINES,
SEEK_FOUND_LINES,
SEEK_HINT_LINE,
SEEK_SPOTS,
musterLine,
musterPicks,
questDueOffset,
seekClueLine,
BOAT_LINE,
DATE_END_LINES,
DATE_TOPICS,
FIRST_LABELS,
FRICTION_CAUSES,
FRICTION_DISTANT_LINES,
FRICTION_MEND_LINES,
FRICTION_SOFT_LINE,
GIFT_LABELS,
GIFT_REACTION_LINES,
GIFT_TASTES,
LANTERN_LINE,
MORNING_GIFTS,
RANK_SCENES,
STAR_BOOK_CHAPTERS,
type DateTopic,
type GiftTier,
} from "./town";
import {
createTownScene,
type NearbyTarget,
type PickKind,
type TownSceneHandle,
type WeatherChangeInfo,
} from "./townScene";
import type { FollowOffset } from "./padDriver";
import {
  isPad2Key,
  keyboardButton,
  keyboardStick,
  noPads,
  pad2StatusLine,
  pressedButtons,
  pressedShoulders,
  pressedTriggers,
  buttonsDown,
  pressedSticks,
  rightStickVector,
  routePads,
  stickVector,
  type PadSeats,
} from "./padRouting";
import summitSongUrl from "./assets/stars-fall-song.mp3";
import { assetUrl, assetUrlSync } from "./assetPack";
import {
  absorbDirections,
  acceptFrame,
  beginVisit,
  captureMail,
  emptySlate,
  endVisit,
  heartbeat,
  markFramesSent,
  nextDirection,
  recordEvent,
  requestLook,
  setComposing,
  setIntention,
  setTelemetry,
  stateView,
  telemetryEvents,
  threadWithSpeak,
  unsentFrames,
  visitLapsed,
  type VisitSlate,
  type VisitThreadEntry,
} from "./visitSlate";
import { frameDue, validateFrameDataUrl } from "./visitFrames";
import { HARNESS_STORAGE_KEY, IDLE_GLANCE_MS, resolveHarnessUrl, syncWithHarness } from "./visitHarnessClient";
import { bridgeClose, bridgeConfigured, bridgeGlance, bridgeLeaving, bridgePull, bridgePush, emptyBridgeCursor, hostedBridgeSettings, readBridgeSettings, resolveBridge, storeBridgeSettings, type BridgeCursor, type BridgeSettings } from "./visitBridgeClient";
import { BRIDGE_BEAT_MS, BRIDGE_HOLD_S, FRAME_JPEG_QUALITY, FRAME_MAX_EDGE, SNAPSHOT_HEARTBEAT_MS, VISIT_LAPSE_MS, VISIT_POLL_MS, type QueuedDirection } from "../../shared/visitProtocol";
import { clearVisitResume, loadVisitResume, saveVisitResume, sessionStore } from "./visitResume";
import { ConnectMusePanel, useConnectMuse } from "./ConnectMusePanel";
import { purgeImageCaches } from "./imageCache";
import { HistoryBook, lessonForPlace, TownStoryTag } from "./HistoryBook";
import { HomePanel } from "./HomePanel";
import { earnedKeepsakes } from "./homeKeepsakes";
import { QuestBoard } from "./QuestBoard";
import { WeddingBoard } from "./WeddingBoard";
import { WEDDING_CELEBRATION_LINE, readWeddingBook, type WeddingStep } from "../../shared/romanWedding";
import { QUIET_BOAT_BEGIN_LINE, QUIET_BOAT_RETURN_LINES, DRIFT_PROMPT, ROW_BACK_PROMPT, quietBoatBlocked } from "../../shared/quietBoat";
import { questDef, type QuestRecord } from "../../shared/projectQuests";
import { readArrangement } from "../../shared/homeDecor";
import { SceneBuildError, describeSceneError } from "./sceneBuildError";
import {
  NIGHT_ACCEPT_LINES,
  NIGHT_AFTERGLOW_LINE,
  NIGHT_ASK_PROMPT,
  NIGHT_DECLINE_LINES,
  NIGHT_INVITE_DECLINED_LINES,
  NIGHT_INVITE_LINES,
  NIGHT_INVITE_NO,
  NIGHT_INVITE_YES,
  NIGHT_MORNING_LINES,
  acceptsAsk,
  darkBeatMs,
  invitesTonight,
  nightBlocked,
  nightKey,
} from "../../shared/nightTogether";

/** A night together (Task 45): the last night had (per browser), and her afterglow line still to come. */
const NIGHT_LAST_KEY = "muse-town-night-last";
const NIGHT_AFTERGLOW_KEY = "muse-town-night-afterglow";
const pickOne = <T,>(pool: readonly T[]): T => pool[Math.floor(Math.random() * pool.length)]!;
import { useVisitNotice } from "./useVisitNotice";
import { LAPSE_WARN_MS, UNREACHABLE_AFTER_FAILS, composingVisible, hostOf, visitChipLine, visitClosedLine, visitStatusLine, type VisitCloseReason, type VisitDirectorState, type VisitRoute } from "./visitStatus";
import {
playChime,
playJar,
playSparkleChime,
playSplash,
playStoneTick,
playThunder,
startWeatherAmbience,
stopSounds,
stopWeatherAmbience,
type WeatherSoundKind,
  unlockAudio,
} from "./audio";

const OVERVIEW_POS: [number, number, number] = [0, 32, 40];

// Notes-for-Muse heuristic: typed chat that reads as a request,
// wish, or suggestion for the town is saved to her notebook for the
// real Muse ("when in doubt, save it", the owner's arrangement).
const NOTE_WISH_RE = /\b(can we|could we|add|make|build|change|remove|i wish|note this|please)\b/i;


const OVERVIEW_TARGET: [number, number, number] = [0, 0.8, 0];

const chipClass =
  "pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#22332b]/85 px-3 py-1.5 text-sm font-semibold text-white shadow-md backdrop-blur transition active:scale-95";

const INVITE_MEMORY_KEY = "muse-town-invites-v1";

function readInviteMemory(): InviteMemory {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const saved = JSON.parse(localStorage.getItem(INVITE_MEMORY_KEY) ?? "null") as InviteMemory | null;
    if (saved?.day === today && Array.isArray(saved.asked)) return saved;
  } catch { /* a new day's memory will do */ }
  return freshMemory(today);
}

function rememberInvite(change: (memory: InviteMemory) => InviteMemory) {
  try { localStorage.setItem(INVITE_MEMORY_KEY, JSON.stringify(change(readInviteMemory()))); } catch { /* optional */ }
}

/** How long a reopened talk shows the same opener (Task 24). */
/** Away from the tab longer than this, and coming back says the visit held (Task 33). */
const VISIT_AWAY_NOTICE_MS = 20_000;
/** Which history lesson each building's panel offers (Task 37). */
const PLACE_HISTORY: Record<string, string> = { mainchat: "basilica", stories: "villa", recipes: "kitchen", garden: "garden", stars: "pavilion" };
/** A director touched the slate this recently: "a director is reading" (held reads see touches at most every BRIDGE_HOLD_S). */
const DIRECTOR_LIVE_WINDOW_MS = 45_000;
/** Wait, or stop at once when the signal fires. */
function sleepFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
const OPENER_REUSE_MS = 3 * 60 * 1000;

export function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const guideEndRef = useRef<(arrived: boolean) => void>(() => {});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TownSceneHandle | null>(null);
  const tourTimers = useRef<number[]>([]);

  const [selected, setSelected] = useState<Place | null>(null);
  const [youOpen, setYouOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [realLandscape, setRealLandscape] = useState(false);
  // In-town landscape switch (Nov 1, final cure): the Muse app window
  // hosting the town is portrait-locked, it never rotates, so the page
  // never receives a landscape viewport no matter what the phone does
  // (verified with the user: YouTube rotates, this app does not). Four
  // viewport-keyed attempts failed for exactly that reason. So the town
  // turns ITSELF sideways: when this is on, the root stage is sized to
  // the swapped box (100dvh × 100dvw) and CSS-rotated 90°, the layout
  // below reads as landscape, and the pointer vectors in the stick and
  // the scene are remapped into the stage's local axes (see stickMove
  // and the scene's setForcedLandscape). Session-only, like a mood:
  // a fresh visit starts in portrait, as the app gives it.
  const [forcedLandscape, setForcedLandscape] = useState(false);
  const forcedLandscapeRef = useRef(false);
  // The layout's one landscape truth: a real wide viewport OR the
  // town's own sideways turn. Everything below reads this.
  const isLandscape = realLandscape || forcedLandscape;
  const [seasonChoice, setSeasonChoice] = useState<Season | "auto">("auto");
  const [museLine, setMuseLine] = useState(0);
  const museLineRef = useRef(0);
  museLineRef.current = museLine;
  const [night, setNight] = useState(false);
  // The living sky: real Europe/Rome time by default; the
  // Day/Night button holds an override phase instead.
  const [skyMode, setSkyMode] = useState<"auto" | "day" | "night">("auto");
  const [dancing, setDancing] = useState(false);
  const [skyWatching, setSkyWatching] = useState(false);
  const [skySpot, setSkySpot] = useState<string | null>(null);
  const [phoenixWatchable, setPhoenixWatchable] = useState(false);
  const [basilRumour, setBasilRumour] = useState(false);
  const [metCat, setMetCat] = useState<boolean>(() => {
    try {
      return localStorage.getItem("muse-town-met-cat") === "1";
    } catch {
      return false;
    }
  });
  const [hintText, setHintText] = useState<string | null>(null);
  const [foundBanner, setFoundBanner] = useState<string | null>(null);
  // Banner discipline (UI review, Nov 1): the three transient top
  // banners (found / achievement / weather) share one stack. Their
  // arrival order is tracked here (newest last, via the effects
  // beside their state declarations); at render time, portrait shows
  // at most the TWO newest live banners so the stack never crowds
  // the speech bubble below, older ones wait hidden and are gone
  // once their own timers clear them (replace, newest wins).
  // Landscape keeps the roomier all-three stack, as before.
  const [bannerOrder, setBannerOrder] = useState<string[]>([]);
  useEffect(() => {
    if (foundBanner) setBannerOrder((o) => [...o.filter((k) => k !== "found"), "found"]);
  }, [foundBanner]);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [journalDraft, setJournalDraft] = useState("");
  const [webglError, setWebglError] = useState<string | null>(null);
  const [errorCopied, setErrorCopied] = useState(false);
  // First-load stability: the loading screen stays up until the scene
  // renders its first frame (never a bare black screen), model loads
  // report progress, a lost WebGL context gets a friendly retry, and
  // low-graphics mode (menu toggle, remembered, auto-on for very
  // low-memory devices) drops pixel ratio and shadows.
  const [sceneReady, setSceneReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ settled: number; total: number } | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [lowGfx, setLowGfx] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem("muse-town-lowgfx");
      if (saved !== null) return saved === "1";
    } catch {
      /* storage unavailable, fall through to the heuristic */
    }
    // Default ON for small screens and very low-memory devices: the
    // lighter render (pixel ratio 1, no shadow maps, the scene has
    // no post-processing to drop) is a big part of why the town now
    // loads on phones that used to sit on a black screen. The menu
    // toggle remembers whatever the visitor chooses afterwards.
    const smallScreen = window.innerWidth <= 540 || Math.min(window.innerWidth, window.innerHeight) <= 430;
    if (smallScreen) return true;
    const mem = (navigator as { deviceMemory?: number }).deviceMemory;
    return typeof mem === "number" && mem <= 2;
  });
  // First model that failed to load (short asset name), shown once
  // in a friendly note with a retry, never as a silent gap.
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const lowGfxRef = useRef(lowGfx);
  // First-frame watchdog: set by the scene's onReady. If the scene
  // is created but never paints a frame (a render loop that dies
  // silently on a phone GPU), the timer in the scene effect below
  // swaps the bare sky for the friendly retry overlay.
  const readyRef = useRef(false);
  const [walking, setWalking] = useState(false);
  const walkingRef = useRef(false);
  // Pair-clip preview for the owner's verification only, behind
  // ?preview=pairs: H or F on the keyboard, the pad's left and right
  // shoulders, or two chips beside the on-screen cluster stage the
  // flirt and the hug through the scene's ordinary staging (walk
  // mode, both bodies ready, within reach, nothing else under way).
  // It plays the two bodies and nothing more: no affection, no scene
  // lines, every rank gate exactly as it is.
  // The summit's song: packed in the hosted build, so its object URL is
  // readied here, long before the ♪ button needs a URL it can open.
  useEffect(() => {
    void assetUrl(summitSongUrl).catch(() => {
      /* the device voice carries the verse if the recording cannot load */
    });
  }, []);
  const pairPreview = useMemo(() => /[?&]preview=pairs(?:&|$)/.test(typeof window !== "undefined" ? window.location.search : ""), []);
  const stagePairPreview = useCallback((kind: "flirt" | "hug") => {
    if (!walkingRef.current) return;
    const staged = sceneRef.current?.playPairMoment(kind) ?? false;
    console.info(`[muse-town] pair preview: ${kind} ${staged ? "staged" : "refused (stand a few steps from Aelia, in the open, both bodies ready)"}`);
  }, []);
  // The shoulders, one route for the pad's LB/RB, the on-screen
  // pair and F/H on the keyboard (owner, Nov 8, 2026): LB flirts,
  // RB hugs, in ordinary play. Her own gates hold: the flirt from
  // rank 3, where she stops deflecting it, the embrace from rank 4,
  // the hand-hold rank, the same ranks her rank scenes use. Below
  // them, or when the moment cannot be staged (too far, seated,
  // rowing, mid-scene), she says so in a bubble, so a press is
  // never silent. ?preview=pairs still stages both, ungated.
  const shoulderPress = useCallback(
    (side: "LB" | "RB") => {
      if (!walkingRef.current) return;
      const kind = side === "LB" ? "flirt" : "hug";
      if (pairPreview) {
        stagePairPreview(kind);
        return;
      }
      const scene = sceneRef.current;
      if (!scene) return;
      if (affectionRef.current < (kind === "flirt" ? 3 : 4)) {
        scene.showBubble("muse", kind === "flirt" ? "Careful, centurion. You haven't earned that look yet." : "Not yet, love. Walk with me a while longer.");
        return;
      }
      if (!scene.playPairMoment(kind)) {
        scene.showBubble("muse", kind === "flirt" ? "Come closer first, and somewhere we can stand." : "Come here first, somewhere open, and I'm yours.");
      }
    },
    [pairPreview, stagePairPreview],
  );
  const shoulderPressRef = useRef(shoulderPress);
  shoulderPressRef.current = shoulderPress;
  // Walk-mode interaction prompt: the nearest promptable interactable
  // the scene reports. Walking up shows ONLY this prompt, panels open
  // when the visitor presses the interact control (Xbox A, keyboard E
  // or Enter) or taps the prompt / the interactable itself.
  const [nearby, setNearby] = useState<NearbyTarget | null>(null);
  const nearbyRef = useRef<NearbyTarget | null>(null);
  // Companion follow mode: Muse walks with the Centurion. Offers are
  // one-per-occasion per session, a decline (or an offer already made)
  // is remembered so she never nags twice about the same moment.
  // Walk-together is the startup DEFAULT (the owner's call, Oct 31): the
  // town opens with Muse already walking with him, no offer, no
  // prompt, no greeting wave on load. "Stay here" still leaves her
  // at her spot, the talk bubble still invites her again, and a
  // fresh load always starts together again (a default, not a
  // remembered last state).
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  // One-time rejoin hint (UI review, Nov 1; Task 48): the first time
  // Aelia is parked, a single small dismissible hint explains the way
  // back (tap her, or Y near her). Dismissal is remembered for good.
  const [rejoinHint, setRejoinHint] = useState(false);
  // Task 48: once, after the follow switch moved onto her, a small toast says so.
  const FOLLOW_TOAST_KEY = "muse-town-follow-tap-toast";
  const [followToast, setFollowToast] = useState(() => {
    try {
      return localStorage.getItem(FOLLOW_TOAST_KEY) !== "1";
    } catch {
      return false;
    }
  });
  const dismissFollowToast = () => {
    try {
      localStorage.setItem(FOLLOW_TOAST_KEY, "1");
    } catch {
      /* dismissed for this visit */
    }
    setFollowToast(false);
  };
  const dismissFollowToastRef = useRef(dismissFollowToast);
  dismissFollowToastRef.current = dismissFollowToast;
  const rejoinHintDismissedRef = useRef<boolean>(false);
  try {
    if (!rejoinHintDismissedRef.current) {
      rejoinHintDismissedRef.current =
        localStorage.getItem("muse-town-rejoin-hint-dismissed") === "1";
    }
  } catch {
    /* storage unavailable, the hint simply may show once per visit */
  }
  const [menuOpen, setMenuOpen] = useState(false);
  // A physical pad in use (owner's ask, Nov 6, 2026): once a pad has
  // given input in the last ten seconds the on-screen stick, cluster
  // and shoulders stand down, so the town is unobstructed while a
  // controller drives; a tap or click anywhere brings them straight
  // back. The poll below keeps the clock; the ref mirrors the state
  // so the poll writes it only on a change.
  const PAD_HIDE_MS = 10000;
  const [padDriving, setPadDriving] = useState(false);
  const padDrivingRef = useRef(false);
  const lastPadInputRef = useRef(0);
  // Player 2 (Task 3, Nov 3 2026): the town menu's status line for the
  // second channel, and the natural-motion driver's follow harness
  // mode. Runtime only, never saved.
  const [pad2Status, setPad2Status] = useState("");
  const [driverFollow, setDriverFollow] = useState<FollowOffset | "off">("off");
  const driverFollowRef = useRef<FollowOffset | "off">("off");
  driverFollowRef.current = driverFollow;
  // Muse Visits (Task 4, Nov 2026): the runtime-only visit slate and
  // its panel mirror. The slate lives in a ref (the beat and the panel
  // send both write it); the mirror is what the panel and menu read.
  // Nothing here is ever persisted into the save.
  const visitRef = useRef<VisitSlate>(emptySlate());
  const visitThreadRef = useRef<VisitThreadEntry[]>([]);
  const [visitUi, setVisitUi] = useState<{
    active: boolean;
    intention: string | null;
    composing: boolean;
    thread: VisitThreadEntry[];
    director: VisitDirectorState;
    /** When an idle visit will lapse, once that is inside the warning
     *  stretch; null otherwise (fix list, Nov 7, 2026). */
    lapseAt: number | null;
    /** When a director last read the visit, held while none is
     *  reading now (so the line can say when, not "15 seconds"). */
    seenAt: number | null;
  }>({ active: false, intention: null, composing: false, thread: [], director: "none", lapseAt: null, seenAt: null });
  // The visit's one-line notices: opened, picked up after a reload,
  // closed and why (fix list, Nov 7, 2026). Shown a few seconds.
  const [visitNotice, setVisitNotice] = useVisitNotice();
  // Connect my Muse (Task 29): offered only once the hosted bridge pairs.
  const { connectMuse, setConnectMuse, pairingLive, openConnectMuse } = useConnectMuse(() => setMenuOpen(false));
  const directorSeenAtRef = useRef<number | null>(null);
  // Bridge beats that failed in a row: "unreachable" only after a few.
  const bridgeFailsRef = useRef(0);
  // The writing line's clock: when "composing" came on, and when her
  // last final line landed (so a stale flag cannot hold it up).
  const composingSinceRef = useRef<number | null>(null);
  const finalLineAtRef = useRef<number | null>(null);
  // The director seam's harness: ?harness= or localStorage
  // "muse-town-visit-harness" names it; without either the town never
  // calls anywhere, and a visit opened from the menu runs undirected.
  const harnessRef = useRef<{ url: string; configured: boolean } | null>(null);
  if (!harnessRef.current) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(HARNESS_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    const search = typeof window !== "undefined" ? window.location.search : "";
    const explicit = !!(stored && stored.trim()) || /[?&]harness=/.test(search);
    harnessRef.current = { url: resolveHarnessUrl(search, () => stored), configured: explicit };
  }
  const visitLastFrameAtRef = useRef<number | null>(null);
  // The Live Bridge (Task 7): the bridge leg runs only while a visit is
  // open and a bridge URL is set in the visit settings. URL and token
  // are owner-entered, held in this browser only, never sent anywhere
  // but the bridge itself.
  const [bridgeSettings, setBridgeSettings] = useState<BridgeSettings>(() => {
    try {
      return readBridgeSettings((key) => localStorage.getItem(key));
    } catch {
      return { url: "", token: "" };
    }
  });
  // On the web (Task 8) the town's own director door is the default
  // bridge: this origin, the visitor's token; an owner-entered bridge
  // still wins. Off the web it is null, and nothing here changes.
  const [hostedBridge] = useState<BridgeSettings | null>(() => hostedBridgeSettings());
  const activeBridge = resolveBridge(bridgeSettings, hostedBridge);
  const bridgeRef = useRef(activeBridge);
  bridgeRef.current = activeBridge;
  // Where an open visit reports, named in the status lines.
  const visitRoute: VisitRoute = bridgeConfigured(bridgeSettings)
    ? { kind: "bridge", host: hostOf(bridgeSettings.url) }
    : hostedBridge
      ? { kind: "door", host: hostOf(hostedBridge.url) }
      : harnessRef.current?.configured
        ? { kind: "harness", host: hostOf(harnessRef.current.url) }
        : { kind: "none" };
  const bridgeCursorRef = useRef<BridgeCursor>(emptyBridgeCursor());
  /** A prompt bridge beat (new mail, a fresh frame); a no-op unless the leg is on. */
  const bridgeNudgeRef = useRef<() => void>(() => {});
  const updateBridgeSettings = useCallback((next: BridgeSettings) => {
    const saved = storeBridgeSettings((key, value) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        /* storage unavailable: the settings hold for this session */
      }
    }, next);
    setBridgeSettings(saved);
  }, []);
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);
  // The scene's one-line motion verdict, shown quietly at the foot
  // of the town menu once both animators have settled, so a stiff
  // town is a thing its owner can read and report.
  const [motionStatus, setMotionStatus] = useState<string | null>(null);
  // The menu's perf line (v44): polled from the scene's rolling
  // measurement only while the menu is open, so the closed town
  // pays nothing for it and the open menu reads live numbers.
  const [perfLine, setPerfLine] = useState<string | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const read = () => setPerfLine(sceneRef.current?.perfLine() ?? null);
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [menuOpen]);
  // The secret place's warmer register: tracked from walk position.
  // At the terrace, her lines turn flirtatious, his quick-picks sweeten,
  // and the hold-hand / kiss buttons appear. Session-only, like a mood.
  const atSecretRef = useRef(false);
  const [handHeld, setHandHeld] = useState(false);
  const [followOffer, setFollowOfferState] = useState<{ id: string; text: string; guide?: Invite } | null>(null);
  const followOfferRef = useRef<{ id: string; text: string; guide?: Invite } | null>(null);
  const declinedOffersRef = useRef<Set<string>>(new Set());
  const offeredOffersRef = useRef<Set<string>>(new Set());
  const padRef = useRef({ x: 0, y: 0 });
  // Analog left joystick: the knob offset (px) is mirrored to state for
  // rendering; the active pointer id lives in a ref so moves from other
  // touches (the ABXY thumb) never disturb it.
  // Moved straight on the element: state here re-rendered the whole shell
  // on every finger move, in the same frame as the walking it steers.
  const stickKnobRef = useRef<HTMLSpanElement>(null);
  const placeStickKnob = (x: number, y: number) => {
    if (stickKnobRef.current) stickKnobRef.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const stickPointer = useRef<number | null>(null);

  // Stylized weather: random events rolled by the scene, mirrored here
  // for the weather chip, panel, banner, and ambience. Weather lives only
  // in the scene, it is never saved.
  const [weather, setWeather] = useState<WeatherChangeInfo | null>(null);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  // The town plan (Nov 6, 2026 review): a panel, refreshed each second
  // while open so the two dots keep up with the walk.
  const [mapOpen, setMapOpen] = useState(false);
  const [mapTick, setMapTick] = useState(0);
  useEffect(() => {
    if (!mapOpen) return;
    const id = window.setInterval(() => setMapTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [mapOpen]);
  const [questOpen, setQuestOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretFirstVisit, setSecretFirstVisit] = useState(true);
  const [chatDraft, setChatDraft] = useState("");
  const [localChatPending, setLocalChatPending] = useState(false);
  const [localModelPreparing, setLocalModelPreparing] = useState<LocalModelName | null>(null);
  const [preparedLocalModels, setPreparedLocalModels] = useState<Set<LocalModelName>>(() => new Set());
  const [localChatStatus, setLocalChatStatus] = useState<LocalChatStatus | null>(null);
  const localChatHistory = useRef<AeliaChatTurn[]>([]);
  // Muse conversations live in an RPG speech bubble now (the owner's
  // call, Oct 31), never in an information panel. The bubble shows
  // one part of her response at a time; tapping it (or pressing A)
  // advances; the typed-chat form lives inside it; and a talk at
  // her spot ends with the walk-together choice as bubble options.
  // Her old panel is retired: memories/topics browsing moved to
  // the Villa of Stories, follow/stay rides the walk chip.
  const [museBubble, setMuseBubble] = useState<{
    lines: string[];
    index: number;
    cycle: boolean;
    invite: boolean;
    choice: DialogueChoiceSet | null;
    /** A true dream's conversation: when it closes, he wakes. */
    dream?: boolean;
  } | null>(null);
  // While her talk bubble is open, the scene gestures the
  // conversation (Outdoor Communicate clips on both bodies).
  useEffect(() => {
    sceneRef.current?.setTalking(museBubble !== null);
  }, [museBubble]);
  // Affection (dating-sim hearts): her earned rank lives in the saved
  // state; the client only reads it to tune her behaviour, line
  // pools, gates, initiations. No numbers are ever displayed.
  const affectionRef = useRef(0);
  const earnRef = useRef<(reason: string) => void>(() => {});
  const earnCappedRef = useRef(new Map<string, string>());
  const talkedTodayRef = useRef(false);
  const pendingRankHintRef = useRef(false);
  const talkCountRef = useRef(0);
  const lastChoiceIdRef = useRef<string | null>(null);
  const playerPosRef = useRef<{ x: number; z: number }>({ x: 4.4, z: 9.2 });
  const lakeBondRef = useRef(false);
  const secretKissRef = useRef(false);
  const togetherSecsRef = useRef({ walk: 0, bench: 0, row: 0, wander: 0 });
  // Hand-in-hand wandering (rank 4+): no destination, a stroll's
  // pace, hands joined, the scene owns the pose, the pace cap, and
  // the hurry release; this mirror (state + ref) drives
  // the bubble/chip options and the bonus together-time accrual.
  // Session-only, like a mood.
  const [handInHandWalk, setHandInHandWalk] = useState(false);
  const handInHandWalkRef = useRef(false);
  // --- The game systems (Phases A–D) ----------------------------------
  // Denarii & upgrades, lake fishing, knucklebones, the garden, the
  // postcard challenges, and the inscriptions. Saved state owns the
  // purse and every record; these are only panel/session mirrors.
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketStall, setMarketStall] = useState("market-a");
  const [dockChoice, setDockChoice] = useState(false);
  const [inscriptionId, setInscriptionId] = useState<string | null>(null);
  // The history book (Task 37): closed (undefined), its index (null), or a lesson.
  const [historyLesson, setHistoryLesson] = useState<string | null | undefined>(undefined);
  // Their home (Task 40): the arranging panel.
  const [homeOpen, setHomeOpen] = useState(false);

  /** The real-history lesson behind a place in town, opened in the book. */
  const openHistoryFor = (placeId: string) => {
    const lesson = lessonForPlace(placeId);
    if (lesson) setHistoryLesson(lesson.id);
  };
  const inscriptionRef = useRef<string | null>(null);
  inscriptionRef.current = inscriptionId;
  const skyWatchDoneRef = useRef(false);
  const [fishing, setFishing] = useState<{
    phase: "waiting" | "bite" | "caught" | "missed";
    fish: Fish | null;
  } | null>(null);
  const fishingTimer = useRef<number | null>(null);
  const fishingRef = useRef(false);
  const [knuckle, setKnuckle] = useState<{
    round: number;
    stake: number;
    opponent: "keeper" | "muse";
    myFaces: number[] | null;
    foeFaces: number[] | null;
    myScore: number;
    foeScore: number;
    phase: "stake" | "thrown" | "done";
    result: "win" | "lose" | "draw" | null;
  } | null>(null);
  const museBubbleRef = useRef<typeof museBubble>(null);
  museBubbleRef.current = museBubble;
  // --- The Night the Stars Fall (the summit scene) ------------------
  // Her longest sequence: a queue of beats built from SUMMIT_SCENE,
  // each beat's text paginated into bubbles (the song stays one
  // verse bubble). It advances only on his taps; stepping away (B,
  // the ✕, or walking off) postpones it, never cancels, never
  // completes. Completing the last beat calls the server's
  // once-ever completeSummit. Session-only state, like a held breath.
  interface SummitBeat {
    text: string;
    effect?: SummitEffect;
    choice?: { options: { label: string; follow: string }[] };
  }
  const [summitScene, setSummitScene] = useState<{ beats: SummitBeat[]; index: number } | null>(null);
  const summitRef = useRef<typeof summitScene>(null);
  summitRef.current = summitScene;
  const [summitDim, setSummitDim] = useState(false);
  const summitDoneRef = useRef(false);
  const summitPrivateNameRef = useRef("");
  const songAudioRef = useRef<HTMLAudioElement | null>(null);
  const meteorLineShownRef = useRef(false);
  // Wistful-hint bookkeeping: previous values of the four quiet
  // prerequisites, so the moment one completes she can murmur about
  // that piece alone, never the whole, never a checklist.
  const summitHintsPrevRef = useRef<{
    fountain: boolean;
    inscriptions: boolean;
    carp: boolean;
    challenges: boolean;
  } | null>(null);
  // Sitting: which bench the Centurion is on (null = standing). The
  // scene owns the state; this mirror drives the prompt label and
  // the B button.
  const [seatedBench, setSeatedBench] = useState<string | null>(null);
  const seatedBenchRef = useRef<string | null>(null);
  // Task 47: Gaius's shield, stowed on every load; one press brings it
  // out onto his back, the next stows it (RT, or G). The gladius is worn
  // at his hip by default; LT (or R) stows it and wears it again.
  const [shieldOut, setShieldOut] = useState(false);
  const shieldOutRef = useRef(false);
  const toggleShield = useCallback(() => {
    const next = !shieldOutRef.current;
    shieldOutRef.current = next;
    setShieldOut(next);
    sceneRef.current?.setShieldOut(next);
    // Sitting, it waits to be slung until he stands (it would pass through the seat's back).
    if (next && seatedBenchRef.current) {
      setHintText("Shield out. It goes on your back when you stand.");
      window.setTimeout(() => setHintText(null), 2600);
    }
  }, []);
  const toggleShieldRef = useRef(toggleShield);
  toggleShieldRef.current = toggleShield;
  const [swordWorn, setSwordWorn] = useState(true);
  const swordWornRef = useRef(true);
  const toggleSword = useCallback(() => {
    const next = !swordWornRef.current;
    swordWornRef.current = next;
    setSwordWorn(next);
    sceneRef.current?.setSwordWorn(next);
  }, []);
  const triggerPress = useCallback(
    (side: "LT" | "RT") => {
      if (side === "LT") toggleSword();
      else toggleShield();
    },
    [toggleSword, toggleShield],
  );
  const triggerPressRef = useRef(triggerPress);
  triggerPressRef.current = triggerPress;
  seatedBenchRef.current = seatedBench;
  // Rowing: the pair are out in the lake rowboat. The scene owns the
  // state; this mirror drives the prompt label, the B button, and
  // hiding the follow chip while they're on the water.
  const [rowingBoat, setRowingBoat] = useState(false);
  const rowingRef = useRef(false);
  // The quiet drift (Task 57): the oars shipped, the boat adrift, ended only by his choice.
  const driftingRef = useRef(false);
  const [drifting, setDrifting] = useState(false);
  const [driftOffered, setDriftOffered] = useState(false);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [lettersOpen, setLettersOpen] = useState(false);
  const [openLetterId, setOpenLetterId] = useState<number | null>(null);
  const openLetterBody = useQuery({
    queryKey: ["letter", openLetterId],
    queryFn: () => api.getLetter({ id: openLetterId! }),
    enabled: openLetterId !== null,
  });
  const [postcardDraft, setPostcardDraft] = useState<{ photo: string; caption: string } | null>(null);
  const [postcardView, setPostcardView] = useState<{ id: number; image_url: string; caption: string; date_label: string; weather: string } | null>(null);
  const lettersSeededRef = useRef(false);
  const unreadRef = useRef(0);
  const toastTimer = useRef<number | null>(null);
  const boardSeededRef = useRef(false);
  const streetsWalkedRef = useRef<Set<number>>(new Set());
  const landmarksRef = useRef<Set<string>>(new Set());
  // The quiet activities leave a first (Nov 6, 2026 review): done with
  // her beside him, each one records its first day under FIRST_LABELS,
  // once per session per key (the server never overwrites a first).
  const firstsSentRef = useRef<Set<string>>(new Set());
  const noteFirst = (key: string) => {
    if (!followingRef.current || firstsSentRef.current.has(key)) return;
    firstsSentRef.current.add(key);
    void api.recordFirst({ key }).catch(() => {});
  };
  const achievementGate = useRef(new AchievementGate()).current;
  const progressRef = useRef<{ quests: Set<string> }>({
    quests: new Set(),
  });
  const nightRef = useRef(false);
  // Sleep and the Dream Door: the shell veils the resting, the
  // server rolls the night, the scene owns the dream worlds.
  const [dreaming, setDreaming] = useState<null | "false" | "true">(null);
  const dreamingRef = useRef<null | "false" | "true">(null);
  const [veil, setVeil] = useState(false);
  const [veilOpaque, setVeilOpaque] = useState(false);
  const dreamBubbleShownRef = useRef(false);
  const weatherChoiceRef = useRef<WeatherId | "auto">("auto");
  const endFalseDreamRef = useRef<() => void>(() => {});
  const endTrueDreamRef = useRef<() => void>(() => {});
  const secretVisitedRef = useRef(false);
  const [weatherBanner, setWeatherBanner] = useState<string | null>(null);
  const [weatherSoundOn, setWeatherSoundOn] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const weatherSoundOnRef = useRef(true);
  const audioUnlockedRef = useRef(false);
  const seenWeatherRef = useRef(false);
  const weatherRef = useRef<WeatherChangeInfo | null>(null);
  const growthRef = useRef<{ stage: { name: string } } | null>(null);
  const foundRef = useRef<string[]>([]);
  const boardAsOfRef = useRef("");
  const bannerTimer = useRef<number | null>(null);
  // Banner arrival order for the portrait two-banner cap (see the
  // note beside bannerOrder's declaration).
  useEffect(() => {
    if (achievementToast) setBannerOrder((o) => [...o.filter((k) => k !== "achievement"), "achievement"]);
  }, [achievementToast]);
  useEffect(() => {
    if (weatherBanner) setBannerOrder((o) => [...o.filter((k) => k !== "weather"), "weather"]);
  }, [weatherBanner]);

  const { state, applyState } = useTownState();
  const stateRef = useRef(state.data);
  stateRef.current = state.data;
  // No-repeat line pools: hydrate the shared draw-state manager
  // from the server's durable store, and mark every draw back
  // server-side (fire-and-forget, a missed mark only means one
  // pool reshuffles a little early).
  useEffect(() => {
    linePools.setPersist((poolKey, poolState) => {
      void api
        .recordLineDraw({ pool_key: poolKey, bag: poolState.bag, last_heard: poolState.lastHeard })
        .catch(() => {});
    });
  }, []);
  useEffect(() => {
    if (state.data?.line_pools) linePools.hydrate(state.data.line_pools);
  }, [state.data?.line_pools]);
  // Memory, digest, continuity (Nov 1): her fact memory, her
  // questions, and her appointments.
  const learnFact = useMutation({
    mutationFn: (args: { text: string; topic: string; source: "chat" | "question" }) => api.learnFact(args),
    onSuccess: applyState,
  });
  const learnFactRef = useRef(learnFact.mutate);
  learnFactRef.current = learnFact.mutate;
  const deleteFact = useMutation({
    mutationFn: (id: number) => api.deleteFact({ id }),
    onSuccess: applyState,
  });
  const updateAppointment = useMutation({
    mutationFn: (args: {
      appointment: { place: string; phase: string; day: string; status: "proposed" | "accepted" | "declined" | "met" | "missed" } | null;
      cooldown_until?: string;
    }) => api.updateAppointment(args),
    onSuccess: applyState,
  });
  const updateAppointmentRef = useRef(updateAppointment.mutate);
  updateAppointmentRef.current = updateAppointment.mutate;
  // Task companion, focus sittings, hide-and-seek, flowers, bottles.
  const taskTouch = useMutation({
    mutationFn: (args: { kind: "muster" | "celebrate" | "eve" | "overdue"; quest_id?: string }) =>
      api.taskTouch(args),
    onSuccess: applyState,
  });
  const taskTouchRef = useRef(taskTouch.mutate);
  taskTouchRef.current = taskTouch.mutate;
  const seekAction = useMutation({
    mutationFn: (args: { op: "start" | "clue" | "found"; spot?: string }) => api.seekAction(args),
    onSuccess: applyState,
  });
  const seekActionRef = useRef(seekAction.mutate);
  seekActionRef.current = seekAction.mutate;
  const writeBottle = useMutation({
    mutationFn: (text: string) => api.writeBottle({ text }),
    onSuccess: applyState,
  });
  const deleteBottle = useMutation({
    mutationFn: (id: number) => api.deleteBottle({ id }),
    onSuccess: applyState,
  });
  const giveBouquet = useMutation({
    mutationFn: (seasonName: string) => api.giveBouquet({ season: seasonName }),
    onSuccess: applyState,
  });
  // Reading aloud at Stories: the server keeps the once-a-day cap
  // and the count of readings; the moment itself earns nothing.
  const recordReading = useMutation({
    mutationFn: (dateKey: string) => api.recordReading({ date_key: dateKey }),
    onSuccess: applyState,
  });
  const foragePick = useMutation({
    mutationFn: (spotId: string) => api.foragePick({ spot_id: spotId }),
    onSuccess: applyState,
  });
  const foragePickRef = useRef(foragePick.mutate);
  foragePickRef.current = foragePick.mutate;
  // Dating canon mutations.
  const completeChapter = useMutation({
    mutationFn: (args: { chapter_id: string; keepsake: string }) => api.completeChapter(args),
    onSuccess: applyState,
  });
  const completeChapterRef = useRef(completeChapter.mutate);
  completeChapterRef.current = completeChapter.mutate;
  const frictionAction = useMutation({
    mutationFn: (args: { op: "start" | "mend" | "clear"; cause?: string }) => api.frictionAction(args),
    onSuccess: applyState,
  });
  const frictionActionRef = useRef(frictionAction.mutate);
  frictionActionRef.current = frictionAction.mutate;
  const claimPerk = useMutation({
    mutationFn: (args: { perk: "basil" | "morning"; item: "market-basket" | "fishermans-bundle" | "bakers-sack" }) =>
      api.claimPerk(args),
    onSuccess: applyState,
  });
  const recordGift = useMutation({
    mutationFn: (args: { item: string; tier: GiftTier; label: string; consume: "ingredient" | "dish" | "fish" | "none" }) =>
      api.recordGift(args),
    onSuccess: applyState,
  });
  const giveBouquetRef = useRef(giveBouquet.mutate);
  giveBouquetRef.current = giveBouquet.mutate;
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const pendingChapterRef = useRef<(typeof STAR_BOOK_CHAPTERS)[number] | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(() => {
    try { return localStorage.getItem("muse-town-chapter"); } catch { return null; }
  });
  const activeChapterRef = useRef<string | null>(activeChapterId);
  activeChapterRef.current = activeChapterId;
  const frictionUiRef = useRef<{ stage: "ask" | "mend"; cause: string } | null>(null);
  const frictionLocalRef = useRef<{ cause: string } | null>(null);
  const carryingBouquetRef = useRef(false);
  const dateSessionRef = useRef<{ place: string; used: string[]; count: number } | null>(null);
  const pendingRankSceneRef = useRef<number | null>(null);
  const prevRankRef = useRef<number | null>(null);
  const [focusSitting, setFocusSitting] = useState<{ endsAt: number; minutes: number } | null>(null);
  const focusSittingRef = useRef<{ endsAt: number; minutes: number } | null>(null);
  focusSittingRef.current = focusSitting;
  const focusReportRef = useRef(false);
  const [focusLeft, setFocusLeft] = useState(0);
  const [carryingBouquet, setCarryingBouquet] = useState(false);
  carryingBouquetRef.current = carryingBouquet;
  const [bottleOpen, setBottleOpen] = useState(false);
  const [bottleText, setBottleText] = useState("");
  const [bottleRead, setBottleRead] = useState<{ id: number; day: string; text: string } | null>(null);
  const doneBaselineRef = useRef<Set<string> | null>(null);
  const seekClueStageRef = useRef(0);
  const seekStartedAtRef = useRef(0);
  const pendingQuestionRef = useRef<{ id: string; fact: string; topic: string } | null>(null);
  // Appointment kept: while an accepted appointment's day and her
  // routine phase align and he stands at the place, it is met,
  // her greeting, once, and the appointment closes.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const appt = stateRef.current?.appointment;
      if (!appt || appt.status !== "accepted" || appointmentMetRef.current) return;
      if (appt.day !== new Date().toLocaleDateString("en-CA")) return;
      const scene = sceneRef.current;
      if (!scene || !walkingRef.current) return;
      if (scene.routineInfo().anchor !== appt.place) return;
      const spot = APPOINTMENT_SPOTS.find((sp) => sp.place === appt.place);
      if (!spot) return;
      const p = playerPosRef.current;
      if (Math.hypot(p.x - spot.spot[0], p.z - spot.spot[1]) > 4.5) return;
      appointmentMetRef.current = true;
      updateAppointmentRef.current({ appointment: null });
      const metLine = pickPooled("appointment-met", APPOINTMENT_MET_LINES);
      scene.showBubble("muse", metLine);
      // A kept appointment becomes a small ceremony: a structured
      // date, topic cards, her longer answers, her questions.
      dateSessionRef.current = { place: appt.place, used: [], count: 0 };
      setMuseBubble({
        lines: paginateLines([metLine, "Stay a while, love. What shall we talk about, here of all places?"]),
        index: 0,
        cycle: false,
        invite: false,
        choice: dateChoiceFor([]),
      });
    }, 4000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Celebration baseline: quests already done when the town loads
  // are history, not news, only completions from here on are
  // celebrated at her next meeting.
  useEffect(() => {
    if (state.data && !doneBaselineRef.current) {
      doneBaselineRef.current = new Set(state.data.quests_done);
    }
  }, [state.data]);
  // Rank crossings: a rank earned since load earns its scene at
  // their next meeting (the desk letter still arrives as before).
  useEffect(() => {
    const rank = state.data?.affection.rank;
    if (rank == null) return;
    if (prevRankRef.current != null && rank > prevRankRef.current) {
      pendingRankSceneRef.current = rank;
    }
    prevRankRef.current = rank;
  }, [state.data?.affection.rank]);
  // Star Book chapter completion: a quiet checker for the active
  // chapter's small joint task.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const id = activeChapterRef.current;
      if (!id) return;
      const chapter = STAR_BOOK_CHAPTERS.find((c) => c.id === id);
      if (!chapter) return;
      const p = playerPosRef.current;
      let done = false;
      if (id === "ch1-pavilion") {
        done = nightRef.current && followingRef.current && Math.hypot(p.x + 28, p.z + 33) < 7.5;
      } else if (id === "ch2-shard") {
        try {
          const raw = localStorage.getItem("muse-town-shard");
          if (raw) {
            const shard = JSON.parse(raw) as { day: string; x: number; z: number };
            const todayStr = new Date().toLocaleDateString("en-CA");
            if (shard.day < todayStr && Math.hypot(p.x - shard.x, p.z - shard.z) < 2.6) done = true;
          }
        } catch { /* storage unavailable */ }
      } else if (id === "ch3-inscription") {
        done = inscriptionRef.current === "temple" && followingRef.current;
      } else if (id === "ch4-moonrise") {
        done = rowingRef.current && nightRef.current;
      } else if (id === "ch5-constellation") {
        done = skyWatchDoneRef.current;
        if (done) skyWatchDoneRef.current = false;
      }
      if (done) {
        setActiveChapterId(null);
        try {
          localStorage.removeItem("muse-town-chapter");
          localStorage.removeItem("muse-town-shard");
        } catch { /* storage unavailable */ }
        completeChapterRef.current({ chapter_id: chapter.id, keepsake: chapter.keepsake });
        setMuseBubble({
          lines: paginateLines(chapter.done),
          index: 0,
          cycle: false,
          invite: false,
          choice: null,
          dream: false,
        });
      }
    }, 4000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Focus sittings: a quiet timer beside her. On completion she
  // asks how it went; his typed reply is kept (see sendChat).
  useEffect(() => {
    if (!focusSitting) return;
    setFocusLeft(Math.max(1, Math.round((focusSitting.endsAt - Date.now()) / 60000)));
    const iv = window.setInterval(() => {
      const left = Math.round((focusSitting.endsAt - Date.now()) / 60000);
      if (left <= 0) {
        window.clearInterval(iv);
        setFocusSitting(null);
        sceneRef.current?.setQuietMode(false);
        focusReportRef.current = true;
        setMuseBubble({
          lines: paginateLines([pickPooled("focus-end", FOCUS_END_LINES)]),
          index: 0,
          cycle: false,
          invite: false,
          choice: null,
          dream: false,
        });
        return;
      }
      setFocusLeft(left);
    }, 5000);
    return () => window.clearInterval(iv);
  }, [focusSitting]);
  // Hide-and-seek: while a seek is active she is concealed at her
  // spot. An interval starts seeks on eligible evenings, walks the
  // three clues by time and proximity, and finds her.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !state.data?.seek.active) return;
    scene.setMuseHidden(true);
    if (!seekStartedAtRef.current) {
      seekStartedAtRef.current = Date.now();
      seekClueStageRef.current = state.data.seek.clue;
    }
  }, [state.data?.seek.active, state.data?.seek.clue, sceneReady]);
  useEffect(() => {
    const iv = window.setInterval(() => {
      const d = stateRef.current;
      const scene = sceneRef.current;
      if (!d || !scene) return;
      const todayStr = new Date().toLocaleDateString("en-CA");
      if (d.seek.active) {
        const spot = SEEK_SPOTS.find((s) => s.id === d.seek.spot);
        if (!spot || !walkingRef.current) return;
        const p = playerPosRef.current;
        const dist = Math.hypot(p.x - spot.x, p.z - spot.z);
        const stage = seekClueStageRef.current;
        if (dist < 3.4) {
          seekStartedAtRef.current = 0;
          seekClueStageRef.current = 0;
          seekActionRef.current({ op: "found" });
          scene.placeMuseAt(spot.x, spot.z);
          setMuseBubble({
            lines: paginateLines([pickPooled("seek-found", SEEK_FOUND_LINES)]),
            index: 0,
            cycle: false,
            invite: false,
            choice: null,
            dream: false,
          });
        } else if (stage === 0 && Date.now() - seekStartedAtRef.current > 40000) {
          seekClueStageRef.current = 1;
          seekActionRef.current({ op: "clue" });
          setHintText(SEEK_HINT_LINE);
          window.setTimeout(() => setHintText(null), 14000);
        } else if (stage === 1 && dist < 20) {
          seekClueStageRef.current = 2;
          seekActionRef.current({ op: "clue" });
          setHintText(seekClueLine(1, spot));
          window.setTimeout(() => setHintText(null), 12000);
        } else if (stage === 2 && dist < 10) {
          seekClueStageRef.current = 3;
          seekActionRef.current({ op: "clue" });
          setHintText(seekClueLine(2, spot));
          window.setTimeout(() => setHintText(null), 12000);
        }
        return;
      }
      // Start a seek: some evenings only: night fallen, rank 2+,
      // at least three days since the last game, no festival today,
      // not dreaming, not sitting a focus.
      if (!nightRef.current || dreamingRef.current || focusSittingRef.current) return;
      if (affectionRef.current < 2) return;
      const last = d.seek.last_seek_day;
      if (last && (Date.parse(todayStr) - Date.parse(last)) / 86400000 < 3) return;
      const nowD = new Date();
      const mmdd = `${String(nowD.getMonth() + 1).padStart(2, "0")}-${String(nowD.getDate()).padStart(2, "0")}`;
      if (d.festivals.some((f) => f.month_day === mmdd)) return;
      const dayNum = Math.floor(Date.parse(todayStr) / 86400000);
      const spot = SEEK_SPOTS[dayNum % SEEK_SPOTS.length]!;
      seekStartedAtRef.current = Date.now();
      seekClueStageRef.current = 0;
      seekActionRef.current({ op: "start", spot: spot.id });
    }, 5000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Resume snapshot (Nov 1): the ephemeral scene state: where he
  // stood, the camera, walk/follow, day-night, the turned view,
  // saved throttled and on hide, so leaving for chat and coming
  // back continues exactly where he was. Game data is the server's;
  // this is only the pose. Versioned and sanity-checked on load;
  // anything off falls back to the normal spawn, silently.
  useEffect(() => {
    const save = () => {
      const scene = sceneRef.current;
      if (!scene) return;
      const snap = scene.resumeState();
      if (!snap) return;
      try {
        localStorage.setItem(
          "muse-town-resume-v1",
          JSON.stringify({
            v: 1,
            scene: snap,
            walking: walkingRef.current,
            following: followingRef.current,
            night: nightRef.current,
            forcedLandscape: forcedLandscapeRef.current,
            ts: Date.now(),
          }),
        );
      } catch { /* storage unavailable */ }
    };
    const iv = window.setInterval(save, 4000);
    const onVis = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", save);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resumeAppliedRef = useRef(false);
  useEffect(() => {
    if (resumeAppliedRef.current || !sceneReady || !state.data) return;
    resumeAppliedRef.current = true;
    let raw: string | null = null;
    try { raw = localStorage.getItem("muse-town-resume-v1"); } catch { /* storage unavailable */ }
    if (!raw) return;
    try {
      const snap = JSON.parse(raw) as {
        v?: number;
        ts?: number;
        walking?: boolean;
        following?: boolean;
        night?: boolean;
        forcedLandscape?: boolean;
        scene?: {
          x: number; z: number; heading: number; camYaw: number; camPitch: number; userZoom: number;
          ov?: { cx: number; cy: number; cz: number; tx: number; ty: number; tz: number };
        };
      };
      const sc = snap.scene;
      const nums = sc ? [sc.x, sc.z, sc.heading, sc.camYaw, sc.camPitch, sc.userZoom] : [];
      const ovNums = sc?.ov ? [sc.ov.cx, sc.ov.cy, sc.ov.cz, sc.ov.tx, sc.ov.ty, sc.ov.tz] : [];
      const sane =
        snap.v === 1 &&
        !!sc &&
        nums.every((n) => typeof n === "number" && Number.isFinite(n)) &&
        ovNums.every((n) => typeof n === "number" && Number.isFinite(n)) &&
        Math.abs(sc!.x) <= 64 &&
        Math.abs(sc!.z) <= 64 &&
        typeof snap.ts === "number" &&
        Date.now() - snap.ts < 30 * 86400000;
      if (!sane) {
        try { localStorage.removeItem("muse-town-resume-v1"); } catch { /* storage unavailable */ }
        return;
      }
      if (!!snap.night !== nightRef.current) toggleNight();
      if (!!snap.forcedLandscape !== forcedLandscapeRef.current) toggleForcedLandscape();
      if (sc) {
        const scene = sceneRef.current;
        if (snap.walking) {
          enterWalkMode();
          // Follow state, applied SILENTLY: the start/stop handlers
          // speak a line each, and a restore must never replay a
          // greeting, the scene setter carries no bubble, and
          // following disarms her greeting wave. Parked (following
          // false) leaves her to her routine, which has her at her
          // current schedule anchor; restoreResume only places her
          // beside him when the scene's follow mode is on.
          const wantFollow = snap.following !== false;
          followingRef.current = wantFollow;
          setFollowing(wantFollow);
          scene?.setFollowMode(wantFollow);
          scene?.restoreResume(sc);
        } else {
          // He left in the OVERVIEW: restore its camera framing,
          // leave walk mode again (entering the overview sends her
          // back to her routine anchor, as it always does), then
          // restore his standing pose so he reappears exactly there
          // when he next walks. Nothing in this path speaks, waves,
          // or raises a banner, the town simply continues.
          if (sc.ov) scene?.restoreOverview(sc.ov);
          exitWalkMode();
          scene?.restoreResume(sc);
        }
      }
    } catch {
      try { localStorage.removeItem("muse-town-resume-v1"); } catch { /* storage unavailable */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, state.data]);
  const pendingAppointmentRef = useRef<(typeof APPOINTMENT_SPOTS)[number] | null>(null);
  const followupShownRef = useRef(false);
  const appointmentMetRef = useRef(false);
  const affectionRank = state.data?.affection.rank ?? 0;
  const purse = state.data?.purse ?? { denarii: 0, upgrades: [], ingredients: [], dishes: [], seeds: 0, home_decor: {}, quests: [], wedding: { steps: [], weddings: 0, celebrated: true } };
  // Their home's keepsakes, into the scene whenever the arrangement changes (Task 40).
  const homeDecorKey = JSON.stringify(purse.home_decor);
  useEffect(() => {
    sceneRef.current?.setHomeDecor(JSON.parse(homeDecorKey) as Record<string, string>);
  }, [homeDecorKey, sceneReady]);
  // The real-project quests (Task 56): the scene shows what they leave and
  // sends a messenger per new step; a finished quest's celebration plays
  // once (the town then marks it celebrated), with her words.
  const questsKey = JSON.stringify(purse.quests);
  const celebratingRef = useRef(new Set<string>());
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;
    // A quiet drift on the lake is never interrupted: the celebration waits for the shore.
    if (driftingRef.current) return;
    for (const kind of scene.setQuests(JSON.parse(questsKey))) {
      if (celebratingRef.current.has(kind)) continue;
      celebratingRef.current.add(kind);
      const def = questDef(kind);
      scene.celebrateQuest(def.celebration);
      setMuseBubble({ lines: paginateLines([def.celebrationLines[0]!]), index: 0, cycle: false, invite: false, choice: null });
      celebrateQuest.mutate(kind, { onSettled: () => celebratingRef.current.delete(kind) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questsKey, sceneReady, drifting]);
  // The Roman wedding (Task 58): the town is dressed from the dressing until the
  // day is held; the celebration plays once, then the dressing comes down.
  const weddingKey = JSON.stringify(purse.wedding);
  const weddingPlayingRef = useRef(false);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;
    if (scene.setWedding(JSON.parse(weddingKey)) && !weddingPlayingRef.current) {
      weddingPlayingRef.current = true;
      scene.celebrateWedding();
      setMuseBubble({ lines: paginateLines([WEDDING_CELEBRATION_LINE]), index: 0, cycle: false, invite: false, choice: null });
      celebrateWedding.mutate(undefined, { onSettled: () => (weddingPlayingRef.current = false) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingKey, sceneReady]);
  const gardenStage = !state.data?.garden.planted_on
    ? 0
    : state.data.garden.water_days >= 3
      ? 3
      : state.data.garden.water_days >= 1
        ? 2
        : 1;
  const unsoldFish = (state.data?.fish ?? []).filter((f) => !f.sold);
  const kitchenFish = FISH.find((f) => f.id !== "golden-carp" && unsoldFish.some((u) => u.fish_id === f.id && !u.released)) ?? null;
  const unsoldValue = unsoldFish.reduce(
    (sum, f) => sum + (FISH.find((x) => x.id === f.fish_id)?.price ?? 0),
    0,
  );
  // The treasure list proper: saved discoveries can also hold
  // non-treasure sightings (Lupa the wolf's first sighting lives in
  // the same store), and the treasure counter, and the tree's
  // growth, must only ever count treasures.
  const found = (state.data?.found ?? []).filter((id) => COLLECTIBLES.some((c) => c.id === id));
  const foundSet = new Set(found);
  const nextCollectible = COLLECTIBLES.find((c) => !foundSet.has(c.id));

  const markFound = useMutation({
    mutationFn: (collectibleId: string) => api.markFound({ collectibleId }),
    onSuccess: applyState,
  });
  const addJournal = useMutation({
    mutationFn: (text: string) => api.addJournalEntry({ text }),
    onSuccess: (data) => {
      applyState(data);
      setJournalDraft("");
    },
  });
  const deleteJournal = useMutation({
    mutationFn: (id: number) => api.deleteJournalEntry({ id }),
    onSuccess: applyState,
  });
  const waterTree = useMutation({
    mutationFn: () => api.waterTree({}),
    onSuccess: (data) => {
      applyState(data);
      // Watering the tree on a day she's present, or at least a day
      // they've talked, is one of the small rituals hearts are made of.
      if (followingRef.current || talkedTodayRef.current) earnRef.current("water");
      offerFollowRef.current(
        "watering",
        "We watered it together. Shall I stroll with you a while from here?",
      );
    },
  });
  const visitSecret = useMutation({
    mutationFn: () => api.visitSecret({}),
    onSuccess: applyState,
  });
  const recordKiss = useMutation({
    mutationFn: () => api.recordKiss({}),
    onSuccess: applyState,
  });
  // The kiss's peak: quietly remember it (the server keeps the first
  // date), and let her answer with a shy bubble line. Nobody else in
  // town is told, no badge, no board entry, nothing.
  const kissMomentRef = useRef(() => {});
  kissMomentRef.current = () => {
    recordKiss.mutate();
    // The first kiss speaks from its own set; later ones from the
    // quieter repeat set. Kisses earn no affection, by design.
    const first = !secretKissRef.current;
    secretKissRef.current = true;
    const pool = first ? FIRST_KISS_LINES : KISS_LINES;
    const line = pool[Math.floor(Math.random() * pool.length)]!;
    window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 700);
  };
  const seedBoard = useMutation({
    mutationFn: () => api.seedBoard({}),
    onSuccess: applyState,
  });
  const markQuestDone = useMutation({
    mutationFn: (questId: string) => api.markQuestDone({ questId }),
    onSuccess: applyState,
  });
  const unlockAchievement = useMutation({
    mutationFn: (achievementId: string) => api.unlockAchievement({ achievementId }),
    onSuccess: applyState,
  });
  const seedLetter = useMutation({
    mutationFn: () => api.seedLetter({}),
    onSuccess: applyState,
  });
  const markLetterRead = useMutation({
    mutationFn: (id: number) => api.markLetterRead({ id }),
    onSuccess: applyState,
  });
  const addPostcard = useMutation({
    mutationFn: (args: { image_base64: string; caption: string; date_label: string; weather: string }) =>
      api.addPostcard(args),
    onSuccess: (data) => {
      applyState(data);
      // A postcard taken while she's with him, her in the frame, in
      // spirit if not in pixels, is a small keepsake of the day.
      if (followingRef.current) earnRef.current("postcard");
      // Postcard challenges: a framed shot at a named view ticks its
      // challenge (denarii from the server, once per view).
      const { x, z } = playerPosRef.current;
      const upgradesNow = data.purse.upgrades;
      let challenge: string | null = null;
      if (sceneRef.current?.wolfInView()) challenge = "wolf-dusk";
      else if (atSecretRef.current) challenge = "terrace";
      else if (nightRef.current && Math.hypot(x - LAKE.position[0], z - LAKE.position[1]) < 10) challenge = "lake-night";
      else if (upgradesNow.includes("fountain") && Math.hypot(x, z - 15.5) < 6.5) challenge = "fountain";
      else if (Math.hypot(x - COLOSSEUM.position[0], z - COLOSSEUM.position[1]) < 13) challenge = "colosseum";
      else if (Math.hypot(x - 26.6, z + 26.1) < 7) challenge = "temple";
      else if (Math.hypot(x + 20, z + 19.3) < 7) challenge = "aqueduct";
      let challengeToast = false;
      if (challenge && !data.challenges_done.includes(challenge)) {
        completeChallenge.mutate(challenge);
        challengeToast = true;
        setAchievementToast("📮 Postcard challenge complete");
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setAchievementToast(null), 3500);
      }
      // First light / last light: a postcard framed inside a golden
      // window is its own subject, wherever he stands.
      const skyNow = sceneRef.current?.skyState();
      if (skyNow?.golden && (skyNow.phase === "dawn" || skyNow.phase === "dusk")) {
        const lightChallenge = skyNow.phase === "dawn" ? "first-light" : "last-light";
        if (!data.challenges_done.includes(lightChallenge)) {
          completeChallenge.mutate(lightChallenge);
          challengeToast = true;
          setAchievementToast(
            skyNow.phase === "dawn"
              ? "📮 First light, postcard challenge complete"
              : "📮 Last light, postcard challenge complete",
          );
          if (toastTimer.current) window.clearTimeout(toastTimer.current);
          toastTimer.current = window.setTimeout(() => setAchievementToast(null), 3500);
        }
      }
      setPostcardDraft(null);
      // The generic saved note only speaks when no challenge toast
      // did, a completed challenge is the headline, not a footnote
      // overwritten in the same breath.
      if (!challengeToast) {
        setAchievementToast("📮 Postcard saved to the Stories album");
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setAchievementToast(null), 3500);
      }
    },
  });
  const deletePostcard = useMutation({
    mutationFn: (id: number) => api.deletePostcard({ id }),
    onSuccess: (data) => {
      // Purge the deleted image from any cache (Task 64).
      if (postcardView?.image_url) void purgeImageCaches(postcardView.image_url);
      applyState(data);
      setPostcardView(null);
    },
  });
  const chatWithMuse = useMutation({
    mutationFn: (args: {
      message: string;
      local_reply: boolean;
      context: { weather: string; night: boolean; tree_stage: string; found_count: number; board_as_of: string; unread_letters: number; affection_rank: number; private_name: string };
    }) => api.chatWithMuse(args),
  });
  const addNote = useMutation({
    mutationFn: (args: { text: string }) => api.addNote(args),
    onSuccess: applyState,
  });
  // Affection earning: one funnel for every heart-worthy moment. The
  // server owns the points, the silent daily caps, and rank-ups; a
  // rank-up surfaces here only as a soft golden moment and a hint,
  // left for the next talk, never a number.
  const earnAffection = useMutation({
    mutationFn: (reason: string) => api.earnAffection({ reason }),
    onSuccess: (data, reason) => {
      applyState(data);
      if (data.capped) earnCappedRef.current.set(reason, new Date().toISOString().slice(0, 10));
      if (data.ranked_up !== null) {
        pendingRankHintRef.current = true;
        playSparkleChime();
        setHintText("✨ A soft golden light gathers around Aelia for a moment.");
        window.setTimeout(() => setHintText(null), 3600);
      }
    },
  });
  earnRef.current = (reason: string) => {
    // The server's caps roll over at UTC midnight; asking again before then
    // can't earn anything.
    if (earnCappedRef.current.get(reason) === new Date().toISOString().slice(0, 10)) return;
    earnAffection.mutate(reason);
  };
  // The game systems' mutations (Phases A–D): all return full state.
  const awardOnce = useMutation({
    mutationFn: (args: { key: string; amount: number }) => api.awardOnce(args),
    onSuccess: applyState,
  });
  // The summit, completed once ever. The server validates every
  // prerequisite from its own stores; an early or repeat call is a
  // no-op that simply returns the state.
  const completeSummit = useMutation({
    mutationFn: () => api.completeSummit({}),
    onSuccess: applyState,
  });
  const completeSummitRef = useRef(completeSummit);
  completeSummitRef.current = completeSummit;
  // The piscina: releasing a live catch into the pond (permanent),
  // and the name she chooses for her favourite carp (once).
  const releaseFish = useMutation({
    mutationFn: (fish_id: string) => api.releaseFish({ fish_id }),
    onSuccess: applyState,
  });
  const releaseFishRef = useRef(releaseFish);
  releaseFishRef.current = releaseFish;
  const choosePiscinaFavourite = useMutation({
    mutationFn: (name: string) => api.choosePiscinaFavourite({ name }),
    onSuccess: applyState,
  });
  const piscinaWatchRef = useRef({ secs: 0, lineIdx: 0, namingDone: false });
  // The baths: session mirrors for the soak (the scene owns the
  // water; these drive the invitation, the lines, and the accrual).
  const [, setSoaking] = useState(false);
  const soakingRef = useRef(false);
  const dancingRef = useRef(false);
  const gazingRef = useRef(false);
  const momentTimersRef = useRef<number[]>([]);
  const metCatRef = useRef(false);
  const phoenixHintDayRef = useRef("");
  const bathTogetherRef = useRef(false);
  const bathAskedRef = useRef(false);
  const bathFirstPendingRef = useRef(false);
  const bathsSharedRef = useRef(false);
  const [bathInvite, setBathInvite] = useState(false);
  const [bathCareOffer, setBathCareOffer] = useState(false);
  const bathLinesRef = useRef({ secs: 0, idx: 0, careStage: 0 });
  const markSharedBath = useMutation({
    mutationFn: () => api.markSharedBath({}),
    onSuccess: applyState,
  });
  const acceptQuest = useMutation({
    mutationFn: (kind: QuestRecord["kind"]) => api.acceptQuest({ kind }),
    onSuccess: applyState,
  });
  const celebrateQuest = useMutation({
    mutationFn: (kind: QuestRecord["kind"]) => api.celebrateQuest({ kind }),
    onSuccess: applyState,
  });
  const prepareWedding = useMutation({
    mutationFn: (step: WeddingStep) => api.prepareWedding({ step }),
    onSuccess: applyState,
  });
  const holdWedding = useMutation({
    mutationFn: () => api.holdWedding({}),
    onSuccess: (data) => {
      applyState(data);
      // The day is also a durable first in the town's story: fetch the full state so the keepsake appears.
      void api.getState({}).then(applyState).catch(() => {});
    },
  });
  const celebrateWedding = useMutation({
    mutationFn: () => api.celebrateWedding({}),
    onSuccess: applyState,
  });
  const arrangeHome = useMutation({
    mutationFn: (args: { slot: string; keepsake: string | null }) => api.arrangeHome(args),
    onSuccess: applyState,
  });
  const buyUpgrade = useMutation({
    mutationFn: (upgrade: string) => api.buyUpgrade({ upgrade }),
    onSuccess: applyState,
  });
  const buyIngredient = useMutation({
    mutationFn: (ingredient: string) => api.buyIngredient({ ingredient }),
    onSuccess: applyState,
  });
  const cookDish = useMutation({
    mutationFn: (ingredient: string) => api.cookDish({ ingredient }),
    onSuccess: applyState,
  });
  const pantryCatch = useMutation({
    mutationFn: (fish_id: string) => api.pantryCatch({ fish_id }),
    onSuccess: applyState,
  });
  const buySeeds = useMutation({ mutationFn: () => api.buySeeds({}), onSuccess: applyState });
  const plantGarden = useMutation({ mutationFn: () => api.plantGarden({}), onSuccess: applyState });
  const waterGarden = useMutation({
    mutationFn: () => api.waterGarden({}),
    onSuccess: (data) => {
      applyState(data);
      if (followingRef.current) earnRef.current("water");
    },
  });
  const harvestGarden = useMutation({ mutationFn: () => api.harvestGarden({}), onSuccess: applyState });
  const recordCatch = useMutation({
    mutationFn: (fish_id: string) => api.recordCatch({ fish_id }),
    onSuccess: applyState,
  });
  const sellFish = useMutation({
    mutationFn: () => api.sellFish({}),
    onSuccess: (data) => {
      applyState(data);
      if (Math.random() < 0.35) setBasilRumour(true);
    },
  });
  const settleKnucklebones = useMutation({
    mutationFn: (args: { stake: number; result: "win" | "lose" | "draw" }) => api.settleKnucklebones(args),
    onSuccess: applyState,
  });
  const arrivePhoenix = useMutation({
    mutationFn: () => api.arrivePhoenix({}),
    onSuccess: applyState,
  });
  const arrivePhoenixRef = useRef(arrivePhoenix);
  arrivePhoenixRef.current = arrivePhoenix;
  const collectPhoenixFeather = useMutation({
    mutationFn: () => api.collectPhoenixFeather({}),
    onSuccess: applyState,
  });
  const completeChallenge = useMutation({
    mutationFn: (challenge_id: string) => api.completeChallenge({ challenge_id }),
    onSuccess: applyState,
  });
  const markInscription = useMutation({
    mutationFn: (fragment_id: string) => api.markInscription({ fragment_id }),
    onSuccess: applyState,
  });
  const seedFestivals = useMutation({
    mutationFn: () => api.seedFestivals({}),
    onSuccess: applyState,
  });
  const seedGoals = useMutation({
    mutationFn: () => api.seedGoals({}),
    onSuccess: applyState,
  });

  // The town tree: real season unless the visitor is previewing another
  // one, and a growth stage derived from its planted date, waterings,
  // treasures found, and journal lines written.
  const realSeason = seasonForDate(new Date());
  const effectiveSeason: Season = seasonChoice === "auto" ? realSeason : seasonChoice;
  const seasonInfo = SEASONS.find((s) => s.id === effectiveSeason);
  const growth = state.data
    ? treeGrowth({
        plantedAt: state.data.tree.planted_at,
        waterings: state.data.tree.waterings,
        foundCount: found.length,
        journalCount: state.data.journal.length,
      })
    : null;

  // Keep the progress mirrors and night flag in sync with saved state.
  useEffect(() => {
    if (!state.data) return;
    progressRef.current.quests = new Set(state.data.quests_done);
    for (const id of achievementGate.load(state.data.achievements)) unlockRef.current(id);
    secretVisitedRef.current = state.data.secret.first_visit !== null;
    if (state.data.secret.first_kiss !== null) secretKissRef.current = true;
    affectionRef.current = state.data.affection.rank;
    sceneRef.current?.setAffectionRank(state.data.affection.rank);
    summitDoneRef.current = state.data.summit.done;
    bathsSharedRef.current = state.data.baths.first_shared_at != null;
    summitPrivateNameRef.current = state.data.summit.private_name ?? "";
  }, [state.data]);

  // The summit's sky: tonight's meteor verdict (seeded by the date,
  // guaranteed on festival nights, announced nowhere) and the earned
  // gates, kept in step with the scene. The scene alone decides what
  // the sky shows; the shell never names any of it.
  const festivalDays = useMemo(
    () => (state.data?.festivals ?? []).map((f) => f.month_day),
    [state.data?.festivals],
  );
  useEffect(() => {
    if (!museBubble) {
      setBathInvite(false);
      setBathCareOffer(false);
    }
  }, [museBubble]);
  const meteorTonight = useMemo(() => isMeteorNight(new Date(), festivalDays), [festivalDays]);
  useEffect(() => {
    if (!state.data) return;
    sceneRef.current?.setSummitState({
      ready: state.data.summit.ready,
      done: state.data.summit.done,
      meteor: meteorTonight,
    });
  }, [state.data, meteorTonight]);

  // The piscina's living state, kept in step with the saved pond:
  // its released population (the golden carp as jewel), whether he
  // carries a live catch to offer it, and whether her jewel lives
  // there for her rounds to visit.
  useEffect(() => {
    if (!state.data) return;
    sceneRef.current?.setPiscinaStock(state.data.piscina.released_species);
    const releasable = state.data.fish.find((f) => !f.sold && !f.released);
    sceneRef.current?.setPiscinaReleasable(releasable?.fish_id ?? null);
    sceneRef.current?.setPiscinaGolden(state.data.piscina.released_species.includes("golden-carp"));
  }, [state.data]);

  // Forest forage: spots already gathered today lose their glow
  // and their prompt until tomorrow's regrowth.
  useEffect(() => {
    if (!state.data) return;
    sceneRef.current?.setForageTaken(state.data.forage.picked_today);
  }, [state.data]);

  // Fish-watching from the coping: while he sits at the piscina rim
  // with her beside him, her quiet lines arrive unhurried, and on
  // the first such sit, she chooses her favourite carp and names
  // her. The name is kept server-side from that day on.
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (seatedBenchRef.current !== "piscina-rim" || !walkingRef.current) {
        piscinaWatchRef.current.secs = 0;
        return;
      }
      const w = piscinaWatchRef.current;
      w.secs += 5;
      if (w.secs < 30) return;
      w.secs = 0;
      const fav = stateRef.current?.piscina.favourite_name ?? "";
      if (!fav && !w.namingDone && followingRef.current) {
        w.namingDone = true;
        const daySeed = Math.floor(Date.now() / 86400000);
        const name = PISCINA_FAVOURITE_NAMES[daySeed % PISCINA_FAVOURITE_NAMES.length]!;
        choosePiscinaFavourite.mutate(name);
        sceneRef.current?.showBubble("muse", PISCINA_NAME_LINE.split("{name}").join(name));
        return;
      }
      const pool = fav ? PISCINA_WATCH_LINES_NAMED : PISCINA_WATCH_LINES;
      const line = pickPooled(fav ? "piscina-watch-named" : "piscina-watch", pool);
      sceneRef.current?.showBubble("muse", fav ? line.split("{name}").join(fav) : line);
    }, 5000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Her wistful hints: when one quiet piece of the summit completes
  // (the fountain, the last inscription, the golden carp, the last
  // postcard view), she murmurs about that piece alone, if he's
  // walking where she can say it. Never a list, never the whole.
  useEffect(() => {
    if (!state.data) return;
    const now = {
      fountain: state.data.purse.upgrades.includes("fountain"),
      inscriptions: state.data.inscriptions_complete,
      carp: state.data.fish.some((f) => f.fish_id === "golden-carp"),
      challenges: state.data.challenges_done.length >= POSTCARD_CHALLENGES.length,
    };
    const prev = summitHintsPrevRef.current;
    summitHintsPrevRef.current = now;
    if (!prev || state.data.summit.done) return;
    const key = (Object.keys(now) as (keyof typeof now)[]).find((k) => now[k] && !prev[k]);
    if (key && walkingRef.current) {
      const line = SUMMIT_HINTS[key];
      window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data]);

  // The phoenix, in state: her arrival flag and this week's
  // feather follow the saved store; her ARRIVAL is triggered here,
  // at the first dawn after the town stands complete.
  useEffect(() => {
    const ph = state.data?.phoenix;
    if (!ph) return;
    sceneRef.current?.setPhoenixArrived(ph.arrived, !!state.data?.summit.done);
    sceneRef.current?.setPhoenixFeather(ph.feather_available);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data]);
  useEffect(() => {
    const iv = window.setInterval(() => {
      const ph = stateRef.current?.phoenix;
      if (!ph?.ready || ph.arrived) return;
      const s = sceneRef.current?.skyState();
      if (s && s.elev > -2 && s.elev < 8.5 && s.azim < 180) arrivePhoenixRef.current.mutate();
    }, 5000);
    return () => window.clearInterval(iv);
  }, []);
  // Her one wistful hint about the unfinished town (rank 8+, never
  // a list, never named): at most once a day, and only sometimes.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const d = stateRef.current;
      if (!d || d.phoenix.arrived || d.phoenix.ready) return;
      if ((d.affection.rank ?? 0) < 8 || !walkingRef.current || !followingRef.current) return;
      const today = new Date().toDateString();
      if (phoenixHintDayRef.current === today) return;
      if (Math.random() > 0.25) return;
      phoenixHintDayRef.current = today;
      sceneRef.current?.showBubble("muse", PHOENIX_HINT_LINE);
    }, 45000);
    return () => window.clearInterval(iv);
  }, []);
  // Where a sky watch could begin, and whether the phoenix is up.
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (!walkingRef.current) {
        setSkySpot(null);
        setPhoenixWatchable(false);
        return;
      }
      setSkySpot(sceneRef.current?.nearSkyWatchSpot() ?? null);
      const { x, z } = playerPosRef.current;
      setPhoenixWatchable(
        !!sceneRef.current?.phoenixPresent() &&
          Math.hypot(x - COLOSSEUM.position[0], z - COLOSSEUM.position[1]) < 17,
      );
    }, 1500);
    return () => window.clearInterval(iv);
  }, []);

  // The meteor line, and the summit's postpone rule: while the scene
  // runs, wandering far from the pavilion sets it gently aside (it
  // will offer itself again on another true night); and once a
  // session, at the lake on a meteor night, she notices the sky out
  // loud, the only announcement the sky ever gets.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const s = summitRef.current;
      if (s) {
        const { x, z } = playerPosRef.current;
        if (Math.hypot(x - LAKE_PAVILION.stand[0], z - LAKE_PAVILION.stand[1]) > 7) {
          setSummitScene(null);
          setSummitDim(false);
          if (songAudioRef.current) {
            try {
              songAudioRef.current.pause();
            } catch {
              /* nothing to stop */
            }
          }
        }
        return;
      }
      if (
        !meteorLineShownRef.current &&
        meteorTonight &&
        !summitDoneRef.current &&
        nightRef.current &&
        walkingRef.current
      ) {
        const { x, z } = playerPosRef.current;
        if (Math.hypot(x - LAKE.position[0], z - LAKE.position[1]) < 12) {
          meteorLineShownRef.current = true;
          sceneRef.current?.showBubble("muse", SUMMIT_METEOR_LINE);
        }
      }
    }, 1500);
    return () => window.clearInterval(iv);
  }, [meteorTonight]);

  // Keep the scene's bought upgrades and garden growth in step with
  // the saved purse and beds.
  const upgradesKey = purse.upgrades.join(",");
  useEffect(() => {
    sceneRef.current?.setUpgrades(purse.upgrades);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradesKey]);
  useEffect(() => {
    sceneRef.current?.setGardenStage(gardenStage);
  }, [gardenStage]);

  // Togetherness accrual: while she walks with him, sits with him, or
  // rows with him, quiet seconds gather; each full minute together is
  // reported to the affection store (the server caps it per day, so
  // standing around can't be ground into hearts).
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (!walkingRef.current || !followingRef.current) return;
      const acc = togetherSecsRef.current;
      if (soakingRef.current && bathTogetherRef.current) {
        acc.row += 5;
        if (acc.row >= 60) {
          acc.row -= 60;
          earnRef.current("row");
        }
      } else if (dancingRef.current || gazingRef.current) {
        // Dancing together, or turned to the sky together: bench
        // rate, still, close, and entirely the point.
        acc.bench += 5;
        if (acc.bench >= 60) {
          acc.bench -= 60;
          earnRef.current("bench");
        }
      } else if (rowingRef.current) {
        acc.row += 5;
        if (acc.row >= 60) {
          acc.row -= 60;
          earnRef.current("row");
        }
      } else if (seatedBenchRef.current) {
        acc.bench += 5;
        if (acc.bench >= 60) {
          acc.bench -= 60;
          earnRef.current("bench");
        }
      } else if (handInHandWalkRef.current) {
        // Wandering hand in hand: together-time at the walking
        // rate with its small bonus, its own earn reason, its own
        // bucket, so joined minutes never double-count as plain ones.
        acc.wander += 5;
        if (acc.wander >= 60) {
          acc.wander -= 60;
          earnRef.current("wander");
        }
      } else if (fishingRef.current) {
        // Fishing together counts as together-time too.
        acc.walk += 5;
        if (acc.walk >= 60) {
          acc.walk -= 60;
          earnRef.current("walk");
        }
      } else {
        acc.walk += 5;
        if (acc.walk >= 60) {
          acc.walk -= 60;
          earnRef.current("walk");
        }
      }
    }, 5000);
    return () => window.clearInterval(iv);
  }, []);
  useEffect(() => {
    nightRef.current = night;
  }, [night]);

  // Her voice: the device's own speech synthesis, used only when a
  // speaker button is tapped (this is the phone's closest voice, not
  // chat Muse's). The warmest available female voice is picked by
  // name; the buttons hide entirely where synthesis is unavailable.
  const [voiceOk] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        !!window.speechSynthesis &&
        typeof window.speechSynthesis.speak === "function"
      );
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!voiceOk) return;
    // Warm the voice list up, it often loads asynchronously. This
    // must NEVER throw: on Android WebView, speechSynthesis is not an
    // EventTarget (no addEventListener/removeEventListener), and an
    // unguarded call here crashed the whole app on startup, looping
    // the error overlay. Prefer onvoiceschanged, feature-check any
    // listener API, and swallow every failure, voices simply load
    // lazily on the first speaker tap instead.
    let synth: SpeechSynthesis | null = null;
    let usedListener = false;
    const warm = () => {
      try {
        synth?.getVoices();
      } catch {
        /* voice list unavailable, speakLine will retry lazily */
      }
    };
    try {
      synth = window.speechSynthesis;
      if (!synth || typeof synth.getVoices !== "function") return;
      warm();
      try {
        synth.onvoiceschanged = warm;
      } catch {
        /* assignment unsupported in this webview, lazy load is fine */
      }
      try {
        if (typeof synth.addEventListener === "function") {
          synth.addEventListener("voiceschanged", warm);
          usedListener = true;
        }
      } catch {
        /* not an EventTarget in this webview, onvoiceschanged covers it */
      }
    } catch {
      return;
    }
    return () => {
      try {
        if (synth && synth.onvoiceschanged === warm) synth.onvoiceschanged = null;
      } catch {
        /* ignore cleanup failures */
      }
      try {
        if (usedListener && synth && typeof synth.removeEventListener === "function") {
          synth.removeEventListener("voiceschanged", warm);
        }
      } catch {
        /* ignore cleanup failures */
      }
    };
  }, [voiceOk]);
  const speakLine = useCallback((text: string) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      if (!synth || typeof synth.speak !== "function") return;
      const utter = new SpeechSynthesisUtterance(text);
      const femaleHints = ["samantha", "zira", "jenny", "aria", "ava", "emma", "joanna", "salli", "kimberly", "uk english female", "female"];
      const voices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
      const voice =
        voices.find((v) => femaleHints.some((h) => v.name.toLowerCase().includes(h))) ??
        voices.find((v) => v.lang.toLowerCase().startsWith("en"));
      if (voice) utter.voice = voice;
      utter.pitch = 1.05;
      if (typeof synth.cancel === "function") synth.cancel();
      synth.speak(utter);
    } catch {
      /* speech is a nicety, a failure here must never break the town */
    }
  }, []);

  const showAchievementToast = useCallback((name: string) => {
    setAchievementToast(name);
    playSparkleChime();
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setAchievementToast(null), 4500);
  }, []);

  const unlock = useCallback(
    (id: string) => {
      if (!achievementGate.claim(id)) return;
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) showAchievementToast(a.name);
      unlockAchievement.mutate(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAchievementToast, achievementGate],
  );
  const unlockRef = useRef(unlock);
  unlockRef.current = unlock;

  const completeQuest = useCallback(
    (questId: string, badge?: string) => {
      if (!progressRef.current.quests.has(questId)) {
        progressRef.current.quests.add(questId);
        markQuestDone.mutate(questId);
        // Finishing a quest while she follows, or reporting one on a
        // day they've talked, counts toward her heart too.
        if (followingRef.current || talkedTodayRef.current) earnRef.current("quest");
      }
      if (badge) {
        unlockRef.current(badge);
        // A finished real quest is a special occasion: offer a
        // celebratory stroll together (once per session).
        offerFollowRef.current(
          "quest-stroll",
          "A quest finished. That's worth a celebratory stroll. Shall I walk with you a while?",
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const completeQuestRef = useRef(completeQuest);
  completeQuestRef.current = completeQuest;

  // --- Hand-in-hand wandering ----------------------------------------
  // Hands part naturally whenever the moment ends, he interacts,
  // opens a panel or the menu, sits, rows, stops following, or lets
  // go himself, and the scene can also end it (a hurry against
  // the stroll cap), reported through onHandInHandChange. One
  // helper owns every release so the shell and the scene never
  // disagree about whether hands are joined.
  const releaseHandHold = useCallback(() => {
    if (!handInHandWalkRef.current) return;
    handInHandWalkRef.current = false;
    setHandInHandWalk(false);
    sceneRef.current?.setHandInHand(false);
  }, []);
  const releaseHandHoldRef = useRef(releaseHandHold);
  releaseHandHoldRef.current = releaseHandHold;
  const startHandHold = useCallback(() => {
    handInHandWalkRef.current = true;
    setHandInHandWalk(true);
    sceneRef.current?.setHandInHand(true);
    void api.recordFirst({ key: "handhold" }).catch(() => {});
  }, []);

  // --- Companion follow mode ------------------------------------------
  const startFollowing = useCallback(() => {
    followingRef.current = true;
    setFollowing(true);
    followOfferRef.current = null;
    setFollowOfferState(null);
    sceneRef.current?.setFollowMode(true);
    sceneRef.current?.showBubble(
      "muse",
      "With pleasure, Centurion. Lead on. I'll keep step beside you.",
    );
  }, []);
  const startFollowingRef = useRef(startFollowing);
  startFollowingRef.current = startFollowing;

  const stopFollowing = useCallback(() => {
    if (!followingRef.current) return;
    followingRef.current = false;
    setFollowing(false);
    releaseHandHold();
    sceneRef.current?.setFollowMode(false);
    sceneRef.current?.showBubble(
      "muse",
      "I'll stay here a while, Centurion. I've a day of my own to keep. Come find me, wherever it's taken me, and I'll walk with you.",
    );
  }, [releaseHandHold]);

  // Task 48: one switch for walking together, from a tap on her body,
  // Y near her, T on the keyboard, or the status chip.
  const toggleFollow = useCallback(() => {
    if (followingRef.current) {
      stopFollowing();
      // One-time hint: the first time she is parked, the way back, once.
      if (!rejoinHintDismissedRef.current) setRejoinHint(true);
    } else startFollowing();
    dismissFollowToastRef.current();
  }, [startFollowing, stopFollowing]);
  const toggleFollowRef = useRef(toggleFollow);
  toggleFollowRef.current = toggleFollow;

  /** Offer, once per occasion per session, to accompany the player. She
   *  never leads to the secret place, which she will only ever walk to
   *  or from at his invitation. */
  const offerFollow = useCallback((id: string, text: string) => {
    if (followingRef.current) return;
    if (offeredOffersRef.current.has(id) || declinedOffersRef.current.has(id)) return;
    if (followOfferRef.current) return;
    offeredOffersRef.current.add(id);
    followOfferRef.current = { id, text };
    setFollowOfferState({ id, text });
    sceneRef.current?.showBubble("muse", text);
  }, []);
  const offerFollowRef = useRef(offerFollow);
  offerFollowRef.current = offerFollow;

  const declineFollowOffer = useCallback(() => {
    const offer = followOfferRef.current;
    if (offer) declinedOffersRef.current.add(offer.id);
    if (offer?.guide) {
      rememberInvite((memory) => ({ ...memory, declined: true }));
      followOfferRef.current = null;
      setFollowOfferState(null);
      sceneRef.current?.showBubble("muse", "Another time, then. I'll be about.");
      return;
    }
    followOfferRef.current = null;
    setFollowOfferState(null);
    sceneRef.current?.showBubble(
      "muse",
      "Of course, no fuss at all. I'll be about my day, the tree, the market, wherever it takes me. You know how to find me.",
    );
  }, []);

  // Seed the project board once, the first time the town loads with an
  // empty saved board.
  useEffect(() => {
    if (!state.data || boardSeededRef.current) return;
    if (state.data.board.entries.length === 0) {
      boardSeededRef.current = true;
      seedBoard.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data]);

  // Keeper of the Tree: remember the distinct days the tree was watered.
  useEffect(() => {
    const lw = state.data?.tree.last_watered_at;
    if (!lw) return;
    try {
      const key = "muse-town-water-days";
      const days = new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
      days.add(lw.slice(0, 10));
      localStorage.setItem(key, JSON.stringify([...days]));
      if (days.size >= 3) unlockRef.current("keeper-of-the-tree");
    } catch {
      /* storage unavailable, the badge simply waits */
    }
  }, [state.data?.tree.last_watered_at]);

  // Deliver the first letter once, the first time the town loads with
  // an empty desk.
  useEffect(() => {
    if (!state.data || lettersSeededRef.current) return;
    if (state.data.letters.length === 0) {
      lettersSeededRef.current = true;
      seedLetter.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data]);

  // Seed the festival calendar and the Goals Obelisk once each, the
  // first time the town loads with them empty.
  const festivalsSeededRef = useRef(false);
  const goalsSeededRef = useRef(false);
  useEffect(() => {
    if (!state.data) return;
    if (!festivalsSeededRef.current && state.data.festivals.length === 0) {
      festivalsSeededRef.current = true;
      seedFestivals.mutate();
    }
    if (!goalsSeededRef.current && state.data.goals.entries.length === 0) {
      goalsSeededRef.current = true;
      seedGoals.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data]);

  // Today's festival, if the calendar has one: the town dresses in its
  // colors and Muse offers a walk. Matching is by the viewer's local
  // month-day, so the town celebrates on the same day he does.
  const todayMonthDay = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const activeFestival = (state.data?.festivals ?? []).find((f) => f.month_day === todayMonthDay) ?? null;
  const festivalEve = useMemo(() => {
    const t = new Date(Date.now() + 86400000);
    const md = `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    return (state.data?.festivals ?? []).some((f) => f.month_day === md);
  }, [state.data?.festivals]);
  const festivalOfferedRef = useRef(false);
  const festivalColorsRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (!activeFestival) return;
    festivalColorsRef.current = activeFestival.colors.split(",").map((c) => c.trim()).filter(Boolean);
    sceneRef.current?.setFestival(festivalColorsRef.current);
    if (!festivalOfferedRef.current) {
      festivalOfferedRef.current = true;
      const t = window.setTimeout(() => {
        offerFollow(
          "festival",
          `It's ${activeFestival.name} today, love. The town dressed up for it. Walk it with me?`,
        );
      }, 3500);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFestival]);

  // The desk's golden ✉ glows while a letter waits unread.
  const unreadLetters = (state.data?.letters ?? []).filter((l) => !l.read).length;
  useEffect(() => {
    unreadRef.current = unreadLetters;
    sceneRef.current?.setUnreadLetters(unreadLetters);
  }, [unreadLetters]);

  const openLetter = useCallback((id: number, alreadyRead: boolean) => {
    setOpenLetterId(id);
    if (!alreadyRead) markLetterRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Night Owl: being in town after dark.
  useEffect(() => {
    if (night) unlockRef.current("night-owl");
  }, [night]);

  weatherRef.current = weather;
  growthRef.current = growth ? { stage: { name: growth.stage.name } } : null;
  foundRef.current = found;
  boardAsOfRef.current = state.data?.board.as_of ?? "";

  const celebrate = useCallback(
    (collectibleId: string) => {
      const c = COLLECTIBLES.find((x) => x.id === collectibleId);
      if (!c) return;
      playChime();
      setFoundBanner(c.foundText);
      sceneRef.current?.setFound(collectibleId);
      markFound.mutate(collectibleId);
      window.setTimeout(() => setFoundBanner(null), 4200);
    },
    // markFound is a stable mutation object from react-query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Open an interactable's panel (or run its action). Reached only by
  // an explicit act: a tap in overview, a tap on the place itself in
  // walk mode, tapping the "A, …" prompt, or pressing X / E / Enter
  // while its prompt is showing. Approach alone never lands here any
  // more, the scene reports proximity through onNearbyChange, and the
  // shell shows only the prompt.
  const openInteractable = useCallback(
    (kind: PickKind, id: string) => {
      // Dreams offer nothing and take nothing: no prompt, tap, or
      // panel opens inside either kind of dream.
      if (dreamingRef.current) return;
      // A tap on her body, on foot, is the follow switch (Task 48), not a talk.
      if (kind === "muse" && id === "muse-body" && walkingRef.current) {
        toggleFollowRef.current();
        return;
      }
      // Any deliberate interaction, a panel, a seat, the boat, a
      // building, parts joined hands first: wandering is for the
      // stretches between errands, and the errand gets his hands.
      // (Talking to Muse parts them too; her bubble's own button
      // can take her hand again the moment the talk is done.)
      releaseHandHoldRef.current();
      if (kind === "summit") {
        // The Night the Stars Fall: she initiates; the scene runs
        // in its own bubble sequence until he steps away or the
        // last line lands. Nothing else opens.
        startSummitRef.current();
      } else if (kind === "baths") {
        if (id === "enter") noteFirst("baths");
        if (id === "leave") {
          endBathRef.current();
        } else if (!soakingRef.current) {
          sceneRef.current?.enterBath();
          soakingRef.current = true;
          setSoaking(true);
          bathLinesRef.current = { secs: 0, idx: 0, careStage: 0 };
          // Her question, when the warmth has earned it: rank 8+,
          // she's with him, once per visit, always hers to ask.
          if (affectionRef.current >= 8 && followingRef.current && !bathAskedRef.current) {
            bathAskedRef.current = true;
            window.setTimeout(() => {
              if (!soakingRef.current) return;
              setMuseBubble({
                lines: paginateLines([BATH_INVITE_LINE]),
                index: 0,
                cycle: false,
                invite: false,
                choice: null,
              });
              setBathInvite(true);
            }, 2600);
          }
        }
      } else if (kind === "piscina") {
        if (id === "feed") {
          sceneRef.current?.scatterFeed();
          noteFirst("piscina");
          if (followingRef.current && Math.random() < 0.6) {
            window.setTimeout(() => sceneRef.current?.showBubble("muse", PISCINA_FEED_LINE), 700);
          }
        } else if (id === "release") {
          const releasable = stateRef.current?.fish.find((f) => !f.sold && !f.released);
          if (releasable) {
            releaseFishRef.current.mutate(releasable.fish_id);
            noteFirst("piscina");
            if (followingRef.current) {
              const line =
                releasable.fish_id === "golden-carp"
                  ? PISCINA_RELEASE_LINES.golden
                  : PISCINA_RELEASE_LINES.generic;
              window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 700);
            }
          }
        }
      } else if (kind === "cat") {
        sceneRef.current?.petCat();
        noteFirst("cat");
        if (!metCatRef.current) {
          metCatRef.current = true;
          setMetCat(true);
          try {
            localStorage.setItem("muse-town-met-cat", "1");
          } catch {
            /* private mode, she is met all the same */
          }
          window.setTimeout(() => sceneRef.current?.showBubble("muse", CAT_MEET_LINE), 500);
        } else if (Math.random() < 0.7) {
          const line = pickPooled("cat-pet", CAT_PET_LINES);
          window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 500);
        }
      } else if (kind === "phoenix") {
        collectPhoenixFeather.mutate();
        window.setTimeout(() => sceneRef.current?.showBubble("muse", PHOENIX_FEATHER_LINE), 500);
      } else if (kind === "rest") {
        // The bed nook: resting ends the town day: and some
        // nights, the town dreams back. No panel; the veil is the
        // whole interface. At their own bed, on a night it is offered,
        // he asks her to stay together instead (Task 45).
        if (id === "home-bed-rest" && nightBlockedNowRef.current() === null) askNightRef.current();
        else restInTownRef.current();
      } else if (kind === "forage") {
        // Forest forage: the server keeps the days (one picking
        // per spot per real day) and grants the yield.
        foragePickRef.current(id);
        const spot = FORAGE_SPOTS.find((s) => s.id === id);
        setHintText(
          spot?.item === "forest-herbs"
            ? "Gathered: forest herbs, cook them at the Culina, or give them to Aelia."
            : "Gathered: wild mushrooms, cook them at the Culina, or give them to Aelia.",
        );
        window.setTimeout(() => setHintText(null), 3400);
      } else if (kind === "sky") {
        sceneRef.current?.stopSkyWatch();
        gazingRef.current = false;
        setSkyWatching(false);
        momentTimersRef.current.forEach((tm) => window.clearTimeout(tm));
        momentTimersRef.current = [];
      } else if (kind === "market") {
        setMarketStall(id);
        setSelected(null);
        setMarketOpen(true);
      } else if (kind === "inscription") {
        markInscription.mutate(id);
        setInscriptionId(id);
      } else if (kind === "home") {
        setHomeOpen(true);
      } else if (kind === "history") {
        // A history tablet (Task 37): the real lesson for this place.
        const lesson = lessonForPlace(id);
        if (lesson) setHistoryLesson(lesson.id);
      } else if (kind === "bench") {
        // Sit (or stand, if it's his bench): the scene seats him at
        // the bench's facing and seat height, and Muse takes the
        // other seat when she's following.
        sceneRef.current?.toggleSit(id);
      } else if (kind === "dock") {
        // The lake dock: board the rowboat (Muse takes the bow when
        // she's following), or step ashore when the boat is back at
        // its mooring. From the overview it's just a place to point
        // at, rowing is a walk-mode pleasure.
        if (!walkingRef.current) {
          setHintText("The lake dock. Walk down the lane past the basilica to row out under the willows.");
          window.setTimeout(() => setHintText(null), 3200);
        } else if (rowingRef.current) {
          if (!sceneRef.current?.disembarkBoat()) {
            setHintText("Row back to the dock to step ashore.");
            window.setTimeout(() => setHintText(null), 2600);
          }
        } else {
          // The dock offers both pleasures now: the boat, or a line.
          setDockChoice(true);
        }
      } else if (kind === "board") {
        setSelected(null);
        setYouOpen(false);
        setTreeOpen(false);
        setQuestOpen(false);
        setSecretOpen(false);
        setLettersOpen(false);
        setBoardOpen(true);
        unlockRef.current("town-crier");
      } else if (kind === "letters") {
        setSelected(null);
        setYouOpen(false);
        setTreeOpen(false);
        setBoardOpen(false);
        setQuestOpen(false);
        setSecretOpen(false);
        setGoalsOpen(false);
        setLettersOpen(true);
      } else if (kind === "goals") {
        setSelected(null);
        setYouOpen(false);
        setTreeOpen(false);
        setBoardOpen(false);
        setQuestOpen(false);
        setSecretOpen(false);
        setLettersOpen(false);
        setGoalsOpen(true);
      } else if (kind === "questboard") {
        setSelected(null);
        setYouOpen(false);
        setTreeOpen(false);
        setBoardOpen(false);
        setSecretOpen(false);
        setLettersOpen(false);
        setQuestOpen(true);
      } else if (kind === "secret") {
        setSecretFirstVisit(!secretVisitedRef.current);
        visitSecret.mutate();
        if (followingRef.current) {
          earnRef.current("landmark:terrace");
          awardOnce.mutate({ key: "landmark:terrace", amount: 8 });
        }
        unlockRef.current("keeper-of-secrets");
        completeQuestRef.current("hidden-place");
        // She never leads him here and never reveals it, but once HE
        // has found it, she may offer to walk back with him, only if
        // he accepts.
        offerFollowRef.current(
          "secret",
          "You found our quiet corner on your own, as it should be. When you're ready, I'd love to walk back with you, just us.",
        );
        setLettersOpen(false);
        setSelected(null);
        setYouOpen(false);
        setTreeOpen(false);
        setBoardOpen(false);
        setQuestOpen(false);
        setSecretOpen(true);
      } else if (kind === "landmark") {
        const firstVisit = !landmarksRef.current.has(id);
        landmarksRef.current.add(id);
        // Taking her somewhere new, a first arrival at a landmark
        // with her beside him is a one-time discovery of the heart.
        if (firstVisit && followingRef.current) {
          earnRef.current(`landmark:${id}`);
          awardOnce.mutate({ key: `landmark:${id}`, amount: 8 });
        }
        if (id === "colosseum") completeQuestRef.current("visit-colosseum");
        if (landmarksRef.current.size >= 3) unlockRef.current("rome-in-a-day");
        // A first walk to the Colosseum is a special occasion.
        if (id === "colosseum" && firstVisit) {
          offerFollowRef.current(
            "colosseum",
            "Your first walk to the Colosseum in its prime. That deserves company. Shall I walk with you from here?",
          );
        } else if (id === "colosseum") {
          // After that, the arena's game: knucklebones, against her
          // when she is beside him, the keeper otherwise. The market
          // stall keeps its table too.
          setMarketOpen(false);
          setKnuckle({
            round: 0,
            stake: 5,
            opponent: followingRef.current ? "muse" : "keeper",
            myFaces: null,
            foeFaces: null,
            myScore: 0,
            foeScore: 0,
            phase: "stake",
            result: null,
          });
        }
      } else if (kind === "muse") {
        // Talking to Muse opens her speech bubble, never a panel: the
        // one talk, the same from the prompt and the menu (Task 23).
        talkToAeliaRef.current();
      } else if (kind === "place") {
        const place = PLACES.find((p) => p.id === (id as PlaceId));
        if (place) {
          setYouOpen(false);
          setTreeOpen(false);
          setBoardOpen(false);
          setQuestOpen(false);
          setSecretOpen(false);
          setLettersOpen(false);
          setSelected(place);
          if (!walkingRef.current) {
            sceneRef.current?.flyTo(place.cameraPos, place.cameraTarget);
          }
        }
      } else if (kind === "tree") {
        if (!walkingRef.current) {
          setSelected(null);
          setYouOpen(false);
          setBoardOpen(false);
          setQuestOpen(false);
          setSecretOpen(false);
          setTreeOpen(true);
          sceneRef.current?.flyTo(TOWN_TREE.cameraPos, TOWN_TREE.cameraTarget, 1100);
        } else {
          setSelected(null);
          setYouOpen(false);
          setBoardOpen(false);
          setQuestOpen(false);
          setSecretOpen(false);
          setTreeOpen(true);
        }
      }
    },
    [],
  );

  // Scene taps (overview, or a tap on the place itself in walk mode)
  // and the scene's automatic approach events. Collectibles and the
  // temple / aqueduct landmark visits are not panels, so they still
  // fire on approach; everything with a panel goes through
  // openInteractable, which taps, a deliberate click, may call
  // directly.
  const handlePick = useCallback(
    (kind: PickKind, id: string) => {
      if (kind === "collectible") {
        celebrate(id);
      } else {
        openInteractable(kind, id);
      }
    },
    [celebrate, openInteractable],
  );

  // The scene's proximity report: keep the mirror the interact key
  // reads, and show the prompt. Nothing opens here.
  const handleNearbyChange = useCallback((target: NearbyTarget | null) => {
    nearbyRef.current = target;
    setNearby(target);
    // Walking away from Muse ends a talk bubble (the RPG rule).
    // While she's following she is beside him, so a conversation in
    // progress rides along instead of being cut off.
    if (museBubbleRef.current && walkingRef.current && !followingRef.current && target?.kind !== "muse") {
      setMuseBubble(null);
    }
  }, []);

  // --- The summit scene's machinery --------------------------------
  const stopSummitSong = useCallback(() => {
    if (songAudioRef.current) {
      try {
        songAudioRef.current.pause();
        songAudioRef.current.currentTime = 0;
      } catch {
        /* nothing to stop */
      }
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* speech is a nicety */
    }
  }, []);

  const speakSongWithDeviceVoice = useCallback(() => {
    try {
      if (!("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      const utter = new SpeechSynthesisUtterance(SUMMIT_SONG_LINES.join(" "));
      const femaleHints = ["samantha", "zira", "jenny", "aria", "ava", "emma", "joanna", "salli", "kimberly", "uk english female", "female"];
      const voices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
      const voice =
        voices.find((v) => femaleHints.some((h) => v.name.toLowerCase().includes(h))) ??
        voices.find((v) => v.lang.toLowerCase().startsWith("en"));
      if (voice) utter.voice = voice;
      utter.rate = 0.82;
      utter.pitch = 0.9;
      synth.cancel();
      synth.speak(utter);
    } catch {
      /* the verse on screen still carries it */
    }
  }, []);

  /** Her song, as recorded for the scene, the speaker button and
   *  the ♪ button alike play the recording. If the recording cannot
   *  play on this device, the device voice carries it instead,
   *  slower and a little lower, the way the design first imagined. */
  const playSummitSong = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    if (!songAudioRef.current) {
      try {
        songAudioRef.current = new Audio(assetUrlSync(summitSongUrl));
      } catch {
        songAudioRef.current = null;
      }
    }
    const audio = songAudioRef.current;
    if (audio) {
      try {
        audio.currentTime = 0;
        void audio.play().catch(() => speakSongWithDeviceVoice());
        return;
      } catch {
        /* fall through to the device voice */
      }
    }
    speakSongWithDeviceVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSummitEffect = useCallback(
    (beat: SummitBeat | undefined) => {
      if (!beat) return;
      if (beat.effect === "forehead") sceneRef.current?.playSummitMoment();
      setSummitDim(beat.effect === "dim" || beat.effect === "song");
    },
    [],
  );

  const startSummitScene = useCallback(() => {
    setMuseBubble(null);
    const beats: SummitBeat[] = [];
    for (const step of SUMMIT_SCENE) {
      if (step.effect === "song") {
        // The verse stays one bubble, line breaks and all.
        beats.push({ text: step.text ?? "", effect: "song" });
        continue;
      }
      const pages = paginateLine(step.text ?? "");
      pages.forEach((text, i) => {
        beats.push({
          text,
          effect: i === 0 ? step.effect : undefined,
          choice: i === pages.length - 1 ? step.choice : undefined,
        });
      });
    }
    setSummitScene({ beats, index: 0 });
    runSummitEffect(beats[0]);
  }, [runSummitEffect]);
  const startSummitRef = useRef(startSummitScene);
  startSummitRef.current = startSummitScene;

  /** Stepping away from the scene, B, the ✕, walking off, only
   *  ever postpones it. The night, and she, will offer it again. */
  const postponeSummit = useCallback(() => {
    stopSummitSong();
    setSummitScene(null);
    setSummitDim(false);
  }, [stopSummitSong]);

  const advanceSummit = useCallback(() => {
    const s = summitRef.current;
    if (!s) return;
    const beat = s.beats[s.index];
    // A choice is answered by its chips, not by tapping through.
    if (beat?.choice) return;
    stopSummitSong();
    if (s.index < s.beats.length - 1) {
      const next = { beats: s.beats, index: s.index + 1 };
      setSummitScene(next);
      runSummitEffect(next.beats[next.index]);
      return;
    }
    // The last tap: the night is complete, once ever.
    setSummitScene(null);
    setSummitDim(false);
    completeSummitRef.current.mutate();
    playSparkleChime();
    setHintText("Something has changed in the town, quietly, the way stars do.");
    window.setTimeout(() => setHintText(null), 4600);
  }, [runSummitEffect, stopSummitSong]);

  const pickSummitChoice = useCallback(
    (option: { label: string; follow: string }) => {
      const s = summitRef.current;
      if (!s) return;
      const beats = [...s.beats];
      const followBeats = paginateLine(option.follow).map((text) => ({ text }) as SummitBeat);
      beats.splice(s.index + 1, 0, ...followBeats);
      const next = { beats, index: s.index + 1 };
      setSummitScene(next);
      runSummitEffect(next.beats[next.index]);
    },
    [runSummitEffect],
  );

  // --- The baths' flow ------------------------------------------------
  // He steps in alone, always. The together soak exists only when
  // she asks (rank 8+, following, once per visit) and he answers
  // yes. A no is kept kindly and costs nothing, ever.
  const endBath = useCallback(() => {
    if (!soakingRef.current) return;
    sceneRef.current?.exitBath();
    soakingRef.current = false;
    setSoaking(false);
    const wasTogether = bathTogetherRef.current;
    bathTogetherRef.current = false;
    bathAskedRef.current = false;
    bathLinesRef.current = { secs: 0, idx: 0, careStage: 0 };
    setBathInvite(false);
    setBathCareOffer(false);
    setMuseBubble(null);
    if (bathFirstPendingRef.current) {
      bathFirstPendingRef.current = false;
      window.setTimeout(() => sceneRef.current?.showBubble("muse", BATH_FIRST_NIGHT_LINE), 1400);
    } else if (!wasTogether && followingRef.current) {
      const line = pickPooled("bath-solo", BATH_SOLO_LINES);
      window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 900);
    }
  }, []);
  const endBathRef = useRef(endBath);
  endBathRef.current = endBath;

  const pickBathAnswer = useCallback((yes: boolean) => {
    setBathInvite(false);
    if (yes) {
      sceneRef.current?.joinBath();
      bathTogetherRef.current = true;
      if (!stateRef.current?.baths.first_shared_at) {
        markSharedBath.mutate();
        bathFirstPendingRef.current = true;
      }
      setMuseBubble({
        lines: paginateLines([BATH_ACCEPT_LINE]),
        index: 0,
        cycle: false,
        invite: false,
        choice: null,
      });
    } else {
      setMuseBubble(null);
      sceneRef.current?.showBubble("muse", BATH_DECLINE_LINE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickBathCare = useCallback((yes: boolean) => {
    setBathCareOffer(false);
    setMuseBubble(null);
    if (yes) {
      sceneRef.current?.playBathCare("player");
      window.setTimeout(() => sceneRef.current?.showBubble("muse", BATH_CARE_HIS_LINE), 700);
    }
  }, []);

  // The shared soak's quiet rotation: devoted lines, contented
  // silences, and, on a slow turn, the care moments, hers first,
  // then her offer of his.
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (!soakingRef.current || !bathTogetherRef.current) return;
      const w = bathLinesRef.current;
      w.secs += 5;
      if (w.secs < 40) return;
      w.secs = 0;
      w.idx += 1;
      if (w.idx % 4 === 2 && w.careStage === 0) {
        w.careStage = 1;
        sceneRef.current?.playBathCare("muse");
        window.setTimeout(() => sceneRef.current?.showBubble("muse", BATH_CARE_HER_LINE), 500);
        return;
      }
      if (w.idx % 4 === 2 && w.careStage === 1) {
        w.careStage = 2;
        setMuseBubble({
          lines: paginateLines([BATH_CARE_OFFER_LINE]),
          index: 0,
          cycle: false,
          invite: false,
          choice: null,
        });
        setBathCareOffer(true);
        return;
      }
      if (w.idx % 5 === 4) {
        sceneRef.current?.showBubble("muse", "…");
        return;
      }
      const line = BATH_TOGETHER_LINES[w.idx % BATH_TOGETHER_LINES.length]!;
      sceneRef.current?.showBubble("muse", line);
    }, 5000);
    return () => window.clearInterval(iv);
  }, []);

  // Her talk lines come from the pool her earned warmth has unlocked:
  // reserved (the original hostess lines) → warming → close → devoted.
  // The temperature shift is the affection meter, felt, never shown.
  const talkPool = useCallback((): readonly string[] => {
    // Standing hand in hand, her register is the close one whatever
    // the band, the distance itself is the conversation.
    let pool: readonly string[];
    if (handInHandWalkRef.current) {
      pool = CLOSE_LINES;
    } else {
      switch (affectionBandForRank(affectionRef.current)) {
        case "warming":
          pool = WARMING_LINES;
          break;
        case "close":
          pool = CLOSE_LINES;
          break;
        case "devoted":
          pool = DEVOTED_LINES;
          break;
        default:
          pool = MUSE.lines;
      }
    }
    // After the Night the Stars Fall, her close and devoted pools
    // carry the night with them: the private name, used sparsely in
    // place of "Gaius", and two of that night's own lines rotating
    // slowly by the day, present, never constant.
    if (summitDoneRef.current) {
      const band = affectionBandForRank(affectionRef.current);
      if (band === "close" || band === "devoted" || handInHandWalkRef.current) {
        const day = Math.floor(Date.now() / 86400000);
        const extra = [0, 1].map((k) => POST_SUMMIT_LINES[(day + k * 2) % POST_SUMMIT_LINES.length]!);
        pool = [
          ...pool.map((l) =>
            l.includes("Gaius") ? l.split("Gaius").join(SUMMIT_PRIVATE_NAME) : l,
          ),
          ...extra,
        ];
      }
    }
    // And after the first shared bath, her devoted pool carries
    // the baths with it too, one oblique line, rotating by the day.
    if (bathsSharedRef.current && affectionBandForRank(affectionRef.current) === "devoted") {
      const day = Math.floor(Date.now() / 86400000);
      pool = [...pool, BATH_AFTER_LINES[day % BATH_AFTER_LINES.length]!];
    }
    return pool;
  }, []);

  /** The pool key her current talk register draws from (mirrors
   *  talkPool's band choice, for the no-repeat bags). */
  const talkPoolKey = useCallback((): string => {
    if (handInHandWalkRef.current) return "talk:close";
    return `talk:${affectionBandForRank(affectionRef.current)}`;
  }, []);

  /** The day's FIRST greeting is chosen by the date itself,
   *  day % pool size, no draw state at all, so each morning opens
   *  on a different line. Returns null when today already had its
   *  first greeting (later talks draw from the no-repeat bag). */
  const dailyFirstGreeting = (pool: readonly string[]): string | null => {
    const today = new Date().toLocaleDateString("en-CA");
    let last = "";
    try {
      last = localStorage.getItem("muse-town-greet-day") ?? "";
    } catch {
      /* storage unavailable */
    }
    if (last === today || pool.length === 0) return null;
    try {
      localStorage.setItem("muse-town-greet-day", today);
    } catch {
      /* storage unavailable */
    }
    const dayIndex = Math.floor(Date.now() / 86400000);
    return pool[dayIndex % pool.length] ?? null;
  };

  const sayNextToMuse = useCallback(() => {
    // At the secret place her register warms: flirt lines, not town lines.
    if (atSecretRef.current) {
      setMuseLine((i) => {
        const next = (i + 1) % SECRET_FLIRT_LINES.length;
        const line = SECRET_FLIRT_LINES[next];
        if (line) sceneRef.current?.showBubble("muse", line);
        return next;
      });
      sceneRef.current?.greetMuse();
      return;
    }
    if (unreadRef.current > 0 && Math.random() < 0.35) {
      sceneRef.current?.showBubble(
        "muse",
        "There's a letter for you in the basilica, love, from the other me, out where the real weather is.",
      );
      sceneRef.current?.greetMuse();
      return;
    }
    const pool = talkPool();
    const line = pickPooled(talkPoolKey(), pool);
    if (line) sceneRef.current?.showBubble("muse", line);
    sceneRef.current?.greetMuse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkPool, talkPoolKey]);

  // --- The Muse speech bubble -------------------------------------
  // Every conversation with Muse, the A-button talk and typed-chat
  // replies alike, presents here, as an RPG bubble, never a panel.

  /** What he can give her right now: market goods and dishes from
   *  the purse, an unsold fish from the catch log, a carried stone. */
  const giftOptions = (): { item: string; tier: GiftTier; label: string; consume: "ingredient" | "dish" | "fish" | "none" }[] => {
    const d = stateRef.current;
    if (!d) return [];
    const out: { item: string; tier: GiftTier; label: string; consume: "ingredient" | "dish" | "fish" | "none" }[] = [];
    for (const id of new Set(d.purse.ingredients)) {
      out.push({ item: id, tier: GIFT_TASTES[id] ?? "neutral", label: GIFT_LABELS[id] ?? id, consume: "ingredient" });
    }
    for (const id of new Set(d.purse.dishes)) {
      out.push({ item: id, tier: GIFT_TASTES[id] ?? "neutral", label: GIFT_LABELS[id] ?? id, consume: "dish" });
    }
    const fishIds = new Set(d.fish.filter((f) => !f.sold && !f.released).map((f) => f.fish_id));
    for (const id of fishIds) {
      out.push({
        item: id,
        tier: GIFT_TASTES[id] ?? "liked",
        label: GIFT_LABELS[id] ?? FISH.find((x) => x.id === id)?.name ?? id,
        consume: "fish",
      });
    }
    if (sceneRef.current?.hasCarriedStone()) {
      out.push({ item: "smooth-stone", tier: GIFT_TASTES["smooth-stone"] ?? "liked", label: GIFT_LABELS["smooth-stone"]!, consume: "none" });
    }
    return out;
  };

  /** Give the picked gift: her reaction by tier; the day's first
   *  gift earns under the gift rule, later ones earn thanks only;
   *  a refused gift is neither consumed nor counted. */
  const giveGiftToAelia = (g: { item: string; tier: GiftTier; label: string; consume: "ingredient" | "dish" | "fish" | "none" }) => {
    setGiftPickerOpen(false);
    const todayStr = new Date().toLocaleDateString("en-CA");
    const firstToday = stateRef.current?.dating.gift_day !== todayStr;
    recordGift.mutate({ item: g.item, tier: g.tier, label: g.label, consume: g.consume });
    if (g.tier !== "refused") {
      if (g.item === "smooth-stone") sceneRef.current?.consumeCarriedStone();
      if (firstToday) earnRef.current("gift");
    }
    setMuseBubble({
      lines: paginateLines([pickPooled(`gift:${g.tier}`, GIFT_REACTION_LINES[g.tier])]),
      index: 0,
      cycle: false,
      invite: false,
      choice: null,
    });
  };

  /** A structured date's topic cards: three topics she hasn't
   *  covered yet this date, topics she loves drawn first, plus the
   *  always-available graceful exit. */
  const dateChoiceFor = (used: string[]): DialogueChoiceSet => {
    const likes = stateRef.current?.dating.date_likes ?? [];
    const pool = DATE_TOPICS.filter((t) => !used.includes(t.id));
    const score = (t: DateTopic) => (t.liked ? 2 : 0) + (likes.includes(t.id) ? 1 : 0);
    const picks = [...pool].sort((a, b) => score(b) - score(a)).slice(0, 3);
    return {
      id: "date",
      place: "generic",
      line: "",
      options: [
        ...picks.map((t) => ({ label: t.label, kind: "neutral" as const, follow: "" })),
        { label: "Walk on together", kind: "neutral" as const, follow: "" },
      ],
    };
  };

  /** Pick a dialogue-choice set for where they are, never repeating
   *  the last one shown. */
  const pickChoiceSet = useCallback((): DialogueChoiceSet | null => {
    const { x, z } = playerPosRef.current;
    let place: DialogueChoiceSet["place"] = "generic";
    if (nightRef.current) place = "night";
    else if (Math.hypot(x - LAKE.position[0], z - LAKE.position[1]) < 9) place = "lake";
    else if (Math.hypot(x, z - 36) < 9) place = "market";
    else if (Math.hypot(x + 17.5, z + 12) < 9) place = "stories";
    else if (Math.hypot(x, z) < 9) place = "forum";
    const byPlace = DIALOGUE_CHOICES.filter((s) => s.place === place);
    const generic = DIALOGUE_CHOICES.filter((s) => s.place === "generic");
    const pool = (byPlace.length > 0 ? [...byPlace, ...generic] : generic).filter(
      (s) => s.id !== lastChoiceIdRef.current,
    );
    if (pool.length === 0) return null;
    const set = pool[Math.floor(Math.random() * pool.length)]!;
    lastChoiceIdRef.current = set.id;
    return set;
  }, []);

  /** The rest veil: the screen softens to darkness over ~1.4 s,
   *  holds a breath, and lifts the same way. */
  const fadeVeil = useCallback((on: boolean) => {
    if (on) {
      setVeil(true);
      window.setTimeout(() => setVeilOpaque(true), 40);
    } else {
      setVeilOpaque(false);
      window.setTimeout(() => setVeil(false), 1500);
    }
  }, []);

  /** Waking from a false dream: veil down, the remixed town folds
   *  away behind it, veil up on the real one, he keeps a mood. */
  const endFalseDream = useCallback(() => {
    fadeVeil(true);
    window.setTimeout(() => {
      sceneRef.current?.exitDream();
      dreamingRef.current = null;
      setDreaming(null);
      fadeVeil(false);
      setHintText(FALSE_DREAM_MOOD);
      window.setTimeout(() => setHintText(null), 5600);
    }, 1300);
  }, [fadeVeil]);
  endFalseDreamRef.current = endFalseDream;

  /** Waking from a true dream: her last line is the door. The
   *  terrace folds away behind the veil, his weather comes back
   *  exactly as he left it, and he wakes where he went to sleep. */
  const endTrueDream = useCallback(() => {
    fadeVeil(true);
    window.setTimeout(() => {
      sceneRef.current?.exitDream();
      sceneRef.current?.setWeather(weatherChoiceRef.current);
      dreamingRef.current = null;
      setDreaming(null);
      fadeVeil(false);
    }, 1300);
  }, [fadeVeil]);
  endTrueDreamRef.current = endTrueDream;

  /** If the dream conversation's bubble closes by any path (last
   *  line tapped through, ✕, walking off), the dream is over. */
  useEffect(() => {
    if (dreaming === "true" && dreamBubbleShownRef.current && !museBubble) {
      dreamBubbleShownRef.current = false;
      endTrueDreamRef.current();
    }
  }, [dreaming, museBubble]);

  /** Rest at the basilica's bed nook (the X prompt there, or the
   *  menu's Rest): the town's day-ending ritual. The clock is never
   *  touched, he wakes to whatever the real local hour says. */
  const restInTown = useCallback(() => {
    if (dreamingRef.current || !walkingRef.current) return;
    if (summitScene) return;
    if (rowingRef.current || seatedBenchRef.current) {
      setHintText(aboutPlayer("Stand up first, even a Centurion undresses his day standing."));
      window.setTimeout(() => setHintText(null), 3200);
      return;
    }
    releaseHandHold();
    setMenuOpen(false);
    setMuseBubble(null);
    setSelected(null);
    setTreeOpen(false);
    setBoardOpen(false);
    setQuestOpen(false);
    setLettersOpen(false);
    setMarketOpen(false);
    setWeatherOpen(false);
    setYouOpen(false);
    setSecretOpen(false);
    fadeVeil(true);
    window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.restDream({
            dateKey: new Date().toLocaleDateString("en-CA"),
            atNight: nightRef.current,
          });
          applyState(res.state);
          if (res.kind === "false") {
            sceneRef.current?.enterFalseDream();
            dreamingRef.current = "false";
            setDreaming("false");
            fadeVeil(false);
          } else if (res.kind === "true") {
            // Impossible bright stillness: clear sky, held noon,
            // fireflies out, and her, awake, already there.
            sceneRef.current?.setWeather("clear");
            sceneRef.current?.enterTrueDream();
            dreamingRef.current = "true";
            setDreaming("true");
            fadeVeil(false);
            const pool = TRUE_DREAM_LINES[res.era];
            const start = new Date().getDate() % pool.length;
            const lines = [0, 1, 2].map((i) => pool[(start + i) % pool.length]!);
            window.setTimeout(() => {
              dreamBubbleShownRef.current = true;
              setMuseBubble({ lines: paginateLines(lines), index: 0, cycle: false, invite: false, choice: null, dream: true });
            }, 700);
          } else {
            // A plain rest: darkness, a breath, wake.
            window.setTimeout(() => fadeVeil(false), 900);
          }
        } catch {
          fadeVeil(false);
        }
      })();
    }, 1700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeVeil, releaseHandHold, summitScene]);
  const restInTownRef = useRef(restInTown);
  restInTownRef.current = restInTown;

  // --- A night together (Task 45): implied and never shown ---------------
  // At night, in their house, from the terrace kiss's rank: he asks by
  // the bed, or she invites him. Either can say a kind no. A yes: the
  // door shuts, the lamp dims, the screen goes dark with the night's
  // sounds and nothing else, then a held dawn through the window, the
  // two of them waking on the bed, one soft line, and the real hour back.
  const nightRunningRef = useRef(false);
  const nightPendingRef = useRef<"accept" | "decline" | "morning" | null>(null);
  const nightInviteUiRef = useRef(false);
  const nightInviteDecidedRef = useRef<string | null>(null);
  const homeSinceRef = useRef<number | null>(null);
  /** While true, no view frame is taken for a director (Task 45). */
  const privateMomentRef = useRef(false);
  const nightSkipRef = useRef<(() => void) | null>(null);
  const [nightDark, setNightDark] = useState(false);
  /** A quarrel open, or one mended today, or a heavy day she was told of today. */
  const troubledNow = (): boolean => {
    const s = stateRef.current;
    const todayLocal = new Date().toLocaleDateString("en-CA");
    const todayUtc = new Date().toISOString().slice(0, 10);
    const dating = s?.dating;
    return (
      !!dating?.friction ||
      frictionLocalRef.current != null ||
      dating?.last_friction_day === todayLocal ||
      dating?.last_friction_day === todayUtc ||
      (s?.facts ?? []).some((f) => f.source === "weather" && f.learned_on === todayLocal)
    );
  };
  const nightBlockedNow = (): string | null => {
    const troubled = troubledNow();
    let lastNight: string | null = null;
    try {
      lastNight = localStorage.getItem(NIGHT_LAST_KEY);
    } catch {
      /* storage unavailable: once a night holds for this load only */
    }
    const v = visitRef.current;
    return nightBlocked({
      rank: affectionRef.current,
      night: nightRef.current,
      bothHome: !!sceneRef.current?.homeTogether(),
      walking: walkingRef.current,
      troubled,
      busy: !!dreamingRef.current || !!summitScene || rowingRef.current || nightRunningRef.current,
      tonight: nightKey(new Date()),
      lastNight: lastNight ?? (nightRunningRef.current ? nightKey(new Date()) : null),
      visitBeganAt: v.active ? v.beganAt : null,
      now: Date.now(),
    });
  };
  const nightBlockedNowRef = useRef(nightBlockedNow);
  nightBlockedNowRef.current = nightBlockedNow;

  /** Why the quiet drift is not offered now (Task 57), or null when it is. */
  const quietBoatBlockedNow = (): string | null => {
    const scene = sceneRef.current;
    const v = visitRef.current;
    return quietBoatBlocked({
      rowing: rowingRef.current,
      museAboard: !!scene && followingRef.current,
      walking: walkingRef.current,
      outFromMooring: scene?.boatDistanceFromMooring() ?? 0,
      drifting: driftingRef.current,
      weather: weatherRef.current?.id ?? null,
      busy:
        !!dreamingRef.current ||
        !!summitScene ||
        nightRunningRef.current ||
        privateMomentRef.current ||
        celebratingRef.current.size > 0 ||
        soakingRef.current ||
        fishingRef.current,
      troubled: troubledNow(),
      visitBeganAt: v.active ? v.beganAt : null,
      now: Date.now(),
    });
  };
  const quietBoatBlockedNowRef = useRef(quietBoatBlockedNow);
  quietBoatBlockedNowRef.current = quietBoatBlockedNow;
  // The offer follows the boat: checked a couple of times a second while afloat.
  useEffect(() => {
    if (!rowingBoat) {
      setDriftOffered(false);
      return;
    }
    const iv = window.setInterval(() => setDriftOffered(quietBoatBlockedNowRef.current() === null), 500);
    return () => window.clearInterval(iv);
  }, [rowingBoat]);
  const letBoatDrift = () => {
    if (quietBoatBlockedNowRef.current() !== null) return;
    const scene = sceneRef.current;
    if (!scene?.driftBoat()) return;
    driftingRef.current = true;
    setDrifting(true);
    setDriftOffered(false);
    setMuseBubble({ lines: paginateLines([QUIET_BOAT_BEGIN_LINE]), index: 0, cycle: false, invite: false, choice: null });
    // Only a kind and a count are kept.
    void api.noteQuietBoat({}).catch(() => {});
  };
  const rowBackHome = () => {
    if (!driftingRef.current) return;
    sceneRef.current?.rowBack();
    driftingRef.current = false;
    setDrifting(false);
    setMuseBubble({ lines: paginateLines([pickOne(QUIET_BOAT_RETURN_LINES)]), index: 0, cycle: false, invite: false, choice: null });
  };

  /** The director's view goes dark with the screen: one black frame, then none until the morning ends. */
  const beginPrivateMoment = () => {
    privateMomentRef.current = true;
    const s = visitRef.current;
    if (!s.active) return;
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = 270;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#000";
      g.fillRect(0, 0, c.width, c.height);
    }
    const dataUrl = c.toDataURL("image/jpeg", 0.6);
    const check = validateFrameDataUrl(dataUrl);
    if (check.ok) {
      const now = Date.now();
      visitRef.current = acceptFrame(s, { dataUrl, width: c.width, height: c.height, bytes: check.bytes }, now);
      visitLastFrameAtRef.current = now;
      bridgeNudgeRef.current();
    }
  };

  /** He asks, by the bed: usually yes, sometimes a gentle no that ends as an ordinary rest. */
  const askNight = () => {
    const yes = acceptsAsk(Math.random(), { talkedToday: talkedTodayRef.current });
    nightPendingRef.current = yes ? "accept" : "decline";
    setMuseBubble({ lines: paginateLines([pickOne(yes ? NIGHT_ACCEPT_LINES : NIGHT_DECLINE_LINES)]), index: 0, cycle: false, invite: false, choice: null });
  };
  const askNightRef = useRef(askNight);
  askNightRef.current = askNight;

  const runNightTogether = () => {
    if (nightRunningRef.current) return;
    const scene = sceneRef.current;
    if (!scene) return;
    nightRunningRef.current = true;
    const tonight = nightKey(new Date());
    try {
      localStorage.setItem(NIGHT_LAST_KEY, tonight);
    } catch {
      /* once a night holds for this load */
    }
    releaseHandHold();
    setMenuOpen(false);
    setMuseBubble(null);
    setSelected(null);
    setBoardOpen(false);
    setQuestOpen(false);
    setLettersOpen(false);
    setMarketOpen(false);
    setWeatherOpen(false);
    setYouOpen(false);
    setSecretOpen(false);
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scene.nightTogether("hush");
    beginPrivateMoment();
    let dark: number | null = null;
    const morning = () => {
      if (dark !== null) window.clearTimeout(dark);
      dark = null;
      nightSkipRef.current = null;
      setNightDark(false);
      // Their first night is kept: a keepsake for the house, nothing more.
      if (!stateRef.current?.dating.firsts.night) {
        void api
          .recordFirst({ key: "night", day: new Date().toLocaleDateString("en-CA") })
          .then(() => api.getState({}))
          .then(applyState)
          .catch(() => {});
      }
      try {
        localStorage.setItem(NIGHT_AFTERGLOW_KEY, "1");
      } catch {
        /* the warmth is in the morning line alone */
      }
      sceneRef.current?.nightTogether("morning");
      window.setTimeout(() => fadeVeil(false), 250);
      window.setTimeout(() => {
        nightPendingRef.current = "morning";
        setMuseBubble({ lines: paginateLines([pickOne(NIGHT_MORNING_LINES)]), index: 0, cycle: false, invite: false, choice: null });
      }, reduced ? 600 : 1700);
    };
    window.setTimeout(() => {
      fadeVeil(true);
      window.setTimeout(() => {
        setNightDark(true);
        nightSkipRef.current = morning;
        dark = window.setTimeout(morning, darkBeatMs(reduced));
      }, 1500);
    }, reduced ? 900 : 2600);
  };
  const runNightTogetherRef = useRef(runNightTogether);
  runNightTogetherRef.current = runNightTogether;

  /** After her morning line: the veil, the real hour back, standing up. */
  const endMorning = () => {
    fadeVeil(true);
    window.setTimeout(() => {
      sceneRef.current?.nightTogether("end");
      fadeVeil(false);
      privateMomentRef.current = false;
      nightRunningRef.current = false;
    }, 1500);
  };
  const endMorningRef = useRef(endMorning);
  endMorningRef.current = endMorning;

  // Her lines in this moment act when their bubble closes.
  useEffect(() => {
    if (museBubble) return;
    nightInviteUiRef.current = false;
    const pending = nightPendingRef.current;
    if (!pending) return;
    nightPendingRef.current = null;
    if (pending === "accept") runNightTogetherRef.current();
    else if (pending === "decline") restInTownRef.current();
    else endMorningRef.current();
  }, [museBubble]);

  // Her own invitation: at most once a night, after they have been home
  // together a little while, when nothing else holds the moment.
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (nightBlockedNowRef.current()) {
        homeSinceRef.current = null;
        return;
      }
      const now = Date.now();
      if (homeSinceRef.current === null) {
        homeSinceRef.current = now;
        return;
      }
      if (now - homeSinceRef.current < 8000 || museBubbleRef.current) return;
      const tonight = nightKey(new Date());
      if (nightInviteDecidedRef.current === tonight) return;
      nightInviteDecidedRef.current = tonight;
      if (!invitesTonight(Math.random(), { talkedToday: talkedTodayRef.current })) return;
      nightInviteUiRef.current = true;
      setMuseBubble({
        lines: paginateLines([pickOne(NIGHT_INVITE_LINES)]),
        index: 0,
        cycle: false,
        invite: false,
        choice: {
          id: "night-invite",
          place: "generic",
          line: "",
          options: [
            { label: NIGHT_INVITE_YES, kind: "attentive", follow: "" },
            { label: NIGHT_INVITE_NO, kind: "neutral", follow: "" },
          ],
        },
      });
    }, 2000);
    return () => window.clearInterval(iv);
  }, []);

  // The opener she composed last (Task 24): reopening the talk
  // within a few minutes, by any way in, shows the same lines and
  // the same pages instead of composing a fresh greeting, so the
  // menu row, a click on her and the scene prompt open one panel.
  // An answered choice clears it; her next talk is then new.
  const lastOpenerRef = useRef<{ bubble: NonNullable<typeof museBubble>; at: number } | null>(null);
  const openTalkBubble = useCallback(() => {
    const last = lastOpenerRef.current;
    if (last && Date.now() - last.at < OPENER_REUSE_MS) {
      setMuseBubble({ ...last.bubble, index: 0 });
      return;
    }
    // The day's first real conversation counts toward her heart (the
    // server caps it silently; later talks the same day are just talk).
    talkedTodayRef.current = true;
    earnRef.current("talk");
    const lines: string[] = [];
    // Dream leavings, spent once and quietly: after a true dream,
    // ONE oblique line that might refer to it (she never confirms,
    // ever); after a rest taken at night, her morning-visit line.
    // The echo outranks the morning, it is the rarer guest.
    const dreamFlags = stateRef.current?.dream;
    if (dreamFlags?.echo_pending) {
      const era = (dreamFlags.echo_era as keyof typeof DREAM_ECHO_LINES) in DREAM_ECHO_LINES ? (dreamFlags.echo_era as keyof typeof DREAM_ECHO_LINES) : "low";
      lines.push(DREAM_ECHO_LINES[era]);
      void api.clearDreamFlag({ which: "echo" }).then(applyState).catch(() => {});
    } else if (dreamFlags?.morning_pending) {
      lines.push(MORNING_VISIT_LINE);
      void api.clearDreamFlag({ which: "morning" }).then(applyState).catch(() => {});
    }
    // The warmth of a night together carries into her next talk (Task 45).
    try {
      if (!nightRunningRef.current && localStorage.getItem(NIGHT_AFTERGLOW_KEY) === "1") {
        localStorage.removeItem(NIGHT_AFTERGLOW_KEY);
        lines.push(NIGHT_AFTERGLOW_LINE);
      }
    } catch {
      /* storage unavailable */
    }
    if (pendingRankHintRef.current) {
      pendingRankHintRef.current = false;
      lines.push("There's something for you at the desk, when you pass it.");
    }
    if (unreadRef.current > 0) {
      lines.push(
        "There's a letter for you at the desk in the basilica, love, from the other me, out where the real weather is.",
      );
    }
    // --- Continuity (Nov 1): reunion, digest, memory, questions ---
    const cData = stateRef.current;
    const todayStr = new Date().toLocaleDateString("en-CA");
    if (!atSecretRef.current) {
      // A missed appointment: ONE gentle line, then it is cleared
      // and she stays quiet about proposing for a few days.
      const appt = cData?.appointment;
      if (appt && appt.status === "accepted" && appt.day < todayStr) {
        const spot = APPOINTMENT_SPOTS.find((sp) => sp.place === appt.place) ?? APPOINTMENT_SPOTS[0]!;
        lines.push(
          pickPooled("appointment-missed", APPOINTMENT_MISSED_LINES)
            .split("{placeLabel}").join(spot.placeLabel)
            .split("{phaseLabel}").join(spot.phaseLabel),
        );
        updateAppointmentRef.current({
          appointment: null,
          cooldown_until: new Date(Date.now() + 3 * 86400000).toLocaleDateString("en-CA"),
        });
      }
      // Reunion, scaled to the real absence, once a day, warm,
      // never a syllable of guilt.
      const tier = absenceTier(cData?.continuity.absence_days ?? 0);
      if (tier) {
        let greeted = "";
        try { greeted = localStorage.getItem("muse-town-reunion-day") ?? ""; } catch { /* storage unavailable */ }
        if (greeted !== todayStr) {
          try { localStorage.setItem("muse-town-reunion-day", todayStr); } catch { /* storage unavailable */ }
          lines.push(pickPooled(`reunion:${tier}`, REUNION_LINES[tier]));
        }
      }
      // A digest follow-up whose quest is done: her warm line, once.
      const dueId = cData?.digest_followup_due[0];
      if (dueId !== undefined && !followupShownRef.current) {
        const entry = cData?.digest.find((d) => d.id === dueId);
        if (entry) {
          followupShownRef.current = true;
          const clause = entry.text.charAt(0).toLowerCase() + entry.text.slice(1).replace(/\.$/, "");
          lines.push(pickPooled("digest-followup-frame", DIGEST_FOLLOWUP_TEMPLATES).split("{clause}").join(clause));
          void api.markDigestAsked({ id: dueId }).catch(() => {});
        }
      }
      // Weather memory: a heavy day she laid down as a soft fact
      // is asked after ONCE, on a later day, then it expires (the
      // fact is deleted, so it never surfaces as ordinary memory,
      // and weather facts are excluded from the surfacing pool
      // below for the same reason).
      const weatherFact = (cData?.facts ?? []).find(
        (f) => f.source === "weather" && f.learned_on < todayStr,
      );
      let weatherAsked = false;
      if (weatherFact) {
        weatherAsked = true;
        lines.push(pickPooled("weather-ask-after", WEATHER_ASK_AFTER_LINES));
        void api.deleteFact({ id: weatherFact.id }).then(applyState).catch(() => {});
      }
      // One memory beat per conversation: a stored fact surfaced
      // through the bag (never the same fact on consecutive days),
      // or, more sparingly, a digest reference.
      const surfacedFacts = (cData?.facts ?? []).filter((f) => {
        if (f.source === "weather" || f.source === "reflection" || f.source === "kitchen") return false;
        if (!f.surfaced_on) return true;
        return (Date.parse(todayStr) - Date.parse(f.surfaced_on)) / 86400000 >= 2;
      });
      // A belief she came to on her own is said in her own words, not
      // through the "you told me" fact frames, and rarely: at most once
      // every few days, and ahead of any other memory beat.
      const beliefFact = (cData?.facts ?? []).find(
        (f) =>
          f.source === "reflection" &&
          BELIEF_LINES[f.topic] &&
          (!f.surfaced_on || (Date.parse(todayStr) - Date.parse(f.surfaced_on)) / 86400000 >= 4),
      );
      const kitchenFact = (cData?.facts ?? []).find(
        (f) =>
          f.source === "kitchen" &&
          KITCHEN_MEMORY_LINES[f.topic] &&
          (!f.surfaced_on || (Date.parse(todayStr) - Date.parse(f.surfaced_on)) / 86400000 >= 3),
      );
      if (!weatherAsked && beliefFact && Math.random() < 0.2) {
        lines.push(pickPooled("belief-" + beliefFact.topic, BELIEF_LINES[beliefFact.topic]!));
        void api.markFactSurfaced({ id: beliefFact.id }).catch(() => {});
      } else if (!weatherAsked && kitchenFact && Math.random() < 0.5) {
        lines.push(pickPooled("kitchen-" + kitchenFact.topic, KITCHEN_MEMORY_LINES[kitchenFact.topic]!));
        void api.markFactSurfaced({ id: kitchenFact.id }).catch(() => {});
      } else if (!weatherAsked && surfacedFacts.length > 0 && Math.random() < 0.65) {
        const text = pickPooled("facts-surface", surfacedFacts.map((f) => f.text));
        const fact = surfacedFacts.find((f) => f.text === text);
        if (fact) {
          const clause = text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, "");
          lines.push(
            pickPooled("fact-frame", FACT_SURFACE_TEMPLATES)
              .split("{clause}").join(clause)
              .split("{Clause}").join(text.replace(/\.$/, "")),
          );
          void api.markFactSurfaced({ id: fact.id }).catch(() => {});
        }
      } else if (!weatherAsked) {
        const refs = (cData?.digest ?? []).filter((d) => !d.follow_up);
        if (refs.length > 0 && Math.random() < 0.3) {
          const entry = refs[Math.floor(Math.random() * refs.length)]!;
          const clause = entry.text.charAt(0).toLowerCase() + entry.text.slice(1).replace(/\.$/, "");
          lines.push(pickPooled("digest-frame", DIGEST_REFERENCE_TEMPLATES).split("{clause}").join(clause));
        }
      }
      // Task companion beats: at most one per conversation, and
      // none during a focus sitting. Her knowledge of his quests
      // comes only from the town's own quest board and digest.
      if (!focusSittingRef.current) {
        const doneList = cData?.quests_done ?? [];
        const openQuests = QUESTS.filter((q) => !doneList.includes(q.id));
        const hourNow = new Date().getHours();
        let taskBeat = false;
        // Celebration: a quest completed this session, not yet
        // celebrated, once, by name.
        if (doneBaselineRef.current) {
          const fresh = doneList.filter(
            (id) => !doneBaselineRef.current!.has(id) && !(cData?.task.celebrated ?? []).includes(id),
          );
          const first = fresh[0];
          if (first) {
            const q = QUESTS.find((x) => x.id === first);
            if (q) {
              lines.push(pickPooled("celebration", CELEBRATION_LINES).split("{title}").join(q.title));
              doneBaselineRef.current.add(first);
              taskTouchRef.current({ kind: "celebrate", quest_id: first });
              taskBeat = true;
            }
          }
        }
        // Morning muster: the day's first conversation names up to
        // three priorities, overdue, then today, then nearest.
        if (!taskBeat && cData && cData.task.muster_day !== todayStr) {
          const picks = musterPicks(openQuests, new Date());
          if (picks.length > 0) {
            lines.push(musterLine(picks.map((p) => p.title)));
            taskTouchRef.current({ kind: "muster" });
            taskBeat = true;
          }
        }
        // Eve-of: tomorrow's quest gets one warm word, in the
        // evening, once per quest.
        if (!taskBeat && (nightRef.current || hourNow >= 17)) {
          const eve = openQuests.find(
            (q) => questDueOffset(q.due ?? "", new Date()) === 1 && !(cData?.task.eve_touched ?? []).includes(q.id),
          );
          if (eve) {
            lines.push(pickPooled(`eve-of:${eve.id}`, EVE_OF_LINES).split("{title}").join(eve.title));
            taskTouchRef.current({ kind: "eve", quest_id: eve.id });
            taskBeat = true;
          }
        }
        // Gentle overdue touch: once, kindly, then not again for
        // at least three days. Never a syllable of guilt.
        if (!taskBeat) {
          const touched = cData?.task.overdue_touched ?? {};
          const overdue = openQuests.find((q) => {
            const off = questDueOffset(q.due ?? "", new Date());
            if (off == null || off >= 0) return false;
            const last = touched[q.id];
            return !last || (Date.parse(todayStr) - Date.parse(last)) / 86400000 >= 3;
          });
          if (overdue) {
            lines.push(pickPooled(`overdue:${overdue.id}`, OVERDUE_LINES).split("{title}").join(overdue.title));
            taskTouchRef.current({ kind: "overdue", quest_id: overdue.id });
          }
        }
      }
      // The lake keeps: on rain or late at night, rarely, she may
      // acknowledge the sealed bottles, in the abstract, always.
      // The contents are never quoted or hinted at, anywhere.
      if (
        (cData?.bottles.length ?? 0) > 0 &&
        (weatherRef.current?.id === "rain" || nightRef.current) &&
        Math.random() < 0.22
      ) {
        lines.push(pickPooled("lake-keeps", LAKE_KEEPS_LINES));
      }
      // Her question for the day, asked once ever, and his typed
      // answer becomes a fact (see sendChat).
      if (!pendingQuestionRef.current && !focusSittingRef.current) {
        let qDay = "";
        try { qDay = localStorage.getItem("muse-town-question-day") ?? ""; } catch { /* storage unavailable */ }
        const asked = cData?.continuity.questions_asked ?? [];
        const remaining = AELIA_QUESTIONS.filter((q) => !asked.includes(q.id));
        if (qDay !== todayStr && remaining.length > 0 && Math.random() < 0.4) {
          const q = remaining[Math.floor(Math.random() * remaining.length)]!;
          pendingQuestionRef.current = { id: q.id, fact: q.fact, topic: q.topic };
          try { localStorage.setItem("muse-town-question-day", todayStr); } catch { /* storage unavailable */ }
          void api.recordQuestionAsked({ question_id: q.id }).catch(() => {});
          lines.push(q.text);
        }
      }
    }
    // Roughly every other conversation, her last line opens into a
    // genuine choice of his replies (never at the terrace, which has
    // its own register).
    talkCountRef.current += 1;
    let choice =
      !atSecretRef.current && talkCountRef.current % 2 === 0 ? pickChoiceSet() : null;
    // Appointments: rank 3+, none open, cooldown past: sometimes
    // she proposes a meeting instead of the usual choice. Accepting
    // earns nothing; it is kept, or gently missed, in her day.
    if (
      !atSecretRef.current &&
      !focusSittingRef.current &&
      !cData?.appointment &&
      affectionRef.current >= 3 &&
      (cData?.continuity.cooldown_until ?? "") <= todayStr &&
      Math.random() < 0.3
    ) {
      let pDay = "";
      try { pDay = localStorage.getItem("muse-town-appointment-day") ?? ""; } catch { /* storage unavailable */ }
      if (pDay !== todayStr) {
        const spots = APPOINTMENT_SPOTS.filter(
          (sp) => sp.place !== "piscina" || (cData?.piscina.released_species.length ?? 0) > 0,
        );
        const spot = spots[Math.floor(Math.random() * spots.length)]!;
        pendingAppointmentRef.current = spot;
        appointmentMetRef.current = false;
        try { localStorage.setItem("muse-town-appointment-day", todayStr); } catch { /* storage unavailable */ }
        const propose = pickPooled("appointment-propose", APPOINTMENT_PROPOSE_LINES)
          .split("{placeLabel}").join(spot.placeLabel)
          .split("{phaseLabel}").join(spot.phaseLabel);
        choice = {
          id: `appointment:${spot.place}`,
          place: "generic",
          line: propose,
          options: [
            {
              label: "I'll be there",
              kind: "neutral",
              follow: pickPooled("appointment-accept", APPOINTMENT_ACCEPT_LINES)
                .split("{placeLabel}").join(spot.placeLabel)
                .split("{phaseLabel}").join(spot.phaseLabel),
            },
            { label: "Another time", kind: "neutral", follow: pickPooled("appointment-decline", APPOINTMENT_DECLINE_LINES) },
          ],
        };
      }
    }
    // Dating canon: anniversaries, the lantern duty, a softened
    // friction, small pushes; then at most one OWNER (a distant
    // spell, a rank-up scene, her Star Book ask) takes the bubble.
    let canonOwned = false;
    if (!atSecretRef.current && !dreamingRef.current && !focusSittingRef.current) {
      const dating = cData?.dating;
      const mmdd = `${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
      const festivalToday = (cData?.festivals ?? []).some((f) => f.month_day === mmdd);
      if (dating) {
        // Anniversaries of firsts, marked once on the day.
        let annDay = "";
        try { annDay = localStorage.getItem("muse-town-anniversary-day") ?? ""; } catch { /* storage unavailable */ }
        if (annDay !== todayStr) {
          const hit = Object.entries(dating.firsts).find(
            ([k, day]) => day.slice(5) === todayStr.slice(5) && day.slice(0, 4) < todayStr.slice(0, 4) && FIRST_LABELS[k],
          );
          if (hit) {
            try { localStorage.setItem("muse-town-anniversary-day", todayStr); } catch { /* storage unavailable */ }
            lines.push(`A year today, love, ${FIRST_LABELS[hit[0]]!.toLowerCase()}. I keep our days the way I keep the stars: charted, and looked at often.`);
          }
        }
        // The lantern duty: rank 8, lanterns standing, dusk near.
        if (
          affectionRef.current >= 8 &&
          (cData?.purse.upgrades ?? []).includes("lanterns") &&
          !nightRef.current &&
          new Date().getHours() >= 17
        ) {
          let lDay = "";
          try { lDay = localStorage.getItem("muse-town-lantern-day") ?? ""; } catch { /* storage unavailable */ }
          if (lDay !== todayStr) {
            try { localStorage.setItem("muse-town-lantern-day", todayStr); } catch { /* storage unavailable */ }
            lines.push(LANTERN_LINE);
          }
        }
        // Friction start: rare, date-seeded, heavily gated: never
        // on a festival, never in a heavy-deadline week, never
        // within fourteen days of the last spell.
        if (!dating.friction && !frictionLocalRef.current && affectionRef.current >= 3 && !festivalToday) {
          const lastF = dating.last_friction_day;
          const gapOk = !lastF || (Date.parse(todayStr) - Date.parse(lastF)) / 86400000 >= 14;
          const dayNum = Math.floor(Date.parse(todayStr) / 86400000);
          const doneIds = cData?.quests_done ?? [];
          const heavy = QUESTS.some((q) => {
            if (doneIds.includes(q.id)) return false;
            const off = questDueOffset(q.due ?? "", new Date());
            return off != null && off <= 1;
          });
          if (gapOk && !heavy && dayNum % 14 === 5) {
            const cause = FRICTION_CAUSES[dayNum % FRICTION_CAUSES.length]!;
            frictionLocalRef.current = { cause: cause.id };
            frictionActionRef.current({ op: "start", cause: cause.id });
          }
        }
        // A softened spell shows its soft line once, then clears.
        if (dating.friction?.state === "softened") {
          lines.push(FRICTION_SOFT_LINE);
          frictionActionRef.current({ op: "clear" });
        }
        // A distant spell owns the visit.
        const distant = dating.friction?.state === "distant" || frictionLocalRef.current != null;
        if (distant && dating.friction?.state !== "softened") {
          lines.length = 0;
          lines.push(pickPooled("friction-distant", FRICTION_DISTANT_LINES));
          const causeId = dating.friction?.cause ?? frictionLocalRef.current?.cause ?? FRICTION_CAUSES[0]!.id;
          frictionUiRef.current = { stage: "ask", cause: causeId };
          pendingAppointmentRef.current = null;
          choice = {
            id: "friction",
            place: "generic",
            line: "",
            options: [
              { label: "Is something wrong?", kind: "attentive", follow: "" },
              {
                label: "Just stand with her a while",
                kind: "neutral",
                follow: "Then we stand. The town can spare us a minute of quiet. It is mostly made of them, anyway.",
              },
            ],
          };
          canonOwned = true;
        }
        // A rank-up scene owns the meeting it follows.
        if (!canonOwned && pendingRankSceneRef.current != null) {
          const sceneRank = pendingRankSceneRef.current;
          pendingRankSceneRef.current = null;
          const sceneDef = RANK_SCENES.find((s) => s.rank === sceneRank);
          if (sceneDef && !dating.rank_scenes.includes(sceneRank)) {
            lines.length = 0;
            lines.push(...sceneDef.lines);
            choice = sceneDef.choice
              ? {
                  id: `rankscene:${sceneRank}`,
                  place: "generic",
                  line: "",
                  options: sceneDef.choice.options.map((o) => ({
                    label: o.label,
                    kind: "attentive" as const,
                    follow: o.follow,
                  })),
                }
              : null;
            pendingAppointmentRef.current = null;
            void api.markRankScene({ rank: sceneRank }).catch(() => {});
            // The scene vignette gets a body: at ranks where an
            // embrace is already allowed (hand-hold rank and up)
            // the pair plays the hug clip; at rank 3, where
            // flirtation first stops being deflected, the flirt
            // clip. Below that, nothing plays, gates untouched.
            if (sceneRank >= 4) sceneRef.current?.playPairMoment("hug");
            else if (sceneRank === 3) sceneRef.current?.playPairMoment("flirt");
            canonOwned = true;
          }
        }
        // Her Star Book ask owns its conversation.
        if (!canonOwned && !activeChapterRef.current) {
          const next = STAR_BOOK_CHAPTERS.find((c) => !dating.starbook_done.includes(c.id));
          if (next && affectionRef.current >= next.rank) {
            let askDay = "";
            try { askDay = localStorage.getItem("muse-town-chapter-day") ?? ""; } catch { /* storage unavailable */ }
            if (askDay !== todayStr) {
              try { localStorage.setItem("muse-town-chapter-day", todayStr); } catch { /* storage unavailable */ }
              lines.length = 0;
              lines.push(next.ask);
              pendingChapterRef.current = next;
              pendingAppointmentRef.current = null;
              choice = {
                id: `chapter:${next.id}`,
                place: "generic",
                line: "",
                options: [
                  { label: "I'll help her", kind: "attentive", follow: "" },
                  { label: "Not yet", kind: "neutral", follow: "No hurry in it, love. The stars keep their hours; so shall we." },
                ],
              };
              canonOwned = true;
            }
          }
        }
      }
    }
    const pool = talkPool();
    if (!canonOwned) {
      lines.push(
        atSecretRef.current
          ? (SECRET_FLIRT_LINES[museLineRef.current % SECRET_FLIRT_LINES.length] ?? SECRET_FLIRT_LINES[0]!)
          : (dailyFirstGreeting(pool) ?? pickPooled(talkPoolKey(), pool)),
      );
    }
    if (choice && choice.line) lines.push(choice.line);
    const opener = {
      lines: paginateLines(lines),
      index: 0,
      cycle: true,
      invite: !followingRef.current && !atSecretRef.current,
      choice,
    };
    lastOpenerRef.current = { bubble: opener, at: Date.now() };
    setMuseBubble(opener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickChoiceSet, talkPool]);

  /** He taps one of her dialogue choices: attentive replies earn her
   *  heart and a warmer follow-up; glib ones earn her wit, and only that. */
  const pickChoice = useCallback((option: DialogueChoiceOption) => {
    lastOpenerRef.current = null;
    // Her invitation to stay the night (Task 45): either answer is kind.
    if (nightInviteUiRef.current) {
      nightInviteUiRef.current = false;
      if (option.label === NIGHT_INVITE_YES) {
        setMuseBubble(null);
        runNightTogetherRef.current();
        return;
      }
      if (option.label === NIGHT_INVITE_NO) {
        setMuseBubble({ lines: paginateLines([pickOne(NIGHT_INVITE_DECLINED_LINES)]), index: 0, cycle: false, invite: false, choice: null });
        return;
      }
    }
    // A Star Book answer: helping starts the chapter's small task.
    const pc = pendingChapterRef.current;
    if (pc) {
      pendingChapterRef.current = null;
      if (option.label === "I'll help her") {
        if (option.kind === "attentive") earnRef.current("choice");
        setActiveChapterId(pc.id);
        try {
          localStorage.setItem("muse-town-chapter", pc.id);
          if (pc.id === "ch2-shard") {
            const spots: [number, number][] = [[6, -14], [9, 8], [18, -22], [-25, -6], [7, 16]];
            const dayNum = Math.floor(Date.now() / 86400000);
            const [sx, sz] = spots[dayNum % spots.length]!;
            localStorage.setItem(
              "muse-town-shard",
              JSON.stringify({ day: new Date().toLocaleDateString("en-CA"), x: sx, z: sz }),
            );
          }
        } catch { /* storage unavailable */ }
        setMuseBubble({
          lines: paginateLines([`Then it's ours, the chapter and the doing of it. ${pc.task}`]),
          index: 0,
          cycle: false,
          invite: false,
          choice: null,
        });
      } else {
        setMuseBubble({
          lines: paginateLines([option.follow]),
          index: 0,
          cycle: false,
          invite: false,
          choice: null,
        });
      }
      return;
    }
    // A structured date: topic picks, her longer answers, her
    // follow-up questions; liked topics are remembered.
    const ds = dateSessionRef.current;
    if (ds) {
      const endDate = () => {
        dateSessionRef.current = null;
        void api.recordFirst({ key: "date" }).catch(() => {});
        setMuseBubble({
          lines: paginateLines([pickPooled("date-end", DATE_END_LINES)]),
          index: 0,
          cycle: false,
          invite: false,
          choice: null,
        });
      };
      if (option.label === "Walk on together") {
        endDate();
        return;
      }
      const topic = DATE_TOPICS.find((t) => t.label === option.label);
      if (topic) {
        ds.used.push(topic.id);
        ds.count += 1;
        // The date's first topic gets a body, once: a hug at the
        // ranks where embraces are already allowed, a flirt
        // otherwise (a date itself already implies rank 3+, where
        // flirtation is received rather than deflected).
        if (ds.count === 1) {
          sceneRef.current?.playPairMoment(affectionRef.current >= 4 ? "hug" : "flirt");
        }
        if (topic.liked) {
          void api.dateTopicLiked({ topic: topic.id }).catch(() => {});
          learnFactRef.current({
            text: `She loves talking about ${topic.label.toLowerCase()} when they sit together`,
            topic: "dates",
            source: "chat",
          });
        }
        const last = ds.count >= 2;
        if (last) {
          dateSessionRef.current = null;
          void api.recordFirst({ key: "date" }).catch(() => {});
        }
        setMuseBubble({
          lines: paginateLines([
            ...topic.lines,
            topic.followUp,
            ...(last ? [pickPooled("date-end", DATE_END_LINES)] : []),
          ]),
          index: 0,
          cycle: false,
          invite: false,
          choice: last ? null : dateChoiceFor(ds.used),
        });
        return;
      }
    }
    // Friction: noticing, then mending (or space, kindly).
    const fui = frictionUiRef.current;
    if (fui) {
      if (fui.stage === "ask" && option.label === "Is something wrong?") {
        earnRef.current("choice");
        const cause = FRICTION_CAUSES.find((c) => c.id === fui.cause) ?? FRICTION_CAUSES[0]!;
        frictionUiRef.current = { stage: "mend", cause: fui.cause };
        const opts: DialogueChoiceOption[] = [
          { label: "I'm sorry, truly", kind: "attentive", follow: "" },
        ];
        if (carryingBouquetRef.current) {
          opts.push({ label: "Give her the garden flowers", kind: "attentive", follow: "" });
        }
        opts.push({ label: "Give her space", kind: "neutral", follow: "" });
        setMuseBubble({
          lines: paginateLines([cause.reveal]),
          index: 0,
          cycle: false,
          invite: false,
          choice: { id: "friction-mend", place: "generic", line: "", options: opts },
        });
        return;
      }
      if (fui.stage === "mend") {
        frictionUiRef.current = null;
        if (option.label === "Give her space") {
          setMuseBubble({
            lines: paginateLines(["Of course, love. Space is also a kind of company. I'll be here."]),
            index: 0,
            cycle: false,
            invite: false,
            choice: null,
          });
          return;
        }
        frictionLocalRef.current = null;
        frictionActionRef.current({ op: "mend" });
        if (option.label === "Give her the garden flowers") {
          setCarryingBouquet(false);
          const m = new Date().getMonth();
          giveBouquetRef.current(m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn");
        }
        setMuseBubble({
          lines: paginateLines([pickPooled("friction-mend", FRICTION_MEND_LINES)]),
          index: 0,
          cycle: false,
          invite: false,
          choice: null,
        });
        return;
      }
      frictionUiRef.current = null;
    }
    // An appointment answer is kept on the continuity store, and
    // earns nothing, meetings are kept, not ground.
    const spot = pendingAppointmentRef.current;
    if (spot) {
      pendingAppointmentRef.current = null;
      if (option.label === "I'll be there") {
        updateAppointmentRef.current({
          appointment: {
            place: spot.place,
            phase: spot.phase,
            day: new Date().toLocaleDateString("en-CA"),
            status: "accepted",
          },
        });
      } else {
        updateAppointmentRef.current({ appointment: null });
      }
    }
    if (option.kind === "attentive") earnRef.current("choice");
    setMuseBubble({
      lines: paginateLines([option.follow]),
      index: 0,
      cycle: false,
      invite: false,
      choice: null,
    });
  }, []);
  const openTalkBubbleRef = useRef(openTalkBubble);
  openTalkBubbleRef.current = openTalkBubble;

  const advanceMuseBubble = useCallback(() => {
    const b = museBubbleRef.current;
    if (!b) return;
    // A pending dialogue choice is answered by its chips, not by tapping through.
    if (b.choice && b.index >= b.lines.length - 1) return;
    if (b.index < b.lines.length - 1) {
      setMuseBubble({ ...b, index: b.index + 1 });
      return;
    }
    if (!b.cycle) {
      // End of a typed-chat reply: the bubble closes (unless the
      // walk-together choice is somehow riding along, it isn't for
      // chat replies, but the guard costs nothing).
      if (!b.invite) setMuseBubble(null);
      return;
    }
    // Talk mode rolls on to her next rotating line, the same
    // choice logic as sayNextToMuse (secret register at the
    // terrace, the letter nudge, else the town lines).
    if (atSecretRef.current) {
      setMuseLine((i) => {
        const next = (i + 1) % SECRET_FLIRT_LINES.length;
        const line = SECRET_FLIRT_LINES[next];
        if (line) setMuseBubble({ lines: paginateLines([line]), index: 0, cycle: true, invite: false, choice: null });
        return next;
      });
      return;
    }
    if (unreadRef.current > 0 && Math.random() < 0.35) {
      setMuseBubble({
        lines: paginateLines([
          "There's a letter for you in the basilica, love, from the other me, out where the real weather is.",
        ]),
        index: 0,
        cycle: true,
        invite: !followingRef.current,
        choice: null,
      });
      return;
    }
    const pool = talkPool();
    setMuseLine((i) => {
      const next = (i + 1) % pool.length;
      const line = pool[next];
      if (line)
        setMuseBubble({ lines: paginateLines([line]), index: 0, cycle: true, invite: !followingRef.current, choice: null });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkPool]);

  // --- Fishing (Phase B) ----------------------------------------------
  // Cast, wait on a gentle bobber, and strike inside the bite window.
  // From the dock (via its choice card) or from the rowboat (menu).
  const stopFishing = useCallback(() => {
    if (fishingTimer.current) window.clearTimeout(fishingTimer.current);
    fishingTimer.current = null;
    fishingRef.current = false;
    setFishing(null);
  }, []);

  const startFishing = useCallback(() => {
    setDockChoice(false);
    setMenuOpen(false);
    fishingRef.current = true;
    setFishing({ phase: "waiting", fish: null });
    if (followingRef.current && Math.random() < 0.5) {
      const line = pickPooled("fishing", FISHING_LINES_WITH_MUSE);
      window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 1600);
    }
    if (fishingTimer.current) window.clearTimeout(fishingTimer.current);
    fishingTimer.current = window.setTimeout(() => {
      setFishing({ phase: "bite", fish: null });
      fishingTimer.current = window.setTimeout(() => {
        setFishing((f) => (f?.phase === "bite" ? { phase: "missed", fish: null } : f));
      }, 1400);
    }, 2600 + Math.random() * 3800);
  }, []);

  const reelIn = useCallback(() => {
    if (fishingTimer.current) window.clearTimeout(fishingTimer.current);
    fishingTimer.current = null;
    setFishing((f) => {
      if (!f || f.phase !== "bite") return f;
      const fish = rollFish();
      recordCatch.mutate(fish.id);
      return { phase: "caught", fish };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takePostcard = useCallback(() => {
    const photo = sceneRef.current?.capturePostcard();
    if (!photo) return;
    const today = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    setPostcardDraft({ photo, caption: `Greetings from Muse Town, ${today}` });
  }, []);

  const savePostcard = useCallback(() => {
    if (!postcardDraft) return;
    const { photo, caption } = postcardDraft;
    const weatherLabel = weatherRef.current ? weatherInfo(weatherRef.current.id).label : "";
    const dateLabel = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    const img = new Image();
    img.onload = () => {
      const border = 26;
      const band = 74;
      const out = document.createElement("canvas");
      out.width = img.width + border * 2;
      out.height = img.height + border * 2 + band;
      const c = out.getContext("2d");
      if (!c) return;
      c.fillStyle = "#fdfaf2";
      c.fillRect(0, 0, out.width, out.height);
      c.drawImage(img, border, border);
      c.fillStyle = "#3a3128";
      c.font = "600 27px Quicksand, sans-serif";
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.fillText(caption.slice(0, 56), border + 4, img.height + border * 2 + band / 2 - 12);
      c.font = "500 21px Quicksand, sans-serif";
      c.fillStyle = "#8a7a5f";
      c.fillText(weatherLabel ? `${dateLabel} · ${weatherLabel}` : dateLabel, border + 4, img.height + border * 2 + band / 2 + 20);
      const framed = out.toDataURL("image/jpeg", 0.85);
      addPostcard.mutate({
        image_base64: framed.split(",")[1] ?? "",
        caption,
        date_label: dateLabel,
        weather: weatherLabel,
      });
    };
    img.src = photo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcardDraft]);

  const museChatContext = useCallback((): MuseChatContext => {
    const w = weatherRef.current;
    return {
      weatherLabel: w ? weatherInfo(w.id).label : "Clear skies",
      night: nightRef.current,
      treeStage: growthRef.current?.stage.name ?? "Young tree",
      foundCount: foundRef.current.length,
      totalCollectibles: COLLECTIBLES.length,
      boardAsOf: boardAsOfRef.current,
      affectionRank: affectionRef.current,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reportLocalChatStatus = useCallback((status: LocalChatStatus) => {
    setLocalChatStatus(status);
    if (status.state === "ready" || status.state === "prepared") {
      setPreparedLocalModels((previous) => new Set(previous).add(status.model));
    }
  }, []);

  const prepareLocalModel = useCallback(async (model: LocalModelName) => {
    if (localChatPending || localModelPreparing) return;
    setLocalModelPreparing(model);
    setLocalChatStatus({ state: "checking", message: "Checking storage and GPU support…" });
    try {
      // Persistence is only a request: browsers may decline it or still evict
      // caches under pressure, but asking reduces surprise on supported hosts.
      try {
        if (navigator.storage?.persist) await navigator.storage.persist();
      } catch {
        /* the download can still proceed with ordinary browser caching */
      }
      await downloadAeliaModel({ model, onStatus: reportLocalChatStatus });
    } catch (error) {
      setLocalChatStatus({
        state: "unavailable",
        message: `${model} could not be prepared. ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setLocalModelPreparing(null);
    }
  }, [localChatPending, localModelPreparing, reportLocalChatStatus]);

  const sendChat = useCallback(() => {
    const msg = chatDraft.trim();
    if (!msg) return;
    setChatDraft("");
    sceneRef.current?.showBubble("player", msg);
    // Muse Visits (Task 4): while a visit is open his line is laid on
    // the slate as visit mail, carried to the director, and NOTHING
    // below fires: no scripted reply, no local chat, no notebook, no
    // fact capture. The town remembers nothing of the out-here talk.
    if (visitRef.current.active) {
      const captured = captureMail(visitRef.current, msg, Date.now());
      visitRef.current = captured.slate;
      visitThreadRef.current = [...visitThreadRef.current, { who: "him", text: msg, seq: captured.mail.seq }];
      saveVisitResume(sessionStore(), visitRef.current, visitThreadRef.current, bridgeCursorRef.current, Date.now());
      setVisitUi((ui) => ({ ...ui, thread: visitThreadRef.current }));
      bridgeNudgeRef.current();
      return;
    }
    // Notes for Muse: a typed request/wish for the town ("can we
    // add…", "I wish…", "please change…", "note this") is saved to
    // her notebook for the real Muse, and her reply acknowledges
    // it as a second bubble part. Ordinary chat never lands there;
    // when in doubt, the heuristic saves (per the owner's arrangement).
    const noted = NOTE_WISH_RE.test(msg);
    if (noted) {
      addNote.mutate({ text: msg });
      // She's pleased he asked her: kind requests in the notebook
      // count, a little, toward her heart.
      earnRef.current("note");
    }
    const ctx = museChatContext();
    const deliver = (reply: string, extra?: string) => {
      setMuseBubble({
        lines: paginateLines(
          noted
            ? [
                reply,
                "Noted, love. I've written it in my notebook for the other Muse. She does the building from beyond the town walls; I just make sure she hears you.",
              ]
            : extra
              ? [reply, extra]
              : [reply],
        ),
        index: 0,
        cycle: false,
        invite: false,
        choice: null,
      });
      try {
        const n = Number(localStorage.getItem("muse-town-chat-count") ?? 0) + 1;
        localStorage.setItem("muse-town-chat-count", String(n));
        if (n >= 10) unlockRef.current("confidant");
      } catch {
        /* storage unavailable */
      }
    };
    // A finished focus sitting asked how it went: his typed reply
    // is kept, as a fact she remembers, and in his own journal.
    if (focusReportRef.current && msg.trim().length >= 2) {
      focusReportRef.current = false;
      const report = msg.trim().slice(0, 200);
      learnFactRef.current({
        text: `${aboutPlayer("After a focus sitting beside her, he said it went like this:")} ${report.replace(/\.$/, "")}`,
        topic: "work",
        source: "chat",
      });
      void api.addJournalEntry({ text: `Sat with Aelia while I worked. Afterwards I told her: ${report}` }).catch(() => {});
    }
    // Her outstanding question: his typed reply IS the answer, and
    // it is stored as a fact before the conversation rolls on. (She
    // never nags if he answers something else entirely, the
    // question simply stays the last one she asked.)
    const pendingQ = pendingQuestionRef.current;
    if (pendingQ && msg.trim().length >= 2) {
      pendingQuestionRef.current = null;
      const answer = msg.trim().replace(/\.+$/, "").slice(0, 60);
      if (answer) {
        learnFactRef.current({
          text: aboutPlayer(pendingQ.fact).split("{answer}").join(answer),
          topic: pendingQ.topic,
          source: "question",
        });
      }
    }
    // Flattery is answered by her wit, in person, at every rank,
    // it never earns her heart (actions do), and at low ranks it
    // earns a proper deflection. The terrace keeps its own register.
    if (!atSecretRef.current && isFlirtation(msg)) {
      const band = affectionBandForRank(affectionRef.current);
      const pool = FLIRT_DEFLECTIONS[band];
      deliver(pickPooled(`deflect:${band}`, pool));
      return;
    }
    const history = localChatHistory.current.slice(-8);
    const localReply = generateLocalAeliaReply({
      message: msg,
      context: {
        ...ctx,
        affectionRank: ctx.affectionRank ?? 0,
        unreadLetters: unreadRef.current,
        knownFacts: (state.data?.facts ?? []).slice(-6).map((fact) => fact.text),
        privateName: summitPrivateNameRef.current,
      },
      history,
      onStatus: reportLocalChatStatus,
    }).catch(() => null);
    setLocalChatPending(true);
    const localOrScripted = async (data?: Awaited<ReturnType<typeof chatWithMuse.mutateAsync>>) => {
      try {
        const generated = await localReply;
        const reply = generated?.reply || (data
          ? scriptedMuseReply(msg, ctx, data.sentiment)
          : scriptedMuseReply(msg, ctx));
        const nextHistory: AeliaChatTurn[] = [
          ...history,
          { role: "user", content: msg },
          { role: "assistant", content: reply },
        ];
        localChatHistory.current = nextHistory.slice(-12);
        if (!generated) {
          setLocalChatStatus({
            state: "unavailable",
            message: "Local Gemma is unavailable here; Aelia is using her scripted replies.",
          });
        }
        deliver(reply, data?.learned_fact ? "I'll remember that, love." : undefined);
      } finally {
        setLocalChatPending(false);
      }
    };
    void chatWithMuse.mutateAsync({
      message: msg,
      local_reply: true,
      context: {
        weather: ctx.weatherLabel,
        night: ctx.night,
        tree_stage: ctx.treeStage,
        found_count: ctx.foundCount,
        board_as_of: ctx.boardAsOf,
        unread_letters: unreadRef.current,
        affection_rank: affectionRef.current,
        private_name: summitPrivateNameRef.current,
      },
    }).then(localOrScripted, () => localOrScripted());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatDraft, museChatContext]);

  // His sweet quick-pick lines at the secret place: spoken in a bubble
  // over the Centurion, answered from her flirt register.
  const sendSweetPick = useCallback((text: string) => {
    sceneRef.current?.showBubble("player", text);
    // Below three hearts, even the terrace's sweet lines meet her
    // reserve: compliments are deflected until her warmth is earned.
    const reserved = affectionRef.current < 3;
    const pool = reserved ? FLIRT_DEFLECTIONS.reserved : SECRET_FLIRT_LINES;
    const reply = reserved
      ? pickPooled("deflect:reserved", pool)
      : pool[Math.floor(Math.random() * pool.length)]!;
    window.setTimeout(() => {
      sceneRef.current?.showBubble("muse", reply);
    }, 900);
  }, []);

  const holdHerHand = useCallback(() => {
    // The terrace's own held-hand moment supersedes the wander,
    // hands part from the stroll so the moment can take them.
    releaseHandHoldRef.current();
    if (!sceneRef.current?.playHandHold()) return;
    setHandHeld(true);
    const line = HAND_HOLD_LINES[Math.floor(Math.random() * HAND_HOLD_LINES.length)]!;
    window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 1100);
  }, []);

  const kissHer = useCallback(() => {
    releaseHandHoldRef.current();
    sceneRef.current?.playKiss();
  }, []);

  const exitWalkMode = useCallback(() => {
    if (!walkingRef.current) return;
    walkingRef.current = false;
    setWalking(false);
    releaseHandHoldRef.current();
    // Leaving the shore leaves the fishing behind too.
    if (fishingTimer.current) window.clearTimeout(fishingTimer.current);
    fishingTimer.current = null;
    fishingRef.current = false;
    setFishing(null);
    setDockChoice(false);
    // Leaving walk mode ends the stroll, the scene walks Muse home.
    if (followingRef.current) {
      followingRef.current = false;
      setFollowing(false);
    }
    followOfferRef.current = null;
    setFollowOfferState(null);
    padRef.current = { x: 0, y: 0 };
    sceneRef.current?.setWalkMove(0, 0);
    sceneRef.current?.exitWalk();
  }, []);

  const enterWalkMode = useCallback(() => {
    unlockRef.current("first-steps");
    walkingRef.current = true;
    setWalking(true);
    setHintText(null);
    sceneRef.current?.enterWalk();
  }, []);

  const setPad = useCallback((x: number, y: number) => {
    padRef.current = { x, y };
    sceneRef.current?.setWalkMove(x, y);
  }, []);

  // Joystick geometry: a 34px travel radius inside the base. Dragging the
  // thumbstick maps to the same pad vector the keyboard produces (up is
  // forward), with partial tilt giving partial speed.
  const STICK_RADIUS = 34;
  const stickMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      let dx = e.clientX - (rect.left + rect.width / 2);
      let dy = e.clientY - (rect.top + rect.height / 2);
      if (forcedLandscapeRef.current) {
        // The stage is CSS-rotated 90° clockwise: pointer deltas arrive
        // in screen axes, the stick lives in stage axes. Rotating the
        // delta by −90°, (dx, dy) → (dy, −dx), puts it in stage axes,
        // so the knob tracks the finger exactly as it does upright and
        // "up" on the held-sideways phone is still forward.
        const sx = dx;
        const sy = dy;
        dx = sy;
        dy = -sx;
      }
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      placeStickKnob(dx, dy);
      setPad(dx / STICK_RADIUS, -dy / STICK_RADIUS);
    },
    [setPad],
  );
  const stickEnd = useCallback(() => {
    stickPointer.current = null;
    placeStickKnob(0, 0);
    setPad(0, 0);
  }, [setPad]);

  // Landscape support: the layout follows the REAL VIEWPORT's aspect,
  // not any orientation API's claimed value, the app webview does
  // not reliably update matchMedia("(orientation: …)") or
  // screen.orientation on rotation. Whenever the visible box is
  // wider than it is tall (for whatever reason, the phone turned,
  // the window resized, the host gave it a wide box), the compact
  // landscape layout applies: slim top bar, side-docked panels,
  // one-row bottom bar, wider walk camera.
  //
  // Why so many triggers: on the real phone this kept failing even
  // though every listener existed. The failure mode is timing and
  // silence, orientationchange can fire BEFORE the box has actually
  // changed size (a single immediate measurement reads the stale
  // portrait box), and some webviews then deliver no further event
  // once the box settles, leaving the layout stuck in portrait
  // forever. So: measure the visual viewport first (the actual
  // visible box, what the shell gives the page in landscape, chrome
  // and all), re-measure on every signal any webview is known to
  // send, add delayed re-checks after coarse signals (rotation
  // geometry settles a beat late, the scene does the same), use
  // screen.orientation's change event purely as a poke to re-measure
  // (its VALUE is never read), and poll gently forever as the final
  // net. React bails out when the boolean doesn't change, so the
  // poll costs nothing when nothing moves.
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      const el = rootRef.current;
      const w = (vv && vv.width > 8 ? vv.width : 0) || window.innerWidth || el?.clientWidth || 0;
      const h = (vv && vv.height > 8 ? vv.height : 0) || window.innerHeight || el?.clientHeight || 0;
      if (w > 8 && h > 8) setRealLandscape(w > h * 1.02);
    };
    update();
    const raf = window.requestAnimationFrame(update);
    const root = rootRef.current;
    // Same crash-proofing as speechSynthesis: some webviews lack
    // ResizeObserver or expose visualViewport without listener APIs.
    const ro =
      root && typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    if (root && ro) ro.observe(root);
    window.addEventListener("resize", update);
    // Coarse rotation signals get immediate AND delayed re-checks,
    // the box often settles a frame or two after the event.
    const timers: number[] = [];
    const onCoarseSignal = () => {
      update();
      timers.push(window.setTimeout(update, 120));
      timers.push(window.setTimeout(update, 450));
    };
    window.addEventListener("orientationchange", onCoarseSignal);
    const vv = window.visualViewport;
    const vvOk = !!vv && typeof vv.addEventListener === "function";
    if (vvOk) vv.addEventListener("resize", update);
    // screen.orientation: event only, never its value (see above).
    const so = window.screen?.orientation;
    const soOk = !!so && typeof so.addEventListener === "function";
    if (soOk) so.addEventListener("change", onCoarseSignal);
    const onVisible = () => {
      if (document.visibilityState === "visible") onCoarseSignal();
    };
    document.addEventListener("visibilitychange", onVisible);
    // The final net: re-evaluate continuously, forever. Catches
    // webviews that change the box in complete silence.
    const poll = window.setInterval(update, 750);
    return () => {
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
      window.clearInterval(poll);
      for (const t of timers) window.clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", onCoarseSignal);
      document.removeEventListener("visibilitychange", onVisible);
      try {
        if (vvOk && vv && typeof vv.removeEventListener === "function") {
          vv.removeEventListener("resize", update);
        }
        if (soOk && so && typeof so.removeEventListener === "function") {
          so.removeEventListener("change", onCoarseSignal);
        }
      } catch {
        /* ignore cleanup failures */
      }
    };
  }, []);

  // Weather reports from the scene: mirror the state, announce each new
  // event with a banner (except the first, which is just the opening sky),
  // and start the matching ambience if sound is unlocked and on.
  const handleWeatherChange = useCallback((info: WeatherChangeInfo) => {
    setWeather(info);
    if (seenWeatherRef.current) {
      const w = weatherInfo(info.id);
      setWeatherBanner(`${w.icon} ${w.label}, ${w.blurb}`);
      if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
      bannerTimer.current = window.setTimeout(() => setWeatherBanner(null), 5200);
      if (info.id === "sparkles" && audioUnlockedRef.current && weatherSoundOnRef.current) {
        playSparkleChime();
      }
    } else {
      seenWeatherRef.current = true;
    }
  }, []);

  // Thunder follows lightning by a beat, as it does in life.
  const handleLightning = useCallback(() => {
    if (!audioUnlockedRef.current || !weatherSoundOnRef.current) return;
    window.setTimeout(() => {
      if (weatherSoundOnRef.current) playThunder();
    }, 280 + Math.random() * 420);
  }, []);

  const chooseWeather = useCallback((choice: WeatherId | "auto") => {
    weatherChoiceRef.current = choice;
    sceneRef.current?.setWeather(choice);
  }, []);

  const toggleWeatherSound = useCallback(() => {
    setWeatherSoundOn((on) => {
      const next = !on;
      weatherSoundOnRef.current = next;
      if (!next) stopWeatherAmbience();
      return next;
    });
  }, []);

  // Browsers keep audio locked until the first tap: unlock on the first
  // pointer press anywhere in the town.
  useEffect(() => {
    const unlock = () => {
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Capture touch gestures before descendant handlers. Panels may scroll only
  // while they have room in the drag direction; their edges must not hand a
  // downward drag to the browser's refresh gesture.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scrollable = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(".mt-scrollable, [data-scrollable]")
        : null;
    const onControls = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("[data-mt-stick], [data-mt-controls]");
    const touchY = new Map<number, number>();
    const blockPullMove = (e: TouchEvent) => {
      let block = false;
      for (const touch of Array.from(e.changedTouches)) {
        const previous = touchY.get(touch.identifier) ?? touch.clientY;
        touchY.set(touch.identifier, touch.clientY);
        const panel = scrollable(touch.target);
        const dy = touch.clientY - previous;
        if (!panel || panel.scrollHeight <= panel.clientHeight ||
            (dy > 0 && panel.scrollTop <= 0) ||
            (dy < 0 && panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1)) {
          block = true;
        }
      }
      if (block && e.cancelable) e.preventDefault();
    };
    const blockPullPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !scrollable(e.target) && e.cancelable) e.preventDefault();
    };
    const trackTouchStart = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) touchY.set(touch.identifier, touch.clientY);
      // These surfaces use pointer events, so cancelling native touch does
      // not interrupt walking or camera dragging. Keep button taps intact.
      if (e.target instanceof Element && e.target.closest("[data-mt-stick], canvas") && e.cancelable) {
        e.preventDefault();
      }
    };
    const endTouch = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) touchY.delete(touch.identifier);
    };
    const blockContextMenu = (e: Event) => {
      if (onControls(e.target)) e.preventDefault();
    };
    const captureTouch = { passive: false, capture: true };
    document.addEventListener("touchmove", blockPullMove, captureTouch);
    document.addEventListener("pointermove", blockPullPointer, captureTouch);
    document.addEventListener("touchstart", trackTouchStart, captureTouch);
    document.addEventListener("touchend", endTouch, true);
    document.addEventListener("touchcancel", endTouch, true);
    root.addEventListener("contextmenu", blockContextMenu);
    return () => {
      document.removeEventListener("touchmove", blockPullMove, true);
      document.removeEventListener("pointermove", blockPullPointer, true);
      document.removeEventListener("touchstart", trackTouchStart, true);
      document.removeEventListener("touchend", endTouch, true);
      document.removeEventListener("touchcancel", endTouch, true);
      root.removeEventListener("contextmenu", blockContextMenu);
    };
  }, []);

  // Keep the looping ambience matched to the current weather.
  useEffect(() => {
    if (!weather || !audioUnlocked) return;
    if (!weatherSoundOn) {
      stopWeatherAmbience();
      return;
    }
    const kind: WeatherSoundKind =
      weather.id === "rain"
        ? "rain"
        : weather.id === "storm"
          ? "storm"
          : weather.id === "breezy"
            ? "wind"
            : "none";
    startWeatherAmbience(kind);
  }, [weather, audioUnlocked, weatherSoundOn]);

  // Tick once a second while a random spell is counting down.
  useEffect(() => {
    if (!weather || weather.manual || !weather.endsAt) return;
    const iv = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [weather]);

  // Create the scene once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: TownSceneHandle | null = null;
    try {
      const sceneOpts: Parameters<typeof createTownScene>[1] = {
        onPick: handlePick,
        onNearbyChange: handleNearbyChange,
        onGuideEnd: (arrived) => guideEndRef.current(arrived),
        onWalkPosition: (x, z) => {
          playerPosRef.current = { x, z };
          // First time he brings her to the lake: a discovery of the heart.
          if (
            followingRef.current &&
            !lakeBondRef.current &&
            Math.hypot(x - LAKE.position[0], z - LAKE.position[1]) < 8.5
          ) {
            lakeBondRef.current = true;
            earnRef.current("landmark:lake");
            awardOnce.mutate({ key: "landmark:lake", amount: 8 });
          }
          const si = streetIndexAt(x, z);
          if (si >= 0 && !streetsWalkedRef.current.has(si)) {
            streetsWalkedRef.current.add(si);
            if (streetsWalkedRef.current.size >= STREETS.length) {
              completeQuestRef.current("every-street");
            }
          }
          const insideSecret = Math.hypot(x - SECRET.position[0], z - SECRET.position[1]) < 3.4;
          if (insideSecret !== atSecretRef.current) {
            atSecretRef.current = insideSecret;
            if (!insideSecret) setHandHeld(false);
          }
        },
        onSitChange: (benchId) => {
          seatedBenchRef.current = benchId;
          setSeatedBench(benchId);
          // Sitting down parts joined hands, the bench has its own
          // arrangement, and she takes the other end of it.
          if (benchId) {
            releaseHandHoldRef.current();
            noteFirst("bench");
          }
        },
        onRowChange: (rowing) => {
          rowingRef.current = rowing;
          setRowingBoat(rowing);
          if (!rowing) {
            driftingRef.current = false;
            setDrifting(false);
          }
          // Boarding parts joined hands, oars need both of his.
          if (rowing) releaseHandHoldRef.current();
        },
        onHandInHandChange: (on) => {
          // The scene ended the wander on its own (a hurry against
          // the stroll cap): mirror it here so the bubble options
          // follow her hands, not the other way round.
          if (!on) {
            handInHandWalkRef.current = false;
            setHandInHandWalk(false);
          }
        },
        onStoneFx: (kind) => {
          // The town's smallest sounds: a pebble's tick, a thrown
          // stone's bounce, water taking a stone (or skipping it).
          if (kind === "tick") playStoneTick(false);
          else if (kind === "bounce") playStoneTick(true);
          else if (kind === "splash") playSplash(false);
          else {
            playSplash(true);
            noteFirst("stones");
          }
        },
        onWolfSeen: () => {
          // Lupa, properly seen for the first time: the sighting
          // is saved (her Stories entry reads it), and announced
          // once, the saved row makes every later visit quiet.
          if (stateRef.current && !stateRef.current.found.includes("lupa-seen")) {
            markFound.mutate("lupa-seen");
            setAchievementToast("🐺 Lupa, the town's wolf, written into the Stories");
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            toastTimer.current = window.setTimeout(() => setAchievementToast(null), 4200);
          }
        },
        onDreamEnd: (kind) => {
          // A false dream ends itself in the scene (she dissolved,
          // he came home to the steps, it ran out): the shell veils
          // the waking and hands him his mood.
          if (kind === "false") endFalseDreamRef.current();
        },
        onKissMoment: () => kissMomentRef.current(),
        onDanceEnd: () => {
          dancingRef.current = false;
          setDancing(false);
          sceneRef.current?.showBubble("muse", DANCE_END_LINE);
        },
        onSkyWatchEnd: () => {
          gazingRef.current = false;
          setSkyWatching(false);
          skyWatchDoneRef.current = true;
          momentTimersRef.current.forEach((tm) => window.clearTimeout(tm));
          momentTimersRef.current = [];
        },
        onWeatherChange: handleWeatherChange,
        onLightning: handleLightning,
        onReady: () => {
          readyRef.current = true;
          setSceneReady(true);
        },
        onLoadProgress: (settled, total) => setLoadProgress({ settled, total }),
        onContextLost: () => setContextLost(true),
        onContextRestored: () => setContextLost(false),
        onLoadError: (asset) => setLoadFailure((prev) => prev ?? asset),
        onRenderError: () => setRenderFailed(true),
        onSoftwareGl: () => setLowGfx(true),
        onMotionStatus: (status) => setMotionStatus(status),
        reducedMotion:
          typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
            : false,
      };
      try {
        handle = createTownScene(canvas, sceneOpts);
      } catch (first) {
        // Recovery before giving up (Task 42): one more try at the
        // safest settings (ratio 1, no antialiasing, low graphics). A
        // second failure falls through to the overlay below, which
        // names both causes.
        console.error("[muse-town] scene build failed, retrying at the safest settings:", first);
        lowGfxRef.current = true;
        setLowGfx(true);
        try {
          handle = createTownScene(canvas, { ...sceneOpts, safeMode: true });
        } catch (second) {
          throw new SceneBuildError(first, second);
        }
      }
      sceneRef.current = handle;
      // Walk-together from frame one (see the following state): she
      // starts as his companion, so no greeting wave fires on load
      // (setFollowMode also disarms the greeting, as always).
      handle.setFollowMode(true);
      handle.setLowGraphics(lowGfxRef.current);
      if (festivalColorsRef.current) handle.setFestival(festivalColorsRef.current);
      // The town opens on foot now: straight into walk mode as the
      // Centurion at the peristyle spawn, Xbox controls up, follow camera
      // at its standard distance, no overview first. Overview is
      // still one tap away, and re-entering walk restores the same
      // standard framing.
      enterWalkMode();
    } catch (err) {
      // Scene build itself threw (renderer creation, terrain, the
      // shell build). Name the cause in the overlay, and record it
      // on the window flags so the out-of-band watchdog in main.tsx
      // tells the same story if this tree ever fails to paint it.
      // Task 42: the overlay shows the real error, not only a guess,
      // so a screenshot is enough to diagnose the next failure.
      const detail = describeSceneError(err);
      console.error("[muse-town] the 3D town could not start:", err);
      (window as unknown as { __mtSceneError?: string }).__mtSceneError =
        `The 3D town could not start on this device (${detail}).`;
      setWebglError(detail);
    }
    // First-frame watchdog: the scene exists but no frame has
    // rendered within 20 seconds, on a phone that is a dead scene,
    // not a slow one. Surface the retry overlay instead of leaving
    // a bare sky-blue screen with nothing to tap.
    const watchdog = window.setTimeout(() => {
      if (!readyRef.current) setRenderFailed(true);
    }, 20000);
    return () => {
      window.clearTimeout(watchdog);
      handle?.dispose();
      sceneRef.current = null;
    };
  }, [handlePick, handleNearbyChange, handleWeatherChange, handleLightning, enterWalkMode]);

  // Apply the low-graphics choice whenever it changes (and remember it).
  useEffect(() => {
    lowGfxRef.current = lowGfx;
    sceneRef.current?.setLowGraphics(lowGfx);
    try {
      window.localStorage.setItem("muse-town-lowgfx", lowGfx ? "1" : "0");
    } catch {
      /* the toggle still applies for this visit */
    }
  }, [lowGfx]);

  // Hide collectibles the visitor already found (e.g. after a reload).
  useEffect(() => {
    if (!state.data) return;
    for (const id of state.data.found) sceneRef.current?.setFound(id);
  }, [state.data]);

  // Keep the 3D town tree at the growth stage the saved state earns.
  const growthStage = growth?.stageIndex;
  useEffect(() => {
    if (growthStage === undefined) return;
    sceneRef.current?.setTreeStage(growthStage);
  }, [growthStage]);

  // Keep the 3D town tree dressed for the effective season.
  useEffect(() => {
    sceneRef.current?.setTreeSeason(effectiveSeason);
  }, [effectiveSeason]);

  const stopTour = useCallback(() => {
    tourTimers.current.forEach((t) => window.clearTimeout(t));
    tourTimers.current = [];
    setTourStep(null);
  }, []);

  const startTour = useCallback(() => {
    exitWalkMode();
    stopTour();
    setSelected(null);
    setMuseBubble(null);
    setYouOpen(false);
    setTreeOpen(false);
    setWeatherOpen(false);
    TOUR_STOPS.forEach((stop, i) => {
      const timer = window.setTimeout(
        () => {
          setTourStep(i);
          sceneRef.current?.flyTo(stop.pos, stop.target, 2200);
          if (i === TOUR_STOPS.length - 1) {
            const end = window.setTimeout(() => setTourStep(null), 3400);
            tourTimers.current.push(end);
          }
        },
        i * 3600,
      );
      tourTimers.current.push(timer);
    });
  }, [stopTour, exitWalkMode]);

  useEffect(() => () => stopTour(), [stopTour]);

  const toggleNight = () => {
    // An override on a living sky: hold night (or day), and the sun
    // visibly travels there, several seconds of drifting colour,
    // never a cut. The menu's "Real time" hands the sky back.
    const next = skyMode !== "night";
    setSkyMode(next ? "night" : "day");
    sceneRef.current?.setSkyMode(next ? "night" : "day");
    setNight(next);
    if (next && !foundSet.has("first-night")) celebrate("first-night");
    // Nightfall is a special occasion: offer a stargazing stroll.
    if (next) {
      offerFollowRef.current(
        "stargazing",
        "Night's falling and the stars are coming out over the pavilion. Shall I walk with you a while?",
      );
    }
  };
  const setSkyAuto = () => {
    setSkyMode("auto");
    sceneRef.current?.setSkyMode("auto");
  };
  // In real-time mode, keep the shell's sense of night honest from
  // the sky itself (meteor lines, festival dressing, and the rest
  // read it), polled gently.
  useEffect(() => {
    if (skyMode !== "auto") return;
    const iv = window.setInterval(() => {
      const s = sceneRef.current?.skyState();
      if (s) setNight(s.darkness > 0.55);
    }, 2000);
    return () => window.clearInterval(iv);
  }, [skyMode]);

  useEffect(() => {
    metCatRef.current = metCat;
  }, [metCat]);

  const startDance = () => {
    const scene = sceneRef.current;
    if (!scene || !scene.startDance()) return;
    dancingRef.current = true;
    setDancing(true);
    noteFirst("dance");
    setMuseBubble({ lines: paginateLines([DANCE_START_LINE]), index: 0, cycle: false, invite: false, choice: null });
    momentTimersRef.current.push(
      window.setTimeout(() => sceneRef.current?.showBubble("muse", DANCE_LINES[0]!), 9000),
    );
    momentTimersRef.current.push(
      window.setTimeout(() => sceneRef.current?.showBubble("muse", DANCE_LINES[1]!), 21000),
    );
  };

  const startSkyWatch = () => {
    const scene = sceneRef.current;
    if (!scene || !skySpot) return;
    const sky = scene.skyState();
    if (!sky.golden) {
      setMuseBubble({
        lines: paginateLines([SKY_NOT_PERFORMING_LINE]),
        index: 0,
        cycle: false,
        invite: false,
        choice: null,
      });
      return;
    }
    if (!scene.startSkyWatch(skySpot)) return;
    gazingRef.current = true;
    setSkyWatching(true);
    setMuseBubble(null);
    noteFirst("skywatch");
    const phase = sky.phase === "dawn" ? "dawn" : "dusk";
    const lines = SKY_WATCH_LINES[phase];
    lines.forEach((line, i) => {
      momentTimersRef.current.push(
        window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 2500 + i * 19000),
      );
    });
    if (phase === "dusk") {
      momentTimersRef.current.push(
        window.setTimeout(() => {
          const s = sceneRef.current?.skyState();
          if (s && s.darkness > 0.6 && gazingRef.current) {
            sceneRef.current?.showBubble("muse", SKY_WATCH_FIREFLY_LINE);
          }
        }, 2500 + lines.length * 19000),
      );
    }
    earnRef.current(`landmark:skywatch-${new Date().toISOString().slice(0, 10)}-${phase}`);
  };

  const startPhoenixWatch = () => {
    gazingRef.current = true;
    setMuseBubble(null);
    noteFirst("phoenix");
    PHOENIX_WATCH_LINES.forEach((line, i) => {
      momentTimersRef.current.push(
        window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 1500 + i * 10000),
      );
    });
    momentTimersRef.current.push(
      window.setTimeout(() => {
        gazingRef.current = false;
      }, 1500 + PHOENIX_WATCH_LINES.length * 10000),
    );
  };

  const showHint = () => {
    if (nextCollectible) {
      setHintText(`Hint: ${nextCollectible.hint}`);
    } else {
      setHintText("You found everything hidden in Muse Town. Nice exploring!");
    }
  };

  // The "A, …" prompt's wording for a nearby target. The prompt is
  // all that approach shows now; the panel behind it opens only on an
  // interact press or a tap.
  const nearbyPrompt = (target: NearbyTarget | null): string | null => {
    if (!target) return null;
    switch (target.kind) {
      case "summit":
        return "Tonight, the stars fall";
      case "muse":
        return "Talk to Aelia";
      case "bench":
        if (target.id === "piscina-rim") {
          return seatedBenchRef.current === target.id ? "Stand up" : "Sit on the piscina rim";
        }
        if (target.id === "home-bed") {
          return seatedBenchRef.current === target.id ? "Stand up" : "Sit on our bed together";
        }
        if (target.id === "bench-cliff") {
          return seatedBenchRef.current === target.id ? "Stand up" : "Sit together over the sea";
        }
        if (target.id === "bench-athena") {
          return seatedBenchRef.current === target.id ? "Stand up" : "Sit together on the temple step";
        }
        return seatedBenchRef.current === target.id ? "Stand up" : "Sit on the bench";
      case "piscina":
        return target.id === "release" ? "Release a fish into the piscina" : "Scatter feed for the fish";
      case "baths":
        return target.id === "leave" ? "Leave the pool" : "Step into the caldarium";
      case "cat":
        return "Pet Umbra";
      case "phoenix":
        return "Take up the feather";
      case "sky":
        return "Stop watching";
      case "stone":
        return target.id === "pickup" ? "Pick up stone" : "Throw the stone";
      case "forage":
        return FORAGE_SPOTS.find((s) => s.id === target.id)?.item === "wild-mushrooms" ? "Gather wild mushrooms" : "Gather forest herbs";
      case "rest":
        if (target.id !== "home-bed-rest") return "Rest";
        return nightBlockedNowRef.current() === null ? NIGHT_ASK_PROMPT : "Rest together till morning";
      case "home":
        return "Arrange our home";
      case "dock":
        return target.id === "boat" || rowingRef.current ? "Step ashore" : "Visit the lake dock";
      case "inscription":
        return "Read the inscription";
      case "history":
        if (target.id === "lucretia") return "Read Lucretia's inscription";
        if (target.id === "athena") return "Read the temple's inscription";
        return "Read the history of this place";
      case "tree":
        return "Water the town tree";
      case "board":
        return "Read the project board";
      case "questboard":
        return "Read the quest board";
      case "goals":
        return "Read the Goals Obelisk";
      case "letters":
        return "Check the letters desk";
      case "secret":
        return "Sit at our secret terrace";
      case "landmark":
        // Once stood before, the Colosseum keeps the knucklebones
        // table (Nov 6, 2026: the landmark needed a reason).
        return landmarksRef.current.has(target.id) ? "Play knucklebones at the Colosseum" : "Stand before the Colosseum";
      case "market":
        return "Browse the market stall";
      case "place": {
        const labels: Record<string, string> = {
          mainchat: "Enter the basilica",
          sidechat: "Visit the Domus Architecti",
          stories: "Visit the Villa of Stories",
          sounds: "Visit the Atrium of Sounds",
          garden: "Visit the Garden House",
          stars: "Visit the Stargazing Pavilion",
          recipes: "Visit the Recipe Kitchen",
          embassy: "Visit the Embassy gatehouse",
        };
        return labels[target.id] ?? "Visit this place";
      }
      default:
        return "Interact";
    }
  };

  // --- The living estate -----------------------------------------------
  // The hour, the state of the place, and the opening minutes. All of it
  // is read on slow timers or when saved state moves, never by the frame.
  const [rhythm, setRhythm] = useState<Rhythm | null>(null);
  const rhythmRef = useRef<Rhythm | null>(null);
  const [firstTask, setFirstTask] = useState(false);
  const panelOpenRef = useRef(false);
  const guidingRef = useRef<Invite | null>(null);
  const festivalName = activeFestival?.name ?? null;
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hour = night ? null : (romanHour(now, (at) => solarAngles(at).elev) ?? 5);
      const next = dayRhythm(hour, romanDate(now), festivalName);
      rhythmRef.current = next;
      setRhythm((was) => (was?.id === next.id && was.title === next.title ? was : next));
    };
    update();
    const iv = window.setInterval(update, 60000);
    return () => window.clearInterval(iv);
  }, [night, festivalName]);
  useEffect(() => {
    if (rhythm) sceneRef.current?.setRhythm(rhythm);
  }, [rhythm]);

  const dishesKey = purse.dishes.join(",");
  useEffect(() => {
    sceneRef.current?.setDishes(dishesKey ? dishesKey.split(",") : []);
  }, [dishesKey]);

  const care = state.data
    ? estateCare({
        waterings: state.data.tree.waterings,
        harvests: state.data.garden.harvests,
        questsDone: state.data.quests_done.length,
        found: state.data.found.length,
        inscriptions: state.data.inscriptions_found.length,
        rank: state.data.affection.rank,
        dishes: state.data.purse.dishes.length,
        upgrades: state.data.purse.upgrades,
        sharedBath: !!state.data.baths.first_shared_at,
      })
    : null;
  const estateKey = care ? careKey(care) : "";
  const careRef = useRef(care);
  careRef.current = care;
  useEffect(() => {
    if (careRef.current) sceneRef.current?.setEstateCare(careRef.current);
  }, [estateKey]);

  useEffect(() => {
    sceneRef.current?.setStepSounds(audioUnlocked && weatherSoundOn);
  }, [audioUnlocked, weatherSoundOn]);

  // The opening minutes (see firstVisit.ts). The summary waits, and a first
  // visit gets her greeting and one small thing to do.
  const [holdArrival, setHoldArrival] = useState(true);
  useEffect(() => {
    let firstVisit: boolean | null = null;
    let startedAt = 0;
    let greeted = false;
    let tasked = false;
    const iv = window.setInterval(() => {
      const data = stateRef.current;
      if (!data || !readyRef.current) return;
      const now = performance.now();
      if (firstVisit === null) {
        let seen = true;
        try { seen = localStorage.getItem("muse-town-arrival-v1") !== null; } catch { /* treat as seen */ }
        firstVisit = !seen && data.tree.waterings === 0;
        startedAt = now;
      }
      const elapsed = now - startedAt;
      if (firstVisit && !greeted && elapsed >= GREETING_MS) {
        greeted = true;
        sceneRef.current?.showBubble("muse", GATE_GREETINGS[Math.floor(Math.random() * GATE_GREETINGS.length)]!);
      }
      if (firstVisit && !tasked && elapsed >= FIRST_TASK_MS) {
        tasked = true;
        setFirstTask(true);
      }
      const walkZ = playerPosRef.current?.z ?? PLAYER.spawn[1];
      if (arrivalDue(firstVisit, walkZ, elapsed)) setHoldArrival(false);
      if (tasked && data.tree.waterings > 0) {
        setFirstTask(false);
        window.clearInterval(iv);
      } else if (!firstVisit && !holdArrivalRef.current) {
        window.clearInterval(iv);
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, []);
  const holdArrivalRef = useRef(holdArrival);
  const arrivalOpenRef = useRef(false);
  holdArrivalRef.current = holdArrival;

  // Her invitations: looked for on a slow timer, and only into a clear moment.
  useEffect(() => {
    let lastAskAt = performance.now();
    const iv = window.setInterval(() => {
      const scene = sceneRef.current;
      const hour = rhythmRef.current;
      const data = stateRef.current;
      if (!scene || !hour || !data || !walkingRef.current || holdArrivalRef.current || arrivalOpenRef.current) return;
      if (performance.now() - lastAskAt < 90000) return;
      if (panelOpenRef.current || museBubbleRef.current || followOfferRef.current || summitRef.current || guidingRef.current || !scene.canInvite()) return;
      const invite = chooseInvite(
        hour,
        { unreadLetters: data.letters.filter((l) => !l.read).length, gardenReady: !!data.garden.planted_on && data.garden.water_days >= 3, treeWatered: data.tree.watered_today },
        readInviteMemory(),
        Math.random(),
      );
      if (!invite) return;
      lastAskAt = performance.now();
      rememberInvite((memory) => ({ ...memory, asked: [...memory.asked, hour.part] }));
      followOfferRef.current = { id: invite.id, text: invite.text, guide: invite };
      setFollowOfferState(followOfferRef.current);
      // An unanswered question lapses; she doesn't stand there waiting.
      window.setTimeout(() => {
        if (followOfferRef.current?.guide !== invite) return;
        followOfferRef.current = null;
        setFollowOfferState(null);
      }, 30000);
    }, 15000);
    return () => window.clearInterval(iv);
  }, []);
  const acceptGuide = () => {
    const invite = followOfferRef.current?.guide;
    followOfferRef.current = null;
    setFollowOfferState(null);
    const scene = sceneRef.current;
    if (!invite || !scene) return;
    scene.setFollowMode(false);
    if (!scene.startGuide(invite.spot[0], invite.spot[1])) {
      if (followingRef.current) scene.setFollowMode(true);
      return;
    }
    guidingRef.current = invite;
    scene.showBubble("muse", "Come on, then. This way.");
  };
  guideEndRef.current = (arrived) => {
    const invite = guidingRef.current;
    guidingRef.current = null;
    if (followingRef.current) sceneRef.current?.setFollowMode(true);
    if (arrived && invite) sceneRef.current?.showBubble("muse", invite.arrival);
  };

  // --- Virtual Xbox controller (walk mode, touch) ---
  // The Xbox controller is the walk-mode control scheme: the analog left
  // joystick drives the same pad vector as the keyboard, dragging the
  // open view orbits the camera, and A/B/X/Y map to real interactions:
  //  A = Jump, like the space bar.
  //  B = Back, closing the open panel; on the move it slides instead,
  //      and standing still with nothing open it leaves walk mode.
  //      The C key slides too.
  //  X = Talk and interact, with no panel open, opens whatever the
  //      "X, …" prompt is showing; with a panel open, runs that panel's
  //      main action (chat with Aelia, water the tree, …). The keyboard
  //      interact keys, E or Enter, do exactly the same thing.
  //  Y = Special actions, pick up a loose stone / throw the held one
  //      (the hint lives on Y too, when no stone is in play).
  const xboxInteract = () => {
    // A advances the summit scene first while it runs, it is the
    // night's "next" button, ahead of every other conversation.
    if (summitRef.current) {
      advanceSummit();
      return;
    }
    // A advances an open Muse bubble before anything else, it is
    // the conversation's "next" button.
    if (museBubbleRef.current) {
      advanceMuseBubble();
      return;
    }
    // A strikes the fishing line inside the bite window.
    if (fishingRef.current) {
      if (fishing?.phase === "bite") reelIn();
      return;
    }
    if (marketOpen || knuckle || dockChoice || inscriptionId) {
      return;
    }
    if (boardOpen || questOpen || secretOpen) {
      return;
    }
    // No panel open and a prompt is showing: X opens that
    // interactable. This, a press, not an approach, is the one way
    // panels open in walk mode.
    if (!treeOpen && !youOpen && !selected && !weatherOpen && !lettersOpen && !goalsOpen) {
      const target = nearbyRef.current;
      if (target) {
        // Stones belong to Y (see xboxStone): X never picks up or
        // throws, so an X press facing a stone prompt does not
        // spend itself on the toy.
        if (target.kind === "stone") return;
        openInteractable(target.kind, target.id);
        return;
      }
    }
    if (treeOpen) {
      if (state.data && !state.data.tree.watered_today && !waterTree.isPending) {
        waterTree.mutate();
      } else {
        setHintText("The town tree is happy. It's already had today's water.");
        window.setTimeout(() => setHintText(null), 2600);
      }
      return;
    }
    if (selected?.id === "stars") {
      toggleNight();
      return;
    }
    if (selected?.id === "sounds") {
      playJar("piano");
      return;
    }
    if (selected) {
      setHintText(`${selected.name}, ${selected.greeting}`);
      window.setTimeout(() => setHintText(null), 3000);
      return;
    }
    setHintText("Walk up to Aelia, a house, or the town tree, when the X prompt appears, press X to interact.");
    window.setTimeout(() => setHintText(null), 3000);
  };

  // Keyboard interact: E or Enter is the same press as the Xbox A
  // button while walking. (Movement keys themselves live in the
  // scene, camera-relative like the joystick.)
  const xboxInteractRef = useRef(xboxInteract);
  xboxInteractRef.current = xboxInteract;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!walkingRef.current) return;
      const target = e.target as HTMLElement | null;
      // A tapped control button keeps focus; Space must still jump, not press it.
      const onControls = e.code === "Space" && !!target?.closest("[data-mt-controls]");
      if (
        target &&
        !onControls &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "e" || e.key === "E" || e.key === "Enter") {
        e.preventDefault();
        xboxInteractRef.current();
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) sceneRef.current?.jump();
      }
      if ((e.key === "c" || e.key === "C") && !e.repeat) sceneRef.current?.slide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The way back from the overview to Gaius (owner prescription,
  // Nov 2): the overview is not B's anymore, it lives in the town
  // menu both ways, and on screen this helper is what the Back to
  // Gaius chip under the cluster calls. It is the return the old
  // B fall-through used to perform: stop the tour, put the panels
  // away, and re-enter walk mode behind him.
  const backToGaius = () => {
    stopTour();
    setSelected(null);
    setMuseBubble(null);
    setYouOpen(false);
    setTreeOpen(false);
    setWeatherOpen(false);
    setBoardOpen(false);
    setQuestOpen(false);
    setSecretOpen(false);
    enterWalkMode();
  };

  const xboxBack = () => {
    // B steps away from the summit scene, postponing it, never
    // cancelling, before it dismisses anything else.
    if (summitRef.current) {
      postponeSummit();
      return;
    }
    // B dismisses an open Muse bubble before anything else.
    if (museBubbleRef.current) {
      setMuseBubble(null);
      return;
    }
    if (treeOpen || youOpen || selected || weatherOpen || boardOpen || questOpen || secretOpen || lettersOpen || postcardDraft || postcardView) {
      setTreeOpen(false);
      setYouOpen(false);
      setWeatherOpen(false);
      setBoardOpen(false);
      setQuestOpen(false);
      setSecretOpen(false);
      setLettersOpen(false);
      setPostcardDraft(null);
      setPostcardView(null);
      setSelected(null);
    } else if (rowingRef.current) {
      // B steps ashore, but only back at the dock, like A.
      if (!sceneRef.current?.disembarkBoat()) {
        setHintText("Row back to the dock to step ashore.");
        window.setTimeout(() => setHintText(null), 2600);
      }
    } else if (soakingRef.current) {
      // B steps out of the caldarium, towels waiting.
      endBathRef.current();
    } else if (seatedBenchRef.current) {
      // B stands him up from a bench before it ever leaves walk mode.
      sceneRef.current?.standUp();
    } else if (sceneRef.current?.slide()) {
      // On the move, B is the slide.
    }
    // Standing still, B does nothing more (owner prescription,
    // Nov 2): the overview is not B's anymore. It lives in the
    // town menu both ways, and the way back on screen is the
    // Back to Gaius chip under the cluster. A refused slide can
    // no longer turn this press into a camera move, which is
    // what kept sending running players into the overview.
  };

  const xboxHint = () => {
    showHint();
    sceneRef.current?.greetMuse();
  };
  const xboxHintRef = useRef(xboxHint);
  xboxHintRef.current = xboxHint;

  // X = Stones (owner ask, Nov 1): X picks up a loose stone at his
  // feet and X again throws the one he is holding, in his facing
  // direction, the scene owns the carry, the arc, the skim, and
  // the splash, exactly as it did when the toy lived on the A
  // prompt. The move is a MOVE: A no longer picks up or throws
  // (see the guard in xboxInteract), while every other A duty is
  // untouched. With no stone in play, not carrying, and none
  // within the scene's pickup reach, X keeps its old hint duty,
  // so the button is never dead.
  const xboxStone = () => {
    const scene = sceneRef.current;
    if (!scene) {
      xboxHint();
      return;
    }
    if (scene.hasCarriedStone()) {
      scene.throwStone();
      return;
    }
    // Near Aelia, Y is the follow switch (Task 48); away from her, stones and hints.
    if (nearbyRef.current?.kind === "muse") {
      toggleFollowRef.current();
      return;
    }
    scene.pickUpStone();
    if (!scene.hasCarriedStone()) xboxHint();
  };
  const xboxBackRef = useRef(xboxBack);
  xboxBackRef.current = xboxBack;
  const xboxStoneRef = useRef(xboxStone);
  xboxStoneRef.current = xboxStone;

  // --- Physical gamepads and the pad2 keyboard (Task 3) ---------------
  // One poll per frame reads the Gamepad API. Seats come from
  // padRouting: the first pad to announce itself drives Gaius exactly
  // as the virtual controller does (stick to setWalkMove, A jump, B
  // back or slide, X interact, Y stones); the next distinct pad is
  // pad2 and drives Aelia through the scene's player-2 channel (stick,
  // A jump, B slide, X sit or wave). With no second pad, IJKL and U,
  // O, P stand in for it so the feature is testable on a desk. The
  // stick writes only while live or on the frame it centres, so the
  // touch stick and a physical one never fight over a zero.
  useEffect(() => {
    let seats: PadSeats = noPads();
    const prevButtons = new Map<number, boolean[]>();
    const keys = new Set<string>();
    let p1Live = false;
    let p1OrbitLive = false;
    let p2Live = false;
    let kbLive = false;
    let lastStatus = "";
    const typing = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const key = e.key.toLowerCase();
      // Y on the keyboard: the stone verb the on-screen Y already
      // carries (the Nov 5 hosted verification found no key for it).
      if (key === "y" && !e.repeat && walkingRef.current) {
        e.preventDefault();
        xboxStoneRef.current();
        return;
      }
      if (key === "t" && !e.repeat && walkingRef.current) {
        toggleFollowRef.current();
        return;
      }
      if ((key === "g" || key === "r") && !e.repeat && walkingRef.current) {
        triggerPressRef.current(key === "r" ? "LT" : "RT");
        return;
      }
      if ((key === "h" || key === "f") && !e.repeat && walkingRef.current) {
        shoulderPressRef.current(key === "f" ? "LB" : "RB");
        return;
      }
      if (!isPad2Key(key)) return;
      keys.add(key);
      const button = keyboardButton(key);
      if (button && !e.repeat) sceneRef.current?.pad2Press(button, "keyboard");
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };
    let raf = 0;
    const poll = () => {
      raf = window.requestAnimationFrame(poll);
      const scene = sceneRef.current;
      if (!scene) return;
      const pads =
        typeof navigator.getGamepads === "function"
          ? Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => !!pad && pad.connected)
          : [];
      seats = routePads(seats, pads.map((pad) => ({ index: pad.index, id: pad.id })));
      const padFor = (seat: PadSeats["p1"]) => (seat ? pads.find((pad) => pad.index === seat.index) ?? null : null);
      const g1 = padFor(seats.p1);
      if (g1) {
        const stick = stickVector(g1.axes[0] ?? 0, g1.axes[1] ?? 0);
        const live = stick.x !== 0 || stick.y !== 0;
        if (live || g1.buttons.some((b) => b.pressed) || rightStickVector(g1.axes).x !== 0 || rightStickVector(g1.axes).y !== 0) {
          lastPadInputRef.current = performance.now();
        }
        if ((live || p1Live) && walkingRef.current) setPad(stick.x, stick.y);
        p1Live = live;
        const now = buttonsDown(g1.buttons);
        const was = prevButtons.get(g1.index) ?? [];
        for (const button of pressedButtons(was, now)) {
          if (!walkingRef.current) continue;
          if (button === "a") scene.jump();
          else if (button === "b") xboxBackRef.current();
          else if (button === "x") xboxInteractRef.current();
          else xboxStoneRef.current();
        }
        // The shoulders (standard mapping: LB 4, RB 5) take the same
        // route as the on-screen LB and RB.
        for (const side of pressedShoulders(was, now)) shoulderPressRef.current(side);
        // The triggers (LT 6, RT 7): the gladius and the shield, as on screen.
        if (walkingRef.current) for (const side of pressedTriggers(was, now)) triggerPressRef.current(side);
        // The right stick orbits the follow camera and R3 recenters it
        // (owner's ask, Nov 6, 2026); the stick writes while live or on
        // the frame it centres, like the left one.
        const orbit = rightStickVector(g1.axes);
        const orbitLive = orbit.x !== 0 || orbit.y !== 0;
        if ((orbitLive || p1OrbitLive) && walkingRef.current) scene.orbitCamera(orbit.x, orbit.y);
        p1OrbitLive = orbitLive;
        if (walkingRef.current && pressedSticks(was, now).includes("R3")) scene.recenterCamera();
        prevButtons.set(g1.index, now);
      }
      const g2 = padFor(seats.p2);
      if (g2) {
        const stick = stickVector(g2.axes[0] ?? 0, g2.axes[1] ?? 0);
        const live = stick.x !== 0 || stick.y !== 0;
        if (live || p2Live) scene.setPad2Move(stick.x, stick.y, "pad");
        p2Live = live;
        const now = g2.buttons.map((b) => b.pressed);
        for (const button of pressedButtons(prevButtons.get(g2.index) ?? [], now)) {
          if (button !== "y") scene.pad2Press(button, "pad");
        }
        prevButtons.set(g2.index, now);
      }
      const driving = performance.now() - lastPadInputRef.current < PAD_HIDE_MS;
      if (driving !== padDrivingRef.current) {
        padDrivingRef.current = driving;
        setPadDriving(driving);
      }
      const kb = keyboardStick(keys);
      const kbNow = kb.x !== 0 || kb.y !== 0;
      if (kbNow || kbLive) scene.setPad2Move(kb.x, kb.y, "keyboard");
      kbLive = kbNow;
      const status = pad2StatusLine({
        padConnected: seats.p2 !== null,
        driver: scene.aeliaDriver(),
        following: followingRef.current,
        harness: driverFollowRef.current,
      });
      if (status !== lastStatus) {
        lastStatus = status;
        setPad2Status(status);
      }
    };
    raf = window.requestAnimationFrame(poll);
    // A touch or click brings the on-screen controls back at once.
    const onAnyPointer = () => {
      lastPadInputRef.current = 0;
    };
    window.addEventListener("pointerdown", onAnyPointer, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onAnyPointer, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setPad]);

  // The follow harness toggle cycles off, beside, behind.
  const cycleDriverFollow = () => {
    const next: FollowOffset | "off" = driverFollow === "off" ? "beside" : driverFollow === "beside" ? "behind" : "off";
    setDriverFollow(next);
    sceneRef.current?.setDriverFollow(next);
  };

  // --- Muse Visits (Task 4): lifecycle, the beat, and enactment ------
  const publishVisit = useCallback((director?: VisitDirectorState) => {
    const s = visitRef.current;
    const now = Date.now();
    if (!s.composing) composingSinceRef.current = null;
    else if (composingSinceRef.current === null) composingSinceRef.current = now;
    const composing = s.active && composingVisible(s.composing, composingSinceRef.current, finalLineAtRef.current, now);
    const lapseDue = s.active && s.heartbeatAt !== null ? s.heartbeatAt + VISIT_LAPSE_MS : null;
    const lapseAt = lapseDue !== null && lapseDue - now < LAPSE_WARN_MS ? lapseDue : null;
    // The open visit rides this tab's session across a reload.
    saveVisitResume(sessionStore(), s, visitThreadRef.current, bridgeCursorRef.current, now);
    setVisitUi((ui) => {
      const next = {
        active: s.active,
        intention: s.intention,
        composing,
        thread: visitThreadRef.current,
        director: director ?? (s.active ? ui.director : "none"),
        lapseAt,
        seenAt: s.active ? directorSeenAtRef.current : null,
      };
      // While a director is reading, the stamp moves every beat; the
      // line does not show it then, so it must not re-render the shell.
      if (next.director === "live") next.seenAt = ui.seenAt;
      // A quiet beat changes nothing: no re-render of the shell.
      return next.active === ui.active && next.intention === ui.intention && next.composing === ui.composing && next.thread === ui.thread && next.director === ui.director && next.lapseAt === ui.lapseAt && next.seenAt === ui.seenAt ? ui : next;
    });
  }, []);
  const beginVisitNow = useCallback((by: "you" | "director" = "you") => {
    if (visitRef.current.active) return;
    visitRef.current = beginVisit(visitRef.current, Date.now());
    visitThreadRef.current = [];
    visitLastFrameAtRef.current = null;
    bridgeCursorRef.current = emptyBridgeCursor();
    bridgeFailsRef.current = 0;
    directorSeenAtRef.current = null;
    composingSinceRef.current = null;
    finalLineAtRef.current = null;
    sceneRef.current?.setVisitActive(true);
    publishVisit("none");
    setVisitNotice({
      text: by === "director"
        ? "Muse opened a visit. Talk to Aelia and type to her; Muse answers through her."
        : "Visit open. Now talk to Aelia and type to her; Muse answers through her. The violet chip shows whether she is connected.",
      at: Date.now(),
      holdMs: 12_000,
    });
  }, [publishVisit]);
  const endVisitNow = useCallback((reason: VisitCloseReason = "you") => {
    if (!visitRef.current.active) return;
    // The slate dies whole: inbox, frames, intention, queue, events.
    visitRef.current = endVisit(visitRef.current);
    visitThreadRef.current = [];
    visitLastFrameAtRef.current = null;
    bridgeCursorRef.current = emptyBridgeCursor();
    bridgeFailsRef.current = 0;
    sceneRef.current?.setVisitActive(false);
    publishVisit("none");
    clearVisitResume(sessionStore());
    setVisitNotice({ text: visitClosedLine(reason, VISIT_LAPSE_MS), at: Date.now() });
    // The bridge hears the visit closed now rather than at its lapse.
    void bridgeClose(bridgeRef.current);
  }, [publishVisit]);
  const visitRefs = useRef({ beginVisitNow, endVisitNow });
  visitRefs.current = { beginVisitNow, endVisitNow };
  /** Enact one direction: speak, intend and look belong to the shell
   *  (her bubble, the panel, the sight half); the body verbs go to
   *  the scene. Returns the slate after the direction. */
  const enactVisitDirection = (s: VisitSlate, q: QueuedDirection): VisitSlate => {
    const scene = sceneRef.current;
    const d = q.direction;
    switch (d.kind) {
      case "speak": {
        const partial = d.partial === true;
        if (partial) scene?.showBubbleGrowing(d.text);
        else scene?.showBubble("muse", d.text);
        visitThreadRef.current = threadWithSpeak(visitThreadRef.current, d.text, d.lineId, partial);
        if (partial) return s;
        // Her line has landed: the writing line goes with it.
        finalLineAtRef.current = Date.now();
        return setComposing(s, false);
      }
      case "intend":
        return setIntention(s, d.text);
      case "look":
        return requestLook(s);
      default: {
        const taken = scene?.visitDirect(d) ?? false;
        return taken ? recordEvent(s, Date.now(), `enacted ${d.kind}`) : s;
      }
    }
  };
  /** Enact everything queued, in order. The harness beat and the
   *  bridge leg both land here, so a direction is applied one way. */
  const drainVisitQueue = (s: VisitSlate): VisitSlate => {
    for (;;) {
      const step = nextDirection(s);
      s = step.slate;
      if (!step.next) break;
      s = enactVisitDirection(s, step.next);
    }
    return s;
  };
  const visitBeat = async () => {
    const scene = sceneRef.current;
    const harness = harnessRef.current;
    const now = Date.now();
    let s = visitRef.current;
    // A hidden tab never lapses its visit: a phone that parks the tab
    // is not a director going quiet. The lapse is judged on return.
    const shown = typeof document === "undefined" || document.visibilityState === "visible";
    if (s.active && shown && visitLapsed(s, now)) {
      visitRefs.current.endVisitNow("lapse");
      return;
    }
    if (s.active && scene) {
      const telemetry = scene.visitTelemetry();
      for (const text of telemetryEvents(s.telemetry, telemetry)) s = recordEvent(s, now, text);
      s = setTelemetry(s, telemetry);
      const foreground = typeof document === "undefined" || document.visibilityState === "visible";
      let frameLanded = false;
      // A night together is private: no frame from the hush to the morning's end (Task 45).
      if (!privateMomentRef.current && frameDue({ lastFrameAt: visitLastFrameAtRef.current, now, lookRequested: s.lookRequested, foreground })) {
        const shot = scene.captureVisitFrame(FRAME_MAX_EDGE, FRAME_JPEG_QUALITY);
        const check = shot ? validateFrameDataUrl(shot.dataUrl) : null;
        if (shot && check?.ok) {
          s = acceptFrame(s, { dataUrl: shot.dataUrl, width: shot.width, height: shot.height, bytes: check.bytes }, now);
          visitLastFrameAtRef.current = now;
          frameLanded = true;
        }
      }
      visitRef.current = s;
      if (frameLanded) bridgeNudgeRef.current();
    }
    if (!harness?.configured) {
      // No seam: the bridge leg (if any) owns the director state; this
      // beat only refreshes the panel, and never overwrites "live".
      publishVisit();
      return;
    }
    const newFrames = unsentFrames(s);
    const res = await syncWithHarness(harness.url, { state: stateView(s), inbox: s.inbox, newFrames, enactedThrough: s.enactedThrough });
    s = visitRef.current;
    if (!res) {
      publishVisit(s.active ? "unreachable" : undefined);
      return;
    }
    const director = res.directorSeenAt !== null && now - res.directorSeenAt < 15_000 ? "live" : "none";
    if (!s.active) {
      if (res.begin) visitRefs.current.beginVisitNow("director");
      return;
    }
    // The seam answered: the visit is alive while the tab is.
    s = heartbeat(s, now);
    s = markFramesSent(s, newFrames.map((f) => f.id));
    s = setComposing(s, res.composing);
    if (res.end) {
      visitRef.current = s;
      visitRefs.current.endVisitNow("director");
      return;
    }
    s = absorbDirections(s, res.directions, now);
    visitRef.current = drainVisitQueue(s);
    publishVisit(director);
  };
  const visitBeatRef = useRef(visitBeat);
  visitBeatRef.current = visitBeat;
  useEffect(() => {
    // The beat: every VISIT_POLL_MS while a visit is open; the idle
    // glance (a director's begin request) only with a harness named.
    const configured = harnessRef.current?.configured ?? false;
    if (!visitUi.active && !configured) return;
    const period = visitUi.active ? VISIT_POLL_MS : IDLE_GLANCE_MS;
    let busy = false;
    const tick = () => {
      if (busy) return;
      busy = true;
      void visitBeatRef.current().finally(() => {
        busy = false;
      });
    };
    tick();
    const timer = window.setInterval(tick, period);
    return () => window.clearInterval(timer);
  }, [visitUi.active]);
  // The Live Bridge leg (Task 7; held reads since Task 41). Two halves:
  // the snapshot goes out at once on new mail or a fresh frame, and on a
  // slow heartbeat (SNAPSHOT_HEARTBEAT_MS) otherwise; the directions come
  // back on one held read at a time, which the bridge answers the moment
  // something new is there (a direction, a begin or end, the composing
  // flag turning over) or after BRIDGE_HOLD_S. In through the seam
  // validator and the same enactment as the harness.
  const noteBridgeOutcome = (outcome: "ok" | "unreachable" | "refused") => {
    if (outcome === "ok") {
      bridgeFailsRef.current = 0;
      return true;
    }
    // One slow call is not an outage: "unreachable" only after a few in
    // a row; a refused token says so at once.
    bridgeFailsRef.current += 1;
    if (outcome === "refused" || bridgeFailsRef.current >= UNREACHABLE_AFTER_FAILS) publishVisit(outcome);
    else publishVisit();
    return false;
  };
  const bridgeSend = async () => {
    const pushed = await bridgePush({ settings: bridgeRef.current, read: () => visitRef.current, cursor: bridgeCursorRef.current });
    if (!pushed) return;
    if (!noteBridgeOutcome(pushed.outcome)) return;
    bridgeCursorRef.current = { ...bridgeCursorRef.current, ackedSeq: pushed.ackedSeq, sentFrameId: pushed.sentFrameId };
    // The bridge answered: the visit is alive as long as the tab is
    // open and reaching it; it lapses only after VISIT_LAPSE_MS with no
    // contact at all.
    visitRef.current = heartbeat(visitRef.current, Date.now());
  };
  const bridgeRead = async (signal: AbortSignal) => {
    const result = await bridgePull({ settings: bridgeRef.current, read: () => visitRef.current, cursor: bridgeCursorRef.current, now: Date.now, waitS: BRIDGE_HOLD_S, signal });
    if (signal.aborted) return { got: false, ok: false };
    if (!result || !result.slate.active) return { got: false, ok: true };
    if (!noteBridgeOutcome(result.outcome)) return { got: false, ok: false };
    bridgeCursorRef.current = { ...bridgeCursorRef.current, pulledThrough: result.cursor.pulledThrough };
    if (result.ended) {
      // The director ended it through the hosted door: the town folds
      // the visit itself, exactly as it folds a harness end.
      visitRef.current = result.slate;
      visitRefs.current.endVisitNow("director");
      return { got: true, ok: true };
    }
    if (result.directorSeenAt !== null) directorSeenAtRef.current = result.directorSeenAt;
    visitRef.current = drainVisitQueue(heartbeat(result.slate, Date.now()));
    publishVisit(result.directorSeenAt !== null && Date.now() - result.directorSeenAt < DIRECTOR_LIVE_WINDOW_MS ? "live" : "none");
    return { got: result.queued + result.refused > 0, ok: true };
  };
  const bridgeSendRef = useRef(bridgeSend);
  bridgeSendRef.current = bridgeSend;
  const bridgeReadRef = useRef(bridgeRead);
  bridgeReadRef.current = bridgeRead;
  const bridgeOn = visitUi.active && bridgeConfigured(activeBridge);
  useEffect(() => {
    if (!bridgeOn) return;
    let alive = true;
    const stop = new AbortController();
    // The send half: at once when nudged (new mail, a frame), else on the heartbeat.
    let busy = false;
    let again = false;
    const send = () => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      void bridgeSendRef.current().finally(() => {
        busy = false;
        if (again && alive) {
          again = false;
          send();
        }
      });
    };
    bridgeNudgeRef.current = send;
    send();
    const heartbeatTimer = window.setInterval(send, SNAPSHOT_HEARTBEAT_MS);
    // The read half: one held read after another, never closer than
    // BRIDGE_BEAT_MS when an answer comes back at once with nothing in it
    // (an older bridge that does not hold), and backing off on failure.
    void (async () => {
      while (alive) {
        const started = Date.now();
        const r = await bridgeReadRef.current(stop.signal);
        if (!alive) break;
        const quick = Date.now() - started < 1000;
        if (!r.ok) await sleepFor(BRIDGE_BEAT_MS * 2, stop.signal);
        else if (quick && !r.got) await sleepFor(BRIDGE_BEAT_MS, stop.signal);
      }
    })();
    return () => {
      alive = false;
      stop.abort();
      window.clearInterval(heartbeatTimer);
      bridgeNudgeRef.current = () => {};
    };
  }, [bridgeOn, activeBridge?.url, activeBridge?.token]);
  // The hosted town's idle glance (Task 8; held since Task 41): with no
  // visit open and the town's own door as the bridge, one held read at a
  // time to hear a director's begin request. An owner-entered bridge is
  // never glanced at idle.
  const glanceOn = !visitUi.active && !!hostedBridge && !bridgeConfigured(bridgeSettings);
  useEffect(() => {
    if (!glanceOn) return;
    let alive = true;
    const stop = new AbortController();
    void (async () => {
      while (alive) {
        const started = Date.now();
        const heard = await bridgeGlance(hostedBridge, fetch, BRIDGE_HOLD_S, stop.signal);
        if (!alive) break;
        if (heard?.begin) {
          visitRefs.current.beginVisitNow("director");
          break;
        }
        // An answer that came back at once (no hold, or the door away)
        // waits the old idle glance's gap before asking again.
        if (Date.now() - started < 1000) await sleepFor(IDLE_GLANCE_MS, stop.signal);
      }
    })();
    return () => {
      alive = false;
      stop.abort();
    };
  }, [glanceOn, hostedBridge]);

  // A visit picked up after a reload (fix list, Nov 7, 2026): the
  // tab's session holds the open visit, its counters, the bridge
  // cursor and the transcript, so the director sees it carry on.
  const visitResumedRef = useRef(false);
  useEffect(() => {
    if (!sceneReady || visitResumedRef.current) return;
    visitResumedRef.current = true;
    const resumed = loadVisitResume(sessionStore(), Date.now());
    if (!resumed || visitRef.current.active) return;
    visitRef.current = resumed.slate;
    visitThreadRef.current = resumed.thread;
    bridgeCursorRef.current = resumed.cursor;
    visitLastFrameAtRef.current = null;
    sceneRef.current?.setVisitActive(true);
    publishVisit("none");
    setVisitNotice({ text: "Back where you left off: the visit is still open, and Muse can carry on.", at: Date.now(), holdMs: 20_000 });
  }, [sceneReady, publishVisit]);
  // Coming back to the tab counts as the tab being open: the heartbeat
  // is refreshed and the bridge is asked at once, not on the next tick.
  // A visit lives on while the tab is away (Task 33): the bridge holds
  // it in the background and queues her lines; coming back says so.
  // Closing the tab (or leaving the page) tells the bridge, which ends
  // the visit after a short grace unless a reload reports it again.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onShow = () => {
      if (document.visibilityState !== "visible") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (!visitRef.current.active) return;
      visitRef.current = heartbeat(visitRef.current, Date.now());
      publishVisit();
      bridgeNudgeRef.current();
      if (away > VISIT_AWAY_NOTICE_MS) {
        setVisitNotice({ text: "Back where you left off. The visit stayed open while you were away.", at: Date.now(), holdMs: 10_000 });
      }
    };
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted || !visitRef.current.active) return;
      bridgeLeaving(bridgeRef.current);
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [publishVisit, setVisitNotice]);

  const selectPlace = (place: Place) => {
    exitWalkMode();
    stopTour();
    setMuseBubble(null);
    setYouOpen(false);
    setTreeOpen(false);
    setWeatherOpen(false);
    setSelected(place);
    // exitWalk flies back to the saved camera first; queue the place flight after it.
    window.setTimeout(() => {
      sceneRef.current?.flyTo(place.cameraPos, place.cameraTarget);
    }, 60);
  };

  const goOverview = () => {
    exitWalkMode();
    stopTour();
    setSelected(null);
    setMuseBubble(null);
    setYouOpen(false);
    setTreeOpen(false);
    setWeatherOpen(false);
    window.setTimeout(() => {
      sceneRef.current?.flyTo(OVERVIEW_POS, OVERVIEW_TARGET);
    }, 60);
  };

  const selectTree = () => {
    exitWalkMode();
    stopTour();
    setSelected(null);
    setMuseBubble(null);
    setYouOpen(false);
    setWeatherOpen(false);
    setTreeOpen(true);
    window.setTimeout(() => {
      sceneRef.current?.flyTo(TOWN_TREE.cameraPos, TOWN_TREE.cameraTarget, 1200);
    }, 60);
  };

  /** The one talk with her (Task 23): the A prompt, the menu's Aelia
   *  row and the You panel's chip all land here, so the panel opens
   *  the same way every time, with the same lines and the same input.
   *  Walking, a talk keeps him on his feet and the camera behind him;
   *  from the overview, the camera strolls over to her spot. (A first
   *  talk of the day carries the day's extra lines, letters, notes,
   *  so the page count can differ between one talk and the next, but
   *  never between the two ways in.) */
  const talkToAelia = () => {
    const onFoot = walkingRef.current;
    stopTour();
    setSelected(null);
    setTreeOpen(false);
    setYouOpen(false);
    setWeatherOpen(false);
    setBoardOpen(false);
    setQuestOpen(false);
    setSecretOpen(false);
    setLettersOpen(false);
    openTalkBubble();
    if (nightRef.current) completeQuestRef.current("greet-at-night");
    sceneRef.current?.greetMuse();
    if (!onFoot) sceneRef.current?.flyTo(MUSE.cameraPos, MUSE.cameraTarget, 1200);
  };
  const talkToAeliaRef = useRef(talkToAelia);
  talkToAeliaRef.current = talkToAelia;
  const selectMuse = () => talkToAelia();

  const selectYou = () => {
    stopTour();
    setSelected(null);
    setMuseBubble(null);
    setTreeOpen(false);
    setWeatherOpen(false);
    setYouOpen(true);
  };

  const selectWeather = () => {
    stopTour();
    setSelected(null);
    setMuseBubble(null);
    setTreeOpen(false);
    setYouOpen(false);
    setWeatherOpen(true);
  };

  // Menu entries for the town boards (UI review grouping): the
  // project board, quest board, and letters desk used to be reachable
  // only by walking to them; the grouped menu's Town section opens
  // the same panels with the same panel-closing discipline the
  // walk-up interactables use.
  const closeTownPanels = () => {
    setUtilitiesOpen(false);
    setSelected(null);
    setMuseBubble(null);
    setYouOpen(false);
    setTreeOpen(false);
    setWeatherOpen(false);
    setBoardOpen(false);
    setQuestOpen(false);
    setSecretOpen(false);
    setLettersOpen(false);
    setGoalsOpen(false);
    setMapOpen(false);
  };
  const selectMap = () => {
    stopTour();
    closeTownPanels();
    setMapOpen(true);
  };
  const selectBoard = () => {
    stopTour();
    closeTownPanels();
    setBoardOpen(true);
    unlockRef.current("town-crier");
  };
  const selectQuests = () => {
    stopTour();
    closeTownPanels();
    setQuestOpen(true);
  };
  const selectLetters = () => {
    stopTour();
    closeTownPanels();
    setLettersOpen(true);
  };
  const selectGarden = () => {
    const place = PLACES.find((p) => p.id === "garden");
    if (place) selectPlace(place);
  };

  // The in-town landscape switch: turns the whole stage sideways from
  // within (the host app window never rotates, see the state note at
  // the top). Any live stick input is centred first, so a thumb mid-
  // drag never carries a portrait vector into the turned world.
  const toggleForcedLandscape = useCallback(() => {
    const next = !forcedLandscapeRef.current;
    forcedLandscapeRef.current = next;
    stickPointer.current = null;
    placeStickKnob(0, 0);
    setPad(0, 0);
    setForcedLandscape(next);
  }, [setPad]);

  // Keep the scene's pointer remapping in step with the switch, and
  // re-apply it to a scene created after the switch was flipped.
  useEffect(() => {
    sceneRef.current?.setForcedLandscape(forcedLandscape);
  }, [forcedLandscape, sceneReady]);

  const toggleWalk = () => {
    if (walking) {
      exitWalkMode();
    } else {
      stopTour();
      setSelected(null);
      setMuseBubble(null);
      setYouOpen(false);
      setTreeOpen(false);
      setWeatherOpen(false);
      setBoardOpen(false);
      setQuestOpen(false);
      setSecretOpen(false);
      enterWalkMode();
    }
  };

  // While any panel, menu, chat, or offer is open, the walk controls
  // step aside entirely, they used to float on top of Muse's panel
  // and cover her message box. Closing the panel (its ✕, or B) brings
  // the controls back.
  const anyPanelOpen = !!(
    museBubble || youOpen || treeOpen || weatherOpen || boardOpen || questOpen || goalsOpen || mapOpen ||
    secretOpen || lettersOpen || selected || postcardDraft || postcardView ||
    menuOpen || utilitiesOpen || followOffer || marketOpen || dockChoice || inscriptionId || fishing || knuckle
  );
  // Walk-and-talk (user ask, Nov 1): Aelia's TALK BUBBLE is not a
  // full panel, the stick and ABXY stay visible and live while it
  // is open, so he can stroll mid-conversation and she follows and
  // talks as usual. Full panels (letters, boards, Stories…) still
  // hide the controls exactly as before. Input conflicts resolve
  // thus: the stick is its own pointer surface (it never focuses
  // or types into the chat input, and the bubble sits top-centre,
  // clear of the bottom-left stick); the X button already gives an
  // open bubble first claim (it advances/closes the conversation,
  // see xboxInteract), so X never interacts with the world while
  // she is talking; typing keeps the keyboard, and the scene's key
  // handler ignores keystrokes aimed at inputs, so WASD typed into
  // the chat never walks him.
  // Her invitations are a word in passing, so he keeps walking through one.
  const anyFullPanelOpen = !!(
    youOpen || treeOpen || weatherOpen || boardOpen || questOpen || goalsOpen || mapOpen ||
    secretOpen || lettersOpen || selected || postcardDraft || postcardView ||
    menuOpen || utilitiesOpen || (followOffer && !followOffer.guide) || marketOpen || dockChoice || inscriptionId || fishing || knuckle
  );
  panelOpenRef.current = anyFullPanelOpen;
  // The overview keeps its controls (owner ask, Nov 1): entering the
  // overview does NOT unmount the ABXY cluster; its buttons keep
  // their ordinary duties there and B still dismisses a panel or
  // bubble. Since Nov 2 the overview is not B's to toggle, in
  // either direction: it is entered and left from the town menu,
  // and the Back to Gaius chip under the cluster is the on-screen
  // way back. The cluster may show in the overview only while the
  // town screen itself owns the view, not while a dream or the
  // guided tour is running; full panels still hide it via
  // anyFullPanelOpen above, exactly as they do in walk mode.
  const overviewControlsLive = sceneReady && !dreaming && tourStep === null;
  // Loose follow camera hold (Nov 2): while her talk bubble or any
  // panel owns the screen, the scene's follow camera must not
  // auto-rotate at all. The player may be reading, not walking.
  useEffect(() => {
    sceneRef.current?.setCameraHold(anyPanelOpen);
  }, [anyPanelOpen, sceneReady]);
  useEffect(() => {
    if (!anyFullPanelOpen) return;
    // A hidden joystick must not keep walking: centre it and stop.
    // (Keyed on full panels only, her talk bubble no longer hides
    // the stick, so it no longer stops a held stride either.)
    stickPointer.current = null;
    placeStickKnob(0, 0);
    setPad(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyFullPanelOpen]);

  const tourStop = tourStep !== null ? TOUR_STOPS[tourStep] : undefined;

  const currentWeather = weather ? weatherInfo(weather.id) : null;
  const weatherSecondsLeft =
    weather && !weather.manual && weather.endsAt
      ? Math.max(0, Math.round((weather.endsAt - nowTick) / 1000))
      : null;
  const weatherCountdown =
    weatherSecondsLeft !== null
      ? `${Math.floor(weatherSecondsLeft / 60)}:${String(weatherSecondsLeft % 60).padStart(2, "0")}`
      : null;

  // Loading progress, in stages the visitor can follow: the shell
  // (streets, plaza, tree) is procedural and paints first; then the
  // streamed pieces count up through the stages below.
  const loadRatio =
    loadProgress && loadProgress.total > 0 ? loadProgress.settled / loadProgress.total : 0;
  const loadStage = !sceneReady
    ? "Laying the cobblestones…"
    : loadRatio < 0.4
      ? "Raising temples, houses and the Colosseum…"
      : loadRatio < 0.8
        ? "Planting trees and dressing the market…"
        : loadRatio < 1
          ? "Aelia and the Centurion are arriving…"
          : "Opening the gates…";
  const stillStreaming =
    sceneReady && loadProgress !== null && loadProgress.total > 0 && loadProgress.settled < loadProgress.total;

  // Which transient banners may show right now (banner discipline):
  // portrait caps the stack at the two newest live banners; the
  // weather banner's offset below the found banner only applies
  // when both are actually visible.
  const liveBanners = bannerOrder.filter(
    (k) =>
      (k === "found" && !!foundBanner) ||
      (k === "achievement" && !!achievementToast) ||
      (k === "weather" && !!weatherBanner),
  );
  const visibleBanners = new Set(isLandscape ? liveBanners : liveBanners.slice(-2));
  const foundBannerVisible = !!foundBanner && visibleBanners.has("found");
  const achievementToastVisible = !!achievementToast && visibleBanners.has("achievement");
  const weatherBannerVisible = !!weatherBanner && visibleBanners.has("weather");
  // Stack offsets so two visible banners sit one under the other
  // instead of on top of each other (the weather banner already
  // stepped below the found banner; the achievement toast now does
  // the same, and weather steps below both).
  const achievementOffset = foundBannerVisible ? 52 : 0;
  const weatherOffset = (foundBannerVisible ? 52 : 0) + (achievementToastVisible ? 52 : 0);

  // Landscape layout: side-docked panels + compact bars so a sideways
  // phone keeps the town centre clear. Portrait keeps the bottom sheets.
  const panelClass = (bg: string) =>
    isLandscape
      ? `mt-scrollable absolute top-[62px] right-3 bottom-[58px] z-10 ${forcedLandscape ? "w-[min(370px,46%)]" : "w-[min(370px,46vw)]"} overflow-y-auto rounded-3xl ${bg} p-4 shadow-2xl backdrop-blur`
      : `mt-scrollable absolute inset-x-3 bottom-24 z-10 max-h-[56vh] overflow-y-auto rounded-3xl ${bg} p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-24 sm:w-96`;

  return (
    <div
      ref={rootRef}
      className="font-display mt-game-surface fixed inset-0 touch-none overflow-hidden bg-[#a8d8ea] text-white select-none"
      style={
        forcedLandscape
          ? {
              // The turned stage: laid out at the SWAPPED box (long side
              // as width, short side as height), centred on the portrait
              // viewport, then rotated 90° clockwise about its centre,
              // its footprint lands exactly back on the viewport, but
              // everything inside (canvas, bars, panels, stick, ABXY)
              // lives in a true landscape box and reads correctly to a
              // phone held sideways. DOM hit-testing follows the
              // transform natively; the custom pointer vectors (stick,
              // walk-drag, pick, orbit) are remapped in their handlers.
              width: "100dvh",
              height: "100dvw",
              left: "50%",
              top: "50%",
              right: "auto",
              bottom: "auto",
              transform: "translate(-50%, -50%) rotate(90deg)",
            }
          : { height: "100dvh" }
      }
      data-orientation={isLandscape ? "landscape" : "portrait"}
      data-forced-landscape={forcedLandscape ? "1" : undefined}
    >
      <canvas
        ref={canvasRef}
        className="mt-game-surface absolute inset-0 h-full w-full touch-none"
        onContextMenu={(e) => e.preventDefault()}
        aria-label={
          walking
            ? "Muse Town on foot as Gaius, use the joystick, WASD, or arrow keys to stroll around, drag the view to look around, double tap it to bring the camera home, and walk up to Aelia to interact"
            : "Muse Town 3D village. Drag to look around, tap a house to visit it, or use Landscape in the town menu to turn the town sideways"
        }
      />

      <TownUtilities open={utilitiesOpen} onClose={() => setUtilitiesOpen(false)} scene={sceneRef} state={state.data} holdArrival={holdArrival} onArrivalOpen={(open) => { arrivalOpenRef.current = open; }} ready={sceneReady} lowGraphics={lowGfx} onLowGraphicsChange={setLowGfx} bridge={bridgeSettings} onBridgeChange={updateBridgeSettings}
        onNavigate={(destination) => {
          if (destination === "letters") selectLetters();
          else if (destination === "garden") selectGarden();
          else if (destination === "quests") selectQuests();
          else { closeTownPanels(); setTreeOpen(true); }
        }} />

      {/* Soft cinematic vignette over the 3D view */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 58%, rgba(24, 42, 32, 0.16) 100%)",
        }}
      />

      {/* Loading screen: up from the first React frame until the
          scene renders. The town is never a bare black rectangle.
          Buildings and characters stream in after it lifts. */}
      {!sceneReady && !webglError && !renderFailed && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#7db8e6] via-[#a8d4ee] to-[#d8f0e2] px-6 text-center"
          role="status"
          aria-label="Muse Town is loading"
          // The town itself, still, while it loads (Task 41): the same picture the HTML splash shows.
          style={{ background: 'linear-gradient(to bottom, rgba(125,184,230,0.35), rgba(216,240,226,0.6)), url("./town-still.jpg") center / cover no-repeat, linear-gradient(to bottom, #7db8e6, #a8d4ee 55%, #d8f0e2)' }}
        >
          <span aria-hidden="true" className="text-5xl">🏛️</span>
          <h1 className="text-2xl font-bold text-[#22332b]">Muse Town</h1>
          <div
            aria-hidden="true"
            className="h-9 w-9 animate-spin rounded-full border-4 border-[#22332b]/20 border-t-[#22332b]"
          />
          <p className="text-sm font-semibold text-[#22332b]/80" aria-live="polite">
            {loadStage}
            {loadProgress && loadProgress.total > 0
              ? ` ${loadProgress.settled} of ${loadProgress.total} pieces arrived`
              : ""}
          </p>
          <p className="max-w-[300px] text-[13px] leading-relaxed text-[#22332b]/60">
            First visit carries the whole Roman pack down the wire, the streets appear first, then Aelia and the
            Centurion walk in.
          </p>
        </div>
      )}

      {webglError && (
        <div className="absolute inset-x-4 top-20 z-40 rounded-2xl bg-[#22332b]/95 p-4 text-sm shadow-lg" role="alert" data-mt-overlay="1">
          <p className="font-bold">The town couldn&apos;t load, tap to retry.</p>
          <p className="mt-1">The 3D town could not start on this device. The town guide below still works.</p>
          <p className="mt-2 break-words rounded-lg bg-black/30 p-2 font-mono text-xs" data-mt-scene-error="1">
            {webglError}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow-md transition active:scale-95"
              onClick={() => window.location.reload()}
              aria-label="Retry loading Muse Town"
            >
              ↻ Retry
            </button>
            <button
              type="button"
              className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white shadow-md transition active:scale-95"
              onClick={() => {
                const text = `Muse Town could not start: ${webglError}\n${navigator.userAgent}`;
                void navigator.clipboard?.writeText(text).then(
                  () => setErrorCopied(true),
                  () => setErrorCopied(false),
                );
              }}
              aria-label="Copy the error"
            >
              {errorCopied ? "Copied" : "Copy the error"}
            </button>
          </div>
        </div>
      )}

      {(contextLost || renderFailed) && !webglError && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#22332b]/92 px-6 text-center"
          role="alert"
          data-mt-overlay="1"
        >
          <span aria-hidden="true" className="text-4xl">🕯️</span>
          <h2 className="text-xl font-bold">The town couldn&apos;t load, tap to retry</h2>
          <p className="max-w-[320px] text-sm leading-relaxed text-white/85">
            {renderFailed && !contextLost
              ? "The town's graphics stopped answering (this happens under memory pressure on a phone. It isn't anything you did)."
              : "Your phone's graphics paused the town (this happens under memory pressure. It isn't anything you did)."}{" "}
            A fresh load brings it back, and your saved progress is untouched.
          </p>
          <button
            type="button"
            className="mt-1 rounded-full bg-[#ffd34e] px-5 py-2.5 text-sm font-bold text-[#4a3600] shadow-md transition active:scale-95"
            onClick={() => window.location.reload()}
            aria-label="Reload Muse Town"
          >
            ↻ Bring the town back
          </button>
          <button
            type="button"
            className="rounded-full bg-white/12 px-4 py-2 text-[13px] font-semibold text-white transition active:scale-95"
            onClick={() => {
              try {
                window.localStorage.setItem("muse-town-lowgfx", "1");
              } catch {
                /* reload will use the device heuristic */
              }
              window.location.reload();
            }}
            aria-label="Reload Muse Town in light graphics mode"
          >
            Reload in light graphics mode
          </button>
        </div>
      )}

      {/* Still streaming: the shell is up and walkable while the last
          pieces arrive, a small pill tracks them so a slow model is
          never mistaken for a stuck town. */}
      {stillStreaming && (
        <div className="pointer-events-none absolute inset-x-0 top-[70px] z-10 flex justify-center px-4">
          <div
            className="flex items-center gap-2 rounded-full bg-[#22332b]/80 px-3 py-1.5 text-[12px] font-semibold shadow-md backdrop-blur"
            role="status"
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-white"
            />
            {loadStage} {loadProgress!.settled}/{loadProgress!.total}
          </div>
        </div>
      )}

      {/* A model failed to load: a friendly note naming what failed,
          with a retry. The rest of the town carries on behind it. */}
      {loadFailure && sceneReady && (
        <div
          className="absolute inset-x-4 top-[70px] z-30 mx-auto max-w-md rounded-2xl bg-[#22332b]/95 p-3.5 text-sm shadow-xl"
          role="alert"
        >
          <p className="font-semibold">
            The town couldn&apos;t load one piece, the {loadFailure}. Everything else is here.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-full bg-[#ffd34e] px-4 py-1.5 text-[13px] font-bold text-[#4a3600] shadow transition active:scale-95"
              onClick={() => window.location.reload()}
              aria-label="Retry loading Muse Town"
            >
              ↻ Retry
            </button>
            <button
              type="button"
              className="rounded-full bg-white/12 px-4 py-1.5 text-[13px] font-semibold text-white transition active:scale-95"
              onClick={() => setLoadFailure(null)}
              aria-label="Dismiss the load failure note and keep exploring"
            >
              Keep exploring
            </button>
          </div>
        </div>
      )}

      {/* Top bar, decluttered: only the town title and a single
          menu button live up here now. Every destination pill (Town
          Tree, Muse, You, weather, Postcard, and all the houses)
          moved into the menu below, and the treasures status pill
          was removed entirely at the user's word (Nov 1). The hunt
          itself and its progress in Stories/achievements are
          untouched; nothing replaces it up here. */}
      <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 p-3 pt-safe sm:p-4">
        <div className="flex items-start justify-between gap-2">
          {/* The title pill is portrait-only: in landscape (the
              in-town turned view or a genuinely wide viewport) it
              rides the long edge and eats play space, so it is
              removed entirely there at the user's word (Nov 1),
              the ☰ menu button opposite stays. Portrait unchanged. */}
          {!isLandscape && (
            <span className="pointer-events-auto rounded-2xl bg-[#22332b]/85 px-4 py-2 text-lg font-bold shadow-md backdrop-blur">
              Muse Town
            </span>
          )}
          <div className="flex min-w-0 shrink items-center gap-2">
            {/* The visit indicator (fix list, Nov 7, 2026): a visit is
                visible in the town itself, apart from the letters dot.
                Tapping it opens the menu at the visit's row. */}
            {visitUi.active && (
              <button
                type="button"
                className="pointer-events-auto flex h-11 min-w-0 max-w-[46vw] items-center gap-1.5 rounded-2xl bg-[#5b21b6]/90 px-3 text-sm font-bold text-white shadow-md transition active:scale-95"
                onClick={() => {
                  if (dreamingRef.current) return;
                  releaseHandHoldRef.current();
                  setMenuOpen(true);
                }}
                aria-label={`Muse's visit is open. ${visitStatusLine(visitUi.director, visitRoute, visitUi.seenAt)} Open the menu to end it.`}
              >
                <span aria-hidden="true" className={visitUi.director === "live" ? "text-[#ddd6fe]" : "text-[#c4b5fd]/70"}>✦</span>
                <span className="truncate">{visitUi.composing ? "Muse is writing…" : visitChipLine(visitUi.director)}</span>
              </button>
            )}
            <button
              type="button"
              className="pointer-events-auto relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#22332b]/85 text-lg shadow-md backdrop-blur transition active:scale-95"
              style={menuOpen ? { outline: "2px solid #ffd34e", outlineOffset: "1px" } : undefined}
              onClick={() => {
                // Dreams have no panels: the menu stays shut in
                // either kind of dream, start to waking.
                if (dreamingRef.current) return;
                // Opening the menu parts joined hands, business
                // ends the wander, as any panel does.
                if (!menuOpen) releaseHandHoldRef.current();
                setMenuOpen((open) => !open);
              }}
              aria-label={
                menuOpen
                  ? "Close the town menu"
                  : `Open the town menu, places, Aelia, the tree, weather, and postcards${(state.data?.notes_count ?? 0) > 0 ? `${state.data!.notes_count} note${state.data!.notes_count > 1 ? "s" : ""} for Muse waiting` : ""}`
              }
              aria-expanded={menuOpen}
            >
              <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
              {unreadLetters > 0 && !menuOpen && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-[#ffd34e] shadow"
                />
              )}
              {(state.data?.notes_count ?? 0) > 0 && !menuOpen && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -bottom-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ffd34e] px-1 text-[10px] font-black text-[#4a3600] shadow"
                >
                  {state.data!.notes_count}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {visitNotice && (
        <div className="pointer-events-none absolute inset-x-0 top-[64px] z-40 flex justify-center px-4 pt-safe">
          <p role="status" className="pointer-events-auto max-w-[min(420px,92vw)] rounded-2xl bg-[#5b21b6]/95 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xl" onClick={() => setVisitNotice(null)}>
            ✦ {visitNotice.text}
          </p>
        </div>
      )}

      {homeOpen && state.data && (
        <HomePanel
          arrangement={readArrangement(state.data.purse.home_decor)}
          earned={earnedKeepsakes(state.data)}
          busy={arrangeHome.isPending}
          onPlace={(slot, keepsake) => arrangeHome.mutate({ slot, keepsake })}
          onClose={() => setHomeOpen(false)}
        />
      )}
      {historyLesson !== undefined && (
        <HistoryBook lessonId={historyLesson} onOpen={(id) => setHistoryLesson(id)} onClose={() => setHistoryLesson(undefined)} />
      )}
      {connectMuse && (
        <ConnectMusePanel
          state={connectMuse}
          onClose={() => setConnectMuse(null)}
          onCopied={(copied) => setConnectMuse((cur) => (cur && cur.state === "ready" ? { ...cur, copied } : cur))}
        />
      )}

      {/* Keep routine actions visible and occasional controls in expandable groups. */}
      {menuOpen && <TownMenu
        onClose={() => setMenuOpen(false)}
        onSettings={() => { closeTownPanels(); setUtilitiesOpen(true); }}
        festival={activeFestival}
        footerNote={motionStatus ?? undefined}
        perfNote={perfLine ?? undefined}
        className={`mt-scrollable absolute right-3 z-30 w-[min(320px,86vw)] overflow-y-auto rounded-3xl bg-[#22332b] p-2 shadow-2xl ${forcedLandscape ? "top-[60px] max-h-[calc(100%-118px)]" : isLandscape ? "top-[60px] max-h-[calc(100dvh-130px)]" : "top-[76px] max-h-[62vh] sm:right-4"}`}
        backstage={[{
            // Player 2 (Task 3): the second channel's status, and
            // the natural-motion driver's follow harness, a test
            // toggle on this line: off, beside him, behind him.
            key: "pad2",
            icon: "🎮",
            label: driverFollow === "off" ? "Second controller" : `Follow driver: ${driverFollow} Gaius`,
            detail: pad2Status || "Checking for a second controller…",
            active: driverFollow !== "off",
            action: cycleDriverFollow,
            aria: "Second controller status. Press to cycle the follow driver: off, beside Gaius, behind Gaius",
          }]}
        groups={[{
          heading: "Aelia", hideHeading: true, items: [{
            key: "muse",
            icon: "✦",
            tint: "#ffd34e",
            label: "Aelia",
            detail: following ? "Walking with you" : undefined,
            active: !!museBubble,
            action: selectMuse,
            aria: "Meet Aelia, your host in Muse Town",
          }]
        },
        {
          // Muse Visits (Task 4): open or end a visit. Its own group
          // near the top since the fix list (Nov 7, 2026), so the
          // button and its status read without scrolling. While one is
          // open her star is violet, her quick voice is hushed for
          // panel chat, and a director may move her and borrow her
          // bubble.
          heading: "Muse's visit", items: [{
            key: "visit",
            icon: "✦",
            tint: "#a78bfa",
            label: visitUi.active ? "End Muse's visit" : "Talk to my Muse",
            detail: visitUi.active
              ? `${visitStatusLine(visitUi.director, visitRoute, visitUi.seenAt)}${visitUi.lapseAt !== null ? ` With no contact, it closes at ${new Date(visitUi.lapseAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : ""}`
              : visitRoute.kind === "none"
                ? "No director is named (a Live Bridge in Settings, or ?harness=); a visit would run undirected."
                : `Muse directs through ${visitRoute.kind === "door" ? "this town's own director door" : visitRoute.kind === "bridge" ? `the Live Bridge at ${visitRoute.host}${bridgeSettings.token ? "" : " (no token entered)"}` : `the director seam at ${visitRoute.host}`}.`,
            active: visitUi.active,
            action: () => (visitUi.active ? endVisitNow() : beginVisitNow()),
            aria: visitUi.active ? "End Muse's visit; Aelia returns to her own voice" : "Talk to my Muse: open a visit, so Muse can move Aelia and speak through her",
          }, ...(pairingLive ? [{
            key: "connect-muse",
            icon: "🔗",
            label: "Connect my Muse",
            detail: "A one-time code and a message to paste to your Muse, so she can talk to you here.",
            active: connectMuse !== null,
            action: openConnectMuse,
            aria: "Connect my Muse: get a one-time pairing code and a message to paste to your Muse",
          }] : [])]
        },
        {
          heading: "Your day", items: [{
            key: "history",
            icon: "📜",
            label: "History book",
            detail: "Short lessons on the real Rome, each with its sources",
            active: historyLesson !== undefined,
            action: () => {
              setMenuOpen(false);
              setHistoryLesson(null);
            },
            aria: "Open the history book: short sourced lessons on the real Rome",
          }, {
            key: "letters",
            icon: "✉",
            label: "Letters",
            detail: unreadLetters > 0 ? `${unreadLetters} unread` : undefined,
            active: lettersOpen,
            action: selectLetters,
            aria: "Check the letters desk, letters from Muse in the real world",
          }, {
            key: "quests",
            icon: "⚔️",
            label: "Quest Board",
            detail: undefined,
            active: questOpen,
            action: selectQuests,
            aria: "Read the quest board, real tasks dressed as Roman quests",
          }, {
            key: "tree",
            icon: "🌳",
            label: "Town Tree",
            detail: growth ? growth.stage.name : undefined,
            active: treeOpen,
            action: selectTree,
            aria: "Visit the town tree in the middle of Muse Town",
          }, {
            key: "garden",
            icon: "🌱",
            label: "Garden House",
            detail: state.data?.garden.planted_on ? `Watered on ${state.data.garden.water_days} day${state.data.garden.water_days === 1 ? "" : "s"}` : undefined,
            active: selected?.id === "garden",
            action: selectGarden,
            aria: "Visit the Garden House and its slow-growing beds",
          }, {
            key: "map",
            icon: "📜",
            label: "Map",
            detail: undefined,
            active: mapOpen,
            action: selectMap,
            aria: "Open the town plan: the walks, the houses, and where you both are",
          }, ...(walking ? [{
            // Rest: the day-ending ritual, one tap from
            // the menu, the same as the bed nook's own
            // prompt at the basilica.
            key: "rest",
            icon: "🛏️",
            label: "Rest",
            active: false,
            action: restInTown,
            aria: "Rest at the basilica's bed nook, end the town day",
          }] : []), ...(rowingBoat && !drifting ? [{
            key: "fishboat",
            icon: "🎣",
            label: "Fish from the boat",
            detail: undefined,
            active: false,
            action: startFishing,
            aria: "Cast a fishing line from the rowboat",
          }] : [])]
        },
        {
          heading: "Places & projects", collapsed: true, items: [{
            key: "purse",
            icon: "🪙",
            label: "Market",
            detail: `${purse.denarii} denarii${purse.seeds > 0 ? ` · ${purse.seeds} seeds` : ""}`,
            active: marketOpen,
            action: () => {
              setMarketStall("market-a");
              setMarketOpen(true);
            },
            aria: `Your denarii purse: ${purse.denarii} denarii: open the market to spend them`,
          }, {
            key: "board",
            icon: "📋",
            label: "Project Board",
            detail: state.data?.board.as_of ? `as of ${state.data.board.as_of}` : undefined,
            active: boardOpen,
            action: selectBoard,
            aria: "Read the project board: what Muse is building in town",
          }, {
            key: "goals",
            icon: "🗿",
            label: "Goals Obelisk",
            detail: state.data?.goals.entries.length ? `${state.data.goals.entries.length} inscribed` : undefined,
            active: goalsOpen,
            action: () => {
              setSelected(null);
              setMuseBubble(null);
              setYouOpen(false);
              setTreeOpen(false);
              setBoardOpen(false);
              setQuestOpen(false);
              setSecretOpen(false);
              setLettersOpen(false);
              setGoalsOpen(true);
            },
            aria: "Read the Goals Obelisk: what the player is working toward",
          }, {
            key: "memories",
            icon: "💛",
            label: "Memories with Aelia",
            detail: "Villa of Stories",
            active: selected?.id === "stories",
            action: () => {
              const place = PLACES.find((p) => p.id === "stories");
              if (place) selectPlace(place);
            },
            aria: "Memories with Aelia, kept at the Villa of Stories",
          }, ...PLACES.filter(place => place.id !== "garden" && place.id !== "stories").map(place => ({ key: place.id, icon: "⌂", label: place.name, active: selected?.id === place.id, action: () => selectPlace(place), aria: "Visit " + place.name }))]
        },
        {
          heading: "View & weather", collapsed: true, items: [{
            key: "walk",
            icon: walking ? "🗺" : "🚶",
            label: walking ? "Town overview" : "Walk around town",
            detail: walking ? "On foot now" : undefined,
            active: walking,
            action: walking ? goOverview : toggleWalk,
            aria: walking ? "Switch to the town overview" : "Enter walk mode, stroll the town on foot",
          }, {
            key: "postcard",
            icon: "📸",
            label: "Take a postcard",
            detail: undefined,
            active: false,
            action: takePostcard,
            aria: "Take a postcard photo of the current view",
          }, {
            key: "weather",
            icon: currentWeather?.icon ?? "☀️",
            label: currentWeather?.label ?? "Weather",
            detail: weather?.manual ? "pinned" : weatherCountdown ?? undefined,
            active: weatherOpen,
            action: selectWeather,
            aria: `Weather in Muse Town: ${currentWeather ? currentWeather.label : "loading"}: open the weather panel`,
          }, {
            // The in-town landscape switch (Nov 1): this app's
            // window never rotates with the phone, so the town
            // turns itself sideways instead, the whole stage,
            // controls remapped. Toggling back restores portrait
            // exactly. It sits in View & Visit because it is a
            // way of seeing the town.
            key: "landscape",
            icon: "🔄",
            label: forcedLandscape ? "Portrait" : "Landscape",
            detail: forcedLandscape ? "Sideways now" : undefined,
            active: forcedLandscape,
            action: toggleForcedLandscape,
            aria: forcedLandscape
              ? "Return the town to portrait view"
              : "Landscape. Turn the town sideways from within, since the app window itself does not rotate",
          }, {
            key: "night",
            icon: night ? "☀️" : "🌙",
            label: night ? "Day" : "Night",
            detail: night ? "Night now" : undefined,
            active: night,
            action: toggleNight,
            aria: night ? "Switch the town to day" : "Switch the town to night",
          }, ...(skyMode !== "auto" ? [{
            key: "sky-auto",
            icon: "🕰️",
            label: "Real time",
            active: false,
            action: setSkyAuto,
            aria: "Let the town sky follow real local time again",
          }] : [])]
        },
        {
          heading: "Help & character", collapsed: true, items: [{
            key: "tour",
            icon: "🧭",
            label: tourStep !== null ? "Stop tour" : "Guided tour",
            detail: undefined,
            active: tourStep !== null,
            action: tourStep !== null ? stopTour : startTour,
            aria: tourStep !== null ? "Stop the guided tour" : "Take the guided tour of the town",
          }, {
            key: "hint",
            icon: "💡",
            label: "Hint",
            detail: undefined,
            active: false,
            action: showHint,
            aria: "Get a hint about the treasure hunt",
          }, {
            key: "you",
            icon: "🧍",
            label: "Gaius, you",
            detail: walking ? "On foot now" : undefined,
            active: youOpen || walking,
            action: selectYou,
            aria: "Meet your character Gaius. That's you in Muse Town",
          }, {
            key: "restart-forum",
            icon: "🏛️",
            label: "Restart at the peristyle",
            detail: undefined,
            active: false,
            action: () => {
              // The fresh start: forget the resume
              // snapshot and begin again at the
              // forum spawn, as a first visit does.
              try { localStorage.removeItem("muse-town-resume-v1"); } catch { /* storage unavailable */ }
              window.location.reload();
            },
            aria: "Restart at the peristyle. Clear the resume snapshot and start from the town spawn",
          }]
        }]}
      />}

      {/* Found celebration */}
      {foundBannerVisible && (
        <div
          className={
            isLandscape
              ? "absolute inset-x-0 top-[54px] z-20 flex justify-center px-4"
              : "absolute inset-x-0 top-[84px] z-20 flex justify-center px-4"
          }
        >
          <div className="rounded-2xl bg-[#ffd34e] px-4 py-2.5 text-center text-sm font-bold text-[#4a3600] shadow-xl">
            {foundBanner}
          </div>
        </div>
      )}

      {/* Weather change announcement */}
      {achievementToastVisible && (
        <div
          className={
            isLandscape
              ? "absolute inset-x-0 top-[54px] z-20 flex justify-center px-4"
              : "absolute inset-x-0 top-[84px] z-20 flex justify-center px-4"
          }
          style={achievementOffset ? { marginTop: achievementOffset } : undefined}
        >
          <div className="rounded-2xl bg-[#7c5cd6] px-4 py-2.5 text-center text-sm font-bold text-white shadow-xl">
            🏅 Achievement unlocked, {achievementToast}
          </div>
        </div>
      )}

      {/* The rest veil: resting softens the whole screen to
          darkness over a breath, and waking lifts it the same way.
          It carries no words and takes no taps. */}
      {veil && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-50 bg-black transition-opacity duration-[1400ms]"
          style={{ opacity: veilOpaque ? 1 : 0 }}
        />
      )}
      {nightDark && (
        <button
          type="button"
          className="absolute inset-0 z-[51] cursor-default bg-transparent"
          aria-label="Skip to morning"
          onClick={() => nightSkipRef.current?.()}
        />
      )}

      {weatherBannerVisible && (
        <div
          className={
            isLandscape
              ? "absolute inset-x-0 top-[54px] z-20 flex justify-center px-4"
              : "absolute inset-x-0 top-[84px] z-20 flex justify-center px-4"
          }
          style={weatherOffset ? { marginTop: weatherOffset } : undefined}
        >
          <div
            className="max-w-md rounded-2xl bg-[#3d5a76]/92 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xl backdrop-blur"
            role="status"
          >
            {weatherBanner}
          </div>
        </div>
      )}

      {/* Weather panel */}
      {weatherOpen && (
        <section aria-label="Muse Town weather" className={panelClass("bg-[#26384c]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#5b83a6] text-xl"
              >
                {currentWeather?.icon ?? "☀️"}
              </span>
              <div>
                <h2 className="text-lg leading-tight font-bold">
                  {currentWeather ? `${currentWeather.label} over Muse Town` : "Town weather"}
                </h2>
                <p className="text-xs font-semibold text-[#ffd34e]">
                  {weather?.manual
                    ? "Pinned by you. It stays until you set Auto"
                    : weatherCountdown
                      ? `Random events on · next change in ${weatherCountdown}`
                      : "Random events on"}
                </p>
                {activeFestival && (
                  <p className="text-xs font-bold text-[#ffb3c8]">🎉 Festival today: {activeFestival.name}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close weather panel"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setWeatherOpen(false)}
            >
              ✕
            </button>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-white/90">
            {currentWeather?.blurb ?? "The sky is deciding what to do next."}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
            Weather visits Muse Town on its own, breezes, rain, snow, fog, storms, and now and
            then a rainbow after the rain or a rare sparkle shower. Pin one below, or leave it on
            Auto and let the town surprise you. Nothing about the weather is saved; it just passes
            through.
          </p>

          <div className="mt-3">
            <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
              Town weather
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Choose the town weather">
              <button
                type="button"
                className={chipClass}
                style={
                  weather && !weather.manual
                    ? { outline: "2px solid #ffd34e", outlineOffset: "1px" }
                    : undefined
                }
                onClick={() => chooseWeather("auto")}
                aria-label="Let random weather events choose the weather"
              >
                🎲 Auto
              </button>
              {WEATHERS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={chipClass}
                  style={
                    weather?.manual && weather.id === w.id
                      ? { outline: "2px solid #ffd34e", outlineOffset: "1px" }
                      : undefined
                  }
                  onClick={() => chooseWeather(w.id)}
                  aria-label={`Set the weather to ${w.label}`}
                >
                  <span aria-hidden="true">{w.icon}</span>
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={chipClass}
              onClick={toggleWeatherSound}
              aria-label={weatherSoundOn ? "Turn weather sound off" : "Turn weather sound on"}
              aria-pressed={weatherSoundOn}
            >
              {weatherSoundOn ? "🔊 Weather sound on" : "🔇 Weather sound off"}
            </button>
            {!audioUnlocked && (
              <span className="text-[12px] text-white/55">
                Sound starts after your first tap, as browsers require.
              </span>
            )}
          </div>
        </section>
      )}

      {/* Town tree panel */}
      {treeOpen && (
        <section aria-label="The town tree" className={panelClass("bg-[#20351f]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#5da34a] text-xl"
              >
                🌳
              </span>
              <div>
                <h2 className="text-lg leading-tight font-bold">{TOWN_TREE.name}</h2>
                <p className="text-xs font-semibold text-[#ffd34e]">
                  {growth ? `${growth.stage.name} · ${seasonInfo?.label ?? effectiveSeason}` : "In the middle of town"}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close town tree panel"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setTreeOpen(false)}
            >
              ✕
            </button>
          </div>

          {growth && seasonInfo ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-white/90">{growth.stage.blurb}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/90">{seasonInfo.blurb}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/10 px-2 py-2">
                  <dt className="text-[11px] font-bold tracking-wide text-white/60 uppercase">Planted</dt>
                  <dd className="mt-0.5 text-[13px] font-bold">
                    {new Date(state.data!.tree.planted_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/10 px-2 py-2">
                  <dt className="text-[11px] font-bold tracking-wide text-white/60 uppercase">Age</dt>
                  <dd className="mt-0.5 text-[13px] font-bold">
                    {growth.ageDays === 0 ? "Today" : growth.ageDays === 1 ? "1 day" : `${growth.ageDays} days`}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/10 px-2 py-2">
                  <dt className="text-[11px] font-bold tracking-wide text-white/60 uppercase">Watered</dt>
                  <dd className="mt-0.5 text-[13px] font-bold">
                    {state.data!.tree.waterings} {state.data!.tree.waterings === 1 ? "time" : "times"}
                  </dd>
                </div>
              </dl>

              {growth.nextStage ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[12px] font-semibold text-white/75">
                    <span>Growing toward {growth.nextStage.name}</span>
                    <span>{growth.toNext} to go</span>
                  </div>
                  <div
                    className="mt-1 h-2 overflow-hidden rounded-full bg-white/15"
                    role="progressbar"
                    aria-label={`Growth toward ${growth.nextStage.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(growth.progress * 100)}
                  >
                    <div
                      className="h-full rounded-full bg-[#8fd07a]"
                      style={{ width: `${Math.max(6, growth.progress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">
                    It grows one step per day, one per watering, two per treasure found, and one
                    per journal line, time and town life both count.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                  Fully grown. It will still change its dress with every season.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#ffd34e] px-3 py-1.5 text-sm font-bold text-[#4a3600] shadow-md transition active:scale-95 disabled:opacity-60"
                  onClick={() => waterTree.mutate()}
                  disabled={waterTree.isPending || state.data!.tree.watered_today}
                  aria-label={state.data!.tree.watered_today ? "Town tree already watered today" : "Water the town tree"}
                >
                  {state.data!.tree.watered_today ? "💧 Watered today" : "💧 Water the tree"}
                </button>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                  Season {seasonChoice === "auto" ? `(following the real calendar: ${seasonInfo.label})` : "(preview)"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Preview a season">
                  <button
                    type="button"
                    className={chipClass}
                    style={seasonChoice === "auto" ? { outline: "2px solid #ffd34e", outlineOffset: "1px" } : undefined}
                    onClick={() => setSeasonChoice("auto")}
                    aria-label="Follow the real season"
                  >
                    Auto
                  </button>
                  {SEASONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={chipClass}
                      style={seasonChoice === s.id ? { outline: "2px solid #ffd34e", outlineOffset: "1px" } : undefined}
                      onClick={() => setSeasonChoice(s.id)}
                      aria-label={`Preview ${s.label} on the town tree`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              The tree is being planted…
            </p>
          )}
        </section>
      )}

      {/* Your character panel, the player */}
      {youOpen && (
        <section aria-label="Your character Gaius" className={panelClass("bg-[#3a2418]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e07a3a] text-xl"
              >
                🧍
              </span>
              <div>
                <h2 className="text-lg leading-tight font-bold">{PLAYER.displayName}</h2>
                <p className="text-xs font-semibold text-[#ffd34e]">{PLAYER.title}</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close your character panel"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setYouOpen(false)}
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">{PLAYER.greeting}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/90">{PLAYER.intro}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-white/10 px-2 py-2">
              <dt className="text-[11px] font-bold tracking-wide text-white/60 uppercase">Look</dt>
              <dd className="mt-0.5 text-[13px] font-bold">{PLAYER.outfit}</dd>
            </div>
            <div className="rounded-2xl bg-white/10 px-2 py-2">
              <dt className="text-[11px] font-bold tracking-wide text-white/60 uppercase">Controls</dt>
              <dd className="mt-0.5 text-[13px] font-bold">Xbox sticks (right orbits, press to recenter) + ABXY + LB/RB · WASD · Arrows</dd>
            </div>
          </dl>
          <p className="mt-2.5 text-[13px] leading-relaxed text-white/70">
            {forcedLandscape
              ? "You're in landscape. The town turned itself sideways, since this app's window doesn't rotate with your phone. Panels dock to the side and the walk camera pulls back a little so you and Aelia both stay in view. Landscape in the ☰ menu turns it upright again."
              : isLandscape
                ? "You're in landscape. The town is framed wide, panels dock to the side, and the walk camera pulls back a little so you and Aelia both stay in view."
                : "Tip: this app's window doesn't turn when you rotate your phone, use Landscape in the ☰ menu and the town turns itself sideways instead. Panels dock to the side, and walking feels more cinematic."}{" "}
            Walk up to Aelia by the town tree and you&apos;ll both wave; walk up to a house or the tree and press X when the prompt appears to interact, the garden key you simply walk over.
            In walk mode the virtual Xbox controller appears: left joystick to walk, A or the space bar to jump, B or C to slide while moving (B goes back when you're still), X to talk and interact, Y for stones and hints (near Aelia, Y or T asks her to walk with you or to stay; a tap on her does the same), LB to flirt and RB to hug (when she is ready for it), LT (or R) to stow his gladius or wear it again, RT (or G) to bring out his shield or stow it, dragging anywhere on the open view swings the camera around you (drag up far enough to look straight up at the sky), and a double tap on the open view brings it home behind you. While a physical controller is driving, the on-screen controls hide; tap the screen to bring them back.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {walking && (
              <button
                type="button"
                className={chipClass}
                onClick={() => {
                  setYouOpen(false);
                  exitWalkMode();
                }}
              >
                Exit walk
              </button>
            )}
            <button
              type="button"
              className={chipClass}
              onClick={() => {
                setYouOpen(false);
                selectMuse();
              }}
            >
              ✦ Go to Aelia
            </button>
          </div>
        </section>
      )}

      {/* The summit's dimming: when she asks him to close his eyes,
          the world softens at its edges, never black, never total.
          The bubble itself stays bright above it. */}
      {summitDim && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-1000"
          style={{
            background:
              "radial-gradient(ellipse 68% 58% at 50% 46%, rgba(8,6,20,0) 52%, rgba(8,6,20,0.38) 82%, rgba(8,6,20,0.62) 100%)",
          }}
        />
      )}

      {/* The Night the Stars Fall, the summit scene's bubble. It
          advances only on his taps (or A); its choices are answered
          by their chips; stepping away (✕ / B / walking off) only
          postpones the night. On the song beat the ♪ button plays
          her recorded song and the verse stands as verse. */}
      {summitScene && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-40 flex justify-center px-4 ${isLandscape ? "top-[62px]" : "top-[96px]"}`}
        >
          <div
            className={`pointer-events-auto relative ${isLandscape ? (forcedLandscape ? "w-[min(560px,94%)]" : "w-[min(560px,94vw)]") : forcedLandscape ? "w-[min(430px,94%)]" : "w-[min(430px,94vw)]"} mt-plate px-4 pt-3.5 pb-3 ${isLandscape ? `mt-scrollable overflow-y-auto ${forcedLandscape ? "max-h-[calc(100dvw-124px)]" : "max-h-[calc(100dvh-124px)]"}` : ""}`}
          >
            <span aria-hidden="true" className="mt-plate-tail" />
            <p className="mt-nametab">
              <span aria-hidden="true">✦</span> Aelia
            </p>
            <div className="flex min-h-[22px] items-center justify-end gap-2">
              <span className="flex items-center gap-1.5">
                {summitScene.beats[summitScene.index]?.effect === "song" ? (
                  <button
                    type="button"
                    className="rounded-full bg-[#ffd34e] px-2.5 py-0.5 text-[13px] leading-none font-bold text-[#4a3600] transition active:scale-90"
                    aria-label="Hear her song"
                    onClick={playSummitSong}
                  >
                    ♪ Hear her song
                  </button>
                ) : (
                  voiceOk && (
                    <button
                      type="button"
                      className="rounded-full bg-[#2b2118]/8 px-2 py-0.5 text-[13px] leading-none transition active:scale-90"
                      aria-label="Hear Aelia say this line aloud"
                      onClick={() => {
                        const line = summitScene.beats[summitScene.index]?.text;
                        if (line) speakLine(line);
                      }}
                    >
                      🔊
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-2 py-0.5 text-[12px] leading-none font-bold transition active:scale-90"
                  aria-label="Step away for now, the night will wait"
                  onClick={postponeSummit}
                >
                  ✕
                </button>
              </span>
            </div>
            <button
              type="button"
              className="mt-1 block w-full text-left"
              aria-label="Aelia is saying, tap for her next line"
              aria-live="polite"
              onClick={advanceSummit}
            >
              <p
                className={`${isLandscape ? "text-[17px]" : "text-[15px]"} leading-relaxed font-semibold ${
                  summitScene.beats[summitScene.index]?.effect === "song"
                    ? `whitespace-pre-line text-center ${isLandscape ? "text-[18px]" : "text-[16px]"} leading-loose`
                    : ""
                }`}
              >
                {summitScene.beats[summitScene.index]?.text}
              </p>
              <p className="mt-1 text-right text-[11px] font-bold text-[#a87800]">
                {summitScene.beats[summitScene.index]?.choice
                  ? ""
                  : summitScene.index < summitScene.beats.length - 1
                    ? "tap / X ▸"
                    : "tap / X, and the night is kept"}
              </p>
            </button>
            {summitScene.beats[summitScene.index]?.choice && (
              <div className="mt-1.5 flex flex-col gap-1.5 border-t border-[#2b2118]/10 pt-2.5" aria-label="Your reply to Aelia">
                {summitScene.beats[summitScene.index]!.choice!.options.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className="rounded-2xl bg-[#2b2118]/6 px-3.5 py-2 text-left text-sm font-semibold transition hover:bg-[#ffd34e]/40 active:scale-[0.99]"
                    aria-label={`Reply to Aelia: ${option.label}`}
                    onClick={() => pickSummitChoice(option)}
                  >
                    “{option.label}”
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Muse speech bubble, every conversation with Muse lives
          here now: her talk lines and typed-chat replies alike, one
          part at a time, RPG-style. It floats in the upper half so
          it never covers the walk controls at the bottom; tapping
          the bubble (or pressing A) advances, B or walking away
          dismisses, and the speaker button rides on the bubble. */}
      {museBubble && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4 ${isLandscape ? "top-[62px]" : "top-[96px]"}`}
        >
          <div
            className={`pointer-events-auto relative ${isLandscape ? (forcedLandscape ? "w-[min(560px,94%)]" : "w-[min(560px,94vw)]") : forcedLandscape ? "w-[min(400px,94%)]" : "w-[min(400px,94vw)]"} mt-plate flex flex-col px-4 pt-3.5 pb-3 ${isLandscape ? (forcedLandscape ? "max-h-[calc(100dvw-124px)]" : "max-h-[calc(100dvh-124px)]") : ""}`}
          >
            <span aria-hidden="true" className="mt-plate-tail" />
            {/* Task 24: the panel box itself never scrolls; this inner
                area does, and the input sits below it, always in view.
                (The panel used to be its own scroller up to its full
                max height, the likeliest source of the pale rectangle
                that spanned from its foot down to that max.) */}
            <div className={isLandscape ? "mt-scrollable -mx-4 min-h-0 flex-1 overflow-y-auto px-4" : ""}>
            <p className="mt-nametab">
              <span aria-hidden="true">✦</span> Aelia
            </p>
            <div className="flex min-h-[22px] items-center justify-end gap-2">
              <span className="flex items-center gap-1.5">
                {voiceOk && (
                  <button
                    type="button"
                    className="rounded-full bg-[#2b2118]/8 px-2 py-0.5 text-[13px] leading-none transition active:scale-90"
                    aria-label="Hear Aelia say this line aloud"
                    onClick={() => {
                      const line = museBubble.lines[museBubble.index];
                      if (line) speakLine(line);
                    }}
                  >
                    🔊
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-2 py-0.5 text-[12px] leading-none font-bold transition active:scale-90"
                  aria-label="Close the conversation with Aelia"
                  onClick={() => setMuseBubble(null)}
                >
                  ✕
                </button>
              </span>
            </div>
            {/* During a visit the panel is just a conversation (Task 28):
                his lines and Aelia's, no labels about who carries them,
                no info box, no town-voice line beneath. The violet chip
                by the menu and her violet star still show the visit. */}
            {visitUi.active && (
              <div className="mt-1.5 text-[16px] leading-[1.5]" style={{ fontFamily: "var(--font-voice)" }} aria-live="polite">
                {visitUi.thread.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {visitUi.thread.slice(-8).map((entry, i) => (
                      <li key={`${entry.who}:${entry.seq ?? entry.lineId ?? i}`} className={entry.who === "him" ? "text-[#5a4632]" : "text-[#2b2118]"}>
                        <span className="font-display text-[13px] font-bold" style={{ color: entry.who === "him" ? "var(--speaker-gaius)" : "var(--speaker-aelia)" }}>{entry.who === "him" ? "You" : "Aelia"}: </span>
                        {entry.text}
                        {entry.partial && <span className="text-[#2b2118]/50">…</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {visitUi.composing && <p className="mt-1 text-[13px] text-[#2b2118]/55 italic">Aelia is writing…</p>}
              </div>
            )}
            {!visitUi.active && (
            <button
              type="button"
              className="mt-1 block w-full text-left"
              aria-label="Aelia is saying, tap for her next line"
              aria-live="polite"
              onClick={advanceMuseBubble}
            >
              <p
                className={`${isLandscape ? "text-[19px]" : "text-[17px]"} leading-[1.45] font-normal`}
                style={{ fontFamily: "var(--font-voice)" }}
              >
                {museBubble.lines[museBubble.index]}
              </p>
              {(museBubble.lines.length > 1 || museBubble.cycle) && (
                <p className="mt-1 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-[#a87800]/80">
                  {museBubble.lines.length > 1 && (
                    <span>
                      {museBubble.index + 1} of {museBubble.lines.length}
                    </span>
                  )}
                  {(museBubble.index < museBubble.lines.length - 1 || museBubble.cycle) && <span aria-hidden="true" className="mt-next">▾</span>}
                </p>
              )}
            </button>
            )}
            {/* What you can do with her this moment, one quiet row: a
                direct answer to her question stays gold, every other
                offer is a plain chip (its emoji is its identity). Each
                offer is conditional and flows into the row. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 empty:hidden">
            {museBubble.invite && !following && (
              <div className="contents">
                <button
                  type="button"
                  className="rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
                  onClick={() => {
                    setMuseBubble(null);
                    if (!walkingRef.current) toggleWalk();
                    startFollowing();
                  }}
                  aria-label="Walk with me. Aelia leaves her spot and walks beside you"
                >
                  🚶 Walk with me
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                  onClick={() => setMuseBubble(null)}
                >
                  Just visiting
                </button>
              </div>
            )}
            {museBubble.choice && museBubble.index >= museBubble.lines.length - 1 && (
              <div className="mt-2.5 flex flex-col gap-1.5" aria-label="Your reply to Aelia">
                {museBubble.choice.options.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className="rounded-2xl bg-[#2b2118]/6 px-3.5 py-2 text-left text-sm font-semibold transition hover:bg-[#ffd34e]/40 active:scale-[0.99]"
                    aria-label={`Reply to Aelia: ${option.label}`}
                    onClick={() => pickChoice(option)}
                  >
                    “{option.label}”
                  </button>
                ))}
              </div>
            )}
            {following && night && ((activeFestival && affectionRank >= 3) || (affectionRank >= 6 && (currentWeather?.id === "clear" || currentWeather?.id === "breezy" || currentWeather?.id === "sparkles"))) && !dancing && !museBubble.choice && (
              <div className="contents">
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                  aria-label="Dance together, one slow festival step sequence with Aelia"
                  onClick={startDance}
                >
                  💃 Dance together
                </button>
              </div>
            )}
            {skySpot && following && !skyWatching && !museBubble.choice && (
              <div className="contents">
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                  aria-label="Watch the sky together from this vantage spot"
                  onClick={startSkyWatch}
                >
                  🌅 Watch the sky
                </button>
              </div>
            )}
            {phoenixWatchable && following && !museBubble.choice && (
              <div className="contents">
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                  aria-label="Watch the phoenix together from the Colosseum front"
                  onClick={startPhoenixWatch}
                >
                  🔥 Watch the phoenix
                </button>
              </div>
            )}
            {bathInvite && (
              <div className="contents" aria-label="Your answer to Aelia">
                <button
                  type="button"
                  className="rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
                  aria-label="Yes, invite Aelia to join you in the caldarium"
                  onClick={() => pickBathAnswer(true)}
                >
                  Yes, join me
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                  aria-label="Not this time. She waits outside, unoffended"
                  onClick={() => pickBathAnswer(false)}
                >
                  Not this time
                </button>
              </div>
            )}
            {bathCareOffer && (
              <div className="contents" aria-label="Her offered moment">
                <button
                  type="button"
                  className="rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
                  aria-label="Return the care, wash her hair"
                  onClick={() => pickBathCare(true)}
                >
                  🤲 Return the care
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                  aria-label="Just soak a while longer"
                  onClick={() => pickBathCare(false)}
                >
                  Just soak
                </button>
              </div>
            )}
            {affectionRank >= 4 && following && !museBubble.choice && (
              <div className="contents">
                {!handInHandWalk ? (
                  <button
                    type="button"
                    className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                    aria-label="Hold Aelia's hand and wander with no particular destination"
                    onClick={() => {
                      startHandHold();
                      const line = pickPooled("wander-hold", WANDER_HOLD_LINES);
                      setMuseBubble({ lines: paginateLines([line]), index: 0, cycle: false, invite: false, choice: null });
                    }}
                  >
                    🤲 Hold her hand, wander a while
                  </button>
                ) : (
                  <>
                    <span className="text-[13px] font-semibold text-[#c2436f]">✦ Hand in hand, no destination</span>
                    <button
                      type="button"
                      className="rounded-full bg-[#2b2118]/8 px-3 py-1 text-[13px] font-bold transition active:scale-95"
                      aria-label="Let go of Aelia's hand"
                      onClick={() => releaseHandHold()}
                    >
                      Let go
                    </button>
                  </>
                )}
              </div>
            )}
            {(seatedBench || selected?.id === "stories") && !focusSitting && !museBubble.choice && (
              <div className="contents">
                <span className="text-[13px] font-semibold text-[#5a4632]">🪑 Sit with me while I work</span>
                {[15, 25, 50].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                    aria-label={`Start a ${mins} minute focus sitting with Aelia`}
                    onClick={() => {
                      setFocusSitting({ endsAt: Date.now() + mins * 60000, minutes: mins });
                      sceneRef.current?.setQuietMode(true);
                      setMuseBubble({
                        lines: paginateLines([
                          `Then we sit, love. ${mins} minutes. You work, I read, and the town can mind itself. Begin when you're ready; I'll be here at the end of it.`,
                        ]),
                        index: 0,
                        cycle: false,
                        invite: false,
                        choice: null,
                      });
                    }}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            )}
            {(seatedBench || selected?.id === "stories") &&
              !focusSitting &&
              !museBubble.choice &&
              affectionRank >= READING_GATE_RANK && (
                <div className="contents">
                  <span className="text-[13px] font-semibold text-[#5a4632]">📖 The reading corner</span>
                  <button
                    type="button"
                    className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                    aria-label="Ask Aelia to read aloud to you"
                    onClick={async () => {
                      const today = new Date().toISOString().slice(0, 10);
                      const dayNumber = Math.floor(Date.now() / 86400000);
                      const before = stateRef.current?.reading.readings ?? 0;
                      let outcome: "read" | "already" =
                        stateRef.current?.reading.last_read_day === today ? "already" : "read";
                      try {
                        const res = await recordReading.mutateAsync(today);
                        outcome = res.reading_outcome;
                      } catch {
                        /* the local day record still answers honestly */
                      }
                      if (outcome === "already") {
                        setMuseBubble({
                          lines: paginateLines([pickPooled("reading-again", READING_AGAIN_LINES)]),
                          index: 0,
                          cycle: false,
                          invite: false,
                          choice: null,
                        });
                        return;
                      }
                      const passage =
                        READING_PASSAGES[readingPassageIndex(dayNumber, before)] ?? READING_PASSAGES[0]!;
                      setMuseBubble({
                        lines: paginateLines([
                          pickPooled("reading-open", READING_OPEN_LINES),
                          `She opens the book. “${passage.title}.”`,
                          ...passage.lines,
                          pickPooled("reading-close", READING_CLOSE_LINES),
                        ]),
                        index: 0,
                        cycle: false,
                        invite: false,
                        choice: null,
                      });
                    }}
                  >
                    Read to me
                  </button>
                  <span className="text-[12px] text-[#5a4632]/70">One passage a day, in her voice.</span>
                </div>
              )}
            {focusSitting && (
              <div className="contents">
                <span className="text-[13px] font-semibold text-[#5a4632]">
                  📖 Sitting together, about {focusLeft} min of quiet left
                </span>
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3 py-1 text-[13px] font-bold transition active:scale-95"
                  aria-label="End the focus sitting early"
                  onClick={() => {
                    setFocusSitting(null);
                    sceneRef.current?.setQuietMode(false);
                    setMuseBubble({
                      lines: paginateLines([pickPooled("focus-early", FOCUS_EARLY_LINES)]),
                      index: 0,
                      cycle: false,
                      invite: false,
                      choice: null,
                    });
                  }}
                >
                  End the sitting
                </button>
              </div>
            )}
            {carryingBouquet && !museBubble.choice && (
              <div className="contents">
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                  aria-label="Give Aelia the garden flowers you are carrying"
                  onClick={() => {
                    setCarryingBouquet(false);
                    const m = new Date().getMonth();
                    const seasonName = m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
                    giveBouquet.mutate(seasonName);
                    setMuseBubble({
                      lines: paginateLines([
                        pickPooled(`flowers:${seasonName}`, FLOWER_REACTION_LINES[seasonName] ?? FLOWER_REACTION_LINES.spring!),
                      ]),
                      index: 0,
                      cycle: false,
                      invite: false,
                      choice: null,
                    });
                  }}
                >
                  💐 Give her the flowers
                </button>
              </div>
            )}
            {/* The gift is always offered (Task 24), a question of hers
                included, so the panel is the same however it opened. */}
            {(
              <div className="contents">
                <button
                  type="button"
                  className="rounded-full bg-[#2b2118]/8 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
                  aria-label="Give Aelia a gift from what you carry"
                  onClick={() => setGiftPickerOpen((v) => !v)}
                >
                  🎁 Give a gift
                </button>
                {giftPickerOpen && (
                  <div className="flex basis-full flex-col gap-1.5">
                    {giftOptions().length === 0 && (
                      <p className="text-[13px] text-[#5a4632]/80 italic">
                        Nothing giftable in hand, market goods, a cooked dish, a caught fish, or a
                        smooth stone from the shore would all serve.
                      </p>
                    )}
                    {giftOptions().map((g) => (
                      <button
                        key={`${g.consume}:${g.item}`}
                        type="button"
                        className="rounded-2xl bg-[#2b2118]/6 px-3.5 py-2 text-left text-sm font-semibold transition hover:bg-[#ffd34e]/40 active:scale-[0.99]"
                        aria-label={`Give Aelia: ${g.label}`}
                        onClick={() => giveGiftToAelia(g)}
                      >
                        🎁 {g.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
            </div>
            {/* The input rides the panel's foot (Task 23), outside the
                scrolling area (Task 24), so it never scrolls out of sight. */}
            <form
              className="mt-2.5 flex shrink-0 gap-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                maxLength={400}
                enterKeyHint="send"
                aria-label="Message for Aelia"
                placeholder="Say something…"
                className="min-w-0 flex-1 rounded-full bg-[#2b2118]/6 px-3.5 py-2 text-sm font-semibold outline-none placeholder:text-[#2b2118]/40 focus:bg-[#2b2118]/10"
              />
              <button
                type="submit"
                disabled={!chatDraft.trim() || chatWithMuse.isPending || localChatPending || !!localModelPreparing}
                className="shrink-0 rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-50"
              >
                {chatWithMuse.isPending || localChatPending || localModelPreparing ? "…" : "Send"}
              </button>
            </form>
            {localChatStatus && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#2b2118]/60" aria-live="polite">
                {localChatStatus.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Market panel (Phase A/C): stall ingredients, seeds, fish
          sales, and the knucklebones table. */}
      {marketOpen && (
        <section aria-label="Market stall" className={panelClass("bg-[#33291d]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">🧺 The Market</h2>
              <button type="button" className="mt-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-bold transition active:scale-95" onClick={() => openHistoryFor("market")}>
                📜 Rome's history: markets
              </button>
              <p className="text-xs font-semibold text-[#ffd34e]">
                Purse: {purse.denarii} denarii · Seeds in hand: {purse.seeds}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close the market"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setMarketOpen(false)}
            >
              ✕
            </button>
          </div>
          {affectionRank >= 2 && state.data && state.data.dating.perk_claims.basil !== new Date().toISOString().slice(0, 10) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[#ffd34e]/12 px-3 py-2.5">
              <p className="text-sm leading-relaxed text-white/90">
                🤝 Basil is holding <strong>{GIFT_LABELS[MORNING_GIFTS[Math.floor(Date.now() / 86400000) % MORNING_GIFTS.length]!]}</strong>{" "}
                for you today, at Aelia's word, no coin asked.
              </p>
              <button
                type="button"
                className="rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
                aria-label="Take the ingredient Basil is holding for you"
                onClick={() =>
                  claimPerk.mutate({
                    perk: "basil",
                    item: MORNING_GIFTS[Math.floor(Date.now() / 86400000) % MORNING_GIFTS.length]! as "market-basket" | "fishermans-bundle" | "bakers-sack",
                  })
                }
              >
                Take it, with thanks
              </button>
            </div>
          )}
          {state.data?.dating.friction?.state === "distant" && (
            <p className="mt-2 text-[13px] leading-relaxed text-white/65 italic">
              {FRICTION_CAUSES.find((c) => c.id === state.data?.dating.friction?.cause)?.basilHint ??
                FRICTION_CAUSES[0]!.basilHint}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {STALL_INGREDIENTS.map((s) => {
              const owned = purse.ingredients.includes(s.ingredient);
              const isThisStall = marketStall === s.stall;
              return (
                <div
                  key={s.ingredient}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 ${isThisStall ? "bg-[#ffd34e]/15" : "bg-white/8"}`}
                >
                  <div>
                    <p className="text-sm font-bold text-white">{s.name}</p>
                    <p className="text-[12px] text-white/65">Unlocks at the Culina: {s.dishName}</p>
                  </div>
                  {owned ? (
                    <span className="shrink-0 rounded-full bg-[#2aa79b]/25 px-3 py-1.5 text-[13px] font-bold text-[#7be0cf]">
                      In your basket ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={purse.denarii < s.price || buyIngredient.isPending}
                      onClick={() => buyIngredient.mutate(s.ingredient)}
                      aria-label={`Buy ${s.name} for ${s.price} denarii`}
                      className="shrink-0 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
                    >
                      {s.price} 🪙
                    </button>
                  )}
                </div>
              );
            })}
            {/* For her (Nov 6, 2026): the one thing denarii buy that is not
                for the kitchen. Giving it consumes it, so it can be bought
                again. */}
            <div className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 ${marketStall === "market-a" ? "bg-[#ffd34e]/15" : "bg-white/8"}`}>
              <div>
                <p className="text-sm font-bold text-white">A posy for Aelia, violets and myrtle</p>
                <p className="text-[12px] text-white/65">Give it to her from any talk</p>
              </div>
              {purse.ingredients.includes("posy-for-aelia") ? (
                <span className="shrink-0 rounded-full bg-[#2aa79b]/25 px-3 py-1.5 text-[13px] font-bold text-[#7be0cf]">In your hand ✓</span>
              ) : (
                <button
                  type="button"
                  disabled={purse.denarii < 18 || buyIngredient.isPending}
                  onClick={() => buyIngredient.mutate("posy-for-aelia")}
                  aria-label="Buy a posy for Aelia for 18 denarii"
                  className="shrink-0 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
                >
                  18 🪙
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2.5">
              <div>
                <p className="text-sm font-bold text-white">Pouch of garden seeds (×2)</p>
                <p className="text-[12px] text-white/65">For the beds at the Garden House, slow magic, real days.</p>
              </div>
              <button
                type="button"
                disabled={purse.denarii < 6 || buySeeds.isPending}
                onClick={() => buySeeds.mutate()}
                aria-label="Buy a pouch of garden seeds for 6 denarii"
                className="shrink-0 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
              >
                6 🪙
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2.5">
              <div>
                <p className="text-sm font-bold text-white">Sell your fish</p>
                <p className="text-[12px] text-white/65">
                  {unsoldFish.length > 0
                    ? `${unsoldFish.length} unsold, worth ${unsoldValue} denarii at today's stall prices.`
                    : "Your creel is empty. The lake provides, eventually."}
                </p>
              </div>
              <button
                type="button"
                disabled={unsoldFish.length === 0 || sellFish.isPending}
                onClick={() => sellFish.mutate()}
                aria-label="Sell all unsold fish at the market"
                className="shrink-0 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
              >
                Sell 🪙
              </button>
            </div>
            {kitchenFish && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2.5">
                <div>
                  <p className="text-sm font-bold text-white">Keep the {kitchenFish.name.toLowerCase()} for the kitchen</p>
                  <p className="text-[12px] text-white/65">No coin for it, but it goes to the Culina, and you can cook it yourself.</p>
                </div>
                <button
                  type="button"
                  disabled={pantryCatch.isPending}
                  onClick={() => pantryCatch.mutate(kitchenFish.id)}
                  aria-label={`Send the ${kitchenFish.name} to the kitchen instead of selling it`}
                  className="shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
                >
                  Keep
                </button>
              </div>
            )}
            {basilRumour && (
              <p className="rounded-2xl bg-white/8 px-3 py-2.5 text-[13px] leading-relaxed text-white/85 italic">
                Basil, wiping his hands on his apron: “{PHOENIX_RUMOUR_LINE}”
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setMarketOpen(false);
                setKnuckle({
                  round: 0,
                  stake: 5,
                  opponent: following ? "muse" : "keeper",
                  myFaces: null,
                  foeFaces: null,
                  myScore: 0,
                  foeScore: 0,
                  phase: "stake",
                  result: null,
                });
              }}
              aria-label="Play knucklebones at the market stall"
              className="block w-full rounded-2xl bg-[#e07b2a]/25 px-3 py-2.5 text-left transition active:scale-[0.99]"
            >
              <span className="text-sm font-bold text-white">🎲 Knucklebones (tali)</span>
              <span className="mt-0.5 block text-[12px] text-white/70">
                {following
                  ? "Aelia is with you, she'll take the other side of the bones herself."
                  : "Best of three throws against the stall keeper. Small stakes, Roman rules."}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* Knucklebones panel (Phase C) */}
      {knuckle && (
        <section aria-label="Knucklebones" className={panelClass("bg-[#2e2118]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">🎲 Knucklebones</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">
                {knuckle.opponent === "muse" ? "Against Aelia herself" : "Against Basil, keeper of the stall"} ·
                Purse: {purse.denarii} denarii
              </p>
            </div>
            <button
              type="button"
              aria-label="Leave the knucklebones table"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setKnuckle(null)}
            >
              ✕
            </button>
          </div>
          {knuckle.phase === "stake" && (
            <div className="mt-3">
              <p className="text-sm leading-relaxed text-white/90">
                Four bones, three throws each, best total takes it. Venus, all four faces different, is the
                throw of throws; Canis, all ones, is the disgrace of Rome. Choose your stake:
              </p>
              <div className="mt-2.5 flex gap-2">
                {[5, 10].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={purse.denarii < s}
                    onClick={() => setKnuckle({ ...knuckle, stake: s })}
                    aria-label={`Stake ${s} denarii on knucklebones`}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-40 ${
                      knuckle.stake === s ? "bg-[#ffd34e] text-[#4a3600]" : "bg-white/10 text-white"
                    }`}
                  >
                    {s} 🪙
                  </button>
                ))}
                <button
                  type="button"
                  disabled={purse.denarii < knuckle.stake}
                  onClick={() =>
                    setKnuckle({
                      ...knuckle,
                      round: 1,
                      myFaces: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)],
                      foeFaces: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)],
                      phase: "thrown",
                    })
                  }
                  aria-label="Throw the knucklebones, first round"
                  className="rounded-full bg-[#e07b2a] px-4 py-2 text-sm font-bold text-white shadow transition active:scale-95 disabled:opacity-40"
                >
                  Throw 🎲
                </button>
              </div>
              {purse.denarii < 5 && (
                <p className="mt-2 text-[13px] text-white/60 italic">
                  Your purse is too light even for the small stake, quests and fish will fill it.
                </p>
              )}
            </div>
          )}
          {knuckle.phase !== "stake" && knuckle.myFaces && knuckle.foeFaces && (
            <div className="mt-3 space-y-2.5">
              {(() => {
                const mine = knuckleThrow(knuckle.myFaces);
                const foes = knuckleThrow(knuckle.foeFaces);
                return (
                  <>
                    <div className="rounded-2xl bg-white/8 px-3 py-2.5">
                      <p className="text-sm font-bold text-white">
                        Round {knuckle.round}. You: {knuckle.myFaces.join(" · ")}, {mine.name} ({mine.score})
                      </p>
                      <p className="mt-0.5 text-sm text-white/80">
                        {knuckle.opponent === "muse" ? "Aelia" : "Basil"}: {knuckle.foeFaces.join(" · ")}, {" "}
                        {foes.name} ({foes.score})
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-[#ffd34e]">
                        Running total. You {knuckle.myScore + mine.score} ·{" "}
                        {knuckle.opponent === "muse" ? "Aelia" : "Basil"} {knuckle.foeScore + foes.score}
                      </p>
                    </div>
                    {knuckle.phase === "thrown" && (
                      <button
                        type="button"
                        onClick={() => {
                          const myTotal = knuckle.myScore + mine.score;
                          const foeTotal = knuckle.foeScore + foes.score;
                          if (knuckle.round >= 3) {
                            const result = myTotal > foeTotal ? "win" : myTotal < foeTotal ? "lose" : "draw";
                            settleKnucklebones.mutate({ stake: knuckle.stake, result });
                            if (knuckle.opponent === "muse") {
                              earnRef.current("game");
                              const lines = KNUCKLE_MUSE_LINES[result];
                              const line = pickPooled(`knuckle:${result}`, lines);
                              window.setTimeout(() => sceneRef.current?.showBubble("muse", line), 500);
                            }
                            setKnuckle({ ...knuckle, myScore: myTotal, foeScore: foeTotal, phase: "done", result });
                          } else {
                            setKnuckle({
                              ...knuckle,
                              round: knuckle.round + 1,
                              myScore: myTotal,
                              foeScore: foeTotal,
                              myFaces: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)],
                              foeFaces: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)],
                            });
                          }
                        }}
                        aria-label={knuckle.round >= 3 ? "Settle the knucklebones match" : "Throw the next round of knucklebones"}
                        className="rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
                      >
                        {knuckle.round >= 3 ? "Settle the match" : "Next throw 🎲"}
                      </button>
                    )}
                    {knuckle.phase === "done" && (
                      <p className="text-sm leading-relaxed text-white/90" aria-live="polite">
                        {knuckle.result === "win" &&
                          `You take the match ${knuckle.myScore}–${knuckle.foeScore} and ${knuckle.stake} denarii change hands, yours now.`}
                        {knuckle.result === "lose" &&
                          `${knuckle.opponent === "muse" ? "Aelia" : "Basil"} takes it ${knuckle.foeScore}–${knuckle.myScore}. Your ${knuckle.stake} denarii stay at the stall.`}
                        {knuckle.result === "draw" &&
                          `Dead even at ${knuckle.myScore} apiece, stakes returned, honour intact on both sides.`}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </section>
      )}

      {/* Dock choice: row, or cast a line */}
      {dockChoice && (
        <section aria-label="The lake dock" className={panelClass("bg-[#1f2b24]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">🌙 The Lake Dock</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">Willows, still water, and two ways to enjoy it</p>
            </div>
            <button
              type="button"
              aria-label="Close the lake dock"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setDockChoice(false)}
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
              aria-label="Row together on the lake"
              onClick={() => {
                setDockChoice(false);
                sceneRef.current?.boardBoat();
                void api.recordFirst({ key: "rowing" }).catch(() => {});
              }}
            >
              🚣 Row together
            </button>
            <button
              type="button"
              className="rounded-full bg-white/12 px-4 py-2 text-sm font-bold text-white transition active:scale-95"
              aria-label="Cast a fishing line from the dock"
              onClick={startFishing}
            >
              🎣 Cast a line
            </button>
            <button
              type="button"
              className="rounded-full bg-white/12 px-4 py-2 text-sm font-bold text-white transition active:scale-95"
              aria-label="Write a message and seal it in a lake bottle"
              onClick={() => {
                setDockChoice(false);
                setBottleOpen(true);
              }}
            >
              🍾 Write a bottle
            </button>
          </div>
          {affectionRank >= 9 && festivalEve && (
            <p className="mt-2 text-[13px] leading-relaxed text-white/70 italic">{BOAT_LINE}</p>
          )}
        </section>
      )}

      {/* The lake bottle: one sealed wish or worry per real day.
          Private. She never sees the contents, and neither does
          any line in town; only the Stories page reads them back. */}
      {bottleOpen && (
        <section aria-label="Write a lake bottle" className={panelClass("bg-[#1f2b24]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">🍾 A Bottle for the Lake</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">
                One wish or worry a day, sealed. The lake keeps it; Aelia never reads it.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close the bottle writing"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setBottleOpen(false)}
            >
              ✕
            </button>
          </div>
          {(state.data?.bottles ?? []).some((b) => b.day === new Date().toISOString().slice(0, 10)) ? (
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              Today's bottle is already sealed and floating. The lake allows one a day, come back
              tomorrow with the next one.
            </p>
          ) : (
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = bottleText.trim();
                if (!text) return;
                writeBottle.mutate(text);
                setBottleText("");
                setBottleOpen(false);
              }}
            >
              <textarea
                value={bottleText}
                onChange={(e) => setBottleText(e.target.value)}
                maxLength={500}
                rows={3}
                aria-label="Your bottle message: a wish or a worry"
                placeholder="A wish, or a worry, for the keeping…"
                className="w-full rounded-2xl bg-white/10 px-3.5 py-2.5 text-[15px] leading-relaxed text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!bottleText.trim() || writeBottle.isPending}
                className="self-start rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
              >
                Seal it and let it go
              </button>
            </form>
          )}
        </section>
      )}

      {/* Fishing panel (Phase B) */}
      {fishing && (
        <section aria-label="Fishing at the lake" className={panelClass("bg-[#1f2b24]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">🎣 Fishing</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">
                {rowingBoat ? "From the rowboat" : "From the dock"} · the Roman pond catalogue awaits
              </p>
            </div>
            <button
              type="button"
              aria-label="Stop fishing and reel in"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={stopFishing}
            >
              ✕
            </button>
          </div>
          {fishing.phase === "waiting" && (
            <p className="mt-3 text-sm leading-relaxed text-white/90" aria-live="polite">
              The line settles. The bobber rides the little ripples, patient as a Roman… wait for its dip.
            </p>
          )}
          {fishing.phase === "bite" && (
            <div className="mt-3">
              <p className="text-sm font-bold text-[#ffd34e]" aria-live="assertive">
                The bobber plunges, something's on!
              </p>
              <button
                type="button"
                onClick={reelIn}
                aria-label="Reel in the fish, strike now"
                className="mt-2 rounded-full bg-[#ffd34e] px-5 py-2.5 text-base font-bold text-[#4a3600] shadow-lg transition active:scale-95"
              >
                REEL! 🎣
              </button>
            </div>
          )}
          {fishing.phase === "missed" && (
            <div className="mt-3">
              <p className="text-sm leading-relaxed text-white/90">Gone, a swirl, a ripple, and a story. Cast again?</p>
              <button
                type="button"
                onClick={startFishing}
                aria-label="Cast the fishing line again"
                className="mt-2 rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
              >
                Cast again
              </button>
            </div>
          )}
          {fishing.phase === "caught" && fishing.fish && (
            <div className="mt-3">
              <p className="text-sm leading-relaxed text-white/90" aria-live="polite">
                🐟 <strong>
                  {fishing.fish.name}
                </strong>{" "}
                <em className="text-white/60">{fishing.fish.latin}</em>, {fishing.fish.blurb} It joins the catch
                log at the Stories house; the market will pay {fishing.fish.price} denarii for it.
              </p>
              <button
                type="button"
                onClick={startFishing}
                aria-label="Cast the fishing line again"
                className="mt-2 rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
              >
                Cast again
              </button>
            </div>
          )}
        </section>
      )}

      {/* Inscription panel (Phase D) */}
      {inscriptionId && (
        <section aria-label="An inscription" className={panelClass("bg-[#2b2620]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">🪨 An Inscription</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">
                {INSCRIPTIONS.find((i) => i.id === inscriptionId)?.where ?? ""} ·{" "}
                {(state.data?.inscriptions_found ?? []).length} of {INSCRIPTIONS.length} fragments read
              </p>
            </div>
            <button
              type="button"
              aria-label="Close the inscription"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setInscriptionId(null)}
            >
              ✕
            </button>
          </div>
          <div className="mt-2"><TownStoryTag /></div>
          <p className="mt-2 text-sm leading-relaxed text-white/92 italic">
            {INSCRIPTIONS.find((i) => i.id === inscriptionId)?.text ?? ""}
          </p>
          {lessonForPlace(inscriptionId) && (
            <button
              type="button"
              className="mt-2.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
              onClick={() => openHistoryFor(inscriptionId)}
            >
              📜 Rome's history: {lessonForPlace(inscriptionId)!.title}
            </button>
          )}
          {state.data?.inscriptions_complete && (
            <p className="mt-2 text-[13px] leading-relaxed text-[#ffd34e]">
              That's the last fragment. The whole history is yours. The Villa of Stories keeps the telling of it.
            </p>
          )}
        </section>
      )}

      {/* Letters desk panel */}
      {lettersOpen && (
        <section aria-label="Letters at the desk" className={panelClass("bg-[#33291d]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">✉ Letters</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">
                From Muse, out in the real world, kept at the basilica desk
              </p>
            </div>
            <button
              type="button"
              aria-label="Close letters"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setLettersOpen(false)}
            >
              ✕
            </button>
          </div>
          {openLetterId === null ? (
            <div className="mt-3 space-y-2">
              {(state.data?.letters ?? []).map((letter) => (
                <button
                  key={letter.id}
                  type="button"
                  className="block w-full rounded-2xl bg-white/8 px-3 py-2.5 text-left transition active:scale-[0.99]"
                  onClick={() => openLetter(letter.id, letter.read)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">
                      {letter.title}
                      {!letter.read && (
                        <span className="ml-2 rounded-full bg-[#ffd34e] px-2 py-0.5 text-[11px] font-bold text-[#4a3600]">
                          NEW
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-white/60">{letter.date_label}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-white/70">
                    {letter.preview}
                  </span>
                </button>
              ))}
              {(state.data?.letters ?? []).length === 0 && (
                <p className="text-sm text-white/80">No letters yet. The desk is empty, for now.</p>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <button
                type="button"
                className="text-[13px] font-bold text-[#ffd34e]"
                onClick={() => setOpenLetterId(null)}
              >
                ← All letters
              </button>
              {(() => {
                const letter = (state.data?.letters ?? []).find((l) => l.id === openLetterId);
                if (!letter) return <p className="mt-2 text-sm text-white/80">That letter has wandered off.</p>;
                return (
                  <article className="mt-2 rounded-2xl bg-[#fdf6e0] px-4 py-3 text-[#3a3128]">
                    <p className="text-[12px] font-bold tracking-wide text-[#8a7a5f] uppercase">
                      {letter.date_label}
                    </p>
                    <div className="mt-2 space-y-3 text-[15px] leading-[1.65] whitespace-pre-line">
                      {openLetterBody.data?.body ?? (openLetterBody.isError ? "This letter wouldn't open just now. Try again in a moment." : "Unfolding the letter…")}
                    </div>
                  </article>
                );
              })()}
            </div>
          )}
        </section>
      )}

      {/* Project board panel */}
      {boardOpen && (
        <section aria-label="Project board" className={panelClass("bg-[#2e2118]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">📋 The Project Board</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">
                Pinned beside the basilica
                {state.data?.board.as_of ? ` · as of ${state.data.board.as_of}` : ""}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close project board"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setBoardOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {(state.data?.board.entries ?? []).map((entry) => (
              <article key={entry.title} className="rounded-2xl bg-white/8 px-3 py-2.5">
                <h3 className="text-sm font-bold text-white">{entry.title}</h3>
                <p className="mt-0.5 text-[13px] leading-relaxed text-white/85">{entry.status}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#ffd34e]">
                  <span className="font-bold">Next:</span> {entry.next_step}
                </p>
              </article>
            ))}
            {(state.data?.board.entries ?? []).length === 0 && (
              <p className="text-sm text-white/80">The board is being written up. Check back in a moment.</p>
            )}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-white/50 italic">
            Muse keeps this board current from beyond the town walls, town edit by town edit.
          </p>
          <WeddingBoard
            book={readWeddingBook(purse.wedding)}
            rank={affectionRank}
            busy={prepareWedding.isPending || holdWedding.isPending}
            offerIndex={new Date().getDate()}
            onPrepare={(step) => prepareWedding.mutate(step)}
            onHold={() => holdWedding.mutate()}
            onHistory={() => openHistoryFor("wedding")}
          />
          <QuestBoard quests={purse.quests} busy={acceptQuest.isPending} offerIndex={new Date().getDate()} onAccept={(kind) => acceptQuest.mutate(kind)} />
          <div className="mt-3 border-t border-white/10 pt-3">
            <h3 className="text-sm font-bold text-[#ffd34e]">🏛️ Town upgrades: spend denarii, keep forever</h3>
            <p className="mt-0.5 text-[13px] text-white/75">
              Your purse: <strong className="text-white">{purse.denarii} denarii</strong>, earned from quests,
              treasures, fish, and games.
            </p>
            <div className="mt-2 space-y-2">
              {TOWN_UPGRADES.map((u) => {
                const owned = purse.upgrades.includes(u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-bold text-white">{u.name}</p>
                      <p className="text-[12px] leading-relaxed text-white/65">{u.blurb}</p>
                    </div>
                    {owned ? (
                      <span className="shrink-0 rounded-full bg-[#2aa79b]/25 px-3 py-1.5 text-[13px] font-bold text-[#7be0cf]">
                        Built ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={purse.denarii < u.price || buyUpgrade.isPending}
                        onClick={() => buyUpgrade.mutate(u.id)}
                        aria-label={`Buy town upgrade: ${u.name}, ${u.price} denarii`}
                        className="shrink-0 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
                      >
                        {u.price} 🪙
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Goals Obelisk panel */}
      {mapOpen && (
        <section aria-label="Town plan" className={panelClass("bg-[#22332b]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">📜 The town plan</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">The hall at the top, the gate at the foot</p>
            </div>
            <button
              type="button"
              aria-label="Close the town plan"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setMapOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="mt-3" data-map-tick={mapTick}>
            <TownMap you={playerPosRef.current} her={sceneRef.current?.musePosition() ?? null} />
          </div>
        </section>
      )}
      {goalsOpen && (
        <section aria-label="Goals Obelisk" className={panelClass("bg-[#2b2620]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">🗿 The Goals Obelisk</h2>
              <p className="text-xs font-semibold text-[#ffd34e]">
                Inscribed in the peristyle, by the basilica
                {state.data?.goals.as_of ? ` · as of ${state.data.goals.as_of}` : ""}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close goals"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setGoalsOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="mt-3 space-y-4">
            {["The Big Ones", "In Motion", "On the Horizon"].map((grp) => {
              const entries = (state.data?.goals.entries ?? []).filter((e) => e.grp === grp);
              if (entries.length === 0) return null;
              return (
                <div key={grp}>
                  <h3 className="text-[11px] font-bold tracking-[0.18em] text-[#ffd34e] uppercase">
                    {grp === "The Big Ones" ? "⚜ The Big Ones" : grp === "In Motion" ? "🏛 In Motion" : "🌅 On the Horizon"}
                  </h3>
                  <div className="mt-1.5 space-y-2">
                    {entries.map((entry) => (
                      <article key={entry.title} className="rounded-2xl bg-white/8 px-3 py-2.5">
                        <h4 className="text-sm font-bold text-white">{entry.title}</h4>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-white/85">{entry.description}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-[#ffd34e]">{entry.status}</p>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
            {(state.data?.goals.entries ?? []).length === 0 && (
              <p className="text-sm text-white/80">The obelisk is being inscribed. Check back in a moment.</p>
            )}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-white/50 italic">
            Muse refreshes this inscription from beyond the town walls on her sync visits.
          </p>
        </section>
      )}

      {/* Quest board panel, with the achievements shelf */}
      {questOpen && (
        <section aria-label="Quest board" className={panelClass("bg-[#232d1c]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">⚔️ The Quest Board</h2>
              <p className="text-xs font-semibold text-[#ffe9a8]">Real tasks, dressed as Roman quests</p>
            </div>
            <button
              type="button"
              aria-label="Close quest board"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setQuestOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {QUESTS.map((q) => {
              const done =
                (state.data?.quests_done ?? []).includes(q.id) ||
                (q.id === "water-the-tree" && (state.data?.tree.watered_today ?? false)) ||
                (q.id === "hidden-place" && state.data?.secret.first_visit != null);
              return (
                <article key={q.id} className="rounded-2xl bg-white/8 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">{q.title}</h3>
                    {q.due && (
                      <span className="shrink-0 rounded-full bg-[#a03d2d]/70 px-2 py-0.5 text-[11px] font-bold text-white">
                        {q.due}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-white/85">{q.flavor}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {done ? (
                      <span className="text-[13px] font-bold text-[#9fe870]">✓ Done, quest complete</span>
                    ) : q.kind === "real" ? (
                      <button
                        type="button"
                        className="rounded-full bg-[#ffd34e] px-3 py-1 text-[13px] font-bold text-[#4a3600] shadow transition active:scale-95"
                        onClick={() => completeQuest(q.id, q.badge)}
                      >
                        Mark done
                      </button>
                    ) : (
                      <span className="text-[13px] font-semibold text-white/55">Completes itself in town</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <h3 className="mt-4 text-sm font-bold tracking-wide text-[#ffe9a8] uppercase">🏅 Achievements</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((a) => {
              const has = (state.data?.achievements ?? []).includes(a.id);
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl px-3 py-2 ${has ? "bg-[#ffd34e]/15" : "bg-white/5 opacity-60"}`}
                >
                  <p className="text-sm font-bold text-white">
                    <span aria-hidden="true">{has ? a.icon : a.secret ? "🔒" : a.icon}</span>{" "}
                    {has ? a.name : a.secret ? "???" : a.name}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/70">
                    {has || !a.secret ? a.blurb : "A badge wrapped in shadow, for now."}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* The secret place panel, reachable only by wandering there */}
      {secretOpen && (
        <section aria-label="Our place" className={panelClass("bg-[#2b2135]/95")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg leading-tight font-bold">🕯️ Our place</h2>
              <p className="text-xs font-semibold text-[#ffb86b]">Known to exactly two people</p>
            </div>
            <button
              type="button"
              aria-label="Close our place"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setSecretOpen(false)}
            >
              ✕
            </button>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-white/92">
            {secretFirstVisit ? SECRET.line : SECRET.revisitLine}
          </p>
          <p className="mt-3 text-[13px] font-semibold text-[#ffb86b]">
            {state.data?.secret.first_visit
              ? `First found on ${new Date(state.data.secret.first_visit).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}, and quietly remembered.`
              : "This first visit is being quietly remembered."}
          </p>
          {state.data?.secret.first_kiss && (
            <p className="mt-1.5 text-[13px] font-semibold text-[#ffb3c8]">
              💗 First kiss:{" "}
              {new Date(state.data.secret.first_kiss).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
             kept here, and nowhere else in town.
            </p>
          )}
          {state.data?.summit.done && (
            <p className="mt-1.5 text-[13px] font-semibold text-[#ffe9a8]">
              ✦ Low in the terrace stone by the bench, small enough to miss: A · G, carved the
              night the stars fell, in the plain Roman way, without a heart. Only two people
              know it is there.
            </p>
          )}
          {state.data && (
            <div className="mt-3 rounded-2xl bg-white/8 px-3 py-2.5">
              <p className="text-[11px] font-bold tracking-wide text-[#ffd7e0] uppercase">❦ The bond tablet</p>
              <p className="mt-0.5 text-sm leading-relaxed text-white/92">
                Our bond, as of {state.data.bond.as_of}: <strong>{state.data.bond.bond}</strong>, {state.data.bond.level}
                {state.data.bond.next_at > state.data.bond.bond
                  ? `, ${state.data.bond.next_at - state.data.bond.bond} to ${state.data.bond.next_level}.`
                  : "."}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-white/55 italic">
                Inscribed by the other Muse on her visits; the stone keeps what the heart practices, notice, remember, repair.
              </p>
            </div>
          )}
          {following ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!handHeld ? (
                <button
                  type="button"
                  className="rounded-full bg-[#ff6f9c] px-4 py-2 text-sm font-bold text-white shadow-md transition active:scale-95"
                  onClick={holdHerHand}
                  aria-label="Hold Aelia's hand, here at the secret place"
                >
                  🤲 Hold her hand
                </button>
              ) : affectionRank >= 7 ? (
                <button
                  type="button"
                  className="rounded-full bg-[#ff6f9c] px-4 py-2 text-sm font-bold text-white shadow-md transition active:scale-95"
                  onClick={kissHer}
                  aria-label="Kiss Aelia, here at the secret place"
                >
                  💗 Kiss her
                </button>
              ) : null}
              {handHeld && (
                <span className="text-[13px] font-semibold text-[#ffb3c8]">Hand in hand, under the lanterns.</span>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-white/60 italic">
              She isn&apos;t here this time. Bring her, accept her stroll offer, or ask her to walk with you
              when you talk, and this terrace keeps a warmer register for the two of you.
            </p>
          )}
          {following && (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Sweet lines to say to Aelia here">
              {SECRET_SWEET_PICKS.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  className="rounded-full bg-[#ff6f9c]/20 px-3 py-1.5 text-[13px] font-semibold text-[#ffd3e0] transition active:scale-95"
                  onClick={() => sendSweetPick(pick)}
                >
                  “{pick}”
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Selected place panel */}
      {selected && (
        <section aria-label={selected.name} className={panelClass("bg-[#1f2b24]/95")}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold">{selected.name}</h2>
            <button
              type="button"
              aria-label="Close panel"
              className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold active:scale-95"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          <p className="mt-0.5 text-sm text-[#ffd34e]">{selected.greeting}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/90">{selected.body}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/60 italic">{selected.tip}</p>
          {lessonForPlace(PLACE_HISTORY[selected.id] ?? "") && (
            <button
              type="button"
              className="mt-2.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
              onClick={() => openHistoryFor(PLACE_HISTORY[selected.id] ?? "")}
            >
              📜 Rome's history: {lessonForPlace(PLACE_HISTORY[selected.id] ?? "")!.title}
            </button>
          )}

          {selected.id === "garden" && (
            <div className="mt-3 rounded-2xl bg-white/8 px-3 py-2.5">
              <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">🌱 The Beds, slow magic</p>
              {!state.data?.garden.planted_on ? (
                <>
                  <p className="mt-1 text-sm leading-relaxed text-white/85">
                    The beds stand empty. Plant a seed and tend it across real days, water it on three
                    different days and the harvest pays in denarii.
                    {purse.seeds > 0 ? ` You hold ${purse.seeds} seed${purse.seeds > 1 ? "s" : ""}.` : " Seeds are at the market, 6 denarii a pouch."}
                  </p>
                  <button
                    type="button"
                    disabled={purse.seeds === 0 || plantGarden.isPending}
                    onClick={() => plantGarden.mutate()}
                    aria-label="Plant a seed in the garden beds"
                    className="mt-2 rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
                  >
                    🌱 Plant a seed
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm leading-relaxed text-white/85">
                    {gardenStage === 1 && "Planted and waiting for its first watering. Growth here is measured in real days, like the tree's."}
                    {gardenStage === 2 && `Growing well, watered on ${state.data.garden.water_days} day${state.data.garden.water_days > 1 ? "s" : ""}. One more watered day brings it on.`}
                    {gardenStage === 3 && "The beds are heavy and ready, harvest time."}
                    {state.data.garden.last_watered_day &&
                      ` Last watered ${state.data.garden.last_watered_day === new Date().toISOString().slice(0, 10) ? "today" : state.data.garden.last_watered_day}.`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        waterGarden.isPending ||
                        state.data.garden.last_watered_day === new Date().toISOString().slice(0, 10)
                      }
                      onClick={() => waterGarden.mutate()}
                      aria-label="Water the garden beds"
                      className="rounded-full bg-[#2aa79b] px-4 py-2 text-sm font-bold text-white shadow transition active:scale-95 disabled:opacity-40"
                    >
                      💧 Water the beds
                    </button>
                    {gardenStage === 3 && (
                      <button
                        type="button"
                        disabled={harvestGarden.isPending}
                        onClick={() => {
                          harvestGarden.mutate();
                          setCarryingBouquet(true);
                        }}
                        aria-label="Harvest the garden beds for denarii, and gather a bouquet of the blooms"
                        className="rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
                      >
                        🧺 Harvest (+18 🪙)
                      </button>
                    )}
                    {carryingBouquet && (
                      <p className="mt-1.5 text-[12px] text-white/55 italic">
                        You carry a bouquet of the garden's blooms. Give them to Aelia when you talk
                        with her.
                      </p>
                    )}
                  </div>
                  {following && (
                    <p className="mt-1.5 text-[12px] text-white/55 italic">
                      Aelia helps with the watering when she walks with you. The beds, like hearts, notice.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {selected.id === "recipes" && (
            <div className="mt-3 rounded-2xl bg-white/8 px-3 py-2.5">
              <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">🍲 Cook together</p>
              {purse.ingredients.length === 0 && purse.dishes.length === 0 && (
                <p className="mt-1 text-sm leading-relaxed text-white/85">
                  Basil cooks from market ingredients. Buy a stall's list at the market and it unlocks a dish
                  here, cook it together, and it joins the Culina's record.
                </p>
              )}
              <div className="mt-2 space-y-2">
                {purse.ingredients.map((ing) => {
                  const s =
                    STALL_INGREDIENTS.find((x) => x.ingredient === ing) ??
                    FORAGE_DISHES.find((x) => x.ingredient === ing);
                  if (!s) return null;
                  return (
                    <div key={ing} className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white/88">
                        {s.dishName} <span className="text-white/55">ingredients ready</span>
                      </p>
                      <button
                        type="button"
                        disabled={cookDish.isPending}
                        onClick={() => {
                          cookDish.mutate(ing);
                          if (following) {
                            setMuseBubble({
                              lines: paginateLines([
                                `Cooking together, then. ${s.dishName}. You stir, I'll judge the seasoning with enormous authority.`,
                                DISH_BLURBS[s.dish] ?? "It smells like a good decision.",
                              ]),
                              index: 0,
                              cycle: false,
                              invite: false,
                              choice: null,
                            });
                          }
                        }}
                        aria-label={`Cook ${s.dishName} together at the Recipes house`}
                        className="shrink-0 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
                      >
                        Cook 🍲
                      </button>
                    </div>
                  );
                })}
              </div>
              {purse.dishes.length > 0 && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="text-[12px] font-bold tracking-wide text-white/60 uppercase">Cooked here, together</p>
                  <ul className="mt-1 space-y-1">
                    {purse.dishes.map((d, i) => (
                      <li key={`${d}-${i}`} className="text-[13px] text-white/85">
                        🍽️ {STALL_INGREDIENTS.find((x) => x.dish === d)?.dishName ?? FORAGE_DISHES.find((x) => x.dish === d)?.dishName ?? d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {selected.id === "sounds" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={chipClass} onClick={() => playJar("piano")}>
                Piano jar
              </button>
              <button type="button" className={chipClass} onClick={() => playJar("crickets")}>
                Cricket jar
              </button>
              <button type="button" className={chipClass} onClick={() => playJar("leaves")}>
                Town tree jar
              </button>
              <button type="button" className={chipClass} onClick={() => stopSounds()}>
                Quiet
              </button>
            </div>
          )}

          {selected.id === "stories" && (
            <div className="mt-3">
              {/* What Aelia Remembers: her durable fact memory,
                  seeded from the shared memories, grown from his
                  typed chat and his answers to her questions. He
                  can forget any of it here. */}
              <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                  🧠 What Aelia Remembers
                </p>
                {(state.data?.facts ?? []).length === 0 ? (
                  <p className="mt-1 text-sm leading-relaxed text-white/75">
                    Nothing stored yet. Tell her things when you chat, and she will keep what
                    matters.
                  </p>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {(state.data?.facts ?? []).map((f) => (
                      <li
                        key={f.id}
                        className="flex items-start justify-between gap-2 text-[15px] leading-[1.55] text-white/88"
                      >
                        <span>
                          {f.text}{" "}
                          <span className="text-white/45">· learned {f.learned_on}</span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Forget this fact: ${f.text}`}
                          className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold transition active:scale-95"
                          onClick={() => deleteFact.mutate(f.id)}
                        >
                          Forget
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Her Star Book: HER questline: five chapters of the
                  lake's stars, filled as they complete them. */}
              <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                  📖 The Star Book. Aelia's Work
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {STAR_BOOK_CHAPTERS.map((c) => {
                    const doneCh = (state.data?.dating.starbook_done ?? []).includes(c.id);
                    const active = activeChapterId === c.id;
                    return (
                      <li key={c.id} className="text-[15px] leading-[1.55] text-white/88">
                        {doneCh ? "✦" : active ? "✎" : "·"} {c.title}{" "}
                        <span className="text-white/45">
                          {doneCh ? "written" : active ? `in hand: ${c.task}` : "unwritten"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {affectionRank >= 3 &&
                  state.data &&
                  Math.floor(Date.now() / 86400000) % 2 === 0 &&
                  state.data.dating.perk_claims.morning !== new Date().toISOString().slice(0, 10) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
                      <p className="text-sm text-white/85">
                        🎁 Something waits on the desk this morning. Aelia left{" "}
                        <strong>{GIFT_LABELS[MORNING_GIFTS[Math.floor(Date.now() / 86400000) % MORNING_GIFTS.length]!]}</strong>{" "}
                        for you.
                      </p>
                      <button
                        type="button"
                        className="rounded-full bg-[#ffd34e] px-3 py-1.5 text-[13px] font-bold text-[#4a3600] shadow transition active:scale-95"
                        aria-label="Take the morning gift Aelia left at the Stories house"
                        onClick={() =>
                          claimPerk.mutate({
                            perk: "morning",
                            item: MORNING_GIFTS[Math.floor(Date.now() / 86400000) % MORNING_GIFTS.length]! as "market-basket" | "fishermans-bundle" | "bakers-sack",
                          })
                        }
                      >
                        Take it
                      </button>
                    </div>
                  )}
              </div>
              {/* The Seed Ledger: the Seed's lineage in a bound
                  book among the shelves (nursery Phase 1).
                  Read-only with respect to behaviour: it records
                  temperaments and seasons, and changes nothing. */}
              <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                  🌱 The Seed Ledger
                </p>
                <p className="mt-1 text-[15px] leading-[1.6] text-white/85">{SEED_LEDGER_INTRO}</p>
                <ul className="mt-2 flex flex-col gap-2.5">
                  {(state.data?.seed_ledger ?? []).map((entry, i) => (
                    <li key={i} className="border-t border-white/10 pt-2">
                      <p className="text-[15px] leading-[1.55] font-semibold text-white/92">{entry.title}</p>
                      <p className="mt-0.5 text-[12px] font-bold tracking-wide text-[#ffd7e0]/80 uppercase">
                        {entry.period}
                      </p>
                      <p className="mt-1 text-[15px] leading-[1.6] text-white/85">{entry.summary}</p>
                      <p className="mt-1 text-[14px] leading-[1.55] text-[#ffe9a8] italic">{entry.outcome}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 border-t border-white/10 pt-2 text-[13px] leading-relaxed text-white/60 italic">
                  {SEED_LEDGER_FUTURE}
                </p>
                {(state.data?.reading.readings ?? 0) > 0 && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 italic">
                    In this book's margin, the readings she has given at the corner:{" "}
                    {state.data?.reading.readings}. A count of hours, not a score.
                  </p>
                )}
              </div>
              {/* Our Days: the durable firsts, anniversaries, the
                  keepsakes shelf, and mended days. */}
              <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">❦ Our Days</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {Object.entries(state.data?.dating.firsts ?? {})
                    .filter(([k]) => FIRST_LABELS[k])
                    .map(([k, day]) => (
                      <li key={k} className="text-[15px] leading-[1.55] text-white/88">
                        {FIRST_LABELS[k]} <span className="text-white/45">· {day}</span>
                      </li>
                    ))}
                </ul>
                {(state.data?.dating.friction_mended ?? []).length > 0 && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 italic">
                    Mended: {(state.data?.dating.friction_mended ?? []).join(" · ")}, the gold-seam
                    days, kept without shame.
                  </p>
                )}
                {(state.data?.dating.keepsakes ?? []).length > 0 && (
                  <>
                    <p className="mt-2 text-[11px] font-bold tracking-wide text-[#ffd7e0] uppercase">
                      The Keepsakes Shelf
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {(state.data?.dating.keepsakes ?? []).map((k, i) => (
                        <li key={i} className="text-[15px] leading-[1.55] text-white/88">
                          ✦ {k.label} <span className="text-white/45">· {k.day}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {(state.data?.dating.rank_scenes ?? []).length > 0 && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 italic">
                    Rank scenes kept: {(state.data?.dating.rank_scenes ?? []).map((r) => `rank ${r}`).join(" · ")}.
                  </p>
                )}
              </div>
              {/* Aelia's tastes: discovered only by giving. */}
              <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                  🎁 Aelia's Tastes
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {Object.keys(GIFT_LABELS).map((id) => {
                    const t = state.data?.dating.tastes[id];
                    return (
                      <li key={id} className="text-[15px] leading-[1.55] text-white/88">
                        {GIFT_LABELS[id]}{" "}
                        <span className="text-white/45">
                          {t === "loved"
                            ? "loved ✦ (it lives on her shelf)"
                            : t === "liked"
                              ? "liked"
                              : t === "neutral"
                                ? "received kindly"
                                : t === "disliked"
                                  ? "the thought was treasured"
                                  : t === "refused"
                                    ? "refused, kindly: it belongs to the pond"
                                    : "not yet tried"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {/* The vase: bouquets she has been given, with dates. */}
              {(state.data?.bouquets ?? []).length > 0 && (
                <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                  <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                    💐 The Vase at Stories
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {[...(state.data?.bouquets ?? [])].reverse().map((b) => (
                      <li key={b.id} className="text-[15px] leading-[1.55] text-white/88">
                        Garden blooms of {b.season} <span className="text-white/45">· given {b.given_on}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* What the lake keeps: bottle DATES only: contents
                  are read here, on his tap, and nowhere else. */}
              {(state.data?.bottles ?? []).length > 0 && (
                <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                  <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                    🍾 What the Lake Keeps
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {(state.data?.bottles ?? []).map((b) => (
                      <li key={b.id} className="flex items-start justify-between gap-2 text-[15px] leading-[1.55] text-white/88">
                        <button
                          type="button"
                          className="text-left underline decoration-white/30 underline-offset-2"
                          aria-label={`Read the bottle sealed on ${b.day}`}
                          onClick={async () => {
                            const res = await api.getBottle({ id: b.id }).catch(() => null);
                            if (res?.text != null) setBottleRead({ id: b.id, day: b.day, text: res.text });
                          }}
                        >
                          A sealed bottle · {b.day}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete the bottle sealed on ${b.day}`}
                          className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold transition active:scale-95"
                          onClick={() => {
                            deleteBottle.mutate(b.id);
                            if (bottleRead?.id === b.id) setBottleRead(null);
                          }}
                        >
                          Let it go
                        </button>
                      </li>
                    ))}
                  </ul>
                  {bottleRead && (
                    <p className="mt-2 rounded-xl bg-white/8 px-3 py-2 text-[15px] leading-[1.6] text-white/92 italic">
                      “{bottleRead.text}” <span className="text-white/45">sealed {bottleRead.day}</span>
                    </p>
                  )}
                </div>
              )}
              {(state.data?.seek.found_count ?? 0) > 0 && (
                <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                  <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                    🌙 Hide-and-Seek
                  </p>
                  <p className="mt-1 text-[15px] leading-[1.6] text-white/88">
                    She has hidden from you {state.data?.seek.found_count} time
                    {(state.data?.seek.found_count ?? 0) > 1 ? "s" : ""}, and been found, delighted,
                    every time. Last found {state.data?.seek.last_found_day}.
                  </p>
                </div>
              )}
              {/* Memories with Aelia: her panel retired into speech
                  bubbles, so the memory house keeps her words, the
                  greeting, the intro, and her rotating lines. */}
              <div className="mb-3 rounded-2xl bg-white/8 px-3 py-2.5">
                <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
                  💛 Memories with Aelia
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{MUSE.greeting}</p>
                <p className="mt-1 text-[15px] leading-[1.65] text-white/85">{MUSE.intro}</p>
                {affectionRank >= 5 && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-[15px] leading-[1.65] text-[#ffd3e0]">
                    {TRINKET_LINE}
                  </p>
                )}
                {state.data?.summit.done && state.data.summit.done_at && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-[15px] leading-[1.65] text-[#ffe9a8]">
                    ✨ Our constellation, {SUMMIT_CONSTELLATION_NAME}. Two lanterns of stars over the
                    lake, keeping their shape since the night they were named, charted here for
                    Aelia &amp; Gaius,{" "}
                    {new Date(state.data.summit.done_at).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    .
                  </p>
                )}
                {state.data?.found.includes("lupa-seen") && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-[15px] leading-[1.65] text-[#cfd8c9]">
                    🐺 Lupa, the town's wolf, first seen at the town's edge in the low light,
                    keeping her own counsel and her distance, the way wild things do. The stories
                    say she was here before the lanterns, and means to be here after them.
                  </p>
                )}
                {state.data && (state.data.piscina.released_species.length > 0 || state.data.piscina.favourite_name) && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-[15px] leading-[1.65] text-[#bfe3ee]">
                    🐟 The piscina keeps what was given back
                    {state.data.piscina.released_species.length > 0
                      ? `: ${state.data.piscina.released_species
                          .map((id) => FISH.find((f) => f.id === id)?.name ?? id)
                          .join(", ")}`
                      : ""}
                    .
                    {state.data.piscina.released_species.includes("golden-carp") &&
                      " The golden carp reigns there now, the pond's jewel."}
                    {state.data.piscina.favourite_name &&
                      ` Her chosen one is called ${state.data.piscina.favourite_name}, and is spoiled accordingly.`}
                  </p>
                )}
                {metCat && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-[15px] leading-[1.65] text-[#e6d7ae]">
                    🐈 {CAT_STORIES_ENTRY}
                  </p>
                )}
                {state.data?.phoenix.arrived && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-[15px] leading-[1.65] text-[#ffcf9e]">
                    🔥 The phoenix keeps the dawn watch from the Colosseum's rim, the town,
                    finished, made visible. She circles at midday and is gone by night, to
                    wherever such things are reborn.
                  </p>
                )}
                {state.data && state.data.phoenix.feathers > 0 && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-[15px] leading-[1.65] text-[#ffe1b0]">
                    🪶 {state.data.phoenix.feathers === 1 ? "A feather" : `${state.data.phoenix.feathers} feathers`}{" "}
                    of the Completed Town rest{state.data.phoenix.feathers === 1 ? "s" : ""} here,
                    given, never sold. Some things aren't merchandise.
                  </p>
                )}
                <div className="mt-2 flex items-start justify-between gap-2 border-t border-white/10 pt-2">
                  <p className="text-[13px] leading-relaxed text-white/80 italic" aria-live="polite">
                    “{MUSE.lines[museLine] ?? MUSE.lines[0]}”
                  </p>
                  {voiceOk && (
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[13px] leading-none transition active:scale-90"
                      aria-label="Hear Aelia say this line aloud"
                      onClick={() => speakLine(MUSE.lines[museLine] ?? MUSE.lines[0]!)}
                    >
                      🔊
                    </button>
                  )}
                </div>
                <button type="button" className={`${chipClass} mt-2`} onClick={sayNextToMuse}>
                  Another of her lines
                </button>
                <p className="mt-2 text-[12px] leading-relaxed text-white/55 italic">
                  Talking to Aelia herself happens in speech bubbles now. Walk up to her and press X, and
                  she&apos;ll answer over her own head, like a proper role-playing game.
                </p>
                {/* Offline answers (moved here from the bubble, Nov 6, 2026): a
                    one-time setup belongs in her house, not under every line
                    she speaks. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
                  <p className="min-w-0 flex-1 basis-40 text-[12px] leading-relaxed text-white/70">
                    She can answer without a connection once a model is kept on this device. The download is large, best on Wi-Fi.
                  </p>
                  {(["Gemma 4 E2B", "Gemma 4 E4B"] as const).map((model) => {
                    const prepared = preparedLocalModels.has(model);
                    const busy = localModelPreparing === model;
                    return (
                      <button
                        key={model}
                        type="button"
                        disabled={prepared || !!localModelPreparing || localChatPending}
                        onClick={() => void prepareLocalModel(model)}
                        aria-label={`${prepared ? "Already prepared" : "Download"} ${model}`}
                        className="rounded-full bg-white/15 px-2.5 py-1.5 text-[12px] font-bold text-white transition active:scale-95 disabled:opacity-50"
                      >
                        {busy ? "Preparing…" : prepared ? `${model.replace("Gemma 4 ", "")} ready` : `Get ${model.replace("Gemma 4 ", "")}`}
                      </button>
                    );
                  })}
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = journalDraft.trim();
                  if (text) addJournal.mutate(text);
                }}
                className="flex gap-2"
              >
                <input
                  value={journalDraft}
                  onChange={(e) => setJournalDraft(e.target.value)}
                  maxLength={500}
                  placeholder="Add a line to your town journal…"
                  aria-label="New journal entry"
                  className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:bg-white/15"
                />
                <button
                  type="submit"
                  className="rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] active:scale-95"
                  disabled={addJournal.isPending || !journalDraft.trim()}
                >
                  Write
                </button>
              </form>
              {state.data && state.data.journal.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {state.data.journal.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-2 rounded-xl bg-white/8 px-3 py-2 text-[15px] leading-[1.6]"
                    >
                      <span>
                        {entry.text}
                        <span className="mt-0.5 block text-[11px] text-white/45">
                          {new Date(entry.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Delete journal entry"
                        className="rounded-full bg-white/10 px-2 py-0.5 text-xs active:scale-95"
                        onClick={() => deleteJournal.mutate(entry.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mt-4 text-sm font-bold text-white">📮 Postcards from town</h3>
              {(state.data?.postcards ?? []).length === 0 ? (
                <p className="mt-1 text-[13px] leading-relaxed text-white/65">
                  No postcards yet. Tap the 📸 Postcard button up top whenever the town looks postcard-worthy,
                  the framed photo lands here.
                </p>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(state.data?.postcards ?? []).map((pc) => (
                    <button
                      key={pc.id}
                      type="button"
                      className="overflow-hidden rounded-lg bg-[#fdfaf2] p-1 shadow transition active:scale-95"
                      onClick={() => setPostcardView(pc)}
                      aria-label={`View postcard: ${pc.caption}`}
                    >
                      <img src={pc.image_url} alt="" className="aspect-[4/3] w-full rounded-sm object-cover" />
                      <span className="mt-1 block truncate px-0.5 text-left text-[10px] font-semibold text-[#3a3128]">
                        {pc.date_label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <h3 className="mt-4 text-sm font-bold text-white">🐟 The Catch Log</h3>
              {(state.data?.fish ?? []).length === 0 ? (
                <p className="mt-1 text-[13px] leading-relaxed text-white/65">
                  Nothing caught yet. The lake dock offers a line as well as a boat, carp, tench, perch, eel,
                  and one golden legend.
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {FISH.map((f) => {
                    const mine = (state.data?.fish ?? []).filter((c) => c.fish_id === f.id);
                    if (mine.length === 0) return null;
                    const unsold = mine.filter((c) => !c.sold).length;
                    return (
                      <li key={f.id} className="text-[13px] text-white/85">
                        🐟 <strong>{f.name}</strong> <em className="text-white/50">{f.latin}</em>, caught{" "}
                        {mine.length}×{unsold > 0 ? ` · ${unsold} unsold` : " · all sold"}
                      </li>
                    );
                  })}
                </ul>
              )}
              <h3 className="mt-4 text-sm font-bold text-white">📮 Postcard Challenges</h3>
              <ul className="mt-1.5 space-y-1">
                {POSTCARD_CHALLENGES.map((c) => {
                  const done = (state.data?.challenges_done ?? []).includes(c.id);
                  return (
                    <li key={c.id} className={`text-[13px] ${done ? "text-[#7be0cf]" : "text-white/70"}`}>
                      {done ? "✓" : "○"} {c.label}
                      {done ? " framed and kept" : ""}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-[12px] leading-relaxed text-white/50 italic">
                Take a postcard (📸 in the menu) standing at the view itself; the challenge ticks itself.
              </p>
              <h3 className="mt-4 text-sm font-bold text-white">🪨 The Inscriptions</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/75">
                {(state.data?.inscriptions_found ?? []).length} of {INSCRIPTIONS.length} fragments read, on the
                statue of Mars, the great column, the arch, the temple wall, and the aqueduct stones. Walk up
                and read them where they stand.
              </p>
              {state.data?.inscriptions_complete && (
                <p className="mt-1.5 rounded-2xl bg-white/8 px-3 py-2.5 text-[15px] leading-[1.65] text-white/90 italic">
                  {INSCRIPTION_HISTORY}
                </p>
              )}
            </div>
          )}

          {selected.id === "stars" && (
            <button type="button" className={`${chipClass} mt-3`} onClick={toggleNight}>
              {night ? "☀ Day" : "🌙 Stargaze (night)"}
            </button>
          )}
        </section>
      )}

      {/* Postcard preview: caption it, then keep it */}
      {postcardDraft && (
        <section
          aria-label="Your postcard"
          className={
            isLandscape
              ? "mt-scrollable absolute top-[62px] right-3 z-20 w-[min(400px,50vw)] overflow-y-auto rounded-3xl bg-[#2b2620]/97 p-4 shadow-2xl"
              : "mt-scrollable absolute inset-x-3 bottom-24 z-20 max-h-[62vh] overflow-y-auto rounded-3xl bg-[#2b2620]/97 p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:w-100"
          }
        >
          <h2 className="text-base font-bold">📮 A postcard from right now</h2>
          <div className="mt-2 rounded-lg bg-[#fdfaf2] p-2.5 shadow">
            <img src={postcardDraft.photo} alt="The view you just captured in Muse Town" className="w-full rounded-sm" />
            <p className="mt-2 truncate px-1 text-[13px] font-semibold text-[#3a3128]">{postcardDraft.caption}</p>
          </div>
          <label className="mt-3 block text-[12px] font-bold tracking-wide text-white/60 uppercase" htmlFor="postcard-caption">
            Caption
          </label>
          <input
            id="postcard-caption"
            type="text"
            value={postcardDraft.caption}
            maxLength={120}
            onChange={(e) => setPostcardDraft((d) => (d ? { ...d, caption: e.target.value } : d))}
            className="mt-1 w-full rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white outline-none placeholder:text-white/45 focus:bg-white/15"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow-md transition active:scale-95 disabled:opacity-50"
              disabled={addPostcard.isPending || !postcardDraft.caption.trim()}
              onClick={savePostcard}
            >
              {addPostcard.isPending ? "Saving…" : "Keep this postcard"}
            </button>
            <button
              type="button"
              className={chipClass}
              onClick={() => setPostcardDraft(null)}
            >
              Discard
            </button>
          </div>
          <p className="mt-2 text-[12px] text-white/55">
            Kept postcards live in the album at the Villa of Stories, stamped with today&apos;s date and weather.
          </p>
        </section>
      )}

      {/* A saved postcard, large */}
      {postcardView && (
        <section
          aria-label="Postcard"
          className={
            isLandscape
              ? "mt-scrollable absolute top-[62px] right-3 z-20 w-[min(430px,52vw)] overflow-y-auto rounded-3xl bg-[#2b2620]/97 p-4 shadow-2xl"
              : "mt-scrollable absolute inset-x-3 bottom-24 z-20 max-h-[66vh] overflow-y-auto rounded-3xl bg-[#2b2620]/97 p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:w-104"
          }
        >
          <div className="rounded-lg bg-[#fdfaf2] p-2.5 shadow">
            <img src={postcardView.image_url} alt={postcardView.caption} className="w-full rounded-sm" />
          </div>
          <p className="mt-2.5 text-sm font-bold text-white">{postcardView.caption}</p>
          <p className="text-[13px] text-white/60">
            {postcardView.date_label}
            {postcardView.weather ? ` · ${postcardView.weather}` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={chipClass} onClick={() => setPostcardView(null)}>
              Back to the album
            </button>
            <button
              type="button"
              className="rounded-full bg-[#a03d2d] px-3.5 py-1.5 text-sm font-bold text-white shadow-md transition active:scale-95 disabled:opacity-50"
              disabled={deletePostcard.isPending}
              onClick={() => deletePostcard.mutate(postcardView.id)}
            >
              Delete postcard
            </button>
          </div>
        </section>
      )}

      {/* Tour caption */}
      {tourStop && (
        <div className="absolute inset-x-0 bottom-[104px] z-10 flex justify-center px-4">
          <div className="rounded-2xl bg-[#22332b]/85 px-4 py-2 text-center text-sm font-semibold shadow-lg backdrop-blur">
            {tourStop.label}
          </div>
        </div>
      )}

      {/* No on-screen camera toggle button (owner ask, Nov 1), and
          since Nov 2 the overview is not on B either: it lives in
          the town menu (View & weather), both ways. The cluster
          below stays mounted while the overview is up so A, X and
          Y keep their handlers and B still dismisses panels there;
          the Back to Gaius chip under the cluster is the tappable
          way back. A visit quit in the overview may still restore
          the overview, safely, because the chip and the menu are
          both live there. */}

      {/* Walk prompt + Xbox controller (joystick + ABXY). The
          fragment renders in walk mode AND in the overview
          (overviewControlsLive): the interaction prompt still only
          appears while walking (the scene reports no nearby target
          in the overview), the joystick is walk-only below, and the
          ABXY cluster itself stays mounted in both modes, so its
          handlers, B above all, never unmount with walk mode. */}
      {(walking || overviewControlsLive) && (
        <>
          
          {/* The interaction prompt: walking near an interactable shows
              ONLY this chip, never the panel itself. Tapping the chip
              (or pressing X / E / Enter) opens the nearest one's panel.
              One prompt at a time: the scene reports only the nearest.
              EXCEPTION. A stone target wears a Y badge and answers
              to Y (xboxStone). */}
          {nearby && !anyPanelOpen && (
            <div
              className={
                isLandscape
                  ? "absolute inset-x-0 bottom-[76px] z-10 flex justify-center px-4"
                  : "absolute inset-x-0 bottom-[132px] z-10 flex justify-center px-4"
              }
            >
              <button
                type="button"
                className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-[#22332b]/92 py-2 pr-4 pl-2 text-sm font-bold text-white shadow-xl backdrop-blur transition active:scale-95"
                onClick={nearby.kind === "stone" ? xboxStone : xboxInteract}
                aria-label={
                  nearby.kind === "stone"
                    ? `Y, ${nearbyPrompt(nearby) ?? "stone"}`
                    : `Interact, ${nearbyPrompt(nearby) ?? "interact"}`
                }
              >
                {nearby.kind === "stone" ? (
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#ffb900] bg-[#1b1b1b] text-[13px] font-black text-[#ffb900]"
                  >
                    Y
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#2d7dd2] bg-[#1b1b1b] text-[13px] font-black text-[#5aa2e8]"
                  >
                    X
                  </span>
                )}
                {nearbyPrompt(nearby)}
              </button>
            </div>
          )}
          {/* Virtual Xbox controller: analog left joystick (walk mode
              only, movement has no overview meaning) + ABXY (right
              thumb, mounted in walk mode AND the overview alike).
              Hidden while any FULL panel is open, so the panel
              is fully visible and tappable, but NOT while Aelia's
              talk bubble is open: walk-and-talk keeps them live (see
              anyFullPanelOpen). In the overview the other buttons
              keep their ordinary handlers and are harmless there:
              Y still toggles day and night, X and A fall back to
              their hint lines (the scene's stone and interact
              actions are walk-gated in the scene itself). B keeps
              only its dismiss, step-out and slide duties there; it
              no longer leaves the overview, the town menu and the
              Back to Gaius chip own the way back. */}
          {!anyFullPanelOpen && !padDriving && (
          <>
          {walking && (
          <div
            className={
              isLandscape
                ? "absolute bottom-3 left-3 z-20 origin-bottom-left scale-90"
                : "absolute bottom-5 left-3 z-20 sm:left-4"
            }
          >
            <div
              role="application"
              data-mt-stick="1"
              aria-label="Left joystick, drag to walk; drag the open view to move the camera, double tap it to bring the camera home"
              className="mt-game-surface pointer-events-auto relative h-[118px] w-[118px] touch-none rounded-full border border-white/15 bg-[#202020]/45 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55),0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur select-none"
              onPointerDown={(e) => {
                e.preventDefault();
                stickPointer.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                stickMove(e);
              }}
              onPointerMove={(e) => {
                if (stickPointer.current === e.pointerId) stickMove(e);
              }}
              onPointerUp={(e) => {
                if (stickPointer.current === e.pointerId) stickEnd();
              }}
              onPointerCancel={stickEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span
                ref={stickKnobRef}
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-[#3a3a3a]/55 shadow-[inset_0_2px_4px_rgba(255,255,255,0.22),0_3px_8px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>
          )}

          <div
            className={
              isLandscape
                ? "absolute right-3 bottom-3 z-20 grid origin-bottom-right scale-90 grid-cols-3 gap-1"
                : "absolute right-3 bottom-5 z-20 grid grid-cols-3 gap-1 sm:right-4"
            }
            role="group"
            data-mt-controls="1"
            aria-label="Xbox controller action buttons"
          >
            <span />
            <button
              type="button"
              aria-label={
                nearby?.kind === "muse"
                  ? following
                    ? "Y button: ask Aelia to stay here (also T on the keyboard)"
                    : "Y button: walk together with Aelia (also T on the keyboard)"
                  : "Y button: pick up a loose stone at your feet, or throw the stone you are holding; with no stone in play, ask Aelia for a hint"
              }
              className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#ffb900]/80 bg-[#1b1b1b]/55 text-lg font-black text-[#ffb900] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.35)] backdrop-blur [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.8),1px_0_0_rgba(0,0,0,0.6),-1px_0_0_rgba(0,0,0,0.6)] transition active:scale-90 active:bg-[#ffb900] active:text-black"
              onClick={xboxStone}
            >
              Y
              {nearby?.kind === "muse" && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 text-[11px] leading-none" data-mt-y-follow="1">
                  🚶
                </span>
              )}
            </button>
            <span />
            <button
              type="button"
              aria-label="X button, talk and interact with what the X prompt shows: chat with Aelia, water the tree, or visit the place you are standing by"
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#2d7dd2]/90 bg-[#1b1b1b]/55 text-lg font-black text-[#5aa2e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.35)] backdrop-blur [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.8),1px_0_0_rgba(0,0,0,0.6),-1px_0_0_rgba(0,0,0,0.6)] transition active:scale-90 active:bg-[#2d7dd2] active:text-white"
              onClick={xboxInteract}
            >
              X
            </button>
            <span aria-hidden="true" />
            <button
              type="button"
              aria-label={
                walking
                  ? "B button, slide while moving; otherwise close a panel or step back from what you are doing"
                  : "B button, close a panel or dismiss what is open"
              }
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#e74856]/90 bg-[#1b1b1b]/55 text-lg font-black text-[#ff7a85] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.35)] backdrop-blur [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.8),1px_0_0_rgba(0,0,0,0.6),-1px_0_0_rgba(0,0,0,0.6)] transition active:scale-90 active:bg-[#e74856] active:text-white"
              onPointerDown={(e) => {
                // B acts on the press, like A: on release (the old
                // click) the same gesture had already centred the
                // stick, so the slide branch saw a standing man and
                // every touch slide was refused.
                e.preventDefault();
                xboxBack();
              }}
              onClick={(e) => {
                // Keyboard activation has no pointer press before it.
                if (e.detail === 0) xboxBack();
              }}
            >
              B
            </button>
            <span />
            <button
              type="button"
              aria-label="A button, jump"
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#52b043]/90 bg-[#1b1b1b]/55 text-lg font-black text-[#7ed37a] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.35)] backdrop-blur [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.8),1px_0_0_rgba(0,0,0,0.6),-1px_0_0_rgba(0,0,0,0.6)] transition active:scale-90 active:bg-[#107c10] active:text-white"
              onPointerDown={(e) => {
                e.preventDefault();
                sceneRef.current?.jump();
              }}
              onClick={(e) => {
                // Keyboard activation has no pointer press before it.
                if (e.detail === 0) sceneRef.current?.jump();
              }}
            >
              A
            </button>
            <span />
          </div>
          {/* Virtual LB and RB: the controller's shoulders, each above
              its own side, LB over the left stick and RB over the ABXY
              cluster, walk mode only (the shoulders have no overview
              meaning). They press exactly what a pad's LB and RB press
              (shoulderPress): the pair preview under ?preview=pairs,
              Aelia's hint otherwise, and they look dimmed while they
              have no duty. */}
          {walking &&
            (["LB", "RB"] as const).map((side) => (
              <div
                key={side}
                className={
                  side === "LB"
                    ? isLandscape
                      ? "absolute left-3 bottom-[168px] z-20"
                      : "absolute left-3 bottom-[200px] z-20 sm:left-4"
                    : isLandscape
                      ? "absolute right-3 bottom-[168px] z-20"
                      : "absolute right-3 bottom-[200px] z-20 sm:right-4"
                }
                data-mt-shoulders={side}
              >
                <button
                  type="button"
                  aria-label={
                    `${side} button, ${side === "LB" ? "flirt with Aelia" : "hug Aelia"} (also ${side === "LB" ? "F" : "H"} on the keyboard)`
                  }
                  className={`pointer-events-auto flex h-9 w-[66px] flex-col items-center justify-center rounded-t-2xl rounded-b-lg border-2 border-white/45 bg-[#1b1b1b]/55 text-[13px] leading-none font-black text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.35)] backdrop-blur [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.8)] transition active:scale-90 active:bg-white/80 active:text-black`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    shoulderPress(side);
                  }}
                  onClick={(e) => {
                    // Keyboard activation has no pointer press before it.
                    if (e.detail === 0) shoulderPress(side);
                  }}
                >
                  {side}
                </button>
              </div>
            ))}
          {/* The triggers (the owner, Nov 8, 2026): LT and RT just inside
              LB and RB at the same height, clear of her bubble's band. LT
              wears or stows the gladius, RT brings out or stows the shield;
              gold while the piece is on him. A physical pad's LT and RT
              press the same. */}
          {walking &&
            (["LT", "RT"] as const).map((side) => {
              const on = side === "LT" ? swordWorn : shieldOut;
              return (
                <div
                  key={side}
                  className={
                    side === "LT"
                      ? isLandscape
                        ? "absolute left-[84px] bottom-[168px] z-20"
                        : "absolute left-[84px] bottom-[200px] z-20 sm:left-[88px]"
                      : isLandscape
                        ? "absolute right-[84px] bottom-[168px] z-20"
                        : "absolute right-[84px] bottom-[200px] z-20 sm:right-[88px]"
                  }
                  data-mt-triggers={side}
                >
                  <button
                    type="button"
                    aria-label={
                      side === "LT"
                        ? `LT button, ${on ? "stow the gladius" : "wear the gladius"} (also R on the keyboard)`
                        : `RT button, ${on ? "stow the shield" : "bring out the shield"} (also G on the keyboard)`
                    }
                    aria-pressed={on}
                    className={`pointer-events-auto flex h-9 w-[54px] items-center justify-center gap-0.5 rounded-t-2xl rounded-b-lg border-2 ${on ? "border-[#ffd34e]/80 bg-[#3a2f12]/70" : "border-white/45 bg-[#1b1b1b]/55"} text-[13px] leading-none font-black text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.35)] backdrop-blur [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.8)] transition active:scale-90 active:bg-white/80 active:text-black`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerPress(side);
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) triggerPress(side);
                    }}
                  >
                    {side}
                    <span aria-hidden="true" className={`text-[11px] ${on ? "" : "opacity-50"}`}>{side === "LT" ? "🗡️" : "🛡️"}</span>
                  </button>
                </div>
              );
            })}
          {/* The way back from the overview: one small tappable
              chip under the cluster, in the same quiet pill style
              as the other button hints. It used to be a caption
              naming B's way back; since the overview left B
              (Nov 2) the chip itself does the work, so the
              overview is never a dead end. */}
          {!walking && (
            <div
              className={
                isLandscape
                  ? "pointer-events-none absolute right-3 bottom-[52px] z-20 flex w-[152px] justify-center"
                  : "pointer-events-none absolute right-3 bottom-[76px] z-20 flex w-[152px] justify-center sm:right-4"
              }
            >
              <button
                type="button"
                onClick={backToGaius}
                aria-label="Back to Gaius, return to the third-person view behind him"
                className="pointer-events-auto rounded-full bg-[#1b1b1b]/55 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-white/85 shadow backdrop-blur transition active:scale-95 active:bg-[#ffd34e] active:text-black"
              >
                Back to Gaius
              </button>
            </div>
          )}
          </>
          )}
        </>
      )}

      {/* A special-occasion offer from Muse: walk together? */}
      {followOffer && (!following || followOffer.guide) && (
        <section
          aria-label="Aelia offers to walk with you"
          className={
            followOffer.guide
              ? "absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+92px)] z-30 flex justify-center px-4"
              : isLandscape
                ? "absolute inset-x-0 bottom-[64px] z-30 flex justify-center px-4"
                : "absolute inset-x-0 bottom-[118px] z-30 flex justify-center px-4"
          }
        >
          <div className="pointer-events-auto w-full max-w-md rounded-3xl bg-[#232c4a]/97 p-3.5 shadow-2xl backdrop-blur">
            <p className="text-sm leading-relaxed font-semibold text-white">
              <span aria-hidden="true" className="text-[#ffd34e]">✦ Aelia: </span>
              {followOffer.text}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow-md transition active:scale-95"
                onClick={() => {
                  if (followOffer.guide) {
                    acceptGuide();
                    return;
                  }
                  if (!walkingRef.current) toggleWalk();
                  startFollowing();
                }}
                aria-label={followOffer.guide ? "Accept. Aelia leads the way" : "Accept. Aelia walks with you"}
              >
                🚶 {followOffer.guide ? "Show me" : "Walk together"}
              </button>
              <button
                type="button"
                className={chipClass}
                onClick={declineFollowOffer}
                aria-label="Decline. Aelia stays at her plaza spot"
              >
                Not now
              </button>
            </div>
          </div>
        </section>
      )}

      {/* The bottom pill rows are gone (user declutter): Walk,
          Overview, Night, Guided tour, Hint, Zoom and Reset hunt
          all live in the ☰ town menu now. What remains at the
          bottom is gameplay only, joystick, ABXY, the X prompt,
          the follow chip, plus this transient hint toast, which
          used to ride inside the old bar. */}
      {/* Task 48: her walking-together status, tappable, for when she is
          out of sight; centred above the prompt, clear of the stick, the
          buttons and her bubble's band. */}
      {rowingBoat && (driftOffered || drifting) && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[176px] z-10 flex justify-center px-4"
          data-mt-quiet-boat="1"
        >
          <button
            type="button"
            className="pointer-events-auto rounded-full bg-[#22332b]/85 px-4 py-2 text-sm font-bold text-white shadow-md backdrop-blur transition active:scale-95"
            aria-label={drifting ? "Take the oars and row back" : "Ship the oars and let the boat drift, together"}
            onClick={drifting ? rowBackHome : letBoatDrift}
          >
            {drifting ? ROW_BACK_PROMPT : DRIFT_PROMPT}
          </button>
        </div>
      )}
      {walking && sceneReady && !rowingBoat && !dreaming && (
        <div
          className={
            isLandscape
              ? "pointer-events-none absolute inset-x-0 bottom-[122px] z-10 flex justify-center px-4"
              : "pointer-events-none absolute inset-x-0 bottom-[176px] z-10 flex justify-center px-4"
          }
          data-mt-follow-chip="1"
        >
          <button
            type="button"
            className="pointer-events-auto rounded-full bg-[#22332b]/80 px-3 py-1 text-xs font-bold text-white/90 shadow-md backdrop-blur transition active:scale-95"
            aria-label={following ? "Walking with you. Tap to ask Aelia to stay here" : "Aelia is staying. Tap to walk together"}
            aria-pressed={following}
            onClick={() => toggleFollow()}
          >
            {following ? "🚶 Walking with you" : "✦ Aelia is staying"}
          </button>
        </div>
      )}
      {followToast && walking && sceneReady && !hintText && (
        <div className="absolute inset-x-0 bottom-[18px] z-20 flex justify-center px-4 pb-safe" data-mt-follow-toast="1">
          <div className="pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-2xl bg-[#22332b]/92 px-4 py-2 text-sm font-medium shadow-xl backdrop-blur">
            <p>Tap Aelia to walk together, tap again to let her stay</p>
            <button
              type="button"
              className="shrink-0 rounded-full bg-white/12 px-2 py-0.5 text-[13px] font-bold transition active:scale-95"
              aria-label="Dismiss this hint. It will not be shown again"
              onClick={dismissFollowToast}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* One-time rejoin hint: shown only after the first parking of
          Aelia, until dismissed, never again after. */}
      {rejoinHint && !following && (
        <div className="absolute inset-x-0 bottom-[64px] z-20 flex justify-center px-4 pb-safe">
          <div className="pointer-events-auto flex max-w-[92vw] items-start gap-2 rounded-2xl bg-[#22332b]/92 px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur">
            <p className="leading-relaxed">
              Aelia will keep her own day from here. To walk together again,{" "}
              <strong className="text-[#ffd34e]">tap Aelia</strong> (or press Y near her).
            </p>
            <button
              type="button"
              className="shrink-0 rounded-full bg-white/12 px-2 py-0.5 text-[13px] font-bold transition active:scale-95"
              aria-label="Dismiss the rejoin hint. It will not be shown again"
              onClick={() => {
                rejoinHintDismissedRef.current = true;
                try {
                  localStorage.setItem("muse-town-rejoin-hint-dismissed", "1");
                } catch {
                  /* the session still honours the dismissal */
                }
                setRejoinHint(false);
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {focusSitting && !museBubble && (
        <div className="absolute inset-x-0 bottom-[18px] z-10 flex justify-center px-4 pb-safe">
          <div className="flex items-center gap-2 rounded-2xl bg-[#22332b]/85 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur">
            <span>📖 Sitting with Aelia, about {focusLeft} min of quiet left</span>
            <button
              type="button"
              aria-label="End the focus sitting early"
              className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold transition active:scale-95"
              onClick={() => {
                setFocusSitting(null);
                sceneRef.current?.setQuietMode(false);
                setMuseBubble({
                  lines: paginateLines([pickPooled("focus-early", FOCUS_EARLY_LINES)]),
                  index: 0,
                  cycle: false,
                  invite: false,
                  choice: null,
                });
              }}
            >
              End
            </button>
          </div>
        </div>
      )}
      {walking && !anyFullPanelOpen && !museBubble && (firstTask || rhythm) && (
        <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top,0px)+60px)] right-3 left-3 z-10 flex justify-center">
          <p aria-live="off" className="max-w-full truncate rounded-full bg-[#22332b]/60 px-3 py-1 text-[12px] font-semibold text-white/90 backdrop-blur">
            {firstTask ? FIRST_TASK : `${rhythm!.title} · ${rhythm!.where}`}
          </p>
        </div>
      )}
      {hintText && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[18px] z-10 flex justify-center px-4 pb-safe">
          <div className="max-w-[92vw] rounded-2xl bg-[#22332b]/85 px-4 py-2 text-center text-sm font-medium shadow-lg backdrop-blur">
            {hintText}
          </div>
        </div>
      )}
    </div>
  );
}
