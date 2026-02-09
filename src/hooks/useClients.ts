// =============================================================================
// useClients - Firestore取引先データ操作フック
// =============================================================================
// 【設計】
// - データ構造: users/{uid}/clients/{clientId}
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
    writeBatch,
    type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Client } from '../types';
import { SUBSCRIPTION_LIMITS, CURRENT_PLAN } from '../config/subscription';

// Firestoreから取得した生データの型
interface FirestoreClient {
    name: string;
    closingDay: number;
    paymentMonthOffset: number;
    paymentDay: number;
    sortOrder?: number;
    createdAt: Timestamp | null;
}

// 新規作成時の入力データ型
export interface CreateClientInput {
    name: string;
    closingDay: number;
    paymentMonthOffset: number;
    paymentDay: number;
    sortOrder?: number;
}

interface ClientsState {
    /** 取引先一覧 */
    clients: Client[];
    /** 読み込み中フラグ */
    loading: boolean;
    /** エラー */
    error: Error | null;
}

interface ClientsActions {
    /** 取引先を追加 */
    addClient: (data: CreateClientInput) => Promise<string>;
    /** 取引先を更新 */
    updateClient: (id: string, data: Partial<CreateClientInput>) => Promise<void>;
    /** 取引先を削除 */
    deleteClient: (id: string) => Promise<void>;
    /** 取引先の順序を一括更新 */
    updateClientsOrder: (orderedIds: string[]) => Promise<void>;
}

export type UseClientsReturn = ClientsState & ClientsActions;

/**
 * 取引先データを管理するカスタムフック
 */
export function useClients(uid: string | undefined): UseClientsReturn {
    const [state, setState] = useState<ClientsState>({
        clients: [],
        loading: true,
        error: null,
    });

    // コレクション参照
    const getCollectionRef = useCallback(() => {
        if (!uid) return null;
        return collection(db, 'users', uid, 'clients');
    }, [uid]);

    // リアルタイム監視
    useEffect(() => {
        if (!uid) {
            setState({ clients: [], loading: false, error: null });
            return;
        }

        const collectionRef = getCollectionRef();
        if (!collectionRef) return;

        const q = query(collectionRef, orderBy('sortOrder', 'asc'), orderBy('name', 'asc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const clients: Client[] = snapshot.docs.map((doc) => {
                    const data = doc.data() as FirestoreClient;
                    return {
                        id: doc.id,
                        uid,
                        name: data.name,
                        closingDay: data.closingDay,
                        paymentMonthOffset: data.paymentMonthOffset,
                        paymentDay: data.paymentDay,
                        sortOrder: data.sortOrder ?? 0,
                        createdAt: data.createdAt?.toDate() ?? null,
                    };
                });
                // sortOrderでソート（小さいほど上）
                clients.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                setState({ clients, loading: false, error: null });
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

    // 取引先追加
    const addClient = useCallback(
        async (data: CreateClientInput): Promise<string> => {
            // 制限チェック
            const limit = SUBSCRIPTION_LIMITS[CURRENT_PLAN].MAX_CLIENTS;
            if (state.clients.length >= limit) {
                throw new Error(`取引先の登録上限(${limit}件)に達しました。`);
            }

            const collectionRef = getCollectionRef();
            if (!collectionRef) {
                throw new Error('ログインが必要です');
            }

            const docRef = await addDoc(collectionRef, {
                uid,
                ...data,
                createdAt: serverTimestamp(),
            });

            return docRef.id;
        },
        [getCollectionRef, state.clients.length]
    );

    // 取引先更新
    const updateClient = useCallback(
        async (id: string, data: Partial<CreateClientInput>): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const docRef = doc(db, 'users', uid, 'clients', id);
            await updateDoc(docRef, data);
        },
        [uid]
    );

    // 取引先削除
    const deleteClient = useCallback(
        async (id: string): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const docRef = doc(db, 'users', uid, 'clients', id);
            await deleteDoc(docRef);
        },
        [uid]
    );

    // 取引先の順序を一括更新
    const updateClientsOrder = useCallback(
        async (orderedIds: string[]): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const batch = writeBatch(db);
            orderedIds.forEach((id, index) => {
                const docRef = doc(db, 'users', uid, 'clients', id);
                batch.update(docRef, { sortOrder: index });
            });
            await batch.commit();
        },
        [uid]
    );

    return useMemo(
        () => ({
            ...state,
            addClient,
            updateClient,
            deleteClient,
            updateClientsOrder,
        }),
        [state, addClient, updateClient, deleteClient, updateClientsOrder]
    );
}

export default useClients;
