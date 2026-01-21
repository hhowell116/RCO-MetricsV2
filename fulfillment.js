document.addEventListener('DOMContentLoaded', () => {
  console.log('[Fulfillment] DOM loaded');
  console.log('[Fulfillment] Chart.js loaded?', !!window.Chart);
  console.log('[Fulfillment] fullData exists?', typeof fullData !== 'undefined');
  console.log('[Fulfillment] wholesaleData exists?', typeof wholesaleData !== 'undefined');

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

  function monthName(m) {
    return [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ][m];
  }

  // ==========================================================
  // STATE (Retail vs Wholesale)
  // ==========================================================
  let isWholesale = false;

  function getActiveData() {
    if (isWholesale) {
      if (typeof wholesaleData !== 'undefined' && Array.isArray(wholesaleData)) return wholesaleData;
      return []; // fallback
    }
    if (typeof fullData !== 'undefined' && Array.isArray(fullData)) return fullData;
    return [];
  }

  function getMostRecentDataMonth() {
    const data = getActiveData();
    if (!data.length) {
      const now = new Date();
      return { month: now.getMonth(), year: now.getFullYear() };
    }
    const sorted = [...data].sort((a, b) => parseDate(b.date) - parseDate(a.date));
    const mostRecent = parseDate(sorted[0].date);
    return { month: mostRecent.getMonth(), year: mostRecent.getFullYear() };
  }

  function getMonthData(year, month) {
    const data = getActiveData();
    return data.filter(d => {
      const dt = parseDate(d.date);
      return dt.getFullYear() === year && dt.getMonth() === month && d.orders > 0;
    });
  }

  function getYearData(year) {
    const data = getActiveData();
    return data.filter(d => parseDate(d.date).getFullYear() === year);
  }

  // ==========================================================
  // DOM
  // ==========================================================
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const datasetLabel = document.getElementById('datasetLabel');
  const datasetToggleBtn = document.getElementById('datasetToggleBtn');

  const monthlyView = document.querySelector('.monthly-view');
  const calendarView = document.getElementById('calendarView');
  const calendarGrid = document.getElementById('calendarGrid');

  const tooltip = document.getElementById('tooltip');

  // ==========================================================
  // CHART INSTANCES
  // ==========================================================
  let currentView = 'monthly';
  let currentMonth, currentYear;
  let fillRateChart, ordersChart;

  // ==========================================================
  // UI: YEAR/MONTH SELECTORS
  // ==========================================================
  function populateYearMonthSelectors() {
    if (!yearSelect || !monthSelect) return;

    yearSelect.innerHTML = '';
    const years = [2025, 2026];
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });

    monthSelect.innerHTML = '';
    for (let m = 0; m < 12; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = monthName(m);
      monthSelect.appendChild(opt);
    }
  }

  // ==========================================================
  // TABLE
  // ==========================================================
  function updateTable(monthData) {
    const tbody = document.getElementById('dataTable');
    if (!tbody) return;
    tbody.innerHTML = '';

    // "lighter" red/green/yellow text colors — KEEP THESE
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
  }

  // ==========================================================
  // CHARTS
  // ==========================================================
  function updateCharts(monthData) {
    if (!window.Chart) return;

    const labels = monthData.map(d => parseDate(d.date).getDate());

    // Fill Rate Chart
    if (fillRateChart) fillRateChart.destroy();
    const c1 = document.getElementById('fillRateChart');
    if (!c1) return;
    fillRateChart = new Chart(c1.getContext('2d'), {
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
          legend: { display: true, labels: { font: { size: 11 }, usePointStyle: true, padding: 12, boxWidth: 15 } }
        },
        scales: {
          y: {
            min: 0, max: 105,
            ticks: { callback: v => v + '%', stepSize: 10 },
          }
        }
      }
    });

    // Orders Chart
    if (ordersChart) ordersChart.destroy();
    const c2 = document.getElementById('ordersChart');
    if (!c2) return;
    ordersChart = new Chart(c2.getContext('2d'), {
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
          legend: { display: true, labels: { font: { size: 11 }, usePointStyle: true, padding: 12, boxWidth: 15 } }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  // ==========================================================
  // CALENDAR RENDER
  // ==========================================================
  function rateClassFromRate7(rate7) {
    if (rate7 == null) return 'cal-rate-none';
    if (rate7 >= 95) return 'cal-rate-excellent';
    if (rate7 >= 85) return 'cal-rate-good';
    if (rate7 >= 70) return 'cal-rate-warning';
    return 'cal-rate-poor';
  }

  function showTooltip(x, y, html) {
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.style.left = (x + 12) + 'px';
    tooltip.style.top = (y + 12) + 'px';
    tooltip.classList.add('show');
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.classList.remove('show');
  }

  function buildCalendar(year) {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';

    const yearData = getYearData(year).filter(d => d.orders > 0);

    // map date -> row
    const byKey = new Map();
    yearData.forEach(r => {
      const dt = parseDate(r.date);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      byKey.set(key, r);
    });

    for (let m = 0; m < 12; m++) {
      const monthCard = document.createElement('div');
      monthCard.className = 'month-calendar';

      const header = document.createElement('div');
      header.className = 'month-header';
      header.textContent = `${monthName(m)} ${year}`;
      monthCard.appendChild(header);

      const days = document.createElement('div');
      days.className = 'calendar-days';

      // Labels
      ['S','M','T','W','T','F','S'].forEach(ch => {
        const lab = document.createElement('div');
        lab.className = 'day-label';
        lab.textContent = ch;
        days.appendChild(lab);
      });

      const first = new Date(year, m, 1);
      const startDay = first.getDay(); // 0 Sun
      const last = new Date(year, m + 1, 0).getDate();

      // empties
      for (let i = 0; i < startDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        days.appendChild(empty);
      }

      // days
      for (let d = 1; d <= last; d++) {
        const key = `${year}-${m}-${d}`;
        const row = byKey.get(key);

        const cell = document.createElement('div');
        cell.className = 'calendar-day ' + rateClassFromRate7(row?.rate7);

        cell.innerHTML = `<div style="font-weight:700;">${d}</div>`;

        if (row) {
          cell.addEventListener('mouseenter', (e) => {
            const html = `
              <div style="font-weight:700; margin-bottom:6px;">
                ${monthName(m)} ${d}, ${year}
              </div>
              <div><b>Orders:</b> ${row.orders.toLocaleString()}</div>
              <div><b>Rate 7D:</b> ${row.rate7.toFixed(2)}%</div>
              <div><b>Rate 4D:</b> ${row.rate4.toFixed(2)}%</div>
              <div><b>Rem 7D:</b> ${row.rem7.toLocaleString()}</div>
              <div><b>Rem 4D:</b> ${row.rem4.toLocaleString()}</div>
            `;
            showTooltip(e.clientX, e.clientY, html);
          });
          cell.addEventListener('mousemove', (e) => {
            if (!tooltip?.classList.contains('show')) return;
            tooltip.style.left = (e.clientX + 12) + 'px';
            tooltip.style.top = (e.clientY + 12) + 'px';
          });
          cell.addEventListener('mouseleave', hideTooltip);
        } else {
          cell.classList.add('cal-rate-none');
        }

        days.appendChild(cell);
      }

      monthCard.appendChild(days);
      calendarGrid.appendChild(monthCard);
    }
  }

  // ==========================================================
  // DASHBOARD UPDATE
  // ==========================================================
  function updateKpisFromData(rows, periodLabelText) {
    const fill4El = document.getElementById('fillRate4Day');
    const fill7El = document.getElementById('fillRate7Day');
    const totalEl = document.getElementById('totalOrders');
    const avgEl = document.getElementById('avgOrders');
    const periodEl = document.getElementById('periodLabel');

    if (!rows.length) {
      if (fill4El) fill4El.textContent = 'N/A';
      if (fill7El) fill7El.textContent = 'N/A';
      if (totalEl) totalEl.textContent = '0';
      if (avgEl) avgEl.textContent = '0';
      if (periodEl) periodEl.textContent = periodLabelText;
      return;
    }

    const avg4 = rows.reduce((s, d) => s + d.rate4, 0) / rows.length;
    const avg7 = rows.reduce((s, d) => s + d.rate7, 0) / rows.length;
    const total = rows.reduce((s, d) => s + d.orders, 0);

    if (fill4El) fill4El.textContent = avg4.toFixed(0) + '%';
    if (fill7El) fill7El.textContent = avg7.toFixed(0) + '%';
    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (avgEl) avgEl.textContent = Math.round(total / rows.length).toLocaleString();
    if (periodEl) periodEl.textContent = periodLabelText;
  }

  function updateDashboard() {
    const data = getActiveData();
    if (!data.length) {
      // clear views
      updateKpisFromData([], currentView === 'calendar' ? 'year' : 'month');
      const tbody = document.getElementById('dataTable');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No data loaded</td></tr>';
      if (calendarGrid) calendarGrid.innerHTML = '';
      return;
    }

    if (currentView === 'calendar') {
      const yearData = getYearData(currentYear).filter(d => d.orders > 0);
      updateKpisFromData(yearData, 'year');
      buildCalendar(currentYear);
      return;
    }

    const monthData = getMonthData(currentYear, currentMonth);
    updateKpisFromData(monthData, 'month');

    if (!monthData.length) {
      const tbody = document.getElementById('dataTable');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No data available for this month</td></tr>';
      if (fillRateChart) fillRateChart.destroy();
      if (ordersChart) ordersChart.destroy();
      return;
    }

    updateTable(monthData);
    try { updateCharts(monthData); }
    catch (e) { console.error('[Fulfillment] Chart render failed:', e); }
  }

  // ==========================================================
  // VIEW BUTTONS
  // ==========================================================
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentView = btn.dataset.view;

      if (currentView === 'monthly') {
        if (monthlyView) monthlyView.style.display = 'grid';
        if (calendarView) calendarView.classList.remove('active');
        if (monthSelect) monthSelect.disabled = false;
      } else {
        if (monthlyView) monthlyView.style.display = 'none';
        if (calendarView) calendarView.classList.add('active');
        if (monthSelect) monthSelect.disabled = true;
      }

      updateDashboard();
    });
  });

  // ==========================================================
  // DATASET TOGGLE (Retail <-> Wholesale)
  // ==========================================================
  function syncDatasetUI() {
    if (datasetLabel) datasetLabel.textContent = isWholesale ? '- Wholesale' : '- Retail';
    if (datasetToggleBtn) {
      datasetToggleBtn.textContent = isWholesale ? 'Retail' : 'Wholesale';
      datasetToggleBtn.classList.toggle('active', isWholesale);
    }
  }

  if (datasetToggleBtn) {
    datasetToggleBtn.addEventListener('click', () => {
      isWholesale = !isWholesale;
      syncDatasetUI();

      // jump selectors to most recent month in the new dataset
      const recent = getMostRecentDataMonth();
      currentMonth = recent.month;
      currentYear = recent.year;

      if (yearSelect) yearSelect.value = String(currentYear);
      if (monthSelect) monthSelect.value = String(currentMonth);

      updateDashboard();
    });
  }

  // ==========================================================
  // YEAR/MONTH LISTENERS
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

  const recent = getMostRecentDataMonth();
  currentMonth = recent.month;
  currentYear = recent.year;

  if (yearSelect) yearSelect.value = String(currentYear);
  if (monthSelect) monthSelect.value = String(currentMonth);

  syncDatasetUI();

  // start in monthly mode
  if (monthlyView) monthlyView.style.display = 'grid';
  if (calendarView) calendarView.classList.remove('active');

  updateDashboard();

  // Keep tooltip from sticking
  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('resize', () => {
    hideTooltip();
    if (fillRateChart) fillRateChart.resize();
    if (ordersChart) ordersChart.resize();
  });
});
