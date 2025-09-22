"use client";

import { useEffect, useState } from 'react';
import { Minus, Plus, Type } from 'lucide-react';

const FONT_SIZES = [
  { label: 'Small', multiplier: 0.8, description: '80%' },
  { label: 'Normal', multiplier: 1.0, description: '100%' },
  { label: 'Large', multiplier: 1.2, description: '120%' },
  { label: 'Larger', multiplier: 1.4, description: '140%' },
  { label: 'Largest', multiplier: 1.6, description: '160%' }
];

export default function FontSizeControl() {
  const [currentSize, setCurrentSize] = useState(1.0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load saved font size preference
    const savedSize = localStorage.getItem('fontSizeMultiplier');
    if (savedSize) {
      const multiplier = parseFloat(savedSize);
      setCurrentSize(multiplier);
      updateFontSize(multiplier);
    }
  }, []);

  const updateFontSize = (multiplier: number) => {
    document.documentElement.style.setProperty('--font-size-multiplier', multiplier.toString());
    localStorage.setItem('fontSizeMultiplier', multiplier.toString());
  };

  const handleSizeChange = (multiplier: number) => {
    setCurrentSize(multiplier);
    updateFontSize(multiplier);
    setIsOpen(false);
  };

  const getCurrentSizeLabel = () => {
    const size = FONT_SIZES.find(s => s.multiplier === currentSize);
    return size ? size.label : 'Normal';
  };

  const getCurrentSizeDescription = () => {
    const size = FONT_SIZES.find(s => s.multiplier === currentSize);
    return size ? size.description : '100%';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 px-2 py-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
        title="Adjust font size for accessibility"
      >
        <Type className="w-4 h-4" />
        <span className="text-xs">{getCurrentSizeDescription()}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:!bg-gray-800 backdrop-blur-sm border border-gray-200 dark:!border-gray-600 rounded-lg shadow-xl z-50">
          <div className="p-2">
            <div className="text-xs font-semibold text-gray-600 dark:!text-gray-300 uppercase tracking-wide mb-2 px-2">
              Font Size
            </div>
            {FONT_SIZES.map((size) => (
              <button
                key={size.multiplier}
                onClick={() => handleSizeChange(size.multiplier)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                  currentSize === size.multiplier
                    ? 'bg-indigo-100 dark:!bg-indigo-900 text-indigo-700 dark:!text-indigo-300 font-medium'
                    : 'hover:bg-gray-100 dark:hover:!bg-gray-700 text-gray-700 dark:!text-gray-200'
                }`}
              >
                <span>{size.label}</span>
                <span className="text-xs text-gray-500 dark:!text-gray-400">{size.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
