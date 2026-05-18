/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

// Do not auto-skipWaiting — controlled by SKIP_WAITING message from the SPA.
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

import './handlers/install-activate';
import './handlers/push';
import './handlers/notification-click';
import './handlers/subscription-change';
