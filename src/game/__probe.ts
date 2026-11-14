import * as THREE from "three";
import { loadCar } from "./models3d";
export async function probe(key: string) {
  const car = await loadCar(key as never);
  car.updateMatrixWorld(true);
  const out: { n: string; m: string; box: number[]; tris: number; wheel?: boolean }[] = [];
  car.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const b = new THREE.Box3().setFromObject(m);
    const g = m.geometry;
    out.push({ n: m.name.slice(0, 40), m: (m.material as THREE.Material).name.slice(0, 50), box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(2)), tris: (g.index ? g.index.count : g.attributes.position!.count) / 3, wheel: !!m.userData.wheel });
  });
  const b = new THREE.Box3().setFromObject(car);
  return { box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(2)), out };
}
(window as unknown as { __probe: typeof probe }).__probe = probe;
