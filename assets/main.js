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

// Fin : le micro tombe (gravité + rebonds), percute « MIC DROP. » et s'y couche.
const end = document.getElementById('end');
const stage = document.getElementById('endStage');
const mic = document.getElementById('mic');
const word = document.getElementById('endWord');
const wave = document.getElementById('endWave');
word.innerHTML = [...word.textContent].map(c => c === ' ' ? ' ' : `<span>${c}</span>`).join('');
const letters = [...word.querySelectorAll('span')];

function dropMic() {
  const s = stage.getBoundingClientRect(), w = word.getBoundingClientRect();
  const mw = mic.getBoundingClientRect().width, mh = mw * 2.6; // viewBox 100x260
  // repère : centre du micro, dans le stage
  const groundY = w.top - s.top - mw * 0.28; // couché, son épaisseur repose sur le haut des lettres
  const centerX = w.left - s.left + w.width * 0.55;
  const place = (x, y, a) => { mic.style.transform = `translate(${x - mw / 2}px,${y - mh / 2}px) rotate(${a}deg)`; };
  mic.style.visibility = 'visible';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { place(centerX, groundY, 90); impact(centerX, 0.4); return; }

  let x = centerX + mw * 0.6, y = -s.top - mh, vx = -mw * 0.4, vy = 0, a = -28, va = 70, hits = 0, last = performance.now();
  const g = 3600; // px/s², une chute franche
  requestAnimationFrame(function step(now) {
    const dt = Math.min(0.032, (now - last) / 1000); last = now;
    vy += g * dt; y += vy * dt; x += vx * dt;
    if (hits === 0) a += va * dt; // tourne en tombant
    else { va += (90 - a) * 120 * dt; va *= Math.pow(0.02, dt); a += va * dt; vx *= Math.pow(0.08, dt); } // se couche à plat
    if (y >= groundY && vy > 0) {
      y = groundY;
      impact(x, Math.min(1, vy / 1800) * (hits ? 0.35 : 1));
      vy = -vy * (hits ? 0.25 : 0.32); // rebond amorti
      if (!hits) { va = (90 - a) * 6; vx = -mw * 1.3; }
      hits++;
      if (hits > 2 || Math.abs(vy) < 90) vy = 0;
    }
    place(x, y, a);
    const done = hits && vy === 0 && Math.abs(90 - a) < 0.3 && Math.abs(vx) < 2;
    if (done) place(x, groundY, 90); else requestAnimationFrame(step);
  });
}

// choc : les lettres s'enfoncent puis rebondissent (en onde depuis le point d'impact), onde au sol, BOUM
function impact(ix, force) {
  const s = stage.getBoundingClientRect();
  letters.forEach(l => {
    const r = l.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - s.left - ix);
    const k = force * Math.max(0, 1 - d / (s.width * 0.7));
    if (k < 0.05) return;
    const tilt = (Math.random() - 0.5) * 10 * k;
    l.animate([
      { transform: 'none' },
      { transform: `translateY(${14 * k}px) scale(${1 + 0.08 * k},${1 - 0.22 * k}) rotate(${tilt}deg)`, offset: 0.25 },
      { transform: `translateY(${-10 * k}px) rotate(${-tilt * 0.6}deg)`, offset: 0.6 },
      { transform: `translateY(${3 * k}px) rotate(${tilt * 0.3}deg)` }
    ], { duration: 650, delay: d * 0.9, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
  });
  if (force < 0.5) return;
  const w = word.getBoundingClientRect();
  Object.assign(wave.style, { left: ix + 'px', top: (w.top - s.top) + 'px' });
  wave.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(3.2,1.6)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.2,.8,.3,1)' });
  stage.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,4px)' }, { transform: 'translate(4px,-3px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'none' }], { duration: 380 });
  end.classList.add('is-hit');
}

new IntersectionObserver((es, io) => {
  if (es[0].isIntersecting) { io.disconnect(); dropMic(); }
}, { threshold: 0.6 }).observe(end);
