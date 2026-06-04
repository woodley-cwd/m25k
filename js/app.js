// M25K — main app controller

document.addEventListener('DOMContentLoaded', () => {

  // ── Service worker registration ──────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }

  // ── Init sub-modules ─────────────────────────────────────────────────────
  Speech.init();
  MapTracker.init();

  // ── Navigation ───────────────────────────────────────────────────────────
  const screens   = document.querySelectorAll('.screen');
  const navBtns   = document.querySelectorAll('.nav-btn');
  const bottomNav = document.getElementById('bottom-nav');

  function showScreen(id) {
    screens.forEach(s => s.classList.toggle('active', s.id === `screen-${id}`));
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.screen === id));
    // Hide nav during active workout
    bottomNav.style.display = (id === 'workout') ? 'none' : 'flex';
    if (id === 'home')    renderHome();
    if (id === 'history') renderHistory();
    if (id === 'stats')   renderStats();
    if (id === 'garden')  renderGarden();
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  // ── HOME screen ──────────────────────────────────────────────────────────
  function renderHome() {
    const progress = Storage.getProgress();
    const streak   = Storage.getStreak();
    const total    = 24;
    const completed = progress.completed;

    document.getElementById('home-streak').textContent = `🔥 ${streak}`;
    document.getElementById('home-progress-text').textContent = `${completed} / ${total}`;
    document.getElementById('home-progress-bar').style.width = `${(completed / total) * 100}%`;

    const allDone = completed >= total;
    document.getElementById('home-next-card').classList.toggle('hidden', allDone);
    document.getElementById('home-complete-card').classList.toggle('hidden', !allDone);

    if (!allDone) {
      const { weekIndex, dayIndex } = progress;
      const summary = getWorkoutSummary(weekIndex, dayIndex);
      document.getElementById('home-next-title').textContent =
        `Week ${summary.week} · Day ${summary.day}`;
      document.getElementById('home-next-desc').textContent =
        `${summary.description} · ${summary.totalMinutes} min`;
    }

    renderWeekGrid(progress);
  }

  function renderWeekGrid(progress) {
    const grid = document.getElementById('home-week-grid');
    grid.innerHTML = '';
    for (let w = 0; w < 8; w++) {
      const weekEl = document.createElement('div');
      weekEl.className = 'week-row';
      const label = document.createElement('span');
      label.className = 'week-label';
      label.textContent = `W${w + 1}`;
      weekEl.appendChild(label);
      for (let d = 0; d < 3; d++) {
        const dot = document.createElement('span');
        const workoutNum = w * 3 + d;
        const isDone = workoutNum < progress.completed;
        const isCurrent = w === progress.weekIndex && d === progress.dayIndex;
        dot.className = 'week-dot' +
          (isDone ? ' done' : '') +
          (isCurrent ? ' current' : '');
        dot.textContent = isDone ? '✓' : `${d + 1}`;
        weekEl.appendChild(dot);
      }
      grid.appendChild(weekEl);
    }
  }

  document.getElementById('home-start-btn').addEventListener('click', startNextWorkout);
  document.getElementById('home-reset-btn').addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      Storage.resetProgress();
      Storage.clearHistory();
      renderHome();
    }
  });

  // ── WORKOUT screen ───────────────────────────────────────────────────────
  function startNextWorkout() {
    const progress = Storage.getProgress();
    if (progress.completed >= 24) return;
    Workout.load(progress.weekIndex, progress.dayIndex);

    document.getElementById('workout-title').textContent =
      `Week ${progress.weekIndex + 1} · Day ${progress.dayIndex + 1}`;

    renderIntervalStrip();
    showScreen('workout');

    // Wire callbacks
    Workout.onPhaseChange = (current, next) => {
      renderPhase(current, next);
      renderIntervalStrip();
    };

    Workout.onTick = (remaining, totalElapsed) => {
      document.getElementById('workout-phase-timer').textContent = formatTime(remaining);
      document.getElementById('workout-overall-timer').textContent = formatTime(totalElapsed);
      renderIntervalStrip();
    };

    Workout.onComplete = (totalSec, distanceKm) => {
      saveAndFinish(totalSec, distanceKm);
    };

    Workout.start();
    updatePauseBtn();
  }

  function renderPhase(current, next) {
    if (!current) return;
    const labelEl = document.getElementById('workout-phase-label');
    const timerEl = document.getElementById('workout-phase-timer');
    const nextEl  = document.getElementById('workout-phase-next');

    labelEl.textContent = current.label.toUpperCase();
    labelEl.className   = 'phase-label phase-' + current.type;
    timerEl.textContent = formatTime(current.duration);
    nextEl.textContent  = next ? `Next: ${next.label}` : '';
  }

  function renderIntervalStrip() {
    const strip = document.getElementById('workout-interval-strip');
    const data  = Workout.buildStripData();
    strip.innerHTML = '';
    data.forEach(iv => {
      const dot = document.createElement('span');
      dot.className = 'strip-dot strip-' + iv.type +
        (iv.active ? ' strip-active' : '') +
        (iv.done   ? ' strip-done'   : '');
      strip.appendChild(dot);
    });
  }

  // Pause / Resume
  const pauseBtn = document.getElementById('workout-pause-btn');
  pauseBtn.addEventListener('click', () => {
    if (Workout.isPaused()) {
      Workout.resume();
    } else {
      Workout.pause();
    }
    updatePauseBtn();
  });

  function updatePauseBtn() {
    pauseBtn.textContent = Workout.isPaused() ? 'Resume' : 'Pause';
  }

  // End early
  document.getElementById('workout-stop-btn').addEventListener('click', () => {
    if (confirm('End workout early? Progress will not be saved.')) {
      Workout.stop();
      MapTracker.reset();
      showScreen('home');
    }
  });

  document.getElementById('workout-back-btn').addEventListener('click', () => {
    if (confirm('End workout early? Progress will not be saved.')) {
      Workout.stop();
      MapTracker.reset();
      showScreen('home');
    }
  });

  function saveAndFinish(totalSec, distanceKm) {
    const progress = Storage.getProgress();
    Garden.onWorkoutComplete(progress.weekIndex);
    const runTime  = Workout.getIntervals()
      .filter(i => i.type === 'run')
      .reduce((s, i) => s + i.duration, 0);
    // ~1 cal per kg per km; assume 70 kg runner, running fraction only
    const calories = Math.round(distanceKm > 0
      ? distanceKm * 70
      : (runTime / 3600) * 70 * 8); // rough MET estimate if no GPS

    Storage.addHistoryRecord({
      weekIndex:   progress.weekIndex,
      dayIndex:    progress.dayIndex,
      date:        new Date().toISOString(),
      durationSec: totalSec,
      distanceKm:  distanceKm,
      calories,
    });

    Storage.advanceProgress();
    MapTracker.reset();

    setTimeout(() => {
      showScreen('home');
    }, 3000);
  }

  // ── HISTORY screen ───────────────────────────────────────────────────────
  function renderHistory() {
    const history = Storage.getHistory().slice().reverse();
    const listEl  = document.getElementById('history-list');
    const emptyEl = document.getElementById('history-empty');

    listEl.innerHTML = '';

    if (!history.length) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    history.forEach(rec => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const date = new Date(rec.date);
      const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      item.innerHTML = `
        <div class="history-item-left">
          <div class="history-workout">Week ${rec.weekIndex + 1} · Day ${rec.dayIndex + 1}</div>
          <div class="history-date">${dateStr}</div>
        </div>
        <div class="history-item-right">
          <div class="history-stat">${formatTime(rec.durationSec)}</div>
          <div class="history-sub">${rec.distanceKm > 0 ? rec.distanceKm.toFixed(2) + ' km' : ''}</div>
        </div>`;
      listEl.appendChild(item);
    });
  }

  // ── STATS screen ─────────────────────────────────────────────────────────
  function renderStats() {
    const stats = Storage.getStats();
    document.getElementById('stat-workouts').textContent  = stats.workouts;
    document.getElementById('stat-distance').textContent  = stats.distanceKm.toFixed(1);
    document.getElementById('stat-time').textContent      = stats.totalMinutes;
    document.getElementById('stat-calories').textContent  = stats.calories;

    const history    = Storage.getHistory();
    const breakdownEl = document.getElementById('stats-weekly-breakdown');
    const emptyEl    = document.getElementById('stats-empty');
    breakdownEl.innerHTML = '';

    if (!history.length) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    const byWeek = {};
    history.forEach(r => {
      const w = r.weekIndex + 1;
      if (!byWeek[w]) byWeek[w] = { km: 0, count: 0 };
      byWeek[w].km    += r.distanceKm || 0;
      byWeek[w].count += 1;
    });

    Object.entries(byWeek).forEach(([week, data]) => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `
        <span class="breakdown-week">Week ${week}</span>
        <span class="breakdown-count">${data.count} workout${data.count !== 1 ? 's' : ''}</span>
        <span class="breakdown-km">${data.km.toFixed(2)} km</span>`;
      breakdownEl.appendChild(row);
    });
  }

  // ── GARDEN screen ────────────────────────────────────────────────────────
  function renderGarden() {
    const { headline, sub } = Garden.getStatusText();
    document.getElementById('garden-headline').textContent = headline;
    document.getElementById('garden-sub').textContent      = sub;
    Garden.render('garden-scene');
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  renderHome();
  showScreen('home');
});
