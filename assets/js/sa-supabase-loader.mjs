/**
 * Charge `createClient` depuis le bundle ESM local, puis des CDN en secours.
 * Une seule instance de la fonction est mise en cache pour tout le site.
 * Rebuild du vendor : tools/build-supabase-vendor.ps1
 */
let __saCachedCreateClient = null;

export async function loadSupabaseCreateClient() {
  if (__saCachedCreateClient) return __saCachedCreateClient;

  const localVendor =
    typeof window !== 'undefined' && window.location && window.location.origin
      ? new URL('/assets/js/vendor/supabase-js-2.49.4.mjs', window.location.origin).href
      : '/assets/js/vendor/supabase-js-2.49.4.mjs';

  const urls = [
    localVendor,
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm',
    'https://esm.sh/@supabase/supabase-js@2.49.4',
    'https://unpkg.com/@supabase/supabase-js@2.49.4/+esm',
  ];

  let lastErr = null;
  for (let i = 0; i < urls.length; i++) {
    try {
      const mod = await import(urls[i]);
      if (mod && typeof mod.createClient === 'function') {
        __saCachedCreateClient = mod.createClient;
        return __saCachedCreateClient;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  const msg = lastErr && lastErr.message ? String(lastErr.message) : 'import';
  throw new Error('Tous les miroirs Supabase ont échoué (' + msg + ').');
}
