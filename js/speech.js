// TTS voice coach using Web Speech API

const Speech = (() => {
  let enabled = true;
  let voice = null;

  function init() {
    if (!window.speechSynthesis) return;
    function pickVoice() {
      const voices = window.speechSynthesis.getVoices();
      // Prefer a local English female voice, fall back gracefully
      voice =
        voices.find(v => v.lang.startsWith('en') && /female|woman|zira|samantha|karen|moira|tessa|fiona|victoria|susan|heather|hazel|catherine|nicky/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith('en') && v.localService) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0] || null;
    }
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text) {
    if (!enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.voice = voice;
    utt.rate = 0.95;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    window.speechSynthesis.speak(utt);
  }

  function setEnabled(val) { enabled = val; }
  function isEnabled() { return enabled; }

  return { init, speak, setEnabled, isEnabled };
})();
