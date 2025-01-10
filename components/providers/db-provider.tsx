// components/providers/db-provider.tsx
"use client";
import { useEffect, useRef } from "react";
import { tx } from "@instantdb/react";
import { db } from "@/lib/instantdb";

export function DbProvider({ children }: { children: React.ReactNode }) {
  const hasBootstrapped = useRef(false);
  const { data, isLoading, error } = db.useQuery({
    users: {
      $: {},
    },
  });

  useEffect(() => {
    const bootstrapDb = async () => {
      // Only proceed if:
      // 1. Query has completed (not loading)
      // 2. We haven't bootstrapped yet
      // 3. No users exist
      if (
        !isLoading &&
        !hasBootstrapped.current &&
        (!data?.users || data.users.length === 0)
      ) {
        try {
          console.log("Bootstrapping database with initial data...");
          const timestamp = Date.now();

          await db.transact([
            tx.users["admin"].update({
              name: "Admin",
              email: "admin@example.com",
              barcode: "ADMIN123",
              isAdmin: true,
              isAuth: true,
              lastLoginAt: timestamp,
              createdAt: timestamp,
              deptId: "",
            }),
          ]);

          hasBootstrapped.current = true;
          console.log("Database bootstrapped successfully");
        } catch (error) {
          console.error("Error bootstrapping database:", error);
        }
      }
    };

    bootstrapDb();
  }, [isLoading]); // Only depend on loading state, not data

  if (error) {
    console.error("Error querying database:", error);
  }

  return <>{children}</>;
}
