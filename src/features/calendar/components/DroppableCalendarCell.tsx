// =============================================================================
// DroppableCalendarCell - ドロップ可能なカレンダーセルコンポーネント
// =============================================================================
// 【設計意図】
// - dnd-kitのuseDroppableを使用
// - ドラッグ中のセルをハイライト表示
// - ドロップ先の日付情報を親に通知
// =============================================================================

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../../lib/utils';

// =============================================================================
// 型定義
// =============================================================================

export interface DroppableCalendarCellProps {
    date: Date;
    dateKey: string;
    children: React.ReactNode;
    className?: string;
    id?: string;
    onClick?: (date: Date) => void;
    onDoubleClick?: (date: Date) => void;
}

export function DroppableCalendarCell({
    date,
    dateKey,
    children,
    className,
    id,
    onClick,
    onDoubleClick,
}: DroppableCalendarCellProps) {
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

    // ドラッグオーバー中のハイライト
    const isValidDrop = active?.data?.current?.type === 'project';
    const highlightClass = isOver && isValidDrop
        ? 'bg-primary-500/10 ring-2 ring-primary-500/50 ring-inset z-10'
        : '';

    return (
        <div
            id={id}
            ref={setNodeRef}
            onClick={() => onClick?.(date)}
            onDoubleClick={() => onDoubleClick?.(date)}
            className={cn(
                'relative', // 親からのスタイルと競合しないよう最低限にするが、SmartCalendar側で制御するため基本はclassNameに任せる
                highlightClass,
                className
            )}
        >
            {children}
        </div>
    );
}

// React.memoでラップ
export default React.memo(DroppableCalendarCell);
