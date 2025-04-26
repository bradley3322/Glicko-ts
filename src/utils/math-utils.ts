export class MathUtils {
    /**
     * Calculates the g(RD) function, which dampens the effect of the opponent's RD.
     * @param rd The rating deviation of the opponent.
     * @returns The dampened RD value.
     */
    static g(rd: number): number {
        return 1 / Math.sqrt(1 + 3 * Math.pow(rd / Math.PI, 2));
    }
}