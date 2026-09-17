import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SIC_PREFIXES = ['SIC_', 'SIC'];
const SII_PREFIXES = ['SII_', 'SII'];

function nameMatches(name, prefixes) {
  if (!name) return false;
  return prefixes.some((p) => name === p || name.startsWith(p));
}

function isSic(name) {
  return nameMatches(name, ['SIC_']) || name === 'LaunchPad' || name === 'FlameTrench';
}

function isSii(name) {
  return nameMatches(name, ['SII_']);
}

/** Simple exhaust particle system parented under nozzles. */
export function createThrustFX() {
  const count = 120;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    velocities.push(new THREE.Vector3());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffaa44,
    size: 1.8,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  points.frustumCulled = false;

  const light = new THREE.PointLight(0xff9944, 0, 40, 2);
  light.position.set(0, -2, 0);

  const group = new THREE.Group();
  group.add(points);
  group.add(light);
  group.userData = { positions, velocities, count, mat, light, active: false };

  return group;
}

export function updateThrustFX(fx, dt, thrusting, stage = 1) {
  const { positions, velocities, count, mat, light } = fx.userData;
  fx.userData.active = thrusting;
  fx.visible = thrusting;
  light.intensity = thrusting ? (stage === 1 ? 8 : stage === 2 ? 5 : 3) : 0;
  mat.opacity = thrusting ? 0.9 : 0;
  mat.size = stage === 1 ? 2.2 : 1.4;

  const attr = fx.children[0].geometry.attributes.position;
  for (let i = 0; i < count; i++) {
    if (thrusting && Math.random() < 0.35) {
      positions[i * 3] = (Math.random() - 0.5) * (stage === 1 ? 4 : 2);
      positions[i * 3 + 1] = -Math.random() * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      velocities[i].set(
        (Math.random() - 0.5) * 4,
        -(12 + Math.random() * 28),
        (Math.random() - 0.5) * 4,
      );
    }
    positions[i * 3] += velocities[i].x * dt;
    positions[i * 3 + 1] += velocities[i].y * dt;
    positions[i * 3 + 2] += velocities[i].z * dt;
    velocities[i].y -= 10 * dt;
  }
  attr.needsUpdate = true;
}

function paint(matName, color, metal = 0, rough = 0.45) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: metal,
    roughness: rough,
    name: matName,
  });
}

/** Procedural low-poly Saturn V (Y-up, base at y=0). */
export function buildProceduralSaturnV() {
  const white = paint('White', 0xf2f2f0);
  const black = paint('Black', 0x1a1a1a, 0.1, 0.55);
  const metal = paint('Metal', 0x889099, 0.7, 0.35);
  const copper = paint('Copper', 0xb87333, 0.55, 0.4);
  const dark = paint('Dark', 0x333338, 0.4, 0.5);

  const root = new THREE.Group();
  root.name = 'Saturn_V';

  const sic = new THREE.Group();
  sic.name = 'SIC_Group';
  // Body ~42m tall, radius ~5
  const sicBody = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.1, 42, 24), white);
  sicBody.position.y = 21;
  sicBody.name = 'SIC_Body';
  sic.add(sicBody);
  const band1 = new THREE.Mesh(new THREE.CylinderGeometry(5.15, 5.15, 3.5, 24), black);
  band1.position.y = 10;
  band1.name = 'SIC_Band_Lower';
  sic.add(band1);
  const band2 = new THREE.Mesh(new THREE.CylinderGeometry(5.15, 5.15, 3.5, 24), black);
  band2.position.y = 32;
  band2.name = 'SIC_Band_Upper';
  sic.add(band2);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, 2.5, 24), dark);
  skirt.position.y = 1.25;
  skirt.name = 'SIC_Skirt';
  sic.add(skirt);

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 3.5), white);
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 5.5, 3, Math.sin(a) * 5.5);
    fin.lookAt(0, 3, 0);
    fin.name = `SIC_Fin_0${i + 1}`;
    sic.add(fin);
  }
  const engineOffsets = [
    [0, 0],
    [2.4, 0],
    [-2.4, 0],
    [0, 2.4],
    [0, -2.4],
  ];
  engineOffsets.forEach(([x, z], i) => {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, 4, 16), copper);
    bell.position.set(x, -1.5, z);
    bell.name = `SIC_Engine_0${i + 1}`;
    sic.add(bell);
  });
  root.add(sic);

  const inter1 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.8, 24), dark);
  inter1.position.y = 42.9;
  inter1.name = 'SIC_SII_Interstage';
  root.add(inter1);

  const sii = new THREE.Group();
  sii.name = 'SII_Group';
  const siiBody = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 24, 24), white);
  siiBody.position.y = 55.8;
  siiBody.name = 'SII_Body';
  sii.add(siiBody);
  const siiBand = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.1, 2.5, 24), black);
  siiBand.position.y = 55.8;
  siiBand.name = 'SII_Band_Mid';
  sii.add(siiBand);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.0, 2.5, 12), copper);
    bell.position.set(Math.cos(a) * 2.2, 43.5, Math.sin(a) * 2.2);
    bell.name = `SII_Engine_0${i + 1}`;
    sii.add(bell);
  }
  root.add(sii);

  const inter2 = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 5, 2, 24), dark);
  inter2.position.y = 68.8;
  inter2.name = 'SII_SIVB_Interstage';
  root.add(inter2);

  const sivb = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 18, 20), white);
  sivb.position.y = 78.8;
  sivb.name = 'SIVB_Body';
  root.add(sivb);
  const sivbEng = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 3, 12), copper);
  sivbEng.position.y = 68.5;
  sivbEng.name = 'SIVB_Engine_01';
  root.add(sivbEng);

  const iu = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 1.2, 20), metal);
  iu.position.y = 88.4;
  iu.name = 'IU';
  root.add(iu);

  const fairing = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.3, 8, 20), white);
  fairing.position.y = 93;
  fairing.name = 'Apollo_Fairing';
  root.add(fairing);
  const csm = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 4, 16), white);
  csm.position.y = 99;
  csm.name = 'CSM';
  root.add(csm);
  const cm = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.5, 16), white);
  cm.position.y = 102.75;
  cm.name = 'CM_Cone';
  root.add(cm);
  const les = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 10, 8), dark);
  les.position.y = 109.5;
  les.name = 'LES_Tower';
  root.add(les);
  const lesNose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 8), dark);
  lesNose.position.y = 115.5;
  lesNose.name = 'LES_Nose';
  root.add(lesNose);

  // Launch pad under rocket
  const pad = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 40), paint('Concrete', 0x777780, 0.05, 0.9));
  pad.position.y = -1;
  pad.name = 'LaunchPad';
  root.add(pad);

  root.userData.procedural = true;
  root.userData.height = 116;
  return root;
}

