// =============================================================================
// useProjectFinancials - 案件別PL計算エンジン
// =============================================================================
// 【設計意図】
// - 特定の案件に関連する全取引を集計し、損益を算出
// - Decimal.jsで浮動小数点誤差を完全排除
// - useMemoで再計算を最適化
// =============================================================================

import { useMemo } from 'react';
import Decimal from 'decimal.js';
import type { Transaction, Project } from '../../../types';
import { calculateProfitMargin } from '../../../utils/currencyMath';

// =============================================================================
// 型定義
// =============================================================================

/** 案件別PL計算結果 */
export interface ProjectFinancials {
    /** 売上高（収入合計） */
    totalIncome: string;
    /** 経費合計 */
    totalExpense: string;
    /** 粗利（売上 - 経費） */
    grossProfit: string;
    /** 粗利率（%） */
    profitMargin: number;
    /** 収入トランザクション一覧 */
    incomeTransactions: Transaction[];
    /** 経費トランザクション一覧 */
    expenseTransactions: Transaction[];
    /** トランザクション総数 */
    transactionCount: number;
    /** 赤字フラグ */
    isDeficit: boolean;
}

/** 粗利率による健全性ステータス */
export type HealthStatus = 'healthy' | 'warning' | 'danger';

// =============================================================================
// メインフック
// =============================================================================

/**
 * 案件別の損益を計算するカスタムフック
 * 
 * @param project - 対象案件（nullの場合は空の結果を返す）
 * @param transactions - 全トランザクション一覧
 * @returns 損益計算結果
 */
export function useProjectFinancials(
    project: Project | null,
    transactions: Transaction[]
): ProjectFinancials {
    return useMemo(() => {
        // 案件がない場合は空の結果を返す
        if (!project) {
            return createEmptyFinancials();
        }

        // ---------------------------------------------------------------------
        // 1. この案件に紐づくトランザクションをフィルタリング
        // ---------------------------------------------------------------------
        const projectTransactions = transactions.filter(
            tx => tx.projectId === project.id
        );

        // ---------------------------------------------------------------------
        // 2. 収入と経費に分類
        // ---------------------------------------------------------------------
        const incomeTransactions = projectTransactions.filter(tx => tx.type === 'income');
        const expenseTransactions = projectTransactions.filter(tx => tx.type === 'expense');

        // ---------------------------------------------------------------------
        // 3. Decimal.jsで高精度集計
        // ---------------------------------------------------------------------
        // 売上高（収入合計）
        const totalIncome = incomeTransactions.reduce(
            (acc, tx) => acc.plus(tx.amount || '0'),
            new Decimal(0)
        );

        // 経費合計
        const totalExpense = expenseTransactions.reduce(
            (acc, tx) => acc.plus(tx.amount || '0'),
            new Decimal(0)
        );

        // 粗利（売上 - 経費）
        const grossProfit = totalIncome.minus(totalExpense);

        // ---------------------------------------------------------------------
        // 4. 粗利率を計算（ゼロ除算ガード付き）
        // ---------------------------------------------------------------------
        const profitMargin = calculateProfitMargin(
            grossProfit.toString(),
            totalIncome.toString()
        );

        // ---------------------------------------------------------------------
        // 5. 結果を返す
        // ---------------------------------------------------------------------
        return {
            totalIncome: totalIncome.toString(),
            totalExpense: totalExpense.toString(),
            grossProfit: grossProfit.toString(),
            profitMargin,
            incomeTransactions,
            expenseTransactions,
            transactionCount: projectTransactions.length,
            isDeficit: grossProfit.isNegative(),
        };
    }, [project, transactions]);
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * 空のFinancialsオブジェクトを生成
 */
function createEmptyFinancials(): ProjectFinancials {
    return {
        totalIncome: '0',
        totalExpense: '0',
        grossProfit: '0',
        profitMargin: 0,
        incomeTransactions: [],
        expenseTransactions: [],
        transactionCount: 0,
        isDeficit: false,
    };
}

/**
 * 粗利率から健全性ステータスを判定
 * 
 * @param profitMargin - 粗利率（%）
 * @returns 健全性ステータス
 */
export function getHealthStatus(profitMargin: number): HealthStatus {
    if (profitMargin >= 30) {
        return 'healthy';  // 30%以上: 健全
    }
    if (profitMargin >= 10) {
        return 'warning';  // 10-30%: 注意
    }
    return 'danger';       // 10%未満: 危険
}

/**
 * 健全性ステータスに応じたカラークラスを取得
 */
export function getHealthStatusColors(status: HealthStatus): {
    bg: string;
    text: string;
} {
    switch (status) {
        case 'healthy':
            return { bg: 'bg-green-100', text: 'text-green-800' };
        case 'warning':
            return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
        case 'danger':
            return { bg: 'bg-red-100', text: 'text-red-800' };
    }
}

export default useProjectFinancials;
