"use client";

import DashboardLayout from '@/components/layout/DashboardLayout';
import { SettingsContent } from '@/components/settings';

export default function SettingsPage() {
  return (
    <DashboardLayout className="settings-page" hideNavigation>
      <div className="w-full px-4 pb-16 pt-6 sm:px-4 lg:px-6">
        <SettingsContent layout="page" />
      </div>
    </DashboardLayout>
  );
}
