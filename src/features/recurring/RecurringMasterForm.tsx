import { useCallback, useState } from 'react';
import { useFormSync } from '../../hooks/useFormSync';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowDownCircle, ArrowUpCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Button, Keypad, DatePicker } from '../../components/ui';
import { FormDrawer } from '../../components/ui/FormDrawer';
import { FormAmountInput, FormDatePicker, FormSelectButton, FormTextInput, FormField } from '../../components/ui/FormInputs';
import { useAppStore } from '../../stores/appStore';
import type { Client, RecurringMaster } from '../../types';
import type { CreateRecurringMasterInput } from '../../hooks/useRecurringMasters';

const recurringSchema = z.object({
    type: z.enum(['income', 'expense']),
    baseAmount: z.string().min(1, '金額を入力してください').refine(val => parseFloat(val) > 0, '金額が正しくありません'),
    title: z.string().min(1, '名称を入力してください'),
    clientId: z.string().optional(),
    startDate: z.date(),
    dayOfPeriod: z.number().min(1).max(31),
    hasEndDate: z.boolean(),
    endDate: z.date().optional(),
});

export type RecurringMasterFormData = z.infer<typeof recurringSchema>;

interface RecurringMasterFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: CreateRecurringMasterInput) => void;
    clients: Client[];
    onOpenClientSheet: () => void;
    selectedClient?: Client | null;
    initialMaster?: RecurringMaster | null;
    onDelete?: (master: RecurringMaster) => void;
}

