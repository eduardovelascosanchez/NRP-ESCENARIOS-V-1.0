(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const ROOM_PATTERN = /^NRP-[A-Z2-9]{6}$/;
  const INSTRUCTOR_PIN = "2026";
  const PEER_SOURCES = [
    "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js",
    "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js"
  ];

  let role = "home";
  let peer = null;
  let connection = null;
  let roomId = "";
  let bridge = null;
  let snapshotTimer = null;
  let connectTimer = null;
  let retryTimer = null;
  let registrationTimer = null;
  let lastSnapshotText = "";
  let lastSnapshotSentAt = 0;
  let latestSnapshot = null;
  let deferredInstallPrompt = null;
  let wakeLock = null;

  function toast(message) {
    const element = $("toast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("show");
    window.setTimeout(() => element.classList.remove("show"), 2600);
  }

  function setScreen(name) {
    role = name;
    $("roleScreen")?.classList.toggle("hidden", name !== "home");
    $("monitorScreen")?.classList.toggle("hidden", name !== "monitor");
    $("instructorScreen")?.classList.toggle("hidden", name !== "instructor");
  }

  function updateUrl(params = {}) {
    const url = new URL(location.href);
    url.search = "";
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    history.replaceState(null, "", url);
  }

  function statusElement(mode) {
    return mode === "monitor" ? $("monitorConnectionStatus") : $("instructorConnectionStatus");
  }

  function setStatus(mode, text, state = "neutral") {
    const element = statusElement(mode);
    if (element) {
      element.textContent = text;
      element.className = `status-badge ${state}`;
    }
    if (mode === "instructor" && $("connectHelp")) $("connectHelp").textContent = text;
  }

  function showMonitorAlert(message, visible = true) {
    const alert = $("monitorAlert");
    if (!alert) return;
    alert.textContent = message;
    alert.classList.toggle("hidden", !visible);
  }

  function isEmbeddedBrowser() {
    const ua = navigator.userAgent || "";
    return /WhatsApp|FBAN|FBAV|Instagram|Line\//i.test(ua) ||
      (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua));
  }

  function randomRoom() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return "NRP-" + [...bytes].map(value => chars[value % chars.length]).join("");
  }

  function clearTimers() {
    if (connectTimer) clearTimeout(connectTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (registrationTimer) clearTimeout(registrationTimer);
    connectTimer = null;
    retryTimer = null;
    registrationTimer = null;
  }

  function friendlyError(error) {
    const type = error?.type || error?.message || "unknown";
    if (type === "peer-unavailable") return "No se encontró el monitor. Verifica el código y mantén abierta la sesión principal.";
    if (type === "unavailable-id") return "El código ya estaba ocupado. Se generará otro automáticamente.";
    if (["network", "server-error", "socket-error", "socket-closed"].includes(type)) return "No fue posible registrar la sesión. Revisa internet y abre la página directamente en Safari, Chrome o Edge.";
    if (type === "browser-incompatible") return "Este navegador no admite el control remoto. Abre el enlace directamente en Safari, Chrome o Edge.";
    if (type === "library-timeout") return "No se pudo cargar el módulo de conexión remota. Revisa internet y vuelve a cargar la página.";
    if (type === "connection-timeout") return "El monitor no respondió. Comprueba que el código siga activo.";
    if (type === "registration-timeout") return "El código se creó, pero no pudo registrarse en el servidor remoto.";
    return `Error de conexión: ${type}`;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.peerjs = "true";
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error("library-timeout"));
      }, 8000);
      script.onload = () => {
        clearTimeout(timer);
        window.Peer ? resolve() : reject(new Error("library-timeout"));
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(new Error("library-timeout"));
      };
      document.head.appendChild(script);
    });
  }

  async function loadPeerJS() {
    if (window.Peer) return;
    document.querySelectorAll('script[data-peerjs="true"]').forEach(node => node.remove());
    let lastError = null;
    for (const source of PEER_SOURCES) {
      try {
        await loadScript(source);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("library-timeout");
  }

  function createPeer(id) {
    const options = {
      debug: 1,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      }
    };
    return id ? new window.Peer(id, options) : new window.Peer(undefined, options);
  }

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch (_) {
      wakeLock = null;
    }
  }

  function buildInstructorLink(id = roomId) {
    const url = new URL("./remote.html", location.href);
    url.searchParams.set("role", "instructor");
    url.searchParams.set("room", id);
    return url.toString();
  }

  async function shareRoom() {
    if (!ROOM_PATTERN.test(roomId)) return;
    const url = buildInstructorLink(roomId);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "NRP Escenarios Remoto · EDUVESA",
          text: `Código de sesión: ${roomId}. PIN del instructor: ${INSTRUCTOR_PIN}`,
          url
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast("Enlace copiado. Compártelo con el instructor.");
      }
    } catch (_) {
      toast("No se pudo compartir automáticamente. Copia el código mostrado.");
    }
  }

  function injectBridge(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc || !frame.contentWindow) throw new Error("frame-unavailable");
      if (frame.contentWindow.NRPRemoteBridge) {
        bridge = frame.contentWindow.NRPRemoteBridge;
        return bridge;
      }

      const script = doc.createElement("script");
      script.textContent = `
(function(){
  if(window.NRPRemoteBridge)return;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)));
  const live=()=>!!document.getElementById("simcard");
  const generated=()=>typeof ULTIMO!=="undefined"&&!!ULTIMO;
  const state=()=>live()&&typeof SIM!=="undefined"&&SIM.estados?SIM.estados[SIM.idx]:null;
  const clockText=seconds=>Math.floor((seconds||0)/60)+":"+String((seconds||0)%60).padStart(2,"0");
  function ensureLive(){
    if(!generated()&&typeof generar==="function")generar();
    if(!live()&&generated()&&typeof abrirSim==="function")abrirSim();
    return live();
  }
  function addRemoteStyle(){
    if(document.getElementById("nrpRemoteBridgeStyle"))return;
    const style=document.createElement("style");
    style.id="nrpRemoteBridgeStyle";
    style.textContent='.nrp-remote-event{position:sticky;top:10px;z-index:50;margin:10px 14px;padding:13px 16px;border-radius:12px;background:#fff2d7;border:2px solid #d99a31;color:#69460a;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.18);animation:nrpEventIn .2s ease}.nrp-remote-event.ok{background:#e6f5eb;border-color:#47a573;color:#185b38}.nrp-remote-event.critical{background:#fde8e5;border-color:#cf5b50;color:#7f251f}@keyframes nrpEventIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}';
    document.head.appendChild(style);
  }
  function notify(text,tone){
    if(!text)return;
    ensureLive();addRemoteStyle();
    const card=document.getElementById("simcard");if(!card)return;
    let box=document.getElementById("nrpRemoteEvent");
    if(!box){box=document.createElement("div");box.id="nrpRemoteEvent";card.prepend(box);}
    box.className="nrp-remote-event "+(tone||"");
    box.textContent=text;
    clearTimeout(window.__nrpRemoteEventTimer);
    window.__nrpRemoteEventTimer=setTimeout(()=>box.remove(),9000);
  }
  function applyVitals(payload){
    if(!ensureLive())return;
    const hr=Number(payload&&payload.hr),spo2=Number(payload&&payload.spo2);
    if(Number.isFinite(hr)){
      SIM.hrTgt=clamp(hr,0,300);
      if(SIM.hrCur==null)SIM.hrCur=SIM.hrTgt;
    }
    if(Number.isFinite(spo2)){
      SIM.spo2Tgt=clamp(spo2,0,100);
      if(SIM.spo2Cur==null)SIM.spo2Cur=SIM.spo2Tgt;
    }
    if(typeof paintVitals==="function")paintVitals(true);
  }
  function setState(index){
    if(!ensureLive())return;
    const next=clamp(Math.round(index),0,Math.max(0,SIM.estados.length-1));
    SIM.idx=next;
    SIM.seconds=Math.max(SIM.seconds||0,SIM.clocks[next]||0);
    const clk=document.getElementById("sim_clk");if(clk)clk.textContent=clockText(SIM.seconds);
    if(typeof simRender==="function")simRender(true);
  }
  function setSecondMonitor(payload){
    if(!ensureLive())return;
    const on=!!payload.on;
    const check=document.getElementById("sim_m2chk");if(check)check.checked=on;
    if(typeof toggleM2==="function"&&!!SIM.m2.on!==on)toggleM2(on);
    if(payload.mode&&document.getElementById("sim_m2mode")){
      document.getElementById("sim_m2mode").value=payload.mode;
      if(typeof setM2Mode==="function")setM2Mode(payload.mode);
    }
    if(Number.isFinite(Number(payload.delta))&&SIM.m2){
      SIM.m2.delta=clamp(payload.delta,0,25);
      const range=document.getElementById("sim_m2delta");if(range)range.value=SIM.m2.delta;
      const label=document.getElementById("sim_m2dv");if(label)label.textContent=SIM.m2.delta+"%";
    }
  }
  function snapshot(){
    const hasGenerated=generated();
    const hasLive=live();
    const current=state();
    const hr=hasLive?(SIM.hrCur??SIM.hrTgt??(current?Number(current.hr):null)):null;
    const spo2=hasLive?(SIM.spo2Cur??SIM.spo2Tgt??(current?Number(current.spo2):null)):null;
    return {
      version:"2.0",
      generated:hasGenerated,
      live:hasLive,
      title:hasGenerated?(ULTIMO.p&&ULTIMO.p.label||"Escenario NRP"):"Sin escenario generado",
      ga:hasGenerated?ULTIMO.ga:null,
      endpoint:hasGenerated?(ULTIMO.p&&ULTIMO.p.endpoint||""):"",
      postnatal:hasGenerated?!!ULTIMO.postnatal:false,
      index:hasLive?SIM.idx:0,
      count:hasLive&&SIM.estados?SIM.estados.length:0,
      seconds:hasLive?SIM.seconds||0:0,
      running:hasLive?!!SIM.running:false,
      auto:hasLive?!!SIM.auto:false,
      hr:Number.isFinite(Number(hr))?Math.round(Number(hr)):null,
      spo2:Number.isFinite(Number(spo2))?Math.round(Number(spo2)):null,
      phase:current&&current.fase||"",
      clinical:document.getElementById("sim_etc")?.textContent||"",
      action:document.getElementById("sim_act")?.textContent||current&&current.accion||"",
      trigger:document.getElementById("sim_trg")?.textContent||current&&current.disparador||"",
      m2:hasLive&&SIM.m2?{on:!!SIM.m2.on,mode:SIM.m2.mode||"ductal",delta:SIM.m2.delta||0}:null,
      met:typeof MET!=="undefined"?{vent:!!MET.vent.on,comp:!!MET.comp.on,rate:MET.vent.rate||40}:null
    };
  }
  window.NRPRemoteBridge={
    snapshot,
    execute(command,payload){
      payload=payload||{};
      switch(command){
        case "generate": if(typeof generar==="function")generar(); break;
        case "random": if(typeof aleatorio==="function")aleatorio(); break;
        case "openLive": ensureLive(); break;
        case "closeLive": if(typeof cerrarSim==="function")cerrarSim(); break;
        case "setRunning": ensureLive(); if(!!payload.running!==!!SIM.running&&typeof simPlay==="function")simPlay(); break;
        case "togglePlay": ensureLive(); if(typeof simPlay==="function")simPlay(); break;
        case "next": ensureLive(); if(typeof simNext==="function")simNext(); break;
        case "prev": ensureLive(); if(typeof simPrev==="function")simPrev(); break;
        case "reset": ensureLive(); if(typeof simResetTimer==="function")simResetTimer(); break;
        case "state": setState(payload.index); break;
        case "auto": ensureLive(); SIM.auto=!!payload.value; {const c=document.getElementById("sim_auto");if(c)c.checked=SIM.auto;} break;
        case "vitals": applyVitals(payload); break;
        case "adjust": {
          ensureLive();
          const current=snapshot();
          const key=payload.key;
          if(key==="hr")applyVitals({hr:(current.hr||0)+Number(payload.delta||0)});
          if(key==="spo2")applyVitals({spo2:(current.spo2||0)+Number(payload.delta||0)});
          break;
        }
        case "event": notify(payload.text,payload.tone); break;
        case "m2": setSecondMonitor(payload); break;
        case "vent": ensureLive(); if(typeof metVent==="function")metVent(); break;
        case "comp": ensureLive(); if(typeof metComp==="function")metComp(); break;
        case "ventRate": ensureLive(); {
          const rate=clamp(payload.rate||40,30,60);
          const range=document.getElementById("met_vrate");if(range)range.value=rate;
          if(typeof metVentRate==="function")metVentRate(rate);
          break;
        }
      }
      return snapshot();
    }
  };
  window.parent.postMessage({type:"nrp-bridge-ready"},location.origin);
})();`;
      doc.body.appendChild(script);
      bridge = frame.contentWindow.NRPRemoteBridge;
      if (!bridge) throw new Error("bridge-not-created");
      showMonitorAlert("Generador listo. Puedes crear la sesión remota antes o después de generar el escenario.", true);
      setTimeout(() => showMonitorAlert("", false), 4500);
      startSnapshotLoop();
      return bridge;
    } catch (error) {
      console.error("No se pudo preparar el puente remoto", error);
      showMonitorAlert("No se pudo activar el control remoto. Recarga esta página directamente en Safari, Chrome o Edge.", true);
      return null;
    }
  }

  function loadGenerator() {
    const frame = $("generatorFrame");
    if (!frame) return;
    bridge = null;
    frame.addEventListener("load", () => {
      window.setTimeout(() => injectBridge(frame), 80);
    }, { once: true });
    frame.src = `./index.html?remote=1&v=2.0&t=${Date.now()}`;
  }

  function getSnapshot() {
    try {
      return bridge?.snapshot?.() || null;
    } catch (error) {
      console.warn("No se pudo leer el estado del monitor", error);
      return null;
    }
  }

  function sendSnapshot(force = false) {
    if (!connection?.open || role !== "monitor") return;
    const snapshot = getSnapshot();
    if (!snapshot) return;
    const text = JSON.stringify(snapshot);
    const now = Date.now();
    if (!force && text === lastSnapshotText && now - lastSnapshotSentAt < 3000) return;
    lastSnapshotText = text;
    lastSnapshotSentAt = now;
    connection.send({ type: "snapshot", snapshot });
  }

  function startSnapshotLoop() {
    if (snapshotTimer) clearInterval(snapshotTimer);
    snapshotTimer = setInterval(() => sendSnapshot(false), 650);
  }

  function runMonitorCommand(command, payload = {}) {
    if (!bridge?.execute) {
      showMonitorAlert("El generador todavía está cargando. Espera unos segundos.", true);
      return null;
    }
    try {
      const snapshot = bridge.execute(command, payload);
      setTimeout(() => sendSnapshot(true), 80);
      return snapshot;
    } catch (error) {
      console.error("Error al ejecutar comando remoto", command, error);
      showMonitorAlert("No se pudo ejecutar la orden remota en el generador.", true);
      return null;
    }
  }

  function attachMonitorConnection(conn) {
    clearTimers();
    if (connection?.open) connection.close();
    connection = conn;
    connectTimer = setTimeout(() => {
      if (!conn.open) {
        try { conn.close(); } catch (_) {}
        setStatus("monitor", friendlyError({ type: "connection-timeout" }), "error");
      }
    }, 14000);

    conn.on("open", () => {
      clearTimers();
      setStatus("monitor", "Instructor conectado", "connected");
      showMonitorAlert("Instructor remoto conectado. El monitor recibirá las modificaciones en tiempo real.", true);
      sendSnapshot(true);
    });
    conn.on("data", data => {
      if (!data || typeof data !== "object") return;
      if (data.type === "command") runMonitorCommand(data.command, data.payload || {});
      if (data.type === "snapshot-request") sendSnapshot(true);
    });
    conn.on("close", () => {
      setStatus("monitor", "Instructor desconectado", "neutral");
      showMonitorAlert("El instructor se desconectó. El código seguirá activo mientras esta página permanezca abierta.", true);
    });
    conn.on("error", error => setStatus("monitor", friendlyError(error), "error"));
  }

  async function createMonitorRoom(attempt = 0) {
    clearTimers();
    if (connection) {
      try { connection.close(); } catch (_) {}
      connection = null;
    }
    if (peer && !peer.destroyed) peer.destroy();

    roomId = randomRoom();
    $("monitorRoomCode").textContent = roomId;
    $("shareRoomBtn").disabled = true;
    setStatus("monitor", `Activando ${roomId}…`, "pending");
    showMonitorAlert(`Código generado: ${roomId}. Activando conexión remota…`, true);

    try {
      await loadPeerJS();
      peer = createPeer(roomId);
    } catch (error) {
      const message = friendlyError(error);
      setStatus("monitor", message, "error");
      showMonitorAlert(message, true);
      return;
    }

    registrationTimer = setTimeout(() => {
      if (!peer?.open) {
        const message = friendlyError({ type: "registration-timeout" });
        setStatus("monitor", message, "error");
        showMonitorAlert(message, true);
      }
    }, 14000);

    peer.on("open", async id => {
      if (registrationTimer) clearTimeout(registrationTimer);
      registrationTimer = null;
      roomId = id;
      $("monitorRoomCode").textContent = id;
      $("shareRoomBtn").disabled = false;
      setStatus("monitor", "Esperando instructor", "waiting");
      showMonitorAlert(`Sesión activa: ${id}. Comparte el enlace y mantén esta pantalla abierta.`, true);
      updateUrl({ role: "monitor", room: id });
      await requestWakeLock();
    });
    peer.on("connection", attachMonitorConnection);
    peer.on("disconnected", () => {
      setStatus("monitor", "Reconectando…", "pending");
      try { peer.reconnect(); } catch (_) {}
    });
    peer.on("error", error => {
      if (registrationTimer) clearTimeout(registrationTimer);
      registrationTimer = null;
      if (error?.type === "unavailable-id" && attempt < 2) {
        retryTimer = setTimeout(() => createMonitorRoom(attempt + 1), 500);
        return;
      }
      const message = friendlyError(error);
      setStatus("monitor", message, "error");
      showMonitorAlert(message, true);
    });
  }

  function attachInstructorConnection(conn) {
    clearTimers();
    connection = conn;
    connectTimer = setTimeout(() => {
      if (!conn.open) {
        try { conn.close(); } catch (_) {}
        setStatus("instructor", friendlyError({ type: "connection-timeout" }), "error");
      }
    }, 14000);

    conn.on("open", () => {
      clearTimers();
      setStatus("instructor", "Conectado al monitor", "connected");
      $("connectCard").classList.add("hidden");
      $("instructorDashboard").classList.remove("hidden");
      conn.send({ type: "snapshot-request" });
      toast("Conexión remota establecida");
    });
    conn.on("data", data => {
      if (data?.type === "snapshot" && data.snapshot) updateInstructorDashboard(data.snapshot);
    });
    conn.on("close", () => {
      setStatus("instructor", "Conexión cerrada", "neutral");
      toast("Se perdió la conexión con el monitor");
    });
    conn.on("error", error => setStatus("instructor", friendlyError(error), "error"));
  }

  function connectAttempt(code, attempt = 0) {
    if (peer && !peer.destroyed) peer.destroy();
    setStatus("instructor", attempt ? `Reintentando ${attempt + 1}/3…` : "Buscando el monitor…", "pending");
    peer = createPeer();
    peer.on("open", () => {
      const conn = peer.connect(code, {
        reliable: true,
        serialization: "json",
        metadata: { role: "instructor", version: "2.0" }
      });
      attachInstructorConnection(conn);
    });
    peer.on("error", error => {
      if (error?.type === "peer-unavailable" && attempt < 2) {
        retryTimer = setTimeout(() => connectAttempt(code, attempt + 1), 1700 * (attempt + 1));
        return;
      }
      setStatus("instructor", friendlyError(error), "error");
    });
  }

  async function connectInstructor() {
    const code = ($("roomInput").value || "").trim().toUpperCase();
    const pin = ($("pinInput").value || "").trim();
    if (!ROOM_PATTERN.test(code)) {
      setStatus("instructor", "Código inválido. Usa el formato NRP-AB12CD.", "error");
      return;
    }
    if (pin !== INSTRUCTOR_PIN) {
      setStatus("instructor", "PIN incorrecto.", "error");
      return;
    }
    if (isEmbeddedBrowser()) toast("Abre el enlace directamente en Safari, Chrome o Edge para una conexión estable.");
    try {
      await loadPeerJS();
      roomId = code;
      updateUrl({ role: "instructor", room: code });
      connectAttempt(code, 0);
    } catch (error) {
      setStatus("instructor", friendlyError(error), "error");
    }
  }

  function sendCommand(command, payload = {}) {
    if (!connection?.open || role !== "instructor") {
      toast("El instructor no está conectado al monitor.");
      return false;
    }
    connection.send({ type: "command", command, payload });
    return true;
  }

  function clockText(seconds = 0) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function updateInstructorDashboard(snapshot) {
    latestSnapshot = snapshot;
    $("remoteScenarioTitle").textContent = snapshot.title || "Sin escenario generado";
    $("remoteScenarioMeta").textContent = snapshot.generated
      ? `RN ${snapshot.ga || "—"} semanas · ${snapshot.endpoint || "escenario NRP"}${snapshot.postnatal ? " · postnatal" : ""}`
      : "Genera un escenario en el monitor para comenzar.";
    $("remotePhase").textContent = snapshot.live ? (snapshot.phase || "Simulación en vivo") : "Simulación no abierta";
    $("remoteClock").textContent = clockText(snapshot.seconds || 0);
    $("remoteHr").textContent = snapshot.hr ?? "—";
    $("remoteSpo2").textContent = snapshot.spo2 ?? "—";
    $("remoteStatePosition").textContent = `${snapshot.count ? snapshot.index + 1 : 0}/${snapshot.count || 0}`;
    $("remoteRunning").textContent = snapshot.running ? "En curso" : "Pausado";
    $("remoteClinical").textContent = snapshot.clinical || "—";
    $("remoteAction").textContent = snapshot.action || "—";
    $("remoteTrigger").textContent = snapshot.trigger || "—";
    $("remotePlayBtn").textContent = snapshot.running ? "⏸ Pausar" : "▶ Iniciar";
    $("remoteOpenLiveBtn").textContent = snapshot.live ? "Simulación abierta" : "Abrir simulación";
    $("autoAdvanceCheck").checked = !!snapshot.auto;
    $("stateRange").max = Math.max(0, (snapshot.count || 1) - 1);
    $("stateRange").value = Math.min(snapshot.index || 0, Number($("stateRange").max));
    $("remotePrevBtn").disabled = !snapshot.live || snapshot.index <= 0;
    $("remoteNextBtn").disabled = !snapshot.live || snapshot.index >= snapshot.count - 1;
    $("remoteCloseLiveBtn").disabled = !snapshot.live;

    if (document.activeElement !== $("hrInput")) $("hrInput").value = snapshot.hr ?? "";
    if (document.activeElement !== $("spo2Input")) $("spo2Input").value = snapshot.spo2 ?? "";

    if (snapshot.m2) {
      $("secondMonitorCheck").checked = !!snapshot.m2.on;
      $("secondMonitorMode").value = snapshot.m2.mode || "ductal";
      $("deltaRange").value = snapshot.m2.delta ?? 10;
      $("deltaLabel").textContent = `${snapshot.m2.delta ?? 10}%`;
    }
    if (snapshot.met) {
      $("ventRateRange").value = snapshot.met.rate || 40;
      $("ventRateLabel").textContent = snapshot.met.rate || 40;
      $("ventMetronomeBtn").textContent = snapshot.met.vent ? "⏸ Detener VPP" : "🫁 VPP";
      $("compMetronomeBtn").textContent = snapshot.met.comp ? "⏸ Detener 3:1" : "🫀 3:1";
    }
  }

  function bindInstructorControls() {
    $("remoteGenerateBtn").addEventListener("click", () => sendCommand("generate"));
    $("remoteRandomBtn").addEventListener("click", () => sendCommand("random"));
    $("remoteOpenLiveBtn").addEventListener("click", () => sendCommand("openLive"));
    $("remotePrevBtn").addEventListener("click", () => sendCommand("prev"));
    $("remoteNextBtn").addEventListener("click", () => sendCommand("next"));
    $("remoteResetBtn").addEventListener("click", () => sendCommand("reset"));
    $("remotePlayBtn").addEventListener("click", () => sendCommand("setRunning", { running: !latestSnapshot?.running }));
    $("stateRange").addEventListener("change", event => sendCommand("state", { index: Number(event.target.value) }));
    $("autoAdvanceCheck").addEventListener("change", event => sendCommand("auto", { value: event.target.checked }));
    $("syncVitalsBtn").addEventListener("click", () => connection?.open && connection.send({ type: "snapshot-request" }));
    $("applyVitalsBtn").addEventListener("click", () => sendCommand("vitals", { hr: Number($("hrInput").value), spo2: Number($("spo2Input").value) }));

    document.querySelectorAll("[data-adjust]").forEach(button => button.addEventListener("click", () => {
      const key = button.dataset.adjust;
      const delta = Number(button.dataset.delta);
      const input = key === "hr" ? $("hrInput") : $("spo2Input");
      const max = key === "hr" ? 300 : 100;
      input.value = Math.min(max, Math.max(0, (Number(input.value) || 0) + delta));
      sendCommand("adjust", { key, delta });
    }));

    document.querySelectorAll("[data-vital-preset]").forEach(button => button.addEventListener("click", () => {
      const [hr, spo2] = button.dataset.vitalPreset.split(",").map(Number);
      $("hrInput").value = hr;
      $("spo2Input").value = spo2;
      sendCommand("vitals", { hr, spo2 });
    }));

    document.querySelectorAll("[data-event]").forEach(button => button.addEventListener("click", () => {
      $("customEvent").value = button.dataset.event;
      sendCommand("event", { text: button.dataset.event, tone: button.textContent.includes("Mejoría") ? "ok" : "critical" });
    }));
    $("sendEventBtn").addEventListener("click", () => {
      const text = $("customEvent").value.trim();
      if (!text) return toast("Escribe el evento que se mostrará en el monitor.");
      sendCommand("event", { text, tone: "" });
    });

    const sendM2 = () => sendCommand("m2", {
      on: $("secondMonitorCheck").checked,
      mode: $("secondMonitorMode").value,
      delta: Number($("deltaRange").value)
    });
    $("secondMonitorCheck").addEventListener("change", sendM2);
    $("secondMonitorMode").addEventListener("change", sendM2);
    $("deltaRange").addEventListener("input", event => $("deltaLabel").textContent = `${event.target.value}%`);
    $("deltaRange").addEventListener("change", sendM2);
    $("ventMetronomeBtn").addEventListener("click", () => sendCommand("vent"));
    $("compMetronomeBtn").addEventListener("click", () => sendCommand("comp"));
    $("ventRateRange").addEventListener("input", event => $("ventRateLabel").textContent = event.target.value);
    $("ventRateRange").addEventListener("change", event => sendCommand("ventRate", { rate: Number(event.target.value) }));
    $("remoteCloseLiveBtn").addEventListener("click", () => sendCommand("closeLive"));
  }

  function destroyConnection() {
    clearTimers();
    if (snapshotTimer) clearInterval(snapshotTimer);
    snapshotTimer = null;
    if (connection) {
      try { connection.close(); } catch (_) {}
      connection = null;
    }
    if (peer && !peer.destroyed) peer.destroy();
    peer = null;
    roomId = "";
    if (wakeLock) {
      try { wakeLock.release(); } catch (_) {}
      wakeLock = null;
    }
  }

  function goHome() {
    destroyConnection();
    setScreen("home");
    updateUrl({});
    const frame = $("generatorFrame");
    if (frame) frame.src = "about:blank";
    $("connectCard").classList.remove("hidden");
    $("instructorDashboard").classList.add("hidden");
    $("monitorRoomCode").textContent = "—";
    $("shareRoomBtn").disabled = true;
    setStatus("monitor", "Sin sesión", "neutral");
    setStatus("instructor", "Desconectado", "neutral");
  }

  function enterMonitor() {
    setScreen("monitor");
    updateUrl({ role: "monitor" });
    loadGenerator();
    if (isEmbeddedBrowser()) showMonitorAlert("Abre esta página directamente en Safari, Chrome o Edge; evita el navegador interno de WhatsApp.", true);
  }

  function enterInstructor(room = "") {
    setScreen("instructor");
    updateUrl({ role: "instructor", room });
    if (room) $("roomInput").value = room.toUpperCase();
    setTimeout(() => (room ? $("pinInput") : $("roomInput")).focus(), 100);
  }

  function setupInstall() {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredInstallPrompt = event;
    });
    $("installAppBtn").addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        return;
      }
      const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      toast(isiOS ? "En Safari: Compartir → Agregar a pantalla de inicio." : "Usa el menú del navegador → Instalar aplicación o Agregar a pantalla principal.");
    });
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw-remote.js").catch(error => console.warn("Service worker", error)));
    }
  }

  function init() {
    $("chooseMonitor").addEventListener("click", enterMonitor);
    $("chooseInstructor").addEventListener("click", () => enterInstructor(""));
    $("chooseLocal").addEventListener("click", () => { location.href = "./index.html"; });
    $("backFromMonitor").addEventListener("click", goHome);
    $("backFromInstructor").addEventListener("click", goHome);
    $("createRoomBtn").addEventListener("click", () => createMonitorRoom());
    $("shareRoomBtn").addEventListener("click", shareRoom);
    $("connectBtn").addEventListener("click", connectInstructor);
    $("roomInput").addEventListener("input", event => {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10);
    });
    $("roomInput").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); $("pinInput").focus(); }
    });
    $("pinInput").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); connectInstructor(); }
    });
    bindInstructorControls();
    setupInstall();

    window.addEventListener("message", event => {
      if (event.origin !== location.origin || event.data?.type !== "nrp-bridge-ready") return;
      const frame = $("generatorFrame");
      if (frame?.contentWindow) bridge = frame.contentWindow.NRPRemoteBridge;
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && role === "monitor" && peer?.disconnected && !peer.destroyed) {
        try { peer.reconnect(); } catch (_) {}
      }
    });

    const params = new URLSearchParams(location.search);
    const requestedRole = params.get("role");
    const requestedRoom = (params.get("room") || "").toUpperCase();
    if (requestedRole === "monitor") enterMonitor();
    else if (requestedRole === "instructor") enterInstructor(requestedRoom);
    else setScreen("home");
  }

  init();
})();
