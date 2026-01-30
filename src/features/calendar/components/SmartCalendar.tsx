// =============================================================================
// SmartCalendar - 業務カレンダーUI（案件バー + 資金繰りドット）
// =============================================================================
// 【設計意図】
// - 7列固定のCSSグリッドレイアウト
// - 3層構造: Zone A (日付), Zone B (案件バー), Zone C (資金繰りドット)
// - 案件バーはセルを跨いで連続表示（ネガティブマージン使用）
// - モバイルファーストで視認性を最優先
// =============================================================================

import { useState } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useCalendarLayout, type RenderableEvent } from '../hooks/useCalendarLayout';
import type { Project, Transaction } from '../../../types';

// =============================================================================
// 型定義
// =============================================================================

interface SmartCalendarProps {
    projects: Project[];
    transactions: Transaction[];
    onDateClick?: (date: Date) => void;
    onProjectClick?: (project: Project) => void;
}

// =============================================================================
// 案件カラーマッピング
// =============================================================================
const PROJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-500/80', text: 'text-white', border: 'border-blue-600' },
    orange: { bg: 'bg-orange-500/80', text: 'text-white', border: 'border-orange-600' },
    green: { bg: 'bg-emerald-500/80', text: 'text-white', border: 'border-emerald-600' },
    purple: { bg: 'bg-purple-500/80', text: 'text-white', border: 'border-purple-600' },
    gray: { bg: 'bg-gray-500/80', text: 'text-white', border: 'border-gray-600' },
};

// =============================================================================
// メインコンポーネント
// =============================================================================

