// =============================================================================
// DroppableCalendarCell - ドロップ可能なカレンダーセルコンポーネント
// =============================================================================
// 【設計意図】
// - dnd-kitのuseDroppableを使用
// - ドラッグ中のセルをハイライト表示
// - ドロップ先の日付情報を親に通知
// =============================================================================

import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { cn } from '../../../lib/utils';

// =============================================================================
// 型定義
// =============================================================================

interface DroppableCalendarCellProps {
    date: Date;
    dateKey: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    children: React.ReactNode;
    onClick?: (date: Date) => void;
}

// =============================================================================
// メインコンポーネント
// =============================================================================

export function DroppableCalendarCell({
    date,
    dateKey,
    isCurrentMonth,
    isToday,
    children,
    onClick,
}: DroppableCalendarCellProps) {
    // -------------------------------------------------------------------------
    // dnd-kit: useDroppable
    // -------------------------------------------------------------------------
    const {
        setNodeRef,
        isOver,
        active,
    } = useDroppable({
        id: `cell-${dateKey}`,
        data: {
            type: 'calendar-cell',
            date,
            dateKey,
        },
    });

    // -------------------------------------------------------------------------
    // スタイル計算
    // -------------------------------------------------------------------------
    const dayOfWeek = date.getDay();
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;

    // ドラッグオーバー中のハイライト
    const isValidDrop = active?.data?.current?.type === 'project';
    const highlightClass = isOver && isValidDrop
        ? 'bg-primary-500/20 ring-2 ring-primary-400 ring-inset'
        : '';

    return (
        <div
            ref={setNodeRef}
            onClick={() => onClick?.(date)}
            className={cn(
                'min-h-[80px] md:min-h-[100px] border-b border-r border-white/5 relative cursor-pointer',
                'hover:bg-surface-light/50 transition-colors',
                !isCurrentMonth && 'opacity-40',
                highlightClass
            )}
        >
            {/* Zone A: 日付ヘッダー */}
            <div className="p-1">
                <span
                    className={cn(
                        'inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full',
                        isToday
                            ? 'bg-primary-500 text-white'
                            : isSaturday
                                ? 'text-blue-400'
                                : isSunday
                                    ? 'text-red-400'
                                    : 'text-gray-300'
                    )}
                >
                    {format(date, 'd')}
                </span>
            </div>

            {/* Zone B & C: 子要素（案件バー + 資金繰りドット） */}
            {children}
        </div>
    );
}

export default DroppableCalendarCell;
