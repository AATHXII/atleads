/** @OnlyCurrentDoc */
/**
 * at leads: приём заявок с сайта atleads.pro.
 * Пишет заявку строкой в лист «Заявки» и шлёт уведомление в Telegram.
 *
 * Развёртывания (веб-приложение, «Запуск от имени: я»):
 * - «leads», доступ «Все» — URL в assets/site.js (LEADS_URL), сюда сайт шлёт заявки.
 * - «setup», доступ «Только я» — страница подключения Telegram: владелец открывает её,
 *   нажимает «Старт» у своего бота и вставляет токен от @BotFather.
 * Токен хранится только в свойствах скрипта (TG_TOKEN), в код и в репозиторий не вписывать.
 * Conversions API (26.11.2026): заявка уходит в Meta с сервера в пиксель своей страницы.
 * Ключ доступа Meta — только в свойствах скрипта (CAPI_TOKEN), вводит владелец на странице «setup».
 */
var PIXELS = {
  '/': '1711007687207002', '/index.html': '1711007687207002',
  '/nedvizhimost.html': '2412799329256930',
  '/medicina.html': '1140470378908940',
  '/rf-target.html': '1190781723620946'
};
var GRAPH = 'https://graph.facebook.com/v23.0/';
var SHEET_NAME = 'Заявки';
var FIELDS = ['name', 'contact', 'sphere', 'role', 'request', 'budget', 'page', 'landing', 'referrer',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
var HEADERS = ['Дата', 'Имя', 'Контакт', 'Сфера', 'Роль', 'Запрос', 'Бюджет', 'Страница', 'Страница входа',
  'Источник перехода', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p['bot-field']) return json_({ ok: true });            // ловушка для ботов
  if (!p.name || !p.contact) return json_({ ok: false, error: 'empty' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([new Date()].concat(FIELDS.map(function (k) { return clean_(p[k]); })));
  } finally {
    lock.releaseLock();
  }
  try { notify_(p); } catch (err) { console.error(err); }
  try { capi_(p); } catch (err) { console.error(err); }
  return json_({ ok: true });
}

// Страница настройки Telegram видна только владельцу скрипта (вошёл в свой Google).
function doGet() {
  if (!isOwner_()) return json_({ ok: true, service: 'at leads' });
  return HtmlService.createHtmlOutput(SETUP_HTML)
    .setTitle('at leads — подключение Telegram')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function isOwner_() {
  var a = Session.getActiveUser().getEmail();
  return !!a && a === Session.getEffectiveUser().getEmail();
}

// Вызывается со страницы настройки: сохраняет токен, находит чат, шлёт тест.
function saveTelegram(token) {
  if (!isOwner_()) throw new Error('Нет доступа');
  token = String(token || '').trim();
  if (!/^\d+:[\w-]{30,}$/.test(token)) throw new Error('Это не похоже на токен бота от @BotFather');
  PropertiesService.getScriptProperties().setProperty('TG_TOKEN', token);
  setupTelegram();
  return 'ok';
}

// Conversions API: событие Lead с тем же event_id, что у пикселя в браузере (Meta убирает дубли).
function capi_(p) {
  var token = PropertiesService.getScriptProperties().getProperty('CAPI_TOKEN');
  var pixel = PIXELS[p.page] || PIXELS['/'];
  if (!token || !pixel) return;
  var user = { client_user_agent: String(p.ua || '').slice(0, 500) };
  if (p.fbp) user.fbp = p.fbp;
  if (p.fbc) user.fbc = p.fbc;
  var phone = String(p.contact || '').replace(/\D/g, '');
  if (phone.length >= 9) user.ph = [sha256_(phone)];
  var fn = String(p.name || '').trim().split(/\s+/)[0].toLowerCase();
  if (fn) user.fn = [sha256_(fn)];
  var ev = {
    event_name: 'Lead', event_time: Math.floor(Date.now() / 1000), action_source: 'website',
    event_id: p.event_id || ('srv-' + Date.now()),
    event_source_url: p.url || ('https://atleads.pro' + (p.page || '/')),
    user_data: user,
    custom_data: { content_name: p.page || '/' }
  };
  var res = UrlFetchApp.fetch(GRAPH + pixel + '/events?access_token=' + encodeURIComponent(token), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ data: [ev] }), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) console.error('CAPI ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

// Вызывается со страницы настройки: сохраняет ключ Conversions API и проверяет доступ ко всем пикселям.
function saveCapi(token) {
  if (!isOwner_()) throw new Error('Нет доступа');
  token = String(token || '').trim();
  if (!/^EA[A-Za-z0-9]{40,}$/.test(token)) throw new Error('Это не похоже на ключ доступа Meta (начинается с EAA)');
  var ok = [], bad = [], seen = {};
  Object.keys(PIXELS).forEach(function (k) {
    var id = PIXELS[k]; if (seen[id]) return; seen[id] = 1;
    var r = UrlFetchApp.fetch(GRAPH + id + '?fields=name&access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    (r.getResponseCode() === 200 ? ok : bad).push(id);
  });
  if (!ok.length) throw new Error('Ключ не даёт доступа ни к одному пикселю');
  PropertiesService.getScriptProperties().setProperty('CAPI_TOKEN', token);
  return 'Сохранено. Доступ к пикселям: ' + ok.length + ' из ' + (ok.length + bad.length) + (bad.length ? '. Нет доступа: ' + bad.join(', ') : '');
}

var SETUP_HTML =
  '<div style="font:16px/1.5 system-ui,sans-serif;max-width:440px;margin:32px auto;padding:0 16px">' +
  '<h2 style="margin:0 0 12px">Telegram для заявок at leads</h2>' +
  '<ol style="padding-left:20px;margin:0 0 16px"><li>Откройте своего бота в Telegram и нажмите «Старт».</li>' +
  '<li>Вставьте токен бота от @BotFather и нажмите «Подключить».</li></ol>' +
  '<input id="t" placeholder="123456789:AA..." autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;font:inherit;border:1px solid #ccc;border-radius:10px">' +
  '<button id="b" style="margin-top:12px;width:100%;padding:12px;font:inherit;border:0;border-radius:10px;background:#1A44C2;color:#fff">Подключить</button>' +
  '<p id="s" style="margin-top:12px"></p>' +
  '<h2 style="margin:32px 0 12px">Conversions API (Meta)</h2>' +
  '<p style="margin:0 0 12px">Вставьте ключ доступа Meta и нажмите «Сохранить ключ».</p>' +
  '<input id="c" placeholder="EAA..." autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;font:inherit;border:1px solid #ccc;border-radius:10px">' +
  '<button id="cb" style="margin-top:12px;width:100%;padding:12px;font:inherit;border:0;border-radius:10px;background:#1A44C2;color:#fff">Сохранить ключ</button>' +
  '<p id="cs" style="margin-top:12px"></p></div>' +
  '<script>document.getElementById("b").onclick=function(){var s=document.getElementById("s");s.textContent="Подключаю…";' +
  'google.script.run.withSuccessHandler(function(){s.textContent="Готово: в Telegram пришло тестовое сообщение.";document.getElementById("t").value="";})' +
  '.withFailureHandler(function(e){s.textContent="Ошибка: "+e.message;}).saveTelegram(document.getElementById("t").value);};' +
  'document.getElementById("cb").onclick=function(){var s=document.getElementById("cs");s.textContent="Проверяю…";' +
  'google.script.run.withSuccessHandler(function(m){s.textContent=m;document.getElementById("c").value="";})' +
  '.withFailureHandler(function(e){s.textContent="Ошибка: "+e.message;}).saveCapi(document.getElementById("c").value);};</script>';

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME, 0);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm');
  }
  return sh;
}

