import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Decimal from 'decimal.js';
import { Delete, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../stores/appStore';
import { useVisualViewport } from '../../hooks/useVisualViewport';

interface KeypadProps {
    onConfirm: (value: string) => void;
    onCancel?: () => void;
    initialValue?: string;
}

type Operator = '+' | '-' | '×' | '÷' | null;

export function Keypad({ onConfirm, onCancel, initialValue = '' }: KeypadProps) {
    const { isKeypadOpen, closeKeypad } = useAppStore();
    const [displayValue, setDisplayValue] = useState(initialValue || '0');
    const [previousValue, setPreviousValue] = useState<string | null>(null);
    const [operator, setOperator] = useState<Operator>(null);
    const [waitingForOperand, setWaitingForOperand] = useState(false);

    const viewport = useVisualViewport();

    // 開くたびに状態をリセット
    useEffect(() => {
        if (isKeypadOpen) {
            setPreviousValue(null);
            setOperator(null);
            setWaitingForOperand(false);
            setDisplayValue(initialValue || '0');
        }
    }, [isKeypadOpen, initialValue]);

    // 背景スクロール防止
    useEffect(() => {
        if (isKeypadOpen) {
            const body = document.body;
            const originalOverflow = body.style.overflow;
            // 既にhiddenの場合は二重にセットしない（vaul等の干渉を避ける）
            if (originalOverflow !== 'hidden') {
                body.style.overflow = 'hidden';
                return () => {
                    body.style.overflow = originalOverflow;
                };
            }
        }
    }, [isKeypadOpen]);

    const handleNumberInput = useCallback((num: string) => {
        if (waitingForOperand) {
            setDisplayValue(num);
            setWaitingForOperand(false);
        } else {
            setDisplayValue(prev =>
                prev === '0' ? num : prev + num
            );
        }
    }, [waitingForOperand]);

    const handleOperator = useCallback((op: Operator) => {
        if (previousValue !== null && operator && !waitingForOperand) {
            // 計算実行
            const result = calculate(previousValue, displayValue, operator);
            setDisplayValue(result);
            setPreviousValue(result);
        } else {
            setPreviousValue(displayValue);
        }
        setOperator(op);
        setWaitingForOperand(true);
    }, [previousValue, displayValue, operator, waitingForOperand]);

    const calculate = (left: string, right: string, op: Operator): string => {
        const a = new Decimal(left);
        const b = new Decimal(right);

        switch (op) {
            case '+':
                return a.plus(b).toFixed(0);
            case '-':
                return a.minus(b).toFixed(0);
            case '×':
                return a.times(b).toFixed(0);
            case '÷':
                if (b.isZero()) return '0';
                return a.dividedBy(b).toFixed(0);
            default:
                return right;
        }
    };

    const handleClear = useCallback(() => {
        setDisplayValue('0');
        setPreviousValue(null);
        setOperator(null);
        setWaitingForOperand(false);
    }, []);

    const handleBackspace = useCallback(() => {
        setDisplayValue(prev => {
            if (prev.length === 1) return '0';
            return prev.slice(0, -1);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        // 演算途中の場合は計算を完了
        if (previousValue !== null && operator) {
            const result = calculate(previousValue, displayValue, operator);
            onConfirm(result);
        } else {
            onConfirm(displayValue);
        }
        closeKeypad();
    }, [displayValue, previousValue, operator, onConfirm, closeKeypad]);

    const handleCancel = useCallback(() => {
        onCancel?.();
        closeKeypad();
    }, [onCancel, closeKeypad]);

    // キーボードイベントリスナー（PC/外付けキーボード対応）
    useEffect(() => {
        if (!isKeypadOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // 数字キー (0-9)
            if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                handleNumberInput(e.key);
                return;
            }

            // 演算子
            switch (e.key) {
                case '+':
                    e.preventDefault();
                    handleOperator('+');
                    break;
                case '-':
                    e.preventDefault();
                    handleOperator('-');
                    break;
                case '*':
                    e.preventDefault();
                    handleOperator('×');
                    break;
                case '/':
                    e.preventDefault();
                    handleOperator('÷');
                    break;
                case 'Enter':
                case '=':
                    e.preventDefault();
                    handleConfirm();
                    break;
                case 'Backspace':
                    e.preventDefault();
                    handleBackspace();
                    break;
                case 'Escape':
                    e.preventDefault();
                    handleCancel();
                    break;
                case 'c':
                case 'C':
                    e.preventDefault();
                    handleClear();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isKeypadOpen, handleNumberInput, handleOperator, handleConfirm, handleBackspace, handleCancel, handleClear]);

    const formatDisplay = (value: string): string => {
        try {
            const num = new Decimal(value);
            return num.toNumber().toLocaleString('ja-JP');
        } catch {
            return value;
        }
    };

    const keys = [
        ['7', '8', '9', '÷'],
        ['4', '5', '6', '×'],
        ['1', '2', '3', '-'],
        ['C', '0', '00', '+'],
    ];

    // ビジュアルビューポートに合わせたスタイル
    // iOS等でキーボードが出ている際も、表示領域全体を覆うように調整
    const containerStyle = viewport ? {
        top: `${viewport.offsetTop}px`,
        height: `${viewport.height}px`,
    } : {
        top: 0,
        bottom: 0,
    };

    // AnimatePresence を Portal の中に配置し、条件分岐を内部で行う
    return createPortal(
        <AnimatePresence>
            {isKeypadOpen && (
                <>
                    {/* オーバーレイ */}
                    <motion.div
                        key="keypad-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-[9998] touch-none pointer-events-auto"
                        onClick={handleCancel}
                    />

                    {/* キーパッドコンテナ */}
                    <div
                        className="fixed inset-x-0 z-[9999] flex items-end md:items-center justify-center pointer-events-none"
                        style={containerStyle}
                    >
                        <motion.div
                            key="keypad-content"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="w-full md:max-w-sm bg-surface-dark rounded-t-3xl md:rounded-2xl pb-safe md:pb-6 pointer-events-auto shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* ハンドル（モバイルのみ） */}
                            <div className="flex justify-center py-3 md:hidden">
                                <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
                            </div>

                            {/* ディスプレイ */}
                            <div className="px-6 pb-4">
                                <div className="bg-surface rounded-2xl p-4">
                                    {/* 演算表示 */}
                                    {previousValue !== null && operator && (
                                        <p className="text-gray-500 text-right text-sm mb-1">
                                            {formatDisplay(previousValue)} {operator}
                                        </p>
                                    )}
                                    {/* 現在値 */}
                                    <p className="text-white text-right text-4xl font-semibold tabular-nums">
                                        ¥{formatDisplay(displayValue)}
                                    </p>
                                </div>
                            </div>

                            {/* キーエリア */}
                            <div className="px-4 pb-4">
                                <div className="grid grid-cols-4 gap-2">
                                    {keys.flat().map((key) => (
                                        <KeypadButton
                                            key={key}
                                            value={key}
                                            onPress={() => {
                                                if (key === 'C') {
                                                    handleClear();
                                                } else if (['+', '-', '×', '÷'].includes(key)) {
                                                    handleOperator(key as Operator);
                                                } else {
                                                    handleNumberInput(key);
                                                }
                                            }}
                                            isOperator={['+', '-', '×', '÷'].includes(key)}
                                            isActive={operator === key && waitingForOperand}
                                        />
                                    ))}
                                </div>

                                {/* 下部ボタン */}
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <button
                                        onClick={handleCancel}
                                        className="h-14 rounded-2xl bg-surface-light text-gray-400 flex items-center justify-center active:scale-95 transition-transform"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={handleBackspace}
                                        className="h-14 rounded-2xl bg-surface-light text-gray-400 flex items-center justify-center active:scale-95 transition-transform"
                                    >
                                        <Delete className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        className="h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center active:scale-95 transition-transform"
                                    >
                                        <Check className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}

interface KeypadButtonProps {
    value: string;
    onPress: () => void;
    isOperator?: boolean;
    isActive?: boolean;
}

function KeypadButton({ value, onPress, isOperator, isActive }: KeypadButtonProps) {
    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onPress}
            // onTouchStart/onPointerDownでのstopPropagationは削除（クリックイベントが阻害される可能性があるため）
            // コンテナ側でタッチイベントを制御しているため、ボタン側では伝播させても問題ない（むしろさせるべき）
            className={cn(
                'h-14 rounded-2xl text-xl font-medium transition-colors pointer-events-auto touch-manipulation select-none',
                isOperator
                    ? isActive
                        ? 'bg-primary-600 text-white'
                        : 'bg-primary-600/20 text-primary-400'
                    : value === 'C'
                        ? 'bg-expense/20 text-expense'
                        : 'bg-surface-light text-white'
            )}
        >
            {value}
        </motion.button>
    );
}

export default Keypad;
