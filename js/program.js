// M25K — Classic C25K 8-Week Program
// Each workout is an array of interval objects: { type: 'walk'|'run', duration: seconds, label: string }

function makeWarmup() {
  return { type: 'walk', duration: 300, label: 'Warm-up Walk' };
}

function makeCooldown() {
  return { type: 'walk', duration: 300, label: 'Cool-down Walk' };
}

function wrap(intervals) {
  return [makeWarmup(), ...intervals, makeCooldown()];
}

function repeat(pattern, times) {
  const out = [];
  for (let i = 0; i < times; i++) out.push(...pattern);
  return out;
}

function r(sec) { return { type: 'run',  duration: sec, label: 'Run'  }; }
function w(sec) { return { type: 'walk', duration: sec, label: 'Walk' }; }

// All 24 workouts indexed [weekIndex][dayIndex] (0-based)
const PROGRAM = [
  // ── Week 1 ── 8 × (60s run / 90s walk)
  [
    wrap(repeat([r(60), w(90)], 8)),
    wrap(repeat([r(60), w(90)], 8)),
    wrap(repeat([r(60), w(90)], 8)),
  ],

  // ── Week 2 ── 6 × (90s run / 2 min walk)
  [
    wrap(repeat([r(90), w(120)], 6)),
    wrap(repeat([r(90), w(120)], 6)),
    wrap(repeat([r(90), w(120)], 6)),
  ],

  // ── Week 3 ── 2 × (90s run / 90s walk / 3 min run / 3 min walk)
  [
    wrap(repeat([r(90), w(90), r(180), w(180)], 2)),
    wrap(repeat([r(90), w(90), r(180), w(180)], 2)),
    wrap(repeat([r(90), w(90), r(180), w(180)], 2)),
  ],

  // ── Week 4 ── 3 min run / 90s walk / 5 min run / 2.5 min walk / 3 min run / 90s walk / 5 min run
  [
    wrap([r(180), w(90), r(300), w(150), r(180), w(90), r(300)]),
    wrap([r(180), w(90), r(300), w(150), r(180), w(90), r(300)]),
    wrap([r(180), w(90), r(300), w(150), r(180), w(90), r(300)]),
  ],

  // ── Week 5 ── Three different days
  [
    // Day 1: 3 × (5 min run / 3 min walk)
    wrap(repeat([r(300), w(180)], 3)),
    // Day 2: 8 min run / 5 min walk / 8 min run
    wrap([r(480), w(300), r(480)]),
    // Day 3: 20 min continuous run
    wrap([r(1200)]),
  ],

  // ── Week 6 ── Three different days
  [
    // Day 1: 5 min run / 3 min walk / 8 min run / 3 min walk / 5 min run
    wrap([r(300), w(180), r(480), w(180), r(300)]),
    // Day 2: 10 min run / 3 min walk / 10 min run
    wrap([r(600), w(180), r(600)]),
    // Day 3: 25 min continuous run
    wrap([r(1500)]),
  ],

  // ── Week 7 ── 25 min continuous run (all 3 days)
  [
    wrap([r(1500)]),
    wrap([r(1500)]),
    wrap([r(1500)]),
  ],

  // ── Week 8 ── 28 / 28 / 30 min run
  [
    wrap([r(1680)]),
    wrap([r(1680)]),
    wrap([r(1800)]),
  ],
];

// Helper: total active run time for a workout (excludes warmup/cooldown)
function getTotalRunTime(intervals) {
  return intervals
    .filter(i => i.type === 'run')
    .reduce((sum, i) => sum + i.duration, 0);
}

// Helper: total duration of a workout in seconds
function getTotalDuration(intervals) {
  return intervals.reduce((sum, i) => sum + i.duration, 0);
}

// Human-readable summary for a workout (used in History/Home)
function getWorkoutSummary(weekIndex, dayIndex) {
  const intervals = PROGRAM[weekIndex][dayIndex];
  const runTime = getTotalRunTime(intervals);
  const totalTime = getTotalDuration(intervals);
  const runIntervals = intervals.filter(i => i.type === 'run');
  const isContinuous = runIntervals.length === 1;

  let description;
  if (isContinuous) {
    description = `${Math.round(runTime / 60)} min continuous run`;
  } else {
    description = `${runIntervals.length} run intervals`;
  }

  return {
    week: weekIndex + 1,
    day: dayIndex + 1,
    description,
    totalMinutes: Math.round(totalTime / 60),
    runMinutes: Math.round(runTime / 60),
    intervalCount: intervals.length,
  };
}
