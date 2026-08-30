/* ==========================================================================
   ZB Legal Solutions — site behaviour
   Progressive enhancement: every page works with JS disabled.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- Mobile navigation ---------- */
  function initNav() {
    var toggle = $('.nav__toggle');
    var links  = $('#nav-links');
    if (!toggle || !links) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      links.classList.toggle('is-open', open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open && window.innerWidth <= 1000 ? 'hidden' : '';
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1000) setOpen(false);
    });
  }

  /* ---------- Sticky header shadow ---------- */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('is-stuck', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------- Accordions (FAQ, practice areas) ---------- */
  function initAccordions() {
    $$('.acc__btn').forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;

      // Collapse on load unless explicitly opened in markup.
      var startOpen = btn.getAttribute('aria-expanded') === 'true';
      panel.style.height = startOpen ? 'auto' : '0px';

      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        var group  = btn.closest('.accordion');

        // Single-open behaviour within one accordion group.
        if (!isOpen && group) {
          $$('.acc__btn[aria-expanded="true"]', group).forEach(function (other) {
            var otherPanel = document.getElementById(other.getAttribute('aria-controls'));
            if (!otherPanel) return;
            other.setAttribute('aria-expanded', 'false');
            otherPanel.style.height = otherPanel.scrollHeight + 'px';
            otherPanel.offsetHeight; // force reflow so the transition runs
            otherPanel.style.height = '0px';
          });
        }

        btn.setAttribute('aria-expanded', String(!isOpen));

        if (isOpen) {
          panel.style.height = panel.scrollHeight + 'px';
          panel.offsetHeight;
          panel.style.height = '0px';
        } else {
          panel.style.height = panel.scrollHeight + 'px';
          if (reduceMotion) {
            panel.style.height = 'auto';
          } else {
            panel.addEventListener('transitionend', function done(e) {
              if (e.propertyName !== 'height') return;
              panel.removeEventListener('transitionend', done);
              if (btn.getAttribute('aria-expanded') === 'true') panel.style.height = 'auto';
            });
          }
        }
      });
    });
  }

  /* ---------- Animated statistics ---------- */
  function initCounters() {
    var counters = $$('[data-count-to]');
    if (!counters.length) return;

    function render(el, value) {
      var prefix = el.dataset.prefix || '';
      var suffix = el.dataset.suffix || '';
      el.textContent = prefix + Math.round(value).toLocaleString('en-IN') + suffix;
    }

    function run(el) {
      var target = parseFloat(el.dataset.countTo);
      if (isNaN(target)) return;
      if (reduceMotion) { render(el, target); return; }
      var duration = 1500, start = null;
      el.classList.add('is-counting');
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        render(el, target * (1 - Math.pow(1 - p, 3))); // easeOutCubic
        if (p < 1) {
          window.requestAnimationFrame(step);
        } else {
          // Settle with the back.out overshoot defined in motion.css
          el.classList.remove('is-counting');
          el.classList.add('is-done');
        }
      }
      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) { counters.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Contact / consultation form ---------- */
  function initForm() {
    var form = $('#consult-form');
    if (!form) return;

    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    // Indian mobile numbers, tolerant of +91 / 0 prefixes, spaces and dashes.
    var PHONE = /^(?:\+?91[\s-]?)?[6-9]\d{9}$/;

    function fieldOf(input) { return input.closest('.field') || input.closest('.check'); }

    function validate(input) {
      var value = (input.value || '').trim();
      var ok = true;

      if (input.hasAttribute('required')) {
        ok = input.type === 'checkbox' ? input.checked : value !== '';
      }
      if (ok && value && input.type === 'email') ok = EMAIL.test(value);
      if (ok && value && input.dataset.validate === 'phone') ok = PHONE.test(value.replace(/[\s-]/g, ''));

      var wrap = fieldOf(input);
      if (wrap) wrap.classList.toggle('is-invalid', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      return ok;
    }

    $$('input, select, textarea', form).forEach(function (input) {
      input.addEventListener('blur', function () { validate(input); });
      input.addEventListener('input', function () {
        var wrap = fieldOf(input);
        if (wrap && wrap.classList.contains('is-invalid')) validate(input);
      });
    });

    form.addEventListener('submit', function (e) {
      var fields = $$('input, select, textarea', form).filter(function (el) { return el.type !== 'hidden'; });
      var firstBad = null;

      fields.forEach(function (input) {
        if (!validate(input) && !firstBad) firstBad = input;
      });

      if (firstBad) {
        e.preventDefault();
        firstBad.focus();
        firstBad.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        return;
      }

      // NOTE: no backend is wired up yet. Until `action` points at a real
      // handler (Formspree, Netlify Forms, or your own endpoint), the submit is
      // intercepted here and the visitor is sent to the confirmation page.
      if (form.dataset.demo === 'true') {
        e.preventDefault();
        var btn = $('button[type="submit"]', form);
        if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
        window.setTimeout(function () {
          window.location.href = 'thank-you.html';
        }, 600);
      }
    });
  }

  /* ---------- Cookie consent ---------- */
  function initCookies() {
    var bar = $('#cookie-consent');
    if (!bar) return;

    var KEY = 'zb-cookie-consent';
    var stored = null;
    try { stored = window.localStorage.getItem(KEY); } catch (err) { stored = null; }
    if (stored) return;

    function decide(choice) {
      try { window.localStorage.setItem(KEY, choice); } catch (err) { /* private mode */ }
      bar.classList.remove('is-in');
      window.setTimeout(function () { bar.classList.remove('is-visible'); }, 300);
    }

    bar.classList.add('is-visible');
    window.setTimeout(function () { bar.classList.add('is-in'); }, 400);

    var accept = $('[data-cookie="accept"]', bar);
    var reject = $('[data-cookie="reject"]', bar);
    if (accept) accept.addEventListener('click', function () { decide('accepted'); });
    if (reject) reject.addEventListener('click', function () { decide('essential'); });
  }

  /* ---------- Footer year ---------- */
  function initYear() {
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Blog filtering ---------- */
  function initBlogFilter() {
    var filters = $$('[data-filter]');
    if (!filters.length) return;
    var posts = $$('[data-category]');
    var empty = $('#blog-empty');

    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.dataset.filter;
        filters.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('btn--primary', on);
          b.classList.toggle('btn--ghost', !on);
          b.setAttribute('aria-pressed', String(on));
        });
        var shown = 0;
        posts.forEach(function (post) {
          var match = target === 'all' || post.dataset.category === target;
          post.hidden = !match;
          if (match) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
      });
    });
  }

  function init() {
    initNav();
    initHeader();
    initAccordions();
    initCounters();
    initForm();
    initCookies();
    initYear();
    initBlogFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
