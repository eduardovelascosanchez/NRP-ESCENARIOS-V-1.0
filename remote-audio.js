(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));

  let audioContext = null;
  let audioEnabled = false;
  let beatTimer = null;
  let lastSnapshot = null;
  let toastTimer = null;

  function toast(message) {
    const element = $("audioToast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 2800);
  }

  function getGeneratorWindow() {
    try {
      const shell = $("remoteShell");
      const shellDocument = shell?.contentDocument;
      const generatorFrame = shellDocument?.getElementById("generatorFrame");
      return generatorFrame?.contentWindow || null;
    } catch (_) {
      return null;
    }
  }

  function readSnapshot() {
    try {
      const generatorWindow = getGeneratorWindow();
      const bridge = generatorWindow?.NRPRemoteBridge;
      const snapshot = bridge?.snapshot?.();
      return snapshot && typeof snapshot === "object" ? snapshot : null;
    } catch (_) {
      return null;
    }
  }

  function updateReadout(snapshot) {
    lastSnapshot = snapshot;
    $("audioHr").textContent = snapshot?.hr ?? "—";
    $("audioSpo2").textContent = snapshot?.spo2 ?? "—";

    if (!audioEnabled) {
      $("audioStatus").textContent = snapshot?.live
        ? "Monitor listo. Pulsa “Activar sonido”."
        : "Genera el escenario y abre la simulación en vivo.";
      return;
    }

    if (!snapshot?.live) {
      $("audioStatus").textContent = "Sonido activo; esperando simulación en vivo.";
      return;
    }
    if (!Number.isFinite(Number(snapshot.hr)) || Number(snapshot.hr) <= 0) {
      $("audioStatus").textContent = "Sin pulso detectable: no se emite tono.";
      return;
    }

    const mode = $("soundMode").value;
    if (mode === "spo2") {
      const spo2 = Number(snapshot.spo2);
      $("audioStatus").textContent = Number.isFinite(spo2)
        ? `Oximetría activa: el tono ${spo2 < 85 ? "desciende por saturación baja" : "refleja la SpO₂"}.`
        : "Oximetría activa; SpO₂ todavía no disponible.";
    } else {
      $("audioStatus").textContent = "Tono ECG fijo sincronizado con cada latido.";
    }
  }

  function pulseLamp() {
    const lamp = $("pulseLamp");
    if (!lamp) return;
    lamp.classList.add("beat");
    setTimeout(() => lamp.classList.remove("beat"), 95);
  }

  function oxygenFrequency(spo2) {
    if (!Number.isFinite(spo2)) return 520;
    return clamp(350 + (clamp(spo2, 55, 100) - 55) * 14, 350, 980);
  }

  function playTone(snapshot) {
    if (!audioContext || audioContext.state !== "running") return;
    const mode = $("soundMode").value;
    const spo2 = Number(snapshot?.spo2);
    const frequency = mode === "ecg" ? 780 : oxygenFrequency(spo2);
    const lowOxygen = mode === "spo2" && Number.isFinite(spo2) && spo2 < 85;
    const duration = lowOxygen ? 0.09 : 0.055;
    const volume = clamp(Number($("volumeRange").value) / 100, 0.03, 1);
    const now = audioContext.currentTime;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = lowOxygen ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12 * volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    pulseLamp();
  }

  function stopBeatLoop() {
    if (beatTimer) clearTimeout(beatTimer);
    beatTimer = null;
  }

  function scheduleBeat(delay = 0) {
    stopBeatLoop();
    if (!audioEnabled) return;
    beatTimer = setTimeout(async () => {
      if (!audioEnabled) return;
      if (audioContext?.state === "suspended") {
        try { await audioContext.resume(); } catch (_) {}
      }

      const snapshot = readSnapshot();
      updateReadout(snapshot);
      const hr = Number(snapshot?.hr);

      if (snapshot?.live && Number.isFinite(hr) && hr > 0) {
        playTone(snapshot);
        const interval = clamp(60000 / clamp(hr, 25, 300), 190, 2400);
        scheduleBeat(interval);
      } else {
        scheduleBeat(420);
      }
    }, delay);
  }

  async function enableAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("audio-unsupported");
      if (!audioContext) audioContext = new AudioContextClass();
      await audioContext.resume();
      audioEnabled = true;
      $("soundToggle").textContent = "🔇 Silenciar sonido";
      $("soundToggle").classList.add("on");
      $("soundToggle").classList.remove("error");
      $("soundToggle").setAttribute("aria-pressed", "true");
      scheduleBeat(30);
      toast("Sonido activado. El tono seguirá la FC y el modo seleccionado.");
    } catch (_) {
      audioEnabled = false;
      $("soundToggle").textContent = "⚠ No se pudo activar";
      $("soundToggle").classList.add("error");
      $("audioStatus").textContent = "Abre la página directamente en Safari, Chrome o Edge y vuelve a pulsar.";
      toast("El navegador bloqueó el audio. Abre la página directamente en Safari, Chrome o Edge.");
    }
  }

  function disableAudio() {
    audioEnabled = false;
    stopBeatLoop();
    $("soundToggle").textContent = "🔊 Activar sonido";
    $("soundToggle").classList.remove("on", "error");
    $("soundToggle").setAttribute("aria-pressed", "false");
    $("audioStatus").textContent = "Sonido silenciado.";
    toast("Sonido del monitor silenciado");
  }

  function toggleAudio() {
    if (audioEnabled) disableAudio();
    else enableAudio();
  }

  function savePreferences() {
    try {
      localStorage.setItem("nrpAudioMode", $("soundMode").value);
      localStorage.setItem("nrpAudioVolume", $("volumeRange").value);
    } catch (_) {}
  }

  function restorePreferences() {
    try {
      const mode = localStorage.getItem("nrpAudioMode");
      const volume = localStorage.getItem("nrpAudioVolume");
      if (["spo2", "ecg"].includes(mode)) $("soundMode").value = mode;
      if (volume !== null) $("volumeRange").value = clamp(volume, 5, 100);
    } catch (_) {}
    $("volumeLabel").textContent = `${$("volumeRange").value}%`;
  }

  function bindControls() {
    $("soundToggle").addEventListener("click", toggleAudio);
    $("soundMode").addEventListener("change", () => {
      savePreferences();
      updateReadout(readSnapshot());
      toast($("soundMode").value === "spo2"
        ? "Modo oximetría: el tono cambia con la saturación."
        : "Modo ECG: tono fijo sincronizado con la frecuencia cardiaca.");
    });
    $("volumeRange").addEventListener("input", event => {
      $("volumeLabel").textContent = `${event.target.value}%`;
      savePreferences();
    });
    $("minimizeDock").addEventListener("click", () => {
      $("audioDock").classList.add("hidden");
      $("restoreDock").classList.remove("hidden");
    });
    $("restoreDock").addEventListener("click", () => {
      $("restoreDock").classList.add("hidden");
      $("audioDock").classList.remove("hidden");
    });
  }

  function init() {
    restorePreferences();
    bindControls();
    setInterval(() => updateReadout(readSnapshot()), 600);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && audioEnabled) scheduleBeat(30);
    });
    window.addEventListener("pagehide", stopBeatLoop);
  }

  init();
})();
