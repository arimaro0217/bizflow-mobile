// =============================================================================
// DraggableProjectBar - ドラッグ可能な案件バーコンポーネント
// =============================================================================
// 【設計意図】
// - dnd-kitのuseDraggableを使用
// - 長押し（Long Press）でドラッグ開始判定
// - ドラッグ中は半透明のゴースト表示
// - ハプティクスフィードバック対応
// =============================================================================
// 【dnd-kit親コンポーネント設定】
// SmartCalendar（または親）に以下の設定が必要:
//
// import { 
//   DndContext, 
//   MouseSensor, 
//   TouchSensor, 
//   useSensor, 
//   useSensors,
//   DragOverlay
// } from '@dnd-kit/core';
//
// const mouseSensor = useSensor(MouseSensor, {
//   activationConstraint: { distance: 10 }
// });
// 
// const touchSensor = useSensor(TouchSensor, {
//   activationConstraint: { delay: 250, tolerance: 5 }  // スマホ用: 250ms長押し
// });
//
// const sensors = useSensors(mouseSensor, touchSensor);
//
// <DndContext 
//   sensors={sensors} 
//   onDragStart={handleDragStart}
//   onDragEnd={handleDragEnd}
// >
//   {/* カレンダーコンテンツ */}
//   <DragOverlay>
//     {activeProject && <DraggableProjectBar project={activeProject} isDragging />}
//   </DragOverlay>
// </DndContext>
// =============================================================================

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../../lib/utils';
import type { Project } from '../../../types';

// =============================================================================
// 型定義
// =============================================================================

interface DraggableProjectBarProps {
    project: Project;
    visualRowIndex: number;
    isStart: boolean;
    isEnd: boolean;
    isDragging?: boolean;  // DragOverlay用
    onClick?: () => void;
}

// =============================================================================
// カラーマッピング
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

export function DraggableProjectBar({
    project,
    visualRowIndex,
    isStart,
    isEnd,
    isDragging = false,
    onClick,
}: DraggableProjectBarProps) {
    // -------------------------------------------------------------------------
    // dnd-kit: useDraggable
    // -------------------------------------------------------------------------
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging: isCurrentlyDragging,
    } = useDraggable({
        id: `project-${project.id}`,
        data: {
            type: 'project',
            project,
        },
    });

    // -------------------------------------------------------------------------
    // スタイル計算
    // -------------------------------------------------------------------------
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

    // ドラッグ中のトランスフォーム
    const style = {
        transform: CSS.Translate.toString(transform),
        top: `${visualRowIndex * 18}px`,
    };

    // ドラッグ中は元の位置に薄いプレースホルダーを残す
    const placeholderOpacity = isCurrentlyDragging ? 'opacity-30' : '';

    return (
        <button
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            className={cn(
                'absolute left-0 right-0 h-4 text-[10px] font-medium truncate px-1 shadow-sm border-t',
                'cursor-grab active:cursor-grabbing touch-none',
                colors.bg,
                colors.text,
                colors.border,
                roundedClass,
                marginClass,
                placeholderOpacity,
                isDragging && 'shadow-lg scale-105 z-50',
                'hover:brightness-110 transition-all'
            )}
            style={style}
        >
            {isStart && project.title}
        </button>
    );
}

// =============================================================================
// DragOverlay用コンポーネント（ドラッグ中のゴースト表示）
// =============================================================================

interface DragOverlayBarProps {
    project: Project;
}

export function DragOverlayBar({ project }: DragOverlayBarProps) {
    const colors = PROJECT_COLORS[project.color] || PROJECT_COLORS.blue;

    return (
        <div
            className={cn(
                'h-4 text-[10px] font-medium truncate px-2 shadow-lg border-t rounded-md',
                'opacity-90 pointer-events-none min-w-[100px]',
                colors.bg,
                colors.text,
                colors.border
            )}
        >
            {project.title}
        </div>
    );
}

export default DraggableProjectBar;
