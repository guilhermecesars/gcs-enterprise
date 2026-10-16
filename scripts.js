/* GCs Enterprise — v2 "Signal". Vanilla JS, no dependencies. */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pointer = { x: -9999, y: -9999, active: false };

  /* ---------- nav ---------- */
  function initNav() {
    const toggle = $('#navToggle');
    const nav = $('#mainNav');
    const header = $('.site-header');
    if (header) {
      const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    if (!toggle || !nav) return;
    const close = () => {
      nav.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('a', nav).forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && close());

    // active link by section
    const links = $$('a[href^="#"], a[href^="index.html#"]', nav);
    const map = links
      .map((a) => ({ a, el: document.getElementById(a.getAttribute('href').split('#')[1] || '') }))
      .filter((x) => x.el);
    if (map.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            const m = map.find((x) => x.el === e.target);
            if (m) m.a.classList.toggle('is-active', e.isIntersecting);
          }),
        { rootMargin: '-45% 0px -50% 0px' }
      );
      map.forEach((m) => io.observe(m.el));
    }
  }

  /* ---------- scroll progress + reveal + counters ---------- */
  function initScroll() {
    const bar = $('.progress');
    const steps = $('.steps');
    const update = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${h > 0 ? clamp(scrollY / h, 0, 1) : 0})`;
      if (steps) {
        const r = steps.getBoundingClientRect();
        steps.style.setProperty('--p', clamp((innerHeight * 0.7 - r.top) / r.height, 0, 1).toFixed(3));
      }
    };
    update();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);

    const targets = $$('.reveal');
    if (!('IntersectionObserver' in window)) return targets.forEach((t) => t.classList.add('is-visible'));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
          if (e.target.dataset.count !== undefined) countUp(e.target);
          $$('[data-count]', e.target).forEach(countUp);
        }),
      { threshold: 0.18 }
    );
    targets.forEach((t) => io.observe(t));
  }

  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const end = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const render = (v) => (el.innerHTML = `${prefix}${Math.round(v)}${suffix ? `<em>${suffix}</em>` : ''}`);
    if (reduce) return render(end);
    const t0 = performance.now();
    const dur = 1600;
    (function tick(now) {
      const p = clamp((now - t0) / dur, 0, 1);
      render(end * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------- cursor + magnetic + tilt + spotlight ---------- */
  function initPointer() {
    addEventListener('pointermove', (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    }, { passive: true });
    document.addEventListener('pointerleave', () => (pointer.active = false));

    if (finePointer && !reduce) {
      document.documentElement.classList.add('has-cursor');
      const ring = $('.cursor-ring');
      const dot = $('.cursor-dot');
      if (ring && dot) {
        let rx = 0, ry = 0;
        (function loop() {
          rx += (pointer.x - rx) * 0.18;
          ry += (pointer.y - ry) * 0.18;
          ring.style.transform = `translate(${rx}px,${ry}px)`;
          dot.style.transform = `translate(${pointer.x}px,${pointer.y}px)`;
          requestAnimationFrame(loop);
        })();
        document.addEventListener('pointerover', (e) => {
          ring.classList.toggle('is-hover', !!e.target.closest('a, button, .shot, .carousel-slide, [data-tilt]'));
        });
      }

      // magnetic buttons
      $$('.btn-primary, .btn-secondary, .case-cta, .nav-cta, .magnetic').forEach((b) => {
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect();
          const x = (e.clientX - r.left - r.width / 2) * 0.28;
          const y = (e.clientY - r.top - r.height / 2) * 0.38;
          b.style.transform = `translate(${x}px, ${y}px)`;
        });
        b.addEventListener('pointerleave', () => (b.style.transform = ''));
      });

      // 3D tilt
      $$('[data-tilt]').forEach((el) => {
        const max = parseFloat(el.dataset.tilt) || 8;
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = `rotateY(${px * max}deg) rotateX(${-py * max}deg)`;
        });
        el.addEventListener('pointerleave', () => (el.style.transform = ''));
      });
    }

    // spotlight on cards
    $$('.project-card, .stat').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--x', `${e.clientX - r.left}px`);
        card.style.setProperty('--y', `${e.clientY - r.top}px`);
      });
    });

    // hero phone follows mouse
    const phone = $('.phone-mockup');
    const hero = $('.hero');
    if (phone && hero && finePointer && !reduce) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        phone.style.transform = `rotateY(${-6 + px * 12}deg) rotateX(${3 - py * 8}deg)`;
      });
      phone.style.transform = 'rotateY(-6deg) rotateX(3deg)';
    }
  }

  /* ---------- particle network background ---------- */
  function initParticles() {
    const canvas = $('#fx');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, dpr, pts = [];
    let visible = true;
    const small = () => innerWidth < 700;

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 1.75);
      w = canvas.width = Math.floor(innerWidth * dpr);
      h = canvas.height = Math.floor(innerHeight * dpr);
      const n = Math.round(clamp((innerWidth * innerHeight) / 17000, 28, small() ? 42 : 90));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35 * dpr,
        vy: (Math.random() - 0.5) * 0.35 * dpr,
        r: (Math.random() * 1.4 + 0.6) * dpr,
      }));
    }

    function frame() {
      if (!visible) return requestAnimationFrame(frame);
      ctx.clearRect(0, 0, w, h);
      const link = (small() ? 110 : 150) * dpr;
      const mx = pointer.x * dpr, my = pointer.y * dpr;
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        if (pointer.active) {
          const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
          if (d < 180 * dpr && d > 0) { p.x += (dx / d) * 1.4 * dpr * (1 - d / (180 * dpr)); p.y += (dy / d) * 1.4 * dpr * (1 - d / (180 * dpr)); }
        }
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < link) {
            ctx.strokeStyle = `rgba(25,230,162,${(1 - d / link) * 0.22})`;
            ctx.lineWidth = dpr * 0.8;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (pointer.active) {
          const d = Math.hypot(a.x - mx, a.y - my);
          if (d < 200 * dpr) {
            ctx.strokeStyle = `rgba(34,211,238,${(1 - d / (200 * dpr)) * 0.55})`;
            ctx.lineWidth = dpr;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(120,255,214,0.75)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    resize();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => (visible = !document.hidden));
    if (reduce) { // single static frame
      ctx.fillStyle = 'rgba(120,255,214,0.5)';
      pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); });
      return;
    }
    requestAnimationFrame(frame);
  }

  /* ---------- word rotator ---------- */
  function initRotator() {
    const el = $('.rotator');
    if (!el) return;
    const words = (el.dataset.words || '').split('|').filter(Boolean);
    if (words.length < 2 || reduce) return;
    let wi = 0, ci = words[0].length, dir = -1;
    el.textContent = words[0];
    setTimeout(function tick() {
      const word = words[wi];
      ci += dir;
      el.textContent = word.slice(0, ci);
      let delay = dir < 0 ? 45 : 85;
      if (dir < 0 && ci <= 0) { dir = 1; wi = (wi + 1) % words.length; delay = 260; }
      else if (dir > 0 && ci >= words[wi].length) { dir = -1; delay = 1900; }
      setTimeout(tick, delay);
    }, 2600);
  }

  /* ---------- hero chat loop ---------- */
  function initChat() {
    const chat = $('.phone-chat');
    if (!chat) return;
    const script = [
      ['in', 'Oi! Vi o cardápio, queria pedir 2 marmitas P'],
      ['out', 'Show! 2 marmitas P registradas ✅ Vai querer bebida também?'],
      ['in', 'Vou querer 1 refri lata'],
      ['out', 'Pedido fechado 🎉 Total: R$ 38,00 — pagamento na entrega. Já mandei pra cozinha!'],
    ];
    if (reduce) return;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const add = (type, text) => {
      const d = document.createElement('div');
      d.className = `chat-bubble chat-${type}`;
      d.textContent = text;
      chat.appendChild(d);
      while (chat.children.length > 5) chat.removeChild(chat.firstChild);
      return d;
    };
    const typing = () => {
      const t = document.createElement('div');
      t.className = 'chat-typing';
      t.innerHTML = '<span></span><span></span><span></span>';
      chat.appendChild(t);
      return t;
    };
    (async function loop() {
      chat.innerHTML = '';
      await wait(900);
      for (const [type, text] of script) {
        if (type === 'out') { const t = typing(); await wait(1100); t.remove(); }
        else await wait(700);
        add(type, text);
        await wait(type === 'out' ? 1500 : 600);
      }
      await wait(4200);
      loop();
    })();
  }

  /* ---------- marquee (auto, scroll-boosted, draggable) ---------- */
  function initMarquees() {
    $$('.marquee').forEach((m) => {
      const track = $('.marquee-track', m);
      const group = $('.marquee-group', m);
      if (!track || !group) return;
      if (reduce) { m.style.overflowX = 'auto'; return; }
      // clone group enough times to fill width * 2
      const clones = [];
      const need = Math.max(2, Math.ceil((innerWidth * 2) / Math.max(group.offsetWidth, 1)) + 1);
      for (let i = 0; i < need; i++) {
        const c = group.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        $$('img', c).forEach((img) => (img.loading = 'eager'));
        track.appendChild(c);
        clones.push(c);
      }
      const dir = m.dataset.dir === 'right' ? 1 : -1;
      const base = parseFloat(m.dataset.speed || '0.6');
      let x = 0, vel = 0, dragging = false, lastX = 0, lastScroll = scrollY, hover = false, onscreen = true;
      const gw = () => group.offsetWidth;

      if ('IntersectionObserver' in window) new IntersectionObserver((es) => (onscreen = es[0].isIntersecting)).observe(m);

      m.addEventListener('pointerenter', () => (hover = true));
      m.addEventListener('pointerleave', () => (hover = false));
      if (m.dataset.drag !== undefined) {
        let down = false, startX = 0, moved = false;
        m.addEventListener('pointerdown', (e) => {
          down = true; moved = false; startX = lastX = e.clientX; vel = 0;
        });
        m.addEventListener('pointermove', (e) => {
          if (!down) return;
          if (!dragging && Math.abs(e.clientX - startX) > 6) {
            dragging = true; moved = true;
            m.classList.add('dragging');
            m.setPointerCapture?.(e.pointerId);
          }
          if (!dragging) return;
          const dx = e.clientX - lastX; lastX = e.clientX;
          x += dx; vel = dx;
        });
        const end = () => {
          down = false; dragging = false; m.classList.remove('dragging');
          if (moved) { m.classList.add('moved'); setTimeout(() => m.classList.remove('moved'), 60); }
        };
        m.addEventListener('pointerup', end);
        m.addEventListener('pointercancel', end);
      }

      (function loop() {
        if (onscreen && !document.hidden) {
          const sv = scrollY - lastScroll; lastScroll = scrollY;
          if (!dragging) {
            const speed = (hover && m.dataset.drag !== undefined ? base * 0.25 : base) + Math.min(Math.abs(sv) * 0.12, 14) * 0.6;
            x += dir * speed + vel;
            vel *= 0.94;
            if (Math.abs(vel) < 0.01) vel = 0;
          }
          const w = gw();
          if (w > 0) { x = ((x % w) + w) % w - w; }
          track.style.transform = `translate3d(${x}px,0,0)`;
        } else lastScroll = scrollY;
        requestAnimationFrame(loop);
      })();
    });
  }

  /* ---------- lightbox + carousel ---------- */
  function initLightbox() {
    const imgs = $$('.shot img, .carousel-slide img');
    if (!imgs.length) return;
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Imagem ampliada');
    box.innerHTML = '<img alt="">';
    document.body.appendChild(box);
    const big = $('img', box);
    const open = (src, alt) => { big.src = src; big.alt = alt || ''; box.classList.add('open'); };
    document.addEventListener('click', (e) => {
      const img = e.target.closest('.shot img, .carousel-slide img, .shot, .carousel-slide');
      if (!img) return;
      const i = img.tagName === 'IMG' ? img : $('img', img);
      if (!i) return;
      if (e.target.closest('.shot-row.moved')) return;
      open(i.currentSrc || i.src, i.alt);
    });
    box.addEventListener('click', () => box.classList.remove('open'));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && box.classList.remove('open'));
  }

  function initCarousel() {
    $$('.carousel').forEach((carousel) => {
      const track = $('.carousel-track', carousel);
      const slides = Array.from(track.children);
      const prev = $('.carousel-prev', carousel);
      const next = $('.carousel-next', carousel);
      const dotsBox = $('.carousel-dots', carousel);
      const dots = slides.map((_, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        d.setAttribute('aria-label', `Ir para o slide ${i + 1}`);
        d.addEventListener('click', () => go(i));
        dotsBox.appendChild(d);
        return d;
      });
      const go = (i) => slides[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      const current = () => {
        const c = track.scrollLeft + track.clientWidth / 2;
        let best = 0, bd = Infinity;
        slides.forEach((s, i) => {
          const d = Math.abs(s.offsetLeft + s.clientWidth / 2 - c);
          if (d < bd) { bd = d; best = i; }
        });
        return best;
      };
      let tick = false;
      track.addEventListener('scroll', () => {
        if (tick) return; tick = true;
        requestAnimationFrame(() => { const c = current(); dots.forEach((d, i) => d.classList.toggle('active', i === c)); tick = false; });
      });
      prev.addEventListener('click', () => go(Math.max(0, current() - 1)));
      next.addEventListener('click', () => go(Math.min(slides.length - 1, current() + 1)));
    });
  }

  /* ---------- ROI calculator ---------- */
  function initRoi() {
    const box = $('.roi');
    if (!box) return;
    const g = (id) => $('#' + id, box);
    const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    const upd = () => {
      const ped = +g('r-ped').value, min = +g('r-min').value, hora = +g('r-hora').value, auto = +g('r-auto').value;
      const horas = Math.round((ped * min * 30 * (auto / 100)) / 60);
      const valor = horas * hora;
      g('v-ped').textContent = ped; g('v-min').textContent = min + ' min';
      g('v-hora').textContent = brl(hora); g('v-auto').textContent = auto + '%';
      g('o-horas').textContent = horas; g('o-valor').textContent = brl(valor);
      const msg = `Oi! Usei a calculadora do site: ${ped} atendimentos/dia, ${min} min cada. Estimei ~${horas}h/mês (${brl(valor)}) que um bot poderia devolver. Quero conversar sobre automatizar o meu atendimento.`;
      g('roi-cta').href = 'https://wa.me/5515996978189?text=' + encodeURIComponent(msg);
    };
    $$('input', box).forEach((i) => i.addEventListener('input', upd));
    upd();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initRoi();
    initNav();
    initScroll();
    initPointer();
    initParticles();
    initRotator();
    initChat();
    initCarousel();
    initLightbox();
    // wait for images so the marquee measures real widths
    const run = () => initMarquees();
    if (document.readyState === 'complete') run(); else addEventListener('load', run);
  });
})();
