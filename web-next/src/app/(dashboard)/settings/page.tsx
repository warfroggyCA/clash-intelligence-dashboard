"use client";

// DashboardLayout is now provided by the parent layout
import { SettingsContent } from '@/components/settings';

export default function SettingsPage() {
  return (
    <div className="w-full px-4 pb-16 pt-6 sm:px-4 lg:px-6">
      <SettingsContent layout="page" />
    </div>
  );
}
