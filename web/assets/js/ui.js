/* CIT Digital Twin - UI Rendering & Navigation */

const UI = {
  currentPage: null,

  // Render sidebar
  renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">DT</div>
        <div class="sidebar-logo-text">
          <div class="sidebar-logo-title">CIT Digital Twin</div>
          <div class="sidebar-logo-subtitle">Route Optimization</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Dashboard</div>
          <div class="nav-item active" data-nav="route-selector" onclick="navigateToPage('route-selector')">
            <span class="nav-item-icon">&#128197;</span>
            <span class="nav-item-text">Route Selector</span>
          </div>
          <div class="nav-item" data-nav="v0-overview" onclick="navigateToPage('v0-overview')">
            <span class="nav-item-icon">&#9776;</span>
            <span class="nav-item-text">V0 Overview</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Routes</div>
          <div class="nav-collapse" id="routes-collapse">
            <div class="nav-collapse-item" onclick="UI.toggleCollapse('routes-collapse')">
              <span class="nav-item-icon">&#9670;</span>
              <span class="nav-item-text">Route Detail</span>
              <span class="collapse-icon">&#9654;</span>
            </div>
            <div class="nav-children" id="route-nav-list">
              <!-- Populated dynamically -->
            </div>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Analysis</div>
          <div class="nav-item" data-nav="what-if-analysis" onclick="navigateToPage('what-if-analysis')">
            <span class="nav-item-icon">&#9881;</span>
            <span class="nav-item-text">What-If Analysis</span>
          </div>
          <div class="nav-item" data-nav="comparison" onclick="navigateToPage('comparison')">
            <span class="nav-item-icon">&#9878;</span>
            <span class="nav-item-text">Comparison</span>
          </div>
        </div>
      </nav>

      <div class="sidebar-stats">
        <div class="sidebar-stats-title">Quick Stats</div>
        <div class="sidebar-stat">
          <span class="sidebar-stat-label">Routes</span>
          <span class="sidebar-stat-value" id="sidebar-routes">--</span>
        </div>
        <div class="sidebar-stat">
          <span class="sidebar-stat-label">Scenarios</span>
          <span class="sidebar-stat-value" id="sidebar-scenarios">0</span>
        </div>
        <div class="sidebar-stat">
          <span class="sidebar-stat-label">Avg Rate</span>
          <span class="sidebar-stat-value done" id="sidebar-rate">--</span>
        </div>
      </div>
    `;

    this.populateRouteNav();
  },

  // Populate route navigation items
  populateRouteNav() {
    const container = document.getElementById('route-nav-list');
    if (!container) return;

    const routes = getRoutes();
    const byDay = groupBy(routes, 'day');

    let html = '';
    DAY_ORDER.forEach(day => {
      const dayRoutes = byDay[day] || [];
      if (dayRoutes.length === 0) return;

      html += `<div class="nav-child-item" style="color:var(--text-muted);font-weight:600;padding-left:32px;font-size:11px;text-transform:uppercase;cursor:default;">${day}</div>`;
      dayRoutes.forEach(route => {
        html += `
          <div class="nav-child-item" data-nav="route-${route.route_id}"
               onclick="navigateToPage('route-detail', {id: '${route.route_id}'})">
            <span class="nav-child-item-dot"></span>
            ${route.route_name}
          </div>
        `;
      });
    });

    container.innerHTML = html;
  },

  // Toggle collapse
  toggleCollapse(collapseId) {
    const el = document.getElementById(collapseId);
    if (el) el.classList.toggle('open');
  },

  // Render header
  renderHeader(title, subtitle = '') {
    const header = document.getElementById('header');
    header.innerHTML = `
      <div class="header-left">
        <button class="mobile-menu-btn" onclick="UI.toggleMobileSidebar()">
          <span class="mobile-menu-icon"></span>
        </button>
        <h1>${title}</h1>
        ${subtitle ? `<p class="subtitle" style="margin-bottom:0">${subtitle}</p>` : ''}
      </div>
      <div class="header-right">
        <span class="header-badge active">V0 Baseline</span>
        <span class="header-badge">${Scenarios.list().length} Scenarios</span>
      </div>
    `;
  },

  // Mobile sidebar toggle
  toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');

    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = createElement('div', { className: 'sidebar-overlay' });
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
      document.body.appendChild(overlay);
    }
    overlay.classList.toggle('show');
  },

  // Update sidebar stats
  updateSidebarStats() {
    const baseline = getBaseline();
    if (!baseline) return;

    const routesEl = document.getElementById('sidebar-routes');
    const scenariosEl = document.getElementById('sidebar-scenarios');
    const rateEl = document.getElementById('sidebar-rate');

    if (routesEl) routesEl.textContent = baseline.routes || getRoutes().length;
    if (scenariosEl) scenariosEl.textContent = Scenarios.list().length;
    if (rateEl) rateEl.textContent = formatPercentage(baseline.rate);
  },

  // Render KPI cards
  renderKPICards(containerId, kpis) {
    const container = document.getElementById(containerId) || document.querySelector(containerId);
    if (!container) return;

    container.innerHTML = kpis.map(kpi => `
      <div class="kpi-card ${kpi.status || ''} ${kpi.clickable ? 'clickable' : ''}"
           ${kpi.onclick ? `onclick="${kpi.onclick}"` : ''}>
        <div class="kpi-header">
          <div class="kpi-icon">${kpi.icon || ''}</div>
          ${kpi.trend ? `<div class="kpi-trend ${kpi.trend.direction}">${kpi.trend.icon} ${kpi.trend.value}</div>` : ''}
        </div>
        <div class="kpi-body">
          <div class="kpi-label">${kpi.label}</div>
          <div class="kpi-value">${kpi.value}</div>
          ${kpi.subtext ? `<div class="kpi-subtext">${kpi.subtext}</div>` : ''}
        </div>
      </div>
    `).join('');
  },

  // Render routes table
  renderRoutesTable(routes) {
    const tbody = document.querySelector('#routes-table tbody');
    if (!tbody) return;

    tbody.innerHTML = routes.map(route => {
      const rate = route.completion_rate || route.rate || 0;
      const ratePercent = rate > 1 ? rate : rate * 100;
      const rateClass = getRateClass(ratePercent / 100);

      return `
        <tr class="clickable" onclick="navigateToPage('route-detail', {id: '${route.route_id}'})">
          <td><strong>${route.route_name}</strong></td>
          <td>${route.day}</td>
          <td>${route.vehicle_id || '--'}</td>
          <td class="numeric text-done">${route.tasks_done || 0}</td>
          <td class="numeric text-visited">${route.tasks_visited || 0}</td>
          <td class="numeric text-todo">${route.tasks_todo || 0}</td>
          <td class="numeric">${formatDistance(route.total_distance_km || 0)}</td>
          <td class="numeric">${formatTime(route.total_time_minutes || 0)}</td>
          <td class="numeric">${formatCurrency(route.total_cost || 0)}</td>
          <td>
            <div class="rate-cell">
              <div class="rate-bar"><div class="rate-fill ${rateClass}" style="width:${ratePercent}%"></div></div>
              <span class="rate-value">${ratePercent.toFixed(1)}%</span>
            </div>
          </td>
          <td class="col-actions">
            <button class="table-action-btn" onclick="event.stopPropagation(); navigateToPage('route-detail', {id: '${route.route_id}'})">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Load page content via fetch
  async loadPage(pageName) {
    const content = document.getElementById('content');
    if (!content) return;

    this.currentPage = pageName;

    // Show loading
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const response = await fetch(`/pages/${pageName}.html`);
      if (!response.ok) throw new Error(`Page not found: ${pageName}`);
      const html = await response.text();
      content.innerHTML = html;

      // Initialize page-specific logic
      const initFn = PageControllers[pageName];
      if (initFn) {
        await initFn();
      }
    } catch (error) {
      console.error('Error loading page:', error);
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9888;</div>
          <div class="empty-state-title">Page Not Found</div>
          <div class="empty-state-text">Could not load "${pageName}". Please try again.</div>
          <button class="btn-primary mt-20" onclick="navigateToPage('v0-overview')">Go to Overview</button>
        </div>
      `;
    }
  }
};

// Page Controllers - initialization logic for each page
const PageControllers = {
  'route-selector': async () => {
    // Render header
    UI.renderHeader('Route Selection', 'Choose a route instance to analyze');

    // Get Zone 2 B routes
    const routes = getRoutes();
    const zone2bRoutes = routes.filter(r => r.route_name === 'Zone 2 B (Day)');

    // Sort by date
    zone2bRoutes.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Render the date selector table
    const tbody = document.getElementById('date-selector-body');
    if (tbody) {
      tbody.innerHTML = zone2bRoutes.map(route => {
        const rate = route.completion_rate || route.rate || 0;
        const ratePercent = rate > 1 ? rate : rate * 100;
        const rateClass = getRateClass(ratePercent / 100);
        const totalTasks = route.tasks_done + route.tasks_visited + route.tasks_todo;

        return `
          <tr onclick="navigateToPage('route-detail', {id: '${route.route_id}'})">
            <td><strong>${formatDateFull(route.date)}</strong></td>
            <td>${route.day}</td>
            <td>${route.route_name}</td>
            <td class="numeric">${totalTasks}</td>
            <td class="numeric text-done">${route.tasks_done}</td>
            <td class="numeric text-visited">${route.tasks_visited}</td>
            <td>
              <div class="rate-cell">
                <div class="rate-bar"><div class="rate-fill ${rateClass}" style="width:${ratePercent}%"></div></div>
                <span class="rate-value">${ratePercent.toFixed(1)}%</span>
              </div>
            </td>
            <td class="col-actions">
              <button class="btn-select" onclick="event.stopPropagation(); navigateToPage('route-detail', {id: '${route.route_id}'})">
                SELECT
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  },

  'v0-overview': async () => {
    const baseline = getBaseline();
    const routes = getRoutes();

    if (!baseline || !routes.length) {
      showNotification('Data not loaded yet. Please wait...', 'warning');
      return;
    }

    // Render header
    UI.renderHeader('V0 Baseline Overview', 'Week of Jan 6-11, 2026 | All 33 Routes | 5 Days');

    // Render KPI cards
    UI.renderKPICards('kpi-grid-overview', [
      {
        icon: '&#10003;',
        label: 'Done Tasks',
        value: formatNumber(baseline.done),
        subtext: `${formatPercentage(baseline.done / (baseline.done + baseline.visited + baseline.todo))} of total`,
        status: 'done'
      },
      {
        icon: '&#9673;',
        label: 'Visited Tasks',
        value: formatNumber(baseline.visited),
        subtext: `${formatPercentage(baseline.visited / (baseline.done + baseline.visited + baseline.todo))} of total`,
        status: 'visited'
      },
      {
        icon: '&#9744;',
        label: 'To-Do Tasks',
        value: formatNumber(baseline.todo),
        subtext: `${formatPercentage(baseline.todo / (baseline.done + baseline.visited + baseline.todo))} of total`,
        status: 'todo'
      },
      {
        icon: '&#9672;',
        label: 'Total Distance',
        value: formatDistance(baseline.distance),
        subtext: `${formatDecimal(baseline.distance / (baseline.routes || 1), 1)} km/route avg`,
        status: 'info'
      },
      {
        icon: '$',
        label: 'Total Cost',
        value: formatCurrency(baseline.cost),
        subtext: `${formatCurrency(baseline.cost / (baseline.routes || 1))} per route avg`,
        status: 'info'
      },
      {
        icon: '&#9729;',
        label: 'CO2 Emissions',
        value: formatCO2(baseline.co2),
        subtext: `Completion rate: ${formatPercentage(baseline.rate)}`,
        status: 'info'
      }
    ]);

    // Render routes table
    UI.renderRoutesTable(routes);

    // Render charts
    const dailyData = getDailyAggregates();
    Charts.initDailyCompletion({
      days: dailyData.map(d => d.day),
      done: dailyData.map(d => d.done),
      visited: dailyData.map(d => d.visited),
      todo: dailyData.map(d => d.todo)
    });

    // Zone performance from routes
    const zones = [...new Set(routes.map(r => r.zone || 'Unknown'))];
    const zoneRates = zones.map(zone => {
      const zoneRoutes = routes.filter(r => (r.zone || 'Unknown') === zone);
      const avgRate = avg(zoneRoutes, 'completion_rate') * 100;
      return { zone, rate: avgRate };
    }).sort((a, b) => b.rate - a.rate);

    Charts.initZonePerformance({
      zones: zoneRates.map(z => z.zone),
      rates: zoneRates.map(z => z.rate)
    });
  },

  'route-detail': async () => {
    const { params } = getPageParams();
    const routeId = params.id;

    if (!routeId) {
      navigateToPage('route-selector');
      return;
    }

    const route = getRouteById(routeId);
    if (!route) {
      showNotification(`Route "${routeId}" not found`, 'error');
      navigateToPage('route-selector');
      return;
    }

    // Store current route for simulation
    window.currentRouteId = routeId;

    // Update header
    const totalTasks = route.tasks_done + route.tasks_visited + route.tasks_todo;
    UI.renderHeader(route.route_name, `${route.day} | Vehicle: ${route.vehicle_id} | ${totalTasks} tasks`);

    // Set route name in page
    const routeNameEl = document.getElementById('route-name');
    const routeMetaEl = document.getElementById('route-meta');
    if (routeNameEl) routeNameEl.textContent = route.route_name;
    if (routeMetaEl) routeMetaEl.textContent = `${route.day} | Vehicle: ${route.vehicle_id} | ${totalTasks} tasks`;

    // Render 8 KPI cards
    const rate = route.completion_rate || route.rate || 0;
    const utilization = (route.tasks_done * 550) / 20000; // rough estimate
    UI.renderKPICards('route-kpi-grid', [
      { icon: '&#10003;', label: 'Done', value: formatNumber(route.tasks_done), subtext: `${formatPercentage(route.tasks_done / totalTasks)} of total`, status: 'done' },
      { icon: '&#9673;', label: 'Visited', value: formatNumber(route.tasks_visited), subtext: 'Failed attempts', status: 'visited' },
      { icon: '&#9744;', label: 'To-Do', value: formatNumber(route.tasks_todo), subtext: 'Not attempted', status: 'todo' },
      { icon: '&#9672;', label: 'Distance', value: formatDistance(route.total_distance_km), subtext: 'Total route', status: 'info' },
      { icon: '&#9201;', label: 'Time', value: formatTime(route.total_time_minutes), subtext: 'Including breaks', status: 'info' },
      { icon: '&#128203;', label: 'Tasks', value: formatNumber(totalTasks), subtext: 'Total planned', status: 'info' },
      { icon: '$', label: 'Cost', value: formatCurrency(route.total_cost), subtext: 'All inclusive', status: 'info' },
      { icon: '&#9889;', label: 'Utilization', value: formatPercentage(Math.min(utilization, 1)), subtext: 'Vehicle capacity', status: utilization >= 0.7 ? 'done' : 'visited' }
    ]);

    // Render status distribution bar
    const doneBar = document.getElementById('status-done-bar');
    const visitedBar = document.getElementById('status-visited-bar');
    const todoBar = document.getElementById('status-todo-bar');
    const donePct = document.getElementById('status-done-pct');
    const visitedPct = document.getElementById('status-visited-pct');
    const todoPct = document.getElementById('status-todo-pct');

    if (doneBar && totalTasks > 0) {
      const donePctVal = (route.tasks_done / totalTasks) * 100;
      const visitedPctVal = (route.tasks_visited / totalTasks) * 100;
      const todoPctVal = (route.tasks_todo / totalTasks) * 100;

      doneBar.style.width = `${donePctVal}%`;
      visitedBar.style.width = `${visitedPctVal}%`;
      todoBar.style.width = `${todoPctVal}%`;

      if (donePct) donePct.textContent = `(${donePctVal.toFixed(1)}%)`;
      if (visitedPct) visitedPct.textContent = `(${visitedPctVal.toFixed(1)}%)`;
      if (todoPct) todoPct.textContent = `(${todoPctVal.toFixed(1)}%)`;
    }

    // Render service points count label
    const spCountLabel = document.getElementById('sp-count-label');
    if (spCountLabel && route.service_points) {
      spCountLabel.textContent = `${route.service_points.length} service points`;
    }

    // Render paginated service points list
    if (route.service_points) {
      renderServicePointsWithPagination(route.service_points, route.zone, 1, 10);
    }
  },

  'what-if-analysis': async () => {
    UI.renderHeader('What-If Scenario Planner', 'Analyze impact of removing visited tasks');

    // Get the current route or default to first Zone 2 B route
    const routeId = window.currentRouteId || 'Z2-B-Day-Tue';
    const routes = getRoutes();
    const zone2bRoutes = routes.filter(r => r.route_name === 'Zone 2 B (Day)');
    const currentRoute = getRouteById(routeId) || zone2bRoutes[0];

    // Populate base route dropdown
    const baseRouteSelect = document.getElementById('base-route-select');
    if (baseRouteSelect) {
      baseRouteSelect.innerHTML = zone2bRoutes.map(r =>
        `<option value="${r.route_id}" ${r.route_id === routeId ? 'selected' : ''}>${formatDateFull(r.date)} - ${r.day}</option>`
      ).join('');

      baseRouteSelect.addEventListener('change', (e) => {
        window.currentRouteId = e.target.value;
        loadVisitedTasksTable(e.target.value);
      });
    }

    // Store baseline metrics
    if (currentRoute) {
      window.baselineMetrics = calculateRouteMetrics(currentRoute);
      updateImpactPreview([], currentRoute);
    }

    // Load visited tasks table
    loadVisitedTasksTable(routeId);

    // Load saved scenarios list
    loadSavedScenariosList();
  },

  'comparison': async () => {
    UI.renderHeader('Scenario Comparison', 'Compare V0 Baseline with optimized scenarios');

    // Populate scenario selector
    const scenarioSelect = document.getElementById('scenario-version');
    if (scenarioSelect) {
      const scenarios = Scenarios.list();
      scenarioSelect.innerHTML = scenarios.length ?
        '<option value="">-- Select a scenario --</option>' +
        scenarios.map(s => `<option value="${s.id}">${s.id.toUpperCase()} - ${s.name}</option>`).join('') :
        '<option value="" disabled>No scenarios yet. Create one in What-If Analysis.</option>';

      // Auto-select first if available
      if (scenarios.length > 0) {
        scenarioSelect.value = scenarios[0].id;
        updateComparisonTable();
      }
    }
  }
};

