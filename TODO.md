# TODO

- [ ] Different colors for -10%, -20% etc in Backtest results

## Bots

- [ ] Bots groups

## BackTests

- [ ] Load backtest presets (comissions, is public, etc from veles.finance)
- [ ] Retry backtest if 429 error
- [ ] Favorite backtests
- [ ] Export backtests links (public)
- [ ] Import backtests by links (public) - directly to aggregation
- [ ] block by position
- [ ] предупреждение если бектесты имеют разный период
- [ ] продливать активные сделки до конца максимального периода
- [ ] учет незакрытых сделок в метриках (например, средний профит за день)
- [ ] Кнопка "выбрать все" в таблице 
- [ ] Сортировка групп бектестов в дропдаунах по дате создания

## Other Features

- [ ] Symbols groups


## Dynamic block by bots

Цель - динамически регулировать максимальное количество одновременных открытых позиций по боту.

UI: пользователь может выбрать API-key и для каждого ключа настроить динамическу блокировку по количеству открытых позиций.
Настройки включают в себя данные:
- API-key
- Минимальное значение блокировки (например, 5) - MIN_POSITIONS_BLOCK
- Максимальное значение блокировки (например, 40) - MAX_POSITIONS_BLOCK
- Таймаут между изменениями (например, 10 минут) - TIMEOUT_BETWEEN_CHANGES

Текущее значение позиций будем обозначать как CURRENT_OPEN_POSITIONS
Текущее значение блокировки будем обозначать как CURRENT_POSITIONS_BLOCK
Период проверки будем обозначать как CHECK_PERIOD_SEC (например, 30 секунд)

Логика:
- Если CURRENT_OPEN_POSITIONS < CURRENT_POSITIONS_BLOCK - 1, то меняем блокировку на MAX(CURRENT_POSITIONS_BLOCK - 1, MIN_POSITIONS_BLOCK)
- Если CURRENT_OPEN_POSITIONS >= CURRENT_POSITIONS_BLOCK, то меняем блокировку на MIN(CURRENT_POSITIONS_BLOCK + 1, MAX_POSITIONS_BLOCK)
- При каждой "попытке" изменения блокировки ждем TIMEOUT_BETWEEN_CHANGES с момента последнего изменения. Делаем каждую попытку раз в CHECK_PERIOD_SEC секунд

Визуально я вижу что пользователь может вводить все ограничения, плюс видит мин/макс и текущее значение блокировки визуально, типа линия на которой видно как далеко до каждого значения.

Запросы к апи:
- Получение текущего списка блокировок
https://veles.finance/api/constraints
  [
  {
  "apiKeyId": 396430,
  "apiKeyName": "Binance Futures",
  "exchange": "BINANCE_FUTURES",
  "position": true,
  "limit": 4,
  "long": null,
  "short": null
  },
  {
  "apiKeyId": 469084,
  "apiKeyName": "ByF - Viral (D4)",
  "exchange": "BYBIT_FUTURES",
  "position": false,
  "limit": 10,
  "long": null,
  "short": null
  },
  {
  "apiKeyId": 445606,
  "apiKeyName": "ByF - Viral (\uD83C\uDF5E)",
  "exchange": "BYBIT_FUTURES",
  "position": true,
  "limit": 6,
  "long": null,
  "short": null
  },
  {
  "apiKeyId": 449391,
  "apiKeyName": "ByF - Pro100Trade",
  "exchange": "BYBIT_FUTURES",
  "position": true,
  "limit": 37,
  "long": null,
  "short": null
  }
]
- Обновление блокировки по API-key
curl 'https://veles.finance/api/constraints' \
  -X 'PUT' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: en-US,en;q=0.9,ru-RU;q=0.8,ru;q=0.7' \
  -H 'content-type: application/json' \
  -b '_ym_uid=1754604342789049727; _ym_d=1754604342; tmr_lvid=d9257c7008d570ae38aaf116b1ec854d; tmr_lvidTS=1754604372905; _gcl_au=1.1.886054789.1758004649; _ga=GA1.1.674907646.1758201366; _ga_Z0SZDH4E4Y=GS2.1.s1761064057$o35$g1$t1761064072$j45$l0$h0; __ddg1_=qrnsWRz2GGu4KRytpBhX; locale=ru; session_id=ZDYwMTY5ODgtYmEyYi00YjllLThjZTMtYmI3OGFiZGMzOGEx; __ddg9_=213.7.88.91; __ddg8_=dUIMQBe9TVaCCoTD; __ddg10_=1765447024' \
  -H 'origin: https://veles.finance' \
  -H 'priority: u=1, i' \
  -H 'referer: https://veles.finance/cabinet/account/locks' \
  -H 'sec-ch-ua: "Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36' \
  -H 'x-csrf-token: 603dde82-a5fe-4763-ad7e-7edd5e24052e' \
  --data-raw '{"apiKeyId":469084,"position":false,"limit":11,"short":null,"long":null}'
