// =============================================================================
// ProjectDetailSheet - 統合型・案件詳細シート
// =============================================================================
// 【設計意図】
// - 案件の全情報を一画面で確認可能な高密度UI
// - 損益サマリー、日程、関連トランザクションを表示
// - 経費追加フローへのスムーズな導線
// =============================================================================

import { useState, useMemo } from 'react';
import { Drawer } from 'vaul';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    MoreVertical,
    Plus,
    Receipt,
    TrendingUp,
    Trash2,
    Archive,
    ChevronRight,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { formatCurrency } from '../../../utils/currencyMath';
import { ProjectPLCard } from './ProjectPLCard';
import type { Project, Transaction, Client } from '../../../types';

// =============================================================================
// 型定義
// =============================================================================

interface ProjectDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project | null;
    transactions: Transaction[];
    clients: Client[];
    onAddExpense?: (projectId: string) => void;
    onEditProject?: (project: Project) => void;
    onDeleteProject?: (project: Project) => void;
    onStatusChange?: (project: Project, status: 'draft' | 'confirmed' | 'completed') => void;
    onTransactionClick?: (transaction: Transaction) => void;
}

// =============================================================================
// ステータスカラーマッピング
// =============================================================================

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: '見積' },
    confirmed: { bg: 'bg-primary-500/20', text: 'text-primary-400', label: '受注' },
    completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '完了' },
};

// =============================================================================
// メインコンポーネント
// =============================================================================

