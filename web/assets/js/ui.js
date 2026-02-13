/* CIT Digital Twin - UI Rendering & Navigation */

const UI = {
  currentPage: null,

  // Render sidebar
  renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    sidebar.classList.toggle('collapsed', isCollapsed);

    sidebar.innerHTML = `
      <button
        class="sidebar-toggle-btn"
        id="sidebar-toggle-btn"
        type="button"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
        aria-expanded="${isCollapsed ? 'false' : 'true'}"
        onclick="UI.toggleSidebarCollapse()"
      >
        <span id="sidebar-toggle-icon">${isCollapsed ? '&rsaquo;' : '&lsaquo;'}</span>
      </button>

      <div class="sidebar-logo">
        <div class="sidebar-logo-icon-chip">
          <img class="sidebar-logo-icon" src="/components/evreka-icon.png" alt="Evreka logo">
        </div>
        <div class="sidebar-logo-text">
          <div class="sidebar-logo-title">CIT Digital Twin</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Dashboard</div>
          <div class="nav-item active" data-nav="home" onclick="navigateToPage('home')">
            <span class="nav-item-icon">&#127968;</span>
            <span class="nav-item-text">Home</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Analysis</div>
          <div class="nav-collapse" id="nav-what-if">
            <div class="nav-collapse-item" onclick="UI.toggleCollapse('nav-what-if')">
              <span class="nav-item-icon">&#9881;</span>
              <span class="nav-item-text">What-If Actions</span>
              <span class="collapse-icon">&#9654;</span>
            </div>
            <div class="nav-children">
              <div class="nav-child-item" data-nav="removing-visited" onclick="navigateToPage('removing-visited')">
                <span class="nav-child-item-dot"></span>
                <span>Removing Visited Tasks</span>
              </div>
              <div class="nav-collapse" id="nav-frequency">
                <div class="nav-collapse-item" onclick="UI.toggleCollapse('nav-frequency')" style="padding-left:52px;">
                  <span class="nav-item-text" style="font-size:13px;">Frequency Optimization</span>
                  <span class="collapse-icon">&#9654;</span>
                </div>
                <div class="nav-children">
                  <div class="nav-child-item" data-nav="frequency-analysis" onclick="navigateToPage('frequency-analysis')" style="padding-left:68px;">
                    <span class="nav-child-item-dot"></span>
                    <span>Region Analysis</span>
                  </div>
                  <div class="nav-child-item" data-nav="frequency-optimize" onclick="navigateToPage('frequency-optimize')" style="padding-left:68px;">
                    <span class="nav-child-item-dot"></span>
                    <span>Optimize & Compare</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Scenarios</div>
          <div class="nav-item" data-nav="saved-scenarios" onclick="navigateToPage('saved-scenarios')">
            <span class="nav-item-icon">&#128190;</span>
            <span class="nav-item-text">Saved Scenarios</span>
          </div>
          <div class="nav-item" data-nav="compare-scenarios" onclick="navigateToPage('compare-scenarios')">
            <span class="nav-item-icon">&#9878;</span>
            <span class="nav-item-text">Compare Scenarios</span>
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
          <span class="sidebar-stat-label">Avg Rate</span>
          <span class="sidebar-stat-value done" id="sidebar-rate">--</span>
        </div>
      </div>
    `;
  },

  // Desktop sidebar collapse toggle
  toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false');

    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.innerHTML = collapsed ? '&rsaquo;' : '&lsaquo;';

    const button = document.getElementById('sidebar-toggle-btn');
    if (button) button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  },

  // Toggle collapse
  toggleCollapse(collapseId) {
    const el = document.getElementById(collapseId);
    if (el) el.classList.toggle('open');
  },

  // Render header
  renderHeader(title, subtitle = '', options = {}) {
    const header = document.getElementById('header');
    header.style.display = 'flex';
    header.className = options.compact ? 'header header-compact' : 'header';
    const showDateFilter = options.showDateFilter !== false;
    header.innerHTML = `
      <div class="header-left">
        <button class="mobile-menu-btn" onclick="UI.toggleMobileSidebar()">
          <span class="mobile-menu-icon"></span>
        </button>
        <h1>${title}</h1>
        ${subtitle ? `<p class="subtitle" style="margin-bottom:0">${subtitle}</p>` : ''}
      </div>
      <div class="header-right">
        ${options.rightHtml || ''}
        ${showDateFilter ? '<span class="header-date-filter">05.01 - 11.01.2026</span>' : ''}
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
      <div class="kpi-card ${kpi.status || ''} ${kpi.clickable ? 'clickable' : ''} ${kpi.compact ? 'compact' : ''}"
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
          <button class="btn-primary mt-20" onclick="navigateToPage('home')">Go to Home</button>
        </div>
      `;
    }
  }
};

// Global navigation functions
function continueToHome() {
  window.selectedRoutePlan = document.getElementById('route-plan-select')?.value || 'zone-2b-day';
  // Show sidebar again
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = '';
  navigateToPage('home');
}

// Ensure sidebar is shown for non-selection pages
function ensureSidebarVisible() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = '';
}

// Switch between tabs on route-detail page
function switchTab(tabId) {
  // Toggle tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Toggle tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  // Lazy-load Route Details tab on first switch
  if (tabId === 'route-details' && !window._routeDetailsLoaded) {
    loadRouteDetailsTab();
  }
}

function getRouteCapacityKg(route, fallbackKg = 20000) {
  const rawCapacity = Number(route?.capacity);
  if (!Number.isFinite(rawCapacity) || rawCapacity <= 0) return fallbackKg;
  // Dataset capacity is in tons for some routes (e.g. 20), normalize to kg.
  return rawCapacity <= 100 ? rawCapacity * 1000 : rawCapacity;
}

function getCollectedWasteKg(route, options = {}) {
  const weight1100 = Number(options.weight1100 || 80);
  const weight240 = Number(options.weight240 || 32);

  if (Array.isArray(route?.service_points) && route.service_points.length) {
    const total = route.service_points.reduce((sum, sp) => {
      if ((sp?.status || '').toLowerCase() !== 'done') return sum;
      const explicitWeight = Number(sp?.weight_kg);
      if (Number.isFinite(explicitWeight) && explicitWeight >= 0) return sum + explicitWeight;

      const type = String(sp?.container_type || '').toLowerCase();
      if (type.includes('240')) return sum + weight240;
      if (type.includes('1100')) return sum + weight1100;
      return sum + weight1100;
    }, 0);
    if (total > 0) return total;
  }

  const doneTasks = Number(route?.tasks_done || 0);
  return doneTasks * weight1100;
}

