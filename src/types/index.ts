// 取引先 (Client)
export interface Client {
    id: string;
    uid: string; // User ID for security rules
    name: string;
    closingDay: number; // 締日（99=月末）
    paymentMonthOffset: number; // 入金サイト（0=当月, 1=翌月...）
    paymentDay: number; // 支払日（99=月末）
    sortOrder?: number; // 表示順序（小さいほど上）
    createdAt: Date | null;
}

// =============================================================================
// 案件 (Project) - 業務カレンダーのコア
// =============================================================================
// 【設計意図】
// - 案件を登録すると自動でTransaction（入金予定）が生成される
// - カレンダー上でバーとして可視化される
// - 取引先の入金サイトに基づいて入金予定日を自動計算
// =============================================================================
export type ProjectStatus = 'draft' | 'confirmed' | 'completed';
export type ProjectColor = 'blue' | 'orange' | 'green' | 'purple' | 'gray';

export const PROJECT_COLORS: Record<ProjectColor, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-500/80', text: 'text-white', border: 'border-blue-600' },
    orange: { bg: 'bg-orange-500/80', text: 'text-white', border: 'border-orange-600' },
    green: { bg: 'bg-emerald-500/80', text: 'text-white', border: 'border-emerald-600' },
    purple: { bg: 'bg-purple-500/80', text: 'text-white', border: 'border-purple-600' },
    gray: { bg: 'bg-gray-500/80', text: 'text-white', border: 'border-gray-600' },
};

export interface Project {
    id: string;
    uid: string;
    clientId: string;                // 取引先ID（必須）
    title: string;                   // 案件名
    startDate: Date | null;          // 開始日
    endDate: Date | null;            // 終了日（納品予定日）
    status: ProjectStatus;           // ステータス
    color: ProjectColor;             // カレンダー表示色
    estimatedAmount: string;         // 見積金額（decimal.js用にstring）
    memo?: string;                   // メモ

    // ▼ 機能強化フィールド (Phase 4)
    tags?: string[];                 // タグ（例: リフォーム, 緊急）
    progress?: number;               // 進捗率 0-100
    urls?: string[];                 // 関連リンク
    isImportant?: boolean;           // 重要フラグ

    createdAt: Date | null;
    updatedAt: Date | null;
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

    // ▼ 案件連動用
    projectId?: string;              // 紐付く案件ID
    isEstimate?: boolean;            // 見込み段階フラグ（案件作成時に自動生成）
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



// フォームデータ用型定義
export type ClientFormData = Omit<Client, 'id' | 'uid' | 'createdAt'>;

export interface TransactionFormData {
    type: 'income' | 'expense';
    amount: string;
    transactionDate: Date | null;
    taxRate?: string;
    settlementDate?: Date | null; // 自動計算されるが、手動上書きも可能
    isSettled?: boolean;
    clientId?: string;
    categoryId?: string;
    memo?: string;
}
