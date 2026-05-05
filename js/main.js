// ─────────────────────────────────────────────
//  ПОСЛУГИ — РЕНДЕР З config.js
// ─────────────────────────────────────────────
function renderServices() {
  const grid = document.getElementById('services-grid');
  if (!grid || typeof SERVICES === 'undefined') return;

  const serviceSelect = document.getElementById('b-service');

  grid.innerHTML = '';
  if (serviceSelect) {
    serviceSelect.innerHTML = '<option value="" disabled selected>Обрати послугу...</option>';
  }

  SERVICES.filter(s => s.active).forEach(service => {
    const priceRows = service.prices
      .map(p => `<li class="price-item"><span>${p.label}</span><span class="price-amount">${p.value}</span></li>`)
      .join('');

    const card = document.createElement('div');
    card.className = 'service-card reveal';
    card.innerHTML = `
      <span class="service-icon">${service.icon}</span>
      <h3 class="service-name">${service.name}</h3>
      <p class="service-desc">${service.desc}</p>
      <ul class="price-list">${priceRows}</ul>
      <a href="#contact" class="service-cta">Записатись →</a>
    `;
    grid.appendChild(card);

    if (serviceSelect) {
      const opt = document.createElement('option');
      opt.value       = service.name;
      opt.textContent = `${service.icon} ${service.name}`;
      const firstPrice = service.prices[0];
      if (firstPrice && firstPrice.value !== 'уточнюється') {
        opt.textContent += ` — ${firstPrice.value}`;
      }
      serviceSelect.appendChild(opt);
    }
  });

  document.querySelectorAll('.service-card.reveal').forEach(el => observer.observe(el));
}

// ─────────────────────────────────────────────
//  SCROLL REVEAL
// ─────────────────────────────────────────────
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.12 }
);

renderServices();
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─────────────────────────────────────────────
//  BOOKING MODAL — ВІДКРИТИ / ЗАКРИТИ
// ─────────────────────────────────────────────
const bookingModal = document.getElementById('booking-modal');
let lastFocused    = null;

function openBookingModal() {
  lastFocused = document.activeElement;
  bookingModal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const first = bookingModal.querySelector('input, select');
    if (first) first.focus();
  }, 50);
}

window.closeBookingModal = function () {
  bookingModal.classList.remove('is-open');
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
};

document.getElementById('bmodal-close').addEventListener('click', closeBookingModal);
bookingModal.addEventListener('click', e => { if (e.target === bookingModal) closeBookingModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && bookingModal.classList.contains('is-open')) closeBookingModal();
});

document.addEventListener('click', e => {
  const trigger = e.target.closest('a[href="#contact"], .js-open-booking');
  if (trigger) {
    e.preventDefault();
    openBookingModal();
  }
});

// ─────────────────────────────────────────────
//  MOBILE NAV
// ─────────────────────────────────────────────
const navToggle = document.querySelector('.nav-toggle');
const navMenu   = document.querySelector('nav ul');

navToggle.addEventListener('click', () => {
  const expanded = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!expanded));
  navMenu.classList.toggle('nav-open');
});

navMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('nav-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ─────────────────────────────────────────────
//  РОЗКЛАД — ЗАВАНТАЖЕННЯ З GOOGLE SHEETS
// ─────────────────────────────────────────────
async function loadRemoteSchedule() {
  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL === 'ВАШ_APPS_SCRIPT_URL') return;
  try {
    const res  = await fetch(`${GOOGLE_SCRIPT_URL}?action=getSchedule`);
    const json = await res.json();
    if (!json.ok || !json.schedule) return;
    const s = json.schedule;
    if (s.workDays)    SCHEDULE.workDays    = JSON.parse(s.workDays);
    if (s.timeSlots)   SCHEDULE.timeSlots   = JSON.parse(s.timeSlots);
    if (s.holidays)    SCHEDULE.holidays    = JSON.parse(s.holidays);
    if (s.specialDays) SCHEDULE.specialDays = JSON.parse(s.specialDays);
  } catch { /* fallback to config.js */ }
}

// ─────────────────────────────────────────────
//  FLATPICKR — КРАСИВИЙ КАЛЕНДАР З ВИБОРОМ ДАТИ
// ─────────────────────────────────────────────
const dateInput = document.getElementById('b-date');
let fpInstance  = null;

function initFlatpickr() {
  if (!dateInput) return;
  if (fpInstance) { fpInstance.destroy(); fpInstance = null; }

  fpInstance = flatpickr(dateInput, {
    minDate: 'today',
    dateFormat: 'Y-m-d',
    disableMobile: false,
    locale: {
      firstDayOfWeek: 1,
      weekdays: {
        shorthand: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        longhand:  ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота']
      },
      months: {
        shorthand: ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'],
        longhand:  ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
      }
    },
    disable: [
      function (date) { return !SCHEDULE.workDays.includes(date.getDay()); },
      ...SCHEDULE.holidays
    ],
    onChange: function (selectedDates, dateStr) {
      updateTimeSlots(dateStr);
      const hint = document.getElementById('date-hint');
      if (hint) hint.textContent = '';
    }
  });
}

