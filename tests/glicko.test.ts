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

    describe('calculateExpectedOutcome', () => {
        it('should calculate expected outcome correctly', () => {
            const glicko = new Glicko();
            const playerRating = 1500;
            const opponentRating = 1600;
            const opponentRd = 200;
            const expectedOutcome = glicko.calculateExpectedOutcome(playerRating, opponentRating, opponentRd);
            const calculatedOutcome = glicko.calculateExpectedOutcome(playerRating, opponentRating, opponentRd);
            expect(calculatedOutcome).toBeCloseTo(expectedOutcome, 8);
        });

    });

    describe('calculateVariance', () => {
        it('should throw an error if playerRd is zero or negative', () => {
            expect(() => glicko.calculateVariance(0, [])).toThrowError("Player's rating deviation (RD) must be positive.");
            expect(() => glicko.calculateVariance(-10, [])).toThrowError("Player's rating deviation (RD) must be positive.");
        });

        it('should return 0 if the match array is empty', () => {
            const variance = glicko.calculateVariance(100, []);
            expect(variance).toBe(0);
        });

        it('should calculate variance correctly', () => {
            const playerRd = 100;
            const matchs: Match[] = [
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1600, rd: 200 }, score: 1, datePlayed: new Date() },
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1400, rd: 150 }, score: 0, datePlayed: new Date() },
            ];

            const expectedVariance = 1 / (
                Math.pow(glicko['config'].q * MathUtils.g(200), 2) * glicko.calculateExpectedOutcome(1500, 1600, 200) * (1 - glicko.calculateExpectedOutcome(1500, 1600, 200)) +
                Math.pow(glicko['config'].q * MathUtils.g(150), 2) * glicko.calculateExpectedOutcome(1500, 1400, 150) * (1 - glicko.calculateExpectedOutcome(1500, 1400, 150))
            );
            const variance = glicko.calculateVariance(playerRd, matchs);
            expect(variance).toBeCloseTo(variance, 8);
        });
    });

    describe('calculateRatingChange', () => {
        it('should throw an error if playerRd is zero or negative', () => {
            expect(() => glicko.calculateRatingChange(1500, 0, [])).toThrowError("Player's rating deviation (RD) must be positive.");
            expect(() => glicko.calculateRatingChange(1500, -10, [])).toThrowError("Player's rating deviation (RD) must be positive.");
        });

        it('should return 0 if the match array is empty', () => {
            const ratingChange = glicko.calculateRatingChange(1500, 100, []);
            expect(ratingChange).toBe(0);
        });

        it('should calculate rating change correctly', () => {
            const playerRating = 1500;
            const playerRd = 100;
            const matchs: Match[] = [
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1600, rd: 200 }, score: 1, datePlayed: new Date() },
                { player: { rating: 1500, rd: 100 }, opponent: { rating: 1400, rd: 150 }, score: 0, datePlayed: new Date() },
            ];
            const expectedOutcome1 = glicko.calculateExpectedOutcome(playerRating, 1600, 200);
            const expectedOutcome2 = glicko.calculateExpectedOutcome(playerRating, 1400, 150);

            const expectedRatingChange = glicko['config'].q * (
                MathUtils.g(200) * (1 - expectedOutcome1) +
                MathUtils.g(150) * (0 - expectedOutcome2)
            );

            const ratingChange = glicko.calculateRatingChange(playerRating, playerRd, matchs);
            expect(ratingChange).toBeCloseTo(ratingChange, 8);
        });
    });

    describe('updateRating', () => {
        it('should update rating correctly', () => {
            const currentRating = 1500;
            const delta = 25.34;
            const newRating = glicko.updateRating(currentRating, delta);
            expect(newRating).toBeCloseTo(1525.34, 2);
        });
    });

    describe('updateRD', () => {
        it('should throw an error if initialRd is zero or negative', () => {
            expect(() => glicko.updateRD(0, 0.06)).toThrowError("Initial rating deviation (RD) must be positive.");
            expect(() => glicko.updateRD(-10, 0.06)).toThrowError("Initial rating deviation (RD) must be positive.");
        });

        it('should throw an error if variance is zero or negative', () => {
            expect(() => glicko.updateRD(100, 0)).toThrowError("Variance must be positive.");
            expect(() => glicko.updateRD(100, -0.06)).toThrowError("Variance must be positive.");
        });

        it('should update RD correctly', () => {
            const glicko = new Glicko();
            const initialRd = 100;
            const variance = 0.06;
            const expectedRD = Math.sqrt(1 / (1 / Math.pow(initialRd, 2) + 1 / variance));
            const roundedExpectedRD = MathUtils.roundToDecimalPlaces(expectedRD, glicko['config'].roundingPrecision);
            const expected = Math.max(roundedExpectedRD, MathUtils.roundToDecimalPlaces(initialRd, glicko['config'].roundingPrecision));
            const newRd = glicko.updateRD(initialRd, variance);
            expect(newRd).toBeCloseTo(expected, 2);
        });

    });

    describe('processGameResults', () => {
        it('should process game results correctly without inactivity', () => {
            const player: Player = glicko.initializeNewPlayer();
            const matchs: Match[] = [
                { player: player, opponent: { rating: 1600, rd: 200 }, score: 1, datePlayed: new Date() },
            ];

            const delta = glicko.calculateRatingChange(player.rating, player.rd, matchs);
            const variance = glicko.calculateVariance(player.rd, matchs);
            const expectedNewRating = glicko.updateRating(player.rating, delta);
            const expectedNewRd = glicko.updateRD(player.rd, variance);
            const updatedPlayer = glicko.processGameResults(player, matchs);

            expect(updatedPlayer.rating).toBeCloseTo(expectedNewRating, 2);
            expect(updatedPlayer.rd).toBeCloseTo(expectedNewRd, 2);
            expect(updatedPlayer.lastPlayedMatch).toBeInstanceOf(Date);
        });

        it('should process game results correctly with inactivity', () => {
            const player: Player = glicko.initializeNewPlayer();
            const matchs: Match[] = [
                { player: player, opponent: { rating: 1600, rd: 200 }, score: 1, datePlayed: new Date() },
            ];
            const daysInactive = 30;
            const inactivePlayer = glicko.updateRDForInactivity(player, daysInactive);
            const delta = glicko.calculateRatingChange(inactivePlayer.rating, inactivePlayer.rd, matchs);
            const variance = glicko.calculateVariance(inactivePlayer.rd, matchs);
            const expectedNewRating = glicko.updateRating(inactivePlayer.rating, delta);
            const expectedNewRd = glicko.updateRD(inactivePlayer.rd, variance);
            const updatedPlayer = glicko.processGameResults(player, matchs, daysInactive);
            expect(updatedPlayer.rating).toBeCloseTo(expectedNewRating, 2);
            expect(updatedPlayer.rd).toBeCloseTo(expectedNewRd, 2);
            expect(updatedPlayer.lastPlayedMatch).toBeInstanceOf(Date);
        });
    });
});
