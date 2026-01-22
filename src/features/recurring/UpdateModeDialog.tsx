import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui';
import { createPortal } from 'react-dom';

interface UpdateModeDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (mode: 'single' | 'future') => void;
    isSettled?: boolean; // 消込済みの場合はfutureを制限
}

/**
 * Googleカレンダー方式の更新モード選択ダイアログ
 * 「この予定のみ」「これ以降すべて」を選択
 */
export function UpdateModeDialog({
    open,
    onClose,
    onSelect,
    isSettled = false,
}: UpdateModeDialogProps) {
    if (!open) return null;

    const content = (
        <AnimatePresence>
            {open && (
                <>
                    {/* オーバーレイ */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-[100]"
                    />

                    {/* ダイアログ */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                    >
                        <div className="bg-surface-dark rounded-2xl w-full max-w-sm shadow-xl border border-white/10">
                            {/* ヘッダー */}
                            <div className="p-6 pb-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5 text-primary-400" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-white">
                                        定期取引の変更
                                    </h2>
                                </div>
                                <p className="text-sm text-gray-400 ml-13">
                                    この取引は定期取引です。どの範囲を変更しますか？
                                </p>
                            </div>

                            {/* オプション */}
                            <div className="px-6 pb-4 space-y-3">
                                <button
                                    onClick={() => onSelect('single')}
                                    className="w-full p-4 bg-surface rounded-xl text-left hover:bg-surface-light transition-colors border border-white/5"
                                >
                                    <p className="text-white font-medium">この予定のみ変更</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        選択した日付の取引だけを変更します
                                    </p>
                                </button>

                                <button
                                    onClick={() => onSelect('future')}
                                    disabled={isSettled}
                                    className={`w-full p-4 bg-surface rounded-xl text-left transition-colors border border-white/5 ${isSettled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-surface-light'
                                        }`}
                                >
                                    <p className="text-white font-medium">これ以降すべての予定を変更</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {isSettled
                                            ? '消込済みの取引は一括変更できません'
                                            : '選択した日付以降の未消込の取引をすべて変更します'
                                        }
                                    </p>
                                </button>
                            </div>

                            {/* キャンセルボタン */}
                            <div className="px-6 pb-6">
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    className="w-full"
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(content, document.body);
}

export default UpdateModeDialog;
