// AuthModal.tsx
import React, { useRef, useEffect, useState } from "react";
import { db } from "../lib/instantdb";
import { tx, id } from "@instantdb/react";
import { useAutoFocus } from "../hooks/useAutoFocus";
import { useAuth } from "../hooks/authContext";

export function AuthModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [sentEmail, setSentEmail] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const { setAuthState } = useAuth();

  useEffect(() => {
    let timer;
    if (isOpen) {
      setTimeLeft(120); // Reset timer when modal opens
      timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            onClose();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, onClose]);

  // Query for existing user
  const {
    data: userData,
    isLoading: userLoading,
    error: userError,
  } = db.useQuery({
    users: {
      $: { where: { email: email } },
    },
  });

  async function logUserToDatabase(
    email: string,
    existingUser: any | undefined
  ) {
    try {
      let userId: string;
      let userDetails: any;

      if (!existingUser) {
        // User doesn't exist, create a new user with sane defaults
        userId = id();
        userDetails = {
          id: userId,
          email,
          name: email.split("@")[0], // Default name is the part before @
          isAdmin: false,
          isAuth: false, // default
          createdAt: Date.now(),
        };
        await db.transact([tx.users[userId].update(userDetails)]);
        console.log("New user created:", email);
      } else {
        // User exists, update last login time
        userId = existingUser.id;
        userDetails = {
          ...existingUser,
          lastLoginAt: Date.now(),
        };
        await db.transact([
          tx.users[userId].update({ lastLoginAt: Date.now() }),
        ]);
        console.log("Existing user logged in:", email);
      }

      // Update auth state with the user details
      setAuthState({
        isLoading: false,
        isAuthenticated: true,
        isAdmin: userDetails.isAdmin || false,
        isAuthorized: userDetails.isAuth || false,
        user: userDetails,
        error: null,
      });
    } catch (error) {
      console.error("Error logging user to database:", error);
      throw error;
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.auth.sendMagicCode({ email });
      setSentEmail(true);
      setTimeLeft(120); // Reset timer after sending code
    } catch (err) {
      console.error(err);
      alert("Error sending code. Please try again.");
    }
  };

  useAutoFocus(inputRef, 1000, isOpen);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.auth.signInWithMagicCode({ email, code });
      const existingUser = userData?.users?.[0];
      await logUserToDatabase(email, existingUser);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error verifying code. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg">
        <h2 className="text-xl mb-4">Authentication</h2>
        {!sentEmail ? (
          <form onSubmit={handleSendCode}>
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="border p-2 mb-2 w-full"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white p-2 rounded"
            >
              Send Code
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter verification code"
              className="border p-2 mb-2 w-full"
            />
            <button
              type="submit"
              className="bg-green-500 text-white p-2 rounded"
            >
              Verify Code
            </button>
          </form>
        )}
        <button onClick={onClose} className="mt-4 text-sm text-gray-600">
          Close
        </button>
      </div>
    </div>
  );
}
