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



/* Sığınak Hesabı arayüzü */
(window.TOOLS = window.TOOLS || {}).siginak = { init: function (root) {
  'use strict';
  var S = window.TA.S, K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var st = { sonuc: null, t: null };
  var ESKI = '7.11.2025\'ten önce ruhsat başvurusu yapılmış, 6306 sayılı Kanun kapsamında noter onaylı inşaat sözleşmesi düzenlenmiş ya da kamu yapım işi için ihale kararı veya ihale tarihi alınmışsa, talep edilirse eski 7. madde hükümleri uygulanır (geçici md. 2). Bu araç güncel hükümlere göre hesaplar.';
  function err(m) { var e = $('#sg-err'); e.textContent = m || ''; e.hidden = !m; }
  function num(sel) { var t = String($(sel).value || '').trim(); if (!t) return null; var n = K.parseNumber(t, { tr: true }); if (!isFinite(n)) throw new Error('Sayıları rakamla girin (ör. 2.400 ya da 1.250,50).'); return n; }

  $('#sg-tur').innerHTML = Object.keys(S.TURLER).map(function (k) { return '<option value="' + k + '">' + U.esc(S.TURLER[k]) + '</option>'; }).join('');
  $('#sg-muaf').innerHTML = Object.keys(S.MUAF_TURLER).map(function (k) { return '<option value="' + k + '">' + U.esc(S.MUAF_TURLER[k]) + '</option>'; }).join('');

  // Kullanıma göre görünen alanlar
  function gor() {
    var t = $('#sg-tur').value, has = function (a) { return a.indexOf(t) >= 0; };
    $('#sg-konut').hidden = !has(['konut', 'karma']);
    $('#sg-alanw').hidden = !has(['karma', 'konutDisi', 'egitim']);
    $('#sg-alanw').firstChild.textContent = t === 'karma' ? 'Binanın tamamının emsale konu alanı (m²)' : 'Emsale konu alan (m²)';
    $('#sg-kdnetw').hidden = t !== 'karma'; $('#sg-kyatakw').hidden = t !== 'karma';
    $('#sg-haricw').hidden = t !== 'egitim';
    $('#sg-resmiw').hidden = !has(['konutDisi', 'egitim']);
    $('#sg-yatakw').hidden = !has(['konaklama', 'bakim']);
    $('#sg-sanayi').hidden = t !== 'sanayi';
    $('#sg-persw').hidden = $('#sg-kurul').value !== 'aranir';
    $('#sg-stad').hidden = t !== 'stadyum';
    $('#sg-muafw').hidden = t !== 'muaf';
    // Sanayide toplam alan "Emsale konu alan" kutusundan okunur
    if (t === 'sanayi') { $('#sg-alanw').hidden = false; $('#sg-alanw').firstChild.textContent = 'Tesisin emsale konu alanı (m²)'; }
  }

  function girdi() {
    var t = $('#sg-tur').value, a = num('#sg-alan');
    return {
      tur: t, konut: { o1: num('#sg-o1'), o2: num('#sg-o2'), o3: num('#sg-o3') },
      konutDisiAlan: a, konutDisiNet: num('#sg-kdnet'), karmaYatak: num('#sg-kyatak'), egitimHaric: num('#sg-haric'), resmi: $('#sg-resmi').checked && (t === 'konutDisi' || t === 'egitim'),
      yatak: num('#sg-yatak'), seyirci: num('#sg-seyirci'), yeniTesis: $('#sg-yeni').checked,
      sanayiAlan: t === 'sanayi' ? a : null, idariAlan: num('#sg-idari'), kurulKarari: $('#sg-kurul').value, personel: num('#sg-pers'),
      salonAlan: num('#sg-salon'), muafTur: $('#sg-muaf').value, yangin: $('#sg-yangin').value, tamamiMd8: $('#sg-md8').checked
    };
  }
  function hesapla() {
    err(''); gor();
    var r; try { r = S.hesapla(girdi()); } catch (e) { err(e.message); $('#sg-out').innerHTML = ''; $('#sg-exp').hidden = true; st.sonuc = null; return; }
    st.sonuc = r; goster(r);
  }
  function goster(r) {
    var h = [], eski = $('#sg-eski').checked;
    if (!r.zorunlu) {
      h.push('<div class="result-head"><span class="eyebrow">Sığınak · md. ' + U.esc(r.madde) + '</span><span class="big">Zorunlu değil</span><span class="meta">' + U.esc(r.gerekce) + '</span></div>');
      if (eski) h.push('<ul class="warnlist"><li>' + ESKI + '</li></ul>');
      $('#sg-out').innerHTML = h.join(''); $('#sg-exp').hidden = false; return;
    }
    if (r.karar === 'bekliyor') h.push('<div class="result-head"><span class="eyebrow">Sığınak · il idare kurulu kararına bağlı</span><span class="big">Kurul kararı gerekli</span><span class="meta">Üretim yapıları için sonuç verilemez' + (r.kisi ? ' · idari bölümler için en az ' + U.num(r.netAlan, 0) + ' m² (' + r.kisi + ' kişi)' : '') + '</span></div>');
    else h.push('<div class="result-head"><span class="eyebrow">Gereken net sığınak alanı</span><span class="big">' + U.num(r.netAlan, 0) + ' m²</span><span class="meta">' + r.kisi + ' kişi · ' + U.esc(r.gerekce) + '</span></div>');
    if (r.karar === 'bekliyor' && !r.kisi) { h.push('<ul class="im-notes">' + r.notlar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>'); $('#sg-out').innerHTML = h.join(''); $('#sg-exp').hidden = false; return; }
    if (r.kalemler.length) h.push('<div class="scroll"><table class="t"><thead><tr><th>Kullanım</th><th>Hesap</th><th class="num">Kişi</th><th class="num">Alan (m²)</th></tr></thead><tbody>' +
      r.kalemler.map(function (x) { return '<tr><td>' + U.esc(x.ad) + '</td><td class="m">' + U.esc(x.hesap) + '</td><td class="num">' + x.kisi + '</td><td class="num">' + U.num(x.alan, 0) + '</td></tr>'; }).join('') +
      '<tr class="hl"><td colspan="2"><strong>Toplam (kişi başı en az net 1 m²)</strong></td><td class="num"><strong>' + r.kisi + '</strong></td><td class="num"><strong>' + U.num(r.gerekenAlan, 0) + '</strong></td></tr>' +
      (r.salonDusumu > 0 ? '<tr><td colspan="3">Sığınak vasfındaki salon alanı düşümü</td><td class="num">−' + U.num(r.salonDusumu, 2) + '</td></tr>' : '') +
      '</tbody></table></div>');
    var w = r.tuvalet, ek = [];
    ek.push(['Tuvalet ve lavabo', w.cift ? w.cift + ' kadın + ' + w.cift + ' erkek' : '1 kadın + 1 erkek (öneri)', '8/a']);
    ek.push(['Mutfak nişi (lavabo ve elektrikli pişirme yeri)', r.mutfak ? 'gerekli, en az 2,30 m²' : 'gerekmez (100 m² ve altı)', '8/a']);
    ek.push(['Çıkış', r.cikis === 2 ? '2 çıkış (100 m²\'den büyük)' : '1 çıkış', '8/c']);
    ek.push(['İç yükseklik', 'net en az 2,40 m', '8/a']);
    ek.push(['Dış duvar ve tavan', 'en az 60 cm beton, 75 cm tuğla/taş ya da 90 cm sıkıştırılmış toprak; tamamen toprak altında, dışarıyla arasında en az 60 cm toprak dolgu olan duvarlarda statik hesaba göre', '8/b']);
    ek.push(['Havalandırma', r.kisi + ' kişi × ' + U.num(r.debi, 1) + ' = ' + U.num(r.hava, 1) + ' m³/saat', '8/ç']);
    ek.push(['Filtre (koruma zamanı)', r.filtre, '8/ç']);
    ek.push(['Enerji', r.enerji24 ? 'en az 24 saat kesintisiz elektrik' : 'fan için jeneratör ya da kesintisiz güç kaynağı', '8/ç']);
    h.push('<div class="scroll"><table class="t"><tbody>' + ek.map(function (e) { return '<tr><td>' + e[0] + '</td><td>' + U.esc(e[1]) + '</td><td class="m">md. ' + e[2] + '</td></tr>'; }).join('') + '</tbody></table></div>');
    var notlar = r.notlar.slice();
    notlar.push('Sığınaklar emsal hesabına dâhil değildir; yer üstünde ya da kısmen yeraltında yapılanlar TAKS\'a dâhildir, ana yapıdan ayrı ve tamamen toprak altındakiler dâhil değildir (md. 6).');
    if (eski) notlar.unshift(ESKI);
    h.push('<ul class="im-notes">' + notlar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    if (r.uyarilar.length) h.push('<ul class="warnlist">' + r.uyarilar.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul>');
    $('#sg-out').innerHTML = h.join(''); $('#sg-exp').hidden = false;
  }
  $('#sg-csv').addEventListener('click', function () {
    var r = st.sonuc; if (!r) return;
    var rows = [['kalem', 'hesap', 'deger']];
    rows.push(['kullanim', S.TURLER[r.tur], ''], ['zorunluluk', r.karar === 'bekliyor' ? 'il idare kurulu kararına bağlı' : r.zorunlu ? 'zorunlu' : 'zorunlu değil', 'md. ' + r.madde], ['gerekce', r.gerekce, '']);
    if (r.zorunlu) {
      r.kalemler.forEach(function (x) { rows.push([x.ad, x.hesap, x.kisi + ' kişi; ' + x.alan + ' m²']); });
      rows.push(['toplam_kisi', '', r.kisi], ['net_siginak_alani_m2', r.karar === 'bekliyor' ? 'yalnız idari bölümler; üretim kurul kararına bağlı' : 'kişi başı en az 1 m²', r.netAlan], ['tuvalet_lavabo_cift', 'kadın + erkek', r.tuvalet.cift || '1 (öneri)'],
        ['mutfak_nisi', '', r.mutfak ? 'gerekli (en az 2,30 m²)' : 'gerekmez'], ['cikis', '', r.cikis], ['havalandirma_m3_saat', r.kisi + ' × ' + r.debi, r.hava.toFixed(1)], ['filtre', r.filtre, '']);
    }
    rows.push(['kaynak', 'Sığınak Yönetmeliği (RG 7.11.2025, 33070 değişikliği işlenmiş)', '']);
    U.download('siginak_hesabi.csv', U.csvRapor(rows));
  });

  ['#sg-tur', '#sg-kurul', '#sg-yangin', '#sg-resmi', '#sg-yeni', '#sg-md8', '#sg-eski', '#sg-muaf'].forEach(function (s) { $(s).addEventListener('change', hesapla); });
  U.$$('input[inputmode]', root).forEach(function (i) { i.addEventListener('input', function () { clearTimeout(st.t); st.t = setTimeout(hesapla, 250); }); });
  hesapla();
}};

(function(){var s=document.getElementById('t-siginak');U.subtabs(s);TOOLS['siginak'].init(s);})();