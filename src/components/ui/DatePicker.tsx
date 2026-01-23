import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    isSameMonth,
    addMonths,
    subMonths,
    startOfWeek,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatePickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    value: Date;
    onConfirm: (date: Date) => void;
}

export function DatePicker({ open, onOpenChange, value, onConfirm }: DatePickerProps) {
    const [currentMonth, setCurrentMonth] = useState(value);
    const [selectedDate, setSelectedDate] = useState(value);

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    const days = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const monthDays = eachDayOfInterval({ start, end });

        // 週の始まりまで埋める（月曜始まり）
        const dayOfWeek = start.getDay();
        const startPadding = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const paddedStart = startOfWeek(start, { weekStartsOn: 1 });
        const paddingDays = startPadding > 0
            ? eachDayOfInterval({ start: paddedStart, end: new Date(start.getTime() - 86400000) })
            : [];

        return [...paddingDays, ...monthDays];
    }, [currentMonth]);

    const handleConfirm = () => {
        onConfirm(selectedDate);
        onOpenChange(false);
    };

    const handleCancel = () => {
        setSelectedDate(value);
        setCurrentMonth(value);
        onOpenChange(false);
    };

    // 今日をタップで選択
    const handleToday = () => {
        const today = new Date();
        setSelectedDate(today);
        setCurrentMonth(today);
    };

    if (!open) return null;

    const content = (
        <AnimatePresence>
            {open && (
                <>
                    {/* オーバーレイ */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCancel}
                        className="fixed inset-0 bg-black/50 z-[9998]"
                    />

                    {/* ピッカー本体 */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-surface-dark rounded-t-3xl z-[9999] pb-safe"
                    >
                        {/* ハンドル */}
                        <div className="flex justify-center py-3">
                            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
                        </div>

                        {/* ヘッダー */}
                        <div className="px-6 pb-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-white">日付を選択</h2>
                            <button
                                onClick={handleToday}
                                className="text-sm text-primary-400 hover:text-primary-300"
                            >
                                今日
                            </button>
                        </div>

                        {/* 月ナビゲーション */}
                        <div className="px-6 pb-4 flex items-center justify-between">
                            <button
                                onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                                className="p-2 rounded-full hover:bg-surface-light transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-400" />
                            </button>
                            <span className="text-lg font-medium text-white">
                                {format(currentMonth, 'yyyy年M月', { locale: ja })}
                            </span>
                            <button
                                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                                className="p-2 rounded-full hover:bg-surface-light transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* 曜日ヘッダー */}
                        <div className="px-6 grid grid-cols-7 gap-1 mb-2">
                            {weekDays.map((day, i) => (
                                <div
                                    key={day}
                                    className={cn(
                                        'text-center text-xs font-medium py-1',
                                        i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-gray-500'
                                    )}
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* 日付グリッド */}
                        <div className="px-6 pb-4 grid grid-cols-7 gap-1">
                            {days.map((day, index) => {
                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                const isSelected = isSameDay(day, selectedDate);
                                const isToday = isSameDay(day, new Date());
                                const dayOfWeek = day.getDay();
                                const isSaturday = dayOfWeek === 6;
                                const isSunday = dayOfWeek === 0;

                                return (
                                    <motion.button
                                        key={index}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setSelectedDate(day)}
                                        className={cn(
                                            'aspect-square rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                                            !isCurrentMonth && 'opacity-30',
                                            isSelected
                                                ? 'bg-primary-500 text-white'
                                                : isToday
                                                    ? 'bg-primary-500/20 text-primary-400'
                                                    : isSaturday
                                                        ? 'text-blue-400 hover:bg-surface-light'
                                                        : isSunday
                                                            ? 'text-red-400 hover:bg-surface-light'
                                                            : 'text-white hover:bg-surface-light'
                                        )}
                                    >
                                        {format(day, 'd')}
                                    </motion.button>
                                );
                            })}
                        </div>

                        {/* 選択中の日付表示 */}
                        <div className="px-6 pb-4">
                            <div className="bg-surface rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-sm mb-1">選択中</p>
                                <p className="text-white text-xl font-semibold">
                                    {format(selectedDate, 'yyyy年M月d日 (E)', { locale: ja })}
                                </p>
                            </div>
                        </div>

                        {/* ボタン */}
                        <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                            <button
                                onClick={handleCancel}
                                className="h-12 rounded-xl bg-surface-light text-gray-400 flex items-center justify-center gap-2 font-medium hover:bg-surface transition-colors"
                            >
                                <X className="w-5 h-5" />
                                キャンセル
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="h-12 rounded-xl bg-primary-500 text-white flex items-center justify-center gap-2 font-medium hover:bg-primary-600 transition-colors"
                            >
                                <Check className="w-5 h-5" />
                                決定
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(content, document.body);
}

export default DatePicker;
