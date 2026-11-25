/* at leads: форма заявки (Netlify Forms), UTM-метки, GA4 и Meta Pixel.
   Заполните ID ниже — пустая строка = выключено. */
var SITE = {
  GA4_ID: '',        // G-XXXXXXXXXX
  PIXEL_ID: '',      // ID пикселя Meta
  WHATSAPP: ''       // номер только цифрами, например 996700000000
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
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString()
    }).then(function (r) {
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
