// =============================================================================
// useProjectInteraction - 案件ドラッグ操作 + 日程変更ハンドラー
// =============================================================================
// 【設計意図】
// - dnd-kitのonDragEndイベントで呼び出される案件移動ロジック
// - 日程変更時に資金繰りデータを自動再計算
// - モバイル向けのハプティクスフィードバック
// =============================================================================

import { useCallback } from 'react';
import { writeBatch, doc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { recalculateSettlement, calculateDaysDiff, addDays } from '../utils/financeHelpers';
import type { Project, Client } from '../types';

// =============================================================================
// 型定義
// =============================================================================

/** 移動結果 */
export interface MoveProjectResult {
    success: boolean;
    message: string;
    warnings: string[];
}

/** ドラッグ終了イベントデータ */
export interface DragEndData {
    projectId: string;
    sourceDate: Date;
    targetDate: Date;
}

// =============================================================================
// メインフック
// =============================================================================

export function useProjectInteraction(
    uid: string | undefined,
    projects: Project[],
    clients: Client[]
) {
    // -------------------------------------------------------------------------
    // ハプティクスフィードバック
    // -------------------------------------------------------------------------
    const triggerHaptic = useCallback((pattern: number | number[] = 50) => {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // ハプティクス非対応の場合は無視
            }
        }
    }, []);

    // -------------------------------------------------------------------------
    // 案件移動処理
    // -------------------------------------------------------------------------
    const moveProject = useCallback(
        async (projectId: string, newStartDate: Date): Promise<MoveProjectResult> => {
            if (!uid) {
                return { success: false, message: 'ログインが必要です', warnings: [] };
            }

            // -----------------------------------------------------------------
            // 1. 対象案件を取得
            // -----------------------------------------------------------------
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                return { success: false, message: '案件が見つかりません', warnings: [] };
            }

            if (!project.startDate || !project.endDate) {
                return { success: false, message: '案件の日程が設定されていません', warnings: [] };
            }

            // -----------------------------------------------------------------
            // 2. 差分日数と新しい終了日を計算
            // -----------------------------------------------------------------
            const diffDays = calculateDaysDiff(project.startDate, newStartDate);

            // 動きがない場合はスキップ
            if (diffDays === 0) {
                return { success: true, message: '変更なし', warnings: [] };
            }

            const newEndDate = addDays(project.endDate, diffDays);

            // -----------------------------------------------------------------
            // 3. Firestoreバッチを開始
            // -----------------------------------------------------------------
            const batch = writeBatch(db);

            // -----------------------------------------------------------------
            // 4. 案件の日程を更新
            // -----------------------------------------------------------------
            const projectRef = doc(db, 'users', uid, 'projects', projectId);
            batch.update(projectRef, {
                startDate: newStartDate,
                endDate: newEndDate,
                updatedAt: serverTimestamp(),
            });

            // -----------------------------------------------------------------
            // 5. 資金繰り再計算サブルーチン
            // -----------------------------------------------------------------
            const updatedProject: Project = {
                ...project,
                startDate: newStartDate,
                endDate: newEndDate,
            };

            const recalcResult = await recalculateSettlement(
                batch,
                uid,
                updatedProject,
                newEndDate,
                clients
            );

            // -----------------------------------------------------------------
            // 6. バッチコミット
            // -----------------------------------------------------------------
            try {
                await batch.commit();

                // 成功ハプティクス
                triggerHaptic([50, 30, 50]);

                // メッセージ作成
                let message = '日程を変更しました';
                if (recalcResult.updatedCount > 0) {
                    message = '日程と入金予定を変更しました';
                } else if (recalcResult.skippedCount > 0) {
                    message = '日程を変更しました（入金日は更新されませんでした）';
                }

                // Toast通知
                toast.success(message);

                // 警告がある場合は追加で表示
                recalcResult.warnings.forEach(warning => {
                    toast.warning(warning, { duration: 5000 });
                });

                return {
                    success: true,
                    message,
                    warnings: recalcResult.warnings,
                };

            } catch (error) {
                console.error('案件移動エラー:', error);
                triggerHaptic([100, 50, 100]);
                toast.error('日程の変更に失敗しました');

                return {
                    success: false,
                    message: '日程の変更に失敗しました',
                    warnings: [],
                };
            }
        },
        [uid, projects, clients, triggerHaptic]
    );

    // -------------------------------------------------------------------------
    // dnd-kit onDragEnd ハンドラー
    // -------------------------------------------------------------------------
    const handleDragEnd = useCallback(
        async (data: DragEndData) => {
            const { projectId, targetDate } = data;

            // ドラッグ開始時のハプティクス
            triggerHaptic(50);

            // 案件を移動
            await moveProject(projectId, targetDate);
        },
        [moveProject, triggerHaptic]
    );

    // -------------------------------------------------------------------------
    // ドラッグ開始ハンドラー（ハプティクス用）
    // -------------------------------------------------------------------------
    const handleDragStart = useCallback(() => {
        triggerHaptic(50);
    }, [triggerHaptic]);

    // -------------------------------------------------------------------------
    // ステータス変更処理
    // -------------------------------------------------------------------------
    const updateProjectStatus = useCallback(
        async (projectId: string, status: 'draft' | 'confirmed' | 'completed') => {
            if (!uid) {
                toast.error('ログインが必要です');
                return;
            }

            const batch = writeBatch(db);
            const projectRef = doc(db, 'users', uid, 'projects', projectId);

            batch.update(projectRef, {
                status,
                updatedAt: serverTimestamp(),
            });

            // ステータスに応じてTransactionの見込みフラグを更新
            try {
                const transactionsRef = collection(db, 'users', uid, 'transactions');

                // 1. 受注/完工 -> 見込み解除
                if (status === 'confirmed' || status === 'completed') {
                    const q = query(
                        transactionsRef,
                        where('projectId', '==', projectId),
                        where('isEstimate', '==', true)
                    );
                    const snapshot = await getDocs(q);
                    snapshot.forEach((doc: any) => {
                        batch.update(doc.ref, {
                            isEstimate: false,
                            updatedAt: serverTimestamp()
                        });
                    });
                }
                // 2. その他 -> 見込みに戻す（未決済のみ）
                else {
                    const q = query(
                        transactionsRef,
                        where('projectId', '==', projectId),
                        where('isEstimate', '==', false),
                        where('isSettled', '==', false)
                    );
                    const snapshot = await getDocs(q);
                    snapshot.forEach((doc: any) => {
                        batch.update(doc.ref, {
                            isEstimate: true,
                            updatedAt: serverTimestamp()
                        });
                    });
                }

                await batch.commit();
                triggerHaptic(50);

                const statusLabels = {
                    draft: '見積',
                    confirmed: '受注',
                    completed: '完工',
                };
                toast.success(`ステータスを「${statusLabels[status]}」に変更しました`);
            } catch (error) {
                console.error('ステータス変更エラー:', error);
                toast.error('ステータスの変更に失敗しました');
            }
        },
        [uid, triggerHaptic]
    );

    return {
        moveProject,
        handleDragEnd,
        handleDragStart,
        updateProjectStatus,
        triggerHaptic,
    };
}

export default useProjectInteraction;
