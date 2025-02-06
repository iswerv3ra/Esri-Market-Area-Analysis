import React, { useState, useRef, useEffect } from 'react';

const NumberRangeInput = ({ 
  value,
  onChange,
  disabled = false,
  placeholder,
  formatValue,
  className = ''
}) => {
  const [localValue, setLocalValue] = useState('');
  const inputRef = useRef(null);
  
  useEffect(() => {
    setLocalValue(formatValue(value));
  }, [value, formatValue]);

  const handleChange = (e) => {
    const cursorPosition = e.target.selectionStart;
    const newValue = e.target.value;
    
    setLocalValue(newValue);
    onChange(newValue);
    
    // Preserve cursor position after state update
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.selectionStart = cursorPosition;
        inputRef.current.selectionEnd = cursorPosition;
      }
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className={`w-24 px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 text-sm ${className}`}
    />
  );
};

export default NumberRangeInput;