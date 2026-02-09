// =============================================================================
// ClientSelectField - 検索機能付き取引先選択コンポーネント
// =============================================================================
// 【設計意図】
// - タップで検索用Bottom Sheetが開く
// - よく使う取引先（sortOrder順）を上に表示
// - パフォーマンス最適化のためReact.memoを使用
// =============================================================================

import { useState, useCallback, useMemo, memo } from 'react';
import { Drawer } from 'vaul';
import { Search, Building2, Check, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { formatPaymentCycle } from '../../../lib/settlement';
import type { Client } from '../../../types';

// =============================================================================
// 型定義
// =============================================================================

interface ClientSelectFieldProps {
    value: string | null;
    onChange: (clientId: string, client: Client) => void;
    clients: Client[];
    onCreateNew?: () => void;
    error?: string;
    placeholder?: string;
}

interface ClientListItemProps {
    client: Client;
    isSelected: boolean;
    onSelect: () => void;
}

// =============================================================================
// メモ化されたリストアイテム
// =============================================================================

const ClientListItem = memo(function ClientListItem({
    client,
    isSelected,
    onSelect,
}: ClientListItemProps) {
    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onSelect}
            className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors',
                isSelected
                    ? 'bg-primary-500/20 border border-primary-500/40'
                    : 'bg-surface-light hover:bg-surface border border-transparent'
            )}
        >
            <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                isSelected ? 'bg-primary-500' : 'bg-surface'
            )}>
                {isSelected ? (
                    <Check className="w-6 h-6 text-white" />
                ) : (
                    <Building2 className="w-6 h-6 text-gray-400" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className={cn(
                    'font-medium truncate text-lg',
                    isSelected ? 'text-primary-400' : 'text-white'
                )}>
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
        </motion.button>
    );
});

// =============================================================================
// メインコンポーネント
// =============================================================================

export const ClientSelectField = memo(function ClientSelectField({
    value,
    onChange,
    clients,
    onCreateNew,
    error,
    placeholder = '取引先を選択',
}: ClientSelectFieldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // 選択中のクライアント情報
    const selectedClient = useMemo(
        () => clients.find((c) => c.id === value),
        [clients, value]
    );

    // 検索フィルタリング
    const filteredClients = useMemo(() => {
        if (!searchQuery.trim()) {
            // sortOrder順でソート（undefinedは最後に）
            return [...clients].sort((a, b) => {
                const orderA = a.sortOrder ?? Infinity;
                const orderB = b.sortOrder ?? Infinity;
                return orderA - orderB;
            });
        }

        const query = searchQuery.toLowerCase();
        return clients
            .filter((c) => c.name.toLowerCase().includes(query))
            .sort((a, b) => {
                const orderA = a.sortOrder ?? Infinity;
                const orderB = b.sortOrder ?? Infinity;
                return orderA - orderB;
            });
    }, [clients, searchQuery]);

    // クライアント選択
    const handleSelect = useCallback(
        (client: Client) => {
            onChange(client.id, client);
            setIsOpen(false);
            setSearchQuery('');

            // Haptic feedback
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(10);
            }
        },
        [onChange]
    );

    // 新規作成
    const handleCreateNew = useCallback(() => {
        setIsOpen(false);
        setSearchQuery('');
        onCreateNew?.();
    }, [onCreateNew]);

    return (
        <>
            {/* トリガーボタン */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors',
                    selectedClient
                        ? 'bg-surface-light border border-primary-500/30'
                        : 'bg-surface-light border border-white/10 hover:border-white/20',
                    error && 'border-expense'
                )}
            >
                <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    selectedClient ? 'bg-primary-500' : 'bg-surface'
                )}>
                    <Building2 className={cn(
                        'w-6 h-6',
                        selectedClient ? 'text-white' : 'text-gray-400'
                    )} />
                </div>
                <div className="flex-1 min-w-0">
                    {selectedClient ? (
                        <>
                            <p className="text-white font-medium truncate text-lg">
                                {selectedClient.name}
                            </p>
                            <p className="text-gray-500 text-sm truncate">
                                {formatPaymentCycle(
                                    selectedClient.closingDay,
                                    selectedClient.paymentMonthOffset,
                                    selectedClient.paymentDay
                                )}
                            </p>
                        </>
                    ) : (
                        <p className="text-gray-500">{placeholder}</p>
                    )}
                </div>
            </button>

            {/* エラー表示 */}
            {error && (
                <p className="text-expense text-sm mt-1 ml-1">{error}</p>
            )}

            {/* 選択用Bottom Sheet */}
            <Drawer.Root open={isOpen} onOpenChange={setIsOpen} dismissible={false} handleOnly={true}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
                    <Drawer.Content
                        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl flex flex-col max-h-[85dvh]"
                        aria-describedby={undefined}
                    >
                        {/* ハンドル - ここだけがドラッグ可能 */}
                        <div className="flex justify-center py-4 cursor-grab active:cursor-grabbing group">
                            <Drawer.Handle className="w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-600 group-hover:bg-gray-500 group-active:bg-primary-500 transition-colors shadow-sm" />
                        </div>

                        {/* ヘッダー */}
                        <div className="px-4 pb-4 flex items-center justify-between">
                            <Drawer.Title className="text-xl font-bold text-white">取引先を選択</Drawer.Title>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-full hover:bg-surface-light"
                            >
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        {/* 検索バー */}
                        <div className="px-4 pb-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="取引先を検索..."
                                    className="w-full h-12 pl-12 pr-4 bg-surface-light rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>

                        {/* クライアントリスト */}
                        <div className="flex-1 overflow-y-auto px-4 pb-8 overscroll-y-contain touch-pan-y">
                            <div className="space-y-2">
                                {/* 新規作成ボタン */}
                                {onCreateNew && (
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={handleCreateNew}
                                        className="w-full flex items-center gap-4 p-4 bg-primary-600/20 rounded-xl text-primary-400 hover:bg-primary-600/30 transition-colors"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                                            <Plus className="w-6 h-6" />
                                        </div>
                                        <span className="font-medium text-lg">新しい取引先を追加</span>
                                    </motion.button>
                                )}

                                {/* クライアント一覧 */}
                                <AnimatePresence>
                                    {filteredClients.map((client, index) => (
                                        <motion.div
                                            key={client.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                        >
                                            <ClientListItem
                                                client={client}
                                                isSelected={client.id === value}
                                                onSelect={() => handleSelect(client)}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {/* 検索結果なし */}
                                {filteredClients.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                        <p>取引先が見つかりません</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </>
    );
});

export default ClientSelectField;
