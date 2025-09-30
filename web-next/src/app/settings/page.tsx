"use client";

import DashboardLayout from '@/components/layout/DashboardLayout';
import { SettingsContent } from '@/components/settings';

export default function SettingsPage() {
  return (
    <DashboardLayout className="settings-page">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <SettingsContent layout="page" />
      </div>
    </DashboardLayout>
  );
}
