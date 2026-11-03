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



/* Otopark Hesabı arayüzü */
(window.TOOLS = window.TOOLS || {}).otopark = { init: function (root) {
  'use strict';
  var P = window.TA.P, K = window.TA.K, U = window.U, SAYI = window.TA.P.sayi, $ = function (s) { return U.$(s, root); };
  var st = { rows: [], sonuc: null, bedel: null, t: null }, seq = 0;
  function err(m) { var e = $('#op-err'); e.textContent = m || ''; e.hidden = !m; }
  function num(v) { var t = String(v == null ? '' : v).trim(); if (!t) return null; var n = SAYI(t); return isFinite(n) ? n : NaN; }
  function adet(v) { return U.num(v, 0); }

  // Seçim listesi (Ek-1 grupları)
  var optHtml = (function () {
    var h = [], g = null;
    P.TABLO.forEach(function (t) {
      if (t.grup !== g) { if (g) h.push('</optgroup>'); g = t.grup; h.push('<optgroup label="' + U.esc(g) + '">'); }
      h.push('<option value="' + t.id + '">' + U.esc(t.ad) + '</option>');
    });
    h.push('</optgroup>'); return h.join('');
  })();
  function birimEtiket(T) {
    if (T.tur === 'mesken' || T.tur === 'oran' || T.tur === 'metin' || T.tur === 'hastane' || T.tur === 'yuzme') return null;
    return T.tur === 'oda' ? (T.birimAd || 'oda') + ' için 1' : T.tur === 'oturma' || T.tur === 'spor' ? 'oturma yeri için 1' : 'm² için 1';
  }
  function satirHtml(r) {
    var T = P.BY_ID[r.id], h = ['<div class="op-row card" data-k="' + r.k + '">'];
    h.push('<div class="row r2" style="align-items:end"><label class="f">Kullanım<select data-f="id">' + optHtml.replace('value="' + r.id + '"', 'value="' + r.id + '" selected') + '</select></label>' +
      '<div class="f" style="justify-content:flex-end;align-items:flex-end"><button class="btn ghost sm" type="button" data-sil="' + r.k + '" aria-label="Kullanımı kaldır">Kaldır</button></div></div>');
    if (T.tur === 'mesken' || T.tur === 'bbAlan') h.push('<label class="f">' + U.esc(T.esas) + '<input data-f="liste" value="' + U.esc(r.liste || '') + '" placeholder="ör. 8 x 95; 2 x 140" spellcheck="false"></label>');
    else if (T.tur === 'metin') h.push('<p class="hint">' + U.esc(T.metin) + '</p>');
    else {
      var e2 = T.tur === 'hastane' ? 'Hasta yatağı sayısı' : T.tur === 'yuzme' ? 'Oturma yeri' : T.id === 'otel45' ? 'Emsale dâhil alan (m²)' : null;
      h.push('<div class="row ' + (e2 ? 'r2' : 'r1') + '"><label class="f">' + U.esc(T.esas.split(' ve ')[0]) + '<input data-f="miktar" inputmode="decimal" value="' + U.esc(r.miktar || '') + '"></label>' +
        (e2 ? '<label class="f">' + e2 + '<input data-f="miktar2" inputmode="decimal" value="' + U.esc(r.miktar2 || '') + '"></label>' : '') + '</div>');
      if (T.tur === 'spor') h.push('<label class="f im-chk"><input type="checkbox" data-f="tribun"' + (r.tribun ? ' checked' : '') + '> Tribünlü tesis (500 oturma yeri için 1 otobüs)</label>');
    }
    var be = birimEtiket(T);
    if (be) h.push('<label class="f op-birim">' + (T.serbest ? 'Birim (zorunlu): kaç ' : 'İdare değeri (boşsa Ek-1: ' + U.num(T.birim, 0) + ' ') + be + (T.serbest ? '' : ')') + '<input data-f="birim" inputmode="decimal" value="' + U.esc(r.birim || '') + '" placeholder="' + (T.birim ? U.num(T.birim, 0) : '') + '"></label>');
    h.push('</div>'); return h.join('');
  }
  function ciz() { $('#op-rows').innerHTML = st.rows.map(satirHtml).join(''); }
  function ekle(r) { r.k = ++seq; st.rows.push(r); }
  function bul(k) { return st.rows.filter(function (r) { return r.k === +k; })[0]; }

  $('#op-rows').addEventListener('input', function (e) {
    var t = e.target, f = t.getAttribute('data-f'), row = t.closest('[data-k]'); if (!f || !row) return;
    var r = bul(row.getAttribute('data-k'));
    if (f === 'id') { r.id = t.value; r.liste = ''; r.miktar = ''; r.miktar2 = ''; r.birim = ''; ciz(); hesapla(); return; }
    r[f] = t.type === 'checkbox' ? t.checked : t.value;
    clearTimeout(st.t); st.t = setTimeout(hesapla, 250);
  });
  $('#op-rows').addEventListener('change', function (e) { if (e.target.getAttribute('data-f') === 'tribun') { bul(e.target.closest('[data-k]').getAttribute('data-k')).tribun = e.target.checked; hesapla(); } });
  $('#op-rows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sil]'); if (!b) return;
    st.rows = st.rows.filter(function (r) { return r.k !== +b.getAttribute('data-sil'); }); ciz(); hesapla();
  });
  $('#op-add').addEventListener('click', function () { ekle({ id: 'dukkan', liste: '' }); ciz(); var s = U.$$('#op-rows select', root).pop(); if (s) s.focus(); });

  function hesapla() {
    err('');
    var satirlar = [], hata = null;
    st.rows.forEach(function (r) {
      if (hata) return;
      var T = P.BY_ID[r.id], s = { id: r.id, sit: $('#op-sit').checked };
      try {
        if (T.tur === 'mesken' || T.tur === 'bbAlan') { s.liste = P.listeOku(r.liste); if (!s.liste.length) return; }
        else if (T.tur !== 'metin') {
          var q = num(r.miktar); if (q == null) return; if (!(q >= 0)) throw new Error(T.ad + ': miktar sayı olmalı.');
          s.miktar = q; var q2 = num(r.miktar2); if (q2 != null) { if (!(q2 >= 0)) throw new Error(T.ad + ': ikinci değer sayı olmalı.'); s.miktar2 = q2; if (T.id === 'otel45') s.emsalAlani = q2; }
          s.tribun = !!r.tribun;
        }
        var b = num(r.birim); if (b != null) { if (!(b > 0)) throw new Error(T.ad + ': idare değeri pozitif olmalı.'); s.birim = b; }
        else if (T.serbest) throw new Error('Tabloda olmayan kullanım için birim değerini girin (md. 8/6).');
        satirlar.push(s);
      } catch (e) { hata = e.message; }
    });
    if (hata) { err(hata); return; }
    if (!satirlar.length) { $('#op-out').innerHTML = '<p class="hint">Bir kullanım ekleyip büyüklüğünü girin.</p>'; $('#op-exp').hidden = true; st.sonuc = null; return; }
    var r;
    try { r = P.hesapla({ satirlar: satirlar, yuvarlama: $('#op-yuv').value, umumi: $('#op-umumi').checked, bolgeGenel: $('#op-bolge').checked, kucukParsel: $('#op-kucuk').checked }); }
    catch (e) { err(e.message); return; }
    st.sonuc = r; st.bedel = bedelHesap(r); goster(r, st.bedel);
  }
  function bedelHesap(r) {
    var k = num($('#op-k').value), ar = num($('#op-arsa').value), ka = num($('#op-kaks').value), B = num($('#op-b').value), Y = +$('#op-y').value;
    if (k == null && ar == null && B == null) return null;
    if (!(k >= 0) || Math.round(k) !== k) return { hata: 'Karşılanamayan otopark sayısını tam sayı olarak girin.' };
    if (k > r.otopark) return { hata: 'Karşılanamayan sayı zorunlu otopark sayısından (' + r.otopark + ') büyük olamaz.' };
    if (!(ar > 0) || !(ka > 0) || !(B >= 0)) return { hata: 'Bedel için arsa m² değerini, KAKS\'ı ve B birim fiyatını girin.' };
    return P.bedel({ arsaBirim: ar, kaks: ka, B: B, Y: Y, adet: k });
  }
  function tl(v) { return U.num(v, 2) + ' TL'; }
  function goster(r, b) {
    var h = [];
    var meta = 'Gereken en az alan ' + U.num(r.otoparkAlani, 0) + ' m²' + (r.otobus ? ' · ' + r.otobus + ' otobüs park yeri' : '') + ' · ham değer ' + U.num(r.ham, 3);
    h.push('<div class="result-head"><span class="eyebrow">Zorunlu otopark</span><span class="big">' + adet(r.otopark) + ' otopark</span><span class="meta">' + meta + '</span></div>');
    h.push('<div class="scroll"><table class="t"><thead><tr><th>Kullanım</th><th>Hesap</th><th class="num">Değer</th>' + (r.satirlar.some(function (x) { return x.adet != null; }) ? '<th class="num">Adet</th>' : '') + '</tr></thead><tbody>');
    r.satirlar.forEach(function (x) {
      var hes = x.hesaplanmaz ? 'hesaplanmaz' : U.esc(x.aciklama);
      var ay = x.ayrinti.length && (x.id === 'mesken' || x.id === 'hastane') ? '<br>' + x.ayrinti.map(function (a) { return U.esc(a.ad) + (a.daire != null ? ' — ' + a.daire + ' daire' : '') + ': ' + U.num(a.ham, 3); }).join('<br>') : '';
      h.push('<tr><td>' + U.esc(x.ad) + '</td><td class="op-hes">' + hes + ay + '</td><td class="num">' + U.num(x.ham, 3) + '</td>' + (x.adet != null ? '<td class="num">' + x.adet + '</td>' : '') + '</tr>');
    });
    h.push('<tr class="hl"><td colspan="2"><strong>Toplam (bir üst sayıya)</strong></td><td class="num"><strong>' + adet(r.otopark) + '</strong></td>' + (r.satirlar.some(function (x) { return x.adet != null; }) ? '<td></td>' : '') + '</tr></tbody></table></div>');
    var ek = [];
    ek.push(['Gereken en az otopark alanı (20 m² × ' + r.otopark + (r.otobus ? ' + 50 m² × ' + r.otobus : '') + ')', U.num(r.otoparkAlani, 0) + ' m²', '4/1-ç']);
    ek.push(['Engelli park yeri', r.engelli == null ? 'erişilebilirlik mevzuatına göre' : adet(r.engelli) + ' adet', r.engelli == null ? '4/1-ğ' : '4/1-ı']);
    ek.push(['Elektrikli araç park yeri (şarj ünitesi dâhil, %' + U.num(r.elektrikliOran * 100, 0) + ')', r.elektrikli ? adet(r.elektrikli) + ' adet' : 'zorunlu değil (20\'den az)', r.elektrikliMadde]);
    if (r.avmAlan > 0) ek.push(['Hızlı şarj ünitesi (AVM ' + U.num(r.avmAlan, 0) + ' m²)', r.hizliSarj + ' adet', '6/5']);
    ek.push(['Bisiklet ve motosiklet için ilave alan (%1)', U.num(r.bisikletAlani, 2) + ' m²', '4/1-i']);
    if (r.yukleme) ek.push(['Yükleme boşaltma alanı', r.yukleme + ' adet', 'Ek-1']);
    if (r.azaltilmis != null) ek.push(['md. 8/2 ile azaltılabilir en az sayı (konutta %50)', adet(r.azaltilmis) + ' otopark; en az ' + r.parseldeEnAz + '\'i parselde', '8/2']);
    h.push('<div class="scroll"><table class="t"><tbody>' + ek.map(function (e) { return '<tr><td>' + e[0] + '</td><td class="num">' + e[1] + '</td><td class="m">md. ' + e[2] + '</td></tr>'; }).join('') + '</tbody></table></div>');
    if (r.azaltilmis != null) r.notlar.unshift('md. 8/2 azaltımı idarenin takdirindedir ("azaltılabilir") ve otopark ihtiyacının en az yarısının parselde karşılanması koşuluna bağlıdır.');
    if (b) {
      if (b.hata) h.push('<p class="err">' + U.esc(b.hata) + '</p>');
      else h.push('<div class="scroll"><table class="t"><thead><tr><th>Otopark bedeli</th><th class="num">Tutar</th></tr></thead><tbody>' +
        '<tr><td>A = arsa m² değeri ÷ KAKS</td><td class="num">' + tl(b.A) + '/m²</td></tr>' +
        '<tr><td>Birim bedel = (A + B) × 20 × ' + U.num(b.Y, 2) + '</td><td class="num">' + tl(b.birim) + '</td></tr>' +
        '<tr class="hl"><td><strong>Toplam (' + $('#op-k').value.trim() + ' otopark)</strong></td><td class="num"><strong>' + tl(b.toplam) + '</strong></td></tr>' +
        '<tr><td>Ruhsatta peşin (%25)</td><td class="num">' + tl(b.pesin) + '</td></tr>' +
        '<tr><td>Kalan %75: 6 eşit taksit (yeniden değerleme öncesi)</td><td class="num">6 × ' + tl(b.taksit) + '</td></tr>' +
        '</tbody></table></div>');
    }
    if (r.notlar.length) h.push('<ul class="im-notes">' + r.notlar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    if (r.uyarilar.length) h.push('<ul class="warnlist">' + r.uyarilar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    $('#op-out').innerHTML = h.join(''); $('#op-exp').hidden = false;
  }

  $('#op-csv').addEventListener('click', function () {
    var r = st.sonuc; if (!r) return;
    var rows = [['kullanim', 'hesap', 'ham_deger', 'adet']];
    r.satirlar.forEach(function (x) { rows.push([x.ad, (x.aciklama || '').replace(/;/g, ','), x.ham.toFixed(4), x.adet == null ? '' : x.adet]); });
    rows.push(['TOPLAM', 'md. 8/4', r.ham.toFixed(4), r.otopark], ['otopark_alani_m2', 'md. 4/1-ç', '', r.otoparkAlani], ['engelli', '', '', r.engelli == null ? '' : r.engelli],
      ['elektrikli', 'md. ' + r.elektrikliMadde, '', r.elektrikli], ['bisiklet_alani_m2', 'md. 4/1-i', '', r.bisikletAlani.toFixed(2)], ['otobus', '', '', r.otobus]);
    if (st.bedel && !st.bedel.hata) rows.push(['otopark_bedeli_TL', '(A+B)x20xY', st.bedel.birim.toFixed(2), st.bedel.toplam.toFixed(2)]);
    U.download('otopark_hesabi.csv', U.csvRapor(rows));
  });
  ['#op-yuv', '#op-umumi', '#op-bolge', '#op-sit', '#op-kucuk', '#op-y'].forEach(function (s) { $(s).addEventListener('change', hesapla); });
  ['#op-k', '#op-arsa', '#op-kaks', '#op-b'].forEach(function (s) { $(s).addEventListener('input', function () { clearTimeout(st.t); st.t = setTimeout(hesapla, 250); }); });
  ekle({ id: 'mesken', liste: '8 x 95; 2 x 140' }); ekle({ id: 'dukkan', liste: '2 x 30; 120' });
  ciz(); hesapla();
}};

(function(){var s=document.getElementById('t-otopark');U.subtabs(s);TOOLS['otopark'].init(s);})();