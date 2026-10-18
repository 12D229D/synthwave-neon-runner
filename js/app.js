/* =================================================================
   Synthwave Neon Velocity — app.js
   Controlador principal: máquina de estados (Menú, Jugando, Pausa,
   Game Over), game loop, HUD, entrada (teclado + táctil + swipe),
   persistencia de récords en localStorage y sincronización música.
   ================================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('game-canvas');
  var ctx = canvas.getContext('2d');

  var STORE_KEY = 'neon-velocity-records';

  var Game = {
    state: 'menu',        // menu | playing | paused | gameover
    scroll: 0,            // distancia recorrida (unidades mundo)
    speed: 14,            // unidades por segundo
    baseSpeed: 14,
    score: 0,
    combo: 1,
    comboStep: 0,
    distance: 0,
    difficulty: 0,
    lastT: 0,
    raf: null,
    clearEachFrame: true,
    bpmSyncT: 0
  };

  var records = loadRecords();

  /* ------------------------- Persistencia ------------------------- */
  function loadRecords() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : { bestScore: 0, bestDistance: 0 };
    } catch (e) { return { bestScore: 0, bestDistance: 0 }; }
  }

  function saveRecords() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(records)); } catch (e) { /* sin storage */ }
  }

  /* ----------------------------- HUD ------------------------------ */
  function pad(n, len) {
    var s = String(Math.floor(n));
    while (s.length < len) s = '0' + s;
    return s;
  }

  function updateHUD() {
    var kmh = Math.round(Game.speed * 18);
    $('hud-speed').textContent = pad(kmh, 3);
    $('hud-score').textContent = pad(Game.score, 6);
    $('hud-combo').textContent = 'x' + Game.combo;
    var fill = $('nitro-fill');
    fill.style.width = Vehicle.state.nitro + '%';
    fill.classList.toggle('empty', Vehicle.state.nitro <= 0);
    $('nitro-bar').setAttribute('aria-valuenow', Math.round(Vehicle.state.nitro));
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1600);
  }

  /* ----------------------- Gestión de overlays -------------------- */
  function showOverlay(which) {
    $('overlay-menu').classList.toggle('hidden', which !== 'menu');
    $('overlay-pause').classList.toggle('hidden', which !== 'pause');
    $('overlay-gameover').classList.toggle('hidden', which !== 'gameover');
  }

  function refreshMenuStats() {
    $('menu-best-score').textContent = records.bestScore.toLocaleString('es');
    $('menu-best-distance').textContent = records.bestDistance.toFixed(1) + ' km';
  }

  /* --------------------------- Estados ---------------------------- */
  function startGame() {
    Sfx.unlock();
    Vehicle.reset();
    Obstacles.reset();
    Game.state = 'playing';
    Game.scroll = 0;
    Game.speed = Game.baseSpeed;
    Game.score = 0;
    Game.combo = 1;
    Game.comboStep = 0;
    Game.distance = 0;
    Game.difficulty = 0;
    Game.clearEachFrame = true;
    Synth.start(124);
    showOverlay('none');
    toast('¡Acelera!');
  }

  function pauseGame() {
    if (Game.state !== 'playing') return;
    Game.state = 'paused';
    Synth.pause();
    showOverlay('pause');
  }

  function resumeGame() {
    if (Game.state !== 'paused') return;
    Game.state = 'playing';
    Synth.resume();
    showOverlay('none');
    Game.lastT = performance.now();
  }

  function gameOver() {
    Game.state = 'gameover';
    Synth.stop();
    Sfx.crash();
    Camera.shake(0.5, 14);
    var isRecord = Game.score > records.bestScore;
    if (isRecord) records.bestScore = Game.score;
    if (Game.distance > records.bestDistance) records.bestDistance = Game.distance;
    saveRecords();
    $('new-record').classList.toggle('hidden', !isRecord);
    $('final-score').textContent = Game.score.toLocaleString('es');
    $('final-distance').textContent = Game.distance.toFixed(1) + ' km';
    $('best-score').textContent = records.bestScore.toLocaleString('es');
    showOverlay('gameover');
  }

  function toMenu() {
    Game.state = 'menu';
    Synth.stop();
    refreshMenuStats();
    showOverlay('menu');
  }

  /* ---------------------------- Loop ------------------------------ */
  function tick(t) {
    Game.raf = requestAnimationFrame(tick);
    var dt = Math.min((t - Game.lastT) / 1000, 0.05);
    Game.lastT = t;

    if (Game.state === 'playing') {
      update(dt);
    } else if (Game.state === 'menu') {
      // Escena de demostración: la rejilla avanza sola
      Game.scroll += 10 * dt;
    }

    render();
    if (Game.state === 'playing') updateHUD();
  }

  function update(dt) {
    // Dificultad progresiva: velocidad sube, dificultad 0→1
    Game.difficulty = Math.min(1, Game.distance / 12);
    var targetSpeed = Game.baseSpeed + Game.difficulty * 14 + (Vehicle.state.nitroActive ? 10 : 0);
    Game.speed += (targetSpeed - Game.speed) * (1 - Math.pow(0.05, dt));
    if (Vehicle.state.nitroActive) Game.clearEachFrame = false;
    else Game.clearEachFrame = true;

    // Motion blur según velocidad
    Camera.setBlur(Vehicle.state.nitroActive ? 0.8 : Math.max(0, (Game.speed - 24) / 20));

    var dWorld = Game.speed * dt;
    Game.scroll += dWorld;
    Game.distance += dWorld * 0.012; // km ficticios

    // BPM sube con la dificultad (sincronía ritmo-velocidad)
    Game.bpmSyncT += dt;
    if (Game.bpmSyncT > 4) {
      Game.bpmSyncT = 0;
      Synth.setBpm(124 + Game.difficulty * 16);
    }

    Vehicle.update(dt, 1);
    Obstacles.update(dt, Game.speed, Game.scroll, Game.difficulty);

    // Colisiones
    var hits = Obstacles.collide(Vehicle.state.laneX, 1.4, 0.55);
    if (hits.orb) {
      Game.comboStep++;
      Game.combo = Math.min(8, 1 + Math.floor(Game.comboStep / 3));
      Game.score += 50 * Game.combo;
      Sfx.pickup(Game.comboStep % 10);
    }
    if (hits.crash) {
      if (Vehicle.state.blinkT <= 0) {
        Game.score = Math.max(0, Game.score - 120);
        Game.combo = 1; Game.comboStep = 0;
        Vehicle.state.blinkT = 1.1;
        Camera.shake(0.4, 10);
        Sfx.crash();
        Game.speed = Game.baseSpeed;
        toast('¡Choque! -120');
        // No game over inmediato: 3 choques en corto tiempo = fin
        hits.crashCount = (Game.crashStreak = (Game.crashStreak || 0) + 1);
        if (Game.crashStreak >= 3) { gameOver(); return; }
      }
    } else if (Game.scroll - (Game.lastCrashScroll || 0) > 20) {
      Game.crashStreak = 0;
      Game.lastCrashScroll = Game.scroll;
    }
    // Recompensa por distancia viva
    Game.score += Math.round(dWorld * 2 * Game.combo);
  }

  function render() {
    Camera.render(ctx, canvas, {
      scroll: Game.scroll,
      laneX: Vehicle.state.laneX,
      clearEachFrame: Game.clearEachFrame
    });
    Obstacles.render(ctx, Vehicle.state.laneX, performance.now() / 1000);
    Vehicle.render(ctx, Vehicle.state.laneX, Game.scroll, Vehicle.state.nitroActive);
  }

  /* --------------------------- Entradas --------------------------- */
  function bindInputs() {
    document.addEventListener('keydown', function (ev) {
      if (ev.repeat) return;
      var k = ev.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') { Vehicle.moveLeft(); ev.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { Vehicle.moveRight(); ev.preventDefault(); }
      else if (k === ' ' || k === 'shift') {
        ev.preventDefault();
        if (Game.state === 'playing') { if (Vehicle.setNitro(true)) Sfx.nitro(); }
        else if (Game.state === 'menu') startGame();
      }
      else if (k === 'p' || k === 'escape') {
        if (Game.state === 'playing') pauseGame();
        else if (Game.state === 'paused') resumeGame();
      }
      else if (k === 'enter') {
        if (Game.state === 'menu') startGame();
        else if (Game.state === 'gameover') startGame();
        else if (Game.state === 'paused') resumeGame();
      }
    });

    document.addEventListener('keyup', function (ev) {
      var k = ev.key.toLowerCase();
      if (k === ' ' || k === 'shift') Vehicle.setNitro(false);
    });

    // Botones
    $('btn-start').addEventListener('click', startGame);
    $('btn-again').addEventListener('click', startGame);
    $('btn-restart').addEventListener('click', function () { startGame(); });
    $('btn-resume').addEventListener('click', resumeGame);
    $('btn-menu').addEventListener('click', toMenu);
    $('btn-pause').addEventListener('click', function () {
      if (Game.state === 'playing') pauseGame();
      else if (Game.state === 'paused') resumeGame();
    });

    // Pads táctiles
    function bindPad(id, down, up) {
      var el = $(id);
      el.addEventListener('pointerdown', function (ev) { ev.preventDefault(); el.classList.add('active'); down(); });
      el.addEventListener('pointerup', function () { el.classList.remove('active'); up && up(); });
      el.addEventListener('pointerleave', function () { el.classList.remove('active'); up && up(); });
    }
    bindPad('pad-left', Vehicle.moveLeft);
    bindPad('pad-right', Vehicle.moveRight);
    bindPad('pad-nitro', function () { if (Vehicle.setNitro(true)) Sfx.nitro(); }, function () { Vehicle.setNitro(false); });

    // Swipe gestures sobre el canvas
    var touchStartX = null;
    canvas.addEventListener('touchstart', function (ev) {
      touchStartX = ev.touches[0].clientX;
    }, { passive: true });
    canvas.addEventListener('touchend', function (ev) {
      if (touchStartX === null) return;
      var dx = ev.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 24) return;
      if (dx < 0) Vehicle.moveLeft(); else Vehicle.moveRight();
    }, { passive: true });

    // Pausa automática al perder foco
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && Game.state === 'playing') pauseGame();
    });
  }

  /* ---------------- Sincronía visual con la música ---------------- */
  function bindMusicEvents() {
    Synth.on('kick', function () {
      Camera.beatFlash(1);
    });
    Synth.on('snare', function () {
      Camera.beatFlash(0.8);
    });
  }

  /* -------------------------- Bootstrap --------------------------- */
  function init() {
    var resize = function () { Camera.resize(canvas); };
    window.addEventListener('resize', resize);
    resize();

    refreshMenuStats();
    bindInputs();
    bindMusicEvents();

    Game.lastT = performance.now();
    Game.raf = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
