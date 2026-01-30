// =============================================================================
// useTransactions - Firestore取引データ操作フック
// =============================================================================
// 【設計】
// - データ構造: users/{uid}/transactions/{transactionId}
// - ユーザーIDを親にすることで、他人のデータが見えない構造
// - onSnapshot でリアルタイム同期
// - Repository パターンでUI層とデータ層を分離
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Transaction } from '../types';

// Firestoreから取得した生データの型
interface FirestoreTransaction {
    type: 'income' | 'expense';
    amount: string;
    taxRate: string;
    transactionDate: Timestamp | null;
    settlementDate: Timestamp | null;
    isSettled: boolean;
    clientId?: string;
    categoryId?: string;
    memo?: string;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

// 新規作成時の入力データ型
export interface CreateTransactionInput {
    type: 'income' | 'expense';
    amount: string;
    taxRate: string;
    transactionDate: Date | null;
    settlementDate: Date | null;
    isSettled?: boolean;
    clientId?: string;
    categoryId?: string;
    memo?: string;
}

interface TransactionsState {
    /** 取引一覧 */
    transactions: Transaction[];
    /** 読み込み中フラグ */
    loading: boolean;
    /** エラー */
    error: Error | null;
}

interface TransactionsActions {
    /** 取引を追加 */
    addTransaction: (data: CreateTransactionInput) => Promise<string>;
    /** 取引を更新 */
    updateTransaction: (id: string, data: Partial<CreateTransactionInput>) => Promise<void>;
    /** 取引を削除 */
    deleteTransaction: (id: string) => Promise<void>;
}

export type UseTransactionsReturn = TransactionsState & TransactionsActions;

/**
 * 取引データを管理するカスタムフック
 * 
 * @param uid - ログイン中のユーザーID
 * 
 * @example
 * ```tsx
 * const { user } = useAuth();
 * const { transactions, loading, addTransaction } = useTransactions(user?.uid);
 * ```
 */
export function useTransactions(uid: string | undefined): UseTransactionsReturn {
    const [state, setState] = useState<TransactionsState>({
        transactions: [],
        loading: true,
        error: null,
    });

    // コレクション参照
    const getCollectionRef = useCallback(() => {
        if (!uid) return null;
        return collection(db, 'users', uid, 'transactions');
    }, [uid]);

    // リアルタイム監視
    useEffect(() => {
        if (!uid) {
            setState({ transactions: [], loading: false, error: null });
            return;
        }

        const collectionRef = getCollectionRef();
        if (!collectionRef) return;

        const q = query(collectionRef, orderBy('transactionDate', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const transactions: Transaction[] = snapshot.docs.map((doc) => {
                    const data = doc.data() as FirestoreTransaction;
                    return {
                        id: doc.id,
                        uid,
                        type: data.type,
                        amount: data.amount,
                        taxRate: data.taxRate,
                        transactionDate: data.transactionDate?.toDate() ?? null,
                        settlementDate: data.settlementDate?.toDate() ?? null,
                        isSettled: data.isSettled,
                        clientId: data.clientId,
                        categoryId: data.categoryId,
                        memo: data.memo,
                        createdAt: data.createdAt?.toDate() ?? null,
                        updatedAt: data.updatedAt?.toDate() ?? null,
                    };
                });
                setState({ transactions, loading: false, error: null });
            },
            (error) => {
                console.error('Firestore監視エラー:', error);
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error instanceof Error ? error : new Error('データ取得に失敗しました'),
                }));
            }
        );

        return () => unsubscribe();
    }, [uid, getCollectionRef]);

    // 取引追加
    const addTransaction = useCallback(
        async (data: CreateTransactionInput): Promise<string> => {
            const collectionRef = getCollectionRef();
            if (!collectionRef) {
                throw new Error('ログインが必要です');
            }

            const docRef = await addDoc(collectionRef, {
                ...data,
                isSettled: data.isSettled ?? false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            return docRef.id;
        },
        [getCollectionRef]
    );

    // 取引更新
    const updateTransaction = useCallback(
        async (id: string, data: Partial<CreateTransactionInput>): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const docRef = doc(db, 'users', uid, 'transactions', id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });
        },
        [uid]
    );

    // 取引削除
    const deleteTransaction = useCallback(
        async (id: string): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const docRef = doc(db, 'users', uid, 'transactions', id);
            await deleteDoc(docRef);
        },
        [uid]
    );

    return useMemo(
        () => ({
            ...state,
            addTransaction,
            updateTransaction,
            deleteTransaction,
        }),
        [state, addTransaction, updateTransaction, deleteTransaction]
    );
}

export default useTransactions;
