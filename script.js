/* ============================================================================
   HOTEL GRAND PARAGON PALACE — script.js
   Vanilla JS, no dependencies. Everything degrades gracefully and every
   animated behaviour checks prefers-reduced-motion first.

   1  helpers                        8  banquet tabs
   2  preloader                      9  gallery filter
   3  scroll progress + header      10  lightbox
   4  nav (dropdowns, active link)  11  booking modal
   5  mobile drawer                 12  form validation + mailto handoff
   6  reveal on scroll              13  availability bar
   7  counters + parallax           14  misc (year, image fallback, to-top)
   ========================================================================= */
(function () {
  'use strict';

  /* ── 1. HELPERS ───────────────────────────────────────────────────────── */
  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

  const HOTEL = {
    reservations: 'reservations@hotelgrandparagon.com',
    booking:      'booking@hotelparagonpalace.com',
    info:         'info@hotelgrandparagon.com',
    phone:        '+91 94180 68277'
  };

  function lockScroll(on) {
    document.body.classList.toggle('is-locked', on);
  }

  /* Keeps Tab inside an open dialog. Returns a teardown function. */
  function trapFocus(container, onEscape) {
    function onKey(e) {
      if (e.key === 'Escape') { onEscape(); return; }
      if (e.key !== 'Tab') return;
      const items = $$(FOCUSABLE, container).filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }

  const fmtDate = iso => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const nightsBetween = (a, b) => {
    if (!a || !b) return 0;
    const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00');
    return ms > 0 ? Math.round(ms / 86400000) : 0;
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

  /* ── 2. PRELOADER ─────────────────────────────────────────────────────── */
  const loader = $('#loader');

  function dismissLoader() {
    if (!loader || loader.classList.contains('is-gone')) return;
    loader.classList.add('is-gone');
    setTimeout(() => { loader.setAttribute('hidden', ''); }, 1200);
    // start the hero arch drawing once the curtain lifts
    $$('.draw-arch').forEach(p => p.classList.add('is-drawn'));
    document.documentElement.classList.add('is-ready');
  }

  if (loader) {
    const minShow = reduceMotion ? 0 : 1900;
    const start = Date.now();
    const go = () => setTimeout(dismissLoader, Math.max(0, minShow - (Date.now() - start)));
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go);
    setTimeout(dismissLoader, 5000);            // hard failsafe — never trap the guest
  }

  /* ── 3. SCROLL PROGRESS + HEADER ──────────────────────────────────────── */
  const head = $('#siteHead');
  const bar  = $('#scrollProgress');
  let lastY = window.scrollY;
  let ticking = false;

  function onScrollFrame() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    if (bar) bar.style.scale = (max > 0 ? Math.min(y / max, 1) : 0) + ' 1';

    if (head) {
      head.classList.toggle('is-stuck', y > 40);
      // hide when scrolling down past the fold, show again on the way up
      const goingDown = y > lastY && y > 420;
      head.classList.toggle('is-hidden', goingDown && !document.body.classList.contains('is-locked'));
    }

    const top = $('#toTop');
    if (top) top.classList.toggle('is-on', y > 700);

    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
  }, { passive: true });
  onScrollFrame();

  /* ── 4. NAV: DROPDOWNS + ACTIVE LINK ──────────────────────────────────── */
  $$('.nav__toggle').forEach(btn => {
    const sub = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      $$('.nav__toggle').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        const s = document.getElementById(b.getAttribute('aria-controls'));
        if (s) s.classList.remove('is-open');
      });
      if (!open) { btn.setAttribute('aria-expanded', 'true'); if (sub) sub.classList.add('is-open'); }
    });
  });

  document.addEventListener('click', e => {
    if (e.target.closest('.nav__has-sub')) return;
    $$('.nav__toggle').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      const s = document.getElementById(b.getAttribute('aria-controls'));
      if (s) s.classList.remove('is-open');
    });
  });

  // close a submenu after choosing from it
  $$('.nav__sub a').forEach(a => a.addEventListener('click', () => {
    const t = a.closest('.nav__has-sub').querySelector('.nav__toggle');
    t.setAttribute('aria-expanded', 'false');
    a.closest('.nav__sub').classList.remove('is-open');
  }));

  const navLinks = $$('.nav__list > li > a[href^="#"]');
  const watched  = navLinks.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  if (watched.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        navLinks.forEach(a => {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    watched.forEach(sec => spy.observe(sec));
  }

  /* ── 5. MOBILE DRAWER ─────────────────────────────────────────────────── */
  const drawer = $('#mobileNav');
  const burger = $('#burger');
  let releaseDrawer = null;

  function openDrawer() {
    if (!drawer) return;
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    lockScroll(true);
    releaseDrawer = trapFocus(drawer, closeDrawer);
    setTimeout(() => { const c = $('#drawerClose'); if (c) c.focus(); }, 120);
  }

  function closeDrawer() {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    lockScroll(false);
    if (releaseDrawer) { releaseDrawer(); releaseDrawer = null; }
    setTimeout(() => { drawer.hidden = true; }, 480);
    burger.focus();
  }

  if (burger) burger.addEventListener('click', () => {
    burger.getAttribute('aria-expanded') === 'true' ? closeDrawer() : openDrawer();
  });
  const drawerClose = $('#drawerClose');
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawer) {
    drawer.addEventListener('click', e => { if (e.target === drawer) closeDrawer(); });
    $$('.drawer__list a', drawer).forEach(a => a.addEventListener('click', closeDrawer));
  }

  /* ── 6. REVEAL ON SCROLL ──────────────────────────────────────────────── */
  const revealables = $$('[data-reveal]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        obs.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(el => io.observe(el));
  }

  /* ── 7. COUNTERS + PARALLAX ───────────────────────────────────────────── */
  const counters = $$('[data-count]');

  function runCounter(el) {
    const target = parseFloat(el.getAttribute('data-count'));
    const plain  = el.getAttribute('data-plain') === 'true';   // years: no thousands separator
    if (isNaN(target)) return;
    if (reduceMotion) { el.textContent = plain ? target : target.toLocaleString('en-IN'); return; }

    const dur = 1500;
    const t0 = performance.now();
    const from = plain ? Math.max(target - 24, 0) : 0;

    (function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (target - from) * eased);
      el.textContent = plain ? String(val) : val.toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  if (counters.length && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        runCounter(en.target);
        obs.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(el => cio.observe(el));
  } else {
    counters.forEach(runCounter);
  }

  const parallaxEls = $$('[data-parallax]');
  if (parallaxEls.length && !reduceMotion) {
    let pTick = false;
    const drawParallax = () => {
      pTick = false;
      // below the tablet breakpoint the parallax elements are laid out
      // statically, so clear any offset left over from a wider viewport
      if (window.innerWidth <= 720) {
        parallaxEls.forEach(el => { el.style.translate = ''; });
        return;
      }
      const mid = window.innerHeight / 2;
      parallaxEls.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        const factor = parseFloat(el.getAttribute('data-parallax')) || 0;
        const shift = (r.top + r.height / 2 - mid) * factor;
        el.style.translate = '0 ' + shift.toFixed(1) + 'px';
      });
    };
    window.addEventListener('scroll', () => {
      if (!pTick) { pTick = true; requestAnimationFrame(drawParallax); }
    }, { passive: true });
    window.addEventListener('resize', drawParallax);
    drawParallax();
  }

  /* Duplicate the ribbon so the -50% keyframe loops seamlessly. */
  const ribbon = $('#ribbonTrack');
  if (ribbon && !reduceMotion) ribbon.innerHTML += ribbon.innerHTML;

  /* ── 8. BANQUET TABS ──────────────────────────────────────────────────── */
  const tabBtns = $$('.tabs__btn');

  function selectTab(btn) {
    tabBtns.forEach(b => {
      const on = b === btn;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(b.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
  }

  tabBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => selectTab(btn));
    btn.addEventListener('keydown', e => {
      let next = null;
      if (e.key === 'ArrowRight') next = tabBtns[(i + 1) % tabBtns.length];
      if (e.key === 'ArrowLeft')  next = tabBtns[(i - 1 + tabBtns.length) % tabBtns.length];
      if (e.key === 'Home')       next = tabBtns[0];
      if (e.key === 'End')        next = tabBtns[tabBtns.length - 1];
      if (next) { e.preventDefault(); selectTab(next); next.focus(); }
    });
  });

  /* ── 9. GALLERY FILTER ────────────────────────────────────────────────── */
  const tiles = $$('#galleryGrid .tile');
  let filterTimer = null;

  /* Filtering happens in two phases so the grid re-forms instead of snapping:
     departing tiles fade and shrink, then display:none reflows the grid, then
     the arriving tiles rise in on a short stagger. Tiles that stay put are
     never touched, so the eye follows the change rather than the whole wall.
     Under prefers-reduced-motion it collapses back to an instant swap. */
  function matches(tile, want) {
    return want === 'all' || tile.getAttribute('data-cat') === want;
  }

  function applyFilter(want) {
    clearTimeout(filterTimer);
    tiles.forEach(t => t.classList.remove('is-arm', 'is-arriving'));

    let leaving = 0;
    tiles.forEach(t => {
      const go = !matches(t, want) && !t.classList.contains('is-hidden');
      t.classList.toggle('is-leaving', go);
      if (go) leaving++;
    });

    const commit = () => {
      let n = 0;
      tiles.forEach(t => {
        const show = matches(t, want);
        const arriving = show && t.classList.contains('is-hidden');
        t.classList.remove('is-leaving');
        t.classList.toggle('is-hidden', !show);
        if (arriving && !reduceMotion) {
          t.style.setProperty('--d', (n++ % 9) * 40 + 'ms');
          t.classList.add('is-arm');
        }
      });
      if (reduceMotion) return;
      /* two frames: one for the browser to paint the armed state, one to
         start the transition out of it. One frame is not reliably enough. */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        tiles.forEach(t => {
          if (!t.classList.contains('is-arm')) return;
          t.classList.add('is-arriving');
          t.classList.remove('is-arm');
        });
      }));
    };

    if (leaving && !reduceMotion) filterTimer = setTimeout(commit, 230);
    else commit();
  }

  $$('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.classList.contains('is-on')) return;
      $$('.chip').forEach(c => {
        c.classList.remove('is-on');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('is-on');
      chip.setAttribute('aria-pressed', 'true');
      applyFilter(chip.getAttribute('data-filter'));
    });
  });

  /* clear the one-shot arrival classes once they have done their job, so a
     later hover or reveal is never fighting a leftover transition-delay */
  $('#galleryGrid')?.addEventListener('transitionend', e => {
    if (e.target.classList?.contains('is-arriving') && e.propertyName === 'opacity') {
      e.target.classList.remove('is-arriving');
      e.target.style.removeProperty('--d');
    }
  });

  /* ── 10. LIGHTBOX ─────────────────────────────────────────────────────── */
  const lb      = $('#lightbox');
  const lbImg   = $('#lbImg');
  const lbCap   = $('#lbCap');
  const lbCount = $('#lbCount');
  let lbIndex = 0;
  let lbList = [];
  let releaseLb = null;
  let lbOpener = null;

  function visibleTiles() {
    return tiles.filter(t => !t.classList.contains('is-hidden'));
  }

  /* Tiles are served at gallery size, so lifting a tile's currentSrc into a
     full-screen panel would show an enlarged thumbnail. Take the widest
     candidate out of the srcset instead. */
  function bestSrc(img) {
    const widest = (img.getAttribute('srcset') || '').split(',')
      .map(s => s.trim().split(/\s+/))
      .filter(p => p[0])
      .map(p => ({ url: p[0], w: parseInt(p[1], 10) || 0 }))
      .sort((a, b) => b.w - a.w)[0];
    return widest ? widest.url : (img.currentSrc || img.src);
  }

  /* warm the neighbours so the arrows feel instant rather than loading */
  function warm(i) {
    if (!lbList.length) return;
    const img = $('img', lbList[(i + lbList.length) % lbList.length]);
    if (img) new Image().src = bestSrc(img);
  }

  function showLb(i) {
    if (!lbList.length) return;
    lbIndex = (i + lbList.length) % lbList.length;
    const tile = lbList[lbIndex];
    const img  = $('img', tile);
    lbCap.textContent = tile.getAttribute('data-caption') || '';
    lbCount.textContent = (lbIndex + 1) + ' / ' + lbList.length;
    if (!img) return;

    const url = bestSrc(img);
    const alt = img.alt || '';
    const swap = () => {
      lbImg.src = url;
      lbImg.alt = alt;
      lbImg.classList.remove('is-swapping');
    };

    /* Cross-fade: hold the outgoing frame until the incoming file has decoded,
       so the panel never flashes empty. The fade-out and the decode run at the
       same time and we wait for whichever finishes last. */
    if (!lbImg.getAttribute('src') || reduceMotion) {
      swap();
    } else {
      lbImg.classList.add('is-swapping');
      const pre = new Image();
      pre.src = url;
      const decoded = pre.decode
        ? pre.decode().catch(() => {})
        : new Promise(res => { pre.onload = pre.onerror = res; });
      const faded = new Promise(res => setTimeout(res, 180));
      Promise.all([decoded, faded]).then(swap, swap);
    }

    warm(lbIndex + 1);
    warm(lbIndex - 1);
  }

  function openLb(tile) {
    if (!lb) return;
    lbOpener = tile;
    lbList = visibleTiles();
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    lockScroll(true);
    showLb(lbList.indexOf(tile));
    releaseLb = trapFocus(lb, closeLb);
    document.addEventListener('keydown', lbArrows);
    setTimeout(() => { const x = $('.lightbox__x', lb); if (x) x.focus(); }, 100);
  }

  function closeLb() {
    if (!lb || lb.hidden) return;
    lb.classList.remove('is-open');
    lockScroll(false);
    if (releaseLb) { releaseLb(); releaseLb = null; }
    document.removeEventListener('keydown', lbArrows);
    setTimeout(() => {
      lb.hidden = true;
      lbImg.removeAttribute('src');
      lbImg.classList.remove('is-swapping');
    }, 420);
    if (lbOpener) lbOpener.focus();
  }

  function lbArrows(e) {
    if (e.key === 'ArrowRight') showLb(lbIndex + 1);
    if (e.key === 'ArrowLeft')  showLb(lbIndex - 1);
  }

  tiles.forEach(t => t.addEventListener('click', () => openLb(t)));
  $$('[data-close-lb]').forEach(el => el.addEventListener('click', closeLb));
  const lbNext = $('#lbNext'), lbPrev = $('#lbPrev');
  if (lbNext) lbNext.addEventListener('click', () => showLb(lbIndex + 1));
  if (lbPrev) lbPrev.addEventListener('click', () => showLb(lbIndex - 1));

  /* ── 11. BOOKING MODAL ────────────────────────────────────────────────── */
  const modal = $('#bookingModal');
  let releaseModal = null;
  let modalOpener = null;

  function openModal(prefill) {
    if (!modal) return;
    modalOpener = document.activeElement;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    lockScroll(true);
    if (head) head.classList.remove('is-hidden');

    if (prefill) {
      if (prefill.room)  setSelect($('#mRoom'), prefill.room);
      if (prefill.in)    $('#mIn').value  = prefill.in;
      if (prefill.out)   $('#mOut').value = prefill.out;
      if (prefill.guests) setSelect($('#mGuests'), prefill.guests);
      updateNights();
    }

    releaseModal = trapFocus(modal, closeModal);
    setTimeout(() => { const f = $('#mIn'); if (f) f.focus(); }, 140);
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.classList.remove('is-open');
    lockScroll(false);
    if (releaseModal) { releaseModal(); releaseModal = null; }
    setTimeout(() => { modal.hidden = true; }, 460);
    if (modalOpener && modalOpener.focus) modalOpener.focus();
  }

  function setSelect(sel, value) {
    if (!sel) return;
    const match = $$('option', sel).find(o => o.textContent.trim() === value.trim());
    if (match) sel.value = match.value || match.textContent;
  }

  $$('[data-open-booking]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeDrawer();
      openModal({ room: btn.getAttribute('data-room') || '' });
    });
  });
  $$('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));

  function updateNights() {
    const note = $('#modalNights');
    if (!note) return;
    const n = nightsBetween($('#mIn').value, $('#mOut').value);
    if (n > 0) {
      note.hidden = false;
      note.textContent = n + (n === 1 ? ' night' : ' nights') +
        ' · ' + fmtDate($('#mIn').value) + ' to ' + fmtDate($('#mOut').value);
    } else {
      note.hidden = true;
    }
  }

  /* ── 12. FORM VALIDATION + MAILTO HANDOFF ─────────────────────────────── */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const PHONE_RE = /^[+()\d\s-]{7,20}$/;

  function setError(input, msg) {
    const field = input.closest('.field');
    const slot  = $('[data-err-for="' + input.id + '"]');
    if (field) field.classList.toggle('is-bad', !!msg);
    if (slot) slot.textContent = msg || '';
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !msg;
  }

  function checkField(input) {
    const v = input.value.trim();
    if (input.hasAttribute('required') && !v) return setError(input, 'This one is needed.');
    if (input.type === 'email' && v && !EMAIL_RE.test(v)) return setError(input, 'Check the email address.');
    if (input.type === 'tel' && v && !PHONE_RE.test(v)) return setError(input, 'Check the phone number.');
    return setError(input, '');
  }

  function wireLiveValidation(form) {
    $$('input,select,textarea', form).forEach(el => {
      el.addEventListener('blur', () => { if (el.value.trim() || el.hasAttribute('required')) checkField(el); });
      el.addEventListener('input', () => {
        const field = el.closest('.field');
        if (field && field.classList.contains('is-bad')) checkField(el);
      });
    });
  }

  function validate(form) {
    const fields = $$('[required]', form);
    let firstBad = null;
    fields.forEach(el => { if (!checkField(el) && !firstBad) firstBad = el; });
    if (firstBad) { firstBad.focus(); return false; }
    return true;
  }

  function mailto(to, subject, lines) {
    return 'mailto:' + to +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.filter(Boolean).join('\n'));
  }

  /* -- main enquiry form -- */
  const enquiry = $('#enquiryForm');
  if (enquiry) {
    wireLiveValidation(enquiry);
    enquiry.addEventListener('submit', e => {
      e.preventDefault();
      if (!validate(enquiry)) return;

      const name  = $('#fName').value.trim();
      const type  = $('#fType').value;
      const date  = $('#fDate').value;
      const body  = [
        'Enquiry from the website',
        '',
        'Name: '   + name,
        'Phone: '  + $('#fPhone').value.trim(),
        'Email: '  + $('#fEmail').value.trim(),
        'About: '  + type,
        date ? 'Preferred date: ' + fmtDate(date) : '',
        $('#fGuests').value.trim() ? 'Guests / rooms: ' + $('#fGuests').value.trim() : '',
        '',
        $('#fMsg').value.trim() || ''
      ];

      const link = $('#mailtoLink');
      if (link) link.href = mailto(HOTEL.reservations, 'Website enquiry — ' + type + ' — ' + name, body);

      const msg = $('#formDoneMsg');
      if (msg) msg.textContent = 'Thanks, ' + name.split(' ')[0] +
        '. Open the message in your email app to send it to our reservations team, or call us on ' +
        HOTEL.phone + ' for an immediate answer.';

      const done = $('#formDone');
      if (done) done.hidden = false;
      if (link) link.focus();
    });
  }

  /* -- booking modal form -- */
  const bookingForm = $('#bookingForm');
  if (bookingForm) {
    wireLiveValidation(bookingForm);

    const mIn = $('#mIn'), mOut = $('#mOut');
    if (mIn) mIn.min = todayISO();
    if (mIn) mIn.addEventListener('change', () => {
      if (mOut) {
        const next = new Date(mIn.value + 'T00:00:00');
        next.setDate(next.getDate() + 1);
        mOut.min = isNaN(next) ? todayISO() : next.toISOString().slice(0, 10);
        if (mOut.value && mOut.value <= mIn.value) mOut.value = mOut.min;
      }
      updateNights();
    });
    if (mOut) mOut.addEventListener('change', updateNights);

    bookingForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!validate(bookingForm)) return;

      const n = nightsBetween(mIn.value, mOut.value);
      if (n <= 0) { setError(mOut, 'Check-out must be after check-in.'); mOut.focus(); return; }

      const name = $('#mName').value.trim();
      const body = [
        'Availability request from the website',
        '',
        'Name: '      + name,
        'Phone: '     + $('#mPhone').value.trim(),
        'Email: '     + $('#mEmail').value.trim(),
        'Check-in: '  + fmtDate(mIn.value) + ' (from 2:00 PM)',
        'Check-out: ' + fmtDate(mOut.value) + ' (by 12:00 PM)',
        'Nights: '    + n,
        'Room type: ' + $('#mRoom').value,
        'Guests: '    + $('#mGuests').value,
        '',
        'Please confirm availability and the current rate.'
      ];

      const link = $('#bookMailto');
      if (link) link.href = mailto(HOTEL.reservations, 'Availability request — ' + fmtDate(mIn.value) + ' — ' + name, body);

      const msg = $('#bookDoneMsg');
      if (msg) msg.textContent = n + (n === 1 ? ' night' : ' nights') + ' for ' + $('#mGuests').value.toLowerCase() +
        '. Open the message in your email app to send it, or call ' + HOTEL.phone + ' — the desk answers 24×7.';

      const done = $('#bookDone');
      if (done) done.hidden = false;
      if (link) link.focus();
    });
  }

  /* ── 13. AVAILABILITY BAR ─────────────────────────────────────────────── */
  const bookBar = $('#bookBar');
  if (bookBar) {
    const bbIn = $('#bbIn'), bbOut = $('#bbOut'), note = $('#bookbarNote');
    const defaultNote = note ? note.textContent : '';

    if (bbIn) bbIn.min = todayISO();
    if (bbIn) bbIn.addEventListener('change', () => {
      if (!bbOut) return;
      const next = new Date(bbIn.value + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      bbOut.min = isNaN(next) ? todayISO() : next.toISOString().slice(0, 10);
      if (bbOut.value && bbOut.value <= bbIn.value) bbOut.value = bbOut.min;
    });

    bookBar.addEventListener('submit', e => {
      e.preventDefault();
      if (!bbIn.value || !bbOut.value) {
        if (note) {
          note.textContent = 'Pick your check-in and check-out dates first.';
          note.classList.add('is-warn');
          setTimeout(() => { note.textContent = defaultNote; note.classList.remove('is-warn'); }, 3200);
        }
        (!bbIn.value ? bbIn : bbOut).focus();
        return;
      }
      openModal({
        in: bbIn.value,
        out: bbOut.value,
        room: $('#bbRoom').value,
        guests: $('#bbGuests').value
      });
    });
  }

  /* ── 14. MISC ─────────────────────────────────────────────────────────── */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  const toTop = $('#toTop');
  if (toTop) toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* Stock photo failed? Drop in a gilt jaali placeholder instead of a broken
     image, and keep the alt text visible so the layout still reads. */
  document.addEventListener('error', e => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.fallbackDone) return;
    img.dataset.fallbackDone = '1';
    img.style.visibility = 'hidden';

    const host = img.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const ph = document.createElement('div');
    ph.className = 'img-fallback';
    ph.innerHTML =
      '<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M2,46 L2,22 C2,13 9.5,5.5 16.5,3 C19,2 19.2,1 20,1 C20.8,1 21,2 23.5,3 C30.5,5.5 38,13 38,22 L38,46" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
      '<span>' + (img.currentSrc || img.src || '').split('/').pop().split('?')[0] + '</span>';
    host.appendChild(ph);
  }, true);

  /* ──────────────────────────────────────────────────────────────────────────
     15. BLUR-UP FOR THE HOTEL'S PHOTOGRAPHY
     Each <img> already carries a 22px blur of itself as an inline background
     token, so something of the real photo is on screen immediately. Here we
     blur the element while the full file is in flight and lift the blur once
     it lands, which hides the placeholder's pixel grid during the handover.
     The .lq class is only ever added by this script — with JS disabled the
     photographs simply appear sharp, never stuck blurred.
     ────────────────────────────────────────────────────────────────────────── */
  const lqImgs = $$('img[style*="--lq-"]');
  lqImgs.forEach(img => {
    // decode() resolves once the bitmap is actually paintable, so the blur
    // lifts on the frame the photo is ready rather than slightly before it.
    const settle = () => {
      img.classList.add('is-ready');
      // Drop the placeholder background afterwards so it is not held in memory
      // behind every photo for the life of the page.
      setTimeout(() => {
        img.classList.remove('lq', 'is-ready');
        img.style.backgroundImage = 'none';
      }, 900);
    };
    if (img.complete && img.naturalWidth > 0) { img.style.backgroundImage = 'none'; return; }
    img.classList.add('lq');
    const done = () => (img.decode ? img.decode().then(settle, settle) : settle());
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', () => img.classList.remove('lq'), { once: true });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     16. TERRACE REEL
     A phone-shot vertical clip, so it is played small and silent. It only
     starts once it is actually on screen — which also means the file is not
     fetched at all for visitors who never scroll this far (preload="none") —
     and it stops again on the way out so it is not burning battery in a
     background tab. Reduced-motion visitors get the poster and a play button.
     ────────────────────────────────────────────────────────────────────────── */
  const reel = $('#reelVideo');
  const reelBtn = $('#reelBtn');
  const reelBand = $('#reel');
  const reelState = $('#reelState');

  if (reel && reelBtn) {
    let userPaused = reduceMotion;   // honour the OS preference as the initial state
    let onScreen = false;

    const paint = playing => {
      reelBtn.setAttribute('aria-pressed', String(playing));
      const label = playing ? 'Pause film' : 'Play film';
      reelBtn.querySelector('.reelframe__btn-label').textContent = label;
      reelBtn.setAttribute('aria-label', label);
      if (reelState) reelState.textContent = playing ? 'Playing' : 'Paused';
      if (reelBand) reelBand.classList.toggle('is-paused', !playing);
    };

    const tryPlay = () => {
      // play() rejects on some mobile browsers until the user interacts; the
      // catch keeps the button label honest instead of claiming it is playing.
      const p = reel.play();
      if (p && p.catch) p.catch(() => paint(false));
    };

    const sync = () => {
      if (onScreen && !userPaused) tryPlay();
      else reel.pause();
    };

    reel.addEventListener('play',  () => paint(true));
    reel.addEventListener('pause', () => paint(false));

    reelBtn.addEventListener('click', () => {
      userPaused = !reel.paused;
      sync();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        entries.forEach(en => {
          onScreen = en.isIntersecting;
          if (onScreen && reel.preload === 'none') reel.preload = 'auto';
          sync();
        });
      }, { threshold: 0.35 }).observe(reel);
    } else {
      onScreen = true;
      sync();
    }

    // Leaving the tab should not leave it looping unseen.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) reel.pause();
      else sync();
    });

    paint(false);
  }

  /* Smooth in-page jumps that also clear the fixed header. */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#' || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = (head ? head.offsetHeight : 0) + 12;
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(y, 0), behavior: reduceMotion ? 'auto' : 'smooth' });
      if (head) head.classList.remove('is-hidden');
    });
  });
})();
