/* CIT Digital Twin - Chart.js Initialization */

const Charts = {
  instances: {},
  defaultFontColor: '#98a2b3',
  gridColor: 'rgba(208, 213, 221, 0.3)',

  // Brand colors from design tokens
  colors: {
    done: '#36a734',
    visited: '#F59E0B',
    todo: '#E03C39',
    info: '#3B82F6',
    teal: '#5fc595',
    purple: '#6554c0',
    pink: '#ef186b',
    darkBlue: '#0b2b51',
    lightBlue: '#2563eb',
  },

  // Common chart options
  getCommonOptions(overrides = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: this.defaultFontColor,
            font: { size: 12, family: "'Inter', sans-serif" },
            padding: 16,
            usePointStyle: true,
            pointStyle: 'rectRounded'
          }
        },
        tooltip: {
          backgroundColor: '#0b2b51',
          titleColor: '#ffffff',
          bodyColor: '#d0d5dd',
          borderColor: '#1a3a52',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { weight: '600' },
          bodyFont: { size: 13 },
          displayColors: true,
          boxPadding: 4
        }
      },
      ...overrides
    };
  },

  // Destroy existing chart
  destroy(chartId) {
    if (this.instances[chartId]) {
      this.instances[chartId].destroy();
      delete this.instances[chartId];
    }
  },

  // Daily Task Completion - Stacked Bar Chart
  initDailyCompletion(data) {
    const ctx = document.getElementById('daily-completion-chart');
    if (!ctx) return;
    this.destroy('daily-completion');

    this.instances['daily-completion'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.days,
        datasets: [
          {
            label: 'Done',
            data: data.done,
            backgroundColor: this.colors.done,
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'Visited',
            data: data.visited,
            backgroundColor: this.colors.visited,
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'To-Do',
            data: data.todo,
            backgroundColor: this.colors.todo,
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: this.getCommonOptions({
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: this.defaultFontColor }
          },
          y: {
            stacked: true,
            grid: { color: this.gridColor },
            ticks: { color: this.defaultFontColor },
            title: {
              display: true,
              text: 'Tasks',
              color: this.defaultFontColor
            }
          }
        }
      })
    });
  },

  // Zone Performance - Horizontal Bar Chart
  initZonePerformance(data) {
    const ctx = document.getElementById('zone-performance-chart');
    if (!ctx) return;
    this.destroy('zone-performance');

    this.instances['zone-performance'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.zones,
        datasets: [{
          label: 'Completion Rate (%)',
          data: data.rates,
          backgroundColor: data.rates.map(rate =>
            rate >= 90 ? this.colors.done :
            rate >= 70 ? this.colors.info :
            rate >= 50 ? this.colors.visited : this.colors.todo
          ),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: this.getCommonOptions({
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.x.toFixed(1)}%`
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            grid: { color: this.gridColor },
            ticks: {
              color: this.defaultFontColor,
              callback: (v) => `${v}%`
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: this.defaultFontColor }
          }
        }
      })
    });
  },

  // Task Distribution - Donut Chart
  initTaskDistribution(data) {
    const ctx = document.getElementById('task-distribution-chart');
    if (!ctx) return;
    this.destroy('task-distribution');

    this.instances['task-distribution'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Done', 'Visited', 'To-Do'],
        datasets: [{
          data: [data.done, data.visited, data.todo],
          backgroundColor: [this.colors.done, this.colors.visited, this.colors.todo],
          borderWidth: 0,
          cutout: '70%',
          borderRadius: 4
        }]
      },
      options: this.getCommonOptions({
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: this.defaultFontColor,
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return `${ctx.label}: ${formatNumber(ctx.parsed)} (${pct}%)`;
              }
            }
          }
        }
      })
    });
  },

  // Route Cost Breakdown - Bar Chart
  initCostBreakdown(data) {
    const ctx = document.getElementById('cost-breakdown-chart');
    if (!ctx) return;
    this.destroy('cost-breakdown');

    this.instances['cost-breakdown'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Fuel Cost',
            data: data.fuel,
            backgroundColor: this.colors.todo,
            borderRadius: 4
          },
          {
            label: 'Labor Cost',
            data: data.labor,
            backgroundColor: this.colors.info,
            borderRadius: 4
          },
          {
            label: 'Vehicle Cost',
            data: data.vehicle,
            backgroundColor: this.colors.visited,
            borderRadius: 4
          }
        ]
      },
      options: this.getCommonOptions({
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: this.defaultFontColor }
          },
          y: {
            stacked: true,
            grid: { color: this.gridColor },
            ticks: {
              color: this.defaultFontColor,
              callback: (v) => `$${v}`
            }
          }
        }
      })
    });
  },

  // Comparison Charts (Distance, Cost, Time, CO2)
  initComparisonCharts(data) {
    this.initComparisonChart('distance-comparison-chart', {
      labels: data.versions,
      values: data.distances,
      title: 'Distance',
      unit: 'km'
    });

    this.initComparisonChart('cost-comparison-chart', {
      labels: data.versions,
      values: data.costs,
      title: 'Cost',
      unit: '$',
      prefix: true
    });

    this.initComparisonChart('time-comparison-chart', {
      labels: data.versions,
      values: data.times,
      title: 'Time',
      unit: 'hours'
    });

    this.initComparisonChart('co2-comparison-chart', {
      labels: data.versions,
      values: data.co2,
      title: 'CO2',
      unit: 'kg'
    });
  },

  initComparisonChart(elementId, data) {
    const ctx = document.getElementById(elementId);
    if (!ctx) return;
    this.destroy(elementId);

    const colors = data.labels.map((_, i) =>
      i === 0 ? this.colors.info : this.colors.lightBlue
    );

    this.instances[elementId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: data.title,
          data: data.values,
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 60
        }]
      },
      options: this.getCommonOptions({
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                if (data.prefix) return `${data.unit}${formatDecimal(val, 2)}`;
                return `${formatDecimal(val, 1)} ${data.unit}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: this.defaultFontColor, font: { weight: '600' } }
          },
          y: {
            grid: { color: this.gridColor },
            ticks: {
              color: this.defaultFontColor,
              callback: (v) => {
                if (data.prefix) return `${data.unit}${v}`;
                return `${v} ${data.unit}`;
              }
            }
          }
        }
      })
    });
  },

  // Route Detail - Daily Performance Line Chart
  initDailyPerformance(data) {
    const ctx = document.getElementById('daily-performance-chart');
    if (!ctx) return;
    this.destroy('daily-performance');

    this.instances['daily-performance'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.days,
        datasets: [
          {
            label: 'Completion Rate',
            data: data.rates,
            borderColor: this.colors.lightBlue,
            backgroundColor: 'rgba(15, 137, 198, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: this.colors.lightBlue,
            pointBorderColor: this.colors.darkBlue,
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }
        ]
      },
      options: this.getCommonOptions({
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y.toFixed(1)}%`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: this.defaultFontColor }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: this.gridColor },
            ticks: {
              color: this.defaultFontColor,
              callback: (v) => `${v}%`
            }
          }
        }
      })
    });
  },

  // Destroy all charts
  destroyAll() {
    Object.keys(this.instances).forEach(key => this.destroy(key));
  }
};