// Защита от формул в ячейках (=, +, -, @ в начале строки).
function clean_(v) {
  v = String(v == null ? '' : v).slice(0, 2000);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function notify_(p) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TG_TOKEN'), chat = props.getProperty('TG_CHAT_ID');
  if (!token || !chat) return;
  var esc = function (s) {
    return String(s || '—').replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; });
  };
  var utm = [p.utm_source, p.utm_medium, p.utm_campaign].filter(String).join(' / ');
  var text = [
    '<b>Новая заявка at leads</b>',
    'Имя: ' + esc(p.name),
    'Контакт: ' + esc(p.contact),
    'Сфера: ' + esc(p.sphere),
    'Роль: ' + esc(p.role),
    'Бюджет: ' + esc(p.budget),
    'Запрос: ' + esc(p.request),
    '',
    'Страница: ' + esc(p.page),
    'UTM: ' + esc(utm)
  ].join('\n');
  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chat, text: text, parse_mode: 'HTML', disable_web_page_preview: true }),
    muteHttpExceptions: true
  });
}

// Запустить один раз после того, как написали боту /start.
function setupTelegram() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TG_TOKEN');
  if (!token) throw new Error('Добавьте свойство скрипта TG_TOKEN');
  var res = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates').getContentText());
  var upd = (res.result || []).reverse().filter(function (u) { return u.message && u.message.chat; })[0];
  if (!upd) throw new Error('Напишите боту /start и запустите снова');
  props.setProperty('TG_CHAT_ID', String(upd.message.chat.id));
  notify_({ name: 'Тест', contact: '—', request: 'Telegram подключён' });
}

// Создаёт лист с заголовками (можно запустить вручную).
function setupSheet() {
  sheet_();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
