// Push registration — WEB (Metro picks push.native.ts on device). Web push is
// deferred (needs a service worker + VAPID key), so this is a no-op for now.
export async function registerForPush(_getToken: () => Promise<string | null>): Promise<void> {
  // no-op on web
}
