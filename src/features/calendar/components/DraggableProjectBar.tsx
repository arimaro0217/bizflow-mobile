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
import { type Project, PROJECT_COLORS } from '../../../types';

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
    onResizeStart?: (e: React.PointerEvent) => void;
}

// =============================================================================
// カラーマッピング
// =============================================================================

// PROJECT_COLORSはtypesへ移動済み

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
    onResizeStart,
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

    // -------------------------------------------------------------------------
    // リサイズ処理 (簡易実装: 右端ドラッグ)
    // -------------------------------------------------------------------------
    // ※ 本格的なリサイズはdnd-kitのmodifiers等が必要だが、
    // ここではシンプルに「ハンドル掴んでドラッグ」を独自に実装するか、
    // または親側で制御するか。
    // dnd-kitのDraggableと競合しないよう、ハンドル部分でのpointerDownで
    // dnd-kitのドラッグをキャンセル（stopPropagation）する必要がある。

    // しかし、useDraggableのリスナー（attributes/listeners）がボタン全体に付与されているため、
    // 子要素でのイベント阻止が少し難しい。
    // そのため、Activator（ドラッグ開始トリガー）を制限するのが正攻法だが、
    // ここでは「ハンドル部分は別コンポーネントとして分離」せずに、
    // ハンドル部分でのイベントを捕捉して、親のドラッグを無効化する。

    // ...一旦、UIのみ追加し、機能実装はSmartCalendar側との連携も含めて検討が必要。
    // 今回は「SmartCalendarでの実装計画」に基づき、
    // ハンドルを表示し、それをドラッグした際の処理をここに追加する。

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'absolute left-0 right-0 h-4 px-1 shadow-sm border-t group select-none',
                'touch-none', // iOSでのスクロール防止等
                colors.bg,
                colors.text,
                colors.border,
                roundedClass,
                marginClass,
                placeholderOpacity,
                isDragging && 'shadow-lg scale-105 z-50',
                !isDragging && 'hover:brightness-110 transition-all'
            )}
            {...attributes}
            {...listeners}
            onClick={(e) => {
                e.stopPropagation();
                if (!isDragging) onClick?.();
            }}
        >
            <div className="flex items-center w-full h-full overflow-hidden">
                <span className="text-[10px] font-medium truncate leading-none">
                    {isStart && project.title}
                </span>
            </div>

            {/* リサイズハンドル (右端) */}
            {isEnd && !isDragging && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10 z-20"
                    onPointerDown={(e) => {
                        // dnd-kitのドラッグを阻止
                        e.stopPropagation();
                        e.preventDefault();
                        onResizeStart?.(e);
                    }}
                >
                    <div className="w-0.5 h-2 bg-white/50 rounded-full" />
                </div>
            )}
        </div>
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
