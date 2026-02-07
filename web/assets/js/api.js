/* CIT Digital Twin - API Client */

const API = {
  baseUrl: '',

  // Generic fetch wrapper
  async request(url, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const mergedOptions = { ...defaultOptions, ...options };

    const response = await fetch(`${this.baseUrl}${url}`, mergedOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // GET request
  async get(url) {
    return this.request(url);
  },

  // POST request
  async post(url, data) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Load V0 baseline data
  async loadBaseline() {
    return this.get('/api/baseline/v0');
  },

  // Load all routes
  async loadRoutes() {
    return this.get('/api/routes');
  },

  // Load single route detail
  async loadRouteDetail(routeId) {
    return this.get(`/api/routes/${encodeURIComponent(routeId)}`);
  },

  // Load service points
  async loadServicePoints() {
    return this.get('/api/service-points');
  },

  // Load frequency recommendations
  async loadFrequencyRecommendations() {
    return this.get('/api/frequency-recommendations');
  },

  // Run route simulation with custom parameters
  async runSimulation(routeId, parameters) {
    return this.post('/api/simulate', { route_id: routeId, parameters });
  },

  // Create/run a scenario
  async runScenario(scenarioData) {
    return this.post('/api/scenarios', scenarioData);
  },

  // Load all scenarios
  async loadScenarios() {
    return this.get('/api/scenarios');
  },

  // Get scenario comparison
  async getComparison(baselineId, scenarioId) {
    return this.get(`/api/comparison?baseline=${baselineId}&scenario=${scenarioId}`);
  }
};

// Data cache
let dataCache = {
  baseline: null,
  routes: null,
  servicePoints: null,
  frequencies: null,
  scenarios: {}
};

// Load all initial data
const loadAllData = async () => {
  try {
    const [baseline, routes, servicePoints, frequencies] = await Promise.all([
      API.loadBaseline(),
      API.loadRoutes(),
      API.loadServicePoints(),
      API.loadFrequencyRecommendations()
    ]);

    dataCache.baseline = baseline;
    dataCache.routes = routes;
    dataCache.servicePoints = servicePoints;
    dataCache.frequencies = frequencies;

    console.log('All data loaded:', {
      baseline: !!baseline,
      routes: routes?.length || 0,
      servicePoints: servicePoints?.length || 0,
      frequencies: frequencies?.length || 0
    });

    return true;
  } catch (error) {
    console.error('Error loading data:', error);
    showNotification('Failed to load data. Check if the server is running.', 'error');
    return false;
  }
};

// Get cached data
const getBaseline = () => dataCache.baseline;
const getRoutes = () => dataCache.routes || [];
const getServicePoints = () => dataCache.servicePoints || [];
const getFrequencies = () => dataCache.frequencies || [];
const getScenarios = () => dataCache.scenarios;

// Get route by ID
const getRouteById = (routeId) => {
  const routes = getRoutes();
  return routes.find(r => r.route_id === routeId);
};

// Get routes grouped by day
const getRoutesByDay = () => {
  return groupBy(getRoutes(), 'day');
};

// Get daily aggregates
const getDailyAggregates = () => {
  const byDay = getRoutesByDay();
  return DAY_ORDER.map(day => {
    const routes = byDay[day] || [];
    return {
      day: day,
      routes: routes.length,
      done: sum(routes, 'tasks_done'),
      visited: sum(routes, 'tasks_visited'),
      todo: sum(routes, 'tasks_todo'),
      distance: sum(routes, 'total_distance_km'),
      time: sum(routes, 'total_time_minutes'),
      cost: sum(routes, 'total_cost'),
      co2: sum(routes, 'co2_emissions_kg'),
      rate: avg(routes, 'completion_rate')
    };
  });
};
