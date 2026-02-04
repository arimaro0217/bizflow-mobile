import { useMemo } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

/**
 * カレンダーのグリッド（日付配列）を生成するフック
 * 月表示・週表示に対応し、常に完全な週（月曜始まり）を返します。
 * 
 * @param currentDate - 表示基準日
 * @param viewMode - 'month' | 'week'
 * @returns Date[]
 */
export function useCalendarGrid(currentDate: Date, viewMode: 'month' | 'week' = 'month') {
    return useMemo(() => {
        let start: Date;
        let end: Date;

        if (viewMode === 'week') {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = endOfWeek(currentDate, { weekStartsOn: 1 });
        } else {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            start = startOfWeek(monthStart, { weekStartsOn: 1 });
            end = endOfWeek(monthEnd, { weekStartsOn: 1 });
        }

        return eachDayOfInterval({ start, end });
    }, [currentDate, viewMode]);
}
