import { useRegisterSW } from 'virtual:pwa-register/react';
import { useState } from 'react';

/**
 * PWA更新通知コンポーネント
 * 新しいバージョンがバックグラウンドでダウンロードされた際、
 * ユーザーに更新を促すToast UIを表示します。
 */
export function ReloadPrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            console.log('[PWA] Service Worker registered:', swUrl);
            // 1時間ごとに更新をチェック
            if (registration) {
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('[PWA] Service Worker registration error:', error);
        },
    });

    const [updating, setUpdating] = useState(false);

    const handleUpdate = async () => {
        setUpdating(true);
        try {
            await updateServiceWorker(true);
        } catch (error) {
            console.error('Failed to update service worker:', error);
            setUpdating(false);
        }
    };

    const handleClose = () => {
        setNeedRefresh(false);
    };

    if (!needRefresh) {
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
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 16h5v5" />
                    </svg>
                </div>
                <div className="reload-prompt__text">
                    <span className="reload-prompt__title">新しいバージョンが利用可能です</span>
                    <span className="reload-prompt__subtitle">最新機能をご利用いただけます</span>
                </div>
                <div className="reload-prompt__actions">
                    <button
                        type="button"
                        className="reload-prompt__button reload-prompt__button--primary"
                        onClick={handleUpdate}
                        disabled={updating}
                    >
                        {updating ? '更新中...' : '更新する'}
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
