import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ToggleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}

const ToggleSection: React.FC<ToggleSectionProps> = ({ title, isOpen, onToggle }) => {
  return (
    <div 
      className="flex items-center justify-between border-solid border-2 border-sky-200 dark:border-sky-700 p-2 bg-gray-200 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
      onClick={onToggle}
    >
      <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
      {isOpen ? <ChevronUp size={20} className="text-gray-900 dark:text-white" /> : <ChevronDown size={20} className="text-gray-900 dark:text-white" />}
    </div>
  );
};

export default ToggleSection;