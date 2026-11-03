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



/* Donatı Alanı Standartları arayüzü */
(window.TOOLS = window.TOOLS || {}).donati = { init: function (root) {
  'use strict';
  var D = window.TA.D, K = window.TA.K, U = window.U, SAYI = window.TA.P.sayi, $ = function (s) { return U.$(s, root); };
  var st = { sonuc: null, t: null };
  function err(m) { var e = $('#dn-err'); e.textContent = m || ''; e.hidden = !m; }
  function num(v) { var t = String(v == null ? '' : v).trim(); if (!t) return null; var n = SAYI(t); return isFinite(n) ? n : NaN; }
  function m2(v) { return U.num(v, 0) + ' m²'; }

  $('#dn-in').innerHTML = '<div class="row r2">' + D.KALEMLER.map(function (k) {
    return '<label class="f"' + (k.ilButunu ? ' data-il hidden' : '') + '>' + U.esc(k.id === 'yesil' ? 'Açık ve yeşil alanlar (ilçe)' : k.id === 'yesilIl' ? 'Açık ve yeşil alanlar (il bütünü)' : k.ad) + ' (m²)<input data-s="' + k.id + '" inputmode="decimal" placeholder="—"></label>';
  }).join('') + '</div>';

  function hesapla() {
    err('');
    var N = num($('#dn-n').value), il = num($('#dn-ilce').value), dop = num($('#dn-dop').value);
    if (N == null || !(N > 0)) { err('Plan nüfusunu kişi olarak girin.'); temizle(); return; }
    if (il != null && !(il >= 0)) { err('İlçe nüfusu sayı olmalı.'); return; }
    var sag = {}, bad = null;
    U.$$('#dn-in input', root).forEach(function (i) { var v = num(i.value); if (v == null) return; if (!(v >= 0)) bad = 'Ayrılan alanlar m² cinsinden sayı olmalı.'; else sag[i.getAttribute('data-s')] = v; });
    if (bad) { err(bad); return; }
    if (dop != null && !(dop >= 0)) { err('DOP\'a tabi yeşil alan sayı olmalı.'); return; }
    var r;
    try { r = D.hesapla({ planNufus: N, ilceNufus: il, ilButunu: $('#dn-il').checked, saglanan: sag, yesilKamuDop: dop }); } catch (e) { err(e.message); return; }
    st.sonuc = r; goster(r);
  }
  function temizle() { $('#dn-out').innerHTML = ''; $('#dn-exp').hidden = true; st.sonuc = null; }
  function goster(r) {
    var h = [], anySag = r.satirlar.some(function (x) { return x.saglanan != null; });
    h.push('<div class="result-head"><span class="eyebrow">Nüfus grubu ' + U.esc(r.grupAd) + '</span><span class="big">' + m2(r.toplamGereken) + '</span><span class="meta">' + U.num(r.planNufus, 0) + ' kişi × ' + U.num(r.toplamStd, 2) + ' m²/kişi · ' + U.num(r.toplamGereken / 10000, 2) + ' ha asgari donatı alanı</span></div>');
    h.push('<div class="scroll"><table class="t"><thead><tr><th>Donatı</th><th class="num">m²/kişi</th><th class="num">Gereken</th>' + (anySag ? '<th class="num">Ayrılan</th><th class="num">Fark</th><th></th>' : '') + '</tr></thead><tbody>');
    r.satirlar.forEach(function (x) {
      var alt = '';
      h.push('<tr><td title="' + U.esc(x.ad) + '">' + U.esc(x.kisa) + alt + '</td><td class="num">' + U.num(x.std, 2) + '</td><td class="num">' + m2(x.gereken) + '</td>' +
        (anySag ? (x.saglanan == null ? '<td class="num">—</td><td></td><td></td>' : '<td class="num">' + m2(x.saglanan) + '<br><span class="m">' + U.num(x.kisiBasi, 2) + ' m²/kişi</span></td><td class="num">' + (x.fark >= 0 ? '+' : '') + U.num(x.fark, 0) + '</td><td class="dn-uyg">' + (x.uygun ? '<span class="badge ok">yeterli</span>' : '<span class="badge no">eksik</span>') + '</td>') : '') + '</tr>');
    });
    h.push('<tr class="hl"><td><strong>Toplam</strong></td><td class="num"><strong>' + U.num(r.toplamStd, 2) + '</strong></td><td class="num"><strong>' + m2(r.toplamGereken) + '</strong></td>' +
      (anySag ? '<td class="num">' + (r.toplamSaglanan != null ? m2(r.toplamSaglanan) : '—') + '</td><td class="num">' + (r.toplamSaglanan != null ? (r.toplamSaglanan - r.toplamGereken >= 0 ? '+' : '') + U.num(r.toplamSaglanan - r.toplamGereken, 0) : '') + '</td><td></td>' : '') + '</tr></tbody></table></div>');
    var y = '<tr><td>DOP\'a tabi kamusal çocuk bahçesi, oyun alanı, park, meydan, semt spor alanı — en az %75</td><td class="num">' + m2(r.yesilKamuEnAz) + '</td>' +
      (r.yesilKamuDop != null ? '<td class="num">' + m2(r.yesilKamuDop) + '</td><td>' + (r.yesilKamuUygun ? '<span class="badge ok">yeterli</span>' : '<span class="badge no">eksik</span>') + '</td>' : '<td></td><td></td>') + '<td class="m">açıklama 9</td></tr>';
    h.push('<div class="scroll"><table class="t"><tbody>' + y + '</tbody></table></div>');
    var bh = []; r.satirlar.forEach(function (x) { x.birimler.forEach(function (b, i) { bh.push('<tr><td>' + (i ? '' : U.esc(x.ad)) + '</td><td>' + U.esc(b.ad) + '</td><td class="num">' + U.esc(b.alan) + ' m²</td></tr>'); }); });
    h.push('<details class="im-adv"><summary>Tesis başına asgari birim alanlar (EK-2, ' + U.esc(r.grupAd) + ')</summary><div class="scroll" style="margin-top:10px"><table class="t"><thead><tr><th>Donatı</th><th>Tesis</th><th class="num">Asgari birim alan</th></tr></thead><tbody>' + bh.join('') + '</tbody></table></div></details>');
    var notlar = r.notlar.slice(); r.satirlar.forEach(function (x) { if (x.not) notlar.push(x.not); });
    if (notlar.length) h.push('<ul class="im-notes">' + notlar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    if (r.uyarilar.length) h.push('<ul class="warnlist">' + r.uyarilar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    $('#dn-out').innerHTML = h.join(''); $('#dn-exp').hidden = false;
  }
  $('#dn-yogbtn').addEventListener('click', function () {
    var rows = [], bad = null;
    $('#dn-yog').value.split(/\n/).forEach(function (l) {
      var t = l.trim(); if (!t) return; var p = t.split(/[\s;\t]+/);
      var a = SAYI(p[0]), d = SAYI(p[1]);
      if (p.length < 2 || !(a > 0) || !(d >= 0)) bad = 'Okunamayan satır: "' + t + '"'; else rows.push({ alan: a, yogunluk: d });
    });
    if (bad) { err(bad); return; }
    if (!rows.length) { err('Alan (ha) ve yoğunluk (kişi/ha) satırları girin.'); return; }
    var n = Math.round(D.nufus(rows));
    $('#dn-n').value = U.num(n, 0); $('#dn-yogout').textContent = rows.length + ' bölge, ' + U.num(n, 0) + ' kişi'; hesapla();
  });
  $('#dn-csv').addEventListener('click', function () {
    var r = st.sonuc; if (!r) return;
    var rows = [['donati', 'm2_kisi', 'gereken_m2', 'ayrilan_m2', 'fark_m2']];
    r.satirlar.forEach(function (x) { rows.push([x.ad, x.std, x.gereken.toFixed(2), x.saglanan == null ? '' : x.saglanan.toFixed(2), x.fark == null ? '' : x.fark.toFixed(2)]); });
    rows.push(['TOPLAM', r.toplamStd, r.toplamGereken.toFixed(2), r.toplamSaglanan == null ? '' : r.toplamSaglanan.toFixed(2), '']);
    rows.push(['nufus_grubu: ' + r.grupAd, '', '', '', ''], ['plan_nufusu', r.planNufus, '', '', '']);
    U.download('donati_alanlari.csv', U.csvRapor(rows));
  });
  $('#dn-il').addEventListener('change', function () { U.$$('[data-il]', root).forEach(function (e) { e.hidden = !$('#dn-il').checked; }); hesapla(); });
  root.addEventListener('input', function (e) { if (e.target.closest('#dn-yog')) return; if (e.target.matches('input:not([type=checkbox])')) { clearTimeout(st.t); st.t = setTimeout(hesapla, 250); } });
  hesapla();
}};

(function(){var s=document.getElementById('t-donati');U.subtabs(s);TOOLS['donati'].init(s);})();