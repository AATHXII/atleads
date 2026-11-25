/**
 * at leads: приём заявок с сайта atleads.pro.
 * Пишет заявку строкой в лист «Заявки» и шлёт уведомление в Telegram.
 *
 * Настройка (один раз):
 * 1. Расширения → Apps Script, вставить этот код, сохранить.
 * 2. Настройки проекта → Свойства скрипта: TG_TOKEN = токен бота от @BotFather.
 * 3. Написать боту /start, затем запустить функцию setupTelegram — она найдёт chat id
 *    и пришлёт тестовое сообщение.
 * 4. Развернуть → Новое развертывание → Веб-приложение:
 *    «Запуск от имени: я», «Доступ: все». URL вставить в assets/site.js (LEADS_URL).
 * Токен в код и в репозиторий не вписывать.
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

function doGet() {
  return json_({ ok: true, service: 'at leads' });
}

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
