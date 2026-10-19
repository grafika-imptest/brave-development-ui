// V3 homepage (lokální koncept): docs/v3/index.html ze skutečných dat šablony.
//   node tools/v2-extract.mjs && node tools/build-v3.mjs
// Jen úvodní stránka; odkazy vedou na stávající (upravené) podstránky.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'node-html-parser';
import { createRewriter } from './lib-rewrite.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'v3');
const BASE = (process.env.BASE ?? '/brave-development-ui').replace(/\/$/, '');
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'mirror', 'manifest.json'), 'utf8'));
const { mapUrl, rewriteHtml } = createRewriter({ BASE, manifest });
const D = JSON.parse(await fs.readFile(path.join(ROOT, 'v3', 'data.json'), 'utf8'));
const shim = (await fs.readFile(path.join(ROOT, 'tools', 'static-shim.js'), 'utf8')).replace('__BASE__', BASE);
const home = parse(await fs.readFile(path.join(ROOT, 'mirror', 'raw', manifest['/'].file), 'utf8'));

const u = p => (p ? mapUrl(p) || p : '');
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const fmt = n => n.toLocaleString('cs-CZ').replace(/ /g, ' ');
const pl = (n, a, b, c) => (n === 1 ? a : n >= 2 && n <= 4 ? b : c);
const units = D.units;
const free = units.filter(x => x.state === 'available');

/* Rychlé vyhledávání šablony (stejné názvy polí a hodnoty) */
const qs = parse(D.quickSearch);
const sel = name => qs.querySelectorAll(`select[name="${name}"] option`).map(o => ({ v: o.getAttribute('value'), l: txt(o) }));
const Q = { dispo: sel('quickDisposition[]'), floor: sel('quickFloor[]'), area: sel('quickArea[]'), price: sel('quickPrice[]') };
const hidden = qs.querySelectorAll('input[type="hidden"]').map(i => `<input type="hidden" name="${esc(i.getAttribute('name'))}" value="${esc(i.getAttribute('value'))}">`).join('');
const floorByPart = Object.fromEntries(D.floors.map(f => [f.partId, f.id]));

/* „Vyberte si podle dispozice“ — hodnoty spočítané serverem šablony */
const show = home.querySelectorAll('[data-disposition-showcase] .tab').map(t => {
	const id = t.getAttribute('data-disposition-tab');
	const panel = home.querySelector(`[data-disposition-panel="${id}"]`);
	return {
		name: txt(t.querySelector('.tab__name')),
		count: Number(txt(t.querySelector('.tab__count'))) || 0,
		link: panel.querySelector('.panel__link a').getAttribute('href'),
		blds: panel.querySelectorAll('.building').map(b => ({
			name: txt(b.querySelector('h4')),
			count: txt(b.querySelector('.count')),
			price: txt(b.querySelector('.price strong')),
			area: b.querySelector('.area strong').innerHTML.trim(),
		})),
	};
});

const icon = {
	area: '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2zM2 6h4V2M14 10h-4v4"/></svg>',
	key: '<svg viewBox="0 0 16 16"><circle cx="5" cy="8" r="3"/><path d="M8 8h6M12 8v2.5M14 8v2"/></svg>',
	bld: '<svg viewBox="0 0 16 16"><path d="M3 14V3h6v11M9 6h4v8M1 14h14M5 5.5h2M5 8h2M5 10.5h2"/></svg>',
	layers: '<svg viewBox="0 0 16 16"><path d="M8 2 1.5 5.5 8 9l6.5-3.5zM1.5 8.5 8 12l6.5-3.5"/></svg>',
	plus: '<svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg>',
	trash: '<svg viewBox="0 0 16 16"><path d="M3 4h10M6 4V2.5h4V4M4.5 4l.7 9.5h5.6l.7-9.5"/></svg>',
	heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
	cmp: '<svg viewBox="0 0 24 24"><path d="M12 4v16M5 20h14M4 8h16M7 8l-3 6a3 3 0 0 0 6 0L7 8zm10 0-3 6a3 3 0 0 0 6 0l-3-6z"/></svg>',
	home: '<svg viewBox="0 0 16 16"><path d="M2 7.5 8 2l6 5.5M3.5 6.5V14h9V6.5"/></svg>',
	mail: '<svg viewBox="0 0 16 16"><path d="M1.5 3.5h13v9h-13zM1.5 3.5 8 9l6.5-5.5"/></svg>',
	phone: '<svg viewBox="0 0 16 16"><path d="M5.5 1.5 3 2.2c-.8 5 4.2 10.6 9.8 10.8l.7-2.5-2.8-1.5-1.5 1.4C7.3 9.5 6.4 8.4 5.6 6.3l1.4-1.4z"/></svg>',
};

