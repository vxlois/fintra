/**
 * FinTra - Reporting and Export Services
 * Reports.gs
 * 
 * Purpose: Prepares reporting objects, compiles monthly summaries, and uses
 * Gemini AI to extract intelligence about allocation bottlenecks and trends.
 */

/**
 * Generate full financial report dataset
 */
function generateReportData(filterPeriod) {
  var budget = getBudgetData();
  var accounting = getAccountingData();
  var cashier = getCashierData();
  
  // Find top payees
  var payeeAllocations = {};
  budget.forEach(function(r) {
    var p = r.payee || "Unknown";
    payeeAllocations[p] = (payeeAllocations[p] || 0) + (Number(r.amount) || 0);
  });
  
  var topPayees = Object.keys(payeeAllocations).map(function(key) {
    return { name: key, total: payeeAllocations[key] };
  }).sort(function(a, b) { return b.total - a.total; }).slice(0, 5);

  // Group by allotment classes
  var allotmentSummaries = {};
  budget.forEach(function(r) {
    var cls = r.allotmentClass || "MOOE";
    if (!allotmentSummaries[cls]) {
      allotmentSummaries[cls] = { count: 0, total: 0 };
    }
    allotmentSummaries[cls].count++;
    allotmentSummaries[cls].total += (Number(r.amount) || 0);
  });

  return {
    period: filterPeriod || "All Time",
    generatedAt: new Date().toISOString(),
    topPayees: topPayees,
    allotmentBreakdown: allotmentSummaries,
    overallStatistics: getDashboardStatistics()
  };
}

/**
 * Connect to Gemini to prepare professional weekly/monthly financial insights
 * Automatically reads the current sheet data and sends a structured payload
 */
function prepareMonthlyWeeklyInsights(period) {
  var stats = getDashboardStatistics();
  var charts = generateDashboardChartsData();
  
  var payload = {
    section: "Executive Financial Report",
    title: "Monthly Allocation and Disbursement Briefing",
    chartType: "Interactive Multi-Timeline Trend",
    period: period || "Monthly Analytics Loop",
    values: {
      budgetSummary: stats.overview,
      recordCounts: stats.counts,
      monthlyTimelines: charts.timelineTrend,
      allotmentsDistribution: charts.allotmentPie
    }
  };

  // Call the Gemini API proxy in Utils.gs
  return callGeminiAI(payload);
}
