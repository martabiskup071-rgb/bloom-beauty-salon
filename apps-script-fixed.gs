const SECRET_KEY = 'DIM_KERATIN_ADMIN_2026';

function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const sheet = getSheet();

    if (data.action === 'add') {
      sheet.appendRow([
        data.created_at || new Date().toISOString(),
        data.name||'', data.phone||'', data.telegram||'',
        data.service||'', data.date||'', data.time||'',
        data.message||'', 'очікує', ''
      ]);
      return jsonOk({ saved: true });
    }

    if (data.action === 'update') {
      if (data.key !== SECRET_KEY) return jsonError('Unauthorized');
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          if (data.status !== undefined) sheet.getRange(i+1,9).setValue(data.status);
          if (data.note   !== undefined) sheet.getRange(i+1,10).setValue(data.note);
          if (data.date   !== undefined) sheet.getRange(i+1,6).setValue(data.date);
          if (data.time   !== undefined) sheet.getRange(i+1,7).setValue(data.time);
          return jsonOk({ updated: true });
        }
      }
      return jsonError('Row not found');
    }

    if (data.action === 'saveSchedule') {
      if (data.key !== SECRET_KEY) return jsonError('Unauthorized');
      const sSheet = getSettingsSheet();
      sSheet.clearContents();
      sSheet.appendRow(['workDays',    JSON.stringify(data.workDays    || [])]);
      sSheet.appendRow(['timeSlots',   JSON.stringify(data.timeSlots   || [])]);
      sSheet.appendRow(['holidays',    JSON.stringify(data.holidays    || [])]);
      sSheet.appendRow(['specialDays', JSON.stringify(data.specialDays || {})]);
      return jsonOk({ saved: true });
    }

    return jsonError('Unknown action');
  } catch(err) { return jsonError(err.toString()); }
}

function doGet(e) {
  try {
    if (e && e.parameter) {

      if (e.parameter.action === 'getSchedule') {
        const sSheet = getSettingsSheet();
        const vals   = sSheet.getDataRange().getValues();
        const result = {};
        vals.forEach(row => { if (row[0]) result[String(row[0])] = String(row[1]); });
        return jsonOk({ schedule: result });
      }

      if (e.parameter.action === 'getAvailableSlots') {
        const date    = e.parameter.date || '';
        const bSheet  = getSheet();
        const bVals   = bSheet.getDataRange().getValues();
        const headers = bVals[0];
        const dIdx    = headers.indexOf('date');
        const tIdx    = headers.indexOf('time');
        const sIdx    = headers.indexOf('status');
        const booked  = bVals.slice(1)
          .filter(r => {
            // Дата може бути Date-об'єктом або рядком
            const rowDate = (r[dIdx] instanceof Date)
              ? Utilities.formatDate(r[dIdx], Session.getScriptTimeZone(), 'yyyy-MM-dd')
              : String(r[dIdx] || '');
            return rowDate === date && String(r[sIdx]) === 'підтверджено';
          })
          .map(r => {
            // Час теж може бути Date-об'єктом (Sheets зберігає "14:00" як Date)
            return (r[tIdx] instanceof Date)
              ? Utilities.formatDate(r[tIdx], Session.getScriptTimeZone(), 'HH:mm')
              : String(r[tIdx] || '');
          });
        // DEBUG: тимчасово, видалити після перевірки
        const debugRows = bVals.slice(1).map(r => ({
          date:   (r[dIdx] instanceof Date) ? Utilities.formatDate(r[dIdx], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(r[dIdx]||''),
          status: String(r[sIdx]||''),
          time:   (r[tIdx] instanceof Date) ? Utilities.formatDate(r[tIdx], Session.getScriptTimeZone(), 'HH:mm') : String(r[tIdx]||'')
        }));
        return jsonOk({ bookedTimes: booked, _debug: debugRows, _headers: headers, _dIdx: dIdx, _sIdx: sIdx });
      }

    }

    if (!e || !e.parameter || e.parameter.key !== SECRET_KEY)
      return jsonError('Unauthorized');

    const sheet  = getSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return jsonOk({ data: [] });
    const headers = values[0];
    const rows = values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const v = row[i];
        obj[h] = (v instanceof Date)
          ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(v || '');
      });
      return obj;
    });
    return jsonOk({ data: rows });

  } catch(err) { return jsonError(err.toString()); }
}

function getSheet() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Записи');
  if (!sheet) {
    sheet = ss.insertSheet('Записи');
    sheet.appendRow(['id','name','phone','telegram','service','date','time','message','status','note']);
    sheet.getRange(1,1,1,10).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSettingsSheet() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Налаштування');
  if (!sheet) {
    sheet = ss.insertSheet('Налаштування');
    sheet.appendRow(['key', 'value']);
    sheet.getRange(1,1,1,2).setFontWeight('bold');
  }
  return sheet;
}

function jsonOk(x)    { return ContentService.createTextOutput(JSON.stringify({ok:true,...x})).setMimeType(ContentService.MimeType.JSON); }
function jsonError(m) { return ContentService.createTextOutput(JSON.stringify({ok:false,error:m})).setMimeType(ContentService.MimeType.JSON); }
