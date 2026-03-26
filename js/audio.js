(() => {
  const G = window.BeanGame;
  const { app, refs } = G;

  const audio = {
    ctx: null,
    enabled: true,
    bgmTimer: null
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
    const n = Math.min(4, Math.max(1, Math.floor(count / 3)));
    const base = 420;
    for (let i = 0; i < n; i += 1) playTone(base + i * 90, 0.09, "square", 0.045, i * 0.045);
  }

  function sfxPlace() {
    playTone(680, 0.06, "square", 0.04);
    playTone(920, 0.08, "triangle", 0.03, 0.04);
  }

  function sfxFail() {
    playTone(280, 0.16, "sawtooth", 0.06);
    playTone(220, 0.24, "square", 0.05, 0.05);
  }

  function sfxSuccess() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => playTone(n, 0.12, "triangle", 0.05, i * 0.07));
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
    const normalBass = [165, 165, 196, 165, 147, 147, 196, 220];
    const normalLead = [659, 784, 659, 587, 659, 523, 587, 494];
    const hardBass = [147, 147, 139, 131, 147, 139, 131, 123];
    const hardLead = [784, 740, 698, 659, 740, 698, 659, 622];
    const bass = app.hardLevel ? hardBass : normalBass;
    const lead = app.hardLevel ? hardLead : normalLead;
    const b = bass[step % bass.length];
    const l = lead[step % lead.length];
    const beat = app.hardLevel ? 0.12 : 0.16;
    const leadDur = app.hardLevel ? 0.08 : 0.1;
    const leadType = app.hardLevel ? "sawtooth" : "triangle";
    playTone(b, beat, "square", app.hardLevel ? 0.038 : 0.03);
    playTone(l, leadDur, leadType, app.hardLevel ? 0.03 : 0.02, app.hardLevel ? 0.02 : 0.035);
  }

  function startBgm() {
    if (!audio.ctx || !audio.enabled || audio.bgmTimer) return;
    let step = 0;
    playBgmStep(step++);
    const tempo = app.hardLevel ? 260 : 380;
    audio.bgmTimer = setInterval(() => {
      if (!audio.enabled) return;
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      playBgmStep(step++);
    }, tempo);
  }

  function refreshBgm() {
    if (!audio.ctx || !audio.enabled) return;
    stopBgm();
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
