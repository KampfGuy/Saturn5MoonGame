import * as THREE from 'three';
import { initInput, thrustHeld, steerLeft, steerRight, evaPressed } from './input.js';
import {
  createStars,
  createEarth,
  createMoon,
  createLunarSurface,
  createSkyGradient,
} from './world.js';
import { loadSaturnV, updateThrustFX, jettisonStage, hidePad } from './rocket.js';
import { createNeilArmstrong, updateAstronaut } from './astronaut.js';

const PHASE = {
  LAUNCH: 'LAUNCH',
  STAGING: 'STAGING',
  TO_THE_MOON: 'TO THE MOON',
  LANDING: 'LANDING',
  EVA: 'EVA',
  THE_END: 'THE END',
};

const el = {
  phase: document.getElementById('phase-label'),
  instructions: document.getElementById('instructions'),
  alt: document.getElementById('alt'),
  vel: document.getElementById('vel'),
  stage: document.getElementById('stage'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayText: document.getElementById('overlay-text'),
  restart: document.getElementById('restart-btn'),
  evaPrompt: document.getElementById('eva-prompt'),
  canvas: document.getElementById('game'),
};

const PHASE_HELP = {
  [PHASE.LAUNCH]: 'Hold SPACE or W for thrust. Lift off the pad!',
  [PHASE.STAGING]: 'Staging! Keep thrusting — spent stages fall away.',
  [PHASE.TO_THE_MOON]: 'Coast to the Moon. Steer altitude with A/D or ←/→. Hold W/SPACE for boost.',
  [PHASE.LANDING]: 'LANDING — ease down with brief thrusts. Touch the gray surface gently.',
  [PHASE.EVA]: 'Touchdown! Press E to send Neil Armstrong out onto the Moon.',
  [PHASE.THE_END]: 'Mission complete.',
};

const STATE = {
  phase: PHASE.LAUNCH,
  rocketY: 0,
  rocketX: 0,
  vy: 0,
  vx: 0,
  pitch: 0, // degrees-ish: + = nose up in cruise
  stageIndex: 1, // 1=S-IC, 2=S-II, 3=S-IVB/upper
  staged1: false,
  staged2: false,
  fuelBoost: 1,
  moonReached: false,
  landed: false,
  evaStarted: false,
  evaDone: false,
  evaT: 0,
  neilMode: 'idle',
  time: 0,
  camShake: 0,
};

let scene, camera, renderer;
let rocketRoot, parts, thrustFX, rocketHeight;
let stars, earth, moon, lunarSurface, padGroup;
let neil = null;
let clock = new THREE.Clock();
let sun;
let atmosphereActive = true;

const WORLD = {
  // Launch altitudes (game units ≈ meters / 1)
  stage1Alt: 95,
  stage2Alt: 175,
  spaceAlt: 230,
  // Cruise
  moonX: 900,
  moonY: 120,
  moonRadius: 55,
  earthX: -220,
  earthY: 40,
  landAlt: 8, // height of craft above lunar ground when "landed"
};

function setPhase(p) {
  STATE.phase = p;
  el.phase.textContent = p;
  el.instructions.textContent = PHASE_HELP[p] || '';
  if (p === PHASE.EVA) {
    el.evaPrompt.classList.remove('hidden');
  } else {
    el.evaPrompt.classList.add('hidden');
  }
}

function showEnd() {
  setPhase(PHASE.THE_END);
  el.overlay.classList.remove('hidden');
  el.overlayTitle.textContent = 'THE END';
  el.overlayText.textContent =
    'The Eagle has landed — Neil Armstrong is on the Moon. THE END.';
  el.evaPrompt.classList.add('hidden');
}

function resetMission() {
  el.overlay.classList.add('hidden');
  STATE.phase = PHASE.LAUNCH;
  STATE.rocketY = 0;
  STATE.rocketX = 0;
  STATE.vy = 0;
  STATE.vx = 0;
  STATE.pitch = 0;
  STATE.stageIndex = 1;
  STATE.staged1 = false;
  STATE.staged2 = false;
  STATE.fuelBoost = 1;
  STATE.moonReached = false;
  STATE.landed = false;
  STATE.evaStarted = false;
  STATE.evaDone = false;
  STATE.evaT = 0;
  STATE.neilMode = 'idle';
  STATE.time = 0;
  STATE.camShake = 0;

  if (neil) {
    scene.remove(neil);
    neil = null;
  }

  // Restore visibility of stages / pad
  rocketRoot.traverse((o) => {
    o.visible = true;
  });
  if (parts) {
    // pad stays in padGroup — ensure visible
    for (const o of parts.pad) o.visible = true;
  }
  if (padGroup) padGroup.visible = true;
  if (lunarSurface) lunarSurface.visible = false;
  if (earth) earth.visible = false;
  if (moon) {
    moon.visible = false;
    moon.position.set(WORLD.moonX, WORLD.moonY, -40);
  }
  if (stars) stars.visible = false;

  rocketRoot.position.set(0, 0, 0);
  rocketRoot.rotation.set(0, 0, 0);
  atmosphereActive = true;
  scene.background = createSkyGradient();
  scene.fog = new THREE.FogExp2(0x6a9ccc, 0.0022);
  sun.intensity = 1.4;
  sun.position.set(80, 120, 60);

  setPhase(PHASE.LAUNCH);
  updateHud();
}

function updateHud() {
  const alt =
    STATE.phase === PHASE.LANDING || STATE.phase === PHASE.EVA || STATE.phase === PHASE.THE_END
      ? Math.max(0, STATE.rocketY)
      : STATE.rocketY;
  el.alt.textContent = `ALT: ${alt.toFixed(0)} m`;
  const speed = Math.hypot(STATE.vx, STATE.vy);
  el.vel.textContent = `VEL: ${speed.toFixed(1)} m/s`;
  const stageName =
    STATE.stageIndex === 1 ? 'S-IC' : STATE.stageIndex === 2 ? 'S-II' : 'S-IVB / Apollo';
  el.stage.textContent = `STAGE: ${stageName}`;
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: el.canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

function setupCamera() {
  // Perspective locked to side view (look along -Z) — classic 2.5D
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(42, aspect, 0.5, 5000);
  camera.position.set(0, 40, 160);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 40, 0);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

async function init() {
  initInput();
  setupRenderer();
  setupCamera();
  window.addEventListener('resize', onResize);

  scene = new THREE.Scene();
  scene.background = createSkyGradient();
  scene.fog = new THREE.FogExp2(0x6a9ccc, 0.0022);

  const hemi = new THREE.HemisphereLight(0xb8d0ff, 0x443322, 0.55);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2dd, 1.4);
  sun.position.set(80, 120, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x334466, 0.35));

  stars = createStars();
  stars.visible = false;
  scene.add(stars);

  earth = createEarth(90);
  earth.position.set(WORLD.earthX, WORLD.earthY, -80);
  earth.visible = false;
  scene.add(earth);

  moon = createMoon(WORLD.moonRadius);
  moon.position.set(WORLD.moonX, WORLD.moonY, -40);
  moon.visible = false;
  scene.add(moon);

  lunarSurface = createLunarSurface(500);
  lunarSurface.position.set(WORLD.moonX, WORLD.moonY - WORLD.moonRadius - 2, 0);
  lunarSurface.visible = false;
  scene.add(lunarSurface);

  const loaded = await loadSaturnV();
  rocketRoot = loaded.root;
  parts = loaded.parts;
  thrustFX = loaded.thrustFX;
  rocketHeight = loaded.height || 110;
  console.log('[Saturn5] model', loaded.fromGlb ? 'GLB' : 'procedural', 'height', rocketHeight);

  // Move pad pieces out so they stay on ground while rocket rises
  padGroup = new THREE.Group();
  padGroup.name = 'PadGroup';
  rocketRoot.updateMatrixWorld(true);
  const padMeshes = [...parts.pad];
  for (const p of padMeshes) {
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    p.updateMatrixWorld(true);
    p.matrixWorld.decompose(worldPos, worldQuat, worldScale);
    if (p.parent) p.parent.remove(p);
    padGroup.add(p);
    p.position.copy(worldPos);
    p.quaternion.copy(worldQuat);
    p.scale.copy(worldScale);
  }
  // Ensure there is something on the ground if GLB pad was odd
  if (padGroup.children.length === 0) {
    const concrete = new THREE.Mesh(
      new THREE.BoxGeometry(50, 2, 50),
      new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.95 }),
    );
    concrete.position.y = -1;
    padGroup.add(concrete);
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(4, 90, 4),
      new THREE.MeshStandardMaterial({ color: 0xb0b0b8, metalness: 0.4, roughness: 0.5 }),
    );
    tower.position.set(-18, 45, 8);
    padGroup.add(tower);
  }
  scene.add(padGroup);
  scene.add(rocketRoot);

  el.restart.addEventListener('click', () => resetMission());

  setPhase(PHASE.LAUNCH);
  clock.start();
  animate();
}

