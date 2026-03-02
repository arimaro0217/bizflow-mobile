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
import { ChevronLeft, ChevronRight, Check, Calendar, Wallet, Briefcase, Tag, AlertCircle, Link as LinkIcon, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectWizard, type WizardStep, STEP_TITLES, type ProjectWizardFormData } from '../hooks/useProjectWizard';
import { ClientSelectField } from '../../clients/components/ClientSelectField';
import { cn } from '../../../lib/utils';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Client, ProjectColor, Project } from '../../../types';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Keypad } from '../../../components/ui/Keypad';
import { useAppStore } from '../../../stores/appStore';
import { useVisualViewport } from '../../../hooks/useVisualViewport';


// =============================================================================
// Props
// =============================================================================

interface ProjectCreateWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clients: Client[];
    initialDate?: Date;
    initialClientId?: string; // 新規作成後の戻り用
    initialProject?: Project; // 編集モード用
    onSubmit: (data: {
        clientId: string;
        client: Client;
        title: string;
        color: ProjectColor;
        startDate: Date;
        endDate: Date;
        amount: string;
        memo?: string;

        // 機能強化
        tags: string[];
        isImportant: boolean;
        progress: number;
        urls: string[];
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
    initialClientId,
    initialProject,
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
        isEditMode,
    } = useProjectWizard(initialDate, initialProject);

    const { openKeypad, isKeypadOpen } = useAppStore();

    const viewport = useVisualViewport();
    const contentStyle = (viewport && !isKeypadOpen) ? {
        bottom: `${Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop))}px`,
        maxHeight: `${viewport.height}px`,
    } : {
        bottom: '0px'
    };

    const { watch, setValue, handleSubmit, formState: { errors } } = form;

    // 選択中のクライアント
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [slideDirection, setSlideDirection] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);

    // UI入力用の一時ステート
    const [tagInput, setTagInput] = useState('');
    const [urlInput, setUrlInput] = useState('');

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
        },
        [setValue]
    );

    // 金額入力の確定処理
    const handleAmountConfirm = useCallback(
        (value: string) => {
            setValue('amount', value);
        },
        [setValue]
    );

    // スクロールリセット処理（iOSでのキーボード表示後のズレ対策）
    const handleInputBlur = useCallback(() => {
        window.scrollTo(0, 0);
    }, []);

    // 編集モード時または新規作成戻り時のクライアント復元
    useEffect(() => {
        if (clients.length === 0 || selectedClient) return;

        if (initialProject) {
            const client = clients.find(c => c.id === initialProject.clientId);
            if (client) {
                setSelectedClient(client);
            }
        } else if (initialClientId) {
            const client = clients.find(c => c.id === initialClientId);
            if (client) {
                setSelectedClient(client);
                // フォームの値も更新しておく（useProjectWizardの中で初期化されているかもしれないが念のため）
                setValue('clientId', initialClientId);
            }
        }
    }, [initialProject, initialClientId, clients, selectedClient, setValue]);

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
        async (data: ProjectWizardFormData) => {
            // 編集モードでクライアントが削除されている場合などは考慮が必要だが、
            // selectedClientがnullでも、IDさえあれば保存は可能にする運用も考えられる。
            // ここでは安全に selectedClient がある場合のみ進める（新規作成時は必須）
            // 編集時は selectedClient が未設定（復元前）の可能性もあるので、data.clientId から再検索する手もあるが、
            // 基本的に useEffect で復元されているはず。
            if (!selectedClient && !data.clientId) return;

            // クライアントオブジェクトが見つからない場合のフォールバック（新規作成は不可避、更新時はIDのみでもOKな設計なら...）
            // ここでは安全側に倒して、client必須とする
            const client = selectedClient || clients.find(c => c.id === data.clientId);
            if (!client) return;

            setIsSubmitting(true);
            try {
                await onSubmit({
                    clientId: data.clientId,
                    client: client,
                    title: data.title,
                    color: data.color,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    amount: data.amount,
                    memo: data.memo,
                    tags: data.tags,
                    isImportant: data.isImportant,
                    progress: data.progress,
                    urls: data.urls,
                });
                triggerHaptic();
                resetWizard();
                setSelectedClient(null);
                onOpenChange(false);
            } catch (error) {
                console.error('案件作成エラー:', error);

                // エラーメッセージの抽出
                let errorMessage = '不明なエラーが発生しました';
                if (error instanceof Error) {
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                }

                toast.error(isEditMode ? '案件の更新に失敗しました' : '案件の登録に失敗しました', {
                    description: errorMessage,
                    duration: 5000,
                    closeButton: true,
                });
            } finally {
                setIsSubmitting(false);
            }
        },
        [selectedClient, clients, onSubmit, triggerHaptic, resetWizard, onOpenChange, isEditMode]
    );

    // ウィザードの開閉検知
    useEffect(() => {
        if (open) {
            // 開いた時にリセット
            resetWizard();
        } else {
            // 閉じた時に選択状態クリア（編集モードでない場合のみ？）
            // 編集中に誤って閉じてもクリアしたほうが安全
            setSelectedClient(null);
            setTagInput('');
            setUrlInput('');
        }
    }, [open, resetWizard]);

    // タグ操作
    const handleAddTag = () => {
        if (!tagInput.trim()) return;
        const currentTags = watchedValues.tags || [];
        if (!currentTags.includes(tagInput.trim())) {
            setValue('tags', [...currentTags, tagInput.trim()]);
        }
        setTagInput('');
    };

    const handleRemoveTag = (tag: string) => {
        const currentTags = watchedValues.tags || [];
        setValue('tags', currentTags.filter(t => t !== tag));
    };

    // URL操作
    const handleAddUrl = () => {
        if (!urlInput.trim()) return;
        // 簡易URLチェック
        if (!urlInput.startsWith('http')) {
            toast.error('URLは http から始めてください');
            return;
        }
        const currentUrls = watchedValues.urls || [];
        if (!currentUrls.includes(urlInput.trim())) {
            setValue('urls', [...currentUrls, urlInput.trim()]);
        }
        setUrlInput('');
    };

    const handleRemoveUrl = (url: string) => {
        const currentUrls = watchedValues.urls || [];
        setValue('urls', currentUrls.filter(u => u !== url));
    };

    return (
        <>
            <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={true} handleOnly={true}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/90 z-40" />
                    <Drawer.Content
                        className="fixed left-0 right-0 z-50 bg-background rounded-t-3xl flex flex-col h-[95dvh] after:hidden"
                        style={contentStyle}
                        aria-describedby={undefined}
                    >
                        {/* アクセシビリティ用の非表示タイトル */}
                        <Drawer.Title className="sr-only">案件登録</Drawer.Title>

                        {/* ハンドル - ここだけがドラッグ可能 */}
                        <div className="mx-auto w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing group">
                            <Drawer.Handle className="w-16 h-1.5 flex-shrink-0 rounded-full bg-gray-600 group-hover:bg-gray-500 group-active:bg-primary-500 transition-colors shadow-sm" />
                        </div>

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
                                        <span>{isSubmitting ? '保存中...' : (isEditMode ? '更新' : '完了')}</span>
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
                        <div className="flex-1 overflow-y-auto px-6 pb-20 overscroll-y-contain touch-pan-y">
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
                                                <label className="block text-base font-bold text-gray-100 mb-2">
                                                    取引先 <span className="text-red-400">*</span>
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
                                                    onBlur={handleInputBlur}
                                                    placeholder="例: ◯◯様邸 改修工事"
                                                    className="w-full h-14 px-4 bg-surface-light rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg"
                                                />
                                                {errors.title && (
                                                    <p className="text-expense text-sm mt-1">{errors.title.message}</p>
                                                )}
                                            </div>

                                            {/* タグ & 重要フラグ */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* 重要フラグ */}
                                                <div className="flex items-center justify-between p-4 bg-surface-light rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("p-2 rounded-lg", watchedValues.isImportant ? "bg-red-500/20" : "bg-gray-700/50")}>
                                                            <AlertCircle className={cn("w-5 h-5", watchedValues.isImportant ? "text-red-400" : "text-gray-400")} />
                                                        </div>
                                                        <div>
                                                            <span className="block text-white font-medium">重要案件</span>
                                                            <span className="text-xs text-gray-400">リストで目立たせる</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setValue('isImportant', !watchedValues.isImportant)}
                                                        className={cn(
                                                            "w-12 h-7 rounded-full transition-colors relative",
                                                            watchedValues.isImportant ? "bg-red-500" : "bg-gray-600"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm",
                                                            watchedValues.isImportant ? "left-6" : "left-1"
                                                        )} />
                                                    </button>
                                                </div>

                                                {/* カラー選択 */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400 mb-3">
                                                        カレンダーの表示色
                                                    </label>
                                                    <div className="flex gap-3">
                                                        {COLOR_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => setValue('color', option.value)}
                                                                className={cn(
                                                                    'w-10 h-10 rounded-full transition-all flex items-center justify-center',
                                                                    option.bg,
                                                                    watchedValues.color === option.value
                                                                        ? 'ring-4 ring-white/20 scale-110 shadow-lg'
                                                                        : 'opacity-60 hover:opacity-100'
                                                                )}
                                                                title={option.label}
                                                            >
                                                                {watchedValues.color === option.value && <Check className="w-5 h-5 text-white" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* タグ入力 */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                                    タグ（任意）
                                                </label>
                                                <div className="flex gap-2 mb-3">
                                                    <input
                                                        type="text"
                                                        value={tagInput}
                                                        onChange={(e) => setTagInput(e.target.value)}
                                                        onBlur={handleInputBlur}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddTag();
                                                            }
                                                        }}
                                                        placeholder="例: リフォーム, 緊急"
                                                        className="flex-1 h-12 px-4 bg-surface-light rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddTag}
                                                        className="w-12 h-12 flex items-center justify-center bg-surface-light rounded-xl text-primary-400 hover:bg-primary-500/10 hover:text-primary-300 transition-colors"
                                                    >
                                                        <Plus className="w-6 h-6" />
                                                    </button>
                                                </div>

                                                {/* タグリスト */}
                                                {(watchedValues.tags || []).length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {(watchedValues.tags || []).map((tag, i) => (
                                                            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700/50 border border-white/5 text-sm text-gray-200">
                                                                <Tag className="w-3.5 h-3.5 text-gray-400" />
                                                                <span>{tag}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveTag(tag)}
                                                                    className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
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
                                                    {watchedValues.isImportant && (
                                                        <span className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5 rounded border border-red-500/30">重要</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-gray-400 text-sm">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>
                                                        {watchedValues.startDate && format(watchedValues.startDate, 'M/d', { locale: ja })}
                                                        {' → '}
                                                        {watchedValues.endDate && format(watchedValues.endDate, 'M/d', { locale: ja })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 金額入力 */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                                    金額（税抜） <span className="text-expense">*</span>
                                                </label>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={openKeypad}
                                                        className="w-full h-20 px-4 bg-surface-light rounded-xl text-white flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                    >
                                                        <span className="text-2xl text-gray-400">¥</span>
                                                        <span className={cn(
                                                            "text-4xl font-bold tracking-tight",
                                                            watchedValues.amount ? "text-white" : "text-gray-500"
                                                        )}>
                                                            {Number(watchedValues.amount || '0').toLocaleString('ja-JP')}
                                                        </span>
                                                    </button>
                                                </div>
                                                {errors.amount && (
                                                    <p className="text-expense text-sm mt-1">{errors.amount.message}</p>
                                                )}
                                            </div>

                                            {/* 進捗率スライダー */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-sm font-medium text-gray-400">
                                                        進捗状況
                                                    </label>
                                                    <span className="text-primary-400 font-bold">{watchedValues.progress}%</span>
                                                </div>
                                                <div className="h-10 px-2 bg-surface-light rounded-xl flex items-center">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="5"
                                                        value={watchedValues.progress}
                                                        onChange={(e) => setValue('progress', parseInt(e.target.value))}
                                                        className="w-full accent-primary-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
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

                                            {/* 関連リンク */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                                    関連リンク（任意）
                                                </label>
                                                <div className="flex gap-2 mb-3">
                                                    <input
                                                        type="text"
                                                        value={urlInput}
                                                        onChange={(e) => setUrlInput(e.target.value)}
                                                        onBlur={handleInputBlur}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddUrl();
                                                            }
                                                        }}
                                                        placeholder="https://..."
                                                        className="flex-1 h-12 px-4 bg-surface-light rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddUrl}
                                                        className="w-12 h-12 flex items-center justify-center bg-surface-light rounded-xl text-primary-400 hover:bg-primary-500/10 hover:text-primary-300 transition-colors"
                                                    >
                                                        <LinkIcon className="w-5 h-5" />
                                                    </button>
                                                </div>

                                                {/* URLリスト */}
                                                {(watchedValues.urls || []).length > 0 && (
                                                    <div className="space-y-2">
                                                        {(watchedValues.urls || []).map((url, i) => (
                                                            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-700/50 border border-white/5 overflow-hidden">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <LinkIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-300 hover:underline truncate">
                                                                        {url}
                                                                    </a>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveUrl(url)}
                                                                    className="ml-2 p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white flex-shrink-0"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* メモ */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                                    メモ（任意）
                                                </label>
                                                <textarea
                                                    value={watchedValues.memo || ''}
                                                    onChange={(e) => setValue('memo', e.target.value)}
                                                    onBlur={handleInputBlur}
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
            </Drawer.Root>

            {/* DatePickers & Keypad - Drawerの外に配置してイベント競合を回避 */}
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
            {open && (
                <Keypad
                    onConfirm={handleAmountConfirm}
                    initialValue={watchedValues.amount}
                />
            )}
        </>
    );
}

export default ProjectCreateWizard;
