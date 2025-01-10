import { useState } from "react";
import { id, tx } from "@instantdb/react";
import { db } from "../lib/instantdb";

interface CreateUserParams {
  name: string;
  email: string;
  barcode: string;
  isAdmin?: boolean;
  deptId?: string;
}

interface UseCreateUserReturn {
  createUser: (params: CreateUserParams) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useCreateUser(): UseCreateUserReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = async (params: CreateUserParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const newUserId = id();
      await db.transact([
        tx.users[newUserId].update({
          name: params.name,
          email: params.email,
          barcode: params.barcode,
          isAdmin: params.isAdmin ?? false,
          isAuth: false,
          lastLoginAt: Date.now(),
          createdAt: Date.now(),
          deptId: params.deptId ?? "", // Empty string if no department provided
        }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createUser,
    isLoading,
    error,
  };
}
