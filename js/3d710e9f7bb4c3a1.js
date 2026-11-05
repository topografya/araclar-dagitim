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
        if (opts.ilSec) ilSecKur(t, cizgi);
      }).catch(function () { /* il sınırı alınamazsa harita yine çalışır */ });
    }
    // İle tıklayıp yakınlaşma (opts.ilSec; Mekânsal Analiz, Haritada Ölç): Türkiye görünümünde iller seçilebilir, üzerine gelince
    // il adı görünür ve ilin kenarı koyulaşır; tıklayınca harita kayarak o ile yakınlaşır (nüfus haritasındaki gibi). z 7'den sonra kapanır.
    var IL_SEC_Z = 7;
    // Araçların kendi harita tıklamaları (nokta yüksekliği, bakış noktası) il seçimi etkinken (Türkiye görünümü) çalışmaz
    api.ilSecte = function () { return !!(opts.ilSec && !api._cizim && map.getZoom() < IL_SEC_Z && map.getLayer('_ilsec-fill')); };
    function ilSecKur(t, yay) {
      var o = t.objects[Object.keys(t.objects)[0]];
      function halka(ix) { var c = []; ix.forEach(function (i, k) { var a = i < 0 ? yay[~i].slice().reverse() : yay[i]; c = c.concat(k ? a.slice(1) : a); }); return c; }
      var fc = { type: 'FeatureCollection', features: o.geometries.map(function (g) {
        var c = g.type === 'Polygon' ? g.arcs.map(halka) : g.arcs.map(function (p) { return p.map(halka); });
        return { type: 'Feature', properties: { ad: g.properties.il_adi }, geometry: { type: g.type, coordinates: c } };
      }) };
      api.setData('_ilsec', fc, { fillOpacity: 0.001, line: 'rgba(0,0,0,0)', width: 0, maxZoom: IL_SEC_Z });
      var vurgu = null;
      function vurgula(f) { var ad = f ? f.properties.ad : null; if (ad === vurgu) return; vurgu = ad;
        api.setData('_ilsec-v', { type: 'FeatureCollection', features: f ? fc.features.filter(function (x) { return x.properties.ad === ad; }) : [] }, { line: '#111111', width: 2.2, fillOpacity: 0.12, maxZoom: IL_SEC_Z }); }
      function bul(e) { if (api._cizim || map.getZoom() >= IL_SEC_Z || !map.getLayer('_ilsec-fill')) return null; return map.queryRenderedFeatures(e.point, { layers: ['_ilsec-fill'] })[0] || null; }
      var ip = document.createElement('div'); ip.className = 'harita-ipucu'; ip.hidden = true; el.appendChild(ip);
      map.on('mousemove', function (e) {
        var f = bul(e); vurgula(f); map.getCanvas().style.cursor = f ? 'pointer' : (api._cizim ? 'crosshair' : '');
        if (!f) { ip.hidden = true; return; }
        ip.innerHTML = '<strong></strong><span>Yakınlaşmak için tıklayın</span>'; ip.firstChild.textContent = f.properties.ad;
        ip.hidden = false; ip.style.left = Math.max(4, Math.min(el.clientWidth - 224, e.point.x + 14)) + 'px'; ip.style.top = Math.min(el.clientHeight - 60, e.point.y + 14) + 'px';
      });
      map.on('mouseout', function () { ip.hidden = true; vurgula(null); });
      map.on('click', function (e) {
        var f = bul(e); if (!f) return;
        var ad = f.properties.ad, tam = fc.features.filter(function (x) { return x.properties.ad === ad; })[0], b = api.bboxOf({ features: [tam] });
        ip.hidden = true; vurgula(null);
        // büyük il ya da dar ekranda yakınlaşma il seçim eşiğinin altında kalmasın (yoksa araç tıklamaları açılmaz)
        var cam = map.cameraForBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 30, maxZoom: 11 }) || {};
        map.easeTo({ center: cam.center || [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], zoom: Math.max(cam.zoom || 0, IL_SEC_Z + 0.2), duration: 800 });
      });
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

