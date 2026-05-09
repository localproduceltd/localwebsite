// Shared constants for pricing and fees
// All amounts in pounds (£)

export const BOX_DEPOSIT = 10;
export const BOTTLE_DEPOSIT = 1;
export const DELIVERY_FEE = 2.99;
export const MINIMUM_ORDER = 25;

// Stripe amounts (in pence)
export const BOX_DEPOSIT_PENCE = BOX_DEPOSIT * 100;
export const BOTTLE_DEPOSIT_PENCE = BOTTLE_DEPOSIT * 100;
export const DELIVERY_FEE_PENCE = Math.round(DELIVERY_FEE * 100);
