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



/* Yapı Yaklaşık Maliyeti arayüzü */
(window.TOOLS = window.TOOLS || {}).maliyet = { init: function (root) {
  'use strict';
  var M = window.TA.M, K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var st = { rows: [], sonuc: null, t: null, odak: null }, seq = 0;
  function err(m) { var e = $('#ym-err'); e.textContent = m || ''; e.hidden = !m; }
  function num(v) { var t = String(v == null ? '' : v).trim(); if (!t) return null; var n = K.parseNumber(t, { tr: true }); return isFinite(n) ? n : NaN; }
  function tl(v) { return U.num(v, 2) + ' TL'; }

  // Seçim listesi: sınıf ve grup başlığı altında tebliğdeki yapılar (değer "III-B|11")
  var optHtml = '<option value="">Seçin…</option>' + M.GRUPLAR.map(function (g) {
    return '<optgroup label="' + g.sinif + '. sınıf (' + g.grup + ') grubu · ' + U.num(g.bm, 0) + ' TL/m²">' +
      g.yapilar.map(function (y, i) { return '<option value="' + g.kod + '|' + i + '">' + U.esc(y) + '</option>'; }).join('') + '</optgroup>';
  }).join('');
  function satirHtml(r) {
    return '<div class="op-row card" data-k="' + r.k + '">' +
      '<label class="f">Yapı türü (sınıf ve grup)<select data-f="sec">' + optHtml.replace('value="' + r.sec + '"', 'value="' + r.sec + '" selected') + '</select></label>' +
      '<div class="row r2" style="align-items:end"><label class="f">İnşaat alanı (m²)<input data-f="alan" inputmode="decimal" value="' + U.esc(r.alan || '') + '" placeholder="ör. 1.250"></label>' +
      '<div class="f" style="justify-content:flex-end;align-items:flex-end">' + (st.rows.length > 1 ? '<button class="btn ghost sm" type="button" data-sil="' + r.k + '" aria-label="Yapıyı kaldır">Kaldır</button>' : '') + '</div></div></div>';
  }
  function ciz() { $('#ym-rows').innerHTML = st.rows.map(satirHtml).join(''); }
  function ekle(r) { r.k = ++seq; st.rows.push(r); return r; }
  function bul(k) { return st.rows.filter(function (r) { return r.k === +k; })[0]; }
  function hedef() { return bul(st.odak) || st.rows[0]; }

  $('#ym-rows').addEventListener('focusin', function (e) { var row = e.target.closest('[data-k]'); if (row) st.odak = +row.getAttribute('data-k'); });
  $('#ym-rows').addEventListener('input', function (e) {
    var t = e.target, f = t.getAttribute('data-f'), row = t.closest('[data-k]'); if (!f || !row) return;
    bul(row.getAttribute('data-k'))[f] = t.value;
    if (f === 'sec') hesapla(); else { clearTimeout(st.t); st.t = setTimeout(hesapla, 250); }
  });
  $('#ym-rows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sil]'); if (!b) return;
    st.rows = st.rows.filter(function (r) { return r.k !== +b.getAttribute('data-sil'); }); ciz(); hesapla();
  });
  $('#ym-add').addEventListener('click', function () { var r = ekle({ sec: '', alan: '' }); st.odak = r.k; ciz(); var s = U.$$('#ym-rows select', root).pop(); if (s) s.focus(); });

  // Arama: sonuca tıklayınca seçili (son odaklanılan) satıra yazılır
  function aramaCiz() {
    var q = $('#ym-ara').value, box = $('#ym-sonuc'), a = M.ara(q).slice(0, 12);
    if (!q.trim()) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = a.length ? a.map(function (x) { return '<button type="button" class="ym-bul" data-sec="' + x.kod + '|' + x.i + '"><span>' + U.esc(x.ad) + '</span><span class="meta">' + x.kod + ' · ' + U.num(x.bm, 0) + ' TL/m²</span></button>'; }).join('') :
      '<p class="hint">Eşleşen yapı yok. Tebliğde olmayan yapılar benzer gruptaki yapılara kıyasla belirlenir.</p>';
  }
  $('#ym-ara').addEventListener('input', aramaCiz);
  $('#ym-sonuc').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sec]'); if (!b) return;
    var r = hedef(); r.sec = b.getAttribute('data-sec'); ciz(); hesapla();
    $('#ym-ara').value = ''; aramaCiz();
    var inp = U.$('[data-k="' + r.k + '"] [data-f="alan"]', root); if (inp && !inp.value) inp.focus();
  });

  // Grup yardımcısı
  function yardimSync() { var m = $('#ym-tur').value === 'mustakil'; $('#ym-katw').hidden = m; $('#ym-bbw').hidden = !m; oneriCiz(); }
  function oneri() {
    var tur = $('#ym-tur').value;
    if (tur === 'mustakil') return M.oner(tur, { bbAlan: num($('#ym-bb').value) });
    return M.oner(tur, { kat: num($('#ym-kat').value), yukseklik: num($('#ym-h').value) });
  }
  function oneriSecimi(kod) {
    var tur = $('#ym-tur').value, g = M.BY_KOD[kod], re = tur === 'mustakil' ? /^Müstakil/ : tur === 'konut' ? /^Konutlar/ : /^İş merkezleri/;
    for (var i = 0; i < g.yapilar.length; i++) if (re.test(g.yapilar[i])) return kod + '|' + i;
    return null;
  }
  function oneriCiz() {
    var o = $('#ym-oneri');
    try { var kod = oneri(), g = M.BY_KOD[kod]; o.textContent = kod + ' grubu · ' + U.num(g.bm, 0) + ' TL/m²'; $('#ym-uygula').disabled = false; }
    catch (e) { o.textContent = e.message; $('#ym-uygula').disabled = true; }
  }
  ['#ym-tur'].forEach(function (s) { $(s).addEventListener('change', yardimSync); });
  ['#ym-kat', '#ym-h', '#ym-bb'].forEach(function (s) { $(s).addEventListener('input', oneriCiz); });
  $('#ym-uygula').addEventListener('click', function () {
    try { var sec = oneriSecimi(oneri()); if (!sec) return; var r = st.rows[0]; r.sec = sec; ciz(); hesapla(); } catch (e) { err(e.message); }
  });

  function hesapla() {
    err('');
    var satirlar = [], hata = null;
    st.rows.forEach(function (r, i) {
      if (hata || !r.sec) return;
      var a = num(r.alan); if (a == null) return;
      if (!(a > 0)) { hata = (i + 1) + '. yapı: inşaat alanını pozitif bir sayı olarak girin (ör. 1.250,50).'; return; }
      var p = r.sec.split('|'); satirlar.push({ kod: p[0], alan: a, ad: M.BY_KOD[p[0]].yapilar[+p[1]] });
    });
    if (hata) { err(hata); $('#ym-out').innerHTML = ''; $('#ym-exp').hidden = true; st.sonuc = null; return; }
    if (!satirlar.length) { $('#ym-out').innerHTML = '<p class="hint">Yapı türünü seçip inşaat alanını girin.</p>'; $('#ym-exp').hidden = true; st.sonuc = null; return; }
    var r; try { r = M.hesapla(satirlar); } catch (e) { err(e.message); return; }
    st.sonuc = r; goster(r);
  }
  function goster(r) {
    var h = [];
    h.push('<div class="result-head"><span class="eyebrow">Yapı yaklaşık maliyeti · ' + M.YIL + '</span><span class="big">' + tl(r.toplam) + '</span><span class="meta">KDV hariç · ' +
      U.num(r.alan, 2) + ' m² · ortalama ' + U.num(r.ortalama, 2) + ' TL/m²</span></div>');
    h.push('<div class="scroll"><table class="t"><thead><tr><th>Yapı</th><th>Sınıf</th><th class="num">Birim maliyet</th><th class="num">Alan (m²)</th><th class="num">Tutar</th></tr></thead><tbody>');
    r.satirlar.forEach(function (x) { h.push('<tr><td>' + U.esc(x.ad) + '</td><td class="m">' + x.kod + '</td><td class="num">' + U.num(x.bm, 2) + '</td><td class="num">' + U.num(x.alan, 2) + '</td><td class="num">' + U.num(x.tutar, 2) + '</td></tr>'); });
    if (r.satirlar.length > 1) h.push('<tr class="hl"><td colspan="3"><strong>Toplam</strong></td><td class="num"><strong>' + U.num(r.alan, 2) + '</strong></td><td class="num"><strong>' + U.num(r.toplam, 2) + '</strong></td></tr>');
    h.push('</tbody></table></div>');
    h.push('<ul class="im-notes"><li>' + U.esc(M.VERI.not) + '</li><li>Birim maliyetler ortalama nitelikli yapı malzemesine göredir; gerçek inşaat maliyeti yerine geçmez.</li>' +
      '<li>Kaynak: ' + U.esc(M.VERI.kaynak) + ' (' + U.esc(M.VERI.rg) + ').</li></ul>');
    $('#ym-out').innerHTML = h.join(''); $('#ym-exp').hidden = false;
  }
  $('#ym-csv').addEventListener('click', function () {
    var r = st.sonuc; if (!r) return;
    var rows = [['yapi', 'sinif_grup', 'birim_maliyet_TL_m2', 'insaat_alani_m2', 'tutar_TL']];
    r.satirlar.forEach(function (x) { rows.push([x.ad, x.kod, x.bm.toFixed(2), x.alan.toFixed(2), x.tutar.toFixed(2)]); });
    rows.push(['TOPLAM (KDV hariç)', '', r.ortalama.toFixed(2), r.alan.toFixed(2), r.toplam.toFixed(2)], ['kaynak', M.VERI.rg, '', '', '']);
    U.download('yapi_yaklasik_maliyeti_' + M.YIL + '.csv', U.csvRapor(rows));
  });

  ekle({ sec: oneriSecimi('III-B'), alan: '1.250' });
  ciz(); yardimSync(); hesapla();
}};

(function(){var s=document.getElementById('t-maliyet');U.subtabs(s);TOOLS['maliyet'].init(s);})();