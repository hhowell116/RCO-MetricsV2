document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================
  // DIAGNOSTICS (helps you see what is failing)
  // ==========================================================
  console.log('[Fulfillment] DOM loaded');
  console.log('[Fulfillment] Chart.js loaded?', !!window.Chart);
  console.log('[Fulfillment] fullData exists?', typeof fullData !== 'undefined');
  console.log('[Fulfillment] wholesaleData exists?', typeof wholesaleData !== 'undefined');

  // ==========================================================
  // CRISP CHARTS (Retina/TV)
  // ==========================================================
  if (window.Chart) {
    Chart.defaults.devicePixelRatio = window.devicePixelRatio || 1;
  }

  // ==========================================================
  // HELPERS
  // ==========================================================
  function parseDate(dateStr) {
    // expects M/D/YYYY
    const parts = dateStr.split('/');
    return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
  }

  function getMostRecentDataMonth() {
    try {
      if (typeof fullData === 'undefined' || !Array.isArray(fullData) || fullData.length === 0) {
        const now = new Date();
        return { month: now.getMonth(), year: now.getFullYear() };
      }

      const sorted = [...fullData].sort((a, b) => parseDate(b.date) - parseDate(a.date));
      const mostRecent = parseDate(sorted[0].date);

      return { month: mostRecent.getMonth(), year: mostRecent.getFullYear() };
    } catch (e) {
      console.error('[Fulfillment] getMostRecentDataMonth failed:', e);
      const now = new Date();
      return { month: now.getMonth(), year: now.getFullYear() };
    }
  }

  // NOTE: currently filters out orders=0 days
  function getMonthData(year, month) {
    if (typeof fullData === 'undefined') return [];
    return fullData.filter(d => {
      const dt = parseDate(d.date);
      return dt.getFullYear() === year && dt.getMonth() === month && d.orders > 0;
    });
  }

  function getYearData(year) {
    if (typeof fullData === 'undefined') return [];
    return fullData.filter(d => parseDate(d.date).getFullYear() === year);
  }

  // ==========================================================
  // STATE
  // ==========================================================
  const recent = getMostRecentDataMonth();
  let currentMonth = recent.month;
  let currentYear = recent.year;
  let currentView = 'monthly';
  let fillRateChart, ordersChart;

  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');

  // ==========================================================
  // UI: YEAR/MONTH SELECTORS
  // ==========================================================
  function populateYearMonthSelectors() {
    if (!yearSelect || !monthSelect) {
      console.warn('[Fulfillment] Missing yearSelect or monthSelect in DOM');
      return;
    }

    yearSelect.innerHTML = '';
    // You had [2025, 2026]; keep that, but if you want dynamic, you can change later
    const years = [2025, 2026];
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });

    monthSelect.innerHTML = '';
    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    months.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });
  }

  // ==========================================================
  // TABLE: PAD TO FILL
  // ==========================================================
  function padTableToFill() {
    const tbody = document.getElementById("dataTable");
    if (!tbody) return;

    const wrapper = tbody.closest(".table-wrapper");
    if (!wrapper) return;

    tbody.querySelectorAll("tr.filler-row").forEach(tr => tr.remove());

    const realRows = Array.from(tbody.querySelectorAll("tr")).filter(tr => !tr.classList.contains('filler-row'));
    if (realRows.length === 0) return;

    const rowHeight = realRows[0].getBoundingClientRect().height || 28;
    const avail = wrapper.getBoundingClientRect().height;

    const targetRows = Math.max(0, Math.floor(avail / rowHeight));
    const needed = Math.max(0, targetRows - realRows.length);

    const colCount = wrapper.querySelectorAll("thead th").length || 6;

    for (let i = 0; i < needed; i++) {
      const tr = document.createElement("tr");
      tr.className = "filler-row";
      for (let c = 0; c < colCount; c++) {
        const td = document.createElement("td");
        td.innerHTML = "&nbsp;";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  function updateTable(monthData) {
    const tbody = document.getElementById('dataTable');
    if (!tbody) {
      console.warn('[Fulfillment] Missing #dataTable tbody');
      return;
    }
    tbody.innerHTML = '';

    const getRateClass = rate => {
      if (rate >= 95) return 'rate-excellent';
      if (rate >= 85) return 'rate-good';
      if (rate >= 70) return 'rate-warning';
      return 'rate-poor';
    };

    monthData.forEach(row => {
      const tr = document.createElement('tr');
      const dt = parseDate(row.date);

      tr.innerHTML = `
        <td>${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
        <td>${row.orders.toLocaleString()}</td>
        <td>${row.rem4.toLocaleString()}</td>
        <td>${row.rem7.toLocaleString()}</td>
        <td class="${getRateClass(row.rate4)}">${row.rate4.toFixed(2)}%</td>
        <td class="${getRateClass(row.rate7)}">${row.rate7.toFixed(2)}%</td>
      `;
      tbody.appendChild(tr);
    });

    padTableToFill();
  }

  // ==========================================================
  // CHARTS (GUARDED: if Chart.js fails, dashboard still shows data)
  // ==========================================================
  function updateCharts(monthData) {
    if (!window.Chart) return; // critical guard

    const labels = monthData.map(d => parseDate(d.date).getDate());

    if (fillRateChart) fillRateChart.destroy();
    const c1 = document.getElementById('fillRateChart');
    if (!c1) return;
    const ctx1 = c1.getContext('2d');

    fillRateChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '7 Day Fill Rate (Target: 95%)',
            data: monthData.map(d => d.rate7),
            borderColor: '#8b7355',
            backgroundColor: 'rgba(139, 115, 85, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBackgroundColor: '#8b7355',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            order: 1
          },
          {
            label: '4 Day Fill Rate (Target: 85%)',
            data: monthData.map(d => d.rate4),
            borderColor: '#d2b48c',
            backgroundColor: 'rgba(210, 180, 140, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBackgroundColor: '#d2b48c',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            order: 2
          },
          {
            label: '95% Target Line',
            data: Array(labels.length).fill(95),
            borderColor: '#5a8c5a',
            borderWidth: 2,
            borderDash: [8, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            order: 3
          },
          {
            label: '85% Target Line',
            data: Array(labels.length).fill(85),
            borderColor: '#d4a05c',
            borderWidth: 2,
            borderDash: [8, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            order: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: window.devicePixelRatio || 1,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: '#8b7355', font: { size: 11 }, usePointStyle: true, padding: 12, boxWidth: 15 }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 105,
            ticks: { callback: v => v + '%', color: '#a0906f', stepSize: 10 },
            grid: { color: 'rgba(210, 180, 140, 0.1)' }
          },
          x: {
            ticks: { color: '#a0906f' },
            grid: { color: 'rgba(210, 180, 140, 0.1)' }
          }
        }
      }
    });

    if (ordersChart) ordersChart.destroy();
    const c2 = document.getElementById('ordersChart');
    if (!c2) return;
    const ctx2 = c2.getContext('2d');

    ordersChart = new Chart(ctx2, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Orders Remaining (4 Day)',
            data: monthData.map(d => d.rem4),
            borderColor: '#d2b48c',
            backgroundColor: 'rgba(210, 180, 140, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBackgroundColor: '#d2b48c',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: 'Orders Remaining (7 Day)',
            data: monthData.map(d => d.rem7),
            borderColor: '#8b7355',
            backgroundColor: 'rgba(139, 115, 85, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBackgroundColor: '#8b7355',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: window.devicePixelRatio || 1,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: '#8b7355', font: { size: 11 }, usePointStyle: true, padding: 12, boxWidth: 15 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#a0906f', callback: v => v.toLocaleString() },
            grid: { color: 'rgba(210, 180, 140, 0.1)' }
          },
          x: {
            ticks: { color: '#a0906f' },
            grid: { color: 'rgba(210, 180, 140, 0.1)' }
          }
        }
      }
    });
  }

  // ==========================================================
  // DASHBOARD UPDATE
  // ==========================================================
  function updateDashboard() {
    // HARD FAIL CHECK: if fullData missing, show a clear message
    if (typeof fullData === 'undefined') {
      console.error('[Fulfillment] fullData is undefined. data.js did not load or is in wrong path.');
      const tbody = document.getElementById('dataTable');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ERROR: data.js not loaded (fullData is undefined)</td></tr>';
      }
      return;
    }

    if (currentView === 'calendar') {
      // If you have calendar functions elsewhere, keep; otherwise just compute KPIs on year
      const yearData = getYearData(currentYear).filter(d => d.orders > 0);

      if (yearData.length === 0) {
        document.getElementById('fillRate4Day').textContent = 'N/A';
        document.getElementById('fillRate7Day').textContent = 'N/A';
        document.getElementById('totalOrders').textContent = '0';
        document.getElementById('avgOrders').textContent = '0';
        document.getElementById('periodLabel').textContent = 'year';
        return;
      }

      const avg4 = yearData.reduce((s, d) => s + d.rate4, 0) / yearData.length;
      const avg7 = yearData.reduce((s, d) => s + d.rate7, 0) / yearData.length;
      const total = yearData.reduce((s, d) => s + d.orders, 0);

      document.getElementById('fillRate4Day').textContent = avg4.toFixed(0) + '%';
      document.getElementById('fillRate7Day').textContent = avg7.toFixed(0) + '%';
      document.getElementById('totalOrders').textContent = total.toLocaleString();
      document.getElementById('avgOrders').textContent = Math.round(total / yearData.length).toLocaleString();
      document.getElementById('periodLabel').textContent = 'year';
      return;
    }

    const monthData = getMonthData(currentYear, currentMonth);

    console.log(`[Fulfillment] Rendering ${currentYear}-${currentMonth + 1}, rows:`, monthData.length);

    if (monthData.length === 0) {
      document.getElementById('fillRate4Day').textContent = 'N/A';
      document.getElementById('fillRate7Day').textContent = 'N/A';
      document.getElementById('totalOrders').textContent = '0';
      document.getElementById('avgOrders').textContent = '0';
      document.getElementById('periodLabel').textContent = 'month';

      if (fillRateChart) fillRateChart.destroy();
      if (ordersChart) ordersChart.destroy();

      const tbody = document.getElementById('dataTable');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No data available for this month</td></tr>';
      }
      return;
    }

    const avg4 = monthData.reduce((s, d) => s + d.rate4, 0) / monthData.length;
    const avg7 = monthData.reduce((s, d) => s + d.rate7, 0) / monthData.length;
    const total = monthData.reduce((s, d) => s + d.orders, 0);

    document.getElementById('fillRate4Day').textContent = avg4.toFixed(0) + '%';
    document.getElementById('fillRate7Day').textContent = avg7.toFixed(0) + '%';
    document.getElementById('totalOrders').textContent = total.toLocaleString();
    document.getElementById('avgOrders').textContent = Math.round(total / monthData.length).toLocaleString();
    document.getElementById('periodLabel').textContent = 'month';

    // IMPORTANT: TABLE FIRST, THEN CHARTS (so Chart failures never hide your data)
    updateTable(monthData);
    try {
      updateCharts(monthData);
    } catch (e) {
      console.error('[Fulfillment] Chart render failed, table still shown:', e);
    }
  }

  // ==========================================================
  // VIEW TOGGLE BUTTONS
  // ==========================================================
  document.querySelectorAll('[data-view]').forEach(btn => {
    if (btn.tagName !== 'BUTTON') return;

    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach(b => {
        if (b.tagName === 'BUTTON') b.classList.remove('active');
      });
      btn.classList.add('active');

      currentView = btn.dataset.view;

      const monthlyView = document.querySelector('.monthly-view');
      const calendarView = document.querySelector('.calendar-view');

      if (currentView === 'monthly') {
        if (monthlyView) monthlyView.style.display = 'block';
        if (calendarView) calendarView.style.display = 'none';
        if (monthSelect) monthSelect.disabled = false;
      } else {
        if (monthlyView) monthlyView.style.display = 'none';
        if (calendarView) calendarView.style.display = 'block';
        if (monthSelect) monthSelect.disabled = true;
      }

      updateDashboard();
    });
  });

  // ==========================================================
  // YEAR/MONTH CHANGE LISTENERS
  // ==========================================================
  if (yearSelect) {
    yearSelect.addEventListener('change', e => {
      currentYear = parseInt(e.target.value, 10);
      updateDashboard();
    });
  }

  if (monthSelect) {
    monthSelect.addEventListener('change', e => {
      currentMonth = parseInt(e.target.value, 10);
      updateDashboard();
    });
  }

  // ==========================================================
  // INIT
  // ==========================================================
  populateYearMonthSelectors();

  // Default selectors to most recent data month
  if (yearSelect) yearSelect.value = String(currentYear);
  if (monthSelect) monthSelect.value = String(currentMonth);

  updateDashboard();

  window.addEventListener("resize", () => {
    padTableToFill();
    if (fillRateChart) fillRateChart.resize();
    if (ordersChart) ordersChart.resize();
  });
});
