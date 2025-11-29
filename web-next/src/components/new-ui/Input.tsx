"use client";

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ className = '', style, ...rest }) => {
  return (
    <input
      className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:border-[var(--accent-alt)] focus:outline-none ${className}`}
      style={{
        background: 'var(--input)',
        borderColor: 'var(--border-subtle)',
        ...style,
      }}
      {...rest}
    />
  );
};

export default Input;