function enterSpace() {
  atmosphereActive = false;
  scene.fog = null;
  scene.background = new THREE.Color(0x02040c);
  stars.visible = true;
  earth.visible = true;
  moon.visible = true;
  padGroup.visible = false;
  hidePad(parts);
  sun.intensity = 1.8;
  sun.position.set(200, 80, 100);

  // Orient rocket for side-view cruise: nose toward +X
  rocketRoot.rotation.z = -Math.PI / 2; // was upright (+Y), now +X
  STATE.vx = 55;
  STATE.vy = 0;
  STATE.rocketX = 40;
  // Keep some altitude
  if (STATE.rocketY < WORLD.spaceAlt) STATE.rocketY = WORLD.spaceAlt;
  setPhase(PHASE.TO_THE_MOON);
}

function enterLanding() {
  setPhase(PHASE.LANDING);
  lunarSurface.visible = true;
  // Place lunar surface under approach
  const groundY = WORLD.moonY - WORLD.moonRadius;
  lunarSurface.position.set(WORLD.moonX + 20, groundY, 0);
  // Soft target: land near moon limb / surface
  STATE.vx = Math.min(STATE.vx, 25);
  STATE.moonReached = true;
}

function doStaging(which) {
  jettisonStage(parts, which);
  STATE.camShake = 0.6;
  if (which === 1) {
    STATE.staged1 = true;
    STATE.stageIndex = 2;
    setPhase(PHASE.STAGING);
    // brief staging phase then continue as launch if still climbing
    setTimeout(() => {
      if (STATE.phase === PHASE.STAGING && STATE.rocketY < WORLD.spaceAlt) {
        el.instructions.textContent = 'S-IC jettisoned. Keep thrusting on S-II!';
      }
    }, 100);
  } else {
    STATE.staged2 = true;
    STATE.stageIndex = 3;
    el.instructions.textContent = 'S-II jettisoned. S-IVB / Apollo continues!';
  }
}

