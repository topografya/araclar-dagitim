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
      maxBounds: opts.sinirla ? [[12.0, 24.0], [58.5, 52.0]] : undefined,
      // Dokunmatik ekranda tek parmak sayfayı kaydırır, harita iki parmakla kayar (sayfada haritaya takılıp kalınmasın); dokunma, nokta koyma ve çizim tek parmakla çalışır.
      // Fareli bilgisayarda davranış değişmez (tekerlekle yakınlaşma Ctrl istemez).
      cooperativeGestures: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches),
      locale: { 'CooperativeGesturesHandler.MobileHelpText': 'Haritayı kaydırmak için iki parmak kullanın', 'CooperativeGesturesHandler.WindowsHelpText': 'Yakınlaştırmak için Ctrl tuşuna basılı tutarak tekerleği çevirin', 'CooperativeGesturesHandler.MacHelpText': 'Yakınlaştırmak için ⌘ tuşuna basılı tutarak tekerleği çevirin' }
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

/* Türkiye Nüfus Haritası (TÜİK ADNKS)
 * Veri: window.TOPO_VERI kökünün yanındaki nufus/ klasörü (gostergeler.json, piramit.json; topografya/veri deposu, jsDelivr)
 * Sınırlar: sinirlar/il-sade.topo.json (Türkiye görünümü), sinirlar/ilce/NN.topo.json (il görünümü), indirmede ayrıntılı il.topo.json / ilce-sade.topo.json
 */
