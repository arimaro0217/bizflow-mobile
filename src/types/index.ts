// 取引先 (Client)
export interface Client {
    id: string;
    uid: string; // User ID for security rules
    name: string;
    closingDay: number; // 締日（99=月末）
    paymentMonthOffset: number; // 入金サイト（0=当月, 1=翌月...）
    paymentDay: number; // 支払日（99=月末）
    createdAt: Date | null;
}

// 取引 (Transaction)
export interface Transaction {
    id: string;
    uid: string;
    type: 'income' | 'expense';
    amount: string; // decimal.jsでの計算用にString保存
    taxRate: string; // "0.1"
    transactionDate: Date | null; // 発生日
    settlementDate: Date | null; // 入金/支払予定日
    isSettled: boolean; // 消込フラグ
    clientId?: string;
    categoryId?: string;
    memo?: string;
    createdAt: Date | null;
    updatedAt: Date | null;

    // ▼ 定期取引の親子関係管理用
    recurringMasterId?: string;      // 親ルールのID（nullなら単発取引）
    recurringInstanceDate?: Date;    // 本来の予定日（日付変更時の追跡用）
    isDetached?: boolean;            // 逸脱フラグ（個別変更された場合true）
}

// 定期取引マスタ (RecurringMaster)
export interface RecurringMaster {
    id: string;
    uid: string;
    title: string;
    baseAmount: string;
    type: 'income' | 'expense';
    clientId?: string;
    categoryId?: string;
    memo?: string;

    frequency: 'monthly' | 'yearly';
    dayOfPeriod: number;      // 1-31（31は月末扱い）
    monthOfYear?: number;     // yearly の場合: 1-12

    startDate: Date | null;
    endDate?: Date | null;    // 無期限の場合はnull

    isActive: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
}

// カテゴリ
export interface Category {
    id: string;
    uid: string;
    name: string;
    type: 'income' | 'expense';
    color?: string;
    icon?: string;
}

// ユーザー設定
export interface UserSettings {
    uid: string;
    defaultTaxRate: string;
    currency: string;
    fiscalYearStart: number; // 1-12
}

