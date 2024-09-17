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
      className="flex items-center justify-between border-solid border-2 border-sky-200 p-2 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors duration-200"
      onClick={onToggle}
    >
      <span className="font-semibold">{title}</span>
      {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
    </div>
  );
};

export default ToggleSection;