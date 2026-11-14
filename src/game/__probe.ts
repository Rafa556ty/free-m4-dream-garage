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
let R: THREE.WebGLRenderer | null = null;
export async function shot(key: string, eye: number[], look: number[], fov = 72) {
  const car = await loadCar(key as never);
  if (!R) { R = new THREE.WebGLRenderer({ antialias: true }); R.setSize(640, 400); document.body.appendChild(R.domElement); R.domElement.style.cssText = "position:fixed;left:0;top:0;z-index:99999"; }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc4e8);
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
  scene.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
  const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 8, 4); scene.add(d);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x333338 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  for (let i = 0; i < 20; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 3), new THREE.MeshBasicMaterial({ color: 0xffffff })); s.position.set(0, 0.01, -i * 8 - 5); scene.add(s); }
  scene.add(car.clone(true));
  const cam = new THREE.PerspectiveCamera(fov, 640 / 400, 0.02, 500);
  cam.position.set(eye[0]!, eye[1]!, eye[2]!); cam.lookAt(look[0]!, look[1]!, look[2]!);
  R.render(scene, cam);
}
(window as unknown as { __shot: typeof shot }).__shot = shot;
export async function pick(key: string, eye: number[], look: number[], px: number, py: number, fov = 72) {
  const car = await loadCar(key as never);
  car.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(fov, 640 / 400, 0.02, 500);
  cam.position.set(eye[0]!, eye[1]!, eye[2]!); cam.lookAt(look[0]!, look[1]!, look[2]!); cam.updateMatrixWorld();
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(px / 320 - 1, 1 - py / 200), cam);
  const h = rc.intersectObject(car, true).filter((x) => (x.object as THREE.Mesh).visible)[0];
  return h ? { p: h.point.toArray().map((v) => +v.toFixed(3)), m: ((h.object as THREE.Mesh).material as THREE.Material).name, d: +h.distance.toFixed(3) } : null;
}
(window as unknown as { __pick: typeof pick }).__pick = pick;
