
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, loginWithGoogle, logout, syncUserMetadata } from '../services/firebaseService';

interface SessionContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
      setIsAuthenticating(false);
      
      if (u) {
        // Sync minimal session metadata
        syncUserMetadata({
          deviceInfo: navigator.userAgent.substring(0, 100),
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error("Session Login Error:", error);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Session Signout Error:", error);
    }
  };

  return (
    <SessionContext.Provider value={{ 
      user, 
      loading, 
      login, 
      signOut, 
      isAuthenticated: !!user 
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
