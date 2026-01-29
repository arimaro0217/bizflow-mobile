// =============================================================================
// CalendarContainer - カレンダー/リスト表示の統合コンテナ
// =============================================================================
// 【設計意図】
// - SmartCalendar と TransactionList の表示モードを切り替え
// - ViewToggle で iOS風の滑らかな切り替えUI
// - AnimatePresence でクロスフェード遷移
// =============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, List, TrendingUp, TrendingDown } from 'lucide-react';
import { ViewToggle } from '../../components/ui/ViewToggle';
import { SmartCalendar } from '../calendar/components/SmartCalendar';
import { TransactionList } from '../calendar/TransactionList';
import type { Project, Transaction, Client } from '../../types';
import Decimal from 'decimal.js';

// =============================================================================
// 型定義
// =============================================================================

type ViewMode = 'calendar' | 'list';

interface CalendarContainerProps {
    projects: Project[];
    transactions: Transaction[];
    clients: Client[];
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
    clients: _clients, // 将来の拡張用に型定義を残す
    onDateClick,
    onProjectClick,
    onTransactionClick,
}: CalendarContainerProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('calendar');

    // サマリー計算
    const summary = transactions.reduce(
        (acc, tx) => {
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

    const viewOptions = [
        { label: 'カレンダー', value: 'calendar', icon: <CalendarIcon className="w-4 h-4" /> },
        { label: 'リスト', value: 'list', icon: <List className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-4">
            {/* ヘッダー: タイトル + 切り替えスイッチ */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary-400" />
                        業務カレンダー
                    </h2>
                    <p className="text-xs text-gray-500">案件と資金繰りを可視化</p>
                </div>

                {/* 表示切替スイッチ */}
                <ViewToggle
                    options={viewOptions}
                    value={viewMode}
                    onChange={(v) => setViewMode(v as ViewMode)}
                    className="w-full sm:w-auto sm:min-w-[240px]"
                />
            </div>

            {/* ミニサマリー */}
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
                {viewMode === 'calendar' ? (
                    <motion.div
                        key="calendar"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <SmartCalendar
                            projects={projects}
                            transactions={transactions}
                            onDateClick={onDateClick}
                            onProjectClick={onProjectClick}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="bg-surface rounded-2xl overflow-hidden">
                            <TransactionList
                                transactions={transactions}
                                onEdit={onTransactionClick}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default CalendarContainer;
