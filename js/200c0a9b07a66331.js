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



/* Ortak Noktalarla Dönüşüm arayüzü */
(window.TOOLS = window.TOOLS || {}).ortaknokta = { init: function (root) {
  'use strict';
  var DN = window.TA.DN, K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var st = { r: null, d: null, t: null };
  function err(m) { var e = $('#on-err'); e.textContent = m || ''; e.hidden = !m; }
  function oku(id, n) {
    var out = [];
    $(id).value.split(/\n/).forEach(function (l, k) {
      var t = l.trim(); if (!t || t[0] === '#') return;
      var p = t.split(/[\s;\t]+/);
      if (p.length < n + 1) throw new Error((k + 1) + '. satır: ad ve ' + n + ' koordinat bekleniyor.');
      var v = p.slice(1, n + 1).map(function (s) { var x = K.parseNumber(s); if (!isFinite(x)) throw new Error((k + 1) + '. satır: okunamayan değer "' + s + '"'); return x; });
      out.push(n === 4 ? { ad: p[0], y: v[0], x: v[1], Y: v[2], X: v[3] } : { ad: p[0], y: v[0], x: v[1] });
    });
    return out;
  }
  function hesapla() {
    err(''); var r, d;
    try { r = DN.kestir(oku('#on-o', 4), $('#on-tur').value); d = oku('#on-d', 2).map(function (q) { var t = r.donustur(q); return { ad: q.ad, y: q.y, x: q.x, Y: t.y, X: t.x }; }); }
    catch (e) { err(e.message); $('#on-out').innerHTML = ''; $('#on-exp').hidden = true; st.r = null; return; }
    st.r = r; st.d = d;
    var h = [], mm = function (v) { return U.num(v * 1000, 1) + ' mm'; };
    var par = r.tur === 'helmert'
      ? 'Ölçek ' + U.num(r.olcek, 7) + ' (' + (r.olcek >= 1 ? '+' : '') + U.num((r.olcek - 1) * 1e6, 1) + ' ppm) · dönüklük ' + U.num(-r.donukluk * 200 / Math.PI, 5) + 'ᵍ'
      : 'Ölçek Y ' + U.num(r.olcekY, 6) + ' · X ' + U.num(r.olcekX, 6);
    h.push('<div class="result-head"><span class="eyebrow">' + (r.tur === 'helmert' ? 'Helmert dönüşümü' : 'Afin dönüşüm') + ' · ' + r.artiklar.length + ' ortak nokta</span><span class="big">m₀ = ' + (r.m0 != null ? '±' + mm(r.m0) : '— (fazla nokta yok)') + '</span><span class="meta">' + par + '</span></div>');
    var enb = r.artiklar.reduce(function (a, v) { return Math.max(a, v.v); }, 0);
    h.push('<div class="scroll"><table class="t"><thead><tr><th>Ortak nokta</th><th class="num">v<sub>Y</sub></th><th class="num">v<sub>X</sub></th><th class="num">|v|</th></tr></thead><tbody>' + r.artiklar.map(function (v) {
      var buyuk = r.m0 != null && r.artiklar.length > 3 && v.v > 3 * r.m0 && v.v === enb;
      return '<tr' + (buyuk ? ' class="hl"' : '') + '><td class="m">' + U.esc(v.ad) + '</td><td class="num">' + mm(v.vy) + '</td><td class="num">' + mm(v.vx) + '</td><td class="num">' + mm(v.v) + (buyuk ? ' <span class="badge no">kontrol edin</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>');
    if (d.length) h.push('<div class="scroll"><table class="t"><thead><tr><th>Nokta</th><th class="num">y</th><th class="num">x</th><th class="num">Y</th><th class="num">X</th></tr></thead><tbody>' + d.map(function (q) { return '<tr><td class="m">' + U.esc(q.ad) + '</td><td class="num">' + U.num(q.y, 3) + '</td><td class="num">' + U.num(q.x, 3) + '</td><td class="num"><strong>' + U.num(q.Y, 3) + '</strong></td><td class="num"><strong>' + U.num(q.X, 3) + '</strong></td></tr>'; }).join('') + '</tbody></table></div>');
    var p = r.tur === 'helmert' ? 'Y′ = ' + U.plain(r.a, 4) + ' + ' + U.plain(r.p, 10) + '·y − ' + U.plain(r.q, 10) + '·x\nX′ = ' + U.plain(r.b, 4) + ' + ' + U.plain(r.q, 10) + '·y + ' + U.plain(r.p, 10) + '·x'
      : 'Y′ = ' + U.plain(r.a1, 4) + ' + ' + U.plain(r.a2, 10) + '·y + ' + U.plain(r.a3, 10) + '·x\nX′ = ' + U.plain(r.b1, 4) + ' + ' + U.plain(r.b2, 10) + '·y + ' + U.plain(r.b3, 10) + '·x';
    h.push('<div class="formula">' + U.esc(p) + '</div>');
    $('#on-out').innerHTML = h.join(''); $('#on-exp').hidden = !d.length;
  }
  function metin(sep) { return st.d.map(function (q) { return [q.ad, q.Y.toFixed(3), q.X.toFixed(3)].join(sep); }).join('\r\n'); }
  $('#on-csv').addEventListener('click', function () { if (st.d) U.download('donusturulen_noktalar.csv', '﻿nokta;Y;X\r\n' + metin(';') + '\r\n'); });
  $('#on-copy').addEventListener('click', function () { if (st.d) U.copy(metin('\t')); });
  $('#on-tur').addEventListener('change', hesapla);
  root.addEventListener('input', function (e) { if (e.target.matches('textarea')) { clearTimeout(st.t); st.t = setTimeout(hesapla, 300); } });
  hesapla();
}};

(function(){var s=document.getElementById('t-ortaknokta');U.subtabs(s);TOOLS['ortaknokta'].init(s);})();