// Завантажуємо розклад з Sheets, потім ініціалізуємо календар
loadRemoteSchedule().then(() => initFlatpickr());

// ─────────────────────────────────────────────
//  ЗАЙНЯТІ СЛОТИ — ПЕРЕВІРКА ПІДТВЕРДЖЕНИХ ЗАПИСІВ
// ─────────────────────────────────────────────
async function fetchBookedSlots(dateStr) {
  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL === 'ВАШ_APPS_SCRIPT_URL') return [];
  try {
    const res  = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAvailableSlots&date=${dateStr}`);
    const json = await res.json();
    console.log('🔍 getAvailableSlots для', dateStr, '→', json);
    return json.bookedTimes || [];
  } catch (err) {
    console.error('❌ fetchBookedSlots помилка:', err);
    return [];
  }
}

// ─────────────────────────────────────────────
//  CALENDAR — СЛОТИ ЧАСУ ПРИ ЗМІНІ ДАТИ
// ─────────────────────────────────────────────
async function updateTimeSlots(dateStr) {
  const timeSelect = document.getElementById('b-time');
  const dateHint   = document.getElementById('date-hint');
  timeSelect.innerHTML = '<option value="" disabled selected>⏳ Завантаження...</option>';

  if (!dateStr) {
    timeSelect.innerHTML = '<option value="" disabled selected>Спочатку оберіть дату...</option>';
    return;
  }

  const date      = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay();

  if (!SCHEDULE.workDays.includes(dayOfWeek)) {
    if (dateHint) { dateHint.textContent = '⛔ Цей день вихідний — оберіть інший.'; dateHint.style.color = '#c0392b'; }
    if (fpInstance) fpInstance.clear();
    timeSelect.innerHTML = '<option value="" disabled selected>Оберіть іншу дату...</option>';
    return;
  }

  if (SCHEDULE.holidays.includes(dateStr)) {
    if (dateHint) { dateHint.textContent = '⛔ Цей день вихідний — оберіть інший.'; dateHint.style.color = '#c0392b'; }
    if (fpInstance) fpInstance.clear();
    timeSelect.innerHTML = '<option value="" disabled selected>Оберіть іншу дату...</option>';
    return;
  }

  if (dateHint) dateHint.textContent = '';

  // Всі слоти для цього дня
  const allSlots = SCHEDULE.specialDays[dateStr] || SCHEDULE.timeSlots;

  // Перевіряємо зайняті (підтверджені) записи
  const bookedTimes = await fetchBookedSlots(dateStr);
  const freeSlots   = allSlots.filter(t => !bookedTimes.includes(t));

  if (freeSlots.length === 0) {
    timeSelect.innerHTML = '<option value="" disabled selected>😔 Всі місця зайняті</option>';
    if (dateHint) {
      dateHint.textContent = '😔 На цей день всі місця зайняті — оберіть інший.';
      dateHint.style.color = '#c0392b';
    }
    return;
  }

  timeSelect.innerHTML = '<option value="" disabled selected>Оберіть час...</option>';
  freeSlots.forEach(time => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = time;
    timeSelect.appendChild(opt);
  });
}

// ─────────────────────────────────────────────
//  GOOGLE SHEETS — ЗБЕРЕГТИ ЗАПИС
// ─────────────────────────────────────────────
async function saveToSheets(data) {
  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL === 'ВАШ_APPS_SCRIPT_URL') {
    console.warn('📋 Google Sheets не налаштований. Дивись GOOGLE-SHEETS-SETUP.md');
    return;
  }
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ action: 'add', ...data, created_at: new Date().toISOString() })
    });
  } catch (err) {
    console.error('Помилка збереження в Google Sheets:', err);
  }
}

// ─────────────────────────────────────────────
//  TELEGRAM — НАДІСЛАТИ ВСІМ ОТРИМУВАЧАМ
// ─────────────────────────────────────────────
async function notifyStaff(data) {
  if (BOT_TOKEN === 'ВАШ_ТОКЕН_БОТ') {
    console.warn('Telegram не налаштований. Дивись TELEGRAM-SETUP.md');
    return;
  }

  const dateObj = new Date(data.date + 'T12:00:00');
  const dateStr = dateObj.toLocaleDateString('uk-UA', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const text =
    `🔔 <b>Новий запис!</b>\n\n` +
    `👤 <b>Ім'я:</b> ${data.name}\n` +
    `📞 <b>Телефон:</b> ${data.phone}\n` +
    (data.telegram ? `💬 <b>Telegram:</b> @${data.telegram.replace('@', '')}\n` : '') +
    `💇 <b>Послуга:</b> ${data.service}\n` +
    `📅 <b>Дата:</b> ${dateStr}\n` +
    `🕐 <b>Час:</b> ${data.time}\n` +
    (data.message ? `📝 <b>Коментар:</b> ${data.message}\n` : '') +
    `\n——\n📩 Запис з сайту ДІМ КЕРАТИНУ`;

  for (const recipient of RECIPIENTS) {
    if (!recipient.chat_id || recipient.chat_id.startsWith('CHAT_ID')) continue;
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: recipient.chat_id, text, parse_mode: 'HTML' })
      });
    } catch (err) {
      console.error(`Помилка надсилання до ${recipient.name}:`, err);
    }
  }
}

