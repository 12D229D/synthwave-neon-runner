/* =================================================================
   Synthwave Neon Velocity — camera.js
   Proyección pseudo-3D (Mode 7 / Retro Grid Projection) y render
   del fondo synthwave: sol neón, cordillera wireframe, rejilla
   infinita y carriles.
   Paradigma: Procedimental / Event-Driven (módulo con namespace)
   ================================================================= */
(function () {
  'use strict';

  var HORIZON_RATIO = 0.42;   // horizonte al 42% de la altura
  var FOCAL = 320;            // distancia focal (px)
  var ROAD_HALF_W = 1.35;     // semiancho de la carretera (unidades mundo)
  var GRID_STEP = 2;          // separación de líneas transversales (mundo)
  var DRAW_DIST = 90;         // distancia de dibujado en Z

  var state = {
    w: 0, h: 0, dpr: 1,
    horizonY: 0,
    shakeT: 0, shakeMag: 0,
    beatFlash: 0,
    blurLevel: 0
  };

  function resize(canvas) {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    state.w = canvas.width;
    state.h = canvas.height;
    state.dpr = dpr;
    state.horizonY = canvas.height * HORIZON_RATIO;
  }

  /* ---- Proyección: mundo (x, y altura, z profundidad) -> pantalla ---- */
  function project(x, y, z, camX) {
    var dz = Math.max(z - 0.35, 0.02);
    var scale = FOCAL / dz;
    return {
      x: state.w / 2 + (x - camX) * scale * (state.w / 900),
      y: state.horizonY + (1.05 - y) * scale * (state.h / 620),
      scale: scale
    };
  }

  function camX(laneX) { return laneX * 0.62; }

  function shake(t, mag) { state.shakeT = t; state.shakeMag = mag; }
  function beatFlash(v) { state.beatFlash = v; }
  function setBlur(v) { state.blurLevel = v; }

  /* ---------------------- Fondo: cielo + sol ---------------------- */
  function drawSky(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, state.horizonY);
    g.addColorStop(0, 'hsl(262, 62%, 8%)');
    g.addColorStop(0.55, 'hsl(285, 60%, 14%)');
    g.addColorStop(1, 'hsl(320, 65%, 18%)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.w, state.horizonY);

    // Estrellas parpadeantes
    var n = 60;
    ctx.fillStyle = 'hsla(0, 0%, 100%, 0.7)';
    for (var i = 0; i < n; i++) {
      var sx = ((i * 173) % 1000) / 1000 * state.w;
      var sy = ((i * 97) % 1000) / 1000 * state.horizonY * 0.75;
      var tw = 0.35 + 0.3 * Math.sin(Date.now() / 700 + i * 1.7);
      ctx.globalAlpha = Math.max(0.05, tw);
      ctx.fillRect(sx, sy, 2 * state.dpr, 2 * state.dpr);
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(ctx) {
    var r = state.h * 0.16;
    var cx = state.w / 2;
    var cy = state.horizonY - r * 0.25;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    var g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, 'hsl(48, 95%, 62%)');
    g.addColorStop(0.5, 'hsl(18, 92%, 55%)');
    g.addColorStop(1, 'hsl(330, 90%, 52%)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Franjas horizontales del sol retro
    ctx.fillStyle = 'hsla(258, 62%, 8%, 0.9)';
    var bandH = r * 0.075;
    for (var i = 0; i < 6; i++) {
      var by = cy + r * 0.1 + i * bandH * 2.6;
      ctx.fillRect(cx - r, by, r * 2, bandH * (1 + i * 0.35));
    }
    ctx.restore();

    // Halo
    ctx.save();
    ctx.globalAlpha = 0.5 + state.beatFlash * 0.4;
    ctx.shadowColor = 'hsla(18, 92%, 55%, 0.9)';
    ctx.shadowBlur = 60 * state.dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsla(38, 92%, 60%, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- Cordillera wireframe (dos capas) --------------- */
  function drawMountains(ctx) {
    var layers = [
      { h: 0.13, color: 'hsla(285, 70%, 30%, 0.9)', speed: 0.5, z: 12 },
      { h: 0.09, color: 'hsla(320, 75%, 38%, 0.9)', speed: 1, z: 24 }
    ];
    for (var l = 0; l < layers.length; l++) {
      var L = layers[l];
      ctx.beginPath();
      ctx.moveTo(0, state.horizonY);
      var offset = L.speed * (state.scroll || 0) * 0.02;
      for (var x = 0; x <= state.w; x += 10 * state.dpr) {
        var k = (x / state.w) * 12 + offset;
        var y = state.horizonY
          - Math.abs(Math.sin(k) * 0.6 + Math.sin(k * 2.3) * 0.3 + Math.sin(k * 0.5) * 0.5)
          * state.h * L.h * 0.5 - 2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(state.w, state.horizonY);
      ctx.closePath();
      ctx.fillStyle = 'hsl(258, 55%, 7%)';
      ctx.fill();
      ctx.strokeStyle = L.color;
      ctx.lineWidth = 1.2 * state.dpr;
      ctx.stroke();
    }
  }

  /* ------------------- Rejilla infinita + carriles ------------------ */
  function drawGrid(ctx, scroll, laneX) {
    var cx = camX(laneX);

    // Suelo base
    var g = ctx.createLinearGradient(0, state.horizonY, 0, state.h);
    g.addColorStop(0, 'hsl(262, 55%, 6%)');
    g.addColorStop(1, 'hsl(300, 60%, 9%)');
    ctx.fillStyle = g;
    ctx.fillRect(0, state.horizonY, state.w, state.h - state.horizonY);

    // Líneas transversales (espaciado logarítmico según Z)
    var z0 = GRID_STEP - (scroll % GRID_STEP);
    ctx.lineWidth = 1 * state.dpr;
    for (var z = z0; z < DRAW_DIST; z += GRID_STEP) {
      var pL = project(-ROAD_HALF_W, 0, z, cx);
      var pR = project(ROAD_HALF_W, 0, z, cx);
      if (pL.y < state.horizonY + 1) continue;
      var fade = Math.min(1, 1 - z / DRAW_DIST);
      ctx.strokeStyle = 'hsla(320, 95%, 60%, ' + (0.25 * fade + state.beatFlash * 0.2) + ')';
      ctx.beginPath();
      ctx.moveTo(0, pL.y);
      ctx.lineTo(state.w, pL.y);
      ctx.stroke();
    }

    // Bordillos + líneas de carril (longitudinales)
    var lines = [-ROAD_HALF_W, -0.45, 0.45, ROAD_HALF_W];
    for (var i = 0; i < lines.length; i++) {
      var xw = lines[i];
      var pNear = project(xw, 0, 0.4, cx);
      var pFar = project(xw, 0, DRAW_DIST, cx);
      var isEdge = (i === 0 || i === lines.length - 1);
      ctx.strokeStyle = isEdge
        ? 'hsla(188, 95%, 55%, 0.9)'
        : 'hsla(320, 90%, 62%, 0.35)';
      ctx.lineWidth = (isEdge ? 2.6 : 1.2) * state.dpr;
      ctx.shadowColor = isEdge ? 'hsla(188, 95%, 53%, 0.8)' : 'transparent';
      ctx.shadowBlur = isEdge ? 12 * state.dpr : 0;
      ctx.beginPath();
      ctx.moveTo(pNear.x, pNear.y);
      ctx.lineTo(pFar.x, pFar.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawHorizonGlow(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.65 + state.beatFlash * 0.3;
    var g = ctx.createLinearGradient(0, state.horizonY - 26 * state.dpr, 0, state.horizonY + 26 * state.dpr);
    g.addColorStop(0, 'hsla(320, 100%, 60%, 0)');
    g.addColorStop(0.5, 'hsla(320, 100%, 62%, 0.5)');
    g.addColorStop(1, 'hsla(320, 100%, 60%, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, state.horizonY - 26 * state.dpr, state.w, 52 * state.dpr);
    ctx.restore();
  }

  /* ------------------- Render de frame completo --------------------- */
  function render(ctx, canvas, world) {
    var scroll = world.scroll || 0;
    var laneX = world.laneX || 0;
    state.scroll = scroll;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Screen shake
    if (state.shakeT > 0) {
      var s = state.shakeMag * state.shakeT;
      ctx.setTransform(1, 0, 0, 1,
        (Math.random() - 0.5) * s * 2,
        (Math.random() - 0.5) * s * 2);
      state.shakeT = Math.max(0, state.shakeT - 0.016);
    }

    // Motion blur del hyperdrive: rastro semitransparente
    if (state.blurLevel > 0.05 && world.clearEachFrame === false) {
      ctx.fillStyle = 'hsla(258, 55%, 6%, ' + (0.6 - state.blurLevel * 0.45) + ')';
      ctx.fillRect(-50, -50, state.w + 100, state.h + 100);
    } else {
      ctx.clearRect(-50, -50, state.w + 100, state.h + 100);
    }

    drawSky(ctx);
    drawSun(ctx);
    drawMountains(ctx);
    drawGrid(ctx, scroll, laneX);
    drawHorizonGlow(ctx);

    // Decae el destello de beat
    state.beatFlash = Math.max(0, state.beatFlash - 0.06);
    return cx;
  }

  window.Camera = {
    resize: resize,
    project: project,
    camX: camX,
    render: render,
    shake: shake,
    beatFlash: beatFlash,
    setBlur: setBlur,
    ROAD_HALF_W: ROAD_HALF_W,
    state: state
  };
})();
