document.addEventListener('DOMContentLoaded', () => {
  console.log('[Fulfillment] Script loaded');

  /* ===============================
     HELPERS
  =============================== */
  const parseDate = (d) => {
    const [m, day, y] = String(d).split('/');
    return new Date(+y, +m - 1, +day);
  };

  const getRateClass = (rate) => {
    if (rate >= 95) return 'rate-excellent';
    if (rate >= 85) return 'rate-good';
    if (rate >= 70) return 'rate-warning';
    return 'rate-poor';
  };

  function showFatalError(msg) {
    const dataTable = document.getElementById('dataTable');
    if (dataTable) {
      dataTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#b23b3b;padding:20px;">${msg}</td></tr>`;
    }
  }

  /* ===============================
     BASE DATA (must exist)
  =============================== */
  const retailRaw = window.fullData;
  const wholesaleRaw = window.wholesaleData;

  if (!Array.isArray(retailRaw) || retailRaw.length === 0) {
    console.error('[Fulfillment] fullData missing/empty');
    showFatalError('fullData is missing or empty — check data.js is loading properly');
    return;
  }
  if (!Array.isArray(wholesaleRaw) || wholesaleRaw.length === 0) {
    console.warn('[Fulfillment] wholesaleData missing/empty (wholesale option will still show but may be blank)');
  }

  // Remove duplicates by date, keep first occurrence
  function dedupeByDate(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter((row, index, self) => {
      const firstIndex = self.findIndex(r => r.date === row.date);
      return index === firstIndex;
    });
  }

  function computeTotalDataset(retailArr, wholesaleArr) {
    const r = dedupeByDate(retailArr);
    const w = dedupeByDate(wholesaleArr);

    const map = new Map();

    // Seed with retail
    for (const row of r) {
      map.set(row.date, {
        date: row.date,
        orders: Number(row.orders) || 0,
        rem4: Number(row.rem4) || 0,
        rem7: Number(row.rem7) || 0
      });
    }

    // Add wholesale
    for (const row of w) {
      const existing = map.get(row.date) || { date: row.date, orders: 0, rem4: 0, rem7: 0 };
      existing.orders += Number(row.orders) || 0;
      existing.rem4 += Number(row.rem4) || 0;
      existing.rem7 += Number(row.rem7) || 0;
      map.set(row.date, existing);
    }

    // Recompute rates from totals
    const combined = [];
    for (const item of map.values()) {
      const orders = item.orders || 0;
      const rem4 = item.rem4 || 0;
      const rem7 = item.rem7 || 0;

      const rate4 = orders > 0 ? ((orders - rem4) / orders) * 100 : 0;
      const rate7 = orders > 0 ? ((orders - rem7) / orders) * 100 : 0;

      combined.push({
        date: item.date,
        orders,
        rem4,
        rem7,
        rate4,
        rate7
      });
    }

    return combined;
  }

  /* ===============================
     ELEMENTS
  =============================== */
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const datasetSelect = document.getElementById('datasetSelect');
  const datasetLabel = document.getElementById('datasetLabel');

  const dataTable = document.getElementById('dataTable');
  const fill4 = document.getElementById('fillRate4Day');
  const fill7 = document.getElementById('fillRate7Day');
  const totalOrders = document.getElementById('totalOrders');
  const avgOrders = document.getElementById('avgOrders');
  const periodLabel = document.getElementById('periodLabel');

  const monthlyView = document.getElementById('monthlyView');
  const calendarView = document.getElementById('calendarView');
  const calendarGrid = document.getElementById('calendarGrid');

  const tooltip = document.getElementById('tooltip');

  let fillRateChart, ordersChart;

  let currentDataset = 'retail';
  let activeData = dedupeByDate(retailRaw);
  let cleanData = []; // rebuilt per dataset
  let currentView = 'monthly';

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  /* ===============================
     TOOLTIP (calendar)
  =============================== */
  function forceHideTooltip() {
    if (!tooltip) return;
    tooltip.classList.remove('show');
  }

  function showTooltip(e, data) {
    if (!tooltip) return;
    const date = parseDate(data.date);

    tooltip.innerHTML = `
<strong>${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong><br>
Orders: ${Number(data.orders || 0).toLocaleString()}<br>
4-Day Rate: ${Number(data.rate4 || 0).toFixed(2)}%<br>
7-Day Rate: ${Number(data.rate7 || 0).toFixed(2)}%<br>
Remaining (4d): ${Number(data.rem4 || 0).toLocaleString()}<br>
Remaining (7d): ${Number(data.rem7 || 0).toLocaleString()}
    `.trim();

    tooltip.classList.add('show');
    moveTooltip(e);
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.classList.remove('show');
  }

  function moveTooltip(e) {
    if (!tooltip) return;
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
  }

  /* ===============================
     DATA: BUILD CLEAN + SET LATEST
  =============================== */
  function rebuildCleanDataFromActive() {
    // Keep only rows with valid numeric orders
    cleanData = activeData
      .map(r => ({
        date: r.date,
        orders: Number(r.orders) || 0,
        rem4: Number(r.rem4) || 0,
        rem7: Number(r.rem7) || 0,
        rate4: Number(r.rate4) || 0,
        rate7: Number(r.rate7) || 0
      }))
      .filter(r => r.date && !Number.isNaN(parseDate(r.date).getTime())); // valid date

    // Sort newest-first
    cleanData.sort((a, b) => parseDate(b.date) - parseDate(a.date));

    // Pick most recent day with orders
    const latestWithOrders = cleanData.find(d => d.orders > 0);
    if (latestWithOrders) {
      const dt = parseDate(latestWithOrders.date);
      currentYear = dt.getFullYear();
      currentMonth = dt.getMonth();
    }
  }

  /* ===============================
     SELECTORS (year/month)
  =============================== */
  function populateSelectors() {
    if (!yearSelect || !monthSelect) return;

    const yearsWithData = [...new Set(
      cleanData
        .filter(d => d.orders > 0)
        .map(d => parseDate(d.date).getFullYear())
    )].sort((a, b) => b - a);

    yearSelect.innerHTML = '';
    yearsWithData.forEach(y => {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      yearSelect.appendChild(o);
    });

    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];

    monthSelect.innerHTML = '';
    months.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = m;
      monthSelect.appendChild(o);
    });

    // Default selection
    yearSelect.value = String(currentYear);
    monthSelect.value = String(currentMonth);
  }

  /* ===============================
     FILTERS
  =============================== */
  function getMonthData() {
    const y = +yearSelect.value;
    const m = +monthSelect.value;

    return cleanData
      .filter(d => {
        const dt = parseDate(d.date);
        return dt.getFullYear() === y && dt.getMonth() === m && d.orders > 0;
      })
      .sort((a, b) => parseDate(a.date) - parseDate(b.date)); // chronological for charts/table
  }

  function getYearData() {
    const y = +yearSelect.value;
    return cleanData
      .filter(d => parseDate(d.date).getFullYear() === y && d.orders > 0);
  }

  /* ===============================
     TABLE
  =============================== */
  function updateTable(rows) {
    if (!dataTable) return;

    dataTable.innerHTML = '';

    if (rows.length === 0) {
      dataTable.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#8d8173;">No data available for this month</td></tr>';
      return;
    }

    rows.forEach(r => {
      const tr = document.createElement('tr');
      const dt = parseDate(r.date);

      tr.innerHTML = `
        <td>${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
        <td>${Number(r.orders || 0).toLocaleString()}</td>
        <td>${Number(r.rem4 || 0).toLocaleString()}</td>
        <td>${Number(r.rem7 || 0).toLocaleString()}</td>
        <td class="${getRateClass(r.rate4)}">${Number(r.rate4 || 0).toFixed(2)}%</td>
        <td class="${getRateClass(r.rate7)}">${Number(r.rate7 || 0).toFixed(2)}%</td>
      `;
      dataTable.appendChild(tr);
    });
  }

  /* ===============================
     KPIs
  =============================== */
  function updateKPIs(rows, labelText) {
    if (!fill4 || !fill7 || !totalOrders || !avgOrders) return;

    if (!rows.length) {
      fill4.textContent = 'N/A';
      fill7.textContent = 'N/A';
      totalOrders.textContent = '0';
      avgOrders.textContent = '0';
      if (periodLabel) periodLabel.textContent = labelText;
      return;
    }

    const avg4 = rows.reduce((s, d) => s + (Number(d.rate4) || 0), 0) / rows.length;
    const avg7 = rows.reduce((s, d) => s + (Number(d.rate7) || 0), 0) / rows.length;
    const total = rows.reduce((s, d) => s + (Number(d.orders) || 0), 0);

    fill4.textContent = avg4.toFixed(0) + '%';
    fill7.textContent = avg7.toFixed(0) + '%';
    totalOrders.textContent = total.toLocaleString();
    avgOrders.textContent = Math.round(total / rows.length).toLocaleString();

    if (periodLabel) periodLabel.textContent = labelText;
  }

  /* ===============================
     CHARTS
  =============================== */
  function updateCharts(rows) {
    if (!window.Chart) return;

    if (fillRateChart) fillRateChart.destroy();
    if (ordersChart) ordersChart.destroy();

    if (!rows.length) return;

    const labels = rows.map(r => parseDate(r.date).getDate());

    fillRateChart = new Chart(document.getElementById('fillRateChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '7-Day', data: rows.map(r => r.rate7), borderColor: '#5f4b3c', tension: 0.3 },
          { label: '4-Day', data: rows.map(r => r.rate4), borderColor: '#bd9979', tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    ordersChart = new Chart(document.getElementById('ordersChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Remaining 4D', data: rows.map(r => r.rem4), borderColor: '#bd9979', tension: 0.3 },
          { label: 'Remaining 7D', data: rows.map(r => r.rem7), borderColor: '#5f4b3c', tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  /* ===============================
     CALENDAR VIEW RENDER
  =============================== */
  function renderCalendarView() {
    forceHideTooltip();
    if (!calendarGrid) return;

    calendarGrid.innerHTML = '';

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    const y = +yearSelect.value;

    for (let m = 0; m < 12; m++) {
      const monthDiv = document.createElement('div');
      monthDiv.className = 'month-calendar';

      const header = document.createElement('div');
      header.className = 'month-header';
      header.textContent = months[m];
      monthDiv.appendChild(header);

      const daysContainer = document.createElement('div');
      daysContainer.className = 'calendar-days';

      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
        const label = document.createElement('div');
        label.className = 'day-label';
        label.textContent = day;
        daysContainer.appendChild(label);
      });

      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();

      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        daysContainer.appendChild(empty);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const dayData = cleanData.find(item => {
          const date = parseDate(item.date);
          return date.getFullYear() === y &&
                 date.getMonth() === m &&
                 date.getDate() === d;
        });

        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';

        if (dayData && dayData.orders > 0) {
          const rate = Number(dayData.rate7 || 0);
          let rateClass = 'cal-rate-none';

          if (rate >= 95) rateClass = 'cal-rate-excellent';
          else if (rate >= 85) rateClass = 'cal-rate-good';
          else if (rate >= 70) rateClass = 'cal-rate-warning';
          else if (rate > 0) rateClass = 'cal-rate-poor';

          dayDiv.classList.add(rateClass);
          dayDiv.innerHTML = `<strong>${d}</strong>`;
          dayDiv.setAttribute('data-rate', `${rate.toFixed(0)}%`);

          dayDiv.addEventListener('mouseenter', (e) => showTooltip(e, dayData));
          dayDiv.addEventListener('mouseleave', hideTooltip);
          dayDiv.addEventListener('mousemove', moveTooltip);
        } else {
          dayDiv.classList.add('cal-rate-none');
          dayDiv.innerHTML = `${d}`;
          dayDiv.setAttribute('data-rate', ``);
        }

        daysContainer.appendChild(dayDiv);
      }

      monthDiv.appendChild(daysContainer);
      calendarGrid.appendChild(monthDiv);
    }
  }

  /* ===============================
     DASHBOARD UPDATE
  =============================== */
  function updateDashboard() {
    if (currentView === 'calendar') {
      // KPI = year averages
      const yearRows = getYearData();
      updateKPIs(yearRows, 'year');
      renderCalendarView();

      // Clear monthly table/charts when on calendar
      updateTable([]);
      if (fillRateChart) fillRateChart.destroy();
      if (ordersChart) ordersChart.destroy();
      return;
    }

    const monthRows = getMonthData();
    updateKPIs(monthRows, 'month');
    updateTable(monthRows);
    updateCharts(monthRows);
  }

  /* ===============================
     DATASET SWITCH
  =============================== */
  function setDataset(ds) {
    currentDataset = ds;

    if (ds === 'retail') {
      activeData = dedupeByDate(retailRaw);
      if (datasetLabel) datasetLabel.textContent = '- Retail';
    } else if (ds === 'wholesale') {
      activeData = dedupeByDate(wholesaleRaw || []);
      if (datasetLabel) datasetLabel.textContent = '- Wholesale';
    } else if (ds === 'total') {
      activeData = computeTotalDataset(retailRaw, wholesaleRaw || []);
      if (datasetLabel) datasetLabel.textContent = '- Total';
    }

    rebuildCleanDataFromActive();
    populateSelectors();

    // Keep month disabled in calendar mode
    if (monthSelect) monthSelect.disabled = (currentView === 'calendar');

    updateDashboard();
  }

  /* ===============================
     VIEW TOGGLE
  =============================== */
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentView = btn.dataset.view;

      if (currentView === 'monthly') {
        if (monthlyView) monthlyView.style.display = 'grid';
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

  /* ===============================
     EVENTS
  =============================== */
  if (yearSelect) yearSelect.addEventListener('change', updateDashboard);
  if (monthSelect) monthSelect.addEventListener('change', updateDashboard);

  if (datasetSelect) {
    datasetSelect.addEventListener('change', (e) => {
      const ds = e.target.value;
      setDataset(ds);
    });
  }

  /* ===============================
     START
  =============================== */
  rebuildCleanDataFromActive();
  populateSelectors();

  // Default dropdown to retail
  if (datasetSelect) datasetSelect.value = 'retail';
  if (datasetLabel) datasetLabel.textContent = '- Retail';

  updateDashboard();

  console.log('[Fulfillment] Dashboard initialized');
});
