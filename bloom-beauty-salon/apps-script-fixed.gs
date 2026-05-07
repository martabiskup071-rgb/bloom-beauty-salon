// ════════════════════════════════════════════════════════════
//  ДІМ КЕРАТИНУ — Google Apps Script
//  Всі секрети зберігаються ВИКЛЮЧНО у PropertiesService.
//  Як налаштувати — дивись SETUP-SECRETS.md
// ════════════════════════════════════════════════════════════

// ── PropertiesService helpers ────────────────────────────────
function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

// ── Сесії (8 годин, сервер-side CacheService) ────────────────
function createSession() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, '1', 28800);
  return token;
}

function verifySession(token) {
  if (!token || typeof token !== 'string' || token.length > 64) return false;
  return CacheService.getScriptCache().get('sess_' + token) === '1';
}

function destroySession(token) {
  if (token) CacheService.getScriptCache().remove('sess_' + token);
}

// ── Rate limiting: глобально не більше 20 записів/хвилину ────
function checkRateLimit() {
  const cache = CacheService.getScriptCache();
  const key   = 'rl_' + Math.floor(Date.now() / 60000);
  const count = parseInt(cache.get(key) || '0');
  if (count >= 20) return false;
  cache.put(key, String(count + 1), 120);
  return true;
}

// ── Валідація телефону (лише UA-формат) ──────────────────────
function isValidPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  // 380XXXXXXXXX (12 цифр) або 0XXXXXXXXX (10 цифр) або 9 цифр
  return digits.length >= 9 && digits.length <= 13;
}

// ── Нормалізація телефону → 380XXXXXXXXX ────────────────────
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('380') && digits.length === 12) return digits;
  if (digits.startsWith('0')   && digits.length === 10) return '38' + digits;
  if (digits.length === 9) return '380' + digits;
  return digits;
}

// ── Форматування дати 'yyyy-MM-dd' → 'ДД.ММ.РРРР' ───────────
function formatDateUa(iso) {
  if (!iso || iso.length < 10) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ── Перетворення дати будь-якого типу → 'yyyy-MM-dd' ─────────
function toDateStr(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch(e) {}
  return s;
}

// ── Перетворення часу будь-якого типу → 'HH:mm' ─────────────
function toTimeStr(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  const s = String(v).trim();
  if (/^\d{2}:\d{2}/.test(s)) return s.substring(0, 5);
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm');
  } catch(e) {}
  return s;
}

// ── Telegram: сповістити персонал (сервер-side) ──────────────
function notifyStaff(data) {
  const botToken  = getProp('BOT_TOKEN');
  if (!botToken) return;
  const recipients = JSON.parse(getProp('RECIPIENTS') || '[]');
  if (!recipients.length) return;

  const dateObj = new Date((data.date || '') + 'T12:00:00');
  const dateStr = isNaN(dateObj) ? (data.date || '') :
    dateObj.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

  const safeName     = escapeHtml(data.name     || '');
  const safePhone    = escapeHtml(data.phone    || '');
  const safeTg       = escapeHtml((data.telegram || '').replace('@', ''));
  const safeService  = escapeHtml(data.service  || '');
  const safeMessage  = escapeHtml(data.message  || '');

  const text =
    `🔔 <b>Новий запис!</b>\n\n` +
    `👤 <b>Ім'я:</b> ${safeName}\n` +
    `📞 <b>Телефон:</b> ${safePhone}\n` +
    (data.telegram ? `💬 <b>Telegram:</b> @${safeTg}\n` : '') +
    `💇 <b>Послуга:</b> ${safeService}\n` +
    `📅 <b>Дата:</b> ${dateStr}\n` +
    `🕐 <b>Час:</b> ${escapeHtml(data.time || '')}\n` +
    (data.message ? `📝 <b>Коментар:</b> ${safeMessage}\n` : '') +
    `\n——\n📩 Запис з сайту ДІМ КЕРАТИНУ`;

  recipients.forEach(function(recipient) {
    if (!recipient.chat_id || String(recipient.chat_id).startsWith('CHAT_ID')) return;
    try {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
        method:             'post',
        contentType:        'application/json',
        payload:            JSON.stringify({ chat_id: recipient.chat_id, text: text, parse_mode: 'HTML' }),
        muteHttpExceptions: true
      });
    } catch(err) {
      Logger.log('Telegram notifyStaff помилка: ' + err.toString());
    }
  });
}

