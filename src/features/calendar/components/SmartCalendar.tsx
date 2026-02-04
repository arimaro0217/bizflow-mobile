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
import { format, addMonths, subMonths, addWeeks, subWeeks, differenceInCalendarDays, addDays } from 'date-fns';
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
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { useCalendarLayout, type RenderableEvent } from '../hooks/useCalendarLayout';
import type { Project, Transaction, Client } from '../../../types';
import { DragOverlayBar } from './DraggableProjectBar';
import { ProjectPopover } from './ProjectPopover';
import { DateTransactionsSheet } from './DateTransactionsSheet';
import CalendarDayCell from './CalendarDayCell';
import { useProjectOperations } from '../../../hooks/useProjectOperations';
import { useAuth } from '../../../features/auth';
import { useAppStore } from '../../../stores/appStore';

// =============================================================================
// 型定義
// =============================================================================

interface SmartCalendarProps {
    projects: Project[];
    transactions: Transaction[];
    onDateClick?: (date: Date) => void;
    onProjectClick?: (project: Project) => void;
    onTransactionClick?: (transaction: Transaction) => void;
    clients?: Client[];
}

// =============================================================================
// メインコンポーネント
// =============================================================================

export function SmartCalendar({
    projects,
    transactions,
    onDateClick,
    onProjectClick,
    onTransactionClick,
    clients = [],
}: SmartCalendarProps) {
    const { user } = useAuth();
    const { updateProject, deleteProject } = useProjectOperations(user?.uid);
    const { currentMonth, setCurrentMonth, calendarView, setCalendarView } = useAppStore();
    // currentMonth をローカル名 currentDate として扱う
    const currentDate = currentMonth;
    // ローカルのviewModeを削除し、ストアのcalendarView（別名viewModeとして扱う）を使用
    const viewMode = calendarView;
    const setViewMode = setCalendarView;

    const [activeEvent, setActiveEvent] = useState<RenderableEvent | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

    // 日付詳細シートの状態
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [detailDate, setDetailDate] = useState<Date | null>(null);
    const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([]);

    // ダブルタップ検出用
    const lastTapRef = React.useRef<{ date: string; time: number } | null>(null);
    const DOUBLE_TAP_DELAY = 300;

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
        return projects.map((p: Project) =>
            p.id === resizingState.project.id
                ? { ...p, endDate: resizingState.newEndDate }
                : p
        );
    }, [projects, resizingState]);

    const { days, eventsByDate, transactionsByDate, maxRowIndex } = useCalendarLayout(
        currentDate,
        displayProjects,
        transactions,
        viewMode
    );

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    // リサイズ処理ロジック
    // リサイズ開始 (useCallbackでメモ化してCalendarDayCellに渡す)
    const handleResizeStart = React.useCallback((project: Project, e: React.PointerEvent) => {
        if (!project.endDate) return;

        setResizingState({
            project,
            originalEndDate: project.endDate,
            startX: e.clientX,
            newEndDate: project.endDate,
        });
    }, []);

    // ナビゲーション
    const handlePrev = () => {
        setCurrentMonth(viewMode === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
    };

    const handleNext = () => {
        setCurrentMonth(viewMode === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
    };

    const handleToday = () => setCurrentMonth(new Date());

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

    // コールバックのメモ化
    const handleDateClick = React.useCallback((date: Date, isDblClick: boolean = false) => {
        const now = Date.now();
        const dateKey = format(date, 'yyyy-MM-dd');
        const lastTap = lastTapRef.current;

        // すでに選択されている日付を再度タップしたか、またはダブルタップの場合にポップアップを表示
        const isSelectedTap = selectedDateKey === dateKey;
        const isManualDoubleTap = lastTap && lastTap.date === dateKey && (now - lastTap.time) < DOUBLE_TAP_DELAY;

        setSelectedDateKey(prev => prev === dateKey ? null : dateKey); // トグル
        onDateClick?.(date);

        if (isDblClick || isSelectedTap || isManualDoubleTap) {
            // ポップアップを表示
            if (!isDblClick) {
                lastTapRef.current = null;
            }

            // その日のトランザクションを取得（useCalendarLayoutの集計ロジックと一致させる：決済日優先、なければ発生日）
            const dayTxs = transactions.filter(t => {
                const effectiveDate = t.settlementDate || t.transactionDate;
                if (!effectiveDate) return false;

                // date-fnsのisSameDayは0時0分補正などを行ってくれるが、
                // ここでは日付オブジェクトの年月日で比較する（SmartCalendarのグリッドロジックに合わせる）
                const d = new Date(effectiveDate);
                return d.getFullYear() === date.getFullYear() &&
                    d.getMonth() === date.getMonth() &&
                    d.getDate() === date.getDate();
            });

            if (dayTxs.length > 0) {
                setDetailDate(date);
                setDetailTransactions(dayTxs);
                setDetailSheetOpen(true);
            }
        } else {
            lastTapRef.current = { date: dateKey, time: now };
        }
    }, [onDateClick, selectedDateKey, transactions]);

    const handleProjectSelect = React.useCallback((project: Project) => {
        setSelectedProject(project);
    }, []);

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

                            return (
                                <motion.div
                                    key={day.dateKey}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <CalendarDayCell
                                        day={day}
                                        events={events}
                                        txSummary={txSummary}
                                        displayRowCount={displayRowCount}
                                        viewMode={viewMode}
                                        isSelected={selectedDateKey === day.dateKey}
                                        onDateClick={(date) => handleDateClick(date)}
                                        onDateDoubleClick={(date) => handleDateClick(date, true)}
                                        onProjectClick={handleProjectSelect}
                                        onResizeStart={handleResizeStart}
                                    />
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
                    onDelete={async (deleteRelatedTransactions) => {
                        await deleteProject(selectedProject.id, deleteRelatedTransactions);
                        setSelectedProject(null);
                        toast.success(deleteRelatedTransactions
                            ? '案件と関連取引を削除しました'
                            : '案件を削除しました');
                    }}
                />
            )}

            {/* 日付詳細シート */}
            <DateTransactionsSheet
                open={detailSheetOpen}
                onOpenChange={setDetailSheetOpen}
                date={detailDate}
                transactions={detailTransactions}
                clients={clients}
                onTransactionClick={(tx) => {
                    setDetailSheetOpen(false);
                    onTransactionClick?.(tx);
                }}
            />
        </DndContext>
    );
}

export default SmartCalendar;
