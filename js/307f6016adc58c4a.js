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



/* CBS Dosya Dönüştürücü arayüzü */
(window.TOOLS = window.TOOLS || {}).donusturucu = { init: function (root) {
  'use strict';
  var F = window.TA.F, K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var S = K.SYSTEMS;
  U.zipper = function (name, data) { var o = {}; o[name] = typeof data === 'string' ? new TextEncoder().encode(data) : data; return F.zip(o); };
  var state = { fc: null, src: null, base: 'veri', table: null, format: '' };

  // sistem listeleri
  var ORDER = ['geo-turef'].concat(K.TM_CMS.map(function (c) { return 'tm-turef-' + c; }), K.UTM_ZONES.map(function (z) { return 'utm-wgs84-' + z; }), ['geo-ed50'],
    K.TM_CMS.map(function (c) { return 'tm-ed50-' + c; }), K.UTM_ZONES.map(function (z) { return 'utm-ed50-' + z; }));
  function label(id) { var s = S[id]; return s.kind === 'geo' ? (s.datum === 'ED50' ? 'Coğrafi – ED50' : 'Coğrafi – WGS84 / TUREF') : s.label; }
  ORDER.forEach(function (id) { $('#dd-src').add(new Option(label(id), id)); $('#do-crs').add(new Option(label(id), id)); });

  var SAMPLE = JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { ad: 'Örnek nokta – Güvenpark', tur: 'nokta' }, geometry: { type: 'Point', coordinates: [32.8541, 39.9199] } },
    { type: 'Feature', properties: { ad: 'Örnek nokta – Kuğulu Park', tur: 'nokta' }, geometry: { type: 'Point', coordinates: [32.8608, 39.9036] } },
    { type: 'Feature', properties: { ad: 'Örnek güzergâh', tur: 'çizgi' }, geometry: { type: 'LineString', coordinates: [[32.8541, 39.9199], [32.8556, 39.9152], [32.8579, 39.9097], [32.8608, 39.9036]] } },
    { type: 'Feature', properties: { ad: 'Örnek alan', tur: 'alan' }, geometry: { type: 'Polygon', coordinates: [[[32.8520, 39.9180], [32.8562, 39.9180], [32.8562, 39.9212], [32.8520, 39.9212]]] } }
  ] }, null, 1);

  function showErr(m) { var e = $('#dd-err'); e.textContent = m || ''; e.hidden = !m; }
  function list(el, items) { el.innerHTML = items.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join(''); el.hidden = !items.length; }

  // ---------- Okuma ----------
  function readXlsx(f) {
    return f.arrayBuffer().then(function (buf) {
      return { name: f.name.replace(/\.xlsx?$/i, '.csv'), data: new TextEncoder().encode(window.TA.XO.csv(window.TA.XO.oku(buf))) };
    });
  }
  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList); if (!files.length) return;
    showErr('');
    Promise.all(files.map(function (f) {
      if (/\.xlsx?$/i.test(f.name)) return readXlsx(f);
      return f.arrayBuffer().then(function (b) { return { name: f.name, data: new Uint8Array(b) }; });
    })).then(function (arr) {
      var main = arr.filter(function (x) { return /\.(shp|kml|kmz|geojson|json|gpx|dxf|csv|txt|tsv|ncn|wkt|zip)$/i.test(x.name); })[0] || arr[0];
      state.base = main.name.replace(/\.[^.]+$/, '').replace(/^.*[\\/]/, '') || 'veri';
      ingest(F.readFiles(arr));
    }).catch(function (e) { showErr('Dosya okunamadı: ' + (e.message || e)); });
  }
  function ingest(r) {
    state.table = null; $('#dd-map').hidden = true;
    list($('#dd-warn'), r.warnings || []);
    state.format = r.format;
    if (r.table) { state.table = r.table; setupTable(r.table); applyTable(); return; }
    state.fc = r.fc; state.src = r.crs;
    $('#dd-src').value = r.crs;
    $('#dd-srcnote').textContent = r.crsSure ? 'Dosyadan algılandı.' : 'Tahmin; verinin sistemini bilmiyorsanız denetleyin (ör. 3° TM orta meridyeni).';
    afterLoad();
  }
  function setupTable(t) {
    var opts = '<option value="-1">—</option>' + t.header.map(function (h, i) { return '<option value="' + i + '">' + U.esc(h) + '</option>'; }).join('');
    ['#dm-a', '#dm-b', '#dm-z', '#dm-wkt'].forEach(function (s) { $(s).innerHTML = opts; });
    $('#dm-a').value = t.guess.a; $('#dm-b').value = t.guess.b; $('#dm-z').value = t.guess.z; $('#dm-wkt').value = t.guess.wkt;
    $('#dd-map').hidden = false;
    var g = t.guess;
    var src = g.geo ? 'geo-turef' : 'tm-turef-33';
    if (!g.geo && g.a >= 0) { // sağa değerden dilim tahmini mümkün değil; varsayılan TM33, kullanıcı seçer
      src = $('#dd-src').value && S[$('#dd-src').value].kind === 'proj' ? $('#dd-src').value : 'tm-turef-33';
    }
    $('#dd-src').value = src; state.src = src;
    $('#dd-srcnote').textContent = g.geo ? 'Değerler coğrafi koordinat gibi görünüyor.' : 'Projeksiyon koordinatı: dilimi (orta meridyeni) ve datumu denetleyin.' + (g.swapped ? ' Y ve X sütunları büyüklüklerine göre yer değiştirildi.' : '');
  }
  function applyTable() {
    var t = state.table; if (!t) return;
    var cols = { a: +$('#dm-a').value, b: +$('#dm-b').value, z: +$('#dm-z').value, wkt: +$('#dm-wkt').value, geo: S[$('#dd-src').value].kind === 'geo' };
    if (cols.wkt < 0 && (cols.a < 0 || cols.b < 0)) { showErr('Koordinat sütunlarını ya da WKT sütununu seçin.'); return; }
    var r = F.tableToFC(t, cols);
    if (!r.fc.features.length) { showErr('Seçilen sütunlarda okunabilir koordinat yok.'); return; }
    showErr(r.skipped.length ? r.skipped.length + ' satır okunamadı (satır ' + r.skipped.slice(0, 10).join(', ') + (r.skipped.length > 10 ? '…' : '') + ').' : '');
    state.fc = r.fc; state.src = $('#dd-src').value; afterLoad();
  }

  function afterLoad() {
    var s = F.summary(state.fc);
    $('#dd-sum').hidden = false; $('#dd-srcwrap').hidden = false; $('#dd-out').hidden = false; $('#dd-val').hidden = false;
    $('#dd-fmt').textContent = 'Girdi · ' + state.format;
    var parts = []; if (s.Point) parts.push(s.Point + ' nokta'); if (s.LineString) parts.push(s.LineString + ' çizgi'); if (s.Polygon) parts.push(s.Polygon + ' alan'); if (s.other) parts.push(s.other + ' diğer');
    $('#dd-count').textContent = s.total + ' öğe';
    $('#dd-meta').textContent = parts.join(' · ') + ' · ' + U.num(s.vertices, 0) + ' köşe noktası' + (s.fields.length ? ' · alanlar: ' + s.fields.slice(0, 8).join(', ') + (s.fields.length > 8 ? '…' : '') : '');
    var fopts = '<option value="">—</option>' + s.fields.map(function (f) { return '<option>' + U.esc(f) + '</option>'; }).join('');
    ['#do-text', '#do-layer', '#do-name'].forEach(function (id) { $(id).innerHTML = fopts; });
    var nm = s.fields.filter(function (f) { return /^(ad|adi|adı|name|nokta|metin)$/i.test(f); })[0] || '';
    $('#do-name').value = nm; $('#do-text').value = nm;
    var lay = s.fields.filter(function (f) { return /^(katman|layer)$/i.test(f); })[0] || ''; $('#do-layer').value = lay;
    // önerilen hedef: coğrafi kaynakta 3° TM, projeksiyonda aynı sistem
    if (S[state.src].kind === 'geo' && s.bbox) $('#do-crs').value = 'tm-turef-' + K.tmCmFor((s.bbox[0] + s.bbox[2]) / 2);
    else $('#do-crs').value = state.src;
    syncOut(); validate(); draw();
  }

  // ---------- Önizleme ----------
  function draw() {
    var svg = $('#dd-svg'), fc = state.fc; if (!fc) return;
    var b = F.bbox(fc); if (!b) { svg.innerHTML = ''; return; }
    var geo = S[state.src].kind === 'geo', kx = geo ? Math.cos(((b[1] + b[3]) / 2) * Math.PI / 180) : 1;
    var W = 600, H = 380, pad = 20, w = Math.max((b[2] - b[0]) * kx, 1e-12), h = Math.max(b[3] - b[1], 1e-12);
    var sc = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h), ox = (W - w * sc) / 2, oy = (H - h * sc) / 2;
    function P(c) { return (ox + (c[0] - b[0]) * kx * sc).toFixed(1) + ',' + (H - oy - (c[1] - b[1]) * sc).toFixed(1); }
    var out = [], n = 0, LIMIT = 4000;
    function path(rings, close) { return rings.map(function (r) { return 'M' + r.map(P).join('L') + (close ? 'Z' : ''); }).join(''); }
    function g1(g) {
      if (!g || n++ > LIMIT) return;
      switch (g.type) {
        case 'Point': var p = P(g.coordinates).split(','); out.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" fill="var(--amber)" stroke="var(--text)" stroke-width=".8"/>'); break;
        case 'MultiPoint': g.coordinates.forEach(function (c) { g1({ type: 'Point', coordinates: c }); }); break;
        case 'LineString': out.push('<path d="' + path([g.coordinates]) + '" fill="none" stroke="var(--text)" stroke-width="1.4"/>'); break;
        case 'MultiLineString': out.push('<path d="' + path(g.coordinates) + '" fill="none" stroke="var(--text)" stroke-width="1.4"/>'); break;
        case 'Polygon': out.push('<path d="' + path(g.coordinates, true) + '" fill="var(--amber)" fill-opacity=".22" fill-rule="evenodd" stroke="var(--text)" stroke-width="1"/>'); break;
        case 'MultiPolygon': g.coordinates.forEach(function (p) { g1({ type: 'Polygon', coordinates: p }); }); break;
        case 'GeometryCollection': g.geometries.forEach(g1); break;
      }
    }
    // önce alanlar, sonra çizgiler, en üstte noktalar
    ['Polygon', 'Line', 'Point'].forEach(function (k) { fc.features.forEach(function (f) { if (f.geometry && f.geometry.type.indexOf(k) >= 0) g1(f.geometry); }); });
    svg.innerHTML = out.join('');
    $('#dd-cap').textContent = (n > LIMIT ? 'İlk ' + LIMIT + ' öğe çizildi. ' : '') + 'Önizleme; kuzey yukarıda. Kapsam: ' + (geo ? U.num(b[1], 5) + '°–' + U.num(b[3], 5) + '° K, ' + U.num(b[0], 5) + '°–' + U.num(b[2], 5) + '° D' : 'Y ' + U.num(b[0], 0) + '–' + U.num(b[2], 0) + ', X ' + U.num(b[1], 0) + '–' + U.num(b[3], 0) + ' m');
  }

  // ---------- Denetim ----------
  function validate() {
    var iss = F.validate(state.fc), fixable = iss.filter(function (i) { return i.onarilir; }).length;
    $('#dv-sum').textContent = iss.length ? iss.length + ' sorun bulundu; ' + fixable + ' tanesi otomatik onarılabilir.' : 'Sorun bulunmadı.';
    $('#dv-tab').tBodies[0].innerHTML = iss.slice(0, 200).map(function (i) {
      return '<tr><td class="m">#' + i.i + '</td><td>' + U.esc(i.mesaj) + '</td><td>' + (i.onarilir ? '<span class="badge ok">onarılır</span>' : '<span class="badge no">elle</span>') + '</td></tr>';
    }).join('');
    $('#dv-tab').parentNode.hidden = !iss.length;
  }

  // ---------- Çıktı ----------
  var TEXT_FMT = { geojson: 1, kml: 1, gpx: 1, csv: 1, wkt: 1 };
  function syncOut() {
    var f = $('#do-fmt').value, wgsOnly = !!F.WGS_ONLY[f];
    $('#do-crs').disabled = wgsOnly; if (wgsOnly) $('#do-crs').value = 'geo-turef';
    $('#do-dxf').hidden = f !== 'dxf'; $('#do-namew').hidden = !(f === 'kml' || f === 'kmz' || f === 'gpx');
    $('#do-copy').disabled = !TEXT_FMT[f];
    var notes = { geojson: 'GeoJSON standardı (RFC 7946) gereği WGS84 coğrafi koordinatla yazılır.', kml: 'KML WGS84 coğrafi koordinat kullanır; Google Earth\'te doğrudan açılır.', kmz: 'Sıkıştırılmış KML; Google Earth\'te açılır.',
      gpx: 'GPX noktaları ve çizgileri taşır; alanlar yazılmaz.', shp: 'Nokta, çizgi ve alanlar ayrı katmanlara (.shp/.shx/.dbf/.prj/.cpg) yazılıp tek .zip olarak verilir.',
      dxf: 'Metre birimli bir sistem (3° TM) seçin; CAD yazılımları koordinatı doğrudan kullanır.', csv: 'Noktalar Y/X ya da enlem/boylam sütunlarıyla, diğer geometriler WKT sütunuyla yazılır; ayraç noktalı virgül.', wkt: 'Her satıra bir geometri.' };
    $('#do-note').textContent = notes[f] || '';
  }
  function produce() {
    if (!state.fc) throw new Error('Önce bir dosya okuyun');
    var src = $('#dd-src').value, data = state.fc, msgs = [];
    if ($('#do-fix').checked) data = F.repair(data);
    var tol = K.parseNumber($('#do-tol').value || '0');
    if (!isFinite(tol) || tol < 0) throw new Error('Sadeleştirme toleransı 0 ya da pozitif bir sayı olmalı');
    if (tol > 0) { var before = F.summary(data).vertices; data = F.simplify(data, src, tol); msgs.push('Sadeleştirme: ' + U.num(before, 0) + ' → ' + U.num(F.summary(data).vertices, 0) + ' köşe noktası.'); }
    var th = K.parseNumber($('#do-th').value || '1');
    var r = F.write(data, src, { format: $('#do-fmt').value, crs: $('#do-crs').value, textField: $('#do-text').value || null, layerField: $('#do-layer').value || null, textHeight: isFinite(th) && th > 0 ? th : 1, nameField: $('#do-name').value || null }, state.base);
    r.notes = msgs.concat(r.notes); return r;
  }
  $('#do-dl').addEventListener('click', function () {
    try { var r = produce(); list($('#do-msg'), r.notes); U.download(r.name, r.data, 'application/octet-stream'); }
    catch (e) { list($('#do-msg'), [e.message]); }
  });
  $('#do-copy').addEventListener('click', function () {
    try { var r = produce(); if (typeof r.data !== 'string') return; list($('#do-msg'), r.notes); U.copy(r.data.replace(/^﻿/, '')); }
    catch (e) { list($('#do-msg'), [e.message]); }
  });
  $('#do-fmt').addEventListener('change', syncOut);
  $('#dd-src').addEventListener('change', function () { if (state.table) applyTable(); else { state.src = $('#dd-src').value; draw(); } });
  $('#dm-apply').addEventListener('click', applyTable);
  $('#dm-swap').addEventListener('click', function () { var a = $('#dm-a').value; $('#dm-a').value = $('#dm-b').value; $('#dm-b').value = a; applyTable(); });

  // ---------- Girdi olayları ----------
  var drop = $('#dd-drop');
  $('#dd-file').addEventListener('change', function (e) { handleFiles(e.target.files); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#dd-file').click(); } });
  function fromText(txt, name) {
    showErr('');
    try { state.base = name || 'veri'; ingest(F.readFiles([{ name: name || 'metin.txt', data: new TextEncoder().encode(txt) }])); }
    catch (e) { showErr(e.message); }
  }
  $('#dd-read').addEventListener('click', function () { fromText($('#dd-text').value, 'veri'); });
  $('#dd-ornek').addEventListener('click', function () { $('#dd-text').value = SAMPLE; fromText(SAMPLE, 'ornek.geojson'); state.base = 'ornek'; });
  $('#dd-ornek').click();
}};

(function(){var s=document.getElementById('t-donusturucu');U.subtabs(s);TOOLS['donusturucu'].init(s);})();