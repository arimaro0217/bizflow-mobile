import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { SpotlightTour } from '../onboarding/SpotlightTour';

interface AppLayoutProps {
    children: ReactNode;
    sidebar?: ReactNode;
    header?: ReactNode;
    className?: string;
}



export function AppLayout({ children, sidebar, header, className }: AppLayoutProps) {
    return (
        // min-h-dvh: Dynamic Viewport Height対応（モバイルブラウザのアドレスバー考慮）
        // pt-safe: iOSステータスバー/ノッチ回避
        <div className="min-h-dvh bg-surface-dark w-full text-foreground pt-[env(safe-area-inset-top)]">
            <SpotlightTour />
            {/* Desktop Container */}
            <div className="mx-auto max-w-[1280px] min-h-dvh">
                <div className="md:grid md:grid-cols-[280px_1fr] min-h-dvh">

                    {/* PC/Tablet Sidebar (Hidden on Mobile) */}
                    <aside className="hidden md:flex flex-col bg-surface border-r border-white/5 p-6 h-dvh sticky top-0">
                        {sidebar || (
                            <div className="text-gray-500 text-sm">Valid Sidebar Content Required</div>
                        )}
                    </aside>

                    {/* Main Content Area */}
                    <main className={cn("flex flex-col relative", className)}>
                        {/* Mobile Header */}
                        {header && (
                            <div className="md:hidden sticky top-[env(safe-area-inset-top)] z-10 bg-surface-dark/80 backdrop-blur">
                                {header}
                            </div>
                        )}

                        {/* PC Header */}
                        {header && (
                            <div className="hidden md:block sticky top-0 z-10 bg-surface-dark/95 backdrop-blur border-b border-white/5">
                                {header}
                            </div>
                        )}

                        {/* pb-safe: iOSホームバー回避 */}
                        <div className="flex-1 p-4 md:p-8 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

