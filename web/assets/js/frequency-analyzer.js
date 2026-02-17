/* CIT Digital Twin - Frequency Analysis Engine */

const FrequencyAnalyzer = {
  // Constants
  SUCCESS_THRESHOLD: 0.70,
  CONFIDENCE_HIGH: 10,
  CONFIDENCE_MEDIUM: 5,
  SAVING_PER_REMOVED_TRIP: 1.5, // $ saving per removed SP trip
  WEEKS_PER_YEAR: 52,
  DISTANCE_PER_TRIP: 0.15,  // km avg per SP visit
  TIME_PER_TRIP: 2.5,       // minutes service time per SP
  CO2_PER_KM: 0.938,        // kg CO2e (2.68 kg/L at 0.35 L/km)

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

  // Analyze a single service point
  analyzeSP(spId, spTasks) {
    const zone = spTasks[0]?.zone || '';
    const assetTypes = spTasks[0]?.asset_types || '';

    // Group by day of week
    const dayAnalysis = {};
    const scheduledDays = new Set();

    for (const day of DAY_ORDER) {
      const dayTasks = spTasks.filter(t => t.day === day);
      if (dayTasks.length === 0) continue;

      scheduledDays.add(day);
      const total = dayTasks.length;
      const done = dayTasks.filter(t => t.task_status === 'Done').length;
      const visited = dayTasks.filter(t => t.task_status === 'Visited').length;
      const todo = dayTasks.filter(t => t.task_status === 'To Do').length;
      const rate = total > 0 ? done / total : 0;

      dayAnalysis[day] = {
        total,
        done,
        visited,
        todo,
        rate,
        classification: rate >= this.SUCCESS_THRESHOLD ? 'good' : 'bad'
      };
    }

    // Overall stats
    const totalTasks = spTasks.length;
    const totalDone = spTasks.filter(t => t.task_status === 'Done').length;
    const overallRate = totalTasks > 0 ? totalDone / totalTasks : 0;

    // Frequency calculations
    const currentFrequency = scheduledDays.size;
    const goodDays = Object.entries(dayAnalysis)
      .filter(([, d]) => d.classification === 'good')
      .map(([day]) => day);
    const badDays = Object.entries(dayAnalysis)
      .filter(([, d]) => d.classification === 'bad')
      .map(([day]) => day);
    const optimalFrequency = goodDays.length;

    // Confidence based on total sample size
    let confidence;
    if (totalTasks >= this.CONFIDENCE_HIGH) {
      confidence = 'HIGH';
    } else if (totalTasks >= this.CONFIDENCE_MEDIUM) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';
    }

    const canOptimize = badDays.length > 0 && optimalFrequency < currentFrequency;

    // Annual savings model:
    // removed trips per week * $1.5 * 52 weeks
    const removedTripsPerWeek = badDays.length;
    const removedTripsPerYear = removedTripsPerWeek * this.WEEKS_PER_YEAR;
    const estimatedSavings = {
      trips: removedTripsPerWeek,
      tripsPerYear: removedTripsPerYear,
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
      currentFrequency,
      optimalFrequency,
      goodDays,
      removableDays: badDays,
      confidence,
      overallRate,
      canOptimize,
      totalTasks,
      totalDone,
      estimatedSavings
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

    // Day distribution: for each day, how many SPs are good vs bad
    const dayDistribution = {};
    for (const day of DAY_ORDER) {
      let good = 0;
      let bad = 0;
      let totalRate = 0;
      let count = 0;

      for (const sp of allSPs) {
        const da = sp.dayAnalysis[day];
        if (!da) continue;
        if (da.classification === 'good') good++;
        else bad++;
        totalRate += da.rate;
        count++;
      }

      dayDistribution[day] = {
        good,
        bad,
        total: good + bad,
        rate: count > 0 ? totalRate / count : 0
      };
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
