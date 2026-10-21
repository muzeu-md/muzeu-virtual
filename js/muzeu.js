/* Muzeul Național — Harta muzeelor din Republica Moldova: poartă + săli vii + dosar + sunet */
(function(){
'use strict';
const redus = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* ---- rama semnătură: fiecare sală are o singură ramă, potrivită vizual ----
 * ↑ clasa CSS .rama-<sufix> (vezi css/muzeu.css). Fișele n-au rămâne manual —
 * rama vine din sală, niciodată per obiect. */
const RAMA_PE_SALA = {
  'sala-documentelor': 'documentelor',
  'sala-scolii': 'scolii',
  'sala-naturii': 'naturii',
  'sala-mestesugurilor': 'mestesugurilor',
  'sala-gospodariei': 'gospodariei',
  'sala-marturiilor': 'marturiilor'
};
function ramaPentru(o){
  return RAMA_PE_SALA[(o && o.sala)] || 'documentelor';
}
/* ---- săgeata mică „←" ca SVG (nu glif de font): butoanele o centrează optic
 * prin flex, fără să depindă de metrica fontului (Cinzel nu are săgeți optice) ---- */
const SAGEATA_MICA_SVG = '<svg class="sageata-svg sageata-mica" aria-hidden="true" focusable="false" viewBox="0 0 13 10" width="13" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.1 5H1.1"/><path d="M4.9 1.4 1.3 5l3.6 3.6"/></svg>';
function poze(o){ return (o.imagini && o.imagini.length ? o.imagini : [o.imagine]); }
function roman(n){
  const t = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let s = '';
  for(const [v,r] of t){ while(n >= v){ s += r; n -= v; } }
  return s || 'I';
}
/* ---- siguranță HTML: orice valoare din fișe trece prin esc() înainte de innerHTML ---- */
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '\u0026amp;').replace(/</g, '\u0026lt;').replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;').replace(/'/g, '\u0026#39;');
}
/* url() pentru style.backgroundImage: ghilimelele nu pot sparge șirul CSS */
function cssUrl(u){
  return 'url("' + String(u == null ? '' : u).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
}
/* Fallback poză (picsum cu seed-ul obiectului): o singură încercare, delegat
 * pe faza de captură (error nu bubble-uiește) — fără onerror inline, fără buclă. */
document.addEventListener('error', function(e){
  const t = e.target;
  if(!t || t.tagName !== 'IMG') return;
  const seed = t.getAttribute('data-fb-seed');
  if(!seed || t.dataset.fb) return;
  t.dataset.fb = '1';
  t.src = 'https://picsum.photos/seed/' + seed + '/' + (t.getAttribute('data-fb-size') || '600/500');
}, true);
function pregatesteFallbackPoza(img, seed, dim){
  if(!img) return;
  if(seed) img.setAttribute('data-fb-seed', seed); else img.removeAttribute('data-fb-seed');
  img.setAttribute('data-fb-size', dim || '600/500');
  img.removeAttribute('data-fb');
}
/* ---- sunet de arhivă: acustic-cald, sintetizat WebAudio, fără fișiere ---- */
const Sunet = (function(){
  let ctx = null, master = null;
  let activ = (function(){
    try{
      const v = localStorage.getItem('muzeu-sunet');
      if(v !== null) return v === '1';
    }catch(e){}
    return !(MUZEU && MUZEU.muzeu && MUZEU.muzeu.sunet === false);
  })();
  function ac(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = .5;
      const rev = ctx.createDelay(1); rev.delayTime.value = .16;
      const fb = ctx.createGain(); fb.gain.value = .25;
      const wet = ctx.createGain(); wet.gain.value = .3;
      master.connect(ctx.destination);
      master.connect(rev); rev.connect(fb); fb.connect(rev); rev.connect(wet); wet.connect(ctx.destination);
    }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function partial(frec, dur, vol, cand){
    const c = ac(); if(!c) return;
    const t = c.currentTime + (cand || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = frec;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + .05);
  }
  function hartieZg(dur, vol, f0, f1, cand){
    const c = ac(); if(!c) return;
    const t0 = c.currentTime + (cand || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for(let i = 0; i < len; i++){ const w = Math.random() * 2 - 1; last = (last + .04 * w) / 1.04; d[i] = last * 3.2 * (1 - i / len); }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = .6;
    f.frequency.setValueAtTime(f0 || 1400, t0);
    f.frequency.exponentialRampToValueAtTime(f1 || 400, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || .10, t0 + .03);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0);
  }
  function thump(frec, dur, vol, cand){
    if(!activ || redus) return;
    try{
      const c = ac(); if(!c) return;
      const t = c.currentTime + (cand || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(frec, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, frec * .55), t + dur);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + .05);
    }catch(e){}
  }
  function ok(){ return activ && !redus; }
  return {
    get activ(){ return activ; },
    comuta(){
      activ = !activ;
      try{ localStorage.setItem('muzeu-sunet', activ ? '1' : '0'); }catch(e){}
      return activ;
    },
    /* clopot de alamă: parțiale inarmonice cu stingere lungă */
    clopot(){
      if(!ok()) return;
      try{
        partial(523.25, 2.2, .10); partial(1244, 1.6, .045, .005);
        partial(1567, 1.3, .03, .008); partial(2093, 1.0, .018, .012);
        partial(261.6, 2.4, .05, .01);
      }catch(e){}
    },
    /* foșnet moale de hârtie, fără șuierat */
    hartie(){ if(!ok()) return; try{ hartieZg(.24, .11, 1500, 380); }catch(e){} },
    /* pași pe lemn: comozi, discreți */
    pas(){ thump(78, .16, .07); },
    /* sigiliu/pecete: bufnet moale */
    pecete(){ thump(150, .22, .08); thump(82, .3, .07, .04); },
    /* ușă grea de lemn: gliss descendent + frecare */
    usa(){
      if(!ok()) return;
      try{
        const c = ac(); if(!c) return;
        const t = c.currentTime;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(92, t);
        o.frequency.linearRampToValueAtTime(54, t + .9);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(.035, t + .1);
        g.gain.exponentialRampToValueAtTime(.0001, t + 1.0);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(t); o.stop(t + 1.05);
        hartieZg(.9, .03, 500, 180, .05);
        thump(60, .35, .06, .95);
      }catch(e){}
    }
  };
})();

