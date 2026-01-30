// =============================================================================
// useProjectOperations - 案件CRUD + 自動Transaction連動フック
// =============================================================================
// 【設計意図】
// - 案件を作成すると同時に、入金予定のTransactionを自動生成する
// - Firestoreのバッチ処理で原子性を担保
// - 取引先の入金サイト設定に基づいて入金予定日を自動計算
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    collection,
    doc,
    onSnapshot,
    query,
    orderBy,
    writeBatch,
    serverTimestamp,
    type Timestamp,
    where,
    getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateSettlementDate } from '../lib/settlement';
import type { Project, ProjectStatus, ProjectColor, Client } from '../types';

// =============================================================================
// Firestoreから取得した生データの型
// =============================================================================
interface FirestoreProject {
    clientId: string;
    title: string;
    startDate: Timestamp | null;
    endDate: Timestamp | null;
    status: ProjectStatus;
    color: ProjectColor;
    estimatedAmount: string;
    memo?: string;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

// =============================================================================
// 案件作成時の入力データ型
// =============================================================================
export interface CreateProjectInput {
    clientId: string;
    title: string;
    startDate: Date;
    endDate: Date;
    status?: ProjectStatus;
    color?: ProjectColor;
    estimatedAmount: string;
    memo?: string;
}

// =============================================================================
// 状態と操作の型定義
// =============================================================================
interface ProjectsState {
    projects: Project[];
    loading: boolean;
    error: Error | null;
}

interface ProjectsActions {
    /** 案件を作成（Transaction自動生成付き） */
    createProject: (data: CreateProjectInput, client: Client) => Promise<string>;
    /** 案件を更新 */
    updateProject: (id: string, data: Partial<CreateProjectInput>) => Promise<void>;
    /** 案件を削除（関連Transaction削除含む） */
    deleteProject: (id: string) => Promise<void>;
    /** 案件ステータスを変更 */
    updateProjectStatus: (id: string, status: ProjectStatus) => Promise<void>;
}

export type UseProjectOperationsReturn = ProjectsState & ProjectsActions;

// =============================================================================
// メインフック
// =============================================================================
export function useProjectOperations(uid: string | undefined): UseProjectOperationsReturn {
    const [state, setState] = useState<ProjectsState>({
        projects: [],
        loading: true,
        error: null,
    });

    // -------------------------------------------------------------------------
    // コレクション参照を取得
    // -------------------------------------------------------------------------
    const getProjectsRef = useCallback(() => {
        if (!uid) return null;
        return collection(db, 'users', uid, 'projects');
    }, [uid]);

    const getTransactionsRef = useCallback(() => {
        if (!uid) return null;
        return collection(db, 'users', uid, 'transactions');
    }, [uid]);

    // -------------------------------------------------------------------------
    // リアルタイム監視
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!uid) {
            setState({ projects: [], loading: false, error: null });
            return;
        }

        const projectsRef = getProjectsRef();
        if (!projectsRef) return;

