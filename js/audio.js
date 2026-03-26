(() => {
  const G = window.BeanGame;
  const { app, refs } = G;

  const audio = {
    ctx: null,
    enabled: true,
    bgmTimer: null,
    bgmStep: 0,
    bgmMode: "collect",
    lastPhrase: -1
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
      [392.0, 493.88, 587.33].forEach((note, i) => playTone(note, 0.18, "sine", 0.012, i * 0.09, 0.05));
      playTone(196.0, 0.5, "sine", 0.009, 0.03, 0.08);
      return;
    }
    [329.63, 392.0, 493.88].forEach((note, i) => playTone(note, 0.14, "sine", 0.011, i * 0.08, 0.04));
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
        tempo: app.hardLevel ? 430 : 470,
        stepLength: 16,
        progression: [
          {
            root: 196.0,
            bass: [196.0, null, null, 246.94, null, null, 220.0, null, 196.0, null, null, 246.94, null, null, 220.0, null],
            chord: [293.66, 392.0, 493.88],
            melody: [587.33, null, null, 659.25, null, null, 587.33, null, 523.25, null, null, 659.25, null, null, 587.33, null],
            counter: [392.0, null, null, null, null, null, 392.0, null, null, null, null, 440.0, null, null, null, null],
            drone: 146.83
          },
          {
            root: 174.61,
            bass: [174.61, null, null, 220.0, null, null, 196.0, null, 174.61, null, null, 220.0, null, null, 196.0, null],
            chord: [261.63, 349.23, 440.0],
            melody: [523.25, null, null, 587.33, null, null, 523.25, null, 493.88, null, null, 587.33, null, null, 523.25, null],
            counter: [349.23, null, null, null, null, null, 349.23, null, null, null, null, 392.0, null, null, null, null],
            drone: 130.81
          },
          {
            root: 220.0,
            bass: [220.0, null, null, 277.18, null, null, 246.94, null, 220.0, null, null, 277.18, null, null, 246.94, null],
            chord: [329.63, 440.0, 523.25],
            melody: [659.25, null, null, 698.46, null, null, 659.25, null, 587.33, null, null, 698.46, null, null, 659.25, null],
            counter: [440.0, null, null, null, null, null, 440.0, null, null, null, null, 493.88, null, null, null, null],
            drone: 164.81
          }
        ]
      },
      craft: {
        tempo: app.hardLevel ? 560 : 610,
        stepLength: 16,
        progression: [
          {
            root: 196.0,
            bass: [196.0, null, null, null, 246.94, null, null, null, 220.0, null, null, null, 196.0, null, null, null],
            chord: [293.66, 392.0, 493.88],
            melody: [392.0, null, null, 440.0, null, null, 493.88, null, 440.0, null, null, 392.0, null, null, 349.23, null],
            counter: [293.66, null, null, null, null, null, 349.23, null, null, null, null, null, null, null, 293.66, null],
            drone: 146.83
          },
          {
            root: 164.81,
            bass: [164.81, null, null, null, 220.0, null, null, null, 196.0, null, null, null, 164.81, null, null, null],
            chord: [246.94, 329.63, 392.0],
            melody: [329.63, null, null, 392.0, null, null, 440.0, null, 392.0, null, null, 329.63, null, null, 293.66, null],
            counter: [246.94, null, null, null, null, null, 293.66, null, null, null, null, null, null, null, 246.94, null],
            drone: 123.47
          },
          {
            root: 174.61,
            bass: [174.61, null, null, null, 220.0, null, null, null, 261.63, null, null, null, 220.0, null, null, null],
            chord: [261.63, 349.23, 440.0],
            melody: [440.0, null, null, 493.88, null, null, 523.25, null, 493.88, null, null, 440.0, null, null, 392.0, null],
            counter: [261.63, null, null, null, null, null, 329.63, null, null, null, null, null, null, null, 261.63, null],
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
    const beat = step % theme.stepLength;
    const bass = phrase.bass[beat];
    const lead = phrase.melody[beat];
    const chordTone = phrase.chord[beat % phrase.chord.length];
    const counter = phrase.counter?.[beat] || null;
    const enterPhrase = beat === 0 && audio.lastPhrase !== phraseIndex;
    audio.lastPhrase = phraseIndex;
    const leadGain = app.phase === "craft" ? 0.0076 : 0.0102;
    const chordGain = app.phase === "craft" ? 0.007 : 0.009;

    playTone(phrase.drone, theme.tempo / 1000 * 5.2, "sine", app.phase === "craft" ? 0.0036 : 0.0046, 0, 0.18);
    playTone(phrase.root / 2, theme.tempo / 1000 * 2.8, "sine", app.phase === "craft" ? 0.0054 : 0.0068, 0, 0.1);
    playTone(chordTone, theme.tempo / 1000 * 2.3, "sine", chordGain, 0.04, 0.08);
    if (bass) {
      playTone(bass, theme.tempo / 1000 * 1.2, "triangle", app.phase === "craft" ? 0.009 : 0.011, 0.06, 0.05);
    }
    if (counter) {
      playTone(counter, theme.tempo / 1000 * 1.1, "sine", app.phase === "craft" ? 0.0048 : 0.0058, 0.28, 0.08);
    }
    if (lead) {
      playTone(lead, theme.tempo / 1000 * (app.phase === "craft" ? 1.7 : 1.25), "sine", leadGain, 0.18, 0.12);
    }
    if (enterPhrase) {
      playTone(phrase.chord[0] * 2, theme.tempo / 1000 * 0.9, "sine", 0.0048, 0.1, 0.12);
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
