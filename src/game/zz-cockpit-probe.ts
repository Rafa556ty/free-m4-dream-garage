// TEMP dev probe (deleted after tuning).
import * as THREE from "three";
import { loadCar } from "./models3d";
import { COCKPIT_SEATS } from "./cockpit";
export async function probe(key: string, eye?: [number, number, number], drop = 0.9, w = 640, h = 400) {
  const car = (await loadCar(key as never)).clone(true);
  car.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(car);
  const sw = car.getObjectByName("steering-wheel");
  const swPos = sw ? sw.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)) : null;
  const e = eye ?? (COCKPIT_SEATS as Record<string, { eye: [number, number, number] }>)[key]?.eye ?? [-0.36, 1, 0.1];
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  document.body.appendChild(canvas);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setSize(w, h, false);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fc4e8);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
  const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 8, -4); scene.add(d);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x555555 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 200), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  line.rotation.x = -Math.PI / 2; line.position.set(1.8, 0.01, 0); scene.add(line);
  scene.add(car);
  if (sw) sw.quaternion.setFromAxisAngle(sw.userData["axis"], -0.8);
  const cam = new THREE.PerspectiveCamera(70, w / h, 0.03, 500);
  cam.position.set(...e); cam.lookAt(e[0], e[1] - drop, e[2] - 30);
  r.render(scene, cam);
  const url = canvas.toDataURL("image/jpeg", 0.8);
  // side cutaway: camera to the left looking at the eye point
  const cam2 = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
  cam2.position.set(-9, e[1], e[2]); cam2.lookAt(0, e[1] - 0.3, e[2]);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.06), new THREE.MeshBasicMaterial({ color: 0xff00ff, depthTest: false }));
  marker.position.set(...e); marker.renderOrder = 999; scene.add(marker);
  r.render(scene, cam2);
  const side = canvas.toDataURL("image/jpeg", 0.8);
  r.dispose(); canvas.remove();
  return { key, box: [box.min.toArray(), box.max.toArray()].map(a => a.map(v => +v.toFixed(2))), swPos, url, side };
}
