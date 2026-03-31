import React, { useCallback } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useVisualViewport } from '../../hooks/useVisualViewport';
import { useAppStore } from '../../stores/appStore';

interface FormDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxHeight?: string;
    className?: string;
    preventDismiss?: boolean;
}

export function FormDrawer({
    open,
    onOpenChange,
    title,
    children,
    footer,
    maxHeight = '85dvh',
    className,
    preventDismiss = false,
}: FormDrawerProps) {
    const { isKeypadOpen } = useAppStore();
    const viewport = useVisualViewport();

    // ソフトウェアキーボードが開いているかどうかを高さの差分で判定（100px以上なら開いているとみなす）
    const isSoftwareKeyboardOpen = viewport && (window.innerHeight - viewport.height > 100);

    // ビューポート調整ロジック（ソフトウェアキーボード表示時のみ調整し、Keypad表示時や通常時は0とする）
    const contentStyle = (viewport && isSoftwareKeyboardOpen && !isKeypadOpen) ? {
        bottom: `${Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop))}px`,
        maxHeight: `${viewport.height}px`,
    } : {
        bottom: '0px'
    };

    const handleClose = useCallback(() => {
        onOpenChange(false);
    }, [onOpenChange]);

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={!preventDismiss && !isKeypadOpen}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
                <Drawer.Content
                    className={cn(
                        "fixed left-0 right-0 z-50 outline-none flex flex-col after:hidden",
                        className
                    )}
                    style={contentStyle}
                >
                    <div 
                        className="bg-surface-dark rounded-t-3xl flex flex-col h-full"
                        style={{ maxHeight: viewport && isSoftwareKeyboardOpen ? undefined : maxHeight }}
                    >
                        {/* ハンドル */}
                        <div className="flex justify-center py-4 cursor-grab active:cursor-grabbing group">
                            <Drawer.Handle className="w-12 h-1.5 bg-gray-600 group-hover:bg-gray-500 rounded-full transition-colors" />
                        </div>

                        {/* ヘッダー */}
                        <div className="px-6 pb-4 flex items-center justify-between">
                            <Drawer.Title className="text-xl font-semibold text-white">
                                {title}
                            </Drawer.Title>
                            <button
                                onClick={handleClose}
                                className="p-2 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* メインコンテンツ */}
                        <div className="flex-1 overflow-y-auto px-6 pb-safe space-y-6 overscroll-y-contain touch-pan-y">
                            {children}
                        </div>

                        {/* フッター */}
                        {footer && (
                            <div className="px-6 py-4 border-t border-white/5 bg-surface-dark/80 backdrop-blur-md">
                                {footer}
                            </div>
                        )}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
