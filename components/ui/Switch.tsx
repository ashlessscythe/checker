// Custom Switch Component using React + Tailwind CSS
export const Switch = ({ isChecked, onChange }) => {
  return (
    <div
      className={`relative inline-flex items-center h-6 rounded-full w-11 cursor-pointer ${
        isChecked ? "bg-blue-600" : "bg-gray-300"
      }`}
      onClick={() => onChange(!isChecked)}
    >
      <span
        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
          isChecked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </div>
  );
};
