/* CIT Digital Twin - Scenario Management */

const Scenarios = {
  scenarios: {},
  scenarioCount: 0,

  // Create new scenario
  create(name, type, config) {
    this.scenarioCount++;
    const id = `v${this.scenarioCount}`;

    this.scenarios[id] = {
      id: id,
      name: name,
      type: type,
      config: config,
      createdAt: new Date().toISOString(),
      results: null,
      status: 'pending'
    };

    this.saveToStorage();
    return id;
  },

  // Get scenario by ID
  get(id) {
    return this.scenarios[id] || null;
  },

  // List all scenarios
  list() {
    return Object.values(this.scenarios).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  // Delete scenario
  delete(id) {
    delete this.scenarios[id];
    this.saveToStorage();
  },

  // Run scenario simulation
  async run(id) {
    const scenario = this.scenarios[id];
    if (!scenario) throw new Error(`Scenario ${id} not found`);

    scenario.status = 'running';
    this.saveToStorage();

    try {
      const result = await API.runScenario({
        name: scenario.name,
        type: scenario.type,
        config: scenario.config
      });

      scenario.results = result;
      scenario.status = 'completed';
      scenario.completedAt = new Date().toISOString();
      this.saveToStorage();
      return result;
    } catch (error) {
      scenario.status = 'failed';
      scenario.error = error.message;
      this.saveToStorage();
      throw error;
    }
  },

  // Get comparison data between baseline and scenario
  getComparison(scenarioId) {
    const scenario = this.get(scenarioId);
    if (!scenario || !scenario.results) return null;

    const baseline = getBaseline();
    if (!baseline) return null;

    const sr = scenario.results;

    const metrics = [
      {
        metric: 'Total Routes',
        baseline: baseline.routes || 33,
        scenario: sr.routes || 33,
        unit: '',
        lowerBetter: true
      },
      {
        metric: 'Done Tasks',
        baseline: baseline.done,
        scenario: sr.done,
        unit: '',
        lowerBetter: false
      },
      {
        metric: 'Visited Tasks',
        baseline: baseline.visited,
        scenario: sr.visited,
        unit: '',
        lowerBetter: true
      },
      {
        metric: 'To-Do Tasks',
        baseline: baseline.todo,
        scenario: sr.todo,
        unit: '',
        lowerBetter: true
      },
      {
        metric: 'Total Distance',
        baseline: baseline.distance,
        scenario: sr.distance,
        unit: 'km',
        lowerBetter: true
      },
      {
        metric: 'Total Time',
        baseline: baseline.time,
        scenario: sr.time,
        unit: 'min',
        lowerBetter: true
      },
      {
        metric: 'Total Cost',
        baseline: baseline.cost,
        scenario: sr.cost,
        unit: '$',
        lowerBetter: true
      },
      {
        metric: 'CO2 Emissions',
        baseline: baseline.co2,
        scenario: sr.co2,
        unit: 'kg',
        lowerBetter: true
      },
      {
        metric: 'Completion Rate',
        baseline: baseline.rate * 100,
        scenario: sr.rate * 100,
        unit: '%',
        lowerBetter: false
      }
    ];

    return metrics.map(m => {
      const delta = m.scenario - m.baseline;
      const pctChange = m.baseline !== 0 ? (delta / m.baseline) * 100 : 0;
      const improved = m.lowerBetter ? delta < 0 : delta > 0;
      return {
        ...m,
        delta: delta,
        pctChange: pctChange,
        improved: improved
      };
    });
  },

  // Get chart comparison data
  getChartData(scenarioId) {
    const scenario = this.get(scenarioId);
    if (!scenario || !scenario.results) return null;

    const baseline = getBaseline();
    const sr = scenario.results;

    return {
      versions: ['V0 (Baseline)', `${scenario.id.toUpperCase()} (${scenario.name})`],
      distances: [baseline.distance, sr.distance],
      costs: [baseline.cost, sr.cost],
      times: [baseline.time / 60, sr.time / 60],
      co2: [baseline.co2, sr.co2]
    };
  },

  // Generate recommendation text based on comparison
  getRecommendation(scenarioId) {
    const comparison = this.getComparison(scenarioId);
    if (!comparison) return 'No comparison data available.';

    const improvements = comparison.filter(m => m.improved);
    const regressions = comparison.filter(m => !m.improved && m.delta !== 0);

    const parts = [];

    if (improvements.length > 0) {
      const topImprovement = improvements.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))[0];
      parts.push(`The biggest improvement is in ${topImprovement.metric} with a ${Math.abs(topImprovement.pctChange).toFixed(1)}% ${topImprovement.lowerBetter ? 'reduction' : 'increase'}.`);
    }

    const costMetric = comparison.find(m => m.metric === 'Total Cost');
    if (costMetric && costMetric.delta < 0) {
      parts.push(`This scenario saves ${formatCurrency(Math.abs(costMetric.delta))} compared to baseline.`);
    }

    const co2Metric = comparison.find(m => m.metric === 'CO2 Emissions');
    if (co2Metric && co2Metric.delta < 0) {
      parts.push(`CO2 emissions are reduced by ${Math.abs(co2Metric.delta).toFixed(1)} kg.`);
    }

    if (regressions.length > 0) {
      parts.push(`Note: ${regressions.length} metric(s) show slight regression and should be monitored.`);
    }

    return parts.join(' ') || 'Scenario shows no significant changes from baseline.';
  },

  // Save to localStorage
  saveToStorage() {
    try {
      localStorage.setItem('cit_scenarios', JSON.stringify({
        scenarios: this.scenarios,
        count: this.scenarioCount
      }));
    } catch (e) {
      console.warn('Failed to save scenarios to localStorage:', e);
    }
  },

  // Load from localStorage
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('cit_scenarios');
      if (saved) {
        const data = JSON.parse(saved);
        this.scenarios = data.scenarios || {};
        this.scenarioCount = data.count || 0;
      }
    } catch (e) {
      console.warn('Failed to load scenarios from localStorage:', e);
    }
  },

  // Clear all scenarios
  clearAll() {
    this.scenarios = {};
    this.scenarioCount = 0;
    this.saveToStorage();
  }
};

// Load saved scenarios on script load
Scenarios.loadFromStorage();
