import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { calculateSettlementDate } from '../../lib/settlement';
import { Button, Keypad, DatePicker } from '../../components/ui';
import { FormDrawer } from '../../components/ui/FormDrawer';
import { FormAmountInput, FormDatePicker, FormSelectButton, FormTextArea } from '../../components/ui/FormInputs';
import { useAppStore } from '../../stores/appStore';
import type { Client, Transaction } from '../../types';

const transactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.string().min(1, '金額を入力してください').refine(val => parseFloat(val) >= 0, '金額が正しくありません'),
    transactionDate: z.date(),
    memo: z.string().optional(),
    clientId: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Omit<Transaction, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => void;
    clients?: Client[];
    onOpenClientSheet?: () => void;
    initialDate?: Date;
    selectedClient?: Client | null;
    initialTransaction?: Transaction | null;
    onDelete?: (transaction: Transaction) => void;
    onCancel?: () => void;
}

export function TransactionForm({
    open,
    onOpenChange,
    onSubmit,
    onOpenClientSheet,
    initialDate = new Date(),
    selectedClient = null,
    initialTransaction = null,
    onDelete,
    onCancel,
}: TransactionFormProps) {
    const { openKeypad } = useAppStore();
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<TransactionFormData>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            type: 'income',
            amount: '0',
            transactionDate: initialDate,
            memo: '',
            clientId: '',
        }
    });

    const watchedValues = watch();

    // 編集モード時の初期値セット
    useEffect(() => {
        if (open) {
            if (initialTransaction) {
                reset({
                    type: initialTransaction.type,
                    amount: initialTransaction.amount,
                    transactionDate: initialTransaction.transactionDate || new Date(),
                    memo: initialTransaction.memo || '',
                    clientId: initialTransaction.clientId || '',
                });
            } else {
                reset({
                    type: 'income',
                    amount: '0',
                    transactionDate: initialDate,
                    memo: '',
                    clientId: selectedClient?.id || '',
                });
            }
        }
    }, [open, initialTransaction, initialDate, reset, selectedClient]);

    // 取引先が選択されたらフォームに反映
    useEffect(() => {
        if (selectedClient) {
            setValue('clientId', selectedClient.id);
        }
    }, [selectedClient, setValue]);

    const handleFormSubmit = (data: TransactionFormData) => {
        if (data.amount === '0' || !data.amount) return;

        const dateWithNoon = new Date(data.transactionDate);
        dateWithNoon.setHours(12, 0, 0, 0);

        let settlementDate = dateWithNoon;
        if (selectedClient) {
            settlementDate = calculateSettlementDate(
                dateWithNoon,
                selectedClient.closingDay,
                selectedClient.paymentMonthOffset,
                selectedClient.paymentDay
            );
        } else if (initialTransaction?.settlementDate) {
            settlementDate = new Date(initialTransaction.settlementDate);
            settlementDate.setHours(12, 0, 0, 0);
        }

        onSubmit({
            type: data.type,
            amount: data.amount,
            taxRate: '0.1',
            transactionDate: dateWithNoon,
            settlementDate,
            isSettled: initialTransaction ? initialTransaction.isSettled : false,
            clientId: data.clientId || undefined,
            memo: data.memo?.trim() || undefined,
        });
        onOpenChange(false); // Close drawer after submission
    };

    const footer = (
        <div className="flex gap-3">
            {initialTransaction && onDelete && (
                <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                        onDelete(initialTransaction);
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
                {initialTransaction ? '更新する' : '登録する'}
            </Button>
        </div>
    );

    return (
        <>
            <FormDrawer
                open={open}
                onOpenChange={onOpenChange}
                title={initialTransaction ? '取引を編集' : '取引を登録'}
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

                {/* 金額入力 */}
                <FormAmountInput
                    value={watchedValues.amount}
                    type={watchedValues.type}
                    onClick={openKeypad}
                    error={errors.amount?.message}
                />

                {/* 日付 */}
                <FormDatePicker
                    date={watchedValues.transactionDate}
                    onClick={() => setIsDatePickerOpen(true)}
                    error={errors.transactionDate?.message}
                />

                {/* 取引先 */}
                <FormSelectButton
                    label="取引先（任意）"
                    placeholder="取引先を選択..."
                    value={watchedValues.clientId}
                    displayValue={selectedClient?.name}
                    onClick={onOpenClientSheet}
                />

                {/* メモ */}
                <FormTextArea
                    label="メモ"
                    placeholder="備考などを入力..."
                    {...register('memo')}
                />
            </FormDrawer>

            {/* キーパッド */}
            {open && (
                <Keypad
                    onConfirm={(val) => setValue('amount', val, { shouldValidate: true })}
                    initialValue={watchedValues.amount}
                />
            )}

            {/* 日付ピッカー */}
            <DatePicker
                open={isDatePickerOpen}
                onOpenChange={setIsDatePickerOpen}
                value={watchedValues.transactionDate}
                onConfirm={(date) => {
                    setValue('transactionDate', date, { shouldValidate: true });
                    setIsDatePickerOpen(false);
                }}
            />
        </>
    );
}

export default TransactionForm;
