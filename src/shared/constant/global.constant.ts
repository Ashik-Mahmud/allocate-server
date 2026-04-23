const GLOBAL_CONFIG = {
    company: "Demo Company",
    FREE_PLAN_DURATION_DAYS: 30, // Duration of the free plan in days
    FREE_PLAN_CREDITS: 100, // Number of credits allocated for free plan users
    VERIFICATION_TOKEN_EXPIRY_MINUTES: 60, // Expiry time for email verification tokens in minutes
    REFUND_POLICY: {
        FULL_REFUND_IF_CANCELLED_WITHIN: 1, // hours before the booking start time for a full refund
        PARTIAL_REFUND_IF_CANCELLED_WITHIN: 0.5, // hours before the booking start time for a partial refund (for simplicity, we will do a 50% refund)
    },
    WEEKEND_DAYS: ['Saturday', 'Sunday'], // Define weekend days for booking rules
}
export default GLOBAL_CONFIG
