document.addEventListener('DOMContentLoaded', () => {

// Find the most recent month with data
function getMostRecentDataMonth() {
    if (!fullData || fullData.length === 0) {
        return { month: new Date().getMonth(), year: new Date().getFullYear() };
    }
    
    // Sort data by date to find the most recent
    const sortedData = [...fullData].sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateB - dateA;
    });
    
    // Get the most recent date
    const mostRecent = parseDate(sortedData[0].date);
    return {
        month: mostRecent.getMonth(),
        year: mostRecent.getFullYear()
    };
}

// Initialize with most recent data month
const recentData = getMostRecentDataMonth();
let currentMonth = recentData.month;
let currentYear = recentData.year;
let currentView = 'monthly';
let fillRateChart, ordersChart;

function parseDate(dateStr) {
    const parts = dateStr.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

function getMonthData(year, month) {
    return fullData.filter(d => {
        const date = parseDate(d.date);
        return date.getFullYear() === year && date.getMonth() === month && d.orders > 0;
    });
}

function getYearData(year) {
    return fullData.filter(d => {
        const date = parseDate(d.date);
        return date.getFullYear() === year;
    });
}

function updateDashboard() {
    if (currentView === 'calendar') {
        renderCalendarView();
        const yearData = getYearData(currentYear);
        const validData = yearData.filter(d => d.orders > 0);
        
        if (validData.length === 0) {
            document.getElementById('fillRate4Day').textContent = 'N/A';
            document.getElementById('fillRate7Day').textContent = 'N/A';
            document.getElementById('totalOrders').textContent = '0';
            document.getElementById('avgOrders').textContent = '0';
            return;
        }
        
        const avg4Day = validData.reduce((sum, d) => sum + d.rate4, 0) / validData.length;
        const avg7Day = validData.reduce((sum, d) => sum + d.rate7, 0) / validData.length;
        const totalOrders = validData.reduce((sum, d) => sum + d.orders, 0);
        
        document.getElementById('fillRate4Day').textContent = avg4Day.toFixed(0) + '%';
        document.getElementById('fillRate7Day').textContent = avg7Day.toFixed(0) + '%';
        document.getElementById('totalOrders').textContent = totalOrders.toLocaleString();
        document.getElementById('avgOrders').textContent = Math.round(totalOrders / validData.length).toLocaleString();
        document.getElementById('periodLabel').textContent = 'year';
    } else {
        const monthData = getMonthData(currentYear, currentMonth);
        
        if (monthData.length === 0) {
            document.getElementById('fillRate4Day').textContent = 'N/A';
            document.getElementById('fillRate7Day').textContent = 'N/A';
            document.getElementById('totalOrders').textContent = '0';
            document.getElementById('avgOrders').textContent = '0';
            
            if (fillRateChart) fillRateChart.destroy();
            if (ordersChart) ordersChart.destroy();
            
            document.getElementById('dataTable').innerHTML = '<tr><td colspan="6" style="text-align: center;">No data available for this month</td></tr>';
            
            document.getElementById('periodLabel').textContent = 'month';
            return;
        }
        
        const avg4Day = monthData.reduce((sum, d) => sum + d.rate4, 0) / monthData.length;
        const avg7Day = monthData.reduce((sum, d) => sum + d.rate7, 0) / monthData.length;
        const totalOrders = monthData.reduce((sum, d) => sum + d.orders, 0);
        
        document.getElementById('fillRate4Day').textContent = avg4Day.toFixed(0) + '%';
        document.getElementById('fillRate7Day').textContent = avg7Day.toFixed(0) + '%';
        document.getElementById('totalOrders').textContent = totalOrders.toLocaleString();
        document.getElementById('avgOrders').textContent = Math.round(totalOrders / monthData.length).toLocaleString();
        document.getElementById('periodLabel').textContent = 'month';
        
        updateCharts(monthData);
        updateTable(monthData);
    }
}

function forceHideTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  tooltip.classList.remove('show');
}

