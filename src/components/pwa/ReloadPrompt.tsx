import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * PWA更新通知コンポーネント (改良版)
 * 
 * - 更新が検出されたら「リロード」ボタンを表示
 * - iPhone対策: アプリ起動時とフォアグラウンド復帰時に更新チェック
 * - 定期的な更新チェック (15分ごと)
 */
export function ReloadPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);

    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            console.log('[PWA] Service Worker registered:', swUrl);

            if (registration) {
                // 起動時に即チェック
                registration.update();

                // 定期的な更新チェック (15分ごと)
                setInterval(() => {
                    console.log('[PWA] Checking for updates (interval)...');
                    registration.update();
                }, 15 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('[PWA] Service Worker registration error:', error);
        },
    });

    // 更新が必要な場合にプロンプトを表示
    useEffect(() => {
        if (needRefresh) {
            console.log('[PWA] New content available, showing prompt');
            setShowPrompt(true);
        }
    }, [needRefresh]);

    // iPhone対策: アプリに戻ってきた時に更新チェック
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[PWA] App is visible, checking for updates...');
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then((registration) => {
                        registration.update();
                    });
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleRefresh = () => {
        updateServiceWorker(true);
    };

    const handleClose = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
        setShowPrompt(false);
    };

    // 更新プロンプト
    if (showPrompt || needRefresh) {
        return (
            <div className="reload-prompt">
                <div className="reload-prompt__content">
                    <div className="reload-prompt__icon" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
                        <RefreshCw className="w-5 h-5 text-white" />
                    </div>
                    <div className="reload-prompt__text">
                        <span className="reload-prompt__title">アップデートがあります</span>
                        <span className="reload-prompt__subtitle">タップして最新版に更新</span>
                    </div>
                    <div className="reload-prompt__actions">
                        <button
                            type="button"
                            className="reload-prompt__button reload-prompt__button--primary"
                            onClick={handleRefresh}
                        >
                            更新
                        </button>
                        <button
                            type="button"
                            className="reload-prompt__button reload-prompt__button--secondary"
                            onClick={handleClose}
                            aria-label="閉じる"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // オフライン準備完了通知
    if (offlineReady) {
        return (
            <div className="reload-prompt">
                <div className="reload-prompt__content">
                    <div className="reload-prompt__icon">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    </div>
                    <div className="reload-prompt__text">
                        <span className="reload-prompt__title">準備完了</span>
                        <span className="reload-prompt__subtitle">オフラインで利用可能です</span>
                    </div>
                    <div className="reload-prompt__actions">
                        <button
                            type="button"
                            className="reload-prompt__button reload-prompt__button--secondary"
                            onClick={handleClose}
                            aria-label="閉じる"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