export function ProjectDetailSheet({
    open,
    onOpenChange,
    project,
    transactions,
    clients,
    onAddExpense,
    onEditProject,
    onDeleteProject,
    onStatusChange,
    onTransactionClick,
}: ProjectDetailSheetProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);

    // 取引先名を取得
    const clientName = useMemo(() => {
        if (!project) return '';
        const client = clients.find(c => c.id === project.clientId);
        return client?.name || '取引先未設定';
    }, [project, clients]);

    // 日程表示
    const dateRange = useMemo(() => {
        if (!project?.startDate || !project?.endDate) return '';
        const start = format(project.startDate, 'M月d日', { locale: ja });
        const end = format(project.endDate, 'M月d日', { locale: ja });
        return `${start} → ${end}`;
    }, [project]);

    // 関連トランザクション（時系列ソート）
    const relatedTransactions = useMemo(() => {
        if (!project) return [];
        return transactions
            .filter(tx => tx.projectId === project.id)
            .sort((a, b) => {
                const dateA = a.transactionDate?.getTime() ?? 0;
                const dateB = b.transactionDate?.getTime() ?? 0;
                return dateA - dateB;
            });
    }, [project, transactions]);

    const statusConfig = project ? STATUS_COLORS[project.status] : STATUS_COLORS.draft;

    if (!project) return null;

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly={true}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none max-h-[90vh] flex flex-col">
                    <div className="bg-surface-dark rounded-t-3xl flex flex-col min-h-0 flex-1">
                        {/* ハンドル - ここだけがドラッグ可能 */}
                        <div className="flex justify-center py-4 shrink-0 cursor-grab active:cursor-grabbing group">
                            <Drawer.Handle className="w-12 h-1.5 bg-gray-600 group-hover:bg-gray-500 group-active:bg-primary-500 rounded-full transition-colors shadow-sm" />
                        </div>

                        {/* ヘッダー（Sticky） */}
                        <div className="px-6 pb-4 shrink-0 border-b border-white/5">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    {/* 案件タイトル */}
                                    <button
                                        onClick={() => onEditProject?.(project)}
                                        className="text-xl font-semibold text-white truncate hover:text-primary-400 transition-colors text-left w-full"
                                    >
                                        {project.title}
                                    </button>
                                    {/* 取引先名 */}
                                    <p className="text-sm text-gray-500 mt-1">
                                        {clientName}
                                    </p>
                                </div>

                                {/* ステータスバッジ + メニュー */}
                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                    {/* ステータス変更ボタン */}
                                    <button
                                        onClick={() => setShowStatusPicker(!showStatusPicker)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1',
                                            statusConfig.bg,
                                            statusConfig.text
                                        )}
                                    >
                                        {statusConfig.label}
                                        <ChevronRight className={cn(
                                            'w-4 h-4 transition-transform',
                                            showStatusPicker && 'rotate-90'
                                        )} />
                                    </button>

                                    {/* メニューボタン */}
                                    <button
                                        onClick={() => setShowMenu(!showMenu)}
                                        className="p-2 rounded-lg hover:bg-surface-light transition-colors"
                                        aria-label="メニューを開く"
                                    >
                                        <MoreVertical className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* ステータスピッカー */}
                            <AnimatePresence>
                                {showStatusPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3 flex gap-2 overflow-hidden"
                                    >
                                        {(['draft', 'confirmed', 'completed'] as const).map(status => (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    onStatusChange?.(project, status);
                                                    setShowStatusPicker(false);
                                                }}
                                                className={cn(
                                                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                                                    project.status === status
                                                        ? 'bg-primary-500 text-white'
                                                        : 'bg-surface-light text-gray-400 hover:text-white'
                                                )}
                                            >
                                                {STATUS_COLORS[status].label}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* メニュードロップダウン */}
                            <AnimatePresence>
                                {showMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-6 top-20 bg-surface rounded-xl shadow-xl border border-white/10 overflow-hidden z-10"
                                    >
                                        <button
                                            onClick={() => {
                                                setShowMenu(false);
                                                // アーカイブ処理
                                            }}
                                            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-gray-300 hover:bg-surface-light transition-colors"
                                        >
                                            <Archive className="w-4 h-4" />
                                            アーカイブ
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowMenu(false);
                                                onDeleteProject?.(project);
                                            }}
                                            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            削除
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* スクロール可能なボディ */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                            {/* A. 経営指標エリア */}
                            <ProjectPLCard project={project} transactions={transactions} />

                            {/* B. 日程エリア */}
                            <div className="bg-surface rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-primary-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">期間</p>
                                        <p className="text-white font-medium">{dateRange}</p>
                                    </div>
                                </div>
                            </div>

                            {/* C. トランザクション・タイムライン */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    関連する取引
                                </h3>

                                {relatedTransactions.length === 0 ? (
                                    // Empty State
                                    <div className="bg-surface rounded-xl p-6 text-center">
                                        <Receipt className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                                        <p className="text-gray-500 text-sm">
                                            まだ取引が登録されていません
                                        </p>
                                        <p className="text-gray-600 text-xs mt-1">
                                            下のボタンから経費を追加しましょう
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {relatedTransactions.map(tx => (
                                            <TransactionItem
                                                key={tx.id}
                                                transaction={tx}
                                                onClick={() => onTransactionClick?.(tx)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* フッター（Fixed） */}
                        <div
                            className="px-6 py-4 border-t border-white/5 shrink-0"
                            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
                        >
                            <button
                                onClick={() => onAddExpense?.(project.id)}
                                className="w-full h-12 rounded-xl bg-primary-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                経費を追加
                            </button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

// =============================================================================
// サブコンポーネント
// =============================================================================

interface TransactionItemProps {
    transaction: Transaction;
    onClick?: () => void;
}

function TransactionItem({ transaction, onClick }: TransactionItemProps) {
    const formattedDate = transaction.transactionDate
        ? format(transaction.transactionDate, 'M/d', { locale: ja })
        : '-';

    const isIncome = transaction.type === 'income';

    return (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between p-4 bg-surface rounded-xl hover:bg-surface-light transition-colors text-left"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                    'w-2 h-10 rounded-full shrink-0',
                    isIncome ? 'bg-income' : 'bg-expense'
                )} />
                <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                        {transaction.memo || (isIncome ? '入金' : '経費')}
                    </p>
                    <p className="text-xs text-gray-500">
                        {formattedDate}
                        {transaction.isEstimate && (
                            <span className="ml-2 text-yellow-500">見込み</span>
                        )}
                    </p>
                </div>
            </div>
            <span className={cn(
                'text-lg font-semibold shrink-0',
                isIncome ? 'text-income' : 'text-expense'
            )}>
                {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
            </span>
        </button>
    );
}

export default ProjectDetailSheet;
