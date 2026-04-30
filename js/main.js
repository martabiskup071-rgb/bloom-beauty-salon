// Scroll reveal
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('nav ul');

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

// Set minimum date on booking forms to today
const today = new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(el => { el.min = today; });

// ── BOOKING MODAL ──
const modalOverlay = document.getElementById('booking-modal');
const modalForm    = document.getElementById('modal-form');
const modalClose   = document.querySelector('.modal-close');
let lastFocused    = null;

function openModal() {
  lastFocused = document.activeElement;
  modalOverlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('modal-name').focus(), 50);
}

function closeModal() {
  modalOverlay.classList.remove('is-open');
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}

// Open on every "Book" trigger
document.querySelectorAll('.js-book-modal').forEach(btn => {
  btn.addEventListener('click', e => { e.preventDefault(); openModal(); });
});

// Close via X, overlay click, or Escape
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('is-open')) closeModal();
});

// Modal form submit
modalForm.addEventListener('submit', e => {
  e.preventDefault();
  const btn = modalForm.querySelector('.form-submit');
  const original = btn.textContent;
  btn.textContent = '✓ Booking Confirmed!';
  btn.style.background = '#5a9e6f';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
    modalForm.reset();
    closeModal();
  }, 2500);
});

// Contact section form submit
const contactForm = document.querySelector('#contact form');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const btn = contactForm.querySelector('.form-submit');
    const original = btn.textContent;
    btn.textContent = '✓ Booking Request Sent!';
    btn.style.background = '#5a9e6f';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '';
      contactForm.reset();
    }, 3000);
  });
}
