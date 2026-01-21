import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
                    {
                        // Variants
                        'bg-primary-600 text-white hover:bg-primary-500': variant === 'primary',
                        'bg-surface-light text-gray-200 hover:bg-surface border border-gray-700': variant === 'secondary',
                        'bg-transparent text-gray-300 hover:bg-surface-light': variant === 'ghost',
                        'bg-expense text-white hover:bg-expense-dark': variant === 'danger',
                        // Sizes
                        'px-3 py-1.5 text-sm': size === 'sm',
                        'px-4 py-2.5 text-base': size === 'md',
                        'px-6 py-3.5 text-lg': size === 'lg',
                    },
                    className
                )}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
