import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import {
    format,
    isSameDay,
    isSameMonth,
    addWeeks,
    subWeeks,
    addMonths,
    subMonths,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../stores/appStore';
import { DateTransactionsSheet } from './components/DateTransactionsSheet';
import { filterTransactionsByDate } from '../../lib/transactionHelpers';
import { useCalendarGrid } from './hooks/useCalendarGrid';
import type { Transaction, Client } from '../../types';

// カレンダー表示用の軽量データ
interface CalendarTransaction {
    date: Date;
    type: 'income' | 'expense';
    amount?: number;
}

interface CalendarProps {
    /** カレンダー表示用の軽量データ */
    transactions?: CalendarTransaction[];
    /** ポップアップ表示用の完全なTransaction配列 */
    fullTransactions?: Transaction[];
    /** 取引先一覧（ポップアップ表示用） */
    clients?: Client[];
    /** 取引クリック時のコールバック */
    onTransactionClick?: (transaction: Transaction) => void;
    /** 日付クリック時のコールバック */
    onDateClick?: (date: Date) => void;
    onDateDoubleClick?: (date: Date) => void;
    onTransactionDelete?: (transaction: Transaction) => void;
    /** 日付詳細ポップアップの管理用（リフティング） */
    openDetailSheet?: boolean;
    detailDate?: Date | null;
    detailTransactions?: Transaction[];
    onDetailOpenChange?: (open: boolean) => void;
}

export function Calendar({
    transactions = [],
    fullTransactions = [],
    clients = [],
    onTransactionClick,
    onDateClick,
    onDateDoubleClick,
    onTransactionDelete,
    openDetailSheet = false,
    detailDate = null,
    detailTransactions = [],
    onDetailOpenChange,
}: CalendarProps) {
    const { selectedDate, setSelectedDate, calendarView, setCalendarView, viewMode, currentMonth, setCurrentMonth } = useAppStore();
    // currentMonth をローカル名 currentDate として扱う（既存ロジック維持のため）
    const currentDate = currentMonth;
    const [direction, setDirection] = useState(0);

    // ↓ Dashboardに引き上げ（削除）

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    const days = useCalendarGrid(currentDate, calendarView);

    const navigate = (direction: number) => {
        setDirection(direction);
        if (calendarView === 'week') {
            setCurrentMonth(direction > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        } else {
            setCurrentMonth(direction > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        }
    };

    const bind = useDrag(
        ({ direction: [xDir], velocity: [vx], active }) => {
            if (!active && Math.abs(vx) > 0.3) {
                navigate(xDir > 0 ? -1 : 1);
            }
        },
        { axis: 'x', filterTaps: true }
    );
    // ダブルタップ検出用のref
    const lastTapRef = useRef<{ date: string; time: number } | null>(null);
    const DOUBLE_TAP_DELAY = 300; // ミリ秒

    // 日付をクリックした時の処理（選択済みの日の場合はポップアップを表示）
    const handleDateClick = (day: Date, isDblClick: boolean = false) => {
        const now = Date.now();
        const dateKey = day.toISOString();
        const lastTap = lastTapRef.current;

        // すでに選択されている日付を再度タップしたか、またはダブルタップの場合にポップアップを表示
        // PCのダブルクリックイベント(isDblClick)の場合は無条件でPopupを開く
        const isSelectedTap = selectedDate && isSameDay(day, selectedDate);
        const isManualDoubleTap = lastTap && lastTap.date === dateKey && (now - lastTap.time) < DOUBLE_TAP_DELAY;

        // 常に日付を選択し、親にも通知
        setSelectedDate(day);
        onDateClick?.(day);

        if (isDblClick || isSelectedTap || isManualDoubleTap) {
            // ポップアップを表示
            if (!isDblClick) {
                lastTapRef.current = null; // 手動検知の場合はリセット
            }

            // その日のトランザクションを取得
            const dayTxs = filterTransactionsByDate(fullTransactions, day, viewMode);

            // 取引がある場合のみシートを開く
            if (dayTxs.length > 0) {
                // Dashboard側に通知
                onDetailOpenChange?.(true);
                // Dashboard側でこれらが更新されるように、Dashboardに handleDateClick で渡すか、
                // あるいは Dashboard側でも計算し直す。
                // ここでは Dashboard の onDateClick に任せるのが筋がいい。
                onDateClick?.(day);
            } else {
                // 取引がない場合は登録画面へ
                onDateDoubleClick?.(day);
            }
        } else {
            // 次のタップを待つ
            lastTapRef.current = { date: dateKey, time: now };
        }
    };

    // シート内の取引をクリックした時
    const handleTransactionClick = (tx: Transaction) => {
        onDetailOpenChange?.(false);
        onTransactionClick?.(tx);
    };

    const getDayData = (date: Date) => {
        const dayTransactions = transactions.filter(t => isSameDay(t.date, date));
        const hasIncome = dayTransactions.some(t => t.type === 'income');
        const hasExpense = dayTransactions.some(t => t.type === 'expense');

        // 合計金額の計算（デモ用簡略化）
        // 実際にはtransactionsにamountが含まれている前提
        const incomeTotal = dayTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        const expenseTotal = dayTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        return { hasIncome, hasExpense, incomeTotal, expenseTotal };
    };

    return (
        <div className="bg-surface rounded-2xl p-4 md:p-6 md:border md:border-white/5">
            {/* ヘッダー */}
            {/* ヘッダー */}
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 md:mb-6 gap-4">
                {/* 以前のナビゲーション（タイトル含む） */}
                <div className="flex items-center justify-between w-full md:w-auto md:gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-surface-light rounded-xl transition-colors text-white"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <span className="text-white font-semibold text-lg md:text-xl">
                        {format(currentDate, 'yyyy年M月', { locale: ja })}
                    </span>

                    <button
                        onClick={() => navigate(1)}
                        className="p-2 hover:bg-surface-light rounded-xl transition-colors text-white"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* 表示切替（セグメントコントロール） */}
                <div className="flex p-1 bg-surface-light/50 rounded-lg w-full md:w-auto">
                    <button
                        onClick={() => setCalendarView('week')}
                        className={cn(
                            "flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md transition-all",
                            calendarView === 'week'
                                ? "bg-primary-500 text-white shadow-sm"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        週
                    </button>
                    <button
                        onClick={() => setCalendarView('month')}
                        className={cn(
                            "flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md transition-all",
                            calendarView === 'month'
                                ? "bg-primary-500 text-white shadow-sm"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        月
                    </button>
                </div>
            </div>

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 mb-2 border-b border-white/5 pb-2">
                {weekDays.map((day, index) => (
                    <div
                        key={day}
                        className={cn(
                            'text-center text-xs md:text-sm font-medium py-1',
                            index === 5 ? 'text-income' : index === 6 ? 'text-expense' : 'text-gray-400'
                        )}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* カレンダー本体 */}
            <div {...bind()} className="touch-pan-y">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={currentDate.toISOString()}
                        initial={{ x: direction * 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: direction * -50, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                            'grid grid-cols-7',
                            calendarView === 'month' ? 'gap-1 md:gap-px md:bg-white/5' : 'gap-0'
                        )}
                    >
                        {days.map((day) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const { hasIncome, hasExpense, incomeTotal, expenseTotal } = getDayData(day);

                            return (
                                <motion.button
                                    key={day.toISOString()}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleDateClick(day)}
                                    onDoubleClick={() => handleDateClick(day, true)}
                                    className={cn(
                                        'relative flex flex-col items-center justify-start py-2 rounded-xl md:rounded-none transition-all overflow-hidden',
                                        // Mobile Styles
                                        calendarView === 'week' ? 'min-h-[72px]' : 'min-h-[64px]',
                                        // Desktop Styles: Expand height and add background
                                        'md:min-h-[120px] md:bg-surface-dark md:hover:bg-surface-light',
                                        isSelected
                                            ? 'bg-primary-600 text-white md:bg-primary-600/20 md:ring-2 md:ring-inset md:ring-primary-500'
                                            : isToday
                                                ? 'bg-primary-600/20 text-primary-400'
                                                : isCurrentMonth
                                                    ? 'text-white hover:bg-surface-light'
                                                    : 'text-gray-600 bg-transparent' // PC: Darken opacity handled by gap logic
                                    )}
                                >
                                    {/* Date Number */}
                                    <span className={cn(
                                        'text-sm font-medium mb-1',
                                        day.getDay() === 0 && !isSelected && 'text-expense',
                                        day.getDay() === 6 && !isSelected && 'text-income',
                                        // PC: Align right or distinct placement
                                        'md:self-end md:mr-2 md:mt-1'
                                    )}>
                                        {format(day, 'd')}
                                    </span>


                                    {/* Mobile: Amount display - 常に2行で表示 */}
                                    <div className="flex flex-col items-center gap-0 mt-0.5 md:hidden pointer-events-none">
                                        {/* 収入行（上） */}
                                        <span className={cn(
                                            'text-[9px] font-medium leading-tight',
                                            isSelected ? 'text-white/80' : incomeTotal > 0 ? 'text-income' : 'text-gray-600'
                                        )}>
                                            {incomeTotal > 0
                                                ? `+${incomeTotal >= 10000
                                                    ? `${Math.floor(incomeTotal / 10000)}万`
                                                    : incomeTotal.toLocaleString()}`
                                                : '-'}
                                        </span>
                                        {/* 支出行（下） */}
                                        <span className={cn(
                                            'text-[9px] font-medium leading-tight',
                                            isSelected ? 'text-white/80' : expenseTotal > 0 ? 'text-expense' : 'text-gray-600'
                                        )}>
                                            {expenseTotal > 0
                                                ? `-${expenseTotal >= 10000
                                                    ? `${Math.floor(expenseTotal / 10000)}万`
                                                    : expenseTotal.toLocaleString()}`
                                                : '-'}
                                        </span>
                                    </div>

                                    {/* Desktop: Details */}
                                    <div className="hidden md:flex flex-col w-full px-1 gap-0.5 mt-auto mb-1 pointer-events-none">
                                        {hasIncome && (
                                            <div className="text-[10px] text-income bg-income/10 px-1 py-0.5 rounded truncate w-full text-left">
                                                +{incomeTotal.toLocaleString()}
                                            </div>
                                        )}
                                        {hasExpense && (
                                            <div className="text-[10px] text-expense bg-expense/10 px-1 py-0.5 rounded truncate w-full text-left">
                                                -{expenseTotal.toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* 日付詳細シート */}
            <DateTransactionsSheet
                open={openDetailSheet}
                onOpenChange={(open) => onDetailOpenChange?.(open)}
                date={detailDate}
                transactions={detailTransactions}
                clients={clients}
                onTransactionClick={handleTransactionClick}
                onTransactionDelete={(tx) => {
                    onDetailOpenChange?.(false);
                    onTransactionDelete?.(tx);
                }}
            />
        </div>
    );
}

export default Calendar;
