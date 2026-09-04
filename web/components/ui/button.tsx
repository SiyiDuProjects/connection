'use client';

import { Button as HeroButton } from '@heroui/react';
import type { ComponentProps } from 'react';

// Translate legacy form props; HeroUI owns rendering and visual states.
type Props = Omit<ComponentProps<typeof HeroButton>, 'variant' | 'size'> & {
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};
export function Button({ disabled, isDisabled, variant = 'default', size = 'default', ...props }: Props) {
  const variants = { default: 'primary', destructive: 'danger', outline: 'outline', secondary: 'secondary', ghost: 'ghost', link: 'ghost' } as const;
  return <HeroButton {...props} isDisabled={isDisabled ?? disabled} variant={variants[variant]} size={size === 'default' || size === 'icon' ? 'md' : size} isIconOnly={size === 'icon' || props.isIconOnly} />;
}
