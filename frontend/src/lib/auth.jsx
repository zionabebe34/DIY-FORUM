// Logged-in user context. The session itself lives in an HttpOnly cookie set by
// the API; here we only keep the user object we got back from /api/auth/me.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, toPerson } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // design-shaped person (toPerson)
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.me().then(u => setUser(toPerson(u))).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  // → { user } when logged in, or { challenge } when the account needs an authenticator code next
  const login = useCallback(async (loginId, password) => {
    const d = await api.login(loginId, password);
    if (d.two_factor_required) return { challenge: d.challenge };
    const u = toPerson(d.user);
    setUser(u);
    return { user: u };
  }, []);

  // Step 2 of a 2FA login: an authenticator code or a backup code
  const loginWithCode = useCallback(async (challenge, code) => {
    const d = await api.loginWithCode(challenge, code);
    const u = toPerson(d.user);
    setUser(u);
    return { user: u, recoveryCodesLeft: d.recovery_codes_left };
  }, []);

  const signup = useCallback(async (fields) => {
    const u = toPerson(await api.signup(fields));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { setUser(null); }
  }, []);

  const updateUser = useCallback((rawUser) => setUser(toPerson(rawUser)), []);

  const value = useMemo(() => ({ user, ready, login, loginWithCode, signup, logout, updateUser }),
    [user, ready, login, loginWithCode, signup, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Ask the app to open the login dialog (used by deeply nested buttons like ♥ / comment). */
export const NEED_LOGIN_EVENT = 'hh:need-login';
export function requestLogin() {
  window.dispatchEvent(new Event(NEED_LOGIN_EVENT));
}
