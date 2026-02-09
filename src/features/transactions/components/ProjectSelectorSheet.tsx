// =============================================================================
// ProjectSelectorSheet - 経費入力時の案件選択Bottom Sheet
// =============================================================================
// 【設計意図】
// - 経費入力フローで「どの案件の経費か」を選択するUI
// - スマホで使いやすいBottom Sheet形式
// - 検索機能 + 最近の案件表示
// =============================================================================

import { useState, useMemo } from 'react';
import { Drawer } from 'vaul';
import { Search, Folder, Clock, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '../../../lib/utils';
import type { Project } from '../../../types';

// =============================================================================
// 型定義
// =============================================================================

interface ProjectSelectorSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projects: Project[];
    selectedProjectId?: string | null;
    onSelect: (project: Project | null) => void;
}

// =============================================================================
// カラーマッピング
// =============================================================================

const PROJECT_COLORS: Record<string, string> = {
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    green: 'bg-emerald-500',
    purple: 'bg-purple-500',
    gray: 'bg-gray-500',
};

// =============================================================================
// メインコンポーネント
// =============================================================================

export function ProjectSelectorSheet({
    open,
    onOpenChange,
    projects,
    selectedProjectId,
    onSelect,
}: ProjectSelectorSheetProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // フィルタリングと並べ替え
    const filteredProjects = useMemo(() => {
        let result = projects;

        // 検索フィルタ
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                p => p.title.toLowerCase().includes(query)
            );
        }

        // 開始日の新しい順で並べ替え
        return [...result].sort((a, b) => {
            const dateA = a.startDate?.getTime() ?? 0;
            const dateB = b.startDate?.getTime() ?? 0;
            return dateB - dateA;
        });
    }, [projects, searchQuery]);

    // 進行中の案件（confirmed）を優先表示
    const activeProjects = useMemo(() => {
        return filteredProjects.filter(p => p.status === 'confirmed');
    }, [filteredProjects]);

    const otherProjects = useMemo(() => {
        return filteredProjects.filter(p => p.status !== 'confirmed');
    }, [filteredProjects]);

    const handleSelect = (project: Project) => {
        onSelect(project);
        onOpenChange(false);
    };

    const handleClear = () => {
        onSelect(null);
        onOpenChange(false);
    };

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly={true}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none">
                    <div className="bg-surface-dark rounded-t-3xl max-h-[85vh] flex flex-col">
                        {/* ハンドル - ここだけがドラッグ可能 */}
                        <div className="flex justify-center py-4 cursor-grab active:cursor-grabbing group">
                            <Drawer.Handle className="w-12 h-1.5 bg-gray-600 group-hover:bg-gray-500 group-active:bg-primary-500 rounded-full transition-colors shadow-sm" />
                        </div>

                        {/* ヘッダー */}
                        <div className="px-6 pb-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-white">
                                    関連案件を選択
                                </h2>
                                {selectedProjectId && (
                                    <button
                                        onClick={handleClear}
                                        className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                                    >
                                        <X className="w-4 h-4" />
                                        解除
                                    </button>
                                )}
                            </div>

                            {/* 検索バー */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="案件名で検索..."
                                    className="w-full pl-12 pr-4 py-3 bg-surface rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>

                        {/* リスト */}
                        <div className="flex-1 overflow-y-auto px-4 pb-safe">
                            {/* 紐付けなし選択 */}
                            <button
                                onClick={handleClear}
                                className={cn(
                                    'w-full flex items-center gap-3 p-4 mb-4 rounded-xl text-left transition-colors',
                                    !selectedProjectId
                                        ? 'bg-primary-600/20 text-primary-400'
                                        : 'bg-surface-light text-gray-400 hover:bg-surface'
                                )}
                            >
                                <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center">
                                    <Folder className="w-5 h-5 opacity-50" />
                                </div>
                                <span className="font-medium">案件に紐付けない</span>
                            </button>

                            {/* 進行中の案件 */}
                            {activeProjects.length > 0 && (
                                <div className="mb-4">
                                    <h3 className="text-xs font-medium text-gray-500 px-1 mb-2 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        進行中
                                    </h3>
                                    <div className="space-y-2">
                                        {activeProjects.map((project, index) => (
                                            <ProjectItem
                                                key={project.id}
                                                project={project}
                                                isSelected={project.id === selectedProjectId}
                                                index={index}
                                                onSelect={handleSelect}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* その他の案件 */}
                            {otherProjects.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-medium text-gray-500 px-1 mb-2">
                                        その他
                                    </h3>
                                    <div className="space-y-2">
                                        {otherProjects.map((project, index) => (
                                            <ProjectItem
                                                key={project.id}
                                                project={project}
                                                isSelected={project.id === selectedProjectId}
                                                index={index}
                                                onSelect={handleSelect}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 空状態 */}
                            {filteredProjects.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                    <Folder className="w-12 h-12 mb-3 opacity-50" />
                                    <p className="text-sm">
                                        {searchQuery
                                            ? '該当する案件がありません'
                                            : '案件が登録されていません'}
                                    </p>
                                </div>
                            )}
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

interface ProjectItemProps {
    project: Project;
    isSelected: boolean;
    index: number;
    onSelect: (project: Project) => void;
}

function ProjectItem({ project, isSelected, index, onSelect }: ProjectItemProps) {
    const colorClass = PROJECT_COLORS[project.color] || PROJECT_COLORS.blue;

    // 日付表示
    const dateRange = useMemo(() => {
        if (!project.startDate || !project.endDate) return '';
        const start = format(project.startDate, 'M/d', { locale: ja });
        const end = format(project.endDate, 'M/d', { locale: ja });
        return `${start} - ${end}`;
    }, [project.startDate, project.endDate]);

    // ステータスラベル
    const statusLabel = useMemo(() => {
        switch (project.status) {
            case 'draft':
                return '見積';
            case 'confirmed':
                return '受注';
            case 'completed':
                return '完了';
            default:
                return '';
        }
    }, [project.status]);

    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelect(project)}
            className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors',
                isSelected
                    ? 'bg-primary-600/20 ring-2 ring-primary-500'
                    : 'bg-surface-light hover:bg-surface'
            )}
        >
            {/* カラーインジケータ */}
            <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                colorClass
            )}>
                <Folder className="w-5 h-5 text-white" />
            </div>

            {/* プロジェクト情報 */}
            <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                    {project.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{dateRange}</span>
                    {statusLabel && (
                        <>
                            <span>•</span>
                            <span className={cn(
                                project.status === 'confirmed' && 'text-primary-400'
                            )}>
                                {statusLabel}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* 選択マーク */}
            {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}
        </motion.button>
    );
}

export default ProjectSelectorSheet;
