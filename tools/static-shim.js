/* Statický shim pro náhled na GitHub Pages — NENÍ součástí UI úprav.
   Živý web běží na PHP/Nette; tady jen zařizuje, aby kopie fungovala bez serveru:
   - AJAX na kořenové cesty míří pod BASE, data map z uložených JSON, signály (?do=…) na prázdnou odpověď,
   - cookie lišta se dá zavřít (pamatuje si to localStorage),
   - klasické POST formuláře se neodešlou (server tu není) — ukáže se krátké upozornění,
   - přepínač Upravená / Původní verze (localStorage + ?puvodni / ?upravene). */
(function () {
	var B = '__BASE__';
	window.__BRAVE_BASE = B;

	var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
		set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
	var qs = location.search;
	if (/[?&]puvodni\b/.test(qs)) store.set('brave-refine', 'off');
	if (/[?&]upravene\b/.test(qs)) store.set('brave-refine', 'on');
	var off = store.get('brave-refine') === 'off';
	window.__BRAVE_REFINE_OFF = off;
	var html = document.documentElement;
	html.classList.add('is-static-preview');
	if (off) html.classList.add('refine-off');
	if (store.get('brave-static-cookie')) html.classList.add('static-cookie-ok');

	function slug(s) {
		return s.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'root';
	}
	function map(u) {
		if (typeof u !== 'string') return u;
		var v = u;
		if (v.indexOf(location.origin) === 0) v = v.slice(location.origin.length);
		if (v.indexOf('https://demo.bravedevelopment.cz') === 0) v = v.slice(33) || '/';
		if (v.charAt(0) === '?') v = location.pathname + v;
		if (v.charAt(0) !== '/' || v.charAt(1) === '/') return u;
		if (/[?&]do=map-[a-z0-9]+-(options|markers|lines)/i.test(v)) {
			if (v.indexOf(B + '/') === 0) v = v.slice(B.length) || '/';
			return B + '/_data/' + slug(v) + '.json';
		}
		if (/[?&]_?do=/.test(v)) return B + '/_data/noop.json';
		if (v.indexOf(B + '/') === 0 || v === B) return u;
		return B + v;
	}

	var open = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (method, url) {
		var mapped = map(url);
		var args = Array.prototype.slice.call(arguments);
		if (mapped !== url) {
			args[1] = mapped;
			// GitHub Pages na POST odpoví 405 — u statických odpovědí stačí GET
			if (/\/_data\//.test(mapped)) args[0] = 'GET';
		}
		return open.apply(this, args);
	};
	if (window.fetch) {
		var f = window.fetch;
		window.fetch = function (input, init) {
			if (typeof input === 'string') {
				var m = map(input);
				if (m !== input && /\/_data\//.test(m) && init) init = Object.assign({}, init, { method: 'GET', body: undefined });
				input = m;
			}
			return f.call(this, input, init);
		};
	}

	function toast(text) {
		var t = document.createElement('div');
		t.className = 'staticToast';
		t.setAttribute('role', 'status');
		t.textContent = text;
		document.body.appendChild(t);
		setTimeout(function () { t.classList.add('is-in'); }, 10);
		setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 400); }, 3600);
	}

	document.addEventListener('submit', function (e) {
		var form = e.target;
		if (!form || form.tagName !== 'FORM') return;
		if (form.id === 'frm-cookieBar-settingsForm') {
			e.preventDefault();
			e.stopImmediatePropagation();
			store.set('brave-static-cookie', '1');
			html.classList.add('static-cookie-ok');
			return;
		}
		// Bublá až sem, takže validace Nette (na formuláři) už proběhla a případně
		// odeslání zastavila — upozornění jen u platně vyplněného formuláře.
		if ((form.method || '').toLowerCase() === 'post' && !form.classList.contains('ajax')) {
			if (!e.defaultPrevented) {
				e.preventDefault();
				toast('Statický náhled: formulář se neodesílá, na živém webu proběhne odeslání.');
			}
		}
	});
	document.addEventListener('submit', function (e) {
		var form = e.target;
		if (form && form.classList && form.classList.contains('ajax') && /reoUnit(Favorite|Comparison)/.test(form.id || '')) {
			toast('Statický náhled: oblíbené a porovnání ukládá server, zde se neukládají.');
		}
	}, true);
	// Cookie lišta: tlačítka jsou submit inputy uvnitř ajax formuláře
	document.addEventListener('click', function (e) {
		var b = e.target && e.target.closest && e.target.closest('#frm-cookieBar-settingsForm [type=submit]');
		if (!b) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		store.set('brave-static-cookie', '1');
		html.classList.add('static-cookie-ok');
	}, true);

	var css = document.createElement('style');
	css.textContent =
		'html.static-cookie-ok .cookie-bar-modal{display:none!important}' +
		'.staticToast{position:fixed;left:50%;bottom:24px;z-index:100000;transform:translate(-50%,12px);opacity:0;max-width:calc(100% - 32px);' +
		'background:#111;color:#fff;font:500 13px/1.45 Poppins,system-ui,sans-serif;padding:12px 18px;border-radius:8px;box-shadow:0 10px 30px rgb(0 0 0/.25);transition:.3s}' +
		'.staticToast.is-in{opacity:1;transform:translate(-50%,0)}' +
		'.refineSwitch{position:fixed;left:16px;bottom:16px;z-index:9990;display:flex;gap:2px;padding:3px;border-radius:999px;background:rgb(17 17 17/.82);' +
		'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:600 11px/1 Poppins,system-ui,sans-serif;letter-spacing:.02em;box-shadow:0 6px 20px rgb(0 0 0/.18)}' +
		'.refineSwitch button{all:unset;cursor:pointer;color:rgb(255 255 255/.7);padding:7px 11px;border-radius:999px;transition:.2s}' +
		'.refineSwitch button[aria-pressed=true]{background:#fff;color:#111}' +
		'.refineSwitch button:focus-visible{outline:2px solid #3cd070;outline-offset:2px}' +
		'@media print{.refineSwitch{display:none}}';
	document.head.appendChild(css);

	document.addEventListener('DOMContentLoaded', function () {
		var s = document.createElement('div');
		s.className = 'refineSwitch';
		s.setAttribute('role', 'group');
		s.setAttribute('aria-label', 'Verze náhledu');
		s.innerHTML = '<button type="button" data-v="on" aria-pressed="' + !off + '">Upravená</button>' +
			'<button type="button" data-v="off" aria-pressed="' + off + '">Původní</button>';
		s.addEventListener('click', function (e) {
			var b = e.target.closest('button');
			if (!b || b.getAttribute('aria-pressed') === 'true') return;
			store.set('brave-refine', b.getAttribute('data-v'));
			location.reload();
		});
		document.body.appendChild(s);
	});
})();
