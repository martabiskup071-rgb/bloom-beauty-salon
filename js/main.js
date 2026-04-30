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

// Set minimum date on booking form to today
const dateInput = document.getElementById('date');
if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

// Booking form submit
document.querySelector('form').addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('.form-submit');
  const original = btn.textContent;
  btn.textContent = '✓ Booking Request Sent!';
  btn.style.background = '#5a9e6f';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
    e.target.reset();
  }, 3000);
});
