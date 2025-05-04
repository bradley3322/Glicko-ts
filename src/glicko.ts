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
        this.config = { ...defaultConfig, ...config }; // Apply user overrides

        // Validate the configuration values
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
     * Initializes a new player with the default rating and rating deviation.
     * @returns A new Player object with initial Glicko or overrided values.
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
     * Updates a player's rating deviation (RD) based on the time since their last played match.
     * The RD increases to reflect the growing uncertainty in the player's skill due to inactivity.
     * @param player The player object to update.
     * @param daysSinceLastActive The number of days since the player's last rated match.
     * @returns A new Player object with the updated RD.
     * @throws Error if daysSinceLastActive is negative.
     */
    updateRDForInactivity(player: Player, daysSinceLastActive: number): Player {
        if (daysSinceLastActive < 0) {
            throw new Error("Days since last active cannot be negative.");
        }

        if (!player.lastPlayedMatch) {
            return { ...player, rd: MathUtils.roundToDecimalPlaces(player.rd, this.config.roundingPrecision) }; // No last played match recorded, RD remains the same
        }

        const periodsSinceLastActivity = daysSinceLastActive / this.config.daysPerRatingPeriod;
        const newRd = Math.min(
            Math.sqrt(Math.pow(player.rd, 2) + Math.pow(this.config.inactivityConstant, 2) * periodsSinceLastActivity),
            this.config.rdCeiling
        );
        return { ...player, rd: MathUtils.roundToDecimalPlaces(newRd, this.config.roundingPrecision) };
    }

    /**
     * Calculates the expected outcome (probability of winning) of a match for the player.
     * This is based on the Glicko ratings and rating deviations of the player and the opponent.
     * @param playerRating The rating of the player.
     * @param opponentRating The rating of the opponent.
     * @param opponentRd The rating deviation of the opponent.
     * @returns The expected outcome for the player (a value between 0 and 1).
     */
    calculateExpectedOutcome(playerRating: number, opponentRating: number, opponentRd: number): number {
        return 1 / (1 + Math.exp(-MathUtils.g(opponentRd) * (playerRating - opponentRating) * this.config.q));
    }

    /**
     * Calculates the variance in the player's rating based on the outcomes of a series of matches.
     * Variance represents the inverse of the information gained about the player's skill.
     * @param playerRd The current rating deviation of the player.
     * @param matchs An array of match results for the player.
     * @returns The calculated variance.
     * @throws Error if the player's RD is zero or negative.
     * @throws Error if the match array is empty.
     */
    calculateVariance(playerRd: number, matchs: Match[]): number {
        if (playerRd <= 0) {
            throw new Error("Player's rating deviation (RD) must be positive.");
        }
        if (!matchs || matchs.length === 0) {
            return 0; // No matches played, no variance to calculate
        }

        let sum = 0;
        for (const match of matchs) {
            const expectedOutcome = this.calculateExpectedOutcome(playerRd, match.opponent.rating, match.opponent.rd);
            sum += Math.pow(MathUtils.g(match.opponent.rd), 2) * expectedOutcome * (1 - expectedOutcome);
        }
        return 1 / sum;
    }

    /**
     * Calculates the change (delta) in the player's rating based on the actual outcomes of a series of matches
     * compared to the expected outcomes.
     * @param playerRating The current rating of the player.
     * @param playerRd The current rating deviation of the player.
     * @param matchs An array of match results for the player.
     * @returns The calculated rating change (delta).
     * @throws Error if the player's RD is zero or negative.
     * @throws Error if the match array is empty.
     */
    calculateRatingChange(playerRating: number, playerRd: number, matchs: Match[]): number {
        if (playerRd <= 0) {
            throw new Error("Player's rating deviation (RD) must be positive.");
        }
        if (!matchs || matchs.length === 0) {
            return 0; // No matches played, no rating change
        }

        let sum = 0;
        for (const match of matchs) {
            const expectedOutcome = this.calculateExpectedOutcome(playerRating, match.opponent.rating, match.opponent.rd);
            sum += MathUtils.g(match.opponent.rd) * (match.score - expectedOutcome);
        }
        const variance = this.calculateVariance(playerRd, matchs);
        return variance * sum;
    }

    /**
     * Updates the player's rating by adding the calculated rating change (delta).
     * @param currentRating The current rating of the player.
     * @param delta The calculated change in rating.
     * @returns The new rating.
     */
    updateRating(currentRating: number, delta: number): number {
        return MathUtils.roundToDecimalPlaces(currentRating + delta, this.config.roundingPrecision);
    }

    /**
     * Updates the player's rating deviation (RD) based on the RD at the beginning of the rating period
     * and the variance calculated from the matches.
     * @param initialRd The rating deviation of the player at the beginning of the rating period.
     * @param variance The calculated variance from the matches.
     * @returns The new rating deviation.
     * @throws Error if the initial RD is zero or negative.
     * @throws Error if the variance is zero or negative.
     */
    updateRD(initialRd: number, variance: number): number {
        if (initialRd <= 0) {
            throw new Error("Initial rating deviation (RD) must be positive.");
        }
        if (variance <= 0) {
            throw new Error("Variance must be positive.");
        }
        const newRd = Math.sqrt(1 / (1 / Math.pow(initialRd, 2) + 1 / variance));
        const roundedRd = MathUtils.roundToDecimalPlaces(newRd, this.config.roundingPrecision);
        return Math.max(roundedRd, MathUtils.roundToDecimalPlaces(initialRd, this.config.roundingPrecision));
    }

    /**
     * Processes a series of match results for a player to update their Glicko rating and RD.
     * @param player The current state of the player (rating and RD).
     * @param matchs An array of match results for the player.
     * @param daysSinceLastActive Optional: The number of days since the player's last rated match.
     * If provided, the RD will be updated for inactivity before processing matches.
     * @returns The updated state of the player (new rating and RD).
     * @throws Error if input parameters are invalid (e.g., negative daysSinceLastActive).
     */
    processGameResults(player: Player, matchs: Match[], daysSinceLastActive?: number): Player {
        let updatedPlayer = { ...player }; // Create a copy to avoid unintended side effects

        if (daysSinceLastActive !== undefined) {
            updatedPlayer = this.updateRDForInactivity(updatedPlayer, daysSinceLastActive);
        }

        const delta = this.calculateRatingChange(updatedPlayer.rating, updatedPlayer.rd, matchs);
        const variance = this.calculateVariance(updatedPlayer.rd, matchs);
        const newRd = this.updateRD(updatedPlayer.rd, variance);
        const newRating = this.updateRating(updatedPlayer.rating, delta);

        return { rating: newRating, rd: newRd, lastPlayedMatch: new Date() };
    }
}