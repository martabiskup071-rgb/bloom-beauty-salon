const SECRET_KEY = 'DIM_KERATIN_ADMIN_2026';

// ── TurboSMS ────────────────────────────────────────────────
// Вставте сюди ваш API-токен з кабінету turbosms.ua
const TURBOSMS_TOKEN  = 'ВАШ_ТОКЕН_TURBOSMS';   // ← замінити!
// Ім'я відправника — підтвердіть в кабінеті TurboSMS (або 'Viber')
const TURBOSMS_SENDER = 'DimKeratin';             // ← замінити після підтвердження!
// ────────────────────────────────────────────────────────────


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

// Форматує дату 'yyyy-MM-dd' → 'ДД.ММ.РРРР' для SMS
function formatDateUa(iso) {
  if (!iso || iso.length < 10) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Нормалізує номер телефону → '380XXXXXXXXX'
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('380') && digits.length === 12) return digits;
  if (digits.startsWith('0')   && digits.length === 10) return '38' + digits;
  if (digits.length === 9) return '380' + digits;
  return digits; // повертаємо як є — TurboSMS сам перевірить
}

// Надсилає SMS через TurboSMS API
// Повертає true якщо успішно, false якщо помилка (не кидає виняток)
function sendSMS(phone, text) {
  if (!TURBOSMS_TOKEN || TURBOSMS_TOKEN === 'ВАШ_ТОКЕН_TURBOSMS') {
    Logger.log('TurboSMS: токен не налаштовано, SMS не надіслано');
    return false;
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    Logger.log('TurboSMS: некоректний номер телефону: ' + phone);
    return false;
  }
  try {
    const payload = {
      recipients: [normalizedPhone],
      sms: { sender: TURBOSMS_SENDER, text: text }
    };
    const options = {
      method:      'post',
      contentType: 'application/json',
      headers:     { 'Authorization': 'Bearer ' + TURBOSMS_TOKEN },
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const resp = UrlFetchApp.fetch('https://api.turbosms.ua/message/send.json', options);
    const result = JSON.parse(resp.getContentText());
    Logger.log('TurboSMS відповідь: ' + JSON.stringify(result));
    // Код 0 = успіх у TurboSMS
    return result && result.response_code === 0;
  } catch (err) {
    Logger.log('TurboSMS помилка: ' + err.toString());
    return false;
  }
}

// ── Щоденна розсилка нагадувань ─────────────────────────────
// Запускається автоматично тригером кожен день о 10:00
// Щоб встановити тригер — виконайте функцію setupDailyReminder() один раз
function sendReminders() {
  const sheet  = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;

  const headers  = values[0];
  const nameIdx  = headers.indexOf('name');
  const phoneIdx = headers.indexOf('phone');
  const svcIdx   = headers.indexOf('service');
  const dateIdx  = headers.indexOf('date');
  const timeIdx  = headers.indexOf('time');
  const statIdx  = headers.indexOf('status');

  // Дата завтра у форматі 'yyyy-MM-dd'
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  let sent = 0;
  for (let i = 1; i < values.length; i++) {
    const row    = values[i];
    const status = String(row[statIdx] || '').trim();
    const date   = toDateStr(row[dateIdx]);
    const phone  = String(row[phoneIdx] || '').trim();

    if (date === tomorrowStr && status === 'підтверджено' && phone) {
      const name    = String(row[nameIdx] || '').trim();
      const service = String(row[svcIdx]  || '').trim();
      const time    = toTimeStr(row[timeIdx]);
      const text    = `Нагадування: ${name}, завтра о ${time} — ${service}. Дім Кератину. Щоб скасувати — напишіть нам: @dim_keratin_bot`;
      const ok = sendSMS(phone, text);
      if (ok) sent++;
      Utilities.sleep(300); // пауза між SMS щоб не перевищити ліміт
    }
  }
  Logger.log(`Нагадування надіслано: ${sent}`);
}

// Встановлює щоденний тригер на sendReminders о 10:00
// Виконайте цю функцію ОДИН РАЗ вручну після деплою скрипту
function setupDailyReminder() {
  // Видаляємо старі тригери sendReminders щоб не дублювати
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sendReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendReminders')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();
  Logger.log('Тригер встановлено: sendReminders щодня о 10:00');
}

// ── doPost ────────────────────────────────────────────────────
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

      // SMS-підтвердження клієнту
      if (data.phone) {
        const dateFormatted = formatDateUa(data.date);
        const smsText = `Дякуємо, ${data.name || 'клієнте'}! Ваш запис прийнято: ${data.service || 'послуга'} ${dateFormatted} о ${data.time}. Очікуйте підтвердження. Дім Кератину`;
        sendSMS(data.phone, smsText);
      }

      return jsonOk({ saved: true });
    }

    if (data.action === 'update') {
      if (data.key !== SECRET_KEY) return jsonError('Unauthorized');
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          const prevStatus = String(values[i][8] || '').trim();

          if (data.status !== undefined) sheet.getRange(i+1,9).setValue(data.status);
          if (data.note   !== undefined) sheet.getRange(i+1,10).setValue(data.note);
          if (data.date   !== undefined) {
            const iso = toDateStr(data.date);
            sheet.getRange(i+1,6).setValue(iso || data.date);
          }
          if (data.time !== undefined) {
            const hhmm = toTimeStr(data.time);
            sheet.getRange(i+1,7).setValue(hhmm || data.time);
          }

          // SMS при зміні статусу (тільки якщо статус дійсно змінився)
          const newStatus = data.status;
          if (newStatus && newStatus !== prevStatus) {
            // Перечитуємо рядок після збереження
            const updRow   = sheet.getRange(i+1, 1, 1, 10).getValues()[0];
            const phone    = String(updRow[2] || '').trim();
            const name     = String(updRow[1] || '').trim();
            const service  = String(updRow[4] || '').trim();
            const dateIso  = toDateStr(updRow[5]);
            const time     = toTimeStr(updRow[6]);
            const dateFmt  = formatDateUa(dateIso);

            let smsText = null;
            if (newStatus === 'підтверджено') {
              smsText = `${name}, ваш запис підтверджено! ${service} ${dateFmt} о ${time}. Чекаємо вас. Дім Кератину`;
            } else if (newStatus === 'скасовано') {
              smsText = `${name}, ваш запис ${dateFmt} о ${time} скасовано. Щоб записатись знову: dim-keratin.netlify.app`;
            }
            if (smsText && phone) sendSMS(phone, smsText);
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

// ── doGet ─────────────────────────────────────────────────────
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

// ── Листи Google Sheets ──────────────────────────────────────
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
