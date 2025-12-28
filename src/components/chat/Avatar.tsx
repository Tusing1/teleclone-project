import { Users, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
  type?: 'user' | 'group' | 'channel';
}

const sizeClasses = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl'
};

const iconSizes = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

export function Avatar({ src, name, size = 'md', isOnline, className, type = 'user' }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500'
  ];

  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
  const bgColor = type === 'group' ? 'bg-emerald-500' :
    type === 'channel' ? 'bg-violet-500' :
      colors[colorIndex];

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn(
            'rounded-full object-cover',
            sizeClasses[size]
          )}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center text-primary-foreground font-medium',
            sizeClasses[size],
            bgColor
          )}
        >
          {type === 'group' ? (
            <Users className={iconSizes[size]} />
          ) : type === 'channel' ? (
            <Radio className={iconSizes[size]} />
          ) : (
            initials || '?'
          )}
        </div>
      )}
      {isOnline !== undefined && type === 'user' && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card',
            isOnline ? 'bg-online' : 'bg-muted-foreground'
          )}
        />
      )}
    </div>
  );
}
