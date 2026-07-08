function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
      .setTitle('FinTra - Finance Tracking and Analytics')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// Include CSS or JS files inside index.html
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Initializes the Spreadsheet database with correct columns if sheets do not exist.
 */
function initializeDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Budget Sheet
  var budgetSheet = ss.getSheetByName('Budget');
  if (!budgetSheet) {
    budgetSheet = ss.insertSheet('Budget');
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
  }

  // 2. Accounting Sheet
  var accountingSheet = ss.getSheetByName('Accounting');
  if (!accountingSheet) {
    accountingSheet = ss.insertSheet('Accounting');
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
  }

  // 3. Cashier Sheet
  var cashierSheet = ss.getSheetByName('Cashier');
  if (!cashierSheet) {
    cashierSheet = ss.insertSheet('Cashier');
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
  }
}

/**
 * Gets data from a sheet as an array of objects
 */
function getSheetData(sheetName) {
  try {
    initializeDatabase();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return []; // Only header
    
    var headers = data[0];
    var records = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var record = { rowNumber: i + 1 };
      for (var j = 0; j < headers.length; j++) {
        var key = convertHeaderToKey(headers[j]);
        record[key] = row[j];
      }
      records.push(record);
    }
    return records;
  } catch (err) {
    Logger.log("Error loading sheet data: " + err.toString());
    return [];
  }
}

/**
 * Helper to convert sheet headers to camelCase keys
 */
function convertHeaderToKey(header) {
  var clean = header.replace(/[^a-zA-Z0-9\s/]/g, '').trim().toLowerCase();
  if (clean.indexOf('docs ref') === 0) return 'docsRefNo';
  if (clean.indexOf('received documents') === 0) return 'receivedDateTime';
  if (clean.indexOf('serial no') === 0) return 'serialNo';
  if (clean.indexOf('allotment') === 0) return 'allotmentClass';
  if (clean.indexOf('pr no') === 0) return 'prNo';
  if (clean.indexOf('po no') === 0) return 'poNo';
  if (clean.indexOf('payee') === 0) return 'payee';
  if (clean.indexOf('particulars') === 0) return 'particulars';
  if (clean.indexOf('responsibility center') === 0 || clean.indexOf('responsibility centers') === 0) return 'responsibilityCenter';
  if (clean.indexOf('expense') === 0 || clean.indexOf('object') === 0) return 'expenseCode';
  if (clean.indexOf('gross') === 0) return 'grossAmount';
  if (clean.indexOf('net') === 0) return 'netAmount';
  if (clean.indexOf('tax') === 0) return 'tax';
  if (clean.indexOf('other deductions') === 0) return 'otherDeductions';
  if (clean.indexOf('deduction ps') === 0) return 'deductionPs';
  if (clean.indexOf('dv no') === 0) return 'dvNo';
  if (clean.indexOf('received approved') === 0) return 'receivedApprovedDvDateTime';
  if (clean.indexOf('lddap') === 0 || clean.indexOf('check') === 0) return 'lddapCheckNo';
  if (clean.indexOf('forwarded lddap') === 0) return 'forwardedDateTime';
  if (clean.indexOf('received signed') === 0) return 'receivedSignedDateTime';
  if (clean.indexOf('status and payment') === 0 || clean.indexOf('status') === 0) return 'status';
  if (clean.indexOf('date') === 0) return 'date';
  if (clean.indexOf('amount') === 0) return 'amount';
  if (clean.indexOf('forwarded') === 0) return 'forwardedDateTime';
  if (clean.indexOf('remarks') === 0) return 'remarks';
  
  return clean.replace(/\s+/g, '');
}

/**
 * Adds a new record to the spreadsheet
 */
function addRecord(sheetName, recordData) {
  try {
    initializeDatabase();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var newRow = [];
    for (var i = 0; i < headers.length; i++) {
      var key = convertHeaderToKey(headers[i]);
      newRow.push(recordData[key] !== undefined ? recordData[key] : "");
    }
    
    sheet.appendRow(newRow);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Fetches the active Google User's name and email dynamically.
 */
function getActiveUserProfile() {
  try {
    var email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || "";
    var name = "";
    if (email) {
      var parts = email.split('@');
      var username = parts[0];
      name = username.split(/[._-]/).map(function(s) {
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      }).join(' ');
    } else {
      email = "admin@gmail.com";
      name = "Admin";
    }
    return {
      name: name,
      email: email
    };
  } catch (err) {
    return {
      name: "Admin",
      email: "admin@gmail.com"
    };
  }
}

/**
 * Fetch All Data for Dashboards
 */
function getAllFinTraData() {
  return {
    budget: getSheetData('Budget'),
    accounting: getSheetData('Accounting'),
    cashier: getSheetData('Cashier')
  };
}

/**
 * Call Gemini API for analytics interpretation from Google Apps Script
 */
function callGeminiAI(payload) {
  try {
    // Retrieve Gemini API Key from Script Properties
    var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return {
        success: false,
        error: "GEMINI_API_KEY script property is not set in Apps Script settings. Please configure your API key."
      };
    }

    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    
    var prompt = "You are a professional Financial Analytics AI for 'FinTra', the Finance Tracking and Analytics System of the Finance and Administrative Services office.\n\n" +
                 "Analyze the following chart and metric selection details:\n" +
                 "- Section: " + payload.section + "\n" +
                 "- Visualization Title: " + payload.title + "\n" +
                 "- Chart Type: " + payload.chartType + "\n" +
                 "- Selected Period: " + payload.period + "\n" +
                 "- Data / Metric Values: " + JSON.stringify(payload.values) + "\n\n" +
                 "Provide a professional finance analytics briefing. Format your response exactly in JSON with the following structure:\n" +
                 "{\n" +
                 "  \"summary\": \"A concise 2-sentence explanation of what this chart shows.\",\n" +
                 "  \"findings\": [\"Bullet point 1 detailing key observed values.\", \"Bullet point 2 with another observation.\"],\n" +
                 "  \"trends\": \"Analyze any upward, downward, or distribution shifts shown in the dataset.\",\n" +
                 "  \"interpretation\": \"Explain the financial operational impact of this data for decision-makers and management monitoring.\"\n" +
                 "}\n\n" +
                 "Ensure only valid JSON is returned, without markdown ticks.";

    var requestBody = {
      "contents": [{
        "parts": [{
          "text": prompt
        }]
      }],
      "generationConfig": {
        "responseMimeType": "application/json"
      }
    };

    var options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(requestBody),
      "muteHttpExceptions": true
    };

    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (responseCode === 200) {
      var json = JSON.parse(responseText);
      var content = json.candidates[0].content.parts[0].text;
      return {
        success: true,
        data: JSON.parse(content)
      };
    } else {
      return {
        success: false,
        error: "Gemini API error (Status " + responseCode + "): " + responseText
      };
    }
  } catch (err) {
    return {
      success: false,
      error: "Apps Script fetch error: " + err.toString()
    };
  }
}