function renderCalendarView() {
    forceHideTooltip();
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
    
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
        
        const firstDay = new Date(currentYear, m, 1).getDay();
        const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
        
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            daysContainer.appendChild(empty);
        }
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dayData = fullData.find(item => {
                const date = parseDate(item.date);
                return date.getFullYear() === currentYear && 
                       date.getMonth() === m && 
                       date.getDate() === d;
            });
            
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            
            if (dayData && dayData.orders > 0) {
                const rate = dayData.rate7;
                let rateClass = 'cal-rate-none';
                
                if (rate >= 95) rateClass = 'cal-rate-excellent';
                else if (rate >= 85) rateClass = 'cal-rate-good';
                else if (rate >= 70) rateClass = 'cal-rate-warning';
                else if (rate > 0) rateClass = 'cal-rate-poor';
                
                dayDiv.classList.add(rateClass);
                dayDiv.innerHTML = `<strong>${d}</strong><br>${rate.toFixed(0)}%`;
                
                dayDiv.addEventListener('mouseenter', (e) => showTooltip(e, dayData));
                dayDiv.addEventListener('mouseleave', hideTooltip);
                dayDiv.addEventListener('mousemove', moveTooltip);
            } else {
                dayDiv.classList.add('cal-rate-none');
                dayDiv.innerHTML = `${d}`;
            }
            
            daysContainer.appendChild(dayDiv);
        }
        
        monthDiv.appendChild(daysContainer);
        grid.appendChild(monthDiv);
    }
}

function showTooltip(e, data) {
    const tooltip = document.getElementById('tooltip');
    const date = parseDate(data.date);
    
   tooltip.innerHTML = `
<strong>${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong><br>
Orders: ${data.orders.toLocaleString()}<br>
4-Day Rate: ${data.rate4.toFixed(2)}%<br>
7-Day Rate: ${data.rate7.toFixed(2)}%<br>
Remaining (4d): ${data.rem4}<br>
Remaining (7d): ${data.rem7}
`.trim();
    
    tooltip.classList.add('show');
    moveTooltip(e);
}

function hideTooltip() {
    document.getElementById('tooltip').classList.remove('show');
}

function moveTooltip(e) {
    const tooltip = document.getElementById('tooltip');
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 15;
    
    let left = e.clientX + padding;
    let top = e.clientY + padding;
    
    // Check if tooltip goes off the right edge
    if (left + tooltipRect.width > window.innerWidth) {
        left = e.clientX - tooltipRect.width - padding;
    }
    
    // Check if tooltip goes off the bottom edge
    if (top + tooltipRect.height > window.innerHeight) {
        top = e.clientY - tooltipRect.height - padding;
    }
    
    // Check if tooltip goes off the left edge
    if (left < 0) {
        left = padding;
    }
    
    // Check if tooltip goes off the top edge
    if (top < 0) {
        top = padding;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

function updateCharts(monthData) {
    const labels = monthData.map(d => parseDate(d.date).getDate());
    
    if (fillRateChart) fillRateChart.destroy();
    
    const ctx1 = document.getElementById('fillRateChart').getContext('2d');
    
    fillRateChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: labels,
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
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { 
                    display: true,
                    labels: { 
                        color: '#8b7355', 
                        font: { size: 11 },
                        usePointStyle: true,
                        padding: 12,
                        boxWidth: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label && !label.includes('Target Line')) {
                                label += ': ' + context.parsed.y.toFixed(1) + '%';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 105,
                    ticks: { 
                        callback: v => v + '%',
                        color: '#a0906f',
                        stepSize: 10
                    },
                    grid: {
                        color: 'rgba(210, 180, 140, 0.1)'
                    }
                },
                x: {
                    ticks: { 
                        color: '#a0906f'
                    },
                    grid: {
                        color: 'rgba(210, 180, 140, 0.1)'
                    }
                }
            }
        }
    });
    
    if (ordersChart) ordersChart.destroy();
    
    const ctx2 = document.getElementById('ordersChart').getContext('2d');
    ordersChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
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
            }, {
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
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { 
                    display: true,
                    labels: { 
                        color: '#8b7355',
                        font: { size: 11 },
                        usePointStyle: true,
                        padding: 12,
                        boxWidth: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ' + context.parsed.y.toLocaleString();
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { 
                        color: '#a0906f',
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(210, 180, 140, 0.1)'
                    }
                },
                x: { 
                    ticks: { color: '#a0906f' },
                    grid: {
                        color: 'rgba(210, 180, 140, 0.1)'
                    }
                }
            }
        }
    });
}