/* praf subtil — culoarea se schimbă per sală */
const PrafViu = { culoare: '#ffe9b0' };
(function praf(){
  const c = document.getElementById('praf');
  if(!c || redus || !c.getContext) return;
  const x = c.getContext('2d');
  if(!x) return;
  const usorDinStart = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
  if(usorDinStart) document.body.classList.add('usor');
  let W, H, P = [];
  function dim(){
    W = c.width = innerWidth; H = c.height = innerHeight;
    const n = usorDinStart ? 25 : 80;
    P = [];
    for(let i = 0; i < n; i++) P.push({x: Math.random()*W, y: Math.random()*H, r: .6 + Math.random()*1.8, v: .12 + Math.random()*.35, o: .15 + Math.random()*.4});
  }
  dim(); addEventListener('resize', dim);
  let cadre = 0, t0 = performance.now(), oprit = false, mort = false, rafPend = false;
  /* o singură programare rAF activă: comutări rapide de tab nu dublează bucla */
  function programeaza(){
    if(rafPend || mort || oprit) return;
    rafPend = true;
    requestAnimationFrame(() => { rafPend = false; f(); });
  }
  addEventListener('visibilitychange', () => { oprit = document.hidden; if(!oprit) programeaza(); });
  /* Cât loader-ul de arhivă e vizibil, sărim desenarea: GPU liber pentru boot.
   * Verificarea e ieftină (o clasă pe body), rAF-ul continuă ca să reluăm instant.
   * (rAF nu rulează în tab-uri ascunse, deci nu consumă baterie.) */
  function loaderActiv(){
    return !document.body.classList.contains('arhiva-gata') && !!document.getElementById('loader-arhiva');
  }
  function f(){
    if(mort) return;
    if(oprit) return; /* reluat de visibilitychange */
    if(loaderActiv()){ programeaza(); return; }
    x.clearRect(0, 0, W, H); x.fillStyle = PrafViu.culoare;
    for(const p of P){
      p.y -= p.v; p.x += Math.sin(p.y * .01) * .15;
      if(p.y < -4){ p.y = H + 4; p.x = Math.random() * W; }
      x.globalAlpha = p.o; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    cadre++;
    if(cadre === 210){
      const fps = cadre / ((performance.now() - t0) / 1000);
      if(fps < 25){ mort = true; document.body.classList.add('usor'); x.clearRect(0, 0, W, H); return; }
    }
    programeaza();
  }
  programeaza();
})();

const stepperEl = document.getElementById('stepper');
const pista = document.getElementById('car-pista');
const salon = document.getElementById('salon');
const fer = document.getElementById('fereastra');
let salaCurenta = MUZEU.sali[0].id;
let obiecte = [];
let imaginiVizon = [], idxVizon = 0;
let idx = 0;

/* ---- raion + sat (harta Moldovei) ---- */
let DATE_RAIOANE = (typeof RAIOANE !== 'undefined' && RAIOANE.raioane) ? RAIOANE.raioane : [];
let blocIstoric = false; /* true când aplicăm o stare din Back/Forward: URL-ul nu se rescrie */
let raionCurent = 'chisinau';
let satCurent = null;

/* Baza URL-urilor de stare (?home, ?raion[/sat], ?DOS-…): numele paginii curente. */
const PAGINA = location.pathname.split('/').pop() || 'index.html';

/* ---- index-uri Map pentru O(1) ---- */
const RAION_MAP = new Map(DATE_RAIOANE.map(r => [r.id, r]));
const SAT_NAME_MAP = new Map();
const SALA_MAP = new Map(MUZEU.sali.map(s => [s.id, s]));
const RAION_TOTAL = new Map();
const SALA_OBIECTE_MAP = new Map();
DATE_RAIOANE.forEach(r => { RAION_TOTAL.set(r.id, 0); (r.sate || []).forEach(s => SAT_NAME_MAP.set(s.id, s.nume)); });
let OBIECTE_MAP = new Map();
let OBIECTE_BY_SALARAMA = new Map();

function raionInfo(id){ return RAION_MAP.get(id) || null; }
function tipRaion(id){
  const r = RAION_MAP.get(id);
  if(r && r.tip === 'municipiu') return 'Municipiul';
  if(r && r.tip === 'autonomie') return 'Unitatea';
  return 'Raionul';
}
function numeRaion(id){ const r = RAION_MAP.get(id); return r ? r.nume : 'Chișinău'; }
function numeSat(rid, sid){ return SAT_NAME_MAP.get(sid) || null; }
function countSat(rid, sid){
  if(!sid) return RAION_TOTAL.get(rid) || 0;
  return (OBIECTE_BY_SALARAMA.get(`${rid}/${sid}`) || []).length;
}
function listaSala(id){
  return OBIECTE_BY_SALARAMA.get(`${id}/${raionCurent}/${satCurent || ''}`) || [];
}
function dosarIdDe(o){ return String((o && (o.dosarId || o.id)) || '').toUpperCase(); }
function gasesteDosar(id){
  id = String(id || '').toUpperCase();
  return OBIECTE_MAP.get(id) || null;
}
function codArticol(o){
  /* Codul afișat vine din câmpul dosarId stocat (DOS-xxxxx → #xxxxx),
   * nu din poziția în listă: rămâne stabil la adăugarea de fișe noi. */
  const m = /DOS-(\d+)/i.exec(String((o && o.dosarId) || ''));
  if(m) return '#' + m[1].padStart(5, '0');
  const i = [...OBIECTE_MAP.values()].findIndex(x => x.id === o.id);
  return '#' + String(i + 1).padStart(5, '0');
}

function construieIndexuri(){
  RAION_TOTAL.clear();
  DATE_RAIOANE.forEach(r => RAION_TOTAL.set(r.id, 0));
  SALA_OBIECTE_MAP.clear();
  const obiecte = MUZEU.obiecte;
  OBIECTE_MAP = new Map(obiecte.map(o => [dosarIdDe(o), o]));
  OBIECTE_BY_SALARAMA = new Map();
  obiecte.forEach(o => {
    const raion = o.raion || 'chisinau';
    const sat = o.sat || raion;
    const sala = o.sala;
    /* Chei array (nu contoare): oglindesc exact filtrele vechiului listaSala —
     * `${sala}/${raion}/` = tot raionul (satCurent null),
     * `${sala}/${raion}/${sat}` = un sat anume (satul lipsei = raionul). */
    const kRS = `${raion}/${sat}`;
    const aRS = OBIECTE_BY_SALARAMA.get(kRS) || [];
    aRS.push(o);
    OBIECTE_BY_SALARAMA.set(kRS, aRS);
    RAION_TOTAL.set(raion, (RAION_TOTAL.get(raion) || 0) + 1);
    if(sala){
      const arr = SALA_OBIECTE_MAP.get(sala) || [];
      arr.push(o);
      SALA_OBIECTE_MAP.set(sala, arr);
      const kToate = `${sala}/${raion}/`;
      const aToate = OBIECTE_BY_SALARAMA.get(kToate) || [];
      aToate.push(o);
      OBIECTE_BY_SALARAMA.set(kToate, aToate);
      const kSat = `${sala}/${raion}/${sat}`;
      if(kSat !== kToate){
        const aSat = OBIECTE_BY_SALARAMA.get(kSat) || [];
        aSat.push(o);
        OBIECTE_BY_SALARAMA.set(kSat, aSat);
      }
    }
  });
}

/* ---- stepper (cu buton înapoi la hartă) ---- */
function randareStepper(){
  stepperEl.innerHTML =
    `<button class="inapoi" id="btn-harta" title="Înapoi la harta Moldovei">${SAGEATA_MICA_SVG}<span>HARTA</span></button>` +
    MUZEU.sali.map(s =>
    `<button type="button" data-sala="${s.id}" class="sala-tab${s.id === salaCurenta ? ' on' : ''}" aria-current="${s.id === salaCurenta}">${esc(s.nume)}</button>`
  ).join('');
  const on = stepperEl.querySelector('.on');
  if(on) on.scrollIntoView({block: 'nearest', inline: 'center'});
}

/* ---- titlul paginii: pe hartă = HARTA MUZEELOR…; în muzeu = [RAION] - MUZEU ---- */
const TITLU_HOME = 'HARTA MUZEELOR DIN REPUBLICA MOLDOVA';
function titluMuzeu(){
  return numeRaion(raionCurent).toLocaleUpperCase('ro-RO') + ' - MUZEU';
}
/* ---- footer viu: raion + sat (buton) ---- */
function actualizeazaFooter(vedere){
  const fr = document.getElementById('f-raion');
  const chip = document.getElementById('sate-stare');
  const bs = document.getElementById('btn-sate');
  const ns = satCurent ? numeSat(raionCurent, satCurent) : null;
  if(fr) fr.textContent = tipRaion(raionCurent) + ' ' + numeRaion(raionCurent);
  if(chip) chip.textContent = ns ? ns : 'Toate satele';
  if(bs) bs.title = ns ? 'Schimbi satul (' + ns + ')' : 'Vezi satele raionului';
  /* vedere: 'muzeu' | 'acasa' | lipsă = autodetect după starea porții */
  const inMuzeu = vedere === 'muzeu' || (vedere !== 'acasa' && document.body.classList.contains('poarta-deschisa'));
  document.title = inMuzeu ? titluMuzeu() : TITLU_HOME;
}

/* ---- cartușul sălii ---- */
function randareCartus(){
  const s = SALA_MAP.get(salaCurenta) || MUZEU.sali[0];
  const i = MUZEU.sali.indexOf(s);
  const icon = document.getElementById('cartus-icon');
  const nume = document.getElementById('cartus-nume');
  const desc = document.getElementById('cartus-desc');
  const nr = document.getElementById('cartus-nr');
  if(icon) icon.textContent = s.icon || '◆';
  if(nume) nume.textContent = s.nume;
  if(desc) desc.textContent = s.descriere || '';
  if(nr) nr.textContent = 'SALA ' + roman(i + 1);
  document.body.dataset.sala = s.id;
  if(s.perete) document.body.style.setProperty('--perete', s.perete);
  if(s.lambriu) document.body.style.setProperty('--lambriu', s.lambriu);
  const prafuri = {
    'sala-documentelor': '#d8e8d5', 'sala-scolii': '#cfd8f0', 'sala-naturii': '#d8f0c8',
    'sala-mestesugurilor': '#ffc890', 'sala-gospodariei': '#ffe0a0', 'sala-marturiilor': '#e0c8e8'
  };
  PrafViu.culoare = prafuri[s.id] || '#ffe9b0';
  umpleModalSala(s, i);
}

/* ---- modal sala: detaliile sălii curente ---- */
function umpleModalSala(s, i){
  const icon = document.getElementById('ms-icon');
  const nume = document.getElementById('ms-nume');
  const nr = document.getElementById('ms-nr');
  const desc = document.getElementById('ms-descriere');
  const tipice = document.getElementById('ms-tipice');
  const contor = document.getElementById('ms-contor');
  const acum = document.getElementById('ms-acum');
  const invitatie = document.getElementById('ms-invitatie');
  if(!nume) return;
  if(icon) icon.textContent = s.icon || '◆';
  if(nume) nume.textContent = s.nume;
  if(nr) nr.textContent = 'SALA ' + roman(i + 1);
  if(desc) desc.textContent = s.descriere || '';
  if(tipice){
    tipice.innerHTML = (s.obiecte_tipice || []).map(t => `<li>${esc(t)}</li>`).join('') || '<li>—</li>';
  }
  const inSala = SALA_OBIECTE_MAP.get(s.id) || [];
  if(contor) contor.textContent = inSala.length
    ? (inSala.length === 1 ? 'Un singur obiect te așteaptă aici:' : inSala.length + ' obiecte te așteaptă aici:')
    : 'Sala e încă goală — prima poveste poate fi a ta.';
  if(acum){
    acum.innerHTML = inSala.length
      ? inSala.map((o, k) => `<li data-obiect="${esc(o.id)}" role="button" tabindex="0">${esc(o.titlu)}</li>`).join('')
      : '<li class="ms-gol" style="cursor:default;border-style:dashed">Adaugă primul obiect prin butonul de pe hartă</li>';
  }
  if(invitatie) invitatie.textContent = s.invitatie || '';
}
function esteModalSalaDeschis(){ return document.body.classList.contains('modal-sala-deschis'); }
function deschideModalSala(){
  inchide();
  inchideSate();
  inchideModalSali();
  const m = document.getElementById('modal-sala');
  const f = document.getElementById('modal-sala-fundal');
  if(!m || !f || esteModalSalaDeschis()) return;
  Sunet.hartie();
  m.hidden = false; f.hidden = false;
  void m.offsetWidth;
  document.body.classList.add('modal-sala-deschis');
  const x = document.getElementById('modal-sala-inchide');
  if(x) x.focus({preventScroll:true});
}
function inchideModalSala(){
  if(!esteModalSalaDeschis()) return;
  document.body.classList.remove('modal-sala-deschis');
  const m = document.getElementById('modal-sala');
  const f = document.getElementById('modal-sala-fundal');
  setTimeout(() => {
    if(!esteModalSalaDeschis()){ if(m) m.hidden = true; if(f) f.hidden = true; }
  }, redus ? 0 : 320);
}
function leagaModalSala(){
  const cart = document.getElementById('cartus-sala');
  const x = document.getElementById('modal-sala-inchide');
  const f = document.getElementById('modal-sala-fundal');
  const acum = document.getElementById('ms-acum');
  if(cart){
    cart.addEventListener('click', () => { if(esteModalSalaDeschis()) inchideModalSala(); else deschideModalSala(); });
    cart.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); deschideModalSala(); } });
  }
  if(x) x.addEventListener('click', inchideModalSala);
  if(f) f.addEventListener('click', inchideModalSala);
  if(acum){
    acum.addEventListener('click', e => {
      const li = e.target.closest('li[data-obiect]');
      if(!li) return;
      const id = li.getAttribute('data-obiect');
      const k = obiecte.indexOf(OBIECTE_MAP.get(id));
      if(k < 0) return;
      inchideModalSala();
      idx = k;
      randareCarusel();
      deschide();
    });
    acum.addEventListener('keydown', e => {
      const li = e.target.closest('li[data-obiect]');
      if(li && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); li.click(); }
    });
  }
}

