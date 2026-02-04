// =============================================================================
// DateTransactionsSheet - 日付タップ時の取引一覧ポップアップ
// =============================================================================
// 【設計意図】
// - カレンダーの日付をタップすると、その日の取引一覧を表示
// - 収入/支出を色分けして見やすく表示
// - 取引をタップすると編集モードへ遷移可能
// =============================================================================

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Drawer } from 'vaul';
import { X, ArrowUpCircle, ArrowDownCircle, Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Transaction, Client } from '../../../types';
import Decimal from 'decimal.js';

interface DateTransactionsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: Date | null;
    transactions: Transaction[];
    clients: Client[];
    onTransactionClick?: (transaction: Transaction) => void;
    onTransactionDelete?: (transaction: Transaction) => void;
}

export function DateTransactionsSheet({
    open,
    onOpenChange,
    date,
    transactions,
    clients,
    onTransactionClick,
    onTransactionDelete,
}: DateTransactionsSheetProps) {
    if (!date) return null;

    // 取引を収入/支出で分類
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');

    // 合計計算
    const totalIncome = incomeTransactions.reduce(
        (sum, t) => sum.plus(new Decimal(t.amount || '0')),
        new Decimal(0)
    );
    const totalExpense = expenseTransactions.reduce(
        (sum, t) => sum.plus(new Decimal(t.amount || '0')),
        new Decimal(0)
    );

    // 取引先名を取得
    const getClientName = (clientId?: string) => {
        if (!clientId) return null;
        const client = clients.find(c => c.id === clientId);
        return client?.name || null;
    };

    // 金額フォーマット
    const formatAmount = (amount: string) => {
        const num = new Decimal(amount || '0').toNumber();
        return num.toLocaleString('ja-JP');
    };

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={false}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none max-h-[80vh] flex flex-col">
                    <div className="bg-surface rounded-t-2xl flex flex-col max-h-[80dvh]">
                        {/* ハンドル */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 rounded-full bg-gray-600" />
                        </div>

                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-500/20 rounded-lg">
                                    <Calendar className="w-5 h-5 text-primary-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        {format(date, 'M月d日（E）', { locale: ja })}
                                    </h2>
                                    <p className="text-sm text-gray-400">
                                        {transactions.length}件の取引
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="p-2 rounded-lg hover:bg-surface-light transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* サマリー */}
                        {transactions.length > 0 && (
                            <div className="grid grid-cols-2 gap-3 p-4 border-b border-white/5">
                                <div className="bg-income/10 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ArrowDownCircle className="w-4 h-4 text-income" />
                                        <span className="text-xs text-gray-400">収入</span>
                                    </div>
                                    <p className="text-lg font-bold text-income">
                                        ¥{formatAmount(totalIncome.toString())}
                                    </p>
                                </div>
                                <div className="bg-expense/10 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ArrowUpCircle className="w-4 h-4 text-expense" />
                                        <span className="text-xs text-gray-400">支出</span>
                                    </div>
                                    <p className="text-lg font-bold text-expense">
                                        ¥{formatAmount(totalExpense.toString())}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 取引リスト */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 overscroll-y-contain touch-pan-y">
                            {transactions.length === 0 ? (
                                <div className="text-center py-8">
                                    <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400">この日の取引はありません</p>
                                </div>
                            ) : (
                                transactions.map((tx) => {
                                    const clientName = getClientName(tx.clientId);
                                    const isIncome = tx.type === 'income';

                                    return (
                                        <div
                                            key={tx.id}
                                            className="relative group"
                                        >
                                            <button
                                                onClick={() => onTransactionClick?.(tx)}
                                                className={cn(
                                                    'w-full text-left p-3 rounded-xl transition-colors',
                                                    'bg-surface-light hover:bg-surface-light/80',
                                                    'border-l-4 pr-12', // Make space for delete button
                                                    isIncome ? 'border-income' : 'border-expense'
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        {/* メモ or 取引先名 */}
                                                        <p className="font-medium text-white truncate">
                                                            {tx.memo || clientName || (isIncome ? '収入' : '支出')}
                                                        </p>
                                                        {/* 取引先名（タイトルがメモの場合のみ表示） */}
                                                        {tx.memo && clientName && (
                                                            <p className="text-sm text-gray-400 truncate mt-0.5">
                                                                {clientName}
                                                            </p>
                                                        )}
                                                        {/* 日付情報 */}
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                                            {tx.transactionDate && (
                                                                <p className="text-xs text-gray-500">
                                                                    発生: {format(tx.transactionDate, 'M/d')}
                                                                </p>
                                                            )}
                                                            {tx.settlementDate && (
                                                                <p className="text-xs text-blue-400/70">
                                                                    決済: {format(tx.settlementDate, 'M/d')}
                                                                </p>
                                                            )}
                                                            {tx.isSettled && (
                                                                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                                                                    消込済
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* 金額 */}
                                                    <p className={cn(
                                                        'text-lg font-bold whitespace-nowrap',
                                                        isIncome ? 'text-income' : 'text-expense'
                                                    )}>
                                                        {isIncome ? '+' : '-'}¥{formatAmount(tx.amount)}
                                                    </p>
                                                </div>
                                            </button>

                                            {/* 削除ボタン - 右端に配置 */}
                                            {onTransactionDelete && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onTransactionDelete(tx);
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors z-10"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* セーフエリア */}
                        <div className="safe-area-bottom" />
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

export default DateTransactionsSheet;
