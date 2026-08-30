/* ==========================================================================
   ZB Legal Solutions — Motion runtime
   --------------------------------------------------------------------------
   Vanilla implementation of the intensity tiers defined in
   nextlevelbuilder/ui-ux-pro-max-skill → src/ui-ux-pro-max/data/motion.csv.
   Row numbers in comments refer to that file.

   Contract:
     • No dependencies, no build step.
     • Nothing animates layout-affecting properties — transform/opacity only,
       so every tween stays on the compositor thread.
     • Without JS, `motion-ready` is never set and all content renders visible.
     • prefers-reduced-motion kills non-essential motion and renders the final
       state immediately (every row's Framework Notes column).
     • Observers, listeners and rAF loops are all torn down on pagehide.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceQuery.matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Teardown registry — everything registers here so pagehide is one call. */
  var teardown = [];
  function onTeardown(fn) { teardown.push(fn); }

  /* Single shared rAF loop; scroll work is read-then-write, never interleaved. */
  var frameTasks = [];
  var frameQueued = false;
  function requestFrame() {
    if (frameQueued) return;
    frameQueued = true;
    window.requestAnimationFrame(function () {
      frameQueued = false;
      for (var i = 0; i < frameTasks.length; i++) frameTasks[i]();
    });
  }
  function addFrameTask(fn) { frameTasks.push(fn); }

  /* ------------------------------------------------------------------
     Row 4 & 5 — Scroll reveal
     start 'top 88%', stagger 0.08s capped at 8 children so the last item
     never feels laggy ("Don't stagger more than ~8 children").
     ------------------------------------------------------------------ */
  var MAX_STAGGER_ITEMS = 8;
  var STAGGER_STEP = 80;      /* 0.08s, row 5 */
  var STAGGER_STEP_TIGHT = 60; /* 0.06s, row 8 grid wave */

  function initReveal() {
    var targets = $$('[data-reveal]');
    if (!targets.length) return;

    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in', 'is-settled'); });
      return;
    }

    /* Group siblings that share a stagger parent so the wave reads as one unit. */
    var groups = new Map();
    targets.forEach(function (el) {
      var host = el.closest('[data-stagger]') || el.parentElement;
      if (!groups.has(host)) groups.set(host, []);
      groups.get(host).push(el);
    });
    groups.forEach(function (items, host) {
      var tight = host && host.hasAttribute && host.hasAttribute('data-stagger-tight');
      var step = tight ? STAGGER_STEP_TIGHT : STAGGER_STEP;
      items.forEach(function (el, i) {
        el.__delay = Math.min(i, MAX_STAGGER_ITEMS - 1) * step;
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var delay = el.__delay || 0;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-in');
        /* Release the compositor layer once settled (row 13 perf note). */
        window.setTimeout(function () {
          el.classList.add('is-settled');
          el.style.transitionDelay = '';
        }, delay + 700);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    targets.forEach(function (el) { io.observe(el); });
    onTeardown(function () { io.disconnect(); });
  }

  /* ------------------------------------------------------------------
     Row 9 — Split-text headline reveal
     Chars, 0.015s stagger, expo.out. Headlines only: anything over 10 words
     is left alone ("Don't split-animate long paragraphs").
     Accessibility: the original string is preserved as aria-label on the
     heading and every generated span is aria-hidden, so assistive tech
     reads the sentence, not 40 loose characters.
     ------------------------------------------------------------------ */
  var CHAR_STAGGER = 15;   /* 0.015s, row 9 */
  var MAX_SPLIT_WORDS = 10;

  function splitText(el) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    var words = text.split(' ');
    if (!text || words.length > MAX_SPLIT_WORDS) return false;

    el.setAttribute('aria-label', text);
    el.textContent = '';

    var frag = document.createDocumentFragment();
    var index = 0;

    words.forEach(function (word, wi) {
      var wordEl = document.createElement('span');
      wordEl.className = 'split__word';
      wordEl.setAttribute('aria-hidden', 'true');

      for (var i = 0; i < word.length; i++) {
        var charEl = document.createElement('span');
        charEl.className = 'split__char';
        charEl.textContent = word[i];
        charEl.style.setProperty('--char-delay', (index * CHAR_STAGGER) + 'ms');
        wordEl.appendChild(charEl);
        index++;
      }
      frag.appendChild(wordEl);

      if (wi < words.length - 1) {
        var space = document.createTextNode(' ');
        frag.appendChild(space);
        index++;
      }
    });

    el.appendChild(frag);
    el.classList.add('split');
    return true;
  }

  function initSplit() {
    var heads = $$('[data-split]');
    if (!heads.length) return;

    if (reduce) { heads.forEach(function (el) { el.classList.add('is-in'); }); return; }

    var live = heads.filter(splitText);
    if (!live.length) return;

    if (!('IntersectionObserver' in window)) {
      live.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        entry.target.classList.add('is-in');
        window.setTimeout(function () {
          entry.target.classList.add('is-settled');
        }, 1400);
      });
    }, { threshold: 0.25 });

    live.forEach(function (el) { io.observe(el); });
    onTeardown(function () { io.disconnect(); });
  }

  /* ------------------------------------------------------------------
     Row 3 — Magnetic pull
     Pull clamped to *0.3 so the element never leaves its hit box.
     Capped at 2 focal elements per screen ("Don't apply to more than 1-2").
     Pointer-only: skipped entirely on touch (ux-guidelines row 11).
     ------------------------------------------------------------------ */
  var MAGNET_PULL = 0.3;
  var MAGNET_MAX = 2;

  function initMagnetic() {
    if (reduce || !canHover) return;
    var els = $$('[data-magnetic]').slice(0, MAGNET_MAX);

    els.forEach(function (el) {
      var inner = el.querySelector('.magnetic__inner') || el;
      var raf = null;
      var tx = 0, ty = 0;

      function apply() {
        raf = null;
        el.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
        inner.style.transform = 'translate3d(' + (tx * 0.4) + 'px,' + (ty * 0.4) + 'px,0)';
      }

      /* Stable named handlers so cleanup removes the same function (row 3). */
      function onMove(e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * MAGNET_PULL;
        ty = (e.clientY - r.top - r.height / 2) * MAGNET_PULL;
        el.classList.remove('is-resting');
        if (!raf) raf = window.requestAnimationFrame(apply);
      }
      function onLeave() {
        if (raf) { window.cancelAnimationFrame(raf); raf = null; }
        tx = ty = 0;
        el.classList.add('is-resting');
        el.style.transform = '';
        inner.style.transform = '';
      }

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      el.addEventListener('blur', onLeave, true);
      onTeardown(function () {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
        el.removeEventListener('blur', onLeave, true);
        if (raf) window.cancelAnimationFrame(raf);
      });
    });
  }

  /* ------------------------------------------------------------------
     Rows 13 & 14 — Parallax
     Decorative layers only; yPercent delta kept between 5 and 15 so
     foreground and background never desync distractingly. Never on text.
     ------------------------------------------------------------------ */
  function initParallax() {
    if (reduce) return;
    var layers = $$('[data-parallax]');
    if (!layers.length) return;

    var visible = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        var at = visible.indexOf(el);
        if (entry.isIntersecting && at === -1) {
          visible.push(el);
          el.classList.remove('is-settled');
        } else if (!entry.isIntersecting && at !== -1) {
          visible.splice(at, 1);
          /* Release GPU memory once the layer is offscreen (row 13). */
          el.classList.add('is-settled');
        }
      });
      requestFrame();
    }, { rootMargin: '20% 0px' });

    layers.forEach(function (el) { io.observe(el); });

    addFrameTask(function () {
      var vh = window.innerHeight;
      for (var i = 0; i < visible.length; i++) {
        var el = visible[i];
        var r = el.getBoundingClientRect();
        /* -1 (below viewport) → 1 (above viewport) */
        var progress = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        var speed = parseFloat(el.dataset.parallax) || 8;   /* yPercent 5-15 */
        el.style.transform = 'translate3d(0,' + (progress * speed).toFixed(2) + '%,0)';
      }
    });

    onTeardown(function () { io.disconnect(); });
  }

  /* ------------------------------------------------------------------
     Scroll progress rail
     ------------------------------------------------------------------ */
  function initRail() {
    if (reduce) return;
    var fill = $('.scroll-rail__fill');
    if (!fill) return;
    addFrameTask(function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    });
  }

  /* ------------------------------------------------------------------
     Row 6 — Scroll-scrubbed quote gallery
     Pinned natively with position:sticky (no JS pinning, no reflow).
     Index is derived from scroll progress, so it is genuinely tied to the
     scrollbar rather than a timer — which also means no auto-rotation
     accessibility burden (row 17). Dots remain operable as jump controls.
     ------------------------------------------------------------------ */
  function initQuotes() {
    var scroller = $('[data-quote-scroll]');
    if (!scroller) return;

    var items = $$('.quotes__item', scroller);
    var dots  = $$('.quotes__dot', scroller);
    if (!items.length) return;

    var current = -1;

    function show(next, animate) {
      next = Math.max(0, Math.min(items.length - 1, next));
      if (next === current) return;

      items.forEach(function (item, i) {
        var active = i === next;
        item.classList.toggle('is-active', active);
        item.classList.toggle('is-leaving', !active && i === current && animate !== false);
        item.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots.forEach(function (dot, i) {
        dot.setAttribute('aria-selected', i === next ? 'true' : 'false');
        dot.setAttribute('tabindex', i === next ? '0' : '-1');
      });
      current = next;
    }

    show(0, false);

    if (reduce) {
      /* Final state: show every quote stacked and readable, no scrubbing. */
      scroller.classList.add('is-static');
      items.forEach(function (item) {
        item.classList.add('is-active');
        item.setAttribute('aria-hidden', 'false');
      });
      return;
    }

    addFrameTask(function () {
      var r = scroller.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      if (total <= 0) return;
      var p = Math.min(Math.max(-r.top / total, 0), 0.9999);
      show(Math.floor(p * items.length));
    });

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        var r = scroller.getBoundingClientRect();
        var total = r.height - window.innerHeight;
        var y = window.scrollY + r.top + (total * (i + 0.5) / items.length);
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
      /* Arrow-key navigation across the dot group. */
      dot.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var target = dots[Math.max(0, Math.min(dots.length - 1, i + dir))];
        if (target) { target.focus(); target.click(); }
      });
    });
  }

  /* ------------------------------------------------------------------
     Row 17 discipline — marquee
     Continuous animation is decorative, so it pauses on hover, on focus
     within, when offscreen, and when the tab is hidden.
     ------------------------------------------------------------------ */
  function initMarquee() {
    var marquees = $$('.marquee');
    if (!marquees.length) return;

    marquees.forEach(function (m) {
      var track = $('.marquee__track', m);
      if (!track) return;

      /* Duplicate the run once so the -50% keyframe loops seamlessly. */
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(clone.children, function (c) { c.setAttribute('aria-hidden', 'true'); });
      while (clone.firstChild) track.appendChild(clone.firstChild);

      var onscreen = true;
      function sync() {
        var paused = !onscreen || document.hidden || m.__hover || m.__focus;
        m.classList.toggle('is-paused', !!paused);
      }

      var io = new IntersectionObserver(function (entries) {
        onscreen = entries[0].isIntersecting;
        sync();
      });
      io.observe(m);

      function onEnter() { m.__hover = true;  sync(); }
      function onLeave() { m.__hover = false; sync(); }
      function onFocusIn()  { m.__focus = true;  sync(); }
      function onFocusOut() { m.__focus = false; sync(); }
      function onVisibility() { sync(); }

      m.addEventListener('pointerenter', onEnter);
      m.addEventListener('pointerleave', onLeave);
      m.addEventListener('focusin', onFocusIn);
      m.addEventListener('focusout', onFocusOut);
      document.addEventListener('visibilitychange', onVisibility);

      onTeardown(function () {
        io.disconnect();
        m.removeEventListener('pointerenter', onEnter);
        m.removeEventListener('pointerleave', onLeave);
        m.removeEventListener('focusin', onFocusIn);
        m.removeEventListener('focusout', onFocusOut);
        document.removeEventListener('visibilitychange', onVisibility);
      });
      sync();
    });
  }

  /* ------------------------------------------------------------------
     Rows 10 & 11 — Page transitions
     Overlay wipe on transform only. Exit (220ms) is deliberately faster
     than entrance (380ms) so back/forward feels snappy, and navigation is
     never blocked on the animation: a hard timeout always fires it.
     ------------------------------------------------------------------ */
  function initPageTransition() {
    var wipe = $('.page-wipe');
    if (!wipe || reduce) return;

    var navigating = false;

    function isInternal(a) {
      if (!a || !a.href) return false;
      if (a.target && a.target !== '_self') return false;
      if (a.hasAttribute('download')) return false;
      if (a.dataset.noTransition !== undefined) return false;
      var url;
      try { url = new URL(a.href); } catch (e) { return false; }
      if (url.origin !== window.location.origin) return false;
      if (!/\.html?$/.test(url.pathname) && url.pathname !== '/') return false;
      /* Same page + hash → let the browser scroll, don't wipe. */
      if (url.pathname === window.location.pathname && url.hash) return false;
      return !/^(mailto|tel):/.test(a.getAttribute('href') || '');
    }

    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a');
      if (!isInternal(a) || navigating) return;

      e.preventDefault();
      navigating = true;
      wipe.classList.add('is-covering');

      var go = function () { window.location.href = a.href; };
      /* Cap the wait so a stalled transition can never trap the visitor. */
      var safety = window.setTimeout(go, 700);
      wipe.addEventListener('transitionend', function done(ev) {
        if (ev.propertyName !== 'transform') return;
        wipe.removeEventListener('transitionend', done);
        window.clearTimeout(safety);
        go();
      });
    }

    document.addEventListener('click', onClick);
    onTeardown(function () { document.removeEventListener('click', onClick); });

    /* Restoring from bfcache: clear the overlay so the page isn't left dark. */
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      navigating = false;
      wipe.classList.remove('is-covering');
    });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function init() {
    root.classList.add('motion-ready');
    if (reduce) root.classList.add('motion-reduced');

    initReveal();
    initSplit();
    initMagnetic();
    initParallax();
    initRail();
    initQuotes();
    initMarquee();
    initPageTransition();

    if (frameTasks.length) {
      window.addEventListener('scroll', requestFrame, { passive: true });
      window.addEventListener('resize', requestFrame, { passive: true });
      onTeardown(function () {
        window.removeEventListener('scroll', requestFrame);
        window.removeEventListener('resize', requestFrame);
      });
      requestFrame();
    }

    /* React to a mid-session change of the motion preference. */
    var onPrefChange = function (e) {
      if (!e.matches) return;
      reduce = true;
      $$('[data-reveal]').forEach(function (el) { el.classList.add('is-in', 'is-settled'); });
      $$('.split').forEach(function (el) { el.classList.add('is-in'); });
      $$('.marquee').forEach(function (m) { m.classList.add('is-paused'); });
    };
    if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onPrefChange);

    window.addEventListener('pagehide', function () {
      teardown.forEach(function (fn) { try { fn(); } catch (e) {} });
      teardown.length = 0;
      frameTasks.length = 0;
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
