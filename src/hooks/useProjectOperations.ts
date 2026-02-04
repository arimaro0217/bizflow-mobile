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
    // 機能強化
    tags?: string[];
    isImportant?: boolean;
    progress?: number;
    urls?: string[];
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
    /** 案件を削除（関連Transaction削除はオプション） */
    deleteProject: (id: string, deleteRelatedTransactions?: boolean) => Promise<void>;
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
                        // 既存フィールド
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
                        // 新規フィールド（Firestoreデータから読み込み、なければデフォルト）
                        // @ts-ignore FirestoreProject型未更新のため
                        tags: data.tags || [],
                        // @ts-ignore
                        isImportant: data.isImportant || false,
                        // @ts-ignore
                        progress: data.progress || 0,
                        // @ts-ignore
                        urls: data.urls || [],
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
                // 新規フィールド
                tags: data.tags || [],
                isImportant: data.isImportant || false,
                progress: data.progress || 0,
                urls: data.urls || [],

                uid, // 認証UIDを追加（セキュリティルールで必要）
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
                uid, // 認証UIDを追加（セキュリティルールで必要）
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
    // -------------------------------------------------------------------------
    // 案件更新
    // -------------------------------------------------------------------------
    const updateProject = useCallback(
        async (id: string, data: Partial<CreateProjectInput>): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const batch = writeBatch(db);
            const projectRef = doc(db, 'users', uid, 'projects', id);

            // 1. 案件を更新
            batch.update(projectRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });

            // -----------------------------------------------------------------
            // 2. 連動するTransactionも更新
            //    (日付、金額、タイトルの変更を反映)
            // -----------------------------------------------------------------
            // 変更対象のフィールドが含まれているかチェック
            const shouldUpdateTransaction =
                data.endDate !== undefined ||
                data.estimatedAmount !== undefined ||
                data.title !== undefined;

            if (shouldUpdateTransaction) {
                try {
                    // 最新のProject情報を取得（ClientIdが必要）
                    // ※ data.clientIdがあればそれを使うが、通常更新でClientIdが変わることは稀
                    //   安全のため、現在のProjectデータを取得する方針とする
                    const { getDoc } = await import('firebase/firestore');
                    const projectSnap = await getDoc(projectRef);

                    if (projectSnap.exists()) {
                        const currentProject = projectSnap.data() as FirestoreProject;
                        const clientId = currentProject.clientId;

                        // Transactionを取得
                        // 条件: projectIdが一致 かつ 未決済(isSettled=false)
                        // ※ isEstimate=true の条件を削除（受注確定して isEstimate=false になったものも更新対象にするため）
                        const transactionsRef = collection(db, 'users', uid, 'transactions');
                        const q = query(
                            transactionsRef,
                            where('projectId', '==', id),
                            where('isSettled', '==', false)
                        );
                        const transactionSnap = await getDocs(q);

                        if (!transactionSnap.empty) {
                            // クライアント設定を取得（入金予定日再計算のため）
                            const clientRef = doc(db, 'users', uid, 'clients', clientId);
                            const clientSnap = await getDoc(clientRef);

                            if (clientSnap.exists()) {
                                const clientData = clientSnap.data() as Client;

                                // 更新データを準備
                                const updateData: any = {
                                    updatedAt: serverTimestamp()
                                };

                                // A. 金額変更
                                if (data.estimatedAmount !== undefined) {
                                    updateData.amount = data.estimatedAmount;
                                }

                                // B. タイトル変更
                                if (data.title !== undefined) {
                                    updateData.memo = `【案件】${data.title}`;
                                }

                                // C. 終了日変更 -> 発生日と入金予定日を再計算
                                if (data.endDate !== undefined) {
                                    updateData.transactionDate = data.endDate;

                                    // 支払サイトに基づいて入金予定日を計算
                                    const newSettlementDate = calculateSettlementDate(
                                        data.endDate,
                                        clientData.closingDay,
                                        clientData.paymentMonthOffset,
                                        clientData.paymentDay
                                    );

                                    if (!isNaN(newSettlementDate.getTime())) {
                                        updateData.settlementDate = newSettlementDate;
                                    }
                                }

                                // 該当するTransaction全て（通常1つ）を更新
                                transactionSnap.forEach(doc => {
                                    batch.update(doc.ref, updateData);
                                });

                                console.log('関連トランザクションを更新対象に追加しました');
                            }
                        }
                    }
                } catch (err) {
                    console.error('関連トランザクションの更新準備中にエラーが発生しました', err);
                    // 案件更新自体は止めないが、ログは出す
                }
            }

            await batch.commit();
            console.log(`案件を更新しました: ${id}`);
        },
        [uid]
    );

    // -------------------------------------------------------------------------
    // 案件削除（関連Transactionの削除はオプション）
    // -------------------------------------------------------------------------
    const deleteProject = useCallback(
        async (id: string, deleteRelatedTransactions: boolean = false): Promise<void> => {
            if (!uid) throw new Error('ログインが必要です');

            const batch = writeBatch(db);

            // 案件を削除
            const projectRef = doc(db, 'users', uid, 'projects', id);
            batch.delete(projectRef);

            // 関連するTransactionも削除する場合
            if (deleteRelatedTransactions) {
                const transactionsRef = collection(db, 'users', uid, 'transactions');
                const q = query(transactionsRef, where('projectId', '==', id));
                const snapshot = await getDocs(q);

                snapshot.forEach((docSnap) => {
                    batch.delete(docSnap.ref);
                });

                console.log(`関連トランザクションも削除: ${snapshot.size}件`);
            }

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
