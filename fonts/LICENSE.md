# Шрифты в репозитории

Все три семейства распространяются по SIL Open Font License 1.1, которая прямо
разрешает включать шрифт в состав продукта. Файлы лежат здесь, а не грузятся
с CDN: дашборд обязан работать без интернета (конституция V, SC-011).

| Файл | Семейство | Автор | Лицензия |
|---|---|---|---|
| `BricolageGrotesque.woff2` | Bricolage Grotesque | Mathieu Triay | OFL 1.1 |
| `IBMPlexSans.woff2`, `IBMPlexSans-cyrillic.woff2` | IBM Plex Sans | IBM / Bold Monday | OFL 1.1 |
| `MartianMono.woff2`, `MartianMono-cyrillic.woff2` | Martian Mono | Evil Martians | OFL 1.1 |

Кириллические файлы отдельные, потому что интерфейс русский: подключены через
`unicode-range`, поэтому браузер скачивает только нужный набор.

Полные тексты лицензий: <https://github.com/google/fonts> — каталоги
`ofl/bricolagegrotesque`, `ofl/ibmplexsans`, `ofl/martianmono`.
