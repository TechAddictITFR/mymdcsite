// Calvin — landing page 3D pilotée par la vidéo
// Effets extraits par tools/extract_video_effects.sh : images, cartes de relief, couleurs ciel/sujet.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 225;
const FRAME_SPEED = 2.0;           // la vidéo se termine vers 50 % du défilement
const VIDEO_ASPECT = 360 / 640;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width: 767px)').matches;

const $ = (s) => document.querySelector(s);
const pad = (i) => String(i + 1).padStart(4, '0');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

const frames = [];
const depths = [];
let skyColors = [];
let coreColors = [];
let currentFrame = 0;
let progress = 0;

/* ---------- Couleurs ---------- */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function lighten(h, k) {
  const [r, g, b] = hexToRgb(h).map((c) => Math.round(c + (255 - c) * k));
  return `rgb(${r} ${g} ${b})`;
}
function applyColors(i) {
  const root = document.documentElement.style;
  if (skyColors[i]) root.setProperty('--sky', skyColors[i]);
  if (coreColors[i]) root.setProperty('--accent', lighten(coreColors[i], 0.4));
}

/* ---------- Préchargement ---------- */
const loadImg = (src) => new Promise((res) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = src;
});

async function preload(onFirst) {
  const bar = $('#loader-bar');
  const pct = $('#loader-percent');
  const total = FRAME_COUNT * 2;
  let done = 0;
  const tick = () => {
    done++;
    const p = done / total;
    bar.style.transform = `scaleX(${p})`;
    pct.textContent = `${Math.round(p * 100)} %`;
  };
  const load = (i) => Promise.all([
    loadImg(`frames/frame_${pad(i)}.jpg`).then((im) => { frames[i] = im; tick(); }),
    loadImg(`frames/depth_${pad(i)}.jpg`).then((im) => { depths[i] = im; tick(); }),
  ]);
  const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);

  [skyColors, coreColors] = await Promise.all([
    fetch('frames/sky.json').then((r) => r.json()).catch(() => []),
    fetch('frames/core.json').then((r) => r.json()).catch(() => []),
  ]);
  await Promise.all(range(0, 10).map(load));     // phase 1 : premier affichage rapide
  onFirst();
  await Promise.all(range(10, FRAME_COUNT).map(load)); // phase 2 : le reste
}

