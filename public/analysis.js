const refs = {
  topic: document.querySelector("#analysis-page-topic"), summary: document.querySelector("#analysis-summary"), transcript: document.querySelector("#analysis-transcript"), fillerCount: document.querySelector("#analysis-filler-count"), pauseCount: document.querySelector("#analysis-pause-count"), wordCount: document.querySelector("#analysis-word-count"), pitchRange: document.querySelector("#analysis-pitch-range"), strengths: document.querySelector("#analysis-strengths"), improvements: document.querySelector("#analysis-improvements")
};
const metrics = {
  clarity: [document.querySelector("#metric-clarity"), document.querySelector("#bar-clarity"), document.querySelector("#detail-clarity")], confidence: [document.querySelector("#metric-confidence"), document.querySelector("#bar-confidence"), document.querySelector("#detail-confidence")], filler: [document.querySelector("#metric-filler"), document.querySelector("#bar-filler"), document.querySelector("#detail-filler")], wpm: [document.querySelector("#metric-wpm"), document.querySelector("#bar-wpm"), document.querySelector("#detail-wpm")]
};
let lastSavedAt = 0;
function getAnalysis() { try { return JSON.parse(sessionStorage.getItem("basement-analysis") || "null"); } catch { return null; } }
function renderList(element, items, fallback) { element.replaceChildren(...(Array.isArray(items) && items.length ? items : [fallback]).map((item) => { const li = document.createElement("li"); li.textContent = String(item); return li; })); }
function setMetric(metric, value, detail) { const [valueElement, barElement, detailElement] = metrics[metric]; const score = Number(value) || 0; valueElement.textContent = score ? `${score}` : "--"; barElement.style.width = `${score}%`; detailElement.textContent = detail || "No signal available yet."; }
function render(analysis) {
  if (!analysis) { refs.topic.textContent = "Finish a session to see your delivery, broken down."; refs.summary.textContent = "No completed session is loaded yet."; return; }
  refs.topic.textContent = analysis.topic ? `Topic: ${analysis.topic}` : "Your delivery, broken down."; refs.summary.textContent = analysis.summary || analysis.error || "Everything here was measured in this anonymous browser session."; refs.transcript.textContent = analysis.transcript || analysis.error || "No transcript captured yet.";
  setMetric("clarity", analysis.clarity, analysis.clarityFeedback || "Clarity signal measured from your transcript and delivery."); setMetric("confidence", analysis.confidence, analysis.confidenceFeedback || "Confidence signal measured from your delivery."); setMetric("filler", analysis.fillerControl, analysis.fillerFeedback || "Filler control measured from your spoken words."); setMetric("wpm", analysis.paceScore, analysis.paceFeedback || (analysis.wpm ? `${analysis.wpm} words per minute.` : "A transcript is needed to calculate pace."));
  refs.fillerCount.textContent = analysis.fillers ?? 0; refs.pauseCount.textContent = analysis.pauses ?? 0; refs.wordCount.textContent = analysis.words ?? 0; refs.pitchRange.textContent = analysis.pitchRange ? `${analysis.pitchRange} Hz` : "--"; renderList(refs.strengths, analysis.strengths, "No delivery strengths were detected yet."); renderList(refs.improvements, analysis.improvements, "Speak naturally for a full take to get a specific next move.");
}
function refresh() { const analysis = getAnalysis(); if (analysis?.savedAt !== lastSavedAt) { lastSavedAt = analysis?.savedAt || 0; render(analysis); } }
refresh(); window.setInterval(refresh, 900);
