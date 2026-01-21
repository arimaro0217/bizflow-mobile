import { useState } from 'react';
import { Drawer } from 'vaul';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowDownCircle, ArrowUpCircle, Calendar, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '../../lib/utils';
import { calculateSettlementDate } from '../../lib/settlement';
import { Button, Keypad } from '../../components/ui';
import { useAppStore } from '../../stores/appStore';
import type { Client, Transaction } from '../../types';

interface TransactionFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Omit<Transaction, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => void;
    clients?: Client[];
    onOpenClientSheet?: () => void;
    initialDate?: Date;
    selectedClient?: Client | null;
}

export function TransactionForm({
    open,
    onOpenChange,
    onSubmit,
    onOpenClientSheet,
    initialDate = new Date(),
    selectedClient = null,
}: TransactionFormProps) {
    const { openKeypad } = useAppStore();
    const [type, setType] = useState<'income' | 'expense'>('income');
    const [amount, setAmount] = useState('0');
    const [transactionDate] = useState(initialDate);
    const [memo, setMemo] = useState('');
    const [taxRate] = useState('0.1');

    const handleAmountConfirm = (value: string) => {
        setAmount(value);
    };

    const handleSubmit = () => {
        if (amount === '0' || !amount) return;

        // 入金予定日を計算
        let settlementDate = transactionDate;
        if (selectedClient) {
            settlementDate = calculateSettlementDate(
                transactionDate,
                selectedClient.closingDay,
                selectedClient.paymentMonthOffset,
                selectedClient.paymentDay
            );
        }

        onSubmit({
            type,
            amount,
            taxRate,
            transactionDate,
            settlementDate,
            isSettled: false,
            clientId: selectedClient?.id,
            memo: memo.trim() || undefined,
        });

        // リセット
        setType('income');
        setAmount('0');
        setMemo('');
        // selectedClient is controlled by parent
        onOpenChange(false);
    };

    return (
        <>
            <Drawer.Root open={open} onOpenChange={onOpenChange}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
                    <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none">
                        <div className="bg-surface-dark rounded-t-3xl max-h-[85vh] flex flex-col">
                            {/* ハンドル */}
                            <div className="flex justify-center py-3">
                                <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
                            </div>

                            {/* ヘッダー */}
                            <div className="px-6 pb-4">
                                <h2 className="text-xl font-semibold text-white">取引を登録</h2>
                            </div>

                            {/* コンテンツ */}
                            <div className="flex-1 overflow-y-auto px-6 pb-safe space-y-6">
                                {/* 収入/支出切替 */}
                                <div className="grid grid-cols-2 gap-2">
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setType('income')}
                                        className={cn(
                                            'flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-colors',
                                            type === 'income'
                                                ? 'bg-income text-white'
                                                : 'bg-surface-light text-gray-400'
                                        )}
                                    >
                                        <ArrowDownCircle className="w-5 h-5" />
                                        収入
                                    </motion.button>
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setType('expense')}
                                        className={cn(
                                            'flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-colors',
                                            type === 'expense'
                                                ? 'bg-expense text-white'
                                                : 'bg-surface-light text-gray-400'
                                        )}
                                    >
                                        <ArrowUpCircle className="w-5 h-5" />
                                        支出
                                    </motion.button>
                                </div>

                                {/* 金額入力 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        金額
                                    </label>
                                    <button
                                        onClick={openKeypad}
                                        className="w-full p-4 bg-surface rounded-xl text-right"
                                    >
                                        <span className={cn(
                                            'text-3xl font-semibold tabular-nums',
                                            amount !== '0'
                                                ? type === 'income' ? 'text-income' : 'text-expense'
                                                : 'text-gray-500'
                                        )}>
                                            {formatCurrency(amount)}
                                        </span>
                                    </button>
                                </div>

                                {/* 日付 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        日付
                                    </label>
                                    <button className="w-full flex items-center gap-3 p-4 bg-surface rounded-xl text-left">
                                        <Calendar className="w-5 h-5 text-gray-400" />
                                        <span className="text-white">
                                            {format(transactionDate, 'yyyy年M月d日 (E)', { locale: ja })}
                                        </span>
                                    </button>
                                </div>

                                {/* 取引先 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        取引先（任意）
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

                                {/* メモ */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        メモ（任意）
                                    </label>
                                    <input
                                        type="text"
                                        value={memo}
                                        onChange={(e) => setMemo(e.target.value)}
                                        placeholder="メモを入力..."
                                        className="w-full px-4 py-3 bg-surface rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                {/* 登録ボタン */}
                                <div className="pt-2 pb-4">
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={amount === '0'}
                                        size="lg"
                                        className="w-full"
                                    >
                                        登録する
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            {/* キーパッド */}
            <Keypad
                onConfirm={handleAmountConfirm}
                initialValue={amount}
            />
        </>
    );
}

export default TransactionForm;
