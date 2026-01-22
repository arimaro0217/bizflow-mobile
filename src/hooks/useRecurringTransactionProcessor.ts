// =============================================================================
// useRecurringTransactionProcessor - 定期取引処理のコアロジック
// =============================================================================
// 【機能】
// 1. 定期取引の一括作成（マスタ登録時）
// 2. Googleカレンダー方式の更新（この予定のみ / これ以降すべて）
// 3. 自動延長（アプリ起動時）
// =============================================================================

import { useCallback } from 'react';
import {
    collection,
    doc,
    query,
    where,
    getDocs,
    writeBatch,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    generateTransactionsFromMaster,
    needsAutoExtension,
    generateExtensionTransactions,
} from '../lib/recurringUtils';
import { calculateSettlementDate } from '../lib/settlement';
import type { RecurringMaster, Transaction, Client } from '../types';
import type { CreateRecurringMasterInput } from './useRecurringMasters';

// 更新モード
export type UpdateMode = 'single' | 'future';

interface ProcessorActions {
    /** 定期取引マスタを作成し、トランザクションを一括生成 */
    createRecurringWithTransactions: (
        masterData: CreateRecurringMasterInput,
        clients: Client[]
    ) => Promise<string>;

    /** 定期取引を更新（Googleカレンダー方式） */
    updateRecurringTransaction: (
        transaction: Transaction,
        newData: Partial<Transaction>,
        updateMode: UpdateMode,
        clients: Client[]
    ) => Promise<void>;

    /** 定期取引マスタを削除し、未消込のトランザクションも削除 */
    deleteRecurringWithTransactions: (masterId: string) => Promise<void>;

    /** 自動延長チェック・実行 */
    autoExtendRecurringTransactions: (
        masters: RecurringMaster[],
        transactions: Transaction[],
        clients: Client[]
    ) => Promise<void>;
}

/**
 * 定期取引処理のコアロジックを提供するフック
 */
