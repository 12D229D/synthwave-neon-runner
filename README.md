# ⚡ Synthwave Neon Velocity

Endless runner arcade pseudo-3D (Mode 7 / Retro Grid Projection) ambientado en los 80s synthwave. Carrera sobre una rejilla de luz neón infinita, esquivando obstáculos holográficos, recolectando esferas de energía y acelerando al ritmo de música synthwave **generada en tiempo real** con Web Audio API.

## ▶ Cómo jugar

Abre `index.html` (sin servidor ni dependencias).

| Acción | Teclado | Táctil |
|---|---|---|
| Cambiar carril | ← → o A / D | Pads ◀ ▶ o swipe |
| Nitro | Espacio / Shift (mantener) | Botón ⚡ |
| Pausa | P / Esc | Botón ❚❚ |

- 3 choques acumulados en corto espacio = Game Over (el choque quita puntos y resetea el combo).
- Los orbes suman puntos × combo; el combo crea cada 3 orbes (hasta x8).
- La velocidad, la frecuencia de obstáculos y el BPM de la música (124→140) escalan con la distancia.
- Récords de puntuación y distancia persistidos en `localStorage`.

## 🏗️ Arquitectura

```text
synthwave-neon-runner/
├── index.html          # HUD, overlays (menú/pausa/game over), canvas, controles táctiles
├── css/style.css       # Tokens HSL, glassmorphism, glows neón, responsive, a11y
├── js/
│   ├── camera.js       # Proyección pseudo-3D, sol neón, montañas wireframe, rejilla
│   ├── synth.js        # Secuenciador Web Audio: kick/snare/hats, bajo arpegiado, pads
│   ├── audio.js        # SFX: choque, nitro, pickup (sin ficheros externos)
│   ├── vehicle.js      # 3 carriles con inercia/easing, nitro, render del coche
│   ├── obstacles.js    # Spawner procedimental, colisión Z-depth + carril
│   └── app.js          # Máquina de estados, game loop, HUD, input, récords
└── plan.md             # Bitácora
```

- **Patrón:** módulos con namespace global (sin build step, compatible con `file://`).
- **Paradigma:** híbrido declarativo (UI/CSS) + event-driven (listeners, callbacks de beat).
- **Sincronía música-juego:** `Synth.on('kick'|'snare')` dispara destellos de la rejilla y la dificultad sube el BPM del secuenciador.

## 📄 Nota

Juego 100% client-side. Sin assets externos: toda la gráfica es Canvas 2D procedural y todo el audio es sintetizado.
