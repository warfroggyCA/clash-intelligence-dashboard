"use client";

import React, { useState } from 'react';

interface CopyableNameProps {
  name: string;
  tag: string;
  className?: string;
  subtitle?: string;
}

export const CopyableName: React.FC<CopyableNameProps> = ({ name, tag, className = '', subtitle }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tag);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-left ${className}`}
      title={copied ? 'Copied!' : 'Click to copy player tag'}
    >
      <span className="block" style={{ fontFamily: 'var(--font-body)' }}>{name}</span>
      {subtitle ? <span className="block text-[12px] font-semibold text-slate-200">{subtitle}</span> : null}
    </button>
  );
};

export default CopyableName;
