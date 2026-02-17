/* CIT Digital Twin - Frequency Analysis Engine (Heuristic v2) */

const FrequencyAnalyzer = {
  // Constants
  NUM_WEEKS: 14,
  SAVING_PER_REMOVED_TRIP: 1.5, // $ saving per removed SP trip
  WEEKS_PER_YEAR: 52,
  DISTANCE_PER_TRIP: 0.15,  // km avg per SP visit
  TIME_PER_TRIP: 2.5,       // minutes service time per SP
  CO2_PER_KM: 0.938,        // kg CO2e (2.68 kg/L at 0.35 L/km)
  CONFIDENCE_HIGH: 10,
  CONFIDENCE_MEDIUM: 5,

  // Working days as numeric values (Mon=1 .. Sun=7)
  WORKING_DAYS: [2, 3, 4, 6, 7],
  DAY_NAME_TO_NUM: {
    'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Saturday': 6, 'Sunday': 7
  },
  DAY_NUM_TO_NAME: {
    2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 6: 'Saturday', 7: 'Sunday'
  },

  // State
  data: null,
  analysis: null,
  summary: null,

  // Load monthly data from API (cached)
  async load() {
    if (this.data) return this.data;

    const response = await API.loadMonthlyTasks();
    this.data = response.tasks || [];
    return this.data;
  },

  // Get ISO week number from date string (YYYY-MM-DD)
  getISOWeek(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7) + 1;
  },

  // Get year-week key for grouping
  getWeekKey(dateStr) {
    const d = new Date(dateStr);
    const week = this.getISOWeek(dateStr);
    // Use Thursday's year for ISO week year
    const thu = new Date(d);
    thu.setDate(thu.getDate() + 3 - (thu.getDay() + 6) % 7);
    return `${thu.getFullYear()}-W${String(week).padStart(2, '0')}`;
  },

  // Run full analysis on loaded data
  analyze() {
    if (this.analysis) return this.analysis;
    if (!this.data || this.data.length === 0) return null;

    // Group tasks by service point
    const spGroups = {};
    for (const task of this.data) {
      const sp = task.service_point;
      if (!sp) continue;
      if (!spGroups[sp]) spGroups[sp] = [];
      spGroups[sp].push(task);
    }

    // Analyze each SP
    const spAnalysis = {};
    for (const [spId, tasks] of Object.entries(spGroups)) {
      spAnalysis[spId] = this.analyzeSP(spId, tasks);
    }

    this.analysis = spAnalysis;
    this.summary = this.computeSummary(spAnalysis);
    return this.analysis;
  },

  // STEP 1: Calculate target frequency
  calcTargetFrequency(spTasks) {
    const totalDone = spTasks.filter(t => t.task_status === 'Done').length;
    const totalToDo = spTasks.filter(t => t.task_status === 'To Do').length;
    const totalTasks = spTasks.length;

    // Avg_D: weekly average Done
    const avgD = totalDone / this.NUM_WEEKS;

    // Max_D: max Done in any single week
    const weeklyDone = {};
    for (const task of spTasks) {
      if (task.task_status !== 'Done') continue;
      const wk = this.getWeekKey(task.date);
      weeklyDone[wk] = (weeklyDone[wk] || 0) + 1;
    }
    const maxD = Object.values(weeklyDone).length > 0
      ? Math.max(...Object.values(weeklyDone))
      : 0;

    // F_base
    const fBase = Math.ceil(avgD);

    // Safety margin
    const fTemp = maxD > fBase ? fBase + 1 : fBase;

    const todoRate = totalTasks > 0 ? totalToDo / totalTasks : 0;
    let fFinal = Math.min(fTemp, 5);

    // Edge case: minimum 1
    if (fFinal === 0) fFinal = 1;

    return {
      avgD,
      maxD,
      fBase,
      fTemp,
      fFinal,
      todoRate,
      weeklyDone
    };
  },

  // STEP 2: Calculate day scores and rank
  calcDayScores(spTasks) {
    const dayScores = {};

    for (const dayNum of this.WORKING_DAYS) {
      const dayName = this.DAY_NUM_TO_NAME[dayNum];
      const dayTasks = spTasks.filter(t => t.day === dayName);

      const dayDone = dayTasks.filter(t => t.task_status === 'Done').length;
      const dayVisited = dayTasks.filter(t => t.task_status === 'Visited').length;
      const dayTodo = dayTasks.filter(t => t.task_status === 'To Do').length;
      const denominator = dayDone + dayVisited + dayTodo;

      const score = denominator > 0 ? dayDone / denominator : 0;

      dayScores[dayNum] = {
        dayNum,
        dayName,
        done: dayDone,
        visited: dayVisited,
        todo: dayTodo,
        total: dayTasks.length,
        score
      };
    }

    // Rank days: by score DESC, then by done DESC for tiebreak
    const rankedDays = Object.values(dayScores)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.done - a.done;
      })
      .map(d => d.dayNum);

    return { dayScores, rankedDays };
  },

  // STEP 3: Dynamic day selection with gap control
  selectDaysWithGapControl(fFinal, rankedDays, dayScores) {
    // If all 5 days, return immediately
    if (fFinal >= 5) {
      return { selectedDays: [...this.WORKING_DAYS], gapValid: true };
    }

    // Max gap allowed
    const maxGap = Math.ceil(7 / fFinal);

    // Initial selection: top F_final days by score
    let selectedDays = rankedDays.slice(0, fFinal);

    // Gap validation loop (max 10 iterations to prevent infinite loop)
    let iterations = 0;
    while (iterations < 10) {
      iterations++;

      // Sort selected days chronologically
      const sorted = [...selectedDays].sort((a, b) => a - b);

      // Calculate gaps
      const gaps = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        gaps.push({
          from: sorted[i],
          to: sorted[i + 1],
          gap: sorted[i + 1] - sorted[i]
        });
      }
      // Wrap-around gap: (7 - last) + first
      const wrapGap = (7 - sorted[sorted.length - 1]) + sorted[0];
      gaps.push({
        from: sorted[sorted.length - 1],
        to: sorted[0],
        gap: wrapGap,
        isWrap: true
      });

      // Find worst gap
      const currentMaxGap = Math.max(...gaps.map(g => g.gap));

      if (currentMaxGap <= maxGap) {
        return { selectedDays: sorted, gapValid: true, gaps };
      }

      // Find the worst gap entry
      const worstGap = gaps.find(g => g.gap === currentMaxGap);

      // Find unselected working days that fall in the gap
      let candidatesInGap;
      if (worstGap.isWrap) {
        // Wrap-around: days after worstGap.from OR before worstGap.to
        candidatesInGap = this.WORKING_DAYS.filter(d =>
          !selectedDays.includes(d) && (d > worstGap.from || d < worstGap.to)
        );
      } else {
        candidatesInGap = this.WORKING_DAYS.filter(d =>
          !selectedDays.includes(d) && d > worstGap.from && d < worstGap.to
        );
      }

      if (candidatesInGap.length === 0) {
        // No working day can fill this gap, accept current selection
        return { selectedDays: sorted, gapValid: false, gaps };
      }

      // Pick the best-scored candidate in the gap
      candidatesInGap.sort((a, b) => {
        const scoreA = dayScores[a]?.score || 0;
        const scoreB = dayScores[b]?.score || 0;
        return scoreB - scoreA;
      });
      const newDay = candidatesInGap[0];

      // Remove the lowest-scored day from selected (excluding gap boundary days)
      const boundaryDays = new Set([worstGap.from, worstGap.to]);
      const removableDays = selectedDays
        .filter(d => !boundaryDays.has(d))
        .sort((a, b) => (dayScores[a]?.score || 0) - (dayScores[b]?.score || 0));

      if (removableDays.length === 0) {
        // Cannot swap, accept current
        return { selectedDays: sorted, gapValid: false, gaps };
      }

      const dayToRemove = removableDays[0];
      selectedDays = selectedDays.filter(d => d !== dayToRemove);
      selectedDays.push(newDay);
    }

    // Fallback after max iterations
    const sorted = [...selectedDays].sort((a, b) => a - b);
    return { selectedDays: sorted, gapValid: false };
  },

  // Analyze a single service point using the 3-step heuristic
  analyzeSP(spId, spTasks) {
    const zone = spTasks[0]?.zone || '';
    const assetTypes = spTasks[0]?.asset_types || '';

    // Overall stats
    const totalTasks = spTasks.length;
    const totalDone = spTasks.filter(t => t.task_status === 'Done').length;
    const totalVisited = spTasks.filter(t => t.task_status === 'Visited').length;
    const totalToDo = spTasks.filter(t => t.task_status === 'To Do').length;
    const overallRate = totalTasks > 0 ? totalDone / totalTasks : 0;

    // Current scheduled days
    const scheduledDays = new Set();
    for (const task of spTasks) {
      const dayNum = this.DAY_NAME_TO_NUM[task.day];
      if (dayNum) scheduledDays.add(dayNum);
    }
    const currentFrequency = scheduledDays.size;

    // STEP 1: Target frequency
    const freq = this.calcTargetFrequency(spTasks);

    // STEP 2: Day scores
    const { dayScores, rankedDays } = this.calcDayScores(spTasks);

    // STEP 3: Day selection with gap control
    const { selectedDays, gapValid } = this.selectDaysWithGapControl(
      freq.fFinal, rankedDays, dayScores
    );

    // Build day analysis (for UI compatibility)
    const dayAnalysis = {};
    const selectedDaySet = new Set(selectedDays);
    for (const dayNum of this.WORKING_DAYS) {
      const ds = dayScores[dayNum];
      if (ds.total === 0 && !scheduledDays.has(dayNum)) continue;

      const isSelected = selectedDaySet.has(dayNum);
      dayAnalysis[ds.dayName] = {
        total: ds.total,
        done: ds.done,
        visited: ds.visited,
        todo: ds.todo,
        rate: ds.score,
        score: ds.score,
        classification: isSelected ? 'good' : 'bad'
      };
    }

    // Determine good/removable days (as day names for UI compatibility)
    const goodDays = selectedDays.map(d => this.DAY_NUM_TO_NAME[d]);
    const removableDays = this.WORKING_DAYS
      .filter(d => scheduledDays.has(d) && !selectedDaySet.has(d))
      .map(d => this.DAY_NUM_TO_NAME[d]);

    const optimalFrequency = freq.fFinal;
    const canOptimize = optimalFrequency < currentFrequency && removableDays.length > 0;

    // Confidence based on total sample size
    let confidence;
    if (totalTasks >= this.CONFIDENCE_HIGH) {
      confidence = 'HIGH';
    } else if (totalTasks >= this.CONFIDENCE_MEDIUM) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';
    }

    // Savings calculation
    const removedTripsPerWeek = removableDays.length;
    const estimatedSavings = {
      trips: removedTripsPerWeek,
      tripsPerYear: removedTripsPerWeek * this.WEEKS_PER_YEAR,
      distance: removedTripsPerWeek * this.DISTANCE_PER_TRIP,
      time: removedTripsPerWeek * this.TIME_PER_TRIP,
      cost: removedTripsPerWeek * this.SAVING_PER_REMOVED_TRIP * this.WEEKS_PER_YEAR,
      weeklyCost: removedTripsPerWeek * this.SAVING_PER_REMOVED_TRIP,
      co2: removedTripsPerWeek * this.DISTANCE_PER_TRIP * this.CO2_PER_KM
    };

    return {
      sp_id: spId,
      zone,
      assetTypes,
      dayAnalysis,
      dayScores,
      currentFrequency,
      optimalFrequency,
      goodDays,
      removableDays,
      selectedDays: selectedDays.map(d => this.DAY_NUM_TO_NAME[d]),
      confidence,
      overallRate,
      canOptimize,
      totalTasks,
      totalDone,
      totalVisited,
      totalToDo,
      estimatedSavings,
      // Heuristic details for UI
      heuristic: {
        avgD: freq.avgD,
        maxD: freq.maxD,
        fBase: freq.fBase,
        fTemp: freq.fTemp,
        fFinal: freq.fFinal,
        todoRate: freq.todoRate,
        gapValid
      }
    };
  },

  // Compute summary statistics
  computeSummary(spAnalysis) {
    const allSPs = Object.values(spAnalysis);
    const totalSPs = allSPs.length;
    const optimizableSPs = allSPs.filter(sp => sp.canOptimize);
    const optimizableCount = optimizableSPs.length;

    // Average success rate
    const avgSuccessRate = totalSPs > 0
      ? allSPs.reduce((sum, sp) => sum + sp.overallRate, 0) / totalSPs
      : 0;

    // Confidence distribution
    const confidenceDistribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const sp of allSPs) {
      confidenceDistribution[sp.confidence]++;
    }

    // Day distribution (includes ToDo in completion rate)
    const dayDistribution = {};
    for (const day of DAY_ORDER) {
      let good = 0;
      let bad = 0;
      let totalDone = 0;
      let totalAll = 0;

      for (const sp of allSPs) {
        const da = sp.dayAnalysis[day];
        if (!da) continue;
        if (da.classification === 'good') good++;
        else bad++;
        totalDone += da.done;
        totalAll += da.done + da.visited + (da.todo || 0);
      }

      dayDistribution[day] = {
        good,
        bad,
        total: good + bad,
        rate: totalAll > 0 ? totalDone / totalAll : 0
      };
    }

    // Frequency distribution
    const freqDistribution = {};
    for (const sp of allSPs) {
      const f = sp.optimalFrequency;
      freqDistribution[f] = (freqDistribution[f] || 0) + 1;
    }

    // Total potential savings (all optimizable SPs)
    const potentialSavings = {
      tripsPerWeek: optimizableSPs.reduce((s, sp) => s + sp.estimatedSavings.trips, 0),
      tripsPerYear: optimizableSPs.reduce((s, sp) => s + (sp.estimatedSavings.tripsPerYear || 0), 0),
      distancePerWeek: optimizableSPs.reduce((s, sp) => s + sp.estimatedSavings.distance, 0),
      timePerWeek: optimizableSPs.reduce((s, sp) => s + sp.estimatedSavings.time, 0),
      costPerYear: optimizableSPs.reduce((s, sp) => s + sp.estimatedSavings.cost, 0),
      costPerWeek: optimizableSPs.reduce((s, sp) => s + (sp.estimatedSavings.weeklyCost || 0), 0),
      co2PerWeek: optimizableSPs.reduce((s, sp) => s + sp.estimatedSavings.co2, 0)
    };

    return {
      totalSPs,
      optimizableCount,
      avgSuccessRate,
      confidenceDistribution,
      dayDistribution,
      freqDistribution,
      potentialSavings
    };
  },

  // Get summary (must call analyze() first)
  getSummary() {
    return this.summary;
  },

  // Get optimizable SPs with filtering and sorting
  getOptimizable(options = {}) {
    if (!this.analysis) return [];

    let results = Object.values(this.analysis).filter(sp => sp.canOptimize);

    // Filter by confidence
    if (options.minConfidence) {
      const levels = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const minLevel = levels[options.minConfidence] || 0;
      results = results.filter(sp => levels[sp.confidence] >= minLevel);
    }

    // Filter by day (SPs that have this day as removable)
    if (options.day) {
      results = results.filter(sp => sp.removableDays.includes(options.day));
    }

    // Sort
    const sortBy = options.sortBy || 'savings';
    if (sortBy === 'savings') {
      results.sort((a, b) => b.estimatedSavings.cost - a.estimatedSavings.cost);
    } else if (sortBy === 'rate') {
      results.sort((a, b) => a.overallRate - b.overallRate);
    } else if (sortBy === 'confidence') {
      const levels = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      results.sort((a, b) => levels[b.confidence] - levels[a.confidence]);
    } else if (sortBy === 'frequency') {
      results.sort((a, b) => b.removableDays.length - a.removableDays.length);
    }

    return results;
  },

  // Get all analyzed SPs (including non-optimizable)
  getAll() {
    if (!this.analysis) return [];
    return Object.values(this.analysis);
  },

  // Calculate aggregate impact for selected SP IDs
  calculateImpact(selectedSpIds) {
    if (!this.analysis) return null;

    let totalTrips = 0;
    let totalDistance = 0;
    let totalTime = 0;
    let totalCost = 0;
    let totalCo2 = 0;
    let badDaysSet = new Set();

    for (const spId of selectedSpIds) {
      const sp = this.analysis[spId];
      if (!sp || !sp.canOptimize) continue;

      totalTrips += sp.estimatedSavings.trips;
      totalDistance += sp.estimatedSavings.distance;
      totalTime += sp.estimatedSavings.time;
      totalCost += sp.estimatedSavings.cost;
      totalCo2 += sp.estimatedSavings.co2;

      for (const day of sp.removableDays) {
        badDaysSet.add(day);
      }
    }

    return {
      selectedCount: selectedSpIds.length,
      totalOptimizable: this.getOptimizable().length,
      trips: totalTrips,
      distance: totalDistance,
      time: totalTime,
      cost: totalCost,
      co2: totalCo2,
      affectedDays: Array.from(badDaysSet)
    };
  },

  // Reset cached analysis (for reload)
  reset() {
    this.data = null;
    this.analysis = null;
    this.summary = null;
  }
};
