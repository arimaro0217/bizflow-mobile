// =============================================================================
// ProjectCreateWizard - 案件登録ウィザード（フルスクリーンモーダル）
// =============================================================================
// 【設計意図】
// - ステップ・バイ・ステップで認知負荷を最小化
// - 取引先選択 → 期間設定 → 金額入力の3ステップ
// - 入金予測をリアルタイムでシミュレーション表示
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { Drawer } from 'vaul';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, Calendar, Wallet, Briefcase } from 'lucide-react';
import { useProjectWizard, type WizardStep, STEP_TITLES } from '../hooks/useProjectWizard';
import { ClientSelectField } from '../../clients/components/ClientSelectField';
import { cn } from '../../../lib/utils';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Client, ProjectColor } from '../../../types';
import { DatePicker } from '../../../components/ui/DatePicker';

// =============================================================================
// Props
// =============================================================================

interface ProjectCreateWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clients: Client[];
    initialDate?: Date;
    onSubmit: (data: {
        clientId: string;
        client: Client;
        title: string;
        color: ProjectColor;
        startDate: Date;
        endDate: Date;
        amount: string;
        memo?: string;
    }) => Promise<void>;
    onCreateClient?: () => void;
}

// =============================================================================
// カラーオプション
// =============================================================================

const COLOR_OPTIONS: { value: ProjectColor; bg: string; label: string }[] = [
    { value: 'blue', bg: 'bg-blue-500', label: '青' },
    { value: 'orange', bg: 'bg-orange-500', label: 'オレンジ' },
    { value: 'green', bg: 'bg-emerald-500', label: '緑' },
    { value: 'purple', bg: 'bg-purple-500', label: '紫' },
    { value: 'gray', bg: 'bg-gray-500', label: 'グレー' },
];

// =============================================================================
// スライドアニメーション
// =============================================================================

const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 300 : -300,
        opacity: 0,
    }),
};

// =============================================================================
// メインコンポーネント
// =============================================================================

