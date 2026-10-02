const CACHE_NAME = "scce-attendance-v4";

const APP_SHELL = [
    "/",
    "/index.html",
    "/student.html",
    "/calculator.html",

    "/css/shared.css",
    "/css/student.css",

    "/js/firebase.js",
    "/js/student-dashboard.js",
    "/js/attendanceDB.js"
];


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener("install", (event) => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(async (cache) => {

                for (const url of APP_SHELL) {

                    try {

                        await cache.add(url);

                        console.log(
                            "[SW] Cached:",
                            url
                        );

                    } catch (error) {

                        console.warn(
                            "[SW] Could not cache:",
                            url,
                            error
                        );
                    }
                }
            })
            .then(() => {

                return self.skipWaiting();

            })
    );
});


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener("activate", (event) => {

    event.waitUntil(

        caches.keys()
            .then((cacheNames) => {

                return Promise.all(

                    cacheNames
                        .filter(
                            (name) =>
                                name !== CACHE_NAME
                        )
                        .map(
                            (name) =>
                                caches.delete(name)
                        )
                );

            })
            .then(() => {

                return self.clients.claim();

            })
    );
});


/* =========================================================
   FETCH
========================================================= */

self.addEventListener("fetch", (event) => {

    // Only handle GET requests
    if (event.request.method !== "GET") {
        return;
    }


    const requestURL =
        new URL(event.request.url);


    // Only handle requests from this website.
    // Firebase, Google APIs, and other external
    // services are not intercepted.
    if (
        requestURL.origin !==
        self.location.origin
    ) {
        return;
    }


    event.respondWith(

        caches.match(event.request)
            .then((cachedResponse) => {

                // Return cached response when available
                if (cachedResponse) {

                    console.log(
                        "[SW] Cache hit:",
                        event.request.url
                    );

                    return cachedResponse;
                }


                // Otherwise fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {

                        // Don't cache unsuccessful responses
                        if (
                            !networkResponse ||
                            networkResponse.status !== 200
                        ) {

                            return networkResponse;
                        }


                        const responseToCache =
                            networkResponse.clone();


                        caches.open(CACHE_NAME)
                            .then((cache) => {

                                cache.put(
                                    event.request,
                                    responseToCache
                                );

                            });


                        return networkResponse;

                    });

            })
    );
});