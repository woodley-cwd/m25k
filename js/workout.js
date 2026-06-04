// Workout timer — interval logic, TTS cues, phase management

const Workout = (() => {
  let intervals   = [];
  let weekIndex   = 0;
  let dayIndex    = 0;

  let currentIdx  = 0;   // index into intervals[]
  let elapsed     = 0;   // seconds elapsed in current interval
  let totalElapsed = 0;  // seconds elapsed in whole workout
  let paused      = false;
  let finished    = false;
  let ticker      = null;

  let announced30 = false; // per-interval flag

  // Callbacks set by app.js
  let onPhaseChange = null;
  let onTick        = null;
  let onComplete    = null;

  function load(wIdx, dIdx) {
    weekIndex  = wIdx;
    dayIndex   = dIdx;
    intervals  = PROGRAM[wIdx][dIdx];
    currentIdx = 0;
    elapsed    = 0;
    totalElapsed = 0;
    paused     = false;
    finished   = false;
    announced30 = false;
  }

  function start() {
    if (ticker) clearInterval(ticker);
    MapTracker.start();
    Speech.speak('Workout starting. ' + phaseAnnouncement(intervals[0]));
    notifyPhaseChange();
    ticker = setInterval(tick, 1000);
  }

  function tick() {
    if (paused || finished) return;

    elapsed++;
    totalElapsed++;
    const current = intervals[currentIdx];
    const remaining = current.duration - elapsed;

    // 30-second warning
    if (!announced30 && remaining === 30) {
      announced30 = true;
      Speech.speak('30 seconds remaining');
    }

    if (remaining <= 0) {
      advanceInterval();
    } else {
      if (onTick) onTick(remaining, totalElapsed);
    }
  }

  function advanceInterval() {
    currentIdx++;
    elapsed = 0;
    announced30 = false;

    if (currentIdx >= intervals.length) {
      finish();
      return;
    }

    const next = intervals[currentIdx];
    Speech.speak(phaseAnnouncement(next));
    notifyPhaseChange();
    if (onTick) onTick(next.duration, totalElapsed);
  }

  function finish() {
    finished = true;
    clearInterval(ticker);
    MapTracker.stop();
    Speech.speak('Workout complete! Amazing work!');
    if (onComplete) onComplete(totalElapsed, MapTracker.getDistanceKm());
  }

  function pause() {
    paused = true;
    window.speechSynthesis && window.speechSynthesis.cancel();
  }

  function resume() {
    paused = false;
    Speech.speak('Resuming');
  }

  function stop() {
    clearInterval(ticker);
    MapTracker.stop();
    window.speechSynthesis && window.speechSynthesis.cancel();
    finished = true;
  }

  function isPaused()   { return paused; }
  function isFinished() { return finished; }

  function getCurrentInterval() {
    return intervals[currentIdx] || null;
  }

  function getNextInterval() {
    return intervals[currentIdx + 1] || null;
  }

  function getCurrentRemaining() {
    const cur = getCurrentInterval();
    return cur ? cur.duration - elapsed : 0;
  }

  function getTotalElapsed() { return totalElapsed; }

  function getIntervals() { return intervals; }

  function notifyPhaseChange() {
    if (onPhaseChange) onPhaseChange(getCurrentInterval(), getNextInterval());
  }

  function phaseAnnouncement(interval) {
    if (!interval) return '';
    if (interval.label === 'Warm-up Walk')   return 'Start your warm-up walk';
    if (interval.label === 'Cool-down Walk') return 'Start your cool-down walk';
    if (interval.type === 'run')  return 'Start running';
    if (interval.type === 'walk') return 'Start walking';
    return '';
  }

  // Build the interval strip dots for the workout screen
  function buildStripData() {
    return intervals.map((iv, i) => ({
      type: iv.type,
      label: iv.label,
      active: i === currentIdx,
      done: i < currentIdx,
    }));
  }

  function getCurrentIndex() { return currentIdx; }

  return {
    load, start, pause, resume, stop,
    isPaused, isFinished,
    getCurrentInterval, getNextInterval,
    getCurrentRemaining, getTotalElapsed,
    getIntervals, buildStripData, getCurrentIndex,
    set onPhaseChange(fn) { onPhaseChange = fn; },
    set onTick(fn) { onTick = fn; },
    set onComplete(fn) { onComplete = fn; },
  };
})();
