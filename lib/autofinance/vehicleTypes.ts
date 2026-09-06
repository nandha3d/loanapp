/**
 * Canonical vehicle types (X-9 — not a literal list inside a route handler).
 * Every auto-finance report groups on this column, so an unrecognised value
 * must be refused at the edge rather than stored raw (AUTO-036).
 *
 * Mirrors the web HP wizard and the mobile vehicle form.
 */
export const VEHICLE_TYPES = [
  'two_wheeler',
  'three_wheeler',
  'four_wheeler',
  'commercial',
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export function isVehicleType(v: string): v is VehicleType {
  return (VEHICLE_TYPES as readonly string[]).includes(v);
}
