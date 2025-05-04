/**
 * Glicko rating system implementation.
 * This class provides methods for calculating and updating Glicko ratings for players based on match outcomes.
 * The Glicko system accounts for rating deviation (RD), a measure of the uncertainty in a player's skill level.
 * A lower RD indicates higher confidence in the rating, while a higher RD suggests more uncertainty.
 */

import { Player } from './interfaces/player';
import { Match } from './interfaces/match';
import { MathUtils } from './utils/math-utils';
import { GlickoConfig } from './config/glicko_config';

export class Glicko {
    private config: GlickoConfig;


    /**
     * Creates an instance of the Glicko rating system calculator.
     * @param {Partial<GlickoConfig>} [config] Optional configuration settings.
     */
    constructor(config?: Partial<GlickoConfig>) {
        const defaultConfig = this.defaultConfig();
        this.config = { ...defaultConfig, ...config };
        this.config.q = defaultConfig.q;

        if (this.config.initialRating < 0) {
            throw new Error("initialRating must be non-negative.");
        }
        if (this.config.initialRD < 0) {
            throw new Error("initialRD must be non-negative.");
        }
        if (this.config.inactivityConstant < 0) {
            throw new Error("inactivityConstant must be non-negative.");
        }
        if (this.config.rdCeiling < 0) {
            throw new Error("rdCeiling must be non-negative.");
        }
        if (this.config.daysPerRatingPeriod <= 0) {
            throw new Error("daysPerRatingPeriod must be positive.");
        }
        if (this.config.roundingPrecision < 0 || !Number.isInteger(this.config.roundingPrecision)) {
            throw new Error("roundingPrecision must be a non-negative integer.");
        }
    }

    /**
    * Provides the default configuration values for the Glicko system.
    * @returns {GlickoConfig} The default configuration.
    * @private
    */
    private defaultConfig(): GlickoConfig {
        return {
            initialRating: 1500,
            initialRD: 350,
            inactivityConstant: 0.5,
            rdCeiling: 350,
            q: Math.log(10) / 400,
            daysPerRatingPeriod: 30,
            roundingPrecision: 2, // Default rounding precision for ratings and RD
        };
    }

    /**
   * Creates a new Player object with initial or overridden rating/RD values.
   * @param {Partial<Player>} [overrides] Optional values to override defaults.
   * @returns {Player} A new Player object.
   */
    initializeNewPlayer(overrides?: Partial<Player>): Player {
        return {
            rating: MathUtils.roundToDecimalPlaces(
                overrides?.rating ?? this.config.initialRating,
                this.config.roundingPrecision
            ),
            rd: MathUtils.roundToDecimalPlaces(
                overrides?.rd ?? this.config.initialRD,
                this.config.roundingPrecision
            ),
            lastPlayedMatch: overrides?.lastPlayedMatch,
        };
    }

    /**
  * Updates a player's Rating Deviation (RD) based on inactivity.
  * RD increases towards a ceiling over time if the player hasn't played.
  * @param {Player} player The player's state *before* the inactivity period.
  * @param {number} daysSinceLastActive The number of days since the player's last rated match.
  * @returns {Player} A new Player object with the potentially updated RD.
  * @throws {Error} If daysSinceLastActive is negative.
  */
    updateRDForInactivity(player: Player, daysSinceLastActive: number): Player {
        if (daysSinceLastActive < 0) { throw new Error("Days since last active cannot be negative."); }
        if (!player.lastPlayedMatch) { return { ...player }; }
        const periodsSinceLastActivity = daysSinceLastActive / this.config.daysPerRatingPeriod;
        const newRd = Math.min(
            Math.sqrt(Math.pow(player.rd, 2) + Math.pow(this.config.inactivityConstant, 2) * periodsSinceLastActivity),
            this.config.rdCeiling
        );
        return { ...player, rd: MathUtils.roundToDecimalPlaces(newRd, this.config.roundingPrecision) };
    }

