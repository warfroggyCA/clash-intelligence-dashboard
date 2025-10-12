"use client";

import React from 'react';

interface CommandRailProps {
  isOpen: boolean;
  onToggle: () => void;
}

const CommandRailInner: React.FC<CommandRailProps> = ({ isOpen, onToggle }) => {
  // EMERGENCY FIX: Return minimal placeholder until full rebuild
  return (
    <div className={`command-rail ${isOpen ? 'open' : 'closed'}`}>
      <div className="p-4 text-yellow-200 bg-yellow-900/20 border border-yellow-500/70 rounded">
        <p className="text-sm">⚠️ Command Rail temporarily disabled (React 185 fix in progress)</p>
      </div>
    </div>
  );
};

const CommandRail = React.memo(CommandRailInner);
export default CommandRail;
