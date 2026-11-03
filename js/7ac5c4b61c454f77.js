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

/* Yükseklik karosu okuyucu (tarayıcı): Terrain Tiles terrarium PNG → Float32Array. window.DEMYUKLE
 * Karolar AWS Açık Veri kovasından doğrudan istenir (sunucumuza yük yok); aynı karo bir kez indirilir.
 */
(function () {
  'use strict';
  var URL_SABLON = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  var ATIF = 'Yükseklik: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> (Mapzen; ' +
    '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">kaynaklar</a>: EU-DEM © Copernicus, SRTM ve GMTED2010 USGS, ETOPO1 NOAA)';
  // İndirilen türev ürünlere yazılan atıf (Tilezen/joerd atıf koşulları; Claude denetimi D3-27)
  var ATIF_METIN = 'Yükseklik verisi: Terrain Tiles (Mapzen; Amazon Web Services Açık Veri Kaydı). Kaynaklar: EU-DEM - Produced using Copernicus data and information funded by the European Union - EU-DEM layers; ' +
    'SRTM ve GMTED2010 - U.S. Geological Survey; ETOPO1 - NOAA National Centers for Environmental Information. Ayrıntı: https://github.com/tilezen/joerd/blob/master/docs/attribution.md. Türetilmiş ürün: topografya.com.tr';
  function ascii(t) { var m = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U', 'â': 'a', 'î': 'i', 'û': 'u' }; return t.replace(/[^\x20-\x7E]/g, function (c) { return m[c] || '?'; }); }
  function xmlEsc(t) { return t.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  // ad uzantısına göre atıf ekler: GeoJSON "attribution" üyesi, KML <description>, DXF 999 açıklama satırları, ZIP içine BENIOKU.txt
  function atifEkle(ad, veri) {
    var F = window.TA.F, enc = new TextEncoder(), dec = new TextDecoder('utf-8');
    if (/\.(geo)?json$/i.test(ad)) { var o = JSON.parse(typeof veri === 'string' ? veri : dec.decode(veri)); o.attribution = ATIF_METIN; return JSON.stringify(o); }
    if (/\.kml$/i.test(ad)) { var k = typeof veri === 'string' ? veri : dec.decode(veri); return k.replace(/<Document>/, '<Document><description>' + xmlEsc(ATIF_METIN) + '</description>'); }
    if (/\.dxf$/i.test(ad)) { var on = enc.encode('999\r\n' + ascii(ATIF_METIN).replace(/(.{1,240})(\s|$)/g, '$1\r\n999\r\n').replace(/\r\n999\r\n$/, '\r\n')), u = typeof veri === 'string' ? enc.encode(veri) : veri, r = new Uint8Array(on.length + u.length); r.set(on); r.set(u, on.length); return r; }
    if (/\.zip$/i.test(ad)) { var z = F.unzip(veri); z['BENIOKU.txt'] = enc.encode(ATIF_METIN.replace(/\. /g, '.\r\n') + '\r\n'); return F.zip(z); }
    return veri;
  }
  var onbellek = {}, kuyruk = [], aktif = 0, ES = 8, sayac = { istenen: 0, gelen: 0 };
  function sira() {
    while (aktif < ES && kuyruk.length) {
      var is = kuyruk.shift(); aktif++;
      is().then(function () { aktif--; sira(); }, function () { aktif--; sira(); });
    }
  }
  function cozumle(blob) {
    return createImageBitmap(blob).then(function (bm) {
      var c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
      var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bm, 0, 0);
      return window.TA.DEM.decodeTerrarium(x.getImageData(0, 0, 256, 256).data);
    });
  }
  function getTile(z, x, y) {
    var k = z + '/' + x + '/' + y;
    if (!onbellek[k]) {
      sayac.istenen++;
      onbellek[k] = new Promise(function (res, rej) {
        kuyruk.push(function () {
          return fetch(URL_SABLON.replace('{z}', z).replace('{x}', x).replace('{y}', y), { mode: 'cors' })
            .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error('Yükseklik karosu alınamadı (' + r.status + ')'); return r.blob().then(cozumle); })
            .then(function (t) { sayac.gelen++; if (D.ilerleme) D.ilerleme(sayac); res(t); }, function (e) { delete onbellek[k]; sayac.gelen++; if (D.ilerleme) D.ilerleme(sayac); rej(e); });
        });
        sira();
      });
    }
    return onbellek[k];
  }
  var D = {
    ATIF: ATIF, ATIF_METIN: ATIF_METIN, ATIF_ASCII: ascii(ATIF_METIN), atifEkle: atifEkle, getTile: getTile, ilerleme: null,
    // bbox için mozaik; maxPx ile yakınlık sınırlanır. Önizleme ortamında dış kaynak kapalıysa anlaşılır hata verir.
    mozaik: function (bbox, maxPx, z) {
      var DEM = window.TA.DEM; sayac.istenen = 0; sayac.gelen = 0;
      var zz = z || DEM.zoomSec(bbox, maxPx || 1.5e6, 64);
      return DEM.mozaik(bbox, zz, getTile).then(function (m) {
        var bos = 0; for (var i = 0; i < m.data.length; i += 97) if (!isFinite(m.data[i])) bos++;
        if (bos > m.data.length / 97 * 0.98) throw new Error(window.TOPO_BASEMAP === 'offline' ? 'Yükseklik verisi bu önizlemede yüklenemiyor (dış kaynaklar kapalı); sitede ve yerel pakette çalışır.' : 'Yükseklik verisi alınamadı; bağlantınızı denetleyip yeniden deneyin.');
        return m;
      });
    }
  };
  window.DEMYUKLE = D;
})();

