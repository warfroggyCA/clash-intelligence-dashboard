import React from 'react';
import RetiredProfileClient from '@/components/retired/RetiredProfileClient';

type Props = { params: Promise<{ tag: string }> };

export const metadata = {
  title: 'Retired Player',
  description: 'Simplified retired player profile',
};

export default async function RetiredProfilePage({ params }: Props) {
  const { tag } = await params;
  return (
    <div className="px-4 py-6 md:px-6">
      <RetiredProfileClient tag={tag} />
    </div>
  );
}

