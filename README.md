# GlickoTS

GlickoTS is a TypeScript implementation of the Glicko rating system, a popular algorithm for calculating the relative skill levels of players in competitive games. This library provides an easy-to-use interface for integrating Glicko ratings into your applications.

\[\!\[License: ISC\](https://img.shields.io/badge/License-ISC-blue.svg)\](https://opensource.org/licenses/ISC)  

## `Features`

- Fully implemented Glicko rating system in TypeScript.
- Support for rating updates based on match results.
- Configurable rating deviation and volatility parameters.
- Lightweight and easy to integrate.

## `Installation`

Install the package via npm:

```bash
npm install glickots
```

## `Usage`

Here's a quick example of how to use GlickoTS:

```typescript
import { Glicko } from 'glickots';
import { Player, Match } from 'glickots'; // Import interfaces

// Initialize the Glicko calculator
const glicko = new Glicko();

// Initialize new players
const playerA: Player = glicko.initializeNewPlayer();
const playerB: Player = glicko.initializeNewPlayer();

// Simulate a match
const matchResult: Match = {
  player: playerA,
  opponent: { ...playerB, rating: 1600, rd: 200 },
  score: 1, // 1 for a win, 0 for a loss, 0.5 for a draw
};

// Process game results for player A
const updatedPlayerA = glicko.processGameResults(playerA, [matchResult]);
console.log('Updated Player A:', updatedPlayerA);

// You can process multiple matches at once
const match2: Match = {
  player: playerA,
  opponent: { ...playerB, rating: updatedPlayerA.rating, rd: updatedPlayerA.rd },
  score: 0.5,
};

const updatedPlayerAAfterMultipleGames = glicko.processGameResults(updatedPlayerA, [matchResult, match2]);
console.log('Updated Player A after multiple games:', updatedPlayerAAfterMultipleGames);

// Update RD for inactivity
const daysInactive = 60;
const playerAInactive = glicko.updateRDForInactivity(updatedPlayerAAfterMultipleGames, daysInactive);
console.log('Player A after inactivity:', playerAInactive);
```

## `Configuration`

You can customize the Glicko system by passing a configuration object to the Glicko constructor. The available configuration options are:

* `initialRating`: The default rating for a new player (default: 1500).  
* `initialRD`: The default rating deviation for a new player (default: 350).  
* `inactivityConstant`: A constant used to increase RD over periods of inactivity (default: 0.5).  
* `rdCeiling`: The maximum value the RD can reach (default: 350).  
* `q`: The system constant, derived as ln(10) / 400 (default: approximately 0.005756).  
* `daysPerRatingPeriod`: The assumed average number of days in a rating period, used for inactivity calculation (default: 30).
* `roundingPrecision`: The number of decimal places to round ratings and RDs to (default: 2).  Must be a non-negative integer.


```typescript
import { Glicko } from 'glickots';  
import { GlickoConfig } from 'glickots';

const customConfig: Partial<GlickoConfig> = {  
  initialRating: 1000,  
  initialRD: 300,  
  daysPerRatingPeriod: 60,
  roundingPrecision: 0,
};

const glickoWithCustomConfig = new Glicko(customConfig);  
const newPlayer = glickoWithCustomConfig.initializeNewPlayer();  
console.log('New player with custom config:', newPlayer);
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

ISC  
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

The Glicko rating system was developed by Mark Glickman. For more information, visit [glicko.net](http://www.glicko.net/).