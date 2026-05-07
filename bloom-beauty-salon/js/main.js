// ─────────────────────────────────────────────
//  УТИЛІТА: екранування HTML (захист від XSS)
// ─────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────
//  ПОСЛУГИ — ЗАВАНТАЖЕННЯ З GOOGLE SHEETS
// ─────────────────────────────────────────────
async function loadAndRenderServices() {
  if (typeof GOOGLE_SCRIPT_URL !== 'undefined' && GOOGLE_SCRIPT_URL !== 'ВАШ_APPS_SCRIPT_URL') {
    try {
      const res  = await fetch(`${GOOGLE_SCRIPT_URL}?action=getServices`);
      const json = await res.json();
      if (json.ok && json.services) {
        renderServices(json.services);
        return;
      }
    } catch { /* fallback to config.js */ }
  }
  renderServices(typeof SERVICES !== 'undefined' ? SERVICES : []);
}

function renderServices(servicesList) {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  const serviceSelect = document.getElementById('b-service');

  grid.innerHTML = '';
  if (serviceSelect) {
    serviceSelect.innerHTML = '<option value="" disabled selected>Обрати послугу...</option>';
  }

  servicesList.filter(s => s.active).forEach(service => {
    const card = document.createElement('div');
    card.className = 'service-card reveal';

    const icon = document.createElement('span');
    icon.className   = 'service-icon';
    icon.textContent = service.icon;

    const title = document.createElement('h3');
    title.className   = 'service-name';
    title.textContent = service.name;

    const desc = document.createElement('p');
    desc.className   = 'service-desc';
    desc.textContent = service.desc;

    const priceList = document.createElement('ul');
    priceList.className = 'price-list';
    (service.prices || []).forEach(p => {
      const li    = document.createElement('li');
      li.className = 'price-item';
      const lbl   = document.createElement('span');
      lbl.textContent = p.label;
      const val   = document.createElement('span');
      val.className   = 'price-amount';
      val.textContent = p.value;
      li.appendChild(lbl);
      li.appendChild(val);
      priceList.appendChild(li);
    });

    const cta = document.createElement('a');
    cta.href      = '#contact';
    cta.className = 'service-cta';
    cta.textContent = 'Записатись →';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(priceList);
    card.appendChild(cta);
    grid.appendChild(card);

    if (serviceSelect) {
      const opt       = document.createElement('option');
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

loadAndRenderServices();
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─────────────────────────────────────────────
//  BOOKING MODAL — ВІДКРИТИ / ЗАКРИТИ
// ─────────────────────────────────────────────
const bookingModal = document.getElementById('booking-modal');
let lastFocused    = null;

function openBookingModal() {
  lastFocused = document.activeElement;
  window._formOpenTime = Date.now(); // ← захист від ботів (timing check)
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
    const safeDate = encodeURIComponent(dateStr);
    const res      = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAvailableSlots&date=${safeDate}`);
    const json     = await res.json();
    return json.bookedTimes || [];
  } catch {
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

  const allSlots   = SCHEDULE.specialDays[dateStr] || SCHEDULE.timeSlots;
  const bookedTimes = await fetchBookedSlots(dateStr);
  const freeSlots  = allSlots.filter(t => !bookedTimes.includes(t));

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
//  ВАЛІДАЦІЯ ТЕЛЕФОНУ (клієнтська сторона)
// ─────────────────────────────────────────────
function isValidPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 13;
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
    // Honeypot — якщо заповнено, тихо відхилити
    const hp       = document.getElementById('b-hp')?.value || '';

    if (!name || !phone || !service || !date || !time) {
      showFormError('Будь ласка, заповніть всі поля зі зірочкою (*)');
      return;
    }

    if (!isValidPhone(phone)) {
      showFormError('Введіть коректний номер телефону');
      return;
    }

    bookingBtn.textContent = 'Надсилаємо...';
    bookingBtn.disabled    = true;

    try {
      const _ft = Math.round((Date.now() - (window._formOpenTime || 0)) / 1000);
      await fetch(GOOGLE_SCRIPT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body:    JSON.stringify({
          action: 'add',
          name, phone, telegram, service, date, time, message,
          _hp: hp, // honeypot (порожній у людей, заповнений у ботів)
          _ft      // час заповнення форми у секундах (< 3 = бот)
        })
      });
    } catch {
      // не блокуємо UX — запис міг зберегтись
    }

    fillSuccessScreen({ name, service, date, time, telegram });
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
  if (tgNote) tgNote.style.display = data.telegram ? 'block' : 'none';
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
