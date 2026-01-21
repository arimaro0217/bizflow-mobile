import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Decimal from 'decimal.js';

/**
 * Tailwind CSSクラスを結合するユーティリティ
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * 金額をフォーマットする
 */
export function formatCurrency(amount: string | number, currency = 'JPY'): string {
    const num = typeof amount === 'string' ? new Decimal(amount).toNumber() : amount;
    return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(num);
}

/**
 * 金額を数値文字列から表示用にフォーマット
 */
export function formatAmount(amount: string): string {
    try {
        const decimal = new Decimal(amount);
        return decimal.toFixed(0);
    } catch {
        return '0';
    }
}

/**
 * 日付をフォーマットする
 */
export function formatDate(date: Date, format: 'short' | 'long' | 'month' = 'short'): string {
    const options: Record<string, Intl.DateTimeFormatOptions> = {
        short: { month: 'numeric', day: 'numeric' },
        long: { year: 'numeric', month: 'long', day: 'numeric' },
        month: { year: 'numeric', month: 'long' },
    };

    return date.toLocaleDateString('ja-JP', options[format]);
}

/**
 * 曜日を取得する
 */
export function getDayOfWeek(date: Date): string {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
}

/**
 * 税込金額を計算する
 */
export function calculateTaxIncluded(amount: string, taxRate: string): string {
    const amountDecimal = new Decimal(amount);
    const rate = new Decimal(taxRate);
    return amountDecimal.times(rate.plus(1)).toFixed(0);
}

/**
 * 税抜金額を計算する
 */
export function calculateTaxExcluded(amount: string, taxRate: string): string {
    const amountDecimal = new Decimal(amount);
    const rate = new Decimal(taxRate);
    return amountDecimal.dividedBy(rate.plus(1)).toFixed(0);
}