/* Arazi araçları ortak arayüz yardımcıları. window.ARAZI */
(function () {
  'use strict';
  var A = {};
  // Alan seçimi: [data-alan="cokgen"] çokgen çiz, [data-alan="gorunur"] görünür alan, [data-alan="temizle"].
  // onSec({ ring: [[lon, lat]…] kapalı, bbox }) çağrılır.
  A.alanSecici = function (api, root, onSec, opts) {
    opts = opts || {};
    var U = window.U, durum = { ring: null };
    var dr = window.HARITA.drawer(api, function (f) {
      basili(null); dr.setMode(null);
      sec(f.geometry.coordinates[0]);
    });
    function basili(m) { U.$$('[data-alan]', root).forEach(function (b) { if (b.dataset.alan === 'cokgen') b.setAttribute('aria-pressed', m === 'cokgen' ? 'true' : 'false'); }); }
    function sec(ring) {
      var b = [Infinity, Infinity, -Infinity, -Infinity]; ring.forEach(function (c) { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); });
      durum.ring = ring; durum.bbox = b;
      api.setData('alan', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }] }, { fillOpacity: 0, width: 2, dash: [3, 2] });
      onSec(durum);
    }
    U.$$('[data-alan]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.dataset.alan;
        if (t === 'cokgen') { var acik = dr.mode === 'Polygon'; dr.setMode(acik ? null : 'Polygon'); basili(acik ? null : 'cokgen'); }
        else if (t === 'gorunur') {
          dr.setMode(null); basili(null);
          var bb = api.map.getBounds(), w = bb.getWest(), s = bb.getSouth(), e = bb.getEast(), n = bb.getNorth();
          // kenarlardan %4 içeri: seçim çerçevesi görünsün
          var dx = (e - w) * 0.04, dy = (n - s) * 0.04; w += dx; e -= dx; s += dy; n -= dy;
          sec([[w, s], [e, s], [e, n], [w, n], [w, s]]);
        } else if (t === 'temizle') { dr.setMode(null); basili(null); durum.ring = null; api.remove('alan'); if (opts.onTemizle) opts.onTemizle(); }
      });
    });
    durum.sec = sec; durum.drawer = dr;
    return durum;
  };
  // Mozaik ızgarasından renkli görüntü (data URL). renk(k) → [r, g, b, a] ya da null (saydam)
  A.resim = function (m, renk) {
    var c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
    var x = c.getContext('2d'), im = x.createImageData(m.w, m.h), d = im.data;
    for (var k = 0; k < m.w * m.h; k++) { var r = renk(k); if (!r) continue; d[k * 4] = r[0]; d[k * 4 + 1] = r[1]; d[k * 4 + 2] = r[2]; d[k * 4 + 3] = r[3] == null ? 255 : r[3]; }
    x.putImageData(im, 0, 0);
    return c.toDataURL('image/png');
  };
  A.hex = function (h) { var n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  // Alan için uygun 3° TM orta meridyeni
  A.tmCm = function (lon) { var cms = window.TA.K.TM_CMS, b = cms[0]; cms.forEach(function (c) { if (Math.abs(lon - c) < Math.abs(lon - b)) b = c; }); return b; };
  A.ilerleme = function (el) { window.DEMYUKLE.ilerleme = function (s) { el.textContent = 'Yükseklik verisi yükleniyor: ' + s.gelen + ' / ' + s.istenen + ' karo'; }; };
  A.alanYaz = function (m2) { var U = window.U; return m2 >= 1e6 ? U.num(m2 / 1e6, 3) + ' km²' : U.num(m2 / 1e4, 2) + ' ha'; };
  // Çokgen için en çok alan (km²): veri ~15 m piksel; büyük alanlarda yakınlık düşer, uyarı verilir
  A.MAX_KM2 = 2500;
  window.ARAZI = A;
})();

