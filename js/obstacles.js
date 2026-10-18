/* =================================================================
   Synthwave Neon Velocity — obstacles.js
   Generación procedimental de obstáculos (barreras láser, pirámides
   retro, desprendimientos) y coleccionables (esferas de energía)
   con escala progresiva según Z. Colisión 3D simplificada
   (Z-depth + carril X).
   ================================================================= */
(function () {
  'use strict';

  var SPAWN_Z = 90;      // distancia de aparición
  var DESPAWN_Z = 0.3;   // detrás de la cámara

  var items = [];        // { type, lane, z, hit, w, h }
  var lastSpawnZ = 0;

  var TYPES = ['laser', 'pyramid', 'rock'];

  function reset() {
    items.length = 0;
    lastSpawnZ = 0;
  }

  /* ---- Spawning procedimental: al menos 1.5 carriles libres ---- */
  function maybeSpawn(scroll, difficulty) {
    // Espera hasta que el punto de spawn anterior se haya alejado
    var minGap = Math.max(6, 16 - difficulty * 8);
    if (lastSpawnZ - SPAWN_Z > -minGap && items.length && items[items.length - 1].z < SPAWN_Z - minGap) {
      // gap suficiente aún
    }
    var gapZ = scroll - lastSpawnZ;
    if (gapZ < minGap) return;

    lastSpawnZ = scroll;

    var lanes = [0, 1, 2];
    // Elige 1 carril bloqueado (o 2 con dificultad alta)
    var nBlock = Math.random() < difficulty * 0.35 ? 2 : 1;
    for (var b = 0; b < nBlock; b++) {
      var idx = Math.floor(Math.random() * lanes.length);
      var lane = lanes.splice(idx, 1)[0];
      var type = TYPES[Math.floor(Math.random() * TYPES.length)];
      items.push({
        type: type,
        lane: lane - 1, // -1..1 en mundo
        z: SPAWN_Z,
        hit: false,
        w: type === 'laser' ? 0.62 : type === 'pyramid' ? 0.55 : 0.5,
        h: type === 'laser' ? 0.5 : type === 'pyramid' ? 0.55 : 0.34
      });
    }

    // Esfera de energía en un carril libre
    if (lanes.length && Math.random() < 0.65) {
      var free = lanes[Math.floor(Math.random() * lanes.length)];
      items.push({ type: 'orb', lane: free - 1, z: SPAWN_Z + 2.5, hit: false, w: 0.18, h: 0.18 });
    }
  }

  /* ---- Avance y limpieza ---- */
  function update(dt, speed, scroll, difficulty) {
    for (var i = items.length - 1; i >= 0; i--) {
      items[i].z -= speed * dt;
      if (items[i].z < DESPAWN_Z || (items[i].hit && items[i].z < DESPAWN_Z + 2)) {
        items.splice(i, 1);
      }
    }
    maybeSpawn(scroll, difficulty);
  }

  /* ---- Colisión 3D simplificada: Z-depth + carril X ---- */
  // Devuelve { crash: item|null, orb: item|null } — el caller consume.
  function collide(vehicleLaneX, near, far) {
    var res = { crash: null, orb: null };
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.hit) continue;
      if (it.z < far || it.z > near) continue;
      if (Math.abs(it.lane - vehicleLaneX) > (it.w + 0.18)) continue;
      if (it.type === 'orb') { it.hit = true; res.orb = it; }
      else { it.hit = true; res.crash = it; break; }
    }
    return res;
  }

  /* ---- Render en orden de profundidad (lejos -> cerca) ---- */
  function render(ctx, laneX, time) {
    items
      .slice()
      .sort(function (a, b) { return b.z - a.z; })
      .forEach(function (it) { render_item(ctx, it, laneX, time); });
  }

  function render_item(ctx, it, laneX, time) {
    var p = Camera.project(it.lane, it.h * 0.5, it.z, laneX);
    if (p.y < Camera.state.horizonY) return;
    var s = p.scale * (Camera.state.w / 900);
    var fade = Math.max(0, Math.min(1, 1.1 - it.z / 70));

    ctx.save();
    ctx.globalAlpha = fade;

    if (it.type === 'laser') {
      // Barrera láser: postes + rayos verticales
      var w = it.w * s;
      var h = it.h * s;
      var off = 0;
      ctx.strokeStyle = 'hsla(330, 100%, 62%, 0.95)';
      ctx.lineWidth = 3 * Camera.state.dpr;
      ctx.shadowColor = 'hsla(330, 100%, 60%, 1)';
      ctx.shadowBlur = 14 * Camera.state.dpr;
      for (off = -w; off <= w; off += w * 0.33) {
        ctx.beginPath();
        ctx.moveTo(p.x + off, p.y + h * 0.5);
        ctx.lineTo(p.x + off, p.y - h * 0.5);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'hsla(258, 50%, 14%, 0.9)';
      ctx.fillRect(p.x - w * 1.08, p.y - h * 0.62, w * 2.16, h * 0.12);
    } else if (it.type === 'pyramid') {
      var w2 = it.w * s;
      var h2 = it.h * s;
      var g = ctx.createLinearGradient(0, p.y - h2 * 0.5, 0, p.y + h2 * 0.5);
      g.addColorStop(0, 'hsla(265, 89%, 66%, 0.85)');
      g.addColorStop(1, 'hsla(258, 60%, 18%, 0.95)');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'hsla(265, 95%, 75%, 0.9)';
      ctx.lineWidth = 1.6 * Camera.state.dpr;
      ctx.shadowColor = 'hsla(265, 89%, 66%, 0.8)';
      ctx.shadowBlur = 12 * Camera.state.dpr;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h2 * 0.55);
      ctx.lineTo(p.x + w2, p.y + h2 * 0.5);
      ctx.lineTo(p.x - w2, p.y + h2 * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Aristas internas wireframe
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h2 * 0.55);
      ctx.lineTo(p.x, p.y + h2 * 0.5);
      ctx.strokeStyle = 'hsla(320, 95%, 70%, 0.5)';
      ctx.stroke();
    } else if (it.type === 'rock') {
      var w3 = it.w * s;
      var h3 = it.h * s;
      ctx.fillStyle = 'hsla(258, 40%, 16%, 0.95)';
      ctx.strokeStyle = 'hsla(18, 92%, 55%, 0.85)';
      ctx.lineWidth = 1.6 * Camera.state.dpr;
      ctx.beginPath();
      ctx.moveTo(p.x - w3, p.y + h3 * 0.5);
      ctx.lineTo(p.x - w3 * 0.55, p.y - h3 * 0.15);
      ctx.lineTo(p.x + w3 * 0.1, p.y - h3 * 0.5);
      ctx.lineTo(p.x + w3 * 0.7, p.y - h3 * 0.05);
      ctx.lineTo(p.x + w3, p.y + h3 * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (it.type === 'orb') {
      // Esfera de energía pulsante
      var r = it.w * s * (1 + 0.12 * Math.sin(time * 6 + it.z));
      var og = ctx.createRadialGradient(p.x, p.y - r * 0.2, r * 0.1, p.x, p.y, r);
      og.addColorStop(0, 'hsla(38, 95%, 70%, 1)');
      og.addColorStop(0.6, 'hsla(38, 92%, 55%, 0.85)');
      og.addColorStop(1, 'hsla(38, 92%, 50%, 0)');
      ctx.fillStyle = og;
      ctx.shadowColor = 'hsla(38, 92%, 55%, 1)';
      ctx.shadowBlur = 16 * Camera.state.dpr;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Anillo
      ctx.strokeStyle = 'hsla(48, 95%, 65%, 0.8)';
      ctx.lineWidth = 1.4 * Camera.state.dpr;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  window.Obstacles = {
    items: items,
    reset: reset,
    update: update,
    collide: collide,
    render: render,
    SPAWN_Z: SPAWN_Z
  };
})();
