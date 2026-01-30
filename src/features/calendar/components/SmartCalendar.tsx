// =============================================================================
// SmartCalendar - 業務カレンダーUI（案件バー + 資金繰りドット）
// =============================================================================
// 【設計意図】
// - 7列固定のCSSグリッドレイアウト
// - 3層構造: Zone A (日付), Zone B (案件バー), Zone C (資金繰りドット)
// - 案件バーはセルを跨いで連続表示（ネガティブマージン使用）
// - モバイルファーストで視認性を最優先
// =============================================================================

import React, { useState } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core';
import { differenceInCalendarDays, addDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { useCalendarLayout, type RenderableEvent } from '../hooks/useCalendarLayout';
import type { Project, Transaction } from '../../../types';
import { DraggableProjectBar, DragOverlayBar } from './DraggableProjectBar';
import DroppableCalendarCell from './DroppableCalendarCell';
import { ProjectPopover } from './ProjectPopover';
import { useProjectOperations } from '../../../hooks/useProjectOperations';
import { useAuth } from '../../../features/auth';

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
// 案件カラーマッピングはtypesへ移動済み

// =============================================================================
// メインコンポーネント
// =============================================================================

export function SmartCalendar({
    projects,
    transactions,
    onDateClick,
    onProjectClick,
}: SmartCalendarProps) {
    const { user } = useAuth();
    const { updateProject } = useProjectOperations(user?.uid);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [activeEvent, setActiveEvent] = useState<RenderableEvent | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    // リサイズ用 State & Ref
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [resizingState, setResizingState] = React.useState<{
        project: Project;
        originalEndDate: Date;
        startX: number;
        newEndDate: Date;
    } | null>(null);

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: { distance: 10 },
        }),
        useSensor(TouchSensor, {
            // スマホではスクロールと区別するため、少し長押しで発火
            activationConstraint: { delay: 250, tolerance: 5 },
        })
    );

    // リサイズ中は表示用プロジェクトリストを書き換える（リアルタイムプレビュー）
    const displayProjects = React.useMemo(() => {
        if (!resizingState) return projects;
        return projects.map(p =>
            p.id === resizingState.project.id
                ? { ...p, endDate: resizingState.newEndDate }
                : p
        );
    }, [projects, resizingState]);

    const { days, eventsByDate, transactionsByDate, maxRowIndex } = useCalendarLayout(
        currentDate,
        displayProjects, // use displayProjects instead of projects
        transactions,
        viewMode
    );

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    // リサイズ処理ロジック
    // リサイズ開始
    const handleResizeStart = (project: Project, e: React.PointerEvent) => {
        if (!project.endDate) return;

        setResizingState({
            project,
            originalEndDate: project.endDate,
            startX: e.clientX,
            newEndDate: project.endDate,
        });
    };

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

    // ドラッグ開始
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        // projectオブジェクトがdata属性に入っている前提
        const project = active.data.current?.project as Project;
        if (project) {
            // ドラッグ中の表示用ダミーイベントを作成
            setActiveEvent({
                project,
                visualRowIndex: 0,
                isStart: true,
                isEnd: true,
                isOverflow: false,
            });
        }
    };

    // ドラッグ終了
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveEvent(null);

        if (!over) return;

        const project = active.data.current?.project as Project;
        const dropDate = over.data.current?.date as Date;

        if (project && dropDate && project.startDate && project.endDate) {
            // 元の開始日とドロップ先の差分日数を計算
            // 注意: ドラッグ元のセル位置(日付)はdnd-kitからは直接わからない（Projectは複数セルにまたがるため）
            // そのため、「指が置かれたセル」の日付(dropDate)と、「Projectの開始日」の差分を使うと、
            // 「バーの途中を持ってドラッグした」場合にずれる可能性がある。

            // 正確には、「ドラッグ開始時に掴んだ位置の日付」と「ドロップ先の日付」の差分が必要だが、
            // カレンダーUIでは「バー全体を持って新しい開始日に置く」操作として実装するほうが直感的か、
            // あるいは「バーの開始日」を基準にするか。

            // ここではシンプルに:
            // ユーザーは「ドロップしたセル」を「新しい開始日」にしたい、あるいは
            // 「相対移動」をしたい。

            // dnd-kitの仕様上、active.dataに「ドラッグ元の日付」を入れるのは難しい（Barは日付を持たないため）。
            // しかし、カレンダー上でのドラッグは「この日を始点にする」という意味合いが強い。
            // よって、「ドロップしたセル」を「新しい開始日」とするロジックにする（バー左端合わせ）。
            // ※ バーの途中を持った場合の補正は難しいので、ユーザーには「左端合わせ」として機能を提供する。

            // 修正案: プロジェクト期間（日数）を維持したまま、StartDateをDropDateに変更する。

            // 期間計算
            const durationDays = differenceInCalendarDays(project.endDate, project.startDate);

            const newStartDate = dropDate;
            const newEndDate = addDays(dropDate, durationDays);

            try {
                // UI上は即座に反映されないため、必要ならここでOptimistic Updateを入れるべきだが
                // Firestoreリスナーがあるので自動反映されるはず
                await updateProject(project.id, {
                    startDate: newStartDate,
                    endDate: newEndDate
                });
            } catch (error) {
                console.error('Failed to update project date:', error);
                toast.error('日程の変更に失敗しました');
            }
        }
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
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
                <div ref={containerRef} className="grid grid-cols-7 bg-surface-dark touch-pan-y">
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
                                >
                                    <DroppableCalendarCell
                                        date={day.date}
                                        dateKey={day.dateKey}
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
                                                    <DraggableProjectBar
                                                        key={`${event.project.id}-${idx}`}
                                                        project={event.project}
                                                        visualRowIndex={event.visualRowIndex}
                                                        isStart={event.isStart}
                                                        isEnd={event.isEnd}
                                                        onClick={() => setSelectedProject(event.project)}
                                                        onResizeStart={(e) => handleResizeStart(event.project, e)}
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
                                    </DroppableCalendarCell>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            <DragOverlay>
                {activeEvent ? (
                    <div className="w-full">
                        <DragOverlayBar project={activeEvent.project} />
                    </div>
                ) : null}
            </DragOverlay>

            {/* 詳細ポップオーバー */}
            {selectedProject && (
                <ProjectPopover
                    project={selectedProject}
                    isOpen={!!selectedProject}
                    onClose={() => setSelectedProject(null)}
                    onStatusChange={(status) => {
                        updateProject(selectedProject.id, { status });
                    }}
                    onEdit={() => onProjectClick?.(selectedProject)}
                />
            )}
        </DndContext>
    );
}

// ProjectBarコンポーネントはDraggableProjectBarに置き換えられたため削除
// ただし、もしDraggableを使わない場合のフォールバックとして残すか、DraggableProjectBar側へ統合する。
// ここでは削除して、DraggableProjectBarに一本化する。


export default SmartCalendar;
