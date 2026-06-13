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

  // Play a silent audio buffer to unlock the media audio channel on iOS/Android
  // before the first TTS fires — this prevents the voice from playing at low volume.
  function unlockAudio() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      setTimeout(() => ctx.close(), 500);
    } catch (e) {}
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

  return { init, speak, unlockAudio, setEnabled, isEnabled };
})();
