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
 */
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

var SETUP_HTML =
  '<div style="font:16px/1.5 system-ui,sans-serif;max-width:440px;margin:32px auto;padding:0 16px">' +
  '<h2 style="margin:0 0 12px">Telegram для заявок at leads</h2>' +
  '<ol style="padding-left:20px;margin:0 0 16px"><li>Откройте своего бота в Telegram и нажмите «Старт».</li>' +
  '<li>Вставьте токен бота от @BotFather и нажмите «Подключить».</li></ol>' +
  '<input id="t" placeholder="123456789:AA..." autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;font:inherit;border:1px solid #ccc;border-radius:10px">' +
  '<button id="b" style="margin-top:12px;width:100%;padding:12px;font:inherit;border:0;border-radius:10px;background:#1A44C2;color:#fff">Подключить</button>' +
  '<p id="s" style="margin-top:12px"></p></div>' +
  '<script>document.getElementById("b").onclick=function(){var s=document.getElementById("s");s.textContent="Подключаю…";' +
  'google.script.run.withSuccessHandler(function(){s.textContent="Готово: в Telegram пришло тестовое сообщение.";document.getElementById("t").value="";})' +
  '.withFailureHandler(function(e){s.textContent="Ошибка: "+e.message;}).saveTelegram(document.getElementById("t").value);};</script>';

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
