import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ToggleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}

const ToggleSection: React.FC<ToggleSectionProps> = ({
  title,
  isOpen,
  onToggle,
}) => {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      className="flex w-full items-center justify-between gap-3 rounded-md border-2 border-sky-200 bg-gray-200 px-3 py-3 text-left transition-colors duration-200 hover:bg-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-sky-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus-visible:ring-sky-500 sm:px-4"
      onClick={onToggle}
    >
      <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
      {isOpen ? (
        <ChevronUp size={20} className="text-gray-900 dark:text-white" />
      ) : (
        <ChevronDown size={20} className="text-gray-900 dark:text-white" />
      )}
    </button>
  );
};

export default ToggleSection;