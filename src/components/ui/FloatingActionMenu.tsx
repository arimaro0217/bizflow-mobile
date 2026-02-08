// =============================================================================
// FloatingActionMenu - Speed Dial形式のFAB（フローティングアクションボタン）
// =============================================================================
// 【設計意図】
// - 画面右下に常駐するアクションの起点
// - タップで展開し、サブボタンが時間差でポップアップ
// - ハプティクスフィードバック対応
// =============================================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar, CircleDollarSign, X } from 'lucide-react';
import { cn } from '../../lib/utils';

// =============================================================================
// 型定義
// =============================================================================

interface FloatingActionMenuProps {
    onCreateProject?: () => void;
    onCreateTransaction?: () => void;
}

// =============================================================================
// アニメーション設定
// =============================================================================

const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

const menuVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: {
        opacity: 0,
        y: 20,
        scale: 0.8,
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring' as const,
            stiffness: 400,
            damping: 25,
        },
    },
};

// =============================================================================
// メインコンポーネント
// =============================================================================

export function FloatingActionMenu({
    onCreateProject,
    onCreateTransaction,
}: FloatingActionMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

    // ハプティクスフィードバック
    const triggerHaptic = useCallback(() => {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(10);
            } catch (e) {
                // 非対応の場合は無視
            }
        }
    }, []);

    const handleToggle = useCallback(() => {
        triggerHaptic();
        setIsOpen(prev => !prev);
    }, [triggerHaptic]);

    const handleCreateProject = useCallback(() => {
        triggerHaptic();
        setIsOpen(false);
        onCreateProject?.();
    }, [triggerHaptic, onCreateProject]);

    const handleCreateTransaction = useCallback(() => {
        triggerHaptic();
        setIsOpen(false);
        onCreateTransaction?.();
    }, [triggerHaptic, onCreateTransaction]);

    const handleBackdropClick = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <>
            {/* オーバーレイ（バックドロップ） */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={backdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={handleBackdropClick}
                        className="fixed inset-0 bg-black/50 z-40"
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            {/* FABコンテナ */}
            <div
                id="tour-target-fab"
                className="fixed right-4 z-50"
                style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
                {/* サブメニュー */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            variants={menuVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="absolute bottom-16 right-0 flex flex-col items-end gap-3 mb-3"
                        >
                            {/* 案件を作成 */}
                            <motion.button
                                variants={itemVariants}
                                onClick={handleCreateProject}
                                className="flex items-center gap-3 group"
                                aria-label="案件を作成"
                            >
                                <span className="px-3 py-1.5 bg-surface rounded-lg text-sm font-medium text-white shadow-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                    案件を作成
                                </span>
                                <div className="w-12 h-12 rounded-full bg-orange-500 shadow-lg flex items-center justify-center hover:bg-orange-600 transition-colors">
                                    <Calendar className="w-5 h-5 text-white" />
                                </div>
                            </motion.button>

                            {/* 取引を記録 */}
                            <motion.button
                                variants={itemVariants}
                                onClick={handleCreateTransaction}
                                className="flex items-center gap-3 group"
                                aria-label="取引を記録"
                            >
                                <span className="px-3 py-1.5 bg-surface rounded-lg text-sm font-medium text-white shadow-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                    取引を記録
                                </span>
                                <div className="w-12 h-12 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors">
                                    <CircleDollarSign className="w-5 h-5 text-white" />
                                </div>
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* メインFABボタン */}
                <motion.button
                    onClick={handleToggle}
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={cn(
                        'w-14 h-14 rounded-full shadow-lg flex items-center justify-center',
                        'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-surface-dark',
                        isOpen
                            ? 'bg-gray-700 hover:bg-gray-600'
                            : 'bg-primary-500 hover:bg-primary-600'
                    )}
                    aria-label={isOpen ? 'メニューを閉じる' : 'メニューを開く'}
                    aria-expanded={isOpen}
                >
                    {isOpen ? (
                        <X className="w-6 h-6 text-white" />
                    ) : (
                        <Plus className="w-6 h-6 text-white" />
                    )}
                </motion.button>
            </div>
        </>
    );
}

export default FloatingActionMenu;
