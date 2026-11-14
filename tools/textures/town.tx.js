// The town's ground, made with loom (Task 93). Build:
//   node .claude/skills/loom/bin/loom.js build tools/textures/town.tx.js --out /tmp/loom-out
//   then `bun tools/textures/install.ts /tmp/loom-out` copies the maps the town uses.
// Palette: warm travertine, never chalk. Albedo luma stays about 0.5 so the
// town's ACES + sun does not push it to white.
pal({
  trav: "#a6977a", travL: "#b8aa8c", travD: "#8c7d61", travR: "#97886d",
  grout: "#706451", dirt: "#615540", stain: "#7c6a4f", moss: "#6d7049",
  cob: "#a1906f", cobL: "#b2a381", cobD: "#807154", cobR: "#927f5d",
})

// ---- Forum paving: big travertine slabs in running bond, 2 m x 1 m at 4 m a tile
{
  const b = bricks({ rows: 4, cols: 2, gap: 0.012, bevel: 0.016, offset: 0.5, vary: 0.05, wobble: 0.15, seed: 11 }).as("slabs")
  const grain = noise({ scale: [10, 26], octaves: 4, seed: 3 }).as("grain")
  const pits = noise({ scale: 40, octaves: 3, seed: 8 }).levels(0.55, 0.85).as("pits")
  const wear = noise({ scale: 5, octaves: 3, seed: 21 }).as("wear")
  const height = b.mul(0.82).add(grain.mul(0.05)).sub(pits.mul(0.05)).as("height")
  const grime = height.cavity(0.006, 16).max(b.mask.invert().mul(0.7)).as("grime")
  const tone = b.id.mix(wear, 0.5)
  material("forum_paving", { size: 512, depth: 0.03 }, {
    height,
    color: ramp(tone, ["travD", "trav", "travL", "trav"]).mix(ramp(grain, ["travR", "travL"]), 0.25)
      .mix("stain", wear.threshold(0.6, 0.25).mul(0.35)).mix("grout", b.mask.invert().mul(0.85)).mix("dirt", grime.mul(0.45)),
    rough: grain.levels(0, 1, 0.62, 0.86).mix(0.95, b.mask.invert()).sub(b.id.mul(0.06)),
  })
}

// ---- Cobbles: rounded stones, about 27 cm across at 2.4 m a tile
{
  const c = cells({ scale: 9, jitter: 0.85, seed: 5 })
  const stone = c.edge.levels(0.0, 0.16).smooth(0, 1).as("stone")
  const grain = noise({ scale: 36, octaves: 3, seed: 4 })
  const patchy = noise({ scale: 4, octaves: 3, seed: 14 })
  const height = stone.mul(0.85).add(grain.mul(0.08)).as("height")
  const grime = height.cavity(0.008, 14).max(stone.invert().mul(0.8)).as("grime")
  const tone = c.id.mix(patchy, 0.35)
  material("cobbles", { size: 512, depth: 0.05 }, {
    height,
    color: ramp(tone, ["cobD", "cobR", "cob", "cobL", "cob"]).mix("grout", stone.invert().mul(0.9))
      .mix("dirt", grime.mul(0.5)).mix("moss", patchy.threshold(0.62, 0.2).mul(stone.invert()).mul(0.2)),
    rough: grain.levels(0, 1, 0.7, 0.92).mix(0.97, stone.invert()),
  })
}
