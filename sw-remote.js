const CACHE="nrp-escenarios-remoto-v2-1-audio";
const ASSETS=[
  "./remote.html",
  "./remote-audio.html",
  "./remote.css",
  "./remote-audio.css",
  "./remote-app.js",
  "./remote-audio.js",
  "./manifest-remote.webmanifest",
  "./icon-remote.svg",
  "./index.html"
];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).catch(()=>caches.match("./remote-audio.html").then(found=>found||caches.match("./remote.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  })));
});