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



/* Bina Kotu ve Kademelendirme arayüzü */
(window.TOOLS = window.TOOLS || {}).kot = { init: function (root) {
  'use strict';
  var KT = window.TA.KT, U = window.U, SAYI = window.TA.P.sayi, $ = function (s) { return U.$(s, root); };
  var st = { r: null, t: null };
  function err(m) { var e = $('#kt-err'); e.textContent = m || ''; e.hidden = !m; }
  function liste(id) { var v = $(id).value.split(/[;\n\t ]+/).map(function (x) { return x.trim(); }).filter(Boolean); return v.map(function (x) { var n = SAYI(x); if (!isFinite(n)) throw new Error('Okunamayan kot: "' + x + '"'); return n; }); }
  function satirlar(id, n) {
    var out = [];
    $(id).value.split(/\n/).forEach(function (l, k) {
      var p = l.trim().split(/[\s;\t]+/).filter(Boolean); if (!p.length) return;
      if (p.length < n) throw new Error((k + 1) + '. satır: ' + n + ' değer bekleniyor.');
      var v = p.slice(0, n).map(function (x) { var q = SAYI(x); if (!isFinite(q)) throw new Error((k + 1) + '. satır: okunamayan değer "' + x + '"'); return q; });
      out.push(v);
    });
    return out;
  }
  function m(v) { return U.num(v, 2) + ' m'; }
  function hesapla() {
    err('');
    var tret = $('#kt-tret').checked, kot, kad = null, L, pr, uyar = [];
    try {
      var yol = $('#kt-yol').value.trim() ? liste('#kt-yol') : [], kose = $('#kt-kose').value.trim() ? liste('#kt-kose') : [];
      var onb = SAYI($('#kt-onb').value || '');
      kot = KT.binaKotu({ yolKotlari: yol, koseKotlari: kose, tretuvarVerildi: tret, onBahce: isFinite(onb) ? onb : 0, yeniPlan: $('#kt-yeni').checked, kosebasi: $('#kt-kb').checked });
      L = SAYI($('#kt-L').value || ''); var ham = satirlar('#kt-pr', 2);
      if (ham.length >= 2 && L > 0) {
        pr = ham.map(function (x) { return { s: x[0], h: tret ? x[1] : x[1] + KT.TRETUVAR }; });
        if ($('#kt-mod').value === 'oner') { var o = KT.kademeOner(pr, L); kad = o.kademeler; uyar = o.uyarilar; }
        else kad = KT.kademeDenetle(pr, satirlar('#kt-kd', 3).map(function (x) { return { bas: x[0], son: x[1], kot: x[2] }; }));
      }
      var arka = $('#kt-arka').value.trim() ? liste('#kt-arka') : [];
      if (arka.length && kot.yolEnDusuk != null) { var dk = KT.derinlikKademesi(kot.yolEnDusuk, arka); kot.derinlik = dk; }
    } catch (e) { err(e.message); $('#kt-out').innerHTML = ''; $('#kt-svg').innerHTML = ''; $('#kt-exp').hidden = true; st.r = null; return; }
    st.r = { kot: kot, kad: kad, pr: pr, L: L };
    goster(kot, kad, uyar); ciz();
  }
  function goster(kot, kad, uyar) {
    var h = [], ad = { yoldan: 'Yoldan kotlandırma', tabii: 'Tabii zeminden kotlandırma', md529: 'Yoldan düşük parsel (md. 5/29)' }[kot.yontem];
    h.push('<div class="result-head"><span class="eyebrow">' + ad + '</span><span class="big">±0.00 = ' + U.num(kot.kot, 2) + ' m</span><span class="meta">' + (kot.yoldan != null ? 'En yüksek tretuvar ' + U.num(kot.yoldan, 2) + ' m' : '') + (kot.tabii != null ? ' · köşe ortalaması ' + U.num(kot.tabii, 2) + ' m' : '') + (kad ? ' · ' + kad.length + ' kademe' : '') + '</span></div>');
    if (kad) {
      h.push('<div class="scroll"><table class="t"><thead><tr><th>Kademe</th><th class="num">Cephe aralığı</th><th class="num">Uzunluk</th><th class="num">±0.00</th><th class="num">En düşük tretuvar</th><th class="num">Fark</th><th></th></tr></thead><tbody>' +
        kad.map(function (k, i) {
          var okH = k.uygun != null ? k.uygun : k.uygunYukseklik, okL = k.uygunUzunluk != null ? k.uygunUzunluk : true;
          var b = k.birlesti ? '<span class="badge">son parça birleşti</span>' : okH && okL ? '<span class="badge ok">uygun</span>' : '<span class="badge no">' + (!okH ? '3,50 m aşıldı' : '4,50 m altında') + '</span>';
          return '<tr><td class="m">' + (i + 1) + '</td><td class="num">' + U.num(k.bas, 2) + '–' + U.num(k.son, 2) + '</td><td class="num">' + m(k.uzunluk) + '</td><td class="num"><strong>' + U.num(k.kot, 2) + '</strong></td><td class="num">' + U.num(k.enDusuk, 2) + '</td><td class="num">' + m(k.fark) + '</td><td>' + b + '</td></tr>';
        }).join('') + '</tbody></table></div>');
    }
    var notlar = kot.notlar.slice();
    if (kot.derinlik) notlar.push('Arka köşeler en düşük yol kotundan ' + U.num(kot.derinlik.fark, 2) + ' m ' + (kot.derinlik.fark >= 0 ? 'aşağıda' : 'yukarıda') + ': ' + (kot.derinlik.gerekli ? 'bina derinliği boyunca da kademelendirme gerekir (md. 11/7).' : 'derinlik boyunca kademe gerekmez (md. 11/7).'));
    if (kad && kad.some(function (k) { return k.birlesti; })) notlar.push('Son kademe 4,50 m\'den kısa kaldığı için bir önceki kademe seviyesine uyuldu (md. 11/6); bu parçada fark 3,50 m\'yi geçebilir.');
    h.push('<ul class="im-notes">' + notlar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    var u = kot.uyarilar.concat(uyar);
    if (u.length) h.push('<ul class="warnlist">' + u.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    $('#kt-out').innerHTML = h.join(''); $('#kt-exp').hidden = !kad;
  }
  function ciz() {
    var r = st.r, svg = $('#kt-svg'); if (!r.kad || !r.pr) { svg.innerHTML = ''; return; }
    var W = 400, H = 220, pl = 46, pr = 12, pt = 14, pb = 26;
    var hs = r.pr.map(function (p) { return p.h; }).concat(r.kad.map(function (k) { return k.kot; }), r.kad.map(function (k) { return k.enDusuk + 3.5; }));
    var y0 = Math.min.apply(null, hs) - 0.5, y1 = Math.max.apply(null, hs) + 0.5, x0 = Math.min(0, r.pr[0].s), x1 = Math.max(r.L, r.pr[r.pr.length - 1].s);
    var X = function (s) { return (pl + (s - x0) / (x1 - x0) * (W - pl - pr)).toFixed(1); }, Y = function (z) { return (H - pb - (z - y0) / (y1 - y0) * (H - pt - pb)).toFixed(1); };
    var P = KT.profil(r.pr), h = [];
    r.kad.forEach(function (k) { h.push('<rect x="' + X(k.bas) + '" y="' + Y(k.enDusuk + 3.5) + '" width="' + (X(k.son) - X(k.bas)).toFixed(1) + '" height="' + (Y(k.enDusuk) - Y(k.enDusuk + 3.5)).toFixed(1) + '" fill="var(--soft)" stroke="var(--rule)"/>'); });
    var pts = []; for (var i = 0; i <= 80; i++) { var s = x0 + (x1 - x0) * i / 80; pts.push(X(s) + ',' + Y(P.h(s))); }
    h.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--text)" stroke-width="2"/>');
    r.kad.forEach(function (k, i) { h.push('<line x1="' + X(k.bas) + '" x2="' + X(k.son) + '" y1="' + Y(k.kot) + '" y2="' + Y(k.kot) + '" stroke="var(--amber)" stroke-width="4"/><text class="svg-text" x="' + ((+X(k.bas) + +X(k.son)) / 2).toFixed(1) + '" y="' + (Y(k.kot) - 6) + '" text-anchor="middle">' + U.num(k.kot, 2) + '</text>'); if (i) h.push('<line x1="' + X(k.bas) + '" x2="' + X(k.bas) + '" y1="' + Y(r.kad[i - 1].kot) + '" y2="' + Y(k.kot) + '" stroke="var(--amber-text)" stroke-width="1.5"/>'); });
    h.push('<line x1="' + X(0) + '" x2="' + X(r.L) + '" y1="' + (H - pb + 8) + '" y2="' + (H - pb + 8) + '" stroke="var(--muted)"/><text class="svg-text" x="' + X(0) + '" y="' + (H - 4) + '">0</text><text class="svg-text" x="' + X(r.L) + '" y="' + (H - 4) + '" text-anchor="end">' + U.num(r.L, 1) + ' m</text>');
    h.push('<text class="svg-text" x="4" y="' + Y(y1 - 0.5) + '">' + U.num(y1 - 0.5, 1) + '</text><text class="svg-text" x="4" y="' + Y(y0 + 0.5) + '">' + U.num(y0 + 0.5, 1) + '</text>');
    svg.innerHTML = h.join('');
  }
  $('#kt-csv').addEventListener('click', function () {
    var r = st.r; if (!r || !r.kad) return;
    var rows = [['kademe', 'baslangic_m', 'bitis_m', 'uzunluk_m', 'kot_m', 'en_dusuk_tretuvar_m', 'fark_m']].concat(r.kad.map(function (k, i) { return [i + 1, k.bas.toFixed(2), k.son.toFixed(2), k.uzunluk.toFixed(2), k.kot.toFixed(3), k.enDusuk.toFixed(3), k.fark.toFixed(3)]; }));
    rows.push(['bina_kotu', '', '', '', r.kot.kot.toFixed(3), '', r.kot.yontem]);
    U.download('kot_kademe.csv', U.csvRapor(rows));
  });
  $('#kt-mod').addEventListener('change', function () { $('#kt-kdw').hidden = $('#kt-mod').value !== 'denetle'; hesapla(); });
  ['#kt-tret', '#kt-kb', '#kt-yeni'].forEach(function (s) { $(s).addEventListener('change', hesapla); });
  root.addEventListener('input', function (e) { if (e.target.matches('input:not([type=checkbox]), textarea')) { clearTimeout(st.t); st.t = setTimeout(hesapla, 300); } });
  hesapla();
}};

(function(){var s=document.getElementById('t-kot');U.subtabs(s);TOOLS['kot'].init(s);})();