import React from 'react';
import RetiredProfileClient from '@/components/retired/RetiredProfileClient';

type Props = { params: { tag: string } };

export const metadata = {
  title: 'Retired Player',
  description: 'Simplified retired player profile',
};

export default function RetiredProfilePage({ params }: Props) {
  const { tag } = params;
  return (
    <div className="px-4 py-6 md:px-6">
      <RetiredProfileClient tag={tag} />
    </div>
  );
}

