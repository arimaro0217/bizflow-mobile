import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { addMonths } from 'date-fns';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Calendar,
    Building2,
    Repeat,
    CalendarDays,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '../../lib/utils';
import { Button, Keypad } from '../../components/ui';
import { useAppStore } from '../../stores/appStore';
import type { Client, RecurringMaster } from '../../types';

interface RecurringMasterFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: RecurringMasterFormData) => void;
    clients?: Client[];
    onOpenClientSheet?: () => void;
    selectedClient?: Client | null;
    initialMaster?: RecurringMaster | null;
}

export interface RecurringMasterFormData {
    title: string;
    baseAmount: string;
    type: 'income' | 'expense';
    clientId?: string;
    memo?: string;
    frequency: 'monthly' | 'yearly';
    dayOfPeriod: number;
    monthOfYear?: number;
    startDate: Date;
    endDate?: Date | null;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
];

export function RecurringMasterForm({
    open,
    onOpenChange,
    onSubmit,
    onOpenClientSheet,
    selectedClient = null,
    initialMaster = null,
}: RecurringMasterFormProps) {
    const { openKeypad, isKeypadOpen } = useAppStore();

    const [title, setTitle] = useState('');
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [amount, setAmount] = useState('0');
    const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
    const [dayOfPeriod, setDayOfPeriod] = useState(25);
    const [monthOfYear, setMonthOfYear] = useState(1);
    const [startDate] = useState(new Date());
    const [hasEndDate, setHasEndDate] = useState(false);
    const [endMonths, setEndMonths] = useState(12);

    // 編集モード時の初期値セット
    useEffect(() => {
        if (open) {
            if (initialMaster) {
                setTitle(initialMaster.title);
                setType(initialMaster.type);
                setAmount(initialMaster.baseAmount);
                setFrequency(initialMaster.frequency);
                setDayOfPeriod(initialMaster.dayOfPeriod);
                setMonthOfYear(initialMaster.monthOfYear || 1);
                setHasEndDate(!!initialMaster.endDate);
            } else {
                setTitle('');
                setType('expense');
                setAmount('0');
                setFrequency('monthly');
                setDayOfPeriod(25);
                setMonthOfYear(1);
                setHasEndDate(false);
                setEndMonths(12);
            }
        }
    }, [open, initialMaster]);

    const handleAmountConfirm = (value: string) => {
        setAmount(value);
    };

    const handleSubmit = () => {
        if (amount === '0' || !amount || !title.trim()) return;

        const data: RecurringMasterFormData = {
            title: title.trim(),
            baseAmount: amount,
            type,
            clientId: selectedClient?.id,
            frequency,
            dayOfPeriod,
            ...(frequency === 'yearly' && { monthOfYear }),
            startDate,
            endDate: hasEndDate ? addMonths(startDate, endMonths) : null,
        };

        onSubmit(data);

        // リセット
        setTitle('');
        setType('expense');
        setAmount('0');
        setFrequency('monthly');
        setDayOfPeriod(25);
        setHasEndDate(false);
        onOpenChange(false);
    };

    const isEditing = !!initialMaster;

    return (
        <>
            <Drawer.Root
                open={open}
                onOpenChange={onOpenChange}
                dismissible={!isKeypadOpen}
            >
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
                    <Drawer.Content
                        className="fixed bottom-0 left-0 right-0 z-50 outline-none"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        <div className="bg-surface-dark rounded-t-3xl max-h-[90vh] flex flex-col">
                            {/* ハンドル */}
                            <div className="flex justify-center py-3">
                                <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
                            </div>

                            {/* ヘッダー */}
                            <div className="px-6 pb-4">
                                <h2 className="text-xl font-semibold text-white">
                                    {isEditing ? '定期取引を編集' : '定期取引を登録'}
                                </h2>
                            </div>

                            {/* コンテンツ */}
                            <div className="flex-1 overflow-y-auto px-6 pb-safe space-y-5">
                                {/* タイトル */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        タイトル
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="例: 家賃、サーバー代"
                                        className="w-full px-4 py-3 bg-surface rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                {/* 収入/支出切替 */}
                                <div className="grid grid-cols-2 gap-2">
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setType('income')}
                                        className={cn(
                                            'flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors',
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
                                            'flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors',
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

                                {/* 頻度 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        <Repeat className="w-4 h-4 inline mr-1" />
                                        繰り返し
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setFrequency('monthly')}
                                            className={cn(
                                                'py-3 rounded-xl font-medium transition-colors',
                                                frequency === 'monthly'
                                                    ? 'bg-primary-500 text-white'
                                                    : 'bg-surface-light text-gray-400'
                                            )}
                                        >
                                            毎月
                                        </button>
                                        <button
                                            onClick={() => setFrequency('yearly')}
                                            className={cn(
                                                'py-3 rounded-xl font-medium transition-colors',
                                                frequency === 'yearly'
                                                    ? 'bg-primary-500 text-white'
                                                    : 'bg-surface-light text-gray-400'
                                            )}
                                        >
                                            毎年
                                        </button>
                                    </div>
                                </div>

                                {/* 日付指定 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        <CalendarDays className="w-4 h-4 inline mr-1" />
                                        {frequency === 'monthly' ? '毎月' : '毎年'}の発生日
                                    </label>

                                    <div className="flex gap-2">
                                        {/* 月選択（yearlyの場合のみ） */}
                                        {frequency === 'yearly' && (
                                            <select
                                                value={monthOfYear}
                                                onChange={(e) => setMonthOfYear(Number(e.target.value))}
                                                className="flex-1 px-4 py-3 bg-surface rounded-xl text-white outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                {MONTHS.map((month, i) => (
                                                    <option key={i} value={i + 1}>{month}</option>
                                                ))}
                                            </select>
                                        )}

                                        {/* 日選択 */}
                                        <select
                                            value={dayOfPeriod}
                                            onChange={(e) => setDayOfPeriod(Number(e.target.value))}
                                            className="flex-1 px-4 py-3 bg-surface rounded-xl text-white outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            {DAYS.map((day) => (
                                                <option key={day} value={day}>
                                                    {day === 31 ? '月末' : `${day}日`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* 期間設定 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        <Calendar className="w-4 h-4 inline mr-1" />
                                        期間
                                    </label>
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => setHasEndDate(false)}
                                            className={cn(
                                                'w-full py-3 px-4 rounded-xl text-left transition-colors',
                                                !hasEndDate
                                                    ? 'bg-primary-500 text-white'
                                                    : 'bg-surface-light text-gray-400'
                                            )}
                                        >
                                            無期限
                                        </button>
                                        <button
                                            onClick={() => setHasEndDate(true)}
                                            className={cn(
                                                'w-full py-3 px-4 rounded-xl text-left transition-colors',
                                                hasEndDate
                                                    ? 'bg-primary-500 text-white'
                                                    : 'bg-surface-light text-gray-400'
                                            )}
                                        >
                                            期間を指定
                                        </button>

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
            <Keypad
                onConfirm={handleAmountConfirm}
                initialValue={amount}
            />
        </>
    );
}

export default RecurringMasterForm;
