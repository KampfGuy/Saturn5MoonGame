# Saturn V → Moon (2.5D)

A short playable **2.5D side-view** PC game: launch a Saturn V, stage, fly to the Moon, land, and send Neil Armstrong on EVA.

Built with **Vite + vanilla JavaScript + Three.js**. The camera is locked to a side view (X = toward the Moon, Y = altitude) — not free 6DOF, not sprites-only 2D.

## Quick start

```bash
cd saturn5-game
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Production build

```bash
npm run build
npx serve dist
```

Or open `dist/index.html` via any static file server (`base` is relative: `./`).

## How to play (keyboard only)

| Phase | Controls |
|-------|----------|
| **LAUNCH** | Hold **Space** or **W** to thrust. Rise from the pad. |
| **STAGING** | Automatic at altitude thresholds — S-IC then S-II jettison. Keep thrusting. |
| **TO THE MOON** | **A/D** or **←/→** steer altitude. **W/Space** boosts. Reach the Moon. |
| **LANDING** | Brief thrusts to soften descent onto the gray surface. |
| **EVA** | Press **E** — Neil Armstrong walks out, plants a flag, waves. |
| **THE END** | Win overlay + **Restart Mission**. |

Typical run: **~2–5 minutes**.

## Assets

- Prefers `public/saturn_v.glb` (exported from the companion Blender Saturn V).
- If the GLB is missing, a procedural low-poly Saturn V (cylinders/cones, black/white bands, fins, nozzles) is built in code.
- Earth, Moon (crater canvas texture), stars, and Neil Armstrong are procedural.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Output to `dist/` |
| `npm run preview` | Preview the production build |

## Notes / caveats

- Arcade movement (no full physics engine).
- Staging hides GLB meshes by name prefix (`SIC_*`, `SII_*`).
- Designed for desktop Chrome/Firefox/Edge with a keyboard.
