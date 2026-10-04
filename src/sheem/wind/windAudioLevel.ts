/** Audio-only tuning: keep physical relative airflow and map wind unchanged.
 * Movement-generated airflow is barely audible at walking speed and soft at a run.
 * Quiet ambient air can move vegetation without producing a constant ear-level roar. */
export function windAudioStrength(
  ambientSpeed: number,
  apparentSpeed: number,
  movementSpeed: number
): number {
  const t = Math.max(0, Math.min(1, (movementSpeed - 1.6) / 1.4));
  const movementGain = 0.03 + 0.17 * t * t * (3 - 2 * t);
  const ambientPart = Math.min(ambientSpeed, apparentSpeed);
  const movementPart = Math.max(0, apparentSpeed - ambientSpeed);
  const breeze = Math.max(0, Math.min(1, (ambientPart - 2.5) / 9.5));
  const ambientGain = 0.55 * breeze * breeze;
  return Math.min(1, ambientGain + (movementPart * movementGain) / 12);
}

/** No diffuse wind bed in gentle weather; reserve the low wash for stronger wind. */
export function windBedLevel(speed: number): number {
  const t = Math.max(0, Math.min(1, (speed - 5) / 7));
  return 0.12 * t * t;
}
