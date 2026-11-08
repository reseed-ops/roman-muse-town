/** Naming a failed scene build (Task 42): the overlay and the window
 *  flag carry the real error, so a screenshot is enough to diagnose it. */

/** Both tries failed: the first at the device's own settings, the
 *  second at the safest ones. */
export class SceneBuildError extends Error {
  constructor(
    readonly first: unknown,
    readonly second: unknown,
  ) {
    super(`${describeOne(first)}; at the safest settings: ${describeOne(second)}`);
    this.name = "SceneBuildError";
  }
}

function describeOne(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name && err.name !== "Error" ? `${err.name}: ` : "";
    return `${name}${err.message || "no message"}`;
  }
  if (typeof err === "string" && err) return err;
  try {
    return String(err) || "an unknown error";
  } catch {
    return "an unknown error";
  }
}

/** One line for the overlay: the error's own name and message (both
 *  tries when the retry failed too), capped so it fits a phone. */
export function describeSceneError(err: unknown, max = 400): string {
  const text = err instanceof SceneBuildError ? err.message : describeOne(err);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
