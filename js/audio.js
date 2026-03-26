(() => {
  const G = window.BeanGame;
  const { app, refs } = G;

  const audio = {
    ctx: null,
    enabled: true,
    bgmTimer: null,
    bgmStep: 0
  };

  function playTone(freq, duration = 0.12, type = "square", volume = 0.05, when = 0) {
    if (!audio.enabled || !audio.ctx) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(audio.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  function sfxMatch(count) {
    const size = Math.min(5, Math.max(3, count));
    const notes = [392, 523, 659, 784, 988].slice(0, Math.min(5, Math.floor(size / 2) + 2));
    notes.forEach((note, i) => playTone(note, 0.12 + i * 0.015, "triangle", 0.028, i * 0.055));
    playTone(196, 0.24, "sine", 0.02, 0.02);
  }

  function sfxCombo(chain) {
    const motifs = [659, 784, 988, 1174];
    const capped = Math.min(chain, 5);
    for (let i = 0; i < capped; i += 1) {
      const note = motifs[Math.min(i, motifs.length - 1)];
      playTone(note, 0.1, "triangle", 0.032, i * 0.06);
    }
    playTone(220 + capped * 20, 0.22, "sine", 0.018, 0.03);
  }

  function sfxPlace() {
    playTone(523, 0.08, "triangle", 0.025);
    playTone(784, 0.12, "sine", 0.018, 0.05);
  }

  function sfxFail() {
    playTone(293, 0.18, "triangle", 0.03);
    playTone(220, 0.24, "sine", 0.024, 0.08);
    playTone(174, 0.32, "sine", 0.02, 0.16);
  }

  function sfxSuccess() {
    const notes = [523, 659, 784, 988, 1174];
    notes.forEach((n, i) => playTone(n, 0.14, "triangle", 0.03, i * 0.06));
    playTone(196, 0.34, "sine", 0.02, 0.04);
  }

  function sfxHardAlert() {
    playTone(760, 0.09, "square", 0.05);
    playTone(620, 0.09, "square", 0.05, 0.12);
    playTone(760, 0.09, "square", 0.05, 0.24);
  }

  function stopBgm() {
    if (audio.bgmTimer) {
      clearInterval(audio.bgmTimer);
      audio.bgmTimer = null;
    }
  }

  function playBgmStep(step) {
    const progression = app.hardLevel
      ? [
          { bass: 174, chord: [261.63, 311.13, 392.0], pedal: 130.81 },
          { bass: 155.56, chord: [233.08, 293.66, 349.23], pedal: 116.54 },
          { bass: 146.83, chord: [220.0, 261.63, 329.63], pedal: 110.0 },
          { bass: 155.56, chord: [233.08, 293.66, 369.99], pedal: 116.54 }
        ]
      : [
          { bass: 196.0, chord: [293.66, 392.0, 493.88], pedal: 146.83 },
          { bass: 220.0, chord: [329.63, 440.0, 523.25], pedal: 164.81 },
          { bass: 174.61, chord: [261.63, 349.23, 440.0], pedal: 130.81 },
          { bass: 196.0, chord: [293.66, 392.0, 523.25], pedal: 146.83 }
        ];
    const section = progression[Math.floor(step / 4) % progression.length];
    const sub = step % 4;
    const arpIndex = [0, 1, 2, 1][sub];
    const leadNote = section.chord[arpIndex];
    const harmony = section.chord[(arpIndex + 1) % section.chord.length];
    playTone(section.pedal, 0.38, "sine", app.hardLevel ? 0.014 : 0.012);
    playTone(section.bass, 0.22, "triangle", app.hardLevel ? 0.026 : 0.022, 0.02);
    playTone(leadNote, 0.18, "triangle", app.hardLevel ? 0.02 : 0.018, 0.06);
    playTone(harmony * 2, 0.11, "sine", app.hardLevel ? 0.01 : 0.008, 0.16);
  }

  function startBgm() {
    if (!audio.ctx || !audio.enabled || audio.bgmTimer) return;
    playBgmStep(audio.bgmStep++);
    const tempo = app.hardLevel ? 360 : 430;
    audio.bgmTimer = setInterval(() => {
      if (!audio.enabled) return;
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      playBgmStep(audio.bgmStep++);
    }, tempo);
  }

  function refreshBgm() {
    if (!audio.ctx || !audio.enabled) return;
    stopBgm();
    audio.bgmStep = 0;
    startBgm();
  }

  function ensureAudio() {
    if (audio.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    startBgm();
  }

  function updateSoundButton() {
    refs.soundBtn.textContent = audio.enabled ? "音效开" : "音效关";
  }

  G.audio = audio;
  G.audioApi = {
    ensureAudio,
    sfxMatch,
    sfxCombo,
    sfxPlace,
    sfxFail,
    sfxSuccess,
    sfxHardAlert,
    startBgm,
    stopBgm,
    refreshBgm,
    updateSoundButton
  };
})();
