(() => {
      'use strict';
      document.documentElement.classList.add('js');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      const header = document.getElementById('fejlec');
      const toggle = document.querySelector('.menu-toggle');
      const menu = document.getElementById('mobil-menu');
      const desktop = window.matchMedia('(min-width: 861px)');
      function setMenu(open, restoreFocus = true) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Menü bezárása' : 'Menü megnyitása');
        menu.hidden = !open;
        menu.inert = !open;
        document.querySelector('.brand').inert = open;
        document.querySelector('.header-actions > .btn').inert = open;
        document.body.classList.toggle('menu-open', open);
        document.querySelector('main').inert = open;
        document.querySelector('footer').inert = open;
        if (open) menu.querySelector('a').focus();
        else if (restoreFocus) toggle.focus();
      }
      toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
      menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false, false)));
      document.addEventListener('keydown', e => {
        if (toggle.getAttribute('aria-expanded') !== 'true') return;
        if (e.key === 'Escape') { setMenu(false); return; }
        if (e.key === 'Tab') {
          const focusable = [toggle, ...menu.querySelectorAll('a')];
          const index = focusable.indexOf(document.activeElement);
          if (e.shiftKey && (index === 0 || index === -1)) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
          else if (!e.shiftKey && (index === focusable.length - 1 || index === -1)) { e.preventDefault(); toggle.focus(); }
        }
      });
      desktop.addEventListener('change', e => { if (e.matches) setMenu(false, false); });
      let scrollFrame = 0;
      function updateHeader() { header.classList.toggle('scrolled', window.scrollY > 24); scrollFrame = 0; }
      window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeader); }, { passive:true });
      updateHeader();

      if ('IntersectionObserver' in window && !reduced.matches) {
        const reveals = document.querySelectorAll('[data-reveal]');
        const revealObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
          });
        }, { threshold:0.07, rootMargin:'0px 0px -24px 0px' });
        reveals.forEach(el => revealObserver.observe(el));
        document.documentElement.classList.add('reveal-ready');

      }

      document.querySelectorAll('[data-package]').forEach(link => {
        link.addEventListener('click', () => {
          const message = document.getElementById('idopont-uzenet');
          const selection = `${link.dataset.package.startsWith('Anti') ? 'Az' : 'A'} ${link.dataset.package} érdekel.`;
          if (!message.value.trim() || message.dataset.prefilled === message.value) {
            message.value = selection;
            message.dataset.prefilled = selection;
          }
        });
      });

    })();
