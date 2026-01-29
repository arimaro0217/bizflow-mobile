// =============================================================================
// CalendarContainer - 案件管理カレンダー / 資金繰りカレンダーの統合コンテナ
// =============================================================================
// 【設計意図】
// - SmartCalendar（案件管理） と Calendar（資金繰り） の表示モードを切り替え
// - ViewToggle で iOS風の滑らかな切り替えUI
// - AnimatePresence でクロスフェード遷移
// =============================================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { isSameMonth, startOfMonth } from 'date-fns';
import { ViewToggle } from '../../components/ui/ViewToggle';
import { SmartCalendar } from '../calendar/components/SmartCalendar';
import { Calendar } from '../calendar/Calendar';
import type { Project, Transaction, Client } from '../../types';
import Decimal from 'decimal.js';

// =============================================================================
// 型定義
// =============================================================================

type ViewMode = 'project' | 'cashflow';

interface CalendarContainerProps {
    projects: Project[];
    transactions: Transaction[];
    clients: Client[];
    /** カレンダー表示用の軽量データ */
    calendarTransactions?: { date: Date; type: 'income' | 'expense'; amount?: number }[];
    onDateClick?: (date: Date) => void;
    onProjectClick?: (project: Project) => void;
    onTransactionClick?: (transaction: Transaction) => void;
}

// =============================================================================
// メインコンポーネント
// =============================================================================

export function CalendarContainer({
    projects,
    transactions,
    clients,
    calendarTransactions,
    onDateClick,
    onProjectClick,
    onTransactionClick,
}: CalendarContainerProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('cashflow');
    const [currentMonth] = useState(new Date());

    // 今月のサマリー計算（月でフィルタリング）
    const summary = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);

        return transactions.reduce(
            (acc, tx) => {
                // transactionDate が今月かどうかをチェック
                const txDate = tx.transactionDate;
                if (!txDate || !isSameMonth(txDate, monthStart)) {
                    return acc;
                }

                const amount = new Decimal(tx.amount || '0');
                if (tx.type === 'income') {
                    acc.income = acc.income.plus(amount);
                } else {
                    acc.expense = acc.expense.plus(amount);
                }
                return acc;
            },
            { income: new Decimal(0), expense: new Decimal(0) }
        );
    }, [transactions, currentMonth]);

    const viewOptions = [
        { label: '資金繰り', value: 'cashflow', icon: <Wallet className="w-4 h-4" /> },
        { label: '案件管理', value: 'project', icon: <Briefcase className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-4">
            {/* 表示切替スイッチ（上部に配置） */}
            <ViewToggle
                options={viewOptions}
                value={viewMode}
                onChange={(v) => setViewMode(v as ViewMode)}
                className="w-full"
            />

            {/* ミニサマリー（今月のみ） */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-light rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 text-income mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">今月の収入</span>
                    </div>
                    <p className="text-lg font-bold text-white">
                        ¥{summary.income.toNumber().toLocaleString()}
                    </p>
                </div>
                <div className="bg-surface-light rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 text-expense mb-1">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-xs font-medium">今月の支出</span>
                    </div>
                    <p className="text-lg font-bold text-white">
                        ¥{summary.expense.toNumber().toLocaleString()}
                    </p>
                </div>
            </div>

            {/* コンテンツエリア: モード切り替え */}
            <AnimatePresence mode="wait">
                {viewMode === 'cashflow' ? (
                    <motion.div
                        key="cashflow"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Calendar
                            transactions={calendarTransactions}
                            fullTransactions={transactions}
                            clients={clients}
                            onTransactionClick={onTransactionClick}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="project"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <SmartCalendar
                            projects={projects}
                            transactions={transactions}
                            onDateClick={onDateClick}
                            onProjectClick={onProjectClick}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default CalendarContainer;
