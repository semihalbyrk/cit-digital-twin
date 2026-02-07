/* CIT Digital Twin - Main Application */

// Hash-based routing
const initRouting = () => {
  const handleRouteChange = () => {
    const { page } = getPageParams();
    const pageName = page || 'route-selector';

    // Update active nav
    setActiveNav(pageName);

    // Load page
    UI.loadPage(pageName);
  };

  window.addEventListener('hashchange', handleRouteChange);

  // Handle initial route
  handleRouteChange();
};

// Main initialization
const initApp = async () => {
  console.log('Initializing CIT Digital Twin Dashboard...');

  // Render sidebar
  UI.renderSidebar();
  UI.renderHeader('CIT Digital Twin', 'Loading data...');

  // Load all data from API
  const loaded = await loadAllData();

  if (!loaded) {
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9888;</div>
          <div class="empty-state-title">Connection Error</div>
          <div class="empty-state-text">Could not load data from the server. Make sure the Flask server is running on port 5000.</div>
          <button class="btn-primary mt-20" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
    return;
  }

  // Update sidebar with data
  UI.populateRouteNav();
  UI.updateSidebarStats();

  // Setup routing
  initRouting();

  console.log('CIT Digital Twin Dashboard initialized successfully');
};

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
