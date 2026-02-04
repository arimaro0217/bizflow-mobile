import React from 'react';
import { format } from 'date-fns';
import { cn } from '../../../lib/utils';
import type { Project } from '../../../types';
import type { CalendarDay, RenderableEvent, DailyTransactionSummary } from '../types';
import DroppableCalendarCell from './DroppableCalendarCell';
import DraggableProjectBar from './DraggableProjectBar';

// =============================================================================
// 型定義
// =============================================================================

interface CalendarDayCellProps {
    day: CalendarDay;
    events: RenderableEvent[];
    txSummary: DailyTransactionSummary | undefined;
    displayRowCount: number;
    viewMode: 'month' | 'week';
    isSelected?: boolean;
    onDateClick?: (date: Date) => void;
    onDateDoubleClick?: (date: Date) => void;
    onProjectClick?: (project: Project) => void;
    onResizeStart: (project: Project, e: React.PointerEvent) => void;
}

// =============================================================================
// メインコンポーネント (メモ化)
// =============================================================================

const CalendarDayCell = React.memo(function CalendarDayCell({
    day,
    events,
    txSummary,
    displayRowCount,
    viewMode,
    isSelected = false,
    onDateClick,
    onDateDoubleClick,
    onProjectClick,
    onResizeStart
}: CalendarDayCellProps) {
    const dayOfWeek = day.date.getDay();
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;

    return (
        <DroppableCalendarCell
            date={day.date}
            dateKey={day.dateKey}
            className={cn(
                'border-b border-r border-white/5 relative cursor-pointer transition-colors',
                !day.isCurrentMonth && 'opacity-40',
                viewMode === 'week' ? 'min-h-[140px]' : 'min-h-[90px] md:min-h-[110px]',
                isSelected
                    ? 'bg-primary-500/15 ring-2 ring-primary-500/50 ring-inset'
                    : 'hover:bg-surface-light/30'
            )}
            onClick={onDateClick}
            onDoubleClick={onDateDoubleClick}
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
                style={{ height: `${displayRowCount * 20}px` }}
            >
                {events
                    .filter(e => !e.isOverflow)
                    .map((event, idx) => (
                        <DraggableProjectBar
                            key={`${event.project.id}-${idx}`}
                            project={event.project}
                            visualRowIndex={event.visualRowIndex}
                            isStart={event.isStart}
                            isEnd={event.isEnd}
                            onClick={() => onProjectClick?.(event.project)}
                            onResizeStart={(e) => onResizeStart(event.project, e)}
                        />
                    ))}

                {/* オーバーフロー表示: 表示しきれない案件がある場合 */}
                {(() => {
                    const overflowCount = events.filter(e => e.isOverflow && e.isStart).length;
                    if (overflowCount > 0) {
                        return (
                            <div
                                className="absolute bottom-0 left-0 right-0 text-center text-[8px] text-gray-400 font-medium cursor-pointer hover:text-gray-300"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // 将来的にはポップオーバーで全件表示など
                                }}
                            >
                                +{overflowCount}件
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            {/* Zone C: 資金繰りドット（セル最下部） */}
            {txSummary && (txSummary.income > 0 || txSummary.expense > 0) && (
                <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1.5 px-1 pointer-events-none">
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
        </DroppableCalendarCell>
    );
}, (prev, next) => {
    // カスタム比較関数によるパフォーマンス最適化
    return (
        prev.day.dateKey === next.day.dateKey &&
        prev.day.isCurrentMonth === next.day.isCurrentMonth &&
        prev.day.isToday === next.day.isToday &&
        prev.viewMode === next.viewMode &&
        prev.displayRowCount === next.displayRowCount &&
        prev.isSelected === next.isSelected &&
        prev.events === next.events &&
        prev.txSummary === next.txSummary &&
        prev.onDateClick === next.onDateClick &&
        prev.onDateDoubleClick === next.onDateDoubleClick &&
        prev.onProjectClick === next.onProjectClick &&
        prev.onResizeStart === next.onResizeStart
    );
});

export default CalendarDayCell;
