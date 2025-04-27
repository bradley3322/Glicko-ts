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
            expect(glicko['config'].q).toBe(Math.log(10) / 400);
            expect(glicko['config'].daysPerRatingPeriod).toBe(30);
        });

        it('should override default configuration with provided values', () => {
            const customConfig = {
                initialRating: 1000,
                initialRD: 200,
                inactivityConstant: 0.3,
                rdCeiling: 300,
                daysPerRatingPeriod: 60,
                roundingPrecision: 0,
            };
            const customGlicko = new Glicko(customConfig);
            expect(customGlicko['config'].initialRating).toBe(1000);
            expect(customGlicko['config'].initialRD).toBe(200);
            expect(customGlicko['config'].inactivityConstant).toBe(0.3);
            expect(customGlicko['config'].rdCeiling).toBe(300);
            expect(customGlicko['config'].q).toBe(Math.log(10) / 400);
            expect(customGlicko['config'].daysPerRatingPeriod).toBe(60);
            expect(customGlicko['config'].roundingPrecision).toBe(0);

        });

        it('should use the roundingPrecision from the configuration', () => {
            const customGlicko = new Glicko({ roundingPrecision: 3 });
            const player = customGlicko.initializeNewPlayer();
            expect(player.rating).toBeCloseTo(1500.000, 3);
            expect(player.rd).toBeCloseTo(350.000, 3);

            const player2: Player = { rating: 1500, rd: 100, lastPlayedMatch: new Date() };
            const daysInactive = 30;
            const periodsSinceLastActivity = daysInactive / customGlicko['config'].daysPerRatingPeriod;
            let expectedRdBeforeRounding = Math.min(
                Math.sqrt(Math.pow(player2.rd, 2) + Math.pow(customGlicko['config'].inactivityConstant, 2) * periodsSinceLastActivity),
                customGlicko['config'].rdCeiling
            );
            const roundedExpectedRd = MathUtils.roundToDecimalPlaces(expectedRdBeforeRounding, 3);
            const updatedPlayer = customGlicko.updateRDForInactivity(player2, daysInactive);
            expect(updatedPlayer.rd).toBeCloseTo(roundedExpectedRd, 3);

            const initialRd = 100;
            const variance = 0.0028;
            const expectedNewRd = Math.sqrt(1 / (1 / Math.pow(initialRd, 2) + 1 / variance));
            const roundedExpectedNewRd2 = MathUtils.roundToDecimalPlaces(expectedNewRd, 3);
            const newRd = customGlicko.updateRD(initialRd, variance);
            expect(newRd).toBeCloseTo(roundedExpectedNewRd2, 3);
        });


    });

    describe('initializeNewPlayer', () => {
        it('should return a new player with initial rating and RD', () => {
            const player = glicko.initializeNewPlayer();
            expect(player.rating).toBe(1500);
            expect(player.rd).toBe(350);
        });
    });

    describe('updateRDForInactivity', () => {
        it('should throw an error if daysSinceLastActive is negative', () => {
            const player: Player = { rating: 1500, rd: 350, lastPlayedMatch: new Date() };
            expect(() => glicko.updateRDForInactivity(player, -10)).toThrowError("Days since last active cannot be negative.");
        });

        it('should not change RD if player has no lastPlayedMatch', () => {
            const player: Player = { rating: 1500, rd: 350 };
            const updatedPlayer = glicko.updateRDForInactivity(player, 30);
            expect(updatedPlayer.rd).toBeCloseTo(350, 2);
        });

        it('should update RD correctly based on daysSinceLastActive', () => {
            const player: Player = { rating: 1500, rd: 100, lastPlayedMatch: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }; // 60 days ago
            const updatedPlayer = glicko.updateRDForInactivity(player, 60);
            const expectedRd = Math.min(
                Math.sqrt(Math.pow(player.rd, 2) + Math.pow(glicko['config'].inactivityConstant, 2) * (60 / glicko['config'].daysPerRatingPeriod)),
                glicko['config'].rdCeiling
            );
            expect(updatedPlayer.rd).toBeCloseTo(expectedRd, 2);
        });

        it('should not exceed rdCeiling', () => {
            const player: Player = { rating: 1500, rd: 300, lastPlayedMatch: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }; // A year ago
            const daysInactive = 365;
            const periodsSinceLastActivity = daysInactive / glicko['config'].daysPerRatingPeriod;
            let expectedRd = Math.sqrt(Math.pow(player.rd, 2) + Math.pow(glicko['config'].inactivityConstant, 2) * periodsSinceLastActivity);
            expectedRd = Math.min(expectedRd, glicko['config'].rdCeiling); // Cap at rdCeiling
            const updatedPlayer = glicko.updateRDForInactivity(player, daysInactive);
            expect(updatedPlayer.rd).toBeCloseTo(expectedRd, 2);
        });
    });

    describe('calculateExpectedOutcome', () => {
        it('should calculate expected outcome correctly', () => {
            const playerRating = 1500;
            const opponentRating = 1600;
            const opponentRd = 200;
            const expectedOutcome = 1 / (1 + Math.exp(-MathUtils.g(opponentRd) * (playerRating - opponentRating) * glicko['config'].q));
            const actualOutcome = glicko.calculateExpectedOutcome(playerRating, opponentRating, opponentRd);
            expect(actualOutcome).toBeCloseTo(expectedOutcome, 2);
        });
    });

    describe('calculateVariance', () => {
        it('should throw an error if playerRd is zero or negative', () => {
            const matchs: Match[] = [];
            expect(() => glicko.calculateVariance(0, matchs)).toThrowError("Player's rating deviation (RD) must be positive.");
            expect(() => glicko.calculateVariance(-10, matchs)).toThrowError("Player's rating deviation (RD) must be positive.");
        });

        it('should return 0 if the match array is empty', () => {
            const playerRd = 100;
            const matchs: Match[] = [];
            const variance = glicko.calculateVariance(playerRd, matchs);
            expect(variance).toBe(0);
        });

        it('should calculate variance correctly', () => {
            const playerRd = 100;
            const matchs: Match[] = [
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1600, rd: 200 }, score: 0, datePlayed: new Date() },
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1400, rd: 150 }, score: 1, datePlayed: new Date() },
            ];
            let expectedVarianceSum = 0;
            for (const match of matchs) {
                const expectedOutcome = glicko.calculateExpectedOutcome(playerRd, match.opponent.rating, match.opponent.rd);
                expectedVarianceSum += Math.pow(MathUtils.g(match.opponent.rd), 2) * expectedOutcome * (1 - expectedOutcome);
            }
            const expectedVariance = 1 / expectedVarianceSum
            const variance = glicko.calculateVariance(playerRd, matchs);
            expect(variance).toBeCloseTo(expectedVariance, 4);
        });
    });

    describe('calculateRatingChange', () => {
        it('should throw an error if playerRd is zero or negative', () => {
            const matchs: Match[] = [];
            expect(() => glicko.calculateRatingChange(1500, 0, matchs)).toThrowError("Player's rating deviation (RD) must be positive.");
            expect(() => glicko.calculateRatingChange(1500, -10, matchs)).toThrowError("Player's rating deviation (RD) must be positive.");
        });

        it('should return 0 if the match array is empty', () => {
            const playerRating = 1500;
            const playerRd = 100;
            const matchs: Match[] = [];
            const ratingChange = glicko.calculateRatingChange(playerRating, playerRd, matchs);
            expect(ratingChange).toBe(0);
        });

        it('should calculate rating change correctly', () => {
            const playerRating = 1500;
            const playerRd = 100;
            const matchs: Match[] = [
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1600, rd: 200 }, score: 0, datePlayed: new Date() },
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1400, rd: 150 }, score: 1, datePlayed: new Date() },
            ];

            let expectedDeltaSum = 0;
            for (const match of matchs) {
                const expectedOutcome = glicko.calculateExpectedOutcome(playerRating, match.opponent.rating, match.opponent.rd);
                expectedDeltaSum += MathUtils.g(match.opponent.rd) * (match.score - expectedOutcome)
            }
            const expectedVariance = glicko.calculateVariance(playerRd, matchs);
            const expectedDelta = expectedVariance * expectedDeltaSum;
            const ratingChange = glicko.calculateRatingChange(playerRating, playerRd, matchs);
            expect(ratingChange).toBeCloseTo(expectedDelta, 2);
        });
    });

    describe('updateRating', () => {
        it('should update rating correctly', () => {
            const currentRating = 1500;
            const delta = -26.21;
            const newRating = glicko.updateRating(currentRating, delta);
            expect(newRating).toBeCloseTo(1473.79, 2);
        });
    });

    describe('updateRD', () => {
        it('should throw an error if initialRd is zero or negative', () => {
            expect(() => glicko.updateRD(0, 0.0028)).toThrowError("Initial rating deviation (RD) must be positive.");
            expect(() => glicko.updateRD(-10, 0.0028)).toThrowError("Initial rating deviation (RD) must be positive.");
        });

        it('should throw an error if variance is zero or negative', () => {
            expect(() => glicko.updateRD(100, 0)).toThrowError("Variance must be positive.");
            expect(() => glicko.updateRD(100, -10)).toThrowError("Variance must be positive.");
        });

        it('should update RD correctly', () => {
            const initialRd = 100;
            const variance = 0.0028;
            const expectedRD = Math.sqrt(1 / (1 / Math.pow(initialRd, 2) + 1 / variance));
            const newRd = glicko.updateRD(initialRd, variance);
            expect(newRd).toBeCloseTo(expectedRD, 2);
        });
    });

    describe('processGameResults', () => {
        it('should process game results correctly without inactivity', () => {
            const player: Player = { rating: 1500, rd: 100 };
            const matchs: Match[] = [
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1600, rd: 200 }, score: 0, datePlayed: new Date() },
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1400, rd: 150 }, score: 1, datePlayed: new Date() },
            ];

            const expectedVariance = glicko.calculateVariance(player.rd, matchs);
            const expectedDelta = glicko.calculateRatingChange(player.rating, player.rd, matchs);
            const expectedNewRating = MathUtils.roundToDecimalPlaces(player.rating + expectedDelta, 2);
            const expectedNewRd = MathUtils.roundToDecimalPlaces(Math.sqrt(1 / (1 / Math.pow(player.rd, 2) + 1 / expectedVariance)), 2);

            const updatedPlayer = glicko.processGameResults(player, matchs);
            console.log(JSON.stringify(updatedPlayer));
            expect(updatedPlayer.rating).toBeCloseTo(expectedNewRating, 2);
            expect(updatedPlayer.rd).toBeCloseTo(expectedNewRd, 2);
            expect(updatedPlayer.lastPlayedMatch).toBeInstanceOf(Date);
        });

        it('should process game results correctly with inactivity', () => {
            const player: Player = { rating: 1500, rd: 100, lastPlayedMatch: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) };
            const matchs: Match[] = [
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1600, rd: 200 }, score: 0, datePlayed: new Date() },
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1400, rd: 150 }, score: 1, datePlayed: new Date() },
            ];
            const daysInactive = 60;

            const expectedInactivityRd = Math.min(
                Math.sqrt(Math.pow(player.rd, 2) + Math.pow(glicko['config'].inactivityConstant, 2) * (daysInactive / glicko['config'].daysPerRatingPeriod)),
                glicko['config'].rdCeiling
            );

            const expectedVariance = glicko.calculateVariance(expectedInactivityRd, matchs);
            const expectedDelta = glicko.calculateRatingChange(player.rating, expectedInactivityRd, matchs);
            const expectedNewRating = MathUtils.roundToDecimalPlaces(player.rating + expectedDelta, 2);
            const expectedNewRd = MathUtils.roundToDecimalPlaces(Math.sqrt(1 / (1 / Math.pow(expectedInactivityRd, 2) + 1 / expectedVariance)), 2);

            const updatedPlayer = glicko.processGameResults(player, matchs, daysInactive);
            expect(updatedPlayer.rating).toBeCloseTo(expectedNewRating, 2);
            expect(updatedPlayer.rd).toBeCloseTo(expectedNewRd, 2);
            expect(updatedPlayer.lastPlayedMatch).toBeInstanceOf(Date);
        });
    });
});