(window.TOOLS = window.TOOLS || {}).nufus = { init: function (root) {
  'use strict';
  var SN = window.TA.SN, F = window.TA.F, SI = window.TA.SI, XL = window.TA.XL, U = window.U, $ = function (s) { return U.$(s, root); };
  var SINIR = window.TOPO_VERI;  // derleme betiği sürüm etiketli adresi yazar (build.js VERI_SURUM)
  var NUFUS = SINIR.replace(/sinirlar\/?$/, 'nufus/');
  // Mahalle ve köyler: ilçe başına GeoJSON (TÜİK ADNKS 2025 nüfusu; konum/sınır © OpenStreetMap). veri/scripts/mahalle/uret.py
  var MAHALLE = window.TOPO_MAHALLE || SINIR.replace(/sinirlar\/?$/, 'mahalle/');
  var cache = {};
  function getJson(url) {
    // Yerel inceleme paketi: veri sayfaya gömülü gelir (window.TOPO_GOMULU['nufus/gostergeler.json'] gibi)
    var g = window.TOPO_GOMULU, k = url.split('/').slice(-2).join('/');
    if (g && g[k]) return Promise.resolve(g[k]);
    if (!cache[url]) cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(url.split('/').pop() + ' alınamadı (' + r.status + ')'); return r.json(); })
      .catch(function (e) { delete cache[url]; throw e; });
    return cache[url];
  }
  function err(m) { var e = $('#nf-err'); e.textContent = m || ''; e.hidden = !m; }
  function durum(m) { $('#nf-durum').textContent = m || ''; }

  var st = { d: null, pir: null, il: null, ilce: null, gos: 'nufus', yil: null, ilFc: null, ilceFc: {} };
  var TR_KUTU = [[25.6, 35.8], [44.8, 42.2]];
  var api = window.HARITA.create($('#nf-map'), { center: [35.2, 39.0], zoom: 5, sinirGizle: true, altlik: 'gri', sinirla: true, ilSinir: false });
  api.ready.then(function () { api.map.fitBounds(TR_KUTU, { padding: 16, duration: 0 }); });
  // Tematik katman opaklığı ve bir üst düzeye dönüş düğmesi (harita üzerinde, altlık seçicinin altında)
  api.saydamlik(['nf-il', 'nf-ilce'], { deger: 100 });
  var geri = document.createElement('button'); geri.type = 'button'; geri.className = 'maplibregl-ctrl harita-geri'; geri.hidden = true; geri.id = 'nf-geri';
  geri.addEventListener('click', function () { if (st.ilce) { st.ilce = null; ciz(); var il = ilBul(st.il); ilceGeo(il.kod).then(function (fc) { sigdir(fc, 30); }); } else turkiye(); });
  api.map.addControl({ onAdd: function () { return geri; }, onRemove: function () { geri.remove(); } }, 'top-left');
  function geriGuncelle() { var il = st.il && ilBul(st.il); geri.hidden = !il; geri.textContent = st.ilce ? '‹ ' + il.ad + ' iline dön' : '‹ Türkiye\'ye dön'; }
  window.__nufus = st; // testler için

  // ---------- Göstergeler ----------
  function yi(y) { return st.d.yillar.indexOf(+y); }
  function iy(y) { return st.d.ilce_yillari.indexOf(+y); }
  function oran(a, b) { return a == null || !b ? null : 100 * a / b; }
  // Türkiye: TÜİK'in yayımladığı yoğunluk (göl yüzeyleri hariç). İl/ilçe: nüfus / OSM sınır alanı (göl ve iç sular dahil;
  // TÜİK il tablosundan birkaç % düşük çıkabilir) — Claude denetimi D3-08
  function yogun(o, y) { var j = yi(y); if (o.yogunluk_tuik && o.yogunluk_tuik[j] != null) return o.yogunluk_tuik[j]; var n = o.nufus[j]; return n == null ? null : n / o.alan_km2; }
  // 2025'te il sınırı değişen iller: TÜİK T38 artış hızı karşılaştırılabilir sınırla hesaplanır, ham nüfus farkından türetilen
  // oranla uyuşmaz (veri hazırlama betiği bu iki ilde farkı raporlar). Claude denetimi D3-18
  var SINIR_DEG = { '28': 2025, '29': 2025 };
  var YOGNOT = 'kişi/km² · OSM sınır alanıyla (göller dahil)';
  var G = [
    { k: 'nufus', ad: 'Nüfus', birim: 'kişi', dec: 0, palet: 'turuncu', ilce: true,
      il: function (o, y) { return o.nufus[yi(y)]; }, ic: function (c, y) { return c.n[iy(y)]; } },
    { k: 'yogunluk', ad: 'Nüfus yoğunluğu', birim: 'kişi/km²', dec: 1, palet: 'turuncu', ilce: true,
      il: yogun, ic: function (c, y) { return c.n[iy(y)] / c.alan_km2; } },
    { k: 'artis', ad: 'Yıllık nüfus artış hızı', birim: '‰', dec: 2, palet: 'iraksak', ilce: true, ilk: 2008,
      il: function (o, y) { return o.artis[yi(y)]; }, ic: function (c, y) { return c.artis[iy(y)]; } },
    { k: 'kentsel', ad: 'İl ve ilçe merkezlerinde yaşayanlar', birim: '%', dec: 1, palet: 'mavi', ilce: true, yillar: [2024, 2025],
      il: function (o, y) { var j = iy(y); return j < 0 ? null : oran(o.merkez[j], o.merkez[j] + o.koy[j]); }, ic: function (c, y) { var j = iy(y); return oran(c.merkez[j], c.n[j]); } },
    { k: 'ortanca', ad: 'Ortanca yaş', birim: 'yaş', dec: 1, palet: 'mavi', il: function (o, y) { return o.ortanca[0] && o.ortanca[0][yi(y)]; } },
    { k: 'yas014', ad: '0–14 yaştakilerin oranı', birim: '%', dec: 1, palet: 'yesil', il: function (o, y) { return o.yas014[yi(y)]; } },
    { k: 'yas65', ad: '65 ve üzeri yaştakilerin oranı', birim: '%', dec: 1, palet: 'mavi', il: function (o, y) { return o.yas65[yi(y)]; } },
    { k: 'bagimlilik', ad: 'Toplam yaş bağımlılık oranı', birim: '%', dec: 1, palet: 'turuncu', il: function (o, y) { return o.bagimlilik[0] && o.bagimlilik[0][yi(y)]; } },
    { k: 'yasli_bag', ad: 'Yaşlı bağımlılık oranı', birim: '%', dec: 1, palet: 'mavi', il: function (o, y) { return o.bagimlilik[2] && o.bagimlilik[2][yi(y)]; } },
    { k: 'hanehalki', ad: 'Ortalama hanehalkı büyüklüğü', birim: 'kişi', dec: 2, palet: 'yesil', il: function (o, y) { return o.hanehalki && o.hanehalki[yi(y)]; } },
    { k: 'cins_orani', ad: 'Cinsiyet oranı (100 kadına düşen erkek)', birim: '', dec: 1, palet: 'mavi', il: function (o, y) { return o.cins_orani[yi(y)]; } }
  ];
  var GK = {}; G.forEach(function (g) { GK[g.k] = g; });
  function gos() { return GK[st.gos]; }
  // Gösterge ilçe düzeyinde mi çizilecek? (il seçili ve gösterge ilçe verisine sahip)
  function ilceModu() { return !!st.il && !!gos().ilce; }
  function yillar(g) {
    if (ilceModu()) return st.d.ilce_yillari.slice();
    if (g.yillar) return g.yillar.slice();
    return st.d.yillar.filter(function (y) { var v = g.il(st.d.tr, y); return v != null && (!g.ilk || y >= g.ilk); });
  }
  function bicim(v, g, dec) { if (v == null || !isFinite(v)) return '—'; var d = dec == null ? g.dec : dec; return (g.birim === '%' || g.birim === '‰' ? g.birim : '') + U.num(v, d) + (g.birim && g.birim !== '%' && g.birim !== '‰' ? ' ' + g.birim : ''); }
  function deger(g, birim, y) { return birim.ilceler ? g.il(birim, y) : g.ic(birim, y); }

  // ---------- Kontroller ----------
  function gosSec() {
    var s = $('#nf-gos');
    s.innerHTML = '<optgroup label="İl ve ilçe düzeyi">' + G.filter(function (g) { return g.ilce; }).map(function (g) { return '<option value="' + g.k + '">' + g.ad + '</option>'; }).join('') + '</optgroup>' +
      '<optgroup label="İl düzeyi (TÜİK ilçe düzeyinde yayımlamıyor)">' + G.filter(function (g) { return !g.ilce; }).map(function (g) { return '<option value="' + g.k + '">' + g.ad + '</option>'; }).join('') + '</optgroup>';
    s.value = st.gos;
  }
  function yilSec() {
    var ys = yillar(gos()), s = $('#nf-yil'), eski = +s.value || st.yil;
    s.innerHTML = ys.slice().reverse().map(function (y) { return '<option>' + y + '</option>'; }).join('');
    st.yil = ys.indexOf(eski) >= 0 ? eski : ys[ys.length - 1]; s.value = st.yil;
  }
  $('#nf-gos').addEventListener('change', function (e) { st.gos = e.target.value; yilSec(); ciz(); });
  $('#nf-yil').addEventListener('change', function (e) { st.yil = +e.target.value; ciz(); });
  $('#nf-yon').addEventListener('change', function () { ciz(); });
  $('#nf-k').addEventListener('change', function () { ciz(); });

  // ---------- Geometri ----------
  function ilGeo() {
    if (st.ilFc) return Promise.resolve(st.ilFc);
    return getJson(SINIR + 'il-sade.topo.json').then(function (t) { st.ilFc = SN.fromTopo(t); return st.ilFc; });
  }
  function ilceGeo(kod) {
    if (st.ilceFc[kod]) return Promise.resolve(st.ilceFc[kod]);
    return getJson(SINIR + 'ilce/' + kod + '.topo.json').then(function (t) { st.ilceFc[kod] = SN.fromTopo(t); return st.ilceFc[kod]; });
  }
  var etiketBellek = {};
  function etiketler(fc, alan, tip) {
    return fc.features.map(function (f) {
      var k = tip + ':' + (f.properties.osm_id || f.properties.il_kodu);
      if (!etiketBellek[k]) etiketBellek[k] = window.HARITA.etiketNoktasi(f.geometry);
      // önem: nüfus (kalabalık birimin adı çakışmada öne geçer)
      var o = tip === 'il' ? ilBul(f.properties.il_kodu) : null, c = tip === 'ilce' && st.il ? ilceBul(ilBul(st.il), f.properties.osm_id) : null;
      var n = o ? o.nufus[o.nufus.length - 1] : c ? c.n[c.n.length - 1] : 0;
      return etiketBellek[k] ? { ad: tip === 'ilce' && c ? c.ad : f.properties[alan], c: etiketBellek[k], tip: tip, n: n || 0 } : null;
    }).filter(Boolean);
  }
  function ilBul(kod) { return st.d.iller.filter(function (o) { return o.kod === kod; })[0]; }
  function ilceBul(il, osm) { return il.ilceler.filter(function (c) { return String(c.osm_id) === String(osm); })[0]; }

  // ---------- Sınıflama ve harita ----------
  var sinirB = [], renkB = [];
  function sinifla(vals) {
    var g = gos(), k = +$('#nf-k').value, y = $('#nf-yon').value;
    sinirB = g.palet === 'iraksak' ? SI.iraksakSinirlar(vals, k, y) : SI.sinirlar(vals, k, y);
    var n = Math.max(1, sinirB.length - 1);
    if (g.palet === 'iraksak') {
      // sıfırın altı kırmızı, üstü mavi tonlar; sınıf sayısına göre ölçeğin iki ucundan alınır
      var negN = sinirB.filter(function (b) { return b < 0; }).length, posN = n - negN, P = SI.PALET.iraksak;
      renkB = [];
      for (var i = 0; i < negN; i++) renkB.push(P[Math.round(i * 2 / Math.max(1, negN - 1 || 1))] || P[2]);
      if (negN === 1) renkB[0] = P[1];
      for (var j = 0; j < posN; j++) renkB.push(P[4 + Math.round(j * 2 / Math.max(1, posN - 1 || 1))] || P[4]);
      if (posN === 1) renkB[renkB.length - 1] = P[5];
    } else renkB = SI.renkler(g.palet, n);
  }
  function renk(v) { var i = SI.sinifi(v, sinirB); return i < 0 ? null : renkB[i]; }
  var BOS = '#E4E2DC';
  function ciz() {
    if (!st.d) return;
    var g = gos(), y = st.yil;
    var il = st.il && ilBul(st.il);
    return ilGeo().then(function (ilFc) {
      var birimler = ilceModu() ? il.ilceler : st.d.iller;
      sinifla(birimler.map(function (b) { return deger(g, b, y); }));
      var ilF = ilFc.features.map(function (f) {
        var o = ilBul(f.properties.il_kodu), v = g.il(o, y), p = { kod: o.kod, ad: o.ad, deger: v };
        if (ilceModu()) p.renk = o.kod === st.il ? 'rgba(0,0,0,0)' : BOS;
        else p.renk = renk(v) || BOS;
        return { type: 'Feature', properties: p, geometry: f.geometry };
      });
      api.setData('nf-il', { type: 'FeatureCollection', features: ilF }, { line: '#FFFFFF', width: st.il ? 0.8 : 0.7, fillOpacity: 0.88, fillExpr: ['get', 'renk'] });
      // yer adları: Türkiye görünümünde il adları, il açılınca o ilin ilçe adları
      if (!st.il) api.etiketler(etiketler(ilFc, 'il_adi', 'il').sort(function (a, b) { return b.n - a.n; }));
      var ilceP = il ? ilceGeo(il.kod) : Promise.resolve(null);
      return ilceP.then(function (fc) {
        var cf = !fc ? [] : fc.features.map(function (f) {
          var c = ilceBul(il, f.properties.osm_id), v = c && gos().ilce ? g.ic(c, y) : null;
          var secili = st.ilce && String(f.properties.osm_id) === String(st.ilce);
          // Ortak seçim görünümü: seçili ilçe kendi sınıf renginde (mahalle daireleri okunsun diye açık tonda), diğer ilçeler soluk; kalın sınır nf-sec katmanında
          var r0 = ilceModu() ? (renk(v) || BOS) : null, rk = !r0 ? 'rgba(0,0,0,0)' : !st.ilce ? r0 : window.HARITA.rgba(r0, secili ? 0.5 : window.HARITA.SOLUK);
          return { type: 'Feature', properties: { osm: String(f.properties.osm_id), ad: c ? c.ad : f.properties.ilce_adi, deger: v, renk: rk }, geometry: f.geometry };
        });
        if (fc) api.etiketler(etiketler(fc, 'ilce_adi', 'ilce').sort(function (a, b) { return b.n - a.n; }));
        api.setData('nf-ilce', { type: 'FeatureCollection', features: cf }, { line: ilceModu() ? '#FFFFFF' : '#5A5A5A', width: ilceModu() ? 0.9 : 0.6, fillOpacity: 0.88, fillExpr: ['get', 'renk'] });
        // seçim çerçevesi
        var sec = [];
        if (st.ilce && fc) sec = fc.features.filter(function (f) { return String(f.properties.osm_id) === String(st.ilce); });
        else if (st.il) sec = ilFc.features.filter(function (f) { return f.properties.il_kodu === st.il; });
        api.secimCiz('nf-sec', sec);
        lejant(); panel();
        return mahCiz(il);
      });
    }).catch(function (e) { err(e.message); });
  }
  // ---------- Mahalle ve köyler ----------
  function mahHazir() { return !!st.mah && st.mahOsm != null && st.mahOsm === String(st.ilce); }
  function mahGeo(ilKod, osm) { return getJson(MAHALLE + ilKod + '/' + osm + '.geojson'); }
  // katman biçimleri ilk kurulumda bir kez uygulanır; boşaltırken de aynı biçim verilir
  var MAH_SINIR = { line: '#4A4A4A', width: 0.8, fillOpacity: 0, fillExpr: 'rgba(255,255,255,0)' }, MAH_NOKTA = { color: ['match', ['get', 't'], 'k', 'rgba(27,175,122,0.72)', 'rgba(204,76,2,0.68)'], line: '#FFFFFF',
    // yakınlaştırdıkça daireler büyür (alan oranı korunur); r: ilçe görünümündeki yarıçap
    radius: ['interpolate', ['linear'], ['zoom'], 8, ['*', ['get', 'r'], 0.45], 12, ['get', 'r'], 15, ['*', ['get', 'r'], 2]] };
  // en kalabalık birimin daire yarıçapı (px): birim sayısı arttıkça küçülür (kent ilçelerinde üst üste binmesin); alan nüfusla orantılı
  var MAH_R = 22;
  function mahR(adet) { return Math.max(10, Math.min(22, 22 * Math.sqrt(30 / Math.max(1, adet)))); }
  function mahYaricap(n, enCok) { return n > 0 ? Math.max(2.5, MAH_R * Math.sqrt(n / enCok)) : 0; }
  function mahCiz(il) {
    var bos = { type: 'FeatureCollection', features: [] };
    if (!st.ilce || !il) { st.mah = null; st.mahOsm = null; api.setData('nf-mah', bos, MAH_SINIR); api.setData('nf-mahn', bos, MAH_NOKTA); $('#nf-mahleg').hidden = true; return; }
    var osm = st.ilce; st.mahHata = null;
    // Başka ilçenin verisi ekranda ya da indirmede kalmasın: yeni ilçe yüklenene kadar mahalle durumu boştur (Codex denetimi D4-01)
    if (st.mahOsm !== osm) { st.mah = null; st.mahOsm = null; api.setData('nf-mah', bos, MAH_SINIR); api.setData('nf-mahn', bos, MAH_NOKTA); $('#nf-mahleg').hidden = true; kapsamSec(); }
    // önizleme paketinde yalnız bazı illerin mahalle verisi bulunur
    if (window.TOPO_MAHALLE_ILLER && window.TOPO_MAHALLE_ILLER.indexOf(il.kod) < 0) {
      st.mah = null; st.mahHata = 'Bu ilin mahalle ve köyleri sitede gösterilecek; önizleme yalnız birkaç örnek ili içeriyor.';
      api.setData('nf-mah', bos, MAH_SINIR); api.setData('nf-mahn', bos, MAH_NOKTA); $('#nf-mahleg').hidden = true; panel(); return;
    }
    return mahGeo(il.kod, osm).then(function (fc) {
      if (st.ilce !== osm) return;
      st.mah = fc; st.mahOsm = osm; MAH_R = mahR(fc.features.filter(function (f) { return f.properties.g !== '-'; }).length);
      var fs = fc.features, enCok = Math.max.apply(null, fs.map(function (f) { return f.properties.n; }).concat([1])), top = fs.reduce(function (t, f) { return t + f.properties.n; }, 0);
      var sinir = fs.filter(function (f) { return f.properties.g === 's' && f.geometry; }).map(function (f) { return { type: 'Feature', properties: { ad: f.properties.a, n: f.properties.n, t: f.properties.t, pay: top ? 100 * f.properties.n / top : 0 }, geometry: f.geometry }; });
      var nokta = fs.filter(function (f) { return f.properties.g === 's' ? f.properties.c : f.properties.g === 'n' && f.geometry; }).map(function (f) {
        var p = f.properties; return { type: 'Feature', properties: { ad: p.a, n: p.n, t: p.t, r: mahYaricap(p.n, enCok), pay: top ? 100 * p.n / top : 0, sinirli: p.g === 's' }, geometry: p.g === 's' ? { type: 'Point', coordinates: p.c } : f.geometry };
      }).sort(function (a, b) { return b.properties.n - a.properties.n; }); // büyük daireler altta
      api.setData('nf-mah', { type: 'FeatureCollection', features: sinir }, MAH_SINIR);
      api.setData('nf-mahn', { type: 'FeatureCollection', features: nokta }, MAH_NOKTA);
      mahLejant(fs, enCok);
      panel();
    }).catch(function (e) { if (st.ilce !== osm) return; st.mah = null; st.mahOsm = null; st.mahHata = 'Mahalle verisi alınamadı (' + e.message + '). Bağlantınızı denetleyip ilçeyi yeniden seçin.'; api.setData('nf-mah', bos, MAH_SINIR); api.setData('nf-mahn', bos, MAH_NOKTA); $('#nf-mahleg').hidden = true; panel(); });
  }
  function mahLejant(fs, enCok) {
    var c = { s: 0, n: 0, '-': 0 }; fs.forEach(function (f) { c[f.properties.g]++; });
    var ornek = [enCok, Math.round(enCok / 4), Math.round(enCok / 16)].filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
    // iç içe referans daireleri; etiketler sağda, birbirine binmeyecek aralıkla
    var R = MAH_R, h = 2 * R + 10, x = R + 4, svg = '<svg viewBox="0 0 ' + (2 * R + 110) + ' ' + h + '" class="nf-mahsvg" role="img" aria-label="Daire alanı nüfusla orantılı">', sonY = -99;
    ornek.forEach(function (v) {
      var r = mahYaricap(v, enCok), ust = h - 3 - 2 * r, ty = Math.max(ust + 4, sonY + 12, 10); sonY = ty;
      svg += '<circle cx="' + x + '" cy="' + (h - 3 - r).toFixed(1) + '" r="' + r.toFixed(1) + '" fill="none" stroke="#8A3A00"/><line x1="' + x + '" x2="' + (2 * R + 12) + '" y1="' + ust.toFixed(1) + '" y2="' + (ty - 4).toFixed(1) + '" stroke="#999" stroke-dasharray="2 2"/><text x="' + (2 * R + 16) + '" y="' + ty.toFixed(1) + '" class="nf-t">' + U.num(v, 0) + ' kişi</text>';
    });
    svg += '</svg>';
    var el = $('#nf-mahleg'); el.hidden = false;
    el.innerHTML = '<div class="nf-lb">Mahalle ve köy nüfusu, 2025</div>' + svg +
      '<div class="meta"><span class="nf-sw" style="background:#CC4C02"></span>mahalle <span class="nf-sw" style="background:#1BAF7A"></span>köy · daire alanı nüfusla orantılı; çok küçük birimler görünsün diye en küçük boyutta çizilir. ' + c.s + ' birim sınırıyla (ince çizgi), ' + c.n + ' birim konum noktasıyla gösteriliyor' + (c['-'] ? '; ' + c['-'] + ' birimin konumu OpenStreetMap\'te yok (yalnız tabloda)' : '') + '.<br>Nüfus: TÜİK ADNKS 2025 · Sınır ve konum: © OpenStreetMap katkıcıları (ODbL)</div>';
  }

  function lejant() {
    var g = gos(), el = $('#nf-leg'), il = st.il && ilBul(st.il);
    var baslik = g.ad + (g.birim ? ' (' + g.birim + ')' : '') + ', ' + st.yil;
    var kapsam = ilceModu() ? 'Sınıflar ' + il.ad + ' ilçelerine göre' : (st.il ? 'Bu gösterge ilçe düzeyinde yayımlanmıyor; iller gösteriliyor' : 'Sınıflar 81 ile göre');
    var satir = [];
    if (sinirB.length === 1) satir.push('<span class="nf-lk"><i style="background:' + renkB[0] + '"></i>' + U.num(sinirB[0], g.dec) + ' (bütün birimler aynı)</span>');
    for (var i = 0; i < sinirB.length - 1; i++) satir.push('<span class="nf-lk"><i style="background:' + renkB[i] + '"></i>' + U.num(sinirB[i], g.dec) + ' – ' + U.num(sinirB[i + 1], g.dec) + '</span>');
    el.innerHTML = '<div class="nf-lb">' + U.esc(baslik) + '</div><div class="nf-ls">' + satir.join('') + '</div><div class="meta">' + kapsam + ' · ' + (g.palet === 'iraksak' && sinirB[0] < 0 && sinirB[sinirB.length - 1] > 0 ? 'sıfırda ikiye bölünmüş (azalış/artış); her yanda ' : '') + ({ jenks: 'doğal kırılmalar', ceyrek: 'eşit sayı', esit: 'eşit aralık' })[$('#nf-yon').value] + ' · Kaynak: TÜİK ADNKS; sınırlar © OpenStreetMap' + (g.k === 'kentsel' ? '<br>30 büyükşehirde köy ve beldeler mahalleye dönüştüğünden (6360 sayılı Kanun) değer tanım gereği %100\'dür; kentleşme düzeyini göstermez.' : '') + '</div>';
  }

  // ---------- Etkileşim ----------
  var ipucu = $('#nf-ipucu');
  function goster(e, html) { ipucu.innerHTML = html; ipucu.hidden = false; var r = $('#nf-map').getBoundingClientRect(); ipucu.style.left = Math.min(r.width - 220, e.point.x + 14) + 'px'; ipucu.style.top = (e.point.y + 14) + 'px'; }
  api.ready.then(function () {
    var m = api.map;
    function mahIpucu(e) {
      var mh = st.ilce && m.queryRenderedFeatures(e.point, { layers: ['nf-mahn-pt', 'nf-mah-fill'].filter(function (l) { return m.getLayer(l); }) })[0];
      if (!mh) return false;
      var q = mh.properties, nokta = mh.layer.id === 'nf-mahn-pt' && String(q.sinirli) !== 'true';
      goster(e, '<strong>' + U.esc(q.ad) + '</strong><span>' + (q.t === 'k' ? 'Köy' : 'Mahalle') + '</span><em>Nüfus 2025: ' + U.num(+q.n, 0) + ' · ilçedeki payı %' + U.num(+q.pay, 1) + '</em>' +
        (nokta ? '<em>Sınırı yok; konum OpenStreetMap noktası (yaklaşık)</em>' : ''));
      return true;
    }
    m.on('mousemove', function (e) {
      if (mahIpucu(e)) { m.getCanvas().style.cursor = 'default'; return; }
      var g = gos(), hits = m.queryRenderedFeatures(e.point, { layers: ['nf-ilce-fill', 'nf-il-fill'].filter(function (l) { return m.getLayer(l); }) });
      var h = hits.filter(function (f) { return f.layer.id === 'nf-ilce-fill'; })[0] || hits[0];
      if (!h) { ipucu.hidden = true; m.getCanvas().style.cursor = ''; return; }
      m.getCanvas().style.cursor = 'pointer';
      var ilce = h.layer.id === 'nf-ilce-fill', p = h.properties, v = p.deger === 'null' || p.deger == null ? null : +p.deger;
      var gv = ilce && !g.ilce ? null : v;
      goster(e, '<strong>' + U.esc(p.ad) + '</strong>' + (ilce ? '<span>' + U.esc(ilBul(st.il).ad) + '</span>' : '') + '<em>' + U.esc(g.ad) + ': ' + (ilce && !g.ilce ? 'ilçe düzeyinde yok' : bicim(gv, g)) + '</em>');
    });
    m.on('mouseout', function () { ipucu.hidden = true; });
    m.on('click', function (e) {
      // dokunmatik ekranda fare gezinmesi yok: mahalleye dokununca bilgisi gösterilir, seçim değişmez (Gemini denetimi 1)
      if (mahIpucu(e)) return;
      ipucu.hidden = true;
      var hits = m.queryRenderedFeatures(e.point, { layers: ['nf-ilce-fill', 'nf-il-fill'].filter(function (l) { return m.getLayer(l); }) });
      var c = hits.filter(function (f) { return f.layer.id === 'nf-ilce-fill'; })[0];
      if (c && st.il) { if (String(c.properties.osm) !== String(st.ilce)) ilceAc(c.properties.osm); return; }
      var i = hits.filter(function (f) { return f.layer.id === 'nf-il-fill'; })[0];
      if (i) ilAc(i.properties.kod);
    });
  });
  function sigdir(fc, pad, maxZoom) { var b = api.bboxOf(fc); if (b) api.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad || 40, duration: 700, maxZoom: maxZoom || 11 }); }
  function ilAc(kod, sigdirma) {
    var once = { il: st.il, ilce: st.ilce }, ad = ilBul(kod).ad;
    st.il = kod; st.ilce = null; yilSec(); durum(ad + ' yükleniyor…'); err('');
    return ilceGeo(kod).then(function (fc) { durum(''); if (!sigdirma) sigdir(fc, 30); return ciz(); })
      .catch(function (e) { // Codex denetimi D4-03: takılı "yükleniyor" kalmasın, görünüm önceki seçime dönsün
        durum(''); st.il = once.il; st.ilce = once.ilce; yilSec(); ciz();
        err(ad + ' ilçe sınırları alınamadı (' + e.message + '). Bağlantınızı denetleyip ile yeniden tıklayın.');
      });
  }
  function ilceAc(osm) {
    st.ilce = String(osm); durum('Mahalleler yükleniyor…');
    var fc = st.ilceFc[st.il], f = fc && fc.features.filter(function (x) { return String(x.properties.osm_id) === st.ilce; })[0];
    if (f) sigdir({ type: 'FeatureCollection', features: [f] }, 30, 13.5);
    return Promise.resolve(ciz()).then(function () { durum(''); });
  }
  function turkiye() { st.il = null; st.ilce = null; yilSec(); api.map.fitBounds(TR_KUTU, { padding: 16, duration: 700 }); return ciz(); }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-nf]'); if (!a) return; e.preventDefault();
    var t = a.getAttribute('data-nf'), v = a.getAttribute('data-v');
    if (t === 'tr') turkiye(); else if (t === 'il') { if (st.il === v) { st.ilce = null; ciz(); } else ilAc(v); } else if (t === 'ilce') ilceAc(v);
  });

  // ---------- Panel ----------
  function kpi(etiket, deger, alt) { return '<div class="nf-k"><span class="nf-ke">' + etiket + '</span><span class="nf-kd">' + deger + '</span>' + (alt ? '<span class="nf-ka">' + alt + '</span>' : '') + '</div>'; }
  function binde(v) { return v == null || !isFinite(v) ? '—' : '‰' + U.num(v, 2); }
  function degisim(fark, yil) { return (fark >= 0 ? '+' : '−') + U.num(Math.abs(fark), 0) + ' kişi (' + yil + ' yılına göre)'; }
  function kart(baslik, govde, not) { return '<div class="card stack nf-kart"><div class="nf-kh"><h3>' + U.esc(baslik) + '</h3></div>' + govde + (not ? '<p class="meta nf-kn">' + not + '</p>' : '') + '</div>'; }
  // Büyükşehirlerde (6360 sayılı Kanun, 2014) köy ve beldeler mahalleye dönüştüğünden belde/köy nüfusu yoktur
  function bsNot(il) { return il && il.koy[1] === 0 ? il.ad + ' büyükşehir olduğundan (6360 sayılı Kanun) köy ve beldeler mahalle statüsündedir; nüfusun tamamı il ve ilçe merkezlerinde görünür; bu oran fiilî kır–kent ayrımını yansıtmaz.' : 'Kaynak: TÜİK ADNKS, il/ilçe merkezleri ile belde ve köyler ayrımı.'; }
  // Yığılmış yatay çubuk (parça–bütün). satirlar: [[ad, d1, d2, …]], dilimler: [[ad, renk, yazıRengi]]
  function yigin(satirlar, dilimler, yuzde) {
    var W = 360, L = 92, R = 46, H = 26, gap = 18, top = 22, s = ['<svg viewBox="0 0 ' + W + ' ' + (top + satirlar.length * (H + gap)) + '" class="nf-svg" role="img" aria-label="' + U.esc(dilimler.map(function (d) { return d[0]; }).join(', ') + ' payları: ' + satirlar.map(function (r) { return r[0]; }).join(', ')) + '">'];
    var lx = L; dilimler.forEach(function (d) { s.push('<rect x="' + lx + '" y="4" width="10" height="10" rx="2" fill="' + d[1] + '"/><text x="' + (lx + 14) + '" y="13" class="nf-tl">' + d[0] + '</text>'); lx += 18 + d[0].length * 6.2; });
    satirlar.forEach(function (r, i) {
      var y = top + i * (H + gap), tot = yuzde ? 100 : r.slice(1).reduce(function (a, b) { return a + b; }, 0), x = L;
      s.push('<text x="' + (L - 6) + '" y="' + (y + H / 2 + 4) + '" class="nf-tl" text-anchor="end">' + U.esc(r[0].length > 14 ? r[0].slice(0, 13) + '…' : r[0]) + '</text>');
      r.slice(1).forEach(function (v, k) {
        var p = tot ? 100 * v / tot : 0, w = (W - L - R) * p / 100; if (w <= 0) return;
        s.push('<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + Math.max(0, w - 2).toFixed(1) + '" height="' + H + '" rx="3" fill="' + dilimler[k][1] + '"><title>' + U.esc(r[0]) + ' · ' + dilimler[k][0] + ': %' + U.num(p, 1) + (yuzde ? '' : ' (' + U.num(v, 0) + ' kişi)') + '</title></rect>');
        if (w > 40) s.push('<text x="' + (x + w / 2 - 1).toFixed(1) + '" y="' + (y + H / 2 + 4) + '" class="nf-tv" text-anchor="middle" fill="' + dilimler[k][2] + '">%' + U.num(p, 1) + '</text>');
        else if (k === r.length - 2) s.push('<text x="' + (W - R + 5) + '" y="' + (y + H / 2 + 4) + '" class="nf-tv" fill="var(--text)">%' + U.num(p, 1) + '</text>');
        else s.push('<text x="' + x.toFixed(1) + '" y="' + (y + H + 12) + '" class="nf-t">%' + U.num(p, 1) + '</text>'); // dar dilim: etiket çubuğun altında (D3-19)
        x += w;
      });
    });
    s.push('</svg>'); return s.join('');
  }
  function yasGrafik(sat) { return yigin(sat, [['0–14 yaş', '#2A78D6', '#FFFFFF'], ['15–64 yaş', '#EB6834', '#111111'], ['65 ve üzeri', '#1BAF7A', '#111111']], true); }
  function yerlesimGrafik(sat) { return yigin(sat, [['İl ve ilçe merkezleri', '#2A78D6', '#FFFFFF'], ['Belde ve köyler', '#EB6834', '#111111']], false); }
  // Nokta grafiği: her gösterge için 81 ilin aralığı (çizgi), il (daire) ve Türkiye (dikey çizgi)
  function karsilastirma(il, Y) {
    var j = yi(Y), d = st.d, satir = [
      ['Ortanca yaş', function (o) { return o.ortanca[0][j]; }, 1, ''],
      ['Ortalama hanehalkı büyüklüğü', function (o) { return o.hanehalki[j]; }, 2, ' kişi'],
      ['Toplam yaş bağımlılık oranı', function (o) { return o.bagimlilik[0][j]; }, 1, '%'],
      ['Yaşlı bağımlılık oranı', function (o) { return o.bagimlilik[2][j]; }, 1, '%'],
      ['Cinsiyet oranı (100 kadına erkek)', function (o) { return o.cins_orani[j]; }, 1, ''],
      ['Yıllık nüfus artış hızı', function (o) { return o.artis[j]; }, 2, '‰']
    ].filter(function (r) { return r[1](d.tr) != null; });
    var W = 360, L = 8, R = 8, H = 60, s = ['<svg viewBox="0 0 ' + W + ' ' + (satir.length * H + 4) + '" class="nf-svg" role="img" aria-label="' + (il ? U.esc(il.ad) + ' ile ' : '') + 'Türkiye ve 81 ilin aralığı: ' + satir.map(function (r) { return r[0]; }).join(', ') + '">'];
    function f(v, r) { return r[3] === '%' || r[3] === '‰' ? r[3] + U.num(v, r[2]) : U.num(v, r[2]) + r[3]; }
    satir.forEach(function (r, i) {
      var vals = d.iller.map(r[1]).filter(function (v) { return v != null; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var enAz = d.iller.filter(function (o) { return r[1](o) === lo; })[0], enCok = d.iller.filter(function (o) { return r[1](o) === hi; })[0];
      var sx = function (v) { return L + (W - L - R) * (hi === lo ? 0.5 : (v - lo) / (hi - lo)); }, y = i * H + 44, tv = r[1](d.tr), iv = il ? r[1](il) : null;
      s.push('<text x="' + L + '" y="' + (y - 30) + '" class="nf-tl">' + r[0] + '</text>');
      s.push('<text x="' + L + '" y="' + (y - 14) + '" class="nf-t"><tspan font-weight="600">' + (il ? U.esc(il.ad) + ' ' + f(iv, r) + ' · ' : '') + '</tspan>Türkiye ' + f(tv, r) + '</text>');
      s.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" class="nf-aralik"><title>En düşük ' + enAz.ad + ' ' + f(lo, r) + ' · en yüksek ' + enCok.ad + ' ' + f(hi, r) + '</title></line>');
      s.push('<text x="' + L + '" y="' + (y + 13) + '" class="nf-t">' + U.esc(enAz.ad) + ' ' + f(lo, r) + '</text><text x="' + (W - R) + '" y="' + (y + 13) + '" class="nf-t" text-anchor="end">' + U.esc(enCok.ad) + ' ' + f(hi, r) + '</text>');
      s.push('<line x1="' + sx(tv).toFixed(1) + '" x2="' + sx(tv).toFixed(1) + '" y1="' + (y - 7) + '" y2="' + (y + 7) + '" class="nf-tr"><title>Türkiye ' + f(tv, r) + '</title></line>');
      if (iv != null) s.push('<circle cx="' + sx(iv).toFixed(1) + '" cy="' + y + '" r="5.5" class="nf-il"><title>' + U.esc(il.ad) + ' ' + f(iv, r) + '</title></circle>');
    });
    s.push('</svg>'); return s.join('');
  }
  function panel() {
    var d = st.d, g = gos(), y = st.yil, il = st.il && ilBul(st.il), ilce = il && st.ilce && ilceBul(il, st.ilce);
    // konum yolu
    var yol = ['<a href="#" data-nf="tr">Türkiye</a>'];
    if (il) yol.push('<a href="#" data-nf="il" data-v="' + il.kod + '">' + U.esc(il.ad) + '</a>');
    if (ilce) yol.push('<span>' + U.esc(ilce.ad) + '</span>');
    $('#nf-yol').innerHTML = yol.join('<span class="nf-ok">›</span>');
    var birim = ilce || il || d.tr, ad = ilce ? ilce.ad : il ? il.ad : 'Türkiye';
    $('#nf-duzey').textContent = ilce ? 'İlçe · ' + il.ad : il ? 'İl · ' + il.ilceler.length + ' ilçe' : 'Ülke · 81 il, ' + d.iller.reduce(function (s, o) { return s + o.ilceler.length; }, 0) + ' ilçe';
    $('#nf-big').textContent = ad;
    var gv = ilce ? (g.ilce ? g.ic(ilce, y) : null) : g.il(birim, y);
    $('#nf-meta').textContent = g.ad + ', ' + y + ': ' + (ilce && !g.ilce ? 'ilçe düzeyinde yayımlanmıyor' : bicim(gv, g));
    // göstergeler: seçili yıl (il düzeyinde 2007–2025; merkez/köy ve ilçe verisi 2024–2025)
    var Y = d.yillar.indexOf(y) >= 0 ? y : d.yillar[d.yillar.length - 1], j2 = Math.max(0, d.ilce_yillari.indexOf(Y)), YM = d.ilce_yillari[j2], k = [];
    if (ilce) {
      var n = ilce.n[j2], n0 = j2 ? ilce.n[0] : null;
      k.push(kpi('Nüfus, ' + YM, U.num(n, 0), n0 != null ? degisim(n - n0, YM - 1) : 'İlçe verisi 2024–2025'));
      k.push(kpi('Yıllık nüfus artış hızı', binde(ilce.artis[j2]), j2 ? '2024: ' + binde(ilce.artis[0]) : 'Türkiye: ' + binde(d.tr.artis[yi(YM)])));
      k.push(kpi('Nüfus yoğunluğu', U.num(n / ilce.alan_km2, 1), YOGNOT + ' · Türkiye ' + U.num(yogun(d.tr, YM), 1) + ' (TÜİK)'));
      k.push(kpi('İl nüfusundaki payı', '%' + U.num(oran(n, il.ilceler.reduce(function (s, c) { return s + c.n[j2]; }, 0)), 1), il.ad + ' ilçeleri arasında ' + (il.ilceler.slice().sort(function (a, b) { return b.n[j2] - a.n[j2]; }).indexOf(ilce) + 1) + '. sırada'));
      $('#nf-kpi').innerHTML = '<div class="nf-tiles">' + k.join('') + '</div>' + mahKart(ilce) + kart('Yerleşim yerine göre nüfus, ' + YM, yerlesimGrafik([[ilce.ad, ilce.merkez[j2], ilce.koy[j2]], [il.ad, il.merkez[j2], il.koy[j2]], ['Türkiye', d.tr.merkez[j2], d.tr.koy[j2]]]), bsNot(il)) +
        '<p class="hint">Yaş, cinsiyet ve hanehalkı göstergeleri TÜİK toplu verisinde ilçe düzeyinde yayımlanmaz; aşağıdaki piramit ve karşılaştırma ' + U.esc(il.ad) + ' ilinindir.</p>' + kart('Türkiye ile karşılaştırma: ' + il.ad + ', ' + Y, karsilastirma(il, Y), 'Çizgi 81 ilin en düşük ve en yüksek değeri arasıdır; daire ' + il.ad + ', dikey çizgi Türkiye.');
    } else {
      var o = birim, j = yi(Y), nn = o.nufus[j];
      k.push(kpi('Nüfus, ' + Y, U.num(nn, 0), j ? degisim(nn - o.nufus[j - 1], Y - 1) : ''));
      k.push(kpi('Yıllık nüfus artış hızı', binde(o.artis[j]), (j > 1 ? (Y - 1) + ': ' + binde(o.artis[j - 1]) : '') + (il && SINIR_DEG[il.kod] === Y ? ' · ' + Y + '\'te il sınırı değişti; TÜİK hızı karşılaştırılabilir sınırla hesaplar, nüfus farkıyla birebir tutmaz' : '')));
      k.push(kpi('Nüfus yoğunluğu', U.num(yogun(o, Y), 1), il ? YOGNOT + ' · Türkiye ' + U.num(yogun(d.tr, Y), 1) + ' (TÜİK)' : 'kişi/km² · TÜİK'));
      var yasSat = [[il ? il.ad : 'Türkiye', o.yas014[j], 100 - o.yas014[j] - o.yas65[j], o.yas65[j]]];
      if (il) yasSat.push(['Türkiye', d.tr.yas014[j], 100 - d.tr.yas014[j] - d.tr.yas65[j], d.tr.yas65[j]]);
      var yer = [[il ? il.ad : 'Türkiye', o.merkez[j2], o.koy[j2]]]; if (il) yer.push(['Türkiye', d.tr.merkez[j2], d.tr.koy[j2]]);
      $('#nf-kpi').innerHTML = '<div class="nf-tiles">' + k.join('') + '</div>' +
        kart('Geniş yaş gruplarına göre nüfus, ' + Y, yasGrafik(yasSat), 'Toplam nüfus içindeki pay') +
        kart('Yerleşim yerine göre nüfus, ' + YM, yerlesimGrafik(yer), bsNot(il)) +
        kart((il ? 'Türkiye ile karşılaştırma: ' + il.ad : 'İller arasındaki dağılım') + ', ' + Y, karsilastirma(il, Y), il ? 'Çizgi 81 ilin en düşük ve en yüksek değeri arasıdır; daire ' + il.ad + ', dikey çizgi Türkiye.' : 'Çizgi 81 ilin en düşük ve en yüksek değeri arasıdır; dikey çizgi Türkiye.');
    }
    piramitCiz(); trendCiz(); siraCiz(); geriGuncelle();
  }

  // Mahalle ve köyler kartı: en kalabalık 10 birim (yatay çubuk) ve bütün birimlerin tablosu
  function mahKart(ilce) {
    if (st.mahHata) return kart('Mahalle ve köyler, 2025', '<p class="hint">' + U.esc(st.mahHata) + '</p>', '');
    if (!mahHazir() || String(st.ilce) !== String(ilce.osm_id)) return kart('Mahalle ve köyler, 2025', '<p class="hint">Yükleniyor…</p>', '');
    var fs = st.mah.features.map(function (f) { return f.properties; }).slice().sort(function (a, b) { return b.n - a.n || a.a.localeCompare(b.a, 'tr'); });
    var top = fs.reduce(function (t, p) { return t + p.n; }, 0), nm = fs.filter(function (p) { return p.t === 'm'; }).length, nk = fs.length - nm;
    var belSay = {}; fs.forEach(function (p) { if (p.b) belSay[p.b] = (belSay[p.b] || 0) + 1; });
    var anaBel = Object.keys(belSay).sort(function (a, b) { return belSay[b] - belSay[a]; })[0];
    var ilk = fs.slice(0, 10), enCok = ilk.length ? ilk[0].n : 1, W = 360, L = 132, R = 56, H = 20;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + (ilk.length * (H + 6) + 4) + '" class="nf-svg" role="img" aria-label="En kalabalık ' + ilk.length + ' mahalle ve köy">';
    ilk.forEach(function (p, i) {
      var y = i * (H + 6) + 2, w = Math.max(1, (W - L - R) * p.n / enCok), ad = p.a.replace(/ (Mah|Köy)\.$/, '');
      svg += '<text x="' + (L - 6) + '" y="' + (y + H / 2 + 4) + '" class="nf-tl" text-anchor="end">' + U.esc(ad.length > 20 ? ad.slice(0, 19) + '…' : ad) + '</text>' +
        '<rect x="' + L + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + H + '" rx="3" fill="' + (p.t === 'k' ? '#1BAF7A' : '#CC4C02') + '"><title>' + U.esc(p.a) + ': ' + U.num(p.n, 0) + ' kişi</title></rect>' +
        '<text x="' + (L + w + 5).toFixed(1) + '" y="' + (y + H / 2 + 4) + '" class="nf-tv" fill="var(--text)">' + U.num(p.n, 0) + '</text>';
    });
    svg += '</svg>';
    var tablo = '<div class="scroll nf-mahtab"><table class="t"><thead><tr><th>Ad</th><th>Tür</th><th class="num">Nüfus</th><th class="num">Pay</th><th>Haritada</th></tr></thead><tbody>' +
      fs.map(function (p) { return '<tr><td>' + U.esc(p.a.replace(/ (Mah|Köy)\.$/, '')) + (p.b && p.b !== anaBel ? '<span class="sub">' + U.esc(p.b.replace(/ Bel\.$/, '')) + ' beldesi</span>' : '') + '</td><td>' + (p.t === 'k' ? 'Köy' : 'Mahalle') + '</td><td class="num">' + U.num(p.n, 0) + '</td><td class="num">%' + U.num(top ? 100 * p.n / top : 0, 1) + '</td><td>' + ({ s: 'sınır', n: 'nokta', '-': '—' })[p.g] + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var fark = ilce.n[1] - top;
    return kart('Mahalle ve köyler, 2025', '<p class="nf-mahoz">' + nm + ' mahalle' + (nk ? ', ' + nk + ' köy' : '') + ' · toplam ' + U.num(top, 0) + ' kişi</p>' + svg +
      '<p class="hint"><span class="nf-sw" style="background:#CC4C02"></span>mahalle <span class="nf-sw" style="background:#1BAF7A"></span>köy · en kalabalık ' + ilk.length + '</p>' + tablo,
      'Kaynak: TÜİK ADNKS 2025 (mahalle ve köy nüfusları). TÜİK mahalle düzeyinde cinsiyet ve yaş kırılımı yayımlamaz.' + (fark > 0 ? ' Mahalle ve köy toplamı ilçe nüfusundan ' + U.num(fark, 0) + ' kişi azdır; fark TÜİK\'in iki tablosu arasındadır.' : ''));
  }

  // ---------- Grafikler (SVG) ----------
  var ER = '#2A78D6', KA = '#EB6834';
  // Grafik ipucu: SVG üzerinde gezinirken en yakın veri noktasını gösteren kutu (tek bir ortak öğe)
  var gIpucu = document.createElement('div'); gIpucu.className = 'nf-gip'; gIpucu.hidden = true; document.body.appendChild(gIpucu);
  function ipucuGoster(e, html) { gIpucu.innerHTML = html; gIpucu.hidden = false; var x = e.clientX + 14, y = e.clientY + 14, w = gIpucu.offsetWidth; if (x + w > window.innerWidth - 8) x = e.clientX - w - 14; gIpucu.style.left = x + 'px'; gIpucu.style.top = y + 'px'; }
  function ipucuGizle() { gIpucu.hidden = true; }
  function piramitCiz() {
    var el = $('#nf-pir'), not = $('#nf-pir-not'), il = st.il && ilBul(st.il);
    if (!st.pir) { el.innerHTML = '<p class="hint">Yükleniyor…</p>'; return; }
    var kod = il ? il.kod : 'TR', p = st.pir.piramit[kod], P = st.pir.piramit.TR, j = st.pir.yillar.indexOf(st.yil); if (j < 0) j = st.pir.yillar.length - 1;
    var yil = st.pir.yillar[j], E = p.E[j], K = p.K[j], sum = function (a) { return a.reduce(function (s, v) { return s + v; }, 0); }, top = sum(E) + sum(K);
    var tE = P.E[j], tK = P.K[j], tTop = sum(tE) + sum(tK), ag = st.pir.yas_gruplari;
    var pe = E.map(function (v) { return 100 * v / top; }), pk = K.map(function (v) { return 100 * v / top; });
    var te = tE.map(function (v) { return 100 * v / tTop; }), tk = tK.map(function (v) { return 100 * v / tTop; });
    var mxv = Math.max.apply(null, pe.concat(pk, il ? te.concat(tk) : [])), adim = mxv > 6 ? 2 : 1, mx = Math.ceil(mxv / adim) * adim;
    var W = 360, H = 300, orta = 42, ust = 6, alt = 40, yarim = (W - orta) / 2 - 6, sat = (H - ust - alt) / 19, xl = W / 2 - orta / 2, xr = W / 2 + orta / 2;
    var sx = function (v) { return v / mx * yarim; }, s = [];
    s.push('<svg viewBox="0 0 ' + W + ' ' + H + '" class="nf-svg nf-pir" role="img" aria-label="Nüfus piramidi ' + yil + '">');
    // ızgara ve eksen (yüzde)
    for (var t = 0; t <= mx; t += adim) {
      [xl - sx(t), xr + sx(t)].forEach(function (x, k) { if (t === 0 && k === 1) return; s.push('<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + ust + '" y2="' + (H - alt + 2) + '" class="nf-grid"/>'); s.push('<text x="' + x.toFixed(1) + '" y="' + (H - alt + 14) + '" class="nf-t" text-anchor="middle">%' + t + '</text>'); });
    }
    for (var i = 0; i < 19; i++) {
      var yy = ust + (18 - i) * sat, h = sat - 2;
      s.push('<path d="M' + xl + ' ' + yy.toFixed(1) + 'h' + (-Math.max(0, sx(pe[i]) - 2)).toFixed(1) + 'a2 2 0 0 0 -2 2v' + (h - 4).toFixed(1) + 'a2 2 0 0 0 2 2h' + Math.max(0, sx(pe[i]) - 2).toFixed(1) + 'z" fill="' + ER + '"/>');
      s.push('<path d="M' + xr + ' ' + yy.toFixed(1) + 'h' + Math.max(0, sx(pk[i]) - 2).toFixed(1) + 'a2 2 0 0 1 2 2v' + (h - 4).toFixed(1) + 'a2 2 0 0 1 -2 2h' + (-Math.max(0, sx(pk[i]) - 2)).toFixed(1) + 'z" fill="' + KA + '"/>');
      if (i % 2 === 0 || i === 18) s.push('<text x="' + (W / 2) + '" y="' + (yy + h * 0.78).toFixed(1) + '" class="nf-t" text-anchor="middle">' + ag[i] + '</text>');
      s.push('<rect x="0" y="' + yy.toFixed(1) + '" width="' + W + '" height="' + sat.toFixed(1) + '" fill="transparent" data-i="' + i + '"/>');
    }
    if (il) { // Türkiye: basamaklı ince çizgi
      ['E', 'K'].forEach(function (c) {
        var d = '', arr = c === 'E' ? te : tk;
        for (var i2 = 0; i2 < 19; i2++) { var y1 = ust + (18 - i2) * sat, x = c === 'E' ? xl - sx(arr[i2]) : xr + sx(arr[i2]); d += (i2 ? 'L' : 'M') + x.toFixed(1) + ' ' + (y1 + sat - 1).toFixed(1) + 'L' + x.toFixed(1) + ' ' + y1.toFixed(1); }
        s.push('<path d="' + d + '" class="nf-ref"/>');
      });
    }
    s.push('<text x="' + xl + '" y="' + (H - 6) + '" class="nf-tl" text-anchor="end"><tspan fill="' + ER + '">■</tspan> Erkek %' + U.num(100 * sum(E) / top, 1) + '</text>');
    s.push('<text x="' + xr + '" y="' + (H - 6) + '" class="nf-tl"><tspan fill="' + KA + '">■</tspan> Kadın %' + U.num(100 * sum(K) / top, 1) + '</text>');
    s.push('</svg>');
    el.innerHTML = s.join('');
    var svg = el.querySelector('svg');
    svg.addEventListener('mousemove', function (e) {
      var r = e.target.getAttribute && e.target.getAttribute('data-i'); if (r == null) { ipucuGizle(); return; } r = +r;
      ipucuGoster(e, '<strong>' + ag[r] + ' yaş</strong><span><i style="background:' + ER + '"></i>Erkek ' + U.num(E[r], 0) + ' · %' + U.num(pe[r], 2) + '</span><span><i style="background:' + KA + '"></i>Kadın ' + U.num(K[r], 0) + ' · %' + U.num(pk[r], 2) + '</span>' + (il ? '<em>Türkiye: erkek %' + U.num(te[r], 2) + ' · kadın %' + U.num(tk[r], 2) + '</em>' : ''));
    });
    svg.addEventListener('mouseleave', ipucuGizle);
    not.textContent = (il ? il.ad : 'Türkiye') + ', ' + yil + ' · toplam nüfusun yüzdesi' + (il ? ' · ince çizgi Türkiye' : '') + (st.ilce ? ' · ilçe düzeyinde yaş verisi yok, il piramidi gösteriliyor' : '');
  }
  function cizgiGrafik(xs, seriler, g) {
    var W = 360, H = 180, L = 46, R = 14, T = 14, B = 26, vals = [];
    seriler.forEach(function (s) { s.v.forEach(function (v) { if (v != null) vals.push(v); }); });
    if (!vals.length) return '<p class="hint">Veri yok.</p>';
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (g.k === 'artis') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    var pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.05 || 1; lo -= pad; hi += pad;
    var sx = function (i) { return L + (W - L - R) * (xs.length < 2 ? 0.5 : i / (xs.length - 1)); }, sy = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var gid = 'nfg' + Math.random().toString(36).slice(2, 7), s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="nf-svg nf-cizgi" role="img" aria-label="' + U.esc(g.ad) + ' yıllara göre"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + seriler[0].renk + '" stop-opacity=".22"/><stop offset="1" stop-color="' + seriler[0].renk + '" stop-opacity="0"/></linearGradient></defs>'];
    for (var t = 0; t <= 4; t++) { var v = lo + (hi - lo) * t / 4, yy = sy(v); s.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="nf-grid"/><text x="' + (L - 6) + '" y="' + (yy + 3).toFixed(1) + '" class="nf-t" text-anchor="end">' + kisa(v, g) + '</text>'); }
    if (g.k === 'artis') s.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(0).toFixed(1) + '" y2="' + sy(0).toFixed(1) + '" class="nf-sifir"/>');
    var adim = Math.ceil(xs.length / 6);
    xs.forEach(function (x, i) { if (i % adim === 0 || i === xs.length - 1) s.push('<text x="' + sx(i).toFixed(1) + '" y="' + (H - 8) + '" class="nf-t" text-anchor="middle">' + x + '</text>'); });
    seriler.slice().reverse().forEach(function (sr, ri) {
      var d = '', on = false, ilk = null, son = null;
      sr.v.forEach(function (v, i) { if (v == null) { on = false; return; } d += (on ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1); on = true; if (ilk == null) ilk = i; son = i; });
      if (!sr.ince && ilk != null && xs.length > 2) s.push('<path d="' + d + 'L' + sx(son).toFixed(1) + ' ' + (H - B) + 'L' + sx(ilk).toFixed(1) + ' ' + (H - B) + 'Z" fill="url(#' + gid + ')"/>');
      s.push('<path d="' + d + '" fill="none" stroke="' + sr.renk + '" stroke-width="' + (sr.ince ? 1.4 : 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (sr.ince ? ' stroke-dasharray="4 3"' : '') + '/>');
      if (!sr.ince && son != null) { s.push('<circle cx="' + sx(son).toFixed(1) + '" cy="' + sy(sr.v[son]).toFixed(1) + '" r="4" fill="' + sr.renk + '" stroke="var(--panel)" stroke-width="2"/>'); if (xs.length <= 3 && ilk !== son) s.push('<circle cx="' + sx(ilk).toFixed(1) + '" cy="' + sy(sr.v[ilk]).toFixed(1) + '" r="4" fill="' + sr.renk + '" stroke="var(--panel)" stroke-width="2"/>'); }
    });
    s.push('<line class="nf-imlec" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/><circle class="nf-imlec-n" r="4.5" visibility="hidden"/>');
    s.push('<rect x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="transparent" class="nf-hedef"/>');
    s.push('</svg>');
    return s.join('');
  }
  // Çizgi grafiğe imleç: en yakın yıl, dikey çizgi ve ipucu
  function cizgiEtkilesim(el, xs, seriler, g, adlar) {
    var svg = el.querySelector('svg'); if (!svg) return;
    var W = 360, H = 180, L = 46, R = 14, T = 14, B = 26, vals = [];
    seriler.forEach(function (s) { s.v.forEach(function (v) { if (v != null) vals.push(v); }); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (g.k === 'artis') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    var pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.05 || 1; lo -= pad; hi += pad;
    var sx = function (i) { return L + (W - L - R) * (xs.length < 2 ? 0.5 : i / (xs.length - 1)); }, sy = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var cizgi = svg.querySelector('.nf-imlec'), nok = svg.querySelector('.nf-imlec-n');
    svg.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, i = Math.round((x - L) / (W - L - R) * (xs.length - 1));
      if (i < 0 || i >= xs.length || x < L - 6) { ipucuGizle(); cizgi.setAttribute('visibility', 'hidden'); nok.setAttribute('visibility', 'hidden'); return; }
      var v = seriler[0].v[i];
      cizgi.setAttribute('x1', sx(i)); cizgi.setAttribute('x2', sx(i)); cizgi.setAttribute('visibility', 'visible');
      if (v != null) { nok.setAttribute('cx', sx(i)); nok.setAttribute('cy', sy(v)); nok.setAttribute('fill', seriler[0].renk); nok.setAttribute('visibility', 'visible'); }
      ipucuGoster(e, '<strong>' + xs[i] + '</strong>' + seriler.map(function (sr, k) { return '<span><i style="background:' + sr.renk + '"></i>' + U.esc(adlar[k]) + ': ' + bicim(sr.v[i], g) + '</span>'; }).join(''));
    });
    svg.addEventListener('mouseleave', function () { ipucuGizle(); cizgi.setAttribute('visibility', 'hidden'); nok.setAttribute('visibility', 'hidden'); });
  }
  function kisa(v, g) { var a = Math.abs(v); if (a >= 1e6) return U.num(v / 1e6, 1) + ' mn'; if (a >= 1e4) return U.num(v / 1e3, 0) + ' bin'; return U.num(v, g.dec > 1 && a < 10 ? 1 : (a < 100 ? 1 : 0)); }
  function trendCiz() {
    var g = gos(), il = st.il && ilBul(st.il), ilce = il && st.ilce && ilceBul(il, st.ilce), el = $('#nf-trend'), not = $('#nf-trend-not');
    $('#nf-trend-baslik').textContent = g.ad + (g.birim ? ' (' + g.birim + ')' : '');
    if (ilce) {
      if (!g.ilce) { el.innerHTML = '<p class="hint">Bu gösterge TÜİK\'te ilçe düzeyinde yayımlanmıyor; il değeri sağdaki göstergelerdedir.</p>'; not.textContent = ''; return; }
      var ys = st.d.ilce_yillari;
      var sr0 = [{ v: ys.map(function (y) { return g.ic(ilce, y); }), renk: '#CC4C02' }];
      el.innerHTML = cizgiGrafik(ys, sr0, g); cizgiEtkilesim(el, ys, sr0, g, [ilce.ad]);
      not.textContent = ilce.ad + ' · ilçe verisi ' + ys[0] + '–' + ys[ys.length - 1]; return;
    }
    var xs = g.yillar ? g.yillar.slice() : st.d.yillar.filter(function (y) { return g.il(st.d.tr, y) != null && (!g.ilk || y >= g.ilk); });
    var seriler = [{ v: xs.map(function (y) { return g.il(il || st.d.tr, y); }), renk: '#CC4C02' }];
    if (il && g.k !== 'nufus') seriler.push({ v: xs.map(function (y) { return g.il(st.d.tr, y); }), renk: '#6B6B6B', ince: true });
    el.innerHTML = cizgiGrafik(xs, seriler, g); cizgiEtkilesim(el, xs, seriler, g, il ? [il.ad, 'Türkiye'] : ['Türkiye']);
    not.textContent = (il ? il.ad + (g.k !== 'nufus' ? ' · kesikli çizgi Türkiye' : '') : 'Türkiye') + ' · ' + xs[0] + '–' + xs[xs.length - 1];
  }
  function siraCiz() {
    var g = gos(), y = st.yil, il = st.il && ilBul(st.il), el = $('#nf-sira');
    var liste, tip;
    if (ilceModu()) { liste = il.ilceler.map(function (c) { return { k: String(c.osm_id), ad: c.ad, v: g.ic(c, y) }; }); tip = 'ilce'; }
    else { liste = st.d.iller.map(function (o) { return { k: o.kod, ad: o.ad, v: g.il(o, y) }; }); tip = 'il'; }
    liste = liste.filter(function (x) { return x.v != null; }).sort(function (a, b) { return b.v - a.v; });
    $('#nf-sira-baslik').textContent = (tip === 'ilce' ? il.ad + ' ilçeleri' : 'İller') + ': ' + g.ad.toLocaleLowerCase('tr');
    $('#nf-sira-not').textContent = st.yil + ' · ' + liste.length + ' birim';
    var mx = Math.max.apply(null, liste.map(function (x) { return Math.abs(x.v); })) || 1, secili = tip === 'ilce' ? st.ilce : st.il;
    el.innerHTML = liste.map(function (x, i) {
      var w = Math.abs(x.v) / mx * 100;
      return '<a href="#" class="nf-sr' + (x.k === secili ? ' on' : '') + '" data-nf="' + tip + '" data-v="' + x.k + '"><span class="nf-sn">' + (i + 1) + '</span><span class="nf-sa">' + U.esc(x.ad) + '</span><span class="nf-sb"><i style="width:' + w.toFixed(1) + '%;background:' + (renk(x.v) || BOS) + '"></i></span><span class="nf-sv">' + bicim(x.v, g) + '</span></a>';
    }).join('');
    $('#nf-harita-not').textContent = st.ilce ? 'Mahalle ve köyler nüfuslarıyla gösteriliyor; daireye gelince ayrıntısı görünür. Başka ilçeye tıklayarak geçebilirsiniz.' : st.il ? (ilceModu() ? 'İlçeye tıklayınca mahalle ve köyleri açılır.' : 'Bu gösterge ilçe düzeyinde yok; ilçe sınırları yalnız çizgi olarak gösteriliyor. İlçeye tıklayınca mahalle ve köyleri açılır.') : 'İl seçmek için haritada ile ya da sıralamadaki ada tıklayın.';
    kapsamSec();
  }

  // ---------- Dışa aktarma ----------
  // Kapsam bulunulan düzeye göre: Türkiye'de 81 il ya da tüm ilçeler; ilde o il ya da ilçeleri; ilçede yalnız o ilçe
  function kapsamSec() {
    var s = $('#nf-kapsam'), eski = s.value, o = [], il = st.il && ilBul(st.il), ilce = il && st.ilce && ilceBul(il, st.ilce);
    if (ilce) { o.push(['ilce', ilce.ad + ' (' + il.ad + ') ilçesi']); if (mahHazir()) o.push(['mahalle', ilce.ad + ' mahalle ve köyleri (' + st.mah.features.length + ')']); }
    else if (il) o.push(['il', il.ad + ' ili: göstergeler ve yıllık seri'], ['ilin', il.ad + ' ilçeleri (' + il.ilceler.length + ')']);
    else o.push(['iller', '81 il'], ['ilceler', 'Türkiye\'nin tüm ilçeleri (973)']);
    s.innerHTML = o.map(function (x) { return '<option value="' + x[0] + '">' + U.esc(x[1]) + '</option>'; }).join('');
    if (o.some(function (x) { return x[0] === eski; })) s.value = eski;
    dlNot();
  }
  function dlNot() {
    var f = $('#nf-fmt').value, k = $('#nf-kapsam').value, n = [];
    if (f === 'xlsx') n.push({ iller: 'Sayfalar: Bilgi, İller (seçili yılın göstergeleri), Nüfus 2007–2025, Yaş ve cinsiyet (19 yaş grubu).', il: 'Sayfalar: Bilgi, Göstergeler, Yıllık seri 2007–2025, Yaş ve cinsiyet (19 yaş grubu).', ilin: 'Sayfalar: Bilgi, İlçeler (2024 ve 2025 nüfusu, merkez/köy, artış hızı, yoğunluk).', ilceler: 'Sayfalar: Bilgi, İlçeler (2024 ve 2025 nüfusu, merkez/köy, artış hızı, yoğunluk).', ilce: 'Sayfalar: Bilgi, İlçe (2024 ve 2025 nüfusu, merkez/köy, artış hızı, yoğunluk).' }[k]);
    if (f === 'csv') n.push((k === 'il' ? 'Yıllık seri tablosu. ' : '') + 'Ayraç noktalı virgül, ondalık virgül, UTF-8; Excel\'de doğrudan açılır.');
    if (k === 'mahalle') {
      n.push(/shp|geojson|kml|dxf/.test(f) ? 'Sınırı olan birimler çokgen, yalnız konumu olanlar nokta olarak; konumu olmayanlar coğrafi biçimlerde yer almaz (tabloda vardır). ' + (f === 'dxf' ? 'DXF: 3° TM (TUREF) metre koordinatı, ad yazılı; mahalle ve köy ayrı katmanda. Dilim orta meridyeni ve EPSG kodu BENIOKU.txt\'dedir.' : 'WGS84 (EPSG:4326).') : 'Bütün mahalle ve köyler; konum sütunları sınırlılarda çokgen içi temsil noktası, diğerlerinde OSM noktasıdır.');
      n.push('Atıf: "Kaynak: TÜİK, ADNKS 2025" ve "© OpenStreetMap katkıcıları (ODbL)".'); $('#nf-dlnot').textContent = n.join(' '); return;
    }
    if (/shp|geojson|kml|dxf/.test(f)) n.push('Sınırlar OpenStreetMap kaynaklı, ' + (f === 'dxf' ? '3° TM (TUREF) metre koordinatı, ad yazılı; dilim orta meridyeni verinin ortasına göre seçilir ve BENIOKU.txt\'de yazılıdır. ' : 'WGS84 coğrafi koordinat (EPSG:4326). ') + (k === 'ilceler' ? 'Tüm ilçeler sade geometriyle (≈500 m) verilir; bir ilin ilçeleri ayrıntılı geometriyle (≈30 m) iner.' : 'Ayrıntılı geometri (≈30 m).') + ' Öznitelik adları ve anlamları BENIOKU.txt\'dedir.');
    n.push('Atıf: "Kaynak: TÜİK, ADNKS"' + (/shp|geojson|kml|dxf/.test(f) ? ' ve "© OpenStreetMap katkıcıları (ODbL)".' : '.'));
    $('#nf-dlnot').textContent = n.join(' ');
  }
  $('#nf-fmt').addEventListener('change', dlNot); $('#nf-kapsam').addEventListener('change', dlNot);
  var ALAN = [ // [anahtar (≤10, CBS özniteliği), başlık (Excel/CSV), işlev]
    ['nufus', 'Nüfus'], ['yogunluk', 'Nüfus yoğunluğu (kişi/km²)'], ['artis', 'Yıllık nüfus artış hızı (‰)'], ['kentsel', 'İl/ilçe merkezlerinde yaşayanlar (%)'],
    ['ortanca', 'Ortanca yaş'], ['yas014', '0–14 yaş oranı (%)'], ['yas65', '65+ yaş oranı (%)'], ['bagimlilik', 'Toplam yaş bağımlılık oranı (%)'], ['yasli_bag', 'Yaşlı bağımlılık oranı (%)'], ['hanehalki', 'Ortalama hanehalkı büyüklüğü'], ['cins_orani', 'Cinsiyet oranı (100 kadına erkek)']
  ];
  function yuv(v, d) { return v == null || !isFinite(v) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d); }
  function ilSatirlari(y, tekIl) {
    var bas = ['il_kodu', 'il_adi', 'alan_km2'].concat(ALAN.map(function (a) { return a[0]; })), satir = [];
    (tekIl ? [tekIl] : st.d.iller).forEach(function (o) { satir.push([o.kod, o.ad, yuv(o.alan_km2, 1)].concat(ALAN.map(function (a) { var g = GK[a[0]]; return yuv(g.il(o, g.yillar && g.yillar.indexOf(y) < 0 ? g.yillar[g.yillar.length - 1] : y), g.dec); }))); });
    return { bas: bas, basT: ['İl kodu', 'İl', 'Alan (km², OSM)'].concat(ALAN.map(function (a) { return a[1]; })), satir: satir };
  }
  function ilceSatirlari(il, tekIlce) {
    var bas = ['il_kodu', 'il_adi', 'ilce_adi', 'osm_id', 'alan_km2', 'nufus_2024', 'nufus_2025', 'merkez2025', 'koy_2025', 'artis_2024', 'artis_2025', 'yogunluk25', 'kentsel25'];
    var basT = ['İl kodu', 'İl', 'İlçe', 'OSM kimliği', 'Alan (km², OSM)', 'Nüfus 2024', 'Nüfus 2025', 'İlçe merkezi nüfusu 2025', 'Belde ve köy nüfusu 2025', 'Artış hızı 2024 (‰)', 'Artış hızı 2025 (‰)', 'Yoğunluk 2025 (kişi/km²)', 'Merkezde yaşayanlar 2025 (%)'];
    var satir = [];
    (il ? [il] : st.d.iller).forEach(function (o) { o.ilceler.forEach(function (c) { if (tekIlce && c !== tekIlce) return; satir.push([o.kod, o.ad, c.ad, c.osm_id, yuv(c.alan_km2, 1), c.n[0], c.n[1], c.merkez[1], c.koy[1], c.artis[0], c.artis[1], yuv(c.n[1] / c.alan_km2, 1), yuv(oran(c.merkez[1], c.n[1]), 2)]); }); });
    return { bas: bas, basT: basT, satir: satir };
  }
  function mahSatirlari(il, ilce) {
    var bas = ['il_kodu', 'il_adi', 'ilce_adi', 'tuik_kodu', 'ad', 'tur', 'belediye', 'nufus2025', 'gosterim', 'enlem', 'boylam', 'alan_km2', 'osm'];
    var basT = ['İl kodu', 'İl', 'İlçe', 'TÜİK birim kodu', 'Mahalle/köy', 'Tür', 'Bağlı belediye', 'Nüfus 2025', 'Haritada', 'Enlem (WGS84)', 'Boylam (WGS84)', 'Alan (km², OSM sınırı)', 'OSM kimliği'];
    var satir = st.mah.features.map(function (f) {
      var p = f.properties, c = p.g === 's' ? p.c : (p.g === 'n' && f.geometry ? f.geometry.coordinates : null);
      return [il.kod, il.ad, ilce.ad, p.k, p.a, p.t === 'k' ? 'köy' : 'mahalle', p.b || null, p.n, ({ s: 'sınır', n: 'nokta', '-': 'yok' })[p.g], c ? yuv(c[1], 6) : null, c ? yuv(c[0], 6) : null, p.km2 != null ? p.km2 : null, p.o || null];
    }).sort(function (a, b) { return b[7] - a[7]; });
    return { bas: bas, basT: basT, satir: satir };
  }
  function bilgi() {
    var k = st.d.kaynak;
    return [['Başlık', 'Değer'], ['Kaynak', k.kurum + ', ' + k.urun], ['TÜİK tabloları', Object.keys(k.tablolar).join(', ')], ['Portal', k.portal], ['Kullanım', k.kosul], ['Sınırlar', k.sinir], ['Artış hızı', k.artis_notu], ['Alan', k.alan_notu],
      ['Derleme', 'topografya.com.tr Türkiye Nüfus Haritası, veri sürümü ' + st.d.derleme + ' (' + SINIR.replace(/sinirlar\/?$/, '') + ')'], ['Sınır lisansı', 'Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/ · https://www.openstreetmap.org/copyright'], ['Atıf', 'Kaynak: TÜİK, Adrese Dayalı Nüfus Kayıt Sistemi; derleme: topografya.com.tr']];
  }
  // Paketteki koordinat sistemi açıkça yazılır (DXF dosyası kendi içinde koordinat sistemi taşımaz; Codex canlı denetimi 6)
  function crsNotu(crs) {
    var S = window.TA.K.SYSTEMS[crs];
    if (!S || S.kind === 'geo') return 'Koordinat sistemi: WGS84 coğrafi koordinat (enlem, boylam; EPSG:4326)\r\n';
    return 'Koordinat sistemi: ' + S.label + ' (EPSG:' + S.epsg + ')\r\n  Datum: TUREF (ITRF96, GRS80 elipsoidi) · Projeksiyon: 3° dilimli Transversal Merkator\r\n  Dilim orta meridyeni: ' + S.cm + '° D · Ölçek katsayısı: 1 · Yalancı doğu (sağa değer): 500.000 m · Yalancı kuzey: 0\r\n  Birim: metre · DXF\'te X = sağa değer (Y), Y = yukarı değer (X)\r\n';
  }
  function benioku(t, crs) { return 'Türkiye Nüfus Haritası verisi\r\n\r\n' + (crs ? crsNotu(crs) + '\r\n' : '') + bilgi().slice(1).map(function (r) { return r[0] + ': ' + r[1]; }).join('\r\n') + '\r\n\r\nÖznitelikler\r\n' + t.bas.map(function (b, i) { return b + ': ' + t.basT[i]; }).join('\r\n') + '\r\n'; }
  function yillikSeri(o) {
    var bas = ['Yıl', 'Nüfus', 'Yıllık nüfus artış hızı (‰)', 'Ortanca yaş', 'Ortanca yaş, erkek', 'Ortanca yaş, kadın', '0–14 yaş oranı (%)', '65+ yaş oranı (%)', 'Toplam yaş bağımlılık oranı (%)', 'Çocuk bağımlılık oranı (%)', 'Yaşlı bağımlılık oranı (%)', 'Ortalama hanehalkı büyüklüğü', 'Cinsiyet oranı (100 kadına erkek)'];
    return [bas].concat(st.d.yillar.map(function (y, j) { return [y, o.nufus[j], o.artis[j], o.ortanca[0][j], o.ortanca[1][j], o.ortanca[2][j], o.yas014[j], o.yas65[j], o.bagimlilik[0][j], o.bagimlilik[1][j], o.bagimlilik[2][j], o.hanehalki && o.hanehalki[j], o.cins_orani[j]]; }));
  }
  $('#nf-dl').addEventListener('click', function () {
    err('');
    var f = $('#nf-fmt').value, k = $('#nf-kapsam').value, il = st.il && ilBul(st.il), ilceO = il && st.ilce && ilceBul(il, st.ilce);
    var Y = st.d.yillar.indexOf(st.yil) >= 0 ? st.yil : st.d.yillar[st.d.yillar.length - 1];
    if (k === 'mahalle') return mahIndir(f, il, ilceO);
    var ilceDuzey = k === 'ilin' || k === 'ilceler' || k === 'ilce';
    var t = ilceDuzey ? ilceSatirlari(k === 'ilceler' ? null : il, k === 'ilce' ? ilceO : null) : ilSatirlari(Y, k === 'il' ? il : null);
    var ad = 'nufus_' + ({ iller: 'iller', ilceler: 'tum_ilceler', il: il && U.slug(il.ad), ilin: il && U.slug(il.ad) + '_ilceler', ilce: ilceO && U.slug(il.ad) + '_' + U.slug(ilceO.ad) })[k] + '_' + (ilceDuzey ? 2025 : Y);
    var is = Promise.resolve();
    if (f === 'xlsx') {
      is = (ilceDuzey ? Promise.resolve(null) : piramitYukle()).then(function () {
        var sayfa = [{ ad: 'Bilgi', satirlar: bilgi(), genislik: [18, 110] }, { ad: k === 'ilce' ? 'İlçe' : ilceDuzey ? 'İlçeler' : k === 'il' ? 'Göstergeler ' + Y : 'İller ' + Y, satirlar: [t.basT].concat(t.satir) }];
        if (k === 'il') {
          sayfa.push({ ad: 'Yıllık seri', satirlar: yillikSeri(il) });
          var ag = st.pir.yas_gruplari, jj = st.pir.yillar.indexOf(Y), p = st.pir.piramit[il.kod];
          sayfa.push({ ad: 'Yaş ve cinsiyet ' + Y, satirlar: [['Yaş grubu', 'Erkek', 'Kadın', 'Toplam']].concat(ag.map(function (a, i) { return [a, p.E[jj][i], p.K[jj][i], p.E[jj][i] + p.K[jj][i]]; })) });
        } else if (k === 'iller') {
          sayfa.push({ ad: 'Nüfus 2007-' + st.d.yillar[st.d.yillar.length - 1], satirlar: [['İl kodu', 'İl'].concat(st.d.yillar)].concat(st.d.iller.map(function (o) { return [o.kod, o.ad].concat(o.nufus); })) });
          var ag2 = st.pir.yas_gruplari, j = st.pir.yillar.indexOf(Y);
          sayfa.push({ ad: 'Yaş ve cinsiyet ' + Y, satirlar: [['İl kodu', 'İl'].concat(ag2.map(function (a) { return 'Erkek ' + a; }), ag2.map(function (a) { return 'Kadın ' + a; }))].concat(st.d.iller.map(function (o) { var p2 = st.pir.piramit[o.kod]; return [o.kod, o.ad].concat(p2.E[j], p2.K[j]); })) });
        }
        U.download(ad + '.xlsx', XL.yaz(sayfa));
      });
    } else if (f === 'csv') {
      // atıf ve lisans dosyadan ayrılmasın diye CSV, BENIOKU ile birlikte zip olarak iner (Codex denetimi L4-01)
      var csvF = {}, enc0 = new TextEncoder(); csvF[ad + '.csv'] = enc0.encode(U.csvRapor(k === 'il' ? yillikSeri(il) : [t.basT].concat(t.satir))); csvF['BENIOKU.txt'] = enc0.encode(benioku(t));
      U.download(ad + '_csv.zip', F.zip(csvF));
    } else {
      durum('Sınırlar hazırlanıyor…');
      var geo = ilceDuzey ? (k === 'ilceler' ? getJson(SINIR + 'ilce-sade.topo.json').then(SN.fromTopo) : ilceGeo(il.kod)) : getJson(SINIR + 'il.topo.json').then(SN.fromTopo);
      is = geo.then(function (fc) {
        var idx = {}; t.satir.forEach(function (r) { idx[ilceDuzey ? String(r[3]) : r[0]] = r; });
        var feats = fc.features.map(function (g) { var r = idx[ilceDuzey ? String(g.properties.osm_id) : g.properties.il_kodu]; if (!r) return null; var p = {}; t.bas.forEach(function (b, i) { p[b] = r[i]; }); p.kaynak = 'TÜİK ADNKS; sınır © OSM'; return { type: 'Feature', properties: p, geometry: g.geometry }; }).filter(Boolean);
        var yo = yazOpt(f, feats, ilceDuzey ? 'ilce_adi' : 'il_adi', null, ilceDuzey ? 150 : 400), out = F.write({ type: 'FeatureCollection', features: feats }, 'geo-turef', yo, ad);
        var files = {}, enc = new TextEncoder();
        if (f === 'shp') { files = F.unzip(out.data); } else files[out.name] = typeof out.data === 'string' ? enc.encode(out.data) : out.data;
        files['BENIOKU.txt'] = enc.encode(benioku(t, yo.crs));
        durum(''); U.download(ad + '_' + f + '.zip', F.zip(files));
      });
    }
    is.catch(function (e) { durum(''); err('İndirme hazırlanamadı: ' + e.message); });
  });

  // DXF: CAD için 3° TM (TUREF) metre koordinatı, dilim verinin orta boylamından; ad yazısı ve katman (Gemini denetimi 4)
  function yazOpt(f, feats, adAlan, katman, yazi) {
    if (f !== 'dxf') return { format: f, crs: 'geo-turef', nameField: adAlan };
    var b = F.bbox({ type: 'FeatureCollection', features: feats }), cm = Math.min(45, Math.max(27, 3 * Math.round((b ? (b[0] + b[2]) / 2 : 33) / 3)));
    return { format: 'dxf', crs: 'tm-turef-' + cm, nameField: adAlan, textField: adAlan, textHeight: yazi, layerField: katman || null };
  }
  function mahIndir(f, il, ilce) {
    if (!mahHazir() || !ilce || String(ilce.osm_id) !== st.mahOsm) { err('Mahalle verisi henüz yüklenmedi; yükleme bitince yeniden deneyin.'); return; }
    var t = mahSatirlari(il, ilce), ad = 'nufus_' + U.slug(il.ad) + '_' + U.slug(ilce.ad) + '_mahalle_koy_2025';
    var bil = bilgi().concat([['Mahalle ve köy nüfusu', 'TÜİK MEDAS, ADNKS 2025: belediye, köy ve mahalle nüfusları (mahalle düzeyinde cinsiyet kırılımı yayımlanmaz)'], ['Mahalle sınır ve konumu', '© OpenStreetMap katkıcıları (ODbL 1.0); TÜİK adıyla ilçe içinde eşleştirilmiştir. Sınırı olmayanlarda OSM noktası, ikisi de yoksa konum boş.']]);
    if (f === 'xlsx') return U.download(ad + '.xlsx', XL.yaz([{ ad: 'Bilgi', satirlar: bil, genislik: [22, 110] }, { ad: 'Mahalle ve köyler', satirlar: [t.basT].concat(t.satir) }]));
    var mb = 'Mahalle ve köy nüfusu\r\n\r\n' + bil.slice(1).map(function (r) { return r[0] + ': ' + r[1]; }).join('\r\n') + '\r\n\r\nÖznitelikler\r\n' + t.bas.map(function (b, i) { return b + ': ' + t.basT[i]; }).join('\r\n') + '\r\n';
    if (f === 'csv') { var cf = {}, e0 = new TextEncoder(); cf[ad + '.csv'] = e0.encode(U.csvRapor([t.basT].concat(t.satir))); cf['BENIOKU.txt'] = e0.encode(mb); return U.download(ad + '_csv.zip', F.zip(cf)); }
    var idx = {}; t.satir.forEach(function (r) { idx[r[3]] = r; });
    var feats = st.mah.features.filter(function (x) { return x.geometry; }).map(function (x) { var r = idx[x.properties.k], p = {}; t.bas.forEach(function (b, i) { p[b] = r[i]; }); p.kaynak = 'TÜİK ADNKS; konum © OSM'; return { type: 'Feature', properties: p, geometry: x.geometry }; });
    var yo = yazOpt(f, feats, 'ad', 'tur', 20), out = F.write({ type: 'FeatureCollection', features: feats }, 'geo-turef', yo, ad);
    var files = {}, enc = new TextEncoder();
    if (f === 'shp') files = F.unzip(out.data); else files[out.name] = typeof out.data === 'string' ? enc.encode(out.data) : out.data;
    files['BENIOKU.txt'] = enc.encode(crsNotu(yo.crs) + '\r\n' + mb);
    U.download(ad + '_' + f + '.zip', F.zip(files));
  }

  // ---------- Başlangıç ----------
  function piramitYukle() { if (st.pir) return Promise.resolve(st.pir); return getJson(NUFUS + 'piramit.json').then(function (p) { st.pir = p; return p; }); }
  durum('Veriler yükleniyor…');
  getJson(NUFUS + 'gostergeler.json').then(function (d) {
    st.d = d; durum(''); gosSec(); yilSec();
    piramitYukle().then(function () { piramitCiz(); }).catch(function (e) { $('#nf-pir').innerHTML = '<p class="hint">Piramit verisi alınamadı: ' + U.esc(e.message) + '</p>'; });
    return api.ready.then(ciz);
  }).catch(function (e) { durum(''); err('Veriler alınamadı: ' + e.message); });
  // testler için
  st._ilAc = ilAc; st._ilceAc = ilceAc; st._turkiye = turkiye;
}};

(function(){var s=document.getElementById('t-nufus');U.subtabs(s);TOOLS['nufus'].init(s);})();