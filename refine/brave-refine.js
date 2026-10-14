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

	ready(function () {
		// UIkit připojuje komponenty při parsování / DOMContentLoaded — sticky
		// rušíme až po něm, jinak by se znovu připojil.
		setTimeout(smartHeader, 0);
		window.addEventListener('load', smartHeader);
	});
})();
