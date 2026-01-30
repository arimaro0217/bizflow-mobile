// =============================================================================
// useProjects - 案件管理フック（資金繰り連動版）
// =============================================================================
// 【機能】
// - Firestore 'projects' コレクションのCRUD
// - Transaction（資金繰り予定）との自動同期
// - 案件作成時 -> 入金予定Transaction作成
// - 案件削除時 -> 紐づくTransaction削除
// =============================================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
    collection,
    doc,
    onSnapshot,
    query,
    orderBy,
    where,
    getDocs,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Project, Client, ProjectStatus, ProjectColor } from '../types';
import { calculateSettlementDate } from '../lib/settlement';

// =============================================================================
// 型定義
// =============================================================================

export interface CreateProjectInput {
    clientId: string;
    title: string;
    startDate: Date;
    endDate: Date;
    status?: ProjectStatus;
    color: ProjectColor;
    estimatedAmount: string;
    memo?: string;
}

interface ProjectsState {
    projects: Project[];
    loading: boolean;
    error: Error | null;
}

interface ProjectsActions {
    addProject: (data: CreateProjectInput, client: Client) => Promise<string>;
    updateProject: (id: string, data: Partial<CreateProjectInput>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
}

// =============================================================================
// メインフック
// =============================================================================

export function useProjects(uid: string | undefined): ProjectsState & ProjectsActions {
    const [state, setState] = useState<ProjectsState>({
        projects: [],
        loading: true,
        error: null,
    });

    // -------------------------------------------------------------------------
    // リアルタイム取得
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!uid) {
            setState({ projects: [], loading: false, error: null });
            return;
        }

        const q = query(
            collection(db, 'users', uid, 'projects'),
            orderBy('startDate', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const projects = snapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        uid,
                        ...data,
                        startDate: data.startDate?.toDate() ?? null,
                        endDate: data.endDate?.toDate() ?? null,
                        createdAt: data.createdAt?.toDate() ?? null,
                        updatedAt: data.updatedAt?.toDate() ?? null,
                    } as Project;
                });
                setState({ projects, loading: false, error: null });
            },
            (error) => {
                console.error('Projects fetch error:', error);
                setState((prev) => ({ ...prev, loading: false, error }));
            }
        );

        return () => unsubscribe();
    }, [uid]);

    // -------------------------------------------------------------------------
    // 案件追加 (Transaction連動)
    // -------------------------------------------------------------------------
    const addProject = useCallback(
        async (data: CreateProjectInput, client: Client): Promise<string> => {
            if (!uid) throw new Error('ユーザーIDが必要です');

            const batch = writeBatch(db);

            // 1. Project作成
            const projectRef = doc(collection(db, 'users', uid, 'projects'));
            batch.set(projectRef, {
                ...data,
                uid,
                status: data.status ?? 'draft',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 2. 入金予定Transaction作成 (自動連携)
            // 案件の終了日(納品日)を基準に入金日を計算
            const settlementDate = calculateSettlementDate(
                data.endDate,
                client.closingDay,
                client.paymentMonthOffset,
                client.paymentDay
            );

            const transactionRef = doc(collection(db, 'users', uid, 'transactions'));
            batch.set(transactionRef, {
                uid,
                type: 'income',
                amount: data.estimatedAmount,
                taxRate: '0.1', // デフォルト消費税
                transactionDate: settlementDate, // 発生日ではなく入金予定日に配置(資金繰りベース)
                settlementDate: settlementDate,
                isSettled: false,
                clientId: client.id,
                projectId: projectRef.id, // 紐付け
                memo: `[案件連動] ${data.title}`,
                isEstimate: true, // 予測フラグ
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            await batch.commit();
            return projectRef.id;
        },
        [uid]
    );

    // -------------------------------------------------------------------------
    // 案件更新 (Transaction連動)
    // -------------------------------------------------------------------------
    const updateProject = useCallback(
        async (id: string, data: Partial<CreateProjectInput>, client?: Client) => {
            if (!uid) throw new Error('ユーザーIDが必要です');

            const batch = writeBatch(db);
            const projectRef = doc(db, 'users', uid, 'projects', id);

            // 1. Project更新
            batch.update(projectRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });

            // 2. 連動するTransactionの更新（条件付き）
            // 金額、日付、タイトル、または取引先情報(client)が変更された場合のみ同期を試みる
            if (data.estimatedAmount || data.endDate || data.title || client) {
                // 関連する未決済の予測トランザクションを検索
                const q = query(
                    collection(db, 'users', uid, 'transactions'),
                    where('projectId', '==', id),
                    where('isEstimate', '==', true),
                    where('isSettled', '==', false)
                );

                const snapshot = await getDocs(q);

                snapshot.docs.forEach((docSnap) => {
                    const updates: any = {
                        updatedAt: serverTimestamp(),
                    };

                    // 金額同期
                    if (data.estimatedAmount) {
                        updates.amount = data.estimatedAmount;
                    }

                    // タイトル同期
                    if (data.title) {
                        updates.memo = `[案件連動] ${data.title}`;
                    }

                    // 日付同期（Client情報とEndDateが必要）
                    if ((data.endDate || client) && client) {
                        // Projectの既存データを取得するわけではないので、
                        // data.endDateがない場合は更新不可能なため、ここには到達しない前提か、
                        // あるいは呼び出し元が必ずendDateを含める必要がある。
                        // 今回は data.endDate がある場合のみ再計算する形とする。
                        if (data.endDate) {
                            const settlementDate = calculateSettlementDate(
                                data.endDate,
                                client.closingDay,
                                client.paymentMonthOffset,
                                client.paymentDay
                            );
                            updates.transactionDate = settlementDate;
                            updates.settlementDate = settlementDate;
                        }
                    }

                    batch.update(docSnap.ref, updates);
                });
            }

            await batch.commit();
        },
        [uid]
    );

    // -------------------------------------------------------------------------
    // 案件削除 (Transaction連動)
    // -------------------------------------------------------------------------
    const deleteProject = useCallback(
        async (id: string): Promise<void> => {
            if (!uid) throw new Error('ユーザーIDが必要です');

            const batch = writeBatch(db);

            // 1. Project削除
            const projectRef = doc(db, 'users', uid, 'projects', id);
            batch.delete(projectRef);

            // 2. 紐づくTransactionを検索して削除
            const transactionsRef = collection(db, 'users', uid, 'transactions');
            const q = query(transactionsRef, where('projectId', '==', id));
            const snapshot = await getDocs(q);

            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
        },
        [uid]
    );

    return useMemo(
        () => ({
            ...state,
            addProject,
            updateProject,
            deleteProject,
        }),
        [state, addProject, updateProject, deleteProject]
    );
}
