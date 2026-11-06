import { BATHS, BED_SPOT, COLOSSEUM, FOREST, LAKE, LAKE_PAVILION, LETTER_DESK_SPOT, PISCINA, PLACES, QUEST_BOARD_SPOT, STREETS } from "./town";
import { GARDEN_BEDS, MARKET_BOOTHS, VILLA } from "./layout";

/** The town plan (Nov 6, 2026 review): the walks, the water, the
 *  houses and the landmarks drawn from the same tables the scene
 *  builds from, north (the hall) at the top, the gate at the foot,
 *  with the two of them on it. What is found by wandering (the secret
 *  terrace, the forest's discoveries) is not drawn. */
export function TownMap({ you, her }: { you: { x: number; z: number } | null; her: { x: number; z: number } | null }) {
  const ink = "#2b2118";
  const widths = new Map<number, number>([[0, 4], [1, 3.6], [6, 1.4], [10, 1.4]]);
  const short = (name: string) => name.split(",")[0]!;
  const spots: [readonly [number, number], string][] = [
    [QUEST_BOARD_SPOT.position, "quests"],
    [LETTER_DESK_SPOT.position, "letters"],
    [BED_SPOT.position, "bed"],
  ];
  return (
    <svg viewBox="-56 -56 112 112" role="img" aria-label="The town plan" className="block h-auto w-full rounded-2xl" style={{ fontFamily: "inherit" }}>
      <rect x="-56" y="-56" width="112" height="112" fill="#e8e1cc" />
      <ellipse cx={FOREST.cx} cy={FOREST.cz} rx={FOREST.rx} ry={FOREST.rz} fill="#9fb98a" />
      <text x={FOREST.cx} y={FOREST.cz + 1} fontSize="3.2" fill="#3f5a36" textAnchor="middle">the forest</text>
      <ellipse cx={LAKE.position[0]} cy={LAKE.position[1]} rx={LAKE.rx} ry={LAKE.rz} fill="#9cc3e0" />
      <rect x={PISCINA.position[0] - 3.2} y={PISCINA.position[1] - 1.6} width="6.4" height="3.2" fill="#9cc3e0" />
      <circle cx={COLOSSEUM.position[0]} cy={COLOSSEUM.position[1]} r="5.5" fill="#d9d0bf" stroke="#a89a82" strokeWidth="0.5" />
      {STREETS.map((s, i) => (
        <polyline key={i} points={s.map(([x, z]) => `${x},${z}`).join(" ")} fill="none" stroke="#cdbf9c" strokeWidth={widths.get(i) ?? 2.4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <rect x={-VILLA.terrace.halfX} y={VILLA.terrace.north} width={VILLA.terrace.halfX * 2} height={VILLA.terrace.south - VILLA.terrace.north} fill="none" stroke="#8a7d6a" strokeWidth="0.6" />
      <rect x={-VILLA.peristyle.halfX} y={-VILLA.peristyle.halfZ} width={VILLA.peristyle.halfX * 2} height={VILLA.peristyle.halfZ * 2} fill="none" stroke="#8a7d6a" strokeWidth="0.6" />
      <circle cx="0" cy="0" r="1.6" fill="#4f8a46" />
      <circle cx={VILLA.metaSudans[0]} cy={VILLA.metaSudans[1]} r="1.3" fill="#b8bcc4" />
      {MARKET_BOOTHS.map(([x, z]) => <rect key={`b${x}${z}`} x={x - 1.1} y={z - 0.6} width="2.2" height="1.2" fill="#c47a4a" />)}
      {GARDEN_BEDS.map(([x, z]) => <rect key={`g${x}`} x={x - 1} y={z - 0.8} width="2" height="1.6" fill="#8b6a48" />)}
      {PLACES.map((p) => (
        <g key={p.id}>
          <rect x={p.position[0] - 3} y={p.position[1] - 2.2} width="6" height="4.4" fill="#cfa883" stroke="#7a4f2e" strokeWidth="0.4" />
          <text x={p.position[0]} y={p.id === "mainchat" ? p.position[1] - 3.2 : p.position[1] + 4.6} fontSize="2.6" fill={ink} textAnchor="middle" fontWeight="700">{short(p.name)}</text>
        </g>
      ))}
      <circle cx={BATHS.position[0]} cy={BATHS.position[1]} r="2.2" fill="#bcc9d8" stroke="#7a8da3" strokeWidth="0.4" />
      <text x={BATHS.position[0]} y={BATHS.position[1] + 4.4} fontSize="2.6" fill={ink} textAnchor="middle">Baths</text>
      <text x={COLOSSEUM.position[0]} y={COLOSSEUM.position[1] + 8} fontSize="2.6" fill={ink} textAnchor="middle">Colosseum</text>
      <rect x="29.5" y="-28.5" width="3" height="3" fill="#d9d0bf" stroke="#a89a82" strokeWidth="0.4" />
      <text x="31" y="-30" fontSize="2.6" fill={ink} textAnchor="middle">Temple</text>
      <circle cx={LAKE_PAVILION.position[0]} cy={LAKE_PAVILION.position[1]} r="1.4" fill="#e6dcc3" stroke="#a89a82" strokeWidth="0.4" />
      <text x={LAKE.position[0]} y={LAKE.position[1] + 1} fontSize="2.6" fill="#2f5a7a" textAnchor="middle">the lake</text>
      <text x={VILLA.gate[0]} y={VILLA.gate[1] + 4.2} fontSize="2.6" fill={ink} textAnchor="middle">the gate</text>
      {spots.map(([pos, label]) => (
        <g key={label}>
          <circle cx={pos[0]} cy={pos[1]} r="0.8" fill="#fff8e6" stroke={ink} strokeWidth="0.3" />
          <text x={pos[0] + (label === "quests" ? -1.4 : 1.4)} y={pos[1] + 0.8} fontSize="2.2" fill={ink} textAnchor={label === "quests" ? "end" : "start"}>{label}</text>
        </g>
      ))}
      {her && <text x={her.x} y={her.z + 1.1} fontSize="3.6" fill="#a87800" textAnchor="middle" aria-label="Aelia">✦</text>}
      {you && (
        <g aria-label="You">
          <circle cx={you.x} cy={you.z} r="1.4" fill="#ffd34e" stroke={ink} strokeWidth="0.4" />
          <text x={you.x} y={you.z - 2.2} fontSize="2.4" fill={ink} textAnchor="middle" fontWeight="700">you</text>
        </g>
      )}
    </svg>
  );
}