/* ----------------------------- sekce ----------------------------- */
const C = D.contact;
const nav = D.nav;
const navLinks = nav.map(n => `<a href="${u(n.href)}">${esc(n.label)}</a>`).join('');
const langs = home.querySelectorAll('header .languageSwitcher [data-uk-dropdown] a').map(a => ({ href: a.getAttribute('href'), label: txt(a), on: a.parentNode.classList.contains('uk-active') }));
const favN = txt(home.querySelector('#snippet--reoUnitFavorite')) || '0';
const cmpN = txt(home.querySelector('#snippet--reoUnitComparison')) || '0';

const header = `<header class="nav">
	<div class="w nav__in">
		<a class="nav__logo" href="${BASE}/v3/" aria-label="${esc(D.project.name)}"><img src="${u(D.project.logo)}" alt="${esc(D.project.name)}" width="233" height="59"></a>
		<nav class="nav__links" aria-label="Hlavní menu">${navLinks}</nav>
		<div class="nav__right">
			<a class="nav__icon" href="${u('/oblibene-nemovitosti')}" title="Oblíbené" aria-label="Oblíbené (${favN})">${icon.heart}<span class="n">${esc(favN)}</span></a>
			<a class="nav__icon" href="${u('/porovnani-jednotek')}" title="Porovnání" aria-label="Porovnání (${cmpN})">${icon.cmp}<span class="n">${esc(cmpN)}</span></a>
			<div class="nav__lang"><button type="button" aria-haspopup="true" aria-expanded="false" aria-label="Jazyk">${esc((langs.find(l => l.on) || langs[0] || { label: 'CS' }).label)} <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button>
				<ul>${langs.map(l => `<li><a href="${u(l.href)}"${l.on ? ' aria-current="true"' : ''}>${esc(l.label)}${l.on ? ' <span>✓</span>' : ''}</a></li>`).join('')}</ul></div>
			<a class="btn btn--line nav__cta" href="${u('/nabidka-nemovitosti')}">${icon.home}Volné byty a ceník</a>
			<button class="nav__burger" type="button" data-burger aria-expanded="false" aria-controls="drawer" aria-label="Menu"><i></i></button>
		</div>
	</div>
</header>
<div class="drawer" id="drawer">
	<ul>${nav.map(n => `<li><a href="${u(n.href)}">${esc(n.label)}<span aria-hidden="true">→</span></a></li>`).join('')}</ul>
	<div class="drawer__tools">
		<a class="btn" href="${u('/nabidka-nemovitosti')}">Volné byty a ceník</a>
		<a class="btn btn--line" href="${u('/oblibene-nemovitosti')}">Oblíbené (${esc(favN)})</a>
		<a class="btn btn--line" href="${u('/porovnani-jednotek')}">Porovnání (${esc(cmpN)})</a>
		${langs.map(l => `<a class="btn btn--line" href="${u(l.href)}">${esc(l.label)}</a>`).join('')}
	</div>
</div>`;

function panorama() {
	let h = D.panorama.replace(/<form class="panoramaHero__quickSearch"[\s\S]*?<\/form>/, '');
	h = h.replace(/<h1 id="(panorama-title-\d+)">([\s\S]*?)<\/h1>/, '<p id="$1">$2</p>');
	return `<script type="module" src="${u('/v3/assets/panorama360.js')}"></script>${rewriteHtml(h)}`;
}

