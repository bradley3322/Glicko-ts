import { Glicko } from '../src/glicko';
import { Player } from '../src/interfaces/player';
import { Match } from '../src/interfaces/match';
import { MathUtils } from '../src/utils/math-utils';

describe('Glicko Class', () => {
    let glicko: Glicko;

    beforeEach(() => {
        glicko = new Glicko();
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            expect(glicko['config'].initialRating).toBe(1500);
            expect(glicko['config'].initialRD).toBe(350);
            expect(glicko['config'].inactivityConstant).toBe(0.5);
            expect(glicko['config'].rdCeiling).toBe(350);
            expect(glicko['config'].q).toBeCloseTo(Math.log(10) / 400, 8);
            expect(glicko['config'].daysPerRatingPeriod).toBe(30);
            expect(glicko['config'].roundingPrecision).toBe(2);
        });

        it('should override default configuration with provided values', () => {
            const customConfig = {
                initialRating: 1000,
                initialRD: 300,
                inactivityConstant: 0.6,
                rdCeiling: 300,
                daysPerRatingPeriod: 60,
                roundingPrecision: 3,
            };
            const glickoWithCustomConfig = new Glicko(customConfig);
            expect(glickoWithCustomConfig['config'].initialRating).toBe(1000);
            expect(glickoWithCustomConfig['config'].initialRD).toBe(300);
            expect(glickoWithCustomConfig['config'].inactivityConstant).toBe(0.6);
            expect(glickoWithCustomConfig['config'].rdCeiling).toBe(300);
            expect(glickoWithCustomConfig['config'].q).toBeCloseTo(Math.log(10) / 400, 8);
            expect(glickoWithCustomConfig['config'].daysPerRatingPeriod).toBe(60);
            expect(glickoWithCustomConfig['config'].roundingPrecision).toBe(3);
        });

        it('should use the roundingPrecision from the configuration', () => {
            const customGlicko = new Glicko({ roundingPrecision: 3 });
            const player = customGlicko.initializeNewPlayer();
            expect(player.rating).toBeCloseTo(1500.000, 3);
            expect(player.rd).toBeCloseTo(350.000, 3);
        });

        it('should use roundingPrecision: 0 from the configuration', () => {
            const customGlicko = new Glicko({ roundingPrecision: 0 });
            const player = customGlicko.initializeNewPlayer();
            expect(player.rating).toBeCloseTo(1500, 0);
            expect(player.rd).toBeCloseTo(350, 0);
        });

        it('should throw an error if initialRating is negative', () => {
            expect(() => new Glicko({ initialRating: -1 })).toThrowError("initialRating must be non-negative.");
        });

        it('should throw an error if initialRD is negative', () => {
            expect(() => new Glicko({ initialRD: -1 })).toThrowError("initialRD must be non-negative.");
        });

        it('should throw an error if inactivityConstant is negative', () => {
            expect(() => new Glicko({ inactivityConstant: -1 })).toThrowError("inactivityConstant must be non-negative.");
        });

        it('should throw an error if rdCeiling is negative', () => {
            expect(() => new Glicko({ rdCeiling: -1 })).toThrowError("rdCeiling must be non-negative.");
        });

        it('should throw an error if daysPerRatingPeriod is zero', () => {
            expect(() => new Glicko({ daysPerRatingPeriod: 0 })).toThrowError("daysPerRatingPeriod must be positive.");
        });

        it('should throw an error if daysPerRatingPeriod is negative', () => {
            expect(() => new Glicko({ daysPerRatingPeriod: -1 })).toThrowError("daysPerRatingPeriod must be positive.");
        });

        it('should throw an error if roundingPrecision is negative', () => {
            expect(() => new Glicko({ roundingPrecision: -1 })).toThrowError("roundingPrecision must be a non-negative integer.");
        });

        it('should throw an error if roundingPrecision is not an integer', () => {
            expect(() => new Glicko({ roundingPrecision: 1.5 })).toThrowError("roundingPrecision must be a non-negative integer.");
        });
    });

    describe('initializeNewPlayer', () => {
        it('should return a new player with initial rating and RD', () => {
            const player = glicko.initializeNewPlayer();
            expect(player.rating).toBeCloseTo(1500, 2);
            expect(player.rd).toBeCloseTo(350, 2);
            expect(player.lastPlayedMatch).toBeUndefined();
        });
    });

    describe('updateRDForInactivity', () => {
        it('should throw an error if daysSinceLastActive is negative', () => {
            const player: Player = { rating: 1500, rd: 100, lastPlayedMatch: new Date() };
            expect(() => glicko.updateRDForInactivity(player, -10)).toThrowError("Days since last active cannot be negative.");
        });

        it('should not change RD if player has no lastPlayedMatch', () => {
            const player: Player = { rating: 1500, rd: 100 };
            const updatedPlayer = glicko.updateRDForInactivity(player, 30);
            expect(updatedPlayer.rd).toBeCloseTo(100, 2);
        });

        it('should update RD correctly based on daysSinceLastActive', () => {
            const player: Player = { rating: 1500, rd: 100, lastPlayedMatch: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) };
            const daysInactive = 60;
            const expectedRd = Math.min(
                Math.sqrt(Math.pow(player.rd, 2) + Math.pow(glicko['config'].inactivityConstant, 2) * (daysInactive / glicko['config'].daysPerRatingPeriod)),
                glicko['config'].rdCeiling
            );
            const updatedPlayer = glicko.updateRDForInactivity(player, daysInactive);
            expect(updatedPlayer.rd).toBeCloseTo(expectedRd, 2);
        });

        it('should not exceed rdCeiling', () => {
            const glicko = new Glicko();
            const player: Player = { rating: 1500, rd: 300, lastPlayedMatch: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
            const daysInactive = 365;
            const expectedRdBeforeCeiling = Math.sqrt(Math.pow(player.rd, 2) + Math.pow(glicko['config'].inactivityConstant, 2) * (daysInactive / glicko['config'].daysPerRatingPeriod));
            const expectedRd = Math.min(expectedRdBeforeCeiling, glicko['config'].rdCeiling);
            const updatedPlayer = glicko.updateRDForInactivity(player, daysInactive);
            expect(updatedPlayer.rd).toBeCloseTo(expectedRd, 2);
        });

    });


    describe('processGameResults', () => {
        it('should calculate results correctly for Case 1 (224 vs 406, B wins)', () => {
            const glicko = new Glicko();
            const playerA_initial: Player = { rating: 224, rd: 350 };
            const playerB_initial: Player = { rating: 406, rd: 350 };

            const matchesForA: Match[] = [
                { player: playerA_initial, opponent: playerB_initial, score: 0, datePlayed: new Date() }
            ];
            const matchesForB: Match[] = [
                { player: playerB_initial, opponent: playerA_initial, score: 1, datePlayed: new Date() }
            ];

            const playerA_updated = glicko.processGameResults(playerA_initial, matchesForA);
            expect(playerA_updated.rating).toBeCloseTo(112.47, 2);
            expect(playerA_updated.rd).toBeCloseTo(295.51, 2);
            expect(playerA_updated.lastPlayedMatch).toBeInstanceOf(Date);

            const playerB_updated = glicko.processGameResults(playerB_initial, matchesForB);
            expect(playerB_updated.rating).toBeCloseTo(517.53, 2);
            expect(playerB_updated.rd).toBeCloseTo(295.51, 2);
            expect(playerB_updated.lastPlayedMatch).toBeInstanceOf(Date);
        });

        it('should calculate results correctly for Case 2 (1100 vs 1500, B wins)', () => {
            const glicko = new Glicko();
            const playerA_initial: Player = { rating: 1100, rd: 350 };
            const playerB_initial: Player = { rating: 1500, rd: 350 };

            const matchesForA: Match[] = [
                { player: playerA_initial, opponent: playerB_initial, score: 0, datePlayed: new Date() }
            ];
            const matchesForB: Match[] = [
                { player: playerB_initial, opponent: playerA_initial, score: 1, datePlayed: new Date() }
            ];

            const playerA_updated = glicko.processGameResults(playerA_initial, matchesForA);
            expect(playerA_updated.rating).toBeCloseTo(1034.14, 2);
            expect(playerA_updated.rd).toBeCloseTo(311.30, 2);
            expect(playerA_updated.lastPlayedMatch).toBeInstanceOf(Date);

            const playerB_updated = glicko.processGameResults(playerB_initial, matchesForB);
            expect(playerB_updated.rating).toBeCloseTo(1565.86, 2);
            expect(playerB_updated.rd).toBeCloseTo(311.30, 2);
            expect(playerB_updated.lastPlayedMatch).toBeInstanceOf(Date);
        });

        it('should process game results correctly *with* inactivity', () => {
            const glicko = new Glicko();
            const playerA_before_inactivity: Player = {
                rating: 1034.14,
                rd: 311.30,
                lastPlayedMatch: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
            };
            const playerC_opponent: Player = { rating: 1200, rd: 150 };

            const matchesForA: Match[] = [
                { player: playerA_before_inactivity, opponent: playerC_opponent, score: 1, datePlayed: new Date() }
            ];
            const daysInactive = 60;

            const EXPECTED_FINAL_RATING = 1263.13;
            const EXPECTED_FINAL_RD = 250.32;

            const playerA_updated = glicko.processGameResults(playerA_before_inactivity, matchesForA, daysInactive);

            expect(playerA_updated.rating).toBeCloseTo(EXPECTED_FINAL_RATING, 2);
            expect(playerA_updated.rd).toBeCloseTo(EXPECTED_FINAL_RD, 2);
            expect(playerA_updated.lastPlayedMatch).toBeInstanceOf(Date);
        });

        it('should return the player unchanged (except for inactivity update) if no matches are provided', () => {
            const glicko = new Glicko();
            const initialPlayer: Player = { rating: 1600, rd: 150, lastPlayedMatch: undefined };

            const updatedPlayerNoMatches = glicko.processGameResults(initialPlayer, []);
            expect(updatedPlayerNoMatches.rating).toBe(initialPlayer.rating);
            expect(updatedPlayerNoMatches.rd).toBe(initialPlayer.rd);
            expect(updatedPlayerNoMatches.lastPlayedMatch).toBeUndefined();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatedPlayerNullMatches = glicko.processGameResults(initialPlayer, null as any);
            expect(updatedPlayerNullMatches.rating).toBe(initialPlayer.rating);
            expect(updatedPlayerNullMatches.rd).toBe(initialPlayer.rd);
            expect(updatedPlayerNullMatches.lastPlayedMatch).toBeUndefined();

            const playerWithLastPlayed: Player = { rating: 1600, rd: 150, lastPlayedMatch: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
            const daysInactive = 30;
            const playerAfterInactivity = glicko.updateRDForInactivity(playerWithLastPlayed, daysInactive);

            const updatedPlayerWithInactivity = glicko.processGameResults(playerWithLastPlayed, [], daysInactive);
            expect(updatedPlayerWithInactivity.rating).toBe(playerWithLastPlayed.rating);
            expect(updatedPlayerWithInactivity.rd).toBeCloseTo(playerAfterInactivity.rd, 2);
            expect(updatedPlayerWithInactivity.lastPlayedMatch).toEqual(playerWithLastPlayed.lastPlayedMatch);
        });

    });

    describe('sumMatchVarianceFactors', () => {
        let glicko: Glicko;
        const playerRating = 1500;
        const playerRd = 200;
        const opponent1: Player = { rating: 1400, rd: 30 };
        const opponentInvalidRd: Player = { rating: 1600, rd: 0 };

        beforeEach(() => {
            glicko = new Glicko();
        });

        it('should throw an error if player RD is zero or negative', () => {
            const matches: Match[] = [{ player: { rating: playerRating, rd: 0 }, opponent: opponent1, score: 1, datePlayed: new Date() }];
            expect(() => glicko['sumMatchVarianceFactors'](playerRating, 0, matches))
                .toThrow("Player RD must be positive for calculations.");

            const matchesNegative: Match[] = [{ player: { rating: playerRating, rd: -50 }, opponent: opponent1, score: 1, datePlayed: new Date() }];
            expect(() => glicko['sumMatchVarianceFactors'](playerRating, -50, matchesNegative))
                .toThrow("Player RD must be positive for calculations.");
        });

        it('should skip matches with non-positive opponent RD and issue a warning', () => {
            const matches: Match[] = [
                { player: { rating: playerRating, rd: playerRd }, opponent: opponent1, score: 1, datePlayed: new Date() },
                { player: { rating: playerRating, rd: playerRd }, opponent: opponentInvalidRd, score: 0, datePlayed: new Date() },
            ];

            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const q = glicko['config'].q;
            const g_opp1 = MathUtils.g(opponent1.rd, q);
            const E1 = glicko['calculateExpectedOutcome'](playerRating, opponent1.rating, opponent1.rd);
            const expectedSum = Math.pow(g_opp1, 2) * E1 * (1 - E1);

            const result = glicko['sumMatchVarianceFactors'](playerRating, playerRd, matches);

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith(`Skipping match in variance factor sum due to non-positive opponent RD: ${opponentInvalidRd.rd}`);
            expect(result).toBeCloseTo(expectedSum, 8);

            consoleWarnSpy.mockRestore();
        });

    });

    describe('sumWeightedScorePerformance', () => {
        let glicko: Glicko;
        const playerRating = 1500;
        const playerRd = 200;
        const opponent1: Player = { rating: 1400, rd: 30 };
        const opponent2: Player = { rating: 1600, rd: 50 };
        const opponentInvalidRd: Player = { rating: 1700, rd: 0 };

        beforeEach(() => {
            glicko = new Glicko();
        });

        it('should throw an error if player RD is zero or negative', () => {
            const matches: Match[] = [{ player: { rating: playerRating, rd: 0 }, opponent: opponent1, score: 1, datePlayed: new Date() }];
            expect(() => glicko['sumWeightedScorePerformance'](playerRating, 0, matches))
                .toThrow("Player RD must be positive for calculations.");

            const matchesNegative: Match[] = [{ player: { rating: playerRating, rd: -50 }, opponent: opponent1, score: 1, datePlayed: new Date() }];
            expect(() => glicko['sumWeightedScorePerformance'](playerRating, -50, matchesNegative))
                .toThrow("Player RD must be positive for calculations.");
        });

        it('should calculate the sum correctly for valid matches', () => {
            const matches: Match[] = [
                { player: { rating: playerRating, rd: playerRd }, opponent: opponent1, score: 1, datePlayed: new Date() },
                { player: { rating: playerRating, rd: playerRd }, opponent: opponent2, score: 0, datePlayed: new Date() },
            ];

            const q = glicko['config'].q;
            const g_opp1 = MathUtils.g(opponent1.rd, q);
            const E1 = glicko['calculateExpectedOutcome'](playerRating, opponent1.rating, opponent1.rd);
            const term1 = g_opp1 * (1 - E1);

            const g_opp2 = MathUtils.g(opponent2.rd, q);
            const E2 = glicko['calculateExpectedOutcome'](playerRating, opponent2.rating, opponent2.rd);
            const term2 = g_opp2 * (0 - E2);

            const expectedSum = term1 + term2;
            const result = glicko['sumWeightedScorePerformance'](playerRating, playerRd, matches);
            expect(result).toBeCloseTo(expectedSum, 8);
        });

        it('should skip matches with non-positive opponent RD and issue a warning (lines 169-172)', () => {
            const matches: Match[] = [
                { player: { rating: playerRating, rd: playerRd }, opponent: opponent1, score: 1, datePlayed: new Date() },
                { player: { rating: playerRating, rd: playerRd }, opponent: opponentInvalidRd, score: 0.5, datePlayed: new Date() },
            ];

            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const q = glicko['config'].q;
            const g_opp1 = MathUtils.g(opponent1.rd, q);
            const E1 = glicko['calculateExpectedOutcome'](playerRating, opponent1.rating, opponent1.rd);
            const expectedSum = g_opp1 * (1 - E1);

            const result = glicko['sumWeightedScorePerformance'](playerRating, playerRd, matches);

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith(`Skipping match in weighted score sum due to non-positive opponent RD: ${opponentInvalidRd.rd}`);
            expect(result).toBeCloseTo(expectedSum, 8);

            consoleWarnSpy.mockRestore();
        });
    });

    describe('calculateNewRating (private)', () => {
        let glicko: Glicko;
        const initialRating = 1500;
        const newRd = 180.5;
        const q = Math.log(10) / 400;

        beforeEach(() => {
            glicko = new Glicko();
        });

        it('should calculate new rating correctly for positive performance sum (lines 208-209)', () => {
            const weightedScorePerformanceSum = 0.5;
            const expectedRating = initialRating + q * Math.pow(newRd, 2) * weightedScorePerformanceSum;
            const result = glicko['calculateNewRating'](initialRating, newRd, weightedScorePerformanceSum);
            expect(result).toBeCloseTo(expectedRating, 8);
        });

        it('should calculate new rating correctly for negative performance sum (lines 208-209)', () => {
            const weightedScorePerformanceSum = -0.2;
            const expectedRating = initialRating + q * Math.pow(newRd, 2) * weightedScorePerformanceSum;
            const result = glicko['calculateNewRating'](initialRating, newRd, weightedScorePerformanceSum);
            expect(result).toBeCloseTo(expectedRating, 8);
        });

        it('should calculate new rating correctly for zero performance sum (lines 208-209)', () => {
            const weightedScorePerformanceSum = 0;
            const expectedRating = initialRating;
            const result = glicko['calculateNewRating'](initialRating, newRd, weightedScorePerformanceSum);
            expect(result).toBeCloseTo(expectedRating, 8);
        });
    });

    describe('calculateNewRD (private)', () => {
        let glicko: Glicko;
        const initialRd = 200;
        const q = Math.log(10) / 400;

        beforeEach(() => {
            glicko = new Glicko();
        });

        it('should calculate new RD correctly for positive variance sum (lines 253-255)', () => {
            const matchVarianceFactorSum = 0.8;
            const expectedRd = 1 / Math.sqrt(1 / Math.pow(initialRd, 2) + Math.pow(q, 2) * matchVarianceFactorSum);
            const result = glicko['calculateNewRD'](initialRd, matchVarianceFactorSum);
            expect(result).toBeCloseTo(expectedRd, 8);
            expect(result).toBeLessThan(initialRd);
        });

        it('should return initial RD if variance sum is zero or negative (line 254)', () => {
            let matchVarianceFactorSum = 0;
            let result = glicko['calculateNewRD'](initialRd, matchVarianceFactorSum);
            expect(result).toBe(initialRd);

            matchVarianceFactorSum = -0.5;
            result = glicko['calculateNewRD'](initialRd, matchVarianceFactorSum);
            expect(result).toBe(initialRd);
        });


        it('should throw an error if initial RD is zero or negative (line 253)', () => {
            expect(() => glicko['calculateNewRD'](0, 0.8))
                .toThrow("Initial RD must be positive.");
            expect(() => glicko['calculateNewRD'](-50, 0.8))
                .toThrow("Initial RD must be positive.");
        });
    });
})
