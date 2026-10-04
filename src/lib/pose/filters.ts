/**
 * Time-based One Euro filter (Casiez, Roussel & Vogel, CHI 2012).
 *
 * An adaptive low-pass filter: at low speeds the cutoff stays near `minCutoff` (strong
 * smoothing, kills jitter), at high speeds it rises by `beta * |speed|` (low lag, so fast
 * movements still cross thresholds). The time step comes from the caller's timestamps, not
 * a frame count, so behaviour is the same at 15, 30 or a jittery variable frame rate.
 *
 * Units: `minCutoff` and `dCutoff` are in Hz; `beta` is in 1 / (value unit), e.g. per
 * degree when filtering angles in degrees.
 */

export interface OneEuroParams {
  /** Minimum cutoff frequency in Hz. Lower = smoother at rest, more lag. */
  minCutoff: number;
  /** Speed coefficient. Higher = less lag during fast movement. */
  beta: number;
  /** Cutoff in Hz for the derivative estimate. */
  dCutoff: number;
}

function smoothingFactor(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
}

export class OneEuroFilter {
  private readonly params: OneEuroParams;
  private x: number | null = null;
  private dx = 0;
  private lastT: number | null = null;

  constructor(params: OneEuroParams) {
    this.params = {
      minCutoff: params.minCutoff > 0 ? params.minCutoff : 1,
      beta: params.beta >= 0 ? params.beta : 0,
      dCutoff: params.dCutoff > 0 ? params.dCutoff : 1,
    };
  }

  /** Last filtered value, or null before the first finite sample (and after reset()). */
  get value(): number | null {
    return this.x;
  }

  /**
   * Feed one sample and return the filtered value.
   * - The first sample passes through unchanged.
   * - Non-finite values or timestamps are ignored (returns the last value, or NaN if none).
   * - A timestamp that does not move forward is ignored (returns the last value).
   */
  filter(value: number, timestampMs: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(timestampMs)) {
      return this.x ?? Number.NaN;
    }
    if (this.x === null || this.lastT === null) {
      this.x = value;
      this.dx = 0;
      this.lastT = timestampMs;
      return value;
    }
    const dtMs = timestampMs - this.lastT;
    if (!(dtMs > 0)) return this.x;
    const dt = dtMs / 1000;

    const rawDx = (value - this.x) / dt;
    this.dx += smoothingFactor(this.params.dCutoff, dt) * (rawDx - this.dx);

    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dx);
    this.x += smoothingFactor(cutoff, dt) * (value - this.x);
    this.lastT = timestampMs;
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
    this.lastT = null;
  }
}
