import { adminAuth } from "./adminAuth";
import { PAYMENT_API, ADMIN_KEY } from "./env";

export async function fetchWithAuth(url, options = {}) {
  const token = adminAuth.getToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Also include x-admin-key for legacy endpoints
  if (ADMIN_KEY) {
    headers['x-admin-key'] = ADMIN_KEY;
  }

  // Handle URL (automatically prepend PAYMENT_API if relative)
  let finalUrl = url;
  if (!url.startsWith('http')) {
    finalUrl = `${PAYMENT_API}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // For GET requests, ensure adminKey is in query if needed
  if ((!options.method || options.method.toUpperCase() === 'GET') && ADMIN_KEY) {
    const urlObj = new URL(finalUrl, window.location.origin);
    if (!urlObj.searchParams.has('adminKey')) {
      urlObj.searchParams.set('adminKey', ADMIN_KEY);
    }
    finalUrl = urlObj.toString();
  }

  return fetch(finalUrl, {
    ...options,
    headers,
  });
}
