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
  // This component is kept for backwards compatibility but no longer used.
  // On-site visitor registration has been replaced by the email-based pre-check flow.
  return null;
}
