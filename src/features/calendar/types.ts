// =============================================================================
// カレンダー機能の型定義
// =============================================================================

import type { Project, Transaction } from '../../types';

/** カレンダー表示用のプロジェクト型 */
export interface CalendarProject {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    color: 'blue' | 'orange' | 'green' | 'purple' | 'gray';
}

/** レンダリング可能なイベント（1日分のバー情報） */
export interface RenderableEvent {
    project: Project;
    visualRowIndex: number;  // 表示段（0, 1, 2, ...）
    isStart: boolean;        // この日がバーの左端か
    isEnd: boolean;          // この日がバーの右端か
    isMiddle: boolean;       // 中間セルか（!isStart && !isEnd）
    isOverflow: boolean;     // 最大段数を超えたか
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

/** useCalendarLayoutフックの戻り値 */
export interface UseCalendarLayoutReturn {
    days: CalendarDay[];
    eventsByDate: EventsByDate;
    transactionsByDate: TransactionsByDate;
    maxRowIndex: number;
}
