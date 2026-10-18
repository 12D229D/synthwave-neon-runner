/* =================================================================
   Synthwave Neon Velocity — vehicle.js
   Vehículo cibernético: 3 carriles con cambio suave (inercia y
   easing), sistema de nitro con consumo/recarga y render del
   coche en pseudo-3D.
   ================================================================= */
(function () {
  'use strict';

  var LANES = [-1, 0, 1]; // posiciones X del mundo

  var state = {
    lane: 1,          // carril actual (0..2)
    laneX: 0,         // X interpolada (unidades mundo)
    targetX: 0,
    nitro: 100,       // 0..100
    nitroActive: false,
    tilt: 0,          // inclinación al girar
    blinkT: 0,        // parpadeo tras choque (invulnerable breve)
    exhaustT: 0
  };

  function reset() {
    state.lane = 1;
    state.laneX = 0;
    state.targetX = 0;
    state.nitro = 100;
    state.nitroActive = false;
    state.tilt = 0;
    state.blinkT = 0;
  }

  function moveLeft() {
    if (state.lane > 0) { state.lane--; state.targetX = LANES[state.lane]; return true; }
    return false;
  }

  function moveRight() {
    if (state.lane < LANES.length - 1) { state.lane++; state.targetX = LANES[state.lane]; return true; }
    return false;
  }

  function setNitro(on) {
    if (on && state.nitro <= 0) return false;
    state.nitroActive = !!on;
    return true;
  }

  /* ---- Actualización física (dt en segundos) ---- */
  function update(dt, speedFactor) {
    // Easing del cambio de carril (lerp exponencial)
    var k = 1 - Math.pow(0.0008, dt);
    state.laneX += (state.targetX - state.laneX) * k;

    // Inclinación proporcional a la velocidad lateral
    state.tilt += ((state.targetX - state.laneX) * 1.4 - state.tilt) * (1 - Math.pow(0.001, dt));

    // Nitro: consumo al activo, recarga pasiva lenta
    if (state.nitroActive) {
      state.nitro -= 26 * dt;
      if (state.nitro <= 0) { state.nitro = 0; state.nitroActive = false; }
      state.exhaustT += dt;
    } else {
      state.nitro = Math.min(100, state.nitro + 7 * dt * (speedFactor || 1));
    }

    if (state.blinkT > 0) state.blinkT -= dt;
  }

  /* ---- Render del coche (triángulo/speeder synthwave) ---- */
  function render(ctx, laneX, scroll, nitroActive) {
    var p = Camera.project(state.laneX, 0, 0.55, laneX);
    var s = p.scale * (Camera.state.w / 900);
    var W = 0.30 * s; // semiancho del coche
    var H = 0.24 * s; // altura

    var blink = state.blinkT > 0 && Math.floor(state.blinkT * 12) % 2 === 0;
    if (blink) return;

    var cx = p.x;
    var cy = p.y;

    ctx.save();

    // Sombra/rejilla glow bajo el coche
    ctx.fillStyle = 'hsla(188, 95%, 60%, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, W * 1.6, H * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Estela del escape (más larga con nitro)
    var trail = nitroActive ? 2.6 : 1.0;
    var flame = ctx.createLinearGradient(cx, cy - H * 0.2, cx, cy + H * trail);
    flame.addColorStop(0, nitroActive ? 'hsla(330, 100%, 65%, 0.9)' : 'hsla(188, 95%, 60%, 0.7)');
    flame.addColorStop(1, 'hsla(265, 89%, 66%, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.42, cy);
    ctx.lineTo(cx + W * 0.42, cy);
    ctx.lineTo(cx + W * 0.16, cy + H * trail * (0.8 + Math.random() * 0.4));
    ctx.lineTo(cx - W * 0.16, cy + H * trail * (0.8 + Math.random() * 0.4));
    ctx.closePath();
    ctx.fill();

    // Cuerpo: trapecio neón
    ctx.translate(cx, cy - H * 0.5);
    ctx.rotate(state.tilt * 0.18);

    var body = ctx.createLinearGradient(0, -H, 0, H);
    body.addColorStop(0, 'hsl(188, 95%, 62%)');
    body.addColorStop(1, 'hsl(265, 89%, 60%)');
    ctx.fillStyle = body;
    ctx.shadowColor = 'hsla(188, 95%, 53%, 0.9)';
    ctx.shadowBlur = 18 * Camera.state.dpr;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.95);          // morro
    ctx.lineTo(W, H * 0.55);           // alerón derecho
    ctx.lineTo(W * 0.55, H * 0.75);
    ctx.lineTo(-W * 0.55, H * 0.75);
    ctx.lineTo(-W, H * 0.55);          // alerón izquierdo
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cabina
    ctx.fillStyle = 'hsla(258, 60%, 12%, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.55);
    ctx.lineTo(W * 0.38, H * 0.35);
    ctx.lineTo(-W * 0.38, H * 0.35);
    ctx.closePath();
    ctx.fill();

    // Luces traseras
    ctx.fillStyle = 'hsl(330, 100%, 65%)';
    ctx.shadowColor = 'hsla(330, 100%, 60%, 1)';
    ctx.shadowBlur = 10 * Camera.state.dpr;
    ctx.fillRect(-W * 0.72, H * 0.45, W * 0.3, H * 0.12);
    ctx.fillRect(W * 0.42, H * 0.45, W * 0.3, H * 0.12);

    ctx.restore();
  }

  window.Vehicle = {
    state: state,
    LANES: LANES,
    reset: reset,
    moveLeft: moveLeft,
    moveRight: moveRight,
    setNitro: setNitro,
    update: update,
    render: render
  };
})();