/* Görünürlük Analizi arayüzü */
(window.TOOLS = window.TOOLS || {}).gorunurluk = { init: function (root) {
  'use strict';
  var DEM = window.TA.DEM, GT = window.TA.GT, GD = window.TA.GD, K = window.TA.K, U = window.U, AR = window.ARAZI, Y = window.DEMYUKLE, $ = function (s) { return U.$(s, root); };
  var api = window.HARITA.create($('#gr-map'), { center: [32.85, 39.92], zoom: 11 });
  api.saydamlik(['gr-ras']); // tematik katman opaklığı
  api.ekAtif(Y.ATIF);
  var mod = 'alan', st = { A: null, B: null, vs: null, m: null, hat: null };
  function err(m) { var e = $('#gr-err'); e.textContent = m || ''; e.hidden = !m; }
  AR.ilerleme($('#gr-durum'));
  function sayi(id, ad, min, max) { var v = K.parseNumber($(id).value); if (!isFinite(v) || v < min || v > max) throw new Error(ad + ' ' + min + ' ile ' + max + ' arasında olmalı'); return v; }
  function temizle() { st.A = st.B = null; st.vs = st.hat = null; ['gr-ras', 'gr-nok', 'gr-cizgi', 'gr-engel'].forEach(api.remove); $('#gr-exp').hidden = true; $('#gr-fig').hidden = true; $('#gr-kv').innerHTML = ''; $('#gr-big').textContent = '—'; $('#gr-meta').textContent = ''; }
  U.$('.subtabs[data-group="gr"]', root).addEventListener('tabchange', function (e) {
    mod = e.detail; temizle(); err('');
    $('#gr-rw').hidden = mod !== 'alan'; $('#gr-leg').hidden = mod !== 'alan';
    $('#gr-ht').value = mod === 'alan' ? '0' : '1,70';
    $('#gr-ipucu').textContent = mod === 'alan' ? 'Haritada bakış noktasına tıklayın.' : 'Haritada önce gözlemci (A), sonra hedef (B) noktasına tıklayın.';
  });
  function noktalar() {
    var f = []; if (st.A) f.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: st.A } }); if (st.B) f.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: st.B } });
    api.setData('gr-nok', { type: 'FeatureCollection', features: f }, { radius: 7, color: '#F2A900' });
  }
  api.ready.then(function () {
    api.map.getCanvas().style.cursor = 'crosshair';
    api.map.on('click', function (e) {
      var p = [e.lngLat.lng, e.lngLat.lat]; err('');
      if (mod === 'alan') { st.A = p; noktalar(); alanHesapla(); }
      else { if (!st.A || st.B) { temizle(); st.A = p; } else st.B = p; noktalar(); if (st.B) hatHesapla(); }
    });
  });
  ['#gr-ho', '#gr-ht', '#gr-r', '#gr-k'].forEach(function (id) { $(id).addEventListener('change', function () { if (mod === 'alan' && st.A) alanHesapla(); if (mod === 'hat' && st.B) hatHesapla(); }); });
  function alanHesapla() {
    var ho, ht, r, k;
    try { ho = sayi('#gr-ho', 'Gözlemci yüksekliği', 0, 1000); ht = sayi('#gr-ht', 'Hedef yüksekliği', 0, 1000); r = sayi('#gr-r', 'Yarıçap', 100, 30000); k = sayi('#gr-k', 'Kırılma katsayısı', -1, 1); } catch (e) { err(e.message); return; }
    var A = st.A, dLat = r / 111132, dLon = r / (111320 * Math.cos(A[1] * Math.PI / 180));
    Y.mozaik([A[0] - dLon, A[1] - dLat, A[0] + dLon, A[1] + dLat], 1.6e6).then(function (m) {
      $('#gr-durum').textContent = '';
      var vs = DEM.gorunurluk(m, A[0], A[1], ho, ht, r, k);
      st.m = m; st.vs = vs;
      api.setImage('gr-ras', AR.resim(m, function (q) { var v = vs.grid[q]; return v === 1 ? [46, 158, 91, 170] : v === 0 ? [40, 40, 40, 120] : v === 2 ? [230, 160, 20, 150] : null; }), DEM.koseler(m), 1);
      $('#gr-eb').textContent = 'Görünür alan';
      $('#gr-big').textContent = AR.alanYaz(vs.gorunurAlan) + ' · %' + U.num(vs.gorunurAlan / vs.toplamAlan * 100, 1);
      $('#gr-belirsiz').hidden = !(vs.belirsizAlan > 0);
      $('#gr-meta').textContent = U.num(r / 1000, 1) + ' km yarıçap · karo pikseli ≈ ' + U.num(DEM.pikselBoyu(A[1], m.z), 0) + ' m' + (m.eksik ? ' · ' + m.eksik + ' karo eksik' : '');
      var ufuk = Math.sqrt(2 * 6371000 * ho / (1 - k));
      $('#gr-kv').innerHTML = '<dt>Bakış noktası</dt><dd>' + U.num(A[1], 6) + '°, ' + U.num(A[0], 6) + '° · zemin ' + U.num(vs.gozKotu - ho, 1) + ' m · göz ' + U.num(vs.gozKotu, 1) + ' m</dd>' +
        '<dt>İncelenen alan</dt><dd>' + AR.alanYaz(vs.toplamAlan) + '</dd><dt>Düz arazide ufuk</dt><dd>≈ ' + U.num(ufuk / 1000, 2) + ' km (' + U.num(ho, 1) + ' m göz yüksekliği)</dd>';
      $('#gr-exp').hidden = false; $('#gr-tif').hidden = false; $('#gr-csv').hidden = true;
    }).catch(function (e) { $('#gr-durum').textContent = ''; err(e.message); });
  }
  function hatHesapla() {
    var ho, ht, k;
    try { ho = sayi('#gr-ho', 'Gözlemci yüksekliği', 0, 1000); ht = sayi('#gr-ht', 'Hedef yüksekliği', 0, 1000); k = sayi('#gr-k', 'Kırılma katsayısı', -1, 1); } catch (e) { err(e.message); return; }
    var A = st.A, B = st.B, L = GD.inverse(A[1], A[0], B[1], B[0]).s;
    if (L > 100000) { err('A ile B arası 100 km\'den uzun.'); return; }
    var pay = 0.003;
    Y.mozaik([Math.min(A[0], B[0]) - pay, Math.min(A[1], B[1]) - pay, Math.max(A[0], B[0]) + pay, Math.max(A[1], B[1]) + pay], 2.5e6).then(function (m) {
      $('#gr-durum').textContent = '';
      var adim = Math.max(2, Math.min(DEM.pikselBoyu(A[1], m.z) / 2, L / 1500));
      var g = DEM.gorusHatti(m, A, B, ho, ht, adim, k); st.hat = g;
      api.setData('gr-cizgi', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [A, B] } }] }, { width: 3, line: g.gorunur === true ? '#2E9E5B' : g.gorunur === false ? '#B3261E' : '#E0A100', dash: g.gorunur === true ? [1, 0] : [2, 1.5] });
      if (g.engel) api.setData('gr-engel', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [g.engel.lon, g.engel.lat] } }] }, { radius: 7, color: '#B3261E' }); else api.remove('gr-engel');
      $('#gr-eb').textContent = 'Görüş hattı';
      $('#gr-big').textContent = g.gorunur === true ? 'B noktası görünür' : g.gorunur === false ? 'Görüş engelleniyor' : 'Belirlenemedi: kesitte yükseklik verisi eksik';
      $('#gr-meta').textContent = U.num(g.uzunluk / 1000, 3) + ' km · karo pikseli ≈ ' + U.num(DEM.pikselBoyu(A[1], m.z), 0) + ' m';
      $('#gr-kv').innerHTML = '<dt>Göz kotu (A)</dt><dd>' + U.num(g.gozKotu, 1) + ' m</dd><dt>Hedef kotu (B)</dt><dd>' + U.num(g.hedefKotu, 1) + ' m</dd>' +
        (g.engel ? '<dt>İlk engel</dt><dd>A\'dan ' + U.num(g.engel.d, 0) + ' m · arazi ' + U.num(g.engel.z, 1) + ' m · görüş çizgisini ≈ ' + U.num(g.engel.asim, 1) + ' m aşıyor</dd>' : '') +
        (g.eksik ? '<dt>Eksik yükseklik verisi</dt><dd>Kesit örneklerinin %' + U.num(g.eksik.oran * 100, 1) + '\'inde veri yok (ilk boşluk A\'dan ≈ ' + U.num(g.eksik.ilkUzaklik, 0) + ' m); ' + (g.engel ? 'bilinen arazideki engel nedeniyle sonuç yine de görünmez.' : 'bilinmeyen arazi açık hat sayılmadığından görünürlük kanıtlanamadı.') + '</dd>' : '') +
        '<dt>Eğrilik + kırılma (B\'de)</dt><dd>' + U.num(DEM.egrilikDuzeltme(g.uzunluk, k), 2) + ' m</dd>';
      grafik(g, k); $('#gr-fig').hidden = false; $('#gr-exp').hidden = false; $('#gr-tif').hidden = true; $('#gr-csv').hidden = false;
    }).catch(function (e) { $('#gr-durum').textContent = ''; err(e.message); });
  }
  function grafik(g, k) {
    var W = 720, H = 260, pl = 56, pr = 14, pt = 14, pb = 30, pts = g.profil.filter(function (p) { return isFinite(p.z); });
    var zz = pts.map(function (p) { return p.z - DEM.egrilikDuzeltme(p.d, k); }).concat([g.gozKotu, g.hedefKotu - DEM.egrilikDuzeltme(g.uzunluk, k)]);
    var zmin = Math.min.apply(null, zz), zmax = Math.max.apply(null, zz), dz = Math.max(5, zmax - zmin); zmin -= dz * 0.08; zmax += dz * 0.08;
    var X = function (d) { return pl + (W - pl - pr) * d / g.uzunluk; }, Yf = function (z) { return H - pb - (H - pt - pb) * (z - zmin) / (zmax - zmin); };
    var h = '', ad = [1, 2, 5, 10, 20, 50, 100, 200, 500].filter(function (s) { return (zmax - zmin) / s <= 6; })[0] || 1000;
    for (var v = Math.ceil(zmin / ad) * ad; v <= zmax; v += ad) h += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Yf(v).toFixed(1) + '" y2="' + Yf(v).toFixed(1) + '" stroke="var(--rule)"/><text class="svg-text" x="' + (pl - 6) + '" y="' + (Yf(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>';
    var yol = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.d).toFixed(1) + ',' + Yf(p.z - DEM.egrilikDuzeltme(p.d, k)).toFixed(1); }).join('');
    h += '<path d="' + yol + 'L' + X(g.uzunluk) + ',' + (H - pb) + 'L' + pl + ',' + (H - pb) + 'Z" fill="#E9DCC6" stroke="#8A4B00" stroke-width="1.2"/>';
    var zB = g.hedefKotu - DEM.egrilikDuzeltme(g.uzunluk, k);
    h += '<line x1="' + X(0) + '" y1="' + Yf(g.gozKotu).toFixed(1) + '" x2="' + X(g.uzunluk) + '" y2="' + Yf(zB).toFixed(1) + '" stroke="var(--text)" stroke-dasharray="6 4" stroke-width="1.4"/>';
    pts.forEach(function (p, i) { if (i === 0) return; var zl = g.gozKotu + (zB - g.gozKotu) * p.d / g.uzunluk, zc = p.z - DEM.egrilikDuzeltme(p.d, k); if (zc > zl && p.d < g.uzunluk) h += '<line x1="' + X(p.d).toFixed(1) + '" x2="' + X(p.d).toFixed(1) + '" y1="' + Yf(zl).toFixed(1) + '" y2="' + Yf(zc).toFixed(1) + '" stroke="#B3261E" stroke-width="2"/>'; });
    h += '<circle cx="' + X(0) + '" cy="' + Yf(g.gozKotu).toFixed(1) + '" r="5" fill="#F2A900" stroke="var(--text)"/><text class="svg-strong" x="' + (X(0) + 8) + '" y="' + (Yf(g.gozKotu) - 8).toFixed(1) + '">A</text>';
    h += '<circle cx="' + X(g.uzunluk) + '" cy="' + Yf(zB).toFixed(1) + '" r="5" fill="#F2A900" stroke="var(--text)"/><text class="svg-strong" x="' + (X(g.uzunluk) - 16) + '" y="' + (Yf(zB) - 8).toFixed(1) + '">B</text>';
    h += '<text class="svg-text" x="' + pl + '" y="' + (H - 8) + '">0</text><text class="svg-text" x="' + (W - pr) + '" y="' + (H - 8) + '" text-anchor="end">' + U.num(g.uzunluk / 1000, 2) + ' km</text>';
    $('#gr-svg').innerHTML = h;
  }
  $('#gr-tif').addEventListener('click', function () {
    if (!st.vs) return; var m = st.m, g = DEM.georef(m);
    U.download('gorunurluk.tif', GT.yaz({ w: m.w, h: m.h, data: st.vs.grid, x0: g.x0, y0: g.y0, px: g.px, py: g.px, epsg: 3857, nodata: 255, aciklama: 'Gorunurluk: 1 gorunur, 0 gorunmez, 2 belirsiz (yukseklik verisi eksik)', telif: window.DEMYUKLE.ATIF_ASCII }), 'image/tiff');
  });
  $('#gr-csv').addEventListener('click', function () {
    var g = st.hat; if (!g) return;
    U.download('gorus_hatti.csv', U.csvRapor([['mesafe_m', 'enlem', 'boylam', 'arazi_kot_m', 'gorus_cizgisi_kot_m']].concat(g.profil.map(function (p) { return [p.d.toFixed(2), p.lat.toFixed(7), p.lon.toFixed(7), isFinite(p.z) ? p.z.toFixed(2) : '', p.gorusKotu != null ? p.gorusKotu.toFixed(2) : '']; }))), 'text/csv');
  });
}};

(function(){var s=document.getElementById('t-gorunurluk');U.subtabs(s);TOOLS['gorunurluk'].init(s);})();