/* ---- modal SĂLI (burger SĂLI, mobil): lista sălilor pentru navigare ---- */
function esteModalSaliDeschis(){ return document.body.classList.contains('modal-sali-deschis'); }
function randareSaliModal(){
  const lista = document.getElementById('modal-sali-lista');
  if(!lista) return;
  lista.innerHTML = MUZEU.sali.map(s =>
    `<button class="modal-sali-btn${s.id === salaCurenta ? ' on' : ''}" data-sala="${s.id}">${s.nume}</button>`
  ).join('');
}
function deschideModalSali(){
  inchide();
  inchideSate();
  inchideModalSala();
  const m = document.getElementById('modal-sali');
  const f = document.getElementById('modal-sali-fundal');
  if(!m || !f || esteModalSaliDeschis()) return;
  randareSaliModal();
  Sunet.hartie();
  m.hidden = false; f.hidden = false;
  void m.offsetWidth;
  document.body.classList.add('modal-sali-deschis');
  const b = document.getElementById('cap-sali');
  if(b) b.setAttribute('aria-expanded', 'true');
  const x = document.getElementById('modal-sali-inchide');
  if(x) x.focus({preventScroll:true});
}
function inchideModalSali(){
  if(!esteModalSaliDeschis()) return;
  document.body.classList.remove('modal-sali-deschis');
  const m = document.getElementById('modal-sali');
  const f = document.getElementById('modal-sali-fundal');
  const b = document.getElementById('cap-sali');
  if(b) b.setAttribute('aria-expanded', 'false');
  setTimeout(() => {
    if(!esteModalSaliDeschis()){ if(m) m.hidden = true; if(f) f.hidden = true; }
  }, redus ? 0 : 320);
}
function leagaModalSali(){
  const h = document.getElementById('cap-harta');
  const b = document.getElementById('cap-sali');
  const x = document.getElementById('modal-sali-inchide');
  const f = document.getElementById('modal-sali-fundal');
  if(h) h.addEventListener('click', () => { Sunet.pas(); intoarceLaHarta(); });
  if(b) b.addEventListener('click', () => { if(esteModalSaliDeschis()) inchideModalSali(); else deschideModalSali(); });
  if(x) x.addEventListener('click', inchideModalSali);
  if(f) f.addEventListener('click', inchideModalSali);
}

/* ---- carusel ---- */
function etichetaFila(i, total){
  return 'FILA ' + (i + 1) + ' DIN ' + total;
}
function cardHTML(o, i, total, clasa){
  const r = ramaPentru(o);
  /* LCP: rama centrală e eager + prioritate mare + dimensiuni fixe (zero CLS);
   * lateralele rămân lazy. Toate imaginile: async decode, fără blocarea firului. */
  const centru = clasa === 'centru';
  return `<div class="cadru-card ${clasa}" data-i="${i}" role="button" tabindex="0" aria-label="${esc(o.titlu)}, ${etichetaFila(i, total)}">
    <div class="cadru rama-${r}">
      <span class="car-badge">${etichetaFila(i, total)}</span>
      <div class="paspartu">
        <img src="${esc(poze(o)[0])}" alt="${esc(o.titlu)}" width="800" height="600" loading="${centru ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${centru ? 'high' : 'low'}" draggable="false" data-fb-seed="${esc(o.id)}" data-fb-size="600/500">
        <div class="sticla"></div>
      </div>
      <div class="glare"></div>
    </div>
  </div>`;
}
/* ---- tilt 3D + glare pe rama centrală ---- */
const tiltFin = matchMedia('(pointer:fine)').matches && !redus;
function leagaTilt(){
  const card = pista.querySelector('.cadru-card.centru');
  const cadru = card && card.querySelector('.cadru');
  if(!card || !cadru || !tiltFin) return;
  const glare = cadru.querySelector('.glare');
  let rect = null, raf = 0, tx = 0, ty = 0, activ = false;
  function aplica(){
    raf = 0;
    if(!activ || !rect || !rect.width) return;
    const px = Math.max(0, Math.min(1, (tx - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (ty - rect.top) / rect.height));
    cadru.style.transform = `rotateX(${((0.5 - py) * 8).toFixed(2)}deg) rotateY(${((px - 0.5) * 10).toFixed(2)}deg) scale(1.02)`;
    cadru.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
    cadru.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    if(glare) glare.style.opacity = '1';
  }
  card.addEventListener('pointerenter', e => {
    activ = true; tx = e.clientX; ty = e.clientY;
    rect = card.getBoundingClientRect();
    cadru.style.transition = 'transform 0s';
    if(!raf) raf = requestAnimationFrame(aplica);
  });
  card.addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    if(!rect) rect = card.getBoundingClientRect();
    if(!raf) raf = requestAnimationFrame(aplica);
  });
  card.addEventListener('pointerleave', () => {
    activ = false;
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    cadru.style.transition = 'transform .6s cubic-bezier(.2,.9,.25,1)';
    cadru.style.transform = '';
    if(glare) glare.style.opacity = '0';
  });
}
function randareCarusel(dir){
  const n = obiecte.length;
  if(!n){
    /* vitrină goală: ACEEAŞI construcţie de dosar (dimensiuni + rama-semnătură a sălii active),
     * textul găzduit în pasartou, fără badge (nu e nimic de numărat) */
    const ramaGol = RAMA_PE_SALA[document.body.dataset.sala] || 'documentelor';
    pista.innerHTML = `<div class="cadru-card centru">
      <div class="cadru rama-${ramaGol}">
        <div class="paspartu">
          <div class="car-gol-fila" role="status">
            <p class="car-gol-rand1">Nu există încă obiecte aici.</p>
            <p class="car-gol-rand2">Alege alt sat sau adaugă primul exponat.</p>
          </div>
          <div class="sticla"></div>
        </div>
        <div class="glare"></div>
      </div>
    </div>`;
    document.getElementById('car-titlu').textContent = '';
    const mc0 = document.getElementById('mob-contor');
    if(mc0) mc0.textContent = '—';
    document.getElementById('btn-descopera').style.display = 'none';
    document.body.classList.add('carusel-gol');   /* săgețile ies din scenă: nu e nimic de navigat */
    return;
  }
  document.getElementById('btn-descopera').style.display = '';
  document.body.classList.remove('carusel-gol');
  idx = ((idx % n) + n) % n;
  if(!dir || redus) delete pista.dataset.dir;
  else pista.dataset.dir = dir > 0 ? 'stanga' : 'dreapta';
  const ant = obiecte[(idx - 1 + n) % n], cur = obiecte[idx], urm = obiecte[(idx + 1) % n];
  const ingust = innerWidth < 1100;
  pista.innerHTML =
    (ingust ? '' : cardHTML(ant, (idx - 1 + n) % n, n, 'lat')) +
    cardHTML(cur, idx, n, 'centru') +
    (ingust ? '' : cardHTML(urm, (idx + 1) % n, n, 'lat'));
  const titluEl = document.getElementById('car-titlu');
  titluEl.textContent = cur.titlu;
  if(dir && !redus && titluEl.animate){
    try{ titluEl.animate([{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 320, easing: 'cubic-bezier(.2,.9,.25,1)'}); }catch(e){}
  }
  const mc = document.getElementById('mob-contor');
  if(mc) mc.textContent = etichetaFila(idx, n);
  leagaTilt();
}

/* ---- dosar de arhivă ---- */
function esteDeschis(){ return document.body.classList.contains('deschis'); }
function actualizeazaBtnDosar(){
  const b = document.getElementById('btn-descopera');
  if(!b) return;
  b.textContent = esteDeschis() ? 'ÎNCHIDE DOSARUL' : 'DESCHIDE DOSARUL';
  b.setAttribute('aria-expanded', esteDeschis() ? 'true' : 'false');
}
function umpleFereastra(){
  const o = obiecte[idx];
  if(!o) return;
  const sala = SALA_MAP.get(o.sala);
  const imgs = poze(o);
  document.getElementById('f-badge').textContent = sala ? sala.nume : '';
  const inv = document.getElementById('f-inv');
  if(inv) inv.textContent = codArticol(o);
  const st = document.getElementById('f-stampila');
  if(st){
    const txtPerioada = String(o.perioada || '').trim();
    const txtAn = String(o.an || '').trim();
    const txt = txtPerioada + (txtAn ? (txtPerioada ? ' · Anul ' + txtAn : 'Anul ' + txtAn) : '');
    st.hidden = !txt;
    st.textContent = txt;
  }
  document.getElementById('f-titlu').textContent = o.titlu;
  const mare = document.getElementById('f-mare');
  const fundal = document.getElementById('f-mare-fundal');
  /* imaginea principală a dosarului e LCP-ul ferestrei: eager + prioritate mare */
  try{ mare.decoding = 'async'; mare.fetchPriority = 'high'; }catch(e){}
  mare.loading = 'eager';
  mare.width = 800; mare.height = 600;
  mare.src = imgs[0]; mare.alt = o.titlu;
  pregatesteFallbackPoza(mare, o.id, '600/500');
  if(fundal) fundal.style.backgroundImage = cssUrl(imgs[0]);
  const afis = imgs.slice(0, 5);
  imaginiVizon = afis.slice(); idxVizon = 0;
  document.getElementById('f-mini').innerHTML = afis.map((u, k) =>
    `<span class="mini${k === 0 ? ' on' : ''}" data-k="${k}" role="button" tabindex="0" aria-label="Imagine ${k + 1} — ${esc(o.titlu)}"><img src="${esc(u)}" alt="Imagine ${k + 1} — ${esc(o.titlu)}" width="200" height="150" loading="lazy" decoding="async" fetchpriority="low" data-fb-seed="${esc(o.id)}" data-fb-size="200/150"></span>`
  ).join('');
  /* preîncărcăm următoarea imagine din dosar, ca navigarea să fie instant */
  try{
    for(let k = 1; k < Math.min(afis.length, 3); k++){
      const pre = new Image(); pre.decoding = 'async'; pre.src = afis[k];
    }
  }catch(e){}
  document.getElementById('f-mini').querySelectorAll('.mini').forEach(t => {
    const arata = () => {
      Sunet.hartie();
      idxVizon = +t.dataset.k;
      mare.src = afis[+t.dataset.k];
      if(fundal) fundal.style.backgroundImage = cssUrl(afis[+t.dataset.k]);
      document.getElementById('f-mini').querySelectorAll('.mini').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
    };
    t.addEventListener('click', arata);
    t.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); arata(); } });
  });
  const pv = document.getElementById('f-poveste-text');
  pv.textContent = '„' + (o.descriere || o.poveste || '') + '”';
  document.getElementById('f-poveste').classList.remove('deschis');
  const btnPv = document.getElementById('f-poveste-btn');
  btnPv.textContent = 'Citește toată descrierea ↓';
  const arataBtn = () => { btnPv.hidden = !(pv.scrollHeight > pv.clientHeight + 1); };
