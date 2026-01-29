// =============================================================================
// ViewToggle - iOS風のSegmented Controlコンポーネント
// =============================================================================

import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ViewToggleOption {
    label: string;
    value: string;
    icon?: React.ReactNode;
}

interface ViewToggleProps {
    options: ViewToggleOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function ViewToggle({ options, value, onChange, className }: ViewToggleProps) {
    const activeIndex = options.findIndex(opt => opt.value === value);

    return (
        <div
            className={cn(
                'relative flex items-center gap-1 p-1 bg-surface-light rounded-xl',
                className
            )}
        >
            {/* 選択中の背景（アニメーション） */}
            <motion.div
                className="absolute h-[calc(100%-8px)] bg-surface rounded-lg shadow-sm"
                layoutId="viewToggleBackground"
                initial={false}
                animate={{
                    x: `calc(${activeIndex * 100}% + ${activeIndex * 4}px)`,
                    width: `calc(${100 / options.length}% - 4px)`,
                }}
                transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 35,
                }}
                style={{
                    left: 4,
                }}
            />

            {/* オプションボタン */}
            {options.map((option) => {
                const isActive = option.value === value;

                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'relative z-10 flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            isActive ? 'text-white' : 'text-gray-400 hover:text-gray-300'
                        )}
                    >
                        {option.icon}
                        <span>{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

export default ViewToggle;
