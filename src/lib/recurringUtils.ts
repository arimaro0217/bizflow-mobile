// =============================================================================
// recurringUtils - 定期取引の日付計算・トランザクション生成ユーティリティ
// =============================================================================

import {
    addMonths,
    addYears,
    setDate,
    setMonth,
    lastDayOfMonth,
    startOfDay,
    isBefore,
    isAfter,
} from 'date-fns';
import { calculateSettlementDate } from './settlement';
import type { RecurringMaster, Transaction, Client } from '../types';

/**
 * 31日問題を考慮して日付を設定する
 * 例: 2月に31日を設定しようとした場合、2月28日（or 29日）に調整
 * 
 * @param date - 基準となる日付
 * @param day - 設定したい日（1-31、31は月末扱い）
 * @returns 調整後の日付
 */
export function setDayWithMonthEndFallback(date: Date, day: number): Date {
    const maxDay = lastDayOfMonth(date).getDate();

    // 31は「月末」として扱う
    if (day >= 31 || day > maxDay) {
        return lastDayOfMonth(date);
    }

    return setDate(date, day);
}

/**
 * 次回の発生日を計算する
 * 
 * @param currentDate - 現在の発生日
 * @param frequency - 頻度（monthly/yearly）
 * @param dayOfPeriod - 日（1-31）
 * @param monthOfYear - 月（yearlyの場合のみ、1-12）
 * @returns 次回の発生日
 */
export function calculateNextOccurrence(
    currentDate: Date,
    frequency: 'monthly' | 'yearly',
    dayOfPeriod: number,
    monthOfYear?: number
): Date {
    let nextDate: Date;

    if (frequency === 'monthly') {
        nextDate = addMonths(currentDate, 1);
    } else {
        nextDate = addYears(currentDate, 1);
    }

    // 月を設定（yearlyの場合）
    if (frequency === 'yearly' && monthOfYear !== undefined) {
        nextDate = setMonth(nextDate, monthOfYear - 1); // 0-indexed
    }

    // 日を設定（31日問題を考慮）
    return setDayWithMonthEndFallback(nextDate, dayOfPeriod);
}

/**
 * 期間内の全発生日を生成する
 * 
 * @param startDate - 開始日
 * @param endDate - 終了日（nullの場合はmaxMonths分生成）
 * @param frequency - 頻度
 * @param dayOfPeriod - 日
 * @param monthOfYear - 月（yearlyの場合）
 * @param maxMonths - 無期限の場合の上限月数（デフォルト12ヶ月）
 * @returns 発生日の配列
 */
export function generateOccurrenceDates(
    startDate: Date,
    endDate: Date | null | undefined,
    frequency: 'monthly' | 'yearly',
    dayOfPeriod: number,
    monthOfYear?: number,
    maxMonths: number = 12
): Date[] {
    const dates: Date[] = [];
    const start = startOfDay(startDate);

    // 終了日の決定
    const calculatedEndDate = endDate
        ? startOfDay(endDate)
        : addMonths(start, maxMonths);

    // 最初の発生日を計算
    let currentDate = setDayWithMonthEndFallback(start, dayOfPeriod);

    // yearlyの場合は月も設定
    if (frequency === 'yearly' && monthOfYear !== undefined) {
        currentDate = setMonth(currentDate, monthOfYear - 1);
        currentDate = setDayWithMonthEndFallback(currentDate, dayOfPeriod);

        // 開始日より前になった場合は翌年に
        if (isBefore(currentDate, start)) {
            currentDate = addYears(currentDate, 1);
            currentDate = setDayWithMonthEndFallback(currentDate, dayOfPeriod);
        }
    } else if (frequency === 'monthly') {
        // 開始日より前になった場合は翌月に
        if (isBefore(currentDate, start)) {
            currentDate = addMonths(currentDate, 1);
            currentDate = setDayWithMonthEndFallback(currentDate, dayOfPeriod);
        }
    }

    // 発生日を生成
    while (!isAfter(currentDate, calculatedEndDate)) {
        dates.push(new Date(currentDate));
        currentDate = calculateNextOccurrence(currentDate, frequency, dayOfPeriod, monthOfYear);
    }

    return dates;
}

/**
 * RecurringMasterからTransaction配列を生成する
 * 
 * @param master - 定期取引マスタ
 * @param clients - 取引先一覧（settlementDate計算用）
 * @param uid - ユーザーID
 * @returns Transaction配列（idなし）
 */
