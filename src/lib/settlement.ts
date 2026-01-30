import {
    addMonths,
    setDate,
    lastDayOfMonth,
    isAfter,
    startOfDay,
} from 'date-fns';

/**
 * 締日・支払月・支払日から入金予定日を計算する
 * 
 * @param transactionDate - 発生日
 * @param closingDay - 締日（1-28, 99=月末）
 * @param paymentMonthOffset - 支払月オフセット（0=当月, 1=翌月, 2=翌々月...）
 * @param paymentDay - 支払日（1-28, 99=月末）
 * @returns 入金予定日
 */
export function calculateSettlementDate(
    transactionDate: Date,
    closingDay: number,
    paymentMonthOffset: number,
    paymentDay: number
): Date {
    const txDate = startOfDay(transactionDate);

    // 締日を計算（99は月末）
    const endOfMonth = lastDayOfMonth(txDate).getDate();
    // 99(月末)ならその月の末日、それ以外なら設定値と末日の小さい方
    const actualClosingDay = closingDay === 99
        ? endOfMonth
        : Math.min(closingDay, endOfMonth);

    // 今月の締日
    let closingDate = setDate(txDate, actualClosingDay);

    // 締日を過ぎていたら翌月の締日
    if (isAfter(txDate, closingDate)) {
        closingDate = addMonths(closingDate, 1);

        // 翌月の末日チェック
        const nextMonthEnd = lastDayOfMonth(closingDate).getDate();
        if (closingDay === 99) {
            closingDate = lastDayOfMonth(closingDate);
        } else {
            // 翌月でも日付が存在しない場合（例: 1/31締め -> 2/28締め）の調整
            const nextClosingDay = Math.min(closingDay, nextMonthEnd);
            closingDate = setDate(closingDate, nextClosingDay);
        }
    }

    // 支払月を計算
    const paymentMonth = addMonths(closingDate, paymentMonthOffset);

    // 支払日を計算（99は月末）
    if (paymentDay === 99) {
        return lastDayOfMonth(paymentMonth);
    } else {
        // 支払日が存在しない月の場合は月末に調整
        const maxDay = lastDayOfMonth(paymentMonth).getDate();
        const actualPaymentDay = Math.min(paymentDay, maxDay);
        return setDate(paymentMonth, actualPaymentDay);
    }
}

/**
 * 入金サイクルの説明文を生成する
 */
export function formatPaymentCycle(
    closingDay: number,
    paymentMonthOffset: number,
    paymentDay: number
): string {
    const closingStr = closingDay === 99 ? '月末' : `${closingDay}日`;
    const monthStr = ['当月', '翌月', '翌々月', '3ヶ月後'][paymentMonthOffset] || `${paymentMonthOffset}ヶ月後`;
    const paymentStr = paymentDay === 99 ? '月末' : `${paymentDay}日`;

    return `${closingStr}締め ${monthStr}${paymentStr}払い`;
}