export function SmartCalendar({
    projects,
    transactions,
    onDateClick,
    onProjectClick,
}: SmartCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

    // レイアウト計算（最適化・ViewMode対応）
    const { days, eventsByDate, transactionsByDate, maxRowIndex } = useCalendarLayout(
        currentDate,
        projects,
        transactions,
        viewMode
    );

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    // ナビゲーション
    const handlePrev = () => {
        setCurrentDate(prev => viewMode === 'week' ? subWeeks(prev, 1) : subMonths(prev, 1));
    };

    const handleNext = () => {
        setCurrentDate(prev => viewMode === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1));
    };

    const handleToday = () => setCurrentDate(new Date());

    // 表示用の段数（最低固定、最大3段）
    const displayRowCount = Math.min(Math.max(maxRowIndex + 1, 1), 3);

    return (
        <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-white/5">
            {/* ヘッダー: 月ナビゲーション & 表示切替 */}
            <div className="flex flex-col md:flex-row items-center justify-between px-4 py-4 border-b border-white/5 gap-4">
                {/* ナビゲーション */}
                <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-4">
                    <button
                        onClick={handlePrev}
                        className="p-2 rounded-xl hover:bg-surface-light transition-colors text-white"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-white tracking-wide">
                            {format(currentDate, 'yyyy年M月', { locale: ja })}
                        </h2>
                        <button
                            onClick={handleToday}
                            className="text-xs font-medium text-primary-300 hover:text-primary-200 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 transition-colors"
                        >
                            今日
                        </button>
                    </div>

                    <button
                        onClick={handleNext}
                        className="p-2 rounded-xl hover:bg-surface-light transition-colors text-white"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* 表示切替（セグメントコントロール） */}
                <div className="flex p-1 bg-surface-light/50 rounded-xl w-full md:w-auto">
                    <button
                        onClick={() => setViewMode('week')}
                        className={cn(
                            "flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-lg transition-all",
                            viewMode === 'week'
                                ? "bg-primary-500 text-white shadow-sm"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        週
                    </button>
                    <button
                        onClick={() => setViewMode('month')}
                        className={cn(
                            "flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-lg transition-all",
                            viewMode === 'month'
                                ? "bg-primary-500 text-white shadow-sm"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        月
                    </button>
                </div>
            </div>

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 border-b border-white/5 bg-surface-light/20">
                {weekDays.map((day, i) => (
                    <div
                        key={day}
                        className={cn(
                            'text-center text-xs font-medium py-2',
                            i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-gray-500'
                        )}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* カレンダーグリッド */}
            <div className="grid grid-cols-7 bg-surface-dark">
                <AnimatePresence mode="popLayout" initial={false}>
                    {days.map((day) => {
                        const events = eventsByDate[day.dateKey] || [];
                        const txSummary = transactionsByDate[day.dateKey];
                        const dayOfWeek = day.date.getDay();
                        const isSaturday = dayOfWeek === 6;
                        const isSunday = dayOfWeek === 0;

                        return (
                            <motion.div
                                key={day.dateKey}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => onDateClick?.(day.date)}
                                className={cn(
                                    'border-b border-r border-white/5 relative cursor-pointer hover:bg-surface-light/30 transition-colors',
                                    !day.isCurrentMonth && 'opacity-40',
                                    viewMode === 'week' ? 'min-h-[140px]' : 'min-h-[90px] md:min-h-[110px]'
                                )}
                            >
                                {/* Zone A: 日付ヘッダー */}
                                <div className="p-1.5 flex justify-center md:justify-start">
                                    <span
                                        className={cn(
                                            'inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full transition-all',
                                            day.isToday
                                                ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
                                                : isSaturday
                                                    ? 'text-blue-400'
                                                    : isSunday
                                                        ? 'text-red-400'
                                                        : 'text-gray-400'
                                        )}
                                    >
                                        {format(day.date, 'd')}
                                    </span>
                                </div>

                                {/* Zone B: 案件バーレイヤー */}
                                <div
                                    className="relative mt-1 w-full"
                                    style={{ height: `${displayRowCount * 20}px` }} // 高さを少し広げる
                                >
                                    {events
                                        .filter(e => !e.isOverflow)
                                        .map((event, idx) => (
                                            <ProjectBar
                                                key={`${event.project.id}-${idx}`}
                                                event={event}
                                                onClick={() => onProjectClick?.(event.project)}
                                            />
                                        ))}
                                </div>

                                {/* Zone C: 資金繰りドット（セル最下部） */}
                                {txSummary && (txSummary.income > 0 || txSummary.expense > 0) && (
                                    <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1.5 px-1">
                                        {txSummary.income > 0 && (
                                            <div className="flex items-center gap-0.5 bg-income/10 px-1.5 py-0.5 rounded-full border border-income/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-income" />
                                                <span className="text-[9px] text-income font-medium md:hidden">IN</span>
                                                <span className="text-[9px] text-income font-medium hidden md:inline">
                                                    +{Math.floor(txSummary.income / 10000)}万
                                                </span>
                                            </div>
                                        )}
                                        {txSummary.expense > 0 && (
                                            <div className="flex items-center gap-0.5 bg-expense/10 px-1.5 py-0.5 rounded-full border border-expense/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-expense" />
                                                <span className="text-[9px] text-expense font-medium md:hidden">OUT</span>
                                                <span className="text-[9px] text-expense font-medium hidden md:inline">
                                                    -{Math.floor(txSummary.expense / 10000)}万
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}

// =============================================================================
// 案件バーコンポーネント
// =============================================================================

interface ProjectBarProps {
    event: RenderableEvent;
    onClick?: () => void;
}

function ProjectBar({ event, onClick }: ProjectBarProps) {
    const { project, visualRowIndex, isStart, isEnd } = event;
    const colors = PROJECT_COLORS[project.color] || PROJECT_COLORS.blue;

    // バーの角丸を制御
    const roundedClass = cn(
        isStart && isEnd ? 'rounded-md' : '',
        isStart && !isEnd ? 'rounded-l-md' : '',
        !isStart && isEnd ? 'rounded-r-md' : '',
        !isStart && !isEnd ? '' : ''
    );

    // セルを跨いで繋がっているように見せるネガティブマージン
    const marginClass = cn(
        isStart ? 'ml-0.5' : 'ml-[-1px]',
        isEnd ? 'mr-0.5' : 'mr-[-1px]'
    );

    return (
        <motion.button
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            className={cn(
                'absolute left-0 right-0 h-4 text-[10px] font-medium truncate px-1 shadow-sm border-t',
                colors.bg,
                colors.text,
                colors.border,
                roundedClass,
                marginClass,
                'hover:brightness-110 transition-all'
            )}
            style={{
                top: `${visualRowIndex * 18}px`,
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title={`${project.title}\n日程: ${format(project.startDate || new Date(), 'M/d')} - ${format(project.endDate || new Date(), 'M/d')}\n金額: ¥${Number(project.estimatedAmount).toLocaleString()}`}
        >
            <div className="flex items-center gap-1 overflow-hidden h-full">
                <span className="truncate flex-1 text-left">{isStart && project.title}</span>
                {isStart && (
                    <span className="text-[9px] opacity-90 font-normal flex-shrink-0 bg-black/20 px-1 rounded">
                        ¥{Number(project.estimatedAmount).toLocaleString()}
                    </span>
                )}
            </div>
        </motion.button>
    );
}

export default SmartCalendar;
