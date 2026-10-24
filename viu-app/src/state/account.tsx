import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { tokenFrom, viewer, Viewer } from '../api/anilist';

const STORAGE_KEY = 'viu.account.v1';

interface Account {
  token: string;
  user: Viewer;
}

interface AccountContextValue {
  account: Account | null;
  // Bumped after every change to the AniList list, so screens that show it
  // know to load it again.
  revision: number;
  changed: () => void;
  signIn: (pasted: string) => Promise<Viewer>;
  signOut: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setAccount(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const signIn = useCallback(async (pasted: string) => {
    const token = tokenFrom(pasted);
    if (!token) throw new Error('Paste the token from AniList first.');
    const user = await viewer(token);
    const next = { token, user };
    setAccount(next);
    setRevision((r) => r + 1);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    return user;
  }, []);

  const signOut = useCallback(() => {
    setAccount(null);
    setRevision((r) => r + 1);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const changed = useCallback(() => setRevision((r) => r + 1), []);

  const value = useMemo(() => ({ account, revision, changed, signIn, signOut }), [account, revision, changed, signIn, signOut]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}
