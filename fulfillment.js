document.addEventListener('DOMContentLoaded', () => {

// ============================================
// DATE HELPERS
// ============================================

function parseDate(dateStr) {
    const parts = dateStr.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

// Find the most recent month with data
function getMostRecentDataMonth() {
    if (!fullData || fullData.length === 0) {
        const now = new Date();
        return { month: now.getMonth(), year: now.getFullYear() };
    }

    const sortedData = [...fullData].sort((a, b) => {
        return parseDate(b.date) - parseDate(a.date);
    });

    const mostRecent = parseDate(sortedData[0].date);
    return { month: mostRecent.getMonth(), year: mostRecent.getFullYear() };
}

// ============================================
// STATE
// ============================================

const recentData = getMostRecentDataMonth();
let currentMonth = recentData.month;
let currentYear = recentData.year;
let currentView = 'monthly';
let fillRateChart, ordersChart;

// ============================================
// DATA FILTERING
// ============================================

function getMonthData(year, month) {
    return fullData.filter(d => {
        const date = parseDate(d.date);
        return (
            date.getFullYear() === year &&
            date.getMonth() === month &&
            d.orders > 0
        );
    });
}

function getYearData(year) {
    return fullData.filter(d => {
        const date = parseDate(d.date);
        return date.getFullYear() === year && d.orders > 0;
    });
}

// ============================================
// DASHBOARD UPDATE
// ============================================

function updateDashboard() {
    if (currentView === 'calendar') {
        renderCalendarView();
        return;
    }

    const monthData = getMonthData(currentYear, currentMonth);

    if (!monthData.length) {
        document.getElementById('fillRate4Day').textContent = 'N/A';
        document.getElementById('fillRate7Day').textContent = 'N/A';
        document.getElementById('totalOrders').textContent = '0';
        document.getElementById('avgOrders').textContent = '0';
        document.getElementById('dataTable').innerHTML =
            '<tr><td colspan="6" style="text-align:center;">No data available</td></tr>';
        return;
    }

    const avg4 = monthData.reduce((s, d) => s + d.rate4, 0) / monthData.length;
    const avg7 = monthData.reduce((s, d) => s + d.rate7, 0) / monthData.length;
    const totalOrders = monthData.reduce((s, d) => s + d.orders, 0);

    document.getElementById('fillRate4Day').textContent = avg4.toFixed(0) + '%';
    document.getElementById('fillRate7Day').textContent = avg7.toFixed(0) + '%';
    document.getElementById('totalOrders').textContent = totalOrders.toLocaleString();
    document.getElementById('avgOrders').textContent =
        Math.round(totalOrders / monthData.length).toLocaleString();

    updateCharts(monthData);
    updateTable(monthData);
}

// ============================================
// RATE COLOR LOGIC (TABLE ONLY)
// ============================================

// 4-Day targets (85% expected)
function getRateClass4(rate) {
    if (rate >= 85) return 'rate-excellent';
    if (rate >= 75) return 'rate-good';
    if (rate >= 65) return 'rate-warning';
    return 'rate-poor';
}

// 7-Day targets (95% expected)
function getRateClass7(rate) {
    if (rate >= 95) return 'rate-excellent';
    if (rate >= 90) return 'rate-good';
    if (rate >= 80) return 'rate-warning';
    return 'rate-poor';
}

// ============================================
// TABLE
// ============================================

function updateTable(monthData) {
    const tbody = document.getElementById('dataTable');
    tbody.innerHTML = '';

    monthData.forEach(row => {
        const tr = document.createElement('tr');
        const date = parseDate(row.date);

        tr.innerHTML = `
            <td>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
            <td>${row.orders.toLocaleString()}</td>
            <td>${row.rem4.toLocaleString()}</td>
            <td>${row.rem7.toLocaleString()}</td>
            <td class="${getRateClass4(row.rate4)}">${row.rate4.toFixed(2)}%</td>
            <td class="${getRateClass7(row.rate7)}">${row.rate7.toFixed(2)}%</td>
        `;

        tbody.appendChild(tr);
    });
}

// ============================================
// CHARTS (UNCHANGED)
// ============================================

function updateCharts(monthData) {
    const labels = monthData.map(d => parseDate(d.date).getDate());

    if (fillRateChart) fillRateChart.destroy();
    if (ordersChart) ordersChart.destroy();

    const ctx1 = document.getElementById('fillRateChart').getContext('2d');
    fillRateChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '7 Day Fill Rate',
                    data: monthData.map(d => d.rate7),
                    borderColor: '#8b7355',
                    tension: 0.3
                },
                {
                    label: '4 Day Fill Rate',
                    data: monthData.map(d => d.rate4),
                    borderColor: '#d2b48c',
                    tension: 0.3
                }
            ]
        }
    });

    const ctx2 = document.getElementById('ordersChart').getContext('2d');
    ordersChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Remaining 4D',
                    data: monthData.map(d => d.rem4),
                    borderColor: '#d2b48c'
                },
                {
                    label: 'Remaining 7D',
                    data: monthData.map(d => d.rem7),
                    borderColor: '#8b7355'
                }
            ]
        }
    });
}

// ============================================
// CONTROLS
// ============================================

document.getElementById('yearSelect').addEventListener('change', e => {
    currentYear = parseInt(e.target.value);
    updateDashboard();
});

document.getElementById('monthSelect').addEventListener('change', e => {
    currentMonth = parseInt(e.target.value);
    updateDashboard();
});

// ============================================
// INIT
// ============================================

document.getElementById('yearSelect').value = currentYear;
document.getElementById('monthSelect').value = currentMonth;
updateDashboard();

});