function spawnNeil() {
  neil = createNeilArmstrong();
  const groundY = lunarSurface.position.y + 0.2;
  neil.position.set(STATE.rocketX + 6, groundY, 4);
  // Face somewhat toward camera / side
  neil.rotation.y = -Math.PI * 0.25;
  scene.add(neil);
  STATE.evaStarted = true;
  STATE.neilMode = 'walk';
  STATE.evaT = 0;
  el.evaPrompt.classList.add('hidden');
  el.instructions.textContent = 'Neil Armstrong steps onto the lunar surface…';
}

function updateCamera(dt) {
  let targetX = STATE.rocketX;
  let targetY = STATE.rocketY + (STATE.phase === PHASE.LAUNCH || STATE.phase === PHASE.STAGING ? 30 : 10);
  let camZ = 160;
  let lookY = targetY;

  if (STATE.phase === PHASE.LAUNCH || STATE.phase === PHASE.STAGING) {
    targetX = 0;
    camZ = 140 + Math.min(80, STATE.rocketY * 0.15);
    targetY = STATE.rocketY + 25;
    lookY = STATE.rocketY + 20;
  } else if (STATE.phase === PHASE.TO_THE_MOON) {
    camZ = 180;
    targetY = STATE.rocketY + 5;
    lookY = STATE.rocketY;
  } else if (STATE.phase === PHASE.LANDING) {
    camZ = 90;
    targetY = STATE.rocketY + 8;
    lookY = STATE.rocketY + 2;
  } else {
    // EVA / END — frame Neil + lander
    if (neil) {
      targetX = neil.position.x;
      targetY = neil.position.y + 4;
      lookY = neil.position.y + 2;
    }
    camZ = 55;
  }

  const shake = STATE.camShake;
  STATE.camShake = Math.max(0, STATE.camShake - dt);
  const sx = (Math.random() - 0.5) * shake * 4;
  const sy = (Math.random() - 0.5) * shake * 4;

  const desired = new THREE.Vector3(targetX + sx, targetY + sy, camZ);
  camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  camera.lookAt(targetX, lookY, 0);
}

