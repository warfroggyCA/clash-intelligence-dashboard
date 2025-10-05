import React from 'react';
import RetiredPlayersTable from '@/components/retired/RetiredPlayersTable';

export const metadata = {
  title: 'Retired Players',
  description: 'Departed members list with departure details',
};

export default function RetiredPage() {
  return (
    <div className="px-4 py-6 md:px-6 space-y-6">
      <RetiredPlayersTable />
    </div>
  );
}

