// =============================================================================
// ProjectPLCard - 案件損益ダッシュボードUI
// =============================================================================
// 【設計意図】
// - 案件の損益状況を一目で把握できるカード
// - 粗利率による健全性インジケータ
// - 経費内訳リストの展開表示
// =============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, TrendingUp, TrendingDown, Receipt, CircleDollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '../../../lib/utils';
import {
    useProjectFinancials,
    getHealthStatus,
    getHealthStatusColors,
    type ProjectFinancials,
} from '../hooks/useProjectFinancials';
import { formatCurrency } from '../../../utils/currencyMath';
import type { Project, Transaction } from '../../../types';

// =============================================================================
// 型定義
// =============================================================================

interface ProjectPLCardProps {
    project: Project;
    transactions: Transaction[];
    compact?: boolean;  // コンパクト表示モード
}

// =============================================================================
// メインコンポーネント
// =============================================================================

export function ProjectPLCard({ project, transactions, compact = false }: ProjectPLCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // PL計算
    const financials = useProjectFinancials(project, transactions);

    // 健全性判定
    const healthStatus = getHealthStatus(financials.profitMargin);
    const healthColors = getHealthStatusColors(healthStatus);

    if (compact) {
        return <CompactPLCard financials={financials} healthColors={healthColors} />;
    }

    return (
        <div className="bg-surface rounded-2xl overflow-hidden">
            {/* ヘッダー */}
            <div className="px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4" />
                    損益サマリー
                </h3>
            </div>

            {/* PL Summary: 3カラム */}
            <div className="grid grid-cols-3 divide-x divide-white/5">
                {/* 売上 */}
                <div className="p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">売上</p>
                    <p className="text-lg font-semibold text-income">
                        {formatCurrency(financials.totalIncome, { compact: true })}
                    </p>
                </div>

                {/* 経費 */}
                <div className="p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">経費</p>
                    <p className="text-lg font-semibold text-expense">
                        {formatCurrency(financials.totalExpense, { compact: true })}
                    </p>
                </div>

                {/* 粗利 */}
                <div className="p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">粗利</p>
                    <p className={cn(
                        'text-lg font-semibold',
                        financials.isDeficit ? 'text-red-500' : 'text-white'
                    )}>
                        {formatCurrency(financials.grossProfit, { compact: true, showSign: true })}
                    </p>
                </div>
            </div>

            {/* 粗利率バッジ */}
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {financials.isDeficit ? (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                    ) : (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-sm text-gray-400">
                        粗利率
                    </span>
                </div>
                <span className={cn(
                    'px-2 py-1 rounded-md text-sm font-medium',
                    healthColors.bg,
                    healthColors.text
                )}>
                    {financials.profitMargin.toFixed(1)}%
                </span>
            </div>

            {/* 経費内訳（展開可能） */}
            {financials.expenseTransactions.length > 0 && (
                <div className="border-t border-white/5">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-400 hover:bg-surface-light transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <Receipt className="w-4 h-4" />
                            経費内訳（{financials.expenseTransactions.length}件）
                        </span>
                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown className="w-4 h-4" />
                        </motion.div>
                    </button>

                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="px-4 pb-4 space-y-2">
                                    {financials.expenseTransactions.map(tx => (
                                        <ExpenseItem key={tx.id} transaction={tx} />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* 経費がない場合 */}
            {financials.expenseTransactions.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-500 text-sm border-t border-white/5">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    経費が登録されていません
                </div>
            )}
        </div>
    );
}

// =============================================================================
// サブコンポーネント
// =============================================================================

/** コンパクト表示（リスト用） */
interface CompactPLCardProps {
    financials: ProjectFinancials;
    healthColors: { bg: string; text: string };
}

function CompactPLCard({ financials, healthColors }: CompactPLCardProps) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <span className={cn(
                    'text-sm font-medium',
                    financials.isDeficit ? 'text-red-500' : 'text-white'
                )}>
                    {formatCurrency(financials.grossProfit, { compact: true })}
                </span>
                <span className={cn(
                    'px-1.5 py-0.5 rounded text-xs font-medium',
                    healthColors.bg,
                    healthColors.text
                )}>
                    {financials.profitMargin.toFixed(0)}%
                </span>
            </div>
        </div>
    );
}

/** 経費アイテム */
interface ExpenseItemProps {
    transaction: Transaction;
}

function ExpenseItem({ transaction }: ExpenseItemProps) {
    const formattedDate = transaction.transactionDate
        ? format(transaction.transactionDate, 'M/d', { locale: ja })
        : '-';

    return (
        <div className="flex items-center justify-between py-2 px-3 bg-surface-light rounded-lg">
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-gray-500 shrink-0">
                    {formattedDate}
                </span>
                <span className="text-sm text-gray-300 truncate">
                    {transaction.memo || '経費'}
                </span>
            </div>
            <span className="text-sm font-medium text-expense shrink-0">
                {formatCurrency(transaction.amount)}
            </span>
        </div>
    );
}

export default ProjectPLCard;
