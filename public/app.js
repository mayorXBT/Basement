const nicheOptions = [["general", "General", "✦"], ["personal-finance", "Personal finance", "◒"], ["entrepreneurship", "Entrepreneurship", "↗"], ["startups", "Startups", "⟁"], ["tech-ai", "Tech / AI", "⌬"], ["fitness", "Fitness", "◉"], ["nutrition", "Nutrition", "◈"], ["productivity", "Productivity", "◷"], ["history", "History", "◫"], ["literature", "Literature", "❖"]];
const els = {
  modeOptions: [...document.querySelectorAll("[data-mode]")], modeDescription: document.querySelector("#mode-description"), nicheControl: document.querySelector("#niche-control"), nicheSelect: document.querySelector("#niche-select"), nicheButton: document.querySelector("#niche-button"), nicheMenu: document.querySelector("#niche-menu"), nicheLabel: document.querySelector("#niche-label"), nicheIcon: document.querySelector("#niche-icon"), spin: document.querySelector("#spin-button"), timer: document.querySelector("#timer-button"), timerLabel: document.querySelector("#timer-button-label"), topic: document.querySelector("#topic-text"), source: document.querySelector("#topic-source"), session: document.querySelector("#session-label"), panel: document.querySelector("#timer-panel"), phase: document.querySelector("#timer-phase"), display: document.querySelector("#timer-display"), ringProgress: document.querySelector("#timer-ring-progress"), timerTopic: document.querySelector("#timer-topic"), waveform: document.querySelector("#waveform-canvas"), waveformDot: document.querySelector("#waveform-dot"), waveformLabel: document.querySelector("#waveform-label"), waveformLevel: document.querySelector("#waveform-level"), timerControl: document.querySelector("#timer-modal-control"), timerClose: document.querySelector("#timer-close"), status: document.querySelector("#timer-status"), reset: document.querySelector("#reset-button"), analysisButton: document.querySelector("#analysis-button"), analysisModal: document.querySelector("#analysis-modal"), closeAnalysis: document.querySelector("#close-analysis"), confetti: document.querySelector("#confetti-canvas"), modal: document.querySelector("#settings-modal"), openSettings: document.querySelector("#settings-button"), closeSettings: document.querySelector("#close-settings"), saveSettings: document.querySelector("#save-settings"), speech: document.querySelector("#speech-duration"), speechValue: document.querySelector("#speech-duration-value"), research: document.querySelector("#research-duration"), researchValue: document.querySelector("#research-duration-value"), mute: document.querySelector("#mute-sounds"), analysisSummary: document.querySelector("#analysis-summary"), analysisTranscript: document.querySelector("#analysis-transcript"), fillerCount: document.querySelector("#analysis-filler-count"), pauseCount: document.querySelector("#analysis-pause-count"), wordCount: document.querySelector("#analysis-word-count"), pitchRange: document.querySelector("#analysis-pitch-range"), strengths: document.querySelector("#analysis-strengths"), improvements: document.querySelector("#analysis-improvements")
};
const SETTINGS_KEY = "unprompted-mission-settings";
const modeCopy = { "off-the-cuff": "Minimal prep. Try to think quick on your feet.", "deep-research": "Spin a topic, set a research timer, then start the speech timer whenever you're ready." };
const defaultSettings = { speechMinutes: 1, researchMinutes: 10, muted: false };
let storedSettings = null; try { storedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null"); } catch { storedSettings = null; }
const metricEls = {
  clarity: document.querySelector("#metric-clarity"), confidence: document.querySelector("#metric-confidence"), filler: document.querySelector("#metric-filler"), wpm: document.querySelector("#metric-wpm"),
  clarityBar: document.querySelector("#bar-clarity"), confidenceBar: document.querySelector("#bar-confidence"), fillerBar: document.querySelector("#bar-filler"), wpmBar: document.querySelector("#bar-wpm"),
  clarityDetail: document.querySelector("#detail-clarity"), confidenceDetail: document.querySelector("#detail-confidence"), fillerDetail: document.querySelector("#detail-filler"), wpmDetail: document.querySelector("#detail-wpm")
};
const state = { mode: "off-the-cuff", niche: "general", topic: "", phase: "idle", remaining: 0, total: 0, interval: null, settings: { ...defaultSettings, ...(storedSettings || {}) }, recording: null, analysis: null, topicHistory: [] };
const spinTopics = ["The art of making mistakes", "A room with no windows", "The last good surprise", "Rules worth breaking", "A story you tell yourself", "The quietest person in the room", "What makes a place feel like home", "The useful detour"];

function formatTime(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`; }
function chirp(frequency = 440, duration = .08) {
  if (state.settings.muted) return;
  try { const context = new (window.AudioContext || window.webkitAudioContext)(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = frequency; oscillator.type = "sine"; gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.05, context.currentTime + .01); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration + .02); } catch { /* Sound is an enhancement. */ }
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function completionSound() {
  if (state.settings.muted) return;
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const now = context.currentTime;
    [523, 659, 784, 1046].forEach((frequency, index) => {
      const oscillator = context.createOscillator(); const gain = context.createGain(); const start = now + index * .09;
      oscillator.type = "sine"; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.07, start + .015); gain.gain.exponentialRampToValueAtTime(.0001, start + .18); oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + .2);
    });
  } catch { /* Sound is an enhancement. */ }
}
function fireConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = els.confetti; const context = canvas.getContext("2d"); if (!context) return;
  const scale = window.devicePixelRatio || 1; const width = window.innerWidth; const height = window.innerHeight;
  canvas.width = width * scale; canvas.height = height * scale; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; context.setTransform(scale, 0, 0, scale, 0, 0);
  const colors = ["#a080c0", "#d7b8f3", "#800080", "#f2eaff"]; const pieces = Array.from({ length: 88 }, (_, index) => ({ x: width * .5 + (Math.random() - .5) * 80, y: height * .46, vx: (Math.random() - .5) * 8, vy: -Math.random() * 8 - 3, width: Math.random() * 7 + 3, height: Math.random() * 12 + 5, rotation: Math.random() * 6, spin: (Math.random() - .5) * .3, color: colors[index % colors.length], opacity: 1 }));
  const started = performance.now();
  function draw(now) {
    const elapsed = now - started; context.clearRect(0, 0, width, height);
    pieces.forEach((piece) => { piece.x += piece.vx; piece.y += piece.vy; piece.vy += .16; piece.rotation += piece.spin; piece.opacity = clamp(1 - elapsed / 1900, 0, 1); context.save(); context.globalAlpha = piece.opacity; context.translate(piece.x, piece.y); context.rotate(piece.rotation); context.fillStyle = piece.color; context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height); context.restore(); });
    if (elapsed < 2000) window.requestAnimationFrame(draw); else context.clearRect(0, 0, width, height);
  }
  window.requestAnimationFrame(draw);
}
function setWaveformState(label, level = "--") { els.waveformLabel.textContent = label; els.waveformLevel.textContent = level; els.waveformLabel.classList.toggle("is-live", label === "MIC LIVE"); els.waveformDot.classList.toggle("is-live", label === "MIC LIVE"); }
function clearWaveform() { const context = els.waveform.getContext("2d"); if (context) context.clearRect(0, 0, els.waveform.width, els.waveform.height); }
function estimatePitch(samples, sampleRate) {
  const minLag = Math.max(2, Math.floor(sampleRate / 450)); const maxLag = Math.min(samples.length - 2, Math.floor(sampleRate / 70)); if (maxLag <= minLag) return 0;
  let runningDifference = 0; let bestLag = 0; let bestScore = Infinity;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let difference = 0;
    for (let index = 0; index < samples.length - lag; index += 1) { const first = (samples[index] - 128) / 128; const second = (samples[index + lag] - 128) / 128; const delta = first - second; difference += delta * delta; }
    runningDifference += difference; const score = runningDifference ? difference * lag / runningDifference : 1;
    if (score < bestScore) { bestScore = score; bestLag = lag; }
    if (lag > minLag && score < .12) { bestLag = lag; break; }
  }
  const pitch = bestLag ? sampleRate / bestLag : 0; return bestScore < .55 && pitch >= 70 && pitch <= 450 ? Math.round(pitch) : 0;
}
function drawWaveform(samples, active) {
  const canvas = els.waveform; const context = canvas.getContext("2d"); if (!context) return; const width = canvas.width; const height = canvas.height; context.clearRect(0, 0, width, height); const bars = 15; const barWidth = 10; const gap = 12; const totalWidth = bars * barWidth + (bars - 1) * gap; const startX = (width - totalWidth) / 2;
  for (let index = 0; index < bars; index += 1) { const from = Math.floor(index * samples.length / bars); const to = Math.max(from + 1, Math.floor((index + 1) * samples.length / bars)); let energy = 0; for (let sampleIndex = from; sampleIndex < to; sampleIndex += 1) { const centered = (samples[sampleIndex] - 128) / 128; energy += centered * centered; } const rms = Math.sqrt(energy / (to - from)); const barHeight = active ? clamp(8 + rms * 260, 6, height - 8) : 5; const x = startX + index * (barWidth + gap); const y = (height - barHeight) / 2; context.fillStyle = active ? "#a080c0" : "rgba(160, 128, 192, .3)"; context.beginPath(); if (typeof context.roundRect === "function") context.roundRect(x, y, barWidth, barHeight, barWidth / 2); else context.rect(x, y, barWidth, barHeight); context.fill(); }
}
function newRecording() { let resolveBlob; const blobReady = new Promise((resolve) => { resolveBlob = resolve; }); return { active: true, paused: false, token: Symbol("recording"), stream: null, mediaRecorder: null, chunks: [], blobReady, resolveBlob, recognition: null, audioContext: null, analyser: null, audioFrame: null, lastSampleAt: 0, silenceStartedAt: null, hasHeardVoice: false, pauses: 0, speakingMs: 0, timerSeconds: 0, pitchSum: 0, pitchCount: 0, pitchMin: 0, pitchMax: 0, transcript: "", error: "", transcriptionProvider: "browser" }; }
const recorderMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"];
function isIosBrowser() { // SpeechRecognition plus MediaRecorder on one WebKit mic stream fails.
  const ua = navigator.userAgent || "";
  return /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function pickRecorderMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) return "";
  return recorderMimeTypes.find((type) => { try { return MediaRecorder.isTypeSupported(type); } catch { return false; } }) || "";
}
function microphoneErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "Microphone access was denied.";
  if (error?.name === "NotFoundError") return "No microphone was found.";
  if (error?.name === "NotReadableError") return "The microphone is in use by another app.";
  if (error?.name === "SecurityError") return "Microphone access needs HTTPS.";
  return "Microphone access is unavailable.";
}
function startAudioMonitor(recording) {
  if (!recording.analyser) return;
  const samples = new Uint8Array(recording.analyser.fftSize);
  const sample = (now) => {
    if (!recording.active || !recording.analyser) return;
    recording.analyser.getByteTimeDomainData(samples); let sum = 0; for (const value of samples) { const centered = (value - 128) / 128; sum += centered * centered; }
    const rms = Math.sqrt(sum / samples.length); const audible = rms > .035; const pitch = audible ? estimatePitch(samples, recording.audioContext?.sampleRate || 48000) : 0; if (pitch) { recording.pitchSum += pitch; recording.pitchCount += 1; recording.pitchMin = recording.pitchMin ? Math.min(recording.pitchMin, pitch) : pitch; recording.pitchMax = Math.max(recording.pitchMax, pitch); } drawWaveform(samples, audible); setWaveformState(audible ? "MIC LIVE" : "LISTENING", pitch ? `${pitch} Hz` : "--"); if (recording.lastSampleAt && audible) recording.speakingMs += now - recording.lastSampleAt;
    if (audible) { if (recording.silenceStartedAt && now - recording.silenceStartedAt >= 900 && recording.hasHeardVoice) recording.pauses += 1; recording.hasHeardVoice = true; recording.silenceStartedAt = null; } else if (!recording.silenceStartedAt) recording.silenceStartedAt = now;
    recording.lastSampleAt = now; recording.audioFrame = window.requestAnimationFrame(sample);
  };
  recording.audioFrame = window.requestAnimationFrame(sample);
}
function startRecognition(recording) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Recognition) return;
  const recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = false; recognition.lang = "en-US";
  recognition.onresult = (event) => { recording.transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim(); };
  recognition.onend = () => { if (recording.active && !recording.paused && state.recording === recording && recording.recognition === recognition) { try { recognition.start(); } catch { /* The browser may already be restarting recognition. */ } } };
  recording.recognition = recognition; try { recognition.start(); } catch { /* Speech recognition is optional. */ }
}
async function startRecording() {
  stopRecording(); const recording = newRecording(); state.recording = recording;
  if (!navigator.mediaDevices?.getUserMedia) { recording.error = "Microphone access is unavailable in this browser."; recording.resolveBlob(null); setWaveformState("MIC UNAVAILABLE"); return; }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) { recording.audioContext = new AudioContextClass(); recording.audioContext.resume().catch(() => {}); }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (error) {
    recording.error = microphoneErrorMessage(error); recording.resolveBlob(null); setWaveformState("MIC UNAVAILABLE"); els.status.textContent = recording.error;
    if (recording.audioContext) recording.audioContext.close().catch(() => {}); recording.audioContext = null; return;
  }
  if (state.recording !== recording || !recording.active || state.phase !== "speech") { stream.getTracks().forEach((track) => track.stop()); if (recording.audioContext) recording.audioContext.close().catch(() => {}); return; }
  recording.stream = stream;
  if (!isIosBrowser()) startRecognition(recording);
  if (window.MediaRecorder) {
    try {
      const mimeType = pickRecorderMimeType();
      recording.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recording.mediaRecorder.ondataavailable = (event) => { if (event.data.size) recording.chunks.push(event.data); };
      recording.mediaRecorder.onstop = () => { recording.resolveBlob(recording.chunks.length ? new Blob(recording.chunks, { type: recording.mediaRecorder.mimeType || mimeType || "audio/webm" }) : null); };
      try { recording.mediaRecorder.start(1000); } catch { recording.mediaRecorder.start(); }
    } catch { recording.error = "This browser could not start an audio recorder."; recording.resolveBlob(null); }
  } else recording.resolveBlob(null);
  if (recording.audioContext) {
    if (recording.audioContext.state === "suspended") recording.audioContext.resume().catch(() => {});
    try {
      const source = recording.audioContext.createMediaStreamSource(stream);
      recording.analyser = recording.audioContext.createAnalyser(); recording.analyser.fftSize = 512; source.connect(recording.analyser); startAudioMonitor(recording);
    } catch { /* Waveform is optional. */ }
  }
  setWaveformState("MIC LIVE", "LISTENING"); els.status.textContent = "Recording locally. The clock starts when you do.";
}
function pauseRecording() {
  const recording = state.recording; if (!recording) return; recording.paused = true; setWaveformState("MIC PAUSED");
  try { if (recording.mediaRecorder?.state === "recording") recording.mediaRecorder.pause(); } catch { /* Safari may not pause MediaRecorder. */ }
  if (recording.audioContext?.state === "running") recording.audioContext.suspend().catch(() => {});
  const recognition = recording.recognition; recording.recognition = null; if (recognition) { try { recognition.stop(); } catch { /* Optional browser API. */ } }
}
function resumeRecording() {
  const recording = state.recording; if (!recording) return; recording.paused = false; setWaveformState("MIC LIVE", "LISTENING");
  try { if (recording.mediaRecorder?.state === "paused") recording.mediaRecorder.resume(); } catch { /* Safari may not resume MediaRecorder. */ }
  if (recording.audioContext?.state === "suspended") recording.audioContext.resume().catch(() => {});
  if (!isIosBrowser()) startRecognition(recording);
}
function stopRecording() { const recording = state.recording; if (!recording) return null; recording.active = false; setWaveformState("MIC OFF"); clearWaveform(); if (recording.audioFrame) window.cancelAnimationFrame(recording.audioFrame); if (recording.recognition) { try { recording.recognition.abort(); } catch { /* Optional browser API. */ } } if (recording.mediaRecorder?.state && recording.mediaRecorder.state !== "inactive") { try { recording.mediaRecorder.stop(); } catch { recording.resolveBlob(null); /* Optional browser API. */ } } else if (!recording.chunks.length) recording.resolveBlob(null); recording.stream?.getTracks().forEach((track) => track.stop()); if (recording.audioContext) recording.audioContext.close().catch(() => {}); state.recording = null; return recording; }
function countWords(text) { return (text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []).length; }
function countFillers(text) { return (text.match(/\b(?:um+|uh+|er+|like|you know|basically|actually|literally|sort of|kind of)\b/gi) || []).length; }
function buildCoachingInsights({ transcript, words, fillers, pauses, wpm, speakingRatio, pitchRange, hasSignal }) {
  if (!hasSignal) {
    return {
      strengths: ["The session was completed, but no spoken audio was captured to evaluate."],
      improvements: ["Allow microphone access and speak naturally for the full timer so Basement can coach the delivery."]
    };
  }
  if (!words) {
    return {
      strengths: ["The microphone detected a live speaking signal."],
      improvements: ["Make sure the mic is close enough to hear your words, then speak in complete thoughts so the transcript can be coached."]
    };
  }
  const strengths = [];
  const improvements = [];
  const fillerRate = fillers / words;
  if (fillers === 0) strengths.push(`Used no detected filler words across ${words} spoken words.`);
  else if (fillerRate <= .04) strengths.push(`Kept filler words limited to ${fillers} across ${words} spoken words.`);
  if (wpm >= 120 && wpm <= 160) strengths.push(`Held an easy-to-follow speaking pace at ${wpm} WPM.`);
  else if (wpm >= 100 && wpm <= 175) strengths.push(`Stayed within a workable speaking range at ${wpm} WPM.`);
  if (speakingRatio >= 55) strengths.push(`Used the floor consistently, speaking for about ${speakingRatio}% of the session.`);
  if (pitchRange >= 35) strengths.push(`Used natural vocal variation across roughly ${pitchRange} Hz of detected pitch.`);
  if (words >= 45) strengths.push(`Gave enough spoken material to make the delivery patterns clear.`);
  if (!strengths.length) strengths.push("Produced a usable transcript for a focused delivery review.");

  if (fillers > 0) improvements.push(`Replace ${fillers === 1 ? "the detected filler word" : `${fillers} filler words`} with a silent breath before the next sentence.`);
  if (wpm > 175) improvements.push(`Slow the next take toward 120–160 WPM so key words have room to land.`);
  else if (wpm > 0 && wpm < 100) improvements.push(`Build more momentum and aim for 120–160 WPM instead of stretching the pauses between ideas.`);
  if (pauses >= 3) improvements.push(`Turn the ${pauses} long pauses into shorter beats by deciding your next point before you finish the current one.`);
  if (words < 45) improvements.push("Develop the answer with one concrete example and a closing sentence.");
  if (speakingRatio > 0 && speakingRatio < 45) improvements.push(`Use more of the timer to develop the answer; only about ${speakingRatio}% contained audible speech.`);
  if (pitchRange > 0 && pitchRange < 18) improvements.push("Give the key phrase a little more pitch contrast so the main idea does not sound flat.");
  if (!improvements.length) improvements.push("Add one concrete example and a crisp closing sentence to make the next answer more memorable.");
  return { strengths: strengths.slice(0, 3), improvements: improvements.slice(0, 3) };
}
function buildAnalysis(recording) {
  const transcript = recording?.transcript || ""; const words = countWords(transcript); const fillers = countFillers(transcript); const seconds = Math.max(1, recording?.timerSeconds || state.settings.speechMinutes * 60); const wpm = words ? Math.round(words / (seconds / 60)) : 0; const hasSignal = Boolean(recording?.hasHeardVoice || words); const speakingRatio = recording?.timerSeconds ? clamp(Math.round((recording.speakingMs / 1000 / recording.timerSeconds) * 100), 0, 100) : 0; const pauses = recording?.pauses || 0; const pitchAverage = recording?.pitchCount ? Math.round(recording.pitchSum / recording.pitchCount) : 0; const pitchRange = recording?.pitchCount ? Math.max(0, recording.pitchMax - recording.pitchMin) : 0; const fillerControl = words ? clamp(Math.round(100 - (fillers / words) * 400), 0, 100) : hasSignal ? 82 : 0; const clarity = hasSignal ? clamp(Math.round(91 - fillers * 4 - pauses * 2), 0, 100) : 0; const confidence = hasSignal ? clamp(Math.round(84 - pauses * 2 - fillers * 2 + (wpm >= 100 && wpm <= 175 ? 7 : 0)), 0, 100) : 0; const paceScore = wpm ? clamp(Math.round(100 - Math.abs(wpm - 140) * .45), 0, 100) : 0; const insights = buildCoachingInsights({ transcript, words, fillers, pauses, wpm, speakingRatio, pitchRange, hasSignal });
  return { transcript, words, fillers, pauses, wpm, speakingRatio, pitchAverage, pitchRange, hasSignal, fillerControl, clarity, confidence, paceScore, ...insights, error: recording?.error || (!transcript && !hasSignal ? "Live transcription was unavailable for this session." : "") };
}
function setMetric(value, valueElement, barElement) { valueElement.textContent = value ? `${value}` : "--"; barElement.style.width = `${value}%`; }
function renderInsightList(element, items, fallback) { const values = Array.isArray(items) && items.length ? items : [fallback]; element.replaceChildren(...values.map((item) => { const li = document.createElement("li"); li.textContent = String(item); return li; })); }
function persistAnalysis(analysis) { try { sessionStorage.setItem("basement-analysis", JSON.stringify({ ...analysis, topic: state.topic, savedAt: Date.now() })); } catch { /* Analysis remains available in the current page. */ } }
function renderAnalysis(analysis) {
  state.analysis = analysis; persistAnalysis(analysis); setMetric(analysis.clarity, metricEls.clarity, metricEls.clarityBar); setMetric(analysis.confidence, metricEls.confidence, metricEls.confidenceBar); setMetric(analysis.fillerControl, metricEls.filler, metricEls.fillerBar); setMetric(analysis.paceScore, metricEls.wpm, metricEls.wpmBar);
  metricEls.clarityDetail.textContent = analysis.clarityFeedback || (analysis.clarity ? (analysis.pauses ? `${analysis.pauses} long pause${analysis.pauses === 1 ? "" : "s"} found.` : "Clean phrasing with steady delivery.") : "Grant microphone access for audio signals.");
  metricEls.confidenceDetail.textContent = analysis.confidenceFeedback || (analysis.confidence ? (analysis.confidence >= 80 ? "Your pace supports a confident read." : "Try shorter pauses and a firmer first sentence.") : "Waiting for a usable speech signal.");
  metricEls.fillerDetail.textContent = analysis.fillerFeedback || (analysis.words ? `${analysis.fillers} filler word${analysis.fillers === 1 ? "" : "s"} across ${analysis.words} words.` : "No live transcript was captured.");
  metricEls.wpmDetail.textContent = analysis.paceFeedback || (analysis.wpm ? `${analysis.wpm} words per minute. Aim for 120–160 for an easy listen.` : "A transcript is needed to calculate pace.");
  els.fillerCount.textContent = analysis.fillers; els.pauseCount.textContent = analysis.pauses; els.wordCount.textContent = analysis.words; els.pitchRange.textContent = analysis.pitchRange ? `${analysis.pitchRange} Hz` : "--"; els.analysisTranscript.textContent = analysis.transcript || analysis.error || "No transcript captured yet."; els.analysisSummary.textContent = analysis.summary || (analysis.error ? analysis.error : "Everything here was measured in this anonymous browser session.");
  renderInsightList(els.strengths, analysis.strengths, "No delivery strengths were detected yet."); renderInsightList(els.improvements, analysis.improvements, "Speak naturally for a full take to get a specific next move.");
}
async function processCompletedRecording(recording) {
  let analysis = buildAnalysis(recording); renderAnalysis(analysis); els.analysisSummary.textContent = "Transcribing your session…";
  try {
    const blob = await recording?.blobReady;
    if (!blob) throw new Error(recording?.error || "No recording was captured.");
    const transcriptResponse = await fetch("/api/transcribe", { method: "POST", headers: { "content-type": blob.type || "audio/webm" }, body: blob });
    if (!transcriptResponse.ok) throw new Error("Transcription is unavailable right now.");
    const transcription = await transcriptResponse.json(); recording.transcript = transcription.transcript || ""; recording.transcriptionProvider = transcription.provider || "server"; analysis = buildAnalysis(recording); renderAnalysis(analysis); els.analysisSummary.textContent = "Transcript ready. Gemini is reading the delivery now…";
    const aiResponse = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: state.topic, transcript: analysis.transcript, metrics: { words: analysis.words, fillers: analysis.fillers, pauses: analysis.pauses, wpm: analysis.wpm, speakingRatio: analysis.speakingRatio, pitchAverage: analysis.pitchAverage, pitchRange: analysis.pitchRange, transcriptionProvider: recording.transcriptionProvider } }) });
    if (!aiResponse.ok) throw new Error("AI analysis is unavailable right now.");
    const result = await aiResponse.json(); const ai = result.analysis;
    if (ai) renderAnalysis({ ...analysis, summary: ai.summary, clarity: Number(ai.clarity?.score) || analysis.clarity, confidence: Number(ai.confidence?.score) || analysis.confidence, fillerControl: Number(ai.fillerControl?.score) || analysis.fillerControl, paceScore: Number(ai.pace?.score) || analysis.paceScore, wpm: Number(ai.pace?.wpm) || analysis.wpm, clarityFeedback: ai.clarity?.feedback, confidenceFeedback: ai.confidence?.feedback, fillerFeedback: ai.fillerControl?.feedback, paceFeedback: ai.pace?.feedback, strengths: Array.isArray(ai.strengths) && ai.strengths.length ? ai.strengths : analysis.strengths, improvements: Array.isArray(ai.improvements) && ai.improvements.length ? ai.improvements : analysis.improvements });
  } catch (error) { const fallback = buildAnalysis({ ...recording, error: error.message || "Provider analysis unavailable. Local metrics are still shown." }); renderAnalysis({ ...fallback, summary: fallback.hasSignal ? "Your transcript is ready. Local delivery signals are shown while the deeper coaching pass is unavailable." : fallback.error }); }
}
function openAnalysis() { if (!state.analysis) return; window.location.assign("/analysis"); }
function closeAnalysis() { els.analysisModal.hidden = true; }
function renderNicheMenu() { els.nicheMenu.innerHTML = nicheOptions.map(([value, label, icon]) => `<button class="niche-option${value === state.niche ? " is-selected" : ""}" type="button" role="option" aria-selected="${value === state.niche}" data-niche="${value}"><span class="niche-option-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`).join(""); }
function renderNiche() { const selected = nicheOptions.find(([value]) => value === state.niche) || nicheOptions[0]; els.nicheLabel.textContent = selected[1]; els.nicheIcon.textContent = selected[2]; els.nicheSelect.value = selected[0]; renderNicheMenu(); }
function toggleNicheMenu(force) { const open = typeof force === "boolean" ? force : els.nicheMenu.hidden; els.nicheMenu.hidden = !open; els.nicheButton.setAttribute("aria-expanded", String(open)); }
function updateTimerLabel() { if (state.phase === "research") els.timerLabel.textContent = "Pause research"; else if (state.phase === "speech") els.timerLabel.textContent = state.interval ? "Pause timer" : "Resume timer"; else if (state.phase === "complete") els.timerLabel.textContent = "Restart timer"; else els.timerLabel.textContent = state.mode === "deep-research" ? `Start ${state.settings.researchMinutes} min research` : `Start ${state.settings.speechMinutes} min timer`; }
function updateModalLabel() { if (state.phase === "research") els.timerControl.textContent = state.interval ? "Pause research" : "Resume research"; else if (state.phase === "speech") els.timerControl.textContent = state.interval ? "Pause timer" : "Start speech"; else if (state.phase === "complete") els.timerControl.textContent = "Close timer"; else els.timerControl.textContent = "Start timer"; els.analysisButton.hidden = state.phase !== "complete"; }
function setMode(mode) { state.mode = mode; els.modeOptions.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode)); els.modeDescription.textContent = modeCopy[mode]; els.nicheControl.hidden = mode === "deep-research"; els.session.textContent = "READY"; resetTimer(); toggleNicheMenu(false); }

