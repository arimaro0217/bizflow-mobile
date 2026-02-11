// =============================================================================
// useProjectWizard - 案件登録ウィザードのフォーム・ステップ管理フック
// =============================================================================
// 【設計意図】
// - react-hook-form + zod でフォーム状態管理
// - ステップ遷移ロジックの分離
// - 入金日シミュレーションのリアルタイム計算
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import { useForm, type UseFormReturn, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { calculateSettlementDate } from '../../../lib/settlement';
import type { Client, Project } from '../../../types';

// =============================================================================
// スキーマ定義
// =============================================================================

export const projectWizardSchema = z.object({
    // Step 1: Who & What
    clientId: z.string().min(1, '取引先を選択してください'),
    title: z.string().min(1, '案件名を入力してください'),
    color: z.enum(['blue', 'orange', 'green', 'purple', 'gray'] as const),

    // 機能強化: タグ・重要フラグ
    tags: z.array(z.string()).default([]),
    isImportant: z.boolean().default(false),

    // Step 2: When
    startDate: z.date(),
    endDate: z.date(),

    // Step 3: How Much & Details
    amount: z.string().min(1, '金額を入力してください'),
    memo: z.string().optional(),

    // 機能強化: 進捗率・関連リンク
    progress: z.number().min(0).max(100).default(0),
    urls: z.array(z.string().url('正しいURLを入力してください')).default([]), // 配列内の各文字列がURL形式
}).refine((data) => {
    // 終了日は開始日以降であること
    if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
    }
    return true;
}, {
    message: "終了日は開始日以降の日付にしてください",
    path: ["endDate"],
});

export type ProjectWizardFormData = z.infer<typeof projectWizardSchema>;

// =============================================================================
// ステップ定義
// =============================================================================

export type WizardStep = 1 | 2 | 3;

export const STEP_TITLES: Record<WizardStep, string> = {
    1: '案件の基本情報',
    2: '期間の設定',
    3: '詳細と確認',
};

// =============================================================================
// 入金予測シミュレーション結果
// =============================================================================

export interface SettlementSimulation {
    settlementDate: Date;
    formattedDate: string;
}

// =============================================================================
// フック戻り値の型
// =============================================================================

export interface UseProjectWizardReturn {
    // フォーム
    form: UseFormReturn<ProjectWizardFormData>;

    // ステップ管理
    currentStep: WizardStep;
    goToNextStep: () => Promise<boolean>;
    goToPrevStep: () => void;
    isFirstStep: boolean;
    isLastStep: boolean;

    // 入金シミュレーション
    simulateSettlement: (client: Client | null, endDate: Date | null) => SettlementSimulation | null;

    // ステップ別バリデーション
    isStepValid: (step: WizardStep) => boolean;

    // フォームリセット
    resetWizard: () => void;

    // Haptic feedback
    triggerHaptic: () => void;

    // 編集モード判定
    isEditMode: boolean;
}

// =============================================================================
// メインフック
// =============================================================================

