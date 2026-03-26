(() => {
  const G = window.BeanGame;
  const { app, refs } = G;

  const audio = {
    ctx: null,
    enabled: true,
    bgmTimer: null,
    bgmStep: 0,
    bgmMode: "collect",
    lastPhrase: -1,
    lastSection: -1
  };

  function playTone(freq, duration = 0.12, type = "square", volume = 0.05, when = 0, attack = 0.01) {
    if (!audio.enabled || !audio.ctx) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(audio.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  function playNoise(duration = 0.08, volume = 0.01, when = 0, attack = 0.005, tone = 1800) {
    if (!audio.enabled || !audio.ctx) return;
    const t0 = audio.ctx.currentTime + when;
    const buffer = audio.ctx.createBuffer(1, Math.max(1, Math.floor(audio.ctx.sampleRate * duration)), audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = audio.ctx.createBufferSource();
    const filter = audio.ctx.createBiquadFilter();
    const gain = audio.ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(tone, t0);
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter).connect(gain).connect(audio.ctx.destination);
    source.start(t0);
    source.stop(t0 + duration + 0.01);
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
    playTone(293, 0.18, "triangle", 0.026);
    playTone(246.94, 0.22, "triangle", 0.022, 0.08);
    playTone(220, 0.28, "sine", 0.018, 0.16);
    playTone(174.61, 0.42, "sine", 0.016, 0.24, 0.03);
  }

  function sfxSuccess() {
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51];
    notes.forEach((n, i) => playTone(n, 0.14 + i * 0.015, i % 2 === 0 ? "triangle" : "sine", 0.026, i * 0.055, 0.02));
    playTone(196, 0.48, "sine", 0.016, 0.02, 0.06);
  }

  function sfxPhaseShift(mode) {
    if (mode === "craft") {
      [392.0, 523.25, 659.25, 783.99].forEach((note, i) => playTone(note, 0.16, "sine", 0.018, i * 0.07, 0.03));
      playTone(196.0, 0.42, "triangle", 0.015, 0.02, 0.05);
      return;
    }
    [329.63, 392.0, 493.88, 587.33].forEach((note, i) => playTone(note, 0.12, "triangle", 0.016, i * 0.055, 0.02));
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

  function currentTheme() {
    const mode = app.phase === "craft" ? "craft" : "collect";
    audio.bgmMode = mode;
    const themes = {
      collect: {
        tempo: app.hardLevel ? 320 : 360,
        stepLength: 16,
        progression: [
          {
            root: 196.0,
            bass: [196.0, null, 293.66, null, 246.94, null, 293.66, 220.0, 196.0, null, 293.66, null, 246.94, null, 220.0, 196.0],
            chord: [293.66, 392.0, 493.88],
            melody: [587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88, 523.25, 659.25, 783.99, 880.0, 783.99, 698.46, 659.25, 587.33, 523.25],
            counter: [392.0, null, 440.0, null, 392.0, null, 369.99, null, 440.0, null, 493.88, null, 440.0, null, 392.0, null],
            pulse: [1, 0, 0.45, 0, 0.7, 0, 0.45, 0, 1, 0, 0.45, 0, 0.8, 0, 0.45, 0],
            drone: 146.83
          },
          {
            root: 220.0,
            bass: [220.0, null, 329.63, null, 277.18, null, 329.63, 246.94, 220.0, null, 329.63, null, 277.18, null, 246.94, 220.0],
            chord: [329.63, 440.0, 523.25],
            melody: [659.25, 698.46, 783.99, 880.0, 783.99, 698.46, 659.25, 587.33, 698.46, 783.99, 880.0, 987.77, 880.0, 783.99, 698.46, 659.25],
            counter: [440.0, null, 493.88, null, 440.0, null, 392.0, null, 493.88, null, 523.25, null, 493.88, null, 440.0, null],
            pulse: [1, 0, 0.45, 0, 0.7, 0, 0.45, 0, 1, 0, 0.45, 0, 0.8, 0, 0.45, 0],
            drone: 164.81
          },
          {
            root: 174.61,
            bass: [174.61, null, 261.63, null, 220.0, null, 261.63, 196.0, 174.61, null, 261.63, null, 220.0, null, 196.0, 174.61],
            chord: [261.63, 349.23, 440.0],
            melody: [523.25, 587.33, 659.25, 587.33, 523.25, 493.88, 440.0, 493.88, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88, 440.0],
            counter: [349.23, null, 392.0, null, 349.23, null, 329.63, null, 392.0, null, 440.0, null, 392.0, null, 349.23, null],
            pulse: [1, 0, 0.42, 0, 0.66, 0, 0.42, 0, 1, 0, 0.42, 0, 0.74, 0, 0.42, 0],
            drone: 130.81
          }
        ]
      },
      craft: {
        tempo: app.hardLevel ? 430 : 480,
        stepLength: 16,
        progression: [
          {
            root: 196.0,
            bass: [196.0, null, null, 246.94, null, null, 220.0, null, 196.0, null, null, 246.94, null, null, 220.0, null],
            chord: [293.66, 392.0, 493.88],
            melody: [392.0, 493.88, 587.33, 659.25, 587.33, 493.88, 440.0, 392.0, 440.0, 493.88, 587.33, 739.99, 659.25, 587.33, 493.88, 440.0],
            counter: [293.66, null, null, 392.0, null, null, 349.23, null, 329.63, null, null, 392.0, null, null, 349.23, null],
            pulse: [0.7, 0, 0.28, 0, 0.5, 0, 0.24, 0, 0.7, 0, 0.28, 0, 0.54, 0, 0.24, 0],
            drone: 146.83
          },
          {
            root: 164.81,
            bass: [164.81, null, null, 220.0, null, null, 196.0, null, 164.81, null, null, 220.0, null, null, 196.0, null],
            chord: [246.94, 329.63, 392.0],
            melody: [392.0, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0, 329.63, 392.0, 440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0],
            counter: [246.94, null, null, 329.63, null, null, 293.66, null, 293.66, null, null, 349.23, null, null, 329.63, null],
            pulse: [0.7, 0, 0.28, 0, 0.5, 0, 0.24, 0, 0.7, 0, 0.28, 0, 0.54, 0, 0.24, 0],
            drone: 123.47
          },
          {
            root: 174.61,
            bass: [174.61, null, null, 220.0, null, null, 261.63, null, 174.61, null, null, 220.0, null, null, 261.63, null],
            chord: [261.63, 349.23, 440.0],
            melody: [440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88, 440.0, 493.88, 523.25, 587.33, 698.46, 659.25, 587.33, 523.25, 493.88],
            counter: [261.63, null, null, 349.23, null, null, 329.63, null, 293.66, null, null, 349.23, null, null, 329.63, null],
            pulse: [0.66, 0, 0.26, 0, 0.46, 0, 0.22, 0, 0.66, 0, 0.26, 0, 0.5, 0, 0.22, 0],
            drone: 130.81
          }
        ]
      }
    };
    return themes[mode];
  }

  function playBgmStep(step) {
    const theme = currentTheme();
    const phrase = theme.progression[Math.floor(step / theme.stepLength) % theme.progression.length];
    const phraseIndex = Math.floor(step / theme.stepLength) % theme.progression.length;
    const sectionIndex = Math.floor(step / (theme.stepLength * theme.progression.length)) % 2;
    const beat = step % theme.stepLength;
    const bass = phrase.bass[beat];
    const lead = phrase.melody[beat];
    const chordTone = phrase.chord[beat % phrase.chord.length];
    const highTone = phrase.chord[(beat + 1) % phrase.chord.length] * 2;
    const counter = phrase.counter?.[beat] || null;
    const enterPhrase = beat === 0 && audio.lastPhrase !== phraseIndex;
    const enterSection = phraseIndex === 0 && beat === 0 && audio.lastSection !== sectionIndex;
    audio.lastPhrase = phraseIndex;
    audio.lastSection = sectionIndex;
    const leadGain = app.phase === "craft" ? 0.011 : 0.014 + (sectionIndex === 1 ? 0.0016 : 0);
    const chordGain = app.phase === "craft" ? 0.012 : 0.014;

    playTone(phrase.drone, theme.tempo / 1000 * 4.6, "sine", app.phase === "craft" ? 0.0048 : 0.0056, 0, 0.12);
    playTone(phrase.root / 2, theme.tempo / 1000 * 2.5, "sine", app.phase === "craft" ? 0.0075 : 0.0088, 0, 0.05);
    playTone(chordTone, theme.tempo / 1000 * 1.9, "triangle", chordGain, 0.04, 0.04);
    if (bass) {
      playTone(bass, theme.tempo / 1000 * 0.9, "triangle", app.phase === "craft" ? 0.018 : 0.022, 0.01, 0.02);
    }
    if (counter) {
      playTone(counter, theme.tempo / 1000 * 0.9, "triangle", app.phase === "craft" ? 0.0072 : 0.0088, 0.23, 0.04);
    }
    if (beat % 2 === 0) {
      playTone(highTone, theme.tempo / 1000 * 0.72, "sine", app.phase === "craft" ? 0.0056 : 0.0076, 0.12, 0.03);
    }
    if (phrase.pulse?.[beat]) {
      playNoise(theme.tempo / 1000 * 0.16, app.phase === "craft" ? 0.0032 * phrase.pulse[beat] : 0.0042 * phrase.pulse[beat], 0.05, 0.004, app.phase === "craft" ? 1250 : 1650);
    }
    playTone(
      lead * (sectionIndex === 1 && beat >= 8 && app.phase === "collect" ? 1.12246 : 1),
      theme.tempo / 1000 * (app.phase === "craft" ? 1.08 : 0.8),
      app.phase === "craft" ? "triangle" : "sine",
      leadGain,
      0.16,
      0.06
    );
    if (enterPhrase) {
      playTone(phrase.chord[0] * 2, theme.tempo / 1000 * 0.6, "sine", 0.006, 0.08, 0.05);
    }
    if (enterSection) {
      playTone(phrase.chord[2] * 2, theme.tempo / 1000 * 0.86, "sine", 0.007, 0.02, 0.08);
      playNoise(theme.tempo / 1000 * 0.2, app.phase === "craft" ? 0.0028 : 0.0038, 0.03, 0.004, app.phase === "craft" ? 1100 : 1800);
    }
  }

  function startBgm() {
    if (!audio.ctx || !audio.enabled || audio.bgmTimer) return;
    const theme = currentTheme();
    playBgmStep(audio.bgmStep++);
    audio.bgmTimer = setInterval(() => {
      if (!audio.enabled) return;
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      playBgmStep(audio.bgmStep++);
    }, theme.tempo);
  }

  function refreshBgm() {
    if (!audio.ctx || !audio.enabled) return;
    stopBgm();
    audio.bgmStep = 0;
    audio.lastPhrase = -1;
    audio.lastSection = -1;
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
    sfxPhaseShift,
    startBgm,
    stopBgm,
    refreshBgm,
    updateSoundButton
  };
})();
