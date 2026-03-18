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
      const normalizedEmail = params.email.trim().toLowerCase();

      if (!params.deptId) {
        throw new Error("Department is required.");
      }

      // `users.email` is unique in the schema. If the email already exists,
      // InstantDB may treat this as an "update" and effectively overwrite
      // the existing record. Guard so the admin gets a clear error.
      const { data: existing } = await db.queryOnce({
        users: {
          $: {
            where: { email: normalizedEmail },
          },
        },
      });

      if (existing?.users?.length > 0) {
        throw new Error("A user with this email already exists.");
      }

      const newUserId = id();
      const now = Date.now();
      await db.transact([
        tx.users[newUserId].update({
          name: params.name,
          email: normalizedEmail,
          barcode: params.barcode,
          isAdmin: params.isAdmin ?? false,
          isAuth: false,
          lastLoginAt: now,
          createdAt: now,
          serverCreatedAt: now,
          deptId: params.deptId, // Department is required
          laptopSerial: "", // satisfy current schema requirement
          purpose: "", // satisfy current schema requirement
        }),
      ]);
    } catch (err) {
      console.error("createUser error", err);
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
