/**
 * Serves the Firebase Cloud Messaging service worker at the site root
 * (/firebase-messaging-sw.js) with the public web config injected from env.
 * A static public/ file can't read env, so we render it from a route instead.
 * Uses the gstatic compat SDK via importScripts — no npm dependency.
 *
 * Required env (public Firebase web config + Web Push VAPID key):
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  };

  const body = `
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || 'LoanTrack', {
    body: n.body || '',
    icon: '/og.png',
    badge: '/og.png',
    data: { link: data.link || '/' },
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const c of list) {
        if ('focus' in c) { c.navigate(link); return c.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
`.trim();

  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  });
}