    /**
    * Calculates the expected outcome (E) of a match for the player against an opponent.
    * Represents the player's expected score (roughly, probability of winning) based on ratings and RDs.
    * Formula: E = 1 / (1 + 10^(-g(RD_opp)*(r - r_opp)/400))
    * @param {number} playerRating Player's rating (r).
    * @param {number} opponentRating Opponent's rating (r_opp).
    * @param {number} opponentRd Opponent's RD (RD_opp).
    * @returns {number} Expected outcome for the player (0 to 1).
    * @private
    */
    private calculateExpectedOutcome(playerRating: number, opponentRating: number, opponentRd: number): number {
        const g_opp = MathUtils.g(opponentRd, this.config.q);
        const exponent = -g_opp * (playerRating - opponentRating) * this.config.q;
        return 1 / (1 + Math.exp(exponent));
    }

    /**
    * Calculates the sum of factors related to the expected variance of match outcomes within a rating period.
    * This sum quantifies the amount of information gained from the matches played, which influences the change in Rating Deviation (RD).
    * Formula: sum[ g(opponent_RD)^2 * E * (1-E) ]
    * A higher value indicates more information was gained, contributing to a larger RD decrease.
    * @param {number} playerRating Rating of the player at the start of the period.
    * @param {number} playerRd RD of the player at the start of the period.
    * @param {Match[]} matchs Matches played during the rating period.
    * @returns {number} The calculated sum. Returns 0 if matchs is empty/invalid.
    * @throws {Error} If playerRd is not positive.
    * @private
    */
    private sumMatchVarianceFactors(playerRating: number, playerRd: number, matchs: Match[]): number {
        if (playerRd <= 0) { throw new Error("Player RD must be positive for calculations."); }

        let sum = 0;
        for (const match of matchs) {
            const opponent = match.opponent;
            if (opponent.rd <= 0) {
                console.warn(`Skipping match in variance factor sum due to non-positive opponent RD: ${opponent.rd}`);
                continue;
            }
            const E = this.calculateExpectedOutcome(playerRating, opponent.rating, opponent.rd);
            const g_opp = MathUtils.g(opponent.rd, this.config.q);
            sum += Math.pow(g_opp, 2) * E * (1 - E);
        }
        return sum;
    }

    /**
     * Calculates the sum of weighted differences between actual match scores and expected scores.
     * This sum represents overall performance relative to expectation, adjusted for opponent RD.
     * It's the primary factor determining the rating change direction and magnitude.
     * Formula: sum[ g(opponent_RD) * (Actual_Score - Expected_Score) ]
     * A positive sum indicates better-than-expected performance (rating increases); negative indicates worse (rating decreases).
     * @param {number} playerRating Rating of the player at the start of the period.
     * @param {number} playerRd RD of the player at the start of the period.
     * @param {Match[]} matchs Matches played during the rating period.
     * @returns {number} The calculated sum. Returns 0 if matchs is empty/invalid.
     * @throws {Error} If playerRd is not positive.
     * @private
     */
    private sumWeightedScorePerformance(playerRating: number, playerRd: number, matchs: Match[]): number {
        if (playerRd <= 0) { throw new Error("Player RD must be positive for calculations."); }

        let sum = 0;
        for (const match of matchs) {
            const opponent = match.opponent;
            const score = match.score;
            if (opponent.rd <= 0) {
                console.warn(`Skipping match in weighted score sum due to non-positive opponent RD: ${opponent.rd}`);
                continue;
            }
            const E = this.calculateExpectedOutcome(playerRating, opponent.rating, opponent.rd);
            const g_opp = MathUtils.g(opponent.rd, this.config.q);
            sum += g_opp * (score - E);
        }
        return sum;
    }

    /**
    * Calculates the player's new Rating (r') for the end of the rating period.
    * Determined by initial rating adjusted by overall performance (weightedScorePerformanceSum),
    * scaled by the system constant (q) and the square of the new RD'.
    * Formula: r' = r + q * (RD')^2 * weightedScorePerformanceSum
    * @param {number} initialRating Player's rating at the start of the period.
    * @param {number} newRd The newly calculated unrounded RD' (output of calculateNewRD).
    * @param {number} weightedScorePerformanceSum Sum representing performance vs expectation.
    * @returns {number} The new rating (unrounded).
    * @private
    */
    private calculateNewRating(initialRating: number, newRd: number, weightedScorePerformanceSum: number): number {
        const newRdSquared = Math.pow(newRd, 2);
        const ratingChange = this.config.q * newRdSquared * weightedScorePerformanceSum;
        return initialRating + ratingChange;
    }

