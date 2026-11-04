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
      // Karar haritanın sabitlenmemiş (doğal) yüksekliğine göre verilir; sabitlenince harita büyüdüğü için
      // anlık yükseklikle karşılaştırmak 420↔620 px arasında sonsuz bir aç-kapa döngüsü yaratıyordu.
      if (!mk.classList.contains('harita-sabit') || !mk._dogal) mk._dogal = mk.scrollHeight;
      mk.classList.toggle('harita-sabit', diger > mk._dogal + 80);
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



/* Poligon Hesabı arayüzü */
(window.TOOLS = window.TOOLS || {}).poligon = { init: function (root) {
  'use strict';
  var PG = window.TA.PG, K = window.TA.K, F = window.TA.F, U = window.U, $ = function (s) { return U.$(s, root); };
  U.zipper = U.zipper || function (name, data) { var o = {}; o[name] = typeof data === 'string' ? new TextEncoder().encode(data) : data; return F.zip(o); };
  var st = { mode: 'dayali', r: null, t: null };
  function err(m) { var e = $('#pg-err'); e.textContent = m || ''; e.hidden = !m; }
  function num(id) { var t = String($(id).value || '').trim(); if (!t) return null; var n = K.parseNumber(t); return isFinite(n) ? n : NaN; }
  function unit() { return $('#pg-unit').value; }
  function aci(t) { // → grad
    if (unit() === 'grad') { var g = K.parseNumber(String(t).replace(/\s*(grad|gon|g|ᵍ)\s*$/i, '')); return g; }
    var d = K.parseAngle(t, 'none'); return d * 400 / 360;
  }
  function aciYaz(g) { return unit() === 'grad' ? U.num(g, 4) + 'ᵍ' : K.fmtDMS(g * 360 / 400, null, 1); }
  function cc(g) { return unit() === 'grad' ? U.num(g * 10000, 1) + 'ᶜᶜ' : U.num(g * 360 / 400 * 3600, 1) + '″'; }
  function nokta(p) { var y = num('#pg-' + p + 'y'), x = num('#pg-' + p + 'x'); if (y == null && x == null) return null; if (y == null || x == null || !isFinite(y) || !isFinite(x)) throw new Error(p.toUpperCase() + ' noktasının Y ve X değerlerini girin.'); return { y: y, x: x }; }
  function istasyonlar() {
    var rows = [];
    $('#pg-st').value.split(/\n/).forEach(function (l, k) {
      var t = l.trim(); if (!t) return;
      var p = t.split(/[\s;\t]+/);
      // derecede DMS boşluklu olabilir: "125 30 15" → ad + üç parça; açıyı tırnaklarla yazmak önerilir
      var ad = p[0], b = p[1] != null ? aci(p[1]) : NaN, s = p[2] != null ? K.parseNumber(p[2]) : NaN;
      if (p[1] != null && !isFinite(b)) throw new Error((k + 1) + '. satır: açı okunamadı "' + p[1] + '"');
      if (p[2] != null && !(s > 0)) throw new Error((k + 1) + '. satır: kenar okunamadı "' + p[2] + '"');
      rows.push({ ad: ad, beta: b, s: s });
    });
    return rows;
  }
  function hesapla() {
    err('');
    var r;
    try {
      var A = nokta('a'), B = nokta('b'), C = st.mode === 'dayali' ? nokta('c') : null, D = st.mode === 'dayali' ? nokta('d') : null;
      if (!A || !B) throw new Error('A ve B noktalarının koordinatlarını girin.');
      if (st.mode === 'dayali' && !C) throw new Error('Dayalı geçkide bitiş noktası C gerekli; bilinmiyorsa "Açık" sekmesini kullanın.');
      r = PG.hesapla({ A: A, B: B, C: C, D: D, kapali: st.mode === 'kapali', istasyonlar: istasyonlar(), yon: $('#pg-yon').value, gecki: $('#pg-tur').value });
    } catch (e) { err(e.message); $('#pg-out').innerHTML = ''; $('#pg-exp').hidden = true; st.r = null; return; }
    st.r = r; goster(r);
  }
  function badge(x) { return x == null ? '' : x ? '<span class="badge ok">sınır içinde</span>' : '<span class="badge no">sınır aşıldı</span>'; }
  function goster(r) {
    var h = [], m = function (v) { return U.num(v * 100, 1) + ' cm'; };
    var basari = [r.okB, r.okL, r.okQ].filter(function (x) { return x != null; });
    var durum = !r.koordKontrol ? 'Kontrolsüz (açık poligon)' : basari.every(Boolean) ? 'Kapanmalar sınır içinde' : 'Kapanma sınırı aşıldı';
    h.push('<div class="result-head"><span class="eyebrow">' + durum + '</span><span class="big">' + (r.koordKontrol ? 'f = ' + m(r.f) + (r.aciKontrol ? ' · f<sub>β</sub> = ' + cc(r.fB) : '') : r.n + ' nokta') + '</span><span class="meta">Geçki uzunluğu ' + U.num(r.sumS, 2) + ' m · ' + r.n + ' kırık nokta' + (r.koordKontrol && isFinite(r.oran) ? ' · bağıl kapanma 1/' + U.num(r.oran, 0) : '') + '</span></div>');
    if (r.koordKontrol) {
      var rows = [];
      if (r.aciKontrol) rows.push(['Açı kapanması f<sub>β</sub>', cc(r.fB), cc(r.FB), badge(r.okB)]);
      if (r.fQ != null) rows.push(['Enine hata f<sub>Q</sub>', m(r.fQ), m(r.FQ), badge(r.okQ)]);
      rows.push([(r.kapali ? 'Boyuna hata (kapalı geçki) f<sub>L</sub>' : 'Boyuna hata f<sub>L</sub>'), m(r.fL), m(r.FL), badge(r.okL)]);
      rows.push(['Koordinat kapanması f<sub>y</sub> / f<sub>x</sub>', m(r.fy) + ' / ' + m(r.fx), '', '']);
      h.push('<div class="scroll"><table class="t"><thead><tr><th>Denetim (md. 28/1-d)</th><th class="num">Değer</th><th class="num">Sınır</th><th></th></tr></thead><tbody>' + rows.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="num">' + x[1] + '</td><td class="num">' + x[2] + '</td><td>' + x[3] + '</td></tr>'; }).join('') + '</tbody></table></div>');
    }
    var t = ['<div class="scroll"><table class="t"><thead><tr><th>Nokta</th><th class="num">β (düzeltilmiş)</th><th class="num">Semt t</th><th class="num">Kenar s</th><th class="num">ΔY + v</th><th class="num">ΔX + v</th><th class="num">Y</th><th class="num">X</th></tr></thead><tbody>'];
    r.satirlar.forEach(function (s) {
      t.push('<tr><td class="m">' + U.esc(s.ad) + '</td><td class="num">' + (s.betaD != null ? aciYaz(s.betaD) : '—') + '</td><td class="num">' + (s.t != null ? aciYaz(s.t) : '') + '</td><td class="num">' + (s.s ? U.num(s.s, 3) : '') + '</td>' +
        '<td class="num">' + (s.dy != null ? U.num(s.dy, 3) + '<br><span class="m">' + (s.vy >= 0 ? '+' : '') + U.num(s.vy * 1000, 1) + ' mm</span>' : '') + '</td><td class="num">' + (s.dx != null ? U.num(s.dx, 3) + '<br><span class="m">' + (s.vx >= 0 ? '+' : '') + U.num(s.vx * 1000, 1) + ' mm</span>' : '') + '</td>' +
        '<td class="num"><strong>' + U.num(s.y, 3) + '</strong></td><td class="num"><strong>' + U.num(s.x, 3) + '</strong></td></tr>');
    });
    t.push('</tbody></table></div>'); h.push(t.join(''));
    if (r.aciKontrol) h.push('<p class="hint">Açı başına düzeltme: ' + cc(r.vB) + '. Toplam ΔY = ' + U.num(r.sumDY, 3) + ' m, ΔX = ' + U.num(r.sumDX, 3) + ' m.</p>');
    if (r.notlar.length) h.push('<ul class="im-notes">' + r.notlar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    if (r.uyarilar.length) h.push('<ul class="warnlist">' + r.uyarilar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    $('#pg-out').innerHTML = h.join(''); $('#pg-exp').hidden = false;
  }
  function koordMetni(sep) { return st.r.satirlar.map(function (s) { return [s.ad, s.y.toFixed(3), s.x.toFixed(3)].join(sep); }).join('\r\n'); }
  $('#pg-csv').addEventListener('click', function () { if (st.r) U.download('poligon_koordinatlari.csv', '﻿nokta;Y;X\r\n' + koordMetni(';') + '\r\n'); });
  $('#pg-copy').addEventListener('click', function () { if (st.r) U.copy(koordMetni('\t')); });
  $('#pg-dxf').addEventListener('click', function () {
    if (!st.r) return;
    var feats = [{ type: 'Feature', properties: { katman: 'POLIGON_GECKI', ad: '' }, geometry: { type: 'LineString', coordinates: st.r.satirlar.map(function (s) { return [s.y, s.x]; }) } }];
    st.r.satirlar.forEach(function (s) { feats.push({ type: 'Feature', properties: { katman: 'POLIGON_NOKTA', ad: s.ad }, geometry: { type: 'Point', coordinates: [s.y, s.x] } }); });
    var out = F.write({ type: 'FeatureCollection', features: feats }, 'tm-turef-33', { format: 'dxf', crs: 'tm-turef-33', layerField: 'katman', textField: 'ad', textHeight: Math.max(0.5, st.r.sumS / 400) }, 'poligon');
    U.download(out.name, out.data);
  });
  function sekme() {
    U.$$('[data-pg="son"]', root).forEach(function (e) { e.hidden = st.mode !== 'dayali'; });
    $('#pg-kh').textContent = st.mode === 'kapali' ? 'Kapalı geçki B noktasında başlar ve biter: son satır yeniden B olmalı, oradaki açı son noktadan A\'ya ölçülür.' : st.mode === 'acik' ? 'Açık poligonda bitiş bilinmez; kapanma hesaplanmaz. Son satıra yalnız nokta adı yazılabilir.' : 'D verilmezse yalnız koordinat kapanması denetlenir.';
  }
  var ORNEK = { dayali: null, kapali: 'B   136,0525  148,749\nK1  296,4868  165,400\nK2  283,7967  151,140\nK3  271,7359  143,946\nK4  290,7799  135,812\nB   121,1498', acik: 'B   165,0012  212,424\nP1  259,9992  187,901\nP2' };
  ORNEK.dayali = $('#pg-st').value;
  U.$('.subtabs[data-group="pg"]', root).addEventListener('tabchange', function (e) {
    var eski = st.mode; st.mode = e.detail; if (eski !== st.mode && $('#pg-st').value === ORNEK[eski]) $('#pg-st').value = ORNEK[st.mode];
    sekme(); hesapla();
  });
  $('#pg-unit').addEventListener('change', function () {
    // istasyon açılarını yeni birime çevir
    var eski = $('#pg-unit').value === 'grad' ? 'deg' : 'grad';
    $('#pg-st').value = $('#pg-st').value.split(/\n/).map(function (l) {
      var p = l.trim().split(/[\s;\t]+/); if (p.length < 2 || !p[1]) return l;
      var v = eski === 'grad' ? K.parseNumber(p[1]) : K.parseAngle(p[1], 'none'); if (!isFinite(v)) return l;
      p[1] = eski === 'grad' ? K.fmtDMS(v * 360 / 400, null, 1).replace(/\s+/g, '') : U.num(v * 400 / 360, 4).replace(/\./g, '');
      return p.join('  ');
    }).join('\n');
    hesapla();
  });
  ['#pg-yon', '#pg-tur'].forEach(function (s) { $(s).addEventListener('change', hesapla); });
  root.addEventListener('input', function (e) { if (e.target.matches('input, textarea')) { clearTimeout(st.t); st.t = setTimeout(hesapla, 300); } });
  sekme(); hesapla();
}};

(function(){var s=document.getElementById('t-poligon');U.subtabs(s);TOOLS['poligon'].init(s);})();