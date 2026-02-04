export const SUBSCRIPTION_LIMITS = {
    FREE: {
        MAX_CLIENTS: Infinity,
    },
    PRO: {
        MAX_CLIENTS: Infinity,
    }
} as const;

export const CURRENT_PLAN = 'FREE';
