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
   * Cache-uim referințele elementelor pentru viteză maximă de randare */
  var LoaderArhiva = (function () {
    var elBara, elProgres, elPct, elMsg, elArhiva;
    function initCache() {
      if (!elBara) {
        elBara = document.getElementById('loader-bara');
        elProgres = document.getElementById('loader-progres');
        elPct = document.getElementById('loader-pct');
        elMsg = document.getElementById('loader-msg');
        elArhiva = document.getElementById('loader-arhiva');
      }
    }
    function set(pct, msg) {
      initCache();
      pct = Math.max(0, Math.min(100, Math.round(pct)));
      if (elProgres) elProgres.style.width = pct + '%';
      if (elBara) elBara.setAttribute('aria-valuenow', String(pct));
      if (elPct) elPct.textContent = pct + '%';
      if (elMsg && msg) elMsg.textContent = msg;
    }
    var gata = false;
    function done() {
      if (gata) return;
      gata = true;
      set(100, 'Arhiva e deschisă. Bine ai venit!');
      document.body.classList.add('arhiva-gata');
      setTimeout(function () {
        initCache();
        if (elArhiva && elArhiva.parentNode) elArhiva.parentNode.removeChild(elArhiva);
      }, 700);
    }
    setTimeout(done, SIGURANTA_LOADER_MS);
    /* muzeu.js anunță primul cadru randat → închidem precis, nu aproximativ */
    window.addEventListener('muzeu-gata', done, { once: true });
    window.addEventListener('load', function () { setTimeout(done, 2000); });
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
      (document.head || document.body).appendChild(s);
    });
  }

  function fetchJSON(url, ms, noStore) {
    var c = ('AbortController' in window) ? new AbortController() : null;
    var t = setTimeout(function () { if (c) c.abort(); }, ms || TIMEOUT_MS);
    var opt = { signal: c ? c.signal : undefined };
    if (noStore) opt.cache = 'no-store';
    return fetch(url, opt).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' la ' + url);
      return r.json();
    }).catch(function (e) { clearTimeout(t); throw e; });
  }

  /* data.js declară const MUZEU (lexical, nu pe window) — citește pe ambele căi. */
  function G_MUZEU() { return (typeof MUZEU !== 'undefined') ? MUZEU : window.MUZEU; }

  /* Normalizează o fișă Pages CMS → formatul intern folosit de muzeu.js. */
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

  /* Citește obiectele din content/obiecte/ cu verificare de cache sincronizată cu CMS-ul.
   * index.json are mereu noStore ca să detecteze instant orice editare din Pages CMS.
   * Dacă updatedAt e identic, cele 51 de fișe sunt servite instant din memorie (0 cereri HTTP). */
  function incarcaContentObiecte() {
    return fetchJSON('content/obiecte/index.json', TIMEOUT_MS, true).then(function (idx) {
      var files = (idx && idx.files) || [];
      if (!files.length) throw new Error('index gol');
      
      var cheieVersiune = 'muzeu_cache_' + (idx.updatedAt || idx.count);
      try {
        var salvate = localStorage.getItem(cheieVersiune);
        if (salvate) {
          var lista = JSON.parse(salvate);
          if (Array.isArray(lista) && lista.length === files.length) {
            LoaderArhiva.set(60, 'Fișele sunt încărcate din arhiva locală…');
            return lista;
          }
        }
      } catch (err) {}

      LoaderArhiva.set(50, 'Se citesc fișele din content/obiecte…');
      return Promise.allSettled(files.map(function (f) {
        return fetchJSON('content/obiecte/' + f, TIMEOUT_MS, false);
      })).then(function (rez) {
        var ok = [];
        rez.forEach(function (r, i) {
          if (r.status === 'fulfilled') ok.push(normalizeazaObiect(r.value));
          else console.warn('[cms] Fișă inaccesibilă, sar peste:', files[i]);
        });
        
        try {
          for (var k in localStorage) {
            if (k.indexOf('muzeu_cache_') === 0) localStorage.removeItem(k);
          }
          localStorage.setItem(cheieVersiune, JSON.stringify(ok));
        } catch (err) {}
        
        return ok;
      });
    });
  }

  /* Boot optimizat paralel: data.js, raioane.js și fișele se încarcă simultan */
  function bootStatic(dosId, viewCerut) {
    LoaderArhiva.set(20, 'Deschidem arhiva locală…');

    var pData = loadScript('js/data.js');
    var pRaioane = loadScript('js/raioane.js');
    var pContent = incarcaContentObiecte().catch(function (e) {
      console.warn('[cms] content/obiecte indisponibil, folosesc rezerva:', (e && e.message) || e);
      return [];
    });

    return Promise.all([pData, pRaioane, pContent])
      .then(function (rezultate) {
        var obiecte = rezultate[2];
        if (obiecte && obiecte.length) G_MUZEU().obiecte = obiecte;
        LoaderArhiva.set(68, 'Fișele sunt pregătite (' + G_MUZEU().obiecte.length + ')…');

        var MZ = G_MUZEU();
        var maxDosar = 0;
        MZ.obiecte.forEach(function (x) {
          var m = /^DOS-(\d+)$/i.exec(String(x.dosarId || ''));
          if (m) maxDosar = Math.max(maxDosar, parseInt(m[1], 10));
        });
        MZ.obiecte.forEach(function (o) {
          if (o.dosarId) return;
          maxDosar += 1;
          o.dosarId = 'DOS-' + String(maxDosar).padStart(5, '0');
        });

        if (viewCerut === 'contribuie') {
          window.__boot = { view: 'contribuie' };
        } else if (dosId) {
          var exista = MZ.obiecte.some(function (x) { 
            return String(x.dosarId || x.id || '').toUpperCase() === String(dosId).toUpperCase(); 
          });
          window.__boot = { view: 'dosar', dosar: String(dosId).toUpperCase(), dosarLipsa: !exista };
          if (!exista) console.warn('[cms] Dosarul cerut nu există:', dosId);
        } else {
          window.__boot = { view: 'home' };
        }

        LoaderArhiva.set(80, 'Se așază exponatele…');
        return loadScript('js/muzeu.js').then(function () { 
          LoaderArhiva.set(90, 'Se aprind luminile sălii…'); 
        });
      });
  }

  function boot() {
    LoaderArhiva.set(10, 'Se descuie ușile muzeului…');
    var q = parseQuery(location.search);
    if (q.view === 'contribuie') return bootStatic(null, 'contribuie');
    if (q.dosar) return bootStatic(q.dosar, 'dosar');
    return bootStatic(null, 'home');
  }

  window.__cms = { parseQuery: parseQuery };
  boot().catch(function (e) { console.error('[cms]', e); });
})();
