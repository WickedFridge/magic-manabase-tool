const config = require('config');
const Parallel = require('paralleljs');
const { customLogger } = require('../../common/logger');
const { hasTypeLand, markEtb, cachedCanPlaySpellOnCurve } = require('../cards/utils');
const { getAllCombinationsOfMaxLength } = require("../../common/tools/utils");

const { createClient } = require('../../common/api-client/scryfall/factory');
const scryfallApiClient = createClient(config.apiClients.scryfall);

const logger = customLogger('index');

async function createDeck(decklist) {
    const cards = [];
    const deck = [];
    const cardData = {};

    (await Promise.all(decklist.map(cardCountAndName => {
        const [count, name] = cardCountAndName.split(/ (.+)/);
        cards.push({ name, count: parseInt(count) });
        return scryfallApiClient.getCardByName(name);
    })))
        .forEach((card, i) => cardData[cards[i].name] = card);

    cards.forEach(({ name, count }) => {
        deck.push(...Array(count).fill(cardData[name]));
    });
    return deck
}

function getDeckStats(spells, landsCombinations) {
    const data = {};
    spells.forEach(spell => {
        const maxLength = Math.max(spell.cmc + 2, 5);
        const keepable = (c) => c.length >= Math.max(spell.cmc, 2) && c.length <= maxLength;
        const NManaLandCombinations = landsCombinations.filter(keepable);
        logger.info(spell.name);
        logger.info(NManaLandCombinations.length);
        const playableHands = NManaLandCombinations.filter(hand => cachedCanPlaySpellOnCurve(hand, spell));
        const stats = (playableHands.length / NManaLandCombinations.length * 100).toFixed(2);
        data[spell.name] = `${stats}%`;
    });
    return data;
}

async function analyzeDecklist(decklist) {
    const deck = await createDeck(decklist);

    const lands = deck
        .filter(card => hasTypeLand(card))
        .map(land => markEtb(land));

    const spells = [...new Set(deck.filter(card => !hasTypeLand(card)))];
    const maxCMC = Math.max(...spells.map(s => s.cmc + 2), 5);

    const landCombinations = getAllCombinationsOfMaxLength(lands, maxCMC);

    const data = getDeckStats(spells, landCombinations);

    logger.info(data);
    return data;
}

module.exports = {
    analyzeDecklist,
};
