/**
 * Certrust for Google Sheets
 *
 * Add a row with a name and an email, and that person is issued a
 * verifiable certificate. The sheet gets a status and the certificate link
 * back in the same row.
 *
 * Setup guide: https://certrust.app/integrations/google-sheets
 *
 * How it works
 * - "Certrust > Connect" stores your API key privately for your Google
 *   account (other editors of the sheet cannot read it) and remembers which
 *   achievement this tab issues.
 * - "Issue new rows now", or automatic issuing (every 5 minutes, and
 *   straight away when a linked Google Form is submitted), sends every row
 *   that has an email and no status yet to Certrust, up to 50 rows per
 *   request.
 * - People who already hold the certificate are never issued twice, and a
 *   run that is cut off can simply run again.
 *
 * Columns (found by their heading in row 1, in any order):
 *   Name, Email               required
 *   Expiry date               optional
 *   <custom attribute name>   optional, one column per custom attribute
 *   Certrust status, Certificate link   added and filled in by this script
 */

var CERTRUST_API = 'https://api.certrust.app';
var CERTRUST_SITE = 'https://certrust.app';

var BATCH_SIZE = 50;
var MAX_BATCHES_PER_RUN = 4;
var TRIGGER_MINUTES = 5;
var STATUS_HEADER = 'Certrust status';
var LINK_HEADER = 'Certificate link';
var NAME_HEADERS = ['name', 'full name', 'your name', 'your full name', 'recipient', 'recipient name', 'participant name', 'student name'];
var EMAIL_HEADERS = ['email', 'e-mail', 'email address', 'your email', 'your email address', 'recipient email', 'participant email', 'student email'];
var EXPIRY_HEADERS = ['expiry date', 'expiry', 'expires', 'expiration date'];
var KEY_PROPERTY = 'certrust.apiKey';
var TAB_PROPERTY_PREFIX = 'certrust.tab.';
var RETRY_PROPERTY = 'certrust.retry';

// ---------------------------------------------------------------- menu

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Certrust')
    .addItem('Connect this tab…', 'showSetup')
    .addSeparator()
    .addItem('Issue new rows now', 'issueNewRowsFromMenu')
    .addItem('Retry rows with errors', 'retryFailedRows')
    .addSeparator()
    .addItem('Turn on automatic issuing', 'turnOnAutomatic')
    .addItem('Turn off automatic issuing', 'turnOffAutomatic')
    .addSeparator()
    .addItem('Disconnect', 'disconnect')
    .addToUi();
}

function showSetup() {
  var html = HtmlService.createHtmlOutput(setupHtml_()).setWidth(440).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Connect to Certrust');
}

// ---------------------------------------------------------------- setup (called from the dialog)

/** Checks the key and returns the organization and its achievements. */
function certrustConnect(apiKey) {
  var key = String(apiKey || '').trim() || storedKey_();
  if (!key) throw new Error('Paste your API key first.');

  var me = api_(key, 'get', '/api/api-keys/me');
  if (me.code === 401) throw new Error('That API key is not valid, or it has been revoked or has expired.');
  if (me.code !== 200) throw new Error(errorMessage_(me));
  var info = me.json.data;
  if (info.scopes.indexOf('issue') === -1 || info.scopes.indexOf('read') === -1) {
    throw new Error('This key needs both the Read and the Issue permission. Create a new key with both in Certrust under Manage > API keys.');
  }

  var list = api_(key, 'get', '/api/achievements/creator/' + info.issuerProfileId);
  if (list.code !== 200) throw new Error(errorMessage_(list));
  var achievements = (list.json.data || []).map(function (a) {
    return { id: a.id, name: a.name || (a.attributes && a.attributes.name) || ('Achievement ' + a.id) };
  });

  var sheet = SpreadsheetApp.getActiveSheet();
  var current = tabConfig_(sheet);
  return {
    organization: info.organization ? info.organization.name : '',
    keyName: info.name,
    tab: sheet.getName(),
    achievements: achievements,
    currentAchievementId: current ? current.achievementId : null,
  };
}

/** Saves the key and the achievement for the active tab, and prepares its columns. */
function certrustSave(apiKey, achievementId, achievementName) {
  var key = String(apiKey || '').trim() || storedKey_();
  if (!key) throw new Error('Paste your API key first.');
  if (!achievementId) throw new Error('Choose an achievement.');

  var attributes = [];
  var res = api_(key, 'get', '/api/custom-attributes');
  if (res.code === 200) {
    attributes = (res.json.data || []).map(function (a) { return { key: a.key, label: a.label }; });
  }

  PropertiesService.getUserProperties().setProperty(KEY_PROPERTY, key);
  var sheet = SpreadsheetApp.getActiveSheet();
  PropertiesService.getDocumentProperties().setProperty(
    TAB_PROPERTY_PREFIX + sheet.getSheetId(),
    JSON.stringify({ achievementId: Number(achievementId), achievementName: String(achievementName || ''), attributes: attributes })
  );
  prepareColumns_(sheet);
  return 'This tab now issues "' + achievementName + '". Add people under Name and Email, then choose Certrust > Issue new rows now.';
}