export function useRecurringTransactionProcessor(
    uid: string | undefined
): ProcessorActions {

    /**
     * 定期取引マスタを作成し、トランザクションを一括生成
     */
    const createRecurringWithTransactions = useCallback(
        async (masterData: CreateRecurringMasterInput, clients: Client[]): Promise<string> => {
            if (!uid) throw new Error('ログインが必要です');

            const batch = writeBatch(db);

            // 1. マスタを作成
            const masterRef = doc(collection(db, 'users', uid, 'recurring_masters'));
            const masterDoc = {
                title: masterData.title,
                baseAmount: masterData.baseAmount,
                type: masterData.type,
                ...(masterData.clientId && { clientId: masterData.clientId }),
                ...(masterData.categoryId && { categoryId: masterData.categoryId }),
                ...(masterData.memo && { memo: masterData.memo }),
                frequency: masterData.frequency,
                dayOfPeriod: masterData.dayOfPeriod,
                ...(masterData.monthOfYear && { monthOfYear: masterData.monthOfYear }),
                startDate: masterData.startDate,
                ...(masterData.endDate && { endDate: masterData.endDate }),
                isActive: masterData.isActive ?? true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            batch.set(masterRef, masterDoc);

            // 2. トランザクションを生成
            const tempMaster: RecurringMaster = {
                id: masterRef.id,
                uid,
                title: masterData.title,
                baseAmount: masterData.baseAmount,
                type: masterData.type,
                clientId: masterData.clientId,
                categoryId: masterData.categoryId,
                memo: masterData.memo,
                frequency: masterData.frequency,
                dayOfPeriod: masterData.dayOfPeriod,
                monthOfYear: masterData.monthOfYear,
                startDate: masterData.startDate,
                endDate: masterData.endDate ?? null,
                isActive: masterData.isActive ?? true,
                createdAt: null,
                updatedAt: null,
            };

            const transactions = generateTransactionsFromMaster(tempMaster, clients, uid);

            // 3. トランザクションをバッチに追加
            const transactionsRef = collection(db, 'users', uid, 'transactions');
            for (const tx of transactions) {
                const txRef = doc(transactionsRef);
                batch.set(txRef, {
                    ...tx,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            // 4. コミット
            await batch.commit();

            console.log(`定期取引を作成しました: ${transactions.length}件のトランザクションを生成`);
            return masterRef.id;
        },
        [uid]
    );

    /**
     * 定期取引を更新（Googleカレンダー方式）
     */
    const updateRecurringTransaction = useCallback(
        async (
            transaction: Transaction,
            newData: Partial<Transaction>,
            updateMode: UpdateMode,
            clients: Client[]
        ): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');
            if (!transaction.recurringMasterId) {
                throw new Error('単発取引です。定期取引の更新はできません。');
            }

            const batch = writeBatch(db);

            if (updateMode === 'single') {
                // ========================================
                // Case: この予定のみ変更
                // ========================================
                const txRef = doc(db, 'users', uid, 'transactions', transaction.id);
                batch.update(txRef, {
                    ...newData,
                    isDetached: true, // 逸脱フラグを立てる
                    updatedAt: serverTimestamp(),
                });

            } else {
                // ========================================
                // Case: これ以降すべての予定を変更
                // ========================================

                // 1. マスタを更新
                const masterRef = doc(db, 'users', uid, 'recurring_masters', transaction.recurringMasterId);
                const masterUpdateData: Record<string, any> = {
                    updatedAt: serverTimestamp(),
                };
                if (newData.amount !== undefined) {
                    masterUpdateData.baseAmount = newData.amount;
                }
                if (newData.clientId !== undefined) {
                    masterUpdateData.clientId = newData.clientId;
                }
                if (newData.memo !== undefined) {
                    masterUpdateData.memo = newData.memo;
                }
                if (newData.type !== undefined) {
                    masterUpdateData.type = newData.type;
                }
                batch.update(masterRef, masterUpdateData);

                // 2. 対象トランザクションを抽出
                const transactionsRef = collection(db, 'users', uid, 'transactions');
                const q = query(
                    transactionsRef,
                    where('recurringMasterId', '==', transaction.recurringMasterId),
                    where('isSettled', '==', false) // 消込済みは除外
                );

                const snapshot = await getDocs(q);

                // 3. 対象日以降のトランザクションを更新
                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();
                    const instanceDate = data.recurringInstanceDate?.toDate?.() ?? data.recurringInstanceDate;

                    // 選択した取引以降のもののみ対象
                    if (!instanceDate || !transaction.recurringInstanceDate) continue;
                    if (instanceDate < transaction.recurringInstanceDate) continue;

                    // 逸脱済みは除外（オプション：個別変更を守る）
                    if (data.isDetached === true) continue;

                    const txRef = doc(db, 'users', uid, 'transactions', docSnap.id);

                    // 更新データを構築
                    const updateData: Record<string, any> = {
                        ...newData,
                        updatedAt: serverTimestamp(),
                    };

                    // 取引先が変わった場合、settlementDateを再計算
                    if (newData.clientId !== undefined) {
                        const newClient = clients.find(c => c.id === newData.clientId);
                        const txDate = data.transactionDate?.toDate?.() ?? data.transactionDate;
                        if (txDate && newClient) {
                            updateData.settlementDate = calculateSettlementDate(
                                txDate,
                                newClient.closingDay,
                                newClient.paymentMonthOffset,
                                newClient.paymentDay
                            );
                        }
                    }

                    batch.update(txRef, updateData);
                }
            }

            await batch.commit();
            console.log(`定期取引を更新しました: モード=${updateMode}`);
        },
        [uid]
    );

    /**
     * 定期取引マスタを削除し、未消込のトランザクションも削除
     */
    const deleteRecurringWithTransactions = useCallback(
        async (masterId: string): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const batch = writeBatch(db);

            // 1. マスタを削除
            const masterRef = doc(db, 'users', uid, 'recurring_masters', masterId);
            batch.delete(masterRef);

            // 2. 未消込のトランザクションを削除
            const transactionsRef = collection(db, 'users', uid, 'transactions');
            const q = query(
                transactionsRef,
                where('recurringMasterId', '==', masterId),
                where('isSettled', '==', false)
            );

            const snapshot = await getDocs(q);
            for (const docSnap of snapshot.docs) {
                batch.delete(doc(db, 'users', uid, 'transactions', docSnap.id));
            }

            await batch.commit();
            console.log(`定期取引を削除しました: ${snapshot.size}件のトランザクションを削除`);
        },
        [uid]
    );

    /**
     * 自動延長チェック・実行
     */
    const autoExtendRecurringTransactions = useCallback(
        async (
            masters: RecurringMaster[],
            transactions: Transaction[],
            clients: Client[]
        ): Promise<void> => {
            if (!uid) return;

            const batch = writeBatch(db);
            let totalCreated = 0;

            for (const master of masters) {
                if (!needsAutoExtension(master, transactions)) {
                    continue;
                }

                const newTransactions = generateExtensionTransactions(
                    master,
                    transactions,
                    clients,
                    uid
                );

                const transactionsRef = collection(db, 'users', uid, 'transactions');
                for (const tx of newTransactions) {
                    const txRef = doc(transactionsRef);
                    batch.set(txRef, {
                        ...tx,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                    totalCreated++;
                }
            }

            if (totalCreated > 0) {
                await batch.commit();
                console.log(`自動延長: ${totalCreated}件のトランザクションを追加`);
            }
        },
        [uid]
    );

    return {
        createRecurringWithTransactions,
        updateRecurringTransaction,
        deleteRecurringWithTransactions,
        autoExtendRecurringTransactions,
    };
}

export default useRecurringTransactionProcessor;
