// =============================================================================
// transactionHelpers - トランザクション表示用ヘルパー関数
// =============================================================================

import type { Transaction } from '../types';
import type { ViewMode } from '../stores/appStore';

/**
 * viewModeに応じた表示用日付を取得する
 * 
 * @param transaction - トランザクション
 * @param viewMode - 表示モード（'accrual' = 発生日, 'cash' = 入金/支払日）
 * @returns 表示に使用する日付（nullの場合もあり）
 */
export function getDisplayDate(
    transaction: Transaction,
    viewMode: ViewMode
): Date | null {
    // プロジェクトモード：発生主義（取引日/納品日）として扱う
    // ※ 案件の終了日（納品日）が transactionDate にマッピングされているため
    if (viewMode === 'project') {
        return transaction.transactionDate;
    }

    // 発生主義モード
    if (viewMode === 'accrual') {
        return transaction.transactionDate;
    }

    // 現金主義モード（'cash'）
    // 決済日（入出金日）を使用。未決済の場合は発生日にフォールバック
    return transaction.settlementDate || transaction.transactionDate;
}

/**
 * トランザクション配列を表示用に変換する
 * viewModeに応じて日付フィールドを切り替え
 * 
 * @param transactions - トランザクション配列
 * @param viewMode - 表示モード
 * @returns カレンダー表示用データ配列
 */
export function mapTransactionsForCalendar(
    transactions: Transaction[],
    viewMode: ViewMode
): { date: Date; type: 'income' | 'expense'; amount: number }[] {
    return transactions
        .map(t => {
            const displayDate = getDisplayDate(t, viewMode);
            if (!displayDate) return null;

            return {
                date: displayDate,
                type: t.type,
                amount: parseInt(t.amount, 10) || 0,
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
}

/**
 * 指定日のトランザクションをフィルタリング
 * 
 * @param transactions - トランザクション配列
 * @param date - フィルタ対象日
 * @param viewMode - 表示モード
 * @returns フィルタ済みトランザクション
 */
export function filterTransactionsByDate(
    transactions: Transaction[],
    date: Date,
    viewMode: ViewMode
): Transaction[] {
    return transactions.filter(t => {
        const displayDate = getDisplayDate(t, viewMode);
        if (!displayDate) return false;

        return (
            displayDate.getFullYear() === date.getFullYear() &&
            displayDate.getMonth() === date.getMonth() &&
            displayDate.getDate() === date.getDate()
        );
    });
}