// Panoráma přes celý hero, přes něj vlevo úzký pruh s textem a pod ním vyhledávač — vše v první obrazovce
const hero = () => `<section class="hero">
	<div class="hero__pano">${panorama()}<div class="panoHint" aria-hidden="true"><span class="panoHint__hand"><svg viewBox="0 0 32 32"><path d="M12.5 17.5V6.8a2 2 0 0 1 4 0v8.4m0-1.6v-1.4a2 2 0 0 1 4 0v2.2m0-.6a2 2 0 0 1 4 0v1.6m0 0a2 2 0 0 1 3.6-.9c.3.4.4.9.4 1.4v4.6c0 4.4-3.3 7.5-7.6 7.5h-1.6c-2.6 0-4.4-1.1-5.9-3.2l-4.1-5.9a2 2 0 0 1 3.1-2.5l1.9 2.1"/></svg></span><span class="panoHint__txt">Táhněte a rozhlédněte se 360°</span></div></div>
	<div class="hero__over">
		<div class="w hero__in">
			<div class="hero__copy">
				<p class="eyebrow hero__eyebrow">${esc(D.project.name)} · ${esc(D.project.eyebrow.split('·')[0].trim())}</p>
				<h1 class="h1 hero__h1">Najděte domov na klidném severu Brna</h1>
				<p class="lead hero__lead">${esc(D.project.lead)}</p>
				<div class="hero__cta"><a class="btn btn--white" href="${u('/nabidka-nemovitosti')}">Zobrazit všechny byty</a><a class="btn btn--glass" href="${u('/kontakty')}">Domluvit prohlídku</a></div>
			</div>
			${search}
		</div>
	</div>
</section>`;

const search = `<form class="srch hero__srch" data-search action="${u('/nabidka-nemovitosti')}" method="get" aria-label="Rychlé vyhledávání bytů" data-r>
			<div class="tabs" role="tablist" aria-label="Dům">
				<button type="button" role="tab" data-bld="" aria-selected="true">Všechny byty</button>
				${[...new Set(D.floors.map(f => f.building))].map(b => `<button type="button" role="tab" data-bld="${b}" aria-selected="false">Dům ${b}</button>`).join('')}
			</div>
			<div class="filter">
				<div class="filter__row">
					<div class="field"><label for="q-d">Dispozice</label><select id="q-d" name="quickDisposition[]"><option value="">Všechny dispozice</option>${Q.dispo.map(o => `<option value="${o.v}">${esc(o.l)}</option>`).join('')}</select></div>
					<div class="field"><label for="q-f">Patro</label><select id="q-f" name="quickFloor[]"><option value="">Všechna podlaží</option>${Q.floor.map(o => `<option value="${o.v}" data-b="${o.l.match(/Dům ([AB])/)[1]}">${esc(o.l)}</option>`).join('')}</select></div>
					<div class="field"><label for="q-a">Užitná plocha</label><select id="q-a" name="quickArea[]"><option value="">Všechny plochy (m²)</option>${Q.area.map(o => `<option value="${o.v}">${esc(o.l)}</option>`).join('')}</select></div>
					<div class="field"><label for="q-p">Cena</label><select id="q-p" name="quickPrice[]"><option value="">Všechny ceny</option>${Q.price.map(o => `<option value="${o.v}">${esc(o.l)}</option>`).join('')}</select></div>
				</div>
				${hidden}
				<div class="filter__foot">
					<a class="btn btn--ghost" href="${u('/nabidka-nemovitosti')}">${icon.plus}Další možnosti</a>
					<span class="filter__count" data-count aria-live="polite"></span>
					<div class="sp"><button class="btn btn--ghost" type="button" data-clear>${icon.trash}Vymazat filtry</button><button class="btn" type="submit">Zobrazit byty</button></div>
				</div>
			</div>
		</form>`;

