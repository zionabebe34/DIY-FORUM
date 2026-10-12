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

  const login = useCallback(async (loginId, password) => {
    const u = toPerson(await api.login(loginId, password));
    setUser(u);
    return u;
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

  const value = useMemo(() => ({ user, ready, login, signup, logout, updateUser }),
    [user, ready, login, signup, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
