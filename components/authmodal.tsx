// AuthModal.tsx
import React, { useRef, useEffect, useState } from "react";
import { db } from "@/lib/instantdb";
import { tx, id } from "@instantdb/react";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { useAuth } from "@/hooks/authContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { X, Mail, Shield, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  shouldFocus: boolean;
}

export function AuthModal({ isOpen, onClose, shouldFocus }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentEmail, setSentEmail] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const { setAuthState } = useAuth();
  const inputRef = useAutoFocus(shouldFocus);
  const modalRef = useRef<HTMLDivElement>(null);

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

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Ignore clicks on select dropdown
      if (target.closest('[role="listbox"]')) return;

      if (modalRef.current && !modalRef.current.contains(target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    
    try {
      await db.auth.sendMagicCode({ email });
      setSentEmail(true);
      setTimeLeft(120); // Reset timer after sending code
      toast.success("Verification code sent to your email");
    } catch (err) {
      console.error(err);
      toast.error("Error sending code. Please try again.");
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter the verification code");
      return;
    }
    
    try {
      await db.auth.signInWithMagicCode({ email, code });
      const existingUser = userData?.users?.[0];
      await logUserToDatabase(email, existingUser);
      toast.success("Authentication successful!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Invalid verification code. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600 dark:text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Authentication</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!sentEmail ? (
            <form onSubmit={handleSendCode} className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail size={16} />
                  Email Address
                </label>
                <Input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Send Code
                </Button>
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <Mail size={16} />
                  <span>Code sent to: {email}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                  <Clock size={16} />
                  <span>Time remaining: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Shield size={16} />
                  Verification Code
                </label>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit verification code"
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Verify Code
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setSentEmail(false);
                    setCode("");
                    setTimeLeft(120);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Resend
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