function classifyParts(root) {
  const sic = [];
  const sii = [];
  const upper = [];
  const pad = [];
  root.traverse((obj) => {
    const n = obj.name || '';
    if (!n || n === 'Saturn_V') return;
    if (n === 'LaunchPad' || n === 'FlameTrench' || n.includes('Pad') || n.includes('Trench')) {
      pad.push(obj);
    } else if (n.startsWith('SIC_') || n === 'SIC_Group') {
      sic.push(obj);
    } else if (n.startsWith('SII_') || n === 'SII_Group') {
      sii.push(obj);
    } else {
      upper.push(obj);
    }
  });
  return { sic, sii, upper, pad };
}

function fitRocketUpright(model) {
  // Center on XZ, base near y=0. Blender GLTF is usually Y-up already.
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // If model is longer on Z than Y, it may still be Z-up — rotate.
  if (size.z > size.y * 1.2) {
    model.rotation.x = -Math.PI / 2;
    box.setFromObject(model);
    box.getSize(size);
    box.getCenter(center);
  }

  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  // Scale to ~110 world units tall if wildly different
  const targetH = 110;
  if (size.y > 1) {
    const s = targetH / size.y;
    if (Math.abs(s - 1) > 0.05) {
      model.scale.multiplyScalar(s);
      box.setFromObject(model);
      model.position.y -= box.min.y;
    }
  }

  return box.setFromObject(model).getSize(new THREE.Vector3()).y;
}

/**
 * Load GLB Saturn V or fall back to procedural.
 * Returns { root, parts, thrustFX, height, fromGlb }
 */
export async function loadSaturnV() {
  const urls = ['/saturn_v.glb', './saturn_v.glb'];
  let gltf = null;
  const loader = new GLTFLoader();

  for (const url of urls) {
    try {
      gltf = await loader.loadAsync(url);
      break;
    } catch (_) {
      /* try next */
    }
  }

  let root;
  let fromGlb = false;
  if (gltf && gltf.scene) {
    root = gltf.scene;
    root.name = root.name || 'Saturn_V';
    fromGlb = true;
  } else {
    root = buildProceduralSaturnV();
  }

  const height = fitRocketUpright(root);
  root.updateMatrixWorld(true);
  const parts = classifyParts(root);

  const thrustFX = createThrustFX();
  thrustFX.position.set(0, 0.5, 0);
  root.add(thrustFX);

  return { root, parts, thrustFX, height, fromGlb };
}

export function jettisonStage(parts, which) {
  const list = which === 1 ? parts.sic : parts.sii;
  for (const obj of list) {
    obj.visible = false;
  }
  if (which === 1) {
    parts.upper.forEach((o) => {
      if (o.name && o.name.includes('SIC_SII')) o.visible = false;
    });
  }
  if (which === 2) {
    parts.upper.forEach((o) => {
      if (o.name && o.name.includes('SII_SIVB')) o.visible = false;
    });
  }
}

export function hidePad(parts) {
  for (const obj of parts.pad) obj.visible = false;
}
