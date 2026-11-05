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


/* Koordinat Dönüştürücü arayüzü */
(window.TOOLS = window.TOOLS || {}).koordinat = { init: function (root) {
  'use strict';
  var K = window.TA.K, U = window.U, $ = function (s) { return U.$(s, root); };
  var SYS = K.SYSTEMS;

  // ---------- Tek nokta ----------
  function fillZones() {
    var v = $('#kd-sys').value, z = $('#kd-zone'), prev = z.value; z.innerHTML = '';
    if (v === 'tm-turef' || v === 'tm-ed50') K.TM_CMS.forEach(function (c) { z.add(new Option('Orta meridyen ' + c + '° (' + (c - 1.5) + '°–' + (c + 1.5) + '°)', c)); });
    if (v === 'utm-wgs84' || v === 'utm-ed50') K.UTM_ZONES.forEach(function (n) { z.add(new Option(n + '. dilim (OM ' + (n * 6 - 183) + '°)', n)); });
    if (prev && Array.prototype.some.call(z.options, function (o) { return o.value === prev; })) z.value = prev;
    else if (z.options.length) z.value = (v.indexOf('tm') === 0 ? '33' : '36');
  }
  function syncForm() {
    var v = $('#kd-sys').value, geo = v.indexOf('geo') === 0, code = v === 'mgrs' || v === 'plus';
    $('#kd-geo').hidden = !geo; $('#kd-proj').hidden = geo || code; $('#kd-codewrap').hidden = !code;
    $('#kd-code').placeholder = v === 'mgrs' ? '36S VK 89019 18690' : '8GHH2V2X+2X';
    $('#kd-hint').hidden = !geo;
    fillZones();
  }
  $('#kd-sys').addEventListener('change', syncForm);

  function readInput() {
    var v = $('#kd-sys').value;
    if (v === 'geo-turef' || v === 'geo-ed50') {
      var lat = K.parseAngle($('#kd-lat').value, 'lat'), lon = K.parseAngle($('#kd-lon').value, 'lon');
      if (!isFinite(lat)) throw new Error('Enlem okunamadı ya da ±90° dışında. Örnek: 39.92, 39°55′12″ ya da 39°55′12″ K (enlemde yön harfi K ya da G olur)');
      if (!isFinite(lon)) throw new Error('Boylam okunamadı ya da ±180° dışında. Örnek: 32.85, 32°51′00″ ya da 32°51′00″ D (boylamda yön harfi D ya da B olur)');
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('Enlem ±90°, boylam ±180° içinde olmalı');
      var g = v === 'geo-ed50' ? K.transform('geo-ed50', 'geo-turef', { lat: lat, lon: lon }) : { lat: lat, lon: lon };
      return { g: g, src: v };
    }
    if (v === 'mgrs') { try { return { g: K.fromMGRS($('#kd-code').value), src: v }; } catch (e) { throw new Error('MGRS kodu okunamadı. Örnek: 36S VK 89019 18690'); } }
    if (v === 'plus') return { g: K.fromPlus($('#kd-code').value), src: v };
    var y = K.parseNumber($('#kd-y').value), x = K.parseNumber($('#kd-x').value), z = +$('#kd-zone').value;
    if (!isFinite(y) || !isFinite(x)) throw new Error('Y ve X metre cinsinden sayı olmalı (ör. 487175,983)');
    if (y < 100000 || y > 900000) throw new Error('Sağa değer (Y) 100 000 – 900 000 m aralığında olmalı; Y ile X yer değiştirmiş olabilir');
    if (x < 3500000 || x > 5000000) throw new Error('Yukarı değer (X) Türkiye için yaklaşık 3 800 000 – 4 800 000 m aralığındadır');
    var id = v === 'tm-turef' ? 'tm-turef-' + z : v === 'tm-ed50' ? 'tm-ed50-' + z : v === 'utm-wgs84' ? 'utm-wgs84-' + z : 'utm-ed50-' + z;
    return { g: K.transform(id, 'geo-turef', { y: y, x: x }), src: v, zone: z, id: id };
  }

  function row(label, sub, val, copyText, hl) {
    return '<tr' + (hl ? ' class="hl"' : '') + '><td>' + label + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</td><td class="m">' + val + '</td><td>' + U.copyBtn(copyText) + '</td></tr>';
  }
  function yx(p) { return 'Y ' + U.num(p.y, 3) + '<br>X ' + U.num(p.x, 3); }
  function yxPlain(p) { return p.y.toFixed(3) + ' ' + p.x.toFixed(3); }

  function render(inp) {
    var g = inp.g, r = K.allFrom(g.lat, g.lon), src = inp.src;
    $('#kd-big').textContent = K.fmtDMS(g.lat, true, 2) + '  ' + K.fmtDMS(g.lon, false, 2);
    $('#kd-meta').textContent = 'TUREF coğrafi · ' + U.num(g.lat, 8) + '°, ' + U.num(g.lon, 8) + '°';
    var h = '';
    h += row('Coğrafi – TUREF', 'derece-dakika-saniye', K.fmtDMS(g.lat, true, 4) + '<br>' + K.fmtDMS(g.lon, false, 4), K.fmtDMS(g.lat, true, 4) + ' ' + K.fmtDMS(g.lon, false, 4), src === 'geo-turef');
    h += row('Coğrafi – TUREF', 'ondalık derece', U.num(g.lat, 9) + '<br>' + U.num(g.lon, 9), g.lat.toFixed(9) + ', ' + g.lon.toFixed(9));
    h += row('Coğrafi – TUREF', 'derece, ondalık dakika', K.fmtDM(g.lat, true) + '<br>' + K.fmtDM(g.lon, false), K.fmtDM(g.lat, true) + ' ' + K.fmtDM(g.lon, false));
    h += row('TUREF – 3° TM', 'orta meridyen ' + r.tmTuref.cm + '° · EPSG:' + SYS['tm-turef-' + r.tmTuref.cm].epsg, yx(r.tmTuref), yxPlain(r.tmTuref), src === 'tm-turef' && inp.zone === r.tmTuref.cm);
    h += row('WGS84 – UTM', r.utmWgs.zone + '. dilim · EPSG:' + SYS['utm-wgs84-' + r.utmWgs.zone].epsg, yx(r.utmWgs), yxPlain(r.utmWgs), src === 'utm-wgs84' && inp.zone === r.utmWgs.zone);
    h += row('Coğrafi – ED50', 'bilgi amaçlı, ±2 m', K.fmtDMS(r.ed50.lat, true, 4) + '<br>' + K.fmtDMS(r.ed50.lon, false, 4), K.fmtDMS(r.ed50.lat, true, 4) + ' ' + K.fmtDMS(r.ed50.lon, false, 4), src === 'geo-ed50');
    h += row('ED50 – 3° TM', 'orta meridyen ' + r.tmEd50.cm + '° · EPSG:' + SYS['tm-ed50-' + r.tmEd50.cm].epsg, yx(r.tmEd50), yxPlain(r.tmEd50), src === 'tm-ed50' && inp.zone === r.tmEd50.cm);
    h += row('ED50 – UTM', r.utmEd50.zone + '. dilim · EPSG:' + SYS['utm-ed50-' + r.utmEd50.zone].epsg, yx(r.utmEd50), yxPlain(r.utmEd50), src === 'utm-ed50' && inp.zone === r.utmEd50.zone);
    // girilen dilim doğal dilimden farklıysa onu da göster
    if (inp.id && ((src.indexOf('tm') === 0 && inp.zone !== r.tmTuref.cm) || (src.indexOf('utm') === 0 && inp.zone !== r.utmWgs.zone))) {
      var p = K.transform('geo-turef', inp.id, g);
      h += row(SYS[inp.id].label, 'girdiğiniz dilim', yx(p), yxPlain(p), true);
    }
    h += row('MGRS', '1 m çözünürlük', U.esc(r.mgrs.replace(/^(\d+[A-Z])([A-Z]{2})(\d{5})(\d{5})$/, '$1 $2 $3 $4')), r.mgrs, src === 'mgrs');
    h += row('Plus Code', 'Open Location Code', U.esc(r.plus), r.plus, src === 'plus');
    h += row('Meridyen yakınsaması γ', '3° TM / UTM', K.fmtDMS(r.convergence.tm, null, 1) + '<br>' + K.fmtDMS(r.convergence.utm, null, 1), r.convergence.tm.toFixed(6) + ' ' + r.convergence.utm.toFixed(6));
    h += row('Nokta ölçek faktörü k', '3° TM / UTM', U.num(r.scale.tm, 7) + '<br>' + U.num(r.scale.utm, 7), r.scale.tm.toFixed(7) + ' ' + r.scale.utm.toFixed(7));
    $('#kd-out').tBodies[0].innerHTML = h;
    var w = [];
    if (!K.inTurkey(g.lat, g.lon)) w.push('Nokta Türkiye dışında; ED50 dönüşüm parametreleri yalnız Türkiye için tanımlıdır.');
    if (inp.id && inp.id.indexOf('tm') === 0 && Math.abs(g.lon - inp.zone) > 1.5 + 1e-6) w.push('Nokta, seçtiğiniz ' + inp.zone + '° dilim sınırlarının (±1,5°) dışında. Yanlış dilim seçilmiş olabilir.');
    if (inp.id && inp.id.indexOf('utm') === 0 && Math.abs(g.lon - (inp.zone * 6 - 183)) > 3 + 1e-6) w.push('Nokta, seçtiğiniz UTM diliminin (±3°) dışında.');
    $('#kd-warn').hidden = !w.length; $('#kd-warn').textContent = w.join(' ');
  }

  var son = null, harita = null;
  function run() {
    var err = $('#kd-err');
    try { var inp = readInput(); render(inp); son = inp.g; err.hidden = true; noktaCiz(false); } catch (e) { err.textContent = e.message; err.hidden = false; }
  }
  // ---------- İsteğe bağlı harita (MapLibre ilk açılışta yüklenir) ----------
  function noktaCiz(ortala) {
    if (!harita || !son) return;
    harita.setData('kd-nokta', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [son.lon, son.lat] } }] }, { radius: 7, color: '#F2A900' });
    if (ortala) harita.ready.then(function () { harita.map.jumpTo({ center: [son.lon, son.lat], zoom: Math.max(harita.map.getZoom(), 13) }); });
  }
  $('#kd-mapbtn').addEventListener('click', function () {
    var w = $('#kd-mapw'), b = this, ac = w.hidden;
    w.hidden = !ac; $('#kd-maphint').hidden = !ac; b.setAttribute('aria-expanded', String(ac)); b.textContent = ac ? 'Haritayı gizle' : 'Haritada göster ve haritadan seç';
    if (!ac || harita) { if (harita) { harita.map.resize(); noktaCiz(true); } return; }
    b.disabled = true;
    window.HARITA.yukle().then(function () {
      harita = window.HARITA.create($('#kd-map'), { center: son ? [son.lon, son.lat] : [35.2, 39.1], zoom: son ? 13 : 5, turkiye: !son });
      harita.ready.then(function () {
        harita.map.getCanvas().style.cursor = 'crosshair';
        harita.map.on('click', function (e) {
          $('#kd-sys').value = 'geo-turef'; syncForm();
          $('#kd-lat').value = e.lngLat.lat.toFixed(8).replace('.', ','); $('#kd-lon').value = e.lngLat.lng.toFixed(8).replace('.', ','); run();
        });
      });
      noktaCiz(true);
    }).catch(function (e) { $('#kd-err').textContent = 'Harita yüklenemedi: ' + e.message; $('#kd-err').hidden = false; w.hidden = true; })
      .then(function () { b.disabled = false; });
  });
  $('#kd-form').addEventListener('submit', function (ev) { ev.preventDefault(); run(); });
  $('#kd-ornek').addEventListener('click', function () {
    $('#kd-sys').value = 'geo-turef'; syncForm(); $('#kd-lat').value = '39°55′12″ K'; $('#kd-lon').value = '32°51′00″ D'; run();
  });

  // ---------- Toplu dönüşüm ----------
  var BATCH = [];
  BATCH.push(['geo-turef', 'Coğrafi – TUREF (enlem, boylam)'], ['geo-ed50', 'Coğrafi – ED50 (enlem, boylam)']);
  K.TM_CMS.forEach(function (c) { BATCH.push(['tm-turef-' + c, 'TUREF – 3° TM, OM ' + c + '°']); });
  K.UTM_ZONES.forEach(function (z) { BATCH.push(['utm-wgs84-' + z, 'WGS84 – UTM ' + z]); });
  K.TM_CMS.forEach(function (c) { BATCH.push(['tm-ed50-' + c, 'ED50 – 3° TM, OM ' + c + '°']); });
  K.UTM_ZONES.forEach(function (z) { BATCH.push(['utm-ed50-' + z, 'ED50 – UTM ' + z]); });
  BATCH.forEach(function (b) { $('#kb-from').add(new Option(b[1], b[0])); $('#kb-to').add(new Option(b[1], b[0])); });
  $('#kb-from').value = 'tm-ed50-33'; $('#kb-to').value = 'tm-turef-33';
  $('#kb-in').value = 'Nokta;Y;X\nP1;487204,374;4420841,324\nP2;487512,100;4421003,550\nP3;488010,820;4420688,040\nP4;487655,000;4420402,770';

  function splitLine(t) {
    if (t.indexOf('\t') >= 0) return t.split('\t');
    if (t.indexOf(';') >= 0) return t.split(';');
    if (/\s/.test(t.trim())) return t.trim().split(/\s+/);
    return t.split(',');
  }
  var result = null, ncn = null;
  function batch() {
    var err = $('#kb-err'); err.hidden = true;
    // Önceki sonuç her yeni denemede temizlenir: hatalı yeni girdide eski sonuç tabloda kalmaz ve indirilemez
    result = null; ncn = null; $('#kb-warn').hidden = true; $('#kb-copy').disabled = true; $('#kb-dl').disabled = true; $('#kb-ncn').disabled = true;
    $('#kb-out').tHead.innerHTML = ''; $('#kb-out').tBodies[0].innerHTML = ''; $('#kb-count').textContent = ''; $('#kb-meta').textContent = '';
    var from = $('#kb-from').value, to = $('#kb-to').value, fs = SYS[from], ts = SYS[to];
    var lines = $('#kb-in').value.split(/\r?\n/), rows = [], skipped = [];
    var takas = $('#kb-swap').checked, tersSay = 0;
    // Satır çözümü: [ad] a b [z]. Dört sayıda ad a b z. Üç sayıda iki okuma vardır: (ad, a, b) ya da (a, b, kot);
    // hangisinin Türkiye için anlamlı koordinat verdiğine değer aralığıyla bakılır (Claude denetimi D3-02/03).
    var belirsiz = 0;
    function makul(a, b) {
      if (fs.kind === 'geo') return (K.inTurkey(a, b) || K.inTurkey(b, a));
      var yOk = function (v) { return v >= 100000 && v <= 900000; }, xOk = function (v) { return v >= 3500000 && v <= 5000000; };
      return (yOk(a) && xOk(b)) || (xOk(a) && yOk(b));
    }
    function coz(parts, vals) {
      var num = vals.map(function (v) { return isFinite(v); }), n = num.filter(Boolean).length, ad = null, a, b, z = null, k;
      var adVar = !num[0];
      if (adVar) { ad = parts[0]; k = 1; while (k < vals.length && !num[k]) k++; vals = vals.slice(k); }
      vals = vals.filter(function (v) { return isFinite(v); });
      if (vals.length < 2) return null;
      if (!adVar && vals.length >= 4) { ad = parts[0]; vals = vals.slice(1); }
      else if (!adVar && vals.length === 3) {
        var adli = makul(vals[1], vals[2]), kotlu = makul(vals[0], vals[1]), ucKot;
        // coğrafide önce doğru sıra (enlem, boylam) aranır; ters sıra yalnız ikisi de tutmazsa dikkate alınır
        if (fs.kind === 'geo' && (K.inTurkey(vals[1], vals[2]) || K.inTurkey(vals[0], vals[1]))) { adli = K.inTurkey(vals[1], vals[2]); kotlu = K.inTurkey(vals[0], vals[1]); }
        if (adli !== kotlu) ucKot = kotlu;
        else {
          // ikisi de (ya da hiçbiri) anlamlı: eski kural + belirsizlik uyarısı
          if (fs.kind === 'geo') ucKot = Math.abs(vals[2]) > 180 || /[.,]\d/.test(parts[0]);
          else ucKot = Math.abs(vals[0]) >= 100000 && Math.abs(vals[1]) >= 100000;
          belirsiz++;
        }
        if (!ucKot) { ad = parts[0]; vals = vals.slice(1); }
      }
      a = vals[0]; b = vals[1]; if (vals.length > 2) z = vals[2];
      return { ad: ad, a: a, b: b, z: z, n: n };
    }
    // Seçilen dilimin orta meridyeni (TM ±1,5°, UTM ±3°)
    function dilim(id) {
      var m = /^(tm|utm)-[a-z0-9]+-(\d+)$/.exec(id); if (!m) return null;
      return m[1] === 'tm' ? { om: +m[2], yari: 1.5 } : { om: +m[2] * 6 - 183, yari: 3 };
    }
    var dFrom = dilim(from), dTo = dilim(to), disi = [], dilimDisi = [], takasOneri = 0;
    lines.forEach(function (ln, i) {
      var t = ln.trim(); if (!t) return;
      var parts = splitLine(t).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
      var parse = fs.kind === 'geo' ? K.parseAngle : K.parseNumber;
      var c = coz(parts, parts.map(parse));
      if (!c) { if (rows.length || i > 0) skipped.push(i + 1); return; }
      if (takas) { var tmp = c.a; c.a = c.b; c.b = tmp; }
      var name = c.ad != null ? c.ad : String(rows.length + 1);
      // Türkiye'de projeksiyon koordinatında Y (sağa) 6 haneli, X (yukarı) 7 hanelidir; tersse uyar
      if (fs.kind !== 'geo' && Math.abs(c.a) >= 1000000 && Math.abs(c.b) < 1000000) tersSay++;
      if (fs.kind === 'geo' && Math.abs(c.a) > 90) tersSay++;
      var inP = fs.kind === 'geo' ? { lat: c.a, lon: c.b } : { y: c.a, x: c.b };
      try {
        var o = K.transform(from, to, inP); rows.push({ name: name, a: c.a, b: c.b, z: c.z, o: o, line: i + 1 });
        var g = fs.kind === 'geo' && from === 'geo-turef' ? inP : K.transform(from, 'geo-turef', inP);
        if (!K.inTurkey(g.lat, g.lon)) {
          disi.push(name);
          if (fs.kind === 'geo' && K.inTurkey(c.b, c.a)) takasOneri++;
        } else [dFrom, dTo].forEach(function (d) { if (d && Math.abs(g.lon - d.om) > d.yari + 0.5 && dilimDisi.indexOf(name) < 0) dilimDisi.push(name); });
      } catch (e) { skipped.push(i + 1); }
    });
    var uyar = $('#kb-warn'), uy = [], ilk = function (l) { return l.slice(0, 6).join(', ') + (l.length > 6 ? ' …' : ''); };
    if (tersSay) uy.push(tersSay + ' satırda koordinatlar ters sırada görünüyor (' + (fs.kind === 'geo' ? 'enlem 90°\'den büyük' : 'Y 7 haneli, X 6 haneli') + '). Sütun sırasını denetleyin; gerekirse "Y ile X yer değiştir" seçeneğini işaretleyin.');
    if (disi.length) uy.push(disi.length + ' nokta Türkiye dışına düşüyor (' + ilk(disi) + ').' + (takasOneri ? ' Enlem ile boylam yer değiştirmiş olabilir: "Y ile X yer değiştir" seçeneğini deneyin.' : ' Kaynak sistem, dilim ya da sütun sırası yanlış olabilir.'));
    if (dilimDisi.length) uy.push(dilimDisi.length + ' nokta seçilen dilimin dışında (' + ilk(dilimDisi) + '); sonuç büyük ölçek bozulması taşır. Dilim seçimini denetleyin.');
    if (belirsiz) uy.push(belirsiz + ' satırda üç sayı var ve ilk sütunun nokta adı mı koordinat mı olduğu değerlerden kestirilemedi; ad sütununu harfle başlatmak (ör. P100001) belirsizliği giderir.');
    uyar.hidden = !uy.length; uyar.textContent = uy.join(' ');
    if (!rows.length) { err.textContent = 'Okunabilen nokta bulunamadı. Her satırda bir ad ve iki koordinat olmalı.'; err.hidden = false; return; }
    var geoOut = ts.kind === 'geo';
    var zVar = rows.some(function (r) { return r.z != null; });
    var head = '<tr><th>Ad</th><th class="num">' + (fs.kind === 'geo' ? 'Enlem' : 'Y') + ' (girdi)</th><th class="num">' + (fs.kind === 'geo' ? 'Boylam' : 'X') + ' (girdi)</th><th class="num">' + (geoOut ? 'Enlem' : 'Y') + '</th><th class="num">' + (geoOut ? 'Boylam' : 'X') + '</th>' + (zVar ? '<th class="num">Z</th>' : '') + '</tr>';
    var dIn = fs.kind === 'geo' ? 9 : 3, dOut = geoOut ? 9 : 3;
    var body = rows.slice(0, 500).map(function (r) {
      var o1 = geoOut ? r.o.lat : r.o.y, o2 = geoOut ? r.o.lon : r.o.x;
      return '<tr><td>' + U.esc(r.name) + '</td><td class="num">' + U.num(r.a, dIn) + '</td><td class="num">' + U.num(r.b, dIn) + '</td><td class="num">' + U.num(o1, dOut) + '</td><td class="num">' + U.num(o2, dOut) + '</td>' + (zVar ? '<td class="num">' + (r.z != null ? U.num(r.z, 3) : '') + '</td>' : '') + '</tr>';
    }).join('');
    $('#kb-out').tHead.innerHTML = head; $('#kb-out').tBodies[0].innerHTML = body;
    $('#kb-count').textContent = rows.length + ' nokta dönüştürüldü';
    $('#kb-meta').textContent = fs.label + ' → ' + ts.label + (skipped.length ? ' · atlanan satır: ' + skipped.slice(0, 12).join(', ') + (skipped.length > 12 ? '…' : '') : '') + (rows.length > 500 ? ' · tabloda ilk 500 satır gösteriliyor' : '');
    var c1 = geoOut ? 'enlem' : 'Y', c2 = geoOut ? 'boylam' : 'X';
    result = 'ad;' + c1 + ';' + c2 + (zVar ? ';Z' : '') + '\n' + rows.map(function (r) {
      return r.name.replace(/;/g, ',') + ';' + (geoOut ? r.o.lat.toFixed(9) : r.o.y.toFixed(3)) + ';' + (geoOut ? r.o.lon.toFixed(9) : r.o.x.toFixed(3)) + (zVar ? ';' + (r.z != null ? r.z.toFixed(3) : '') : '');
    }).join('\n');
    // NCN (Netcad nokta dosyası): ad Y X Z, yalnız projeksiyon hedefinde
    ncn = geoOut ? null : rows.map(function (r) { return r.name.replace(/\s+/g, '_') + ' ' + r.o.y.toFixed(3) + ' ' + r.o.x.toFixed(3) + ' ' + (r.z != null ? r.z.toFixed(3) : '0.000'); }).join('\r\n') + '\r\n';
    $('#kb-copy').disabled = false; $('#kb-dl').disabled = false; $('#kb-ncn').disabled = !ncn;
  }
  $('#kb-run').addEventListener('click', batch);
  $('#kb-swap').addEventListener('change', batch);
  $('#kb-ncn').addEventListener('click', function () { if (ncn) U.download('donusum_' + $('#kb-to').value + '.ncn', ncn, 'text/plain'); });
  $('#kb-copy').addEventListener('click', function () { if (result) U.copy(result); });
  $('#kb-dl').addEventListener('click', function () { if (result) U.download('donusum_' + $('#kb-to').value + '.csv', '﻿' + result, 'text/csv;charset=utf-8'); });
  $('#kb-file').addEventListener('change', function (ev) {
    var f = ev.target.files[0]; if (!f) return; var err = $('#kb-err');
    if (/\.xlsx?$/i.test(f.name)) {
      f.arrayBuffer().then(function (buf) {
        $('#kb-in').value = window.TA.XO.csv(window.TA.XO.oku(buf)); batch();
      }).catch(function (e) { err.textContent = 'Excel dosyası okunamadı: ' + e.message; err.hidden = false; });
    } else {
      var rd = new FileReader();
      rd.onload = function () { $('#kb-in').value = String(rd.result); batch(); };
      rd.readAsText(f, 'utf-8');
    }
    ev.target.value = '';
  });

  syncForm();
  $('#kd-ornek').click();
}};

(function(){var s=document.getElementById('t-koordinat');U.subtabs(s);TOOLS['koordinat'].init(s);})();