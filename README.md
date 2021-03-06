# Project Manabase
This Project is developped with a goal of color sources optimization.
The Goal is to have the best mix of lands to play your spells.
It has been started by Charles Wickham in February 2020.

## TODO
- [x] express
- [x] scryfall
    - [x] call scryfall with the decklist
    - [x] get simple objects
    - [x] test that everything matches
    - [x] test with mocked scryfall
- deployment
    - [x] expose cloud function
    - [x] expose basic front
- known bugs
    - [ ] X amounts in cycling isn't working
- features
    - backEnd
        - mana
            - [x] handle ravlands
            - [ ] handle phyrexian mana
            - [x] handle colorless mana
            - [x] handle hybrid mana
            - [x] handle fetchlands
            - [x] handle checklands
            - [x] handle fastlands
        - modal spells
            - [x] handle splitcards
            - [x] handle alternate costs
            - [x] handle escape
            - [x] handle X spells
    - front
        - [x] mobile overlay
        - [ ] non-conditional probability
        - [ ] add contact page
        - [ ] rework placeholder
            - [x] basic replacement
        - [ ] nice recap graph
        - [ ] mean / median / percentiles
        - [ ] navbar
            - [x] chose X spell
            - [ ] %'s of playing spells at N+X
        - [ ] nice sideboard input
        
- performance upgrades
    - [ ] handle colorless spells
    - [x] use reddis for the cache
    - [ ] parallelization
        - [x] try parallel.js
        - [x] try multi-services archi
        - [ ] try clusters
    - architecture refactoring
        - [ ] precalculate / cache "generic combinations"
        - [x] "on the go calculation"
    - search each CMC only once

## Usage

### Prerequisites
As this project relies on Firebase, you need to install it on your local environment in order to start the backend.
[See more about installing firebase.](https://firebase.google.com/docs/cli)
```
npm install -g firebase-tools
```

### Setup
```
npm run start
cd functions/
npm run serve
```

### *[POST]* /analyze
```
{
    "deck": [
        "4 Temple of Mystery",
        "2 Island",
        "4 Forest",
        "2 Mountain",
        "1 Frilled Mystic",
        "2 Growth Spiral"
    ],
    "xValue": 2
}
```