function updateLaunch(dt) {
  const thrusting = thrustHeld();
  const thrustPower =
    STATE.stageIndex === 1 ? 55 : STATE.stageIndex === 2 ? 42 : 28;
  const gravity = 18;

  if (thrusting) {
    STATE.vy += thrustPower * dt;
    STATE.camShake = Math.max(STATE.camShake, 0.15);
  }
  STATE.vy -= gravity * dt;
  // Drag near ground
  if (STATE.rocketY < 5 && STATE.vy < 0) STATE.vy *= 0.5;

  STATE.rocketY += STATE.vy * dt;
  if (STATE.rocketY < 0) {
    STATE.rocketY = 0;
    STATE.vy = 0;
  }

  rocketRoot.position.set(0, STATE.rocketY, 0);
  // Slight sway
  rocketRoot.rotation.z = Math.sin(STATE.time * 2) * 0.01 * Math.min(1, STATE.rocketY / 20);

  updateThrustFX(thrustFX, dt, thrusting && STATE.rocketY >= 0, STATE.stageIndex);

  if (!STATE.staged1 && STATE.rocketY >= WORLD.stage1Alt) doStaging(1);
  if (!STATE.staged2 && STATE.rocketY >= WORLD.stage2Alt) doStaging(2);

  if (STATE.rocketY >= WORLD.spaceAlt && STATE.staged2) {
    enterSpace();
  } else if (STATE.rocketY >= WORLD.spaceAlt && STATE.staged1) {
    // Allow space entry after stage 2 threshold even if late
    if (STATE.rocketY >= WORLD.stage2Alt + 30) {
      if (!STATE.staged2) doStaging(2);
      enterSpace();
    }
  }
}

function updateCruise(dt) {
  const thrusting = thrustHeld();
  // Steer altitude
  if (steerLeft()) STATE.vy += 28 * dt;
  if (steerRight()) STATE.vy -= 28 * dt;
  if (thrusting) {
    STATE.vx += 18 * dt;
    STATE.vy += 4 * dt;
  }
  // Soft auto-level toward moon altitude corridor
  const targetAlt = WORLD.moonY + 10;
  STATE.vy += (targetAlt - STATE.rocketY) * 0.02 * dt;
  STATE.vy *= 1 - 0.4 * dt;
  STATE.vx = Math.min(120, Math.max(20, STATE.vx));

  STATE.rocketX += STATE.vx * dt;
  STATE.rocketY += STATE.vy * dt;

  rocketRoot.position.set(STATE.rocketX, STATE.rocketY, 0);
  // Pitch visual from vertical velocity
  const pitch = THREE.MathUtils.clamp(-STATE.vy * 0.02, -0.35, 0.35);
  rocketRoot.rotation.z = -Math.PI / 2 + pitch;

  updateThrustFX(thrustFX, dt, thrusting, 3);

  earth.rotation.y += dt * 0.05;
  moon.rotation.y += dt * 0.02;

  const dist = Math.hypot(STATE.rocketX - WORLD.moonX, STATE.rocketY - WORLD.moonY);
  if (dist < WORLD.moonRadius + 70) {
    enterLanding();
  }
}