const yearSelect = document.getElementById('yearSelect');
const monthSelect = document.getElementById('monthSelect');

function populateYearMonthSelectors() {
    // YEARS
    yearSelect.innerHTML = '';
    const years = [2025, 2026]; // adjust if needed

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    // MONTHS
    monthSelect.innerHTML = '';
    const months = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];

    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = month;
        monthSelect.appendChild(option);
    });

    // Defaults
    const now = new Date();
    yearSelect.value = now.getFullYear();
    monthSelect.value = now.getMonth();
}

// UPDATED: Color-code Rate 4D and Rate 7D based on their specific targets
function updateTable(monthData) {
    const tbody = document.getElementById('dataTable');
    tbody.innerHTML = '';
    
    // Rate 4D targets: 85% (good), below is warning/poor
    const getRate4Class = rate => {
        if (rate >= 85) return 'rate-excellent';  // At or above 85% target
        if (rate >= 75) return 'rate-good';       // Close to target
        if (rate >= 65) return 'rate-warning';    // Concerning
        return 'rate-poor';                       // Below acceptable
    };
    
    // Rate 7D targets: 95% (good), below is warning/poor
    const getRate7Class = rate => {
        if (rate >= 95) return 'rate-excellent';  // At or above 95% target
        if (rate >= 85) return 'rate-good';       // Close to target
        if (rate >= 75) return 'rate-warning';    // Concerning
        return 'rate-poor';                       // Below acceptable
    };
    
    monthData.forEach(row => {
        const tr = document.createElement('tr');
        const date = parseDate(row.date);
        
        tr.innerHTML = `
            <td>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
            <td>${row.orders.toLocaleString()}</td>
            <td>${row.rem4.toLocaleString()}</td>
            <td>${row.rem7.toLocaleString()}</td>
            <td class="${getRate4Class(row.rate4)}">${row.rate4.toFixed(2)}%</td>
            <td class="${getRate7Class(row.rate7)}">${row.rate7.toFixed(2)}%</td>
        `;
        
        tbody.appendChild(tr);
    });
}

// FIXED: Event listeners for view switching
document.getElementById('monthlyBtn').addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('monthlyBtn').classList.add('active');
    
    currentView = 'monthly';
    
    const monthlyView = document.getElementById('monthlyView');
    const calendarView = document.getElementById('calendarView');
    
    monthlyView.style.display = 'grid';
    calendarView.style.display = 'none';
    document.getElementById('monthSelect').disabled = false;
    
    updateDashboard();
});

document.getElementById('calendarBtn').addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('calendarBtn').classList.add('active');
    
    currentView = 'calendar';
    
    const monthlyView = document.getElementById('monthlyView');
    const calendarView = document.getElementById('calendarView');
    
    monthlyView.style.display = 'none';
    calendarView.style.display = 'block';
    document.getElementById('monthSelect').disabled = true;
    
    updateDashboard();
});

document.getElementById('yearSelect').addEventListener('change', e => {
    currentYear = parseInt(e.target.value);
    updateDashboard();
});

document.getElementById('monthSelect').addEventListener('change', e => {
    currentMonth = parseInt(e.target.value);
    updateDashboard();
});

populateYearMonthSelectors();

// Initialize with most recent data month
document.getElementById('monthSelect').value = currentMonth.toString();
document.getElementById('yearSelect').value = currentYear.toString();

// Set initial title to show Retail
const datasetLabel = document.getElementById('datasetLabel');
if (datasetLabel) {
    datasetLabel.textContent = '- Retail';
}

updateDashboard();

// ============================================
// DATASET DROPDOWN (Retail / Wholesale / Total)
// ============================================