requestAnimationFrame(arataBtn);
  document.getElementById('f-fisa').innerHTML =
    `<dt>Material</dt><dd>${esc(o.material || '-')}</dd>` +
    `<dt>Dimensiuni</dt><dd>${esc(o.dimensiuni || '-')}</dd>` +
    `<dt>Autor</dt><dd>${esc(o.autor || '-')}</dd>` +
    `<dt>Locația obiectului</dt><dd>${esc(o.locatie_fizica || '-')}</dd>`;
}
function deschide(){
  if(!obiecte.length) return;
  inchideSate();
  inchideModalSala();
  inchideModalSali();
  umpleFereastra();
  Sunet.hartie();
  if(esteDeschis()) return;
  comutaDosarMare(false);
  fer.hidden = false;
  void fer.offsetWidth;
  document.body.classList.add('deschis');
  salon.classList.add('deschis');
  actualizeazaBtnDosar();
  document.getElementById('f-inchide').focus({preventScroll:true});
  if(innerWidth < 861){
    requestAnimationFrame(() => fer.scrollIntoView({behavior: redus ? 'auto' : 'smooth', block: 'nearest'}));
  }
  scrieURL('push', 'muzeu');
}
function inchide(){
  if(!esteDeschis()) return;
  Sunet.pecete();
  document.body.classList.remove('deschis', 'dosar-mare');
  salon.classList.remove('deschis');
  actualizeazaBtnDosar();
  inchideVizor(true);
  setTimeout(() => { 
    if(!esteDeschis()) { 
      fer.hidden = true; 
      const f = document.getElementById('fereastra-fundal');
      if(f) f.hidden = true;
    }
  }, redus ? 0 : 320);
  scrieURL('push');
}
function esteDosarMare(){ return document.body.classList.contains('dosar-mare'); }
function comutaDosarMare(forta){
  const mare = (typeof forta === 'boolean') ? forta : !esteDosarMare();
  if(mare && !esteDeschis()) return;
  const b = document.getElementById('f-mareste');
  const f = document.getElementById('fereastra-fundal');
  if(mare){
    if(f) f.hidden = false;
    document.body.classList.add('dosar-mare');
  } else {
    document.body.classList.remove('dosar-mare');
    setTimeout(() => { if(!esteDosarMare() && f) f.hidden = true; }, redus ? 0 : 320);
  }
  if(b){
    b.textContent = mare ? '❐' : '⛶';
    b.setAttribute('aria-expanded', mare ? 'true' : 'false');
    const et = mare ? 'Revino la panoul lateral' : 'Mărește dosarul';
    b.setAttribute('aria-label', et); b.title = et;
  }
  if(mare) Sunet.hartie();
}
function esteVizonDeschis(){ return document.body.classList.contains('vizor-deschis'); }
function arataVizon(){
  const n = imaginiVizon.length;
  if(!n) return;
  idxVizon = ((idxVizon % n) + n) % n;
  const img = document.getElementById('vizor-img');
  try{ img.decoding = 'async'; img.fetchPriority = 'high'; }catch(e){}
  img.src = imaginiVizon[idxVizon];
  const o = obiecte[idx];
  pregatesteFallbackPoza(img, o ? o.id : '', '600/500');
  img.alt = (o ? o.titlu + ' — ' : '') + 'Imagine ' + (idxVizon + 1);
  document.getElementById('vizor-caption').textContent =
    (o ? o.titlu + ' · ' : '') + 'Imagine ' + (idxVizon + 1) + ' din ' + n;
  /* vecinii sunt deja următorii pași aproape siguri → prefetch silențios */
  try{
    const urm = new Image(); urm.decoding = 'async'; urm.src = imaginiVizon[(idxVizon + 1) % n];
    const ant = new Image(); ant.decoding = 'async'; ant.src = imaginiVizon[(idxVizon - 1 + n) % n];
  }catch(e){}
}
function deschideVizor(){
  if(!imaginiVizon.length) return;
  arataVizon();
  Sunet.hartie();
  document.getElementById('vizor').hidden = false;
  const f = document.getElementById('vizor-fundal');
  if(f) f.hidden = false;
  document.body.classList.add('vizor-deschis');
  document.getElementById('vizor-inchide').focus({preventScroll:true});
}
function inchideVizor(silent){
  if(!esteVizonDeschis()) return;
  if(!silent) Sunet.pecete();
  document.body.classList.remove('vizor-deschis');
  setTimeout(() => {
    if(!esteVizonDeschis()){
      document.getElementById('vizor').hidden = true;
      const f = document.getElementById('vizor-fundal');
      if(f) f.hidden = true;
    }
  }, redus ? 0 : 320);
  const cadru = document.getElementById('f-mare-cadru');
  if(cadru) cadru.focus({preventScroll:true});
}
function pasVizon(d){
  if(!esteVizonDeschis() || !imaginiVizon.length) return;
  idxVizon = (idxVizon + d + imaginiVizon.length) % imaginiVizon.length;
  Sunet.hartie();
  arataVizon();
}
/* ---- panoul satelor (stânga, oglinda dosarului) ---- */
const panSate = document.getElementById('sate');
function esteSateDeschis(){ return document.body.classList.contains('sate-deschis'); }
function randareSate(){
  const r = raionInfo(raionCurent);
  const titlu = document.getElementById('sate-titlu');
  const lista = document.getElementById('sate-lista');
  if(!r || !titlu || !lista) return;
  titlu.textContent = tipRaion(raionCurent) + ' ' + r.nume;
  const sate = r.sate || [];
  let html = `<button class="sat ${!satCurent ? 'on' : ''}" data-sat="">Toate satele<span class="sat-nr">${countSat(raionCurent, '')}</span></button>`;
  html += sate.map(s =>
    `<button class="sat ${satCurent === s.id ? 'on' : ''}" data-sat="${s.id}">${s.nume}<span class="sat-nr">${countSat(raionCurent, s.id)}</span></button>`
  ).join('');
  lista.innerHTML = html;
}
function deschideSate(){
  inchide();
  inchideModalSala();
  inchideModalSali(); /* excludere reciprocă între ferestre */
  randareSate();
  if(esteSateDeschis()) return;
  if(!panSate) return;
  Sunet.hartie();
  panSate.hidden = false;
  void panSate.offsetWidth;
  document.body.classList.add('sate-deschis');
  salon.classList.add('sate-deschis'); /* caruselul alunecă la dreapta, oglinda dosarului */
  const inc = document.getElementById('sate-inchide');
  if(inc) inc.focus({preventScroll:true});
}
function inchideSate(){
  if(!esteSateDeschis()) return;
  document.body.classList.remove('sate-deschis');
  salon.classList.remove('sate-deschis');
  setTimeout(() => { if(!esteSateDeschis() && panSate) panSate.hidden = true; }, redus ? 0 : 320);
}
function alegeSat(sid){
  if(sid && !numeSat(raionCurent, sid)) sid = null;
  satCurent = sid;
  idx = 0;
  Sunet.hartie();
  obiecte = listaSala(salaCurenta);
  randareSate();
  randareCarusel();
  if(esteDeschis()) umpleFereastra();
  actualizeazaFooter();
  scrieURL('push');
}
function scrieURL(metoda, stare){
  /* stare: 'muzeu' | 'acasa' | 'contribuie' | undefined=autodetect */
  if(stare === 'contribuie'){
    try{
      if(!blocIstoric && metoda === 'push') history.pushState(null, '', PAGINA + '?contribuie');
      else history.replaceState(null, '', PAGINA + '?contribuie');
    }catch(e){}
    return;
  }
  let inMuzeu;
  if(stare === 'muzeu') inMuzeu = true;
  else if(stare === 'acasa') inMuzeu = false;
  else inMuzeu = document.body.classList.contains('poarta-deschisa');
  let u;
  if(esteContribuieDeschis()){
    u = PAGINA + '?contribuie';
  }else if(inMuzeu && esteDeschis() && obiecte[idx]){
    u = PAGINA + '?' + raionCurent + (satCurent ? '/' + satCurent : '') + '&dosar=' + dosarIdDe(obiecte[idx]);
  } else if(inMuzeu){
    u = PAGINA + '?' + raionCurent + (satCurent ? '/' + satCurent : '');
  } else {
    u = PAGINA + '?home';
  }
  try{
    if(!blocIstoric && metoda === 'push') history.pushState(null, '', u);
    else history.replaceState(null, '', u);
  }catch(e){}
}
/* Parser URL: sursa unică e window.__cms.parseQuery (cms.js). */
function parseURLNou(){
  return window.__cms.parseQuery(location.search);
}

