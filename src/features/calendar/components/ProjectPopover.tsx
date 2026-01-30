import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { type Project, PROJECT_COLORS, type ProjectStatus } from '../../../types';
import { cn } from '../../../lib/utils';
import { X, Calendar as CalendarIcon, Wallet, ArrowRightCircle } from 'lucide-react';
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
}

export function ProjectPopover({
    project,
    isOpen,
    onClose,
    onStatusChange,
    onEdit,
}: ProjectPopoverProps) {
    const [isUpdating, setIsUpdating] = useState(false);

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
                    <h3 className="font-bold text-white truncate pr-4">{project.title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Date */}
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                        <CalendarIcon className="w-4 h-4 text-primary-400" />
                        <span>
                            {project.startDate && format(project.startDate, 'M/d', { locale: ja })}
                            {' - '}
                            {project.endDate && format(project.endDate, 'M/d', { locale: ja })}
                        </span>
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

                    {/* Status Actions */}
                    <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
                        {project.status === 'draft' && (
                            <button
                                onClick={() => handleStatusUpdate('confirmed')}
                                disabled={isUpdating}
                                className="col-span-2 flex items-center justify-center gap-2 py-2 px-3 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <ArrowRightCircle className="w-4 h-4" />
                                受注確定にする
                            </button>
                        )}
                        {project.status === 'confirmed' && (
                            <button
                                onClick={() => handleStatusUpdate('completed')}
                                disabled={isUpdating}
                                className="col-span-2 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <ArrowRightCircle className="w-4 h-4" />
                                完工済みにする
                            </button>
                        )}

                        <button
                            onClick={onEdit}
                            className="col-span-2 py-2 text-xs text-gray-400 hover:text-white hover:underline transition-colors"
                        >
                            詳細編集
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
