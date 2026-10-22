function transcriptBlockText(analysis) {
  if (analysis?.transcript) return analysis.transcript;
  if (analysis?.error) return analysis.error;
  if (analysis?.transcribing) return "Transcribing your session…";
  return "No transcript captured yet.";
}

function canNavigateToAnalysis(analysis) {
  return Boolean(analysis) && !analysis.transcribing;
}

function isCurrentRecording(state, recording) {
  return Boolean(recording) && state.analysisToken === recording.token;
}

function startSpeechRecognition(recognition, isCurrent, schedule) {
  const wait = schedule || setTimeout;
  const attempt = (n) => {
    if (!isCurrent()) return;
    try {
      recognition.start();
    } catch {
      if (n < 5) wait(() => attempt(n + 1), 120 * (n + 1));
    }
  };
  attempt(0);
}
