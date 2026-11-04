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



/* Nivelman Hesabı arayüzü */
(window.TOOLS = window.TOOLS || {}).nivelman = { init: function (root) {
  'use strict';
  var NV = window.TA.NV, K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var st = { r: null, t: null };
  function err(m) { var e = $('#nv-err'); e.textContent = m || ''; e.hidden = !m; }
  function num(id) { var t = String($(id).value || '').trim(); if (!t) return null; var n = K.parseNumber(t); return isFinite(n) ? n : NaN; }
  function v3(x) { return isFinite(x) ? U.num(x, 3) : ''; }
  function hesapla() {
    err('');
    var r, h1 = num('#nv-h1'), h2 = num('#nv-h2');
    try {
      if (h1 == null || !isFinite(h1)) throw new Error('Başlangıç kotunu girin.');
      if (h2 != null && !isFinite(h2)) throw new Error('Bitiş kotu sayı olmalı.');
      r = NV.hesapla({ satirlar: NV.defterOku($('#nv-d').value, K.parseNumber), Hilk: h1, Hson: h2 == null ? NaN : h2, sinif: $('#nv-sinif').value });
    } catch (e) { err(e.message); $('#nv-out').innerHTML = ''; $('#nv-exp').hidden = true; st.r = null; gidisDonus(); return; }
    st.r = r; goster(r); gidisDonus();
  }
  function goster(r) {
    var h = [], sinif = $('#nv-sinif').value, sinir = r.sinirLup ? r.sinirLup[sinif] : null;
    var durum = sinir == null ? (r.lup ? 'Lup' : 'Bağlı geçki') : r.ok ? 'Kapanma sınır içinde' : 'Kapanma sınırı aşıldı';
    h.push('<div class="result-head"><span class="eyebrow">' + durum + '</span><span class="big">f = ' + (r.f >= 0 ? '+' : '') + U.num(r.f * 1000, 1) + ' mm</span><span class="meta">' + r.kurulum + ' kurulum' + (r.S != null ? ' · ' + U.num(r.S, 1) + ' m' : '') + ' · Σ(g − i) = ' + U.num(r.sumDh, 4) + ' m' + (sinir != null ? ' · md. 39 sınırı ' + U.num(sinir, 1) + ' mm' : '') + '</span></div>');
    var t = ['<div class="scroll"><table class="t"><thead><tr><th>Nokta</th><th class="num">Geri</th><th class="num">Ara</th><th class="num">İleri</th><th class="num">Mesafe</th><th class="num">Düzeltme</th><th class="num">Kot H</th></tr></thead><tbody>'];
    var vMap = {}; r.kurulumlar.forEach(function (c) { vMap[c.ileri] = c.v; c.ara.forEach(function (j) { vMap[j] = c.v; }); });
    r.satirlar.forEach(function (s, j) {
      t.push('<tr><td class="m">' + U.esc(s.ad) + '</td><td class="num">' + v3(s.g) + '</td><td class="num">' + v3(s.a) + '</td><td class="num">' + v3(s.i) + '</td><td class="num">' + (isFinite(s.s) ? U.num(s.s, 1) : '') + '</td><td class="num">' + (vMap[j] != null ? (vMap[j] >= 0 ? '+' : '') + U.num(vMap[j] * 1000, 1) + ' mm' : '') + '</td><td class="num"><strong>' + U.num(s.H, 3) + '</strong></td></tr>');
    });
    t.push('</tbody></table></div>'); h.push(t.join(''));
    if (r.notlar.length) h.push('<ul class="im-notes">' + r.notlar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    $('#nv-out').innerHTML = h.join(''); $('#nv-exp').hidden = false;
  }
  function gidisDonus() {
    var g = num('#nv-g'), d = num('#nv-dn'), s = num('#nv-s'), box = $('#nv-gd');
    if (g == null || d == null || s == null) { box.innerHTML = '<p class="hint">Gidiş ve dönüş yükseklik farklarını (işaretleriyle) ve yol uzunluğunu girin. Yardımcı nivelmanda ΔH için yukarıdaki defter kullanılır.</p>'; return; }
    if (!isFinite(g) || !isFinite(d) || !(s > 0)) { box.innerHTML = '<p class="err">Değerler sayı olmalı.</p>'; return; }
    var r = NV.gidisDonus({ gidis: g, donus: d, S: s, sinif: $('#nv-sinif').value, sumAbs: st.r ? st.r.sumAbs : 0 });
    box.innerHTML = '<div class="scroll"><table class="t"><tbody><tr><td>Kapanma değeri w = Δh<sub>gidiş</sub> + Δh<sub>dönüş</sub></td><td class="num">' + U.num(r.w, 1) + ' mm</td></tr><tr><td>Sınır (md. 38, ' + U.esc($('#nv-sinif').selectedOptions[0].textContent.toLowerCase()) + ')</td><td class="num">' + U.num(r.sinir, 1) + ' mm ' + (r.ok ? '<span class="badge ok">sınır içinde</span>' : '<span class="badge no">sınır aşıldı</span>') + '</td></tr><tr><td>Ortalama yükseklik farkı</td><td class="num">' + U.num(r.ortalama, 4) + ' m</td></tr></tbody></table></div>';
  }
  function metin(sep) { return st.r.satirlar.map(function (s) { return [s.ad, s.H.toFixed(3)].join(sep); }).join('\r\n'); }
  $('#nv-csv').addEventListener('click', function () { if (st.r) U.download('nivelman_kotlari.csv', '﻿nokta;H\r\n' + metin(';') + '\r\n'); });
  $('#nv-copy').addEventListener('click', function () { if (st.r) U.copy(metin('\t')); });
  $('#nv-sinif').addEventListener('change', hesapla);
  root.addEventListener('input', function (e) { if (e.target.matches('input, textarea')) { clearTimeout(st.t); st.t = setTimeout(hesapla, 300); } });
  hesapla();
}};

(function(){var s=document.getElementById('t-nivelman');U.subtabs(s);TOOLS['nivelman'].init(s);})();