// ─────────────────────────────────────────────
//  TELEGRAM — ПІДТВЕРДЖЕННЯ КЛІЄНТУ
// ─────────────────────────────────────────────
async function notifyClient(data) {
  if (BOT_TOKEN === 'ВАШ_ТОКЕН_БОТ') return;
  if (!data.telegram) return;

  const username = data.telegram.replace('@', '');
  const dateObj  = new Date(data.date + 'T12:00:00');
  const dateStr  = dateObj.toLocaleDateString('uk-UA', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const text =
    `✅ <b>Ваш запис прийнято!</b>\n\n` +
    `💇 <b>Послуга:</b> ${data.service}\n` +
    `📅 <b>Дата:</b> ${dateStr}\n` +
    `🕐 <b>Час:</b> ${data.time}\n` +
    `📍 <b>Адреса:</b> Дрогобич, Газова 7\n\n` +
    `До зустрічі в ДІМ КЕРАТИНУ! ✨\n` +
    `Якщо потрібно перенести — напишіть нам: @${BOT_USERNAME}`;

  try {
    const getChat = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: `@${username}` })
    });
    const chatData = await getChat.json();
    if (!chatData.ok) return;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatData.result.id, text, parse_mode: 'HTML' })
    });
  } catch (err) {
    console.error('Помилка сповіщення клієнта:', err);
  }
}

// ─────────────────────────────────────────────
//  BOOKING FORM — SUBMIT
// ─────────────────────────────────────────────
const bookingForm    = document.getElementById('booking-form');
const bookingSuccess = document.getElementById('booking-success');
const bookingBtn     = document.getElementById('booking-btn');

if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormError();

    const name     = document.getElementById('b-name').value.trim();
    const phone    = document.getElementById('b-phone').value.trim();
    const telegram = document.getElementById('b-telegram').value.trim();
    const service  = document.getElementById('b-service').value;
    const date     = document.getElementById('b-date').value;
    const time     = document.getElementById('b-time').value;
    const message  = document.getElementById('b-message').value.trim();

    if (!name || !phone || !service || !date || !time) {
      showFormError('Будь ласка, заповніть всі поля зі зірочкою (*)');
      return;
    }

    bookingBtn.textContent = 'Надсилаємо...';
    bookingBtn.disabled    = true;

    const data = { name, phone, telegram, service, date, time, message };

    // Паралельно: Telegram + Google Sheets
    await Promise.all([
      notifyStaff(data),
      notifyClient(data),
      saveToSheets(data)
    ]);

    fillSuccessScreen(data);
    document.getElementById('bmodal-form-wrap').style.display = 'none';
    bookingSuccess.style.display = 'flex';
  });
}

function fillSuccessScreen(data) {
  const dateObj = new Date(data.date + 'T12:00:00');
  const dateStr = dateObj.toLocaleDateString('uk-UA', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  document.getElementById('success-service').textContent = data.service;
  document.getElementById('success-date').textContent    = dateStr;
  document.getElementById('success-time').textContent    = data.time;

  const tgNote = document.getElementById('success-tg-note');
  if (data.telegram && BOT_TOKEN !== 'ВАШ_ТОКЕН_БОТ') {
    tgNote.style.display = 'block';
  } else {
    tgNote.style.display = 'none';
  }

  const tgLink = document.getElementById('success-tg-link');
  if (tgLink) tgLink.href = `https://t.me/${BOT_USERNAME}`;
}

window.resetBookingForm = function () {
  bookingForm.reset();
  if (fpInstance) fpInstance.clear();
  document.getElementById('bmodal-form-wrap').style.display = 'block';
  bookingSuccess.style.display = 'none';
  bookingBtn.textContent       = 'Записатись →';
  bookingBtn.disabled          = false;
  document.getElementById('b-time').innerHTML =
    '<option value="" disabled selected>Спочатку оберіть дату...</option>';
};

function showFormError(msg) {
  let err = document.getElementById('form-error');
  if (!err) {
    err = document.createElement('p');
    err.id = 'form-error';
    err.style.cssText =
      'color:#c0392b;font-size:0.85rem;margin-bottom:1rem;' +
      'padding:0.6rem 1rem;background:#fdf0f0;border-radius:8px;';
    bookingForm.prepend(err);
  }
  err.textContent   = msg;
  err.style.display = 'block';
}

function clearFormError() {
  const err = document.getElementById('form-error');
  if (err) err.style.display = 'none';
}
