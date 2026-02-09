import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'accrual' | 'cash' | 'project';

interface AppState {
    // 表示モード
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    toggleViewMode: () => void;

    // 選択日
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;

    // キーパッド
    isKeypadOpen: boolean;
    openKeypad: () => void;
    closeKeypad: () => void;

    // 入力バッファ（電卓の入力中の値）
    inputBuffer: string;
    setInputBuffer: (value: string) => void;
    appendToBuffer: (char: string) => void;
    clearBuffer: () => void;
    backspace: () => void;

    // カレンダー表示モード
    calendarView: 'week' | 'month';
    setCalendarView: (view: 'week' | 'month') => void;

    // 表示中の月（カレンダー）
    currentMonth: Date;
    setCurrentMonth: (date: Date) => void;

    // Bottom Sheet
    activeSheet: 'none' | 'client' | 'transaction' | 'menu';
    setActiveSheet: (sheet: 'none' | 'client' | 'transaction' | 'menu') => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // 表示モード
            viewMode: 'cash',
            setViewMode: (mode) => set({ viewMode: mode }),
            toggleViewMode: () => set((state) => {
                const modes: ViewMode[] = ['cash', 'project', 'accrual'];
                const currentIdx = modes.indexOf(state.viewMode);
                return { viewMode: modes[(currentIdx + 1) % modes.length] };
            }),

            // 選択日
            selectedDate: new Date(),
            setSelectedDate: (date) => set({ selectedDate: date }),

            // キーパッド
            isKeypadOpen: false,
            openKeypad: () => set({ isKeypadOpen: true }),
            closeKeypad: () => set({ isKeypadOpen: false }),

            // 入力バッファ
            inputBuffer: '',
            setInputBuffer: (value) => set({ inputBuffer: value }),
            appendToBuffer: (char) => set((state) => ({
                inputBuffer: state.inputBuffer + char
            })),
            clearBuffer: () => set({ inputBuffer: '' }),
            backspace: () => set((state) => ({
                inputBuffer: state.inputBuffer.slice(0, -1)
            })),

            // カレンダー表示モード
            calendarView: 'week',
            setCalendarView: (view) => set({ calendarView: view }),

            // 表示中の月（カレンダー）
            currentMonth: new Date(),
            setCurrentMonth: (date) => set({ currentMonth: date }),

            // Bottom Sheet
            activeSheet: 'none',
            setActiveSheet: (sheet) => set({ activeSheet: sheet }),
        }),
        {
            name: 'gantact-app-state',
            partialize: (state) => ({
                viewMode: state.viewMode,
                calendarView: state.calendarView,
                // currentMonthは永続化しない（アプリ再起動時は今日に戻るのが自然）
            }),
        }
    )
);
