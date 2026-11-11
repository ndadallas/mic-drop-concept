// Bords déchirés : un contour unique par découpe, généré une fois.
function tornPolygon(steps, amp) {
  const r = () => (Math.random() * amp).toFixed(2);
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(`${(i / steps) * 100}% ${r()}%`);
  for (let i = 0; i <= steps; i++) pts.push(`${100 - r()}% ${(i / steps) * 100}%`);
  for (let i = steps; i >= 0; i--) pts.push(`${(i / steps) * 100}% ${100 - r()}%`);
  for (let i = steps; i >= 0; i--) pts.push(`${r()}% ${(i / steps) * 100}%`);
  return `polygon(${pts.join(',')})`;
}
document.querySelectorAll('.cut, .sticker').forEach(el => {
  const s = el.classList.contains('sticker');
  el.style.clipPath = tornPolygon(s ? 8 : 18, s ? 4 : 1.4);
  if (el.dataset.tilt) el.style.setProperty('--tilt', el.dataset.tilt + 'deg');
  // l'ombre va sur un parent : clip-path rognerait un drop-shadow posé sur l'élément lui-même
  // (pas pour les stickers : positionnés en absolu, un parent filtré casserait leur placement)
  if (s) return;
  const w = document.createElement('div');
  w.className = 'shadow';
  el.replaceWith(w);
  w.appendChild(el);
});

// Vidéos du programme : ne tournent que visibles.
const vidIO = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause()), { threshold: .3 });
document.querySelectorAll('.prog video').forEach(v => vidIO.observe(v));

// Décrocher = allumer la TV.
const phone = document.getElementById('phone');
const tv = document.getElementById('tv');
const frame = document.getElementById('tvFrame');
const VIMEO = 'https://player.vimeo.com/video/1146238177?autoplay=1&title=0&byline=0&portrait=0';
function openTV() {
  phone.classList.add('is-off');
  frame.src = VIMEO;
  tv.hidden = false;
  document.getElementById('tvClose').focus();
}
function closeTV() {
  tv.hidden = true;
  frame.src = ''; // coupe le son
  phone.classList.remove('is-off');
  phone.focus();
}
phone.addEventListener('click', openTV);
document.getElementById('tvClose').addEventListener('click', closeTV);
tv.addEventListener('click', e => { if (e.target === tv) closeTV(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !tv.hidden) closeTV(); });

// Générique : les crédits montent avec le scroll.
const credits = document.querySelector('.credits');
const roll = document.querySelector('.credits__roll');
function onScroll() {
  const r = credits.getBoundingClientRect();
  // progression pendant que le bloc traverse l'écran (plus de section collante : bloc plus court)
  const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
  roll.style.setProperty('--roll', `${(0.5 - p) * 24}vh`);
  document.body.classList.toggle('bar-dark', r.top <= 40 && r.bottom >= 40);
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Fin : le micro tombe une fois.
const end = document.getElementById('end');
new IntersectionObserver((es, io) => {
  if (es[0].isIntersecting) { end.classList.add('is-dropped'); io.disconnect(); }
}, { threshold: .5 }).observe(end);