const dispoCards = `<section class="sec">
	<div class="w">
		<div class="head" data-r><h2 class="h2">Byty podle dispozice</h2><p class="lead">Rychlý přehled volných bytů v obou domech. Kliknutím zobrazíte všechny byty dané dispozice.</p></div>
		<div class="cards">${show.map(s => {
			const pick = units.find(x => x.dispo === s.name && x.state === 'available' && x.gallery[0]) || units.find(x => x.dispo === s.name && x.gallery[0]);
			const all = units.filter(x => x.dispo === s.name);
			const prices = s.blds.map(b => Number(b.price.replace(/\D/g, ''))).filter(Boolean);
			const aMax = Math.max(...all.map(x => x.area)), aMin = Math.min(...all.map(x => x.area));
			return `<a class="card" href="${u(s.link)}" data-r>
				<div class="card__img">${pick ? `<img src="${u(pick.gallery[0].webp || pick.gallery[0].src)}" alt="Vizualizace interiéru, byt ${esc(pick.code)}" loading="lazy" width="1113" height="660">` : ''}<span class="card__badge">${s.count} ${pl(s.count, 'volný', 'volné', 'volných')}</span></div>
				<div class="card__body">
					<div class="card__top"><h3 class="card__title">Byty ${esc(s.name)}</h3><span class="card__price">${prices.length ? 'od ' + fmt(Math.min(...prices)) + ' Kč' : '—'}</span></div>
					<p class="card__sub">Bytový komplex Hálkova · ${esc(s.blds.map(b => b.name.replace('Budova', 'Dům')).join(' · '))}</p>
					<dl class="card__bld">${s.blds.map(b => `<dt>${esc(b.name)}</dt><dd>${esc(b.count)} · od ${esc(b.price)}</dd>`).join('')}</dl>
					<div class="meta"><span>${icon.area}${String(aMin).replace('.', ',')}–${String(aMax).replace('.', ',')} m²</span><span>${icon.layers}${all.length} ${pl(all.length, 'byt', 'byty', 'bytů')} v projektu</span></div>
				</div>
			</a>`;
		}).join('')}</div>
	</div>
</section>`;

/* Vizualizace domu + statistiky s mini grafy */
const floorsSorted = [...D.floors].sort((a, b) => a.building.localeCompare(b.building) || a.number - b.number);
const ffree = f => units.filter(x => x.floorId === f.id && x.state === 'available').length;
const maxFree = Math.max(...floorsSorted.map(ffree), 1);
const dispos = show.map(s => s.name);
const minPriceBy = d => { const p = free.filter(x => x.dispo === d).map(x => x.priceValue); return p.length ? Math.min(...p) : 0; };
const maxMin = Math.max(...dispos.map(minPriceBy), 1);
const cntBy = d => units.filter(x => x.dispo === d).length;
const maxCnt = Math.max(...dispos.map(cntBy), 1);
const bar = (v, max, t) => `<i style="height:${Math.max(6, Math.round((v / max) * 100))}%" data-t="${esc(t)}"></i>`;
const minP = Math.min(...free.map(x => x.priceValue));
const V = D.viz;
const bands = V.areas.map(a => {
	const f = D.floors.find(x => x.url === a.href);
	if (!f) return '';
	const fr = ffree(f), all = units.filter(x => x.floorId === f.id).length;
	const p = a.coords.split(',').map(Number); const pts = []; for (let i = 0; i < p.length; i += 2) pts.push(p[i] + ',' + p[i + 1]);
	return `<a href="${u(a.href)}" aria-label="${esc(f.label)}: ${fr} ${pl(fr, 'volný byt', 'volné byty', 'volných bytů')} z ${all}"><polygon class="band${fr ? '' : ' is-sold'}" points="${pts.join(' ')}" data-tip="${esc(`<b>${f.label}</b><span>Volné byty <strong>${fr} z ${all}</strong></span>`)}"></polygon></a>`;
}).join('');
const house = `<section class="sec">
	<div class="w">
		<div class="head" data-r><h2 class="h2">${esc(V.title.replace(/\s+/g, ' '))}</h2><p class="lead">Najeďte na podlaží a uvidíte, kolik bytů je na něm volných. Kliknutím otevřete jeho půdorys.</p></div>
		<div class="kpis" data-r>
			<div class="kpi"><span class="label">Volné byty</span><span class="kpi__val">${free.length}<small>z ${units.length}</small></span><div class="bars" aria-label="Volné byty podle podlaží">${floorsSorted.map(f => bar(ffree(f), maxFree, `${f.label}: ${ffree(f)}`)).join('')}</div></div>
			<div class="kpi"><span class="label">Ceny volných bytů od</span><span class="kpi__val">${fmt(minP)}<small>Kč</small></span><div class="bars" aria-label="Nejnižší cena podle dispozice">${dispos.map(d => bar(minPriceBy(d), maxMin, `${d}: od ${fmt(minPriceBy(d))} Kč`)).join('')}</div></div>
			<div class="kpi"><span class="label">Dispozice v projektu</span><span class="kpi__val">${esc(dispos[0])} – ${esc(dispos[dispos.length - 1])}</span><div class="bars" aria-label="Počet bytů podle dispozice">${dispos.map(d => bar(cntBy(d), maxCnt, `${d}: ${cntBy(d)} bytů`)).join('')}</div></div>
		</div>
		<div class="house" data-house data-r>
			<img src="${u(V.img)}" alt="Vizualizace bytových domů A a B" width="${V.width}" height="${V.height}" loading="lazy">
			<svg viewBox="0 0 ${V.width} ${V.height}" preserveAspectRatio="none" aria-label="Podlaží domů">${bands}</svg>
			<span class="tag">Vizualizace</span>
			<div class="house__tip" aria-hidden="true"></div>
		</div>
		<div class="house__bar">
			<div class="floors">${floorsSorted.map(f => `<a href="${u(f.url)}">${esc(f.label)}<i>${ffree(f)}</i></a>`).join('')}</div>
			<a class="btn" href="${u('/nabidka-nemovitosti')}">Zobrazit všechny byty</a>
		</div>
	</div>
</section>`;

