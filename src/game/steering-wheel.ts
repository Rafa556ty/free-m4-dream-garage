// Cuts the steering wheel out of a batched playable car so it can turn on its
// column. The wheel is found geometrically (a disc in front of the driver's
// eye, see cockpit.ts) because most files merge it into the cabin mesh.
import * as THREE from "three";
import { COLUMN_AXIS, inSteeringDisc, wheelCentre, type CockpitSpec } from "./cockpit";

export const STEERING_GROUP = "steering-wheel";

export function splitSteeringWheel(car: THREE.Group, spec: CockpitSpec): THREE.Group | null {
  car.updateMatrixWorld(true);
  const toCar = new THREE.Matrix4().copy(car.matrixWorld).invert();
  const centre = new THREE.Vector3(...wheelCentre(spec.hub));
  const pivot = new THREE.Group();
  pivot.name = STEERING_GROUP;
  pivot.position.copy(centre);
  pivot.userData["axis"] = new THREE.Vector3(...COLUMN_AXIS);
  const meshes: THREE.Mesh[] = [];
  car.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData["wheel"] && !Array.isArray(m.material)) meshes.push(m);
  });
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const pos = src.getAttribute("position");
    if (!pos) continue;
    const local = new THREE.Matrix4().multiplyMatrices(toCar, m.matrixWorld);
    const tris = pos.count / 3;
    const take: number[] = [];
    const keep: number[] = [];
    for (let t = 0; t < tris; t++) {
      let inside = true;
      for (let k = 0; k < 3 && inside; k++) {
        v.fromBufferAttribute(pos, t * 3 + k).applyMatrix4(local);
        inside = inSteeringDisc(v.x, v.y, v.z, spec.hub);
      }
      (inside ? take : keep).push(t);
    }
    if (!take.length) { if (src !== m.geometry) src.dispose(); continue; }
    const pick = (list: number[]) => {
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(src.attributes)) {
        const a = attr as THREE.BufferAttribute;
        const out = new Float32Array(list.length * 3 * a.itemSize);
        let o = 0;
        for (const t of list) for (let k = 0; k < 3; k++) for (let c = 0; c < a.itemSize; c++) out[o++] = a.getComponent(t * 3 + k, c);
        g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize, a.normalized));
      }
      return g;
    };
    const wheelGeo = pick(take);
    // Bake the part into car space, then centre it on the pivot.
    wheelGeo.applyMatrix4(local);
    wheelGeo.translate(-centre.x, -centre.y, -centre.z);
    wheelGeo.computeBoundingSphere();
    const part = new THREE.Mesh(wheelGeo, m.material);
    part.name = `steer_${(m.material as THREE.Material).name}`;
    part.castShadow = false;
    pivot.add(part);
    const rest = pick(keep);
    rest.computeBoundingSphere();
    const old = m.geometry;
    m.geometry = rest;
    if (src !== old) src.dispose();
    old.dispose();
  }
  if (!pivot.children.length) return null;
  car.add(pivot);
  return pivot;
}

/** Turn the cut-out wheel about its column. */
export function turnSteeringWheel(pivot: THREE.Object3D, angle: number) {
  pivot.quaternion.setFromAxisAngle(pivot.userData["axis"] as THREE.Vector3, angle);
}
