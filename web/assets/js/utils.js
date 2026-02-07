/* CIT Digital Twin - Utility Functions */

// Number formatting
const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(num));
};

const formatDecimal = (num, decimals = 1) => {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

const formatCurrency = (num) => {
  if (num === null || num === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const formatDistance = (km) => {
  if (km === null || km === undefined) return '0 km';
  return `${km.toFixed(1)} km`;
};

const formatTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

const formatPercentage = (value) => {
  if (value === null || value === undefined) return '0%';
  const pct = typeof value === 'number' && value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const formatDateFull = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatCO2 = (kg) => {
  if (kg === null || kg === undefined) return '0 kg';
  return `${kg.toFixed(1)} kg`;
};

// Status helpers
const getStatusColor = (status) => {
  const s = (status || '').toLowerCase().replace(/[\s-]/g, '');
  switch (s) {
    case 'done': return 'var(--color-done)';
    case 'visited': return 'var(--color-visited)';
    case 'todo': return 'var(--color-todo)';
    default: return 'var(--text-secondary)';
  }
};

const getStatusClass = (status) => {
  const s = (status || '').toLowerCase().replace(/[\s-]/g, '');
  return `status-${s}`;
};

const getRateClass = (rate) => {
  const r = rate > 1 ? rate : rate * 100;
  if (r >= 90) return 'high';
  if (r >= 70) return 'medium';
  return 'low';
};

const getDeltaClass = (value) => {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
};

// DOM helpers
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const createElement = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') el.className = value;
    else if (key === 'innerHTML') el.innerHTML = value;
    else if (key === 'textContent') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value);
  });
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  });
  return el;
};

// Navigation
const setActiveNav = (navId) => {
  $$('.nav-item, .nav-child-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeItem = $(`[data-nav="${navId}"]`);
  if (activeItem) activeItem.classList.add('active');
};

const navigateToPage = (pageName, params = {}) => {
  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const hash = queryString ? `${pageName}?${queryString}` : pageName;
  window.location.hash = `#${hash}`;
};

const getPageParams = () => {
  const hash = window.location.hash.slice(1);
  const [page, query] = hash.split('?');
  const params = {};
  if (query) {
    query.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      params[key] = decodeURIComponent(value);
    });
  }
  return { page: page || 'v0-overview', params };
};

const goBack = () => {
  navigateToPage('v0-overview');
};

// Sorting
const sortData = (data, key, direction = 'asc') => {
  return [...data].sort((a, b) => {
    let aVal = a[key];
    let bVal = b[key];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

// Filtering
const filterData = (data, filters) => {
  return data.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value === '') return true;
      return String(item[key]).toLowerCase().includes(String(value).toLowerCase());
    });
  });
};

// Grouping
const groupBy = (data, key) => {
  return data.reduce((groups, item) => {
    const value = item[key];
    if (!groups[value]) groups[value] = [];
    groups[value].push(item);
    return groups;
  }, {});
};

// Aggregation
const sum = (data, key) => data.reduce((total, item) => total + (item[key] || 0), 0);
const avg = (data, key) => data.length ? sum(data, key) / data.length : 0;
const min = (data, key) => Math.min(...data.map(d => d[key] || 0));
const max = (data, key) => Math.max(...data.map(d => d[key] || Infinity));

// Debounce
const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// Throttle
const throttle = (fn, delay = 100) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
};

// Deep clone
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// Generate unique ID
const generateId = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Show/hide elements
const show = (el) => {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.remove('hidden');
};

const hide = (el) => {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.add('hidden');
};

const toggle = (el) => {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.toggle('hidden');
};

// Notification
const showNotification = (message, type = 'info') => {
  const existing = $('.notification');
  if (existing) existing.remove();

  const notification = createElement('div', {
    className: `notification notification-${type}`,
    innerHTML: `<span>${message}</span><button onclick="this.parentElement.remove()">&times;</button>`
  });

  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '9999',
    padding: '14px 20px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    animation: 'fadeIn 0.3s ease',
    maxWidth: '400px',
    backgroundColor: type === 'success' ? 'var(--color-done)' :
                     type === 'error' ? 'var(--color-todo)' :
                     type === 'warning' ? 'var(--color-visited)' :
                     'var(--color-info)',
    color: 'white',
    fontSize: '14px',
    boxShadow: 'var(--shadow-lg)'
  });

  notification.querySelector('button').style.cssText = 'background:none;border:none;color:white;font-size:18px;cursor:pointer;padding:0;';

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
};

// Color helpers
const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Day name mapping
const DAY_ORDER = ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getDayIndex = (day) => {
  return DAY_ORDER.indexOf(day);
};

const getDayDate = (day) => {
  const dates = {
    'Tuesday': '2026-01-06',
    'Wednesday': '2026-01-07',
    'Thursday': '2026-01-08',
    'Friday': '2026-01-10',
    'Saturday': '2026-01-11'
  };
  return dates[day] || '';
};
