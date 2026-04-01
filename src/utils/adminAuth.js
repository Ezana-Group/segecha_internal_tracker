const TOKEN_KEY = 'segecha_admin_token';
const USER_KEY = 'segecha_admin_user';

export const adminAuth = {
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // Signal useAppState to immediately fetch real data from the server
    window.dispatchEvent(new CustomEvent('segecha:login'));
  },
  
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  
  getToken: () => localStorage.getItem(TOKEN_KEY),
  
  getUser: () => {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  },
  
  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY)
};
