/**
 * FinTra - Google Sheets Data Services
 * Data.gs
 * 
 * Purpose: Handles connection to Google Sheets, database initialization,
 * data retrieval, schema mapping, and CRUD operations.
 */

/**
 * Safe spreadsheet retrieval helper
 */
function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    Logger.log("Error accessing active spreadsheet: " + err.toString());
    throw new Error("Could not access Google Spreadsheet. Make sure this script is bound to a Google Sheet.");
  }
}

/**
 * Initializes the Spreadsheet database with correct columns if sheets do not exist.
 * This runs automatically on getSheetData calls to ensure the database is ready.
 */
function initializeDatabase() {
  var ss = getSpreadsheet();
  
  // 1. Budget Sheet
  var budgetSheet = ss.getSheetByName(CONFIG.SHEETS.BUDGET);
  if (!budgetSheet) {
    budgetSheet = ss.insertSheet(CONFIG.SHEETS.BUDGET);
    budgetSheet.appendRow([
      'Docs Ref. No.', 
      'Received Documents Date and Time', 
      'Serial No.', 
      'Allotment Class', 
      'PR No.', 
      'PO No.', 
      'Payee', 
      'Particulars', 
      'Responsibility Centers / End Users', 
      'Expense/Object Code', 
      'Amount', 
      'Forwarded Date and Time', 
      'Remarks'
    ]);
    budgetSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    budgetSheet.setFrozenRows(1);
  }

  // 2. Accounting Sheet
  var accountingSheet = ss.getSheetByName(CONFIG.SHEETS.ACCOUNTING);
  if (!accountingSheet) {
    accountingSheet = ss.insertSheet(CONFIG.SHEETS.ACCOUNTING);
    accountingSheet.appendRow([
      'Received Documents Date and Time', 
      'Payee', 
      'Particulars', 
      'DV No.', 
      'Date', 
      'Gross Amount', 
      'Tax', 
      'Other Deductions', 
      'Deduction PS', 
      'Net Amount', 
      'Forwarded DV Date and Time', 
      'Remarks'
    ]);
    accountingSheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    accountingSheet.setFrozenRows(1);
  }

  // 3. Cashier Sheet
  var cashierSheet = ss.getSheetByName(CONFIG.SHEETS.CASHIER);
  if (!cashierSheet) {
    cashierSheet = ss.insertSheet(CONFIG.SHEETS.CASHIER);
    cashierSheet.appendRow([
      'Received Approved DV Date and Time', 
      'LDDAP/Check No.', 
      'Date', 
      'Amount', 
      'Forwarded LDDAP/Checks Date and Time', 
      'Received Signed LDDAP/Checks Date and Time', 
      'Status and Payment'
    ]);
    cashierSheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    cashierSheet.setFrozenRows(1);
  }
}

/**
 * Gets data from a specific sheet as an array of structured objects
 */
function getSheetData(sheetName) {
  try {
    initializeDatabase();
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only headers exist
    
    var headers = data[0];
    var records = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Check if row is empty (ignore trailing blank rows)
      var isEmpty = row.every(function(cell) { return cell === ""; });
      if (isEmpty) continue;
      
      var record = { rowNumber: i + 1 };
      for (var j = 0; j < headers.length; j++) {
        var key = convertHeaderToKey(headers[j]);
        var value = row[j];
        
        // Convert Date objects to ISO-like YYYY-MM-DD or custom string formatting for stability
        if (value instanceof Date) {
          try {
            // Check if the column is a full date time or just date
            if (key.toLowerCase().indexOf('datetime') !== -1 || key.toLowerCase().indexOf('time') !== -1) {
              value = value.toISOString();
            } else {
              value = Utilities.formatDate(value, ss.getSpreadsheetTimeZone() || "GMT+8", "yyyy-MM-dd");
            }
          } catch(e) {
            value = value.toString();
          }
        }
        record[key] = value;
      }
      records.push(record);
    }
    return records;
  } catch (err) {
    Logger.log("Error loading sheet data for " + sheetName + ": " + err.toString());
    return [];
  }
}

/**
 * Retrieve Budget Records
 */
function getBudgetData() {
  return getSheetData(CONFIG.SHEETS.BUDGET);
}

/**
 * Retrieve Accounting Records
 */
function getAccountingData() {
  return getSheetData(CONFIG.SHEETS.ACCOUNTING);
}

/**
 * Retrieve Cashier Records
 */
function getCashierData() {
  return getSheetData(CONFIG.SHEETS.CASHIER);
}

/**
 * Returns a complete set of FinTra data (for frontend syncing)
 */
function getAllFinTraData() {
  return {
    budget: getBudgetData(),
    accounting: getAccountingData(),
    cashier: getCashierData()
  };
}

/**
 * Calculate high-level financial summary across sheets
 */
function getFinancialSummary() {
  var budget = getBudgetData();
  var accounting = getAccountingData();
  var cashier = getCashierData();
  
  var totalBudget = budget.reduce(function(acc, row) { return acc + (Number(row.amount) || 0); }, 0);
  var totalAccountingGross = accounting.reduce(function(acc, row) { return acc + (Number(row.grossAmount) || 0); }, 0);
  var totalAccountingNet = accounting.reduce(function(acc, row) { return acc + (Number(row.netAmount) || 0); }, 0);
  var totalCashierReleased = cashier.filter(function(r) { return r.status === 'Completed'; })
                                    .reduce(function(acc, row) { return acc + (Number(row.amount) || 0); }, 0);
  
  return {
    budgetCount: budget.length,
    accountingCount: accounting.length,
    cashierCount: cashier.length,
    totalBudget: totalBudget,
    totalAccountingGross: totalAccountingGross,
    totalAccountingNet: totalAccountingNet,
    totalCashierReleased: totalCashierReleased,
    timestamp: new Date().toISOString()
  };
}

/**
 * Adds a new record to the spreadsheet
 * Called from client-side via google.script.run
 */
function addRecord(sheetName, recordData) {
  try {
    initializeDatabase();
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, error: "Sheet '" + sheetName + "' does not exist." };
    }
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var newRow = [];
    
    for (var i = 0; i < headers.length; i++) {
      var key = convertHeaderToKey(headers[i]);
      var val = recordData[key];
      
      // Handle empty or undefined cells
      newRow.push(val !== undefined && val !== null ? val : "");
    }
    
    sheet.appendRow(newRow);
    return { success: true, rowNumber: sheet.getLastRow() };
  } catch (err) {
    Logger.log("Error adding record: " + err.toString());
    return { success: false, error: err.toString() };
  }
}
