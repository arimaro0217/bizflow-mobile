// =============================================================================
// useCalendarLayout - カレンダーレイアウトエンジン（Tetris Packing Algorithm）
// =============================================================================
// 【設計意図】
// - 案件バーが重ならないように配置計算を行う
// - 各日付セルで「使用済みの段数」を管理し、最小の空き段を割り当てる
// - パフォーマンス最適化:
//   - プロジェクトのソートをメモ化
//   - ビューモード（月/週）に応じて計算範囲を最小化
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

export type CalendarViewMode = 'month' | 'week';

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

/** k: 日付文字列, v: 集計情報 */
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

const MAX_VISIBLE_ROWS = 3;

// =============================================================================
// メインフック
// =============================================================================

export function useCalendarLayout(
    currentDate: Date,
    projects: Project[],
    transactions: Transaction[],
    viewMode: CalendarViewMode = 'month'
): UseCalendarLayoutReturn {
    // -------------------------------------------------------------------------
    // 1. プロジェクトのソート（データ変更時のみ再計算）
    // -------------------------------------------------------------------------
    const sortedProjects = useMemo(() => {
        return [...projects]
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
    }, [projects]);

    return useMemo(() => {
        // ---------------------------------------------------------------------
        // 2. 表示範囲の日付グリッド生成
        // ---------------------------------------------------------------------
        const today = new Date();
        let start: Date;
        let end: Date;

        if (viewMode === 'week') {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = endOfWeek(currentDate, { weekStartsOn: 1 });
        } else {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            start = startOfWeek(monthStart, { weekStartsOn: 1 });
            end = endOfWeek(monthEnd, { weekStartsOn: 1 });
        }

        const allDates = eachDayOfInterval({ start, end });
        const days: CalendarDay[] = allDates.map(date => ({
            date,
            dateKey: format(date, 'yyyy-MM-dd'),
            isCurrentMonth: date.getMonth() === currentDate.getMonth(),
            isToday: isSameDay(date, today),
        }));

        // ---------------------------------------------------------------------
        // 3. レイアウト計算用マップ初期化
        // ---------------------------------------------------------------------
        const usedRowsByDate: Record<string, Set<number>> = {};
        const eventsByDate: EventsByDate = {};
        const transactionsByDate: TransactionsByDate = {};

        // 高速アクセスのため初期化ループを一回にまとめる & 文字列連結を避ける
        const dateKeySet = new Set<string>();

        for (const day of days) {
            const k = day.dateKey;
            usedRowsByDate[k] = new Set();
            eventsByDate[k] = [];
            transactionsByDate[k] = { income: 0, expense: 0, transactions: [] };
            dateKeySet.add(k);
        }

        // ---------------------------------------------------------------------
        // 4. 案件の配置計算 (Tetris Algorithm)
        // ---------------------------------------------------------------------
        let maxRowIndex = 0;

        for (const project of sortedProjects) {
            const pStart = project.startDate!;
            const pEnd = project.endDate!;

            // 範囲外判定（高速化）
            if (isAfter(pStart, end) || isBefore(pEnd, start)) continue;

            // 表示範囲と案件期間の交差取得
            const effectiveStart = isBefore(pStart, start) ? start : pStart;
            const effectiveEnd = isAfter(pEnd, end) ? end : pEnd;

            // 日付ループ生成も最適化（都度eachDayOfInterval呼び出しを避ける）
            // しかし日付計算は軽量なので、可読性重視でループ処理
            // ただし、Mapへのアクセス回数を減らす
            const intersectDays = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
            const intersectKeys: string[] = [];

            // 有効なキーのみ収集
            for (const d of intersectDays) {
                const k = format(d, 'yyyy-MM-dd');
                if (dateKeySet.has(k)) intersectKeys.push(k);
            }

            if (intersectKeys.length === 0) continue;

            // 空き段を探す
            let assignedRow = 0;
            // 最大段数を超えてもループは回すが、ある程度で打ち切るべきか？
            // ここではMAX_VISIBLE_ROWSまでは厳密にチェック
            while (assignedRow < MAX_VISIBLE_ROWS) {
                let isRowAvailable = true;
                for (const k of intersectKeys) {
                    if (usedRowsByDate[k]?.has(assignedRow)) {
                        isRowAvailable = false;
                        break;
                    }
                }
                if (isRowAvailable) break;
                assignedRow++;
            }

            const isOverflow = assignedRow >= MAX_VISIBLE_ROWS;
            if (!isOverflow && assignedRow > maxRowIndex) {
                maxRowIndex = assignedRow;
            }

            // 配置確定
            intersectKeys.forEach((key, idx) => {
                if (!isOverflow) {
                    usedRowsByDate[key]!.add(assignedRow);
                }

                eventsByDate[key].push({
                    project,
                    visualRowIndex: assignedRow,
                    isStart: idx === 0,
                    isEnd: idx === intersectKeys.length - 1,
                    isOverflow,
                });
            });
        }

        // ---------------------------------------------------------------------
        // 5. トランザクション集計
        // ---------------------------------------------------------------------
        for (const tx of transactions) {
            const targetDate = tx.settlementDate || tx.transactionDate;
            if (!targetDate) continue;

            // 範囲外判定（高速化）
            if (isBefore(targetDate, start) || isAfter(targetDate, end)) continue;

            const dateKey = format(targetDate, 'yyyy-MM-dd');
            if (!transactionsByDate[dateKey]) continue;

            const summary = transactionsByDate[dateKey];
            summary.transactions.push(tx);

            const val = parseFloat(tx.amount) || 0;
            if (tx.type === 'income') {
                summary.income += val;
            } else {
                summary.expense += val;
            }
        }

        return {
            days,
            eventsByDate,
            transactionsByDate,
            maxRowIndex,
        };
    }, [currentDate, sortedProjects, transactions, viewMode]);
}

export default useCalendarLayout;
