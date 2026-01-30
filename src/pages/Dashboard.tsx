import { useState } from 'react';
import { isSameMonth } from 'date-fns';
import { Plus, Settings, Wallet, LayoutDashboard, LogOut, TrendingUp, PieChart, Repeat, CheckCircle, AlertCircle } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { motion } from 'framer-motion';
import { useAuth } from '../features/auth';
import { TransactionList } from '../features/calendar';
import { CalendarContainer } from '../features/dashboard/CalendarContainer';
import { ClientSheet, ClientFormSheet } from '../features/clients';
import { TransactionForm } from '../features/transactions';
import { ToggleSwitch, Skeleton, ConfirmDrawer } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { ProjectCreateWizard } from '../features/projects/components/ProjectCreateWizard';
import { useTransactions, useClients, type CreateTransactionInput, type CreateClientInput, useHaptic, useProjects } from '../hooks';
import type { Client, Transaction, ClientFormData, TransactionFormData, ProjectColor } from '../types';
import RecurringSettings from './RecurringSettings';
import SettingsPage from './SettingsPage';
import ClientManagementPage from './ClientManagementPage';
import { mapTransactionsForCalendar } from '../lib/transactionHelpers';
import Decimal from 'decimal.js';
import { toast } from 'sonner';

export default function Dashboard() {
    const { user, signOut } = useAuth();
    const {
        viewMode,
        toggleViewMode,
        selectedDate,
        setSelectedDate,
    } = useAppStore();
    const { trigger: haptic } = useHaptic();

    const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [transactionClient, setTransactionClient] = useState<Client | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [showRecurringSettings, setShowRecurringSettings] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showClientManagement, setShowClientManagement] = useState(false);
    const [isProjectWizardOpen, setIsProjectWizardOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    // 取引フォーム用の初期日付ステート
    const [formInitialDate, setFormInitialDate] = useState(new Date());

    // Firestoreからリアルタイムでデータを取得
    const { transactions, loading: transactionsLoading, addTransaction, updateTransaction, deleteTransaction } = useTransactions(user?.uid);
    const { clients, addClient, updateClient, deleteClient, updateClientsOrder } = useClients(user?.uid);
    const { projects, addProject } = useProjects(user?.uid);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    const handleFormSubmit = async (data: TransactionFormData) => {
        try {
            const input: CreateTransactionInput = {
                type: data.type,
                amount: data.amount,
                taxRate: data.taxRate || '0.1',
                transactionDate: data.transactionDate ?? new Date(),
                settlementDate: data.settlementDate ?? null,
                isSettled: data.isSettled || false,
                // Firestore は undefined をサポートしないため、undefined の場合は除外
                ...(data.clientId && { clientId: data.clientId }),
                ...(data.memo && { memo: data.memo }),
            };



            const promise = editingTransaction
                ? updateTransaction(editingTransaction.id, input)
                : addTransaction(input);

            // 非同期でエラーハンドリング
            promise.catch((error) => {
                console.error('取引の保存に失敗:', error);
                haptic('error');
                toast.error('保存に失敗しました', {
                    description: '変更が反映されませんでした',
                    icon: <AlertCircle className="w-5 h-5" />,
                });
            });

            // 即座に成功扱いとしてUIを閉じる
            haptic('success');
            toast.success(editingTransaction ? '取引を更新しました' : '取引を保存しました', {
                description: '変更内容は即座に反映されます',
                icon: <CheckCircle className="w-5 h-5" />,
            });

            setTransactionClient(null); // Reset client selection
            setEditingTransaction(null); // Reset editing state
            setIsTransactionFormOpen(false); // Close form explicitly
        } catch (error) {
            // 同期的なエラー（入力構築時など）
            console.error('処理エラー:', error);
            toast.error('エラーが発生しました');
        }
    };

    const handleEditTransaction = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        // クライアント情報を復元
        if (transaction.clientId && clients.length > 0) {
            const client = clients.find((c: Client) => c.id === transaction.clientId);
            setTransactionClient(client || null);
        } else {
            setTransactionClient(null);
        }
        setIsTransactionFormOpen(true);
    };

    const handleDeleteTransaction = async (transaction: Transaction) => {
        // 確認ドロワーを表示
        setTransactionToDelete(transaction);
    };

    const executeDeleteTransaction = async () => {
        if (!transactionToDelete) return;

        // ノンブロッキング実行
        deleteTransaction(transactionToDelete.id).catch((error) => {
            console.error('削除に失敗しました:', error);
            haptic('error');
            toast.error('削除に失敗しました');
        });

        // 即座にUI更新
        haptic('success');
        toast.success('取引を削除しました', {
            icon: <CheckCircle className="w-5 h-5" />,
        });
        setTransactionToDelete(null);
    };

    const handleCreateClient = async (data: ClientFormData) => {
        try {
            if (editingClient) {
                // 編集モード
                updateClient(editingClient.id, {
                    name: data.name,
                    closingDay: data.closingDay,
                    paymentMonthOffset: data.paymentMonthOffset,
                    paymentDay: data.paymentDay,
                }).catch((error) => {
                    console.error('取引先の更新に失敗:', error);
                    toast.error('取引先の更新に失敗しました');
                });

                toast.success('取引先を更新しました');
                setEditingClient(null);
            } else {
                // 新規作成モード
                const input: CreateClientInput = {
                    name: data.name,
                    closingDay: data.closingDay,
                    paymentMonthOffset: data.paymentMonthOffset,
                    paymentDay: data.paymentDay,
                    sortOrder: clients.length, // 末尾に追加
                };
                addClient(input).catch((error) => {
                    console.error('取引先の保存に失敗:', error);
                    toast.error('取引先の保存に失敗しました');
                });

                toast.success('取引先を保存しました');
            }
        } catch (error) {
            console.error('処理エラー:', error);
        }
    };

    const handleEditClient = (client: Client) => {
        setEditingClient(client);
        setIsClientSheetOpen(false);
        setTimeout(() => setIsClientFormOpen(true), 200);
    };

    const handleDeleteClient = async (client: Client) => {
        setClientToDelete(client);
    };

    const executeDeleteClient = async () => {
        if (!clientToDelete) return;
        // ノンブロッキング実行
        deleteClient(clientToDelete.id).catch((error) => {
            console.error('削除に失敗:', error);
            haptic('error');
            toast.error('削除に失敗しました', {
                icon: <AlertCircle className="w-5 h-5" />,
            });
        });

        // 即座にUI更新
        haptic('success');
        toast.success('取引先を削除しました', {
            icon: <CheckCircle className="w-5 h-5" />,
        });
        setClientToDelete(null);
    };

    const handleReorderClients = async (orderedIds: string[]) => {
        updateClientsOrder(orderedIds).catch((error) => {
            console.error('順序の更新に失敗:', error);
            toast.error('並び替えの保存に失敗しました');
        });
        // 並び替えはUI側でReact stateとして即座に反映済み（Reorderコンポーネント内）なので
        // ここでは追加のUI更新は不要だが、エラーハンドリングだけしておく
    };

    // 案件作成
    const handleCreateProject = async (data: {
        clientId: string;
        client: Client;
        title: string;
        color: ProjectColor;
        startDate: Date;
        endDate: Date;
        amount: string;
        memo?: string;
    }) => {
        try {
            await addProject({
                clientId: data.clientId,
                title: data.title,
                startDate: data.startDate,
                endDate: data.endDate,
                color: data.color,
                estimatedAmount: data.amount,
                memo: data.memo,
            }, data.client);

            haptic('success');
            toast.success('案件を作成しました', {
                description: '資金繰り予定も自動作成されました',
                icon: <CheckCircle className="w-5 h-5" />,
            });
            setIsProjectWizardOpen(false);
        } catch (error) {
            console.error('案件作成失敗:', error);
            haptic('error');
            toast.error('案件の作成に失敗しました');
        }
    };

    // カレンダーの日付クリック時の処理
    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        // setFormInitialDate(date);
        // setEditingTransaction(null);
        // setTransactionClient(null);
        // setIsTransactionFormOpen(true);
    };

    // サマリー計算
    const incomeTotal = transactions
        .filter(t => t.type === 'income' && t.transactionDate && isSameMonth(t.transactionDate, selectedDate))
        .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));

    const expenseTotal = transactions
        .filter(t => t.type === 'expense' && t.transactionDate && isSameMonth(t.transactionDate, selectedDate))
        .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));

    // 入金予測（決済日が今月の収入）
    const cashInTotal = transactions
        .filter(t => t.type === 'income' && t.settlementDate && isSameMonth(t.settlementDate, selectedDate))
        .reduce((sum, t) => sum.plus(t.amount), new Decimal(0));

    const sidebarContent = (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-2 mb-8">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                    <Wallet className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    BizFlow
                </span>
            </div>

            <nav className="space-y-2 flex-1">
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-primary-500/10 text-primary-400 rounded-xl font-medium transition-colors">
                    <LayoutDashboard className="w-5 h-5" />
                    ダッシュボード
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 rounded-xl font-medium transition-colors">
                    <PieChart className="w-5 h-5" />
                    レポート
                </button>
                <button
                    onClick={() => setShowRecurringSettings(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 rounded-xl font-medium transition-colors"
                >
                    <Repeat className="w-5 h-5" />
                    定期取引
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 rounded-xl font-medium transition-colors">
                    <Settings className="w-5 h-5" />
                    設定
                </button>
            </nav>

            <div className="pt-6 border-t border-white/5">
                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl font-medium transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    ログアウト
                </button>
            </div>
        </div>
    );

    const headerContent = (
        <div className="flex items-center justify-between h-16 px-4 md:px-0 w-full">
            <h1 className="text-xl font-bold text-white md:hidden">BizFlow</h1>

            <div className="hidden md:block">
                <h2 className="text-lg font-semibold text-white">ダッシュボード</h2>
                <p className="text-xs text-gray-400">資金繰りの状況を一目で確認できます</p>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                <ToggleSwitch
                    checked={viewMode === 'cash'}
                    onChange={toggleViewMode}
                    leftLabel="発生"
                    rightLabel="入金"
                />
                <button
                    onClick={() => setShowSettings(true)}
                    className="md:hidden p-2 rounded-full hover:bg-surface-light transition-colors"
                >
                    <Settings className="w-6 h-6 text-gray-400" />
                </button>
            </div>
        </div>
    );

    // 設定画面からのナビゲーション
    const handleSettingsNavigate = (page: 'dashboard' | 'report' | 'recurring' | 'clients') => {
        setShowSettings(false);
        switch (page) {
            case 'dashboard':
                // 既にダッシュボードにいるので何もしない
                break;
            case 'recurring':
                setShowRecurringSettings(true);
                break;
            case 'clients':
                setShowClientManagement(true);
                break;
            case 'report':
                // TODO: レポート画面実装時に追加
                break;
        }
    };

    // 設定画面
    if (showSettings) {
        return (
            <SettingsPage
                onBack={() => setShowSettings(false)}
                onNavigate={handleSettingsNavigate}
            />
        );
    }

    // 取引先管理画面
    if (showClientManagement) {
        return (
            <ClientManagementPage
                onBack={() => setShowClientManagement(false)}
                clients={clients}
                onCreateClient={handleCreateClient}
                onUpdateClient={updateClient}
                onDeleteClient={handleDeleteClient}
                onReorderClients={handleReorderClients}
            />
        );
    }

    // 定期取引設定画面
    if (showRecurringSettings) {
        return (
            <RecurringSettings onBack={() => setShowRecurringSettings(false)} />
        );
    }

    return (
        <AppLayout sidebar={sidebarContent} header={headerContent}>
            {/* メインコンテンツ */}
            <div className="space-y-6 max-w-5xl mx-auto">
                {/* すべての画面サイズで CalendarContainer を使用（週/月切り替え付） */}
                <CalendarContainer
                    projects={projects}
                    transactions={transactions}
                    clients={clients}
                    calendarTransactions={mapTransactionsForCalendar(transactions, viewMode)}
                    onDateClick={handleDateClick}
                    onTransactionClick={handleEditTransaction}
                />

                {/* PC: リスト+サマリー */}
                <div className="hidden md:block">

                    {/* トランザクションリスト + PCサマリー */}
                    <div className="grid grid-cols-2 gap-6 mt-6">
                        <div>
                            <h2 className="text-gray-400 text-sm font-medium mb-4 px-1 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                {viewMode === 'accrual' ? '発生予定' : '入出金予定'}
                                {transactionsLoading && (
                                    <span className="text-xs text-primary-400">読み込み中...</span>
                                )}
                            </h2>
                            <TransactionList
                                transactions={transactions}
                                loading={transactionsLoading}
                                onEdit={handleEditTransaction}
                                onDelete={handleDeleteTransaction}
                            />
                        </div>
                        {/* PC表示用のサマリー */}
                        <div className="p-6 bg-surface rounded-2xl border border-white/5 h-fit">
                            <h3 className="text-lg font-medium text-white mb-4">今月のサマリー</h3>
                            <div className="space-y-4">
                                {transactionsLoading ? (
                                    <>
                                        <Skeleton className="h-20 w-full rounded-xl" />
                                        <Skeleton className="h-20 w-full rounded-xl" />
                                        <Skeleton className="h-20 w-full rounded-xl" />
                                    </>
                                ) : (
                                    <>
                                        <div className="p-4 bg-surface-light rounded-xl border border-white/5">
                                            <p className="text-sm text-gray-400 mb-1">売上 (発生)</p>
                                            <p className="text-2xl font-bold text-income">
                                                ¥{incomeTotal.toNumber().toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-surface-light rounded-xl border border-white/5">
                                            <p className="text-sm text-gray-400 mb-1">支出 (発生)</p>
                                            <p className="text-2xl font-bold text-expense">
                                                ¥{expenseTotal.toNumber().toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/20">
                                            <p className="text-sm text-primary-400 mb-1">入金予測 (決済)</p>
                                            <p className="text-2xl font-bold text-white">
                                                ¥{cashInTotal.toNumber().toLocaleString()}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAB (Floating Action Button) */}
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                    if (viewMode === 'project') {
                        setIsProjectWizardOpen(true);
                    } else {
                        // 編集ではなく新規作成なのでClient情報などはクリアして、
                        // カレンダーで選択されている日付を初期値としてセット
                        setFormInitialDate(selectedDate);
                        setEditingTransaction(null);
                        setTransactionClient(null);
                        setIsTransactionFormOpen(true);
                    }
                }}
                className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-primary-500 hover:bg-primary-600 rounded-full shadow-lg shadow-primary-500/30 flex items-center justify-center text-white z-20 transition-colors"
            >
                <Plus className="w-8 h-8" />
            </motion.button>

            {/* Project Wizard */}
            <ProjectCreateWizard
                open={isProjectWizardOpen}
                onOpenChange={setIsProjectWizardOpen}
                clients={clients}
                initialDate={selectedDate} // 選択中の日付を初期値に
                onSubmit={handleCreateProject}
                onCreateClient={() => {
                    setIsProjectWizardOpen(false);
                    // 少し待ってから開く（ドロワー被り防止）
                    setTimeout(() => setIsClientFormOpen(true), 300);
                }}
            />

            {/* Sheets */}
            <TransactionForm
                open={isTransactionFormOpen}
                onOpenChange={(open) => {
                    setIsTransactionFormOpen(open);
                    if (!open) {
                        setEditingTransaction(null);
                        setTransactionClient(null);
                    }
                }}
                onSubmit={handleFormSubmit}
                clients={clients}
                onOpenClientSheet={() => setIsClientSheetOpen(true)}
                initialDate={formInitialDate}
                selectedClient={transactionClient}
                initialTransaction={editingTransaction}
            />

            <ClientSheet
                open={isClientSheetOpen}
                onOpenChange={setIsClientSheetOpen}
                clients={clients}
                onSelect={(client) => {
                    setTransactionClient(client);
                    setIsClientSheetOpen(false);
                }}
                onCreateNew={() => {
                    setEditingClient(null);
                    setIsClientSheetOpen(false);
                    setTimeout(() => setIsClientFormOpen(true), 200);
                }}
                onEdit={handleEditClient}
                onDelete={handleDeleteClient}
                onReorder={handleReorderClients}
            />

            <ClientFormSheet
                open={isClientFormOpen}
                onOpenChange={(open) => {
                    setIsClientFormOpen(open);
                    if (!open) setEditingClient(null);
                }}
                onSubmit={handleCreateClient}

            />

            <ConfirmDrawer
                open={!!transactionToDelete}
                onOpenChange={(open) => !open && setTransactionToDelete(null)}
                title="取引を削除しますか？"
                description="この操作は取り消せません。本当に削除してもよろしいですか？"
                confirmLabel="削除する"
                variant="destructive"
                onConfirm={executeDeleteTransaction}
            />

            <ConfirmDrawer
                open={!!clientToDelete}
                onOpenChange={(open) => !open && setClientToDelete(null)}
                title={`「${clientToDelete?.name}」を削除しますか？`}
                description="この取引先に紐づく未消込のトランザクションも同時に削除される可能性があります。"
                confirmLabel="削除する"
                variant="destructive"
                onConfirm={executeDeleteClient}
            />
        </AppLayout>
    );
}
