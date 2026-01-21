import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import {
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
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

interface CalendarProps {
    transactions?: {
        date: Date;
        type: 'income' | 'expense';
        amount?: number; // 金額表示用に追加
    }[];
}

export function Calendar({ transactions = [] }: CalendarProps) {
    const { selectedDate, setSelectedDate, calendarView, setCalendarView } = useAppStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [direction, setDirection] = useState(0);

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    const days = useMemo(() => {
        if (calendarView === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 0 });
            const end = endOfWeek(currentDate, { weekStartsOn: 0 });
            return eachDayOfInterval({ start, end });
        } else {
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);
            const monthDays = eachDayOfInterval({ start, end });

            // 週の始まりまで埋める
            const startPadding = start.getDay();
            const paddedStart = startOfWeek(start, { weekStartsOn: 0 });
            const paddingDays = startPadding > 0
                ? eachDayOfInterval({ start: paddedStart, end: new Date(start.getTime() - 86400000) })
                : [];

            return [...paddingDays, ...monthDays];
        }
    }, [currentDate, calendarView]);

    const navigate = (direction: number) => {
        setDirection(direction);
        if (calendarView === 'week') {
            setCurrentDate(prev => direction > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1));
        } else {
            setCurrentDate(prev => direction > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
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
                            index === 0 ? 'text-expense' : index === 6 ? 'text-income' : 'text-gray-400'
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
                                    onClick={() => setSelectedDate(day)}
                                    className={cn(
                                        'relative flex flex-col items-center justify-start py-2 rounded-xl md:rounded-none transition-all overflow-hidden',
                                        // Mobile Styles
                                        calendarView === 'week' ? 'h-16' : 'h-12',
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

                                    {/* Mobile: Dots */}
                                    {(hasIncome || hasExpense) && (
                                        <div className="flex gap-0.5 mt-1 md:hidden">
                                            {hasIncome && (
                                                <span className={cn(
                                                    'w-1.5 h-1.5 rounded-full',
                                                    isSelected ? 'bg-white/70' : 'bg-income'
                                                )} />
                                            )}
                                            {hasExpense && (
                                                <span className={cn(
                                                    'w-1.5 h-1.5 rounded-full',
                                                    isSelected ? 'bg-white/70' : 'bg-expense'
                                                )} />
                                            )}
                                        </div>
                                    )}

                                    {/* Desktop: Details */}
                                    <div className="hidden md:flex flex-col w-full px-1 gap-0.5 mt-auto mb-1">
                                        {/* Mock Amount display for demo - In real app, format currency */}
                                        {hasIncome && (
                                            <div className="text-[10px] text-income bg-income/10 px-1 py-0.5 rounded truncate w-full text-left">
                                                +{incomeTotal > 0 ? incomeTotal.toLocaleString() : '¥50,000'}
                                            </div>
                                        )}
                                        {hasExpense && (
                                            <div className="text-[10px] text-expense bg-expense/10 px-1 py-0.5 rounded truncate w-full text-left">
                                                -{expenseTotal > 0 ? expenseTotal.toLocaleString() : '¥20,000'}
                                            </div>
                                        )}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

export default Calendar;
