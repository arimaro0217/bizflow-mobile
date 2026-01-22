import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Repeat } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../features/auth';
import { RecurringMasterList, RecurringMasterForm, type RecurringMasterFormData } from '../features/recurring';
import { ClientSheet, ClientFormSheet } from '../features/clients';
import {
    useRecurringMasters,
    useRecurringTransactionProcessor,
    useClients,
    useTransactions,
} from '../hooks';
import type { RecurringMaster, Client } from '../types';

interface RecurringSettingsProps {
    onBack?: () => void;
}

export default function RecurringSettings({ onBack }: RecurringSettingsProps) {
    const { user } = useAuth();

    const { masters, loading, updateRecurringMaster } = useRecurringMasters(user?.uid);
    const { clients, addClient } = useClients(user?.uid);
    const { transactions } = useTransactions(user?.uid);
    const {
        createRecurringWithTransactions,
        deleteRecurringWithTransactions,
        autoExtendRecurringTransactions,
    } = useRecurringTransactionProcessor(user?.uid);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [editingMaster, setEditingMaster] = useState<RecurringMaster | null>(null);

    // アプリ起動時に自動延長をチェック
    useEffect(() => {
        if (masters.length > 0 && transactions.length >= 0 && clients.length >= 0) {
            autoExtendRecurringTransactions(masters, transactions, clients);
        }
    }, [masters.length]); // マスタ数が変わったときのみ実行

    const handleCreateMaster = async (data: RecurringMasterFormData) => {
        try {
            await createRecurringWithTransactions(
                {
                    title: data.title,
                    baseAmount: data.baseAmount,
                    type: data.type,
                    clientId: data.clientId,
                    memo: data.memo,
                    frequency: data.frequency,
                    dayOfPeriod: data.dayOfPeriod,
                    monthOfYear: data.monthOfYear,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    isActive: true,
                },
                clients
            );
            console.log('定期取引を作成しました');
            setSelectedClient(null);
        } catch (error) {
            console.error('定期取引の作成に失敗:', error);
        }
    };

    const handleEditMaster = (master: RecurringMaster) => {
        setEditingMaster(master);
        if (master.clientId) {
            const client = clients.find(c => c.id === master.clientId);
            setSelectedClient(client || null);
        } else {
            setSelectedClient(null);
        }
        setIsFormOpen(true);
    };

    const handleDeleteMaster = async (master: RecurringMaster) => {
        if (window.confirm(`「${master.title}」を削除しますか？\n未消込のトランザクションも削除されます。`)) {
            try {
                await deleteRecurringWithTransactions(master.id);
                console.log('定期取引を削除しました');
            } catch (error) {
                console.error('削除に失敗:', error);
            }
        }
    };

    const handleToggleActive = async (master: RecurringMaster, isActive: boolean) => {
        try {
            await updateRecurringMaster(master.id, { isActive });
            console.log(`定期取引を${isActive ? '有効' : '無効'}にしました`);
        } catch (error) {
            console.error('更新に失敗:', error);
        }
    };

    const handleCreateClient = async (data: any) => {
        try {
            await addClient(data);
            console.log('取引先を作成しました');
        } catch (error) {
            console.error('取引先の作成に失敗:', error);
        }
    };

    const headerContent = (
        <div className="flex items-center h-16 px-4 md:px-0 w-full">
            <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-full hover:bg-surface-light transition-colors mr-2"
            >
                <ArrowLeft className="w-6 h-6 text-gray-400" />
            </button>
            <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Repeat className="w-5 h-5 text-primary-400" />
                    定期取引設定
                </h1>
                <p className="text-xs text-gray-400">サブスクリプションや固定費を管理</p>
            </div>
        </div>
    );

    return (
        <AppLayout header={headerContent}>
            <div className="max-w-2xl mx-auto">
                {/* 説明 */}
                <div className="bg-surface-light rounded-xl p-4 mb-6 border border-white/5">
                    <p className="text-sm text-gray-400">
                        定期取引を登録すると、指定した期間分のトランザクションが自動で作成されます。
                        家賃、サーバー代、サブスクリプションなどの固定費管理に便利です。
                    </p>
                </div>

                {/* 一覧 */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                    </div>
                ) : (
                    <RecurringMasterList
                        masters={masters}
                        onEdit={handleEditMaster}
                        onDelete={handleDeleteMaster}
                        onToggleActive={handleToggleActive}
                    />
                )}
            </div>

            {/* FAB */}
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                    setEditingMaster(null);
                    setSelectedClient(null);
                    setIsFormOpen(true);
                }}
                className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-primary-500 hover:bg-primary-600 rounded-full shadow-lg shadow-primary-500/30 flex items-center justify-center text-white z-20 transition-colors"
            >
                <Plus className="w-8 h-8" />
            </motion.button>

            {/* フォーム */}
            <RecurringMasterForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) {
                        setEditingMaster(null);
                        setSelectedClient(null);
                    }
                }}
                onSubmit={handleCreateMaster}
                clients={clients}
                onOpenClientSheet={() => setIsClientSheetOpen(true)}
                selectedClient={selectedClient}
                initialMaster={editingMaster}
            />

            {/* 取引先選択 */}
            <ClientSheet
                open={isClientSheetOpen}
                onOpenChange={setIsClientSheetOpen}
                clients={clients}
                onSelect={(client) => {
                    setSelectedClient(client);
                    setIsClientSheetOpen(false);
                }}
                onCreateNew={() => {
                    setIsClientSheetOpen(false);
                    setTimeout(() => setIsClientFormOpen(true), 200);
                }}
            />

            {/* 取引先作成 */}
            <ClientFormSheet
                open={isClientFormOpen}
                onOpenChange={setIsClientFormOpen}
                onSubmit={handleCreateClient}
            />
        </AppLayout>
    );
}
