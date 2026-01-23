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
import { format, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
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
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // レイアウト計算
    const { days, eventsByDate, transactionsByDate, maxRowIndex } = useCalendarLayout(
        currentMonth,
        projects,
        transactions
    );

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    // 月ナビゲーション
    const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
    const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
    const handleToday = () => setCurrentMonth(new Date());

    // 表示用の段数（最低1段、最大3段）
    const displayRowCount = Math.min(Math.max(maxRowIndex + 1, 1), 3);

    return (
        <div className="bg-surface rounded-2xl overflow-hidden">
            {/* ヘッダー: 月ナビゲーション */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <button
                    onClick={handlePrevMonth}
                    className="p-2 rounded-lg hover:bg-surface-light transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>

                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">
                        {format(currentMonth, 'yyyy年M月', { locale: ja })}
                    </h2>
                    <button
                        onClick={handleToday}
                        className="text-xs text-primary-400 hover:text-primary-300 px-2 py-1 rounded bg-primary-500/10"
                    >
                        今日
                    </button>
                </div>

                <button
                    onClick={handleNextMonth}
                    className="p-2 rounded-lg hover:bg-surface-light transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
            </div>

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 border-b border-white/5">
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
            <div className="grid grid-cols-7">
                {days.map((day) => {
                    const events = eventsByDate[day.dateKey] || [];
                    const txSummary = transactionsByDate[day.dateKey];
                    const dayOfWeek = day.date.getDay();
                    const isSaturday = dayOfWeek === 6;
                    const isSunday = dayOfWeek === 0;

                    return (
                        <div
                            key={day.dateKey}
                            onClick={() => onDateClick?.(day.date)}
                            className={cn(
                                'min-h-[80px] md:min-h-[100px] border-b border-r border-white/5 relative cursor-pointer hover:bg-surface-light/50 transition-colors',
                                !day.isCurrentMonth && 'opacity-40'
                            )}
                        >
                            {/* Zone A: 日付ヘッダー */}
                            <div className="p-1">
                                <span
                                    className={cn(
                                        'inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full',
                                        day.isToday
                                            ? 'bg-primary-500 text-white'
                                            : isSaturday
                                                ? 'text-blue-400'
                                                : isSunday
                                                    ? 'text-red-400'
                                                    : 'text-gray-300'
                                    )}
                                >
                                    {format(day.date, 'd')}
                                </span>
                            </div>

                            {/* Zone B: 案件バーレイヤー */}
                            <div
                                className="relative"
                                style={{ height: `${displayRowCount * 18}px` }}
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
                                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1">
                                    {txSummary.income > 0 && (
                                        <div className="w-2 h-2 rounded-full bg-income" title={`収入: ¥${txSummary.income.toLocaleString()}`} />
                                    )}
                                    {txSummary.expense > 0 && (
                                        <div className="w-2 h-2 rounded-full bg-expense" title={`支出: ¥${txSummary.expense.toLocaleString()}`} />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
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
        >
            {isStart && project.title}
        </motion.button>
    );
}

export default SmartCalendar;
