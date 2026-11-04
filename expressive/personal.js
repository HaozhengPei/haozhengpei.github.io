(() => {
  'use strict';
  const selector = document.querySelector('.hobby-selector');
  if (!selector) return;
  const buttons = Array.from(selector.querySelectorAll('button[data-hobby]'));
  const scenes = Array.from(document.querySelectorAll('.hobby-scene'));
  const select = button => {
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    scenes.forEach(scene => { scene.hidden = scene.id !== button.getAttribute('aria-controls'); });
    document.querySelector('.hobby-count').textContent = button.dataset.hobby;
  };
  buttons.forEach(button => button.addEventListener('click', () => select(button)));
  selector.addEventListener('keydown', event => {
    const current = buttons.indexOf(document.activeElement);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus(); select(buttons[next]);
  });
  select(buttons[0]); selector.hidden = false;
})();
