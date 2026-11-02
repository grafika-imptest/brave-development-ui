/* Brave Development — UI refinement layer (JS)
   Jen chování prezentace, žádná nová funkce:
   1) chytrá hlavička — schová se při scrollu dolů, vrátí při scrollu nahoru,
      u horního okraje je vždy vidět; bez blikání díky prahům a rAF,
   2) třídy rf-nav-hidden / rf-nav-scrolled na <html> — z nich CSS
      odvozuje --rf-nav-offset pro sticky prvky (filtr bytů).
   Načítá se s defer po bundlu šablony (jQuery + UIkit už existují). */
(function () {
	'use strict';

	var root = document.documentElement;
	if (root.classList.contains('refine-off')) return;
	root.classList.add('rf-on');

	/* Oblasti pater ve vizualizaci domu (originální pixely 1600 × 800) podle skutečných
	   hran stropů — v datech šablony je horní ustoupené patro přes celou šířku domu
	   a přízemí přesahuje do zeleně. Musí se přepsat hned (před přepočtem šablony
	   na DOMContentLoaded), proto mimo ready(). Klíč = adresa patra. */
	var FLOOR_SHAPES = {
		'20260831070015086': {
			'dum-a-4-np': '252,286,705,286,705,344,252,344',
			'dum-a-3-np': '185,344,737,344,737,414,185,414',
			'dum-a-2-np': '185,414,737,414,737,477,185,477',
			'dum-a-1-np': '185,477,737,477,737,537,185,537',
			'dum-b-6-np': '892,255,1273,255,1273,303,892,303',
			'dum-b-5-np': '849,303,1326,303,1326,355,849,355',
			'dum-b-4-np': '849,355,1326,355,1326,405,849,405',
			'dum-b-3-np': '849,405,1326,405,1326,456,849,456',
			'dum-b-2-np': '849,456,1326,456,1326,506,849,506',
			'dum-b-1-np': '849,506,1326,506,1326,556,849,556'
		}
	};
	function imgKey(img) { return (img.getAttribute('src') || '').replace(/^.*\/(\d{10,})[^/]*$/, '$1'); }
	function floorKey(a) { return ((a.getAttribute('href') || '').match(/\/([^/?#]+)\/?(?:[?#].*)?$/) || [])[1] || ''; }
	function fixFloorAreas() {
		if (root.classList.contains('refine-off')) return;
		document.querySelectorAll('img.map[usemap]').forEach(function (img) {
			var shapes = FLOOR_SHAPES[imgKey(img)];
			var map = shapes && document.querySelector('map[name="' + img.getAttribute('usemap').replace('#', '') + '"]');
			if (!map) return;
			map.querySelectorAll('area').forEach(function (a) {
				var c = shapes[floorKey(a)];
				if (!c) return;
				a.setAttribute('data-rf-coords', c);
				a.setAttribute('coords', c);
				if (window.jQuery) window.jQuery(a).data('coords', c); // originál pro přepočet šablony
			});
		});
	}
	fixFloorAreas();

	function ready(fn) {
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
		else fn();
	}

	/* ---------------------------------------------------------------- *
	 * 1) Chytrá hlavička
	 * ---------------------------------------------------------------- */
	function smartHeader() {
		var bar = document.querySelector('header section.topBar');
		if (!bar || bar.hasAttribute('data-rf-header')) return;
		bar.setAttribute('data-rf-header', '');

		// UIkit sticky (show-on-up) nahrazujeme — přepínal position a
		// vkládal placeholder, což se s vlastním chováním pere.
		try {
			var sticky = window.UIkit && UIkit.getComponent(bar, 'sticky');
			if (sticky) sticky.$destroy();
		} catch (e) {}
		bar.removeAttribute('data-uk-sticky');
		bar.removeAttribute('uk-sticky');
		bar.classList.remove('uk-sticky', 'uk-sticky-fixed', 'uk-active', 'uk-animation-slide-top', 'uk-sticky-below');
		['top', 'width', 'position', 'left', 'right'].forEach(function (p) { bar.style.removeProperty(p); });
		var ph = bar.parentNode && bar.parentNode.querySelector('.uk-sticky-placeholder');
		if (ph) ph.remove();

		var DOWN = 14; // px souvislého scrollu dolů, než se schová
		var UP = 10; // px souvislého scrollu nahoru, než se vrátí
		var lastY = Math.max(0, window.scrollY);
		var acc = 0;
		var hidden = false;
		var scrolled = null;
		var ticking = false;
		var headerH = bar.offsetHeight || 72;

		function setHidden(v) {
			if (v === hidden) return;
			hidden = v;
			root.classList.toggle('rf-nav-hidden', v);
		}

		function setScrolled(v) {
			if (v === scrolled) return;
			scrolled = v;
			root.classList.toggle('rf-nav-scrolled', v);
		}

		// Kdy hlavičku neschovávat: otevřený dropdown/menu, fokus z klávesnice uvnitř
		function locked() {
			var a = document.activeElement;
			if (a && a !== document.body && bar.contains(a) && a.matches(':focus-visible')) return true;
			if (bar.querySelector('.uk-drop.uk-open, .uk-dropdown.uk-open')) return true;
			if (document.querySelector('.uk-offcanvas.uk-open')) return true;
			return false;
		}

		function update() {
			ticking = false;
			var y = Math.max(0, window.scrollY);
			var dy = y - lastY;
			lastY = y;
			setScrolled(y > 4);

			// U horního okraje vždy vidět (a neřešit odraz/overscroll)
			if (y <= headerH) {
				acc = 0;
				setHidden(false);
				return;
			}
			if (locked()) {
				acc = 0;
				setHidden(false);
				return;
			}
			if (dy === 0) return;
			// Změna směru vynuluje akumulaci → drobné pohyby kolečkem nepřepínají
			if ((dy > 0 && acc < 0) || (dy < 0 && acc > 0)) acc = 0;
			acc += dy;
			if (acc > DOWN) setHidden(true);
			else if (acc < -UP) setHidden(false);
		}

		function onScroll() {
			if (!ticking) {
				ticking = true;
				window.requestAnimationFrame(update);
			}
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', function () {
			headerH = bar.offsetHeight || headerH;
			onScroll();
		}, { passive: true });

		// Tab do hlavičky (klávesnice) ji vždy ukáže
		bar.addEventListener('focusin', function () {
			acc = 0;
			setHidden(false);
		});

		update();
	}

	/* ---------------------------------------------------------------- *
	 * 3) Úpravy podle produktového auditu (28. 9. 2026) — doplňky prezentace
	 *    nad stávajícími daty stránky; nic se nevymýšlí, jen přeskupuje.
	 * ---------------------------------------------------------------- */
	var mqMobile = window.matchMedia('(max-width: 767px)');
	var mqSearch = window.matchMedia('(max-width: 639px)'); // šablona pod 640 px vyhledávání skrývá
	var BASE = window.__BRAVE_BASE || '';
	function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
	function phone() { var a = document.querySelector('a[href^="tel:"]'); return a ? { href: a.getAttribute('href'), text: a.textContent.trim() || a.getAttribute('href').slice(4) } : null; }
	function onMq(fn) { mqMobile.addEventListener ? mqMobile.addEventListener('change', fn) : mqMobile.addListener(fn); }
	var ICON = {
		tel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
		list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>',
		cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/></svg>'
	};

	// Mobilní hero: vyhledávání ze šablony je na mobilu skryté — přesuneme ho pod hero
	function heroSearch() {
		var hero = document.querySelector('section.panoramaHero');
		var form = hero && hero.querySelector('.panoramaHero__quickSearch');
		if (!form || document.querySelector('.rfHeroSearch')) return;
		var home = form.parentNode, next = form.nextSibling;
		// třída panoramaHero: styly vyhledávání šablony jsou vázané na section.panoramaHero
		var box = el('section', 'panoramaHero rfHeroSearch', '<p class="rfHeroSearch__title">Najděte svůj byt</p>');
		box.setAttribute('aria-label', 'Rychlé vyhledávání bytů');
		hero.parentNode.insertBefore(box, hero.nextSibling);
		function place() {
			if (mqSearch.matches) { if (form.parentNode !== box) box.appendChild(form); }
			else if (form.parentNode !== home) home.insertBefore(form, next);
		}
		place();
		mqSearch.addEventListener ? mqSearch.addEventListener('change', place) : mqSearch.addListener(place);
	}

	// Sticky mobilní lišta + CTA a telefon v mobilním menu
	function mobileActions() {
		var tel = phone();
		var offer = BASE + '/nabidka-nemovitosti/';
		// Prohlídka: poptávkový formulář na stránce (detail bytu, kontakty), jinak kontakty
		var form = document.querySelector('section.brokerOffer form, form[id^="frm-generatedForm-contact"]');
		var visit = form ? '#' + (form.id || (form.id = 'rf-visit-form')) : BASE + '/kontakty/#frm-generatedForm-contact-form';
		if (!document.querySelector('.rfMobileBar')) {
			var bar = el('nav', 'rfMobileBar');
			bar.setAttribute('aria-label', 'Rychlé akce');
			bar.innerHTML = (tel ? '<a href="' + tel.href + '">' + ICON.tel + 'Zavolat</a>' : '') +
				'<a class="is-main" href="' + offer + '">' + ICON.list + 'Nabídka</a>' +
				'<a href="' + visit + '">' + ICON.cal + 'Prohlídka</a>';
			if (!tel) bar.style.gridTemplateColumns = '1fr 1fr';
			document.body.appendChild(bar);
			root.classList.add('rf-has-mobilebar');
		}
		var oc = document.querySelector('#offcanvas-nav .uk-offcanvas-bar');
		if (oc && !oc.querySelector('.rfMenuCta')) {
			var box = el('div', 'rfMenuCta', '<a class="rfMenuCta__main" href="' + offer + '">Volné byty a ceník</a>' +
				(tel ? '<a class="rfMenuCta__tel" href="' + tel.href + '">' + ICON.tel.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"') + tel.text + '</a>' : ''));
			var nav = oc.querySelector('.offcanvasMainNav');
			nav ? nav.parentNode.insertBefore(box, nav) : oc.appendChild(box);
		}
	}

	// Vizualizace domu: nápověda „klikněte na patro“, na mobilu vodorovný posun
	function houseViz() {
		document.querySelectorAll('section.vizualize .maping').forEach(function (m) {
			if (m.parentNode.classList.contains('rfVizScroll')) return;
			var hint = el('p', 'rfVizHint', '<span class="t-mouse">Najeďte na patro a kliknutím zobrazíte jeho byty</span><span class="t-touch">Klepněte na patro — zobrazí se jeho byty</span>');
			var wrap = el('div', 'rfVizScroll');
			m.parentNode.insertBefore(hint, m);
			m.parentNode.insertBefore(wrap, m);
			wrap.appendChild(m);
			function center() { if (mqMobile.matches) wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2; }
			// image mapa šablony přepočítá oblasti podle nové šířky
			window.dispatchEvent(new Event('resize'));
			setTimeout(center, 300);
			window.addEventListener('load', center);
		});
	}

	// Vizualizace domu: pulzující obrys budov (obálka jejich pater z image mapy) — na první
	// pohled je vidět, že je obrázek klikací. Při najetí myší obrys ustoupí, po odjetí pulzuje dál.
	var SILHOUETTES = {
		// vizualizace Bytový komplex Hálkova (1600 × 800): Dům A, Dům B
		'20260831070015086': [
			'185,537 185,344 252,344 252,286 705,286 705,344 737,344 737,537',
			'849,556 849,303 892,303 892,255 1273,255 1273,303 1326,303 1326,556'
		]
	};
	function houseOutline() {
		// šablona přepočítá oblasti a zvýraznění pater jen při změně velikosti okna;
		// fotka mění šířku i bez ní (přesun do sloupce, posuvník) → hlídat přímo obrázek
		if ('ResizeObserver' in window) {
			var rt, lastW = {};
			var ro = new ResizeObserver(function (en) {
				var changed = en.some(function (e, i) { var w = Math.round(e.contentRect.width); var k = e.target.src; var c = lastW[k] !== undefined && lastW[k] !== w; lastW[k] = w; return c; });
				if (changed) { clearTimeout(rt); rt = setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 120); }
			});
			document.querySelectorAll('section.vizualize .maping img.map').forEach(function (i) { ro.observe(i); });
		}

		document.querySelectorAll('section.vizualize .maping').forEach(function (m) {
			var img = m.querySelector('img[usemap]');
			var map = img && document.querySelector('map[name="' + img.getAttribute('usemap').replace('#', '') + '"]');
			if (!map || m.querySelector('.rfHouseOutline')) return;
			var W = +img.getAttribute('width') || img.naturalWidth, H = +img.getAttribute('height') || img.naturalHeight;
			if (!W || !H) return;
			var boxes = {};
			map.querySelectorAll('area').forEach(function (a) {
				var key = ((a.getAttribute('href') || '').match(/dum-([a-z0-9]+)-/i) || [])[1] || 'x';
				var c = String(a.getAttribute('data-rf-coords') || (window.jQuery && window.jQuery(a).data('coords')) || a.getAttribute('coords') || '').split(',').map(Number);
				if (c.length < 4) return;
				var b = boxes[key] = boxes[key] || { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
				for (var i = 0; i + 1 < c.length; i += 2) {
					b.x1 = Math.min(b.x1, c[i]); b.x2 = Math.max(b.x2, c[i]);
					b.y1 = Math.min(b.y1, c[i + 1]); b.y2 = Math.max(b.y2, c[i + 1]);
				}
			});
			// Siluety domů (body v pixelech originálu vizualizace): ustoupená horní patra jsou
			// užší než oblasti pater v image mapě → bez nich by obrys byl jen obdélník.
			var sil = SILHOUETTES[(img.getAttribute('src') || '').replace(/^.*\/(\d{10,})[^/]*$/, '$1')];
			var rects = (sil ? sil.map(function (pts, i) {
				return '<polygon points="' + pts + '" style="animation-delay:' + (i * 0.35) + 's"/>';
			}) : Object.keys(boxes).map(function (k, i) {
				var b = boxes[k];
				return '<rect x="' + b.x1 + '" y="' + b.y1 + '" width="' + (b.x2 - b.x1) + '" height="' + (b.y2 - b.y1) + '" rx="6" style="animation-delay:' + (i * 0.35) + 's"/>';
			})).join('');
			if (!rects) return;
			m.insertAdjacentHTML('beforeend', '<svg class="rfHouseOutline" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + rects + '</svg>');
			// Při najetí obrys ustoupí zvýraznění pater šablony, po odjetí zase pulzuje
			var t;
			function off() { clearTimeout(t); m.classList.add('rf-touched'); }
			function on() { clearTimeout(t); m.classList.remove('rf-touched'); }
			m.addEventListener('mouseenter', off);
			m.addEventListener('mouseleave', on);
			m.addEventListener('focusin', off);
			m.addEventListener('focusout', on);
			// dotyk nemá „odjetí“: obrys se vrátí po chvíli bez dotyku
			m.addEventListener('touchstart', function () { off(); t = setTimeout(on, 4000); }, { passive: true });
		});
	}

	// Přepínač jazyka: odkaz „#“ je jen otevírač nabídky → sémanticky tlačítko
	function langToggle() {
		document.querySelectorAll('a.menuLink.language[href="#"]').forEach(function (a) {
			a.setAttribute('role', 'button');
			a.setAttribute('aria-haspopup', 'true');
			a.setAttribute('aria-label', 'Jazyk: ' + a.textContent.trim());
			a.addEventListener('click', function (e) { e.preventDefault(); });
		});
	}

	// Čísla: desetinná čárka (šablona míchá „32.4 m²“ a „32,4 m²“)
	var DEC_TEST = /\d\.\d+\s*(m|%|km|Kč)/;
	var DEC = /(\d)\.(\d+)(?=\s*(m|%|km|Kč))/g;
	function decimals() {
		var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
			acceptNode: function (n) {
				return DEC_TEST.test(n.nodeValue) && !n.parentNode.closest('script,style,textarea,code') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
			}
		});
		var list = [];
		while (w.nextNode()) list.push(w.currentNode);
		list.forEach(function (n) { n.nodeValue = n.nodeValue.replace(DEC, '$1,$2'); });
	}

	/* ---------------------------------------------------------------- *
	 * 4) Homepage pro prezentaci šablony: video v hero, panoráma jako
	 *    samostatná sekce před aktualitami, výběr budovy ve vyhledávání,
	 *    kontaktní formulář s makléřem nad patičkou.
	 * ---------------------------------------------------------------- */
	var MEDIA = BASE + '/refine/media/';
	var MEDIA_V = '?v=3'; // zvýšit při výměně videa (mezipaměť prohlížeče)

	// Hero: smyčka videa místo panoramatu; text i vyhledávání se přesunou do nového hero
	function videoHero() {
		var pano = document.querySelector('section.panoramaHero[data-panorama-hero]');
		if (!pano || document.querySelector('.rfVideoHero')) return;
		var hero = el('section', 'panoramaHero rfVideoHero'); // styly textu a vyhledávání šablony
		var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		var src = window.matchMedia('(max-width: 959px)').matches ? 'halkova-loop-1080.mp4' : 'halkova-loop-1920.mp4';
		hero.innerHTML = '<video class="rfVideoHero__video" muted playsinline loop preload="auto" poster="' + MEDIA + 'halkova-loop-poster.jpg' + MEDIA_V + '"' + (reduce ? '' : ' autoplay') +
			' aria-hidden="true"><source src="' + MEDIA + src + MEDIA_V + '" type="video/mp4"></video><div class="panoramaHero__shade rfVideoHero__shade"></div>';
		['.panoramaHero__copy', '.panoramaHero__quickSearch'].forEach(function (s) { var n = pano.querySelector(s); if (n) hero.appendChild(n); });
		pano.parentNode.insertBefore(hero, pano);
		var v = hero.querySelector('video');
		if (!reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

		// Panoráma → do sekce Lokalita místo mapy (body zájmu ukazují, co je v okolí)
		var mapBox = document.querySelector('section.homepageInteractive .mapWrapper');
		if (mapBox) {
			mapBox.classList.add('rfPanoBox');
			Array.prototype.forEach.call(mapBox.children, function (c) { if (c.matches('[data-map-id]')) c.hidden = true; }); // mapa se pak ani nenačte
			mapBox.appendChild(pano);
		} else {
			var news = document.querySelector('section.newsExtract, section.footerMain');
			if (news) news.parentNode.insertBefore(pano, news);
		}
		window.dispatchEvent(new Event('resize'));
	}

	// Vyhledávání: výběr budovy (šablona filtruje jen podle pater → budova = všechna její patra)
	function buildingFilter() {
		var form = document.querySelector('.panoramaHero__quickSearch');
		var floorSel = form && form.querySelector('select[name="quickFloor[]"]');
		if (!floorSel || form.querySelector('[data-rf-building]')) return;
		var byB = {};
		Array.prototype.forEach.call(floorSel.options, function (o) {
			var m = o.text.match(/^(?:Dům|Budova)\s+([A-Z0-9]+)/i);
			if (m) (byB[m[1]] = byB[m[1]] || []).push(o);
		});
		var names = Object.keys(byB);
		if (names.length < 2) return;
		var item = el('label', 'panoramaHero__quickSearchItem is-enhanced');
		item.setAttribute('data-rf-building', '');
		// bez <select>: šablona vylepšuje všechny selecty ve vyhledávání a zdvojila by menu
		item.innerHTML = '<span>Budova</span>' +
			'<button type="button" class="panoramaHero__quickSearchTrigger" aria-expanded="false">Vše</button><div class="panoramaHero__quickSearchMenu" role="listbox"></div>';
		form.insertBefore(item, form.querySelector('.panoramaHero__quickSearchItem'));
		var trig = item.querySelector('button'), menu = item.querySelector('.panoramaHero__quickSearchMenu');
		var on = {};
		names.forEach(function (n) {
			var b = el('button', 'panoramaHero__quickSearchOption');
			b.type = 'button'; b.setAttribute('role', 'option'); b.textContent = 'Budova ' + n;
			b.addEventListener('click', function (e) { e.stopPropagation(); on[n] = !on[n]; sync(); });
			menu.appendChild(b);
		});
		function picked() { return names.filter(function (n) { return on[n]; }); }
		function sync() {
			var p = picked();
			trig.textContent = p.length ? (p.length === 1 ? 'Budova ' + p[0] : p.length + ' vybráno') : 'Vše';
			Array.prototype.forEach.call(menu.children, function (b, i) { var s = !!on[names[i]]; b.classList.toggle('is-selected', s); b.setAttribute('aria-selected', String(s)); });
			// v nabídce pater nech jen patra vybraných budov
			var floorMenu = floorSel.closest('.panoramaHero__quickSearchItem').querySelector('.panoramaHero__quickSearchMenu');
			if (floorMenu) Array.prototype.forEach.call(floorMenu.children, function (b) {
				var m = b.textContent.match(/^(?:Dům|Budova)\s+([A-Z0-9]+)/i);
				b.hidden = !!(p.length && m && p.indexOf(m[1]) < 0);
			});
		}
		trig.addEventListener('click', function (e) {
			e.stopPropagation();
			var open = !menu.classList.contains('is-open');
			form.querySelectorAll('.panoramaHero__quickSearchMenu').forEach(function (m) { m.classList.remove('is-open'); });
			form.querySelectorAll('.panoramaHero__quickSearchTrigger').forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
			menu.classList.toggle('is-open', open);
			trig.setAttribute('aria-expanded', String(open));
		});
		document.addEventListener('click', function (e) { if (!item.contains(e.target)) { menu.classList.remove('is-open'); trig.setAttribute('aria-expanded', 'false'); } });
		// Odeslání: vybraná budova bez zvoleného patra = všechna patra budovy
		form.addEventListener('submit', function () {
			var p = picked();
			form.querySelectorAll('input[data-rf-auto]').forEach(function (i) { i.remove(); });
			var chosen = Array.prototype.filter.call(floorSel.options, function (o) { return o.selected; });
			if (p.length && !chosen.length) {
				p.forEach(function (n) { byB[n].forEach(function (o) {
					var h = el('input'); h.type = 'hidden'; h.name = 'quickFloor[]'; h.value = o.value; h.setAttribute('data-rf-auto', ''); form.appendChild(h);
				}); });
			} else if (p.length) {
				chosen.forEach(function (o) { var m = o.text.match(/^(?:Dům|Budova)\s+([A-Z0-9]+)/i); if (m && p.indexOf(m[1]) < 0) o.selected = false; });
			}
		});
		sync();
	}

	// Kontaktní formulář s makléřem nad patičkou homepage (formulář i kontakt ze stránky Kontakty)
	function leadBlock() {
		if (!document.querySelector('.rfVideoHero') || document.querySelector('.rfLead')) return;
		var foot = document.querySelector('section.footerMain');
		if (!foot || !window.fetch || !window.DOMParser) return;
		fetch(BASE + '/kontakty/', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); }).then(function (html) {
			var doc = new DOMParser().parseFromString(html, 'text/html');
			var sec = doc.querySelector('section.form');
			var form = sec && sec.querySelector('form[id^="frm-generatedForm-contact"]');
			if (!form) return;
			var box = doc.querySelector('section.topContact .entityBox');
			var photo = doc.querySelector('section.topContact img[src*="upload"]');
			var name = box && box.querySelector('h3'), role = box && box.querySelector('.subtitle');
			var tel = box && box.querySelector('a[href^="tel:"]'), mail = box && box.querySelector('a[href^="mailto:"]');
			var t = function (n) { return n ? n.textContent.trim() : ''; };
			var card = '<aside class="rfLead__card" aria-label="Váš makléř">' +
				(photo ? '<img src="' + photo.getAttribute('src') + '" alt="' + t(name) + '" loading="lazy">' : '') +
				'<div><p class="rfLead__role">' + t(role) + '</p><p class="rfLead__name">' + t(name) + '</p>' +
				(tel ? '<a href="' + tel.getAttribute('href') + '">' + ICON.tel.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"') + t(tel) + '</a>' : '') +
				(mail ? '<a href="' + mail.getAttribute('href') + '">' + t(mail) + '</a>' : '') + '</div></aside>';
			// sekce šablony (stejné styly formuláře); místo fotky domu karta makléře
			sec.classList.add('rfLead');
			sec.id = 'rf-lead';
			var pack = sec.querySelector('.formPack');
			if (pack) { pack.querySelector('h2').textContent = 'Domluvte si prohlídku'; var pp = pack.querySelector('h2 + p'); if (pp) pp.textContent = 'Napište nám a makléřka se vám ozve s termínem i odpověďmi na vaše otázky'; }
			var cols = sec.querySelectorAll('.content > div > div'); // .uk-grid doplňuje až UIkit za běhu
			if (cols[1]) cols[1].innerHTML = card; else if (pack) pack.insertAdjacentHTML('afterend', card);
			var node = document.importNode(sec, true);
			foot.parentNode.insertBefore(node, foot);
			// UIkit grid + validace formuláře šablony na nově vloženém obsahu
			try { if (window.UIkit) UIkit.update(node); } catch (e) {}
			try { if (window.Nette && Nette.initForm) Nette.initForm(node.querySelector('form')); } catch (e) {}
			// Mobilní lišta „Prohlídka“ → tento formulář
			var visit = document.querySelector('.rfMobileBar a[href*="kontakty"]');
			if (visit) visit.setAttribute('href', '#rf-lead');
		}).catch(function () {});
	}

	// Body lokality: místo fajfek ikony stejné sady jako piny v panoramatu
	function localityIcons() {
		document.querySelectorAll('section.homepageInteractive .editableBlock li').forEach(function (li) {
			if (li.querySelector('.rfLocIcon')) return;
			var t = li.textContent, ic = /sport/i.test(t) ? 'mdi-basketball' : /ZŠ|MŠ|škol/i.test(t) ? 'mdi-school-outline' : /restaur/i.test(t) ? 'mdi-silverware-fork-knife' :
				/lékár|obchod/i.test(t) ? 'mdi-cart-outline' : /MHD|zastáv/i.test(t) ? 'mdi-bus-stop' : /park|les|příro/i.test(t) ? 'mdi-tree-outline' : 'mdi-map-marker-outline';
			li.classList.add('rfLocItem');
			li.insertAdjacentHTML('afterbegin', '<i class="mdi ' + ic + ' rfLocIcon" aria-hidden="true"></i>');
		});
	}

	// Výpis bytů (desktop): vlevo zafixovaná fotka domu + velký půdorys patra (obojí se
	// zvýrazňuje podle karty pod myší — logika šablony), vpravo zafixovaná lišta filtrů
	// přímo na stránce (místo tlačítka a okna) a výpis. Drátěné modely pryč.
	// Filtry počítají shodu z matice šablony (stejná data jako okno filtru) a výpis
	// filtrují rovnou v prohlížeči; pod 1200 px zůstává tlačítko + okno šablony.
	var mqWide = window.matchMedia('(min-width: 1200px)');
	function listingLayout() {
		var grid = document.querySelector('.unitsLayout .layoutGrid');
		var modal = document.getElementById('reo-unit-filter-modal');
		var main = grid && grid.querySelector(':scope > .layoutMain');
		var side = grid && grid.querySelector(':scope > .layoutSide');
		var viz = grid && grid.querySelector(':scope > .layoutViz');
		var src = modal && modal.querySelector('script[data-reo-unit-filter-matrix]');
		if (!grid || !modal || !main || !side || !src || document.querySelector('.rfFilterBar')) return;
		var units = {};
		try { (JSON.parse(src.textContent).units || []).forEach(function (u) { units[u.id] = u; }); } catch (e) { return; }
		root.classList.add('rf-listing');

		// --- rozvržení: vlevo fotka + půdorys, vpravo lišta filtrů + výpis
		var visual = el('div', 'rfListVisual');
		var preview = side.querySelector('.floorPreview');
		var bar = el('div', 'rfFilterBar');
		bar.setAttribute('role', 'search');
		bar.setAttribute('aria-label', 'Filtr bytů');
		var homeModal = modal.parentNode, homeNext = modal.nextSibling;
		function place() {
			if (mqWide.matches) {
				if (visual.parentNode !== side) side.insertBefore(visual, side.firstChild);
				if (viz && viz.parentNode !== visual) visual.insertBefore(viz, visual.firstChild);
				if (preview && preview.parentNode !== visual) visual.appendChild(preview);
				if (bar.parentNode !== main) main.insertBefore(bar, main.firstChild);
				if (modal.parentNode !== bar) bar.insertBefore(modal, bar.firstChild);
			} else {
				if (viz && viz.parentNode !== grid) grid.insertBefore(viz, main);
				if (preview && preview.parentNode !== side) side.appendChild(preview);
				if (modal.parentNode !== homeModal) homeModal.insertBefore(modal, homeNext);
			}
			window.dispatchEvent(new Event('resize')); // image mapa přepočítá oblasti
		}

		// --- čipy filtrů (obsah = původní skupiny z okna šablony)
		var groups = Array.prototype.slice.call(modal.querySelectorAll('form[data-filter-matrix-kind]'));
		var sortForm = modal.querySelector('#snippet--reoUnitSort form');
		function closeAll() {
			modal.querySelectorAll('.rfChipGroup.is-open').forEach(function (f) { f.classList.remove('is-open'); f.querySelector('.rfChip').setAttribute('aria-expanded', 'false'); });
		}
		groups.concat(sortForm ? [sortForm] : []).forEach(function (form) {
			if (form.querySelector('.rfChip') || form.classList.contains('rfRange')) return;
			// cena a plocha: posuvník rovnou v liště (bez nabídky)
			if (/^(or|pr)$/.test(form.getAttribute('data-filter-matrix-kind') || '')) { form.classList.add('rfRange'); return; }
			var labels = Array.prototype.map.call(form.querySelectorAll('.filterLabel'), function (l) { return l.textContent.trim(); });
			var title = labels[0] + (labels[1] ? ' a ' + labels[1].toLowerCase() : '');
			var chip = el('button', 'rfChip', '<span class="rfChip__t">' + title + '</span><span class="rfChip__n" hidden></span>');
			chip.type = 'button';
			chip.setAttribute('aria-expanded', 'false');
			form.classList.add('rfChipGroup');
			// obsah skupiny do jedné nabídky (prvky zůstávají ve formuláři → logika šablony beze změny)
			var pop = el('div', 'rfPop');
			Array.prototype.slice.call(form.childNodes).forEach(function (n) { if (!(n.nodeType === 1 && n.matches('input[type="hidden"]'))) pop.appendChild(n); });
			form.appendChild(pop);
			form.insertBefore(chip, form.firstChild);
			chip.addEventListener('click', function (e) {
				e.stopPropagation();
				var open = !form.classList.contains('is-open');
				closeAll();
				form.classList.toggle('is-open', open);
				chip.setAttribute('aria-expanded', String(open));
				// nabídka u pravého okraje lišty se otevírá doleva
				if (open) { var br = bar.getBoundingClientRect(), fr = form.getBoundingClientRect(); form.classList.toggle('is-right', fr.left + 360 > br.right); }
			});
		});
		document.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('.rfChipGroup'))) closeAll(); });
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

		// --- vyhodnocení filtru nad maticí šablony
		function checked(form) { return Array.prototype.map.call(form.querySelectorAll('input[type="checkbox"]:checked'), function (i) { return String(i.value); }); }
		function hit(actual, sel) { var a = (Array.isArray(actual) ? actual : [actual]).map(String); return sel.some(function (v) { return a.indexOf(String(v)) >= 0; }); }
		function num(f, sel) { var i = f.querySelector(sel); return i && i.value !== '' ? +i.value : NaN; }
		function criteria() {
			return groups.map(function (f) {
				var kind = f.getAttribute('data-filter-matrix-kind'), opt = f.getAttribute('data-filter-matrix-option');
				if (kind === 'or') return { kind: kind, opt: opt, min: num(f, '[data-reo-unit-filter-range-min]'), max: num(f, '[data-reo-unit-filter-range-max]'), lo: +(f.querySelector('[data-reo-unit-filter-range-min]') || {}).min, hi: +(f.querySelector('[data-reo-unit-filter-range-max]') || {}).max, form: f };
				if (kind === 'pr') return { kind: kind, min: num(f, '[data-reo-unit-filter-price-min]'), max: num(f, '[data-reo-unit-filter-price-max]'), form: f };
				return { kind: kind, opt: opt, sel: checked(f), form: f };
			});
		}
		function match(u, cr) {
			return cr.every(function (c) {
				if (c.kind === 's') return c.sel.length ? hit(u.s, c.sel) : !u.sold;
				if (c.kind === 'pp') return !c.sel.length || hit(u.pp || [], c.sel);
				if (c.kind === 'os' || c.kind === 'ov') return !c.sel.length || hit((u[c.kind] || {})[c.opt] || [], c.sel);
				if (c.kind === 'or') { if (!isFinite(c.min) || !isFinite(c.max)) return true; return ((u.ov || {})[c.opt] || []).some(function (v) { return +v >= c.min && +v <= c.max; }); }
				if (c.kind === 'pr') { if (!isFinite(c.min) || !isFinite(c.max) || (!c.min && !c.max)) return true; return +u.price >= c.min && +u.price <= c.max; }
				return true;
			});
		}
		var foot = el('div', 'rfFilterBar__foot', '<p class="rfFilterBar__count"></p>');
		var reset = el('button', 'rfFilterBar__reset', 'Zrušit filtry');
		reset.type = 'button';
		foot.appendChild(reset);
		bar.appendChild(foot);
		var count = foot.querySelector('.rfFilterBar__count');
		var items = function () { return Array.prototype.slice.call(main.querySelectorAll('[data-unit-floor-id]')); };
		var idOf = function (it) { var s = it.querySelector('[id^="snippet--reoUnitBox-"]'); return s ? +s.id.split('-').pop() : null; };
		var cellOf = function (it) { return it.classList.contains('tRow') ? it : it.parentElement; };
		var plural = function (n) { return n === 1 ? 'byt' : n >= 2 && n <= 4 ? 'byty' : 'bytů'; };
		function apply() {
			var cr = criteria(), n = 0;
			Object.keys(units).forEach(function (id) { if (match(units[id], cr)) n++; });
			items().forEach(function (it) { var u = units[idOf(it)]; cellOf(it).classList.toggle('rf-hidden', !!u && !match(u, cr)); });
			count.innerHTML = '<strong>' + n + '</strong> ' + plural(n) + ' odpovídá výběru';
			var rc = main.querySelector('.resultBar__count'); if (rc) rc.innerHTML = '<strong>' + n + '</strong> ' + plural(n);
			var active = 0;
			cr.forEach(function (c) {
				var b = c.form.querySelector('.rfChip__n'); if (!b) return;
				var k = c.sel ? c.sel.length : (c.kind === 'or' && isFinite(c.min) && (c.min > c.lo || c.max < c.hi)) ? 1 : 0;
				b.hidden = !k; b.textContent = k; c.form.querySelector('.rfChip').classList.toggle('is-active', !!k); active += k;
			});
			reset.hidden = !active;
		}
		var t;
		function later() { clearTimeout(t); t = setTimeout(apply, 80); }
		['change', 'input', 'click'].forEach(function (ev) { modal.addEventListener(ev, later, true); });
		reset.addEventListener('click', function () {
			var r = modal.querySelector('[data-reo-unit-filter-reset]');
			if (r) r.click();
			modal.querySelectorAll('input[type="checkbox"]:checked').forEach(function (i) { i.checked = false; });
			later();
		});

		// Řazení (čip „Seřadit“): bez načtení stránky, podle dat výpisu
		if (sortForm) sortForm.addEventListener('change', function (e) {
			var list = items();
			if (!list.length) return;
			var lab = e.target && e.target.id ? sortForm.querySelector('label[for="' + e.target.id + '"]') : null;
			var txt = (lab || (e.target.closest('fieldset') || {}).querySelector && e.target.closest('fieldset').querySelector('label') || {}).textContent || '';
			var fn = /Název/.test(txt) ? function (u, it) { return ((it.querySelector('h3, .cName a') || {}).textContent || '').trim(); } :
				/Stav/.test(txt) ? function (u) { return u.sold ? 9 : u.s; } :
				/Nejnižší/.test(txt) ? function (u) { return +u.price; } :
				/Nejvyšší/.test(txt) ? function (u) { return -u.price; } : null;
			var cells = list.map(function (it, i) { if (it.__rfOrder == null) it.__rfOrder = i; return { it: it, c: cellOf(it), u: units[idOf(it)] || {} }; });
			cells.sort(function (a, b) {
				var x = fn ? fn(a.u, a.it) : a.it.__rfOrder, y = fn ? fn(b.u, b.it) : b.it.__rfOrder;
				return typeof x === 'string' ? x.localeCompare(y, 'cs', { numeric: true }) : x - y;
			});
			var parent = cells[0].c.parentNode;
			cells.forEach(function (c) { parent.appendChild(c.c); });
			sortForm.querySelectorAll('label').forEach(function (l) { l.classList.toggle('active', l === lab || l.textContent === txt); });
			e.stopImmediatePropagation();
			e.preventDefault();
		}, true);

		place();
		mqWide.addEventListener ? mqWide.addEventListener('change', place) : mqWide.addListener(place);
		apply();
		// půdorys hned po načtení: patro prvního bytu ve výpisu (šablona ho plní až při najetí)
		var first = items()[0];
		if (first) setTimeout(function () { first.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); }, 400);
	}

	// Seznam bytů: stav (Volný / Rezervace / Prodáno) u ceny místo u názvu
	function stateAtPrice() {
		document.querySelectorAll('.tRow.tHead .cPrice').forEach(function (h) {
			var t = h.querySelector('button') || h;
			if (!/stav/i.test(t.textContent)) t.textContent = t.textContent.trim() + ' · stav';
		});
		document.querySelectorAll('.tRow[data-sort-state]').forEach(function (r) {
			var price = r.querySelector('.cPrice');
			if (!price || price.querySelector('.rfState')) return;
			var dot = r.querySelector('.cName .unitStateDot');
			var cls = dot ? (dot.className.match(/is-[a-z]+/) || [''])[0] : '';
			price.insertAdjacentHTML('beforeend', '<span class="rfState ' + cls + '">' + r.getAttribute('data-sort-state') + '</span>');
			r.classList.add('rf-state-price');
		});
	}

	// Panoráma: na první pohled poznat, že je interaktivní — jemná samorotace, štítek
	// „Pohled 360°“ a nápověda s prstem; po zásahu uživatele se zastaví, po chvíli zase
	// rozjede. Instanci prohlížeče zpřístupní build (tools/panorama-pois.mjs → t.__psv).
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Panoráma: štítek projektu jako na 2D mapě (logo, adresa, Navigovat — data z karty
	// projektu v mapě) a na Lokalitě filtr bodů podle stejných kategorií jako legenda mapy.
	var POI_CAT = { 'Občanská vybavenost': /bus-stop|school|teddy|store|cart|pill|hospital|pharmacy/, 'Aktivity v okolí': /silverware|church|coffee|food|theater/, 'Sportoviště': /basketball|soccer|run|dumbbell|weight|bike|swim|tennis/, 'Přírodní zajímavosti': /tree|pine|flower|nature|park|water/ };
	var projectCard = null;
	function getProjectCard() {
		if (!projectCard) projectCard = fetch(BASE + '/_data/do-map-main-markers.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
			var m = (list || []).find(function (x) { return !x.categories || !x.categories.length; });
			return m && m.content ? m.content : null;
		}).catch(function () { return null; });
		return projectCard;
	}
	function panoEnhance(sec, v) {
		var mk = v.getPlugin && v.getPlugin('markers');
		if (!mk) return;
		getProjectCard().then(function (card) {
			if (!card) return;
			mk.getMarkers().forEach(function (m) {
				if (!m.config || !m.config.data || m.config.data.kind !== 'complex') return;
				var W = 300, H = 184, TAIL = 44;
				mk.updateMarker({ id: m.id, html: '<div class="qtip-content panoramaComplexTip rfComplexCard">' + card + '</div>', size: { width: W, height: H }, anchor: { x: 0, y: (H + TAIL) / H } });
			});
		});
		if (!sec.closest('.rfPanoSection') || sec.querySelector('.rfPanoLegend')) return;
		var cats = Object.keys(POI_CAT), byCat = {};
		mk.getMarkers().forEach(function (m) {
			if (!m.config || !m.config.data || m.config.data.kind !== 'poi') return;
			var ic = (String(m.config.html || '').match(/mdi-[a-z-]+/) || [''])[0];
			var c = cats.find(function (k) { return POI_CAT[k].test(ic); }) || cats[0];
			(byCat[c] = byCat[c] || []).push(m.id);
		});
		// ikony kategorií převzaté z legendy 2D mapy šablony
		var legend = document.querySelector('[data-map-legend]');
		var icon = function (name) { var l = legend && Array.prototype.find.call(legend.querySelectorAll('label'), function (x) { return x.textContent.replace(/\s+/g, ' ').trim() === name; }); /* šablona píše nezlomitelné mezery */ var im = l && l.querySelector('img'); return im ? '<img src="' + im.getAttribute('src') + '" alt="">' : ''; };
		var box = el('div', 'rfPanoLegend'); // bez třídy legend — pravidla šablony by přidala druhou fajfku
		box.innerHTML = cats.filter(function (c) { return byCat[c]; }).map(function (c, i) {
			return '<p><input type="checkbox" id="rf-pl-' + i + '" value="' + c + '" checked><label for="rf-pl-' + i + '">' + icon(c) + c + '</label></p>';
		}).join('');
		sec.appendChild(box);
		box.addEventListener('change', function (e) {
			var c = e.target && e.target.value;
			(byCat[c] || []).forEach(function (id) { e.target.checked ? mk.showMarker(id) : mk.hideMarker(id); });
		});
		['pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.stopPropagation(); }); });
	}
	function panoAttract(scope) {
		(scope || document).querySelectorAll('section.panoramaHero[data-panorama-hero]').forEach(function (sec) {
			var el = sec.querySelector('[data-panorama-viewer]');
			if (!el || sec.querySelector('.rfPanoHint')) return;
			sec.insertAdjacentHTML('beforeend',
				'<span class="rfPanoBadge" aria-hidden="true"><b>360°</b> Interaktivní pohled</span>' +
				'<div class="rfPanoHint" aria-hidden="true"><span class="rfPanoHint__hand"><svg viewBox="0 0 32 32"><path d="M12.5 17.5V6.8a2 2 0 0 1 4 0v8.4m0-1.6v-1.4a2 2 0 0 1 4 0v2.2m0-.6a2 2 0 0 1 4 0v1.6m0 0a2 2 0 0 1 3.6-.9c.3.4.4.9.4 1.4v4.6c0 4.4-3.3 7.5-7.6 7.5h-1.6c-2.6 0-4.4-1.1-5.9-3.2l-4.1-5.9a2 2 0 0 1 3.1-2.5l1.9 2.1"/></svg></span>' +
				'<span class="rfPanoHint__txt">Táhněte a rozhlédněte se po okolí</span></div>');
			var hint = sec.querySelector('.rfPanoHint');
			var SPEED = 0.06, IDLE = 5000; // rad/s (~3,4°/s)
			var v = null, last = 0, pausedUntil = 0, visible = false, ramp = 0, shown = false;
			function stop() {
				pausedUntil = performance.now() + IDLE; ramp = 0;
				sec.classList.add('rf-pano-used');
			}
			['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (e) { el.addEventListener(e, stop, { passive: true, capture: true }); });
			if ('IntersectionObserver' in window) new IntersectionObserver(function (en) {
				visible = en[0].isIntersecting;
				if (visible && !shown) { shown = true; sec.classList.add('rf-pano-hint'); setTimeout(function () { sec.classList.add('rf-pano-used'); }, 9000); }
			}, { threshold: 0.35 }).observe(el);
			else visible = true;
			function tick(t) {
				requestAnimationFrame(tick);
				var dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
				if (!v || reduceMotion || !visible || document.hidden || t < pausedUntil) return;
				ramp = Math.min(1, ramp + dt / 1.5);
				var p = v.getPosition();
				v.rotate({ yaw: p.yaw + SPEED * ramp * dt, pitch: p.pitch });
			}
			(function wait(n) {
				if (el.__psv) {
					v = el.__psv;
					var go = function () { pausedUntil = performance.now() + 800; requestAnimationFrame(tick); try { panoEnhance(sec, v); } catch (e) {} };
					v.state && v.state.ready ? go() : v.addEventListener('ready', go, { once: true });
				} else if (n < 200) setTimeout(function () { wait(n + 1); }, 100);
			})(0);
		});
	}

	// Podstránka Lokalita: panoráma s body zájmu nad mapou (panoráma i body převezme z homepage)
	function lokalitaPanorama() {
		var map = document.querySelector('section.mapContent');
		if (!map || !/\/lokalita\/?$/.test(location.pathname) || document.querySelector('.rfPanoSection') || !window.fetch) return;
		fetch(BASE + '/', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); }).then(function (html) {
			var doc = new DOMParser().parseFromString(html, 'text/html');
			var pano = doc.querySelector('section.panoramaHero[data-panorama-hero]');
			if (!pano) return;
			['.panoramaHero__quickSearch', '.panoramaHero__copy'].forEach(function (s) { var n = pano.querySelector(s); if (n) n.remove(); });
			var wrap = el('section', 'rfPanoSection', '<div class="container rfPanoSection__head"><p class="subtitle">Pohled 360°</p>' +
				'<h2>Rozhlédněte se po okolí</h2><p class="rfPanoSection__lead">Otočte pohledem a podívejte se, co všechno máte kolem domu. Najeďte na bod a uvidíte, jak daleko to je.</p></div><div class="container rfPanoSection__frame"></div>');
			map.parentNode.insertBefore(wrap, map);
			var frame = wrap.querySelector('.rfPanoSection__frame');
			frame.appendChild(document.importNode(pano, true));
			// Přepínač Pohled 360° / Mapa 2D — jeden prostor, mapa šablony se do něj přesune
			var head = wrap.querySelector('.rfPanoSection__head');
			var sw = el('div', 'rfViewSwitch', '<button type="button" data-view="pano" aria-pressed="true">Pohled 360°</button><button type="button" data-view="map" aria-pressed="false">Mapa 2D</button>');
			sw.setAttribute('role', 'group');
			sw.setAttribute('aria-label', 'Zobrazení okolí');
			head.appendChild(sw);
			// celá sekce mapy šablony do stejného rámu (zachová styly legendy i filtr bodů)
			var mapBox = map;
			mapBox.classList.add('rfMapView');
			mapBox.hidden = true;
			frame.appendChild(mapBox);
			sw.addEventListener('click', function (e) {
				var b = e.target.closest('button'); if (!b) return;
				var v = b.getAttribute('data-view');
				sw.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
				frame.querySelector('section.panoramaHero').hidden = v !== 'pano';
				mapBox.hidden = v !== 'map';
				wrap.classList.toggle('is-map', v === 'map');
				// Leaflet potřebuje přepočítat velikost, když se mapa ukáže
				if (v === 'map') setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30);
			});
			var s = document.createElement('script');
			s.type = 'module';
			s.src = BASE + '/www/assets/panorama360.js';
			document.body.appendChild(s);
			panoAttract(wrap);
		}).catch(function () {});
	}

	// Výpis bytů 768–1199 px: když velká fotka domu odjede, objeví se její zmenšená verze
	// v zafixovaném levém sloupci nad tlačítkem filtrů — patra jsou klikací a zvýrazňují
	// se souběžně s kartou pod myší (stejné patro jako na velké fotce).
	function listingMiniViz() {
		var grid = document.querySelector('.unitsLayout .layoutGrid');
		var side = grid && grid.querySelector(':scope > .layoutSide');
		var viz = grid && grid.querySelector('.layoutViz');
		var img = viz && viz.querySelector('.maping img[usemap]');
		var map = img && document.querySelector('map[name="' + img.getAttribute('usemap').replace('#', '') + '"]');
		if (!map || !side || side.querySelector('.rfMiniViz')) return;
		var W = +img.getAttribute('width') || 1600, H = +img.getAttribute('height') || 800;
		var polys = Array.prototype.map.call(map.querySelectorAll('area'), function (a) {
			var orig = a.getAttribute('data-rf-coords') || (window.jQuery && window.jQuery(a).data('coords')) || a.getAttribute('coords') || '';
			var c = String(orig).split(',').map(Number), pts = [];
			for (var i = 0; i + 1 < c.length; i += 2) pts.push(c[i] + ',' + c[i + 1]);
			return '<a href="' + (a.getAttribute('href') || '#') + '" data-part="' + (a.getAttribute('data-part-id') || '') + '" aria-label="' + (a.getAttribute('alt') || a.getAttribute('title') || 'Patro') + '"><polygon points="' + pts.join(' ') + '"/></a>';
		}).join('');
		var box = el('div', 'rfMiniViz');
		box.innerHTML = '<div class="rfMiniViz__frame"><img src="' + (img.currentSrc || img.src) + '" alt="" width="' + W + '" height="' + H + '">' +
			'<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + polys + '</svg></div>';
		side.insertBefore(box, side.firstChild);
		var cur = null;
		function mark(id) {
			if (id === cur) return;
			cur = id;
			box.querySelectorAll('a[data-part]').forEach(function (a) { a.classList.toggle('is-on', !!id && a.getAttribute('data-part') === id); });
		}
		document.addEventListener('mouseover', function (e) {
			var c = e.target.closest && e.target.closest('[data-unit-floor-id]');
			if (c) mark(c.getAttribute('data-unit-floor-id'));
		});
		if ('IntersectionObserver' in window) {
			new IntersectionObserver(function (en) { box.classList.toggle('is-on', !en[0].isIntersecting && !mqWide.matches); }, { rootMargin: '-20% 0px 0px 0px' }).observe(viz);
		}
	}

	function audit() {
		[videoHero, localityIcons, buildingFilter, heroSearch, mobileActions, houseViz, houseOutline, listingLayout, listingMiniViz, stateAtPrice, panoAttract, lokalitaPanorama, langToggle, decimals, leadBlock].forEach(function (fn) {
			try { fn(); } catch (e) { if (window.console) console.warn('brave-refine:', e); }
		});
		// výpis jednotek se dotahuje AJAXem (filtr, stránkování) → čísla i v nových dlaždicích
		if ('MutationObserver' in window) {
			var t;
			new MutationObserver(function () { clearTimeout(t); t = setTimeout(decimals, 150); })
				.observe(document.body, { childList: true, subtree: true });
		}
	}

	ready(function () {
		// UIkit připojuje komponenty při parsování / DOMContentLoaded — sticky
		// rušíme až po něm, jinak by se znovu připojil.
		setTimeout(smartHeader, 0);
		window.addEventListener('load', smartHeader);
		audit();
	});
})();
