// =============================================================================
// ProjectListView - 高機能リストビュー（検索・管理特化型）
// =============================================================================
// 【設計意図】
// - カレンダーモードと対になる、検索・管理特化型のビュー
// - タブ切り替え、スマート検索、粗利表示
// - リスト項目タップでProjectDetailSheetをオープン
// =============================================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Folder, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '../../../lib/utils';
import { useProjectFinancials, getHealthStatus, getHealthStatusColors } from '../hooks/useProjectFinancials';
import { formatCurrency, isNegative } from '../../../utils/currencyMath';
import type { Project, Transaction, Client } from '../../../types';

// =============================================================================
// 型定義
// =============================================================================

interface ProjectListViewProps {
    projects: Project[];
    transactions: Transaction[];
    clients: Client[];
    onProjectClick?: (project: Project) => void;
    onCreateProject?: () => void;
}

type TabType = 'active' | 'completed' | 'all';

// =============================================================================
// タブ設定
// =============================================================================

const TABS: { key: TabType; label: string }[] = [
    { key: 'active', label: '進行中' },
    { key: 'completed', label: '完了' },
    { key: 'all', label: 'すべて' },
];

// =============================================================================
// ステータスカラーマッピング
// =============================================================================

const STATUS_BORDER_COLORS: Record<string, string> = {
    draft: 'border-gray-500',
    confirmed: 'border-primary-500',
    completed: 'border-emerald-500',
};

// =============================================================================
// メインコンポーネント
// =============================================================================

export function ProjectListView({
    projects,
    transactions,
    clients,
    onProjectClick,
    onCreateProject,
}: ProjectListViewProps) {
    const [activeTab, setActiveTab] = useState<TabType>('active');
    const [searchQuery, setSearchQuery] = useState('');

    // フィルタリング
    const filteredProjects = useMemo(() => {
        let result = projects;

        // タブによるフィルタ
        if (activeTab === 'active') {
            result = result.filter(p => p.status === 'confirmed' || p.status === 'draft');
        } else if (activeTab === 'completed') {
            result = result.filter(p => p.status === 'completed');
        }

        // 検索フィルタ
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p => {
                // 案件名で検索
                if (p.title.toLowerCase().includes(query)) return true;
                // 取引先名で検索
                const client = clients.find(c => c.id === p.clientId);
                if (client?.name.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        // 開始日の新しい順でソート
        return [...result].sort((a, b) => {
            const dateA = a.startDate?.getTime() ?? 0;
            const dateB = b.startDate?.getTime() ?? 0;
            return dateB - dateA;
        });
    }, [projects, clients, activeTab, searchQuery]);

    return (
        <div className="flex flex-col h-full">
            {/* ヘッダー（固定） */}
            <div className="shrink-0 px-4 pt-4 pb-2 space-y-4">
                {/* 検索バー */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="案件名・取引先名で検索..."
                        className="w-full pl-12 pr-4 py-3 bg-surface rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>

                {/* タブナビゲーション */}
                <div className="flex gap-2 bg-surface rounded-xl p-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                                activeTab === tab.key
                                    ? 'bg-primary-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* リスト */}
            <div className="flex-1 overflow-y-auto px-4 pb-24">
                {filteredProjects.length === 0 ? (
                    // Empty State
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Folder className="w-16 h-16 text-gray-700 mb-4" />
                        <p className="text-gray-400 font-medium mb-2">
                            {searchQuery
                                ? '該当する案件がありません'
                                : '案件がありません'}
                        </p>
                        <p className="text-gray-500 text-sm mb-6">
                            右下のボタンから作成しましょう
                        </p>
                        {onCreateProject && (
                            <button
                                onClick={onCreateProject}
                                className="px-6 py-3 bg-primary-500 rounded-xl text-white font-medium flex items-center gap-2 hover:bg-primary-600 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                案件を作成
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3 pt-2">
                        <AnimatePresence>
                            {filteredProjects.map((project, index) => (
                                <ProjectListItem
                                    key={project.id}
                                    project={project}
                                    transactions={transactions}
                                    clients={clients}
                                    index={index}
                                    onClick={() => onProjectClick?.(project)}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// リストアイテムコンポーネント
// =============================================================================

interface ProjectListItemProps {
    project: Project;
    transactions: Transaction[];
    clients: Client[];
    index: number;
    onClick?: () => void;
}

const ProjectListItem = ({
    project,
    transactions,
    clients,
    index,
    onClick,
}: ProjectListItemProps) => {
    // PL計算（メモ化はuseProjectFinancials内部で行われている）
    const financials = useProjectFinancials(project, transactions);
    const healthStatus = getHealthStatus(financials.profitMargin);
    const healthColors = getHealthStatusColors(healthStatus);

    // 取引先名
    const clientName = useMemo(() => {
        const client = clients.find(c => c.id === project.clientId);
        return client?.name || '取引先未設定';
    }, [project.clientId, clients]);

    // 日程表示
    const dateRange = useMemo(() => {
        if (!project.startDate || !project.endDate) return '';
        const start = format(project.startDate, 'M/d', { locale: ja });
        const end = format(project.endDate, 'M/d', { locale: ja });
        return `${start} - ${end}`;
    }, [project.startDate, project.endDate]);

    const borderColor = STATUS_BORDER_COLORS[project.status] || STATUS_BORDER_COLORS.draft;
    const isDeficit = isNegative(financials.grossProfit);

    return (
        <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: index * 0.03 }}
            onClick={onClick}
            className={cn(
                'w-full flex items-center justify-between p-4 bg-surface rounded-xl',
                'border-l-4 text-left hover:bg-surface-light transition-colors',
                borderColor
            )}
        >
            <div className="min-w-0 flex-1">
                {/* タイトル */}
                <p className="text-white font-medium truncate">
                    {project.title}
                </p>
                {/* メタ情報 */}
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <span className="truncate max-w-[100px]">{clientName}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 shrink-0">
                        <Calendar className="w-3 h-3" />
                        {dateRange}
                    </span>
                </div>
            </div>

            {/* 粗利表示 */}
            <div className="shrink-0 text-right ml-4">
                <p className={cn(
                    'font-semibold',
                    isDeficit ? 'text-red-500' : 'text-white'
                )}>
                    {formatCurrency(financials.grossProfit, { compact: true })}
                </p>
                <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    healthColors.bg,
                    healthColors.text
                )}>
                    {financials.profitMargin.toFixed(0)}%
                </span>
            </div>
        </motion.button>
    );
};

export default ProjectListView;