async function spin() {
  els.spin.disabled = true; els.session.textContent = "THINKING"; els.source.textContent = "Generating a fresh topic"; els.topic.classList.add("is-spinning"); els.topic.textContent = spinTopics[Math.floor(Math.random() * spinTopics.length)]; chirp(520);
  const reel = window.setInterval(() => { els.topic.textContent = spinTopics[Math.floor(Math.random() * spinTopics.length)]; }, 115);
  try {
    const response = await fetch("/api/spin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: state.mode, niche: state.niche, recentTopics: state.topicHistory.slice(-20) }) });
    if (!response.ok) throw new Error("Spin failed");
    const result = await response.json();
    state.topic = result.topic;
    state.topicHistory = [...state.topicHistory.filter((topic) => topic.toLowerCase() !== result.topic.toLowerCase()), result.topic].slice(-20);
    els.topic.textContent = result.topic;
    els.timerTopic.textContent = result.topic;
    els.source.textContent = result.source === "gemini"
      ? "Gemini generated topic"
      : result.reason === "quota_or_rate_limit"
        ? "Fresh local topic · Gemini rate limited"
        : result.reason === "invalid_or_restricted_key"
          ? "Fresh local topic · check Gemini key"
          : "Fresh local topic pool";
    els.session.textContent = "READY"; els.timer.disabled = false; updateTimerLabel(); updateModalLabel(); chirp(660, .12);
  } catch { els.session.textContent = "TRY AGAIN"; els.source.textContent = "Topic generation unavailable"; els.topic.textContent = "Spin again"; } finally { window.clearInterval(reel); els.topic.classList.remove("is-spinning"); els.spin.disabled = false; }
}
function startTimer() { if (!state.topic || state.interval) return; state.phase = state.mode === "deep-research" ? "research" : "speech"; state.total = (state.phase === "research" ? state.settings.researchMinutes : state.settings.speechMinutes) * 60; state.remaining = state.total; els.timerTopic.textContent = state.topic; els.panel.hidden = false; els.phase.textContent = state.phase === "research" ? "Research timer" : "Speech timer"; els.status.textContent = state.phase === "research" ? "Build your angle. Then start speaking." : "The clock starts when you do."; setWaveformState(state.phase === "speech" ? "MIC STARTING" : "RESEARCH MODE"); renderTimer(); state.interval = window.setInterval(tick, 1000); if (state.phase === "speech") startRecording(); updateTimerLabel(); updateModalLabel(); chirp(760); }
function tick() { state.remaining -= 1; if (state.phase === "speech" && state.recording) state.recording.timerSeconds += 1; renderTimer(); if (state.remaining <= 0) finishPhase(); }
function finishPhase() { window.clearInterval(state.interval); state.interval = null; chirp(880, .22); if (state.phase === "research") { state.phase = "speech"; state.total = state.settings.speechMinutes * 60; state.remaining = state.total; els.phase.textContent = "Speech timer"; els.status.textContent = "Research complete. Tap Start speech when you are ready."; renderTimer(); updateTimerLabel(); updateModalLabel(); return; } const recording = stopRecording(); state.phase = "complete"; state.analysis = buildAnalysis(recording); renderAnalysis(state.analysis); processCompletedRecording(recording); els.status.textContent = "Mission complete. Nice work."; completionSound(); fireConfetti(); updateTimerLabel(); updateModalLabel(); }
function renderTimer() { const ratio = state.total ? Math.max(0, state.remaining / state.total) : 1; els.display.textContent = formatTime(Math.max(0, state.remaining)); els.ringProgress.style.strokeDashoffset = `${603.19 * (1 - ratio)}`; }
function resetTimer() { window.clearInterval(state.interval); state.interval = null; stopRecording(); state.phase = "idle"; state.remaining = 0; state.total = 0; state.analysis = null; els.panel.hidden = true; els.timer.disabled = !state.topic; updateTimerLabel(); updateModalLabel(); }
function closeTimerModal() { window.clearInterval(state.interval); state.interval = null; if (state.phase === "speech") stopRecording(); els.panel.hidden = true; updateTimerLabel(); updateModalLabel(); }
function renderSettings() { els.speech.value = state.settings.speechMinutes; els.research.value = state.settings.researchMinutes; els.mute.checked = state.settings.muted; els.speechValue.textContent = `${els.speech.value} min`; els.researchValue.textContent = `${els.research.value} min`; }
function openSettings() { renderSettings(); els.modal.hidden = false; els.speech.focus(); }
function closeSettings() { els.modal.hidden = true; }
function saveSettings() { state.settings = { speechMinutes: Number(els.speech.value), researchMinutes: Number(els.research.value), muted: els.mute.checked }; localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); updateTimerLabel(); closeSettings(); chirp(660); }

