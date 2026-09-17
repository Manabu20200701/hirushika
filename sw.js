const CACHE='hirushika-v0-63';
const ASSETS=[
  './','./index.html','./manifest.webmanifest',
  './assets/hirushika-hero.png','./assets/hirushika.png',
  './assets/hirushika-road.png','./assets/hirushika-road-empty.png',
  './assets/hirushika-detour.png','./assets/hirushika-chew.png',
  './assets/hirushika-good-lunch.png','./assets/hirushika-memory.png',
  './assets/hirushika-time.png','./assets/hirushika-achievement.png'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{let c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});