/* Türkiye İl ve İlçe Sınırları arayüzü
 * Veri kökü: window.TOPO_VERI (site: jsDelivr, önizleme: yanındaki dosyalar)
 */
(window.TOOLS = window.TOOLS || {}).sinirlar = { init: function (root) {
  'use strict';
  var SN = window.TA.SN, F = window.TA.F, K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var BASE = window.TOPO_VERI;  // derleme betiği sürüm etiketli adresi yazar (build.js VERI_SURUM)
  U.zipper = function (name, data) { var o = {}; o[name] = typeof data === 'string' ? new TextEncoder().encode(data) : data; return F.zip(o); };
  var st = { level: 'il', ozet: null, ilSade: null, ilceSade: null, ilAyr: null, ilceAyr: {}, sel: { il: new Set(), ilce: new Set() }, open: new Set(), q: '' };
  // Altlığın kendi idari sınır çizgileri gizlenir: haritada yalnız indirilecek verinin sınırları görünür (iki farklı sınırın kayık görünmesini önler)
  var api = window.HARITA.create($('#sn-map'), { center: [35.2, 39.0], zoom: 5, sinirGizle: true, turkiye: true, altlik: 'gri', sinirla: true, ilSinir: false });
  api.saydamlik(['birim']); // tematik katman opaklığı
  var cache = {};
  function getJson(name) {
    if (!cache[name]) cache[name] = fetch(BASE + name).then(function (r) { if (!r.ok) throw new Error(name + ' alınamadı (' + r.status + ')'); return r.json(); });
    return cache[name];
  }
  function err(m) { var e = $('#sn-err'); e.textContent = m || ''; e.hidden = !m; }

  // ---------- Liste ----------
  function keyOf(f) { return st.level === 'il' ? f.properties.il_kodu : String(f.properties.osm_id); }
  function renderList() {
    var box = $('#sn-list'), html = [], oz = st.ozet; if (!oz) return;
    oz.iller.forEach(function (il) {
      var m = SN.match(st.q, il); if (!m.il) return;
      if (st.level === 'il') {
        html.push('<label class="sn-row"><input type="checkbox" data-il="' + il.kod + '"' + (st.sel.il.has(il.kod) ? ' checked' : '') + '><span class="sn-k">' + il.kod + '</span><span class="sn-n">' + U.esc(il.ad) + '</span><span class="sn-a">' + U.num(il.alan_km2, 0) + ' km²</span></label>');
      } else {
        var ids = il.ilceler.map(function (c) { return String(c.osm_id); }), n = ids.filter(function (i) { return st.sel.ilce.has(i); }).length;
        var open = st.open.has(il.kod) || (st.q && m.ilceler && m.ilceler.length);
        html.push('<div class="sn-grp"><div class="sn-row"><button type="button" class="sn-exp" data-exp="' + il.kod + '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-label="' + U.esc(il.ad) + ' ilçelerini ' + (open ? 'gizle' : 'göster') + '">' + (open ? '▾' : '▸') + '</button>' +
          '<label class="sn-lab"><input type="checkbox" data-ilgrp="' + il.kod + '"' + (n === ids.length && n ? ' checked' : '') + (n && n < ids.length ? ' data-mixed="1"' : '') + '><span class="sn-k">' + il.kod + '</span><span class="sn-n">' + U.esc(il.ad) + '</span><span class="sn-a">' + (n ? n + '/' : '') + ids.length + ' ilçe</span></label></div>');
        if (open) {
          html.push('<div class="sn-sub">');
          il.ilceler.forEach(function (c) {
            if (m.ilceler && m.ilceler.indexOf(c.osm_id) < 0) return;
            html.push('<label class="sn-row"><input type="checkbox" data-ilce="' + c.osm_id + '"' + (st.sel.ilce.has(String(c.osm_id)) ? ' checked' : '') + '><span class="sn-n">' + U.esc(c.ad) + '</span><span class="sn-a">' + U.num(c.alan_km2, 1) + ' km²</span></label>');
          });
          html.push('</div>');
        }
        html.push('</div>');
      }
    });
    box.innerHTML = html.join('') || '<p class="hint" style="padding:10px">Eşleşen birim yok.</p>';
    U.$$('input[data-mixed]', box).forEach(function (i) { i.indeterminate = true; });
    summary();
  }
  function selected() { return st.level === 'il' ? st.sel.il : st.sel.ilce; }
  function summary() {
    var oz = st.ozet, s = selected(), alan = 0;
    if (st.level === 'il') oz.iller.forEach(function (il) { if (s.has(il.kod)) alan += il.alan_km2; });
    else oz.iller.forEach(function (il) { il.ilceler.forEach(function (c) { if (s.has(String(c.osm_id))) alan += c.alan_km2; }); });
    $('#sn-sel').textContent = s.size ? s.size + ' ' + (st.level === 'il' ? 'il' : 'ilçe') + ' seçildi · toplam ' + U.num(alan, 1) + ' km²' : 'Seçim yok. Listeden ya da haritadan birim seçin.';
    $('#sn-dl').disabled = !s.size;
    $('#sn-dl').textContent = s.size ? s.size + ' ' + (st.level === 'il' ? 'ili' : 'ilçeyi') + ' indir' : 'İndir';
    suggestCrs(); drawMap();
  }

  // ---------- Harita ----------
  // Yakınlaşınca (z ≥ 8) görünen illerin ayrıntılı (≈30 m) geometrisi yüklenir ve sade (≈500 m) geometrinin yerine çizilir;
  // böylece kıyı ve sınırlar altlıkla örtüşür. Dosyalar yalnız gerektiğinde ve bir kez indirilir (CDN).
  var ayr = {}; // anahtar → ayrıntılı geometri
  function ayrintiYukle() {
    if (!st.ozet || api.map.getZoom() < 8) return;
    var b = api.map.getBounds(), w = b.getWest(), so = b.getSouth(), e = b.getEast(), n = b.getNorth();
    var gorunen = st.ozet.iller.filter(function (il) { var x = il.bbox; return x && x[0] < e && x[2] > w && x[1] < n && x[3] > so; });
    if (!gorunen.length || gorunen.length > 8) return;
    var is;
    if (st.level === 'il') {
      if (gorunen.every(function (il) { return ayr['il:' + il.kod]; })) return;
      is = (st.ilAyr ? Promise.resolve(st.ilAyr) : getJson('il.topo.json').then(function (t) { st.ilAyr = SN.fromTopo(t); return st.ilAyr; }))
        .then(function (fc) { fc.features.forEach(function (f) { ayr['il:' + f.properties.il_kodu] = f.geometry; }); });
    } else {
      is = Promise.all(gorunen.map(function (il) {
        return st.ilceAyr[il.kod] ? Promise.resolve(st.ilceAyr[il.kod]) : getJson('ilce/' + il.kod + '.topo.json').then(function (t) { st.ilceAyr[il.kod] = SN.fromTopo(t); return st.ilceAyr[il.kod]; });
      })).then(function (list) { list.forEach(function (fc) { fc.features.forEach(function (f) { ayr['ilce:' + f.properties.osm_id] = f.geometry; }); }); });
    }
    is.then(drawMap).catch(function () { /* ayrıntı alınamazsa sade geometri kalır */ });
  }
  function displayFc() {
    var fc = st.level === 'il' ? st.ilSade : st.ilceSade; if (!fc) return null;
    var s = selected();
    return { type: 'FeatureCollection', features: fc.features.map(function (f) { var k = keyOf(f); return { type: 'Feature', properties: { k: k, sec: s.has(k) ? 1 : 0, ad: f.properties.ilce_adi || f.properties.il_adi, il: f.properties.ilce_adi ? f.properties.il_adi : '', alan: f.properties.alan_km2 }, geometry: ayr[st.level + ':' + k] || f.geometry }; }) };
  }
  function drawMap() {
    var fc = displayFc(); if (!fc) return;
    api.setData('birim', fc, { line: U.cssVar('--map-edge'), width: st.level === 'il' ? 0.9 : 0.5, fillOpacity: 0.55, fillExpr: ['case', ['==', ['get', 'sec'], 1], '#F2A900', 'rgba(255,255,255,0.01)'] });
    api.secimCiz('birim-sec', fc.features.filter(function (f) { return f.properties.sec === 1; })); // ortak seçim görünümü: kalın koyu sınır
    etiketCiz(); ilceIc();
  }
  // İl düzeyinde yakınlaşınca (z ≥ 7) ilçe sınırları da ince kesikli çizgiyle görünür; ilçe adlarıyla birlikte
  var ilceIcAcik = null;
  function ilceIc() {
    var ac = st.level === 'il' && !!st.ilceSade && api.map.getZoom() >= 7;
    if (ac === ilceIcAcik) return; ilceIcAcik = ac;
    api.setData('ilce-ic', ac ? { type: 'FeatureCollection', features: st.ilceSade.features.map(function (f) { return { type: 'Feature', properties: { osm: String(f.properties.osm_id) }, geometry: f.geometry }; }) } : { type: 'FeatureCollection', features: [] },
      { line: '#3F3F3F', width: 0.9, fillOpacity: 0, fillExpr: 'rgba(0,0,0,0)', dash: [3, 2] });
  }
  // Yer adları: il düzeyinde il adları; ilçe düzeyinde ilçe adları yakınlaşınca (z ≥ 7) görünür
  var etiketBellek = {}, etiketDuzey = null;
  function etiketCiz() {
    var fc = st.level === 'il' ? st.ilSade : st.ilceSade; if (!fc || etiketDuzey) return; etiketDuzey = 1;
    function liste(fc2, il, min, max) {
      return fc2.features.map(function (f) {
        var k = (il ? 'il' : 'ilce') + (il ? f.properties.il_kodu : f.properties.osm_id);
        if (!etiketBellek[k]) etiketBellek[k] = window.HARITA.etiketNoktasi(f.geometry);
        return etiketBellek[k] ? { ad: il ? f.properties.il_adi : f.properties.ilce_adi, c: etiketBellek[k], tip: il ? 'il' : 'ilce', min: min, max: max, a: f.properties.alan_km2 || 0 } : null;
      }).filter(Boolean).sort(function (p, q) { return q.a - p.a; });
    }
    // ilçe düzeyinde uzaktan il adları, yakınlaşınca (z ≥ 7) ilçe adları
    // uzaktan il adları; yakınlaşınca (z ≥ 7) iki düzeyde de ilçe adları
    api.etiketler(liste(st.ilSade || { features: [] }, true, 0, 7).concat(st.ilceSade ? liste(st.ilceSade, false, 7, 99) : []));
  }
  api.ready.then(function () {
    api.map.on('click', 'birim-fill', function (e) {
      // il düzeyinde ilçe sınırları görünürken tıklanan ilçe: "İlçe sınırları" sekmesine geçilir, ilçe seçilir ve ilçeye yaklaşılır
      if (st.level === 'il' && ilceIcAcik && api.map.getLayer('ilce-ic-fill')) {
        var hi = api.map.queryRenderedFeatures(e.point, { layers: ['ilce-ic-fill'] })[0];
        if (hi && hi.properties.osm) { var ko = hi.properties.osm; U.$('.subtabs[data-group="sn"] button[data-tab="ilce"]', root).click(); st.sel.ilce.add(ko); renderList(); yaklas(ko); return; }
      }
      var k = e.features && e.features[0] && e.features[0].properties.k; if (k == null) return; var s = selected(), yeni = !s.has(k); yeni ? s.add(k) : s.delete(k); renderList();
      // nüfus haritasındaki gibi: seçilen birime yaklaş (ilde ilçe adları görünür hale gelir)
      if (yeni) yaklas(k);
    });
    function yaklas(k) { var fc = displayFc(), f = fc && fc.features.filter(function (x) { return x.properties.k === k; })[0], b = f && api.bboxOf({ type: 'FeatureCollection', features: [f] }); if (b) api.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 700, maxZoom: st.level === 'il' ? 8.5 : 10.5 }); }
    // ortak bilgi kutusu: ad, bağlı il, alan ve seçim durumu
    api.ipucu(['birim-fill'], function (p) { return p.ad ? { ad: p.ad, alt: p.il ? p.il : 'İl', satirlar: [(p.alan != null ? 'Alan: ' + U.num(+p.alan, 1) + ' km²' : ''), +p.sec === 1 ? 'Seçili · tıklayınca seçimden çıkar' : 'Tıklayınca seçilir'].filter(Boolean) } : null; });
    api.map.on('mouseleave', 'birim-fill', function () { api.map.getCanvas().style.cursor = ''; });
    api.map.on('moveend', ayrintiYukle); api.map.on('zoomend', ilceIc);
  });

  // ---------- Koordinat sistemi ----------
  function fillCrs() {
    var sel = $('#sn-crs'), prev = sel.value; sel.innerHTML = '';
    sel.add(new Option('Otomatik: ITRF96 3° TM (seçime göre dilim)', 'auto-tm'));
    sel.add(new Option('Otomatik: WGS84 UTM (seçime göre dilim)', 'auto-utm'));
    sel.add(new Option('WGS84 coğrafi (enlem/boylam)', 'geo-turef'));
    K.TM_CMS.forEach(function (c) { sel.add(new Option('ITRF96 3° TM ' + c, 'tm-turef-' + c)); });
    K.UTM_ZONES.forEach(function (z) { sel.add(new Option('WGS84 UTM ' + z + 'K', 'utm-wgs84-' + z)); });
    sel.add(new Option('Otomatik: ED50 3° TM (bilgi amaçlı)', 'auto-ed50tm'));
    K.TM_CMS.forEach(function (c) { sel.add(new Option('ED50 3° TM ' + c, 'tm-ed50-' + c)); });
    K.UTM_ZONES.forEach(function (z) { sel.add(new Option('ED50 UTM ' + z + 'K', 'utm-ed50-' + z)); });
    sel.value = prev || 'auto-tm';
  }
  fillCrs();
  function selectedFeaturesSade() { var fc = st.level === 'il' ? st.ilSade : st.ilceSade, s = selected(); return fc ? fc.features.filter(function (f) { return s.has(keyOf(f)); }) : []; }
  function resolveCrs(z) {
    var v = $('#sn-crs').value;
    if (v === 'auto-tm') return 'tm-turef-' + z.tm; if (v === 'auto-utm') return 'utm-wgs84-' + z.utm; if (v === 'auto-ed50tm') return 'tm-ed50-' + z.tm;
    return v;
  }
  function suggestCrs() {
    var f = selectedFeaturesSade(), note = [], fmt = $('#sn-fmt').value;
    $('#sn-lblw').hidden = fmt !== 'dxf';
    $('#sn-crs').disabled = !!F.WGS_ONLY[fmt];
    if (F.WGS_ONLY[fmt]) note.push({ geojson: 'GeoJSON', kml: 'KML', kmz: 'KMZ', gpx: 'GPX' }[fmt] + ' standardı gereği WGS84 coğrafi koordinatla yazılır.');
    if (f.length) {
      var z = SN.zones(f), id = resolveCrs(z), S = K.SYSTEMS[id];
      if (!F.WGS_ONLY[fmt]) note.push('Çıktı sistemi: ' + (S.kind === 'geo' ? 'WGS84 coğrafi' : S.label) + (S.epsg ? ' (EPSG:' + S.epsg + ')' : '') + '.');
      if (S.proj === 'TM' && Math.max(S.cm - z.bbox[0], z.bbox[2] - S.cm) > 1.5 + 0.25) note.push('Seçim ' + S.cm + '° diliminin ±1,5° sınırını aşıyor; uzak kısımlarda ölçek bozulması artar.');
      if (S.proj === 'UTM' && Math.max(S.cm - z.bbox[0], z.bbox[2] - S.cm) > 3.5) note.push('Seçim UTM diliminin ±3° sınırını aşıyor.');
      if (S.datum === 'ED50') note.push('ED50 dönüşümü yaklaşık 2 m doğrulukta, bilgi amaçlıdır (EPSG:1784).');
    }
    if (fmt === 'csv') note.push('CSV geometri içermez: kodlar, adlar, alan ve ağırlık merkezi koordinatları.');
    $('#sn-note').textContent = note.join(' ');
  }
  ['#sn-crs', '#sn-fmt', '#sn-res'].forEach(function (id) { $(id).addEventListener('change', suggestCrs); });

  // ---------- Etkileşim ----------
  $('#sn-list').addEventListener('change', function (e) {
    var t = e.target, s;
    if (t.dataset.il) { s = st.sel.il; t.checked ? s.add(t.dataset.il) : s.delete(t.dataset.il); }
    else if (t.dataset.ilce) { s = st.sel.ilce; t.checked ? s.add(t.dataset.ilce) : s.delete(t.dataset.ilce); }
    else if (t.dataset.ilgrp) {
      var il = st.ozet.iller.filter(function (x) { return x.kod === t.dataset.ilgrp; })[0];
      il.ilceler.forEach(function (c) { var k = String(c.osm_id); t.checked ? st.sel.ilce.add(k) : st.sel.ilce.delete(k); });
    }
    renderList();
  });
  $('#sn-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-exp]'); if (!b) return;
    var k = b.dataset.exp; st.open.has(k) ? st.open.delete(k) : st.open.add(k); renderList();
  });
  var qt; $('#sn-q').addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { st.q = $('#sn-q').value; renderList(); }, 120); });
  $('#sn-all').addEventListener('click', function () {
    st.ozet.iller.forEach(function (il) {
      var m = SN.match(st.q, il); if (!m.il) return;
      if (st.level === 'il') st.sel.il.add(il.kod);
      else il.ilceler.forEach(function (c) { if (!m.ilceler || m.ilceler.indexOf(c.osm_id) >= 0) st.sel.ilce.add(String(c.osm_id)); });
    });
    renderList();
  });
  $('#sn-none').addEventListener('click', function () { selected().clear(); renderList(); });
  $('#sn-zoom').addEventListener('click', function () { var f = selectedFeaturesSade(); if (f.length) api.fit(SN.bboxAll(f), 12); else api.fit([25.6, 35.8, 44.9, 42.2]); });
  U.$('.subtabs[data-group="sn"]', root).addEventListener('tabchange', function (e) { st.level = e.detail; ilceIcAcik = null; renderList(); ayrintiYukle(); });

  // ---------- İndirme ----------
  function detailedFeatures() {
    var s = selected();
    if ($('#sn-res').value === 'sade') return Promise.resolve(selectedFeaturesSade());
    if (st.level === 'il') {
      return (st.ilAyr ? Promise.resolve(st.ilAyr) : getJson('il.topo.json').then(function (t) { st.ilAyr = SN.fromTopo(t); return st.ilAyr; }))
        .then(function (fc) { return fc.features.filter(function (f) { return s.has(f.properties.il_kodu); }); });
    }
    var kodlar = st.ozet.iller.filter(function (il) { return il.ilceler.some(function (c) { return s.has(String(c.osm_id)); }); }).map(function (il) { return il.kod; });
    return Promise.all(kodlar.map(function (k) {
      return st.ilceAyr[k] ? Promise.resolve(st.ilceAyr[k]) : getJson('ilce/' + k + '.topo.json').then(function (t) { st.ilceAyr[k] = SN.fromTopo(t); return st.ilceAyr[k]; });
    })).then(function (list) { var out = []; list.forEach(function (fc) { fc.features.forEach(function (f) { if (s.has(String(f.properties.osm_id))) out.push(f); }); }); return out; });
  }
  $('#sn-dl').addEventListener('click', function () {
    var btn = $('#sn-dl'), label = btn.textContent; btn.disabled = true; btn.textContent = 'Hazırlanıyor…'; err('');
    detailedFeatures().then(function (feats) {
      if (!feats.length) throw new Error('Seçili birimlerin geometrisi bulunamadı');
      var fmt = $('#sn-fmt').value, z = SN.zones(feats), crs = F.WGS_ONLY[fmt] ? 'geo-turef' : resolveCrs(z);
      var tarih = (st.ozet.veri_tarihi || '').replace(/-/g, ''), base = (st.level === 'il' ? 'il' : 'ilce') + '_sinirlari' + (feats.length === 1 ? '_' + U.slug(feats[0].properties.ilce_adi || feats[0].properties.il_adi) : '') + (tarih ? '_osm' + tarih : '');
      var fc = { type: 'FeatureCollection', features: feats.map(function (f) { return { type: 'Feature', properties: Object.assign({}, f.properties), geometry: f.geometry }; }) };
      var out;
      if (fmt === 'csv') out = { name: base + '.csv', data: SN.attributeCsv(fc.features, crs, st.level) };
      else out = F.write(fc, 'geo-turef', { format: fmt, crs: crs, textField: fmt === 'dxf' && $('#sn-lbl').checked ? (st.level === 'il' ? 'il_adi' : 'ilce_adi') : null, textHeight: st.level === 'il' ? 1500 : 300, layerField: st.level === 'ilce' && fmt === 'dxf' ? 'il_adi' : null, nameField: st.level === 'il' ? 'il_adi' : 'ilce_adi' }, base);
      if (fmt === 'shp') {
        // Shapefile paketine lisans ve kaynak notu ekle
        var files = F.unzip(out.data), enc = new TextEncoder();
        files['BENIOKU.txt'] = enc.encode('Türkiye ' + (st.level === 'il' ? 'il' : 'ilçe') + ' sınırları\r\nKaynak: © OpenStreetMap katkıcıları, ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/)\r\nOSM verisi: ' + (st.ozet.veri_tarihi || '') + '\r\nDerleme: topografya.com.tr · github.com/topografya/veri\r\nKoordinat sistemi: ' + (K.SYSTEMS[crs].label || crs) + '\r\nÇözünürlük: ' + ($('#sn-res').value === 'sade' ? '≈500 m' : '≈30 m') + '\r\nResmî sınır değildir; resmî işlerde HGM, TKGM ve ilgili idarelerin kayıtları esastır.\r\n');
        out.data = F.zip(files);
      }
      U.download(out.name, out.data);
    }).catch(function (e) { err(e.message); }).then(function () { btn.disabled = false; btn.textContent = label; });
  });

  // ---------- Yükleme ----------
  Promise.all([getJson('ozet.json'), getJson('il-sade.topo.json'), getJson('ilce-sade.topo.json')]).then(function (r) {
    st.ozet = r[0]; st.ilSade = SN.fromTopo(r[1]); st.ilceSade = SN.fromTopo(r[2]);
    var t = st.ozet.veri_tarihi ? st.ozet.veri_tarihi.split('-').reverse().join('.') : '';
    $('#sn-src').innerHTML = st.ozet.il_sayisi + ' il, ' + st.ozet.ilce_sayisi + ' ilçe · OpenStreetMap verisi ' + U.esc(t) + ' · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap katkıcıları</a>, ODbL';
    renderList(); api.fit([25.6, 35.8, 44.9, 42.2]);
  }).catch(function (e) { $('#sn-src').textContent = 'Veri yüklenemedi: ' + e.message + '. Sayfayı yenileyin.'; });
}};

(function(){var s=document.getElementById('t-sinirlar');U.subtabs(s);TOOLS['sinirlar'].init(s);})();