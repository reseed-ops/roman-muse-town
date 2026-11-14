// Task 94: the director's own frame checks, without a browser. A deliberately bad frame must be flagged:
// a black frame, a subject out of frame, a frame where nothing moves. A good frame must pass.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

const py = (code: string) => spawnSync("python3", ["-I", "-c", `import importlib.util,sys\nsys.dont_write_bytecode=True\ns=importlib.util.spec_from_file_location("d",${JSON.stringify(new URL("./director.py", import.meta.url).pathname)});d=importlib.util.module_from_spec(s);s.loader.exec_module(d)\n${code}`], { encoding: "utf8" });

test("the director self-test passes", () => {
  const r = spawnSync("python3", ["-I", new URL("./director.py", import.meta.url).pathname, "--self-test"], { encoding: "utf8" });
  expect(r.stdout + r.stderr).toContain("director self-test ok");
  expect(r.status).toBe(0);
});

test("a black frame is flagged and a subject out of frame is flagged", () => {
  const r = py(`
black=d._png(64,36,lambda x,y:(0,0,0))
print(d.frame_verdict(d.grid_stats(d.luma_grid(black))))
cam,tgt,p=d.camera_pose((0,0),0.0,1.0,0.0,1280,720)
pr=lambda x,h,z:d.project((x,h,z),cam,tgt,p['fov'],p['aspect'])
print(d.subject_verdict('aelia',pr(30,1.75,2),pr(30,0,2)))
print(d.subject_verdict('aelia',pr(1.2,1.75,1.5),pr(1.2,0,1.5)))
`);
  const [black, out, ok] = r.stdout.trim().split("\n");
  expect(black).toBe("black frame");
  expect(out).toBe("aelia is out of frame");
  expect(ok).toBe("None");
});

test("a frame where nothing moves is flagged, and a note edits the saved scene", () => {
  const r = py(`
f=d.luma_grid(d._png(64,36,lambda x,y:((x*4)%256,(y*7)%256,90)))
print(d.motion_verdict(d.grid_motion([f,f,f])))
sc={"camera":{"zoom":1.0}}
d.apply_note(sc,"closer, zoom the camera")
print(sc["camera"]["zoom"], len(sc["notes"]))
`);
  const [still, note] = r.stdout.trim().split("\n");
  expect(still).toContain("nothing is happening");
  expect(note).toBe("0.7 1");
});

test("the saved scenes are valid scripts with the fields the director reads", () => {
  for (const f of ["wedding-arch", "terrace-dusk"]) {
    const s = JSON.parse(require("node:fs").readFileSync(new URL(`./scenes/${f}.json`, import.meta.url), "utf8"));
    expect(s.name).toBe(f);
    expect(typeof s.gaius.x).toBe("number");
    expect(typeof s.aelia.z).toBe("number");
    expect(s.require).toContain("aelia");
  }
});
