# at leads — сайт

Статичный сайт at leads: https://atleads.pro. Хостинг Netlify, автодеплой из ветки `main`.

- Страницы: `index.html` (общая), `nedvizhimost.html`, `medicina.html`, `rf-target.html`, `privacy.html`.
- Заявки: Google Apps Script (apps-script/leads.gs) → Google Таблица «at leads — заявки с сайта» + Telegram. В заявку пишутся страница, UTM-метки, fbclid/gclid и источник перехода.
- ID GA4, Meta Pixel, URL приёма заявок и номер WhatsApp задаются в начале `assets/site.js`.