function updateLanding(dt) {
  const thrusting = thrustHeld();
  const groundY = lunarSurface.position.y + WORLD.landAlt;

  // Approach moon X, descend
  if (steerLeft()) STATE.vx -= 12 * dt;
  if (steerRight()) STATE.vx += 12 * dt;
  STATE.vx *= 1 - 0.5 * dt;

  const gravity = 6; // lunar-ish arcade
  if (thrusting) {
    STATE.vy += 22 * dt;
  }
  STATE.vy -= gravity * dt;
  STATE.vy *= 1 - 0.15 * dt;

  STATE.rocketX += STATE.vx * dt;
  STATE.rocketY += STATE.vy * dt;

  // Keep near landing zone
  if (STATE.rocketX < WORLD.moonX - 40) STATE.rocketX += 10 * dt;
  if (STATE.rocketX > WORLD.moonX + 80) STATE.vx -= 5 * dt;

  if (STATE.rocketY <= groundY) {
    STATE.rocketY = groundY;
    STATE.vy = 0;
    STATE.vx *= 0.5;
    if (Math.abs(STATE.vx) < 8) {
      STATE.landed = true;
      STATE.vx = 0;
      rocketRoot.position.set(STATE.rocketX, STATE.rocketY, 0);
      // Sit upright-ish on surface (stack was sideways — tilt to upright for LM feel)
      rocketRoot.rotation.z = -0.15;
      updateThrustFX(thrustFX, dt, false, 3);
      setPhase(PHASE.EVA);
      return;
    }
  }

  rocketRoot.position.set(STATE.rocketX, STATE.rocketY, 0);
  rocketRoot.rotation.z = -Math.PI / 2 + THREE.MathUtils.clamp(-STATE.vy * 0.03, -0.5, 0.4);
  updateThrustFX(thrustFX, dt, thrusting, 3);
}

function updateEva(dt) {
  updateThrustFX(thrustFX, dt, false, 3);
  if (!STATE.evaStarted) {
    if (evaPressed()) spawnNeil();
    return;
  }

  STATE.evaT += dt;
  if (STATE.evaT < 3.5) {
    // Walk a few meters
    STATE.neilMode = 'walk';
    neil.position.x += 2.2 * dt;
    updateAstronaut(neil, dt, 'walk');
  } else if (STATE.evaT < 5.5) {
    // Plant flag
    STATE.neilMode = 'idle';
    updateAstronaut(neil, dt, 'idle');
    if (neil.userData.flag && !neil.userData.flag.visible) {
      neil.userData.flag.visible = true;
      neil.userData.flag.position.set(1.2, 0, 0.3);
      el.instructions.textContent = 'One small step… the flag is planted.';
    }
  } else if (STATE.evaT < 8) {
    STATE.neilMode = 'wave';
    updateAstronaut(neil, dt, 'wave');
  } else if (!STATE.evaDone) {
    STATE.evaDone = true;
    showEnd();
  } else {
    updateAstronaut(neil, dt, 'wave');
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  STATE.time += dt;

  switch (STATE.phase) {
    case PHASE.LAUNCH:
    case PHASE.STAGING:
      updateLaunch(dt);
      // Return to LAUNCH label after brief staging flash
      if (STATE.phase === PHASE.STAGING && STATE.staged1 && STATE.rocketY > WORLD.stage1Alt + 15) {
        if (!STATE.staged2) {
          el.phase.textContent = PHASE.LAUNCH;
        }
      }
      break;
    case PHASE.TO_THE_MOON:
      updateCruise(dt);
      break;
    case PHASE.LANDING:
      updateLanding(dt);
      break;
    case PHASE.EVA:
      updateEva(dt);
      break;
    case PHASE.THE_END:
      if (neil) updateAstronaut(neil, dt, 'wave');
      break;
    default:
      break;
  }

  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
}

init().catch((err) => {
  console.error(err);
  el.instructions.textContent = 'Failed to load game: ' + err.message;
});