const L = D.location;
// Ikona bodu lokality podle obsahu (stejná sada jako piny v panoramatu)
const pointIcon = p => /sport/i.test(p) ? 'mdi-basketball' : /ZŠ|MŠ|škol/i.test(p) ? 'mdi-school-outline' : /restaur/i.test(p) ? 'mdi-silverware-fork-knife' : /lékár|obchod/i.test(p) ? 'mdi-store-outline' : /MHD|zastáv/i.test(p) ? 'mdi-bus-stop' : 'mdi-map-marker-outline';

const loc = `<section class="sec">
	<div class="w">
		<div class="head" data-r><h2 class="h2">${esc(L.title.replace(/\s+/g, ' '))}</h2><p class="lead">${esc(L.eyebrow.charAt(0) + L.eyebrow.slice(1).toLowerCase())}. ${esc(D.geo ? D.geo.address : '')}</p></div>
		<div class="split" data-r>
			<div class="panel">
				<h3 class="h3">Vše důležité v docházkové vzdálenosti</h3>
				<p>${esc(L.text)}</p>
				<ul class="checks">${L.points.map(p => `<li><i class="mdi ${pointIcon(p)}" aria-hidden="true"></i>${esc(p)}</li>`).join('')}</ul>
				<a class="btn btn--line" href="${u(L.more)}">Více o lokalitě</a>
			</div>
			<div class="mapBox">${rewriteHtml(L.mapHtml).replace(/data-map-markers-endpoint="[^"]*"/, `data-map-markers-endpoint="${BASE}/v3/assets/map-markers.json"`).replace(/data-map-options-endpoint="[^"]*"/, `data-map-options-endpoint="${BASE}/v3/assets/map-options.json"`)}</div>
		</div>
	</div>
</section>`;

const G = D.gallery;
const gallery = `<section class="sec">
	<div class="w">
		<div class="head" data-r><h2 class="h2">${esc(G.title)}</h2><p class="lead">Vizualizace exteriérů a interiérů projektu. Kliknutím obrázek zvětšíte.</p></div>
		<div class="gallery" data-r>${G.items.map((g, i) => `<button type="button" data-lb="${u(g.full)}" aria-label="Vizualizace ${i + 1}"><img src="${u(g.webp || g.src)}" alt="Vizualizace projektu ${i + 1}" loading="lazy"></button>`).join('')}</div>
		<div class="gallery__foot"><span class="label">${G.items.length} vizualizací na úvodu · další v galerii</span><a class="btn btn--line" href="${u(G.more)}">Zobrazit galerii</a></div>
	</div>
</section>`;

const N = D.news;
const news = `<section class="sec">
	<div class="w">
		<div class="head" data-r><h2 class="h2">${esc(N.title)}</h2><p class="lead">${esc(N.eyebrow.charAt(0) + N.eyebrow.slice(1).toLowerCase())}: novinky ze stavby a z prodeje.</p></div>
		<div class="rows">${N.items.map(n => `<article class="row" data-r>
			<a class="row__img" href="${u(n.href)}" tabindex="-1" aria-hidden="true"><img src="${u(n.img.webp || n.img.src)}" alt="" loading="lazy" width="500" height="400"></a>
			<div class="row__body">
				<h3><a href="${u(n.href)}">${esc(n.title)}</a></h3>
				<div class="row__meta">${n.meta.map(m => `<span>${esc(m)}</span>`).join('')}</div>
				<p>${esc(n.text)}</p>
				<div class="acts"><a class="btn" href="${u(n.href)}">Číst článek</a></div>
			</div>
			<div class="row__aside"><span class="v">${esc(n.meta[0] || '')}</span><span class="label">Publikováno</span><span class="v">${esc(n.meta[1] || '')}</span><span class="label">Kategorie</span></div>
		</article>`).join('')}</div>
		<div class="gallery__foot"><span></span><a class="btn btn--line" href="${u(N.more)}">Všechny aktuality</a></div>
	</div>
</section>`;

