/* Ortak yardımcılar (window.U) */
(function () {
  'use strict';
  var U = {};
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  U.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  // Türkçe sayı biçimi: 4.512.345,678
  U.num = function (v, dec) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  // Dosya/CSV için noktalı ondalık, binlik ayraçsız
  U.plain = function (v, dec) { return isFinite(v) ? v.toFixed(dec) : ''; };
  U.toast = function (msg) {
    var t = U.$('#toast'); if (!t) return;
    t.textContent = msg; t.hidden = false; clearTimeout(U._tt); U._tt = setTimeout(function () { t.hidden = true; }, 1900);
  };
  U.copy = function (text, selectEl) {
    function fallback() {
      if (selectEl && selectEl.select) { selectEl.focus(); selectEl.select(); U.toast('Metin seçildi; Ctrl+C ile kopyalayın'); }
      else U.toast('Kopyalanamadı; metni elle seçin');
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { U.toast('Kopyalandı'); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  };
  // Rapor CSV'si (Excel'de açılmak için): UTF-8 BOM, noktalı virgül ayraç, ondalık virgül.
  // Türkçe Excel nokta işaretini binlik ayırıcı saydığından "12.345" sayısı 12345'e, "1.5" tarihe dönüşebilir; bu yüzden
  // ondalık sayılar virgülle yazılır. Koordinat değişim dosyaları (NCN, CAD, CBS) bu işlevi kullanmaz, nokta ondalıkla kalır.
  U.csvRapor = function (rows) {
    return '\ufeff' + rows.map(function (r) { return r.map(function (c) {
      var t = c == null ? '' : String(c);
      if (/^-?\d+\.\d+$/.test(t)) t = t.replace('.', ',');
      if (/[;"\r\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
      return t;
    }).join(';'); }).join('\r\n') + '\r\n';
  };
  // Dosya indirme. claude.ai önizlemesinde "downloads" yeteneği kullanılır (yalnız izinli uzantılar;
  // diğerleri .zip içinde verilir). Sitede doğrudan tarayıcı indirmesi yapılır.
  var DL_OK = /\.(txt|json|md|csv|zip|html|svg|pdf|png|jpg|jpeg|webp|xlsx|docx)$/i;
  U.download = function (name, data, mime) {
    function blobSave() {
      try {
        var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        U.toast(name + ' indiriliyor');
      } catch (e) { U.toast('İndirme yapılamadı; Kopyala düğmesini kullanın'); }
    }
    if (!(window.claude && typeof window.claude.use === 'function')) return blobSave();
    window.claude.use('downloads').then(function (dl) {
      if (!dl) return blobSave();
      var n = name, d = data;
      if (!DL_OK.test(n) && U.zipper) { d = U.zipper(n, d); n = n + '.zip'; }
      return dl.save({ filename: n, data: d }).then(function () { U.toast(n + ' kaydedildi'); }, function (e) {
        U.toast(e && e.code === 'declined' ? 'İndirme iptal edildi' : 'İndirme bu görünümde yapılamadı');
      });
    }, blobSave);
  };
  // Alt sekmeler: <div class="subtabs" data-group="x"><button data-tab="a">..</button></div> + <div data-pane="x:a">
  U.subtabs = function (root) {
    U.$$('.subtabs', root).forEach(function (bar) {
      var g = bar.getAttribute('data-group');
      var btns = U.$$('button[data-tab]', bar);
      function sel(id) {
        btns.forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === id ? 'true' : 'false'); });
        U.$$('[data-pane^="' + g + ':"]', root).forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== g + ':' + id; });
        bar.dispatchEvent(new CustomEvent('tabchange', { detail: id }));
      }
      btns.forEach(function (b) { b.setAttribute('role', 'tab'); b.addEventListener('click', function () { sel(b.getAttribute('data-tab')); }); });
      bar.setAttribute('role', 'tablist');
      var first = btns.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0] || btns[0];
      if (first) sel(first.getAttribute('data-tab'));
      bar._select = sel;
    });
  };
  // Tıklanınca data-copy içeriğini kopyalayan düğmeler (temsilci dinleyici)
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-copy]');
    if (b) U.copy(b.getAttribute('data-copy'));
  });
  // Hata durumunda önceki sonucu geçersiz kılar: metin/tablo/çizim boşaltılır, düğmeler kapatılır (Claude denetimi D3-22)
  U.gecersiz = function (root, sels) {
    sels.forEach(function (s) {
      U.$$(s, root).forEach(function (e) {
        var t = e.tagName.toUpperCase();
        if (t === 'BUTTON') e.disabled = true;
        else if (t === 'TABLE') { if (e.tHead) e.tHead.innerHTML = ''; Array.prototype.forEach.call(e.tBodies, function (b) { b.innerHTML = ''; }); }
        else if (t === 'CANVAS') { var c = e.getContext('2d'); if (c) c.clearRect(0, 0, e.width, e.height); }
        else e.innerHTML = '';
      });
    });
  };
  U.copyBtn = function (text) { return '<button type="button" class="copy" data-copy="' + U.esc(text) + '">Kopyala</button>'; };
  // Harici betiği bir kez yükle (yalnız izinli CDN'ler)
  U.loadScript = function (src) {
    U._ls = U._ls || {};
    if (!U._ls[src]) U._ls[src] = new Promise(function (res, rej) {
      var s = document.createElement('script'), sri = window.TOPO_SRI && window.TOPO_SRI[src]; if (sri) { s.integrity = sri; s.crossOrigin = 'anonymous'; } s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Kütüphane yüklenemedi: ' + src)); };
      document.head.appendChild(s);
    });
    return U._ls[src];
  };
  U.cssVar = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  // Dosya adı için güvenli kısa ad: "Çankaya" -> "cankaya"
  U.slug = function (s) {
    var m = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'Ö': 'o', 'Ş': 's', 'Ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
    return String(s || '').replace(/[çğıİöşüÇĞÖŞÜâîû]/g, function (c) { return m[c]; }).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'birim';
  };
  // Yatay kaydırılan tablolar: içerik kutuya sığmıyorsa sağ (ve kaydırılınca sol) kenar soluklaşır; kullanıcı kaydırılabildiğini görür.
  function kaydirmaIsareti(el) {
    var t = el.scrollWidth - el.clientWidth > 2, sol = el.scrollLeft > 2, sag = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
    el.classList.toggle('kayar', t); el.classList.toggle('kayar-sol', t && sol); el.classList.toggle('kayar-sag', t && sag);
  }
  function kaydirmaTara(kok) {
    U.$$('.scroll, .formula', kok).forEach(function (el) {
      var formul = el.classList.contains('formula');
      if (!formul) { if (!el._ki) { el._ki = 1; el.addEventListener('scroll', function () { kaydirmaIsareti(el); }, { passive: true }); } kaydirmaIsareti(el); }
      // formül kutuları da dar ekranda yatay kayar (Codex denetimi D4-06)
      if (formul && !el.hasAttribute('aria-label')) { el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Formül'); }
      // yatay kayan bölge klavyeyle de kaydırılabilsin (WCAG 2.1.1; axe scrollable-region-focusable — D3-31)
      var tasar = el.scrollWidth > el.clientWidth + 1;
      if (tasar && !el.hasAttribute('tabindex')) { el.tabIndex = 0; el._ti = 1; } else if (!tasar && el._ti) { el.removeAttribute('tabindex'); el._ti = 0; }
    });
  }
  // Harita sütunu, yanındaki panel ondan uzunsa sabitlenir (shell.css .harita-sabit); kısa panelde sabitleme indirme gibi düğmeleri gizlemesin
  function haritaSabit(kok) {
    U.$$('.cols:not(.harita-akis)', kok).forEach(function (cols) {
      var kol = Array.prototype.slice.call(cols.children), mk = kol.filter(function (c) { return c.classList.contains('mapbox') || (c.classList.contains('stack') && c.querySelector(':scope > .mapbox')); })[0];
      if (!mk) return;
      var diger = Math.max.apply(null, kol.filter(function (c) { return c !== mk; }).map(function (c) { return c.scrollHeight; }).concat([0]));
      mk.classList.toggle('harita-sabit', diger > mk.scrollHeight + 80);
    });
  }
  if (typeof MutationObserver !== 'undefined') {
    var bekle = 0;
    new MutationObserver(function () { if (bekle) return; bekle = requestAnimationFrame(function () { bekle = 0; kaydirmaTara(document); haritaSabit(document); }); }).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', function () { kaydirmaTara(document); haritaSabit(document); });
  }
  // Dar ekranda yatay kayan araç menüsünde etkin aracı görünür alana getir (D3-39)
  U.etkinSekme = function () {
    U.$$('nav a[aria-current="page"], .subnav a[aria-current="page"]').forEach(function (a) {
      var p = a.parentElement; while (p && p !== document.body && !(p.scrollWidth > p.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(p).overflowX))) p = p.parentElement;
      if (p && p !== document.body) { var ra = a.getBoundingClientRect(), rp = p.getBoundingClientRect(); p.scrollLeft += (ra.left + ra.width / 2) - (rp.left + rp.width / 2); }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', U.etkinSekme); else setTimeout(U.etkinSekme, 0);
  window.addEventListener('hashchange', function () { setTimeout(U.etkinSekme, 0); });
  window.U = U;
})();



/* Gölge Diyagramı arayüzü */
(window.TOOLS = window.TOOLS || {}).golge = { init: function (root) {
  'use strict';
  var GL = window.TA.GL, K = window.TA.K, F = window.TA.F, U = window.U, SAYI = window.TA.P.sayi, $ = function (s) { return U.$(s, root); };
  U.zipper = U.zipper || function (name, data) { var o = {}; o[name] = typeof data === 'string' ? new TextEncoder().encode(data) : data; return F.zip(o); };
  var st = { mode: 'dik', r: null, kutleler: null, alan: null, crs: null, dosya: null, t: null };
  function err(m) { var e = $('#gl-err'); e.textContent = m || ''; e.hidden = !m; }
  function num(id) { var t = String($(id).value || '').trim(); if (!t) return null; var n = SAYI(t); return isFinite(n) ? n : K.parseNumber(t); }
  function hhmm(dk) { var h = Math.floor(dk / 60), m = Math.round(dk % 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  function dkOku(id) { var p = ($(id).value || '').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  var ORDER = ['geo-turef'].concat(K.TM_CMS.map(function (c) { return 'tm-turef-' + c; }), K.UTM_ZONES.map(function (z) { return 'utm-wgs84-' + z; }), ['geo-ed50'], K.TM_CMS.map(function (c) { return 'tm-ed50-' + c; }));
  ['#gl-src', '#gl-fsrc'].forEach(function (sel) { ORDER.forEach(function (id) { var s = K.SYSTEMS[id]; $(sel).add(new Option(s.kind === 'geo' ? (s.datum === 'ED50' ? 'Coğrafi – ED50' : 'Coğrafi – WGS84 / TUREF') : s.label, id)); }); });
  $('#gl-src').value = 'tm-turef-33';

  // Kütleleri ve konumu hazırla → { kutleler:[{pts,h}], lat, lon, gamma, crs }
  function konumla(halkalar, src) { // halkalar: [[[a,b],...]] kaynak sistemde
    var S = K.SYSTEMS[src], tum = [].concat.apply([], halkalar), cy = tum.reduce(function (a, p) { return a + p[0]; }, 0) / tum.length, cx = tum.reduce(function (a, p) { return a + p[1]; }, 0) / tum.length;
    if (S.kind === 'geo') {
      var cm = K.tmCmFor(cy), tm = (S.datum === 'ED50' ? 'tm-ed50-' : 'tm-turef-') + cm;
      var donus = halkalar.map(function (r) { return r.map(function (p) { var q = K.transform(src, tm, { lat: p[1], lon: p[0] }); return [q.y, q.x]; }); });
      var g0 = K.transform(src, 'geo-turef', { lat: cx, lon: cy });
      return { halkalar: donus, lat: g0.lat, lon: g0.lon, gamma: K.convergence(g0.lat, g0.lon, cm), crs: tm };
    }
    var g = K.transform(src, 'geo-turef', { y: cy, x: cx });
    return { halkalar: halkalar, lat: g.lat, lon: g.lon, gamma: K.convergence(g.lat, g.lon, S.cm), crs: src };
  }
  function kutleHazirla() {
    if (st.mode === 'dik') {
      var w = num('#gl-w'), d = num('#gl-d'), h = num('#gl-h'), rot = num('#gl-rot') || 0, lat = num('#gl-lat'), lon = num('#gl-lon');
      if (!(w > 0) || !(d > 0) || !(h > 0)) throw new Error('Genişlik, derinlik ve yüksekliği metre olarak girin.');
      if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) throw new Error('Enlem ve boylamı derece olarak girin.');
      var a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      var pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(function (p) { return [p[0] * ca + p[1] * sa, -p[0] * sa + p[1] * ca]; });
      return { kutleler: [{ pts: pts, h: h }], lat: lat, lon: lon, gamma: 0, crs: null };
    }
    var halkalar, hs;
    if (st.mode === 'koor') {
      halkalar = []; var cur = [];
      $('#gl-pts').value.split(/\n/).forEach(function (l, k) {
        var t = l.trim(); if (!t) { if (cur.length) { halkalar.push(cur); cur = []; } return; }
        var p = t.split(/[\s;\t]+/); if (p.length > 2) p = p.slice(-2);
        var y = K.parseNumber(p[0]), x = K.parseNumber(p[1]); if (!isFinite(y) || !isFinite(x)) throw new Error((k + 1) + '. satır: Y X okunamadı.');
        cur.push([y, x]);
      });
      if (cur.length) halkalar.push(cur);
      hs = $('#gl-hs').value.split(/[;\s]+/).filter(Boolean).map(function (s) { return SAYI(s); });
      if (hs.length < halkalar.length) { var son = hs[hs.length - 1]; while (hs.length < halkalar.length) hs.push(son); }
      var kk = konumla(halkalar, $('#gl-src').value);
      return { kutleler: kk.halkalar.map(function (r, i) { return { pts: temizle(r), h: hs[i] }; }), lat: kk.lat, lon: kk.lon, gamma: kk.gamma, crs: kk.crs };
    }
    if (!st.dosya) throw new Error('Kütle dosyası yükleyin.');
    var fld = $('#gl-fh').value, h0 = num('#gl-fh0');
    halkalar = st.dosya.map(function (f) { return f.ring; });
    hs = st.dosya.map(function (f) { var v = fld ? SAYI(String(f.props[fld])) : h0; return v; });
    var kd = konumla(halkalar, $('#gl-fsrc').value);
    return { kutleler: kd.halkalar.map(function (r, i) { return { pts: temizle(r), h: hs[i] }; }).filter(function (k) { return k.h > 0; }), lat: kd.lat, lon: kd.lon, gamma: kd.gamma, crs: kd.crs };
  }
  function temizle(r) { var a = r.slice(); if (a.length > 3 && a[0][0] === a[a.length - 1][0] && a[0][1] === a[a.length - 1][1]) a.pop(); return a; }
  function alanHazirla(kutleler) {
    if ($('#gl-alan').value === 'ozel') {
      var pts = [];
      $('#gl-apts').value.split(/\n/).forEach(function (l) { var p = l.trim().split(/[\s;\t]+/); if (p.length < 2) return; if (p.length > 2) p = p.slice(-2); var y = K.parseNumber(p[0]), x = K.parseNumber(p[1]); if (isFinite(y) && isFinite(x)) pts.push([y, x]); });
      if (pts.length < 3) throw new Error('Değerlendirme alanı için en az 3 köşe girin.');
      return temizle(pts);
    }
    var pay = num('#gl-pay'); if (!(pay >= 0)) pay = 30;
    var all = [].concat.apply([], kutleler.map(function (k) { return k.pts; }));
    var y0 = Math.min.apply(null, all.map(function (p) { return p[0]; })) - pay, y1 = Math.max.apply(null, all.map(function (p) { return p[0]; })) + pay;
    var x0 = Math.min.apply(null, all.map(function (p) { return p[1]; })) - pay, x1 = Math.max.apply(null, all.map(function (p) { return p[1]; })) + pay;
    return [[y0, x0], [y1, x0], [y1, x1], [y0, x1]];
  }
  function tarih() { var v = $('#gl-tarih').value.split('-'); return { y: +v[0], m: +v[1], d: +v[2] }; }

  function hesapla() {
    err('');
    var K0, r;
    try {
      K0 = kutleHazirla();
      if (!K0.kutleler.length) throw new Error('Yüksekliği pozitif kütle bulunamadı.');
      var alan = alanHazirla(K0.kutleler), t1 = dkOku('#gl-t1'), t2 = dkOku('#gl-t2');
      if (!(t2 >= t1)) throw new Error('Bitiş saati başlangıçtan önce olamaz.');
      r = GL.hesapla({ kutleler: K0.kutleler, lat: K0.lat, lon: K0.lon, gamma: K0.gamma, tarih: tarih(), tz: 3, baslangic: t1, bitis: t2, adim: +$('#gl-adim').value, alan: alan });
      st.alan = alan;
    } catch (e) { err(e.message); $('#gl-out').innerHTML = ''; $('#gl-svg').innerHTML = ''; $('#gl-cap').textContent = ''; $('#gl-exp').hidden = true; st.r = null; return; }
    st.r = r; st.kutleler = K0.kutleler; st.crs = K0.crs; st.konum = K0;
    ciz(); goster();
  }

  function ciz() {
    var r = st.r, svg = $('#gl-svg'), W = 400, H = 400, pad = 18, pts = st.alan.slice();
    r.saatler.forEach(function (s) { (s.geometri || []).forEach(function (poly) { poly[0].forEach(function (p) { pts.push(p); }); }); });
    var ys = pts.map(function (p) { return p[0]; }), xs = pts.map(function (p) { return p[1]; });
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var s = Math.min((W - 2 * pad) / (y1 - y0 || 1), (H - 2 * pad) / (x1 - x0 || 1)), ox = (W - (y1 - y0) * s) / 2, oy = (H - (x1 - x0) * s) / 2;
    var X = function (y) { return (ox + (y - y0) * s).toFixed(1); }, Y = function (x) { return (H - oy - (x - x0) * s).toFixed(1); };
    var path = function (mp) { return mp.map(function (poly) { return poly.map(function (ring) { return 'M' + ring.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join('L') + 'Z'; }).join(''); }).join(''); };
    var h = ['<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="var(--panel)"/>'];
    h.push('<path d="' + path([[st.alan.concat([st.alan[0]])]]) + '" fill="none" stroke="var(--muted)" stroke-dasharray="4 3" stroke-width="1"/>');
    var isi = $('#gl-isi').checked && r.izgara;
    if (isi) {
      var c = r.izgara.hucre, top = r.izgara.gunduzDk || 1;
      r.izgara.hucreler.forEach(function (q) { var f = q.gunesDk / top; h.push('<rect x="' + X(q.y - c / 2) + '" y="' + Y(q.x + c / 2) + '" width="' + (c * s + 0.3).toFixed(2) + '" height="' + (c * s + 0.3).toFixed(2) + '" fill="' + renk(f) + '"/>'); });
    } else {
      r.saatler.forEach(function (sa) { if (sa.geometri) h.push('<path d="' + path(sa.geometri) + '" fill="rgba(17,17,17,.07)" stroke="rgba(17,17,17,.35)" stroke-width=".8" fill-rule="nonzero"/>'); });
    }
    h.push('<path d="' + path(r.taban) + '" fill="var(--amber)" stroke="var(--text)" stroke-width="1.2"/>');
    if (!isi) {
      var cy = 0, cx = 0, n = 0; st.kutleler.forEach(function (k) { k.pts.forEach(function (p) { cy += p[0]; cx += p[1]; n++; }); }); cy /= n; cx /= n;
      var hmax = Math.max.apply(null, st.kutleler.map(function (k) { return k.h; }));
      // Saat etiketleri: üst üste binenler atlanır (ilk ve son saat her zaman yazılır)
      var konan = [], sat = r.saatler.filter(function (sa) { return sa.v; });
      sat.forEach(function (sa, i) {
        var ty = cy + sa.v[0] * hmax, tx = cx + sa.v[1] * hmax, px = +X(ty), py = +Y(tx), son = i === sat.length - 1;
        var carp = function (q) { return Math.abs(q[0] - px) < 34 && Math.abs(q[1] - py) < 13; };
        if (konan.some(carp) && !son) return;
        if (son) konan = konan.filter(function (q) { return !carp(q) || q[2] === 0; });
        konan.push([px, py, i, sa]);
      });
      konan.forEach(function (q) { h.push('<text class="svg-text" x="' + q[0] + '" y="' + q[1] + '" text-anchor="middle" style="paint-order:stroke;stroke:var(--panel);stroke-width:3px">' + hhmm(q[3].dk) + '</text>'); });
    }
    var nice = [1, 2, 5, 10, 20, 50, 100, 200, 500], len = nice.filter(function (v) { return v * s <= 90; }).pop() || 1;
    h.push('<line x1="12" y1="' + (H - 12) + '" x2="' + (12 + len * s).toFixed(1) + '" y2="' + (H - 12) + '" stroke="var(--text)" stroke-width="2"/><text class="svg-text" x="12" y="' + (H - 18) + '">' + len + ' m</text>');
    h.push('<text class="svg-strong" x="' + (W - 14) + '" y="20" text-anchor="end">' + (st.crs ? 'Harita K ↑' : 'K ↑') + '</text>');
    svg.innerHTML = h.join('');
    $('#gl-cap').textContent = isi ? 'Renk: güneş alma süresi (açık = az, koyu sarı = çok).' : 'Sarı: kütle tabanı. Gri: saatlik gölgeler; saat etiketleri en yüksek kütlenin gölge ucundadır.';
  }
  function renk(f) { var a = 0.08 + 0.75 * f; return 'rgba(242,169,0,' + a.toFixed(3) + ')'; }

  function goster() {
    var r = st.r, h = [], k = st.konum, ds = r.saatler.filter(function (s) { return !s.gece; });
    var t = tarih(), gun = t.d + '.' + (t.m < 10 ? '0' : '') + t.m + '.' + t.y;
    var enUzun = ds.reduce(function (a, s) { return Math.max(a, s.enUzun); }, 0);
    h.push('<div class="result-head"><span class="eyebrow">' + gun + ' · ' + U.num(k.lat, 4) + '° K, ' + U.num(k.lon, 4) + '° D' + (st.crs ? ' · yakınsama ' + U.num(k.gamma, 3) + '°' : '') + '</span><span class="big">En uzun gölge ' + U.num(enUzun, 1) + ' m</span><span class="meta">' + ds.length + ' adım' + (ds.length < r.saatler.length ? ' (' + (r.saatler.length - ds.length) + ' adımda güneş ufkun altında)' : '') + ' · taban ' + U.num(r.tabanAlan, 1) + ' m²</span></div>');
    h.push('<div class="scroll"><table class="t"><thead><tr><th>Saat</th><th class="num">Güneş yüksekliği</th><th class="num">Azimut</th><th class="num">Gölge / yükseklik</th><th class="num">Gölge alanı</th><th class="num">Değerlendirme alanında</th></tr></thead><tbody>' +
      r.saatler.map(function (s) {
        if (s.gece) return '<tr><td class="m">' + hhmm(s.dk) + '</td><td class="num">' + U.num(s.yukseklik, 1) + '°</td><td class="num">' + U.num(s.azimut, 1) + '°</td><td class="num" colspan="3">güneş ufkun altında ya da çok alçakta</td></tr>';
        return '<tr><td class="m">' + hhmm(s.dk) + '</td><td class="num">' + U.num(s.yukseklik, 1) + '°</td><td class="num">' + U.num(s.azimut, 1) + '°</td><td class="num">' + U.num(s.oran, 2) + '</td><td class="num">' + U.num(s.alan, 0) + ' m²</td><td class="num">' + U.num(s.alandaGolge, 0) + ' m² (%' + U.num(s.alandaOran * 100, 0) + ')</td></tr>';
      }).join('') + '</tbody></table></div>');
    if (r.izgara && r.izgara.hucreler.length) {
      var c2 = r.izgara.hucre * r.izgara.hucre, sinif = [0, 0, 0, 0];
      r.izgara.hucreler.forEach(function (q) { var g = q.gunesDk; sinif[g === 0 ? 0 : g < 120 ? 1 : g < 240 ? 2 : 3] += c2; });
      var tp = sinif.reduce(function (a, b) { return a + b; }, 0) || 1;
      h.push('<div class="scroll"><table class="t"><thead><tr><th>Değerlendirme alanı (kütle hariç) güneş alma süresi</th><th class="num">Alan</th><th class="num">Oran</th></tr></thead><tbody>' +
        [['Hiç güneş almıyor', 0], ['2 saatten az', 1], ['2–4 saat', 2], ['4 saat ve üzeri', 3]].map(function (x) { return '<tr><td>' + x[0] + '</td><td class="num">' + U.num(sinif[x[1]], 0) + ' m²</td><td class="num">%' + U.num(sinif[x[1]] / tp * 100, 1) + '</td></tr>'; }).join('') +
        '</tbody></table></div><p class="hint">Süreler ' + hhmm(dkOku('#gl-t1')) + '–' + hhmm(dkOku('#gl-t2')) + ' aralığında, ' + r.izgara.adim + ' dakikalık örneklerle (yamuk kuralı; uçlar yarım aralık sayılır) ve ' + U.num(r.izgara.hucre, 2) + ' m ızgarayla yaklaşık hesaplanmıştır.</p>');
    }
    $('#gl-out').innerHTML = h.join(''); $('#gl-exp').hidden = false;
  }

  $('#gl-dxf').addEventListener('click', function () {
    var r = st.r; if (!r) return;
    var feats = [];
    var poly = function (mp, katman, ad) { mp.forEach(function (p) { feats.push({ type: 'Feature', properties: { katman: katman, ad: ad }, geometry: { type: 'Polygon', coordinates: p } }); }); };
    r.saatler.forEach(function (s) { if (s.geometri) poly(s.geometri, 'GOLGE_' + hhmm(s.dk).replace(':', ''), ''); });
    st.kutleler.forEach(function (k, i) { var ring = k.pts.concat([k.pts[0]]); feats.push({ type: 'Feature', properties: { katman: 'KUTLE', ad: 'H=' + U.plain(k.h, 2) }, geometry: { type: 'Polygon', coordinates: [ring] } }); });
    feats.push({ type: 'Feature', properties: { katman: 'DEGERLENDIRME_ALANI', ad: '' }, geometry: { type: 'Polygon', coordinates: [st.alan.concat([st.alan[0]])] } });
    var crs = st.crs || 'tm-turef-33';
    var out = F.write({ type: 'FeatureCollection', features: feats }, crs, { format: 'dxf', crs: crs, layerField: 'katman', textField: 'ad', textHeight: 1, centerText: true }, 'golge_diyagrami');
    U.download(out.name, out.data);
  });
  $('#gl-csv').addEventListener('click', function () {
    var r = st.r; if (!r) return;
    var rows = [['saat', 'gunes_yukseklik_derece', 'azimut_derece', 'golge_orani', 'golge_alani_m2', 'alandaki_golge_m2']].concat(r.saatler.map(function (s) { return [hhmm(s.dk), s.yukseklik.toFixed(3), s.azimut.toFixed(3), s.gece ? '' : s.oran.toFixed(4), s.gece ? '' : s.alan.toFixed(2), s.gece ? '' : s.alandaGolge.toFixed(2)]; }));
    U.download('golge_saatlik.csv', U.csvRapor(rows));
  });

  // Dosya
  var drop = $('#gl-drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { dosya(e.dataTransfer.files); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#gl-file').click(); } });
  $('#gl-file').addEventListener('change', function (e) { dosya(e.target.files); e.target.value = ''; });
  function dosya(list) {
    var files = Array.prototype.slice.call(list || []); if (!files.length) return;
    Promise.all(files.map(function (f) { return f.arrayBuffer().then(function (b) { return { name: f.name, data: new Uint8Array(b) }; }); })).then(function (arr) {
      var r = F.readFiles(arr); if (r.table) throw new Error('Alan (poligon) içeren bir dosya seçin.');
      var out = [];
      r.fc.features.forEach(function (f) { if (!f.geometry) return; var g = f.geometry; (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).forEach(function (p) { out.push({ ring: p[0], props: f.properties || {} }); }); });
      if (!out.length) throw new Error('Dosyada alan (poligon) bulunamadı.');
      st.dosya = out; $('#gl-fsrc').value = r.crs;
      var keys = {}; out.forEach(function (o) { Object.keys(o.props).forEach(function (k) { if (isFinite(SAYI(String(o.props[k])))) keys[k] = 1; }); });
      $('#gl-fh').innerHTML = '<option value="">— tek yükseklik —</option>' + Object.keys(keys).map(function (k) { return '<option>' + U.esc(k) + '</option>'; }).join('');
      var guess = Object.keys(keys).filter(function (k) { return /yuk|yük|height|kat_?h|^h$|elev/i.test(k); })[0]; if (guess) $('#gl-fh').value = guess;
      $('#gl-fnote').textContent = out.length + ' kütle okundu.' + (guess ? ' Yükseklik "' + guess + '" alanından alındı.' : '');
      hesapla();
    }).catch(function (e) { err('Dosya okunamadı: ' + (e.message || e)); });
  }

  // Olaylar
  U.$('.subtabs[data-group="gl"]', root).addEventListener('tabchange', function (e) { st.mode = e.detail; hesapla(); });
  $('#gl-gun').addEventListener('change', function () { var v = $('#gl-gun').value; if (v !== 'ozel') { var p = v.split('-'), y = (($('#gl-tarih').value || '2026').split('-')[0]); $('#gl-tarih').value = y + '-' + (p[0] < 10 ? '0' : '') + p[0] + '-' + p[1]; } hesapla(); });
  $('#gl-tarih').addEventListener('change', function () { $('#gl-gun').value = 'ozel'; hesapla(); });
  $('#gl-alan').addEventListener('change', function () { var o = $('#gl-alan').value === 'ozel'; $('#gl-aptsw').hidden = !o; $('#gl-payw').hidden = o; hesapla(); });
  ['#gl-adim', '#gl-src', '#gl-fsrc', '#gl-fh', '#gl-t1', '#gl-t2'].forEach(function (s) { $(s).addEventListener('change', hesapla); });
  $('#gl-isi').addEventListener('change', function () { if (st.r) ciz(); });
  root.addEventListener('input', function (e) { if (e.target.matches('input:not([type=checkbox]):not([type=date]):not([type=time]), textarea')) { clearTimeout(st.t); st.t = setTimeout(hesapla, 350); } });
  hesapla();
}};

(function(){var s=document.getElementById('t-golge');U.subtabs(s);TOOLS['golge'].init(s);})();