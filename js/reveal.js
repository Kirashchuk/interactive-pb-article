/** Скрол-ефекти: плавна поява секцій та індикатор прогресу читання. */

export function initReveal() {
  const items = document.querySelectorAll('.reveal');
  // Без IntersectionObserver залишаємо контент видимим (js-reveal не вмикаємо).
  if (!('IntersectionObserver' in window)) return;

  // Приховування вмикається лише тепер, коли ми впевнені, що зможемо розкрити.
  document.documentElement.classList.add('js-reveal');

  // threshold: 0 — розкриваємо, щойно будь-яка частина елемента входить у в'юпорт.
  // (Поріг 0.12 недосяжний для дуже високих секцій — вони ніколи б не з'явилися.)
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
  items.forEach((el) => io.observe(el));

  // Запобіжник: якщо через ~2,5 с елемент усе ще не розкрито, а він уже в зоні
  // видимості або вище — розкриваємо примусово (щоб контент не лишався прихованим).
  setTimeout(() => {
    for (const el of items) {
      if (el.classList.contains('visible')) continue;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) el.classList.add('visible');
    }
  }, 2500);
}

export function initProgress() {
  const bar = document.getElementById('progress');
  const update = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = max > 0 ? `${(100 * h.scrollTop) / max}%` : '0%';
  };
  document.addEventListener('scroll', update, { passive: true });
  update();
}