// ---------------------------------------------------------------- issuing

function issueNewRowsFromMenu() {
  var summary = issueNewRows();
  SpreadsheetApp.getActiveSpreadsheet().toast(summary, 'Certrust', 8);
}

/** Issues every pending row on every connected tab. Also run by the timer. */
function issueNewRows() {
  var key = storedKey_();
  if (!key) return 'Not connected yet. Choose Certrust > Connect this tab…';

  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) return 'Certrust is already issuing. Try again in a moment.';
  try {
    var totals = { issued: 0, already: 0, errors: 0, waiting: 0 };
    var notes = [];
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var config = tabConfig_(sheets[i]);
      if (!config) continue;
      var note = processSheet_(sheets[i], config, key, totals);
      if (note) notes.push(sheets[i].getName() + ': ' + note);
    }
    var parts = [totals.issued + ' issued'];
    if (totals.already) parts.push(totals.already + ' already had it');
    if (totals.errors) parts.push(totals.errors + ' with errors');
    if (totals.waiting) parts.push(totals.waiting + ' waiting for a name');
    return parts.join(', ') + (notes.length ? '. ' + notes.join(' ') : '.');
  }
  finally {
    lock.releaseLock();
  }
}

/** Clears the status of rows that ended in an error, then issues again. */
function retryFailedRows() {
  // A deliberate retry must really run again, not get the earlier answer back.
  var props = PropertiesService.getDocumentProperties();
  props.setProperty(RETRY_PROPERTY, String(Number(props.getProperty(RETRY_PROPERTY) || 0) + 1));
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (!tabConfig_(sheets[i])) continue;
    var layout = layout_(sheets[i]);
    if (layout.statusCol === -1 || layout.values.length < 2) continue;
    for (var r = 1; r < layout.values.length; r++) {
      if (String(layout.values[r][layout.statusCol] || '').indexOf('Error') === 0) {
        sheets[i].getRange(r + 1, layout.statusCol + 1).setValue('');
      }
    }
  }
  issueNewRowsFromMenu();
}

function processSheet_(sheet, config, key, totals) {
  prepareColumns_(sheet);
  var layout = layout_(sheet);
  if (layout.emailCol === -1) return 'no "Email" column in row 1.';

  var timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var pending = [];
  for (var r = 1; r < layout.values.length; r++) {
    var row = layout.values[r];
    var email = String(row[layout.emailCol] || '').trim();
    var status = String(row[layout.statusCol] || '').trim();
    if (!email || (status && status.indexOf('Waiting') !== 0)) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      writeResult_(sheet, layout, r, 'Error: "' + email + '" is not a valid email address', '');
      totals.errors++;
      continue;
    }
    var name = layout.nameCol === -1 ? '' : String(row[layout.nameCol] || '').trim();
    if (!name) {
      if (!status) writeResult_(sheet, layout, r, 'Waiting: add a name', '');
      totals.waiting++;
      continue;
    }
    var recipient = { name: name, email: email };
    if (layout.expiryCol !== -1 && row[layout.expiryCol] !== '') {
      recipient.expirationDate = dateText_(row[layout.expiryCol], timeZone);
    }
    var custom = {};
    var hasCustom = false;
    for (var a = 0; a < (config.attributes || []).length; a++) {
      var col = layout.attributeCols[config.attributes[a].key];
      if (col === undefined || row[col] === '') continue;
      custom[config.attributes[a].key] = row[col] instanceof Date ? dateText_(row[col], timeZone) : String(row[col]);
      hasCustom = true;
    }
    if (hasCustom) recipient.customFields = custom;
    pending.push({ rowIndex: r, recipient: recipient });
  }

  var batches = 0;
  for (var start = 0; start < pending.length; start += BATCH_SIZE) {
    if (batches++ >= MAX_BATCHES_PER_RUN) return (pending.length - start) + ' more rows will be issued on the next run.';
    var chunk = pending.slice(start, start + BATCH_SIZE);
    var body = {
      data: {
        achievementId: config.achievementId,
        skipExisting: true,
        recipients: chunk.map(function (p) { return p.recipient; }),
      },
    };
    // The same rows sent again (after a timeout, say) get the first answer back.
    var retry = PropertiesService.getDocumentProperties().getProperty(RETRY_PROPERTY) || '0';
    var idempotencyKey = 'sheets-' + sheet.getParent().getId() + '-' + sheet.getSheetId() + '-' + retry + '-' + sha256_(JSON.stringify(body));
    var res = api_(key, 'post', '/api/credentials/batch-issue', body, idempotencyKey);

    if (res.code === 409 || res.code === 429) return 'Certrust is busy; these rows will be issued on the next run.';
    if (res.code === 401) return 'the API key is no longer valid. Choose Certrust > Connect this tab… to add a new one.';
    if (res.code !== 200 || !res.json || !res.json.results) return errorMessage_(res);

    for (var i = 0; i < chunk.length; i++) {
      var result = res.json.results[i] || { success: false, error: 'No answer for this row' };
      var rowIndex = chunk[i].rowIndex;
      if (!result.success) {
        writeResult_(sheet, layout, rowIndex, 'Error: ' + result.error, '');
        totals.errors++;
      }
      else if (result.skipped) {
        var existingId = result.existing && result.existing.credentialId;
        writeResult_(sheet, layout, rowIndex, 'Already issued', existingId ? link_(existingId) : '');
        totals.already++;
      }
      else {
        var credential = (result.data && result.data.credential) || {};
        writeResult_(sheet, layout, rowIndex, 'Issued ' + dateText_(new Date(), timeZone), credential.credentialId ? link_(credential.credentialId) : '');
        totals.issued++;
      }
    }
  }
  return '';
}

