import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';

/**
 * PWA更新通知コンポーネント (Auto Update対応版)
 * 
 * - registerType: 'autoUpdate' により、更新があれば自動的にリロードされます。
 * - iPhoneなどの対策として、アプリがフォアグラウンドに戻った際(visibilitychange)に
 *   明示的に更新チェックを行います。
 * - オフライン利用可能になった際のみToastを表示します。
 */
export function ReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            console.log('[PWA] Service Worker registered:', swUrl);

            // 定期的な更新チェック (1時間ごと)
            if (registration) {
                setInterval(() => {
                    console.log('[PWA] Checking for updates (interval)...');
                    registration.update();
                }, 60 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('[PWA] Service Worker registration error:', error);
        },
    });

    // iPhone対策: アプリに戻ってきた時に更新チェック
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[PWA] App is visible, checking for updates...');
                // navigator.serviceWorker.ready を使ってregistrationを取得しupdate
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

    const handleClose = () => {
        setOfflineReady(false);
    };

    // オフライン準備完了通知のみ表示（自動更新モードなので更新通知は不要）
    if (!offlineReady) {
        return null;
    }

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
