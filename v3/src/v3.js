/* Brave Development — V3 homepage (chování prezentace)
   Mapa, panoráma a formuláře obsluhuje původní kód šablony. */
(function () {
	'use strict';
	var root = document.documentElement;
	root.classList.remove('no-js');
	root.classList.add('js');
	var $ = function (s, c) { return (c || document).querySelector(s); };
	var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
	var data = (function () { var el = $('#v3-data'); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } })();

	/* Hlavička: schová se při scrollu dolů, vrátí při scrollu nahoru */
	(function () {
		var last = window.scrollY, acc = 0, t = false;
		function upd() {
			t = false;
			var y = Math.max(0, window.scrollY), dy = y - last; last = y;
			root.classList.toggle('is-scrolled', y > 4);
			if (root.classList.contains('is-menu') || y < 90) { root.classList.remove('is-nav-hidden'); acc = 0; return; }
			if ((dy > 0 && acc < 0) || (dy < 0 && acc > 0)) acc = 0;
			acc += dy;
			if (acc > 14) root.classList.add('is-nav-hidden');
			else if (acc < -10) root.classList.remove('is-nav-hidden');
		}
		window.addEventListener('scroll', function () { if (!t) { t = true; requestAnimationFrame(upd); } }, { passive: true });
		$('.nav').addEventListener('focusin', function () { root.classList.remove('is-nav-hidden'); });
		upd();
	})();

	/* Mobilní menu a výběr jazyka */
	var burger = $('[data-burger]');
	burger && burger.addEventListener('click', function () {
		var open = !root.classList.contains('is-menu');
		root.classList.toggle('is-menu', open);
		burger.setAttribute('aria-expanded', String(open));
		document.body.style.overflow = open ? 'hidden' : '';
	});
	$$('.nav__lang').forEach(function (l) {
		var b = $('button', l);
		b.addEventListener('click', function (e) { e.stopPropagation(); var o = !l.classList.contains('is-open'); l.classList.toggle('is-open', o); b.setAttribute('aria-expanded', String(o)); });
		document.addEventListener('click', function () { l.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
	});
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Escape') return;
		if (root.classList.contains('is-menu')) burger.click();
		$$('.nav__lang.is-open').forEach(function (l) { l.classList.remove('is-open'); });
	});

	/* Vyhledávání: záložky domů, živý počet, vymazání */
	(function () {
		var form = $('[data-search]');
		if (!form || !data) return;
		var tabs = $$('[data-bld]', form), floorSel = $('select[name="quickFloor[]"]', form);
		var bld = '';
		var allFloorOpts = $$('option', floorSel).map(function (o) { return { v: o.value, l: o.textContent, b: o.getAttribute('data-b') }; });
		function setBld(b) {
			bld = b;
			tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-bld') === b)); });
			var cur = floorSel.value;
			floorSel.innerHTML = allFloorOpts.filter(function (o) { return !o.v || !b || o.b === b; }).map(function (o) { return '<option value="' + o.v + '"' + (o.b ? ' data-b="' + o.b + '"' : '') + '>' + o.l + '</option>'; }).join('');
			if ($('option[value="' + cur + '"]', floorSel)) floorSel.value = cur;
			count();
		}
		function inR(v, r) { if (!r) return true; var p = r.split('-'); return v >= +p[0] && v < +p[1]; }
		function count() {
			var f = Object.fromEntries(new FormData(form).entries());
			var dispo = f['quickDisposition[]'] ? data.dispos[f['quickDisposition[]']] : '';
			var floor = f['quickFloor[]'] ? data.floorByPart[f['quickFloor[]']] : '';
			var n = data.units.filter(function (u) {
				if (u.s !== 'available') return false;
				if (dispo && u.d !== dispo) return false;
				if (floor && u.f !== floor) return false;
				if (!floor && bld && u.b !== bld) return false;
				if (!inR(u.a, f['quickArea[]'])) return false;
				if (!inR(u.p, f['quickPrice[]'])) return false;
				return true;
			}).length;
			$('[data-count]', form).textContent = n + ' ' + (n === 1 ? 'volný byt' : n >= 2 && n <= 4 ? 'volné byty' : 'volných bytů');
		}
		tabs.forEach(function (t) { t.addEventListener('click', function () { setBld(t.getAttribute('data-bld')); }); });
		form.addEventListener('change', count);
		$('[data-clear]', form).addEventListener('click', function () { $$('select', form).forEach(function (s) { s.value = ''; }); setBld(''); });
		// Záložka domu bez zvoleného podlaží = všechna podlaží domu (stejný parametr jako ve šabloně)
		form.addEventListener('submit', function () {
			$$('input[data-auto]', form).forEach(function (i) { i.remove(); });
			// prázdné výběry neposílat (čistší URL nabídky)
			var empty = $$('select', form).filter(function (s) { return !s.value; });
			empty.forEach(function (s) { s.disabled = true; });
			setTimeout(function () { empty.forEach(function (s) { s.disabled = false; }); }, 0);
			if (bld && !floorSel.value) {
				floorSel.disabled = true;
				allFloorOpts.filter(function (o) { return o.b === bld; }).forEach(function (o) {
					var i = document.createElement('input'); i.type = 'hidden'; i.name = 'quickFloor[]'; i.value = o.v; i.setAttribute('data-auto', ''); form.appendChild(i);
				});
				setTimeout(function () { floorSel.disabled = false; }, 0);
			}
		});
		count();
	})();

	/* Panoráma: jemná samorotace (ukazuje, že je interaktivní) + nápověda s prstem.
	   Po zásahu uživatele se zastaví a po chvíli nečinnosti se pomalu rozjede znovu. */
	(function () {
		var el = $('[data-panorama-viewer]'), hint = $('.panoHint');
		if (!el) return;
		var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		var SPEED = 0.035, IDLE = 6000; // rad/s (~2°/s), prodleva po interakci
		var v = null, last = 0, pausedUntil = 0, visible = true, ramp = 0;
		function stop() {
			pausedUntil = performance.now() + IDLE; ramp = 0;
			if (hint) hint.classList.add('is-off');
		}
		['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (e) { el.addEventListener(e, stop, { passive: true, capture: true }); });
		if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(el);
		function tick(t) {
			requestAnimationFrame(tick);
			var dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
			if (!v || reduce || !visible || document.hidden || t < pausedUntil) return;
			ramp = Math.min(1, ramp + dt / 1.5); // plynulý rozjezd
			var p = v.getPosition();
			v.rotate({ yaw: p.yaw + SPEED * ramp * dt, pitch: p.pitch });
		}
		(function wait(n) {
			if (el.__psv) {
				v = el.__psv;
				var go = function () { pausedUntil = performance.now() + 1200; requestAnimationFrame(tick); if (hint) { hint.classList.add('is-on'); setTimeout(function () { hint.classList.add('is-off'); }, 10000); } };
				v.state && v.state.ready ? go() : v.addEventListener('ready', go, { once: true });
			} else if (n < 200) setTimeout(function () { wait(n + 1); }, 100);
		})(0);
	})();

	/* Mapa: karta adresy projektu jen při najetí na pin „B“ (na dotyku po klepnutí) */
	(function () {
		var box = $('.mapBox');
		if (!box) return;
		var tmr;
		function mainPin(t) { var p = t.closest && t.closest('.brave-map-pin'); return p && p.querySelector('img[src*="/pins/projekt"]') ? p : null; }
		function inCard(t) { var p = t.closest && t.closest('.leaflet-popup'); return !!(p && p.querySelector('.addressCard')); }
		function show(pin) {
			clearTimeout(tmr);
			if (!box.querySelector('.leaflet-popup .addressCard')) pin.click(); // otevře kartu přes Leaflet
			box.classList.add('is-addr');
		}
		function hide() { clearTimeout(tmr); tmr = setTimeout(function () { box.classList.remove('is-addr'); }, 250); }
		box.addEventListener('mouseover', function (e) { var p = mainPin(e.target); if (p) show(p); else if (inCard(e.target)) clearTimeout(tmr); });
		box.addEventListener('mouseout', function (e) { if (mainPin(e.target) || inCard(e.target)) hide(); });
		box.addEventListener('click', function (e) {
			if (mainPin(e.target)) { clearTimeout(tmr); box.classList.add('is-addr'); }
			else if (!inCard(e.target)) box.classList.remove('is-addr');
		});
	})();


	/* Interaktivní dům: popisek podlaží */
	$$('[data-house]').forEach(function (h) {
		var tip = $('.house__tip', h);
		$$('.band', h).forEach(function (b) {
			function on() {
				var r = h.getBoundingClientRect(), br = b.getBoundingClientRect();
				tip.innerHTML = b.getAttribute('data-tip');
				tip.style.left = (br.left - r.left + br.width / 2) + 'px';
				tip.style.top = (br.top - r.top) + 'px';
				tip.classList.add('on');
			}
			function off() { tip.classList.remove('on'); }
			var a = b.parentNode;
			a.addEventListener('mouseenter', on); a.addEventListener('focus', on);
			a.addEventListener('mouseleave', off); a.addEventListener('blur', off);
		});
	});

	/* Lightbox galerie */
	(function () {
		var items = $$('[data-lb]');
		if (!items.length) return;
		var box = document.createElement('div');
		box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Galerie');
		box.innerHTML = '<div class="lb__bar"><span data-c></span><button class="sq" type="button" data-x aria-label="Zavřít">✕</button></div><div class="lb__stage"><img alt=""></div><div class="lb__bar"><button class="sq" type="button" data-p aria-label="Předchozí">←</button><span>Vizualizace</span><button class="sq" type="button" data-n aria-label="Další">→</button></div>';
		document.body.appendChild(box);
		var img = $('img', box), i = 0, from = null;
		function show() { img.src = items[i].getAttribute('data-lb'); img.alt = items[i].getAttribute('aria-label') || ''; $('[data-c]', box).textContent = (i + 1) + ' / ' + items.length; }
		function close() { box.classList.remove('on'); from && from.focus(); }
		items.forEach(function (b, k) { b.addEventListener('click', function () { i = k; from = b; show(); box.classList.add('on'); $('[data-x]', box).focus(); }); });
		$('[data-x]', box).onclick = close;
		$('[data-p]', box).onclick = function () { i = (i - 1 + items.length) % items.length; show(); };
		$('[data-n]', box).onclick = function () { i = (i + 1) % items.length; show(); };
		box.addEventListener('click', function (e) { if (e.target.classList.contains('lb__stage')) close(); });
		document.addEventListener('keydown', function (e) { if (!box.classList.contains('on')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') $('[data-p]', box).click(); if (e.key === 'ArrowRight') $('[data-n]', box).click(); });
	})();

	/* Odhalení při scrollu (kontrola v rAF — spolehlivé i vedle WebGL panoramatu) */
	(function () {
		var pend = $$('[data-r]'), t = false;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { pend.forEach(function (e) { e.classList.add('in'); }); return; }
		function chk() { t = false; var lim = innerHeight * 0.95; pend = pend.filter(function (e) { var r = e.getBoundingClientRect(); if (r.top < lim) { e.classList.add('in'); return false; } return true; }); }
		window.addEventListener('scroll', function () { if (!t) { t = true; requestAnimationFrame(chk); } }, { passive: true });
		chk();
	})();
})();