function pasul(d){
  if(!obiecte.length) return;
  idx = (idx + d + obiecte.length) % obiecte.length;
  Sunet.hartie();
  randareCarusel(d);
  if(esteDeschis()){ umpleFereastra(); scrieURL(); }
}

/* ---- alegere sală ---- */
function alegeSala(id, scrie){
  if(!MUZEU.sali.some(s => s.id === id)) id = MUZEU.sali[0].id;
  inchide();
  salaCurenta = id;
  obiecte = listaSala(id);
  idx = 0;
  randareStepper();
  randareCartus();
  randareCarusel();
  actualizeazaFooter();
  if(scrie) scrieURL(scrie === 'push' ? 'push' : 'replace');
}

/* ---- poarta-hartă: harta Moldovei; click raion pilot → ușile se deschid ---- */
function toastPoarta(msg){
  const t = document.getElementById('toast-poarta');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('arata');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('arata'), 2600);
}
function alegeRaion(id){
  const info = raionInfo(id);
  if(!info || info.stare !== 'pilot'){
    const g = document.querySelector('#harta-svg .raion[data-id="' + id + '"]');
    toastPoarta(tipRaion(id) + ' ' + ((g && g.getAttribute('data-nume')) || id) + ' intră în curând în muzeu.');
    return;
  }
  /* Datele raionului sunt locale (raioane.js) — intrarea e instantanee. */
  raionCurent = id;
  satCurent = null;
  idx = 0;
  alegeSala(MUZEU.sali[0].id, false);
  randareSate();
  actualizeazaFooter('muzeu');
  scrieURL('push', 'muzeu');
  intra();
}
function intoarceLaHarta(){
  inchide();
  inchideSate();
  document.title = TITLU_HOME; /* ?home: revenim la titlul hărții, indiferent de animația porții */
  /* URL explicit ?home: clasele se șterg asincron, deci scrieURL() ar calcula greșit ?raion */
  try{
    if(!blocIstoric) history.pushState(null, '', PAGINA + '?home');
    else history.replaceState(null, '', PAGINA + '?home');
  }catch(e){}
  if(redus){
    document.body.classList.remove('poarta-deschisa', 'intrare-gata', 'usile-deschise', 'poarta-pleaca');
    document.getElementById('poarta').hidden = false;
    return;
  }
  /* 1) arătăm poarta; ascundem harta (ca să se vadă ușile) și plecăm de la uși DESCHISE */
  document.body.classList.remove('poarta-deschisa', 'intrare-gata');
  document.body.classList.add('poarta-pleaca');   /* harta invizibilă */
  document.body.classList.add('usile-deschise');  /* uși deschise → se vede muzeul în spate */
  const p = document.getElementById('poarta');
  p.hidden = false;
  void p.offsetWidth;                             /* reflow: animația pornește de la uși deschise */
  Sunet.usa();
  /* 2) închidem ușile peste muzeu (efectul de „plecare") */
  document.body.classList.remove('usile-deschise');
  /* 3) după ce s-au închis, dezvăluim harta + detaliile din home */
  setTimeout(() => {
    document.body.classList.remove('poarta-pleaca');
    const mh = document.getElementById('harta-svg');
    if(mh) mh.focus({preventScroll:true});
  }, 1300);
}
/* harta SVG din poartă: hover premium (mărire + plăcuță) + click raion */
function leagaHartaPoarta(){
  const svg = document.getElementById('harta-svg');
  if(!svg) return;
  const placuta = document.getElementById('harta-placuta');
  const parinte = svg.parentElement;
  function pozitioneaza(g){
    if(!placuta || !parinte) return;
    try{
      const t = g.querySelector('text');
      const r = (t || g).getBoundingClientRect();
      const pr = parinte.getBoundingClientRect();
      placuta.style.left = (r.left - pr.left + r.width / 2) + 'px';
      placuta.style.top = (r.top - pr.top) + 'px';
    }catch(e){}
  }
  function scoate(g){
    if(!placuta) return;
    placuta.textContent = g.getAttribute('data-nume') || '';
    placuta.classList.add('arata');
    pozitioneaza(g);
  }
  function ascunde(){
    if(!placuta) return;
    placuta.classList.remove('arata');
  }
  svg.querySelectorAll('.raion').forEach(g => {
    g.addEventListener('click', () => alegeRaion(g.getAttribute('data-id')));
    g.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); alegeRaion(g.getAttribute('data-id')); } });
    g.addEventListener('pointerenter', e => {
      /* pe touch nu arătăm plăcuța: tap-ul navighează direct */
      if(e.pointerType && e.pointerType !== 'mouse') return;
      scoate(g);
    });
    g.addEventListener('pointerleave', ascunde);
    g.addEventListener('focus', () => scoate(g));
    g.addEventListener('blur', ascunde);
  });
}
/* ---- contribuire: overlay peste hartă; trimitere via FormSubmit (gratuit, nelimitat) —
 * fișierele ajung ca ATAȘAMENTE în emailul arhivarului. Imaginile se comprimă în browser
 * (Canvas, max 1600px) ca totalul să stea sub limita de 10MB/trimitere a serviciului. ---- */
const CONTRIBUTIE_MAX_POZE = 5;
const CONTRIBUTIE_MAX_ORIGINAL = 25 * 1024 * 1024; /* peste 25MB refuzăm înainte de decodare */
const stareContribuie = { fisiere: [], indexPrincipal: 0, trimitere: false };
function esteContribuieDeschis(){ return document.body.classList.contains('form-contribuie-deschis'); }
/* revenirea din redirectul FormSubmit (?contribuie=multumim) → ecranul de mulțumire */
function esteIntoarcereContributie(){ return /multumim/i.test(location.search); }
function deschideContribuie(push){
  const form = document.getElementById('form-contribuie');
  const fundal = document.getElementById('form-contribuie-fundal');
  if(!form) return;
  if(esteContribuieDeschis()) return;
  inchide();
  inchideSate();
  inchideModalSala();
  inchideModalSali();
  Sunet.hartie();
  const eMultumire = esteIntoarcereContributie();
  const zonaForm = document.getElementById('contribuie-zona-form');
  const multumim = document.getElementById('contribuie-multumim');
  if(zonaForm) zonaForm.hidden = eMultumire;
  if(multumim) multumim.hidden = !eMultumire;
  setStareContribuie('', false);
  form.hidden = false;
  if(fundal) fundal.hidden = false;
  void form.offsetWidth;
  document.body.classList.add('form-contribuie-deschis');
  if(push !== false) scrieURL('push', 'contribuie');
  const t = document.getElementById(eMultumire ? 'contribuie-multumim-harta' : 'contribuie-titlu');
  if(t) setTimeout(() => { try{ t.focus({preventScroll:true}); }catch(e){} }, 60);
}
function inchideContribuie(push){
  if(!esteContribuieDeschis()) return;
  Sunet.pecete();
  document.body.classList.remove('form-contribuie-deschis');
  const form = document.getElementById('form-contribuie');
  const fundal = document.getElementById('form-contribuie-fundal');
  setTimeout(() => {
    if(!esteContribuieDeschis()){ if(form) form.hidden = true; if(fundal) fundal.hidden = true; }
  }, redus ? 0 : 300);
  if(push !== false) scrieURL('push');
}
function leagaContribuie(){
  const b = document.getElementById('btn-contribuie');
  if(!b || b._legatContribuie) return;
  b._legatContribuie = true;
  b.addEventListener('click', () => deschideContribuie(true));
}

function setStareContribuie(msg, eroare){
  const el = document.getElementById('contribuie-stare');
  if(!el) return;
  if(!msg){ el.hidden = true; el.textContent = ''; el.classList.remove('eroare'); return; }
  el.hidden = false;
  el.textContent = msg;
  el.classList.toggle('eroare', !!eroare);
}