els.modeOptions.forEach((button) => button.addEventListener("click", () => { setMode(button.dataset.mode); chirp(400); }));
els.nicheButton.addEventListener("click", () => toggleNicheMenu());
els.nicheMenu.addEventListener("click", (event) => { const option = event.target.closest("[data-niche]"); if (!option) return; state.niche = option.dataset.niche; renderNiche(); toggleNicheMenu(false); chirp(400); });
els.spin.addEventListener("click", spin);
els.timer.addEventListener("click", () => { if (state.phase === "complete") resetTimer(); if (state.phase !== "idle" && state.remaining > 0) { els.timerTopic.textContent = state.topic; els.panel.hidden = false; updateModalLabel(); return; } startTimer(); });
els.timerControl.addEventListener("click", () => { if (state.phase === "complete") { closeTimerModal(); return; } if (state.interval) { window.clearInterval(state.interval); state.interval = null; if (state.phase === "speech") pauseRecording(); els.status.textContent = "Timer paused."; updateTimerLabel(); updateModalLabel(); return; } if (state.phase === "speech" || state.phase === "research") { state.interval = window.setInterval(tick, 1000); if (state.phase === "speech") { if (state.recording) resumeRecording(); else startRecording(); } els.status.textContent = state.phase === "research" ? "Build your angle. Then start speaking." : "The clock starts when you do."; updateTimerLabel(); updateModalLabel(); return; } startTimer(); });
els.timerClose.addEventListener("click", closeTimerModal);
els.analysisButton.addEventListener("click", openAnalysis); els.closeAnalysis.addEventListener("click", closeAnalysis); els.analysisModal.addEventListener("click", (event) => { if (event.target === els.analysisModal) closeAnalysis(); });
els.reset.addEventListener("click", resetTimer); els.openSettings.addEventListener("click", openSettings); els.closeSettings.addEventListener("click", closeSettings); els.saveSettings.addEventListener("click", saveSettings); els.modal.addEventListener("click", (event) => { if (event.target === els.modal) closeSettings(); });
els.speech.addEventListener("input", () => { els.speechValue.textContent = `${els.speech.value} min`; }); els.research.addEventListener("input", () => { els.researchValue.textContent = `${els.research.value} min`; });
document.addEventListener("click", (event) => { if (!els.nicheControl.contains(event.target)) toggleNicheMenu(false); }); document.addEventListener("keydown", (event) => { if (event.key === "Escape") { toggleNicheMenu(false); if (!els.modal.hidden) closeSettings(); else if (!els.analysisModal.hidden) closeAnalysis(); else if (!els.panel.hidden) closeTimerModal(); } });
renderNiche(); renderSettings(); updateTimerLabel(); updateModalLabel();
