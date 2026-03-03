// =============================================================================
// ProjectCreateWizard - 案件登録ウィザード（フルスクリーンモーダル）
// =============================================================================
// 【設計意図】
// - ステップ・バイ・ステップで認知負荷を最小化
// - 取引先選択 → 期間設定 → 金額入力の3ステップ
// - 入金予測をリアルタイムでシミュレーション表示
// =============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, AlertCircle, Plus, X, Check, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectWizard, STEP_TITLES, type ProjectWizardFormData } from '../hooks/useProjectWizard';
import { ClientSelectField } from '../../clients/components/ClientSelectField';
import { cn } from '../../../lib/utils';
import { addDays } from 'date-fns';
import type { Client, ProjectColor, Project } from '../../../types';
import { DatePicker, Button, Keypad } from '../../../components/ui';
import { FormDrawer } from '../../../components/ui/FormDrawer';
import { FormAmountInput, FormDatePicker, FormTextInput, FormTextArea, FormField } from '../../../components/ui/FormInputs';
import { useAppStore } from '../../../stores/appStore';


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
    onSubmit: (data: any) => Promise<void>;
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
        isEditMode,
    } = useProjectWizard(initialDate, initialProject);

    const { openKeypad, closeKeypad } = useAppStore();

    const { watch, setValue, register, handleSubmit, formState: { errors } } = form;

    // 選択中のクライアント
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [slideDirection, setSlideDirection] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [datePickerField, setDatePickerField] = useState<'startDate' | 'endDate' | null>(null);

    // UI入力用の一時ステート
    const [tagInput, setTagInput] = useState('');

    // フォーム値を監視
    const watchedValues = watch();

    // 入金シミュレーション
    const settlementSimulation = useMemo(() =>
        simulateSettlement(selectedClient, watchedValues.endDate),
        [selectedClient, watchedValues.endDate, simulateSettlement]
    );

    // ウィザードの開閉検知
    useEffect(() => {
        if (open) {
            // 開いた時にリセット
            resetWizard();
        }
    }, [open, resetWizard]);

    // 編集モード時または新規作成戻り時のクライアント復元
    useEffect(() => {
        if (clients.length > 0) {
            const cid = watchedValues.clientId || initialClientId;
            if (watchedValues.clientId !== cid) {
                setValue('clientId', cid as string);
            }
            if (cid && cid !== selectedClient?.id) {
                const client = clients.find(c => c.id === cid);
                if (client) setSelectedClient(client);
            }
        }
    }, [watchedValues.clientId, initialClientId, clients, setValue, selectedClient?.id]);

    // クライアント選択時の処理
    const handleClientSelect = useCallback(
        (clientId: string, client: Client) => {
            setValue('clientId', clientId, { shouldValidate: true });
            setSelectedClient(client);
        },
        [setValue]
    );

    // タグ操作
    const handleAddTag = useCallback(() => {
        if (!tagInput.trim()) return;
        const currentTags = watchedValues.tags || [];
        if (!currentTags.includes(tagInput.trim())) {
            setValue('tags', [...currentTags, tagInput.trim()]);
        }
        setTagInput('');
    }, [tagInput, watchedValues.tags, setValue]);

    const handleRemoveTag = useCallback((tagToRemove: string) => {
        setValue('tags', (watchedValues.tags || []).filter(t => t !== tagToRemove));
    }, [watchedValues.tags, setValue]);

    // 送信
    const onFormSubmit = async (data: ProjectWizardFormData) => {
        if (!selectedClient) return; // クライアントが選択されていない場合は処理しない
        setIsSubmitting(true);
        try {
            await onSubmit({
                ...data,
                client: selectedClient, // selectedClientを渡す
            });
            closeKeypad();
            onOpenChange(false); // 成功したら閉じる
        } catch (error) {
            console.error('案件作成/更新エラー:', error);
            toast.error('保存に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const footer = (
        <div className="flex gap-3">
            {!isFirstStep && (
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                        setSlideDirection(-1);
                        goToPrevStep();
                    }}
                >
                    <ChevronLeft className="w-5 h-5" />
                    戻る
                </Button>
            )}
            <Button
                className="flex-[2] bg-primary-600 hover:bg-primary-500 text-white"
                onClick={async () => {
                    if (isLastStep) {
                        await handleSubmit(onFormSubmit)();
                    } else {
                        setSlideDirection(1);
                        await goToNextStep();
                    }
                }}
                disabled={isSubmitting || !isStepValid(currentStep)}
            >
                {isLastStep ? (isSubmitting ? '保存中...' : (isEditMode ? '更新する' : '登録する')) : '次へ'}
                {!isLastStep && <ChevronRight className="w-5 h-5" />}
            </Button>
        </div>
    );

    return (
        <>
            <FormDrawer
                open={open}
                onOpenChange={(isOpen) => {
                    if (!isOpen) closeKeypad();
                    onOpenChange(isOpen);
                }}
                title={STEP_TITLES[currentStep]}
                footer={footer}
            >
                <div className="relative overflow-hidden min-h-[400px]">
                    <AnimatePresence mode="wait" custom={slideDirection}>
                        <motion.div
                            key={currentStep}
                            custom={slideDirection}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="space-y-6"
                        >
                            {/* Step 1: Who & What */}
                            {currentStep === 1 && (
                                <>
                                    <FormField label="取引先" error={errors.clientId?.message}>
                                        <ClientSelectField
                                            value={watchedValues.clientId}
                                            onChange={handleClientSelect}
                                            clients={clients}
                                            onCreateNew={onCreateClient}
                                        />
                                    </FormField>

                                    <FormTextInput
                                        label="案件名"
                                        placeholder="例: ◯◯様邸 改修工事"
                                        {...register('title')}
                                        error={errors.title?.message}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            onClick={() => setValue('isImportant', !watchedValues.isImportant)}
                                            className={cn(
                                                "flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer",
                                                watchedValues.isImportant
                                                    ? "bg-red-500/10 border-red-500/50 text-red-400"
                                                    : "bg-surface border-white/5 text-gray-400"
                                            )}
                                        >
                                            <AlertCircle className="w-5 h-5" />
                                            <span className="font-medium">重要案件</span>
                                        </div>

                                        <div className="flex gap-2 items-center justify-center p-2 bg-surface rounded-xl border border-white/5">
                                            {COLOR_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setValue('color', opt.value)}
                                                    className={cn(
                                                        "w-7 h-7 rounded-full flex items-center justify-center transition-transform",
                                                        opt.bg,
                                                        watchedValues.color === opt.value ? "scale-125 ring-2 ring-white" : "opacity-50"
                                                    )}
                                                >
                                                    {watchedValues.color === opt.value && <Check className="w-4 h-4 text-white" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <FormField label="タグ">
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={tagInput}
                                                    onChange={(e) => setTagInput(e.target.value)}
                                                    placeholder="タグを追加..."
                                                    className="flex-1 h-12 px-4 bg-surface rounded-xl text-white outline-none focus:ring-1 focus:ring-primary-500"
                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddTag}
                                                    className="w-12 h-12 flex items-center justify-center bg-surface rounded-xl text-primary-400"
                                                >
                                                    <Plus className="w-6 h-6" />
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {watchedValues.tags?.map(tag => (
                                                    <span key={tag} className="flex items-center gap-1 px-3 py-1 bg-surface-light rounded-full text-xs text-gray-300 border border-white/5">
                                                        {tag}
                                                        <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </FormField>
                                </>
                            )}

                            {/* Step 2: When */}
                            {currentStep === 2 && (
                                <>
                                    <div className="grid grid-cols-1 gap-6">
                                        <FormDatePicker
                                            label="プロジェクト開始日"
                                            date={watchedValues.startDate}
                                            onClick={() => { setDatePickerField('startDate'); setIsDatePickerOpen(true); }}
                                            error={errors.startDate?.message}
                                        />
                                        <FormDatePicker
                                            label="終了日（納品予定日）"
                                            date={watchedValues.endDate}
                                            onClick={() => { setDatePickerField('endDate'); setIsDatePickerOpen(true); }}
                                            error={errors.endDate?.message}
                                        />
                                    </div>

                                    {settlementSimulation && (
                                        <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-2xl space-y-2">
                                            <div className="flex items-center gap-2 text-primary-400">
                                                <Building2 className="w-4 h-4" />
                                                <span className="text-sm font-bold">入金予測（{selectedClient?.name}）</span>
                                            </div>
                                            <div className="text-2xl font-bold text-white tabular-nums">
                                                {settlementSimulation.formattedDate}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                ※取引先の締日・入金サイト設定に基づき自動計算しています。
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        {[7, 14, 30, 60, 90].map(days => (
                                            <button
                                                key={days}
                                                type="button"
                                                onClick={() => setValue('endDate', addDays(watchedValues.startDate || new Date(), days))}
                                                className="py-3 px-4 bg-surface rounded-xl text-sm text-gray-300 hover:bg-surface-light border border-white/5"
                                            >
                                                {days >= 30 ? `${Math.floor(days / 30)}ヶ月` : `${days / 7}週間`}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Step 3: How Much & Details */}
                            {currentStep === 3 && (
                                <>
                                    <FormAmountInput
                                        label="見積金額"
                                        value={watchedValues.amount}
                                        type="income"
                                        onClick={openKeypad}
                                        error={errors.amount?.message}
                                    />

                                    <FormField label="進捗率">
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="5"
                                                {...register('progress', { valueAsNumber: true })}
                                                className="flex-1 accent-primary-500"
                                            />
                                            <span className="text-xl font-bold text-white tabular-nums w-12 text-center">
                                                {watchedValues.progress}%
                                            </span>
                                        </div>
                                    </FormField>

                                    <FormTextArea
                                        label="備考・メモ"
                                        placeholder="案件の詳細や注意事項など..."
                                        {...register('memo')}
                                        rows={4}
                                    />
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </FormDrawer>

            {/* DatePickers - FormDrawerの外に配置してイベント競合を回避 */}
            <DatePicker
                open={isDatePickerOpen}
                onOpenChange={setIsDatePickerOpen}
                value={(datePickerField ? watchedValues[datePickerField] : null) || new Date()}
                onConfirm={(date) => {
                    if (datePickerField) setValue(datePickerField, date, { shouldValidate: true });
                    setIsDatePickerOpen(false);
                }}
            />

            {/* キーパッド */}
            {open && (
                <Keypad
                    onConfirm={(val: string) => setValue('amount', val, { shouldValidate: true })}
                    initialValue={watchedValues.amount}
                />
            )}
        </>
    );
}

export default ProjectCreateWizard;
