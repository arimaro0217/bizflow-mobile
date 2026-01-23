// =============================================================================
// useCalendarLayout - カレンダーレイアウトエンジン（Tetris Packing Algorithm）
// =============================================================================
// 【設計意図】
// - 案件バーが重ならないように配置計算を行う
// - 各日付セルで「使用済みの段数」を管理し、最小の空き段を割り当てる
// - 月をまたぐバーも正しく連続して表示できるように isStart/isEnd フラグを付与
// =============================================================================

import { useMemo } from 'react';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    isSameDay,
    isBefore,
    isAfter,
} from 'date-fns';
import type { Project, Transaction } from '../../../types';

// =============================================================================
// 型定義
// =============================================================================

/** レンダリング可能なイベント（1日分のバー情報） */
export interface RenderableEvent {
    project: Project;
    visualRowIndex: number;  // 表示段（0, 1, 2, ...）
    isStart: boolean;        // この日がバーの左端か
    isEnd: boolean;          // この日がバーの右端か
    isOverflow: boolean;     // 最大段数を超えたか（表示対象外）
}

/** 日付ごとのイベントマップ */
export type EventsByDate = Record<string, RenderableEvent[]>;

/** 日付ごとのトランザクション集計 */
export interface DailyTransactionSummary {
    income: number;
    expense: number;
    transactions: Transaction[];
}
export type TransactionsByDate = Record<string, DailyTransactionSummary>;

/** カレンダーグリッド用の日付情報 */
export interface CalendarDay {
    date: Date;
    dateKey: string;        // 'yyyy-MM-dd' 形式
    isCurrentMonth: boolean;
    isToday: boolean;
}

/** フックの戻り値 */
export interface UseCalendarLayoutReturn {
    days: CalendarDay[];
    eventsByDate: EventsByDate;
    transactionsByDate: TransactionsByDate;
    maxRowIndex: number;  // 使用された最大の段数
}

// =============================================================================
// 定数
// =============================================================================

/** 1セルに表示可能な最大段数 */
const MAX_VISIBLE_ROWS = 3;

// =============================================================================
// メインフック
// =============================================================================

export function useCalendarLayout(
    currentMonth: Date,
    projects: Project[],
    transactions: Transaction[]
): UseCalendarLayoutReturn {
    return useMemo(() => {
        // ---------------------------------------------------------------------
        // 1. 対象月の日付グリッドを生成（前月・翌月の埋めを含む）
        // ---------------------------------------------------------------------
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);

        // 月曜始まりのカレンダー
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const allDates = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
        const today = new Date();

        const days: CalendarDay[] = allDates.map(date => ({
            date,
            dateKey: format(date, 'yyyy-MM-dd'),
            isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
            isToday: isSameDay(date, today),
        }));

        // ---------------------------------------------------------------------
        // 2. 案件を「開始日が早い順」かつ「期間が長い順」にソート
        // ---------------------------------------------------------------------
        const sortedProjects = [...projects]
            .filter(p => p.startDate && p.endDate)
            .sort((a, b) => {
                // 開始日が早い順
                const startDiff = a.startDate!.getTime() - b.startDate!.getTime();
                if (startDiff !== 0) return startDiff;

                // 期間が長い順（同じ開始日の場合）
                const durationA = a.endDate!.getTime() - a.startDate!.getTime();
                const durationB = b.endDate!.getTime() - b.startDate!.getTime();
                return durationB - durationA;
            });

        // ---------------------------------------------------------------------
        // 3. 各日付セルの「使用済み段数」マップを初期化
        // ---------------------------------------------------------------------
        const usedRowsByDate: Record<string, Set<number>> = {};
        days.forEach(day => {
            usedRowsByDate[day.dateKey] = new Set();
        });

        // ---------------------------------------------------------------------
        // 4. 各案件に「期間中を通して空いている最小の段数」を割り当て
        // ---------------------------------------------------------------------
        const eventsByDate: EventsByDate = {};
        days.forEach(day => {
            eventsByDate[day.dateKey] = [];
        });

        let maxRowIndex = 0;

        sortedProjects.forEach(project => {
            if (!project.startDate || !project.endDate) return;

            // この案件がカバーする日付キーを取得
            const projectStart = project.startDate;
            const projectEnd = project.endDate;

            // カレンダー表示範囲と案件期間の交差部分を計算
            const displayStart = isBefore(projectStart, calendarStart) ? calendarStart : projectStart;
            const displayEnd = isAfter(projectEnd, calendarEnd) ? calendarEnd : projectEnd;

            // 表示範囲外ならスキップ
            if (isAfter(displayStart, calendarEnd) || isBefore(displayEnd, calendarStart)) {
                return;
            }

            const projectDays = eachDayOfInterval({ start: displayStart, end: displayEnd });
            const projectDateKeys = projectDays.map(d => format(d, 'yyyy-MM-dd'));

            // ---------------------------------------------------------------
            // 「期間中を通して空いている最小の段数」を探す
            // ---------------------------------------------------------------
            let assignedRow = 0;
            while (assignedRow < MAX_VISIBLE_ROWS) {
                const isRowAvailable = projectDateKeys.every(
                    dateKey => !usedRowsByDate[dateKey]?.has(assignedRow)
                );
                if (isRowAvailable) break;
                assignedRow++;
            }

            const isOverflow = assignedRow >= MAX_VISIBLE_ROWS;

            // 最大使用段数を記録
            if (!isOverflow && assignedRow > maxRowIndex) {
                maxRowIndex = assignedRow;
            }

            // ---------------------------------------------------------------
            // 各日付にイベント情報を登録
            // ---------------------------------------------------------------
            projectDateKeys.forEach((dateKey, index) => {
                // 使用済みマークを付ける（オーバーフローでなければ）
                if (!isOverflow) {
                    usedRowsByDate[dateKey]?.add(assignedRow);
                }

                // イベント情報を追加
                if (eventsByDate[dateKey]) {
                    eventsByDate[dateKey].push({
                        project,
                        visualRowIndex: assignedRow,
                        isStart: index === 0,
                        isEnd: index === projectDateKeys.length - 1,
                        isOverflow,
                    });
                }
            });
        });

        // ---------------------------------------------------------------------
        // 5. トランザクションを日付ごとに集計
        // ---------------------------------------------------------------------
        const transactionsByDate: TransactionsByDate = {};
        days.forEach(day => {
            transactionsByDate[day.dateKey] = {
                income: 0,
                expense: 0,
                transactions: [],
            };
        });

        transactions.forEach(tx => {
            // settlementDate（入金/支払予定日）で集計
            const targetDate = tx.settlementDate || tx.transactionDate;
            if (!targetDate) return;

            const dateKey = format(targetDate, 'yyyy-MM-dd');
            if (!transactionsByDate[dateKey]) return;

            transactionsByDate[dateKey].transactions.push(tx);
            const amount = parseFloat(tx.amount) || 0;

            if (tx.type === 'income') {
                transactionsByDate[dateKey].income += amount;
            } else {
                transactionsByDate[dateKey].expense += amount;
            }
        });

        return {
            days,
            eventsByDate,
            transactionsByDate,
            maxRowIndex,
        };
    }, [currentMonth, projects, transactions]);
}

export default useCalendarLayout;