/* ---- preview: o singură grilă cu toate imaginile; ★ = principală (default: prima) ---- */
function dimensiuniUmane(b){ return (b / 1048576).toFixed(1) + ' MB'; }
function totalImaginiContribuie(){
  let t = 0;
  stareContribuie.fisiere.forEach(f => { t += f.size; });
  return t;
}
function randeazaPreviewContribuie(){
  const previewEl = document.getElementById('contribuie-preview');
  const counterEl = document.getElementById('contribuie-counter');
  if(!previewEl || !counterEl) return;
  previewEl.querySelectorAll('img[data-obj]').forEach(img => {
    try{ URL.revokeObjectURL(img.getAttribute('src')); }catch(e){}
  });
  previewEl.innerHTML = '';
  if(stareContribuie.indexPrincipal >= stareContribuie.fisiere.length) stareContribuie.indexPrincipal = 0;
  stareContribuie.fisiere.forEach((file, i) => {
    const principal = (i === stareContribuie.indexPrincipal && stareContribuie.fisiere.length > 0);
    const item = document.createElement('div');
    item.className = 'contribuie-preview-item' + (principal ? ' principala' : '');
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.setAttribute('data-obj', '1');
    img.alt = 'Imaginea ' + (i + 1) + (principal ? ' (principală)' : '');
    const stea = document.createElement('button');
    stea.type = 'button';
    stea.className = 'contribuie-steluta material-symbols-outlined';
    stea.textContent = 'stars';
    stea.title = principal ? 'Imaginea principală (se vede în carusel)' : 'Marchează ca imagine principală';
    stea.setAttribute('aria-label', stea.title);
    stea.setAttribute('aria-pressed', principal ? 'true' : 'false');
    stea.addEventListener('click', () => {
      stareContribuie.indexPrincipal = i;
      Sunet.hartie();
      randeazaPreviewContribuie();
    });
    const scoate = document.createElement('button');
    scoate.type = 'button';
    scoate.className = 'contribuie-scoate material-symbols-outlined';
    scoate.textContent = 'close';
    scoate.title = 'Scoate imaginea';
    scoate.setAttribute('aria-label', 'Scoate imaginea ' + (i + 1));
    scoate.addEventListener('click', () => {
      stareContribuie.fisiere.splice(i, 1);
      if(stareContribuie.indexPrincipal >= stareContribuie.fisiere.length) stareContribuie.indexPrincipal = 0;
      Sunet.hartie();
      randeazaPreviewContribuie();
    });
    item.appendChild(img);
    item.appendChild(stea);
    if(principal){
      const badge = document.createElement('span');
      badge.className = 'contribuie-badge-principala';
      const bIco = document.createElement('span');
      bIco.className = 'material-symbols-outlined';
      bIco.textContent = 'stars';
      badge.appendChild(bIco);
      badge.appendChild(document.createTextNode(' PRINCIPALĂ'));
      item.appendChild(badge);
    }
    item.appendChild(scoate);
    previewEl.appendChild(item);
  });
  const total = totalImaginiContribuie();
  counterEl.textContent = stareContribuie.fisiere.length + '/' + CONTRIBUTIE_MAX_POZE + ' imagini alese' +
    (total ? ' · ~' + dimensiuniUmane(total) : '');
}
/* Dimensiuni: 2 variante (2D = Lungime x Lățime, 3D = + Înălțime), câmpuri orizontale */
function tipDimensiuni(){
  const sel = document.querySelector('input[name="Tip dimensiuni"]:checked');
  return sel ? sel.value : '2d';
}
function comutaDimensiuni(){
  const e3d = tipDimensiuni() === '3d';
  document.querySelectorAll('.dim-camp-h').forEach(el => { el.hidden = !e3d; });
  document.querySelectorAll('.dim-x-h').forEach(el => { el.hidden = !e3d; });
  if(!e3d){
    const h = document.getElementById('contribuie-inaltime');
    if(h) h.value = '';
  }
}
/* ---- comprimare imagini (Canvas): max 1600px, JPEG ~0.82, fundal alb ---- */
function comprimaImagine(file, numeNou){
  return new Promise(function(res){
    if(!file || !/^image\//.test(file.type || '')){ res(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function(){
      URL.revokeObjectURL(url);
      try{
        const maxL = 1600;
        const k = Math.min(1, maxL / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * k));
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob(function(b){
          if(b) res(new File([b], numeNou, { type: 'image/jpeg', lastModified: Date.now() }));
          else res(file);
        }, 'image/jpeg', 0.82);
      }catch(e){ res(file); }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}
async function onFisiereAlese(list){
  const primite = Array.from(list || []);
  if(!primite.length) return;
  const okTip = primite.filter(f => /^image\//.test(f.type || '') || /\.(jpe?g|png|webp|gif)$/i.test(f.name || ''));
  if(okTip.length !== primite.length) toastPoarta('Doar imagini JPG / PNG / WebP / GIF.');
  const spatiu = CONTRIBUTIE_MAX_POZE - stareContribuie.fisiere.length;
  if(spatiu <= 0){ toastPoarta('Poți încărca maximum ' + CONTRIBUTIE_MAX_POZE + ' imagini.'); return; }
  const deAdaugat = okTip.slice(0, spatiu);
  if(okTip.length > spatiu) toastPoarta('Primele ' + spatiu + ' imagini au fost adăugate (max ' + CONTRIBUTIE_MAX_POZE + ').');
  for(const f of deAdaugat){
    if(f.size > CONTRIBUTIE_MAX_ORIGINAL){ toastPoarta('„' + (f.name || 'imagine') + '” depășește 25MB.'); continue; }
    stareContribuie.fisiere.push(await comprimaImagine(f, 'contributie.jpg'));
  }
  if(stareContribuie.indexPrincipal >= stareContribuie.fisiere.length) stareContribuie.indexPrincipal = 0;
  Sunet.hartie();
  randeazaPreviewContribuie();
}
/* ---- raion/municipiu → sat (cascada; satul e inactiv până la alegerea raionului) ---- */
function populeazaLocatieContribuie(){
  const rSel = document.getElementById('contribuie-raion');
  const sSel = document.getElementById('contribuie-sat');
  if(!rSel || !sSel || rSel.options.length > 1) return;
  const lista = (typeof RAIOANE !== 'undefined' && RAIOANE && RAIOANE.raioane) ? RAIOANE.raioane : [];
  lista.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.nume;
    rSel.appendChild(o);
  });
  rSel.addEventListener('change', () => {
    sSel.innerHTML = '';
    const gol = document.createElement('option');
    gol.value = '';
    gol.textContent = '— alege satul —';
    sSel.appendChild(gol);
    const r = lista.find(x => x.id === rSel.value);
    (r && r.sate ? r.sate : []).forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.nume;
      sSel.appendChild(o);
    });
    sSel.disabled = !r;
    Sunet.hartie();
  });
}

