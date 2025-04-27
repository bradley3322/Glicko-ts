export class MathUtils {
    /**
     * Calculates the g(RD) function, which dampens the effect of the opponent's RD.
     * @param rd The rating deviation of the opponent.
     * @returns The dampened RD value.
     */
    static g(rd: number): number {
        return 1 / Math.sqrt(1 + 3 * Math.pow(rd / Math.PI, 2));
    }

    /**
     * Rounds a number to a specified number of decimal places.
     * @param num The number to round.
     * @param places The number of decimal places.
     * @returns The rounded number.
     */
    static roundToDecimalPlaces(num: number, places: number): number {
        if (places === 0) {
            return Math.round(num);
        }
        const p = Math.pow(10, places);
        const rounded = (Math.round(num * p) / p);
        return Number(rounded.toFixed(places));
    }
}