/* ---------- Scène 3D (Three.js) ---------- */
const VERT = /* glsl */`
  uniform sampler2D uDepth;
  uniform float uAmp;
  varying vec2 vUv;
  varying float vD;
  void main() {
    vUv = uv;
    float d = texture2D(uDepth, uv).r;
    vec2 c = (uv - 0.5) * vec2(1.6, 1.0);
    float mask = 1.0 - smoothstep(0.15, 0.8, length(c));
    float disp = (d * 0.6 + mask * 0.4) * uAmp - uAmp * 0.35;
    vD = d;
    vec3 p = position;
    p.z += disp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FRAG = /* glsl */`
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vD;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    float edge = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x)
               * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
    vec3 col = c.rgb * (0.88 + vD * 0.2);
    gl_FragColor = vec4(col, edge);
  }`;

function createScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  const planeH = 2;
  const geo = new THREE.PlaneGeometry(planeH * VIDEO_ASPECT, planeH, 160, 280);

  const makeTex = (img) => {
    const t = new THREE.Texture(img);
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  const mapTex = makeTex(frames[0]);
  const depthTex = makeTex(depths[0]);
  const uniforms = { uMap: { value: mapTex }, uDepth: { value: depthTex }, uAmp: { value: 0.22 } };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
  }));
  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);

  let baseZ = 4;
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const fill = isMobile() ? 0.98 : 0.8;   // part de la hauteur occupée par la vidéo
    baseZ = planeH / fill / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  };
  resize();
  addEventListener('resize', resize);

  // Parallaxe souris, discrète
  const mouse = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  if (!reduceMotion) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX / innerWidth - 0.5;
      mouse.y = e.clientY / innerHeight - 0.5;
    });
  }

  let shown = -1;
  function render() {
    if (shown !== currentFrame && frames[currentFrame] && depths[currentFrame]) {
      mapTex.image = frames[currentFrame]; mapTex.needsUpdate = true;
      depthTex.image = depths[currentFrame]; depthTex.needsUpdate = true;
      shown = currentFrame;
    }
    // Trajectoire : vue de trois quarts pendant la fusion, puis face au bloc unique
    const t = ease(clamp(progress * FRAME_SPEED));
    const swell = Math.sin(Math.PI * t);
    smooth.x = lerp(smooth.x, mouse.x, 0.06);
    smooth.y = lerp(smooth.y, mouse.y, 0.06);
    group.rotation.y = lerp(0.62, 0, t) + smooth.x * 0.18;
    group.rotation.x = lerp(-0.2, 0, t) + smooth.y * 0.1;
    uniforms.uAmp.value = 0.32 + 0.22 * swell;
    camera.position.z = baseZ * (1 - 0.1 * swell);
    renderer.render(scene, camera);
  }
  return { render };
}

/* Repli 2D si WebGL est indisponible (méthode du skill : cover rembourré) */
function createFallback(canvas) {
  const ctx = canvas.getContext('2d');
  const resize = () => {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
  };
  resize();
  addEventListener('resize', resize);
  return {
    render() {
      const img = frames[currentFrame];
      if (!img) return;
      const cw = canvas.width, ch = canvas.height;
      const s = (ch / img.naturalHeight) * (isMobile() ? 0.98 : 0.8);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    },
  };
}

/* ---------- Défilement ---------- */
function initLenis() {
  if (reduceMotion) return null;
  const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = $(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    });
  });
  return lenis;
}

function buildTimeline(section, children) {
  const tl = gsap.timeline({ paused: true });
  const base = { opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' };
  switch (section.dataset.animation) {
    case 'slide-left':  tl.from(children, { ...base, x: -70 }); break;
    case 'slide-right': tl.from(children, { ...base, x: 70 }); break;
    case 'scale-up':    tl.from(children, { ...base, scale: 0.92, ease: 'power2.out', duration: 1 }); break;
    case 'stagger-up':  tl.from(children, { ...base, y: 50, stagger: 0.15, duration: 0.8 }); break;
    case 'clip-reveal': tl.from(children, { ...base, clipPath: 'inset(100% 0 0 0)', y: 20, stagger: 0.14, duration: 1.1, ease: 'power4.inOut' }); break;
    default:            tl.from(children, { ...base, y: 40 });
  }
  return tl;
}

function runCounters(section, play) {
  section.querySelectorAll('.stat-number').forEach((el) => {
    const target = parseFloat(el.dataset.value);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const fmt = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    gsap.killTweensOf(el);
    if (!play) { el.textContent = fmt(0); return; }
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const o = { v: 0 };
    gsap.to(o, { v: target, duration: 1.8, ease: 'power1.out', onUpdate: () => { el.textContent = fmt(o.v); } });
  });
}

function initSections() {
  const sections = [...document.querySelectorAll('.scroll-section')];
  return sections.map((section) => {
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;
    const persist = section.dataset.persist === 'true';
    // Le bloc final est placé en bas pour rester visible en fin de page
    const mid = persist ? 1 : (enter + leave) / 2;
    section.style.setProperty('--mid', mid);
    const children = section.querySelectorAll('.section-label, .section-heading, .section-body, .section-note, .cta-row, .stat');
    const tl = reduceMotion ? null : buildTimeline(section, children);
    let active = false;
    return (p) => {
      const inRange = p >= enter && (persist || p <= leave);
      if (inRange === active) return;
      active = inRange;
      section.classList.toggle('is-active', inRange);
      if (tl) inRange ? tl.play() : tl.reverse();
      if (section.classList.contains('section-stats')) runCounters(section, inRange);
    };
  });
}

function rangeOpacity(p, enter, leave, max, fade = 0.04) {
  if (p < enter - fade || p > leave + fade) return 0;
  if (p < enter) return max * (p - (enter - fade)) / fade;
  if (p > leave) return max * (1 - (p - leave) / fade);
  return max;
}

function initScroll(view) {
  const container = $('#scroll-container');
  const overlay = $('#dark-overlay');
  const marquee = $('.marquee-wrap');
  const marqueeText = $('.marquee-text');
  const sectionUpdaters = initSections();
  const sceneWrap = $('.scene-wrap');
  const heroFade = document.querySelectorAll('.hero-inner, .scroll-hint');

  // Révélation circulaire de la scène pendant que l'accueil s'en va
  ScrollTrigger.create({
    trigger: '.hero-standalone', start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (self) => {
      const w = clamp(self.progress / 0.9);
      sceneWrap.style.clipPath = w >= 1 ? 'none' : `circle(${(w * 75).toFixed(2)}% at 50% 50%)`;
      heroFade.forEach((el) => { el.style.opacity = String(1 - clamp(self.progress * 1.6)); });
    },
  });

  ScrollTrigger.create({
    trigger: container, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (self) => {
      progress = self.progress;
      const idx = Math.min(Math.floor(clamp(progress * FRAME_SPEED) * FRAME_COUNT), FRAME_COUNT - 1);
      if (idx !== currentFrame) { currentFrame = idx; applyColors(idx); }
      overlay.style.opacity = rangeOpacity(progress, 0.47, 0.61, 0.9);
      marquee.style.opacity = rangeOpacity(progress, 0.24, 0.44, 1, 0.05);
      sectionUpdaters.forEach((u) => u(progress));
    },
  });

  if (!reduceMotion) {
    gsap.to(marqueeText, {
      xPercent: parseFloat(marquee.dataset.scrollSpeed) || -25, ease: 'none',
      scrollTrigger: { trigger: container, start: 'top top', end: 'bottom bottom', scrub: true },
    });
  }

  gsap.ticker.add(view.render);
}

function introHero() {
  if (reduceMotion) return;
  gsap.timeline()
    .from('.hero-standalone .section-label', { y: 16, opacity: 0, duration: 0.7, ease: 'power3.out' })
    .from('.hero-heading .word', { y: 48, opacity: 0, stagger: 0.08, duration: 1, ease: 'power3.out' }, '-=0.4')
    .from('.hero-tagline, .scroll-hint', { y: 16, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out' }, '-=0.6');
}

/* ---------- Démarrage ---------- */
(async () => {
  initLenis();
  const canvas = $('#scene');
  let view;
  await preload(() => {
    view = createScene(canvas) || createFallback(canvas);
    applyColors(0);
    view.render();
  });
  initScroll(view);
  ScrollTrigger.refresh();
  $('#loader').classList.add('is-done');
  introHero();
})();
