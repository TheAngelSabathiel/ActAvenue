/** Written into rejection_reason on a booking that was moved to another show. */
export const TRANSFER_PREFIX = "Transferred to ";
export const isTransferred = (reason: string | null | undefined) => !!reason && reason.startsWith(TRANSFER_PREFIX);
