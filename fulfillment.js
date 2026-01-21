document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================
  // DIAGNOSTICS
  // ==========================================================
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
    const parts = String(dateStr).split('/');
    return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // ==========================================================
  // ELEMENTS
  // ==========================================================
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const datasetToggleBtn = document.getElementById('datasetToggleBtn');
  const datasetLabelEl = document.getElementById('datasetLabel');

  const fillRate4El = document.getElementById('fillRate4Day');
  const fillRate7El = document.getElementById('fillRate7Day');
  const totalOrdersEl = document.getElementById('totalOrders');
  const avgOrdersEl = document.getElementById('avgOrders');
  const periodLabelEl = document.getElementById('periodLabel');

  const tooltipEl = document.getElementById('tooltip');

  // Panels (from the fixed HTML)
  const monthlyPanel = document.querySelector('.monthly-view.view-panel');
  const calendarPanel = document.querySelector('.calendar-view.view-panel');

  const calendarGrid = document.getElementById('calendarGrid');

  // ==========================================================
  // STATE
  // ==========================================================
  let currentDataset = 'retail'; // 'retail' | 'wholesale'
  let currentView = 'monthly';   // 'monthly' | 'calendar'
  let currentYear;
  let currentMonth;

  let fillRateChart = null;
  let ordersChart = null;

  function activeData() {
    if (currentDataset === 'wholesale') return (typeof wholesaleData !== 'undefined' ? wholesaleData : []);
    return (typeof fullData !== 'undefined' ? fullData : []);
  }

  function getAvailableYears(data) {
    const years = new Set();
    (data || []).forEach(d => {
      const dt = parseDate(d.date);
      if (!Number.isNaN(dt.getTime())) years.add(dt.getFullYear());
    });
    return Array.from(years).sort((a, b) => a - b);
  }

  function getMostRecentDataMonth(data) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        const now = new Date();
        return { month: now.getMonth(), year: now.getFullYear() };
      }

      // Prefer rows that have orders (ignore completely empty/zero-only periods)
      const filtered = data.filter(d => d && typeof d.date === 'string');
      if (filtered.length === 0) {
        const now = new Date();
        return { month: now.getMonth(), year: now.getFullYear() };
      }

      const sorted = [...filtered].sort((a, b) => parseDate(b.date) - parseDate(a.date));
      const mostRecent = parseDate(sorted[0].date);

      return { month: mostRecent.getMonth(), year: mostRecent.getFullYear() };
    } catch (e) {
      console.error('[Fulfillment] getMostRecentDataMonth failed:', e);
      const now = new Date();
      return { month: now.getMonth(), year: now.getFullYear() };
    }
  }

  // NOTE: keep your original behavior: filter out orders=0 for the MONTHLY table/charts
  function getMonthData(year, month) {
    const data = activeData();
    return (data || []).filter(d => {
      const dt = parseDate(d.date);
      return dt.getFullYear() === year && dt.getMonth() === month && (d.orders || 0) > 0;
    });
  }

  // For calendar/year KPIs we can still filter orders>0 so 0-days don't crush averages
  function getYearData(year) {
    const data = activeData();
    return (data || []).filter(d => parseDate(d.date).getFullYear() === year);
  }

  function setTooltip(show, html, x, y) {
    if (!tooltipEl) return;
    if (!show) {
      tooltipEl.classList.remove('show');
      return;
    }
    tooltipEl.innerHTML = html;
    tooltipEl.style.left = (x + 12) + 'px';
    tooltipEl.style.top = (y + 12) + 'px';
    tooltipEl.classList.add('show');
  }

  // ==========================================================
  // UI: YEAR/MONTH SELECTORS
  // ==========================================================
  function populateYearMonthSelectors() {
    if (!yearSelect || !monthSelect) {
      console.warn('[Fulfillment] Missing yearSelect or monthSelect in DOM');
      return;
    }

    const years = getAvailableYears(activeData());
    yearSelect.innerHTML = '';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    });

    monthSelect.innerHTML = '';
    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    months.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });

    // If currentYear/currentMonth are not set or no longer valid, re-anchor to most recent
    const mostRecent = getMostRecentDataMonth(activeData());
    if (typeof currentYear !== 'number' || !years.includes(currentYear)) currentYear = mostRecent.year;
    if (typeof currentMonth !== 'number') currentMonth = mostRecent.month;

    // Clamp month just in case
    currentMonth = clamp(currentMonth, 0, 11);

    yearSelect.value = String(currentYear);
    monthSelect.value = String(currentMonth);
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
        <td>${(row.orders || 0).toLocaleString()}</td>
        <td>${(row.rem4 || 0).toLocaleString()}</td>
        <td>${(row.rem7 || 0).toLocaleString()}</td>
        <td class="${getRateClass(row.rate4 || 0)}">${(row.rate4 ?? 0).toFixed(2)}%</td>
        <td class="${getRateClass(row.rate7 || 0)}">${(row.rate7 ?? 0).toFixed(2)}%</td>
      `;
      tbody.appendChild(tr);
    });

    padTableToFill();
  }

  // ==========================================================
  // CHARTS
  // ==========================================================
  function updateCharts(monthData) {
    if (!window.Chart) return;

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
  // CALENDAR RENDERING (FIXES "BLANK CALENDAR")
  // ==========================================================
  function getCalendarClass(rate7, orders) {
    if (!orders || orders <= 0) return 'cal-rate-none';
    if (rate7 >= 95) return 'cal-rate-excellent';
    if (rate7 >= 85) return 'cal-rate-good';
    if (rate7 >= 70) return 'cal-rate-warning';
    return 'cal-rate-poor';
  }

  function renderCalendar(year) {
    if (!calendarGrid) return;

    calendarGrid.innerHTML = '';

    const data = getYearData(year);
    const byKey = new Map();
    data.forEach(d => {
      const dt = parseDate(d.date);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      byKey.set(key, d);
    });

    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    const dayLabels = ['S','M','T','W','T','F','S'];

    for (let m = 0; m < 12; m++) {
      const monthWrap = document.createElement('div');
      monthWrap.className = 'month-calendar';

      const header = document.createElement('div');
      header.className = 'month-header';
      header.textContent = `${months[m]} ${year}`;
      monthWrap.appendChild(header);

      const daysGrid = document.createElement('div');
      daysGrid.className = 'calendar-days';

      // Day labels
      dayLabels.forEach(lbl => {
        const d = document.createElement('div');
        d.className = 'day-label';
        d.textContent = lbl;
        daysGrid.appendChild(d);
      });

      const first = new Date(year, m, 1);
      const firstDay = first.getDay(); // 0=Sun
      const daysInMonth = new Date(year, m + 1, 0).getDate();

      // Empty leading cells
      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        daysGrid.appendChild(empty);
      }

      // Real days
      for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');

        const key = `${year}-${m}-${day}`;
        const row = byKey.get(key);

        const orders = row ? (row.orders || 0) : 0;
        const rate7 = row ? (row.rate7 ?? 0) : 0;

        cell.className = `calendar-day ${getCalendarClass(rate7, orders)}`;
        cell.innerHTML = `<div style="font-weight:700;font-size:0.95em;line-height:1;">${day}</div>`;

        if (row && tooltipEl) {
          cell.addEventListener('mousemove', (e) => {
            setTooltip(
              true,
              `
                <div style="font-weight:700;margin-bottom:6px;">${months[m]} ${day}, ${year}</div>
                <div>Orders: <b>${(row.orders || 0).toLocaleString()}</b></div>
                <div>Rem 4D: <b>${(row.rem4 || 0).toLocaleString()}</b></div>
                <div>Rem 7D: <b>${(row.rem7 || 0).toLocaleString()}</b></div>
                <div>Rate 4D: <b>${(row.rate4 ?? 0).toFixed(2)}%</b></div>
                <div>Rate 7D: <b>${(row.rate7 ?? 0).toFixed(2)}%</b></div>
              `,
              e.clientX,
              e.clientY
            );
          });
          cell.addEventListener('mouseleave', () => setTooltip(false));
        }

        daysGrid.appendChild(cell);
      }

      monthWrap.appendChild(daysGrid);
      calendarGrid.appendChild(monthWrap);
    }
  }

  // ==========================================================
  // DASHBOARD UPDATE
  // ==========================================================
  function updateDatasetUI() {
    if (datasetLabelEl) datasetLabelEl.textContent = (currentDataset === 'wholesale' ? '- Wholesale' : '- Retail');
    if (datasetToggleBtn) datasetToggleBtn.textContent = (currentDataset === 'wholesale' ? 'Retail' : 'Wholesale');
  }

  function setKpis(avg4, avg7, total, avgOrders, periodLabel) {
    if (fillRate4El) fillRate4El.textContent = Number.isFinite(avg4) ? Math.round(avg4) + '%' : 'N/A';
    if (fillRate7El) fillRate7El.textContent = Number.isFinite(avg7) ? Math.round(avg7) + '%' : 'N/A';
    if (totalOrdersEl) totalOrdersEl.textContent = (total || 0).toLocaleString();
    if (avgOrdersEl) avgOrdersEl.textContent = Math.round(avgOrders || 0).toLocaleString();
    if (periodLabelEl) periodLabelEl.textContent = periodLabel;
  }

  function updateDashboard() {
    const data = activeData();

    if (!Array.isArray(data) || data.length === 0) {
      console.error('[Fulfillment] Active dataset missing/empty. Check data.js / wholesale.js loading paths.');
      const tbody = document.getElementById('dataTable');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">ERROR: Dataset not loaded (${currentDataset})</td></tr>`;
      }
      setKpis(NaN, NaN, 0, 0, (currentView === 'calendar' ? 'year' : 'month'));
      return;
    }

    if (currentView === 'calendar') {
      const yearData = getYearData(currentYear).filter(d => (d.orders || 0) > 0);

      if (yearData.length === 0) {
        setKpis(NaN, NaN, 0, 0, 'year');
        if (calendarGrid) calendarGrid.innerHTML = `<div style="color:#8d8173;">No data available for ${currentYear}</div>`;
        return;
      }

      const avg4 = yearData.reduce((s, d) => s + (d.rate4 || 0), 0) / yearData.length;
      const avg7 = yearData.reduce((s, d) => s + (d.rate7 || 0), 0) / yearData.length;
      const total = yearData.reduce((s, d) => s + (d.orders || 0), 0);
      const avgOrders = total / yearData.length;

      setKpis(avg4, avg7, total, avgOrders, 'year');
      renderCalendar(currentYear);
      return;
    }

    // MONTHLY
    const monthData = getMonthData(currentYear, currentMonth);

    console.log(`[Fulfillment] Rendering ${currentDataset} ${currentYear}-${currentMonth + 1}, rows:`, monthData.length);

    if (monthData.length === 0) {
      setKpis(NaN, NaN, 0, 0, 'month');

      if (fillRateChart) fillRateChart.destroy();
      if (ordersChart) ordersChart.destroy();

      const tbody = document.getElementById('dataTable');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No data available for this month</td></tr>';
      }
      return;
    }

    const avg4 = monthData.reduce((s, d) => s + (d.rate4 || 0), 0) / monthData.length;
    const avg7 = monthData.reduce((s, d) => s + (d.rate7 || 0), 0) / monthData.length;
    const total = monthData.reduce((s, d) => s + (d.orders || 0), 0);
    const avgOrders = total / monthData.length;

    setKpis(avg4, avg7, total, avgOrders, 'month');

    updateTable(monthData);
    try {
      updateCharts(monthData);
    } catch (e) {
      console.error('[Fulfillment] Chart render failed, table still shown:', e);
    }
  }

  // ==========================================================
  // VIEW SWITCHING (works with .view-panel.active)
  // ==========================================================
  function setView(view) {
    currentView = view;

    // Button active styling
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.view-btn[data-view="${view}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Panel switching
    if (monthlyPanel) monthlyPanel.classList.toggle('active', view === 'monthly');
    if (calendarPanel) calendarPanel.classList.toggle('active', view === 'calendar');

    // Month disabled in calendar view
    if (monthSelect) monthSelect.disabled = (view === 'calendar');

    updateDashboard();
  }

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  // ==========================================================
  // DATASET TOGGLE (FIXES "WHOLESALE DOESN'T SWAP")
  // ==========================================================
  if (datasetToggleBtn) {
    datasetToggleBtn.addEventListener('click', () => {
      currentDataset = (currentDataset === 'wholesale') ? 'retail' : 'wholesale';
      updateDatasetUI();

      // Rebuild year list based on the NEW dataset
      const mostRecent = getMostRecentDataMonth(activeData());
      currentYear = mostRecent.year;
      currentMonth = mostRecent.month;

      populateYearMonthSelectors();

      // If currently on calendar view, make sure calendar renders for the new dataset
      updateDashboard();
    });
  }

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
  updateDatasetUI();

  const mostRecent = getMostRecentDataMonth(activeData());
  currentYear = mostRecent.year;
  currentMonth = mostRecent.month;

  populateYearMonthSelectors();
  setView('monthly');

  window.addEventListener('resize', () => {
    padTableToFill();
    if (fillRateChart) fillRateChart.resize();
    if (ordersChart) ordersChart.resize();
  });

  // Hide tooltip on scroll / escape
  window.addEventListener('scroll', () => setTooltip(false), true);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setTooltip(false);
  });
});