/* Legături formular: X, fundal, pickere imagini, buton harta, submit (defensiv, o singură dată) */
function leagaFormContribuie(){
  if(window._contribuieLegat) return;
  window._contribuieLegat = true;
  const x = document.getElementById('form-contribuie-inchide');
  if(x) x.addEventListener('click', () => inchideContribuie(true));
  const fundal = document.getElementById('form-contribuie-fundal');
  if(fundal) fundal.addEventListener('click', () => inchideContribuie(true));
  const harta = document.getElementById('contribuie-multumim-harta');
  if(harta) harta.addEventListener('click', () => { Sunet.pas(); inchideContribuie(true); });
  const inp = document.getElementById('contribuie-imagini');
  if(inp) inp.addEventListener('change', () => { onFisiereAlese(inp.files); inp.value = ''; });
  const eticheta = document.querySelector('label.btn-alege-imagini[for="contribuie-imagini"]');
  if(eticheta) eticheta.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if(inp) inp.click(); }
  });
  const form = document.getElementById('contribuie-form');
  if(form) form.addEventListener('submit', trimiteContribuie);
  document.querySelectorAll('input[name="Tip dimensiuni"]').forEach(r => {
    r.addEventListener('change', () => { Sunet.hartie(); comutaDimensiuni(); });
  });
  populeazaLocatieContribuie();
  comutaDimensiuni();
  randeazaPreviewContribuie();
}
async function trimiteContribuie(e){
  e.preventDefault();
  if(stareContribuie.trimitere) return;
  const titluEl = document.getElementById('contribuie-titlu');
  const descEl = document.getElementById('contribuie-descriere');
  const matEl = document.getElementById('contribuie-material');
  const anEl = document.getElementById('contribuie-an');
  const perEl = document.getElementById('contribuie-perioada');
  const lungEl = document.getElementById('contribuie-lungime');
  const latEl = document.getElementById('contribuie-latime');
  const inalEl = document.getElementById('contribuie-inaltime');
  const unitEl = document.getElementById('contribuie-unitate');
  const autorEl = document.getElementById('contribuie-autor');
  const emailEl = document.getElementById('contribuie-email');
  const locEl = document.getElementById('contribuie-locatie');
  const raionEl = document.getElementById('contribuie-raion');
  const satEl = document.getElementById('contribuie-sat');
  const btn = document.getElementById('contribuie-trimite');
  const titlu = titluEl ? titluEl.value.trim() : '';
  const descriere = descEl ? descEl.value.trim() : '';
  const material = matEl ? matEl.value.trim() : '';
  const an = anEl ? anEl.value.trim().slice(0, 20) : '';
  const perioada = perEl ? perEl.value.trim().slice(0, 60) : '';
  const lungime = lungEl ? lungEl.value.trim() : '';
  const latime = latEl ? latEl.value.trim() : '';
  const inaltime = inalEl ? inalEl.value.trim() : '';
  const unitate = unitEl ? unitEl.value : 'cm';
  const autor = autorEl ? autorEl.value.trim().slice(0, 120) : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const locatie = locEl ? locEl.value.trim().slice(0, 120) : '';
  const raionId = raionEl ? raionEl.value : '';
  const satId = satEl ? satEl.value : '';
  const e3d = tipDimensiuni() === '3d';
  function eroare(msg){
    setStareContribuie(msg, true);
    toastPoarta(msg);
  }
  if(!titlu || !descriere){
    eroare('Completează denumirea și descrierea obiectului.');
    return;
  }
  if(!material){ eroare('Completează materialul obiectului (ex: hârtie / ceramică).'); return; }
  if(!an){ eroare('Completează anul obiectului (ex: 1932 / cca 1900 / sec. XIX).'); return; }
  if(!perioada){ eroare('Completează perioada obiectului (ex: Interbelic).'); return; }
  if(!lungime || !latime || (e3d && !inaltime)){
    eroare(e3d ? 'Completează lungimea, lățimea și înălțimea.' : 'Completează lungimea și lățimea.');
    return;
  }
  if(!autor){ eroare('Completează autorul — introduceți numele dumneavoastră.'); return; }
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
    eroare('Emailul nu pare complet — verifică-l sau lasă-l gol.');
    return;
  }
  if(!locatie){ eroare('Completează locația obiectului (ex: muzeul școlar / colecție personală).'); return; }
  if(!raionId){ eroare('Alege raionul / municipiul obiectului.'); return; }
  if(!satId){ eroare('Alege satul (după raion).'); return; }
  if(stareContribuie.fisiere.length !== CONTRIBUTIE_MAX_POZE){
    eroare('Încarcă exact ' + CONTRIBUTIE_MAX_POZE + ' imagini (toate obligatorii).');
    return;
  }
  if(totalImaginiContribuie() > 9 * 1024 * 1024){
    eroare('Imaginile depășesc 9MB în total — scoate una și reîncearcă.');
    return;
  }
  const dimensiuni = e3d
    ? lungime + ' × ' + latime + ' × ' + inaltime + ' ' + unitate
    : lungime + ' × ' + latime + ' ' + unitate;
  const raionNume = (raionEl && raionEl.selectedOptions && raionEl.selectedOptions[0]) ? raionEl.selectedOptions[0].textContent : raionId;
  const satNume = (satEl && satEl.selectedOptions && satEl.selectedOptions[0]) ? satEl.selectedOptions[0].textContent : satId;
  const subjEl = document.getElementById('contribuie-subject');
  if(subjEl) subjEl.value = '[MUZEU CONTRIBUȚIE] ' + titlu + ' — ' + raionNume + ' / ' + satNume;
  const dimEl = document.getElementById('contribuie-dimensiuni-camp');
  if(dimEl) dimEl.value = dimensiuni;
  const nextEl = document.getElementById('contribuie-next');
  if(nextEl) nextEl.value = location.origin + location.pathname + '?contribuie=multumim';
  const infoEl = document.getElementById('contribuie-principala-info');
  if(infoEl) infoEl.value = 'contributie-principala.jpg (vezi atașamentul nr. 1)';
  if(!('DataTransfer' in window)){
    eroare('Browserul este prea vechi pentru încărcarea imaginilor — încearcă un browser recent.');
    return;
  }
  /* exact câte un fișier în fiecare input denumit — schema documentată FormSubmit;
     slotul 0 primește ÎNTOTDEAUNA imaginea marcată cu ⭐; restul, în ordinea alegerii */
  const poPrincipala = stareContribuie.indexPrincipal;
  const restul = stareContribuie.fisiere.map((f, i) => i).filter(i => i !== poPrincipala);
  for(let i = 0; i <= 4; i++){
    const inp = document.getElementById('contribuie-fisier-' + i);
    if(!inp) continue;
    const dt = new DataTransfer();
    const f = (i === 0) ? stareContribuie.fisiere[poPrincipala] : stareContribuie.fisiere[restul[i - 1]];
    if(f){
      const numeFinal = (i === 0) ? 'contributie-principala.jpg' : 'contributie-suplimentara-' + i + '.jpg';
      dt.items.add(new File([f], numeFinal, { type: f.type, lastModified: f.lastModified || Date.now() }));
    }
    try{ inp.files = dt.files; }catch(err){}
  }
  stareContribuie.trimitere = true;
  if(btn){ btn.disabled = true; btn.textContent = 'SE TRIMITE…'; }
  setStareContribuie('Se trimite contribuția…', false);
  const form = document.getElementById('contribuie-form');
  form.submit(); /* POST nativ → FormSubmit atașează fișierele → redirect _next (?contribuie=multumim) */
  /* dacă navigarea nu are loc (ex. eroare de rețea), reactivăm butonul */
  setTimeout(() => {
    stareContribuie.trimitere = false;
    if(btn){ btn.disabled = false; btn.textContent = 'TRIMITE CONTRIBUȚIA'; }
  }, 4000);
}
function leagaPoarta(sariDirect, fortzaHarta){
  const poarta = document.getElementById('poarta');
  if(!poarta) return;
  leagaHartaPoarta();
  leagaContribuie();
  leagaFormContribuie();
  leagaModalSala();
  leagaModalSali();
  if(!fortzaHarta && (sariDirect || sessionStorage.getItem('muzeu-intrat') === '1')){
    document.body.classList.add('poarta-deschisa', 'intrare-gata');
    poarta.hidden = true;
    return;
  }
  /* arătăm harta (pagina de start): curățăm orice stare de „muzeu deschis" */
  document.body.classList.remove('poarta-deschisa', 'intrare-gata', 'usile-deschise', 'poarta-pleaca');
  poarta.hidden = false;
  setTimeout(() => {
    if(!poarta.hidden){
      const mh = document.getElementById('harta-svg');
      if(mh) mh.focus({preventScroll:true});
    }
  }, 400);
}
function intra(){
  const poarta = document.getElementById('poarta');
  if(!poarta) return;
  if(document.body.classList.contains('poarta-deschisa') || document.body.classList.contains('poarta-pleaca')) return;
  if(redus){
    document.body.classList.add('poarta-deschisa', 'intrare-gata');
    try{ sessionStorage.setItem('muzeu-intrat', '1'); }catch(e){}
    poarta.hidden = true;
    return;
  }
  document.body.classList.add('poarta-pleaca');
  Sunet.usa();
  setTimeout(() => { document.body.classList.add('usile-deschise'); }, 450);
  setTimeout(() => Sunet.clopot(), 1400);
  setTimeout(() => {
    document.body.classList.add('poarta-deschisa', 'intrare-gata');
    /* pleaca rămâne până se stinge overlay-ul — altfel harta reapare o fracțiune */
    try{ sessionStorage.setItem('muzeu-intrat', '1'); }catch(e){}
    setTimeout(() => {
      poarta.hidden = true;
      document.body.classList.remove('usile-deschise', 'poarta-pleaca');
    }, 700);
  }, 1650);
}

/* ---- buton sunet ---- */
function leagaSunet(){
  const b = document.getElementById('btn-sunet');
  const stare = document.getElementById('sunet-stare');
  if(!b) return;
  function desen(){
    b.setAttribute('aria-pressed', Sunet.activ ? 'true' : 'false');
    if(stare) stare.textContent = Sunet.activ ? 'SUNET: DA' : 'SUNET: NU';
  }
  desen();
  b.addEventListener('click', () => { Sunet.comuta(); desen(); if(Sunet.activ) Sunet.hartie(); });
}

/* ---- evenimente ---- */
document.getElementById('car-next').addEventListener('click', () => pasul(1));
document.getElementById('car-prev').addEventListener('click', () => pasul(-1));
document.getElementById('mob-next').addEventListener('click', () => pasul(1));
document.getElementById('mob-prev').addEventListener('click', () => pasul(-1));
document.getElementById('btn-descopera').addEventListener('click', () => { if(esteDeschis()) inchide(); else deschide(); });
document.getElementById('f-inchide').addEventListener('click', inchide);
document.getElementById('f-mareste').addEventListener('click', () => comutaDosarMare());
document.getElementById('fereastra-fundal').addEventListener('click', e => { e.stopPropagation(); comutaDosarMare(false); });
const cadruMare = document.getElementById('f-mare-cadru');
if(cadruMare){
  cadruMare.addEventListener('click', deschideVizor);
  cadruMare.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); deschideVizor(); } });
}
document.getElementById('vizor-inchide').addEventListener('click', () => inchideVizor());
document.getElementById('vizor-fundal').addEventListener('click', e => { e.stopPropagation(); inchideVizor(); });
document.getElementById('vizor-prev').addEventListener('click', () => pasVizon(-1));
document.getElementById('vizor-next').addEventListener('click', () => pasVizon(1));
document.getElementById('btn-sate').addEventListener('click', () => { if(esteSateDeschis()) inchideSate(); else deschideSate(); });
document.getElementById('sate-inchide').addEventListener('click', inchideSate);
document.getElementById('f-prev').addEventListener('click', () => pasul(-1));
document.getElementById('f-next').addEventListener('click', () => pasul(1));
document.getElementById('f-poveste-btn').addEventListener('click', () => {
  const pv = document.getElementById('f-poveste');
  const deschis = pv.classList.toggle('deschis');
  document.getElementById('f-poveste-btn').textContent = deschis ? 'Arată mai puțin ↑' : 'Citește toată descrierea ↓';
  Sunet.hartie();
});
addEventListener('keydown', e => {
  if(esteVizonDeschis() && e.key === 'ArrowRight'){ pasVizon(1); return; }
  if(esteVizonDeschis() && e.key === 'ArrowLeft'){ pasVizon(-1); return; }
  const poartaDeschisa = document.body.classList.contains('poarta-deschisa');
  if(e.key === 'Escape'){
    if(esteContribuieDeschis()) inchideContribuie(true);
    else if(esteModalSalaDeschis()) inchideModalSala();
    else if(esteModalSaliDeschis()) inchideModalSali();
    else if(esteVizonDeschis()) inchideVizor();
    else if(esteDeschis() && esteDosarMare()) comutaDosarMare(false);
    else if(esteDeschis()) inchide();
    else if(esteSateDeschis()) inchideSate();
  }
  else if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
    /* săgețile schimbă fila doar în muzeul curat: fără panouri/formulare deschise
     * și fără focus într-un câmp (acolo săgețile navighează textul) */
    const focusInFormular = e.target && e.target.closest && !!e.target.closest('input, textarea, select');
    const panouDeschis = esteDeschis() || esteSateDeschis() || esteModalSalaDeschis() ||
      esteModalSaliDeschis() || esteContribuieDeschis();
    if(poartaDeschisa && !panouDeschis && !focusInFormular) pasul(e.key === 'ArrowRight' ? 1 : -1);
  }
});
let sx = null, ultimulSwipe = 0;
pista.addEventListener('pointerdown', e => { sx = e.clientX; });
pista.addEventListener('pointerup', e => {
  if(sx === null) return;
  const dx = e.clientX - sx; sx = null;
  if(Math.abs(dx) > 10) ultimulSwipe = Date.now();
  if(Math.abs(dx) > 45) pasul(dx < 0 ? 1 : -1);
});

