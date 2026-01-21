document.addEventListener('DOMContentLoaded', () => {
  console.log('[Fulfillment] Loaded');

  /* ===============================
     DATA SOURCE STATE
  =============================== */
  let currentDataset = 'retail';
  let data = window.fullData || [];

  if (!Array.isArray(data)) {
    console.error('[Fulfillment] fullData not found');
    showFatalError('fullData is missing — check data.js');
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
     INIT YEAR / MONTH
  =============================== */
  const sorted = [...data].sort((a, b) => parseDate(b.date) - parseDate(a.date));
  const latest = parseDate(sorted[0].date);

  currentYear = latest.getFullYear();
  currentMonth = latest.getMonth();

  /* ===============================
     POPULATE SELECTORS
  =============================== */
  function populateSelectors() {
    const years = [...new Set(data.map(d => parseDate(d.date).getFullYear()))].sort((a, b) => b - a);

    yearSelect.innerHTML = '';
    years.forEach(y => {
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
    return data.filter(d => {
      const dt = parseDate(d.date);
      return (
        dt.getFullYear() === +yearSelect.value &&
        dt.getMonth() === +monthSelect.value &&
        d.orders > 0
      );
    });
  }

  /* ===============================
     UPDATE TABLE
  =============================== */
  function updateTable(rows) {
    dataTable.innerHTML = '';

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
    if (!window.Chart) return;

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
  document.getElementById('datasetToggleBtn').addEventListener('click', e => {
    if (currentDataset === 'retail' && window.wholesaleData) {
      data = wholesaleData;
      currentDataset = 'wholesale';
      e.target.classList.add('active');
      document.getElementById('datasetLabel').textContent = '- Wholesale';
    } else {
      data = fullData;
      currentDataset = 'retail';
      e.target.classList.remove('active');
      document.getElementById('datasetLabel').textContent = '- Retail';
    }
    populateSelectors();
    updateDashboard();
  });

  /* ===============================
     EVENTS
  =============================== */
  yearSelect.addEventListener('change', updateDashboard);
  monthSelect.addEventListener('change', updateDashboard);

  /* ===============================
     START
  =============================== */
  populateSelectors();
  updateDashboard();

  function showFatalError(msg) {
    dataTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#b23b3b;">${msg}</td></tr>`;
  }
});
