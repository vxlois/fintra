/**
 * FinTra - Dashboard Analytics Logic
 * Dashboard.gs
 * 
 * Purpose: Processes and groups spreadsheet ledger data specifically
 * for statistics, bento-grid metric widgets, and Chart.js visualization arrays.
 */

/**
 * Generate fully calculated dashboard statistics and KPIs
 */
function getDashboardStatistics() {
  var budgetRecords = getBudgetData();
  var accountingRecords = getAccountingData();
  var cashierRecords = getCashierData();
  
  // 1. Budget Stats
  var totalBudgetsAmount = 0;
  var budgetAllotmentClasses = {};
  
  budgetRecords.forEach(function(r) {
    var amt = Number(r.amount) || 0;
    totalBudgetsAmount += amt;
    
    var allotment = r.allotmentClass || 'Unclassified';
    budgetAllotmentClasses[allotment] = (budgetAllotmentClasses[allotment] || 0) + amt;
  });

  // 2. Accounting Stats
  var totalGross = 0;
  var totalNet = 0;
  var totalTax = 0;
  
  accountingRecords.forEach(function(r) {
    totalGross += Number(r.grossAmount) || 0;
    totalNet += Number(r.netAmount) || 0;
    totalTax += Number(r.tax) || 0;
  });

  // 3. Cashier Stats
  var cashierCompletedSum = 0;
  var cashierPendingSum = 0;
  var cashierCompletedCount = 0;
  var cashierPendingCount = 0;
  
  cashierRecords.forEach(function(r) {
    var amt = Number(r.amount) || 0;
    var status = (r.status || '').trim().toLowerCase();
    
    if (status === 'completed' || status === 'paid' || status === 'success') {
      cashierCompletedSum += amt;
      cashierCompletedCount++;
    } else {
      cashierPendingSum += amt;
      cashierPendingCount++;
    }
  });

  // 4. Calculate Efficiency Ratio
  // (Completed disbursements vs total requested budgets)
  var efficiencyRate = 0;
  if (totalBudgetsAmount > 0) {
    efficiencyRate = (cashierCompletedSum / totalBudgetsAmount) * 100;
  }

  return {
    overview: {
      totalBudgets: totalBudgetsAmount,
      totalGrossProcessed: totalGross,
      totalNetDisbursed: totalNet,
      totalCashierReleased: cashierCompletedSum,
      payoutEfficiency: Math.round(efficiencyRate * 10) / 10, // 1 decimal
      pendingDisbursement: cashierPendingSum
    },
    counts: {
      budgetRecords: budgetRecords.length,
      accountingRecords: accountingRecords.length,
      cashierRecords: cashierRecords.length,
      cashierPendingCount: cashierPendingCount,
      cashierCompletedCount: cashierCompletedCount
    },
    allotments: budgetAllotmentClasses
  };
}

/**
 * Shape ledger data into ready-to-render formats for frontend line/bar charts
 */
function generateDashboardChartsData() {
  var budgetRecords = getBudgetData();
  var accountingRecords = getAccountingData();
  var cashierRecords = getCashierData();
  
  // Group by Month (YYYY-MM)
  var monthlyGroup = {};
  
  // Helper to get Year-Month key from various date formats
  function getYearMonth(dateStr) {
    if (!dateStr) return null;
    // Standard format: YYYY-MM-DD
    var parts = dateStr.split('-');
    if (parts.length >= 2) {
      return parts[0] + '-' + parts[1]; // e.g., "2026-01"
    }
    return 'Other';
  }
  
  // Aggregate budgets
  budgetRecords.forEach(function(r) {
    var ym = getYearMonth(r.receivedDateTime);
    if (!ym) return;
    if (!monthlyGroup[ym]) monthlyGroup[ym] = { month: ym, budget: 0, accounting: 0, cashier: 0 };
    monthlyGroup[ym].budget += Number(r.amount) || 0;
  });
  
  // Aggregate accounting gross
  accountingRecords.forEach(function(r) {
    var ym = getYearMonth(r.receivedDateTime);
    if (!ym) return;
    if (!monthlyGroup[ym]) monthlyGroup[ym] = { month: ym, budget: 0, accounting: 0, cashier: 0 };
    monthlyGroup[ym].accounting += Number(r.grossAmount) || 0;
  });
  
  // Aggregate cashier completed payments
  cashierRecords.forEach(function(r) {
    if ((r.status || '').trim().toLowerCase() !== 'completed') return;
    var ym = getYearMonth(r.date);
    if (!ym) return;
    if (!monthlyGroup[ym]) monthlyGroup[ym] = { month: ym, budget: 0, accounting: 0, cashier: 0 };
    monthlyGroup[ym].cashier += Number(r.amount) || 0;
  });
  
  // Convert map to sorted list
  var sortedMonths = Object.keys(monthlyGroup).sort();
  var chartSeries = sortedMonths.map(function(key) {
    return monthlyGroup[key];
  });
  
  // Group allotments by allotment class for pie chart
  var allotmentsMap = {};
  budgetRecords.forEach(function(r) {
    var cat = r.allotmentClass || 'MOOE';
    allotmentsMap[cat] = (allotmentsMap[cat] || 0) + (Number(r.amount) || 0);
  });
  
  var allotmentSeries = Object.keys(allotmentsMap).map(function(key) {
    return { name: key, value: allotmentsMap[key] };
  });

  return {
    timelineTrend: chartSeries,
    allotmentPie: allotmentSeries
  };
}
