/* =================================================================
   Synthwave Neon Velocity — audio.js
   Efectos de sonido: choque (crash), turbo (nitro) y recolección
   de esferas (pickup). Web Audio API, sin ficheros externos.
   ================================================================= */
(function () {
  'use strict';

  var ctx = null;
  var master = null;

  function ensureContext() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    return true;
  }

  function unlock() {
    if (ensureContext() && ctx.state === 'suspended') ctx.resume();
  }

  /* ---------------- Choque: ruido + barrido descendente ------------ */
  function crash() {
    if (!ensureContext()) return;
    var t = ctx.currentTime;

    var n = Math.floor(ctx.sampleRate * 0.5);
    var buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.6);
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(140, t + 0.45);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.85, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    noise.connect(f); f.connect(g); g.connect(master);
    noise.start(t);

    var o = ctx.createOscillator();
    var og = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
    og.gain.setValueAtTime(0.4, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(og); og.connect(master);
    o.start(t); o.stop(t + 0.45);
  }

  /* ---------------- Turbo: barrido ascendente + shimmer ----------- */
  function nitro() {
    if (!ensureContext()) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.6);
  }

  /* ---------------- Pickup: blip pentatónico ascendente ----------- */
  function pickup(comboStep) {
    if (!ensureContext()) return;
    var t = ctx.currentTime;
    // Escala pentatónica: cada combo sube el tono
    var scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
    var semi = scale[Math.min(comboStep || 0, scale.length - 1)];
    var freq = 660 * Math.pow(2, semi / 12);

    var o = ctx.createOscillator();
    var o2 = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'triangle';
    o2.type = 'sine';
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.5;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); o2.connect(g); g.connect(master);
    o.start(t); o2.start(t);
    o.stop(t + 0.18); o2.stop(t + 0.18);
  }

  /* ---------------- UI click suave ---------------- */
  function click() {
    if (!ensureContext()) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.1);
  }

  window.Sfx = {
    unlock: unlock,
    crash: crash,
    nitro: nitro,
    pickup: pickup,
    click: click
  };
})();