    /**
    * Calculates the player's new Rating Deviation (RD') for the end of the rating period.
    * Determined by initial RD and information gained from matches (matchVarianceFactorSum). More information leads to a lower RD.
    * Formula: RD' = 1 / sqrt( 1/RD^2 + q^2 * matchVarianceFactorSum )
    * @param {number} initialRd Player's RD at the start of the period.
    * @param {number} matchVarianceFactorSum Sum quantifying information gain from matches.
    * @returns {number} The new rating deviation (unrounded). Returns initialRd if no info gained.
    * @throws {Error} If initialRd is not positive.
    * @private
    */
    private calculateNewRD(initialRd: number, matchVarianceFactorSum: number): number {
        if (initialRd <= 0) { throw new Error("Initial RD must be positive."); }
        if (matchVarianceFactorSum <= 0) { return initialRd; }
        const qSquared = Math.pow(this.config.q, 2);
        const initialRdSquaredInverse = 1 / Math.pow(initialRd, 2);
        const dSquaredInverse = qSquared * matchVarianceFactorSum;
        const newRdSquared = 1 / (initialRdSquaredInverse + dSquaredInverse);
        return Math.sqrt(newRdSquared);
    }

    /**
    * Processes all matches for a player within a single rating period to update their Glicko-1 rating and RD.
    * This is the main public method used to calculate rating updates after a set of games representing one period.
    *
    * The process involves these steps:
    * 1. Optionally updates the player's RD based on inactivity since their last known activity.
    * 2. Calculates intermediate factors based on the match outcomes during the period compared to expectations.
    * 3. Computes the new RD' based on the RD at the start of the period and the information gained from matches.
    * 4. Computes the new Rating' based on the rating at the start of the period, the performance during the period, and the new RD'.
    * 5. Returns the updated player state, including the new rating, new RD (rounded), and an updated `lastPlayedMatch` timestamp.
    *
    * @param {Player} player The player's state (rating, RD, lastPlayedMatch) *before* the start of this rating period.
    * @param {Match[]} matchs An array of all matches the player participated in *during* this rating period.
    * Each match object should contain the opponent's state (at the time of the match, or start of period)
    * and the score achieved by the player (e.g., 1=win, 0.5=draw, 0=loss).
    * @param {number} [daysSinceLastActive] Optional: The number of days that elapsed between the `player.lastPlayedMatch` date
    * (from the input `player` object) and the *start* of this rating period.
    * If provided and greater than 0, the player's RD will be updated for
    * inactivity *before* processing the matches in this period.
    * @returns {Player} The updated state of the player after processing the rating period, with updated rating, RD,
    * and `lastPlayedMatch` set to the current time of processing. If no matches are provided
    * (matchs array is empty or null), it returns the player's state after only the potential
    * inactivity update (and `lastPlayedMatch` is NOT updated in this case).
    * @throws {Error} Can throw if internal calculations encounter issues (e.g., non-positive RD input to helpers)
    * or if `daysSinceLastActive` is negative (via `updateRDForInactivity`).
    */
    processGameResults(player: Player, matchs: Match[], daysSinceLastActive?: number): Player {
        let playerAtPeriodStart = { ...player };

        if (daysSinceLastActive !== undefined && daysSinceLastActive > 0) {
            playerAtPeriodStart = this.updateRDForInactivity(player, daysSinceLastActive);
        }

        const initialRating = playerAtPeriodStart.rating;
        const initialRd = playerAtPeriodStart.rd;

        if (!matchs || matchs.length === 0) {
            return playerAtPeriodStart;
        }

        const matchVarianceFactorSum = this.sumMatchVarianceFactors(
            initialRating, initialRd, matchs
        );

        const weightedScorePerformanceSum = this.sumWeightedScorePerformance(
            initialRating, initialRd, matchs
        );

        const newRdUnrounded = this.calculateNewRD(initialRd, matchVarianceFactorSum);

        const newRatingUnrounded = this.calculateNewRating(
            initialRating, newRdUnrounded, weightedScorePerformanceSum
        );

        return {
            rating: MathUtils.roundToDecimalPlaces(newRatingUnrounded, this.config.roundingPrecision),
            rd: MathUtils.roundToDecimalPlaces(newRdUnrounded, this.config.roundingPrecision),
            lastPlayedMatch: new Date()
        };
    }
}