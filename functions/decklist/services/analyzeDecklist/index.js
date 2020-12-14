const config = require('config');
const { performance } = require('perf_hooks');
const { customLogger } = require('../../../common/logger');
const { hasTypeLand, markEtbAndLandType, cachedCanPlaySpellOnCurve, isDFC, isMDFC, isPathway, getArrayOfCards, calculateCMC } = require('../../cards/utils');
const { getAllCombinationsOfMinAndMaxLengthWithCallback } = require("../../../common/tools/utils");
const { getLandNOnCurveProba, getAverageLandCountInHand } = require('../../../common/tools/hypergeometric');

const { createClient: createScryfallClient } = require('../../../common/api-client/scryfall/factory');

const scryfallApiClient = createScryfallClient(config.apiClients.scryfall);
const logger = customLogger('index');

function splitCountAndName(input) {
    const words = input.split(' ');
    const count = words.shift();
    const name = words.join(' ');
    return [count, name];
}

function handleXSpell(card, xValue) {
    if (!card.cost.X) {
        return;
    }
    card.cost.generic = card.cost.X * xValue;
    delete card.cost.X;
    card.cmc = calculateCMC(card.cost);
}

function handleFetchlands(lands) {
    const fetchs = new Set(lands.filter(land => land.fetchland));
    fetchs.forEach(fetch => {
        logger.info(`fetch : ${fetch.name}`);
        const landTypes = ['Basic', 'Plains', 'Island', 'Swamp', 'Forest', 'Mountain'];
        const targets = fetch.fetchland.filter(prop => landTypes.includes(prop));
        const colors = [];
        lands.forEach(land => {
            if (targets.some(t => land.type.includes(t))) {
                colors.push(...land.colors);
            }
        });
        fetch.colors.push(...new Set(colors));
    })
}

function handleNotManaProducingLands(lands) {
    lands.forEach(land => {
        land.producesMana = land.colors.length > 0;
    })
}

function handleSplitCard(card, splitcard, xValue, cardsCount) {
    const spells = [];
    const lands = [];
    if (!hasTypeLand(splitcard)) {
        handleXSpell(splitcard, xValue);
        spells.push(splitcard);
        return [spells, lands];
    }
    if (isMDFC(card)) {
        lands.push(...getArrayOfCards(cardsCount, splitcard, card.name))
        return [spells, lands];
    }
}

function handlePathway(card, cardsCount) {
    const colors = [...new Set(card.card_faces
        .reduce((acc, splitcard) => [...acc, ...splitcard.colors], []))];
    const text = card.card_faces.reduce((acc, splitcard) => `${acc} ${splitcard.text}`, '');
    card.colors = colors;
    card.text = text;
    return getArrayOfCards(cardsCount, card, card.name);
}

async function fetchCardInfo(decklist, xValue) {
    const spells = [];
    const lands = [];
    const cardsCount = {};

    (await Promise.all(decklist.map(cardCountAndName => {
        const [count, name] = splitCountAndName(cardCountAndName);
        cardsCount[name] = parseInt(count);
        return scryfallApiClient.getCardByName(name);
    })))
        .forEach((card) => {
            logger.info(card);
            // handle splitcards
            if (isDFC(card)) {
                if (isPathway(card)) {
                    lands.push(...handlePathway(card, cardsCount));
                } else {
                    card.card_faces.forEach(splitcard => {
                        const [addedSpells, addedLands] = handleSplitCard(card, splitcard, xValue, cardsCount);
                        spells.push(...addedSpells);
                        lands.push(...addedLands);
                    })
                }
            }
            else if (!hasTypeLand(card)) {
                // handle regular spells
                handleXSpell(card, xValue);
                spells.push(card);
            } else {
                // handle lands
                const count = cardsCount[card.name];
                const landsToPush = Array(count).fill(markEtbAndLandType(card));
                lands.push(...landsToPush);
            }
        });
    return [cardsCount, spells, lands];
}


async function createDeck(decklist, xValue) {

    const [deckCardsCount, deckSpells, deckLands] = await fetchCardInfo(decklist.deck, xValue);
    const [sideCardsCount, sideSpells, sideLands] = await fetchCardInfo(decklist.sideboard, xValue);
    const [commanderCardsCount, commander] = await fetchCardInfo(decklist.commander, xValue);

    const spells = [...deckSpells, ...sideSpells, ...commander];
    const lands = [...deckLands];

    const cardCounts = {
        deck: deckCardsCount,
        sideboard: sideCardsCount,
        commander: commanderCardsCount,
    }

    handleFetchlands(lands);
    handleNotManaProducingLands(lands);
    const deckSize = Object.values(cardCounts.deck).reduce((acc, cur) => acc + cur);
    return [lands, spells, deckSize];
}


async function analyzeDecklist(decklist, xValue = 2) {
    const t0 = performance.now();
    const [lands, spells, deckSize] = await createDeck(decklist, xValue);
    const averageLandCount = getAverageLandCountInHand(deckSize, lands.length);
    logger.info(`lands : ${lands.length}`);
    logger.info(`spells : ${spells.length}`);
    logger.info(spells);
    logger.info(`deckSize : ${deckSize}`);
    logger.info('deck created !');
    const t1 = performance.now();
    const maxCMC = Math.max(...spells.map(s => s.cmc), 4);
    const minCMC = Math.min(...spells.map(s => s.cmc), 2);

    const data = {};
    spells.forEach(s => {
        data[s.name] = {
            cmc: s.cmc,
            ok: 0,
            nok: 0,
        };
    });

    const callback = (data, spells) => (comb) => {
        spells.forEach(spell => {
            const keepable = (c) => c.length >= Math.max(spell.cmc, 2)
                && c.length <= Math.max(2, Math.max(spell.cmc, averageLandCount));
            // const keepable = (c) => c.length === Math.max(spell.cmc, 2);
            if (!keepable(comb)) {
                return;
            }
            if (!comb.every(land => land.producesMana)) {
                data[spell.name].nok ++;
                return;
            }
            if (cachedCanPlaySpellOnCurve(comb, spell)) {
                data[spell.name].ok ++;
            } else {
                data[spell.name].nok ++;
            }
        });
    };

    const t2 = performance.now();
    getAllCombinationsOfMinAndMaxLengthWithCallback(callback(data, spells), lands, minCMC, maxCMC);
    const t3 = performance.now();
    Object.entries(data).forEach(([spellName, spellData]) => {
        spellData.p1 = 100 * spellData.ok / (spellData.ok + spellData.nok) || 0;
        // spellData.p3 = 100 * getLandNOnCurveProba(deckSize - sideboardSize, lands.length, spellData.cmc);
        spellData.p2 = 100 * spellData.ok / (spellData.ok + spellData.nok) * getLandNOnCurveProba(deckSize, lands.length, spellData.cmc) || 0;
    });
    logger.info(data);
    logger.info(`create deck: ${t1-t0}`);
    logger.info(`intermediate time: ${t2-t1}`);
    logger.info(`get Stats: ${t3-t2}`);
    return data;
}

module.exports = {
    analyzeDecklist,
    splitCountAndName,
    handleFetchlands
};