const footer = `<footer class="foot">
	<div class="w">
		<div class="foot__top">
			<div class="foot__brand"><img src="${u(D.project.logo)}" alt="${esc(D.project.name)}" width="233" height="59"><p>${esc(C.officeLabel)}<br>${esc(C.office)}</p>
				<div class="foot__social">${C.social.map(s => `<a href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="${esc(s.label)}">${esc(s.label.slice(0, 2))}</a>`).join('')}</div></div>
			<div><h4>Navigace</h4><ul>${nav.map(n => `<li><a href="${u(n.href)}">${esc(n.label)}</a></li>`).join('')}</ul></div>
			<div><h4>Nástroje</h4><ul><li><a href="${u('/investicni-kalkulacka')}">Investiční kalkulačka</a></li><li><a href="${u('/oblibene-nemovitosti')}">Oblíbené</a></li><li><a href="${u('/porovnani-jednotek')}">Porovnání</a></li></ul></div>
			<div><h4>Kontakt</h4><ul><li><a href="${C.phoneHref}">${esc(C.phone)}</a></li><li><a href="${C.emailHref}">${esc(C.email)}</a></li></ul><a class="btn" href="${u('/nabidka-nemovitosti')}" style="margin-top:10px">Volné byty a ceník</a></div>
		</div>
		<div class="foot__bot"><a href="${u(C.legal.href)}">${esc(C.legal.label)}</a><span>${esc(C.copy)} <a href="https://www.impnet.cz/" target="_blank" rel="noopener"><img src="${u('/www/Development/images/impnet.png')}" alt="IMPnet"></a></span></div>
	</div>
</footer>
<div class="contactWidget"><a href="${C.emailHref}">${icon.mail}${esc(C.email)}</a><a href="${C.phoneHref}">${icon.phone}${esc(C.phone)}</a></div>`;

const json = {
	dispos: Object.fromEntries(Q.dispo.map(o => [o.v, o.l])),
	floorByPart,
	units: units.map(x => ({ s: x.state, d: x.dispo, f: x.floorId, b: x.building, a: x.area, p: x.priceValue })),
};

