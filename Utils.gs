/**
 * FinTra - Reusable Helper & Utility Services
 * Utils.gs
 * 
 * Purpose: Provides helper functions, active user profile discovery,
 * system logging services, and secure client-to-API proxying for Google Gemini.
 */

/**
 * Fetches the active Google User's name and email dynamically.
 * Gracefully defaults if executed in a restricted domain context.
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
      email = "Admin@gmail.com";
      name = "Admin";
    }
    return {
      name: name,
      email: email
    };
  } catch (err) {
    Logger.log("Error fetching user profile: " + err.toString());
    return {
      name: "Admin",
      email: "Admin@gmail.com"
    };
  }
}

/**
 * Helper to convert arbitrary sheet headers into clean camelCase JSON property keys
 */
function convertHeaderToKey(header) {
  if (!header) return "";
  var clean = header.toString().replace(/[^a-zA-Z0-9\s/]/g, '').trim().toLowerCase();
  
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
 * Proxy connection to Google Gemini API
 * Accepts client-side requests and runs them with secure properties service credentials
 */
function callGeminiAI(payload) {
  try {
    // Retrieve Gemini API Key from Script Properties
    var apiKey = PropertiesService.getScriptProperties().getProperty(CONFIG.PROPERTIES.GEMINI_API_KEY);
    if (!apiKey) {
      return {
        success: false,
        error: "GEMINI_API_KEY is not configured in Apps Script properties. Click Settings (gear icon) > Script Properties to set it up."
      };
    }

    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    
    var prompt = "You are an expert Financial Analysis AI for FinTra (Finance Tracking and Analytics System) of the Finance and Administrative Services Office.\n\n" +
                 "Analyze the following charts and metrics:\n" +
                 "- Section: " + payload.section + "\n" +
                 "- Title: " + payload.title + "\n" +
                 "- Time Period: " + payload.period + "\n" +
                 "- Data Summary: " + JSON.stringify(payload.values) + "\n\n" +
                 "Compile a professional finance executive brief. Respond ONLY with a valid JSON block structured as follows:\n" +
                 "{\n" +
                 "  \"summary\": \"Concise 2-sentence summary of the financial allocations and flow.\",\n" +
                 "  \"findings\": [\"Crucial data observation 1\", \"Crucial data observation 2\"],\n" +
                 "  \"trends\": \"Detailed trend assessment (upward/downward trajectories, bottlenecks, seasonality).\",\n" +
                 "  \"interpretation\": \"Operational impact and recommendations for administrative action.\"\n" +
                 "}\n\n" +
                 "Do not wrap the response in markdown blocks or backticks. Return the JSON object directly.";

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
    Logger.log("Gemini Connection Error: " + err.toString());
    return {
      success: false,
      error: "Connection failure: " + err.toString()
    };
  }
}

/**
 * Centered System Execution Logger
 */
function logEvent(level, message) {
  try {
    var user = Session.getActiveUser().getEmail() || "anonymous";
    var logMsg = "[" + level.toUpperCase() + "] User: " + user + " - " + message;
    console.log(logMsg);
    Logger.log(logMsg);
  } catch (err) {
    // Fail-silent
  }
}
