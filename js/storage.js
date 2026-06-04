// localStorage persistence for M25K

const Storage = (() => {
  const PROGRESS_KEY = 'm25k_progress';
  const HISTORY_KEY  = 'm25k_history';

  // ── Progress (which workout is next) ──────────────────────────────────────

  function getProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? JSON.parse(raw) : { weekIndex: 0, dayIndex: 0, completed: 0 };
    } catch {
      return { weekIndex: 0, dayIndex: 0, completed: 0 };
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function resetProgress() {
    localStorage.removeItem(PROGRESS_KEY);
  }

  // Advance to the next workout; returns updated progress
  function advanceProgress() {
    const p = getProgress();
    p.completed += 1;
    p.dayIndex += 1;
    if (p.dayIndex >= 3) {
      p.dayIndex = 0;
      p.weekIndex += 1;
    }
    saveProgress(p);
    return p;
  }

  // ── History (completed workout records) ───────────────────────────────────

  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // record: { weekIndex, dayIndex, date, durationSec, distanceKm, calories }
  function addHistoryRecord(record) {
    const history = getHistory();
    history.push({ ...record, id: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  // ── Streak calculation ────────────────────────────────────────────────────

  function getStreak() {
    const history = getHistory();
    if (!history.length) return 0;

    const days = [...new Set(
      history.map(r => new Date(r.date).toDateString())
    )].map(d => new Date(d)).sort((a, b) => b - a);

    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (const day of days) {
      const d = new Date(day);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((cursor - d) / 86400000);
      if (diff <= 1) {
        streak++;
        cursor = d;
      } else {
        break;
      }
    }
    return streak;
  }

  // ── Aggregate stats ───────────────────────────────────────────────────────

  function getStats() {
    const history = getHistory();
    const workouts  = history.length;
    const distanceKm = history.reduce((s, r) => s + (r.distanceKm || 0), 0);
    const totalSec   = history.reduce((s, r) => s + (r.durationSec || 0), 0);
    // ~60 cal/km running, adjusted by fraction of run time
    const calories   = history.reduce((s, r) => s + (r.calories || 0), 0);
    return { workouts, distanceKm, totalMinutes: Math.round(totalSec / 60), calories };
  }

  return {
    getProgress, saveProgress, resetProgress, advanceProgress,
    getHistory, addHistoryRecord, clearHistory,
    getStreak, getStats,
  };
})();
