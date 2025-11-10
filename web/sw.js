// Service Worker for Thermal Print Preview PWA
// Handles offline caching and share target functionality

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `thermal-print-static-${CACHE_VERSION}`;
const PYODIDE_CACHE = `thermal-print-pyodide-${CACHE_VERSION}`;

// Static resources to cache on install
const STATIC_RESOURCES = [
  '/editor.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Pyodide resources to cache (these are large, so we cache on first use)
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';

/**
 * Install event - cache static resources
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static resources');
      // Cache what's available, don't fail if icons don't exist yet
      return Promise.allSettled(
        STATIC_RESOURCES.map(url =>
          cache.add(url).catch(err => console.log('[SW] Failed to cache:', url, err))
        )
      );
    }).then(() => {
      console.log('[SW] Static resources cached');
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('thermal-print-') &&
              cacheName !== STATIC_CACHE &&
              cacheName !== PYODIDE_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - serve from cache or network
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle share target POST requests
  if (event.request.method === 'POST' && url.pathname.includes('editor.html')) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Handle Pyodide CDN requests - cache on first use
  if (url.origin.includes('cdn.jsdelivr.net') && url.pathname.includes('pyodide')) {
    event.respondWith(
      caches.open(PYODIDE_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            console.log('[SW] Serving Pyodide from cache:', url.pathname);
            return response;
          }

          console.log('[SW] Fetching Pyodide from network:', url.pathname);
          return fetch(event.request).then((response) => {
            // Cache successful responses
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Handle static resources - cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        console.log('[SW] Serving from cache:', url.pathname);
        return response;
      }

      console.log('[SW] Fetching from network:', url.pathname);
      return fetch(event.request).then((response) => {
        // Cache successful responses for static resources
        if (response && response.status === 200 && STATIC_RESOURCES.includes(url.pathname)) {
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, response.clone());
          });
        }
        return response;
      });
    }).catch((error) => {
      console.error('[SW] Fetch failed:', error);
      // Could return a custom offline page here
      throw error;
    })
  );
});

/**
 * Handle share target POST requests
 * Extracts shared data and redirects to editor with data in URL parameters
 */
async function handleShareTarget(request) {
  console.log('[SW] Handling share target request');

  try {
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const url = formData.get('url') || '';
    const imageFile = formData.get('image');

    console.log('[SW] Share data:', { title, text, url, hasImage: !!imageFile });

    // Build redirect URL with shared data
    const redirectUrl = new URL('/editor.html', self.location.origin);

    if (imageFile) {
      // For images, we need to pass the image data to the editor
      // We'll use IndexedDB to store it temporarily
      const imageData = await imageFile.arrayBuffer();
      const imageId = `share-${Date.now()}`;

      await storeSharedImage(imageId, imageData, imageFile.type);
      redirectUrl.searchParams.set('imageId', imageId);
      redirectUrl.searchParams.set('imageType', imageFile.type);

    } else {
      // For text, encode it in the URL
      const sharedContent = [title, text, url].filter(Boolean).join('\n\n');
      if (sharedContent) {
        redirectUrl.searchParams.set('shared', 'text');
        redirectUrl.searchParams.set('content', sharedContent);
      }
    }

    console.log('[SW] Redirecting to:', redirectUrl.toString());

    // Redirect to editor with shared data
    return Response.redirect(redirectUrl, 303);

  } catch (error) {
    console.error('[SW] Error handling share target:', error);
    // Redirect to editor without data on error
    return Response.redirect('/editor.html', 303);
  }
}

/**
 * Store shared image in IndexedDB for retrieval by the editor
 */
async function storeSharedImage(imageId, imageData, imageType) {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('SharedImages', 1);

    dbRequest.onerror = () => reject(dbRequest.error);

    dbRequest.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
    };

    dbRequest.onsuccess = () => {
      const db = dbRequest.result;
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');

      const imageRecord = {
        id: imageId,
        data: imageData,
        type: imageType,
        timestamp: Date.now()
      };

      const putRequest = store.put(imageRecord);

      putRequest.onsuccess = () => {
        console.log('[SW] Stored shared image:', imageId);
        resolve();
      };

      putRequest.onerror = () => reject(putRequest.error);

      // Clean up old images (older than 1 hour)
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (Date.now() - cursor.value.timestamp > 3600000) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    };
  });
}

console.log('[SW] Service worker loaded');
