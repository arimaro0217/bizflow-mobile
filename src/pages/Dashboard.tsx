import { useState } from 'react';
import { isSameMonth } from 'date-fns';
import { Plus, Settings, Wallet, LayoutDashboard, LogOut, TrendingUp, PieChart, Repeat } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { motion } from 'framer-motion';
import { useAuth } from '../features/auth';
import { Calendar, TransactionList } from '../features/calendar';
import { ClientSheet, ClientFormSheet } from '../features/clients';
import { TransactionForm } from '../features/transactions';
import { ToggleSwitch } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { useTransactions, useClients, type CreateTransactionInput, type CreateClientInput } from '../hooks';
import RecurringSettings from './RecurringSettings';
import { mapTransactionsForCalendar } from '../lib/transactionHelpers';
import Decimal from 'decimal.js';

export default function Dashboard() {
    const { user, signOut } = useAuth();
    const {
        viewMode,
        toggleViewMode,
        selectedDate
    } = useAppStore();

    const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [transactionClient, setTransactionClient] = useState<any>(null);
    const [editingTransaction, setEditingTransaction] = useState<any>(null);
    const [showRecurringSettings, setShowRecurringSettings] = useState(false);

    // Firestoreからリアルタイムでデータを取得
    const { transactions, loading: transactionsLoading, addTransaction, updateTransaction, deleteTransaction } = useTransactions(user?.uid);
    const { clients, addClient, updateClient, deleteClient, updateClientsOrder } = useClients(user?.uid);
    const [editingClient, setEditingClient] = useState<any>(null);

    const handleFormSubmit = async (data: any) => {
        try {
            const input: CreateTransactionInput = {
                type: data.type,
                amount: data.amount,
                taxRate: data.taxRate || '0.1',
                transactionDate: data.transactionDate,
                settlementDate: data.settlementDate,
                isSettled: data.isSettled || false,
                // Firestore は undefined をサポートしないため、undefined の場合は除外
                ...(data.clientId && { clientId: data.clientId }),
                ...(data.memo && { memo: data.memo }),
            };

            if (editingTransaction) {
                await updateTransaction(editingTransaction.id, input);
                console.log('取引を更新しました');
            } else {
                await addTransaction(input);
                console.log('取引を保存しました');
            }

            setTransactionClient(null); // Reset client selection
            setEditingTransaction(null); // Reset editing state
            setIsTransactionFormOpen(false); // Close form explicitly
        } catch (error) {
            console.error('取引の保存に失敗:', error);
        }
    };

    const handleEditTransaction = (transaction: any) => {
        setEditingTransaction(transaction);
        // クライアント情報を復元
        if (transaction.clientId && clients.length > 0) {
            const client = clients.find((c: any) => c.id === transaction.clientId);
            setTransactionClient(client || null);
        } else {
            setTransactionClient(null);
        }
        setIsTransactionFormOpen(true);
    };

    const handleDeleteTransaction = async (transaction: any) => {
        if (window.confirm('この取引を削除してもよろしいですか？')) {
            try {
                await deleteTransaction(transaction.id);
                console.log('取引を削除しました');
            } catch (error) {
                console.error('削除に失敗しました:', error);
            }
        }
    };

    const handleCreateClient = async (data: any) => {
        try {
            if (editingClient) {
                // 編集モード
                await updateClient(editingClient.id, {
                    name: data.name,
                    closingDay: data.closingDay,
                    paymentMonthOffset: data.paymentMonthOffset,
                    paymentDay: data.paymentDay,
                });
                console.log('取引先を更新しました');
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
                await addClient(input);
                console.log('取引先を保存しました');
            }
        } catch (error) {
            console.error('取引先の保存に失敗:', error);
        }
    };

    const handleEditClient = (client: any) => {
        setEditingClient(client);
        setIsClientSheetOpen(false);
        setTimeout(() => setIsClientFormOpen(true), 200);
    };

    const handleDeleteClient = async (client: any) => {
        if (window.confirm(`「${client.name}」を削除しますか？`)) {
            try {
                await deleteClient(client.id);
                console.log('取引先を削除しました');
            } catch (error) {
                console.error('削除に失敗:', error);
            }
        }
    };

    const handleReorderClients = async (orderedIds: string[]) => {
        try {
            await updateClientsOrder(orderedIds);
            console.log('取引先の順序を更新しました');
        } catch (error) {
            console.error('順序の更新に失敗:', error);
        }
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
                    onClick={() => signOut()}
                    className="md:hidden p-2 rounded-full hover:bg-surface-light transition-colors"
                >
                    <Settings className="w-6 h-6 text-gray-400" />
                </button>
            </div>
        </div>
    );

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
                {/* カレンダー */}
                <Calendar
                    transactions={mapTransactionsForCalendar(transactions, viewMode)}
                    fullTransactions={transactions}
                    clients={clients}
                    onTransactionClick={handleEditTransaction}
                />

                {/* トランザクションリスト */}
                <div className="md:grid md:grid-cols-2 md:gap-6">
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
                            onEdit={handleEditTransaction}
                            onDelete={handleDeleteTransaction}
                        />
                    </div>
                    {/* PC表示用のサマリー */}
                    <div className="hidden md:block p-6 bg-surface rounded-2xl border border-white/5 h-fit">
                        <h3 className="text-lg font-medium text-white mb-4">今月のサマリー</h3>
                        <div className="space-y-4">
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
                        </div>
                    </div>
                </div>
            </div>

            {/* FAB (Floating Action Button) */}
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                    setEditingTransaction(null);
                    setTransactionClient(null);
                    setIsTransactionFormOpen(true);
                }}
                className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-primary-500 hover:bg-primary-600 rounded-full shadow-lg shadow-primary-500/30 flex items-center justify-center text-white z-20 transition-colors"
            >
                <Plus className="w-8 h-8" />
            </motion.button>

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
                initialDate={selectedDate}
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
                initialClient={editingClient}
            />
        </AppLayout>
    );
}
