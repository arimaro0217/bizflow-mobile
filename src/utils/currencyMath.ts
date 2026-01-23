// =============================================================================
// currencyMath - Decimal.jsラッパー関数群（高精度通貨計算）
// =============================================================================
// 【設計意図】
// - 金融データの計算では浮動小数点誤差が致命的なため、decimal.jsを使用
// - 内部計算は全てDecimal型で行い、表示時のみstring/numberに変換
// - データ保存は原則string型で行い、精度を保持
// =============================================================================

import Decimal from 'decimal.js';

// =============================================================================
// 基本計算関数
// =============================================================================

/**
 * 2つの金額を加算
 * @param a - 金額1（string）
 * @param b - 金額2（string）
 * @returns 合計（string）
 */
export function add(a: string, b: string): string {
    return new Decimal(a || '0').plus(b || '0').toString();
}

/**
 * 金額を減算（a - b）
 * @param a - 金額1（string）
 * @param b - 金額2（string）
 * @returns 差額（string）
 */
export function subtract(a: string, b: string): string {
    return new Decimal(a || '0').minus(b || '0').toString();
}

/**
 * 金額を乗算
 * @param a - 金額（string）
 * @param b - 乗数（string）
 * @returns 積（string）
 */
export function multiply(a: string, b: string): string {
    return new Decimal(a || '0').times(b || '0').toString();
}

/**
 * 金額を除算
 * @param a - 被除数（string）
 * @param b - 除数（string）
 * @returns 商（string）、除数が0の場合は'0'を返す
 */
export function divide(a: string, b: string): string {
    const divisor = new Decimal(b || '0');
    if (divisor.isZero()) {
        return '0';
    }
    return new Decimal(a || '0').dividedBy(divisor).toString();
}

// =============================================================================
// 集計関数
// =============================================================================

/**
 * 金額配列の合計
 * @param amounts - 金額配列（string[]）
 * @returns 合計（string）
 */
export function sum(amounts: string[]): string {
    return amounts.reduce(
        (acc, amount) => acc.plus(amount || '0'),
        new Decimal(0)
    ).toString();
}

// =============================================================================
// 損益計算関数
// =============================================================================

/**
 * 粗利（Gross Profit）を計算
 * @param income - 売上高（string）
 * @param expense - 経費（string）
 * @returns 粗利（string）
 */
export function calculateGrossProfit(income: string, expense: string): string {
    return subtract(income, expense);
}

/**
 * 粗利率（Profit Margin）を計算
 * 
 * 計算式: (粗利 / 売上高) * 100
 * 
 * @param grossProfit - 粗利（string）
 * @param income - 売上高（string）
 * @returns 粗利率（%）、売上高が0の場合は0を返す
 */
export function calculateProfitMargin(grossProfit: string, income: string): number {
    const incomeDecimal = new Decimal(income || '0');

    // ゼロ除算ガード
    if (incomeDecimal.isZero()) {
        return 0;
    }

    const margin = new Decimal(grossProfit || '0')
        .dividedBy(incomeDecimal)
        .times(100);

    // 小数点以下1桁で丸め
    return margin.toDecimalPlaces(1).toNumber();
}

// =============================================================================
// フォーマット関数
// =============================================================================

/**
 * 金額を日本円形式でフォーマット
 * @param amount - 金額（string）
 * @param options - フォーマットオプション
 * @returns フォーマット済み文字列
 */
export function formatCurrency(
    amount: string,
    options: {
        showSign?: boolean;      // +/- 記号を表示
        compact?: boolean;       // 万/億単位で省略
    } = {}
): string {
    const { showSign = false, compact = false } = options;

    const decimal = new Decimal(amount || '0');
    const num = decimal.toNumber();

    if (compact) {
        const absNum = Math.abs(num);
        if (absNum >= 100000000) {
            const value = (num / 100000000).toFixed(1);
            return showSign && num > 0 ? `+¥${value}億` : `¥${value}億`;
        }
        if (absNum >= 10000) {
            const value = (num / 10000).toFixed(1);
            return showSign && num > 0 ? `+¥${value}万` : `¥${value}万`;
        }
    }

    const formatted = Math.abs(num).toLocaleString('ja-JP');

    if (num < 0) {
        return `-¥${formatted}`;
    }
    if (showSign && num > 0) {
        return `+¥${formatted}`;
    }
    return `¥${formatted}`;
}

/**
 * 数値が正か負かを判定
 */
export function isPositive(amount: string): boolean {
    return new Decimal(amount || '0').isPositive() && !new Decimal(amount || '0').isZero();
}

export function isNegative(amount: string): boolean {
    return new Decimal(amount || '0').isNegative();
}

export function isZero(amount: string): boolean {
    return new Decimal(amount || '0').isZero();
}

/**
 * Decimalインスタンスを取得（チェーン計算用）
 */
export function decimal(amount: string): Decimal {
    return new Decimal(amount || '0');
}

export default {
    add,
    subtract,
    multiply,
    divide,
    sum,
    calculateGrossProfit,
    calculateProfitMargin,
    formatCurrency,
    isPositive,
    isNegative,
    isZero,
    decimal,
};
