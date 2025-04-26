export interface Player {
    rating: number;
    rd: number;
    lastPlayedMatch?: Date; // Optional property to track the last active time of the player
}