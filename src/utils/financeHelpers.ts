// =============================================================================
// financeHelpers - 資金繰り自動再計算エンジン
// =============================================================================
// 【設計意図】
// - 案件の日程変更時に、関連するTransactionの入金日を自動で再計算
// - 入金消込済み(isSettled)や手動編集済み(isDetached)のガード処理
// - Firestoreバッチ処理に対応（原子性担保）
// =============================================================================

import {
    doc,
    collection,
    query,
    where,
    getDocs,
    type WriteBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateSettlementDate } from '../lib/settlement';
import type { Project, Transaction, Client } from '../types';

// =============================================================================
// 型定義
// =============================================================================

/** 再計算結果 */
export interface RecalculationResult {
    success: boolean;
    updatedCount: number;
    skippedCount: number;
    warnings: string[];
}

/** スキップ理由 */
export type SkipReason = 'settled' | 'detached' | 'no_client';

// =============================================================================
// 入金日再計算関数（バッチ処理対応版）
// =============================================================================

/**
 * 案件に紐づくTransactionの入金日を再計算し、バッチに追加する
 * 
 * @param batch - Firestoreバッチ
 * @param uid - ユーザーID
 * @param project - 対象案件
 * @param newEndDate - 新しい終了日（納品日）
 * @param clients - 取引先一覧（キャッシュ）
 * @returns 再計算結果
 */
export async function recalculateSettlement(
    batch: WriteBatch,
    uid: string,
    project: Project,
    newEndDate: Date,
    clients: Client[]
): Promise<RecalculationResult> {
    const result: RecalculationResult = {
        success: true,
        updatedCount: 0,
        skippedCount: 0,
        warnings: [],
    };

    try {
        // ---------------------------------------------------------------------
        // 1. この案件に紐づくトランザクションを取得
        // ---------------------------------------------------------------------
        const transactionsRef = collection(db, 'users', uid, 'transactions');
        const q = query(
            transactionsRef,
            where('projectId', '==', project.id),
            where('type', '==', 'income')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            result.warnings.push('紐付くトランザクションが見つかりませんでした');
            return result;
        }

        // ---------------------------------------------------------------------
        // 2. 各トランザクションに対してガード処理 + 再計算
        // ---------------------------------------------------------------------
        for (const docSnap of snapshot.docs) {
            const tx = docSnap.data() as Omit<Transaction, 'id'>;
            const txRef = doc(db, 'users', uid, 'transactions', docSnap.id);

            // ガード処理: 入金消込済み
            if (tx.isSettled) {
                result.skippedCount++;
                result.warnings.push(
                    `「${tx.memo || '入金予定'}」は入金済みのため、入金日は更新されませんでした`
                );
                continue;
            }

            // ガード処理: 手動編集済み
            if (tx.isDetached) {
                result.skippedCount++;
                result.warnings.push(
                    `「${tx.memo || '入金予定'}」は手動編集済みのため、入金日は更新されませんでした`
                );
                continue;
            }

            // ガード処理: 取引先情報がない
            if (!project.clientId) {
                result.skippedCount++;
                result.warnings.push('取引先が設定されていないため、入金日の計算ができませんでした');
                continue;
            }

            // -----------------------------------------------------------------
            // 3. 新しい入金日を計算
            // -----------------------------------------------------------------
            const client = clients.find(c => c.id === project.clientId);
            if (!client) {
                result.skippedCount++;
                result.warnings.push('取引先情報が見つかりませんでした');
                continue;
            }

            const newSettlementDate = calculateSettlementDate(
                newEndDate,
                client.closingDay,
                client.paymentMonthOffset,
                client.paymentDay
            );

            // -----------------------------------------------------------------
            // 4. バッチ更新キューに追加
            // -----------------------------------------------------------------
            batch.update(txRef, {
                transactionDate: newEndDate,    // 発生日も更新
                settlementDate: newSettlementDate,
                updatedAt: new Date(),
            });

            result.updatedCount++;
        }

        return result;

    } catch (error) {
        console.error('入金日再計算エラー:', error);
        result.success = false;
        result.warnings.push('入金日の再計算中にエラーが発生しました');
        return result;
    }
}

// =============================================================================
// 日数差分計算ユーティリティ
// =============================================================================

/**
 * 2つの日付間の日数差を計算
 * 
 * @param from - 元の日付
 * @param to - 新しい日付
 * @returns 日数差（正: 未来へ移動、負: 過去へ移動）
 */
export function calculateDaysDiff(from: Date, to: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * 日付に日数を加算
 * 
 * @param date - 元の日付
 * @param days - 加算する日数
 * @returns 新しい日付
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
