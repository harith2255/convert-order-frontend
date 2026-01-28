import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";

interface AutocompleteProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function Autocomplete({
  options,
  value,
  onChange,
  placeholder = "Select or type...",
  label,
  className = "",
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sync filter with external value changes only if it's not being typed
    // Actually, distinct separation is better. Let's just use value as filter when closed?
    // No, standard combobox behavior: input value IS the value.
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className={`w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
        
        {/* Dropdown Toggle Icon (Visual only) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
          <ChevronDown className="w-4 h-4" />
        </div>

        {/* Dropdown Menu */}
        {isOpen && filteredOptions.length > 0 && (
          <ul className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredOptions.map((option, index) => (
              <li
                key={index}
                className="px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer transition-colors"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
