# Brave Development — UI refinement

Citlivé UI vylepšení šablony **Brave Development** (IMPnet, PHP/Nette + UIkit 3.17)
nad demo webem <https://demo.bravedevelopment.cz/>. Nejde o redesign: logo, barvy,
písmo Poppins, obsah, pořadí sekcí, struktura stránek i všechny funkce zůstávají.
Mění se jen prezentace — šířky a kontejnery, mezery, hierarchie, rámečky, stavy
a chování hlavičky.

**Náhled:** <https://hutterlukas22-dot.github.io/brave-development-ui/>
— vlevo dole přepínač **Upravená / Původní** (pamatuje si volbu; také `?puvodni` / `?upravene`).

## Co je výstup

| Soubor | Co to je |
|---|---|
| `refine/brave-refine.css` | Vrstva úprav — vložit do šablony **jako poslední stylopis** po CSS bundlu. |
| `refine/brave-refine.js` | Chování hlavičky (skrývání při scrollu) — vložit s `defer` po JS bundlu. |
| `refine/src/*.css` | Zdroj vrstvy rozdělený podle oblastí (tokeny, hlavička, layout, stránky…). Pro přepis do SCSS šablony po komponentách. |

Nasazení do šablony (Latte, layout):

```html
<link rel="stylesheet" href="{$basePath}/www/Development/css/brave-refine.css">
<script src="{$basePath}/www/Development/js/brave-refine.js" defer></script>
```

Hlavička: JS ruší UIkit `data-uk-sticky="show-on-up: true"` na `section.topBar`
a řídí ji sám (třídy `rf-nav-hidden` / `rf-nav-scrolled` na `<html>`). Při přepisu
do šablony stačí atribut ze šablony odebrat.

## Statický náhled (GitHub Pages)

Živý web běží na serveru, náhled je jeho **statická kopie** (`docs/`) s vloženou
vrstvou úprav. Co funguje: všechny stránky, odkazy, galerie a lightboxy, 360°
panoráma, mapy (data uložená z AJAX endpointů), interaktivní výběr domu/patra,
přepínání zobrazení, záložky, akordeony, kalkulačky, offcanvas menu.

Co bez serveru fungovat nemůže (na živém webu ano — vrstva úprav do nich nezasahuje):
odeslání formulářů, přidání do oblíbených a porovnání, libovolné kombinace filtru
(staženy jsou jen varianty, na které web odkazuje), přepnutí jazyka.

## Nástroje

```bash
npm install                 # playwright-core (systémový Edge), stylelint
node tools/mirror.mjs       # stáhne živý web do mirror/ (cache, necommituje se)
node tools/build.mjs        # složí docs/ = statický web + vrstva úprav
node tools/build.mjs --refine-only   # jen přestaví refine/*.css|js
node tools/serve.mjs 5320   # http://localhost:5320/brave-development-ui/
node tools/shots.mjs --mode=both     # screenshoty Původní/Upravená (shots/)
node tools/check.mjs        # přetečení, konzole, obrázky, chování hlavičky
node tools/header-fit.mjs   # vejde se hlavička na 1200–1920 px?
```

