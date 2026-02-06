"use client";

import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { Shield, User, Users, Swords, Crown, Ghost, ChevronRight, X } from 'lucide-react';
import type { ClanRoleName } from '@/lib/auth/roles';

export function RoleSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const impersonatedRole = useDashboardStore((state) => state.impersonatedRole);
  const setImpersonatedRole = useDashboardStore((state) => state.setImpersonatedRole);
  const currentUser = useDashboardStore((state) => state.currentUser);
  
  // Only show in dev or for the specific owner/god-account
  const isDev = process.env.NODE_ENV === 'development';
  const isOwner = currentUser?.email === 'doug.findlay@gmail.com';

  if (!isDev && !isOwner) return null;

  const roles: Array<{ name: ClanRoleName | null; label: string; icon: any; color: string }> = [
    { name: 'leader', label: 'Leader', icon: Crown, color: 'text-clash-gold' },
    { name: 'coleader', label: 'Co-Leader', icon: Shield, color: 'text-rose-400' },
    { name: 'elder', label: 'Elder', icon: Swords, color: 'text-purple-400' },
    { name: 'member', label: 'Member', icon: Users, color: 'text-cyan-400' },
    { name: null, label: 'Public (Guest)', icon: Ghost, color: 'text-slate-400' },
  ];

  const currentRole = roles.find(r => r.name === impersonatedRole) || roles[roles.length - 1];

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {/* Small Toggle Pill */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full border bg-slate-900/90 backdrop-blur-md shadow-2xl transition-all duration-300 ${
          isOpen ? 'border-clash-gold ring-2 ring-clash-gold/20' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <currentRole.icon className={`w-3.5 h-3.5 ${currentRole.color}`} />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white">
          Viewing as: <span className={currentRole.color}>{currentRole.label}</span>
        </span>
        {isOpen ? <X className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="flex flex-col gap-1 p-1 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          {roles.map((role) => (
            <button
              key={role.label}
              onClick={() => {
                setImpersonatedRole(role.name);
                setIsOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                impersonatedRole === role.name 
                  ? 'bg-white/10 text-white' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <role.icon className={`w-4 h-4 ${role.color}`} />
              <span className="text-xs font-semibold">{role.label}</span>
              {impersonatedRole === role.name && (
                <div className="w-1 h-1 rounded-full bg-clash-gold ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