export function useProjectWizard(
    initialDate?: Date,
    initialProject?: Project | null // 編集モード用
): UseProjectWizardReturn {
    const [currentStep, setCurrentStep] = useState<WizardStep>(1);

    // フォーム初期化
    const form = useForm<ProjectWizardFormData>({
        resolver: zodResolver(projectWizardSchema) as Resolver<ProjectWizardFormData>,
        defaultValues: useMemo(() => {
            if (initialProject) {
                return {
                    clientId: initialProject.clientId,
                    title: initialProject.title,
                    color: initialProject.color,
                    startDate: initialProject.startDate || new Date(),
                    endDate: initialProject.endDate || new Date(),
                    amount: initialProject.estimatedAmount,
                    memo: initialProject.memo || '',
                    tags: initialProject.tags || [],
                    isImportant: initialProject.isImportant || false,
                    progress: initialProject.progress || 0,
                    urls: initialProject.urls || [],
                };
            }
            return {
                clientId: '',
                title: '',
                color: 'blue',
                startDate: initialDate ?? new Date(),
                endDate: initialDate ?? new Date(),
                amount: '',
                memo: '',
                tags: [],
                isImportant: false,
                progress: 0,
                urls: [],
            };
        }, [initialProject, initialDate]),
        mode: 'onChange',
    });

    const { watch, trigger, reset } = form;

    // -------------------------------------------------------------------------
    // Haptic Feedback
    // -------------------------------------------------------------------------
    const triggerHaptic = useCallback(() => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(10); // 10ms の微細な振動
        }
    }, []);

    // -------------------------------------------------------------------------
    // ステップ別のフィールド定義
    // -------------------------------------------------------------------------
    const stepFields: Record<WizardStep, (keyof ProjectWizardFormData)[]> = {
        1: ['clientId', 'title', 'color', 'tags', 'isImportant'],
        2: ['startDate', 'endDate'],
        3: ['amount', 'progress', 'urls', 'memo'], // memoもStep3で検証
    };

    // -------------------------------------------------------------------------
    // ステップバリデーション
    // -------------------------------------------------------------------------
    const isStepValid = useCallback(
        (step: WizardStep): boolean => {
            const values = watch();

            switch (step) {
                case 1:
                    return Boolean(values.clientId && values.title);
                case 2:
                    return Boolean(values.startDate && values.endDate);
                case 3:
                    // 金額チェック + URLの形式用簡易チェック（詳細はzodでやるが、ボタン活性化用）
                    return Boolean(values.amount && parseFloat(values.amount) >= 0);
                default:
                    return false;
            }
        },
        [watch]
    );

    // -------------------------------------------------------------------------
    // ステップ遷移
    // -------------------------------------------------------------------------
    const goToNextStep = useCallback(async (): Promise<boolean> => {
        // 現在のステップのフィールドをバリデーション
        const isValid = await trigger(stepFields[currentStep]);

        if (!isValid) {
            return false;
        }

        if (currentStep < 3) {
            setCurrentStep((prev) => (prev + 1) as WizardStep);
            triggerHaptic();
            return true;
        }

        return true; // 最終ステップ
    }, [currentStep, trigger, stepFields, triggerHaptic]);

    const goToPrevStep = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep((prev) => (prev - 1) as WizardStep);
        }
    }, [currentStep]);

    // -------------------------------------------------------------------------
    // 入金シミュレーション
    // -------------------------------------------------------------------------
    const simulateSettlement = useCallback(
        (client: Client | null, endDate: Date | null): SettlementSimulation | null => {
            if (!client || !endDate) {
                return null;
            }

            const settlementDate = calculateSettlementDate(
                endDate,
                client.closingDay,
                client.paymentMonthOffset,
                client.paymentDay
            );

            // 日本語フォーマット
            const formattedDate = settlementDate.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            // Haptic feedback when simulation completes
            triggerHaptic();

            return {
                settlementDate,
                formattedDate,
            };
        },
        [triggerHaptic]
    );

    // -------------------------------------------------------------------------
    // ウィザードリセット
    // -------------------------------------------------------------------------
    const resetWizard = useCallback(() => {
        if (initialProject) {
            reset({
                clientId: initialProject.clientId,
                title: initialProject.title,
                color: initialProject.color,
                startDate: initialProject.startDate || new Date(),
                endDate: initialProject.endDate || new Date(),
                amount: initialProject.estimatedAmount,
                memo: initialProject.memo || '',
                tags: initialProject.tags || [],
                isImportant: initialProject.isImportant || false,
                progress: initialProject.progress || 0,
                urls: initialProject.urls || [],
            });
        } else {
            reset({
                clientId: '',
                title: '',
                color: 'blue',
                startDate: initialDate ?? new Date(),
                endDate: initialDate ?? new Date(),
                amount: '',
                memo: '',
                tags: [],
                isImportant: false,
                progress: 0,
                urls: [],
            });
        }
        setCurrentStep(1);
    }, [reset, initialDate, initialProject]);

    // -------------------------------------------------------------------------
    // メモ化された値
    // -------------------------------------------------------------------------
    return useMemo(
        () => ({
            form,
            currentStep,
            goToNextStep,
            goToPrevStep,
            isFirstStep: currentStep === 1,
            isLastStep: currentStep === 3,
            simulateSettlement,
            isStepValid,
            resetWizard,
            triggerHaptic,
            isEditMode: !!initialProject,
        }),
        [
            form,
            currentStep,
            goToNextStep,
            goToPrevStep,
            simulateSettlement,
            isStepValid,
            resetWizard,
            triggerHaptic,
            initialProject,
        ]
    );
}

export default useProjectWizard;
