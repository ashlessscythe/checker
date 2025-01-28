"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { verifyBarcode } from "@/utils/barcodeVerification";
import { useModalAutoNavigate } from "@/hooks/useModalAutoNavigate";
import { useAutoFocus } from "@/hooks/useAutoFocus";
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

const VISIT_PURPOSES = [
  "Meeting",
  "Interview",
  "Delivery",
  "Contractor",
  "Other",
];

export default function VisitorRegistration() {
  const [showForm, setShowForm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    purpose: "",
    laptopSerial: "",
    barcode: "",
  });
  const barcodeInputRef = useAutoFocus(showForm && !formData.barcode);

  const closeModal = useCallback(() => {
    setFormData({
      name: "",
      purpose: "",
      laptopSerial: "",
      barcode: "",
    });
    setShowForm(false);
  }, []);

  // Auto navigate after 120 seconds when modal is open and no data entered
  const hasData =
    formData.barcode ||
    formData.name ||
    formData.purpose ||
    formData.laptopSerial;
  useModalAutoNavigate(showForm && !hasData);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Ignore clicks on select dropdown
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
  }, [showForm]);

  const { data } = db.useQuery({
    departments: {
      $: {
        where: {
          departmentId: "VISITOR",
        },
      },
    },
    users: {
      $: {
        where: {
          barcode: formData.barcode,
        },
      },
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.barcode) {
      toast.error("Please enter the barcode provided by security");
      return;
    }

    if (!verifyBarcode(formData.barcode)) {
      toast.error(
        "Invalid barcode format. Please enter a valid 20-character security barcode"
      );
      return;
    }

    // Check if barcode is already in use
    if (data?.users?.length > 0) {
      toast.error("This barcode is already registered");
      return;
    }

    try {
      // First, ensure VISITOR department exists
      let visitorDeptId = "";

      if (!data?.departments || data.departments.length === 0) {
        // Create VISITOR department if it doesn't exist
        visitorDeptId = id();
        await db.transact([
          tx.departments[visitorDeptId].update({
            name: "Visitors",
            departmentId: "VISITOR",
          }),
        ]);
      } else {
        visitorDeptId = data.departments[0].id;
      }

      // Create visitor in users table
      const visitorId = id();

      await db.transact([
        tx.users[visitorId].update({
          name: formData.name,
          email: `${formData.purpose.toLowerCase()}_${crypto
            .randomUUID()
            .slice(0, 10)}@visitor`,
          barcode: formData.barcode,
          isAdmin: false,
          isAuth: false,
          deptId: visitorDeptId,
          createdAt: Date.now(),
          serverCreatedAt: Date.now(),
          laptopSerial: formData.laptopSerial || undefined,
          purpose: formData.purpose,
        }),
      ]);

      toast.success("Visitor registered successfully!");
      setFormData({ name: "", purpose: "", laptopSerial: "", barcode: "" });
      setShowForm(false);
    } catch (error) {
      toast.error("Failed to register visitor");
      console.error(error);
    }
  };

  if (showForm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div
          ref={modalRef}
          className="hover:bg-primary/90 bg-white rounded-lg p-6 max-w-md w-full"
        >
          <h2 className="text-xl font-bold mb-4">Visitor Registration</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Security Barcode
              </label>
              <Input
                ref={barcodeInputRef}
                type="password"
                value={formData.barcode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    barcode: e.target.value.toUpperCase(),
                  })
                }
                placeholder="Scan the barcode you were provided"
                maxLength={20}
                pattern="[346789ACDEFGHJKLMNPQRTUVWXY]{20}"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Purpose of Visit
              </label>
              <Select
                value={formData.purpose}
                onValueChange={(value) =>
                  setFormData({ ...formData, purpose: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-border shadow-md rounded-sm">
                  {VISIT_PURPOSES.map((purpose) => (
                    <SelectItem
                      key={purpose}
                      value={purpose}
                      className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                    >
                      {purpose}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Laptop Serial Number (if applicable)
              </label>
              <Input
                type="text"
                value={formData.laptopSerial}
                onChange={(e) =>
                  setFormData({ ...formData, laptopSerial: e.target.value })
                }
              />
            </div>
            <div className="flex space-x-4">
              <Button type="submit">Register</Button>
              <Button
                type="button"
                onClick={() => {
                  setFormData({
                    name: "",
                    purpose: "",
                    laptopSerial: "",
                    barcode: "",
                  });
                  closeModal();
                }}
                variant="outline"
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
    <Button onClick={() => setShowForm(true)} className="w-full">
      First Time Visitor? Register Here
    </Button>
  );
}
