// =============================================================================
// SettingsPage - モバイル設定画面
// =============================================================================

import { useState } from 'react';
import { ArrowLeft, LayoutDashboard, PieChart, Repeat, Building2, LogOut, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../features/auth';
import { cn } from '../lib/utils';
import { ConfirmDrawer } from '../components/ui';

interface SettingsPageProps {
    onBack: () => void;
    onNavigate: (page: 'dashboard' | 'report' | 'recurring' | 'clients') => void;
}

interface MenuItem {
    id: 'dashboard' | 'report' | 'recurring' | 'clients' | 'logout';
    label: string;
    description: string;
    icon: React.ElementType;
    color?: string;
    danger?: boolean;
}

const menuItems: MenuItem[] = [
    {
        id: 'dashboard',
        label: 'ダッシュボード',
        description: '資金繰りの状況を確認',
        icon: LayoutDashboard,
        color: 'text-primary-400',
    },
    {
        id: 'report',
        label: 'レポート',
        description: '収支レポートを表示',
        icon: PieChart,
        color: 'text-blue-400',
    },
    {
        id: 'recurring',
        label: '定期取引',
        description: 'サブスクリプション・固定費を管理',
        icon: Repeat,
        color: 'text-green-400',
    },
    {
        id: 'clients',
        label: '取引先管理',
        description: '取引先の追加・編集・削除',
        icon: Building2,
        color: 'text-orange-400',
    },
    {
        id: 'logout',
        label: 'ログアウト',
        description: 'アカウントからログアウト',
        icon: LogOut,
        color: 'text-red-400',
        danger: true,
    },
];

export default function SettingsPage({ onBack, onNavigate }: SettingsPageProps) {
    const { signOut } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleItemClick = (id: MenuItem['id']) => {
        if (id === 'logout') {
            setShowLogoutConfirm(true);
        } else {
            onNavigate(id);
        }
    };

    const headerContent = (
        <div className="flex items-center h-16 px-4 w-full">
            <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-full hover:bg-surface-light transition-colors mr-2"
            >
                <ArrowLeft className="w-6 h-6 text-gray-400" />
            </button>
            <h1 className="text-xl font-bold text-white">設定</h1>
        </div>
    );

    return (
        <AppLayout header={headerContent}>
            <div className="max-w-lg mx-auto px-4 py-2">
                {/* メニューリスト */}
                <div className="space-y-2">
                    {menuItems.map((item, index) => (
                        <motion.button
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleItemClick(item.id)}
                            className={cn(
                                'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors',
                                item.danger
                                    ? 'bg-red-500/10 hover:bg-red-500/20'
                                    : 'bg-surface-light hover:bg-surface'
                            )}
                        >
                            {/* アイコン */}
                            <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                item.danger ? 'bg-red-500/20' : 'bg-surface'
                            )}>
                                <item.icon className={cn('w-6 h-6', item.color)} />
                            </div>

                            {/* ラベル */}
                            <div className="flex-1 min-w-0">
                                <p className={cn(
                                    'font-medium',
                                    item.danger ? 'text-red-400' : 'text-white'
                                )}>
                                    {item.label}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                    {item.description}
                                </p>
                            </div>

                            {/* 矢印 */}
                            {!item.danger && (
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                            )}
                        </motion.button>
                    ))}
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-600">GANTACT v1.0.0</p>
                </div>
            </div>

            <ConfirmDrawer
                open={showLogoutConfirm}
                onOpenChange={setShowLogoutConfirm}
                title="ログアウトしますか？"
                confirmLabel="ログアウト"
                variant="destructive"
                onConfirm={signOut}
            />
        </AppLayout >
    );
}
