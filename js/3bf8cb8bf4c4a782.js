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

/* Ortak harita bileşeni (MapLibre GL). window.HARITA
 * Altlık: window.TOPO_BASEMAP = 'openfreemap' (site: altlık seçici) | 'offline' (önizleme: dış kaynak yok, yalnız Türkiye sınırı).
 * Altlıklar (ücretsiz, ticari kullanıma açık, anahtarsız):
 *  - Gri / Koyu / OSM: OpenFreeMap (Positron, Dark, Liberty stilleri), veri © OpenMapTiles, © OpenStreetMap katkıcıları (ODbL).
 *  - Topografik: OpenFreeMap Bright + kabartma gölgesi ve eş yükselti eğrileri (Terrain Tiles, AWS Açık Veri; maplibre-contour BSD-3).
 *  - Uydu: EOxCloudless 2016 (Sentinel-2 bulutsuz mozaik), CC BY 4.0, EOX IT Services GmbH. 2018 ve sonrası yıllar ticari
 *    kullanıma kapalı (CC BY-NC-SA) olduğundan bilerek 2016 katmanı kullanılır.
 *  - Altlık yok: altlıksız açık zemin (çizim ve çıktı için).
 * Altlık değişince araçların kendi katmanları (api.setData) korunur.
 */
(function () {
  'use strict';
  var H = {};
  var C = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; };
  var OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> katkıcıları';
  var OFM = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · ' + OSM;
  // Lisans sayfasındaki atıf metni (cloudless.eox.at/license-non-commercial, 2016 satırı)
  var EOX = '<a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless https://cloudless.eox.at</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 &amp; 2017), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>';
  // Yükseklik: Terrain Tiles (AWS Açık Veri; Mapzen/Tilezen), kaynakları ayrıca atıf ister
  var DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  var DEM_ATIF = 'Yükseklik: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> (Mapzen; ' +
    '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">kaynaklar</a>: EU-DEM © Copernicus, SRTM ve GMTED2010 USGS, ETOPO1 NOAA)';
  var OFM_STIL = 'https://tiles.openfreemap.org/styles/';
  var ALTLIK = {
    // OpenFreeMap stillerinin kaynakları kendi atıflarını taşır (OpenFreeMap, OpenMapTiles, OpenStreetMap); MapLibre bunları gösterir.
    gri: { ad: 'Gri', baslik: 'Açık gri tonlu sade harita; tematik veriyi öne çıkarır (OpenFreeMap Positron, OpenStreetMap verisi)', url: OFM_STIL + 'positron' },
    topo: { ad: 'Topografik', baslik: 'Kabartma gölgesi ve eş yükselti eğrileri (20 m, kalın 100 m; uzaklaştıkça seyrekleşir) ile renkli harita. Eğriler yaklaşık 30 m çözünürlüklü yükseklik verisinden üretilir; ölçme ya da proje için kullanılamaz.', url: OFM_STIL + 'bright' },
    uydu: { ad: 'Uydu', baslik: 'Sentinel-2 bulutsuz mozaik, 2016; yaklaşık 10 m çözünürlük, parsel düzeyinde ayrıntı vermez (EOxCloudless)' },
    koyu: { ad: 'Koyu', baslik: 'Koyu zeminli sade harita; açık renkli verileri öne çıkarır (OpenFreeMap Dark, OpenStreetMap verisi)', url: OFM_STIL + 'dark' },
    osm: { ad: 'OSM', baslik: 'OpenStreetMap verisiyle ayrıntılı standart harita: yol sınıfları, yapılar, ilgi noktaları (OpenFreeMap, OSM Liberty stili)', url: OFM_STIL + 'liberty' },
    bos: { ad: 'Altlık yok', baslik: 'Altlık haritasız açık zemin (çizim ve çıktı için)' }
  };
  var SIRA = ['osm', 'gri', 'topo', 'uydu', 'koyu', 'bos'];
  var KOYU_ZEMIN = { uydu: true, koyu: true }; // koyu zeminli altlıklarda koyu çizgiler beyaza çevrilir
  // Topografik altlık: kabartma gölgesi (MapLibre hillshade) + eş yükselti eğrileri (maplibre-contour, BSD-3; tarayıcıda üretilir)
  var demKaynak = null;
  function konturKur() {
    if (demKaynak) return Promise.resolve(demKaynak);
    var yukle = window.mlcontour ? Promise.resolve() : window.U.loadScript('https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.1/dist/index.min.js');
    return yukle.then(function () {
      if (!demKaynak) { demKaynak = new window.mlcontour.DemSource({ url: DEM_URL, encoding: 'terrarium', maxzoom: 13, worker: true, cacheSize: 100, timeoutMs: 15000 }); demKaynak.setupMaplibre(maplibregl); }
      return demKaynak;
    });
  }
  function topoEkle(st, dem) {
    var L = st.layers, i, sembol = -1, ulasim = -1, yazi = ['Noto Sans Regular'];
    for (i = 0; i < L.length; i++) {
      if (sembol < 0 && L[i].type === 'symbol') { sembol = i; if (L[i].layout && Array.isArray(L[i].layout['text-font'])) yazi = L[i].layout['text-font']; }
      if (ulasim < 0 && (L[i]['source-layer'] === 'transportation' || L[i]['source-layer'] === 'building')) ulasim = i;
    }
    if (sembol < 0) sembol = L.length; if (ulasim < 0 || ulasim > sembol) ulasim = sembol;
    st.sources._dem = { type: 'raster-dem', tiles: [dem.sharedDemProtocolUrl], encoding: 'terrarium', tileSize: 256, maxzoom: 13, attribution: DEM_ATIF };
    st.sources._kontur = { type: 'vector', maxzoom: 15, tiles: [dem.contourProtocolUrl({ thresholds: { 9: [200, 1000], 10: [100, 500], 11: [50, 250], 12: [20, 100], 13: [20, 100], 14: [10, 50], 15: [10, 50] }, elevationKey: 'ele', levelKey: 'level', contourLayer: 'kontur' })] };
    var cizgi = { id: '_kontur', type: 'line', source: '_kontur', 'source-layer': 'kontur', paint: { 'line-color': 'rgba(120,82,40,0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.1, 0.5] } };
    var etiket = { id: '_kontur-ad', type: 'symbol', source: '_kontur', 'source-layer': 'kontur', filter: ['>', ['get', 'level'], 0],
      layout: { 'symbol-placement': 'line', 'text-size': 10, 'text-field': ['number-format', ['get', 'ele'], {}], 'text-font': yazi },
      paint: { 'text-color': 'rgba(110,72,30,0.95)', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.2 } };
    var golge = { id: '_kabartma', type: 'hillshade', source: '_dem', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#4A3F2E', 'hillshade-highlight-color': '#FFFFFF' } };
    if (st.glyphs) L.splice(sembol, 0, cizgi, etiket); else L.splice(sembol, 0, cizgi); // yazı tipi tanımı yoksa yalnız çizgiler
    L.splice(ulasim, 0, golge);
    return st;
  }
  function bgLayer(color) { return { id: '_bg', type: 'background', paint: { 'background-color': color } }; }
  function offlineStyle() {
    return { version: 8, sources: { _tr: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: window.TA_TR || [] } } } },
      layers: [bgLayer(C('--map-sea')),
        { id: '_tr-fill', type: 'fill', source: '_tr', paint: { 'fill-color': C('--map-land') } },
        { id: '_tr-line', type: 'line', source: '_tr', paint: { 'line-color': C('--map-edge'), 'line-width': 0.8 } }] };
  }
  var stilOnbellek = {};
  function stilAl(key) {
    var a = ALTLIK[key];
    if (key === 'uydu') return Promise.resolve({ version: 8, sources: { _eox: { type: 'raster', tileSize: 256, maxzoom: 15, attribution: EOX,
      tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'] } }, layers: [bgLayer('#1d2326'), { id: '_eox', type: 'raster', source: '_eox' }] });
    if (key === 'bos') return Promise.resolve({ version: 8, sources: {}, layers: [bgLayer('#FBFBF8')] });
    if (!stilOnbellek[key]) stilOnbellek[key] = fetch(a.url).then(function (r) { if (!r.ok) throw new Error('Altlık stili alınamadı (' + r.status + ')'); return r.json(); })
      .catch(function (e) { delete stilOnbellek[key]; throw e; });
    var kopya = stilOnbellek[key].then(function (s) { return JSON.parse(JSON.stringify(s)); });
    return key === 'topo' ? Promise.all([kopya, konturKur()]).then(function (r) { return topoEkle(r[0], r[1]); }) : kopya;
  }
  // Uydu altlığında koyu çizgiler seçilemez; koyu çizgi rengi uyduda beyaza çevrilir.
  function koyuMu(c) { var m = /^#([0-9a-f]{6})$/i.exec(String(c || '').trim()); if (!m) return false; var n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255 < 0.6; }
  var KAYIT = 'topografya-altlik';
  function kayitli() { try { var k = localStorage.getItem(KAYIT); return ALTLIK[k] ? k : null; } catch (e) { return null; } }
  function kaydet(k) { try { localStorage.setItem(KAYIT, k); } catch (e) { /* özel pencere */ } }

  // MapLibre'yi gerektiğinde yükle (haritası isteğe bağlı araçlar için; sayfa açılışını ağırlaştırmaz)
  H.yukle = function () {
    if (window.maplibregl) return Promise.resolve();
    var V = '4.7.1', css = 'https://cdn.jsdelivr.net/npm/maplibre-gl@' + V + '/dist/maplibre-gl.css', sri = window.TOPO_SRI && window.TOPO_SRI[css];
    if (!document.querySelector('link[href="' + css + '"]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; if (sri) { l.integrity = sri; l.crossOrigin = 'anonymous'; } l.href = css; document.head.appendChild(l); }
    return window.U.loadScript('https://cdn.jsdelivr.net/npm/maplibre-gl@' + V + '/dist/maplibre-gl.js');
  };
  H.create = function (el, opts) {
    opts = opts || {};
    var online = window.TOPO_BASEMAP === 'openfreemap';
    var map = new maplibregl.Map({
      container: el, style: online ? { version: 8, sources: {}, layers: [bgLayer('#F2F1EC')] } : offlineStyle(),
      center: opts.center || [35.2, 39.1], zoom: opts.zoom || 5, attributionControl: false, preserveDrawingBuffer: !!opts.preserve, dragRotate: false, pitchWithRotate: false,
      // Türkiye'ye özgü tematik haritalar (nüfus, sınırlar): Türkiye ve yakın çevresi dışına kaydırılamaz (Kıbrıs ve komşu ülkelerin bir kısmı dahil; telefonda dikey ekranda bütün Türkiye sığsın diye kutu geniş)
      maxBounds: opts.sinirla ? [[12.0, 24.0], [58.5, 52.0]] : undefined
    });
    map.touchZoomRotate.disableRotation();
    // Türkiye görünümü: sabit yakınlaştırma yerine kutuya sığdırma (harita kutusunun boyuna göre tüm ülke görünür)
    if (opts.turkiye) { try { map.fitBounds([[25.6, 35.8], [44.8, 42.2]], { padding: 12, duration: 0 }); } catch (e) { /* boyutsuz kapsayıcı */ } map.once('load', function () { map.fitBounds([[25.6, 35.8], [44.8, 42.2]], { padding: 12, duration: 0 }); }); }
    (window.__haritalar = window.__haritalar || []).push(map); // testler için
    // kapsayıcı boyutu değişince (sekme açılması, yazı tipi yüklenmesi, ekran döndürme) haritayı yeniden boyutlandır
    try { new ResizeObserver(function () { map.resize(); }).observe(el); } catch (e) { window.addEventListener('resize', function () { map.resize(); }); }
    map.once('load', function () { map.resize(); });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    var attrCtl = null, ekAtif = '';
    function attrKur(html) {
      if (attrCtl) map.removeControl(attrCtl);
      var t = [html, ekAtif].filter(Boolean).join(' · ');
      attrCtl = new maplibregl.AttributionControl({ compact: true, customAttribution: t || undefined });
      map.addControl(attrCtl, 'bottom-right');
    }
    var tabanAtif = online ? '' : 'Türkiye sınırı: ' + OSM + ' (ODbL), topografya.com.tr derlemesi';
    attrKur(tabanAtif);
    var api = { map: map, layers: {}, altlik: online ? null : 'cevrimdisi' };
    var kendi = {}; // araçların kendi kaynakları (altlık değişince taşınır)
    api.ready = online ? new Promise(function (res) { if (map.isStyleLoaded()) res(); else map.once('style.load', res); })
      : new Promise(function (res) { if (map.loaded()) res(); else map.on('load', res); });
    // Altlık değiştir: yeni stil + mevcut araç kaynakları ve katmanları (sıralarıyla, en üstte)
    var istek = 0;
    api.setBasemap = function (key) {
      if (!online || !ALTLIK[key]) return Promise.resolve();
      var no = ++istek, onceki = api.ready, bitti;
      api.ready = new Promise(function (res) { bitti = res; });
      // Sıra: önceki geçiş bitmeden yenisi başlamaz; her istek kendi "bitti"sini mutlaka çözer (kilitlenme olmaz).
      function uygula(k) {
        return stilAl(k).then(function (base) {
          if (opts.sinirGizle && base.layers) base.layers = base.layers.filter(function (l) { return l['source-layer'] !== 'boundary'; });
          var cur = map.getStyle();
          Object.keys(cur.sources || {}).forEach(function (id) { if (kendi[id]) base.sources[id] = cur.sources[id]; });
          (cur.layers || []).forEach(function (l) { if (l.source && kendi[l.source]) base.layers.push(l); });
          return new Promise(function (res, rej) {
            // Stil geçersizse MapLibre 'style.load' yerine 'error' verir; beklemede kalmamak için hata da sonlandırır
            var bitti2 = false;
            function hata(e) { if (bitti2) return; bitti2 = true; map.off('error', hata); rej(e && e.error || new Error('Altlık stili yüklenemedi')); }
            map.on('error', hata);
            map.once('style.load', function () { if (bitti2) return; bitti2 = true; map.off('error', hata); api.altlik = k; attrKur(tabanAtif); secici(); renkUyarla(); if (opts.onBasemap) opts.onBasemap(k); res(); });
            map.setStyle(base, { diff: false });
          });
        });
      }
      return onceki.then(function () {
        if (no !== istek) return; // daha yeni bir seçim var; bu atlanır
        return uygula(key).catch(function (e) {
          console.warn(e); // altlık alınamazsa (ağ, servis) altlıksız zeminle devam; araç çalışmaya devam eder
          if (key !== 'bos') return uygula('bos').then(function () { yuklenemedi = ALTLIK[key] ? ALTLIK[key].ad : key; secici(); });
        });
      }).catch(function (e) { console.warn(e); }).then(function () { bitti(); });
    };
    // Altlık seçici (sol üst)
    var kutu = document.createElement('div');
    kutu.className = 'maplibregl-ctrl harita-altlik'; kutu.setAttribute('role', 'group'); kutu.setAttribute('aria-label', 'Altlık harita');
    // Açılır liste: kısa etiket "Altlık" + seçili altlığın adı; ayrıntı (kaynak, çözünürlük) seçeneklerin title'ında
    var yuklenemedi = null; // son başarısız altlık: seçicinin yanında kullanıcıya gösterilir (D3-30)
    function secici() {
      var not = yuklenemedi && api.altlik === 'bos' ? '<span class="harita-altlik-not" role="status">' + yuklenemedi + ' altlığı yüklenemedi; altlıksız gösteriliyor</span>' : '';
      if (api.altlik !== 'bos') yuklenemedi = null;
      kutu.innerHTML = '<label class="harita-altlik-lbl" for="' + map.getContainer().id + '-altlik">Altlık</label><select id="' + map.getContainer().id + '-altlik"' + (online ? '' : ' disabled') + ' title="' + (online ? 'Altlık haritayı seçin' : 'Önizlemede dış altlıklar yüklenemez; sitede çalışır') + '">' + SIRA.map(function (k) {
        var a = ALTLIK[k];
        return '<option value="' + k + '"' + (api.altlik === k ? ' selected' : '') + ' title="' + a.baslik + '">' + a.ad + '</option>';
      }).join('') + '</select>' + (online ? not : '<span class="harita-altlik-not">Önizlemede kapalı · sitede çalışır</span>');
    }
    secici();
    kutu.addEventListener('change', function (e) { var v = e.target.value; if (!ALTLIK[v]) return; kaydet(v); api.setBasemap(v); });
    map.addControl({ onAdd: function () { return kutu; }, onRemove: function () { kutu.remove(); } }, 'top-left');
    // Açılış altlığı: kullanıcının son seçimi; yoksa aracın önerdiği (tematik araçlarda Gri), o da yoksa OSM
    if (online) api.setBasemap(kayitli() || (ALTLIK[opts.altlik] ? opts.altlik : 'osm'));
    var _setData = function (id) { kendi[id] = true; };
    var asilRenk = {};
    function cizgiRengi(layerId, c) { asilRenk[layerId] = c; return KOYU_ZEMIN[api.altlik] && koyuMu(c) ? '#FFFFFF' : c; }
    function renkUyarla() { Object.keys(asilRenk).forEach(function (id) { if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', cizgiRengi(id, asilRenk[id])); }); }
    // Katman: tek kaynak, geometri türüne göre alan/çizgi/nokta katmanları
    api.setData = function (id, fc, st) {
      st = st || {}; _setData(id);
      var color = st.color || C('--amber'), line = st.line || C('--text');
      api.ready.then(function () {
        var src = map.getSource(id);
        if (src) { src.setData(fc); return; }
        map.addSource(id, { type: 'geojson', data: fc });
        var poly = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
        var lin = ['match', ['geometry-type'], ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'], true, false];
        var pt = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false];
        if (st.heat) {
          map.addLayer({ id: id + '-heat', type: 'heatmap', source: id, filter: pt, paint: { 'heatmap-radius': st.radius || 18, 'heatmap-opacity': .85,
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(242,169,0,0)', 0.25, 'rgba(242,169,0,.45)', 0.6, '#F2A900', 1, '#8A2B00'] } });
          return;
        }
        var fo = st.fillOpacity == null ? 0.25 : st.fillOpacity; asilOpak[id] = fo;
        map.addLayer({ id: id + '-fill', type: 'fill', source: id, maxzoom: st.maxZoom || 24, filter: poly, paint: { 'fill-color': st.fillExpr || color, 'fill-opacity': opakCarpan[id] == null ? fo : fo * opakCarpan[id] } });
        map.addLayer({ id: id + '-line', type: 'line', source: id, maxzoom: st.maxZoom || 24, filter: lin, paint: { 'line-color': cizgiRengi(id + '-line', line), 'line-width': st.width || 1.6, 'line-dasharray': st.dash || [1, 0] } });
        map.addLayer({ id: id + '-pt', type: 'circle', source: id, maxzoom: st.maxZoom || 24, filter: pt, paint: { 'circle-radius': st.radius || 4.5, 'circle-color': color, 'circle-stroke-color': line, 'circle-stroke-width': 1 } });
        api.layers[id] = [id + '-fill', id + '-line', id + '-pt'];
      });
    };
    // Sade (≈500 m) il sınırı parsel ölçeğinde yanıltıcı olacağından z 10'dan sonra gizlenir.
    // İl sınırları (bütün haritalı araçlar; kendi il katmanını çizen nüfus ve sınır araçlarında kapalı): veri deposundaki sade il
    // TopoJSON'unun yayları ince çizgi olarak çizilir. Dosya jsDelivr'den gelir, bir kez indirilir.
    if (opts.ilSinir !== false && window.TOPO_VERI_KOK && window.fetch && location.protocol !== 'file:') { // dosyadan açılan önizlemede fetch çalışmaz
      fetch(window.TOPO_VERI_KOK + 'sinirlar/il-sade.topo.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (t) {
        var sk = t.transform.scale, tr = t.transform.translate;
        var cizgi = t.arcs.map(function (a) { var x = 0, y = 0; return a.map(function (p) { x += p[0]; y += p[1]; return [x * sk[0] + tr[0], y * sk[1] + tr[1]]; }); });
        api.setData('_ilsinir', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: cizgi } }] }, { line: '#5F5F5F', width: 0.9, fillOpacity: 0, dash: [3, 2], maxZoom: 10 });
      }).catch(function () { /* il sınırı alınamazsa harita yine çalışır */ });
    }
    // Yer adı etiketleri (DOM): [{ ad, c: [boylam, enlem], tip: 'il'|'ilce', min, max }]; yalnız görünen alandaki ve yakınlaştırma aralığındakiler çizilir
    var etiketler = [], etiketIsaret = [];
    function etiketGuncelle() {
      if (!window.maplibregl) return;
      var z = map.getZoom(), b = map.getBounds(), w = b.getWest(), e2 = b.getEast(), so = b.getSouth(), n = b.getNorth();
      etiketIsaret.forEach(function (m) { m.remove(); }); etiketIsaret = [];
      // çakışma denetimi: liste önem sırasındadır; ekranda başka bir etiketle üst üste gelen etiket çizilmez
      var dolu = [];
      etiketler.forEach(function (x) {
        if (z < (x.min || 0) || z >= (x.max || 99) || x.c[0] < w || x.c[0] > e2 || x.c[1] < so || x.c[1] > n) return;
        var p = map.project(x.c), gw = String(x.ad).length * (x.tip === 'il' ? 7.6 : 6.4) + 6, gh = 15, k = [p.x - gw / 2, p.y - gh / 2, p.x + gw / 2, p.y + gh / 2];
        if (dolu.some(function (d) { return k[0] < d[2] && k[2] > d[0] && k[1] < d[3] && k[3] > d[1]; })) return;
        dolu.push(k);
        var d = document.createElement('div'); d.className = 'harita-etiket ' + (x.tip || ''); d.textContent = x.ad;
        etiketIsaret.push(new maplibregl.Marker({ element: d }).setLngLat(x.c).addTo(map));
      });
    }
    api.etiketler = function (liste) { etiketler = liste || []; api.ready.then(etiketGuncelle); };
    map.on('moveend', etiketGuncelle);
    // Ortak bilgi kutusu (bütün haritalı araçlar): fareyle üzerine gelince, dokunmatik ekranda dokununca birimin adı ve kısa bilgisi.
    // icerik(özellikler) → { ad, alt, satirlar: [] } ya da null. Nüfus haritası aynı görünümü kendi kutusuyla kullanır (.nf-ipucu).
    api.ipucu = function (katmanlar, icerik) {
      var kutu = document.createElement('div'); kutu.className = 'harita-ipucu'; kutu.hidden = true; el.appendChild(kutu);
      function bul(e) { var ls = katmanlar.filter(function (l) { return map.getLayer(l); }); return ls.length ? map.queryRenderedFeatures(e.point, { layers: ls })[0] : null; }
      function goster(e) {
        if (api._cizim) { kutu.hidden = true; return false; } // çizim sürerken gösterme (imleç çizim artısı kalır)
        var f = bul(e), b = f && icerik(f.properties || {});
        if (!b) { kutu.hidden = true; return false; }
        var es = function (x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
        kutu.innerHTML = '<strong>' + es(b.ad) + '</strong>' + (b.alt ? '<span>' + es(b.alt) + '</span>' : '') + (b.satirlar || []).map(function (x) { return '<em>' + es(x) + '</em>'; }).join('');
        kutu.hidden = false; kutu.style.left = Math.max(4, Math.min(el.clientWidth - 224, e.point.x + 14)) + 'px'; kutu.style.top = Math.min(el.clientHeight - 60, e.point.y + 14) + 'px';
        return true;
      }
      api.ready.then(function () {
        map.on('mousemove', function (e) { if (api._cizim) { kutu.hidden = true; return; } var v = goster(e); map.getCanvas().style.cursor = v ? 'pointer' : ''; });
        map.on('mouseout', function () { kutu.hidden = true; });
        map.on('click', goster);
      });
    };
    // Ortak seçim görünümü (bütün haritalı araçlar): seçili birim kalın koyu sınırla çizilir; seçili olmayanlar soluklaşır (SECIM.soluk)
    api.secimCiz = function (id, features) {
      api.setData(id, { type: 'FeatureCollection', features: (features || []).map(function (f) { return { type: 'Feature', properties: {}, geometry: f.geometry }; }) },
        { line: '#111111', width: 2.6, fillOpacity: 0, fillExpr: 'rgba(0,0,0,0)' });
    };
    // Opaklık denetimi (tematik katmanlar: alan dolguları ve görüntü katmanları): kullanıcı opaklığı %0–100 arasında ayarlar; katmanın kendi opaklığıyla çarpılır.
    // Seçim altlık değişince ve katman yeniden kurulunca korunur. katmanlar: setData kimlikleri, ör. ['nf-il', 'nf-ilce']
    var asilOpak = {}, opakCarpan = {}, asilRaster = {};
    api.saydamlik = function (katmanlar, opts) {
      opts = opts || {};
      var kutu2 = document.createElement('div'), kimlik = (map.getContainer().id || 'harita') + '-opak', v0 = opts.deger == null ? 100 : opts.deger;
      kutu2.className = 'maplibregl-ctrl harita-opak';
      kutu2.innerHTML = '<label for="' + kimlik + '">Opaklık</label><input type="range" id="' + kimlik + '" min="0" max="100" step="5" value="' + v0 + '" aria-valuetext="%' + v0 + '"><output for="' + kimlik + '">%' + v0 + '</output>';
      var inp = kutu2.querySelector('input'), out = kutu2.querySelector('output');
      function uygula() {
        var v = +inp.value / 100; out.textContent = '%' + inp.value; inp.setAttribute('aria-valuetext', '%' + inp.value);
        katmanlar.forEach(function (id) {
          opakCarpan[id] = v;
          if (map.getLayer(id + '-fill')) map.setPaintProperty(id + '-fill', 'fill-opacity', (asilOpak[id] == null ? 0.25 : asilOpak[id]) * v);
          if (map.getLayer(id + '-img')) map.setPaintProperty(id + '-img', 'raster-opacity', (asilRaster[id] == null ? 0.75 : asilRaster[id]) * v);
        });
      }
      inp.addEventListener('input', uygula);
      map.addControl({ onAdd: function () { return kutu2; }, onRemove: function () { kutu2.remove(); } }, opts.konum || 'top-left');
      uygula();
      return { el: kutu2, ayarla: function (v) { inp.value = v; uygula(); } };
    };
    // Araç verisinin atfı (ör. yükseklik verisi): altlık değişse de korunur
    api.ekAtif = function (html) { ekAtif = html || ''; attrKur(tabanAtif); };
    // Görüntü katmanı (ör. eğim haritası): url (data: ya da blob:), köşeler [[lon, lat] sol üst, sağ üst, sağ alt, sol alt]
    api.setImage = function (id, url, coords, opacity) {
      kendi[id] = true;
      return api.ready.then(function () {
        var src = map.getSource(id);
        if (opacity != null) asilRaster[id] = opacity;
        var ro = function () { var b = asilRaster[id] == null ? 0.75 : asilRaster[id]; return opakCarpan[id] == null ? b : b * opakCarpan[id]; };
        if (url == null) { if (map.getLayer(id + '-img')) map.setPaintProperty(id + '-img', 'raster-opacity', ro()); return; }
        if (src) { src.updateImage({ url: url, coordinates: coords }); }
        else { map.addSource(id, { type: 'image', url: url, coordinates: coords }); map.addLayer({ id: id + '-img', type: 'raster', source: id, paint: { 'raster-opacity': ro(), 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }); }
        if (map.getLayer(id + '-img')) map.setPaintProperty(id + '-img', 'raster-opacity', ro());
      });
    };
    api.remove = function (id) { api.ready.then(function () { ['-fill', '-line', '-pt', '-heat', '-img'].forEach(function (s) { if (map.getLayer(id + s)) map.removeLayer(id + s); }); if (map.getSource(id)) map.removeSource(id); }); };
    api.fit = function (b, maxZoom) { if (!b) return; api.ready.then(function () { var same = b[0] === b[2] && b[1] === b[3]; if (same) map.easeTo({ center: [b[0], b[1]], zoom: Math.max(map.getZoom(), 15) }); else map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, maxZoom: maxZoom || 17, duration: 0 }); }); };
    api.bboxOf = function (fc) { var b = [Infinity, Infinity, -Infinity, -Infinity]; (fc.features || []).forEach(function (f) { if (!f.geometry) return; (function w(x) { if (typeof x[0] === 'number') { b[0] = Math.min(b[0], x[0]); b[1] = Math.min(b[1], x[1]); b[2] = Math.max(b[2], x[0]); b[3] = Math.max(b[3], x[1]); } else x.forEach(w); })(f.geometry.coordinates || []); }); return isFinite(b[0]) ? b : null; };
    // tema değişince altlık renklerini yenile (yalnız çevrim dışı stil)
    function retheme() { if (online || !map.getLayer('_tr-fill')) return; map.setPaintProperty('_bg', 'background-color', C('--map-sea')); map.setPaintProperty('_tr-fill', 'fill-color', C('--map-land')); map.setPaintProperty('_tr-line', 'line-color', C('--map-edge')); }
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme); } catch (e) { /* eski tarayıcı */ }
    new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return api;
  };

  /* Basit çizim aracı: mode 'Point' | 'LineString' | 'Polygon'. onDone(feature). */
  H.drawer = function (api, onDone, onChange) {
    var map = api.map, mode = null, verts = [], hover = null;
    function sketch() {
      var f = [];
      if (verts.length) {
        var cs = hover ? verts.concat([hover]) : verts.slice();
        if (mode === 'Polygon' && cs.length >= 3) f.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [cs.concat([cs[0]])] } });
        else if (cs.length >= 2) f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: cs } });
        verts.forEach(function (c) { f.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }); });
      }
      api.setData('_sketch', { type: 'FeatureCollection', features: f }, { dash: [2, 1.5], radius: 3.5, fillOpacity: 0.15 });
      if (onChange) onChange(verts, mode);
    }
    function finish() {
      if (!mode) return;
      var g = null;
      // çift tıklama aynı yere iki köşe bırakır: ekranda 3 pikselden yakın ardışık köşeler (ve ilk köşeye denk gelen son köşe) atılır (D3-21)
      verts = verts.filter(function (v, i) { if (!i) return true; var a = map.project(verts[i - 1]), b = map.project(v); return Math.hypot(a.x - b.x, a.y - b.y) >= 3; });
      if (mode === 'Polygon' && verts.length > 3) { var f0 = map.project(verts[0]), fn = map.project(verts[verts.length - 1]); if (Math.hypot(f0.x - fn.x, f0.y - fn.y) < 3) verts.pop(); }
      if (mode === 'LineString' && verts.length >= 2) g = { type: 'LineString', coordinates: verts.slice() };
      if (mode === 'Polygon' && verts.length >= 3) g = { type: 'Polygon', coordinates: [verts.concat([verts[0]])] };
      verts = []; hover = null; sketch();
      if (g) onDone({ type: 'Feature', properties: {}, geometry: g });
    }
    map.on('click', function (e) {
      if (!mode) return;
      var c = [e.lngLat.lng, e.lngLat.lat];
      if (mode === 'Point') { onDone({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }); return; }
      // ilk noktaya tıklanınca alanı kapat
      if (mode === 'Polygon' && verts.length >= 3) { var p0 = map.project(verts[0]); if (Math.hypot(p0.x - e.point.x, p0.y - e.point.y) < 10) { finish(); return; } }
      verts.push(c); sketch();
    });
    map.on('dblclick', function (e) { if (mode && mode !== 'Point') { e.preventDefault(); if (verts.length && mode === 'LineString') verts.pop(); finish(); } });
    map.on('mousemove', function (e) { if (mode && mode !== 'Point' && verts.length) { hover = [e.lngLat.lng, e.lngLat.lat]; sketch(); } });
    document.addEventListener('keydown', function (e) {
      if (!mode) return;
      if (e.key === 'Escape') { verts = []; hover = null; sketch(); }
      else if (e.key === 'Enter') finish();
      else if (e.key === 'Backspace' && verts.length && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); verts.pop(); sketch(); }
    });
    return {
      setMode: function (m) { mode = m; api._cizim = m || null; verts = []; hover = null; sketch(); map.getCanvas().style.cursor = m ? 'crosshair' : ''; if (m && m !== 'Point') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable(); },
      finish: finish, undo: function () { verts.pop(); sketch(); }, cancel: function () { verts = []; hover = null; sketch(); },
      get mode() { return mode; }, get vertices() { return verts.slice(); }
    };
  };
  // seçim dışındaki birimlerin dolgu saydamlığı ve renk yardımcı işlevi (hex → rgba)
  H.SOLUK = 0.32;
  H.rgba = function (hex, a) { var h = String(hex).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
  // Bir alanın etiket noktası: en büyük çokgen halkasının alan ağırlık merkezi; dışta kalırsa halkanın içindeki bir köşe ortası
  H.etiketNoktasi = function (g) {
    if (!g) return null;
    var halkalar = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(function (p) { return p[0]; }) : [];
    var en = null, enA = -1;
    halkalar.forEach(function (r) { var a = 0; for (var i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] * r[i][1] - r[i][0] * r[j][1]); a = Math.abs(a / 2); if (a > enA) { enA = a; en = r; } });
    if (!en) return null;
    var cx = 0, cy = 0, A = 0;
    for (var i = 0, j = en.length - 1; i < en.length; j = i++) { var f = en[j][0] * en[i][1] - en[i][0] * en[j][1]; A += f; cx += (en[j][0] + en[i][0]) * f; cy += (en[j][1] + en[i][1]) * f; }
    var c = A ? [cx / (3 * A), cy / (3 * A)] : en[0];
    function icinde(p) { var k = false; for (var i = 0, j = en.length - 1; i < en.length; j = i++) { var xi = en[i][0], yi = en[i][1], xj = en[j][0], yj = en[j][1]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) k = !k; } return k; }
    if (icinde(c)) return c;
    // yatay tarama: ağırlık merkezinin enleminde halkayı kesen en geniş parçanın ortası
    var xs = []; for (var a = 0, b = en.length - 1; a < en.length; b = a++) { var y1 = en[a][1], y2 = en[b][1]; if ((y1 > c[1]) !== (y2 > c[1])) xs.push(en[a][0] + (c[1] - y1) * (en[b][0] - en[a][0]) / (y2 - y1)); }
    xs.sort(function (p, q) { return p - q; }); var best = null, bw = -1;
    for (var k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > bw) { bw = xs[k + 1] - xs[k]; best = [(xs[k] + xs[k + 1]) / 2, c[1]]; }
    return best || en[0];
  };
  window.HARITA = H;
})();


