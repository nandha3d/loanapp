'use client';

import { useEffect, useRef } from 'react';

export type WebPushConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

declare global {
  interface Window {
    // firebase compat global, loaded from the gstatic CDN.
    firebase?: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Registers the browser for FCM web push: installs the service worker, asks for
 * notification permission, mints an FCM token and registers it as a DeviceToken
 * (platform 'web'). The shared push dispatcher then reaches this browser too.
 *
 * No-ops silently when the Firebase web config / VAPID key is absent, when the
 * browser lacks push support, or when the user denies permission.
 */
export default function WebPushManager({ config }: { config: WebPushConfig }) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!config.apiKey || !config.vapidKey) return; // not configured yet
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return;
    // Don't re-prompt users who already declined.
    if (Notification.permission === 'denied') return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const permission =
          Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;
        if (permission !== 'granted') return;

        await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
        const fb = window.firebase;
        if (!fb) return;
        if (!fb.apps?.length) {
          fb.initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          });
        }
        const messaging = fb.messaging();
        const token = await messaging.getToken({
          vapidKey: config.vapidKey,
          serviceWorkerRegistration: reg,
        });
        if (!token) return;

        await fetch('/api/notifications/register-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch {
        // Push setup is best-effort; ignore failures (other channels still work).
      }
    })();
  }, [config]);

  return null;
}
