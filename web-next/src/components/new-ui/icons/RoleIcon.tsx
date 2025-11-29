"use client";

import Image from 'next/image';
import { roleIconMap, fallbackIcons } from './maps';

interface RoleIconProps {
  role: 'leader' | 'coleader' | 'elder' | 'member';
  size?: number;
  className?: string;
  label?: string;
}

export const RoleIcon: React.FC<RoleIconProps> = ({ role, size = 48, className = '', label }) => {
  const src = roleIconMap[role] || fallbackIcons.role;
  const title = label || role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <span title={title} className="inline-flex" aria-label={title}>
      <Image
        src={src}
        alt={title}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`object-contain ${className}`}
        priority
      />
    </span>
  );
};

export default RoleIcon;
