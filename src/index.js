const config = require('config');
const { island, forest, guildGate, growthSpiral } = require('./cards');
const { getAllCombinations, canPlaySpellOnCurve } = require('./utils');
const { createClient } = require('./common/api-client/scryfall/factory');
const { customLogger } = require('./common/logger');

const logger = customLogger('index');
const scryfallApiClient = createClient(config.apiClients.scryfall);


async function searchCard(cardName) {
    const forestCard = await scryfallApiClient.getCardByName(cardName);
    logger.info(forestCard);
}

const lands = [
    guildGate(0),
    guildGate(1),
    guildGate(2),
    guildGate(3),
    forest(0),
    forest(1),
    forest(2),
    forest(3),
    forest(4),
    forest(5),
    forest(6),
    forest(7),
    forest(8),
    forest(9),
    forest(10),
    forest(11),
    forest(12),
];

const keepableLandCombinations = getAllCombinations(lands).filter(c => c.length >= 2 && c.length <= 5);
const playableHands = keepableLandCombinations.filter(hand => canPlaySpellOnCurve(hand, growthSpiral(0)));
const unplayableHands = keepableLandCombinations.filter(hand => !canPlaySpellOnCurve(hand, growthSpiral(0)));
logger.info(keepableLandCombinations.length);
logger.info(playableHands.length / keepableLandCombinations.length);
// console.log(playableHands);

searchCard('Growth Spiral').then();