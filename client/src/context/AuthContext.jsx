import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    if (data.twofa_required) return data;              // 2FA bosqichi
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const verify2fa = useCallback(async (user_id, code) => {
    const data = await api.post('/auth/2fa/verify', { user_id, code });
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  const value = { user, setUser, loading, login, register, logout, verify2fa,
    can: (...roles) => roles.includes(user?.role) };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
