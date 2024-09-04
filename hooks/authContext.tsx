// contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect } from "react";
import { db } from "../lib/instantdb";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAuthorized: boolean;
  user: any | null;
  error: any | null;
}

interface UserData {
  id: string;
  email: string;
  isAdmin: boolean;
  isAuth: boolean;
}

interface AuthContextType extends AuthState {
  setAuthState: React.Dispatch<React.SetStateAction<AuthState>>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
    isAuthorized: false,
    user: null,
    error: null,
  });

  // Helper function to check for boolean false and string 'false'
  function isTruthy(value: any): boolean {
    return value !== false && value !== "false" && Boolean(value);
  }

  const {
    isLoading: authLoading,
    user: authUser,
    error: authError,
  } = db.useAuth();
  const { data: userData, isLoading: userDataLoading } = db.useQuery({
    users: {
      $: {
        where: {
          email: authUser?.email,
        },
        limit: 1,
      },
    },
  });

  // console.log(`current user email is ${authUser?.email}`);
  // console.log(`current user data is`, userData?.users[0]);
  const currentUser = userData?.users?.[0];

  useEffect(() => {
    const updateAuthState = async () => {
      if (authLoading || userDataLoading) {
        setAuthState((prev) => ({ ...prev, isLoading: true }));
        return;
      }

      if (authError) {
        console.error("Auth error:", authError);
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          isAdmin: false,
          isAuthorized: false,
          user: null,
          error: authError,
        });
        return;
      }

      if (authUser) {
        if (currentUser) {
          const userDetails = currentUser as UserData;
          setAuthState({
            isLoading: false,
            isAuthenticated: true,
            isAdmin: isTruthy(currentUser.isAdmin) || false,
            isAuthorized: isTruthy(currentUser.isAuth) || false,
            user: { ...authUser, ...userDetails },
            error: null,
          });
        } else {
          // User is authenticated but not in the database
          setAuthState({
            isLoading: false,
            isAuthenticated: true,
            isAdmin: false,
            isAuthorized: false,
            user: authUser,
            error: null,
          });
          // Optionally, you could create a new user entry here
          // await createNewUser(authUser);
        }
      } else {
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          isAdmin: false,
          isAuthorized: false,
          user: null,
          error: null,
        });
      }
    };

    updateAuthState();
  }, [authLoading, userDataLoading, authUser, authError, userData]);

  const signOut = async () => {
    try {
      db.auth.signOut();
      setAuthState({
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
        isAuthorized: false,
        user: null,
        error: null,
      });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, setAuthState, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
