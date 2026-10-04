/** Audio-only tuning: keep physical relative airflow and map wind unchanged.
 * Movement-generated airflow is barely audible at walking speed and soft at a run.
 * Ambient wind remains fully audible; moving with it can still reduce felt wind. */
export function windAudioStrength(
  ambientSpeed: number,
  apparentSpeed: number,
  movementSpeed: number
): number {
  const t = Math.max(0, Math.min(1, (movementSpeed - 1.6) / 1.4));
  const movementGain = 0.03 + 0.17 * t * t * (3 - 2 * t);
  const ambientPart = Math.min(ambientSpeed, apparentSpeed);
  const movementPart = Math.max(0, apparentSpeed - ambientSpeed);
  return Math.min(1, (ambientPart + movementPart * movementGain) / 12);
}
