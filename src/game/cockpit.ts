// First-person cockpit view (pure, unit-tested). Only cars whose own GLB has a
// real modelled cabin and steering wheel get one; the rest keep the outside views.
// Car-local metres: x right, y up, nose toward -z (as loadCar returns it).
import type { PlayerCar } from "./player-cars";

export type Vec3 = readonly [number, number, number];

export interface CockpitSpec {
  /** Front face of the steering-wheel hub (airbag), measured in the model. */
  hub: Vec3;
  /** Driver eye; defaults to EYE_FROM_HUB behind/above the hub. */
  eye?: Vec3;
}

/** Driver's eye relative to the hub: ~20 cm above it and ~52 cm back. */
export const EYE_FROM_HUB: Vec3 = [0, 0.2, 0.52];

// Audited from inside every playable model. Left out on purpose:
// SVJ and Demon (no modelled cabin), Huracán EVO (cabin without a steering
// wheel) and Chiron Super Sport 300+ (file scale/cabin not usable).
export const COCKPITS: Partial<Record<PlayerCar, CockpitSpec>> = {
  revuelto: { hub: [-0.442, 0.746, -0.452] },
  laferrari: { hub: [-0.324, 0.679, -0.324] },
  chiron: { hub: [-0.39, 0.751, -0.514] },
  tourbillon: { hub: [-0.372, 0.709, -0.427] },
  "voiture-noire": { hub: [-0.34, 0.805, -0.215] },
  jesko: { hub: [-0.31, 0.7, -0.4] },
  "utopia-roadster": { hub: [-0.325, 0.75, -0.416] },
  huayra: { hub: [-0.337, 0.73, -0.45] },
  "m4-competition": { hub: [-0.378, 0.885, -0.325] },
};

export const hasCockpit = (car: PlayerCar): boolean => COCKPITS[car] !== undefined;

export function cockpitEye(spec: CockpitSpec): Vec3 {
  if (spec.eye) return spec.eye;
  return [spec.hub[0] + EYE_FROM_HUB[0], spec.hub[1] + EYE_FROM_HUB[1], spec.hub[2] + EYE_FROM_HUB[2]];
}

/** Steering column tilt: the wheel face leans back toward the driver. */
export const COLUMN_TILT = 0.38; // rad (~22°)
/** Column axis, pointing from the dashboard toward the driver. */
export const COLUMN_AXIS: Vec3 = [0, Math.sin(COLUMN_TILT), Math.cos(COLUMN_TILT)];
/** Rim radius and slab thickness used to cut the wheel out of the cabin mesh. */
export const WHEEL_RADIUS = 0.205;
const WHEEL_BEHIND_HUB = 0.04; // rim plane sits a little in front of the airbag face
const WHEEL_HALF_DEPTH = 0.07;

/** Centre of the steering wheel (rotation pivot). */
export function wheelCentre(hub: Vec3): Vec3 {
  const a = COLUMN_AXIS;
  return [hub[0] - a[0] * WHEEL_BEHIND_HUB, hub[1] - a[1] * WHEEL_BEHIND_HUB, hub[2] - a[2] * WHEEL_BEHIND_HUB];
}

/** Is a cabin vertex part of the steering wheel (inside the wheel's disc)? */
export function inSteeringDisc(x: number, y: number, z: number, hub: Vec3): boolean {
  const c = wheelCentre(hub);
  const a = COLUMN_AXIS;
  const dx = x - c[0], dy = y - c[1], dz = z - c[2];
  const d = dx * a[0] + dy * a[1] + dz * a[2];
  if (Math.abs(d) > WHEEL_HALF_DEPTH) return false;
  const rx = dx - a[0] * d, ry = dy - a[1] * d, rz = dz - a[2] * d;
  return rx * rx + ry * ry + rz * rz <= WHEEL_RADIUS * WHEEL_RADIUS;
}

/** Steering wheel rotation at full lock (rad); about 110°, like a quick supercar rack. */
export const STEERING_WHEEL_LOCK = 1.9;
/** Wheel angle about the column for steer input −1 (left) … 1 (right). Right = clockwise. */
export function steeringWheelAngle(steer: number): number {
  return -Math.max(-1, Math.min(1, steer)) * STEERING_WHEEL_LOCK;
}

// ---------- driver head motion ----------
// The head is a damped spring hung in the car: it is thrown back under
// acceleration, forward under braking, to the outside of a turn, and buzzes
// with the road at speed. The camera also glances into the turn.

export type Head = {
  x: number; vx: number; // lateral (m), + = right
  z: number; vz: number; // longitudinal (m), + = back
  lastSpeed: number;
};
export const initialHead = (): Head => ({ x: 0, vx: 0, z: 0, vz: 0, lastSpeed: 0 });

export const HEAD_STIFF = 55; // 1/s²
export const HEAD_DAMP = 10; // 1/s
export const HEAD_MAX_SURGE = 0.06; // m
export const HEAD_MAX_SWAY = 0.045; // m
const SURGE_PER_MS2 = 0.0065; // m of head travel per m/s² of acceleration
const SWAY_AT_SPEED = 0.04; // m at full steer above ~150 km/h

export function stepHead(h: Head, speedKmh: number, steer: number, braking: boolean, dt: number): Head {
  const t = Math.min(dt, 0.05);
  if (t <= 0) return h;
  const accel = (speedKmh - h.lastSpeed) / 3.6 / t; // m/s²
  const speedF = Math.min(1, speedKmh / 150);
  const surgeTarget = clamp(accel * SURGE_PER_MS2 - (braking ? 0.02 : 0), -HEAD_MAX_SURGE, HEAD_MAX_SURGE);
  // Turning right throws the head left (outside of the turn).
  const swayTarget = clamp(-steer * SWAY_AT_SPEED * speedF, -HEAD_MAX_SWAY, HEAD_MAX_SWAY);
  const vz = h.vz + (HEAD_STIFF * (surgeTarget - h.z) - HEAD_DAMP * h.vz) * t;
  const vx = h.vx + (HEAD_STIFF * (swayTarget - h.x) - HEAD_DAMP * h.vx) * t;
  return {
    z: clamp(h.z + vz * t, -HEAD_MAX_SURGE * 1.4, HEAD_MAX_SURGE * 1.4),
    vz,
    x: clamp(h.x + vx * t, -HEAD_MAX_SWAY * 1.4, HEAD_MAX_SWAY * 1.4),
    vx,
    lastSpeed: speedKmh,
  };
}

export type HeadPose = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number };

/** Camera offset/angles for the current head state; `time` drives the road buzz. */
export function headPose(h: Head, speedKmh: number, steer: number, time: number): HeadPose {
  const speedF = Math.min(1, speedKmh / 300);
  const buzz = speedKmh > 2 ? 0.0006 + speedF * 0.0024 : 0;
  const n = (f: number, p: number) => Math.sin(time * f + p);
  return {
    x: h.x + buzz * 0.5 * (n(41, 0.3) + 0.6 * n(67, 1.1)),
    y: buzz * (n(53, 0) + 0.7 * n(88, 2.1) + 0.4 * n(17, 0.7)),
    z: h.z,
    // Glance into the turn, more at speed.
    yaw: -steer * (0.04 + 0.05 * speedF),
    // Head nods forward on braking (z < 0), back on launch; base tilt frames the road.
    pitch: -0.05 + h.z * 0.6,
    // Lean with the lateral throw.
    roll: -h.x * 0.5,
  };
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
