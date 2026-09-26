// Short sound effects generated with the Web Audio API (no audio files needed).
(function (root) {
  'use strict';

  var ctx = null;

  function audio() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, vol) {
    var c = audio();
    if (!c) return;
    var t0 = c.currentTime + start;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  var sounds = {
    correct: function () { tone(660, 0, 0.12, 'triangle'); tone(990, 0.1, 0.18, 'triangle'); },
    // Gentle, not a harsh "fail" buzz.
    wrong: function () { tone(392, 0, 0.18, 'sine', 0.12); tone(330, 0.16, 0.26, 'sine', 0.12); },
    reward: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.11, 0.22, 'triangle', 0.16); });
    },
    tap: function () { tone(880, 0, 0.04, 'sine', 0.05); }
  };

  root.Sound = {
    enabled: true,
    play: function (name) {
      if (!this.enabled || !sounds[name]) return;
      try { sounds[name](); } catch (e) { /* audio not available */ }
    }
  };
})(this);