export function ProjectCreateWizard({
    open,
    onOpenChange,
    clients,
    initialDate,
    onSubmit,
    onCreateClient,
}: ProjectCreateWizardProps) {
    const {
        form,
        currentStep,
        goToNextStep,
        goToPrevStep,
        isFirstStep,
        isLastStep,
        simulateSettlement,
        isStepValid,
        resetWizard,
        triggerHaptic,
    } = useProjectWizard(initialDate);

    const { watch, setValue, handleSubmit, formState: { errors } } = form;

    // 選択中のクライアント
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [slideDirection, setSlideDirection] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);

    // フォーム値を監視
    const watchedValues = watch();

    // 入金シミュレーション
    const settlementSimulation = simulateSettlement(
        selectedClient,
        watchedValues.endDate
    );

    // クライアント選択時の処理
    const handleClientSelect = useCallback(
        (clientId: string, client: Client) => {
            setValue('clientId', clientId);
            setSelectedClient(client);

            // 自動入力ロジックを削除（ユーザー要望により手動入力を強制）
            // if (!watchedValues.title) {
            //     setValue('title', `${client.name} 案件`);
            // }
        },
        [setValue]
    );

    // 次へボタン
    const handleNext = useCallback(async () => {
        setSlideDirection(1);
        const success = await goToNextStep();
        if (success) {
            // キーボードを閉じる
            const activeElement = document.activeElement as HTMLElement;
            activeElement?.blur();
        }
    }, [goToNextStep]);

    // 戻るボタン
    const handlePrev = useCallback(() => {
        setSlideDirection(-1);
        goToPrevStep();
    }, [goToPrevStep]);

    // 送信
    const onFormSubmit = useCallback(
        async (data: typeof watchedValues) => {
            if (!selectedClient) return;

            setIsSubmitting(true);
            try {
                await onSubmit({
                    clientId: data.clientId,
                    client: selectedClient,
                    title: data.title,
                    color: data.color,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    amount: data.amount,
                    memo: data.memo,
                });
                triggerHaptic();
                resetWizard();
                setSelectedClient(null);
                onOpenChange(false);
            } catch (error) {
                console.error('案件作成エラー:', error);
            } finally {
                setIsSubmitting(false);
            }
        },
        [selectedClient, onSubmit, triggerHaptic, resetWizard, onOpenChange]
    );

    // ウィザードの開閉検知
    useEffect(() => {
        if (open) {
            // 開いた時にリセット（最新の日付を反映するため）
            resetWizard();
        } else {
            // 閉じた時に選択状態クリア
            setSelectedClient(null);
        }
    }, [open, resetWizard]);

    // 金額のフォーマット
    const formatAmount = (value: string) => {
        const num = value.replace(/[^0-9]/g, '');
        if (!num) return '';
        return Number(num).toLocaleString();
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setValue('amount', raw);
    };

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
                <Drawer.Content
                    className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl flex flex-col h-[95vh]"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    {/* ハンドル */}
                    <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-600 my-4" />

                    {/* ヘッダー */}
                    <div className="flex items-center justify-between px-4 pb-4 border-b border-white/5">
                        {/* 左: キャンセルまたは戻る */}
                        <button
                            onClick={isFirstStep ? () => onOpenChange(false) : handlePrev}
                            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                        >
                            {isFirstStep ? (
                                <span>キャンセル</span>
                            ) : (
                                <>
                                    <ChevronLeft className="w-5 h-5" />
                                    <span>戻る</span>
                                </>
                            )}
                        </button>

                        {/* 中央: ステップインジケータ */}
                        <div className="flex items-center gap-2">
                            {([1, 2, 3] as WizardStep[]).map((step) => (
                                <div
                                    key={step}
                                    className={cn(
                                        'w-2 h-2 rounded-full transition-all',
                                        step === currentStep
                                            ? 'w-6 bg-primary-500'
                                            : step < currentStep
                                                ? 'bg-primary-500/50'
                                                : 'bg-gray-600'
                                    )}
                                />
                            ))}
                        </div>

                        {/* 右: 次へまたは完了 */}
                        <button
                            onClick={isLastStep ? handleSubmit(onFormSubmit) : handleNext}
                            disabled={!isStepValid(currentStep) || isSubmitting}
                            className={cn(
                                'flex items-center gap-1 font-medium transition-colors',
                                isStepValid(currentStep) && !isSubmitting
                                    ? 'text-primary-400 hover:text-primary-300'
                                    : 'text-gray-600'
                            )}
                        >
                            {isLastStep ? (
                                <>
                                    <span>{isSubmitting ? '保存中...' : '完了'}</span>
                                    {!isSubmitting && <Check className="w-5 h-5" />}
                                </>
                            ) : (
                                <>
                                    <span>次へ</span>
                                    <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>

                    {/* ステップタイトル */}
                    <div className="px-6 pt-6 pb-4">
                        <h2 className="text-2xl font-bold text-white">
                            {STEP_TITLES[currentStep]}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Step {currentStep} / 3
                        </p>
                    </div>

                    {/* コンテンツ */}
                    <div className="flex-1 overflow-y-auto px-6">
                        <AnimatePresence mode="wait" custom={slideDirection}>
                            <motion.div
                                key={currentStep}
                                custom={slideDirection}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                            >
                                {/* Step 1: 取引先と案件名 */}
                                {currentStep === 1 && (
                                    <div className="space-y-6">
                                        {/* 取引先選択 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                                取引先 <span className="text-expense">*</span>
                                            </label>
                                            <ClientSelectField
                                                value={watchedValues.clientId}
                                                onChange={handleClientSelect}
                                                clients={clients}
                                                onCreateNew={onCreateClient}
                                                error={errors.clientId?.message}
                                            />
                                        </div>

                                        {/* 案件名 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                                案件名 <span className="text-expense">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={watchedValues.title}
                                                onChange={(e) => setValue('title', e.target.value)}
                                                placeholder="例: ◯◯様邸 改修工事"
                                                className="w-full h-14 px-4 bg-surface-light rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg"
                                            />
                                            {errors.title && (
                                                <p className="text-expense text-sm mt-1">{errors.title.message}</p>
                                            )}
                                        </div>

                                        {/* カラー選択 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-3">
                                                カレンダーの表示色
                                            </label>
                                            <div className="flex gap-4">
                                                {COLOR_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setValue('color', option.value)}
                                                        className={cn(
                                                            'w-12 h-12 rounded-full transition-all',
                                                            option.bg,
                                                            watchedValues.color === option.value
                                                                ? 'ring-4 ring-white/30 scale-110'
                                                                : 'opacity-60 hover:opacity-100'
                                                        )}
                                                        title={option.label}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: 期間設定 */}
                                {currentStep === 2 && (
                                    <div className="space-y-6">
                                        {/* 開始日 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                                開始日 <span className="text-expense">*</span>
                                            </label>
                                            <div
                                                onClick={() => setIsStartDatePickerOpen(true)}
                                                className="w-full h-14 px-4 bg-surface-light rounded-xl text-white flex items-center text-lg active:bg-surface transition-colors cursor-pointer"
                                            >
                                                {watchedValues.startDate ? format(watchedValues.startDate, 'yyyy年M月d日', { locale: ja }) : <span className="text-gray-500">日付を選択</span>}
                                                <Calendar className="ml-auto w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>

                                        {/* 終了日 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                                終了日（納品日） <span className="text-expense">*</span>
                                            </label>
                                            <div
                                                onClick={() => setIsEndDatePickerOpen(true)}
                                                className={cn(
                                                    "w-full h-14 px-4 bg-surface-light rounded-xl flex items-center text-lg active:bg-surface transition-colors cursor-pointer",
                                                    watchedValues.endDate ? "text-white" : "text-gray-500"
                                                )}
                                            >
                                                {watchedValues.endDate ? format(watchedValues.endDate, 'yyyy年M月d日', { locale: ja }) : '日付を選択'}
                                                <Calendar className="ml-auto w-5 h-5 text-gray-400" />
                                            </div>
                                            {errors.endDate && (
                                                <p className="text-expense text-sm mt-1">{errors.endDate.message}</p>
                                            )}
                                        </div>

                                        {/* クイック選択 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-3">
                                                クイック設定
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { label: '1週間', days: 7 },
                                                    { label: '2週間', days: 14 },
                                                    { label: '1ヶ月', days: 30 },
                                                    { label: '2ヶ月', days: 60 },
                                                    { label: '3ヶ月', days: 90 },
                                                ].map((preset) => (
                                                    <button
                                                        key={preset.days}
                                                        type="button"
                                                        onClick={() => {
                                                            const start = watchedValues.startDate || new Date();
                                                            setValue('endDate', addDays(start, preset.days));
                                                        }}
                                                        className="px-4 py-2 bg-surface-light rounded-lg text-gray-300 hover:bg-surface hover:text-white transition-colors text-sm"
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: 金額 */}
                                {currentStep === 3 && (
                                    <div className="space-y-6">
                                        {/* 案件サマリー */}
                                        <div className="p-4 bg-surface-light rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Briefcase className="w-5 h-5 text-primary-400" />
                                                <span className="text-white font-medium">{watchedValues.title}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-gray-400 text-sm">
                                                <Calendar className="w-4 h-4" />
                                                <span>
                                                    {watchedValues.startDate && format(watchedValues.startDate, 'M月d日', { locale: ja })}
                                                    {' → '}
                                                    {watchedValues.endDate && format(watchedValues.endDate, 'M月d日', { locale: ja })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 金額入力 */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                                金額（税抜） <span className="text-expense">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">¥</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatAmount(watchedValues.amount)}
                                                    onChange={handleAmountChange}
                                                    placeholder="0"
                                                    className="w-full h-20 pl-10 pr-4 bg-surface-light rounded-xl text-white text-4xl font-bold text-center tracking-tight focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                            </div>
                                            {errors.amount && (
                                                <p className="text-expense text-sm mt-1">{errors.amount.message}</p>
                                            )}
                                        </div>

                                        {/* 入金予測カード */}
                                        <AnimatePresence>
                                            {settlementSimulation && watchedValues.amount && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 mt-4 shadow-sm"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Wallet className="w-6 h-6 text-blue-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-blue-600">💰 入金予測</p>
                                                            <p className="text-lg font-bold text-blue-900">
                                                                {settlementSimulation.formattedDate}
                                                            </p>
                                                            <p className="text-xs text-blue-500 mt-1">
                                                                {selectedClient?.name}の支払サイトに基づく
                                                            </p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* メモ */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                                メモ（任意）
                                            </label>
                                            <textarea
                                                value={watchedValues.memo || ''}
                                                onChange={(e) => setValue('memo', e.target.value)}
                                                placeholder="追加のメモがあれば入力..."
                                                rows={3}
                                                className="w-full px-4 py-3 bg-surface-light rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
            <Drawer.Portal>
                {/* DatePickers - ポータル外に出すとz-index管理が楽だが、createPortalされているのでここにおいてもbody直下にレンダーされる */}
                <DatePicker
                    open={isStartDatePickerOpen}
                    onOpenChange={setIsStartDatePickerOpen}
                    value={watchedValues.startDate || new Date()}
                    onConfirm={(date) => setValue('startDate', date)}
                />
                <DatePicker
                    open={isEndDatePickerOpen}
                    onOpenChange={setIsEndDatePickerOpen}
                    value={watchedValues.endDate || watchedValues.startDate || new Date()}
                    onConfirm={(date) => setValue('endDate', date)}
                />
            </Drawer.Portal>
        </Drawer.Root>
    );
}

export default ProjectCreateWizard;