// Task Adjustment Table
function loadTaskAdjustmentTable() {
  const routes = getRoutes();
  const tbody = document.querySelector('#task-adjustment-table tbody');
  if (!tbody) return;

  let rows = [];
  routes.forEach(route => {
    if (route.service_points) {
      route.service_points.forEach(sp => {
        const status = sp.status || 'Done';
        if (status === 'Visited' || status === 'To-Do') {
          rows.push({
            route_name: route.route_name,
            day: route.day,
            sp_id: sp.sp_id || sp.id || sp,
            status: status,
            route_id: route.route_id
          });
        }
      });
    }
  });

  // Limit for display
  const displayRows = rows.slice(0, 100);

  tbody.innerHTML = displayRows.map((row, idx) => `
    <tr>
      <td>${row.route_name}</td>
      <td>${row.day}</td>
      <td>${row.sp_id}</td>
      <td><span class="status-badge ${getStatusClass(row.status)}">${row.status}</span></td>
      <td class="col-center"><input type="checkbox" name="task-select" value="${idx}" data-route="${row.route_id}" data-sp="${row.sp_id}"></td>
    </tr>
  `).join('');

  // Apply filters
  const filterDay = document.getElementById('filter-day');
  const filterRoute = document.getElementById('filter-route');

  const applyFilters = () => {
    const dayFilter = filterDay?.value || '';
    const routeFilter = filterRoute?.value || '';

    const filtered = rows.filter(r => {
      if (dayFilter && r.day !== dayFilter) return false;
      if (routeFilter && r.route_name !== routeFilter) return false;
      return true;
    }).slice(0, 100);

    tbody.innerHTML = filtered.map((row, idx) => `
      <tr>
        <td>${row.route_name}</td>
        <td>${row.day}</td>
        <td>${row.sp_id}</td>
        <td><span class="status-badge ${getStatusClass(row.status)}">${row.status}</span></td>
        <td class="col-center"><input type="checkbox" name="task-select" value="${idx}" data-route="${row.route_id}" data-sp="${row.sp_id}"></td>
      </tr>
    `).join('');
  };

  if (filterDay) filterDay.addEventListener('change', applyFilters);
  if (filterRoute) filterRoute.addEventListener('change', applyFilters);
}

