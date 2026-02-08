import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react';
import { Button } from '../ui/Button';

type TargetRect = {
    top: number;
    left: number;
    width: number;
    height: number;
    borderRadius: number | string;
} | null;

export function SpotlightTour() {
    const [mounted, setMounted] = useState(false);
    const [step, setStep] = useState<number>(0);
    const [isVisible, setIsVisible] = useState(false);
    const [targetRect, setTargetRect] = useState<TargetRect>(null);

    // ハイドレーション対策
    useEffect(() => {
        setMounted(true);
    }, []);

    // 座標計算
    const updateRect = () => {
        if (step === 0) {
            setTargetRect(null);
            return;
        }

        let targetId = '';
        let borderRadius: number | string = 12;

        if (step === 1) {
            targetId = 'tour-target-today';
            if (!document.getElementById(targetId)) {
                targetId = 'tour-target-calendar';
            }
        } else if (step === 2) {
            targetId = 'tour-target-fab';
            borderRadius = '50%';
        }

        const element = document.getElementById(targetId);
        if (element) {
            const rect = element.getBoundingClientRect();
            const padding = 6;
            setTargetRect({
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + (padding * 2),
                height: rect.height + (padding * 2),
                borderRadius: borderRadius
            });
        } else {
            console.warn(`[Spotlight] Target not found: ${targetId}`);
            // ターゲットが見つからなくてもnullを設定しない（前のrectを維持）
        }
    };

    useEffect(() => {
        if (isVisible && mounted) {
            // stepが変わったら即座に座標を更新
            updateRect();
            const timers = [
                setTimeout(updateRect, 50),
                setTimeout(updateRect, 200),
                setTimeout(updateRect, 500),
                setTimeout(updateRect, 1000)
            ];
            window.addEventListener('resize', updateRect);
            window.addEventListener('scroll', updateRect, true);
            return () => {
                window.removeEventListener('resize', updateRect);
                window.removeEventListener('scroll', updateRect, true);
                timers.forEach(clearTimeout);
            };
        }
    }, [step, isVisible, mounted]);

    useEffect(() => {
        if (!mounted) return;
        const hasSeen = localStorage.getItem('hasSeenSpotlightTour_v8');
        if (!hasSeen) {
            console.log('[Spotlight] Starting tour v8');
            const timer = setTimeout(() => setIsVisible(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [mounted]);

    const handleComplete = () => {
        setIsVisible(false);
        localStorage.setItem('hasSeenSpotlightTour_v8', 'true');
    };

    const handleNext = () => {
        if (step >= 2) handleComplete();
        else setStep(s => s + 1);
    };

    if (!mounted || !isVisible) return null;

    const cardStyle = "bg-gray-800 border-2 border-gray-600 p-6 rounded-2xl shadow-2xl";

    // Step 1/2用のカード位置を計算（targetRectがない場合は画面中央）
    const getStep1Top = () => {
        if (targetRect) {
            return Math.min(targetRect.top + targetRect.height + 24, window.innerHeight - 250);
        }
        return '50%';
    };

    const getStep2Bottom = () => {
        if (targetRect) {
            return window.innerHeight - targetRect.top + 24;
        }
        return 100;
    };

    return (
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
            {/* 背景オーバーレイ */}
            <div
                className="fixed inset-0"
                style={{
                    backgroundColor: (step === 0 || !targetRect) ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
                    boxShadow: (step > 0 && targetRect) ? '0 0 0 9999px rgba(0, 0, 0, 0.8)' : 'none',
                    zIndex: 1
                }}
            />

            {/* スポットライト枠 */}
            {step > 0 && targetRect && (
                <motion.div
                    className="fixed border-2 border-green-500"
                    style={{
                        boxShadow: '0 0 20px rgba(34,197,94,0.5)',
                        zIndex: 2
                    }}
                    initial={false}
                    animate={{
                        top: targetRect.top,
                        left: targetRect.left,
                        width: targetRect.width,
                        height: targetRect.height,
                        borderRadius: targetRect.borderRadius,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}

            {/* スキップボタン */}
            <button
                onClick={handleComplete}
                className="fixed right-4 text-white/70 hover:text-white text-sm font-medium px-4 py-2 rounded-full bg-gray-700/80 backdrop-blur-md"
                style={{
                    top: 'max(env(safe-area-inset-top, 20px), 20px)',
                    zIndex: 1000
                }}
            >
                スキップ
            </button>

            {/* Step 0: Welcome */}
            <AnimatePresence mode="wait">
                {step === 0 && (
                    <motion.div
                        key="welcome"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center p-4"
                        style={{ zIndex: 100 }}
                    >
                        <div className={`${cardStyle} max-w-sm w-full text-center`}>
                            <h2 className="text-2xl font-bold mb-3 text-white">BizFlowへようこそ</h2>
                            <p className="text-gray-300 mb-8 text-sm leading-relaxed">
                                案件管理と資金繰りを劇的にシンプルにする<br />
                                全く新しい体験がここから始まります。
                            </p>
                            <Button onClick={handleNext} className="w-full py-6 text-lg">
                                ツアーを始める
                                <ChevronRight className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Step 1: Calendar - targetRectがなくても表示 */}
                {step === 1 && (
                    <motion.div
                        key="calendar"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed left-0 right-0 flex justify-center px-4"
                        style={{
                            top: typeof getStep1Top() === 'number' ? getStep1Top() : undefined,
                            bottom: typeof getStep1Top() === 'string' ? 'auto' : undefined,
                            transform: typeof getStep1Top() === 'string' ? 'translateY(-50%)' : undefined,
                            ...(typeof getStep1Top() === 'string' && { top: '50%' }),
                            zIndex: 100
                        }}
                    >
                        <div className={`${cardStyle} max-w-xs w-full`}>
                            <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs">1</span>
                                日付を登録
                            </h3>
                            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                                日付をダブルタップして、<br />案件や取引を登録しましょう。
                            </p>
                            <div className="flex justify-end">
                                <Button size="sm" variant="ghost" onClick={handleNext}>次へ</Button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Step 2: FAB - targetRectがなくても表示 */}
                {step === 2 && (
                    <motion.div
                        key="fab"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed right-4 px-4"
                        style={{
                            bottom: getStep2Bottom(),
                            zIndex: 100
                        }}
                    >
                        <div className={`${cardStyle} w-64`}>
                            <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs">2</span>
                                クイック追加
                            </h3>
                            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                                ここからいつでも<br />新しい情報を追加できます。
                            </p>
                            <Button onClick={handleComplete} className="w-full">
                                <Check className="w-4 h-4 mr-2" />
                                準備完了
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
