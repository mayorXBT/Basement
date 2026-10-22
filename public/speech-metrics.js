(function installSpeechMetrics(root) {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function countWords(text) {
    return (String(text || "").match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []).length;
  }

  function countFillers(text) {
    return (String(text || "").match(/\b(?:um+|uh+|er+|like|you know|basically|actually|literally|sort of|kind of)\b/gi) || []).length;
  }

  function computeWpm(words, seconds) {
    const safeSeconds = Math.max(1, Number(seconds) || 0);
    return words ? Math.round(words / (safeSeconds / 60)) : 0;
  }

  function localScores({ words = 0, fillers = 0, pauses = 0, wpm = 0, hasSignal = Boolean(words) } = {}) {
    return {
      fillerControl: words ? clamp(Math.round(100 - (fillers / words) * 400), 0, 100) : hasSignal ? 82 : 0,
      clarity: hasSignal ? clamp(Math.round(91 - fillers * 4 - pauses * 2), 0, 100) : 0,
      confidence: hasSignal ? clamp(Math.round(84 - pauses * 2 - fillers * 2 + (wpm >= 100 && wpm <= 175 ? 7 : 0)), 0, 100) : 0,
      paceScore: wpm ? clamp(Math.round(100 - Math.abs(wpm - 140) * .45), 0, 100) : 0
    };
  }

  root.BasementSpeechMetrics = Object.freeze({ countWords, countFillers, computeWpm, localScores });
})(globalThis);
