/* Service Worker — MathNova: يخزّن ملفات التطبيق والمكتبات (CDN) ليعمل دون إنترنت بعد أول تشغيل.
   غيّر رقم الإصدار V عند أي تحديث لتُحدَّث الذاكرة المخزّنة. */
const V = 'mathnova-v3';
const CORE = ['./', 'index.html', 'style.css', 'script.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'logo.png', 'qr.png'];
/* المكتبات الخارجية تُخزَّن مسبقاً (بدون إفشال التثبيت إن تعذّر أحدها) */
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.2/math.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/nerdamer/1.1.13/nerdamer.core.js',
  'https://cdnjs.cloudflare.com/ajax/libs/nerdamer/1.1.13/Algebra.js',
  'https://cdnjs.cloudflare.com/ajax/libs/nerdamer/1.1.13/Calculus.js',
  'https://cdnjs.cloudflare.com/ajax/libs/nerdamer/1.1.13/Solve.js',
  'https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.35.2/plotly.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
];

self.addEventListener('install', e => e.waitUntil(
  caches.open(V).then(async c => {
    await c.addAll(CORE);
    await Promise.allSettled(CDN.map(u => fetch(u).then(r => r.ok && c.put(u, r))));
  }).then(() => self.skipWaiting())
));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

/* الاستراتيجية: من الذاكرة أولاً مع تحديثها من الشبكة في الخلفية */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => hit || caches.match('index.html'));
    return hit || net;
  }));
});
