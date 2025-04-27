export interface GlickoConfig {
    initialRating: number;
    initialRD: number;
    inactivityConstant: number;
    rdCeiling: number;
    q: number;
    daysPerRatingPeriod: number;
    roundingPrecision: number; // Optional rounding precision for ratings and RD
}