const CACHE_NAME = 'jarvis-ai-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './index.jsx',
  './App.jsx',
  './components/JarvisOrb.jsx',
  './components/ChatLog.jsx',
  './components/MicButton.jsx',
  './hooks/useJarvis.js',
  './types.js',
  './services/geminiService.js',
  './metadata.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/@google/genai@^1.13.0',
  'https://esm.sh/react-dom@^19.1.1/client',
  'https://esm.sh/react-dom@^19.1.1/',
  'https://esm.sh/react@^19.1.1/',
  'https://esm.sh/react@^19.1.1',
  'https://esm.sh/lucide-react@^0.539.0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        const cachePromises = urlsToCache.map(urlToCache => {
          return fetch(urlToCache, { cache: 'no-store' }).then(response => {
            if (response.ok) {
              return cache.put(urlToCache, response);
            }
            console.error(`Failed to fetch and cache ${urlToCache}:`, response.status, response.statusText);
            return Promise.resolve();
          });
        });
        return Promise.all(cachePromises);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // We only handle GET requests for caching.
  // API calls are typically POST and should always go to the network.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Cache hit - return response
          return response;
        }
        // Not in cache, go to network.
        // We don't cache API calls to Gemini or other dynamic resources.
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});