const datasetSelect = document.getElementById('datasetSelect');

if (datasetSelect) {
    // Hard backups that NEVER get mutated
    const retailBackup = Array.isArray(fullData) ? fullData.map(x => ({ ...x })) : [];
    const wholesaleBackup = (typeof wholesaleData !== 'undefined' && Array.isArray(wholesaleData))
        ? wholesaleData.map(x => ({ ...x }))
        : [];

    // Replace fullData IN PLACE (so rest of file keeps working)
    const setFullData = (arr) => {
        fullData.length = 0;
        fullData.push(...arr);
    };

    // Build Total dataset: merge by date, sum orders/rem, recompute rates
    // Build Total dataset: dedupe each dataset by date, then sum + recompute rates
const buildTotalData = () => {

    // Keep ONLY the last occurrence of each date (prevents double-counting)
    const keepLastByDate = (arr) => {
        const map = new Map();
        (arr || []).forEach(row => {
            if (!row || !row.date) return;
            map.set(row.date, { ...row }); // overwrite -> keep last
        });
        return Array.from(map.values());
    };

    const retailOnePerDate = keepLastByDate(retailBackup);
    const wholesaleOnePerDate = keepLastByDate(wholesaleBackup);

    const map = new Map();

    const addRow = (row) => {
        if (!row || !row.date) return;

        const key = row.date;
        if (!map.has(key)) {
            map.set(key, { date: key, orders: 0, rem4: 0, rem7: 0 });
        }

        const agg = map.get(key);
        agg.orders += Number(row.orders) || 0;
        agg.rem4 += Number(row.rem4) || 0;
        agg.rem7 += Number(row.rem7) || 0;
    };

    retailOnePerDate.forEach(addRow);
    wholesaleOnePerDate.forEach(addRow);

    const out = Array.from(map.values()).map(r => {
        const orders = r.orders || 0;
        const rate4 = orders > 0 ? ((orders - r.rem4) / orders) * 100 : 0;
        const rate7 = orders > 0 ? ((orders - r.rem7) / orders) * 100 : 0;

        return {
            date: r.date,
            orders,
            rem4: r.rem4,
            rem7: r.rem7,
            rate4,
            rate7
        };
    });

    out.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    return out;
};


    const syncLabel = (val) => {
        const label = document.getElementById('datasetLabel');
        if (!label) return;
        if (val === 'wholesale') label.textContent = '- Wholesale';
        else if (val === 'total') label.textContent = '- Retail + Wholesale';
        else label.textContent = '- Retail';
    };

    // Make sure label matches initial dropdown value on load
    syncLabel(datasetSelect.value || 'retail');

    datasetSelect.addEventListener('change', () => {
        const val = datasetSelect.value;

        if (val === 'retail') {
            setFullData(retailBackup.map(x => ({ ...x })));
        } else if (val === 'wholesale') {
            if (!wholesaleBackup.length) {
                alert('Wholesale data not available. Make sure wholesale.js is loaded.');
                datasetSelect.value = 'retail';
                setFullData(retailBackup.map(x => ({ ...x })));
                syncLabel('retail');
                return;
            }
            setFullData(wholesaleBackup.map(x => ({ ...x })));
        } else if (val === 'total') {
            if (!wholesaleBackup.length) {
                alert('Wholesale data not available. Make sure wholesale.js is loaded.');
                datasetSelect.value = 'retail';
                setFullData(retailBackup.map(x => ({ ...x })));
                syncLabel('retail');
                return;
            }
            setFullData(buildTotalData());
        }

        syncLabel(val);

        // Reset to most recent month/year for the NEW dataset
        const recent = getMostRecentDataMonth();
        currentMonth = recent.month;
        currentYear = recent.year;

        document.getElementById('monthSelect').value = currentMonth.toString();
        document.getElementById('yearSelect').value = currentYear.toString();

        updateDashboard();
    });
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'TV_VIEW_STATE') {
    document.body.classList.toggle('tv-view-active', event.data.active);
  }
});
    
});