/* Pafta Bulucu arayüzü */
(window.TOOLS = window.TOOLS || {}).pafta = { init: function (root) {
  'use strict';
  var P = window.TA.P, F = window.TA.F, K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var S = K.SYSTEMS;
  U.zipper = function (name, data) { var o = {}; o[name] = typeof data === 'string' ? new TextEncoder().encode(data) : data; return F.zip(o); };
  var st = { mode: 'dosya', fc: null, base: 'pafta', table: null, res: null, point: null, name: null, drawn: false };
  var DEF_SCALES = ['100000', '50000', '25000', '10000', '5000', '2000', '1000'];
  var TEXT_H = { '100000': 1200, '50000': 600, '25000': 300, '10000': 150, '5000': 70, '2000': 35, '1000': 18, '500': 9 };
  var LABEL = {}; P.SCALES.forEach(function (s) { LABEL[s.key] = s.label; });

  // ---------- Ayarlar ----------
  var fs = $('#pf-scales');
  P.SCALES.forEach(function (s) {
    var l = document.createElement('label'); l.innerHTML = '<input type="checkbox" value="' + s.key + '"' + (DEF_SCALES.indexOf(s.key) >= 0 ? ' checked' : '') + '> ' + s.label; fs.appendChild(l);
    $('#pf-mscale').add(new Option(s.label, s.key));
  });
  $('#pf-mscale').insertBefore(new Option('Otomatik', 'auto'), $('#pf-mscale').firstChild); $('#pf-mscale').value = 'auto';
  function scales() { return U.$$('input:checked', fs).map(function (i) { return i.value; }); }
  function datum() { return $('#pf-datum').value; }
  function tol() { var v = K.parseNumber($('#pf-tol').value); return isFinite(v) && v >= 0 ? v : 5; }
  function datumNote() {
    $('#pf-datumnote').textContent = datum() === 'ED50'
      ? 'ED50 seçili: girdi ED50 coğrafi koordinatına dönüştürülerek bölünür (EPSG:1784). Eski (2005 öncesi) haritalar ve HGM topoğrafik paftaları için. Pafta çizgileri haritada gerçek yerinde (WGS84) gösterilir.'
      : 'TUREF seçili: 2018 yönetmeliğine göre üretilen haritalar. KML, GPX ve GeoJSON (WGS84) verisi doğrudan bu sistemdedir.';
  }
  datumNote();

  // kaynak ve çıktı sistemi listeleri
  var ORDER = ['geo-turef'].concat(K.TM_CMS.map(function (c) { return 'tm-turef-' + c; }), K.UTM_ZONES.map(function (z) { return 'utm-wgs84-' + z; }), ['geo-ed50'],
    K.TM_CMS.map(function (c) { return 'tm-ed50-' + c; }), K.UTM_ZONES.map(function (z) { return 'utm-ed50-' + z; }));
  function label(id) { var s = S[id]; return s.kind === 'geo' ? (s.datum === 'ED50' ? 'Coğrafi – ED50' : 'Coğrafi – WGS84 / TUREF') : s.label; }
  ORDER.forEach(function (id) { $('#pf-src').add(new Option(label(id), id)); $('#pf-ksys').add(new Option(label(id), id)); });
  function fillExpCrs() {
    var sel = $('#pf-ecrs'), prev = sel.value; sel.innerHTML = '';
    sel.add(new Option('Otomatik: ' + (datum() === 'ED50' ? 'ED50' : 'ITRF96') + ' 3° TM (paftanın dilimi)', 'auto-tm'));
    sel.add(new Option('Otomatik: ' + (datum() === 'ED50' ? 'ED50' : 'WGS84') + ' UTM', 'auto-utm'));
    ORDER.forEach(function (id) { sel.add(new Option(label(id), id)); });
    sel.value = prev || 'auto-tm';
  }
  fillExpCrs();

  function err(m) { var e = $('#pf-err'); e.textContent = m || ''; e.hidden = !m; }
  function warn(items) { var el = $('#pf-warn'); el.innerHTML = items.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join(''); el.hidden = !items.length; }
  function m2(v) { return v >= 1e6 ? U.num(v / 1e6, 3) + ' km²' : v >= 1e4 ? U.num(v, 0) + ' m² (' + U.num(v / 1e4, 2) + ' ha)' : U.num(v, 2) + ' m²'; }
  function mLen(v) { return v >= 1000 ? U.num(v / 1000, 3) + ' km' : U.num(v, 2) + ' m'; }
  function featName(f, i) { var p = f && f.properties || {}; var n = p.name || p.Name || p.ad || p.AD || p.adi || p.parsel || p.PARSEL || p.ada_parsel || p.label; return n != null && n !== '' ? String(n) : 'Detay ' + (i + 1); }
  function nameBtn(n) { return '<button type="button" class="pf-n" data-open="' + U.esc(n) + '">' + U.esc(n) + '</button>'; }

  // ---------- Harita ----------
  var api = window.HARITA.create($('#pf-map'), { center: [35.2, 39.0], zoom: 5, turkiye: true });
  // "Haritadaki ağ" seçicisi harita denetimi olarak altlık seçicinin altına; ardından opaklık
  (function () { var el = $('.pf-maptools'); if (el) { el.classList.add('maplibregl-ctrl'); api.map.addControl({ onAdd: function () { return el; }, onRemove: function () { el.remove(); } }, 'top-left'); } })();
  api.saydamlik(['pf-ag', 'pf-detay']); // tematik katman opaklığı
  var markers = [];
  function clearLabels() { markers.forEach(function (m) { m.remove(); }); markers = []; }
  // Etiket: pafta merkezi görünmeyebilir; odak noktası (detayın merkezi) varsa paftanın ona en yakın iç noktasına konur
  // Pafta adları: her paftanın ortasına, sığdığı kadarıyla. Hücre tam adı alacak kadar genişse tam ad; değilse
  // bütün paftalarda ortak olan baş kısım atılıp kalan son ekler (…-a-3-b) yazılır, ortak kısım haritanın altında bir kez
  // gösterilir; ek de sığmıyorsa ad yazılmaz (çakışma olmaz). Yakınlaştırınca yeniden hesaplanır.
  var lblList = [];
  function ortakOnek(ns) {
    if (ns.length < 2) return '';
    var a = ns[0].split('-'), k = a.length;
    ns.forEach(function (n) { var b = n.split('-'), i = 0; while (i < k && i < b.length - 1 && a[i] === b[i]) i++; k = i; });
    return k ? a.slice(0, k).join('-') : '';
  }
  function yerlestir() {
    if (!api.map) return;
    var CH = 6.9, PAD = 12, onek = ortakOnek(lblList.map(function (x) { return x.n; })), kisaldi = false;
    lblList.forEach(function (x) {
      var p0 = api.map.project([x.b[0], x.b[3]]), p1 = api.map.project([x.b[2], x.b[1]]), w = Math.abs(p1.x - p0.x), h = Math.abs(p1.y - p0.y);
      var kisa = onek && x.n.length > onek.length ? '…' + x.n.slice(onek.length) : x.n, t = '';
      if (h >= 22 && w >= x.n.length * CH + PAD) t = x.n; else if (h >= 18 && w >= kisa.length * CH + PAD) { t = kisa; kisaldi = kisaldi || kisa !== x.n; }
      x.el.textContent = t; x.el.style.display = t ? '' : 'none'; x.el.title = x.n;
    });
    var not = $('#pf-lblnot'); if (not) { not.hidden = !kisaldi; not.textContent = kisaldi ? 'Haritada adlar kısaltıldı; baştaki ortak kısım: ' + onek + ' (tam ad için yakınlaştırın).' : ''; }
  }
  api.ready.then(function () { api.map.on('zoomend', yerlestir); api.map.on('resize', yerlestir); });
  api.ipucu(['pf-ag-fill'], function (p) { return p.n ? { ad: String(p.n), alt: 'Pafta', satirlar: +p.sec === 1 ? ['Detayınız bu paftaya düşüyor'] : [] } : null; }); // ortak bilgi kutusu
  function drawSheets(list, hl) {
    clearLabels(); lblList = [];
    var feats = list.map(function (n) { var f = P.sheetFeature(n, datum()); f.properties = { n: n, sec: hl && hl.indexOf(n) >= 0 ? 1 : 0 }; return f; });
    api.setData('pf-ag', { type: 'FeatureCollection', features: feats }, { line: U.cssVar('--text'), width: 1.3, fillOpacity: 0.12, fillExpr: ['case', ['==', ['get', 'sec'], 1], '#F2A900', 'rgba(255,255,255,0.01)'] });
    if (list.length > 150) { yerlestir(); return; }
    api.ready.then(function () {
      feats.forEach(function (f) {
        var r = f.geometry.coordinates[0], x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        r.forEach(function (c) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); });
        var el = document.createElement('div'); el.className = 'pf-lbl' + (f.properties.sec ? ' on' : '');
        markers.push(new maplibregl.Marker({ element: el }).setLngLat([(x0 + x1) / 2, (y0 + y1) / 2]).addTo(api.map));
        lblList.push({ n: f.properties.n, el: el, b: [x0, y0, x1, y1] });
      });
      yerlestir();
    });
  }
  function drawDetail(fc) { api.setData('pf-detay', fc || { type: 'FeatureCollection', features: [] }, { color: '#F2A900', line: '#8A2B00', width: 2, fillOpacity: 0.35, radius: 5 }); }

  // çizim
  var drawer = window.HARITA.drawer(api, function (feat) {
    var fc = st.fc || { type: 'FeatureCollection', features: [] }; // çizimler haritadaki parsellere eklenir
    feat.properties = { ad: (feat.geometry.type === 'Polygon' ? 'Çizilen alan ' : feat.geometry.type === 'LineString' ? 'Çizilen çizgi ' : 'Çizilen nokta ') + (fc.features.length + 1) };
    fc.features.push(feat); st.fc = fc; st.drawn = true; st.base = 'cizim';
    if (feat.geometry.type !== 'Point') setDraw(null);
    $('#pf-srcw').hidden = true; warn([]); runFile(false);
    // uzaktan konan noktaya yaklaşılır (paftası görünsün)
    if (feat.geometry.type === 'Point' && api.map.getZoom() < 14) { var c = feat.geometry.coordinates; api.map.easeTo({ center: c, zoom: 15, duration: 1000 }); }
  });
  function setDraw(m) {
    drawer.setMode(m); $('#pf-drawhint').hidden = !m || m === 'Point';
    U.$$('[data-draw]', root).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.draw === m ? 'true' : 'false'); });
  }
  U.$$('[data-draw]', root).forEach(function (b) { b.addEventListener('click', function () { if (st.mode !== 'dosya') return; setDraw(drawer.mode === b.dataset.draw ? null : b.dataset.draw); }); });

  // ---------- Dosya ----------
  var drop = $('#pf-drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { e.stopPropagation(); root.classList.remove('pf-surukle'); handleFiles(e.dataTransfer.files); });
  // Dosya aracın herhangi bir yerine (harita dahil) bırakılabilir: sekme Dosya'ya geçer
  var surSay = 0;
  root.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); surSay++; root.classList.add('pf-surukle'); } });
  root.addEventListener('dragover', function (e) { if (root.classList.contains('pf-surukle')) e.preventDefault(); });
  root.addEventListener('dragleave', function () { if (--surSay <= 0) { surSay = 0; root.classList.remove('pf-surukle'); } });
  root.addEventListener('drop', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); surSay = 0; root.classList.remove('pf-surukle');
    if (st.mode !== 'dosya') U.$('.subtabs[data-group="pf"]', root)._select('dosya');
    handleFiles(e.dataTransfer.files);
  });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#pf-file').click(); } });
  $('#pf-file').addEventListener('change', function (e) { handleFiles(e.target.files); e.target.value = ''; });
  function handleFiles(list) {
    var files = Array.prototype.slice.call(list || []); if (!files.length) return;
    err(''); setDraw(null);
    Promise.all(files.map(function (f) { return f.arrayBuffer().then(function (b) { return { name: f.name, data: new Uint8Array(b) }; }); })).then(function (arr) {
      var main = arr.filter(function (x) { return /\.(shp|kml|kmz|geojson|json|gpx|dxf|csv|txt|tsv|ncn|wkt|zip)$/i.test(x.name); })[0] || arr[0];
      st.base = main.name.replace(/\.[^.]+$/, '').replace(/^.*[\\/]/, '') || 'pafta';
      ingest(F.readFiles(arr), st.base);
    }).catch(function (e) { err('Dosya okunamadı: ' + (e.message || e)); });
  }
  // Birden çok parsel: yeni dosya ya da çizim haritadakilere eklenir (st.onceki, WGS84); "Temizle" hepsini kaldırır
  function adlandir(fc, ad) { (fc.features || []).forEach(function (f, i) { f.properties = f.properties || {}; if (!f.properties.ad && !f.properties.name) f.properties.ad = ad + (fc.features.length > 1 ? ' ' + (i + 1) : ''); }); return fc; }
  function ingest(r, adi) {
    st.onceki = st.fc && st.fc.features && st.fc.features.length ? st.fc : null; st.yeniAd = adi || 'Parsel';
    st.drawn = false; st.table = null; $('#pf-tbl').hidden = true;
    warn(r.warnings || []);
    if (r.table) {
      st.table = r.table;
      var opts = '<option value="-1">—</option>' + r.table.header.map(function (h, i) { return '<option value="' + i + '">' + U.esc(h) + '</option>'; }).join('');
      $('#pf-ca').innerHTML = opts; $('#pf-cb').innerHTML = opts; $('#pf-ca').value = r.table.guess.a; $('#pf-cb').value = r.table.guess.b;
      $('#pf-tbl').hidden = false; $('#pf-srcw').hidden = false;
      $('#pf-src').value = r.table.guess.geo ? 'geo-turef' : ($('#pf-src').value && S[$('#pf-src').value].kind === 'proj' ? $('#pf-src').value : 'tm-turef-33');
      $('#pf-srcnote').textContent = r.table.guess.geo ? 'Değerler coğrafi koordinat gibi görünüyor.' : 'Projeksiyon koordinatı: 3° TM orta meridyenini ve datumu denetleyin.';
      applyTable(); return;
    }
    st.fc = r.fc; st.srcFc = r.fc;
    $('#pf-src').value = r.crs; $('#pf-srcw').hidden = !!(r.crsSure && S[r.crs].kind === 'geo' && /KML|KMZ|GPX|GeoJSON/.test(r.format));
    $('#pf-srcnote').textContent = r.crsSure ? r.format + ' dosyasından algılandı.' : 'Tahmin edildi; dosyanın sistemini bilmiyorsanız denetleyin (ör. 3° TM orta meridyeni).';
    reprojectAndRun();
  }
  function applyTable() {
    var t = st.table; if (!t) return;
    var cols = { a: +$('#pf-ca').value, b: +$('#pf-cb').value, z: -1, wkt: -1, geo: S[$('#pf-src').value].kind === 'geo' };
    if (cols.a < 0 || cols.b < 0) { err('Koordinat sütunlarını seçin.'); return; }
    var r = F.tableToFC(t, cols);
    if (!r.fc.features.length) { err('Seçilen sütunlarda okunabilir koordinat yok.'); return; }
    warn(r.skipped.length ? [r.skipped.length + ' satır okunamadı (satır ' + r.skipped.slice(0, 10).join(', ') + (r.skipped.length > 10 ? '…' : '') + ').'] : []);
    st.srcFc = r.fc; reprojectAndRun();
  }
  $('#pf-capply').addEventListener('click', applyTable);
  $('#pf-src').addEventListener('change', function () { if (st.table) applyTable(); else if (st.srcFc) reprojectAndRun(); });
  function reprojectAndRun() {
    err('');
    try {
      var yeni = adlandir($('#pf-src').value === 'geo-turef' ? st.srcFc : F.reproject(st.srcFc, $('#pf-src').value, 'geo-turef'), st.yeniAd || 'Parsel');
      st.fc = st.onceki ? { type: 'FeatureCollection', features: st.onceki.features.concat(yeni.features) } : yeni;
    }
    catch (e) { err('Koordinat dönüşümü yapılamadı: ' + e.message); return; }
    runFile(true);
  }
  function runFile(fit) {
    if (!st.fc) return;
    err('');
    var sc = scales(); if (!sc.length) { err('En az bir ölçek seçin.'); return; }
    try { st.res = P.intersect(st.fc, { scales: sc, datum: datum(), tolerance: tol(), limit: 3000 }); }
    catch (e) { st.res = null; $('#pf-out').innerHTML = ''; $('#pf-exp').hidden = true; drawDetail(st.fc); err(e.message); return; }
    $('#pf-temizle').hidden = false;
    drawDetail(st.fc); renderFile(); mapGrid();
    if (fit) { var b = api.bboxOf(st.fc); if (b) api.fit(b, 16); }
    fillScope();
  }
  function renderFile() {
    var r = st.res, t = r.totals, h = [];
    var parts = [t.features + ' detay']; if (t.area) parts.push('alan ' + m2(t.area)); if (t.length) parts.push('uzunluk ' + mLen(t.length)); if (t.points) parts.push(t.points + ' nokta');
    h.push('<div class="result-head"><span class="eyebrow">Girdi · ' + (datum() === 'ED50' ? 'ED50 paftaları' : 'TUREF paftaları') + '</span><span class="big">' + parts.join(' · ') + '</span><span class="meta">Alanlar elipsoit üzerinde jeodezik olarak hesaplanmıştır. Pafta adına tıklayarak köşe koordinatlarını ve komşularını görün.</span></div>');
    var ust = [];
    if (t.features > 1) {
      // detay başına pafta listesi (en ince ölçek)
      var fin = r.scales.filter(function (s) { return !s.skipped; }).slice(-1)[0];
      if (fin) {
        var rows = st.fc.features.map(function (f, i) { return { i: i, n: featName(f, i), list: fin.sheets.filter(function (x) { return x.features.indexOf(i) >= 0; }).map(function (x) { return x.name; }) }; }).filter(function (x) { return x.list.length; });
        ust.push('<details class="pf-det" open><summary>Detay başına paftalar (' + fin.label + ')</summary><div class="scroll"><table class="t"><thead><tr><th>Detay</th><th>Paftalar</th></tr></thead><tbody>' +
          rows.slice(0, 500).map(function (x) { return '<tr><td>' + U.esc(x.n) + '</td><td class="m">' + x.list.map(nameBtn).join(' ') + '</td></tr>'; }).join('') + '</tbody></table></div>' + (rows.length > 500 ? '<p class="hint">İlk 500 detay gösterildi; tamamı için CSV indirin.</p>' : '') + '</details>');
      }
    }
    h.push(ust.join(''));
    // ölçeklere göre paftalar, alan ve paylar: açılıp kapanabilir (birden çok parselde liste uzar)
    h.push('<details class="pf-olcekler" open><summary>Ölçeklere göre paftalar, alan ve paylar</summary>');
    r.scales.forEach(function (s) {
      if (s.skipped) { h.push('<div class="card"><h3 class="pf-h">' + s.label + '</h3><p class="hint">' + U.esc(s.skipped) + '</p></div>'); return; }
      var names = s.sheets.map(function (x) { return x.name; });
      h.push('<div class="pf-scale"><div class="pf-sh"><h3 class="pf-h">' + s.label + '</h3><span class="meta">' + s.sheets.length + ' pafta</span>' + U.copyBtn(names.join('\n')) + '</div><div class="scroll"><table class="t"><thead><tr><th>Pafta</th>' +
        (t.area ? '<th class="num">Alan</th><th class="num">Pay</th>' : '') + (t.length ? '<th class="num">Uzunluk</th>' + (t.area ? '' : '<th class="num">Pay</th>') : '') + (t.points ? '<th class="num">Nokta</th>' : '') + '<th></th></tr></thead><tbody>');
      s.sheets.forEach(function (x) {
        var note = x.nearEdge ? '<span class="badge no" title="Detay bu paftaya en fazla ' + U.num(x.depth, 1) + ' m giriyor">kenarda ' + U.num(x.depth, 1) + ' m</span>' : '';
        h.push('<tr' + (x.nearEdge ? '' : '') + '><td class="m">' + nameBtn(x.name) + '</td>' +
          (t.area ? '<td class="num">' + (x.area ? m2(x.area) : '—') + '</td><td class="num">' + (x.area ? U.num(x.share, x.share < 1 ? 3 : 2) + ' %' : '—') + '</td>' : '') +
          (t.length ? '<td class="num">' + (x.length ? mLen(x.length) : '—') + '</td>' + (t.area ? '' : '<td class="num">' + U.num(x.share, 2) + ' %</td>') : '') +
          (t.points ? '<td class="num">' + (x.points || '—') + '</td>' : '') + '<td>' + note + '</td></tr>');
      });
      h.push('</tbody></table></div>');
      if (s.edgeWarn && s.edgeWarn.length) {
        h.push('<ul class="warnlist">' + s.edgeWarn.slice(0, 20).map(function (w) { return '<li>' + U.esc(featName(st.fc.features[w.feature], w.feature)) + ' tamamen ' + U.esc(w.sheet) + ' paftasında, ancak pafta çizgisine ' + U.num(w.distance, 2) + ' m. Konum belirsizliği bundan büyükse komşu paftayı da denetleyin.</li>'; }).join('') + (s.edgeWarn.length > 20 ? '<li>… ' + (s.edgeWarn.length - 20) + ' detay daha</li>' : '') + '</ul>');
      }
      h.push('</div>');
    });
    h.push('</details>');
    $('#pf-out').innerHTML = h.join('');
    $('#pf-exp').hidden = false;
  }
  function mapGrid() {
    if (!st.res) return;
    var avail = st.res.scales.filter(function (s) { return !s.skipped && s.sheets.length; }), v = $('#pf-mscale').value, pick = null;
    if (v !== 'auto') pick = avail.filter(function (s) { return s.scale === v; })[0];
    if (!pick) { pick = avail.filter(function (s) { return s.sheets.length <= 40; }).slice(-1)[0] || avail[0]; }
    if (!pick) { drawSheets([]); return; }
    var bb = st.res.bbox, foc = bb ? (datum() === 'ED50' ? P.fromDatum('ED50')([(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]) : [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]) : null;
    drawSheets(pick.sheets.map(function (x) { return x.name; }), pick.sheets.filter(function (x) { return !x.nearEdge; }).map(function (x) { return x.name; }), foc);
  }
  $('#pf-mscale').addEventListener('change', function () { if (st.mode === 'dosya') mapGrid(); else if (st.mode === 'koord' && st.point) runPoint(false); });
  $('#pf-temizle').addEventListener('click', function () { st.fc = null; st.onceki = null; st.srcFc = null; st.res = null; st.drawn = false; st.table = null; setDraw(null); drawDetail(null); drawSheets([]); $('#pf-out').innerHTML = ''; $('#pf-exp').hidden = true; $('#pf-temizle').hidden = true; $('#pf-srcw').hidden = true; $('#pf-tbl').hidden = true; warn([]); err(''); });
  $('#pf-ornek').addEventListener('click', function () {
    // pafta köşesine düşen örnek parsel (G25-d-01-d / -c / G25-d-06-a / -b birleşimi)
    var c = [30.525, 40.70], dx = 0.0011, dy = 0.0008;
    st.srcFc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { ad: 'Örnek parsel 101/5' }, geometry: { type: 'Polygon', coordinates: [[[c[0] - dx * 1.3, c[1] - dy * 0.7], [c[0] + dx * 0.4, c[1] - dy * 1.1], [c[0] + dx * 0.9, c[1] + dy * 0.2], [c[0] + dx * 0.2, c[1] + dy * 1.0], [c[0] - dx * 1.0, c[1] + dy * 0.8], [c[0] - dx * 1.3, c[1] - dy * 0.7]]] } }] };
    st.onceki = null; st.table = null; st.drawn = false; $('#pf-tbl').hidden = true; $('#pf-src').value = 'geo-turef'; $('#pf-srcw').hidden = true; warn([]); st.base = 'ornek_parsel';
    reprojectAndRun();
  });

  // ---------- Koordinat ----------
  function kLabels() {
    var geo = S[$('#pf-ksys').value].kind === 'geo';
    $('#pf-k1l').firstChild.textContent = geo ? 'Enlem' : 'Y (sağa değer)';
    $('#pf-k2l').firstChild.textContent = geo ? 'Boylam' : 'X (yukarı değer)';
    $('#pf-k1').placeholder = geo ? '40°42\'30" ya da 40,7083' : '500 000,00';
    $('#pf-k2').placeholder = geo ? '30°30\'30" ya da 30,5083' : '4 506 000,00';
  }
  $('#pf-ksys').addEventListener('change', function () { var p = st.point; kLabels(); if (p) setInputs(p); });
  kLabels();
  function setInputs(g) {
    var id = $('#pf-ksys').value, s = S[id];
    if (s.kind === 'geo') { var q = id === 'geo-turef' ? g : K.transform('geo-turef', id, g); $('#pf-k1').value = U.plain(q.lat, 7).replace('.', ','); $('#pf-k2').value = U.plain(q.lon, 7).replace('.', ','); }
    else { var p = K.transform('geo-turef', id, g); $('#pf-k1').value = U.plain(p.y, 2).replace('.', ','); $('#pf-k2').value = U.plain(p.x, 2).replace('.', ','); }
  }
  function readInputs() {
    var id = $('#pf-ksys').value, s = S[id], a, b;
    if (s.kind === 'geo') { a = K.parseAngle($('#pf-k1').value, 'lat'); b = K.parseAngle($('#pf-k2').value, 'lon'); if (!isFinite(a) || !isFinite(b)) throw new Error('Enlem ve boylamı derece (40,7083) ya da derece-dakika-saniye (40°42\'30") olarak girin.'); return id === 'geo-turef' ? { lat: a, lon: b } : K.transform(id, 'geo-turef', { lat: a, lon: b }); }
    a = K.parseNumber($('#pf-k1').value); b = K.parseNumber($('#pf-k2').value);
    if (!isFinite(a) || !isFinite(b)) throw new Error('Y ve X değerlerini metre olarak girin.');
    if (a > 1e6 || b < 3e6) throw new Error('Y (sağa, ~200 000–800 000) ile X (yukarı, ~4 000 000–4 700 000) yer değiştirmiş olabilir.');
    return K.transform(id, 'geo-turef', { y: a, x: b });
  }
  function runPoint(fit) {
    err('');
    var g = st.point, fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { ad: 'Nokta' }, geometry: { type: 'Point', coordinates: [g.lon, g.lat] } }] };
    var r; try { r = P.intersect(fc, { scales: P.SCALES.map(function (s) { return s.key; }), datum: datum(), tolerance: tol() }); } catch (e) { err(e.message); return; }
    st.res = r; drawDetail(fc);
    var dg = datum() === 'ED50' ? K.transform('geo-turef', 'geo-ed50', g) : g;
    var h = ['<div class="result-head"><span class="eyebrow">Nokta · ' + (datum() === 'ED50' ? 'ED50' : 'TUREF') + '</span><span class="big">' + U.esc(P.toDMS(dg.lat, true)) + '  ' + U.esc(P.toDMS(dg.lon, false)) + '</span><span class="meta">' + (datum() === 'ED50' ? 'ED50 coğrafi koordinatı (WGS84: ' + U.plain(g.lat, 6) + ', ' + U.plain(g.lon, 6) + ')' : 'Enlem ' + U.plain(g.lat, 7) + ' · boylam ' + U.plain(g.lon, 7)) + '</span></div>'];
    h.push('<div class="scroll"><table class="t"><thead><tr><th>Ölçek</th><th>Pafta</th><th class="num">Pafta çizgisine</th><th></th></tr></thead><tbody>');
    var a250 = r.scales.length ? P.ad250(r.scales[0].sheets[0].name) : null;
    if (a250) h.push('<tr><td class="m">1/250.000</td><td class="m">' + U.esc(a250.onek) + ' ' + U.copyBtn(a250.onek) + ' <span class="meta">(' + (a250.bugun ? 'bugün ' + U.esc(a250.bugun) + ' · ' : '') + a250.kapsam + ')</span></td><td></td><td></td></tr>');
    r.scales.forEach(function (s) { var x = s.sheets[0]; h.push('<tr><td class="m">' + s.label + '</td><td class="m">' + nameBtn(x.name) + ' ' + U.copyBtn(x.name) + '</td><td class="num">' + U.num(x.depth, 1) + ' m</td><td>' + (x.nearEdge ? '<span class="badge no">sınırda</span>' : '') + '</td></tr>'); });
    h.push('</tbody></table></div><p class="hint">Pafta çizgisine uzaklık, noktanın bulunduğu paftanın en yakın kenarına olan yaklaşık uzaklıktır. Konum belirsizliğinden küçükse nokta komşu paftada da olabilir.</p>');
    $('#pf-out').innerHTML = h.join(''); $('#pf-exp').hidden = false; fillScope();
    var v = $('#pf-mscale').value, sk = v === 'auto' ? '1000' : v, nm = r.scales.filter(function (s) { return s.scale === sk; })[0].sheets[0].name, nb = P.neighbors(nm), list = [nm];
    Object.keys(nb).forEach(function (k) { if (nb[k]) list.push(nb[k].name); });
    drawSheets(list, [nm]); st.noktaPafta = nm;
    if (fit) { var b = P.sheetFeature(nm, datum()).geometry.coordinates[0]; var bb = api.bboxOf({ features: [{ geometry: { coordinates: [b] } }] }); api.fit(bb, 17); }
  }
  $('#pf-kbul').addEventListener('click', function () { try { st.point = readInputs(); runPoint(true); } catch (e) { err(e.message); } });
  ['#pf-k1', '#pf-k2'].forEach(function (s) { $(s).addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#pf-kbul').click(); }); });
  // Haritaya tıklama (çizim yokken): pafta adı görünümünde ya da yüklü dosyada bir pafta hücresine tıklanırsa o pafta açılır;
  // diğer her durumda tıklanan noktanın paftaları bulunur (sekme Koordinat'a geçer).
  function noktaAc(g, sigdir) {
    st.point = g; var sek = U.$('.subtabs[data-group="pf"]', root);
    if (st.mode !== 'koord') sek._select('koord');
    setInputs(g); runPoint(sigdir);
  }
  api.ready.then(function () {
    api.map.on('click', function (e) {
      if (drawer.mode) return;
      var hucre = api.map.getLayer('pf-ag-fill') ? api.map.queryRenderedFeatures(e.point, { layers: ['pf-ag-fill'] })[0] : null;
      if (hucre && (st.mode === 'ad' || (st.mode === 'dosya' && st.fc))) { openName(hucre.properties.n); return; }
      noktaAc({ lat: e.lngLat.lat, lon: e.lngLat.lng }, false);
      // Tıklanan noktanın paftasına yumuşakça yaklaşılır (uzaktan tıklanınca pafta görünmüyordu); zaten yakındaysa harita yerinde kalır
      if (st.noktaPafta && api.map.getZoom() < 14) {
        var bb = api.bboxOf({ features: [P.sheetFeature(st.noktaPafta, datum())] });
        if (bb) api.map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 60, maxZoom: 16, duration: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200 });
      }
    });
  });
  // Hızlı arama: pafta adı ya da koordinat (enlem boylam; ondalık ya da derece-dakika-saniye; seçili TM/UTM sisteminde Y X)
  function hizliAra() {
    err(''); var t = $('#pf-ara').value.trim(); if (!t) return;
    try { var p = P.fromName(t); openName(p.name); return; } catch (e) { /* ad değil */ }
    // 1/250.000 pafta adı (ör. ANKARA): kapsadığı altı 1/100.000 paftası listelenir (Claude denetimi D3-23)
    var a250 = P.ara250(t);
    if (a250) {
      U.$('.subtabs[data-group="pf"]', root)._select('ad'); st.res = null; st.name = null; $('#pf-exp').hidden = true; drawDetail(null);
      $('#pf-out').innerHTML = '<div class="eyebrow">1/250.000 pafta</div><div class="big">' + U.esc(a250.ad.toLocaleUpperCase('tr-TR')) + '</div>' + (a250.bugun ? '<p class="hint">Bugünkü adı: ' + U.esc(a250.bugun) + '</p>' : '') +
        '<p>Kapsadığı 1/100.000 paftaları (ayrıntı için seçin):</p><div class="actions">' + a250.paftalar.map(function (n) { return '<button type="button" class="btn ghost sm" data-open="' + U.esc(n) + '">' + U.esc(a250.ad.toLocaleUpperCase('tr-TR') + '-' + n) + '</button>'; }).join('') + '</div>';
      api.ready.then(function () { var b = a250.bounds; api.map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 40, duration: 0 }); });
      return;
    }
    // MGRS (ör. 36S VK 89019 18690)
    if (/^\d{1,2}\s*[C-HJ-NP-X]\s*[A-HJ-NP-Z]{2}\s*\d/i.test(t)) { try { noktaAc(K.fromMGRS(t), true); return; } catch (e) { /* MGRS değil */ } }
    var parca = /;/.test(t) ? t.split(/\s*;\s*/) : t.split(/\s+/).filter(Boolean);
    // boşluklu derece dakika saniye: "39 55 14.88 32 51 14.76"
    if (parca.length === 6 && parca.every(function (x) { return isFinite(K.parseNumber(x)); })) parca = [parca.slice(0, 3).join(' '), parca.slice(3).join(' ')];
    // dilim önekli TM: "TM33 487175,983 4420657,093" ya da "33 487175.983 4420657.093"
    if (parca.length === 3) {
      var dz = /^(?:TM)?(27|30|33|36|39|42|45)$/i.exec(parca[0]), y3 = K.parseNumber(parca[1]), x3 = K.parseNumber(parca[2]);
      if (dz && y3 > 1e5 && y3 < 9e5 && x3 > 3.9e6 && x3 < 4.8e6) { var did = 'tm-turef-' + dz[1]; /* girilen koordinat TUREF kabul edilir (ED50 için Koordinat sekmesi) */ noktaAc(K.transform(did, 'geo-turef', { y: y3, x: x3 }), true); return; }
    }
    if (parca.length === 1 && /^-?\d+\.\d+,-?\d+\.\d+$/.test(t)) parca = t.split(',');
    if (parca.length === 2) {
      var a = K.parseAngle(parca[0], 'lat'), b = K.parseAngle(parca[1], 'lon');
      if (isFinite(a) && isFinite(b) && a > 34 && a < 44 && b > 24 && b < 47) { noktaAc({ lat: a, lon: b }, true); return; }
      // ters sıra (boylam, enlem): yer değiştirip açar ve bildirir
      var a2 = K.parseAngle(parca[1], 'lat'), b2 = K.parseAngle(parca[0], 'lon');
      if (isFinite(a2) && isFinite(b2) && a2 > 34 && a2 < 44 && b2 > 24 && b2 < 47 && !(a > 34 && a < 44)) { noktaAc({ lat: a2, lon: b2 }, true); U.toast('Değerler boylam, enlem sırasında görünüyor; enlem ' + U.num(a2, 4) + '°, boylam ' + U.num(b2, 4) + '° olarak açıldı.'); return; }
      var y = K.parseNumber(parca[0]), x = K.parseNumber(parca[1]);
      if (isFinite(y) && isFinite(x)) {
        if (y > 3e6 && x < 1e6) { var tmp = y; y = x; x = tmp; }
        if (y > 1e5 && y < 9e5 && x > 3.9e6 && x < 4.8e6) {
          var id = $('#pf-ksys').value;
          if (S[id].kind === 'geo') { if (st.mode !== 'koord') U.$('.subtabs[data-group="pf"]', root)._select('koord'); err('Y ' + U.num(y, 2) + ' · X ' + U.num(x, 2) + ' metre koordinatına benziyor. Hangi 3° TM ya da UTM diliminde olduğunu "Koordinat sistemi" listesinden seçip yeniden arayın.'); $('#pf-ksys').focus(); return; }
          noktaAc(K.transform(id, 'geo-turef', { y: y, x: x }), true); return;
        }
      }
    }
    st.res = null; st.name = null; $('#pf-out').innerHTML = ''; $('#pf-exp').hidden = true; drawDetail(null);
    err('"' + t + '" pafta adı ya da koordinat olarak tanınmadı. Örnekler: G25-d-01-d · 39,9208 32,8541 · 39°55\'15" 32°51\'15" · 487200 4420800 (Koordinat sekmesinde dilim seçili).');
  }
  $('#pf-arabul').addEventListener('click', hizliAra);
  $('#pf-ara').addEventListener('keydown', function (e) { if (e.key === 'Enter') hizliAra(); });

  // ---------- Pafta adı ----------
  function openName(n) { U.$('.subtabs[data-group="pf"]', root)._select('ad'); $('#pf-ad').value = n; runName(true); }
  root.addEventListener('click', function (e) { var b = e.target.closest('[data-open]'); if (b) { e.preventDefault(); openName(b.getAttribute('data-open')); } });
  function runName(fit) {
    err('');
    var p; try { p = P.fromName($('#pf-ad').value); } catch (e) { err(e.message); $('#pf-out').innerHTML = ''; $('#pf-exp').hidden = true; return; }
    st.name = p.name; $('#pf-ad').value = p.name;
    var dt = datum(), c = P.corners(p.name, dt), b = p.bounds, nb = P.neighbors(p.name), par = P.parents(p.name), ch = P.children(p.name);
    var g = window.TA.GD, wN = g.inverse(b.north, b.west, b.north, b.east).s, wS = g.inverse(b.south, b.west, b.south, b.east).s, hW = g.inverse(b.north, b.west, b.south, b.west).s;
    var area = P._ringArea(P.sheetFeature(p.name, 'TUREF').geometry.coordinates[0]);
    var tmLbl = (dt === 'ED50' ? 'ED50' : 'ITRF96') + ' 3° TM ' + c.cm, utmLbl = (dt === 'ED50' ? 'ED50' : 'WGS84') + ' UTM ' + c.zone + 'K';
    var h = ['<div class="result-head"><span class="eyebrow">' + p.label + ' pafta · ' + (dt === 'ED50' ? 'ED50' : 'TUREF') + '</span><span class="big">' + U.esc(p.name) + ' ' + U.copyBtn(p.name) + '</span><span class="meta">Kuzey ' + U.esc(P.toDMS(b.north, true)) + ' · Güney ' + U.esc(P.toDMS(b.south, true)) + ' · Batı ' + U.esc(P.toDMS(b.west, false)) + ' · Doğu ' + U.esc(P.toDMS(b.east, false)) + '</span></div>'];
    h.push('<dl class="kv"><dt>Boyut</dt><dd>' + U.num(wN, 1) + ' m (kuzey kenarı) · ' + U.num(wS, 1) + ' m (güney kenarı) · ' + U.num(hW, 1) + ' m (yükseklik)</dd><dt>Alan</dt><dd>' + m2(area) + '</dd>' + (function () { var a = P.ad250(p.name); return a ? '<dt>1/250.000</dt><dd>' + U.esc(a.onek) + ' (' + (a.bugun ? 'bugün ' + U.esc(a.bugun) + ' · ' : '') + a.kapsam + ') · ön ekli ad ' + U.esc(a.tamAd) + ' ' + U.copyBtn(a.tamAd) + '</dd>' : ''; })() + '<dt>Projeksiyon</dt><dd>' + tmLbl + ' (EPSG:' + S[(dt === 'ED50' ? 'tm-ed50-' : 'tm-turef-') + c.cm].epsg + ')</dd></dl>');
    h.push('<div class="scroll"><table class="t"><thead><tr><th>Köşe</th><th>Enlem</th><th>Boylam</th><th class="num">Y (' + tmLbl + ')</th><th class="num">X</th><th class="num">UTM Y</th><th class="num">UTM X</th></tr></thead><tbody>');
    [['KB', 'Kuzeybatı'], ['KD', 'Kuzeydoğu'], ['GD', 'Güneydoğu'], ['GB', 'Güneybatı']].forEach(function (k) {
      var q = c[k[0]]; h.push('<tr><td>' + k[1] + '</td><td class="m">' + U.esc(P.toDMS(q.lat, true)) + '</td><td class="m">' + U.esc(P.toDMS(q.lon, false)) + '</td><td class="num">' + U.num(q.tm.y, 3) + '</td><td class="num">' + U.num(q.tm.x, 3) + '</td><td class="num">' + U.num(q.utm.y, 3) + '</td><td class="num">' + U.num(q.utm.x, 3) + '</td></tr>');
    });
    h.push('</tbody></table></div><p class="hint">UTM sütunları: ' + utmLbl + '. Düzlem koordinatları paftanın kendi datumundadır.</p>');
    // komşular 3x3
    var cell = function (k) { var x = nb[k]; return x ? '<button type="button" class="pf-c" data-open="' + U.esc(x.name) + '"><span>' + k + '</span>' + U.esc(x.name) + '</button>' : '<span class="pf-c off">—</span>'; };
    h.push('<div class="pf-nb"><h3 class="pf-h">Komşu paftalar</h3><div class="pf-grid">' + cell('KB') + cell('K') + cell('KD') + cell('B') + '<span class="pf-c me">' + U.esc(p.name) + '</span>' + cell('D') + cell('GB') + cell('G') + cell('GD') + '</div></div>');
    if (par.length) h.push('<p class="pf-chain"><span class="eyebrow">Üst paftalar</span> ' + par.map(function (x) { return '<span class="pf-tag">' + x.label + '</span> ' + nameBtn(x.name); }).join(' <span class="meta">›</span> ') + '</p>');
    ch.forEach(function (c2) { h.push('<p class="pf-chain"><span class="eyebrow">Alt paftalar ' + c2.label + ' (' + c2.list.length + ')</span> ' + c2.list.map(function (x) { return nameBtn(x.name); }).join(' ') + '</p>'); });
    $('#pf-out').innerHTML = h.join(''); $('#pf-exp').hidden = false; fillScope();
    var list = [p.name]; Object.keys(nb).forEach(function (k) { if (nb[k]) list.push(nb[k].name); });
    drawDetail(null); drawSheets(list, [p.name]);
    if (fit) { var fb = api.bboxOf({ features: [P.sheetFeature(p.name, dt)] }); api.fit(fb, 17); }
  }
  $('#pf-adbul').addEventListener('click', function () { runName(true); });
  $('#pf-ad').addEventListener('keydown', function (e) { if (e.key === 'Enter') runName(true); });

  // ---------- Sekme ve ayar değişimleri ----------
  U.$('.subtabs[data-group="pf"]', root).addEventListener('tabchange', function (e) {
    st.mode = e.detail; setDraw(null); err('');
    api.map.getCanvas().style.cursor = st.mode === 'koord' ? 'crosshair' : '';
    $('#pf-out').innerHTML = ''; $('#pf-exp').hidden = true; drawSheets([]); drawDetail(null); st.res = null;
    if (st.mode === 'dosya' && st.fc) runFile(false);
    if (st.mode === 'koord' && st.point) runPoint(false);
    if (st.mode === 'ad' && st.name) runName(false);
  });
  function rerun() { datumNote(); fillExpCrs(); if (st.mode === 'dosya' && st.fc) runFile(false); else if (st.mode === 'koord' && st.point) runPoint(false); else if (st.mode === 'ad' && st.name) runName(false); }
  $('#pf-datum').addEventListener('change', rerun); $('#pf-tol').addEventListener('change', rerun); fs.addEventListener('change', function () { if (st.mode === 'dosya') rerun(); });

  // ---------- Dışa aktarma ----------
  // Birden çok parselde dışa aktarım tek parsele daraltılabilir ("Tümü" ya da bir parsel)
  function parselSec() {
    var w = $('#pf-eparselw'), s = $('#pf-eparsel'), n = st.mode === 'dosya' && st.fc ? st.fc.features.length : 0, eski = s.value;
    w.hidden = n < 2; if (n < 2) { s.innerHTML = ''; return; }
    s.innerHTML = '<option value="-1">Tümü (' + n + ' detay)</option>' + st.fc.features.map(function (f, i) { return '<option value="' + i + '">' + U.esc(featName(f, i)) + '</option>'; }).join('');
    if (eski !== '' && +eski < n) s.value = eski;
  }
  function parselNo() { var v = $('#pf-eparsel').value; return $('#pf-eparselw').hidden || v === '' ? -1 : +v; }
  function parselde(x) { var p = parselNo(); return p < 0 || x.features.indexOf(p) >= 0; }
  function fillScope() {
    var sel = $('#pf-esc'), o = [];
    if (st.mode === 'dosya' && st.res) {
      parselSec();
      st.res.scales.forEach(function (s) { var say = s.skipped ? 0 : s.sheets.filter(parselde).length; if (say) o.push([s.scale, s.label + ' – ' + say + ' pafta']); });
      if (o.length > 1) o.push(['all', 'Seçili bütün ölçekler']);
      o.push(['detay', 'Girdi detayları + pafta adları (en ince ölçek)']);
    } else if (st.mode === 'koord' && st.res) {
      // Haritada gösterilen ölçek en başta; "bütün ölçekler" iç içe çerçeveler verdiği için sona konur
      var mv = $('#pf-mscale').value, ms = mv === 'auto' ? '1000' : mv, ss = st.res.scales.slice().sort(function (a, b) { return (b.scale === ms) - (a.scale === ms); });
      ss.forEach(function (s) { if (s.sheets.length) o.push([s.scale, 'Yalnız ' + s.label + ' paftası (' + s.sheets[0].name + ')']); });
      o.push(['all', 'Bütün ölçekler, iç içe (' + ss.length + ' çerçeve)']);
    }
    else if (st.mode === 'ad' && st.name) {
      o.push(['bu', 'Bu pafta (' + st.name + ')'], ['komsu', 'Bu pafta ve komşuları (3×3)']);
      P.children(st.name).forEach(function (c) { o.push(['alt-' + c.scale, 'Alt paftalar ' + c.label + ' (' + c.list.length + ')']); });
    }
    sel.innerHTML = o.map(function (x) { return '<option value="' + x[0] + '">' + U.esc(x[1]) + '</option>'; }).join('');
    expNote();
  }
  function sheetList() {
    var v = $('#pf-esc').value, out = [];
    if (st.mode === 'ad') {
      if (v === 'bu') out.push({ n: st.name });
      else if (v === 'komsu') { out.push({ n: st.name }); var nb = P.neighbors(st.name); P.DIRS.forEach(function (d) { if (nb[d[0]]) out.push({ n: nb[d[0]].name, yon: d[0] }); }); }
      else { var sk = v.slice(4); P.children(st.name).forEach(function (c) { if (c.scale === sk) c.list.forEach(function (x) { out.push({ n: x.name }); }); }); }
      return out;
    }
    st.res.scales.forEach(function (s) {
      if (s.skipped || !(v === 'all' || v === s.scale)) return;
      s.sheets.forEach(function (x) { if (st.mode === 'dosya' && !parselde(x)) return; out.push({ n: x.name, area: x.area, share: x.share, length: x.length, points: x.points, depth: x.depth, near: x.nearEdge }); });
    });
    return out;
  }
  function resolveCrs(list) {
    var v = $('#pf-ecrs').value, ed = datum() === 'ED50', lon = 0;
    if (v !== 'auto-tm' && v !== 'auto-utm') return v;
    list.forEach(function (x) { var b = P.fromName(x.n).bounds; lon += (b.west + b.east) / 2; }); lon /= Math.max(1, list.length);
    if (v === 'auto-tm') return (ed ? 'tm-ed50-' : 'tm-turef-') + K.tmCmFor(lon);
    return (ed ? 'utm-ed50-' : 'utm-wgs84-') + Math.min(38, Math.max(35, K.utmZoneFor(lon)));
  }
  function expNote() {
    var fmt = $('#pf-efmt').value, n = [];
    $('#pf-ecrs').disabled = !!F.WGS_ONLY[fmt];
    if (F.WGS_ONLY[fmt]) n.push({ geojson: 'GeoJSON', kml: 'KML', kmz: 'KMZ' }[fmt] + ' standardı gereği WGS84 coğrafi koordinatla yazılır.');
    else if ((st.res || st.name) && $('#pf-esc').value) { try { var id = resolveCrs(sheetList()); n.push('Çıktı sistemi: ' + label(id) + (S[id].epsg ? ' (EPSG:' + S[id].epsg + ')' : '') + '.'); if (S[id].datum !== (datum() === 'ED50' ? 'ED50' : S[id].datum === 'WGS84' ? 'WGS84' : 'TUREF')) n.push('Pafta datumu ile çıktı datumu farklı; çerçeveler dönüştürülerek yazılır.'); } catch (e) { /* liste yok */ } }
    if (fmt === 'dxf') n.push('Her ölçek ayrı katmanda (PAFTA_5000 gibi); pafta adları ortada, ölçeğe uygun yükseklikte yazılır. Kenarlar 200 m\'yi geçmeyecek biçimde sıklaştırılır; paralel ve meridyenler projeksiyonda doğru eğrilikte çizilir.');
    if (fmt === 'csv') n.push('CSV: pafta adı, ölçek, köşe coğrafi koordinatları (derece) ve seçilen projeksiyonda köşe Y/X değerleri.');
    if ($('#pf-esc').value === 'detay') n.push('Girdi detayları, her birinin düştüğü paftaların adlarıyla (pafta alanı) birlikte yazılır.');
    $('#pf-enote').textContent = n.join(' ');
  }
  ['#pf-efmt', '#pf-ecrs', '#pf-esc'].forEach(function (s) { $(s).addEventListener('change', expNote); });
  $('#pf-eparsel').addEventListener('change', function () { var v = $('#pf-esc').value; fillScope(); if ([].some.call($('#pf-esc').options, function (o) { return o.value === v; })) $('#pf-esc').value = v; expNote(); });
  function csvOut(list, crs) {
    var dt = datum(), s = S[crs], rows = [['pafta', 'olcek', 'datum', 'KB_enlem', 'KB_boylam', 'KD_enlem', 'KD_boylam', 'GD_enlem', 'GD_boylam', 'GB_enlem', 'GB_boylam'].concat(s.kind === 'proj' ? ['sistem', 'KB_Y', 'KB_X', 'KD_Y', 'KD_X', 'GD_Y', 'GD_X', 'GB_Y', 'GB_X'] : []).concat(st.mode === 'dosya' ? ['kesisim_m2', 'pay_yuzde', 'uzunluk_m', 'nokta', 'kenarda'] : [])];
    var fx = function (v, d) { return (+v).toFixed(d).replace('.', ','); };
    list.forEach(function (x) {
      var p = P.fromName(x.n), b = p.bounds, cs = [[b.north, b.west], [b.north, b.east], [b.south, b.east], [b.south, b.west]];
      var r = [p.name, p.label, dt]; cs.forEach(function (c) { r.push(fx(c[0], 8), fx(c[1], 8)); });
      if (s.kind === 'proj') { r.push(s.label); cs.forEach(function (c) { var g = dt === 'ED50' ? K.transform('geo-ed50', 'geo-turef', { lat: c[0], lon: c[1] }) : { lat: c[0], lon: c[1] }, q = K.transform('geo-turef', crs, g); r.push(fx(q.y, 3), fx(q.x, 3)); }); }
      if (st.mode === 'dosya') r.push(fx(x.area || 0, 2), fx(x.share || 0, 4), fx(x.length || 0, 2), x.points || 0, x.near ? 'evet' : '');
      rows.push(r);
    });
    return '﻿' + rows.map(function (r) { return r.map(function (v) { v = String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n') + '\r\n';
  }
  $('#pf-edl').addEventListener('click', function () {
    err('');
    try {
      var fmt = $('#pf-efmt').value, dt = datum(), list, crs, base, out, fc;
      if ($('#pf-esc').value === 'detay') {
        var fin = st.res.scales.filter(function (s) { return !s.skipped; }).slice(-1)[0];
        fc = { type: 'FeatureCollection', features: st.fc.features.map(function (f, i) { if (parselNo() >= 0 && i !== parselNo()) return null; var p = Object.assign({}, f.properties || {}); p.paftalar = fin.sheets.filter(function (x) { return x.features.indexOf(i) >= 0; }).map(function (x) { return x.name; }).join(', '); p.pafta_olcek = fin.label; p.pafta_datum = dt; return { type: 'Feature', properties: p, geometry: f.geometry }; }).filter(Boolean) };
        crs = F.WGS_ONLY[fmt] ? 'geo-turef' : (function () { var v = $('#pf-ecrs').value; if (v.indexOf('auto') !== 0) return v; var b = F.bbox(fc), lon = (b[0] + b[2]) / 2; return v === 'auto-tm' ? (dt === 'ED50' ? 'tm-ed50-' : 'tm-turef-') + K.tmCmFor(lon) : (dt === 'ED50' ? 'utm-ed50-' : 'utm-wgs84-') + Math.min(38, Math.max(35, K.utmZoneFor(lon))); })();
        base = st.base + '_paftalar';
        if (fmt === 'csv') { var h = Object.keys(fc.features[0].properties); out = { name: base + '.csv', data: '﻿' + [h.join(';')].concat(fc.features.map(function (f) { return h.map(function (k) { var v = String(f.properties[k] == null ? '' : f.properties[k]); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); })).join('\r\n') + '\r\n' }; }
        else out = F.write(fc, 'geo-turef', { format: fmt, crs: crs, nameField: 'paftalar', textField: fmt === 'dxf' ? 'paftalar' : null, textHeight: 2 }, base);
        U.download(out.name, out.data); return;
      }
      list = sheetList(); if (!list.length) throw new Error('İndirilecek pafta yok');
      crs = F.WGS_ONLY[fmt] ? 'geo-turef' : resolveCrs(list);
      base = 'paftalar_' + (st.mode === 'ad' ? st.name.replace(/İ/g, 'I') : st.mode === 'dosya' ? (parselNo() >= 0 ? U.slug(featName(st.fc.features[parselNo()], parselNo())) : U.slug(st.base)) : 'nokta') + '_' + dt.toLowerCase();
      if (fmt === 'csv') { U.download(base + '.csv', csvOut(list, crs)); return; }
      fc = { type: 'FeatureCollection', features: list.map(function (x) {
        var p = P.fromName(x.n), extra = {};
        if (st.mode === 'dosya') { if (x.area) { extra.kesisim_m2 = Math.round(x.area * 100) / 100; extra.pay_yuzde = Math.round(x.share * 10000) / 10000; } if (x.length) extra.uzunluk_m = Math.round(x.length * 100) / 100; if (x.points) extra.nokta = x.points; extra.kenarda = x.near ? 'evet' : 'hayir'; }
        if (x.yon) extra.yon = x.yon;
        if (fmt === 'dxf') { extra.katman = 'PAFTA_' + p.scale; extra._yh = TEXT_H[p.scale]; }
        return P.sheetFeature(p.name, dt, extra, true);
      }) };
      out = F.write(fc, 'geo-turef', { format: fmt, crs: crs, nameField: 'pafta', textField: fmt === 'dxf' ? 'pafta' : null, textHeightField: '_yh', centerText: true, layerField: fmt === 'dxf' ? 'katman' : null, textHeight: 50 }, base);
      if (fmt === 'shp') {
        var files = F.unzip(out.data), enc = new TextEncoder();
        files['BENIOKU.txt'] = enc.encode('Pafta çerçeveleri\r\nBölümleme: Büyük Ölçekli Harita ve Harita Bilgileri Üretim Yönetmeliği (2018) md. 73, Ek-9\r\nPafta datumu: ' + (dt === 'ED50' ? 'ED50' : 'TUREF / ITRF96') + '\r\nÇıktı koordinat sistemi: ' + label(crs) + (S[crs].epsg ? ' (EPSG:' + S[crs].epsg + ')' : '') + '\r\nÜretim: topografya.com.tr Pafta Bulucu\r\n');
        out.data = F.zip(files);
      }
      U.download(out.name, out.data);
    } catch (e) { err('İndirme hazırlanamadı: ' + e.message); }
  });
}};

(function(){var s=document.getElementById('t-pafta');U.subtabs(s);TOOLS['pafta'].init(s);})();