"use client";

import { useEffect } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import PlayerDatabasePage from './PlayerDatabasePage';

export default function Page() {
  const setActiveTab = useDashboardStore((state) => state.setActiveTab);
  
  useEffect(() => {
    setActiveTab('database');
  }, [setActiveTab]);
  
  return <PlayerDatabasePage />;
}
