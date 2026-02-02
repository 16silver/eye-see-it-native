import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  configureGoogleSignIn,
  signInWithGoogle,
  signOut as authSignOut,
  onAuthStateChanged,
} from '../services/auth';

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Google Sign-In 초기화
    configureGoogleSignIn();

    // 인증 상태 변경 리스너
    const unsubscribe = onAuthStateChanged((authUser) => {
      setUser(authUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignInWithGoogle = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await authSignOut();
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
