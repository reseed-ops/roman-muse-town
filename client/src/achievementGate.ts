/** Which achievements are already earned. The town starts unlocking the
 * moment it opens, before the save has arrived, so a claim made that early
 * has to wait for the answer or every visit re-announces old badges. */
export class AchievementGate {
  private known: Set<string> | null = null;
  private waiting: string[] = [];

  /** Takes the saved list; returns the early claims, to be claimed again. */
  load(saved: readonly string[]): string[] {
    this.known = new Set(saved);
    const waiting = this.waiting;
    this.waiting = [];
    return waiting;
  }

  /** True the one time this badge should be announced and saved. */
  claim(id: string): boolean {
    if (!this.known) {
      this.waiting.push(id);
      return false;
    }
    if (this.known.has(id)) return false;
    this.known.add(id);
    return true;
  }
}