// ── Telegram: підтвердження клієнту (сервер-side) ────────────
function notifyClient(data) {
  const botToken    = getProp('BOT_TOKEN');
  const botUsername = getProp('BOT_USERNAME');
  if (!botToken || !data.telegram) return;

  const username = String(data.telegram).replace('@', '');
  if (!username) return;

  const dateObj = new Date((data.date || '') + 'T12:00:00');
  const dateStr = isNaN(dateObj) ? (data.date || '') :
    dateObj.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

  const text =
    `✅ <b>Ваш запис прийнято!</b>\n\n` +
    `💇 <b>Послуга:</b> ${escapeHtml(data.service || '')}\n` +
    `📅 <b>Дата:</b> ${dateStr}\n` +
    `🕐 <b>Час:</b> ${escapeHtml(data.time || '')}\n` +
    `📍 <b>Адреса:</b> вул. Стрийська, 73, Дрогобич\n\n` +
    `До зустрічі в ДІМ КЕРАТИНУ! ✨\n` +
    (botUsername ? `Якщо потрібно перенести — напишіть нам: @${escapeHtml(botUsername)}` : '');

  try {
    const getChat = UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/getChat', {
      method:             'post',
      contentType:        'application/json',
      payload:            JSON.stringify({ chat_id: '@' + username }),
      muteHttpExceptions: true
    });
    const chatData = JSON.parse(getChat.getContentText());
    if (!chatData.ok) return;

    UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method:             'post',
      contentType:        'application/json',
      payload:            JSON.stringify({ chat_id: chatData.result.id, text: text, parse_mode: 'HTML' }),
      muteHttpExceptions: true
    });
  } catch(err) {
    Logger.log('Telegram notifyClient помилка: ' + err.toString());
  }
}

// ── TurboSMS ─────────────────────────────────────────────────
function sendSMS(phone, text) {
  const token  = getProp('TURBOSMS_TOKEN');
  const sender = getProp('TURBOSMS_SENDER') || 'DimKeratin';
  if (!token) {
    Logger.log('TurboSMS: токен не налаштовано в PropertiesService');
    return false;
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    Logger.log('TurboSMS: некоректний номер: ' + phone);
    return false;
  }
  try {
    const options = {
      method:             'post',
      contentType:        'application/json',
      headers:            { 'Authorization': 'Bearer ' + token },
      payload:            JSON.stringify({ recipients: [normalizedPhone], sms: { sender: sender, text: text } }),
      muteHttpExceptions: true
    };
    const resp   = UrlFetchApp.fetch('https://api.turbosms.ua/message/send.json', options);
    const result = JSON.parse(resp.getContentText());
    Logger.log('TurboSMS відповідь: ' + JSON.stringify(result));
    return result && result.response_code === 0;
  } catch(err) {
    Logger.log('TurboSMS помилка: ' + err.toString());
    return false;
  }
}

// ── Щоденна розсилка нагадувань ──────────────────────────────
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
      const botUsername = getProp('BOT_USERNAME') || 'dim_keratin_bot';
      const text    = `Нагадування: ${name}, завтра о ${time} — ${service}. Дім Кератину. Щоб скасувати — напишіть нам: @${botUsername}`;
      const ok = sendSMS(phone, text);
      if (ok) sent++;
      Utilities.sleep(300);
    }
  }
  Logger.log('Нагадування надіслано: ' + sent);
}