/* ---- delegare single-listener (evită rebind la fiecare randare) ---- */
stepperEl.addEventListener('click', e => {
  const b = e.target.closest('button[data-sala]');
  if(b){ Sunet.pas(); alegeSala(b.dataset.sala, 'push'); return; }
  if(e.target.closest('#btn-harta')){ Sunet.pas(); intoarceLaHarta(); }
});
const listaSateEl = document.getElementById('sate-lista');
if(listaSateEl) listaSateEl.addEventListener('click', e => {
  const b = e.target.closest('.sat');
  if(b) alegeSat(b.dataset.sat || null);
});
const listaSaliEl = document.getElementById('modal-sali-lista');
if(listaSaliEl) listaSaliEl.addEventListener('click', e => {
  const b = e.target.closest('.modal-sali-btn');
  if(b){ Sunet.pas(); inchideModalSali(); alegeSala(b.dataset.sala, 'push'); }
});
let rafCard = null;
pista.addEventListener('click', e => {
  const c = e.target.closest('.cadru-card');
  if(!c) return;
  if(Date.now() - ultimulSwipe < 500) return;
  const i = +c.dataset.i;
  if(!Number.isInteger(i)) return;  /* vitrina goală nu e dosar: cardul e inert */
  if(i === idx){ deschide(); return; }
  const d = (i === (idx + 1) % obiecte.length) ? 1 : -1;
  idx = i; Sunet.hartie(); randareCarusel(d);
  if(esteDeschis()) umpleFereastra();
});
pista.addEventListener('keydown', e => {
  const c = e.target.closest('.cadru-card');
  if(c && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); c.click(); }
});

let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(randareCarusel, 150); });

/* ---- click pe loc gol închide panoul activ (dosar, sate sau modal sală; NU formularul contribuie) ---- */
document.addEventListener('click', e => {
  const t = e.target;
  /* formularul contribuie se închide doar cu X / fundal / Escape — nu la click gol (are câmpuri) */
  if(t.closest && (t.closest('#form-contribuie') || t.closest('#btn-contribuie'))) return;
  if(!esteDeschis() && !esteSateDeschis() && !esteModalSalaDeschis() && !esteModalSaliDeschis()) return;
  /* conținutul panourilor */
  if(t.closest && (t.closest('#fereastra') || t.closest('#sate') || t.closest('#modal-sala') || t.closest('#modal-sali') || t.closest('#vizor'))) return;
  /* comutatoarele și acțiunile funcționale — nu sunt „loc gol” */
  if(t.closest && (t.closest('#btn-descopera') || t.closest('#btn-sate') || t.closest('#btn-sunet') ||
    t.closest('#btn-harta') || t.closest('#cap-harta') || t.closest('#cap-sali') || t.closest('.cadru-card') || t.closest('.stepper') || t.closest('#cartus-sala'))) return;
  if(esteModalSalaDeschis()) inchideModalSala();
  else if(esteModalSaliDeschis()) inchideModalSali();
  else if(esteDeschis()) inchide();
  else if(esteSateDeschis()) inchideSate();
});

/* ---- pornire (?home = harta; ?raion[/sat] = muzeul raionului; ?DOS-00001 = modalul dosarului) ----
 * La încărcare proaspătă se onorează dosarul și ?raion[/sat]; altfel pornește la ?home. */
function pornesteAcasa(){
  raionCurent = 'chisinau';
  satCurent = null;
  alegeSala(MUZEU.sali[0].id, false);
  randareSate();
  actualizeazaFooter('acasa');
  try{ history.replaceState(null, '', PAGINA + '?home'); }catch(e){}
  leagaPoarta(false, true); /* pe ?home harta e mereu afișată, indiferent de sessionStorage */
}
/* ---- pornire directă pe un raion (refresh pe ?raion[/sat]) ---- */
function pornesteRaion(rid, sid){
  const info = raionInfo(rid);
  if(!info || info.stare !== 'pilot'){ pornesteAcasa(); return; }
  leagaPoarta(true); /* leagă handler-ele hărții + ascunde poarta */
  raionCurent = rid;
  satCurent = (sid && numeSat(rid, sid)) ? sid : null;
  idx = 0;
  alegeSala(MUZEU.sali[0].id, false);
  randareSate();
  actualizeazaFooter('muzeu');
  scrieURL('replace', 'muzeu');
}
function deschideDosarInitial(dosId){
  const o = gasesteDosar(dosId);
  if(!o){
    pornesteAcasa();
    setTimeout(() => toastPoarta('Dosarul ' + dosId + ' nu există sau nu e publicat.'), 600);
    return;
  }
  const info = raionInfo(o.raion || 'chisinau');
  if(!info || info.stare !== 'pilot' || !SALA_MAP.get(o.sala)){
    pornesteAcasa();
    setTimeout(() => toastPoarta('Dosarul ' + dosId + ' are date incomplete (sală sau raion invalid).'), 600);
    return;
  }
  raionCurent = o.raion || 'chisinau';
  satCurent = o.sat || null;
  alegeSala(o.sala, false);
  idx = obiecte.indexOf(o);
  if(idx < 0){
    pornesteAcasa();
    setTimeout(() => toastPoarta('Dosarul ' + dosId + ' nu poate fi afișat în sala lui.'), 600);
    return;
  }
  randareCarusel();
  randareSate();
  actualizeazaFooter('muzeu');
  try{ history.replaceState(null, '', PAGINA + '?' + dosId); }catch(e){}
  leagaPoarta(true);
  setTimeout(() => { blocIstoric = true; deschide(); blocIstoric = false; }, 350);
}
/* ---- butonul Back/Forward al browserului ---- */
function aplicaIstoric(){
  const st = parseURLNou();
  const eContribuie = (st.view === 'contribuie') || !!st.contribuie;
  inchideModalSala();
  inchideModalSali();
  if(eContribuie){
    blocIstoric = true;
    try{
      if(esteDeschis()) inchide();
      if(esteSateDeschis()) inchideSate();
      deschideContribuie(false);
    }finally{ blocIstoric = false; }
    return;
  }
  if(esteContribuieDeschis()) inchideContribuie(false);
  if(st.view === 'home'){
    blocIstoric = true;
    if(esteDeschis()) inchide();
    if(esteSateDeschis()) inchideSate();
    intoarceLaHarta();
    blocIstoric = false;
    return;
  }
  const infoSt = st.raion ? raionInfo(st.raion) : null;
  if(st.raion && (!infoSt || infoSt.stare !== 'pilot')){
    /* URL din istoric cu un raion nedeschis: revenim la hartă, sincron cu URL-ul */
    blocIstoric = true;
    try{
      if(esteDeschis()) inchide();
      if(esteSateDeschis()) inchideSate();
      pornesteAcasa();
    } finally { blocIstoric = false; }
    return;
  }
  const rid = st.raion || raionCurent;
  blocIstoric = true;
  try{
    const eraInMuzeu = document.body.classList.contains('poarta-deschisa');
    raionCurent = rid;
    satCurent = (st.sat && numeSat(rid, st.sat)) ? st.sat : null;
    idx = 0;
    obiecte = listaSala(salaCurenta);
    randareStepper();
    randareCartus();
    randareCarusel();
    randareSate();
    actualizeazaFooter('muzeu');
    if(!eraInMuzeu) intra();
    if(st.dosar){
      const o = gasesteDosar(st.dosar);
      if(o){
        idx = obiecte.indexOf(o);
        if(idx < 0) idx = 0;
        randareCarusel();
        if(!esteDeschis()) deschide();
        else { umpleFereastra(); scrieURL(); }
      } else if(esteDeschis()) inchide();
    } else if(esteDeschis()) inchide();
  } finally { blocIstoric = false; }
}
addEventListener('popstate', aplicaIstoric);

/* ---- semnal pentru loader-ul de arhivă (cms.js): primul cadru e randat ----
 * Așteptăm imaginea centrală (LCP) ca overlay-ul să se stingă pe conținut vizibil,
 * nu pe pagină goală. Siguranță 4s ca o imagine atârnată să nu blocheze UI-ul. */
function semnalGata(){
  function semnal(){ try{ window.dispatchEvent(new Event('muzeu-gata')); }catch(e){} }
  try{
    if(window.LoaderArhiva) window.LoaderArhiva.set(92, 'Se lustruiește sticla vitrinei…');
    const img = pista.querySelector('.cadru-card.centru img');
    if(img && !img.complete){
      img.addEventListener('load', semnal, {once:true});
      img.addEventListener('error', semnal, {once:true});
      setTimeout(semnal, 4000);
    } else {
      requestAnimationFrame(function(){ setTimeout(semnal, 250); });
    }
  }catch(e){ semnal(); }
}

(function start(){
  leagaSunet();
  actualizeazaBtnDosar();
  leagaFormContribuie();
  construieIndexuri(); /* MUZEU.obiecte e final (cms.js l-a populat înainte de loadScript muzeu.js) */
  const boot = (window.__boot || {view:'home'});
  if(boot.view === 'dosar' && boot.dosar){
    deschideDosarInitial(String(boot.dosar).toUpperCase());
    semnalGata();
    return;
  }
  /* la refresh / încărcare proaspătă onorăm ?contribuie, ?raion[/sat] și dosarul */
  const st = parseURLNou();
  const eContribuie = (boot && boot.view === 'contribuie') || (st.view === 'contribuie') || !!st.contribuie;
  if(eContribuie){
    raionCurent = 'chisinau';
    satCurent = null;
    alegeSala(MUZEU.sali[0].id, false);
    randareSate();
    actualizeazaFooter('acasa');
    leagaPoarta(false, true); /* harta în spate, ca la ?home, dar URL-ul rămâne ?contribuie */
    blocIstoric = true;
    deschideContribuie(false);
    blocIstoric = false;
    try{ history.replaceState(null, '', PAGINA + '?contribuie'); }catch(e){}
    semnalGata();
    return;
  }
  if(st.view === 'muzeu' && st.raion){
    const info = raionInfo(st.raion);
    if(info && info.stare === 'pilot'){
      pornesteRaion(st.raion, st.sat);
      semnalGata();
      return;
    }
  }
  pornesteAcasa();
  semnalGata();
})();
})();