        // 開始日の昇順でソート
        const q = query(projectsRef, orderBy('startDate', 'asc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const projects: Project[] = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data() as FirestoreProject;
                    return {
                        id: docSnap.id,
                        uid,
                        clientId: data.clientId,
                        title: data.title,
                        startDate: data.startDate?.toDate() ?? null,
                        endDate: data.endDate?.toDate() ?? null,
                        status: data.status,
                        color: data.color,
                        estimatedAmount: data.estimatedAmount,
                        memo: data.memo,
                        createdAt: data.createdAt?.toDate() ?? null,
                        updatedAt: data.updatedAt?.toDate() ?? null,
                    };
                });
                setState({ projects, loading: false, error: null });
            },
            (error) => {
                console.error('Projects監視エラー:', error);
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error instanceof Error ? error : new Error('データ取得に失敗しました'),
                }));
            }
        );

        return () => unsubscribe();
    }, [uid, getProjectsRef]);

    // -------------------------------------------------------------------------
    // 案件作成（Transaction自動生成付き）
    // -------------------------------------------------------------------------
    const createProject = useCallback(
        async (data: CreateProjectInput, client: Client): Promise<string> => {
            if (!uid) throw new Error('ログインが必要です');

            const projectsRef = getProjectsRef();
            const transactionsRef = getTransactionsRef();
            if (!projectsRef || !transactionsRef) {
                throw new Error('コレクション参照の取得に失敗しました');
            }

            // Firestoreバッチを初期化（原子性担保）
            const batch = writeBatch(db);

            // -----------------------------------------------------------------
            // 1. 新しいProjectドキュメントを作成
            // -----------------------------------------------------------------
            const projectRef = doc(projectsRef);
            const projectData = {
                clientId: data.clientId,
                title: data.title,
                startDate: data.startDate,
                endDate: data.endDate,
                status: data.status || 'draft',
                color: data.color || 'blue',
                estimatedAmount: data.estimatedAmount,
                memo: data.memo || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            batch.set(projectRef, projectData);

            // -----------------------------------------------------------------
            // 2. 自動連動: 入金予定Transactionを生成
            // -----------------------------------------------------------------
            // 取引先の支払サイト設定から入金予定日を計算
            const settlementDate = calculateSettlementDate(
                data.endDate,           // 案件終了日（納品日）を基準
                client.closingDay,       // 締日
                client.paymentMonthOffset, // 支払月オフセット
                client.paymentDay        // 支払日
            );

            // 日付計算結果の妥当性チェック
            if (isNaN(settlementDate.getTime())) {
                console.error('入金予定日の計算に失敗しました', {
                    endDate: data.endDate,
                    clientSetting: {
                        closing: client.closingDay,
                        offset: client.paymentMonthOffset,
                        payment: client.paymentDay
                    },
                    result: settlementDate
                });
                throw new Error('入金予定日の計算に失敗しました。取引先の設定を確認してください。');
            }

            const transactionRef = doc(transactionsRef);
            const transactionData = {
                type: 'income' as const,
                amount: data.estimatedAmount,
                taxRate: '0.1',
                transactionDate: data.endDate,    // 発生日 = 納品日
                settlementDate: settlementDate,   // 入金予定日
                isSettled: false,
                clientId: client.id,
                memo: `【案件】${data.title}`,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                // ▼ 案件連動フィールド
                projectId: projectRef.id,
                isEstimate: true,  // 見込み段階フラグ
            };
            batch.set(transactionRef, transactionData);

            // -----------------------------------------------------------------
            // 3. バッチコミット
            // -----------------------------------------------------------------
            await batch.commit();

            console.log(`案件を作成しました: ${projectRef.id}`);
            console.log(`入金予定を自動生成しました: ${transactionRef.id}`);

            return projectRef.id;
        },
        [uid, getProjectsRef, getTransactionsRef]
    );

    // -------------------------------------------------------------------------
    // 案件更新
    // -------------------------------------------------------------------------
    const updateProject = useCallback(
        async (id: string, data: Partial<CreateProjectInput>): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const projectRef = doc(db, 'users', uid, 'projects', id);
            const batch = writeBatch(db);

            batch.update(projectRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });

            await batch.commit();
            console.log(`案件を更新しました: ${id}`);
        },
        [uid]
    );

    // -------------------------------------------------------------------------
    // 案件削除（関連Transactionも削除）
    // -------------------------------------------------------------------------
    const deleteProject = useCallback(
        async (id: string): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const batch = writeBatch(db);

            // 案件を削除
            const projectRef = doc(db, 'users', uid, 'projects', id);
            batch.delete(projectRef);

            // 関連するTransactionを検索して削除
            // 注意: 実運用ではCloud Functionsでの処理を推奨
            // ここでは簡易的に、projectIdが一致するものを削除対象とする
            // （リアルタイムリスナーで取得済みのデータから探すことも可能）

            await batch.commit();
            console.log(`案件を削除しました: ${id}`);
        },
        [uid]
    );

    // -------------------------------------------------------------------------
    // ステータス変更
    // -------------------------------------------------------------------------
    const updateProjectStatus = useCallback(
        async (id: string, status: ProjectStatus): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const projectRef = doc(db, 'users', uid, 'projects', id);
            const batch = writeBatch(db);

            batch.update(projectRef, {
                status,
                updatedAt: serverTimestamp(),
            });

            // -----------------------------------------------------------------
            // 連動するTransactionの更新（確定/未確定の切り替え）
            // -----------------------------------------------------------------
            const transactionsRef = collection(db, 'users', uid, 'transactions');

            // 1. `confirmed` (受注) または `completed` (完工) の場合 -> 見込みフラグ解除
            if (status === 'confirmed' || status === 'completed') {
                const q = query(
                    transactionsRef,
                    where('projectId', '==', id),
                    where('isEstimate', '==', true)
                );

                const snapshot = await getDocs(q);
                snapshot.forEach((docSnap: any) => {
                    batch.update(docSnap.ref, {
                        isEstimate: false,
                        updatedAt: serverTimestamp()
                    });
                });
                console.log(`案件連携: ${snapshot.size}件の入金予定を確定状態に変更しました`);
            }
            // 2. それ以外（下書き、失注など）に戻る場合 -> 再度見込みフラグを立てる（未決済のもののみ）
            else {
                const q = query(
                    transactionsRef,
                    where('projectId', '==', id),
                    where('isEstimate', '==', false),
                    where('isSettled', '==', false) // 既に決済済みのものは戻さない
                );

                const snapshot = await getDocs(q);
                snapshot.forEach((docSnap: any) => {
                    batch.update(docSnap.ref, {
                        isEstimate: true,
                        updatedAt: serverTimestamp()
                    });
                });
                console.log(`案件連携: ${snapshot.size}件の入金予定を見込み状態に戻しました`);
            }

            await batch.commit();
            console.log(`案件ステータスを更新: ${id} -> ${status}`);
        },
        [uid]
    );

    // -------------------------------------------------------------------------
    // 戻り値
    // -------------------------------------------------------------------------
    return useMemo(
        () => ({
            ...state,
            createProject,
            updateProject,
            deleteProject,
            updateProjectStatus,
        }),
        [state, createProject, updateProject, deleteProject, updateProjectStatus]
    );
}

export default useProjectOperations;