// Frequency Table
function loadFrequencyTable() {
  const frequencies = getFrequencies();
  const tbody = document.querySelector('#frequency-optimization-table tbody');
  if (!tbody) return;

  tbody.innerHTML = frequencies.map((freq, idx) => `
    <tr>
      <td>${freq.sp_id}</td>
      <td>${freq.zone}</td>
      <td>${freq.current_freq}</td>
      <td><strong style="color:var(--accent-blue)">${freq.recommended_freq}</strong></td>
      <td>
        <div class="rate-cell">
          <div class="rate-bar"><div class="rate-fill ${getRateClass(freq.fill_rate)}" style="width:${freq.fill_rate * 100}%"></div></div>
          <span class="rate-value">${formatPercentage(freq.fill_rate)}</span>
        </div>
      </td>
      <td class="col-center"><input type="checkbox" name="freq-select" value="${idx}" data-sp="${freq.sp_id}"></td>
    </tr>
  `).join('');
}

// Render comparison table and charts
function renderComparison(scenarioId) {
  const comparison = Scenarios.getComparison(scenarioId);
  if (!comparison) {
    showNotification('No comparison data available', 'warning');
    return;
  }

  // Render comparison table
  const tbody = document.querySelector('#comparison-table tbody');
  if (tbody) {
    tbody.innerHTML = comparison.map(m => {
      const deltaClass = m.improved ? 'positive' : m.delta !== 0 ? 'negative' : 'neutral';
      const formatVal = (v) => {
        if (m.unit === '$') return formatCurrency(v);
        if (m.unit === '%') return `${v.toFixed(1)}%`;
        if (m.unit === 'km') return `${v.toFixed(1)} km`;
        if (m.unit === 'min') return formatTime(v);
        if (m.unit === 'kg') return `${v.toFixed(1)} kg`;
        return formatNumber(v);
      };

      return `
        <tr>
          <td><strong>${m.metric}</strong></td>
          <td class="numeric">${formatVal(m.baseline)}</td>
          <td class="numeric">${formatVal(m.scenario)}</td>
          <td class="numeric delta ${deltaClass}">${formatVal(m.delta)}</td>
          <td class="numeric delta ${deltaClass}">${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
  }

  // Render charts
  const chartData = Scenarios.getChartData(scenarioId);
  if (chartData) {
    Charts.initComparisonCharts(chartData);
  }

  // Render recommendation
  const recText = document.getElementById('recommendation-text');
  if (recText) {
    recText.textContent = Scenarios.getRecommendation(scenarioId);
  }
}

// Toggle parameter section
function toggleParamSection(sectionName) {
  const section = document.querySelector(`.param-section[data-section="${sectionName}"]`);
  if (section) {
    section.classList.toggle('open');
  }
}

// Render service points with pagination
function renderServicePointsWithPagination(servicePoints, defaultZone, currentPage = 1, pageSize = 10) {
  const spContainer = document.getElementById('sp-list-container');
  const paginationContainer = document.getElementById('sp-pagination');
  if (!spContainer) return;

  const totalItems = servicePoints.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pageItems = servicePoints.slice(startIdx, endIdx);

  // Render table
  spContainer.innerHTML = `
    <div class="table-container table-scroll" style="max-height: 400px;">
      <table class="compact">
        <thead>
          <tr>
            <th class="col-center">#</th>
            <th>Service Point</th>
            <th>Status</th>
            <th>Type</th>
            <th class="numeric">Weight</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems.map((sp, idx) => {
            const rowClass = sp.status === 'Visited' ? 'row-visited' : sp.status === 'Todo' ? 'row-todo' : '';
            return `
              <tr class="${rowClass}">
                <td class="col-center text-muted">${startIdx + idx + 1}</td>
                <td><strong>${sp.sp_id || sp.id || sp}</strong></td>
                <td><span class="status-badge ${getStatusClass(sp.status || 'Done')}">${sp.status || 'Done'}</span></td>
                <td>${sp.container_type || '1100L'}</td>
                <td class="numeric">${sp.weight_kg ? sp.weight_kg + ' kg' : '--'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Render pagination controls
  if (paginationContainer) {
    const pageButtons = [];
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(`
        <button class="pagination-btn ${i === currentPage ? 'active' : ''}"
                onclick="renderServicePointsWithPagination(getRouteById('${window.currentRouteId}').service_points, '${defaultZone}', ${i}, ${pageSize})">
          ${i}
        </button>
      `);
    }

    paginationContainer.innerHTML = `
      <div class="pagination-info">
        Showing ${startIdx + 1}-${endIdx} of ${totalItems} service points
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" onclick="renderServicePointsWithPagination(getRouteById('${window.currentRouteId}').service_points, '${defaultZone}', 1, ${pageSize})" ${currentPage === 1 ? 'disabled' : ''}>
          First
        </button>
        <button class="pagination-btn" onclick="renderServicePointsWithPagination(getRouteById('${window.currentRouteId}').service_points, '${defaultZone}', ${currentPage - 1}, ${pageSize})" ${currentPage === 1 ? 'disabled' : ''}>
          Prev
        </button>
        ${pageButtons.join('')}
        <button class="pagination-btn" onclick="renderServicePointsWithPagination(getRouteById('${window.currentRouteId}').service_points, '${defaultZone}', ${currentPage + 1}, ${pageSize})" ${currentPage === totalPages ? 'disabled' : ''}>
          Next
        </button>
        <button class="pagination-btn" onclick="renderServicePointsWithPagination(getRouteById('${window.currentRouteId}').service_points, '${defaultZone}', ${totalPages}, ${pageSize})" ${currentPage === totalPages ? 'disabled' : ''}>
          Last
        </button>
      </div>
    `;
  }
}

// Parameter adjustment helper
function adjustParameter(paramId, delta) {
  const input = document.getElementById(paramId);
  if (!input) return;
  const newVal = parseFloat(input.value) + delta;
  const minVal = parseFloat(input.min) || 0;
  const maxVal = parseFloat(input.max) || 999999;
  input.value = Math.max(minVal, Math.min(maxVal, newVal));
}

// Reset parameters
function resetParameters() {
  // Time & Traffic
  const startTime = document.getElementById('start-time');
  const endTime = document.getElementById('end-time');
  const speed = document.getElementById('speed');
  const breakDuration = document.getElementById('break-duration');

  if (startTime) startTime.value = '09:00';
  if (endTime) endTime.value = '17:00';
  if (speed) speed.value = 35;
  if (breakDuration) breakDuration.value = 60;

  // Costs
  const fuelConsumption = document.getElementById('fuel-consumption');
  const fuelPrice = document.getElementById('fuel-price');
  const laborRate = document.getElementById('labor-rate');
  const disposalCost = document.getElementById('disposal-cost');

  if (fuelConsumption) fuelConsumption.value = 6.0;
  if (fuelPrice) fuelPrice.value = 1.50;
  if (laborRate) laborRate.value = 25;
  if (disposalCost) disposalCost.value = 15;

  // Service Time
  const serviceTime = document.getElementById('service-time');
  if (serviceTime) serviceTime.value = 2.5;

  // Vehicle & Capacity
  const capacity = document.getElementById('capacity');
  const weight1100L = document.getElementById('weight-1100L');
  const weight240L = document.getElementById('weight-240L');

  if (capacity) capacity.value = 20000;
  if (weight1100L) weight1100L.value = 550;
  if (weight240L) weight240L.value = 120;

  // Disposal
  const disposalTime = document.getElementById('disposal-time');
  if (disposalTime) disposalTime.value = 15;

  // Hide simulation results
  const resultsSection = document.getElementById('simulation-results');
  if (resultsSection) resultsSection.classList.add('hidden');

  showNotification('Parameters reset to defaults', 'info');
}

// Run route simulation
async function runRouteSimulation() {
  const routeId = window.currentRouteId;
  if (!routeId) {
    showNotification('No route selected', 'error');
    return;
  }

  // Gather all parameters from the form
  const parameters = {
    speed: parseFloat(document.getElementById('speed')?.value || 35),
    service_time: parseFloat(document.getElementById('service-time')?.value || 2.5),
    capacity: parseFloat(document.getElementById('capacity')?.value || 20000),
    start_time: document.getElementById('start-time')?.value || '09:00',
    end_time: document.getElementById('end-time')?.value || '17:00',
    break_duration: parseFloat(document.getElementById('break-duration')?.value || 60),
    fuel_consumption: parseFloat(document.getElementById('fuel-consumption')?.value || 6.0),
    fuel_price: parseFloat(document.getElementById('fuel-price')?.value || 1.50),
    labor_rate: parseFloat(document.getElementById('labor-rate')?.value || 25),
    disposal_cost: parseFloat(document.getElementById('disposal-cost')?.value || 15),
    disposal_time: parseFloat(document.getElementById('disposal-time')?.value || 15),
    weight_1100L: parseFloat(document.getElementById('weight-1100L')?.value || 550),
    weight_240L: parseFloat(document.getElementById('weight-240L')?.value || 120)
  };

  showNotification('Running simulation...', 'info');

  try {
    const result = await API.runSimulation(routeId, parameters);
    showNotification('Simulation completed!', 'success');

    if (result) {
      // Update KPIs with result
      const totalTasks = result.done + result.visited + result.todo;
      UI.renderKPICards('route-kpi-grid', [
        { icon: '&#10003;', label: 'Done', value: formatNumber(result.done || 0), subtext: `${formatPercentage(result.done / totalTasks)} of total`, status: 'done' },
        { icon: '&#9673;', label: 'Visited', value: formatNumber(result.visited || 0), subtext: 'Failed attempts', status: 'visited' },
        { icon: '&#9744;', label: 'To-Do', value: formatNumber(result.todo || 0), subtext: 'Not attempted', status: 'todo' },
        { icon: '&#9672;', label: 'Distance', value: formatDistance(result.distance), subtext: 'Total route', status: 'info' },
        { icon: '&#9201;', label: 'Time', value: formatTime(result.total_time), subtext: 'Including breaks', status: 'info' },
        { icon: '&#128203;', label: 'Tasks', value: formatNumber(totalTasks), subtext: 'Total planned', status: 'info' },
        { icon: '$', label: 'Cost', value: formatCurrency(result.total_cost), subtext: 'All inclusive', status: 'info' },
        { icon: '&#9889;', label: 'Utilization', value: formatPercentage(result.utilization), subtext: 'Vehicle capacity', status: result.utilization >= 0.7 ? 'done' : 'visited' }
      ]);

      // Show and update simulation results section
      const resultsSection = document.getElementById('simulation-results');
      if (resultsSection) {
        resultsSection.classList.remove('hidden');

        // Operational metrics
        const outTravelTime = document.getElementById('out-travel-time');
        const outServiceTime = document.getElementById('out-service-time');
        const outTotalTime = document.getElementById('out-total-time');
        const outDistance = document.getElementById('out-distance');

        if (outTravelTime) outTravelTime.textContent = formatTime(result.travel_time);
        if (outServiceTime) outServiceTime.textContent = formatTime(result.service_time);
        if (outTotalTime) outTotalTime.textContent = formatTime(result.total_time);
        if (outDistance) outDistance.textContent = formatDistance(result.distance);

        // Financial metrics
        const outFuelCost = document.getElementById('out-fuel-cost');
        const outLaborCost = document.getElementById('out-labor-cost');
        const outTotalCost = document.getElementById('out-total-cost');

        if (outFuelCost) outFuelCost.textContent = formatCurrency(result.fuel_cost);
        if (outLaborCost) outLaborCost.textContent = formatCurrency(result.labor_cost);
        if (outTotalCost) outTotalCost.textContent = formatCurrency(result.total_cost);

        // Environmental metrics
        const outFuelUsed = document.getElementById('out-fuel-used');
        const outCo2 = document.getElementById('out-co2');
        const outUtilization = document.getElementById('out-utilization');

        if (outFuelUsed) outFuelUsed.textContent = `${result.fuel_used} L`;
        if (outCo2) outCo2.textContent = formatCO2(result.co2);
        if (outUtilization) outUtilization.textContent = formatPercentage(result.utilization);
      }
    }
  } catch (error) {
    showNotification('Simulation failed: ' + error.message, 'error');
  }
}

// Run scenario simulation
async function runScenarioSimulation(type) {
  const nameInput = document.getElementById('scenario-name');
  const name = nameInput?.value?.trim();
  if (!name) {
    showNotification('Please enter a scenario name', 'warning');
    nameInput?.focus();
    return;
  }

  let config = {};

  if (type === 'task-adjustment') {
    const checked = document.querySelectorAll('input[name="task-select"]:checked');
    if (checked.length === 0) {
      showNotification('Please select at least one task to adjust', 'warning');
      return;
    }
    config.selected_tasks = Array.from(checked).map(cb => ({
      route_id: cb.dataset.route,
      sp_id: cb.dataset.sp
    }));
    config.action = 'remove';
  } else {
    const checked = document.querySelectorAll('input[name="freq-select"]:checked');
    if (checked.length === 0) {
      showNotification('Please select at least one service point', 'warning');
      return;
    }
    config.selected_sps = Array.from(checked).map(cb => cb.dataset.sp);
  }

  showNotification('Creating scenario and running simulation...', 'info');

  try {
    const scenarioId = Scenarios.create(name, type, config);
    await Scenarios.run(scenarioId);
    showNotification(`Scenario ${scenarioId.toUpperCase()} created!`, 'success');
    UI.updateSidebarStats();

    // Offer to navigate to comparison
    setTimeout(() => {
      if (confirm(`Scenario ${scenarioId.toUpperCase()} completed. View comparison?`)) {
        navigateToPage('comparison');
      }
    }, 500);
  } catch (error) {
    showNotification('Scenario failed: ' + error.message, 'error');
  }
}

// Calculate route metrics from route data
function calculateRouteMetrics(route) {
  const totalTasks = route.tasks_done + route.tasks_visited + route.tasks_todo;
  const distance = route.total_distance_km || 45;
  const totalTime = route.total_time_minutes || 480;
  const serviceTime = (route.tasks_done + route.tasks_visited) * 2.5;
  const travelTime = totalTime - serviceTime - 60; // minus break

  // Cost calculations
  const fuelConsumption = 6.0; // km/L
  const fuelPrice = 1.50;
  const laborRate = 25;
  const fuelUsed = distance / fuelConsumption;
  const fuelCost = fuelUsed * fuelPrice;
  const laborCost = (totalTime / 60) * laborRate;
  const totalCost = route.total_cost || (fuelCost + laborCost + 15);

  // CO2: 2.31 kg per liter of diesel
  const co2 = fuelUsed * 2.31;

  return {
    tasks: totalTasks,
    sps: route.service_points ? route.service_points.length : totalTasks,
    distance,
    time: totalTime,
    travelTime,
    serviceTime,
    fuelCost,
    laborCost,
    totalCost,
    fuelUsed,
    co2
  };
}

// Load visited tasks table
function loadVisitedTasksTable(routeId) {
  const route = getRouteById(routeId);
  if (!route || !route.service_points) return;

  const visitedTasks = route.service_points.filter(sp => sp.status === 'Visited');
  const tbody = document.getElementById('visited-tasks-body');
  const countLabel = document.getElementById('visited-count-label');

  if (countLabel) {
    countLabel.textContent = `(${visitedTasks.length} tasks)`;
  }

  if (tbody) {
    tbody.innerHTML = visitedTasks.map((sp, idx) => `
      <tr class="row-visited">
        <td class="col-center">
          <input type="checkbox" name="visited-task-select" value="${sp.sp_id}"
                 onchange="onVisitedTaskSelectionChange()">
        </td>
        <td class="text-muted">${idx + 1}</td>
        <td><strong>${sp.sp_id}</strong></td>
        <td>${sp.container_type || '1100L'}</td>
        <td class="numeric">${sp.fill_rate ? (sp.fill_rate * 100).toFixed(0) + '%' : '--'}</td>
      </tr>
    `).join('');
  }

  // Store baseline metrics
  window.baselineMetrics = calculateRouteMetrics(route);
  window.currentVisitedTasks = visitedTasks;
  updateImpactPreview([], route);
}

// Handle visited task selection change
function onVisitedTaskSelectionChange() {
  const checked = document.querySelectorAll('input[name="visited-task-select"]:checked');
  const selectedCount = document.getElementById('selected-count');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');

  if (selectedCount) {
    selectedCount.textContent = checked.length;
  }

  // Update select all checkbox state
  const allCheckboxes = document.querySelectorAll('input[name="visited-task-select"]');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = checked.length === allCheckboxes.length && allCheckboxes.length > 0;
    selectAllCheckbox.indeterminate = checked.length > 0 && checked.length < allCheckboxes.length;
  }

  // Get selected task IDs
  const selectedIds = Array.from(checked).map(cb => cb.value);
  const route = getRouteById(window.currentRouteId);
  updateImpactPreview(selectedIds, route);
}

// Select all visited tasks
function selectAllVisited() {
  const checkboxes = document.querySelectorAll('input[name="visited-task-select"]');
  checkboxes.forEach(cb => cb.checked = true);
  onVisitedTaskSelectionChange();
}

// Deselect all visited tasks
function deselectAllVisited() {
  const checkboxes = document.querySelectorAll('input[name="visited-task-select"]');
  checkboxes.forEach(cb => cb.checked = false);
  onVisitedTaskSelectionChange();
}

// Toggle select all checkbox
function toggleSelectAll(checkbox) {
  const checkboxes = document.querySelectorAll('input[name="visited-task-select"]');
  checkboxes.forEach(cb => cb.checked = checkbox.checked);
  onVisitedTaskSelectionChange();
}

// Update impact preview based on selected tasks
function updateImpactPreview(selectedIds, route) {
  if (!route || !window.baselineMetrics) return;

  const baseline = window.baselineMetrics;
  const removedCount = selectedIds.length;

  // Estimate V1 metrics with removed tasks
  const v1Tasks = baseline.tasks - removedCount;
  const v1Sps = baseline.sps - removedCount;
  const serviceTimePerTask = 2.5; // minutes
  const distancePerTask = 0.15; // km average

  const v1Distance = baseline.distance - (removedCount * distancePerTask);
  const v1ServiceTime = baseline.serviceTime - (removedCount * serviceTimePerTask);
  const v1TravelTime = baseline.travelTime - (removedCount * 0.5); // reduced travel
  const v1Time = v1ServiceTime + v1TravelTime + 60; // plus break

  // Cost calculations
  const fuelConsumption = 6.0;
  const fuelPrice = 1.50;
  const laborRate = 25;
  const v1FuelUsed = v1Distance / fuelConsumption;
  const v1FuelCost = v1FuelUsed * fuelPrice;
  const v1LaborCost = (v1Time / 60) * laborRate;
  const v1TotalCost = v1FuelCost + v1LaborCost + 15;
  const v1Co2 = v1FuelUsed * 2.31;

  // Update V0 column
  setText('v0-tasks', baseline.tasks);
  setText('v0-sps', baseline.sps);
  setText('v0-distance', formatDistance(baseline.distance));
  setText('v0-time', formatTime(baseline.time));
  setText('v0-fuel-cost', formatCurrency(baseline.fuelCost));
  setText('v0-labor-cost', formatCurrency(baseline.laborCost));
  setText('v0-total-cost', formatCurrency(baseline.totalCost));
  setText('v0-fuel-used', baseline.fuelUsed.toFixed(1) + ' L');
  setText('v0-co2', formatCO2(baseline.co2));

  // Update V1 column
  setText('v1-tasks', v1Tasks);
  setText('v1-sps', v1Sps);
  setText('v1-distance', formatDistance(v1Distance));
  setText('v1-time', formatTime(v1Time));
  setText('v1-fuel-cost', formatCurrency(v1FuelCost));
  setText('v1-labor-cost', formatCurrency(v1LaborCost));
  setText('v1-total-cost', formatCurrency(v1TotalCost));
  setText('v1-fuel-used', v1FuelUsed.toFixed(1) + ' L');
  setText('v1-co2', formatCO2(v1Co2));

  // Update deltas
  setDelta('delta-tasks', -removedCount);
  setDelta('delta-sps', -removedCount);
  setDelta('delta-distance', v1Distance - baseline.distance, ' km');
  setDelta('delta-time', v1Time - baseline.time, ' min');
  setDelta('delta-fuel-cost', v1FuelCost - baseline.fuelCost, '', true);
  setDelta('delta-labor-cost', v1LaborCost - baseline.laborCost, '', true);
  setDelta('delta-total-cost', v1TotalCost - baseline.totalCost, '', true);
  setDelta('delta-fuel-used', v1FuelUsed - baseline.fuelUsed, ' L');
  setDelta('delta-co2', v1Co2 - baseline.co2, ' kg');

  // Update summary
  const summaryText = document.getElementById('summary-text');
  if (summaryText) {
    if (removedCount === 0) {
      summaryText.textContent = 'Select visited tasks to see the estimated savings.';
    } else {
      const costSavings = baseline.totalCost - v1TotalCost;
      const timeSavings = baseline.time - v1Time;
      summaryText.innerHTML = `
        Removing <strong>${removedCount} visited tasks</strong> would save approximately
        <strong>${formatCurrency(costSavings)}</strong> and <strong>${timeSavings.toFixed(0)} minutes</strong> per route.
      `;
    }
  }
}

// Helper to set text content
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Helper to set delta with formatting
function setDelta(id, value, suffix = '', isCurrency = false) {
  const el = document.getElementById(id);
  if (!el) return;

  const absValue = Math.abs(value);
  let displayValue = isCurrency ? formatCurrency(absValue) : absValue.toFixed(1) + suffix;

  if (value < 0) {
    el.textContent = '-' + displayValue;
    el.className = 'impact-col delta-col delta-positive'; // reduction is positive
  } else if (value > 0) {
    el.textContent = '+' + displayValue;
    el.className = 'impact-col delta-col delta-negative'; // increase is negative
  } else {
    el.textContent = '--';
    el.className = 'impact-col delta-col';
  }
}

// Save scenario
function saveScenario() {
  const nameInput = document.getElementById('scenario-name');
  const name = nameInput?.value?.trim();
  if (!name) {
    showNotification('Please enter a scenario name', 'warning');
    nameInput?.focus();
    return;
  }

  const checked = document.querySelectorAll('input[name="visited-task-select"]:checked');
  if (checked.length === 0) {
    showNotification('Please select at least one visited task to remove', 'warning');
    return;
  }

  const selectedTasks = Array.from(checked).map(cb => cb.value);
  const route = getRouteById(window.currentRouteId);

  // Create scenario
  const scenarioId = Scenarios.create(name, 'task-removal', {
    route_id: window.currentRouteId,
    removed_tasks: selectedTasks,
    baseline: window.baselineMetrics
  });

  // Store V1 metrics for comparison
  const baseline = window.baselineMetrics;
  const removedCount = selectedTasks.length;
  const v1Metrics = {
    tasks: baseline.tasks - removedCount,
    sps: baseline.sps - removedCount,
    distance: baseline.distance - (removedCount * 0.15),
    time: baseline.time - (removedCount * 3),
    totalCost: baseline.totalCost - (removedCount * 0.8),
    co2: baseline.co2 - (removedCount * 0.05)
  };

  Scenarios.setResults(scenarioId, v1Metrics);
  showNotification(`Scenario "${name}" saved successfully!`, 'success');

  // Refresh saved scenarios list
  loadSavedScenariosList();
  UI.updateSidebarStats();
}

// Load saved scenarios list
function loadSavedScenariosList() {
  const container = document.getElementById('saved-scenarios-list');
  if (!container) return;

  const scenarios = Scenarios.list();

  if (scenarios.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:20px;">
        <div class="empty-state-text">No scenarios saved yet.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = scenarios.map(s => `
    <div class="scenario-item">
      <div class="scenario-item-info">
        <strong>${s.id.toUpperCase()}</strong>
        <span class="text-muted">${s.name}</span>
      </div>
      <div class="scenario-item-actions">
        <button class="btn-sm btn-secondary" onclick="navigateToPage('comparison')">Compare</button>
      </div>
    </div>
  `).join('');
}

// ─── Comparison Page Functions ────────────────────────────────────────────────

// Update comparison table with selected scenario
function updateComparisonTable() {
  const scenarioSelect = document.getElementById('scenario-version');
  const scenarioId = scenarioSelect?.value;

  if (!scenarioId) {
    resetComparisonDisplay();
    return;
  }

  const scenario = Scenarios.get(scenarioId);
  if (!scenario) {
    resetComparisonDisplay();
    return;
  }

  // Get baseline and scenario metrics
  const baseline = scenario.config?.baseline || window.baselineMetrics || getDefaultBaseline();
  const v1 = scenario.results || estimateV1Metrics(baseline, scenario);

  // Update V0 columns
  setText('cmp-v0-tasks', baseline.tasks);
  setText('cmp-v0-sps', baseline.sps);
  setText('cmp-v0-distance', formatDistance(baseline.distance));
  setText('cmp-v0-time', formatTime(baseline.time));
  setText('cmp-v0-rate', formatPercentage(baseline.tasks > 0 ? (baseline.tasks - (scenario.config?.removed_tasks?.length || 0)) / baseline.tasks : 1));
  setText('cmp-v0-fuel-cost', formatCurrency(baseline.fuelCost));
  setText('cmp-v0-labor-cost', formatCurrency(baseline.laborCost));
  setText('cmp-v0-total-cost', formatCurrency(baseline.totalCost));
  setText('cmp-v0-fuel-used', baseline.fuelUsed?.toFixed(1) + ' L');
  setText('cmp-v0-co2', formatCO2(baseline.co2));

  // Update V1 columns
  setText('cmp-v1-tasks', v1.tasks);
  setText('cmp-v1-sps', v1.sps);
  setText('cmp-v1-distance', formatDistance(v1.distance));
  setText('cmp-v1-time', formatTime(v1.time));
  setText('cmp-v1-rate', '100%');
  setText('cmp-v1-fuel-cost', formatCurrency(v1.fuelCost || baseline.fuelCost * 0.95));
  setText('cmp-v1-labor-cost', formatCurrency(v1.laborCost || baseline.laborCost * 0.95));
  setText('cmp-v1-total-cost', formatCurrency(v1.totalCost));
  setText('cmp-v1-fuel-used', (v1.fuelUsed || baseline.fuelUsed * 0.95).toFixed(1) + ' L');
  setText('cmp-v1-co2', formatCO2(v1.co2));

  // Update delta columns
  const removedTasks = scenario.config?.removed_tasks?.length || 0;
  setCompDelta('cmp-delta-tasks', v1.tasks - baseline.tasks);
  setCompDelta('cmp-delta-sps', v1.sps - baseline.sps);
  setCompDelta('cmp-delta-distance', v1.distance - baseline.distance, ' km');
  setCompDelta('cmp-delta-time', v1.time - baseline.time, ' min');
  setCompDelta('cmp-delta-rate', 0, '%');
  setCompDelta('cmp-delta-fuel-cost', (v1.fuelCost || baseline.fuelCost * 0.95) - baseline.fuelCost, '', true);
  setCompDelta('cmp-delta-labor-cost', (v1.laborCost || baseline.laborCost * 0.95) - baseline.laborCost, '', true);
  setCompDelta('cmp-delta-total-cost', v1.totalCost - baseline.totalCost, '', true);
  setCompDelta('cmp-delta-fuel-used', (v1.fuelUsed || baseline.fuelUsed * 0.95) - baseline.fuelUsed, ' L');
  setCompDelta('cmp-delta-co2', v1.co2 - baseline.co2, ' kg');

  // Update narrative
  updateNarrative(scenario, baseline, v1);
}

// Helper to set comparison delta
function setCompDelta(id, value, suffix = '', isCurrency = false) {
  const el = document.getElementById(id);
  if (!el) return;

  const absValue = Math.abs(value);
  let displayValue = isCurrency ? formatCurrency(absValue) : absValue.toFixed(1) + suffix;

  if (value < -0.01) {
    el.innerHTML = `<span class="delta positive">-${displayValue}</span>`;
  } else if (value > 0.01) {
    el.innerHTML = `<span class="delta negative">+${displayValue}</span>`;
  } else {
    el.innerHTML = '<span class="delta neutral">--</span>';
  }
}

// Get default baseline metrics
function getDefaultBaseline() {
  const route = getRouteById(window.currentRouteId || 'Z2-B-Day-Tue');
  if (route) return calculateRouteMetrics(route);

  return {
    tasks: 330,
    sps: 330,
    distance: 45,
    time: 480,
    fuelCost: 11.25,
    laborCost: 200,
    totalCost: 226.25,
    fuelUsed: 7.5,
    co2: 17.3
  };
}

// Estimate V1 metrics from baseline and scenario config
function estimateV1Metrics(baseline, scenario) {
  const removedCount = scenario.config?.removed_tasks?.length || 0;
  return {
    tasks: baseline.tasks - removedCount,
    sps: baseline.sps - removedCount,
    distance: baseline.distance - (removedCount * 0.15),
    time: baseline.time - (removedCount * 3),
    fuelCost: baseline.fuelCost * (1 - removedCount * 0.003),
    laborCost: baseline.laborCost * (1 - removedCount * 0.006),
    totalCost: baseline.totalCost - (removedCount * 0.8),
    fuelUsed: baseline.fuelUsed * (1 - removedCount * 0.003),
    co2: baseline.co2 - (removedCount * 0.05)
  };
}

// Update narrative summary
function updateNarrative(scenario, baseline, v1) {
  const narrativeEl = document.getElementById('narrative-content');
  if (!narrativeEl) return;

  const removedTasks = scenario.config?.removed_tasks?.length || 0;
  const costSavings = baseline.totalCost - v1.totalCost;
  const timeSavings = baseline.time - v1.time;
  const co2Savings = baseline.co2 - v1.co2;
  const distSavings = baseline.distance - v1.distance;

  narrativeEl.innerHTML = `
    <div class="narrative-block">
      <h4>Scenario: ${scenario.name}</h4>
      <p>
        By removing <strong>${removedTasks} visited tasks</strong> from the route,
        the V1 scenario achieves the following improvements over the V0 baseline:
      </p>
      <ul class="narrative-list">
        <li><strong>Cost Reduction:</strong> ${formatCurrency(costSavings)} savings per route (${((costSavings / baseline.totalCost) * 100).toFixed(1)}%)</li>
        <li><strong>Time Savings:</strong> ${timeSavings.toFixed(0)} minutes reduction in total route time</li>
        <li><strong>Distance Reduction:</strong> ${distSavings.toFixed(1)} km less driving</li>
        <li><strong>Environmental Impact:</strong> ${co2Savings.toFixed(1)} kg less CO2 emissions</li>
      </ul>
      <p class="narrative-conclusion">
        <strong>Recommendation:</strong> Implementing this scenario would improve operational efficiency
        by eliminating unnecessary visits to low-priority service points while maintaining 100% completion
        rate on all remaining tasks.
      </p>
    </div>
  `;
}

// Reset comparison display
function resetComparisonDisplay() {
  const ids = [
    'cmp-v0-tasks', 'cmp-v0-sps', 'cmp-v0-distance', 'cmp-v0-time', 'cmp-v0-rate',
    'cmp-v0-fuel-cost', 'cmp-v0-labor-cost', 'cmp-v0-total-cost', 'cmp-v0-fuel-used', 'cmp-v0-co2',
    'cmp-v1-tasks', 'cmp-v1-sps', 'cmp-v1-distance', 'cmp-v1-time', 'cmp-v1-rate',
    'cmp-v1-fuel-cost', 'cmp-v1-labor-cost', 'cmp-v1-total-cost', 'cmp-v1-fuel-used', 'cmp-v1-co2',
    'cmp-delta-tasks', 'cmp-delta-sps', 'cmp-delta-distance', 'cmp-delta-time', 'cmp-delta-rate',
    'cmp-delta-fuel-cost', 'cmp-delta-labor-cost', 'cmp-delta-total-cost', 'cmp-delta-fuel-used', 'cmp-delta-co2'
  ];
  ids.forEach(id => setText(id, '--'));

  const narrativeEl = document.getElementById('narrative-content');
  if (narrativeEl) {
    narrativeEl.innerHTML = '<p class="text-muted">Select a scenario above to see the impact narrative.</p>';
  }
}

// Reset comparison
function resetComparison() {
  const scenarioSelect = document.getElementById('scenario-version');
  if (scenarioSelect) scenarioSelect.value = '';
  resetComparisonDisplay();
  showNotification('Comparison reset', 'info');
}

// Create new scenario
function createNewScenario() {
  navigateToPage('what-if-analysis');
}

// Export comparison report
function exportComparison() {
  const scenarioSelect = document.getElementById('scenario-version');
  const scenarioId = scenarioSelect?.value;

  if (!scenarioId) {
    showNotification('Please select a scenario first', 'warning');
    return;
  }

  showNotification('Export feature coming soon...', 'info');
}
