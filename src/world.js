import * as THREE from 'three';

/** Distant starfield (side-view friendly). */
export function createStars(count = 1800) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.35) * 4200;
    positions[i * 3 + 1] = (Math.random() - 0.2) * 2200;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 800 - 200;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const stars = new THREE.Points(geo, mat);
  stars.name = 'Stars';
  return stars;
}

export function createEarth(radius = 80) {
  const geo = new THREE.SphereGeometry(radius, 48, 32);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#1a4a9a');
  g.addColorStop(0.45, '#2d7a3e');
  g.addColorStop(0.55, '#1e6b35');
  g.addColorStop(1, '#0c2a6a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * 256, Math.random() * 128, 8 + Math.random() * 18, 3 + Math.random() * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0x001133,
    emissiveIntensity: 0.15,
  });
  const earth = new THREE.Mesh(geo, mat);
  earth.name = 'Earth';
  return earth;
}

export function createMoon(radius = 55) {
  const geo = new THREE.SphereGeometry(radius, 64, 48);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a8a8a8';
  ctx.fillRect(0, 0, 512, 256);
  // Craters
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = 4 + Math.random() * 28;
    const shade = 90 + Math.floor(Math.random() * 50);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgb(${shade - 30},${shade - 30},${shade - 30})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.95,
    metalness: 0.0,
    color: 0xcccccc,
  });
  const moon = new THREE.Mesh(geo, mat);
  moon.name = 'Moon';
  return moon;
}

/** Flat lunar ground for landing (local plane under LM / upper stack). */
export function createLunarSurface(size = 400) {
  const geo = new THREE.PlaneGeometry(size, size, 40, 40);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const n = Math.sin(x * 0.08) * Math.cos(y * 0.07) * 1.2 + Math.sin(x * 0.2 + y * 0.15) * 0.4;
    pos.setZ(i, n);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9a9a9a,
    roughness: 1,
    flatShading: true,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'LunarSurface';
  return ground;
}

export function createSkyGradient() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#02040c');
  g.addColorStop(0.35, '#0a1a3a');
  g.addColorStop(0.7, '#3a6aaa');
  g.addColorStop(1, '#87b4e0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function createAtmosphereFog() {
  return new THREE.FogExp2(0x6a9ccc, 0.0018);
}
