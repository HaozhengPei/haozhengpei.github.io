(() => {
  const links = Array.from(document.querySelectorAll('a[data-photo]'));
  if (!links.length || !('HTMLDialogElement' in window)) return;
  const zh = document.documentElement.lang.startsWith('zh');
  const dialog = document.createElement('dialog');
  dialog.className = 'photo-viewer';
  dialog.setAttribute('aria-label', zh ? '照片浏览' : 'Photo viewer');
  dialog.innerHTML = '<span class="photo-count" aria-live="polite"></span><button class="photo-close" type="button">×</button><button class="photo-prev" type="button">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="photo-next" type="button">›</button>';
  const close = dialog.querySelector('.photo-close');
  const previous = dialog.querySelector('.photo-prev');
  const next = dialog.querySelector('.photo-next');
  close.setAttribute('aria-label', zh ? '关闭照片' : 'Close photo');
  previous.setAttribute('aria-label', zh ? '上一张' : 'Previous photo');
  next.setAttribute('aria-label', zh ? '下一张' : 'Next photo');
  const img = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  const count = dialog.querySelector('.photo-count');
  let index = 0, opener;
  const show = (value) => {
    index = (value + links.length) % links.length;
    const link = links[index];
    img.src = link.href;
    img.alt = link.querySelector('img')?.alt || '';
    caption.textContent = link.dataset.caption || img.alt;
    count.textContent = `${index + 1} / ${links.length}`;
  };
  links.forEach((link, position) => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    show(position);
    document.body.classList.add('photo-viewer-open');
    dialog.showModal();
    close.focus();
  }));
  close.addEventListener('click', () => dialog.close());
  previous.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('photo-viewer-open');
    opener?.focus({preventScroll:true});
  });
  document.body.append(dialog);
})();
