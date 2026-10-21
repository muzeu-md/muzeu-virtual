/* Muzeu CMS bootloader — 100% static (GitHub Pages + Pages CMS).
 * Fără backend extern: fără Google Apps Script, fără ImgBB, fără API live.
 * Sursa de adevăr: content/obiecte/*.json (1 fișier = 1 obiect, editat via Pages CMS).
 * Ordinea stabilă din content/obiecte/index.json păstrează ID-urile DOS-00001…
 * js/data.js rămâne doar ca rezervă + sursă pentru muzeu/săli.
 * Regula de boot: ?home = harta; ?DOS-00001 = modalul dosarului;
 * ?raion[/sat] = muzeul raionului; ?contribuie = formularul (temporar suspendat). */
(function () {
  'use strict';
  var TIMEOUT_MS = 8000;
  var SIGURANTA_LOADER_MS = 12000; /* loader-ul nu blochează niciodată mai mult */

  /* ---- Loader tematic arhivă: progres real, nu spinner fals ----
   * Overlay-ul e HTML static în index.html (vizibil instant, fără JS).
   * Aici doar actualizăm bara; ascunderea se face cu body.arhiva-gata. */
  var LoaderArhiva = (function () {
    function el(id) { return document.getElementById(id); }
    function set(pct, msg) {
      pct = Math.max(0, Math.min(100, Math.round(pct)));
      var bara = el('loader-bara'), umplere = el('loader-progres'),
          txt = el('loader-pct'), mesaj = el('loader-msg');
      if (umplere) umplere.style.width = pct + '%';
      if (bara) bara.setAttribute('aria-valuenow', String(pct));
      if (txt) txt.textContent = pct + '%';
      if (mesaj && msg) mesaj.textContent = msg;
    }
    var gata = false;
    function done() {
      if (gata) return;
      gata = true;
      set(100, 'Arhiva e deschisă. Bine ai venit!');
      document.body.classList.add('arhiva-gata');
      setTimeout(function () {
        var n = el('loader-arhiva');
        if (n && n.parentNode) n.parentNode.removeChild(n);
      }, 700);
    }
    setTimeout(done, SIGURANTA_LOADER_MS);
    /* muzeu.js anunță primul cadru randat → închidem precis, nu aproximativ */
    window.addEventListener('muzeu-gata', done, { once: true });
    window.addEventListener('load', function () { setTimeout(done, 2500); });
    return { set: set, done: done };
  })();
  window.LoaderArhiva = LoaderArhiva;

  /* ---- parser URL (sursă unică, folosit și de muzeu.js la Back) ---- */
  function parseQuery(qs) {
    var q = String(qs || '').replace(/^[?#]/, '');
    var parts = q.split('&').filter(Boolean);
    var out = { view: 'home', raion: null, sat: null, dosar: null, contribuie: false };
    var path = '';
    var areContribuie = false;
    parts.forEach(function (p) {
      var m = /^dosar=(.+)$/i.exec(p);
      if (m) { out.dosar = m[1].trim().toUpperCase(); return; }
      if (/^contribuie($|=)/i.test(p)) { areContribuie = true; return; }
      if (p.indexOf('=') === -1 && !path) path = p;
    });
    if (areContribuie || (path && path.toLowerCase() === 'contribuie')) {
      out.view = 'contribuie'; out.contribuie = true; return out;
    }
    if (/^dos-\d+$/i.test(path)) { out.view = 'dosar'; out.dosar = path.toUpperCase(); return out; }
    if (!path || path.toLowerCase() === 'home') return out;
    var seg = path.split('/').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!seg.length) return out;
    out.view = 'muzeu'; out.raion = seg[0].toLowerCase();
    if (seg[1]) out.sat = seg[1].toLowerCase();
    return out;
  }

   function loadScript(src) {
     return new Promise(function (res, rej) {
       var s = document.createElement('script');
       s.src = src;
       s.defer = true;
       s.onload = res;
       s.onerror = function () { rej(new Error('Nu s-a încărcat ' + src)); };
       document.body.appendChild(s);
     });
   }
   function fetchJSON(url, ms) {
    var c = ('AbortController' in window) ? new AbortController() : null;
    var t = setTimeout(function () { if (c) c.abort(); }, ms || TIMEOUT_MS);
    var opt = c ? { signal: c.signal, cache: 'default' } : {};
    return fetch(url, opt).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' la ' + url);
      return r.json();
    }).catch(function (e) { clearTimeout(t); throw e; });
  }
  /* data.js declară const MUZEU (lexical, nu pe window) — citește pe ambele căi. */
  function G_MUZEU() { return (typeof MUZEU !== 'undefined') ? MUZEU : window.MUZEU; }

  /* Normalizează o fișă Pages CMS → formatul intern folosit de muzeu.js.
   * Acceptă hibrid imagini: cale relativă din repo (public/images/…) sau URL extern.
   * imagine_principala e mereu prima din galerie (e imaginea afișată în dosar);
   * img_1…img_4 sunt imaginile secundare, dedublicate. */
  function normalizeazaObiect(o) {
    o = o || {};
    var principal = String(o.imagine_principala || o.imagine || '').trim();
    var galerie = [principal, o.img_1, o.img_2, o.img_3, o.img_4].filter(function (u, i, a) {
      u = String(u || '').trim();
      return !!u && u !== '-' && a.indexOf(u) === i;
    });
    return {
      id: o.id, titlu: o.titlu, sala: o.sala, perioada: o.perioada, an: o.an,
      material: o.material, dimensiuni: o.dimensiuni, autor: o.autor || '',
      locatie_fizica: o.locatie_fizica || '', descriere: o.descriere || o.poveste || '',
      imagine: principal || (galerie[0] || ''), imagini: galerie, raion: o.raion || 'chisinau', sat: o.sat || null,
      dosarId: o.dosarId || null
    };
  }
  /* Citește obiectele din content/obiecte/ (index + câte un fetch per fișă).
   * Static pe GitHub Pages nu există listare de director, de aceea index.json
   * e regenerat de scripts/build-index.py (vezi .github/workflows/build-index.yml). */
  function incarcaContentObiecte() {
    return fetchJSON('content/obiecte/index.json', TIMEOUT_MS).then(function (idx) {
      var files = (idx && idx.files) || [];
      if (!files.length) throw new Error('index gol');
      LoaderArhiva.set(55, 'Se citesc fișele din content/obiecte…');
      /* allSettled: o fișă coruptă/404 nu golește tot muzeul — se sare peste ea */
      return Promise.allSettled(files.map(function (f) {
        return fetchJSON('content/obiecte/' + f, TIMEOUT_MS);
      })).then(function (rez) {
        var ok = [];
        rez.forEach(function (r, i) {
          if (r.status === 'fulfilled') ok.push(normalizeazaObiect(r.value));
          else console.warn('[cms] Fișă inaccesibilă, sar peste:',
            files[i], (r.reason && r.reason.message) || r.reason);
        });
        return ok;
      });
    });
  }

   /* Boot static unic: data + raioane + content/obiecte, apoi muzeu.js. */
  function bootStatic(dosId, viewCerut) {
    LoaderArhiva.set(25, 'Deschidem arhiva locală…');
    return loadScript('js/data.js')
      .then(function () { LoaderArhiva.set(45, 'File locale găsite…'); return loadScript('js/raioane.js'); })
      .then(function () {
        return incarcaContentObiecte().then(function (obiecte) {
          if (obiecte && obiecte.length) G_MUZEU().obiecte = obiecte;
          LoaderArhiva.set(60, 'Fișele sunt aici (' + G_MUZEU().obiecte.length + ')…');
        }).catch(function (e) {
          console.warn('[cms] content/obiecte indisponibil, folosesc js/data.js:', (e && e.message) || e);
        });
      })
      .then(function () {
        var MZ = G_MUZEU();
        /* Siguranță: dacă o fișă n-are dosarId (ocolire CMS), primește
         * următorul număr liber, niciodată unul deja folosit. */
        var maxDosar = 0;
        MZ.obiecte.forEach(function (x) {
          var m = /^DOS-(\d+)$/i.exec(String(x.dosarId || ''));
          if (m) maxDosar = Math.max(maxDosar, parseInt(m[1], 10));
        });
        MZ.obiecte.forEach(function (o) {
          if (o.dosarId) return;
          maxDosar += 1;
          o.dosarId = 'DOS-' + String(maxDosar).padStart(5, '0');
          console.warn('[cms] Fișă fără dosarId, atribuit automat:', o.id, o.dosarId);
        });
        if (viewCerut === 'contribuie') {
          window.__boot = { view: 'contribuie' };
        } else if (dosId) {
          var exista = MZ.obiecte.some(function (x) { return String(x.dosarId || x.id || '').toUpperCase() === String(dosId).toUpperCase(); });
          window.__boot = { view: 'dosar', dosar: String(dosId).toUpperCase(), dosarLipsa: !exista };
          if (!exista) console.warn('[cms] Dosarul cerut nu există în content/obiecte:', dosId);
        } else {
          window.__boot = { view: 'home' };
        }
        LoaderArhiva.set(70, 'Se așază exponatele…');
        return loadScript('js/muzeu.js').then(function () { LoaderArhiva.set(88, 'Se aprind luminile sălii…'); });
      });
  }

  function boot() {
    LoaderArhiva.set(12, 'Se descuie ușile muzeului…');
    var q = parseQuery(location.search);
    if (q.view === 'contribuie') return bootStatic(null, 'contribuie');
    if (q.dosar) return bootStatic(q.dosar, 'dosar');
    return bootStatic(null, 'home');
  }

  window.__cms = { parseQuery: parseQuery };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot().catch(function (e) { console.error('[cms]', e); }); });
  } else {
    boot().catch(function (e) { console.error('[cms]', e); });
  }
})();