// ---------------------------------------------------------------- automatic issuing

function turnOnAutomatic() {
  if (!storedKey_()) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Connect a tab first: Certrust > Connect this tab…', 'Certrust', 8);
    return;
  }
  removeTriggers_();
  ScriptApp.newTrigger('issueNewRows').timeBased().everyMinutes(TRIGGER_MINUTES).create();
  // A linked Google Form adds its answers as new rows; issue those at once
  // rather than at the next timer run. Harmless when no form is linked.
  ScriptApp.newTrigger('issueNewRows').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onFormSubmit().create();
  SpreadsheetApp.getActiveSpreadsheet().toast('New rows are now issued automatically: every ' + TRIGGER_MINUTES + ' minutes, and as soon as a linked form is submitted.', 'Certrust', 8);
}

function turnOffAutomatic() {
  removeTriggers_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Automatic issuing is off. Use Certrust > Issue new rows now.', 'Certrust', 8);
}

/** Forgets the API key and stops automatic issuing. Rows already issued stay as they are. */
function disconnect() {
  removeTriggers_();
  PropertiesService.getUserProperties().deleteProperty(KEY_PROPERTY);
  SpreadsheetApp.getActiveSpreadsheet().toast('Disconnected. Your API key has been removed from this sheet.', 'Certrust', 8);
}

function removeTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'issueNewRows') ScriptApp.deleteTrigger(triggers[i]);
  }
}

// ---------------------------------------------------------------- helpers

function storedKey_() {
  return PropertiesService.getUserProperties().getProperty(KEY_PROPERTY) || '';
}

function tabConfig_(sheet) {
  var raw = PropertiesService.getDocumentProperties().getProperty(TAB_PROPERTY_PREFIX + sheet.getSheetId());
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch (e) { return null; }
}

function normalize_(text) {
  return String(text || '').trim().toLowerCase();
}

/** Where each column is, from the headings in row 1. */
function layout_(sheet) {
  var values = sheet.getLastRow() > 0 ? sheet.getDataRange().getValues() : [[]];
  var headers = values[0].map(normalize_);
  var find = function (names) {
    for (var i = 0; i < headers.length; i++) if (names.indexOf(headers[i]) !== -1) return i;
    return -1;
  };
  var config = tabConfig_(sheet);
  var attributeCols = {};
  var attributes = (config && config.attributes) || [];
  for (var a = 0; a < attributes.length; a++) {
    var col = find([normalize_(attributes[a].label), normalize_(attributes[a].key)]);
    if (col !== -1) attributeCols[attributes[a].key] = col;
  }
  return {
    values: values,
    nameCol: find(NAME_HEADERS),
    emailCol: find(EMAIL_HEADERS),
    expiryCol: find(EXPIRY_HEADERS),
    statusCol: find([normalize_(STATUS_HEADER)]),
    linkCol: find([normalize_(LINK_HEADER)]),
    attributeCols: attributeCols,
  };
}