const html = `<!doctype html>
<html lang="cs" class="v3 no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(D.project.name)} — nové byty v Brně (V3)</title>
<meta name="description" content="${esc(D.project.lead)}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="${u('/www/upload/f0dec1d8/favicon-brave/favicon-brave.32x32.exact.png')}">
<script>${shim}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.2/dist/leaflet.css" crossorigin>
<link rel="stylesheet" href="${BASE}/v3/assets/v3.css">
<script src="${u(D.scripts.bundleJs)}"></script>
</head>
<body>
<a class="skip" href="#obsah">Přeskočit na obsah</a>
${header}
<main id="obsah">
${hero()}
${dispoCards}
${house}
${loc}
${gallery}
${news}
</main>
${footer}
<script type="application/json" id="v3-data">${JSON.stringify(json)}</script>
<script src="${BASE}/v3/assets/v3.js" defer></script>
</body>
</html>`;

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, 'assets'), { recursive: true });
const css = (await fs.readFile(path.join(ROOT, 'v2', 'src', 'vendor-panorama.css'), 'utf8')) + '\n' + (await fs.readFile(path.join(ROOT, 'v3', 'src', 'v3.css'), 'utf8'));
await fs.writeFile(path.join(OUT, 'assets', 'v3.css'), css);
await fs.copyFile(path.join(ROOT, 'v3', 'src', 'v3.js'), path.join(OUT, 'assets', 'v3.js'));
// Mapa lokality: vlastní piny — projekt = zelený pin s „B“ z loga, body okolí = ikony jako v panoramatu
{
	const mdi = await import('@mdi/js');
	const G = '#42c787';
	const logo = await fs.readFile(path.join(ROOT, 'docs', 'www', 'upload', 'f0dec1d8', 'logo-development.svg'), 'utf8');
	const bPath = logo.match(/<path d="([^"]+)"/)[1]; // první tvar loga = písmeno B (0–49 × 0–36)
	const mainSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><path d="M40 78C40 78 13 51 13 33a27 27 0 1 1 54 0C67 51 40 78 40 78Z" fill="${G}" stroke="#fff" stroke-width="2.5"/><path d="${bPath}" fill="#fff" transform="translate(25.6 22.6) scale(0.6)"/></svg>`;
	const poiSvg = p => `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><line x1="30" y1="34" x2="30" y2="60" stroke="${G}" stroke-width="1.5"/><circle cx="30" cy="18" r="16" fill="#fff"/><circle cx="30" cy="18" r="14" fill="${G}"/><path d="${p}" fill="#fff" transform="translate(21 9) scale(0.75)"/></svg>`;
	const pick = m => {
		const t = m.title, c = (m.categories || [])[0]?.name || '';
		if (/sport/i.test(c)) return 'mdiBasketball';
		if (/přírod/i.test(c)) return 'mdiTreeOutline';
		if (/kostel/i.test(t)) return 'mdiChurchOutline';
		if (/ZŠ|MŠ|škol/i.test(t)) return 'mdiSchoolOutline';
		if (/MHD|zastáv/i.test(t)) return 'mdiBusStop';
		if (/aktivit/i.test(c)) return 'mdiSilverwareForkKnife';
		return 'mdiStoreOutline';
	};
	const src = JSON.parse(await fs.readFile(path.join(ROOT, 'docs', '_data', 'urban-park-brno-do-map-contact-markers.json'), 'utf8'));
	await fs.mkdir(path.join(OUT, 'assets', 'pins'), { recursive: true });
	await fs.writeFile(path.join(OUT, 'assets', 'pins', 'projekt.svg'), mainSvg);
	const used = new Set();
	const markers = src.map(m => {
		const isMain = !m.categories || !m.categories.length;
		const name = isMain ? 'projekt' : pick(m).replace(/^mdi/, '').toLowerCase();
		if (!isMain && !used.has(name)) { used.add(name); }
		const icon = `${BASE}/v3/assets/pins/${name}.svg`;
		return { ...m, icon, content: isMain ? m.content : m.content.replace(/(<span class="ico"><img src=")[^"]+/, '$1' + icon) };
	});
	for (const n of used) {
		const key = 'mdi' + Object.keys(mdi).find(k => k.toLowerCase() === 'mdi' + n).slice(3);
		await fs.writeFile(path.join(OUT, 'assets', 'pins', n + '.svg'), poiSvg(mdi[key]));
	}
	await fs.writeFile(path.join(OUT, 'assets', 'map-markers.json'), JSON.stringify(markers));
	const opt = JSON.parse(await fs.readFile(path.join(ROOT, 'docs', '_data', 'do-map-main-options.json'), 'utf8'));
	await fs.writeFile(path.join(OUT, 'assets', 'map-options.json'), JSON.stringify({ ...opt, zoom: 16 }));
}

// Kopie panoramatu šablony, která zpřístupní instanci prohlížeče (pro jemnou samorotaci ve v3.js)
const pano = await fs.readFile(path.join(ROOT, 'docs', 'www', 'assets', 'panorama360.js'), 'utf8');
if (!pano.includes('h = new sf({') || !pano.includes('N_ = import.meta.url.slice(0, import.meta.url.lastIndexOf("/") + 1)')) throw new Error('panorama360.js: nenalezena inicializace prohlížeče');
await fs.writeFile(path.join(OUT, 'assets', 'panorama360.js'), pano.replace('h = new sf({', 'h = t.__psv = new sf({')
	// styly prohlížeče zůstávají u originálu ve www/assets
	.replace('N_ = import.meta.url.slice(0, import.meta.url.lastIndexOf("/") + 1)', 'N_ = new URL("../../www/assets/", import.meta.url).href'));
await fs.writeFile(path.join(OUT, 'index.html'), html);
console.log(`docs/v3/index.html (${show.length} dispozic, ${D.floors.length} podlaží, BASE=${BASE})`);
