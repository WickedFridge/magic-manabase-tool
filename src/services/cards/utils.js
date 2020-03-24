const config = require('config');
const { customLogger } = require('../../common/logger');
const { copy, getAllCombinations } = require('../../common/tools/utils');

const logger = customLogger('utils');

const cache = new Map();

function hasTypeLand(card) {
    return RegExp('Land').test(card.type);
}

function markEtb(card) {
    return {
        etbTapped: RegExp('enters the battlefield tapped').test(card.text),
        ...card,
    }
}

function hasCorrectColors(lands, spell) {
    return Object.keys(spell.cost).filter(color => color !== 'generic').every(color => {
        return lands.some(l => l.colors.includes(color));
    });
}

function hasUntappedLand(lands) {
    return lands.some(l => l.etbTapped === false);
}

function findCorrectLand(lands, color) {
    if (color === 'generic') {
        return lands[0];
    }
    const exactMatchs = lands.filter(land => land.colors.length === 1 && land.colors.includes(color));
    if (exactMatchs.length > 0) {
        return exactMatchs[0];
    }
    return lands.find(land => land.colors.includes(color));
}

/**
 * Evaluate if the cost can be paid with the lands
 * /!\ still basic algorythm for now
 * return true if it can be paid
 * @param lands
 * @param cost
 * @returns {boolean}
 */
function evaluateCost(lands, cost) {
    const colorsToFind = copy(cost);
    const remainingLands = copy(lands).sort((land1, land2) => land1.colors.length - land2.colors.length);
    const usedLands = [];
    const sortedLandsToFind = Object.keys(cost).sort((c1, c2) => c1.length - c2.length);
    sortedLandsToFind.forEach((color) => {
        for(let i=0; i<cost[color]; i++) {
            const foundLand = findCorrectLand(remainingLands, color);
            if (!foundLand) {
                return;
            }
            usedLands.push(...remainingLands.splice(remainingLands.findIndex(l => l.name === foundLand.name), 1));
            colorsToFind[color]--;
        }
    });
    return Object.values(colorsToFind).every(l => l === 0) && hasUntappedLand(usedLands);
}

function canPlaySpellOnCurve(lands, spell) {
    if (!hasCorrectColors(lands, spell)) {
        return false;
    }
    if (!hasUntappedLand(lands)) {
        return false;
    }

    const comb = getAllCombinations(lands).filter(l => l.length === spell.cmc);
    if (comb.length === 0) {
        return false;
    }
    return comb.some(comb => evaluateCost(comb, spell.cost));
}

function cachedCanPlaySpellOnCurve(lands, spell) {
    const key = JSON.stringify([spell.mana_cost, lands.map(l => l.name).sort()]);
    const value = cache.has(key) ?
        cache.get(key) :
        canPlaySpellOnCurve(lands, spell);

    cache.set(key, value);
    return value;


}

function getManaCost(codifiedCmc) {
    const manacost = {};
    if (!codifiedCmc) {
        return manacost;
    }
    const matches = codifiedCmc.substr(1).slice(0,-1).split('}{');

    matches.forEach((val) => {
        if (!!parseInt(val)) {
            manacost.generic = parseInt(val);
        } else {
            manacost[val] = (manacost[val] || 0) + 1;
        }
    });
    return manacost;
}

function getCache() {
    return cache;
}

module.exports = {
    hasTypeLand,
    markEtb,
    evaluateCost,
    getManaCost,
    cachedCanPlaySpellOnCurve,
    hasCorrectColors,
    getCache,
};