export function generateTransactionsFromMaster(
    master: RecurringMaster,
    clients: Client[],
    uid: string
): Omit<Transaction, 'id'>[] {
    if (!master.startDate) {
        return [];
    }

    const occurrenceDates = generateOccurrenceDates(
        master.startDate,
        master.endDate,
        master.frequency,
        master.dayOfPeriod,
        master.monthOfYear
    );

    // 取引先情報を取得（settlementDate計算用）
    const client = master.clientId
        ? clients.find(c => c.id === master.clientId)
        : undefined;

    return occurrenceDates.map(date => {
        // 入金予定日を計算
        let settlementDate = date;
        if (client) {
            settlementDate = calculateSettlementDate(
                date,
                client.closingDay,
                client.paymentMonthOffset,
                client.paymentDay
            );
        }

        return {
            uid,
            type: master.type,
            amount: master.baseAmount,
            taxRate: '0.1', // デフォルト税率
            transactionDate: date,
            settlementDate,
            isSettled: false,
            clientId: master.clientId,
            categoryId: master.categoryId,
            memo: master.memo || master.title,
            createdAt: null,
            updatedAt: null,

            // 定期取引の親子関係
            recurringMasterId: master.id,
            recurringInstanceDate: date,
            isDetached: false,
        };
    });
}

/**
 * 自動延長が必要かどうかを判定する
 * 
 * @param master - 定期取引マスタ
 * @param transactions - 既存のトランザクション
 * @param thresholdMonths - 延長トリガーとなる残り月数（デフォルト6ヶ月）
 * @returns 延長が必要ならtrue
 */
export function needsAutoExtension(
    master: RecurringMaster,
    transactions: Transaction[],
    thresholdMonths: number = 6
): boolean {
    // 無期限でなければ自動延長不要
    if (master.endDate) {
        return false;
    }

    // アクティブでなければ不要
    if (!master.isActive) {
        return false;
    }

    // このマスタに紐づくトランザクションを抽出
    const relatedTransactions = transactions.filter(
        t => t.recurringMasterId === master.id
    );

    if (relatedTransactions.length === 0) {
        return true; // トランザクションがなければ作成が必要
    }

    // 最も未来の発生日を取得
    const latestDate = relatedTransactions.reduce((latest, t) => {
        if (!t.recurringInstanceDate) return latest;
        return isAfter(t.recurringInstanceDate, latest)
            ? t.recurringInstanceDate
            : latest;
    }, new Date(0));

    // 閾値と比較
    const threshold = addMonths(new Date(), thresholdMonths);
    return isBefore(latestDate, threshold);
}

/**
 * 延長分のトランザクションを生成する
 * 
 * @param master - 定期取引マスタ
 * @param existingTransactions - 既存のトランザクション
 * @param clients - 取引先一覧
 * @param uid - ユーザーID
 * @param extensionMonths - 延長する月数（デフォルト12ヶ月）
 * @returns 新規に作成するTransaction配列
 */
export function generateExtensionTransactions(
    master: RecurringMaster,
    existingTransactions: Transaction[],
    clients: Client[],
    uid: string,
    extensionMonths: number = 12
): Omit<Transaction, 'id'>[] {
    // このマスタに紐づくトランザクションを抽出
    const relatedTransactions = existingTransactions.filter(
        t => t.recurringMasterId === master.id
    );

    if (relatedTransactions.length === 0) {
        // 最初から生成
        return generateTransactionsFromMaster(master, clients, uid);
    }

    // 最も未来の発生日を取得
    const latestDate = relatedTransactions.reduce((latest, t) => {
        if (!t.recurringInstanceDate) return latest;
        return isAfter(t.recurringInstanceDate, latest)
            ? t.recurringInstanceDate
            : latest;
    }, new Date(0));

    // 延長開始日（最新日の翌月/翌年から）
    const extensionStartDate = calculateNextOccurrence(
        latestDate,
        master.frequency,
        master.dayOfPeriod,
        master.monthOfYear
    );

    // 延長終了日
    const extensionEndDate = addMonths(extensionStartDate, extensionMonths);

    // 新規発生日を生成
    const newDates = generateOccurrenceDates(
        extensionStartDate,
        extensionEndDate,
        master.frequency,
        master.dayOfPeriod,
        master.monthOfYear,
        extensionMonths
    );

    // 取引先情報を取得
    const client = master.clientId
        ? clients.find(c => c.id === master.clientId)
        : undefined;

    return newDates.map(date => {
        let settlementDate = date;
        if (client) {
            settlementDate = calculateSettlementDate(
                date,
                client.closingDay,
                client.paymentMonthOffset,
                client.paymentDay
            );
        }

        return {
            uid,
            type: master.type,
            amount: master.baseAmount,
            taxRate: '0.1',
            transactionDate: date,
            settlementDate,
            isSettled: false,
            clientId: master.clientId,
            categoryId: master.categoryId,
            memo: master.memo || master.title,
            createdAt: null,
            updatedAt: null,
            recurringMasterId: master.id,
            recurringInstanceDate: date,
            isDetached: false,
        };
    });
}
