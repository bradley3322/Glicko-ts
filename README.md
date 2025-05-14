# Glicko-ts

glicko-ts is a TypeScript implementation of the **Glicko-1** rating system, developed by Mark Glickman. It's a popular algorithm for calculating the relative skill levels of players in competitive games, improving upon simpler systems by incorporating rating reliability. This library provides an easy-to-use interface for integrating Glicko-1 ratings into your applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## `Features`

-   Implementation of the **Glicko-1** rating algorithm in TypeScript.
-   Calculates updated Ratings and Rating Deviations (RD) based on match outcomes.
-   Handles player inactivity via configurable RD increase over time.
-   Configurable system parameters (initial values, inactivity constant, RD ceiling, etc.).
-   Provides clear type definitions for easy integration.
-   Lightweight with zero external dependencies.

## `Installation`

Install the package via npm:

```bash
npm install glicko-ts
```

## `Usage`

Here's a quick example of how to use GlickoTS:

```typescript
import { Glicko, Player, Match } from 'glicko-ts'; // Adjust path if necessary

// 1. Initialize the Glicko calculator (using default or custom config)
const glicko = new Glicko();

// 2. Get player states *before* the rating period begins
// (Assuming these were loaded from your database or previous calculations)
let playerA: Player = glicko.initializeNewPlayer({ rating: 1500, rd: 200, lastPlayedMatch: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }); // Example existing player
let playerB: Player = glicko.initializeNewPlayer({ rating: 1700, rd: 150, lastPlayedMatch: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }); // Example existing player
let playerC: Player = glicko.initializeNewPlayer(); // New player this period

console.log('Initial Player A:', playerA);
console.log('Initial Player B:', playerB);
console.log('Initial Player C:', playerC);

// 3. Define matches played *during* this rating period
// Note: The 'score' is always from the perspective of the 'player' in the Match object.
// A single game between A and B results in two Match objects, one for each player's perspective.

// Assume Player A beat Player C (Score 1 for A, Score 0 for C)
const matchA_vs_C: Match = { player: playerA, opponent: playerC, score: 1 };
const matchC_vs_A: Match = { player: playerC, opponent: playerA, score: 0 };

// Assume Player B lost to Player A (Score 0 for B, Score 1 for A - from another match perspective not shown here)
const matchB_vs_A: Match = { player: playerB, opponent: playerA, score: 0 };
// Assume Player B beat Player C (Score 1 for B, Score 0 for C)
const matchB_vs_C: Match = { player: playerB, opponent: playerC, score: 1 };
const matchC_vs_B: Match = { player: playerC, opponent: playerB, score: 0 };


// 4. Collate matches for each player for this period
const matchesForPlayerA = [matchA_vs_C]; // Add other matches A played here
const matchesForPlayerB = [matchB_vs_A, matchB_vs_C]; // Add other matches B played here
const matchesForPlayerC = [matchC_vs_A, matchC_vs_B]; // Add other matches C played here


// 5. Calculate inactivity days for each player (time between their last update and the *start* of this period)
// (This calculation depends on your application's tracking of period start/end times)
const daysInactiveA = 60; // Example
const daysInactiveB = 90; // Example
const daysInactiveC = 0;  // New player, no prior inactivity


// 6. Process results for each player
// This is the standard way: process inactivity and matches in one call.
const updatedPlayerA = glicko.processGameResults(playerA, matchesForPlayerA, daysInactiveA);
const updatedPlayerB = glicko.processGameResults(playerB, matchesForPlayerB, daysInactiveB);
const updatedPlayerC = glicko.processGameResults(playerC, matchesForPlayerC, daysInactiveC); // daysInactiveC is 0, so no inactivity applied


// 7. Store the updated player states for the next rating period
console.log('Updated Player A:', updatedPlayerA);
console.log('Updated Player B:', updatedPlayerB);
console.log('Updated Player C:', updatedPlayerC);

/*
// Alternative Usage Patterns:

// A) Manually applying inactivity first:
const inactivePlayer = glicko.updateRDForInactivity(player, daysInactive);
const updatedPlayer = glicko.processGameResults(inactivePlayer, matches); // Note: no daysInactive here

// B) Processing results without considering inactivity:
const updatedPlayerNoInactivity = glicko.processGameResults(player, matches);
*/
```

## `Configuration`

You can customize the Glicko system by passing a configuration object to the Glicko constructor. The available configuration options are:

* `initialRating`: The default rating for a new player (default: 1500).
* `initialRD`: The rating deviation assigned to a new player (default: 350). Higher values reflect more uncertainty..
* `inactivityConstant`: Controls the rate of RD increase during inactivity. Often denoted 'c' (default: 0.5). Needs tuning based on the specific game/skill.
* `rdCeiling`: The maximum value the RD can reach through inactivity (default: 350). Cannot be lower than initialRD
* `q`: The Glicko system constant $\ln(10)/400$ is calculated internally and not configurable.
* `daysPerRatingPeriod`: The typical number of days in your rating cycle. Used to scale the inactivity calculation (default: 30).
* `roundingPrecision`: The number of decimal places to round final ratings and RDs to (default: 2). Must be a non-negative integer.

```typescript
import { Glicko } from 'glicko-ts'; // Adjust path if necessary
import { GlickoConfig } from 'glicko-ts'; // Adjust path if necessary

const customConfig: Partial<GlickoConfig> = {
  initialRating: 1000,         // Default: 1500
  initialRD: 250,              // Default: 350
  inactivityConstant: 0.4,     // Default: 0.5 - Controls how fast RD increases
  rdCeiling: 300,              // Default: 350 - Maximum RD value
  daysPerRatingPeriod: 7,      // Default: 30 - Used for inactivity calc scaling
  roundingPrecision: 0,        // Default: 2 - Decimal places for final results
};

const glickoWithCustomConfig = new Glicko(customConfig);
const newPlayer = glickoWithCustomConfig.initializeNewPlayer();
console.log('New player with custom config:', newPlayer); // Rating: 1000, RD: 250
```

### `Interfaces`

```typescript
interface Player {  
  rating: number;  
  rd: number;  
  lastPlayedMatch?: Date;  
}

interface Opponent {  
  rating: number;  
  rd: number;  
}

interface Match {  
  player: Player;  
  opponent: Opponent;  
  score: number;  
}

interface GlickoConfig {  
  initialRating: number;  
  initialRD: number;  
  inactivityConstant: number;  
  rdCeiling: number;  
  q: number;  
  daysPerRatingPeriod: number;
  roundingPrecision: number; 
}
```

## `License`
 
MIT License

Copyright (c) \[2025\] \[Bradley Robinson\]

Permission is hereby granted, free of charge, to any person obtaining a copy  
of this software and associated documentation files (the "Software"), to deal  
in the Software without restriction, including without limitation the rights  
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell  
copies of the Software, and to permit persons to whom the Software is  
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all  
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR  
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,  
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE  
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER  
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,  
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE  
SOFTWARE.  

## `Acknowledgments`

The Glicko(-1) rating system was developed by Mark Glickman. For more information, visit [glicko.net](http://www.glicko.net/).