/** Adds the Name/Email headings to an empty tab, and the two result columns if missing. */
function prepareColumns_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 2).setValues([['Name', 'Email']]);
  }
  var layout = layout_(sheet);
  var next = sheet.getLastColumn() + 1;
  if (layout.statusCol === -1) sheet.getRange(1, next++).setValue(STATUS_HEADER);
  if (layout.linkCol === -1) sheet.getRange(1, next++).setValue(LINK_HEADER);
}

function writeResult_(sheet, layout, rowIndex, status, link) {
  sheet.getRange(rowIndex + 1, layout.statusCol + 1).setValue(status);
  if (link && layout.linkCol !== -1) sheet.getRange(rowIndex + 1, layout.linkCol + 1).setValue(link);
}

function link_(credentialId) {
  return CERTRUST_SITE + '/credentials/' + encodeURIComponent(credentialId);
}

function dateText_(value, timeZone) {
  if (value instanceof Date) return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
  return String(value).trim();
}

function sha256_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function api_(key, method, path, body, idempotencyKey) {
  var headers = { Authorization: 'Bearer ' + key };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  var options = { method: method, headers: headers, muteHttpExceptions: true };
  if (body) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }
  var response = UrlFetchApp.fetch(CERTRUST_API + path, options);
  var json = null;
  try { json = JSON.parse(response.getContentText()); }
  catch (e) { json = null; }
  return { code: response.getResponseCode(), json: json };
}

function errorMessage_(res) {
  var message = res.json && res.json.error && res.json.error.message;
  return message ? 'Certrust said: ' + message : 'Certrust could not be reached (status ' + res.code + ').';
}

function setupHtml_() {
  return '<!DOCTYPE html><html><head><base target="_top"><style>'
    + 'body{font-family:Arial,sans-serif;font-size:14px;color:#1f2937;margin:16px}'
    + 'label{display:block;font-weight:bold;margin:14px 0 4px}'
    + 'input,select{width:100%;box-sizing:border-box;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px}'
    + 'button{margin-top:16px;padding:9px 16px;border:0;border-radius:999px;background:#28A745;color:#000;font-size:14px;cursor:pointer}'
    + 'button[disabled]{opacity:.5;cursor:default}'
    + '.hint{color:#6b7280;font-size:12px;margin-top:4px}'
    + '.error{color:#b91c1c;margin-top:12px}.ok{color:#166534;margin-top:12px}'
    + '</style></head><body>'
    + '<p>Issue a certificate for every row in this tab.</p>'
    + '<label for="key">API key</label>'
    + '<input id="key" type="password" placeholder="crt_…" autocomplete="off">'
    + '<div class="hint">Create one in Certrust under Manage &gt; API keys, with the Read and Issue permissions. Leave empty to keep the key already saved.</div>'
    + '<button id="connect">Connect</button>'
    + '<div id="step2" style="display:none">'
    + '<p class="ok" id="org"></p>'
    + '<label for="achievement">Achievement for this tab</label>'
    + '<select id="achievement"></select>'
    + '<div class="hint">Each row in this tab is issued this achievement. Use another tab for another achievement.</div>'
    + '<button id="save">Save</button>'
    + '</div>'
    + '<div id="message"></div>'
    + '<script>'
    + 'var $=function(id){return document.getElementById(id)};'
    + 'function show(text,cls){var m=$("message");m.className=cls;m.textContent=text}'
    + '$("connect").onclick=function(){'
    + ' $("connect").disabled=true;show("Checking…","hint");'
    + ' google.script.run.withSuccessHandler(function(r){'
    + '  $("connect").disabled=false;show("","");'
    + '  $("org").textContent="Connected to "+r.organization+" (tab: "+r.tab+")";'
    + '  var s=$("achievement");s.innerHTML="";'
    + '  if(!r.achievements.length){show("This account has no achievements yet. Create one in Certrust first.","error");return}'
    + '  r.achievements.forEach(function(a){var o=document.createElement("option");o.value=a.id;o.textContent=a.name;if(a.id===r.currentAchievementId)o.selected=true;s.appendChild(o)});'
    + '  $("step2").style.display="block";'
    + ' }).withFailureHandler(function(e){$("connect").disabled=false;show(e.message,"error")}).certrustConnect($("key").value);'
    + '};'
    + '$("save").onclick=function(){'
    + ' var s=$("achievement");$("save").disabled=true;show("Saving…","hint");'
    + ' google.script.run.withSuccessHandler(function(text){show(text,"ok");setTimeout(function(){google.script.host.close()},2500)})'
    + '  .withFailureHandler(function(e){$("save").disabled=false;show(e.message,"error")})'
    + '  .certrustSave($("key").value,Number(s.value),s.options[s.selectedIndex].text);'
    + '};'
    + '</script></body></html>';
}
