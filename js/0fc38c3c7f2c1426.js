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



/* Geriden Kestirme ve Aplikasyon arayüzü */
(window.TOOLS = window.TOOLS || {}).kestirme = { init: function (root) {
  'use strict';
  var KS = window.TA.KS, K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var st = { mode: 'geri', tablo: null, t: null };
  function unit() { return $('#ks-unit').value; }
  function aci(t) { if (unit() === 'grad') return K.parseNumber(String(t).replace(/\s*(grad|gon|g|ᵍ)\s*$/i, '')); var d = K.parseAngle(t, 'none'); return d * 400 / 360; }
  function aciYaz(g) { return unit() === 'grad' ? U.num(g, 4) + 'ᵍ' : K.fmtDMS(g * 360 / 400, null, 1); }
  function kucuk(g) { return unit() === 'grad' ? U.num(g * 10000, 1) + 'ᶜᶜ' : U.num(g * 360 / 400 * 3600, 1) + '″'; }
  function n(id) { var v = K.parseNumber(String($(id).value || '').trim()); if (!isFinite(v)) throw new Error('Koordinat ve açı alanlarına sayı girin.'); return v; }
  function satirlar(id, alanlar) { // alanlar: ['y','x','r'] vb.
    var out = [];
    $(id).value.split(/\n/).forEach(function (l, k) {
      var p = l.trim().split(/[\s;\t]+/); if (!p[0]) return;
      if (p.length < alanlar.length + 1) throw new Error((k + 1) + '. satır: ad ve ' + alanlar.length + ' değer bekleniyor.');
      var o = { ad: p[0] };
      alanlar.forEach(function (a, i) { var v = a === 'r' ? aci(p[i + 1]) : K.parseNumber(p[i + 1]); if (!isFinite(v)) throw new Error((k + 1) + '. satır: okunamayan değer "' + p[i + 1] + '"'); o[a] = v; });
      out.push(o);
    });
    return out;
  }
  function hata(id, m) { var e = $(id); e.textContent = m || ''; e.hidden = !m; }
  function tablo(bas, rows) { return '<div class="scroll"><table class="t"><thead><tr>' + bas.map(function (b, i) { return '<th' + (i ? ' class="num"' : '') + '>' + b + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="num"' : ' class="m"') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }

  function geri() {
    hata('#ks-gerr', ''); var r, pts;
    try { pts = satirlar('#ks-g', ['y', 'x', 'r']); r = KS.geriden(pts); } catch (e) { hata('#ks-gerr', e.message); $('#ks-gout').innerHTML = ''; st.tablo = null; return; }
    var h = ['<div class="result-head"><span class="eyebrow">Durulan nokta' + (r.serbestlik ? ' · ' + pts.length + ' nokta, ' + r.serbestlik + ' fazla ölçü' : ' · fazla ölçü yok') + '</span><span class="big">Y ' + U.num(r.P.y, 3) + ' · X ' + U.num(r.P.x, 3) + '</span><span class="meta">Yöneltme bilinmeyeni z = ' + aciYaz(r.z) + (r.m0 != null ? ' · m₀ = ±' + kucuk(r.m0) : '') + (r.konum ? ' · konum ±' + U.num(r.konum.mp * 1000, 1) + ' mm' : '') + '</span></div>'];
    h.push(tablo(['Nokta', 'Semt t', 'Kenar s', 'Düzeltme v'], pts.map(function (p, i) { return [U.esc(p.ad), aciYaz(KS.semt(r.P, p)), U.num(Math.hypot(p.y - r.P.y, p.x - r.P.x), 3) + ' m', kucuk(r.artiklar[i])]; })));
    if (r.konum) h.push('<p class="hint">Koordinat ortalama hataları: m<sub>Y</sub> = ±' + U.num(r.konum.my * 1000, 1) + ' mm, m<sub>X</sub> = ±' + U.num(r.konum.mx * 1000, 1) + ' mm (eşit ağırlıklı doğrultular).</p>');
    if (!r.serbestlik) h.push('<p class="hint">Üç noktayla çözümde denetim yoktur; dördüncü bir noktaya da bakarak sonucu sınayın.</p>');
    if (r.uyarilar.length) h.push('<ul class="warnlist">' + r.uyarilar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    $('#ks-gout').innerHTML = h.join('');
    st.tablo = [['nokta', 'Y', 'X'], ['P', r.P.y.toFixed(3), r.P.x.toFixed(3)]];
  }
  function kut() {
    hata('#ks-kerr', ''); var r;
    try { var S = { y: n('#ks-ky'), x: n('#ks-kx') }; r = KS.kutupsal(S, satirlar('#ks-kb', ['y', 'x', 'r']), satirlar('#ks-ka', ['r', 's'])); } catch (e) { hata('#ks-kerr', e.message); $('#ks-kout').innerHTML = ''; st.tablo = null; return; }
    var h = ['<div class="result-head"><span class="eyebrow">Kutupsal alım · ' + r.noktalar.length + ' nokta</span><span class="big">z = ' + aciYaz(r.z) + '</span><span class="meta">Yöneltme artıkları: ' + r.yoneltmeArtik.map(kucuk).join(', ') + '</span></div>'];
    h.push(tablo(['Nokta', 'Semt t', 'Mesafe', 'Y', 'X'], r.noktalar.map(function (p) { return [U.esc(p.ad), aciYaz(p.t), U.num(p.s, 3), '<strong>' + U.num(p.y, 3) + '</strong>', '<strong>' + U.num(p.x, 3) + '</strong>']; })));
    $('#ks-kout').innerHTML = h.join('');
    st.tablo = [['nokta', 'Y', 'X']].concat(r.noktalar.map(function (p) { return [p.ad, p.y.toFixed(3), p.x.toFixed(3)]; }));
  }
  function apl() {
    hata('#ks-aerr', ''); var r;
    try { var S = { y: n('#ks-ay'), x: n('#ks-ax') }, B = { y: n('#ks-by'), x: n('#ks-bx') }; var rb = aci($('#ks-br').value || '0'); if (!isFinite(rb)) throw new Error('Bakışta okunan değeri girin.'); r = KS.aplikasyon(S, B, rb, satirlar('#ks-ah', ['y', 'x'])); } catch (e) { hata('#ks-aerr', e.message); $('#ks-aout').innerHTML = ''; st.tablo = null; return; }
    var h = ['<div class="result-head"><span class="eyebrow">Aplikasyon ölçüleri</span><span class="big">' + r.length + ' nokta</span><span class="meta">Alet bakış noktasına ' + aciYaz(aci($('#ks-br').value || '0')) + ' okunarak yöneltilmiş kabul edilir.</span></div>'];
    h.push(tablo(['Nokta', 'Okunacak doğrultu', 'Yatay mesafe', 'Semt t'], r.map(function (p) { return [U.esc(p.ad), '<strong>' + aciYaz(p.r) + '</strong>', '<strong>' + U.num(p.s, 3) + ' m</strong>', aciYaz(p.t)]; })));
    $('#ks-aout').innerHTML = h.join('');
    st.tablo = [['nokta', 'dogrultu_' + unit(), 'mesafe_m']].concat(r.map(function (p) { return [p.ad, unit() === 'grad' ? p.r.toFixed(4) : (p.r * 0.9).toFixed(6), p.s.toFixed(3)]; }));
  }
  function hesapla() { if (st.mode === 'geri') geri(); else if (st.mode === 'kut') kut(); else apl(); }
  $('#ks-csv').addEventListener('click', function () { if (st.tablo) U.download('kestirme_' + st.mode + '.csv', U.csvRapor(st.tablo)); });
  $('#ks-copy').addEventListener('click', function () { if (st.tablo) U.copy(st.tablo.map(function (r) { return r.join('\t'); }).join('\n')); });
  U.$('.subtabs[data-group="ks"]', root).addEventListener('tabchange', function (e) { st.mode = e.detail; hesapla(); });
  $('#ks-unit').addEventListener('change', function () {
    var eski = unit() === 'grad' ? 'deg' : 'grad';
    function cev(v) { var g = eski === 'grad' ? K.parseNumber(v) : K.parseAngle(v, 'none') * 400 / 360; if (!isFinite(g)) return v; return unit() === 'grad' ? U.num(g, 4).replace(/\./g, '') : K.fmtDMS(g * 360 / 400, null, 1).replace(/\s+/g, ''); }
    [['#ks-g', 3], ['#ks-kb', 3], ['#ks-ka', 1]].forEach(function (a) { $(a[0]).value = $(a[0]).value.split(/\n/).map(function (l) { var p = l.trim().split(/[\s;\t]+/); if (p.length > a[1]) p[a[1]] = cev(p[a[1]]); return p.join('  '); }).join('\n'); });
    $('#ks-br').value = cev($('#ks-br').value || '0');
    hesapla();
  });
  root.addEventListener('input', function (e) { if (e.target.matches('input, textarea')) { clearTimeout(st.t); st.t = setTimeout(hesapla, 300); } });
  hesapla();
}};

(function(){var s=document.getElementById('t-kestirme');U.subtabs(s);TOOLS['kestirme'].init(s);})();