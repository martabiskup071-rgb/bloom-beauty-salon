const SECRET_KEY = 'DIM_KERATIN_ADMIN_2026';

// Перетворює будь-яке значення дати → 'yyyy-MM-dd'
function toDateStr(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10); // вже ISO
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch(e) {}
  return s;
}

// Перетворює будь-яке значення часу → 'HH:mm'
function toTimeStr(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  const s = String(v).trim();
  if (/^\d{2}:\d{2}/.test(s)) return s.substring(0, 5); // вже HH:mm
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm');
  } catch(e) {}
  return s;
}

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
          if (data.date   !== undefined) {
            // Зберігаємо дату як ISO рядок (yyyy-MM-dd) щоб уникнути проблем з форматом
            const iso = toDateStr(data.date);
            sheet.getRange(i+1,6).setValue(iso || data.date);
          }
          if (data.time   !== undefined) {
            const hhmm = toTimeStr(data.time);
            sheet.getRange(i+1,7).setValue(hhmm || data.time);
          }
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

    if (data.action === 'saveServices') {
      if (data.key !== SECRET_KEY) return jsonError('Unauthorized');
      const svSheet = getServicesSheet();
      svSheet.clearContents();
      svSheet.appendRow(['key', 'value']);
      svSheet.getRange(1,1,1,2).setFontWeight('bold');
      svSheet.appendRow(['services', JSON.stringify(data.services || [])]);
      return jsonOk({ saved: true });
    }

    return jsonError('Unknown action');
  } catch(err) { return jsonError(err.toString()); }
}

function doGet(e) {
  try {
    if (e && e.parameter) {

      if (e.parameter.action === 'getServices') {
        const svSheet = getServicesSheet();
        const vals = svSheet.getDataRange().getValues();
        for (const row of vals) {
          if (String(row[0]) === 'services') {
            return jsonOk({ services: JSON.parse(String(row[1])) });
          }
        }
        return jsonOk({ services: null });
      }

      if (e.parameter.action === 'getSchedule') {
        const sSheet = getSettingsSheet();
        const vals   = sSheet.getDataRange().getValues();
        const result = {};
        vals.forEach(row => { if (row[0]) result[String(row[0])] = String(row[1]); });
        return jsonOk({ schedule: result });
      }

      if (e.parameter.action === 'getAvailableSlots') {
        const date   = e.parameter.date || '';
        const bSheet = getSheet();
        const bVals  = bSheet.getDataRange().getValues();
        const headers = bVals[0];
        const dIdx   = headers.indexOf('date');
        const tIdx   = headers.indexOf('time');
        const sIdx   = headers.indexOf('status');
        const booked = bVals.slice(1)
          .filter(r => {
            const rowDate = toDateStr(r[dIdx]);
            return rowDate === date && String(r[sIdx]).trim() === 'підтверджено';
          })
          .map(r => toTimeStr(r[tIdx]));
        return jsonOk({ bookedTimes: booked });
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

function getServicesSheet() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Послуги');
  if (!sheet) {
    sheet = ss.insertSheet('Послуги');
    sheet.appendRow(['key', 'value']);
    sheet.getRange(1,1,1,2).setFontWeight('bold');
  }
  return sheet;
}

function jsonOk(x)    { return ContentService.createTextOutput(JSON.stringify({ok:true,...x})).setMimeType(ContentService.MimeType.JSON); }
function jsonError(m) { return ContentService.createTextOutput(JSON.stringify({ok:false,error:m})).setMimeType(ContentService.MimeType.JSON); }
