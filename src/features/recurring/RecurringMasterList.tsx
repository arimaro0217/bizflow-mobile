import { useState } from 'react';
import { motion } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Pencil, Trash2, Repeat, Calendar } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import type { RecurringMaster } from '../../types';

interface RecurringMasterListProps {
    masters: RecurringMaster[];
    onEdit?: (master: RecurringMaster) => void;
    onDelete?: (master: RecurringMaster) => void;
    onToggleActive?: (master: RecurringMaster, isActive: boolean) => void;
}

export function RecurringMasterList({
    masters,
    onEdit,
    onDelete,
    onToggleActive,
}: RecurringMasterListProps) {
    if (masters.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Repeat className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">定期取引はまだ登録されていません</p>
                <p className="text-xs mt-1">右下の＋ボタンから登録できます</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {masters.map((master) => (
                <RecurringMasterItem
                    key={master.id}
                    master={master}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                />
            ))}
        </div>
    );
}

interface RecurringMasterItemProps {
    master: RecurringMaster;
    onEdit?: (master: RecurringMaster) => void;
    onDelete?: (master: RecurringMaster) => void;
    onToggleActive?: (master: RecurringMaster, isActive: boolean) => void;
}

function RecurringMasterItem({
    master,
    onEdit,
    onDelete,
    onToggleActive,
}: RecurringMasterItemProps) {
    const [offsetX, setOffsetX] = useState(0);

    const bind = useDrag(
        ({ offset: [x], last, velocity: [vx], direction: [xDir] }) => {
            if (last) {
                if (x < -60 || (vx > 0.5 && xDir < 0)) {
                    setOffsetX(-120);
                } else {
                    setOffsetX(0);
                }
            } else {
                setOffsetX(Math.min(0, Math.max(-120, x)));
            }
        },
        {
            axis: 'x',
            from: () => [offsetX, 0],
            bounds: { left: -120, right: 0 },
            rubberband: true,
            filterTaps: true,
        }
    );

    const handleClose = () => {
        setOffsetX(0);
    };

    // 頻度の表示テキスト
    const frequencyText = master.frequency === 'monthly'
        ? `毎月${master.dayOfPeriod === 31 ? '月末' : `${master.dayOfPeriod}日`}`
        : `毎年${master.monthOfYear}月${master.dayOfPeriod === 31 ? '末' : `${master.dayOfPeriod}日`}`;

    return (
        <div className="relative overflow-hidden rounded-xl">
            {/* アクションボタン（背景） */}
            <div className="absolute inset-y-0 right-0 flex">
                <button
                    onClick={() => {
                        onEdit?.(master);
                        handleClose();
                    }}
                    className="w-15 bg-primary-600 flex items-center justify-center"
                    style={{ width: 60 }}
                >
                    <Pencil className="w-5 h-5 text-white" />
                </button>
                <button
                    onClick={() => {
                        onDelete?.(master);
                        handleClose();
                    }}
                    className="w-15 bg-expense flex items-center justify-center"
                    style={{ width: 60 }}
                >
                    <Trash2 className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* コンテンツ */}
            <motion.div
                {...(bind() as any)}
                style={{ x: offsetX }}
                className={cn(
                    'relative bg-surface-light p-4 rounded-xl touch-pan-y',
                    !master.isActive && 'opacity-50'
                )}
            >
                <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                        {/* タイトル */}
                        <div className="flex items-center gap-2">
                            <Repeat className="w-4 h-4 text-primary-400 flex-shrink-0" />
                            <p className="text-white font-medium truncate">
                                {master.title}
                            </p>
                        </div>

                        {/* 頻度と次回日付 */}
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-gray-400 text-sm">
                                {frequencyText}
                            </span>
                            {master.startDate && (
                                <span className="text-gray-500 text-xs flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(master.startDate, 'yyyy/M/d', { locale: ja })}〜
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 金額とトグル */}
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className={cn(
                                'font-semibold text-lg tabular-nums',
                                master.type === 'income' ? 'text-income' : 'text-expense'
                            )}>
                                {master.type === 'income' ? '+' : '-'}
                                {formatCurrency(master.baseAmount)}
                            </p>
                        </div>

                        {/* ON/OFFトグル */}
                        <button
                            onClick={() => onToggleActive?.(master, !master.isActive)}
                            className={cn(
                                'w-12 h-6 rounded-full transition-colors relative',
                                master.isActive ? 'bg-primary-500' : 'bg-gray-600'
                            )}
                        >
                            <motion.div
                                animate={{ x: master.isActive ? 24 : 2 }}
                                className="absolute top-1 w-4 h-4 bg-white rounded-full"
                            />
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default RecurringMasterList;
