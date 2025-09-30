"use client";

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { SettingsContent } from '@/components/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="xl">
      <SettingsContent layout="modal" onClose={onClose} />
    </Modal>
  );
}
