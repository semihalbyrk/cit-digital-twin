/* CIT Digital Twin - Chart.js Initialization */

const Charts = {
  instances: {},
  defaultFontColor: '#A0AEC0',
  gridColor: 'rgba(74, 85, 104, 0.3)',

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
          backgroundColor: '#1A1F2E',
          titleColor: '#FFFFFF',
          bodyColor: '#A0AEC0',
          borderColor: '#3A4557',
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
            backgroundColor: '#36A734',
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'Visited',
            data: data.visited,
            backgroundColor: '#F59E0B',
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'To-Do',
            data: data.todo,
            backgroundColor: '#E03C39',
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
            rate >= 90 ? '#36A734' :
            rate >= 70 ? '#3B82F6' :
            rate >= 50 ? '#F59E0B' : '#E03C39'
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
          backgroundColor: ['#36A734', '#F59E0B', '#E03C39'],
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
            backgroundColor: '#E03C39',
            borderRadius: 4
          },
          {
            label: 'Labor Cost',
            data: data.labor,
            backgroundColor: '#3B82F6',
            borderRadius: 4
          },
          {
            label: 'Vehicle Cost',
            data: data.vehicle,
            backgroundColor: '#F59E0B',
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
      i === 0 ? '#3B82F6' : '#0099CC'
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
            borderColor: '#0099CC',
            backgroundColor: 'rgba(0, 153, 204, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#0099CC',
            pointBorderColor: '#1A1F2E',
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