function setupDailyReminder() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
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
    const data = JSON.parse(e.postData.contents);

    // ── Логін адміна ──
    if (data.action === 'login') {
      const storedPassword = getProp('ADMIN_PASSWORD');
      if (!storedPassword) return jsonError('Сервер не налаштовано (ADMIN_PASSWORD)');
      if (!data.password || data.password !== storedPassword) {
        Utilities.sleep(500); // захист від brute-force
        return jsonError('Unauthorized');
      }
      return jsonOk({ token: createSession() });
    }

    // ── Logout ──
    if (data.action === 'logout') {
      destroySession(data.token);
      return jsonOk({ done: true });
    }

    // ── Публічний запис клієнта ──
    if (data.action === 'add') {
      // Honeypot: якщо заповнено — бот
      if (data._hp) return jsonOk({ saved: true }); // мовчки ігнорувати

      // Rate limiting
      if (!checkRateLimit()) return jsonError('Забагато запитів. Спробуйте пізніше.');

      // Валідація телефону
      if (!isValidPhone(data.phone)) return jsonError('Некоректний номер телефону');

      // Валідація обов'язкових полів
      const name    = String(data.name    || '').trim().substring(0, 100);
      const phone   = String(data.phone   || '').trim().substring(0, 20);
      const service = String(data.service || '').trim().substring(0, 200);
      const date    = String(data.date    || '').trim().substring(0, 10);
      const time    = String(data.time    || '').trim().substring(0, 5);
      const message = String(data.message || '').trim().substring(0, 500);
      const telegram = String(data.telegram || '').trim().substring(0, 50);

      if (!name || !phone || !service || !date || !time) {
        return jsonError('Заповніть всі обов\'язкові поля');
      }

      const sheet = getSheet();
      sheet.appendRow([
        new Date().toISOString(),
        name, phone, telegram,
        service, date, time,
        message, 'очікує', ''
      ]);

      // Сервер-side Telegram + SMS
      notifyStaff({ name, phone, telegram, service, date, time, message });
      notifyClient({ name, phone, telegram, service, date, time });

      if (phone) {
        const dateFormatted = formatDateUa(date);
        const smsText = `Дякуємо, ${name}! Ваш запис прийнято: ${service} ${dateFormatted} о ${time}. Очікуйте підтвердження. Дім Кератину`;
        sendSMS(phone, smsText);
      }

      return jsonOk({ saved: true });
    }

    // ── Всі наступні дії потребують сесійного токена ──
    if (!verifySession(data.key)) return jsonError('Unauthorized');

    if (data.action === 'update') {
      const values = getSheet().getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id)) {
          const sheet      = getSheet();
          const prevStatus = String(values[i][8] || '').trim();

          if (data.status !== undefined) sheet.getRange(i+1,9).setValue(String(data.status).substring(0,50));
          if (data.note   !== undefined) sheet.getRange(i+1,10).setValue(String(data.note).substring(0,500));
          if (data.date   !== undefined) {
            const iso = toDateStr(data.date);
            sheet.getRange(i+1,6).setValue(iso || data.date);
          }
          if (data.time !== undefined) {
            const hhmm = toTimeStr(data.time);
            sheet.getRange(i+1,7).setValue(hhmm || data.time);
          }

          // SMS при зміні статусу
          const newStatus = data.status;
          if (newStatus && newStatus !== prevStatus) {
            const updRow   = sheet.getRange(i+1, 1, 1, 10).getValues()[0];
            const phone    = String(updRow[2] || '').trim();
            const name     = String(updRow[1] || '').trim();
            const service  = String(updRow[4] || '').trim();
            const dateIso  = toDateStr(updRow[5]);
            const time     = toTimeStr(updRow[6]);
            const dateFmt  = formatDateUa(dateIso);

            let smsText = null;
            const botUsername = getProp('BOT_USERNAME') || 'dim_keratin_bot';
            if (newStatus === 'підтверджено') {
              smsText = `${name}, ваш запис підтверджено! ${service} ${dateFmt} о ${time}. Чекаємо вас. Дім Кератину`;
            } else if (newStatus === 'скасовано') {
              smsText = `${name}, ваш запис ${dateFmt} о ${time} скасовано. Щоб записатись знову напишіть: @${botUsername}`;
            }
            if (smsText && phone) sendSMS(phone, smsText);
          }

          return jsonOk({ updated: true });
        }
      }
      return jsonError('Row not found');
    }

    if (data.action === 'saveSchedule') {
      const sSheet = getSettingsSheet();
      sSheet.clearContents();
      sSheet.appendRow(['workDays',    JSON.stringify(data.workDays    || [])]);
      sSheet.appendRow(['timeSlots',   JSON.stringify(data.timeSlots   || [])]);
      sSheet.appendRow(['holidays',    JSON.stringify(data.holidays    || [])]);
      sSheet.appendRow(['specialDays', JSON.stringify(data.specialDays || {})]);
      return jsonOk({ saved: true });
    }

    if (data.action === 'getAll') {
      const sheet  = getSheet();
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return jsonOk({ data: [] });
      const headers = values[0];
      const rows = values.slice(1).map(function(row) {
        const obj = {};
        headers.forEach(function(h, i) {
          const v = row[i];
          obj[h] = (v instanceof Date)
            ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(v || '');
        });
        return obj;
      });
      return jsonOk({ data: rows });
    }

    if (data.action === 'saveServices') {
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
    if (!e || !e.parameter) return jsonError('Bad request');

    // ── Публічні ендпоінти ──
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
      vals.forEach(function(row) { if (row[0]) result[String(row[0])] = String(row[1]); });
      return jsonOk({ schedule: result });
    }

    if (e.parameter.action === 'getAvailableSlots') {
      const date   = String(e.parameter.date || '').substring(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError('Invalid date');
      const bSheet = getSheet();
      const bVals  = bSheet.getDataRange().getValues();
      const headers = bVals[0];
      const dIdx   = headers.indexOf('date');
      const tIdx   = headers.indexOf('time');
      const sIdx   = headers.indexOf('status');
      const booked = bVals.slice(1)
        .filter(function(r) {
          const rowDate = toDateStr(r[dIdx]);
          return rowDate === date && String(r[sIdx]).trim() === 'підтверджено';
        })
        .map(function(r) { return toTimeStr(r[tIdx]); });
      return jsonOk({ bookedTimes: booked });
    }

    // ── Адмін-ендпоінт: потребує сесійного токена ──
    if (e.parameter.action === 'getAll') {
      if (!verifySession(e.parameter.key)) return jsonError('Unauthorized');
      const sheet  = getSheet();
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return jsonOk({ data: [] });
      const headers = values[0];
      const rows = values.slice(1).map(function(row) {
        const obj = {};
        headers.forEach(function(h, i) {
          const v = row[i];
          obj[h] = (v instanceof Date)
            ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(v || '');
        });
        return obj;
      });
      return jsonOk({ data: rows });
    }

    return jsonError('Unauthorized');
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

// ── HTML-екранування (захист від XSS у Telegram/SMS) ─────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function jsonOk(x)    { return ContentService.createTextOutput(JSON.stringify(Object.assign({ok:true},x))).setMimeType(ContentService.MimeType.JSON); }
function jsonError(m) { return ContentService.createTextOutput(JSON.stringify({ok:false,error:m})).setMimeType(ContentService.MimeType.JSON); }
