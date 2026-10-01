import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Hosts operated by the browser push services. The scheduler POSTs to a stored
 * endpoint from inside our network, so an endpoint is effectively a URL the
 * user asks our server to fetch. Blocking private IP ranges is not enough on
 * its own: a public hostname can resolve to 169.254.169.254 at send time. An
 * allow-list of the real services is the only check that DNS cannot defeat.
 */
const PUSH_SERVICE_HOST_SUFFIXES = [
  'fcm.googleapis.com', // Chrome, Edge (Chromium), Opera, Samsung
  'push.services.mozilla.com', // Firefox
  'notify.windows.com', // legacy Edge / Windows WNS
  'push.apple.com', // Safari
] as const;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  if (url.username !== '' || url.password !== '') return false;
  if (url.port !== '') return false;

  const host = url.hostname.toLowerCase();
  // Matching on a label boundary: `evilfcm.googleapis.com` must not pass.
  return PUSH_SERVICE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function IsPushServiceUrl(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPushServiceUrl',
      target: object.constructor,
      propertyName,
      ...(options !== undefined ? { options } : {}),
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && isAllowedPushEndpoint(value);
        },
        defaultMessage() {
          return '$property must be an https URL on a browser push service';
        },
      },
    });
  };
}
