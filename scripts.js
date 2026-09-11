document.addEventListener('DOMContentLoaded', () => {
  const alvos = document.querySelectorAll('.reveal');
  if (alvos.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    alvos.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  alvos.forEach((el) => observer.observe(el));
});

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (!toggle || !nav) return;

  function fecharMenu() {
    nav.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    const aberto = nav.classList.toggle('open');
    toggle.classList.toggle('open', aberto);
    toggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', fecharMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharMenu();
  });

  document.addEventListener('click', (e) => {
    if (!nav.classList.contains('open')) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    fecharMenu();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.carousel').forEach((carousel) => {
    const track = carousel.querySelector('.carousel-track');
    const slides = Array.from(track.children);
    const prevBtn = carousel.querySelector('.carousel-prev');
    const nextBtn = carousel.querySelector('.carousel-next');
    const dotsContainer = carousel.querySelector('.carousel-dots');

    const dots = slides.map((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Ir para o slide ${i + 1}`);
      dot.addEventListener('click', () => irPara(i));
      dotsContainer.appendChild(dot);
      return dot;
    });

    function irPara(i) {
      slides[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    function slideAtual() {
      const centro = track.scrollLeft + track.clientWidth / 2;
      let atual = 0;
      let menorDistancia = Infinity;
      slides.forEach((slide, i) => {
        const distancia = Math.abs(slide.offsetLeft + slide.clientWidth / 2 - centro);
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          atual = i;
        }
      });
      return atual;
    }

    let ticking = false;
    track.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const atual = slideAtual();
        dots.forEach((dot, i) => dot.classList.toggle('active', i === atual));
        ticking = false;
      });
    });

    prevBtn.addEventListener('click', () => irPara(Math.max(0, slideAtual() - 1)));
    nextBtn.addEventListener('click', () => irPara(Math.min(slides.length - 1, slideAtual() + 1)));
  });
});
