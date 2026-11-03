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



/* İmar Hesaplayıcı arayüzü */
(window.TOOLS = window.TOOLS || {}).imar = { init: function (root) {
  'use strict';
  var I = window.TA.I, K = window.TA.K, F = window.TA.F, O = window.TA.O, U = window.U, $ = function (s) { return U.$(s, root); };
  U.zipper = function (name, data) { var o = {}; o[name] = typeof data === 'string' ? new TextEncoder().encode(data) : data; return F.zip(o); };
  var st = { mode: 'dik', filePts: null, fileCrs: null, turler: null, ozel: {}, yol: {}, sonuc: null, pts: null, env: null };
  var TUR = ['on', 'yan', 'arka', 'bitisik'], TUR_AD = { on: 'Ön (yol)', yan: 'Yan', arka: 'Arka', bitisik: 'Bitişik (0)' }, TUR_KISA = { on: 'Ö', yan: 'Y', arka: 'A', bitisik: 'B' };
  function err(m) { var e = $('#im-err'); e.textContent = m || ''; e.hidden = !m; }
  function num(v) { var t = String(v == null ? '' : v).trim(); if (!t) return null; var pct = /%/.test(t); var n = K.parseNumber(t.replace(/%/g, '')); if (!isFinite(n)) return NaN; return pct ? n / 100 : n; }
  function m2(v) { return U.num(v, 2) + ' m²'; }
  function m(v) { return U.num(v, 2) + ' m'; }

  // sistem listesi (dosya)
  var ORDER = ['geo-turef'].concat(K.TM_CMS.map(function (c) { return 'tm-turef-' + c; }), K.UTM_ZONES.map(function (z) { return 'utm-wgs84-' + z; }), ['geo-ed50'], K.TM_CMS.map(function (c) { return 'tm-ed50-' + c; }));
  ORDER.forEach(function (id) { var s = K.SYSTEMS[id]; $('#im-src').add(new Option(s.kind === 'geo' ? (s.datum === 'ED50' ? 'Coğrafi – ED50' : 'Coğrafi – WGS84 / TUREF') : s.label, id)); });

  // ---------- Parsel ----------
  function parsel() {
    if (st.mode === 'dik') {
      var w = num($('#im-w').value), d = num($('#im-d').value);
      if (!(w > 0) || !(d > 0)) throw new Error('Ön cephe genişliğini ve derinliği metre olarak girin.');
      return { pts: [{ y: 0, x: 0 }, { y: w, x: 0 }, { y: w, x: d }, { y: 0, x: d }], yerel: true };
    }
    if (st.mode === 'koor') {
      var rows = O.parsePointList($('#im-pts').value, K.parseNumber);
      if (rows.length < 3) throw new Error('En az 3 köşe noktası girin.');
      var pts = rows.map(function (r) { return { y: r.y, x: r.x, ad: r.ad }; });
      if (pts.length > 3 && pts[0].y === pts[pts.length - 1].y && pts[0].x === pts[pts.length - 1].x) pts.pop();
      return { pts: pts, yerel: false };
    }
    if (!st.filePts) throw new Error('Parsel dosyası yükleyin.');
    return { pts: st.filePts, yerel: false, crs: st.fileCrs };
  }
  function varsayilanTurler(n) { return I.kenarTurleri(n, [0]); }

  // ---------- Hesap ----------
  function hesapla() {
    err('');
    var P; try { P = parsel(); } catch (e) { err(e.message); temizle(); return; }
    var pts = P.pts, n = pts.length;
    if (!st.turler || st.turler.length !== n) { st.turler = varsayilanTurler(n); st.ozel = {}; st.yol = {}; }
    var A = Math.abs(I._ringArea(pts));
    var taks = num($('#im-taks').value), kaks = num($('#im-kaks').value), kat = num($('#im-kat').value);
    if (taks != null && taks > 1) taks = taks / 100;
    if (taks != null && !(taks > 0 && taks <= 1)) { err('TAKS 0 ile 1 arasında bir oran (ya da %) olmalı.'); return; }
    if (kaks != null && !(kaks > 0)) { err('KAKS pozitif bir sayı olmalı.'); return; }
    if (!(kat >= 1) || Math.round(kat) !== kat) { err('Kat adedi 1 ya da daha büyük bir tam sayı olmalı.'); return; }
    var plan = {}, on = num($('#im-on').value), yan = num($('#im-yan').value), arka = num($('#im-arka').value);
    if (on != null) plan.on = on; if (yan != null) plan.yan = yan; if (arka != null) plan.arka = arka;
    var g = { parselAlani: A, taks: taks, kaks: kaks, katAdedi: kat, nizam: $('#im-nizam').value, bolge: $('#im-bolge').value, asmaKat: $('#im-asma').checked,
      tekBagimsizKonut: $('#im-tek').checked, bodrumAcik: num($('#im-bod').value) || 0, bodrumKullanimli: num($('#im-bodk').value) || 0, plan: plan, taksPlandanAcik: $('#im-taksacik').checked };
    var on1 = I.hesapla(g), b = on1.bahce;
    var kenarlar = st.turler.map(function (t, i) { var o = st.ozel[i]; return { tur: t, mesafe: o != null ? o : t === 'on' ? b.on : t === 'yan' ? b.yan : t === 'arka' ? b.arka : 0, yolGenisligi: t === 'on' ? st.yol[i] : undefined }; });
    var env = I.yapilasabilirAlan(pts, kenarlar), cik = I.cikmaSiniri(pts, kenarlar), bitVar = kenarlar.some(function (k) { return k.tur === 'bitisik'; }); cik.acik = bitVar ? I.cikmaSiniri(pts, kenarlar, { acik: true }) : cik;
    g.yapilasabilir = env.alan;
    var r = I.hesapla(g); st.kapaliYasak = r.kapaliCikmaYasak;
    // asgari parsel (md. 6)
    var olc = P.yerel ? { cephe: pts[1].y, derinlik: pts[2].x } : I.parselOlculeri(pts, kenarlar);
    var nz = g.nizam, yanTop = nz === 'bitisik' ? 0 : nz === 'blok' ? r.bahce.yan : 2 * r.bahce.yan;
    var ap = I.asgariParsel(nz, r.cepheKatAdedi, yanTop, r.bahce.on);
    st.sonuc = r; st.pts = pts; st.env = env; st.cik = cik; st.kenarlar = kenarlar; st.olc = olc; st.ap = ap; st.P = P;
    cizim(pts, kenarlar, env, cik); kenarTablosu(pts, kenarlar, cik); sonuc(r, olc, ap, A, cik);
  }
  function temizle() { $('#im-out').innerHTML = ''; $('#im-edges').innerHTML = ''; $('#im-svg').innerHTML = ''; $('#im-exp').hidden = true; }

  // ---------- Şema ----------
  function cizim(pts, kenarlar, env, cik) {
    var svg = $('#im-svg'), W = 400, H = 300, pad = 34;
    var ys = pts.map(function (p) { return p.y; }), xs = pts.map(function (p) { return p.x; });
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var s = Math.min((W - 2 * pad) / Math.max(y1 - y0, 1e-6), (H - 2 * pad) / Math.max(x1 - x0, 1e-6));
    var ox = (W - (y1 - y0) * s) / 2, oy = (H - (x1 - x0) * s) / 2;
    var X = function (y) { return ox + (y - y0) * s; }, Y = function (x) { return H - oy - (x - x0) * s; };
    var h = [];
    h.push('<defs><pattern id="im-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--tint)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--amber)" stroke-width="2"/></pattern></defs>');
    h.push('<polygon points="' + pts.map(function (p) { return X(p.y).toFixed(1) + ',' + Y(p.x).toFixed(1); }).join(' ') + '" fill="var(--soft)" stroke="none"/>');
    (env.geometri || []).forEach(function (poly) {
      var d = poly.map(function (ring) { return 'M' + ring.map(function (c) { return X(c[0]).toFixed(1) + ',' + Y(c[1]).toFixed(1); }).join('L') + 'Z'; }).join('');
      h.push('<path d="' + d + '" fill="url(#im-hatch)" fill-rule="evenodd" stroke="var(--amber-text)" stroke-width="1.2"/>');
    });
    var cizCik = function (geo, baslik, dash) { (geo || []).forEach(function (poly) {
      var d = poly.map(function (ring) { return 'M' + ring.map(function (c) { return X(c[0]).toFixed(1) + ',' + Y(c[1]).toFixed(1); }).join('L') + 'Z'; }).join('');
      h.push('<path d="' + d + '" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="' + dash + '"><title>' + baslik + '</title></path>');
    }); };
    if (!st.kapaliYasak) cizCik(cik.geometri, 'Kapalı çıkma sınırı (md. 41)', '4 3');
    if (cik.acik !== cik || st.kapaliYasak) cizCik(cik.acik.geometri, 'Açık çıkma sınırı (md. 41; bitişik komşuya 2,00 m)', '1.5 2.5');
    var n = pts.length, cx = pts.reduce(function (a, p) { return a + X(p.y); }, 0) / n, cy = pts.reduce(function (a, p) { return a + Y(p.x); }, 0) / n;
    kenarlar.forEach(function (k, i) {
      var a = pts[i], b = pts[(i + 1) % n], ax = X(a.y), ay = Y(a.x), bx = X(b.y), by = Y(b.x);
      var col = k.tur === 'on' ? 'var(--text)' : k.tur === 'bitisik' ? 'var(--muted)' : 'var(--amber-text)';
      h.push('<line class="im-edge" data-i="' + i + '" x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + bx.toFixed(1) + '" y2="' + by.toFixed(1) + '" stroke="' + col + '" stroke-width="' + (k.tur === 'on' ? 4 : 2.5) + '"' + (k.tur === 'bitisik' ? ' stroke-dasharray="6 4"' : '') + '/>');
      h.push('<line class="im-hit" data-i="' + i + '" x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + bx.toFixed(1) + '" y2="' + by.toFixed(1) + '" stroke="transparent" stroke-width="16" style="cursor:pointer"><title>' + (i + 1) + '. kenar: ' + TUR_AD[k.tur] + ' — tıklayarak değiştirin</title></line>');
      var mx = (ax + bx) / 2, my = (ay + by) / 2, vx = mx - cx, vy = my - cy, L = Math.hypot(vx, vy) || 1;
      var lx = mx + vx / L * 14, ly = my + vy / L * 14;
      h.push('<text class="svg-strong" x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle">' + TUR_KISA[k.tur] + ' ' + U.num(k.mesafe, 2) + '</text>');
    });
    // ölçek çubuğu
    var nice = [1, 2, 5, 10, 20, 50, 100, 200, 500], len = nice.filter(function (v) { return v * s <= 90; }).pop() || 1;
    h.push('<line x1="12" y1="' + (H - 12) + '" x2="' + (12 + len * s).toFixed(1) + '" y2="' + (H - 12) + '" stroke="var(--text)" stroke-width="2"/><text class="svg-text" x="12" y="' + (H - 18) + '">' + len + ' m</text>');
    if (!st.P.yerel) h.push('<text class="svg-text" x="' + (W - 14) + '" y="18" text-anchor="end">K ↑</text>');
    svg.innerHTML = h.join('');
  }
  $('#im-svg').addEventListener('click', function (e) {
    var t = e.target.closest('[data-i]'); if (!t) return;
    var i = +t.getAttribute('data-i'); st.turler[i] = TUR[(TUR.indexOf(st.turler[i]) + 1) % TUR.length]; delete st.ozel[i]; hesapla();
  });
  function kenarTablosu(pts, kenarlar, cik) {
    var n = pts.length, cokOn = kenarlar.filter(function (k) { return k.tur === 'on'; }).length > 1, h = ['<table class="t"><thead><tr><th>Kenar</th><th class="num">Uzunluk</th><th>Tür</th><th class="num">Çekme (m)</th><th class="num">Çıkma</th>' + (cokOn ? '<th class="num">Yol (m)</th>' : '') + '</tr></thead><tbody>'];
    kenarlar.forEach(function (k, i) {
      var a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b.y - a.y, b.x - a.x);
      h.push('<tr><td class="m">' + (a.ad && b.ad ? U.esc(a.ad + '–' + b.ad) : (i + 1) + '. kenar') + '</td><td class="num">' + U.num(L, 2) + ' m</td><td><select data-tur="' + i + '" aria-label="' + (i + 1) + '. kenar türü">' + TUR.map(function (t) { return '<option value="' + t + '"' + (t === k.tur ? ' selected' : '') + '>' + TUR_AD[t] + '</option>'; }).join('') + '</select></td>' +
        '<td class="num"><input data-mes="' + i + '" inputmode="decimal" value="' + (st.ozel[i] != null ? String(st.ozel[i]).replace('.', ',') : '') + '" placeholder="' + U.num(k.mesafe, 2) + '" style="width:6.5em;text-align:right" aria-label="' + (i + 1) + '. kenar çekme mesafesi"></td><td class="num">' + U.num(cik.paylar[i].cikma, 2) + ' m</td>' +
        (cokOn ? '<td class="num">' + (k.tur === 'on' ? '<input data-yol="' + i + '" inputmode="decimal" value="' + (st.yol[i] != null ? String(st.yol[i]).replace('.', ',') : '') + '" placeholder="—" style="width:5.5em;text-align:right" aria-label="' + (i + 1) + '. kenarın baktığı yol genişliği">' : '') + '</td>' : '') + '</tr>');
    });
    h.push('</tbody></table><p class="hint">Çekme boşsa yönetmelik ya da plan mesafesi kullanılır. Köşe başı parselde iki yola bakan kenarı da "Ön" yapın' + (cokOn ? '; parsel ön cephesi geniş yola bakan kenardır, yollar eşitse ya da genişlik girilmemişse dar kenardır (md. 4/1-kkk)' : '') + '.</p>');
    $('#im-edges').innerHTML = h.join('');
  }
  $('#im-edges').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.tur != null) { st.turler[+t.dataset.tur] = t.value; delete st.ozel[+t.dataset.tur]; hesapla(); }
    if (t.dataset.mes != null) { var v = num(t.value); if (v == null) delete st.ozel[+t.dataset.mes]; else if (v >= 0) st.ozel[+t.dataset.mes] = v; hesapla(); }
    if (t.dataset.yol != null) { var w = num(t.value); if (w == null || !(w > 0)) delete st.yol[+t.dataset.yol]; else st.yol[+t.dataset.yol] = w; hesapla(); }
  });

  // ---------- Sonuç ----------
  function sonuc(r, olc, ap, A, cik) {
    var h = [];
    h.push('<div class="result-head"><span class="eyebrow">' + U.esc(r.durum) + '</span><span class="big">Taban ' + m2(r.tabanAlani) + ' · Emsal ' + m2(r.emsalAlani) + '</span><span class="meta">' + r.katAdedi + ' kat · bina yüksekliği ' + m(r.katlar.binaYuksekligi) + ' · uygulanan TAKS ' + U.num(r.taksGercek, 3) + ' · KAKS ' + U.num(r.kaksGercek, 3) + '</span></div>');
    h.push('<div class="scroll"><table class="t im-sonuc"><tbody>' +
      '<tr><td>Parsel alanı (net imar parseli)<span class="sub">md. 5/5</span></td><td class="num">' + m2(A) + '</td></tr>' +
      '<tr><td>Bahçe mesafelerine göre yapılaşabilir alan<span class="sub">md. 23</span></td><td class="num">' + m2(r.yapilasabilir) + '</td></tr>' +
      '<tr><td>TAKS ile bulunan taban alanı sınırı<span class="sub">md. 5/6</span></td><td class="num">' + m2(r.tabanTaks) + '</td></tr>' +
      '<tr class="hl"><td><strong>Taban alanı</strong><span class="sub">md. 20/3</span></td><td class="num"><strong>' + m2(r.tabanAlani) + '</strong></td></tr>' +
      '<tr class="hl"><td><strong>Emsal (katlar alanı)</strong><span class="sub">md. 4, 21</span></td><td class="num"><strong>' + m2(r.emsalAlani) + '</strong></td></tr>' +
      '<tr><td>Emsal harici alanlar için üst sınır (%30)<span class="sub">md. 5/8</span></td><td class="num">' + m2(r.emsalDisiAzami) + '</td></tr>' +
      '<tr><td>Bina yüksekliği (' + r.katlar.katlar.map(function (v) { return U.num(v, 2); }).join(' + ') + ')<span class="sub">md. ' + r.katlar.madde + '</span></td><td class="num">' + m(r.katlar.binaYuksekligi) + '</td></tr>' +
      '<tr><td>Bahçe mesafeleri: ön / yan / arka<span class="sub">md. 23' + (r.bahce.artis ? ' (+' + U.num(r.bahce.artis, 2) + ')' : '') + '</span></td><td class="num">' + [r.bahce.on, r.bahce.yan, r.bahce.arka].map(function (v) { return U.num(v, 2); }).join(' / ') + ' m</td></tr>' +
      (r.kapaliCikmaYasak ? '' : '<tr><td>Kapalı çıkmalarla en büyük kat izdüşümü<span class="sub">md. 41</span></td><td class="num">' + m2(cik.alan) + '</td></tr>') +
      (cik.acik !== cik || r.kapaliCikmaYasak ? '<tr><td>Açık çıkma sınırı içi alan' + (cik.acik !== cik ? ' (bitişik komşuya 2,00 m)' : '') + '<span class="sub">md. 41/1-b</span></td><td class="num">' + m2(cik.acik.alan) + '</td></tr>' : '') +
      '<tr><td>Bahçeye dikilecek ağaç (her 30 m²)<span class="sub">md. 23/6</span></td><td class="num">' + r.agac + ' adet</td></tr>' +
      '</tbody></table></div>');
    var okG = olc.cephe == null ? null : olc.cephe + 1e-9 >= ap.genislik, okD = olc.derinlik == null ? null : olc.derinlik + 1e-9 >= ap.derinlik;
    var badge = function (x) { return x == null ? '<span class="badge">ölçülemedi</span>' : x ? '<span class="badge ok">uygun</span>' : '<span class="badge no">yetersiz</span>'; };
    h.push('<div class="scroll"><table class="t"><thead><tr><th>Denetim</th><th class="num">Parsel</th><th class="num">Asgari</th><th></th></tr></thead><tbody>' +
      '<tr><td>Parsel genişliği (md. ' + ap.madde + ')</td><td class="num">' + (olc.cephe == null ? '—' : m(olc.cephe)) + '</td><td class="num">' + m(ap.genislik) + '</td><td>' + badge(okG) + '</td></tr>' +
      '<tr><td>Parsel derinliği (md. ' + ap.maddeDerinlik + ')</td><td class="num">' + (olc.derinlik == null ? '—' : m(olc.derinlik)) + '</td><td class="num">' + m(ap.derinlik) + '</td><td>' + badge(okD) + '</td></tr>' +
      '</tbody></table></div>');
    var li = [r.asansor, 'Çıkmalar: yol cephesinde yaklaşma sınırından en çok 1,50 m (parsel sınırı içinde); yan ve arka bahçede parsel sınırına 3,00 m\'den fazla yaklaşmadan en çok 1,50 m. Çıkma altı tabii ya da tesviye zeminden en az 2,40 m; ön bahçe 3 m ya da daha azsa yol kotundan 2,40 m. Açık çıkma bitişik nizamda komşu sınırına 2,00 m\'den fazla yaklaşamaz (md. 41). Saçak plan yoksa en çok 1,00 m, çıkma varsa çıkmadan 0,50 m (md. 42). Şemadaki çıkma sınırı yalnız yatay sınırdır; çıkma altı yüksekliği ve saçak ayrıca denetlenmelidir.']; if (r.yuksekYapi) li.push(r.yuksekYapi); r.notlar.forEach(function (x) { li.push(x); });
    h.push('<ul class="im-notes">' + li.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    if (r.uyarilar.length) h.push('<ul class="warnlist">' + r.uyarilar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    h.push('<p class="hint">Uygulama imar planı, plan notları ve idarenin imar yönetmeliği bu genel hükümlerden önce gelir; kesin değerler parselin imar durum belgesindedir.</p>');
    $('#im-out').innerHTML = h.join(''); $('#im-exp').hidden = false;
  }

  // ---------- Kat adedi yola göre ----------
  $('#im-yolkat').addEventListener('click', function () {
    var y = num($('#im-yol').value); if (!(y > 0)) { err('Yol genişliğini metre olarak girin.'); return; }
    $('#im-kat').value = I.yolKatAdedi(y); U.toast('Kat adedi md. 9 tablosundan: ' + I.yolKatAdedi(y)); hesapla();
  });

  // ---------- Dosya ----------
  var drop = $('#im-drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { dosya(e.dataTransfer.files); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#im-file').click(); } });
  $('#im-file').addEventListener('change', function (e) { dosya(e.target.files); e.target.value = ''; });
  var ham = null;
  function dosya(list) {
    var files = Array.prototype.slice.call(list || []); if (!files.length) return;
    Promise.all(files.map(function (f) { return f.arrayBuffer().then(function (b) { return { name: f.name, data: new Uint8Array(b) }; }); })).then(function (arr) {
      var r = F.readFiles(arr); if (r.table) throw new Error('Tablo dosyası yerine alan (poligon) içeren bir dosya seçin ya da köşe koordinatları sekmesini kullanın.');
      var f = r.fc.features.filter(function (x) { return x.geometry && /Polygon/.test(x.geometry.type); })[0];
      if (!f) throw new Error('Dosyada alan (poligon) bulunamadı.');
      var ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      ham = ring; $('#im-src').value = r.crs; $('#im-srcw').hidden = !!(r.crsSure);
      donustur();
    }).catch(function (e) { err('Dosya okunamadı: ' + (e.message || e)); });
  }
  function donustur() {
    if (!ham) return;
    var src = $('#im-src').value, S = K.SYSTEMS[src], cs = ham.slice();
    if (cs.length > 3 && cs[0][0] === cs[cs.length - 1][0] && cs[0][1] === cs[cs.length - 1][1]) cs.pop();
    var pts;
    if (S.kind === 'geo') {
      var lon = cs.reduce(function (a, c) { return a + c[0]; }, 0) / cs.length, cm = K.tmCmFor(lon), tm = (S.datum === 'ED50' ? 'tm-ed50-' : 'tm-turef-') + cm;
      pts = cs.map(function (c) { var p = K.transform(src, tm, { lat: c[1], lon: c[0] }); return { y: p.y, x: p.x }; });
      st.fileCrs = tm; $('#im-fnote').textContent = 'Coğrafi koordinatlar ' + K.SYSTEMS[tm].label + ' düzlemine dönüştürüldü. Alan bu düzlemde hesaplanır (dilim ortasında ölçek etkisi ihmal edilebilir).';
    } else { pts = cs.map(function (c) { return { y: c[0], x: c[1] }; }); st.fileCrs = src; $('#im-fnote').textContent = 'Koordinatlar ' + S.label + ' düzleminde kullanıldı.'; }
    st.filePts = pts; st.turler = null; hesapla();
  }
  $('#im-src').addEventListener('change', donustur);

  // ---------- Dışa aktarma ----------
  $('#im-dxf').addEventListener('click', function () {
    if (!st.sonuc) return;
    var ring = st.pts.map(function (p) { return [p.y, p.x]; }); ring.push(ring[0]);
    var feats = [{ type: 'Feature', properties: { katman: 'PARSEL', ad: 'Parsel ' + U.num(st.sonuc.parselAlani, 2) + ' m2' }, geometry: { type: 'Polygon', coordinates: [ring] } }];
    if (!st.sonuc.kapaliCikmaYasak) (st.cik.geometri || []).forEach(function (poly) { feats.push({ type: 'Feature', properties: { katman: 'CIKMA_SINIRI', ad: '' }, geometry: { type: 'Polygon', coordinates: poly } }); });
    if (st.cik.acik !== st.cik || st.sonuc.kapaliCikmaYasak) (st.cik.acik.geometri || []).forEach(function (poly) { feats.push({ type: 'Feature', properties: { katman: 'ACIK_CIKMA_SINIRI', ad: '' }, geometry: { type: 'Polygon', coordinates: poly } }); });
    (st.env.geometri || []).forEach(function (poly) { feats.push({ type: 'Feature', properties: { katman: 'YAPI_YAKLASMA_SINIRI', ad: 'Yapilasabilir ' + U.num(st.env.alan, 2) + ' m2' }, geometry: { type: 'Polygon', coordinates: poly } }); });
    var crs = st.fileCrs || 'tm-turef-33';
    var out = F.write({ type: 'FeatureCollection', features: feats }, crs, { format: 'dxf', crs: crs, layerField: 'katman', textField: 'ad', textHeight: Math.max(0.5, Math.sqrt(st.sonuc.parselAlani) / 25), centerText: true }, 'imar_yapilasabilir_alan');
    U.download(out.name, out.data);
  });
  $('#im-csv').addEventListener('click', function () {
    var r = st.sonuc; if (!r) return;
    var rows = [['kalem', 'deger', 'birim', 'madde'],
      ['parsel_alani', r.parselAlani.toFixed(2), 'm2', '5/5'], ['yapilasabilir_alan', r.yapilasabilir.toFixed(2), 'm2', '23'], ['taban_alani', r.tabanAlani.toFixed(2), 'm2', '20/3'],
      ['emsal_alani', r.emsalAlani.toFixed(2), 'm2', '21'], ['emsal_harici_azami', r.emsalDisiAzami.toFixed(2), 'm2', '5/8'], ['kat_adedi', r.katAdedi, 'adet', ''],
      ['bina_yuksekligi', r.katlar.binaYuksekligi.toFixed(2), 'm', r.katlar.madde], ['on_bahce', r.bahce.on, 'm', '23'], ['yan_bahce', r.bahce.yan, 'm', '23'], ['arka_bahce', r.bahce.arka, 'm', '23'], ['agac', r.agac, 'adet', '23/6'], ['cikma_siniri_alani', st.cik.alan.toFixed(2), 'm2', '41']];
    U.download('imar_hesabi.csv', U.csvRapor(rows));
  });

  // ---------- Olaylar ----------
  U.$('.subtabs[data-group="im"]', root).addEventListener('tabchange', function (e) { st.mode = e.detail; st.turler = null; st.ozel = {}; st.yol = {}; hesapla(); });
  ['#im-w', '#im-d', '#im-taks', '#im-kaks', '#im-kat', '#im-on', '#im-yan', '#im-arka', '#im-bod', '#im-bodk'].forEach(function (s) { $(s).addEventListener('input', function () { clearTimeout(st.t); st.t = setTimeout(hesapla, 250); }); });
  $('#im-pts').addEventListener('input', function () { clearTimeout(st.t); st.t = setTimeout(function () { st.turler = null; hesapla(); }, 400); });
  ['#im-nizam', '#im-bolge', '#im-asma', '#im-tek', '#im-taksacik'].forEach(function (s) { $(s).addEventListener('change', hesapla); });
  $('#im-pts').value = '1 500000,00 4400000,00\n2 500022,50 4400002,00\n3 500020,00 4400031,00\n4 500004,00 4400030,00\n5 499999,00 4400016,00';
  hesapla();
}};

(function(){var s=document.getElementById('t-imar');U.subtabs(s);TOOLS['imar'].init(s);})();