/* at leads: форма заявки (Apps Script), UTM-метки, GA4, Meta Pixel, анимации появления.
   Заполните ID ниже — пустая строка = выключено. */
var SITE = {
  GA4_ID: 'G-ZRF220BEH6', // GA4: аккаунт «at leads», ресурс atleads.pro
  PIXEL_ID: '1711007687207002', // Meta Pixel «at leads site (atleads.pro)», бизнес Atai Project
  WHATSAPP: '',      // номер только цифрами, например 996700000000
  LEADS_URL: 'https://script.google.com/macros/s/AKfycby7v8TAu1KKwP-l9yCbSn2w6aFMQ8oh3Zg4FeasAY5yVMRxGPu_FlqTe-gwi8e3IQMX/exec' // Apps Script «leads»: Google Таблица + Telegram
};

/* ---------- Аналитика ---------- */
(function () {
  if (SITE.GA4_ID) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + SITE.GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', SITE.GA4_ID);
  }
  if (SITE.PIXEL_ID) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', SITE.PIXEL_ID);
    fbq('track', 'PageView');
  }
})();

function track(ga, fb, params) {
  try { if (window.gtag) gtag('event', ga, params || {}); } catch (e) {}
  try { if (window.fbq) fbq(fb.std ? 'track' : 'trackCustom', fb.name, params || {}); } catch (e) {}
}

/* ---------- UTM: запоминаем первый вход в сессии ---------- */
var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
(function () {
  var p = new URLSearchParams(location.search), saved = {};
  try { saved = JSON.parse(sessionStorage.getItem('atl_attr') || '{}'); } catch (e) {}
  var hasNew = ATTR_KEYS.some(function (k) { return p.get(k); });
  if (hasNew || !saved.landing) {
    saved = { landing: location.pathname, referrer: document.referrer || '' };
    ATTR_KEYS.forEach(function (k) { if (p.get(k)) saved[k] = p.get(k); });
    try { sessionStorage.setItem('atl_attr', JSON.stringify(saved)); } catch (e) {}
  }
  window.ATL_ATTR = saved;
})();

document.addEventListener('DOMContentLoaded', function () {
  /* Клик «Записаться на разбор» */
  document.querySelectorAll('a[href="#form"]').forEach(function (a) {
    a.addEventListener('click', function () {
      track('cta_click', { name: 'ClickRazbor' }, { page: location.pathname });
    });
  });

  var form = document.getElementById('lead');
  if (!form) return;
  var done = form.querySelector('.form__done');
  var err = form.querySelector('.form__err');
  var btn = form.querySelector('button[type="submit"]');

  if (SITE.WHATSAPP) {
    form.querySelectorAll('[data-wa-off]').forEach(function (el) { el.hidden = true; });
    form.querySelectorAll('[data-wa-on]').forEach(function (el) { el.hidden = false; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var a = window.ATL_ATTR || {};
    var set = function (n, v) { var i = form.querySelector('[name="' + n + '"]'); if (i) i.value = v || ''; };
    ATTR_KEYS.forEach(function (k) { set(k, a[k]); });
    set('landing', a.landing);
    set('referrer', a.referrer);
    set('page', location.pathname);

    btn.disabled = true;
    if (err) err.hidden = true;
    var body = new URLSearchParams(new FormData(form)).toString();
    var send = SITE.LEADS_URL
      // Apps Script: ответ непрозрачный (no-cors), поэтому успехом считаем доставку запроса.
      ? fetch(SITE.LEADS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
          .then(function () { return { ok: true }; })
      : fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body });
    send.then(function (r) {
      if (!r.ok) throw new Error(r.status);
      form.querySelector('.form__body').hidden = true;
      done.hidden = false;
      track('generate_lead', { name: 'Lead', std: true }, { page: location.pathname });
      if (SITE.WHATSAPP) {
        var name = (form.querySelector('[name="name"]') || {}).value || '';
        var text = 'Здравствуйте! Я ' + name + ', оставил(а) заявку на разбор на сайте at leads.';
        var link = done.querySelector('[data-wa-link]');
        if (link) link.href = 'https://wa.me/' + SITE.WHATSAPP + '?text=' + encodeURIComponent(text);
      }
    }).catch(function () {
      btn.disabled = false;
      if (err) err.hidden = false;
    });
  });
});

/* ---------- Анимации: появление при прокрутке, счётчики цифр ----------
   Только opacity/transform, без библиотек. Без JS и при «уменьшить движение» всё видно сразу. */
(function () {
  var root = document.documentElement;
  var q = new URLSearchParams(location.search);
  if (q.has('shot') || q.has('capture')) return;
  if (!('IntersectionObserver' in window)) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = document.createElement('style');
  css.textContent =
    '.rv{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1);transition-delay:var(--rv-d,0ms)}' +
    '.rv.rv-in{opacity:1;transform:none}' +
    '.btn svg{transition:transform .25s ease}.btn:hover svg{transform:translateX(3px)}' +
    '.count{font-variant-numeric:tabular-nums}' +
    '@media (prefers-reduced-motion:reduce){.rv{opacity:1;transform:none;transition:none}.btn:hover svg{transform:none}}';
  document.head.appendChild(css);

  var REVEAL = 'section h2, .stat, .card, .sketch-card, .chart-card, .shift, .reels__viz, .sysx__card, .photo, .oa__bonus, details.qa';
  var COUNT = '.stat__v, .case__num';

  function init() {
    if (reduce) return;
    var vh = innerHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('rv-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    var seen = new Map();
    document.querySelectorAll(REVEAL).forEach(function (el) {
      if (el.closest('dialog, .hero, footer')) return;
      if (el.getBoundingClientRect().top < vh) return;      // первый экран не трогаем: без мигания
      var parent = el.parentElement, i = seen.get(parent) || 0;
      seen.set(parent, i + 1);
      el.style.setProperty('--rv-d', Math.min(i, 5) * 70 + 'ms');
      el.classList.add('rv');
      io.observe(el);
    });

    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        countUp(e.target);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll(COUNT).forEach(function (el) {
      if (el.getBoundingClientRect().top < vh) return;
      if (numNode(el)) { el.classList.add('count'); cio.observe(el); }
    });
  }

  // Первое число в элементе: «553», «7,5», «3 108 000» (пробелы и неразрывные пробелы между разрядами).
  var NUM = /\d{1,3}(?:[  ]\d{3})+|\d+(?:,\d+)?/;
  function numNode(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) if (NUM.test(n.nodeValue)) return n;
    return null;
  }
  function countUp(el) {
    var node = numNode(el); if (!node) return;
    var src = node.nodeValue, m = src.match(NUM), raw = m[0];
    var sep = (raw.match(/[  ]/) || [''])[0];
    var dec = raw.indexOf(',') > -1 ? raw.split(',')[1].length : 0;
    var target = parseFloat(raw.replace(/[  ]/g, '').replace(',', '.'));
    var fmt = function (v) {
      var s = v.toFixed(dec).replace('.', ',');
      if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      return src.slice(0, m.index) + s + src.slice(m.index + raw.length);
    };
    var t0 = performance.now(), dur = 1400;
    (function tick(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      node.nodeValue = k < 1 ? fmt(target * e) : src;
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
