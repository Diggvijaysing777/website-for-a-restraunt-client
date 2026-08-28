/* Runtime smoke test — loads index.html + script.js in jsdom and exercises
   the interactive paths, failing loudly on any thrown error. */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: 'http://localhost/'
});
const { window } = dom;

// --- polyfills jsdom lacks ---
window.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; this._els = []; }
  observe(el) { this._els.push(el); this.cb([{ isIntersecting: true, target: el }], this); }
  unobserve() {} disconnect() {}
};
window.matchMedia = q => ({ matches: false, media: q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
window.HTMLElement.prototype.scrollTo = function(){};
window.scrollTo = () => {};
if (!window.performance) window.performance = { now: () => Date.now() };
// jsdom returns 0-size boxes; give elements a plausible box for the parallax math
window.Element.prototype.getBoundingClientRect = function () {
  return { top: 100, bottom: 500, left: 0, right: 800, width: 800, height: 400, x: 0, y: 100 };
};
Object.defineProperty(window, 'innerWidth',  { value: 1440, writable: true });
Object.defineProperty(window, 'innerHeight', { value: 900,  writable: true });

// --- run the site script ---
try {
  window.eval(fs.readFileSync('script.js', 'utf8'));
} catch (e) {
  errors.push('script threw on load: ' + e.stack);
}

const { document } = window;
const $ = s => document.querySelector(s);
const results = [];
const ok = (label, cond, extra) => results.push([cond ? 'PASS' : 'FAIL', label, extra || '']);

function fire(el, type, opts) {
  if (!el) return;
  el.dispatchEvent(new window.Event(type, Object.assign({ bubbles: true, cancelable: true }, opts)));
}

/* 1. reveal + counters ran */
ok('reveals activated', document.querySelectorAll('[data-reveal].is-in').length > 20,
   document.querySelectorAll('[data-reveal].is-in').length + ' of ' + document.querySelectorAll('[data-reveal]').length);
ok('year stamped', /^20\d\d$/.test($('#year').textContent), $('#year').textContent);
ok('ribbon duplicated for seamless loop', $('#ribbonTrack').children.length > 12,
   $('#ribbonTrack').children.length + ' items');

/* 2. booking modal opens from a room card and prefills the room */
fire(document.querySelector('.room .linkish[data-room]'), 'click');
ok('modal opens', $('#bookingModal').hidden === false);
ok('room prefilled', $('#mRoom').value.includes('Valley View'), $('#mRoom').value);

/* 3. required-field validation blocks an empty submit */
fire($('#bookingForm'), 'submit');
ok('empty booking submit blocked', $('#bookDone').hidden === true);
ok('error message shown', ($('[data-err-for="mIn"]').textContent || '').length > 0,
   $('[data-err-for="mIn"]').textContent);

/* 4. a valid submit produces a mailto with the real reservations address */
$('#mIn').value = '2026-09-10';
fire($('#mIn'), 'change');
$('#mOut').value = '2026-09-13';
fire($('#mOut'), 'change');
ok('nights calculated', $('#modalNights').textContent.includes('3 night'), $('#modalNights').textContent);
$('#mName').value  = 'Asha Verma';
$('#mPhone').value = '+91 98765 43210';
$('#mEmail').value = 'asha@example.com';
fire($('#bookingForm'), 'submit');
const href = $('#bookMailto').getAttribute('href') || '';
ok('valid submit succeeds', $('#bookDone').hidden === false);
ok('mailto targets reservations@', href.startsWith('mailto:reservations@hotelgrandparagon.com'));
ok('mailto carries dates + nights', /Nights%3A%203/.test(href) && /10%20Sep%202026/.test(href));
ok('no price in mailto body', !/%E2%82%B9|Rs|INR/.test(href));

/* 5. check-out min is pushed past check-in */
ok('checkout min guarded', $('#mOut').min === '2026-09-11', $('#mOut').min);

/* 6. bad email is rejected */
$('#mEmail').value = 'not-an-email';
fire($('#mEmail'), 'blur');
ok('bad email flagged', ($('[data-err-for="mEmail"]').textContent || '').length > 0);

/* 7. enquiry form */
$('#fName').value = 'Rohit Sharma';
$('#fPhone').value = '9418068277';
$('#fEmail').value = 'rohit@example.com';
$('#fGuests').value = '400 guests';
fire($('#enquiryForm'), 'submit');
ok('enquiry submit succeeds', $('#formDone').hidden === false);
ok('enquiry mailto built', ($('#mailtoLink').getAttribute('href') || '').startsWith('mailto:reservations@'));

/* 8. banquet tabs */
const tabSa = $('#tabSa');
fire(tabSa, 'click');
ok('tab switch shows Sangam', $('#panSa').hidden === false && $('#panSv').hidden === true);
ok('aria-selected tracks tab', tabSa.getAttribute('aria-selected') === 'true');

/* 9. gallery filter */
fire(document.querySelector('.chip[data-filter="weddings"]'), 'click');
const shown = Array.from(document.querySelectorAll('#galleryGrid .tile')).filter(t => !t.classList.contains('is-hidden'));
ok('filter narrows gallery', shown.length === 2 && shown.every(t => t.dataset.cat === 'weddings'),
   shown.length + ' wedding tiles');

/* 10. lightbox walks only the visible set */
fire(shown[0], 'click');
ok('lightbox opens', $('#lightbox').hidden === false);
ok('counter scoped to filtered set', $('#lbCount').textContent.trim() === '1 / 2', $('#lbCount').textContent);
fire($('#lbNext'), 'click');
ok('next advances', $('#lbCount').textContent.trim() === '2 / 2', $('#lbCount').textContent);
fire($('#lbNext'), 'click');
ok('wraps around', $('#lbCount').textContent.trim() === '1 / 2', $('#lbCount').textContent);
fire(document.querySelector('[data-close-lb]'), 'click');
ok('lightbox closes', $('#lightbox').classList.contains('is-open') === false);

/* 11. mobile drawer */
fire($('#burger'), 'click');
ok('drawer opens', $('#mobileNav').hidden === false && $('#burger').getAttribute('aria-expanded') === 'true');
fire($('#drawerClose'), 'click');
ok('drawer closes', $('#burger').getAttribute('aria-expanded') === 'false');

/* 12. availability bar refuses empty dates, then hands off to the modal */
const note = $('#bookbarNote');
fire($('#bookBar'), 'submit');
ok('bookbar warns on empty dates', note.classList.contains('is-warn'), note.textContent.trim().slice(0, 44));

/* 13. nav dropdown */
const navToggle = document.querySelector('.nav__toggle');
fire(navToggle, 'click');
ok('nav dropdown opens', navToggle.getAttribute('aria-expanded') === 'true');

/* 14. broken image falls back instead of showing a broken icon */
const testImg = document.querySelector('.room__fig img');
fire(testImg, 'error');
ok('image fallback injected', !!document.querySelector('.room__fig .img-fallback'));
ok('fallback names the local file',
   (document.querySelector('.room__fig .img-fallback span') || {}).textContent === 'images/room-executive-valley.jpg',
   (document.querySelector('.room__fig .img-fallback span') || {}).textContent);

/* ── report ── */
console.log('');
let fails = 0;
results.forEach(([s, l, x]) => { if (s === 'FAIL') fails++; console.log(`  ${s}  ${l}${x ? '  → ' + x : ''}`); });
console.log('');
if (errors.length) { console.log('RUNTIME ERRORS:'); errors.forEach(e => console.log('  ' + e)); }
else console.log('No runtime errors.');
console.log(`\n${results.length - fails}/${results.length} checks passed.`);
process.exit(fails || errors.length ? 1 : 0);
