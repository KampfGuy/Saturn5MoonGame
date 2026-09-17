import * as THREE from 'three';

/** Procedural Neil Armstrong: white suit + gold visor. */
export function createNeilArmstrong() {
  const suit = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.7, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.25,
    metalness: 0.85,
    emissive: 0x332200,
    emissiveIntensity: 0.25,
  });
  const flagRed = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.6 });
  const flagWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const flagBlue = new THREE.MeshStandardMaterial({ color: 0x002868, roughness: 0.6 });

  const root = new THREE.Group();
  root.name = 'NeilArmstrong';

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.7, 6, 12), suit);
  torso.position.y = 1.15;
  root.add(torso);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.35), suit);
  backpack.position.set(0, 1.2, -0.45);
  root.add(backpack);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), suit);
  helmet.position.y = 1.95;
  root.add(helmet);

  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI), gold);
  visor.position.set(0, 1.95, 0.12);
  visor.rotation.y = Math.PI;
  root.add(visor);

  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 4, 8), suit);
  legL.position.set(-0.22, 0.45, 0);
  root.add(legL);
  const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 4, 8), suit);
  legR.position.set(0.22, 0.45, 0);
  root.add(legR);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.45, 4, 8), suit);
  armL.position.set(-0.62, 1.25, 0);
  armL.rotation.z = 0.3;
  root.add(armL);
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.45, 4, 8), suit);
  armR.position.set(0.62, 1.25, 0);
  armR.rotation.z = -0.3;
  root.add(armR);

  // Tiny handheld flag (hidden until planted sequence)
  const flag = new THREE.Group();
  flag.name = 'Flag';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), dark);
  pole.position.y = 1.1;
  flag.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), flagBlue);
  cloth.position.set(0.62, 1.85, 0);
  flag.add(cloth);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), flagRed);
  stripe.position.set(0.62, 1.7, 0.01);
  flag.add(stripe);
  const stripe2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), flagWhite);
  stripe2.position.set(0.62, 1.55, 0.01);
  flag.add(stripe2);
  flag.visible = false;
  root.add(flag);

  root.userData = {
    armR,
    armL,
    legL,
    legR,
    flag,
    waving: false,
    walkPhase: 0,
  };

  root.scale.setScalar(1.8);
  return root;
}

export function updateAstronaut(neil, dt, mode) {
  const ud = neil.userData;
  if (mode === 'walk') {
    ud.walkPhase += dt * 6;
    ud.legL.rotation.x = Math.sin(ud.walkPhase) * 0.45;
    ud.legR.rotation.x = Math.sin(ud.walkPhase + Math.PI) * 0.45;
    ud.armL.rotation.x = Math.sin(ud.walkPhase + Math.PI) * 0.35;
    ud.armR.rotation.x = Math.sin(ud.walkPhase) * 0.35;
  } else if (mode === 'wave') {
    ud.armR.rotation.z = -0.3 - Math.abs(Math.sin(performance.now() * 0.008)) * 1.2;
    ud.armR.rotation.x = 0.2;
    ud.legL.rotation.x = 0;
    ud.legR.rotation.x = 0;
  } else {
    ud.legL.rotation.x = 0;
    ud.legR.rotation.x = 0;
  }
}
