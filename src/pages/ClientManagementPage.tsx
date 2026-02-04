// =============================================================================
// ClientManagementPage - 取引先管理専用ページ
// =============================================================================

import { useState, useEffect } from 'react';

import { ArrowLeft, Plus, Building2, Pencil, Trash2, GripVertical, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { AppLayout } from '../components/layout/AppLayout';
import { ClientFormSheet } from '../features/clients';
import { formatPaymentCycle } from '../lib/settlement';
import { cn } from '../lib/utils';
import type { Client } from '../types';
import { ConfirmDrawer } from '../components/ui';
import { useHaptic } from '../hooks';
import { toast } from 'sonner';

interface ClientManagementPageProps {
    onBack: () => void;
    clients: Client[];
    onCreateClient: (data: Omit<Client, 'id' | 'uid' | 'createdAt'>) => Promise<void>;
    onUpdateClient: (id: string, data: Partial<Client>) => Promise<void>;
    onDeleteClient: (client: Client) => Promise<void>;
    onReorderClients: (orderedIds: string[]) => Promise<void>;
}

export default function ClientManagementPage({
    onBack,
    clients,
    onCreateClient,
    onUpdateClient,
    onDeleteClient,
    onReorderClients,
}: ClientManagementPageProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [orderedClients, setOrderedClients] = useState<Client[]>(clients);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const { trigger: haptic } = useHaptic();

    // クライアントリストが変わったらローカルステートを更新
    // 件数が変わった場合やIDリストが変わった場合のみ同期
    useEffect(() => {
        setOrderedClients(clients);
    }, [clients]);

    const handleCreateNew = () => {
        setEditingClient(null);
        setIsFormOpen(true);
    };

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setIsFormOpen(true);
    };

    const handleDelete = async (client: Client) => {
        setClientToDelete(client);
    };

    const executeDelete = async () => {
        if (!clientToDelete) return;

        try {
            await onDeleteClient(clientToDelete.id as any);
            haptic('success');
            toast.success('取引先を削除しました', {
                icon: <CheckCircle className="w-5 h-5" />,
            });
        } catch (error) {
            console.error('削除に失敗:', error);
            haptic('error');
            toast.error('削除に失敗しました', {
                icon: <AlertCircle className="w-5 h-5" />,
            });
        }
        setClientToDelete(null);
    };

    const handleSubmit = async (data: Omit<Client, 'id' | 'uid' | 'createdAt'>) => {
        if (editingClient) {
            await onUpdateClient(editingClient.id, data);
        } else {
            await onCreateClient(data);
        }
        setIsFormOpen(false);
        setEditingClient(null);
    };

    const handleSaveOrder = async () => {
        await onReorderClients(orderedClients.map(c => c.id));
        setIsEditMode(false);
    };

    const headerContent = (
        <div className="flex items-center justify-between h-16 px-4 w-full">
            <div className="flex items-center">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full hover:bg-surface-light transition-colors mr-2"
                >
                    <ArrowLeft className="w-6 h-6 text-gray-400" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-orange-400" />
                        取引先管理
                    </h1>
                </div>
            </div>

            {/* 編集モード切替 */}
            {clients.length > 0 && (
                <button
                    onClick={() => isEditMode ? handleSaveOrder() : setIsEditMode(true)}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        isEditMode
                            ? "bg-primary-500 text-white"
                            : "text-primary-400 hover:bg-surface-light"
                    )}
                >
                    {isEditMode ? '完了' : '編集'}
                </button>
            )}
        </div>
    );

    return (
        <AppLayout header={headerContent}>
            <div className="max-w-lg mx-auto px-4 py-2">
                {/* 説明 */}
                <div className="bg-surface-light rounded-xl p-4 mb-6 border border-white/5">
                    <p className="text-sm text-gray-400">
                        取引先を登録すると、締日・支払日から入金予定日が自動計算されます。
                    </p>
                </div>

                {/* 新規作成ボタン */}
                {!isEditMode && (
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={handleCreateNew}
                        className="w-full flex items-center gap-4 p-4 mb-4 bg-primary-600/20 rounded-xl text-primary-400 hover:bg-primary-600/30 transition-colors"
                    >
                        <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="font-medium text-lg">新しい取引先を追加</span>
                    </motion.button>
                )}

                {/* 取引先リスト */}
                {clients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <Building2 className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-lg mb-2">取引先がありません</p>
                        <p className="text-sm">「新しい取引先を追加」から登録してください</p>
                    </div>
                ) : isEditMode ? (
                    // 編集モード: ドラッグで並べ替え可能
                    <Reorder.Group
                        axis="y"
                        values={orderedClients}
                        onReorder={setOrderedClients}
                        className="space-y-2"
                    >
                        {orderedClients.map((client) => (
                            <ClientEditItem
                                key={client.id}
                                client={client}
                                onEdit={() => handleEdit(client)}
                                onDelete={() => handleDelete(client)}
                            />
                        ))}
                    </Reorder.Group>
                ) : (
                    // 通常モード
                    <div className="space-y-2">
                        {clients.map((client, index) => (
                            <motion.button
                                key={client.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => handleEdit(client)}
                                className="w-full flex items-center gap-4 p-4 bg-surface-light rounded-xl text-left hover:bg-surface transition-colors"
                            >
                                <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center">
                                    <Building2 className="w-6 h-6 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate text-lg">
                                        {client.name}
                                    </p>
                                    <p className="text-gray-500 text-sm truncate">
                                        {formatPaymentCycle(
                                            client.closingDay,
                                            client.paymentMonthOffset,
                                            client.paymentDay
                                        )}
                                    </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>

            {/* フォーム */}
            <ClientFormSheet
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) setEditingClient(null);
                }}
                onSubmit={handleSubmit}
                initialClient={editingClient}
            />

            <ConfirmDrawer
                open={!!clientToDelete}
                onOpenChange={(open) => !open && setClientToDelete(null)}
                title={`「${clientToDelete?.name}」を削除しますか？`}
                description="この取引先に紐づく未消込のトランザクションも同時に削除される可能性があります。"
                confirmLabel="削除する"
                variant="destructive"
                onConfirm={executeDelete}
            />
        </AppLayout>
    );
}

// 編集モード用のドラッグ可能なアイテム
interface ClientEditItemProps {
    client: Client;
    onEdit: () => void;
    onDelete: () => void;
}

function ClientEditItem({ client, onEdit, onDelete }: ClientEditItemProps) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={client}
            dragListener={false}
            dragControls={controls}
            className="w-full flex items-center gap-3 p-4 bg-surface-light rounded-xl"
        >
            {/* ドラッグハンドル */}
            <button
                onPointerDown={(e) => controls.start(e)}
                className="touch-none cursor-grab active:cursor-grabbing p-1"
            >
                <GripVertical className="w-5 h-5 text-gray-500" />
            </button>

            {/* アイコン */}
            <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-400" />
            </div>

            {/* 名前 */}
            <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{client.name}</p>
                <p className="text-gray-500 text-sm truncate">
                    {formatPaymentCycle(client.closingDay, client.paymentMonthOffset, client.paymentDay)}
                </p>
            </div>

            {/* アクションボタン */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onEdit}
                    className="p-2.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors"
                >
                    <Pencil className="w-5 h-5" />
                </button>
                <button
                    onClick={onDelete}
                    className="p-2.5 rounded-lg bg-expense/20 text-expense hover:bg-expense/30 transition-colors"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
        </Reorder.Item>
    );
}
