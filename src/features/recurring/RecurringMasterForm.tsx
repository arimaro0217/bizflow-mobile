```
import { useEffect, useState } from 'react';
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

const recurringSchema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.string().min(1, '金額を入力してください').refine(val => parseFloat(val) > 0, '金額が正しくありません'),
    title: z.string().min(1, '名称を入力してください'),
    clientId: z.string().optional(),
    startDate: z.date(),
    day: z.number().min(1).max(31),
    hasEndDate: z.boolean(),
    endMonths: z.number().min(1).max(60).optional(),
});

type RecurringFormData = z.infer<typeof recurringSchema>;

interface RecurringMasterFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Omit<RecurringMaster, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => void;
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
    const { openKeypad } = useAppStore();
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<RecurringFormData>({
        resolver: zodResolver(recurringSchema),
        defaultValues: {
            type: 'income',
            amount: '0',
            title: '',
            clientId: '',
            startDate: new Date(),
            day: new Date().getDate(),
            hasEndDate: false,
            endMonths: 12,
        }
    });

    const watchedValues = watch();

    // 編集モード時の初期値セット
    useEffect(() => {
        if (open) {
            if (initialMaster) {
                reset({
                    type: initialMaster.type,
                    amount: initialMaster.amount,
                    title: initialMaster.title,
                    clientId: initialMaster.clientId || '',
                    startDate: initialMaster.startDate || new Date(),
                    day: initialMaster.day,
                    hasEndDate: !!initialMaster.endMonths,
                    endMonths: initialMaster.endMonths || 12,
                });
            } else {
                reset({
                    type: 'income',
                    amount: '0',
                    title: '',
                    clientId: selectedClient?.id || '',
                    startDate: new Date(),
                    day: new Date().getDate(),
                    hasEndDate: false,
                    endMonths: 12,
                });
            }
        }
    }, [open, initialMaster, reset, selectedClient]);

    // 取引先が選択されたらフォームに反映
    useEffect(() => {
        if (selectedClient) {
            setValue('clientId', selectedClient.id);
        }
    }, [selectedClient, setValue]);

    const handleFormSubmit = (data: RecurringFormData) => {
        onSubmit({
            type: data.type,
            amount: data.amount,
            title: data.title,
            clientId: data.clientId || undefined,
            startDate: data.startDate,
            day: data.day,
            interval: 'monthly',
            endMonths: data.hasEndDate ? data.endMonths : undefined,
            isActive: true,
        });
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
                disabled={isSubmitting || watchedValues.amount === '0'}
            >
                {initialMaster ? '更新する' : '登録する'}
            </Button>
        </div>
    );

    return (
        <>
            <FormDrawer
                open={open}
                onOpenChange={onOpenChange}

                                        {hasEndDate && (
                                            <select
                                                value={endMonths}
                                                onChange={(e) => setEndMonths(Number(e.target.value))}
                                                className="w-full px-4 py-3 bg-surface rounded-xl text-white outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value={6}>6ヶ月間</option>
                                                <option value={12}>1年間</option>
                                                <option value={24}>2年間</option>
                                                <option value={36}>3年間</option>
                                                <option value={60}>5年間</option>
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* 取引先 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        取引先（入金サイト計算用・任意）
                                    </label>
                                    <button
                                        onClick={onOpenClientSheet}
                                        className="w-full flex items-center gap-3 p-4 bg-surface rounded-xl text-left"
                                    >
                                        <Building2 className="w-5 h-5 text-gray-400" />
                                        <span className={selectedClient ? 'text-white' : 'text-gray-500'}>
                                            {selectedClient?.name || '取引先を選択...'}
                                        </span>
                                    </button>
                                </div>

                                {/* 登録ボタン */}
                                <div className="pt-2 pb-4">
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={amount === '0' || !title.trim()}
                                        size="lg"
                                        className="w-full"
                                    >
                                        {isEditing ? '更新する' : '登録する'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            {/* キーパッド */}
            {open && (
                <Keypad
                    onConfirm={handleAmountConfirm}
                    initialValue={amount}
                />
            )}
        </>
    );
}

export default RecurringMasterForm;
