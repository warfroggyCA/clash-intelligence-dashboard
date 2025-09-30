import React from 'react';
import Image from 'next/image';

interface ResourceDisplayProps {
  type: 'gold' | 'elixir' | 'dark' | 'gems';
  amount: number;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
};

const containerSizeClasses = {
  sm: 'px-2 py-1',
  md: 'px-3 py-2',
  lg: 'px-4 py-2'
};

const resourceConfig = {
  gold: {
    icon: '/assets/icons/Icon_HV_Resource_Gold_small.png',
    color: 'text-clash-gold',
    bgColor: 'bg-clash-gold/10',
    borderColor: 'border-clash-gold/30',
    emoji: '🪙'
  },
  elixir: {
    icon: '/assets/icons/Icon_HV_Resource_Elixir_small.png',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
    emoji: '💜'
  },
  dark: {
    icon: '/assets/icons/Icon_HV_Resource_Dark_small.png',
    color: 'text-purple-600',
    bgColor: 'bg-purple-600/10',
    borderColor: 'border-purple-600/30',
    emoji: '🖤'
  },
  gems: {
    icon: '/assets/icons/Icon_HV_Resource_Gems_small.png',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    emoji: '💎'
  }
};

export const ResourceDisplay: React.FC<ResourceDisplayProps> = ({
  type,
  amount,
  className = '',
  showIcon = true,
  size = 'md'
}) => {
  const config = resourceConfig[type];
  
  return (
    <div className={`flex items-center gap-2 ${config.bgColor} ${config.borderColor} border rounded-lg ${containerSizeClasses[size]} ${className}`}>
      {showIcon && (
        <div
          className="relative"
          style={{
            width: `${size === 'sm' ? 16 : size === 'md' ? 20 : 24}px`,
            height: `${size === 'sm' ? 16 : size === 'md' ? 20 : 24}px`,
          }}
        >
          <Image
            src={config.icon}
            alt={`${type} resource`}
            width={size === 'sm' ? 16 : size === 'md' ? 20 : 24}
            height={size === 'sm' ? 16 : size === 'md' ? 20 : 24}
            className="object-contain"
            style={{
              width: `${size === 'sm' ? 16 : size === 'md' ? 20 : 24}px`,
              height: `${size === 'sm' ? 16 : size === 'md' ? 20 : 24}px`,
            }}
            onError={(e) => {
              // Fallback to emoji if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = config.emoji;
                parent.className += ' flex items-center justify-center';
              }
            }}
          />
        </div>
      )}
      <span className={`${config.color} font-bold ${textSizeClasses[size]}`}>
        {amount.toLocaleString()}
      </span>
    </div>
  );
};

export default ResourceDisplay;
