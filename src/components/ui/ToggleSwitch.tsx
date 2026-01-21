import { cn } from '../../lib/utils';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    leftLabel?: string;
    rightLabel?: string;
    className?: string;
}

export function ToggleSwitch({
    checked,
    onChange,
    leftLabel,
    rightLabel,
    className,
}: ToggleSwitchProps) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            {leftLabel && (
                <span
                    className={cn(
                        'text-sm font-medium transition-colors cursor-pointer',
                        !checked ? 'text-white' : 'text-gray-500'
                    )}
                    onClick={() => onChange(false)}
                >
                    {leftLabel}
                </span>
            )}

            <button
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className="relative w-12 h-7 bg-surface-light rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-dark"
            >
                <span
                    className={cn(
                        'absolute top-1 left-1 w-5 h-5 rounded-full transition-transform duration-200 ease-in-out',
                        checked
                            ? 'translate-x-5 bg-primary-500'
                            : 'translate-x-0 bg-gray-400'
                    )}
                />
            </button>

            {rightLabel && (
                <span
                    className={cn(
                        'text-sm font-medium transition-colors cursor-pointer',
                        checked ? 'text-white' : 'text-gray-500'
                    )}
                    onClick={() => onChange(true)}
                >
                    {rightLabel}
                </span>
            )}
        </div>
    );
}

export default ToggleSwitch;
