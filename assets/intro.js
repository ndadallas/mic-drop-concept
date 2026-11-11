// Intro 3D : le téléphone sonne, on décroche, la TV s'allume, la caméra plonge dans l'écran.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const intro = document.getElementById('intro');
const canvas = document.getElementById('introCanvas');
const ring = document.getElementById('introRing');
const cta = document.getElementById('introCta');
const PAPER = 0xfffdf5;
// on arrive toujours en haut du site après l'intro
history.scrollRestoration = 'manual';
scrollTo(0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
const CAM_START = new THREE.Vector3(0.35, 1.25, 4.1);
const LOOK_START = new THREE.Vector3(0.15, 0.45, 0.2);
camera.position.copy(CAM_START);

scene.add(new THREE.HemisphereLight(0xfff6e0, 0xc9b98f, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-2.5, 4, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
sun.shadow.radius = 6;
scene.add(sun);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.18 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Contour papier blanc autour de chaque objet (coque inversée gonflée le long des normales).
function paperOutline(mesh, thickness) {
  const m = new THREE.MeshBasicMaterial({ color: PAPER, side: THREE.BackSide });
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${thickness.toFixed(4)};`);
  };
  const o = new THREE.Mesh(mesh.geometry, m);
  mesh.add(o);
}

// Une seule vidéo : d'abord texture de l'écran 3D, puis la même en plein écran (aucune coupure ni redémarrage).
// préchargée pendant la sonnerie pour démarrer sans attente
const full = document.createElement('video');
Object.assign(full, { src: 'assets/video/mic-drop.mp4', preload: 'auto', playsInline: true, className: 'intro__show' });
let fullFailed = false;
full.addEventListener('error', () => {
  // vidéo complète absente : extrait muet sur l'écran 3D, puis lecteur Vimeo
  if (fullFailed) return;
  fullFailed = true;
  Object.assign(full, { src: 'assets/video/mv-culture.mp4', muted: true, loop: true });
}, { once: true });
full.addEventListener('ended', () => endIntro());
// l'extinction démarre sur les dernières images, sans arrêt sur image
full.addEventListener('timeupdate', () => { if (state.phase === 'show' && full.duration - full.currentTime < 0.3) endIntro(); });
intro.appendChild(full);
const vtex = new THREE.VideoTexture(full);
vtex.colorSpace = THREE.SRGBColorSpace;
vtex.flipY = false; // UV glTF
vtex.repeat.x = 0.75; // vidéo 16:9 recadrée sur l'écran 4:3, comme object-fit: cover
vtex.offset.x = 0.125;

let tv, screen, handset, base, mic;
const state = { t: 0, phase: 'ring', liftT: 0, diveT: 0, mouse: new THREE.Vector2() };
let restPos, restRot;

new GLTFLoader().load('assets/3d/scene.glb', gltf => {
  scene.add(gltf.scene);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  tv = gltf.scene.getObjectByName('TV');
  screen = gltf.scene.getObjectByName('Screen');
  handset = gltf.scene.getObjectByName('Handset');
  base = gltf.scene.getObjectByName('PhoneBase');
  mic = gltf.scene.getObjectByName('Mic');
  // collecter d'abord : ajouter le contour pendant le traverse le re-parcourrait à l'infini
  const meshes = [];
  [tv, handset, base, mic].forEach(o => o && o.traverse(m => m.isMesh && meshes.push(m)));
  meshes.forEach(m => paperOutline(m, 0.018));
  screen.material = new THREE.MeshBasicMaterial({ color: 0x0b0908 });
  restPos = handset.position.clone();
  restRot = handset.rotation.clone();
  buildCord();
  intro.classList.add('is-ready');
  window.__introReady = true;
}, undefined, () => endIntro(true));

// Cordon spiralé entre le socle et le combiné, recalculé quand le combiné bouge.
let cord;
const cordMat = new THREE.MeshStandardMaterial({ color: 0xb3171d, roughness: 0.4 });
class CoilCurve extends THREE.Curve {
  constructor(a, b) { super(); this.a = a; this.b = b; }
  getPoint(t, target = new THREE.Vector3()) {
    const mid = this.a.clone().lerp(this.b, 0.5);
    mid.y -= 0.12 + this.a.distanceTo(this.b) * 0.18; // le cordon pend
    const p = new THREE.Vector3()
      .addScaledVector(this.a, (1 - t) ** 2)
      .addScaledVector(mid, 2 * t * (1 - t))
      .addScaledVector(this.b, t * t);
    const coil = t > 0.06 && t < 0.94 ? 0.016 : 0;
    const ang = t * Math.PI * 2 * 26;
    return target.copy(p).add(new THREE.Vector3(Math.cos(ang) * coil, Math.sin(ang) * coil, Math.sin(ang + 1) * coil));
  }
}
function cordEnds() {
  const a = new THREE.Vector3(-0.3, 0.06, -0.05).applyMatrix4(base.matrixWorld);
  const b = new THREE.Vector3(-0.29, -0.09, 0).applyMatrix4(handset.matrixWorld);
  return [a, b];
}
function buildCord() {
  scene.updateMatrixWorld(true);
  const [a, b] = cordEnds();
  const g = new THREE.TubeGeometry(new CoilCurve(a, b), 420, 0.007, 5, false);
  if (cord) { cord.geometry.dispose(); cord.geometry = g; }
  else { cord = new THREE.Mesh(g, cordMat); cord.castShadow = true; scene.add(cord); }
}

// Interaction
function pickUp() {
  if (state.phase !== 'ring' || !handset) return;
  state.phase = 'lift';
  state.liftT = 0;
  ring.classList.remove('is-on');
  cta.classList.add('is-gone');
  // lancée dans le clic : le navigateur autorise le son
  full.currentTime = 0;
  full.play().catch(() => { full.muted = true; full.play().catch(() => {}); });
}
intro.addEventListener('click', e => { if (!e.target.closest('.intro__skip')) pickUp(); });
addEventListener('keydown', e => {
  if (ended) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickUp(); }
  if (e.key === 'Escape') endIntro();
});
document.getElementById('introSkip').addEventListener('click', () => endIntro());
addEventListener('pointermove', e => state.mouse.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1));

// Une fois dans la TV : la vidéo (déjà en cours) occupe tout l'écran, la 3D s'arrête.
function showGenerique() {
  if (state.phase === 'show') return;
  state.phase = 'show';
  renderer.setAnimationLoop(null);
  intro.classList.add('is-show');
  Object.assign(full.style, { opacity: 1, transform: 'none' });
  if (fullFailed) { full.remove(); showVimeo(); }
}

// sinon le lecteur Vimeo
function showVimeo() {
  const f = document.createElement('iframe');
  f.className = 'intro__show';
  f.title = 'MIC DROP';
  f.allow = 'autoplay; fullscreen; picture-in-picture';
  f.src = 'https://player.vimeo.com/video/1146238177?autoplay=1&title=0&byline=0&portrait=0';
  intro.appendChild(f);
  // API postMessage de Vimeo : à la fin de la vidéo, on entre sur le site
  addEventListener('message', e => {
    if (e.origin !== 'https://player.vimeo.com') return;
    const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (d.event === 'ready') f.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: 'ended' }), e.origin);
    if (d.event === 'ended') endIntro();
  });
}

let ended = false;
function endIntro(instant) {
  if (ended) return;
  ended = true;
  // depuis la vidéo : la TV s'éteint (trait puis point), puis l'écran noir se lève sur le site
  const tvOff = !instant && intro.classList.contains('is-show');
  if (tvOff) intro.classList.add('is-off'); // la vidéo continue pendant qu'elle s'écrase
  else full.pause();
  // le rideau part avant la fin de l'extinction pour enchaîner sans temps mort
  setTimeout(() => intro.classList.add('is-out'), tvOff ? 600 : 0);
  setTimeout(() => {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    full.pause();
    intro.remove();
    // seulement après : réactiver le scroll pendant l'animation provoquait un recalcul de la page (saccade)
    document.body.classList.remove('intro-on');
  }, instant ? 0 : tvOff ? 1450 : 900);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // recule la caméra en portrait pour garder la scène entière
  camera.userData.back = Math.max(1, 1.45 / (w / h) * 0.8);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const ease = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const look = new THREE.Vector3();
const screenPos = new THREE.Vector3();
let last = performance.now();

renderer.setAnimationLoop(now => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.t += dt;
  if (!handset) { renderer.render(scene, camera); return; }

  // caméra de base : léger flottement + parallaxe souris
  const back = camera.userData.back;
  const camBase = CAM_START.clone().multiplyScalar(back).add(new THREE.Vector3(0, (back - 1) * -0.5, 0));
  camBase.x += state.mouse.x * 0.25 + Math.sin(state.t * 0.4) * 0.05;
  camBase.y += -state.mouse.y * 0.12;
  look.copy(LOOK_START);

  if (state.phase === 'ring') {
    // sonnerie : secousses rapides, puis une pause
    const cyc = state.t % 2.2;
    const on = cyc < 1.1;
    const k = on ? Math.sin(cyc * 70) * 0.06 : 0;
    handset.position.copy(restPos).add(new THREE.Vector3(0, on ? Math.abs(Math.sin(cyc * 35)) * 0.025 : 0, 0));
    handset.rotation.set(restRot.x + k, restRot.y, restRot.z + k * 0.6);
    ring.classList.toggle('is-on', on);
    if (on) {
      screenPos.copy(restPos).add(new THREE.Vector3(0.1, 0.35, 0)).project(camera);
      ring.style.transform = `translate(${(screenPos.x + 1) / 2 * innerWidth}px, ${(1 - screenPos.y) / 2 * innerHeight}px) translate(-50%,-50%) rotate(${-8 + Math.sin(state.t * 30) * 3}deg)`;
    }
    buildCord();
  }

  if (state.phase === 'lift' || state.phase === 'dive') {
    state.liftT = Math.min(1, state.liftT + dt / 1.1);
    const e = ease(state.liftT);
    handset.position.copy(restPos).add(new THREE.Vector3(-0.35 * e, 0.75 * e, 0.45 * e));
    handset.rotation.set(restRot.x + 0.9 * e, restRot.y - 0.5 * e, restRot.z + 1.2 * e);
    buildCord();
    // la TV s'allume (balayage vertical façon cathodique)
    const on = THREE.MathUtils.clamp((state.liftT - 0.35) / 0.4, 0, 1);
    if (on > 0 && screen.material.map !== vtex) screen.material = new THREE.MeshBasicMaterial({ map: vtex });
    if (on > 0) screen.scale.set(1, Math.max(0.02, ease(on)), 1);
    if (state.liftT >= 1 && state.phase === 'lift') { state.phase = 'dive'; state.diveT = 0; }
  }

  if (state.phase === 'dive') {
    state.diveT = Math.min(1, state.diveT + dt / 1.8);
    const e = easeInOut(state.diveT);
    const sp = new THREE.Vector3().setFromMatrixPosition(screen.matrixWorld);
    camBase.lerp(sp.clone().add(new THREE.Vector3(0, 0, 0.42)), e);
    look.lerp(sp, ease(state.diveT));
    // fondu enchaîné : la même vidéo en plein écran apparaît par-dessus pendant que la caméra finit d'avancer
    const f = THREE.MathUtils.clamp((state.diveT - 0.55) / 0.45, 0, 1);
    full.style.opacity = easeInOut(f);
    full.style.transform = `scale(${0.82 + 0.18 * ease(f)})`;
    if (state.diveT >= 1) showGenerique();
  }

  camera.position.lerp(camBase, state.phase === 'dive' ? 1 : 0.08);
  camera.lookAt(look);
  renderer.render(scene, camera);
});
