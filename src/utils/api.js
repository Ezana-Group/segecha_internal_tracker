import { adminAuth } from "./adminAuth";
import { PAYMENT_API } from "./env";

// CRIT-02 / CRIT-09: Admin key is no longer sent from the frontend.
// All privileged requests are authenticated exclusively via the JWT Bearer token
// obtained from /api/admin/login. The static ADMIN_KEY must never be exposed
// in the browser bundle or sent as a query parameter.
export async function fetchWithAuth(url, options = {}) {
  const token = adminAuth.getToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle URL (automatically prepend PAYMENT_API if relative)
  let finalUrl = url;
  if (!url.startsWith('http')) {
    finalUrl = `${PAYMENT_API}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  const res = await fetch(finalUrl, {
    ...options,
    headers,
  });

  // Auto-clear stale session on 401 so the login screen re-appears
  if (res.status === 401) {
    adminAuth.clearSession();
    // Dispatch a named event so the Login page can show "Session expired" message
    // instead of an unexplained silent reload.
    window.dispatchEvent(new CustomEvent('segecha:session-expired'));
    window.location.reload();
  }

  return res;
}
