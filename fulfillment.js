document.addEventListener('DOMContentLoaded', () => {
  console.log('[Fulfillment] Script loaded');

  /* ===============================
     DATA SOURCE STATE
  =============================== */
  let currentDataset = 'retail';
  let data = window.fullData || [];

  // Debug: Check if data exists
  console.log('[Fulfillment] Data loaded:', data ? `${data.length} rows` : 'NO DATA');

  if (!Array.isArray(data) || data.length === 0) {
    console.error('[Fulfillment] fullData not found or empty');
    showFatalError('fullData is missing or empty — check data.js is loading properly');
    return;
  }

  /* ===============================
     HELPERS
  =============================== */
  const parseDate = d => {
    const [m, day, y] = d.split('/');
    return new Date(+y, +m - 1, +day);
  };

  const getRateClass = rate => {
    if (rate >= 95) return 'rate-excellent';
    if (rate >= 85) return 'rate-good';
    if (rate >= 70) return 'rate-warning';
    return 'rate-poor';
  };

  /* ===============================
     ELEMENTS
  =============================== */
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const dataTable = document.getElementById('dataTable');

  const fill4 = document.getElementById('fillRate4Day');
  const fill7 = document.getElementById('fillRate7Day');
  const totalOrders = document.getElementById('totalOrders');
  const avgOrders = document.getElementById('avgOrders');
  const periodLabel = document.getElementById('periodLabel');

  const monthlyView = document.getElementById('monthlyView');
  const calendarView = document.getElementById('calendarView');

  let fillRateChart, ordersChart;
  let currentYear, currentMonth;
  let currentView = 'monthly';

  /* ===============================
     INIT / CLEAN DATA
     (IMPORTANT FIX: if the dataset contains duplicate dates,
      keep the *best* row instead of the first one. Your data.js
      has duplicates like 12/1 and 12/2 where the first copy has
      orders=0 but the later copy has real numbers. The old
      "keep first" de-dupe was throwing away the real rows,
      making months look empty.)
  =============================== */

  function buildCleanData(dataset) {
    const byDate = new Map();
    for (const row of dataset) {
      if (!row || !row.date) continue;

      const existing = byDate.get(row.date);
      if (!existing) {
        byDate.set(row.date, row);
        continue;
      }

      // Prefer the row with higher orders; if tie, prefer the later row
      // (so the "most recently pasted" / corrected entry wins).
      const existingOrders = Number(existing.orders) || 0;
      const incomingOrders = Number(row.orders) || 0;
      if (incomingOrders > existingOrders || (incomingOrders === existingOrders)) {
        byDate.set(row.date, row);
      }
    }
    return Array.from(byDate.values());
  }

  let cleanData = buildCleanData(data);

  console.log('[Fulfillment] Cleaned data:', cleanData.length, 'rows');

  const sorted = [...cleanData].sort((a, b) => parseDate(b.date) - parseDate(a.date));
  
  // Find the latest date with actual orders
  const latestWithOrders = sorted.find(d => d.orders > 0);
  
  if (!latestWithOrders) {
    console.error('[Fulfillment] No data with orders found');
    showFatalError('No order data found in dataset');
    return;
  }

  const latest = parseDate(latestWithOrders.date);
  currentYear = latest.getFullYear();
  currentMonth = latest.getMonth();

  console.log('[Fulfillment] Latest date with orders:', latestWithOrders.date);

  /* ===============================
     POPULATE SELECTORS
  =============================== */
  function populateSelectors() {
    // Get years that have data with orders
    const yearsWithData = [...new Set(
      cleanData
        .filter(d => d.orders > 0)
        .map(d => parseDate(d.date).getFullYear())
    )].sort((a, b) => b - a);

    console.log('[Fulfillment] Years with data:', yearsWithData);

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

    yearSelect.value = currentYear;
    monthSelect.value = currentMonth;
  }

  /* ===============================
     FILTER DATA
  =============================== */
  function getMonthData() {
    const filtered = cleanData.filter(d => {
      const dt = parseDate(d.date);
      return (
        dt.getFullYear() === +yearSelect.value &&
        dt.getMonth() === +monthSelect.value &&
        d.orders > 0  // Only include days with orders
      );
    });

    console.log(
      `[Fulfillment] Filtered data for ${monthSelect.options[monthSelect.selectedIndex].text} ${yearSelect.value}:`,
      filtered.length,
      'rows'
    );
    
    return filtered;
  }

  /* ===============================
     UPDATE TABLE
  =============================== */
  function updateTable(rows) {
    dataTable.innerHTML = '';

    if (rows.length === 0) {
      dataTable.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:20px;color:#8d8173;">No data available for this month</td></tr>';
      return;
    }

    rows.forEach(r => {
      const tr = document.createElement('tr');
      const dt = parseDate(r.date);

      tr.innerHTML = `
        <td>${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
        <td>${r.orders.toLocaleString()}</td>
        <td class="${getRateClass(r.rate4)}">${r.rem4.toLocaleString()}</td>
        <td class="${getRateClass(r.rate7)}">${r.rem7.toLocaleString()}</td>
        <td class="${getRateClass(r.rate4)}">${r.rate4.toFixed(1)}%</td>
        <td class="${getRateClass(r.rate7)}">${r.rate7.toFixed(1)}%</td>
      `;
      dataTable.appendChild(tr);
    });
  }

  /* ===============================
     UPDATE KPIs
  =============================== */
  function updateKPIs(rows) {
    if (!rows.length) {
      fill4.textContent = 'N/A';
      fill7.textContent = 'N/A';
      totalOrders.textContent = '0';
      avgOrders.textContent = '0';
      return;
    }

    const avg4 = rows.reduce((s, d) => s + d.rate4, 0) / rows.length;
    const avg7 = rows.reduce((s, d) => s + d.rate7, 0) / rows.length;
    const total = rows.reduce((s, d) => s + d.orders, 0);

    fill4.textContent = avg4.toFixed(0) + '%';
    fill7.textContent = avg7.toFixed(0) + '%';
    totalOrders.textContent = total.toLocaleString();
    avgOrders.textContent = Math.round(total / rows.length).toLocaleString();
  }

  /* ===============================
     UPDATE CHARTS
  =============================== */
  function updateCharts(rows) {
    if (!window.Chart) {
      console.warn('[Fulfillment] Chart.js not loaded');
      return;
    }

    if (rows.length === 0) {
      console.log('[Fulfillment] No data to chart');
      return;
    }

    const labels = rows.map(r => parseDate(r.date).getDate());

    if (fillRateChart) fillRateChart.destroy();
    if (ordersChart) ordersChart.destroy();

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
     DASHBOARD UPDATE
  =============================== */
  function updateDashboard() {
    const rows = getMonthData();
    updateKPIs(rows);
    updateTable(rows);
    updateCharts(rows);
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
        monthlyView.style.display = 'grid';
        calendarView.style.display = 'none';
        monthSelect.disabled = false;
      } else {
        monthlyView.style.display = 'none';
        calendarView.style.display = 'block';
        monthSelect.disabled = true;
      }

      updateDashboard();
    });
  });

  /* ===============================
     DATASET TOGGLE
  =============================== */
  const toggleBtn = document.getElementById('datasetToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', e => {
      if (currentDataset === 'retail' && window.wholesaleData) {
        data = window.wholesaleData;
        currentDataset = 'wholesale';
        e.target.classList.add('active');
        const label = document.getElementById('datasetLabel');
        if (label) label.textContent = '- Wholesale';
      } else {
        data = window.fullData;
        currentDataset = 'retail';
        e.target.classList.remove('active');
        const label = document.getElementById('datasetLabel');
        if (label) label.textContent = '- Retail';
      }

      // Recalculate with new dataset (same de-dupe fix)
      cleanData = buildCleanData(data);
      
      populateSelectors();
      updateDashboard();
    });
  }

  /* ===============================
     EVENTS
  =============================== */
  yearSelect.addEventListener('change', updateDashboard);
  monthSelect.addEventListener('change', updateDashboard);

  /* ===============================
     START
  =============================== */
  console.log('[Fulfillment] Initializing dashboard...');
  populateSelectors();
  updateDashboard();
  console.log('[Fulfillment] Dashboard initialized');

  function showFatalError(msg) {
    if (dataTable) {
      dataTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#b23b3b;padding:20px;">${msg}</td></tr>`;
    }
  }
});
