// =============================================================================
// useRecurringMasters - 定期取引マスタCRUDフック
// =============================================================================
// 【設計】
// - データ構造: users/{uid}/recurring_masters/{masterId}
// - ユーザーIDを親にすることで、他人のデータが見えない構造
// - onSnapshot でリアルタイム同期
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
import type { RecurringMaster } from '../types';

// Firestoreから取得した生データの型
interface FirestoreRecurringMaster {
    title: string;
    baseAmount: string;
    type: 'income' | 'expense';
    clientId?: string;
    categoryId?: string;
    memo?: string;
    frequency: 'monthly' | 'yearly';
    dayOfPeriod: number;
    monthOfYear?: number;
    startDate: Timestamp | null;
    endDate?: Timestamp | null;
    isActive: boolean;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

// 新規作成時の入力データ型
export interface CreateRecurringMasterInput {
    title: string;
    baseAmount: string;
    type: 'income' | 'expense';
    clientId?: string;
    categoryId?: string;
    memo?: string;
    frequency: 'monthly' | 'yearly';
    dayOfPeriod: number;
    monthOfYear?: number;
    startDate: Date;
    endDate?: Date | null;
    isActive?: boolean;
}

interface RecurringMastersState {
    /** マスタ一覧 */
    masters: RecurringMaster[];
    /** 読み込み中フラグ */
    loading: boolean;
    /** エラー */
    error: Error | null;
}

interface RecurringMastersActions {
    /** マスタを追加 */
    addRecurringMaster: (data: CreateRecurringMasterInput) => Promise<string>;
    /** マスタを更新 */
    updateRecurringMaster: (id: string, data: Partial<CreateRecurringMasterInput>) => Promise<void>;
    /** マスタを削除 */
    deleteRecurringMaster: (id: string) => Promise<void>;
}

export type UseRecurringMastersReturn = RecurringMastersState & RecurringMastersActions;

/**
 * 定期取引マスタを管理するカスタムフック
 * 
 * @param uid - ログイン中のユーザーID
 */
export function useRecurringMasters(uid: string | undefined): UseRecurringMastersReturn {
    const [state, setState] = useState<RecurringMastersState>({
        masters: [],
        loading: true,
        error: null,
    });

    // コレクション参照
    const getCollectionRef = useCallback(() => {
        if (!uid) return null;
        return collection(db, 'users', uid, 'recurring_masters');
    }, [uid]);

    // リアルタイム監視
    useEffect(() => {
        if (!uid) {
            setState({ masters: [], loading: false, error: null });
            return;
        }

        const collectionRef = getCollectionRef();
        if (!collectionRef) return;

        const q = query(collectionRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const masters: RecurringMaster[] = snapshot.docs.map((doc) => {
                    const data = doc.data() as FirestoreRecurringMaster;
                    return {
                        id: doc.id,
                        uid,
                        title: data.title,
                        baseAmount: data.baseAmount,
                        type: data.type,
                        clientId: data.clientId,
                        categoryId: data.categoryId,
                        memo: data.memo,
                        frequency: data.frequency,
                        dayOfPeriod: data.dayOfPeriod,
                        monthOfYear: data.monthOfYear,
                        startDate: data.startDate?.toDate() ?? null,
                        endDate: data.endDate?.toDate() ?? null,
                        isActive: data.isActive,
                        createdAt: data.createdAt?.toDate() ?? null,
                        updatedAt: data.updatedAt?.toDate() ?? null,
                    };
                });
                setState({ masters, loading: false, error: null });
            },
            (error) => {
                console.error('RecurringMasters監視エラー:', error);
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error instanceof Error ? error : new Error('データ取得に失敗しました'),
                }));
            }
        );

        return () => unsubscribe();
    }, [uid, getCollectionRef]);

    // マスタ追加
    const addRecurringMaster = useCallback(
        async (data: CreateRecurringMasterInput): Promise<string> => {
            const collectionRef = getCollectionRef();
            if (!collectionRef) {
                throw new Error('ログインが必要です');
            }

            const docRef = await addDoc(collectionRef, {
                uid,
                title: data.title,
                baseAmount: data.baseAmount,
                type: data.type,
                ...(data.clientId && { clientId: data.clientId }),
                ...(data.categoryId && { categoryId: data.categoryId }),
                ...(data.memo && { memo: data.memo }),
                frequency: data.frequency,
                dayOfPeriod: data.dayOfPeriod,
                ...(data.monthOfYear && { monthOfYear: data.monthOfYear }),
                startDate: data.startDate,
                ...(data.endDate && { endDate: data.endDate }),
                isActive: data.isActive ?? true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            return docRef.id;
        },
        [getCollectionRef]
    );

    // マスタ更新
    const updateRecurringMaster = useCallback(
        async (id: string, data: Partial<CreateRecurringMasterInput>): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const docRef = doc(db, 'users', uid, 'recurring_masters', id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });
        },
        [uid]
    );

    // マスタ削除
    const deleteRecurringMaster = useCallback(
        async (id: string): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const docRef = doc(db, 'users', uid, 'recurring_masters', id);
            await deleteDoc(docRef);
        },
        [uid]
    );

    return useMemo(
        () => ({
            ...state,
            addRecurringMaster,
            updateRecurringMaster,
            deleteRecurringMaster,
        }),
        [state, addRecurringMaster, updateRecurringMaster, deleteRecurringMaster]
    );
}

export default useRecurringMasters;
