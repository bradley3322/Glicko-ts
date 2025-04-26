import { Opponent } from "./opponent";
import { Player } from "./player";

export interface Match {
    player: Player;
    opponent: Opponent;
    score: number;
    datePlayed: Date; // Timestamp of when the game was played
}