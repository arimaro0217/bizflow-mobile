import { Drawer } from 'vaul';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';
import { useHaptic } from '../../hooks';
import { useEffect } from 'react';

interface ConfirmDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
}

export function ConfirmDrawer({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = '実行する',
    cancelLabel = 'キャンセル',
    onConfirm,
    variant = 'default',
}: ConfirmDrawerProps) {
    const { trigger: haptic } = useHaptic();

    // ドロワーが開いた時に軽い振動
    useEffect(() => {
        if (open) {
            haptic('light');
        }
    }, [open, haptic]);

    const handleConfirm = () => {
        haptic('medium');
        onConfirm();
        onOpenChange(false);
    };

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/50 z-50" />
                <Drawer.Content
                    className="fixed bottom-0 left-0 right-0 z-[60] outline-none"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <div className="bg-surface-dark rounded-t-3xl p-6 pb-safe">
                        {/* ハンドル */}
                        <div className="flex justify-center mb-6">
                            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
                        </div>

                        <div className="flex flex-col items-center text-center mb-8">
                            {variant === 'destructive' && (
                                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                </div>
                            )}
                            <Drawer.Title className="text-xl font-semibold text-white mb-2">
                                {title}
                            </Drawer.Title>
                            {description && (
                                <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                                    {description}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3">
                            <Button
                                onClick={handleConfirm}
                                variant={variant === 'destructive' ? 'danger' : 'primary'}
                                size="lg"
                                className="w-full"
                            >
                                {confirmLabel}
                            </Button>
                            <Button
                                onClick={() => onOpenChange(false)}
                                variant="ghost"
                                size="lg"
                                className="w-full text-gray-400 hover:text-white hover:bg-white/5"
                            >
                                {cancelLabel}
                            </Button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
