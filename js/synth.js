/* =================================================================
   Synthwave Neon Velocity — synth.js
   Sintetizador synthwave generativo con Web Audio API.
   Secuenciador BPM 120–140: bombo, caja, hi-hat, bajo arpegiado
   y acordes de pad. Callbacks onKick/onSnare para sincronizar
   visuales y spawning con el ritmo.
   ================================================================= */
(function () {
  'use strict';

  // Progresión synthwave (Am – F – C – G) en semitonos relativos a A2
  var PROGRESSION = [
    { root: 45, chord: [0, 3, 7] },   // Am
    { root: 41, chord: [0, 4, 7] },   // F
    { root: 48, chord: [0, 4, 7] },   // C
    { root: 43, chord: [0, 4, 7] }    // G
  ];
  var BASS_PATTERN = [0, 0, 7, 0, 12, 0, 7, 3]; // arpegio por corchea

  var ctx = null;
  var master = null;
  var musicGain = null;
  var lookahead = null;
  var nextNoteTime = 0;
  var step = 0;
  var bar = 0;
  var bpm = 128;
  var playing = false;

  var listeners = { kick: [], snare: [] };
  function emit(kind) {
    (listeners[kind] || []).forEach(function (fn) {
      try { fn(); } catch (e) { /* listener aislado */ }
    });
  }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function ensureContext() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.55;
    musicGain.connect(master);
  }

  /* ---------------------------- Voces ----------------------------- */
  function kick(t) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.25);
  }

  function snare(t) {
    var bufferSize = ctx.sampleRate * 0.2;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1400;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.connect(f); f.connect(g); g.connect(musicGain);
    noise.start(t);

    // Golpe tonal
    var o = ctx.createOscillator();
    var og = ctx.createGain();
    o.frequency.value = 190;
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og); og.connect(musicGain);
    o.start(t); o.stop(t + 0.12);
  }

  function hihat(t, open) {
    var dur = open ? 0.14 : 0.045;
    var n = Math.floor(ctx.sampleRate * dur);
    var buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(f); f.connect(g); g.connect(musicGain);
    noise.start(t);
  }

  function bass(t, midi) {
    var o = ctx.createOscillator();
    var o2 = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sawtooth';
    o2.type = 'square';
    o.frequency.value = midiToFreq(midi);
    o2.frequency.value = midiToFreq(midi - 12);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(musicGain);
    o.start(t); o2.start(t);
    o.stop(t + 0.22); o2.stop(t + 0.22);
  }

  function padChord(t, root, chord) {
    chord.forEach(function (semi, idx) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = idx === 0 ? 'sawtooth' : 'triangle';
      o.frequency.value = midiToFreq(root + 12 + semi);
      o.detune.value = (idx - 1) * 6; // ligero chorus
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.4);
      g.gain.setValueAtTime(0.075, t + 1.5);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.95);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + 2);
    });
  }

  /* -------------------------- Secuenciador ------------------------ */
  function scheduleStep(s, t) {
    var inBar = s % 8;
    // Batería: bombo en 0 y 4; caja en 4; hats en cada corchea
    if (inBar === 0 || inBar === 4) kick(t);
    if (inBar === 4) snare(t);
    if (inBar % 2 === 1) hihat(t, inBar === 7);

    var chord = PROGRESSION[bar % PROGRESSION.length];
    // Bajo arpegiado
    bass(t, chord.root + BASS_PATTERN[inBar] - 12);
    // Pad al inicio de cada compás
    if (inBar === 0) padChord(t, chord.root, chord.chord);
  }

  function tick() {
    if (!playing) return;
    var secondsPerStep = (60 / bpm) / 2; // corcheas
    while (nextNoteTime < ctx.currentTime + 0.12) {
      scheduleStep(step, nextNoteTime);
      // Callbacks de ritmo alineados al momento del golpe
      var inBar = step % 8;
      if (inBar === 0 || inBar === 4) setTimeout(emit.bind(null, 'kick'), Math.max(0, (nextNoteTime - ctx.currentTime) * 1000));
      if (inBar === 4) setTimeout(emit.bind(null, 'snare'), Math.max(0, (nextNoteTime - ctx.currentTime) * 1000));
      nextNoteTime += secondsPerStep;
      step++;
      if (step % 8 === 0) bar++;
    }
    lookahead = setTimeout(tick, 25);
  }

  /* -------------------------- API pública ------------------------- */
  function start(newBpm) {
    ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    if (typeof newBpm === 'number') bpm = Math.min(140, Math.max(120, newBpm));
    step = 0; bar = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    playing = true;
    tick();
    return true;
  }

  function setBpm(newBpm) { bpm = Math.min(140, Math.max(120, newBpm)); }

  function stop() {
    playing = false;
    if (lookahead) { clearTimeout(lookahead); lookahead = null; }
    if (ctx && musicGain) {
      // Apagar suavemente lo ya programado
      var now = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(musicGain.gain.value, now);
      musicGain.gain.linearRampToValueAtTime(0, now + 0.15);
      setTimeout(function () {
        if (musicGain) musicGain.gain.setValueAtTime(0.55, ctx.currentTime);
      }, 200);
    }
  }

  function pause() { stop(); }
  function resume() { if (ctx) { start(); } }

  function on(kind, fn) {
    if (listeners[kind]) listeners[kind].push(fn);
  }

  function isPlaying() { return playing; }
  function getBpm() { return bpm; }

  window.Synth = {
    start: start,
    stop: stop,
    pause: pause,
    resume: resume,
    setBpm: setBpm,
    on: on,
    isPlaying: isPlaying,
    getBpm: getBpm,
    unlock: function () { ensureContext(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  };
})();
