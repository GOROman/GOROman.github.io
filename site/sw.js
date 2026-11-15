/* goroman.org service worker — conservative caching only.
   - Navigations / HTML: network-first (deploys are visible immediately;
     the cache copy is only an offline fallback).
   - /assets/: stale-while-revalidate (instant repeat views; a replaced
     image is at most one view stale because every hit revalidates).
   - Everything else (cross-origin incl. the narupo API, non-GET): untouched. */
var CORE = "goroman-core-v1";
var ASSETS = "goroman-assets-v1";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CORE && k !== ASSETS; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  var isDoc = req.mode === "navigate" || url.pathname === "/" || /\.html?$/i.test(url.pathname);
  if (isDoc) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CORE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req, { ignoreSearch: true }); })
    );
    return;
  }
  if (url.pathname.indexOf("/assets/") >= 0) {
    e.respondWith(
      caches.open(ASSETS).then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) {
            if (res && res.status === 200) c.put(req, res.clone());
            return res;
          }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
  }
});