export function RecurringMasterForm({
    open,
    onOpenChange,
    onSubmit,
    clients,
    onOpenClientSheet,
    selectedClient = null,
    initialMaster = null,
    onDelete,
}: RecurringMasterFormProps) {
    const { openKeypad, closeKeypad } = useAppStore();
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<RecurringMasterFormData>({
        resolver: zodResolver(recurringSchema),
        defaultValues: {
            type: 'income',
            baseAmount: '0',
            title: '',
            clientId: '',
            startDate: new Date(),
            dayOfPeriod: new Date().getDate(),
            hasEndDate: false,
        }
    });

    const watchedValues = watch();

    const handleReset = useCallback(() => {
        if (initialMaster) {
            reset({
                type: initialMaster.type,
                baseAmount: initialMaster.baseAmount,
                title: initialMaster.title,
                clientId: initialMaster.clientId || '',
                startDate: initialMaster.startDate || new Date(),
                dayOfPeriod: initialMaster.dayOfPeriod,
                hasEndDate: !!initialMaster.endDate,
                endDate: initialMaster.endDate || undefined,
            });
        } else {
            reset({
                type: 'income',
                baseAmount: '0',
                title: '',
                clientId: selectedClient?.id || '',
                startDate: new Date(),
                dayOfPeriod: new Date().getDate(),
                hasEndDate: false,
            });
        }
    }, [reset, initialMaster, selectedClient]);

    // フォーム同期フックの使用
    useFormSync({
        form: { setValue } as any,
        open,
        selectedClient,
        clientIdField: 'clientId',
        onReset: handleReset
    });

    const handleFormSubmit = (data: RecurringMasterFormData) => {
        onSubmit({
            type: data.type,
            baseAmount: data.baseAmount,
            title: data.title,
            clientId: data.clientId || undefined,
            startDate: data.startDate,
            dayOfPeriod: data.dayOfPeriod,
            frequency: 'monthly',
            endDate: data.hasEndDate ? data.endDate || null : null,
            isActive: true,
            memo: data.title, // Use title as memo if not provided or just placeholder
        });
        closeKeypad();
        onOpenChange(false);
    };

    const footer = (
        <div className="flex gap-3">
            {initialMaster && onDelete && (
                <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                        onDelete(initialMaster);
                        onOpenChange(false);
                    }}
                >
                    削除
                </Button>
            )}
            <Button
                className="flex-[2] bg-primary-600 hover:bg-primary-500 text-white"
                onClick={handleSubmit(handleFormSubmit)}
                disabled={isSubmitting || watchedValues.baseAmount === '0'}
            >
                {initialMaster ? '更新する' : '登録する'}
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
                title={initialMaster ? '定期取引を編集' : '定期取引を登録'}
                footer={footer}
            >
                {/* 収入/支出切替 */}
                <div className="grid grid-cols-2 gap-2">
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setValue('type', 'income')}
                        className={cn(
                            'flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-colors',
                            watchedValues.type === 'income'
                                ? 'bg-income text-white'
                                : 'bg-surface-light text-gray-400'
                        )}
                    >
                        <ArrowDownCircle className="w-5 h-5" />
                        収入
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setValue('type', 'expense')}
                        className={cn(
                            'flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-colors',
                            watchedValues.type === 'expense'
                                ? 'bg-expense text-white'
                                : 'bg-surface-light text-gray-400'
                        )}
                    >
                        <ArrowUpCircle className="w-5 h-5" />
                        支出
                    </motion.button>
                </div>

                {/* 名称 */}
                <FormTextInput
                    label="名称"
                    placeholder="例: 月額サーバー費用"
                    {...register('title')}
                    error={errors.title?.message}
                />

                {/* 金額入力 */}
                <FormAmountInput
                    value={watchedValues.baseAmount}
                    type={watchedValues.type}
                    onClick={openKeypad}
                    error={errors.baseAmount?.message}
                />

                {/* 開始日 */}
                <FormDatePicker
                    label="開始月"
                    date={watchedValues.startDate}
                    onClick={() => setIsDatePickerOpen(true)}
                    error={errors.startDate?.message}
                />

                {/* 毎月の日付 */}
                <FormField label="毎月の振替日" error={errors.dayOfPeriod?.message}>
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min="1"
                            max="31"
                            {...register('dayOfPeriod', { valueAsNumber: true })}
                            className="flex-1 accent-primary-500"
                        />
                        <span className="text-2xl font-semibold text-white tabular-nums w-12 text-center">
                            {watchedValues.dayOfPeriod}日
                        </span>
                    </div>
                </FormField>

                {/* 取引先 */}
                <FormSelectButton
                    label="取引先（任意）"
                    placeholder="取引先を選択..."
                    value={watchedValues.clientId}
                    displayValue={selectedClient?.name || clients.find(c => c.id === watchedValues.clientId)?.name}
                    onClick={onOpenClientSheet}
                />

                {/* 終了設定 */}
                <div className="space-y-4 pt-2">
                    <button
                        type="button"
                        onClick={() => setValue('hasEndDate', !watchedValues.hasEndDate)}
                        className="flex items-center gap-3 w-full"
                    >
                        <div className={cn(
                            "w-6 h-6 rounded-md border flex items-center justify-center transition-colors",
                            watchedValues.hasEndDate ? "bg-primary-500 border-primary-500" : "border-gray-600"
                        )}>
                            {watchedValues.hasEndDate && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                        </div>
                        <span className="text-white font-medium">終了期限を設定する</span>
                    </button>

                    {watchedValues.hasEndDate && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="pl-9 space-y-3"
                        >
                            <FormDatePicker
                                label="終了日"
                                date={watchedValues.endDate || new Date()}
                                onClick={() => setIsEndDatePickerOpen(true)}
                                error={errors.endDate?.message}
                            />
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Info className="w-3 h-3" />
                                終了期限を過ぎると、自動的に「無効」になります。
                            </p>
                        </motion.div>
                    )}
                </div>
            </FormDrawer>

            {/* キーパッド */}
            {open && (
                <Keypad
                    onConfirm={(val) => setValue('baseAmount', val, { shouldValidate: true })}
                    initialValue={watchedValues.baseAmount}
                />
            )}

            {/* 日付ピッカー */}
            <DatePicker
                open={isDatePickerOpen}
                onOpenChange={setIsDatePickerOpen}
                value={watchedValues.startDate}
                onConfirm={(date) => {
                    setValue('startDate', date, { shouldValidate: true });
                    setIsDatePickerOpen(false);
                }}
            />

            {/* 終了日ピッカー */}
            <DatePicker
                open={isEndDatePickerOpen}
                onOpenChange={setIsEndDatePickerOpen}
                value={watchedValues.endDate || new Date()}
                onConfirm={(date) => {
                    setValue('endDate', date, { shouldValidate: true });
                    setIsEndDatePickerOpen(false);
                }}
            />
        </>
    );
}

export default RecurringMasterForm;
