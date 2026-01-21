import { useState, useMemo } from 'react';
import { Drawer } from 'vaul';
import { Search, Plus, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { formatPaymentCycle } from '../../lib/settlement';
import type { Client } from '../../types';
import { Button } from '../../components/ui';

interface ClientSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clients: Client[];
    onSelect: (client: Client) => void;
    onCreateNew?: () => void;
}

export function ClientSheet({
    open,
    onOpenChange,
    clients,
    onSelect,
    onCreateNew,
}: ClientSheetProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredClients = useMemo(() => {
        if (!searchQuery) return clients;
        const query = searchQuery.toLowerCase();
        return clients.filter(client =>
            client.name.toLowerCase().includes(query)
        );
    }, [clients, searchQuery]);

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none">
                    <div className="bg-surface-dark rounded-t-3xl max-h-[85vh] flex flex-col">
                        {/* ハンドル */}
                        <div className="flex justify-center py-3">
                            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
                        </div>

                        {/* ヘッダー */}
                        <div className="px-6 pb-4">
                            <h2 className="text-xl font-semibold text-white mb-4">取引先を選択</h2>

                            {/* 検索バー */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="取引先を検索..."
                                    className="w-full pl-12 pr-4 py-3 bg-surface rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>

                        {/* リスト */}
                        <div className="flex-1 overflow-y-auto px-4 pb-safe">
                            {/* 新規作成ボタン */}
                            {onCreateNew && (
                                <button
                                    onClick={onCreateNew}
                                    className="w-full flex items-center gap-3 p-4 mb-2 bg-primary-600/20 rounded-xl text-primary-400 hover:bg-primary-600/30 transition-colors"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span className="font-medium">新しい取引先を登録</span>
                                </button>
                            )}

                            {/* 取引先リスト */}
                            {filteredClients.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                    <Building2 className="w-12 h-12 mb-3 opacity-50" />
                                    <p className="text-sm">
                                        {searchQuery ? '該当する取引先がありません' : '取引先が登録されていません'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredClients.map((client, index) => (
                                        <motion.button
                                            key={client.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => {
                                                onSelect(client);
                                                onOpenChange(false);
                                            }}
                                            className="w-full flex items-center gap-4 p-4 bg-surface-light rounded-xl text-left hover:bg-surface transition-colors"
                                        >
                                            <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center">
                                                <Building2 className="w-5 h-5 text-gray-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate">
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
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

// 取引先新規作成フォーム
interface ClientFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Omit<Client, 'id' | 'uid' | 'createdAt'>) => void;
}

export function ClientFormSheet({ open, onOpenChange, onSubmit }: ClientFormProps) {
    const [name, setName] = useState('');
    const [closingDay, setClosingDay] = useState<number>(99);
    const [paymentMonthOffset, setPaymentMonthOffset] = useState<number>(1);
    const [paymentDay, setPaymentDay] = useState<number>(99);

    const handleSubmit = () => {
        if (!name.trim()) return;

        onSubmit({
            name: name.trim(),
            closingDay,
            paymentMonthOffset,
            paymentDay,
        });

        // リセット
        setName('');
        setClosingDay(99);
        setPaymentMonthOffset(1);
        setPaymentDay(99);
        onOpenChange(false);
    };

    const dayOptions = [
        { value: 1, label: '1日' },
        { value: 5, label: '5日' },
        { value: 10, label: '10日' },
        { value: 15, label: '15日' },
        { value: 20, label: '20日' },
        { value: 25, label: '25日' },
        { value: 99, label: '月末' },
    ];

    const monthOptions = [
        { value: 0, label: '当月' },
        { value: 1, label: '翌月' },
        { value: 2, label: '翌々月' },
        { value: 3, label: '3ヶ月後' },
    ];

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none">
                    <div className="bg-surface-dark rounded-t-3xl max-h-[85vh] flex flex-col">
                        {/* ハンドル */}
                        <div className="flex justify-center py-3">
                            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
                        </div>

                        {/* ヘッダー */}
                        <div className="px-6 pb-4">
                            <h2 className="text-xl font-semibold text-white">新しい取引先</h2>
                        </div>

                        {/* フォーム */}
                        <div className="flex-1 overflow-y-auto px-6 pb-safe space-y-6">
                            {/* 名前 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    取引先名
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="株式会社〇〇"
                                    className="w-full px-4 py-3 bg-surface rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            {/* 締日 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    締日
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {dayOptions.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setClosingDay(option.value)}
                                            className={cn(
                                                'py-2 px-3 rounded-xl text-sm font-medium transition-colors',
                                                closingDay === option.value
                                                    ? 'bg-primary-600 text-white'
                                                    : 'bg-surface-light text-gray-300'
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 支払月 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    支払月
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {monthOptions.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setPaymentMonthOffset(option.value)}
                                            className={cn(
                                                'py-2 px-3 rounded-xl text-sm font-medium transition-colors',
                                                paymentMonthOffset === option.value
                                                    ? 'bg-primary-600 text-white'
                                                    : 'bg-surface-light text-gray-300'
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 支払日 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    支払日
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {dayOptions.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setPaymentDay(option.value)}
                                            className={cn(
                                                'py-2 px-3 rounded-xl text-sm font-medium transition-colors',
                                                paymentDay === option.value
                                                    ? 'bg-primary-600 text-white'
                                                    : 'bg-surface-light text-gray-300'
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* プレビュー */}
                            <div className="bg-surface rounded-xl p-4">
                                <p className="text-gray-400 text-sm mb-1">入金サイクル</p>
                                <p className="text-white font-medium">
                                    {formatPaymentCycle(closingDay, paymentMonthOffset, paymentDay)}
                                </p>
                            </div>

                            {/* 保存ボタン */}
                            <div className="pt-2 pb-4">
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!name.trim()}
                                    size="lg"
                                    className="w-full"
                                >
                                    保存
                                </Button>
                            </div>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

export default ClientSheet;