function formatRatioMetric(value, unit) {
  if (!Number.isFinite(value)) return '--';
  if (value >= 1000) return `${formatNumber(value)} ${unit}`;
  return `${formatDecimal(value, 1)} ${unit}`;
}

// Load route details tab data from CSV endpoint
async function loadRouteDetailsTab() {
  const routeId = window.currentRouteId;
  if (!routeId) return;

  const seqBody = document.getElementById('completed-sequence-body');
  if (seqBody) {
    seqBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;"><div class="spinner"></div> Loading route sequence...</td></tr>';
  }

  try {
    const data = await API.loadRouteTaskSequence(routeId);

    if (data.error && data.completed_sequence.length === 0) {
      if (seqBody) seqBody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;padding:20px;">No CSV data available for this date.</td></tr>`;
      return;
    }

    window._routeSequenceData = data.completed_sequence;
    window._routeDetailsLoaded = true;

    // Update completed count
    const countEl = document.getElementById('completed-seq-count');
    if (countEl) countEl.textContent = `(${data.total_completed} items in sequence)`;

    // Render completed sequence with pagination
    renderCompletedSequencePage(1);

    // Render summary stats
    const route = getRouteById(routeId);
    setText('seq-total-distance', `Total Distance: ${formatDistance(route?.total_distance_km || 0)}`);
    setText('seq-total-time', `Total Time: ${formatTime(route?.total_time_minutes || 0)}`);
    const doneCount = data.completed_sequence.filter(s => s.status === 'Done').length;
    setText('seq-tasks-completed', `Tasks Completed: ${doneCount}`);

    // Render incomplete tasks
    const incBody = document.getElementById('incomplete-tasks-body');
    const incCount = document.getElementById('incomplete-count');
    if (incCount) incCount.textContent = `(${data.total_incomplete} service points not visited)`;

    if (incBody) {
      if (data.incomplete_tasks.length === 0) {
        incBody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:20px;">No incomplete tasks.</td></tr>';
      } else {
        incBody.innerHTML = data.incomplete_tasks.map((task, idx) => `
          <tr class="row-todo">
            <td class="col-center text-muted">${idx + 1}</td>
            <td><strong>${task.sp_id}</strong></td>
            <td><span class="status-badge todo">To Do</span></td>
            <td>${task.asset_types || '--'}</td>
            <td>${task.planned_adhoc || 'Planned'}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load route details:', err);
    if (seqBody) seqBody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;padding:20px;">Failed to load route sequence data.</td></tr>`;
  }
}

// Render a page of the completed sequence table
function renderCompletedSequencePage(page, pageSize = 20) {
  const data = window._routeSequenceData || [];
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pageItems = data.slice(startIdx, endIdx);

  const tbody = document.getElementById('completed-sequence-body');
  if (tbody) {
    tbody.innerHTML = pageItems.map(item => {
      const statusClass = item.status === 'Done' ? 'done' : item.status === 'Visited' ? 'visited' : '';
      const statusIcon = item.status === 'Done' ? '&#10003;' : item.status === 'Visited' ? '&#9673;' : item.status === 'Start' || item.status === 'End' ? '&#9632;' : '&#9670;';
      const rowClass = item.type === 'depot_start' || item.type === 'depot_end' ? 'row-depot' : item.type === 'disposal' ? 'row-disposal' : item.status === 'Visited' ? 'row-visited' : '';

      return `
        <tr class="${rowClass}">
          <td class="col-center text-muted">${item.seq}</td>
          <td><strong>${item.sp_id}</strong></td>
          <td><span class="status-badge ${statusClass}">${statusIcon} ${item.status}</span></td>
          <td>${item.completed_asset_types || item.asset_types || '--'}</td>
          <td class="numeric">${item.asset_collects || '--'}</td>
        </tr>
      `;
    }).join('');
  }

  // Render pagination
  const paginationEl = document.getElementById('completed-seq-pagination');
  if (paginationEl && totalPages > 1) {
    const pageButtons = [];
    const maxButtons = 5;
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(`<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="renderCompletedSequencePage(${i}, ${pageSize})">${i}</button>`);
    }

    paginationEl.innerHTML = `
      <div class="pagination-info">Showing ${startIdx + 1}-${endIdx} of ${totalItems} items</div>
      <div class="pagination-controls">
        <button class="pagination-btn" onclick="renderCompletedSequencePage(1, ${pageSize})" ${page === 1 ? 'disabled' : ''}>First</button>
        <button class="pagination-btn" onclick="renderCompletedSequencePage(${page - 1}, ${pageSize})" ${page === 1 ? 'disabled' : ''}>Prev</button>
        ${pageButtons.join('')}
        <button class="pagination-btn" onclick="renderCompletedSequencePage(${page + 1}, ${pageSize})" ${page === totalPages ? 'disabled' : ''}>Next</button>
        <button class="pagination-btn" onclick="renderCompletedSequencePage(${totalPages}, ${pageSize})" ${page === totalPages ? 'disabled' : ''}>Last</button>
      </div>
    `;
  } else if (paginationEl) {
    paginationEl.innerHTML = totalItems > 0 ? `<div class="pagination-info">Showing all ${totalItems} items</div>` : '';
  }
}

// Page Controllers - initialization logic for each page
const PageControllers = {
  'route-plan-selection': async () => {
    const header = document.getElementById('header');
    if (header) header.style.display = 'none';
    // Hide sidebar on selection page
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'none';
  },

  'home': async () => {
    ensureSidebarVisible();
    UI.renderHeader('Zone 2 B (Day)', 'Albada Zone-2 | Week of Jan 5-11, 2026', {
      rightHtml: '<button class="btn-secondary" onclick="navigateToPage(\'route-plan-selection\')">Change Route Plan</button>'
    });

    // Get Zone 2 B routes
    const routes = getRoutes();
    const zone2bRoutes = routes.filter(r => r.route_name === 'Zone 2 B (Day)');
    zone2bRoutes.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate aggregate KPIs
    const totalDone = sum(zone2bRoutes, 'tasks_done');
    const totalVisited = sum(zone2bRoutes, 'tasks_visited');
    const totalTodo = sum(zone2bRoutes, 'tasks_todo');
    const totalAll = totalDone + totalVisited + totalTodo;
    const avgDistance = avg(zone2bRoutes, 'total_distance_km');
    const avgCost = avg(zone2bRoutes, 'total_cost');
    const avgRate = avg(zone2bRoutes, 'completion_rate');

    // Render KPI cards
    UI.renderKPICards('home-kpi-grid', [
      { icon: '&#10003;', label: 'Done', value: formatNumber(totalDone), subtext: `${formatPercentage(totalDone / totalAll)} of total`, status: 'done' },
      { icon: '&#9673;', label: 'Visited', value: formatNumber(totalVisited), subtext: `${formatPercentage(totalVisited / totalAll)} of total`, status: 'visited' },
      { icon: '&#9744;', label: 'To-Do', value: formatNumber(totalTodo), subtext: `${formatPercentage(totalTodo / totalAll)} of total`, status: 'todo' },
      { icon: '&#9672;', label: 'Avg Distance', value: formatDistance(avgDistance), subtext: 'per route', status: 'info' },
      { icon: '$', label: 'Avg Cost', value: formatCurrency(avgCost), subtext: 'per route', status: 'info' },
      { icon: '&#9889;', label: 'Completion Rate', value: formatPercentage(avgRate), subtext: 'avg across routes', status: avgRate >= 0.9 ? 'done' : 'visited' }
    ]);

    // Render route count
    const countLabel = document.getElementById('home-route-count');
    if (countLabel) countLabel.textContent = `${zone2bRoutes.length} route instances`;

    // Render routes table
    const tbody = document.getElementById('home-routes-body');
    if (tbody) {
      tbody.innerHTML = zone2bRoutes.map(route => {
        const rate = route.completion_rate || 0;
        const ratePercent = rate > 1 ? rate : rate * 100;
        const totalTasks = route.tasks_done + route.tasks_visited + route.tasks_todo;
        const statusLabel = ratePercent >= 90 ? '&#10003; Good' : ratePercent >= 70 ? '&#9888; Fair' : '&#9888; Attention';
        const statusClass = ratePercent >= 90 ? 'text-done' : ratePercent >= 70 ? 'text-visited' : 'text-todo';

        return `
          <tr class="clickable" onclick="navigateToPage('route-detail', {id: '${route.route_id}'})">
            <td><strong>${formatDateFull(route.date)}</strong></td>
            <td>Day</td>
            <td class="numeric">${totalTasks}</td>
            <td class="numeric text-done">${route.tasks_done}</td>
            <td class="numeric text-visited">${route.tasks_visited}</td>
            <td class="numeric text-todo">${route.tasks_todo}</td>
            <td class="numeric">${formatDistance(route.total_distance_km)}</td>
            <td class="numeric">${formatTime(route.total_time_minutes)}</td>
            <td class="numeric">${formatCurrency(route.total_cost)}</td>
            <td class="numeric">${formatCO2(route.co2_emissions_kg)}</td>
            <td class="${statusClass}">${statusLabel}</td>
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

  'route-selector': async () => {
    // Legacy: redirect to home
    navigateToPage('home');
    return;
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

    const uniqueDays = new Set(routes.map(r => r.date).filter(Boolean)).size;
    UI.renderHeader('V0 Baseline Overview', `Week of Jan 5-11, 2026 | ${routes.length} Routes | ${uniqueDays} Days`);

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
    ensureSidebarVisible();
    const { params } = getPageParams();
    const routeId = params.id;

    if (!routeId) {
      navigateToPage('home');
      return;
    }

    const route = getRouteById(routeId);
    if (!route) {
      showNotification(`Route "${routeId}" not found`, 'error');
      navigateToPage('home');
      return;
    }

    // Store current route for simulation
    window.currentRouteId = routeId;
    window._routeDetailsLoaded = false;

    // Update header with correct date format
    const totalTasks = route.tasks_done + route.tasks_visited + route.tasks_todo;
    const dateDisplay = route.date ? formatDateFull(route.date) : route.day;
    UI.renderHeader(route.route_name, `${dateDisplay} | Vehicle: ${route.vehicle_id} | ${totalTasks} tasks`, {
      compact: true,
      showDateFilter: false,
      rightHtml: '<button class="btn-primary btn-sm btn-whatif-cta" onclick="navigateToPage(\'removing-visited\', {route: window.currentRouteId})">&#9881; Do What-If Analysis</button>'
    });

    const distanceKm = route.total_distance_km || 0;
    const totalTimeMin = route.total_time_minutes || 0;
    const totalTimeHours = totalTimeMin > 0 ? totalTimeMin / 60 : 0;
    const fuelUsed = distanceKm / 6.0;
    const co2 = route.co2_emissions_kg || (fuelUsed * 2.31);
    const vehicleCapacityKg = getRouteCapacityKg(route);
    const collectedWasteKg = getCollectedWasteKg(route);
    const utilizationPercent = vehicleCapacityKg > 0 ? (collectedWasteKg / vehicleCapacityKg) * 100 : null;
    const wastePerKm = distanceKm > 0 ? (collectedWasteKg / distanceKm) : null;
    const wastePerHr = totalTimeHours > 0 ? (collectedWasteKg / totalTimeHours) : null;
    const doneShare = totalTasks > 0 ? route.tasks_done / totalTasks : 0;

    // Render compact KPI cards
    UI.renderKPICards('route-kpi-grid', [
      { icon: '&#10003;', label: 'Done', value: formatNumber(route.tasks_done), subtext: `${formatPercentage(doneShare)} of total`, status: 'done', compact: true },
      { icon: '&#9673;', label: 'Visited', value: formatNumber(route.tasks_visited), subtext: 'Failed attempts', status: 'visited', compact: true },
      { icon: '&#9744;', label: 'To-Do', value: formatNumber(route.tasks_todo), subtext: 'Not attempted', status: 'todo', compact: true },
      { icon: '&#9672;', label: 'Distance', value: formatDistance(distanceKm), subtext: 'Total route', status: 'info', compact: true },
      { icon: '&#9201;', label: 'Time', value: formatTime(totalTimeMin), subtext: 'Including breaks', status: 'info', compact: true },
      { icon: '$', label: 'Cost', value: formatCurrency(route.total_cost || 0), subtext: 'All inclusive', status: 'info', compact: true },
      { icon: '&#128203;', label: 'Waste', value: `${formatNumber(collectedWasteKg)} kg`, subtext: 'Collected waste', status: 'info', compact: true },
      { icon: '&#9889;', label: 'Vehicle Utilization', value: utilizationPercent === null ? '--' : `${formatDecimal(utilizationPercent, 1)}%`, subtext: `Capacity ${formatNumber(vehicleCapacityKg)} kg`, status: utilizationPercent !== null && utilizationPercent >= 70 ? 'done' : 'visited', compact: true },
      { icon: '&#128668;', label: 'Waste per km', value: formatRatioMetric(wastePerKm, 'kg/km'), subtext: 'Collected / distance', status: 'info', compact: true },
      { icon: '&#9203;', label: 'Waste per hr', value: formatRatioMetric(wastePerHr, 'kg/hr'), subtext: 'Collected / total time', status: 'info', compact: true },
      { icon: '&#9729;', label: 'CO2', value: formatCO2(co2), subtext: 'Emissions', status: 'info', compact: true }
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

    // Ensure route detail outputs are parameter-accurate on initial page entry.
    await runRouteSimulation();
  },

  'removing-visited': async () => {
    ensureSidebarVisible();
    UI.renderHeader('Removing Visited Tasks', 'Analyze impact of removing visited tasks from routes');

    // Check for route param from Route Detail page
    const { params } = getPageParams();
    const routeId = params.route || window.currentRouteId || 'Z2-B-Day-Tue';
    const routes = getRoutes();
    const zone2bRoutes = routes.filter(r => r.route_name === 'Zone 2 B (Day)');
    const currentRoute = getRouteById(routeId) || zone2bRoutes[0];

    if (currentRoute) {
      window.currentRouteId = currentRoute.route_id;
    }

    // Populate base route dropdown
    const baseRouteSelect = document.getElementById('base-route-select');
    if (baseRouteSelect) {
      baseRouteSelect.innerHTML = zone2bRoutes.map(r =>
        `<option value="${r.route_id}" ${r.route_id === (currentRoute?.route_id || routeId) ? 'selected' : ''}>${formatDateFull(r.date)} - ${r.day}</option>`
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
    loadVisitedTasksTable(currentRoute?.route_id || routeId);
  },

  'what-if': async () => {
    ensureSidebarVisible();
    UI.renderHeader('What-If Actions', 'Choose an analysis action');

    // Load recent scenarios
    const container = document.getElementById('what-if-recent-scenarios');
    if (container) {
      const recent = Scenarios.getRecent(3);
      if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-state-text">No scenarios created yet. Start by selecting an action above.</div></div>';
      } else {
        container.innerHTML = recent.map(s => {
          const removedCount = s.config?.removed_tasks?.length || 0;
          const dateStr = new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          return `
            <div class="scenario-item">
              <div class="scenario-item-info">
                <strong>${s.id.toUpperCase()}</strong>
                <span>${s.name}</span>
                <span class="text-muted text-sm">${dateStr} | ${removedCount} tasks removed</span>
              </div>
              <div class="scenario-item-actions">
                <button class="btn-sm btn-secondary" onclick="navigateToPage('compare-scenarios', {scenario: '${s.id}'})">Compare</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  'comparison': async () => {
    // Legacy redirect
    navigateToPage('compare-scenarios');
  },

  'saved-scenarios': async () => {
    ensureSidebarVisible();
    UI.renderHeader('Saved Scenarios', 'Manage and compare your what-if scenarios', {
      rightHtml: '<button class="btn-primary btn-sm" onclick="navigateToPage(\'removing-visited\')">+ NEW SCENARIO</button>'
    });

    const grid = document.getElementById('scenarios-grid');
    if (!grid) return;

    const scenarios = Scenarios.list();

    if (scenarios.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#128203;</div>
          <div class="empty-state-title">No Scenarios Yet</div>
          <div class="empty-state-text">Create your first what-if scenario to analyze route optimizations.</div>
          <button class="btn-primary mt-20" onclick="navigateToPage('removing-visited')">+ Create New Scenario</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = scenarios.map(s => {
      const removedCount = s.config?.removed_tasks?.length || 0;
      const dateStr = new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const baseRouteName = s.baseRoute ? `${s.baseRoute.route_name} - ${s.baseRoute.day}` : 'N/A';
      const baseline = s.config?.baseline;
      const results = s.results;

      // Calculate metric deltas
      let costDelta = '', timeDelta = '', distDelta = '';
      if (baseline && results) {
        const costDiff = results.totalCost - baseline.totalCost;
        const timeDiff = results.time - baseline.time;
        const distDiff = results.distance - baseline.distance;
        costDelta = `<span class="scenario-card-metric-value ${costDiff < 0 ? 'positive' : 'negative'}">${costDiff < 0 ? '' : '+'}${formatCurrency(costDiff)}</span>`;
        timeDelta = `<span class="scenario-card-metric-value ${timeDiff < 0 ? 'positive' : 'negative'}">${timeDiff < 0 ? '' : '+'}${timeDiff.toFixed(0)} min</span>`;
        distDelta = `<span class="scenario-card-metric-value ${distDiff < 0 ? 'positive' : 'negative'}">${distDiff < 0 ? '' : '+'}${distDiff.toFixed(1)} km</span>`;
      }

      return `
        <div class="scenario-card">
          <div class="scenario-card-header">
            <div class="scenario-card-title">
              <span class="badge badge-info">${s.id.toUpperCase()}</span>
              <h3>${s.name}</h3>
            </div>
          </div>
          <div class="scenario-card-info">
            <div class="scenario-card-detail"><span class="text-muted">Base Route:</span> ${baseRouteName}</div>
            <div class="scenario-card-detail"><span class="text-muted">Created:</span> ${dateStr}</div>
            ${s.description ? `<div class="scenario-card-detail"><span class="text-muted">Note:</span> ${s.description}</div>` : ''}
            <div class="scenario-card-detail"><span class="text-muted">Tasks Removed:</span> ${removedCount}</div>
          </div>
          ${baseline && results ? `
          <div class="scenario-card-metrics">
            <div class="scenario-card-metric">
              <span class="scenario-card-metric-label">Cost</span>
              ${costDelta}
            </div>
            <div class="scenario-card-metric">
              <span class="scenario-card-metric-label">Time</span>
              ${timeDelta}
            </div>
            <div class="scenario-card-metric">
              <span class="scenario-card-metric-label">Distance</span>
              ${distDelta}
            </div>
          </div>
          ` : ''}
          <div class="scenario-card-actions">
            <button class="btn-sm btn-secondary" onclick="navigateToPage('compare-scenarios', {scenario: '${s.id}'})">Compare</button>
            <button class="btn-sm btn-secondary" onclick="renameScenario('${s.id}')">Rename</button>
            <button class="btn-sm btn-danger" onclick="deleteScenario('${s.id}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  },

  'compare-scenarios': async () => {
    ensureSidebarVisible();
    UI.renderHeader('Compare Scenarios', 'Side-by-side comparison of scenarios');

    const { params } = getPageParams();

    // Populate both dropdowns
    const scenarios = Scenarios.list();
    const baselineSelect = document.getElementById('compare-left');
    const scenarioSelect = document.getElementById('compare-right');

    if (baselineSelect) {
      baselineSelect.innerHTML = '<option value="v0">V0 - Current Operations (Baseline)</option>' +
        scenarios.map(s => `<option value="${s.id}">${s.id.toUpperCase()} - ${s.name}</option>`).join('');
    }

    if (scenarioSelect) {
      if (scenarios.length === 0) {
        scenarioSelect.innerHTML = '<option value="" disabled>No scenarios yet. Create one first.</option>';
      } else {
        scenarioSelect.innerHTML = '<option value="">-- Select a scenario --</option>' +
          scenarios.map(s => `<option value="${s.id}">${s.id.toUpperCase()} - ${s.name}</option>`).join('');

        // Auto-select from URL params or first scenario
        if (params.scenario && scenarios.find(s => s.id === params.scenario)) {
          scenarioSelect.value = params.scenario;
          updateComparisonTable();
        } else if (scenarios.length > 0) {
          scenarioSelect.value = scenarios[0].id;
          updateComparisonTable();
        }
      }
    }
  },

  'frequency-analysis': async () => {
    ensureSidebarVisible();
    UI.renderHeader('Region Analysis', 'Historic frequency patterns across service points');

    try {
      await FrequencyAnalyzer.load();
      FrequencyAnalyzer.analyze();
      const summary = FrequencyAnalyzer.getSummary();
      if (!summary) throw new Error('No analysis data');

      // Hide loading, show content
      hide('#freq-loading');
      show('#freq-content');

      // Render KPI cards
      const kpiGrid = document.getElementById('freq-overview-grid');
      if (kpiGrid) {
        kpiGrid.innerHTML = `
          <div class="freq-kpi-card">
            <div class="freq-kpi-value">${summary.totalSPs}</div>
            <div class="freq-kpi-label">Total Service Points</div>
          </div>
          <div class="freq-kpi-card highlight">
            <div class="freq-kpi-value">${summary.optimizableCount}</div>
            <div class="freq-kpi-label">Optimizable SPs</div>
          </div>
          <div class="freq-kpi-card">
            <div class="freq-kpi-value">${formatPercentage(summary.avgSuccessRate)}</div>
            <div class="freq-kpi-label">Avg Success Rate</div>
          </div>
          <div class="freq-kpi-card highlight">
            <div class="freq-kpi-value">${formatCurrency(summary.potentialSavings.costPerWeek)}</div>
            <div class="freq-kpi-label">Potential Savings/wk</div>
          </div>
        `;
      }

      // Render day distribution
      const dayBody = document.getElementById('day-distribution-body');
      if (dayBody) {
        let dayHtml = '';
        for (const day of DAY_ORDER) {
          const dd = summary.dayDistribution[day];
          if (!dd || dd.total === 0) continue;
          const goodPct = (dd.good / dd.total * 100).toFixed(0);
          const badPct = (dd.bad / dd.total * 100).toFixed(0);
          dayHtml += `
            <div class="day-distribution-row">
              <div class="day-dist-label">${day}</div>
              <div class="day-dist-bar-container">
                <div class="day-dist-bar good" style="width:${goodPct}%"></div>
                <div class="day-dist-bar bad" style="width:${badPct}%"></div>
              </div>
              <div class="day-dist-stats">
                <span class="day-dist-good">${dd.good} good</span>
                <span class="day-dist-bad">${dd.bad} bad</span>
                <span class="day-dist-rate">${formatPercentage(dd.rate)}</span>
              </div>
            </div>
          `;
        }
        dayBody.innerHTML = dayHtml;
      }

      // Render confidence grid
      const confGrid = document.getElementById('confidence-grid');
      if (confGrid) {
        const cd = summary.confidenceDistribution;
        confGrid.innerHTML = `
          <div class="confidence-card high">
            <div class="confidence-card-value">${cd.HIGH}</div>
            <div class="confidence-card-label">HIGH</div>
            <div class="confidence-card-desc">10+ samples</div>
          </div>
          <div class="confidence-card medium">
            <div class="confidence-card-value">${cd.MEDIUM}</div>
            <div class="confidence-card-label">MEDIUM</div>
            <div class="confidence-card-desc">5-9 samples</div>
          </div>
          <div class="confidence-card low">
            <div class="confidence-card-value">${cd.LOW}</div>
            <div class="confidence-card-label">LOW</div>
            <div class="confidence-card-desc">&lt;5 samples</div>
          </div>
        `;
      }

      // Render top 10 recommendations
      const recBody = document.getElementById('recommendations-body');
      if (recBody) {
        const top = FrequencyAnalyzer.getOptimizable({ sortBy: 'savings' }).slice(0, 10);
        if (top.length === 0) {
          recBody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No optimization candidates found</td></tr>';
        } else {
          recBody.innerHTML = top.map(sp => `
            <tr>
              <td><strong>${sp.sp_id}</strong></td>
              <td>${sp.currentFrequency}d/wk</td>
              <td class="text-done">${sp.optimalFrequency}d/wk</td>
              <td>${sp.removableDays.map(d => `<span class="day-badge bad">${d.slice(0, 3)}</span>`).join(' ')}</td>
              <td><span class="confidence-badge ${sp.confidence.toLowerCase()}">${sp.confidence}</span></td>
              <td class="text-done">${formatCurrency(sp.estimatedSavings.cost)}</td>
            </tr>
          `).join('');
        }
      }

    } catch (err) {
      console.error('Frequency analysis error:', err);
      const loading = document.getElementById('freq-loading');
      if (loading) {
        loading.innerHTML = `
          <div class="empty-state-icon">&#9888;</div>
          <div class="empty-state-title">Failed to Load Data</div>
          <div class="empty-state-text">${err.message || 'Check if the server is running and monthly data is available.'}</div>
          <button class="btn-secondary mt-20" onclick="navigateToPage('what-if')">&#8592; Back to What-If Actions</button>
        `;
      }
    }
  },

  'frequency-optimize': async () => {
    ensureSidebarVisible();
    UI.renderHeader('Optimize & Compare', 'Select service points to preview frequency optimization impact');

    try {
      await FrequencyAnalyzer.load();
      FrequencyAnalyzer.analyze();

      const optimizable = FrequencyAnalyzer.getOptimizable({ sortBy: 'savings' });

      // Hide loading, show content
      hide('#freq-opt-loading');
      show('#freq-opt-content');

      // Store for filter/sort
      window._freqOptimizable = optimizable;
      window._freqAllOptimizable = optimizable;

      renderFreqSPCards(optimizable);
      updateFreqImpactPreview([]);

    } catch (err) {
      console.error('Frequency optimize error:', err);
      const loading = document.getElementById('freq-opt-loading');
      if (loading) {
        loading.innerHTML = `
          <div class="empty-state-icon">&#9888;</div>
          <div class="empty-state-title">Failed to Load Data</div>
          <div class="empty-state-text">${err.message || 'Check if the server is running.'}</div>
          <button class="btn-secondary mt-20" onclick="navigateToPage('frequency-analysis')">&#8592; Back to Region Analysis</button>
        `;
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
  if (weight1100L) weight1100L.value = 80;
  if (weight240L) weight240L.value = 32;

  // Disposal
  const disposalTime = document.getElementById('disposal-time');
  if (disposalTime) disposalTime.value = 15;

  showNotification('Parameters reset to defaults', 'info');
}

// Run route simulation
async function runRouteSimulation() {
  const routeId = window.currentRouteId;
  if (!routeId) {
    console.error('No route selected');
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
    weight_1100L: parseFloat(document.getElementById('weight-1100L')?.value || 80),
    weight_240L: parseFloat(document.getElementById('weight-240L')?.value || 32)
  };

  try {
    const result = await API.runSimulation(routeId, parameters);

    if (result) {
      const route = getRouteById(routeId);
      const totalTasks = (result.done || 0) + (result.visited || 0) + (result.todo || 0);
      const doneShare = totalTasks > 0 ? (result.done || 0) / totalTasks : 0;
      const capacityKg = Number(result.vehicle_capacity_kg || parameters.capacity);
      const collectedWasteKg = Number(result.collected_waste_kg) || getCollectedWasteKg(route, {
        weight1100: parameters.weight_1100L,
        weight240: parameters.weight_240L
      });
      const distanceKm = Number(result.distance || 0);
      const totalTimeMin = Number(result.total_time || 0);
      const totalTimeHours = totalTimeMin > 0 ? totalTimeMin / 60 : 0;
      const utilizationPercent = Number.isFinite(result.utilization_percent)
        ? Number(result.utilization_percent)
        : (capacityKg > 0 ? (collectedWasteKg / capacityKg) * 100 : null);
      const wastePerKm = distanceKm > 0 ? (collectedWasteKg / distanceKm) : null;
      const wastePerHr = totalTimeHours > 0 ? (collectedWasteKg / totalTimeHours) : null;

      // Update KPIs with result (compact)
      UI.renderKPICards('route-kpi-grid', [
        { icon: '&#10003;', label: 'Done', value: formatNumber(result.done || 0), subtext: `${formatPercentage(doneShare)} of total`, status: 'done', compact: true },
        { icon: '&#9673;', label: 'Visited', value: formatNumber(result.visited || 0), subtext: 'Failed attempts', status: 'visited', compact: true },
        { icon: '&#9744;', label: 'To-Do', value: formatNumber(result.todo || 0), subtext: 'Not attempted', status: 'todo', compact: true },
        { icon: '&#9672;', label: 'Distance', value: formatDistance(distanceKm), subtext: 'Total route', status: 'info', compact: true },
        { icon: '&#9201;', label: 'Time', value: formatTime(totalTimeMin), subtext: 'Including breaks', status: 'info', compact: true },
        { icon: '$', label: 'Cost', value: formatCurrency(result.total_cost || 0), subtext: 'All inclusive', status: 'info', compact: true },
        { icon: '&#128203;', label: 'Waste', value: `${formatNumber(collectedWasteKg)} kg`, subtext: 'Collected waste', status: 'info', compact: true },
        { icon: '&#9889;', label: 'Vehicle Utilization', value: utilizationPercent === null ? '--' : `${formatDecimal(utilizationPercent, 1)}%`, subtext: `Capacity ${formatNumber(capacityKg)} kg`, status: utilizationPercent !== null && utilizationPercent >= 70 ? 'done' : 'visited', compact: true },
        { icon: '&#128668;', label: 'Waste per km', value: formatRatioMetric(wastePerKm, 'kg/km'), subtext: 'Collected / distance', status: 'info', compact: true },
        { icon: '&#9203;', label: 'Waste per hr', value: formatRatioMetric(wastePerHr, 'kg/hr'), subtext: 'Collected / total time', status: 'info', compact: true },
        { icon: '&#9729;', label: 'CO2', value: formatCO2(result.co2 || 0), subtext: 'Emissions', status: 'info', compact: true }
      ]);

      // Update simulation results section
      const resultsSection = document.getElementById('simulation-results');
      if (resultsSection) {
        // Operational metrics
        const outTravelTime = document.getElementById('out-travel-time');
        const outServiceTime = document.getElementById('out-service-time');
        const outTotalTime = document.getElementById('out-total-time');
        const outDistance = document.getElementById('out-distance');
        const outWaste = document.getElementById('out-waste');

        if (outTravelTime) outTravelTime.textContent = formatTime(result.travel_time);
        if (outServiceTime) outServiceTime.textContent = formatTime(result.service_time);
        if (outTotalTime) outTotalTime.textContent = formatTime(totalTimeMin);
        if (outDistance) outDistance.textContent = formatDistance(distanceKm);
        if (outWaste) outWaste.textContent = `${formatNumber(collectedWasteKg)} kg`;

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
        const outWastePerKm = document.getElementById('out-waste-per-km');
        const outWastePerHr = document.getElementById('out-waste-per-hr');

        if (outFuelUsed) outFuelUsed.textContent = `${result.fuel_used} L`;
        if (outCo2) outCo2.textContent = formatCO2(result.co2);
        if (outUtilization) outUtilization.textContent = utilizationPercent === null ? '--' : `${formatDecimal(utilizationPercent, 1)}%`;
        if (outWastePerKm) outWastePerKm.textContent = formatRatioMetric(wastePerKm, 'kg/km');
        if (outWastePerHr) outWastePerHr.textContent = formatRatioMetric(wastePerHr, 'kg/hr');
      }
    }
  } catch (error) {
    console.error('Simulation failed:', error);
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
  openSaveScenarioModal();
}

function openSaveScenarioModal() {
  const modal = document.getElementById('save-scenario-modal');
  if (!modal) return;

  const nameInput = document.getElementById('modal-scenario-name');
  const descInput = document.getElementById('modal-scenario-description');
  const errorEl = document.getElementById('save-scenario-error');

  if (nameInput && !nameInput.value.trim()) {
    const route = getRouteById(window.currentRouteId);
    const dateLabel = route?.date ? new Date(route.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Route';
    nameInput.value = `Visited Tasks Removal - ${dateLabel}`;
  }
  if (descInput && !descInput.value.trim()) {
    descInput.value = '';
  }
  if (errorEl) errorEl.textContent = '';

  modal.classList.remove('hidden');
  setTimeout(() => nameInput?.focus(), 0);
}

function closeSaveScenarioModal() {
  const modal = document.getElementById('save-scenario-modal');
  if (modal) modal.classList.add('hidden');
}

function confirmSaveScenario() {
  const nameInput = document.getElementById('modal-scenario-name');
  const descInput = document.getElementById('modal-scenario-description');
  const errorEl = document.getElementById('save-scenario-error');
  const name = nameInput?.value?.trim();

  if (!name) {
    if (errorEl) errorEl.textContent = 'Scenario name is required.';
    nameInput?.focus();
    return;
  }

  const checked = document.querySelectorAll('input[name="visited-task-select"]:checked');
  if (checked.length === 0) {
    if (errorEl) errorEl.textContent = 'Select at least one visited task to remove.';
    return;
  }

  const selectedTasks = Array.from(checked).map(cb => cb.value);
  const route = getRouteById(window.currentRouteId);
  const description = descInput?.value?.trim() || '';

  // Build baseRoute metadata
  const baseRoute = route ? {
    route_id: route.route_id,
    route_name: route.route_name,
    date: route.date,
    day: route.day
  } : null;

  // Create scenario with enriched metadata
  const scenarioId = Scenarios.create(name, 'task-removal', {
    route_id: window.currentRouteId,
    removed_tasks: selectedTasks,
    baseline: window.baselineMetrics
  }, {
    description: description,
    baseRoute: baseRoute
  });

  // Store V1 metrics for comparison
  const baseline = window.baselineMetrics;
  const removedCount = selectedTasks.length;
  const v1Metrics = {
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

  Scenarios.setResults(scenarioId, v1Metrics);
  closeSaveScenarioModal();
  showNotification(`Scenario "${name}" saved as ${scenarioId.toUpperCase()}!`, 'success');
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

// Get metrics for a scenario or V0 baseline
function getMetricsForSelection(value) {
  if (value === 'v0' || !value) {
    return getDefaultBaseline();
  }
  const scenario = Scenarios.get(value);
  if (!scenario) return getDefaultBaseline();
  const baseline = scenario.config?.baseline || getDefaultBaseline();
  return scenario.results || estimateV1Metrics(baseline, scenario);
}

// Update comparison table with selected scenarios
function updateComparisonTable() {
  // Support both new (compare-left/compare-right) and legacy (scenario-version) selectors
  const leftSelect = document.getElementById('compare-left');
  const rightSelect = document.getElementById('compare-right') || document.getElementById('scenario-version');

  const leftValue = leftSelect?.value || 'v0';
  const rightValue = rightSelect?.value;

  if (!rightValue) {
    resetComparisonDisplay();
    return;
  }

  const baseline = getMetricsForSelection(leftValue);
  const v1 = getMetricsForSelection(rightValue);

  if (!baseline || !v1) {
    resetComparisonDisplay();
    return;
  }

  // Update V0 (left) columns
  setText('cmp-v0-tasks', baseline.tasks);
  setText('cmp-v0-sps', baseline.sps);
  setText('cmp-v0-distance', formatDistance(baseline.distance));
  setText('cmp-v0-time', formatTime(baseline.time));
  setText('cmp-v0-rate', formatPercentage(baseline.tasks > 0 ? 1 : 0));
  setText('cmp-v0-fuel-cost', formatCurrency(baseline.fuelCost));
  setText('cmp-v0-labor-cost', formatCurrency(baseline.laborCost));
  setText('cmp-v0-total-cost', formatCurrency(baseline.totalCost));
  setText('cmp-v0-fuel-used', (baseline.fuelUsed || 0).toFixed(1) + ' L');
  setText('cmp-v0-co2', formatCO2(baseline.co2));

  // Update V1 (right) columns
  setText('cmp-v1-tasks', v1.tasks);
  setText('cmp-v1-sps', v1.sps);
  setText('cmp-v1-distance', formatDistance(v1.distance));
  setText('cmp-v1-time', formatTime(v1.time));
  setText('cmp-v1-rate', formatPercentage(v1.tasks > 0 ? 1 : 0));
  setText('cmp-v1-fuel-cost', formatCurrency(v1.fuelCost || 0));
  setText('cmp-v1-labor-cost', formatCurrency(v1.laborCost || 0));
  setText('cmp-v1-total-cost', formatCurrency(v1.totalCost));
  setText('cmp-v1-fuel-used', (v1.fuelUsed || 0).toFixed(1) + ' L');
  setText('cmp-v1-co2', formatCO2(v1.co2));

  // Update delta columns
  setCompDelta('cmp-delta-tasks', v1.tasks - baseline.tasks);
  setCompDelta('cmp-delta-sps', v1.sps - baseline.sps);
  setCompDelta('cmp-delta-distance', v1.distance - baseline.distance, ' km');
  setCompDelta('cmp-delta-time', v1.time - baseline.time, ' min');
  setCompDelta('cmp-delta-rate', 0, '%');
  setCompDelta('cmp-delta-fuel-cost', (v1.fuelCost || 0) - (baseline.fuelCost || 0), '', true);
  setCompDelta('cmp-delta-labor-cost', (v1.laborCost || 0) - (baseline.laborCost || 0), '', true);
  setCompDelta('cmp-delta-total-cost', v1.totalCost - baseline.totalCost, '', true);
  setCompDelta('cmp-delta-fuel-used', (v1.fuelUsed || 0) - (baseline.fuelUsed || 0), ' L');
  setCompDelta('cmp-delta-co2', v1.co2 - baseline.co2, ' kg');

  // Update narrative if right side is a scenario
  const scenario = Scenarios.get(rightValue);
  if (scenario) {
    updateNarrative(scenario, baseline, v1);
  }
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
  const leftSelect = document.getElementById('compare-left');
  const rightSelect = document.getElementById('compare-right') || document.getElementById('scenario-version');
  if (leftSelect) leftSelect.value = 'v0';
  if (rightSelect) rightSelect.value = '';
  resetComparisonDisplay();
  showNotification('Comparison reset', 'info');
}

// Create new scenario
function createNewScenario() {
  navigateToPage('removing-visited');
}

// Export comparison report
function exportComparison() {
  const scenarioSelect = document.getElementById('scenario-version') || document.getElementById('compare-right');
  const scenarioId = scenarioSelect?.value;

  if (!scenarioId) {
    showNotification('Please select a scenario first', 'warning');
    return;
  }

  showNotification('Export feature coming soon...', 'info');
}

// Rename scenario
function renameScenario(id) {
  const scenario = Scenarios.get(id);
  if (!scenario) return;

  const newName = prompt('Enter new name:', scenario.name);
  if (newName && newName.trim()) {
    Scenarios.updateMetadata(id, { name: newName.trim() });
    showNotification(`Scenario renamed to "${newName.trim()}"`, 'success');
    // Refresh page
    navigateToPage('saved-scenarios');
  }
}

// Delete scenario
function deleteScenario(id) {
  const scenario = Scenarios.get(id);
  if (!scenario) return;

  if (confirm(`Delete scenario ${id.toUpperCase()} - "${scenario.name}"? This cannot be undone.`)) {
    Scenarios.delete(id);
    showNotification('Scenario deleted', 'info');
    // Refresh page
    navigateToPage('saved-scenarios');
  }
}

// Swap comparison dropdowns
function swapComparison() {
  const left = document.getElementById('compare-left');
  const right = document.getElementById('compare-right');
  if (!left || !right) return;

  const leftVal = left.value;
  const rightVal = right.value;

  // Check if values exist in opposite dropdown
  if (leftVal && right.querySelector(`option[value="${leftVal}"]`)) {
    right.value = leftVal;
  }
  if (rightVal && left.querySelector(`option[value="${rightVal}"]`)) {
    left.value = rightVal;
  }

  updateComparisonTable();
}

// ─── Frequency Optimization Helpers ────────────────────────────────────────

// Render SP recommendation cards into the list
function renderFreqSPCards(spList) {
  const container = document.getElementById('freq-sp-list');
  if (!container) return;

  if (!spList || spList.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;">
        <div class="empty-state-icon">&#128269;</div>
        <div class="empty-state-title">No Matching Service Points</div>
        <div class="empty-state-text">Try adjusting your filters.</div>
      </div>
    `;
    return;
  }

  const countLabel = document.getElementById('freq-sp-count');
  if (countLabel) countLabel.textContent = `${spList.length} service points`;

  container.innerHTML = spList.map(sp => `
    <div class="freq-sp-card" id="freq-card-${sp.sp_id}" data-sp="${sp.sp_id}">
      <div class="freq-sp-card-header" onclick="toggleFreqSPCard('${sp.sp_id}')">
        <label class="freq-sp-checkbox" onclick="event.stopPropagation()">
          <input type="checkbox" name="freq-sp-select" value="${sp.sp_id}" onchange="onFreqSPSelectionChange()">
        </label>
        <div class="freq-sp-id">${sp.sp_id}</div>
        <div class="freq-arrow">${sp.currentFrequency}d &#8594; ${sp.optimalFrequency}d</div>
        <span class="confidence-badge ${sp.confidence.toLowerCase()}">${sp.confidence}</span>
        <span class="freq-expand-icon">&#9654;</span>
      </div>
      <div class="freq-sp-card-body">
        <div class="freq-sp-meta">
          <span class="text-muted">Zone: ${sp.zone}</span>
          <span class="text-muted">Assets: ${sp.assetTypes}</span>
          <span class="text-muted">Overall: ${formatPercentage(sp.overallRate)}</span>
        </div>
        <table class="freq-day-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Samples</th>
              <th>Done</th>
              <th>Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${DAY_ORDER.map(day => {
              const da = sp.dayAnalysis[day];
              if (!da) return '';
              return `
                <tr class="freq-day-cell ${da.classification}">
                  <td>${day}</td>
                  <td>${da.total}</td>
                  <td>${da.done}</td>
                  <td>${formatPercentage(da.rate)}</td>
                  <td><span class="day-badge ${da.classification}">${da.classification === 'good' ? 'Keep' : 'Remove'}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div class="freq-sp-savings">
          Est. weekly savings: <strong>${formatCurrency(sp.estimatedSavings.cost)}</strong>
          (${sp.removableDays.length} trip${sp.removableDays.length !== 1 ? 's' : ''} removed)
        </div>
      </div>
    </div>
  `).join('');
}

// Toggle expand/collapse of an SP card
function toggleFreqSPCard(spId) {
  const card = document.getElementById(`freq-card-${spId}`);
  if (card) card.classList.toggle('expanded');
}

// Handle SP selection change
function onFreqSPSelectionChange() {
  const checkboxes = document.querySelectorAll('input[name="freq-sp-select"]:checked');
  const selectedIds = Array.from(checkboxes).map(cb => cb.value);
  updateFreqImpactPreview(selectedIds);
}

// Update the impact preview panel
function updateFreqImpactPreview(selectedIds) {
  const impact = FrequencyAnalyzer.calculateImpact(selectedIds);
  const total = window._freqAllOptimizable?.length || 0;

  setText('freq-impact-selected', `${selectedIds.length} of ${total}`);
  setText('freq-impact-trips', impact ? `-${impact.trips}` : '0');
  setText('freq-impact-distance', impact ? `-${impact.distance.toFixed(1)} km` : '0 km');
  setText('freq-impact-time', impact ? `-${impact.time.toFixed(0)} min` : '0 min');
  setText('freq-impact-cost', impact ? `-${formatCurrency(impact.cost).replace('$', '')}` : '$0.00');
  setText('freq-impact-co2', impact ? `-${impact.co2.toFixed(2)} kg` : '0 kg');

  const summaryEl = document.getElementById('freq-impact-summary');
  if (summaryEl) {
    if (selectedIds.length === 0) {
      summaryEl.textContent = 'Select service points to see estimated impact.';
    } else {
      const days = impact.affectedDays.map(d => d.slice(0, 3)).join(', ');
      summaryEl.innerHTML = `Optimizing <strong>${selectedIds.length} SPs</strong> across ${days} would save <strong>${formatCurrency(impact.cost)}/week</strong>.`;
    }
  }
}

// Filter frequency SP cards
function filterFreqSPs() {
  const dayFilter = document.getElementById('freq-filter-day')?.value || '';
  const confFilter = document.getElementById('freq-filter-confidence')?.value || '';
  const sortBy = document.getElementById('freq-sort')?.value || 'savings';

  const options = { sortBy };
  if (dayFilter) options.day = dayFilter;
  if (confFilter) options.minConfidence = confFilter;

  const filtered = FrequencyAnalyzer.getOptimizable(options);
  window._freqOptimizable = filtered;
  renderFreqSPCards(filtered);

  // Reset selections
  updateFreqImpactPreview([]);
}

// Select all visible frequency SPs
function selectAllVisibleFreqSPs() {
  const checkboxes = document.querySelectorAll('input[name="freq-sp-select"]');
  checkboxes.forEach(cb => cb.checked = true);
  onFreqSPSelectionChange();
}

// Deselect all frequency SPs
function deselectAllFreqSPs() {
  const checkboxes = document.querySelectorAll('input[name="freq-sp-select"]');
  checkboxes.forEach(cb => cb.checked = false);
  onFreqSPSelectionChange();
}
