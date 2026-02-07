import type { Metadata } from 'next';
import '../globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs as LayoutBreadcrumbs } from '@/components/layout/Breadcrumbs';
import ChunkLoadRecovery from './ChunkLoadRecovery';
import NewHeaderActions from './NewHeaderActions';

export const metadata: Metadata = {
  title: 'Clash Intelligence (New)',
  description: 'Rebuilt experience.',
};

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      headerContent={
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <LayoutBreadcrumbs className="min-w-0" />
          <NewHeaderActions />
        </div>
      }
    >
      <ChunkLoadRecovery />
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </AppShell>
  );
}
