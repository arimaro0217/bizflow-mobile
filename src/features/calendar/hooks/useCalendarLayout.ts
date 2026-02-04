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
import { format, isSameDay, isAfter, isBefore, eachDayOfInterval } from 'date-fns';
import { getDisplayDate } from '../../../lib/transactionHelpers';
import type { ViewMode } from '../../../stores/appStore';
import type { Project, Transaction } from '../../../types';
import type { UseCalendarLayoutReturn, CalendarDay, EventsByDate, TransactionsByDate } from '../types';
import { useCalendarGrid } from './useCalendarGrid';

const MAX_VISIBLE_ROWS = 4;
type CalendarViewMode = 'month' | 'week';

// ...

export function useCalendarLayout(
    currentDate: Date,
    projects: Project[],
    transactions: Transaction[],
    viewMode: CalendarViewMode = 'month',
    financeViewMode: ViewMode = 'accrual' // デフォルトは発生主義（案件カレンダーなので）
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

    // -------------------------------------------------------------------------
    // 2. 表示範囲の日付グリッド生成（共通フック使用）
    // -------------------------------------------------------------------------
    const allDates = useCalendarGrid(currentDate, viewMode);

    return useMemo(() => {
        const today = new Date();
        const start = allDates[0];
        const end = allDates[allDates.length - 1];

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
                    isMiddle: idx !== 0 && idx !== intersectKeys.length - 1,
                    isOverflow,
                });
            });
        }

        // ---------------------------------------------------------------------
        // 5. トランザクション集計
        // ---------------------------------------------------------------------
        for (const tx of transactions) {
            // viewModeに応じて日付を決定（発生主義 or 現金主義）
            const targetDate = getDisplayDate(tx, financeViewMode);
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
