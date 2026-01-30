import { motion, AnimatePresence } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Pencil, Trash2 } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import type { Transaction } from '../../types';
import { useState } from 'react';
import { Skeleton } from '../../components/ui';

interface TransactionListProps {
    transactions: Transaction[];
    loading?: boolean;
    onEdit?: (transaction: Transaction) => void;
    onDelete?: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, loading, onEdit, onDelete }: TransactionListProps) {
    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
            </div>
        );
    }
    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <p className="text-sm">この日の取引はありません</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
                {transactions.map((transaction) => (
                    <motion.div
                        key={transaction.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    >
                        <TransactionItem
                            transaction={transaction}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

interface TransactionItemProps {
    transaction: Transaction;
    onEdit?: (transaction: Transaction) => void;
    onDelete?: (transaction: Transaction) => void;
}

function TransactionItem({ transaction, onEdit, onDelete }: TransactionItemProps) {
    const [offsetX, setOffsetX] = useState(0);

    const bind = useDrag(
        ({ offset: [x], last, velocity: [vx], direction: [xDir] }) => {
            if (last) {
                // スワイプ完了時
                if (x < -60 || (vx > 0.5 && xDir < 0)) {
                    setOffsetX(-120);
                } else {
                    setOffsetX(0);
                }
            } else {
                // ドラッグ中
                setOffsetX(Math.min(0, Math.max(-120, x)));
            }
        },
        {
            axis: 'x',
            from: () => [offsetX, 0],
            bounds: { left: -120, right: 0 },
            rubberband: true,
            filterTaps: true,
        }
    );

    const handleClose = () => {
        setOffsetX(0);
    };

    return (
        <div className="relative overflow-hidden rounded-xl">
            {/* アクションボタン（背景） */}
            <div className="absolute inset-y-0 right-0 flex">
                <button
                    onClick={() => {
                        onEdit?.(transaction);
                        handleClose();
                    }}
                    className="w-15 bg-primary-600 flex items-center justify-center"
                    style={{ width: 60 }}
                >
                    <Pencil className="w-5 h-5 text-white" />
                </button>
                <button
                    onClick={() => {
                        onDelete?.(transaction);
                        handleClose();
                    }}
                    className="w-15 bg-expense flex items-center justify-center"
                    style={{ width: 60 }}
                >
                    <Trash2 className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* コンテンツ */}
            <motion.div
                {...(bind() as any)}
                style={{ x: offsetX }}
                className="relative bg-surface-light p-4 rounded-xl touch-pan-y"
            >    <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                        {/* 取引先/カテゴリ */}
                        <p className="text-white font-medium truncate">
                            {transaction.memo || '取引'}
                        </p>
                        {/* 日時 */}
                        <p className="text-gray-500 text-sm">
                            {transaction.transactionDate
                                ? format(transaction.transactionDate, 'M/d (E)', { locale: ja })
                                : '-'}
                        </p>
                    </div>

                    {/* 金額 */}
                    <div className="text-right">
                        <p className={cn(
                            'font-semibold text-lg tabular-nums',
                            transaction.type === 'income' ? 'text-income' : 'text-expense'
                        )}>
                            {transaction.type === 'income' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                        </p>
                        {/* ステータス表示 */}
                        <div className="flex justify-end gap-2 mt-1">
                            {/* 予測・自動連動バッジ */}
                            {transaction.isEstimate && !transaction.isSettled && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    ✨ 予測
                                </span>
                            )}
                            {/* 消込ステータス */}
                            {transaction.isSettled ? (
                                <span className="text-xs text-primary-500">消込済</span>
                            ) : transaction.settlementDate ? (
                                <span className="text-xs text-gray-500">
                                    {format(transaction.settlementDate, 'M/d予定', { locale: ja })}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default TransactionList;
