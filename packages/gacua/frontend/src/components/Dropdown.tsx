/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const ArrowIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 9l-7 7-7-7"
    ></path>
  </svg>
);

const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select option...',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full text-left px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-3xl flex items-center justify-between gap-2 hover:text-gray-900 hover:font-semibold ${isOpen ? 'text-gray-900 font-semibold' : 'text-gray-500'} ${className || ''}`}
        disabled={disabled}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ArrowIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div className="absolute z-10 bottom-full mb-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {options
            .filter((option) => option.value !== value)
            .map((option) => (
              <div
                key={option.value}
                className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-gray-500"
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
