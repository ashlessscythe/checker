"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { tx, id } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import toast from "react-hot-toast";
import { X, User, Building, Laptop, QrCode } from "lucide-react";

const VISIT_PURPOSES = [
  "Meeting",
  "Interview", 
  "Delivery",
  "Contractor",
  "Maintenance",
  "Vendor",
  "Other",
];

interface FormData {
  name: string;
  purpose: string;
  laptopSerial: string;
  barcode: string;
}

interface FormErrors {
  name?: string;
  purpose?: string;
  barcode?: string;
}

export default function VisitorRegistration() {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    purpose: "",
    laptopSerial: "",
    barcode: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Query for existing users with the current barcode
  const { data: existingUsers } = db.useQuery({
    users: {
      $: {
        where: {
          barcode: formData.barcode || "NO_MATCH", // Use placeholder when no barcode
        },
      },
    },
  });

  // Query for VISITOR department
  const { data: deptData } = db.useQuery({
    departments: {
      $: {
        where: {
          departmentId: "VISITOR",
        },
      },
    },
  });

  // Enhanced barcode validation - must contain both numbers and letters
  const validateBarcode = (barcode: string): boolean => {
    if (!barcode) return false;
    // Must be 10-20 characters, alphanumeric, and contain both letters and numbers
    const hasLetters = /[A-Za-z]/.test(barcode);
    const hasNumbers = /[0-9]/.test(barcode);
    const isValidLength = barcode.length >= 10 && barcode.length <= 20;
    const isAlphanumeric = /^[A-Za-z0-9]+$/.test(barcode);
    
    return hasLetters && hasNumbers && isValidLength && isAlphanumeric;
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.purpose) {
      newErrors.purpose = "Please select a purpose";
    }

    if (!formData.barcode.trim()) {
      newErrors.barcode = "Barcode is required";
    } else if (!validateBarcode(formData.barcode)) {
      newErrors.barcode = "Barcode must be 10-20 characters with both letters and numbers";
    } else if (formData.name.trim().toLowerCase() === formData.barcode.trim().toLowerCase()) {
      newErrors.barcode = "Barcode must be different from your name";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const closeModal = useCallback(() => {
    setFormData({
      name: "",
      purpose: "",
      laptopSerial: "",
      barcode: "",
    });
    setErrors({});
    setShowForm(false);
  }, []);

  // Focus name input when modal opens
  useEffect(() => {
    if (showForm && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [showForm]);

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[role="listbox"]')) return;

      if (modalRef.current && !modalRef.current.contains(target)) {
        closeModal();
      }
    };

    if (showForm) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showForm, closeModal]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showForm) {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showForm, closeModal]);

  // Auto-close modal after 30 seconds of inactivity
  useEffect(() => {
    if (!showForm) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        closeModal();
      }, 30000); // 30 seconds
    };

    const events = [
      "mousedown",
      "mousemove", 
      "keypress",
      "keydown",
      "scroll",
      "touchstart",
      "input",
      "change"
    ];

    // Set initial timeout
    resetTimeout();

    // Add event listeners to reset timeout on activity
    events.forEach((event) => {
      document.addEventListener(event, resetTimeout, { passive: true });
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, [showForm, closeModal]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the errors below");
      return;
    }

    // Check if barcode is already in use
    if (existingUsers?.users?.length > 0) {
      toast.error("This barcode is already registered");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get or create VISITOR department
      let visitorDeptId = "";
      
      if (!deptData?.departments || deptData.departments.length === 0) {
        // Create VISITOR department
        visitorDeptId = id();
        await db.transact([
          tx.departments[visitorDeptId].update({
            name: "Visitors",
            departmentId: "VISITOR",
          }),
        ]);
      } else {
        visitorDeptId = deptData.departments[0].id;
      }

      // Create visitor
      const visitorId = id();
      const timestamp = Date.now();

      await db.transact([
        tx.users[visitorId].update({
          name: formData.name.trim(),
          email: `${formData.purpose.toLowerCase().replace(/\s+/g, '_')}_${timestamp}@visitor`,
          barcode: formData.barcode.trim().toUpperCase(),
          isAdmin: false,
          isAuth: false,
          deptId: visitorDeptId,
          createdAt: timestamp,
          serverCreatedAt: timestamp,
          laptopSerial: formData.laptopSerial.trim() || undefined,
          purpose: formData.purpose,
        }),
      ]);

      toast.success("Visitor registered successfully!");
      closeModal();
      
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register visitor. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showForm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Visitor Registration</h2>
            <button
              onClick={closeModal}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Name Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User size={16} />
                Full Name
              </label>
              <Input
                ref={nameInputRef}
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter your full name"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Purpose Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Building size={16} />
                Purpose of Visit
              </label>
              <Select
                value={formData.purpose}
                onValueChange={(value) => handleInputChange("purpose", value)}
              >
                <SelectTrigger className={errors.purpose ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select purpose of visit" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-border shadow-md rounded-sm">
                  {VISIT_PURPOSES.map((purpose) => (
                    <SelectItem 
                      key={purpose} 
                      value={purpose}
                      className="hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      {purpose}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.purpose && (
                <p className="text-red-500 text-xs mt-1">{errors.purpose}</p>
              )}
            </div>

            {/* Barcode Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <QrCode size={16} />
                Security Barcode
              </label>
              <Input
                type="text"
                value={formData.barcode}
                onChange={(e) => handleInputChange("barcode", e.target.value.toUpperCase())}
                placeholder="Enter the barcode provided by security"
                maxLength={20}
                className={errors.barcode ? "border-red-500" : ""}
              />
              {errors.barcode && (
                <p className="text-red-500 text-xs mt-1">{errors.barcode}</p>
              )}
            </div>

            {/* Laptop Serial Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Laptop size={16} />
                Laptop Serial Number (Optional)
              </label>
              <Input
                type="text"
                value={formData.laptopSerial}
                onChange={(e) => handleInputChange("laptopSerial", e.target.value)}
                placeholder="Enter laptop serial number if applicable"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Registering..." : "Register Visitor"}
              </Button>
              <Button
                type="button"
                onClick={closeModal}
                variant="outline"
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Button 
      onClick={() => setShowForm(true)} 
      className="w-full max-w-md bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
    >
      First Time Visitor? Register Here
    </Button>
  );
}
