import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { type Project, PROJECT_COLORS, type ProjectStatus } from '../../../types';
import { cn } from '../../../lib/utils';
import { X, Calendar as CalendarIcon, Wallet, AlertCircle, Tag, Link as LinkIcon, CheckCircle2, Trash2 } from 'lucide-react';
import { useState } from 'react';

// =============================================================================
// ProjectPopover - 案件詳細ポップオーバー
// =============================================================================

interface ProjectPopoverProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onStatusChange?: (status: ProjectStatus) => void;
    onEdit?: () => void;
    onDelete?: (deleteRelatedTransactions: boolean) => Promise<void>;
}

export function ProjectPopover({
    project,
    isOpen,
    onClose,
    onStatusChange,
    onEdit,
    onDelete,
}: ProjectPopoverProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen) return null;

    const colors = PROJECT_COLORS[project.color] || PROJECT_COLORS.blue;
    const formattedAmount = parseInt(project.estimatedAmount).toLocaleString();

    const handleStatusUpdate = async (newStatus: ProjectStatus) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            await onStatusChange?.(newStatus);
            onClose();
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-full max-w-sm bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={cn("px-4 py-3 border-b border-white/5 flex justify-between items-center bg-surface-light/30", colors.bg)}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        {project.isImportant && (
                            <AlertCircle className="w-5 h-5 text-red-100 flex-shrink-0" />
                        )}
                        <h3 className="font-bold text-white truncate">{project.title}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors text-white flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Tags */}
                    {project.tags && project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {project.tags.map((tag, i) => (
                                <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-700/50 border border-white/5 text-xs text-gray-300">
                                    <Tag className="w-3 h-3 text-gray-400" />
                                    <span>{tag}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                        <CalendarIcon className="w-4 h-4 text-primary-400" />
                        <div className="flex flex-col">
                            <span>
                                {project.startDate && format(project.startDate, 'M/d', { locale: ja })}
                                {' - '}
                                {project.endDate && format(project.endDate, 'M/d', { locale: ja })}
                            </span>
                            {project.startDate && project.endDate && (() => {
                                const now = new Date();
                                const end = project.endDate;
                                const diffTime = end.getTime() - now.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                if (project.status === 'completed') {
                                    return <span className="text-[10px] text-emerald-400">完了</span>;
                                } else if (diffDays < 0) {
                                    return <span className="text-[10px] text-red-400">期限超過 {Math.abs(diffDays)}日</span>;
                                } else if (diffDays <= 7) {
                                    return <span className="text-[10px] text-yellow-400">残り{diffDays}日</span>;
                                }
                                return <span className="text-[10px] text-gray-500">残り{diffDays}日</span>;
                            })()}
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        <span className="font-medium text-white">¥{formattedAmount}</span>
                        {project.status !== 'confirmed' && project.status !== 'completed' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                見込
                            </span>
                        )}
                    </div>

                    {/* Memo (簡易表示) */}
                    {project.memo && (
                        <div className="text-xs text-gray-400 bg-surface-light/30 rounded-lg p-2 line-clamp-2">
                            {project.memo}
                        </div>
                    )}

                    {/* Progress */}
                    {typeof project.progress === 'number' && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>進捗</span>
                                <span>{project.progress}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary-500 rounded-full transition-all duration-500"
                                    style={{ width: `${project.progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Related URLs */}
                    {project.urls && project.urls.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xs text-gray-500 font-medium">関連リンク</p>
                            <div className="space-y-1">
                                {project.urls.map((url, i) => (
                                    <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 hover:underline truncate"
                                    >
                                        <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{url}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status Actions */}
                    <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
                        {project.status === 'draft' && (
                            <button
                                onClick={() => handleStatusUpdate('confirmed')}
                                disabled={isUpdating}
                                className="col-span-2 flex items-center justify-center gap-2 py-2 px-3 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                受注確定にする
                            </button>
                        )}
                        {project.status === 'confirmed' && (
                            <button
                                onClick={() => handleStatusUpdate('completed')}
                                disabled={isUpdating}
                                className="col-span-2 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                完工済みにする
                            </button>
                        )}

                        <button
                            onClick={onEdit}
                            className="col-span-2 py-2 text-xs text-gray-400 hover:text-white hover:underline transition-colors"
                        >
                            詳細編集
                        </button>

                        {/* 削除ボタン */}
                        {!isConfirmingDelete ? (
                            <button
                                onClick={() => setIsConfirmingDelete(true)}
                                className="col-span-2 flex items-center justify-center gap-1 py-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                                削除
                            </button>
                        ) : (
                            <div className="col-span-2 space-y-2 pt-2 border-t border-red-500/20">
                                <p className="text-xs text-gray-400 text-center">削除方法を選択</p>
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        onClick={async () => {
                                            if (isDeleting) return;
                                            setIsDeleting(true);
                                            try {
                                                await onDelete?.(false);
                                                onClose();
                                            } finally {
                                                setIsDeleting(false);
                                            }
                                        }}
                                        disabled={isDeleting}
                                        className="flex items-center justify-center gap-1 py-2 text-xs text-white bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        {isDeleting ? '削除中...' : '案件のみ削除'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (isDeleting) return;
                                            setIsDeleting(true);
                                            try {
                                                await onDelete?.(true);
                                                onClose();
                                            } finally {
                                                setIsDeleting(false);
                                            }
                                        }}
                                        disabled={isDeleting}
                                        className="flex items-center justify-center gap-1 py-2 text-xs text-white bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        {isDeleting ? '削除中...' : '関連取引も削除'}
                                    </button>
                                    <button
                                        onClick={() => setIsConfirmingDelete(false)}
                                        disabled={isDeleting}
                                        className="py-2 text-xs text-gray-400 hover:text-white transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
