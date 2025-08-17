export const Tribe8 = {};

Tribe8.attributes = {
	primary: {
		'agi': 'Agility',
		'app': 'Appearance',
		'bld': 'Build',
		'cre': 'Creativity',
		'fit': 'Fitness',
		'inf': 'Influence',
		'kno': 'Knowledge',
		'per': 'Perception',
		'psy': 'Psyche',
		'wil': 'Willpower'
	}
};
Tribe8.attributeBasis = -1; // Where attributes starts;

/**
 * The combat meta-skills used to categorize valid uses of Combat
 * Maneuvers. Note that these do not necessarily correspond to actual
 * skill names (e.g. "Ranged")
 */
Tribe8.COMBAT_SKILLS = {
	"C": "Cavalry",
	"D": "Defense",
	"H": "Hand-to-Hand",
	"M": "Melee",
	"R": "Ranged"
};

/**
 * The skill slugs that qualify as "ranged" skills.
 */
Tribe8.RANGED_COMBAT_SKILL_REFERENCE = [
	'archery',
	'gunnery',
	'heavyweapons',
	'smallarms',
	'throwing'
];

/**
 * The skill slugs that might be used for "hand to hand" skills, in
 * addition to "handtohand" itself
 */
Tribe8.HAND_TO_HAND_VARIATIONS = [
	'h2h',
	'hth',
	'htoh',
	'hand2hand'
];

/**
 * What various things cost, when their cost is CP vs. XP invariant
 */
Tribe8.costs = {
	aspect: 5,
	specialization: 5,
	totem: 7, // Additional beyond a number equal to Ritual Cpx
	attribute: 50, // Specifically for XP
}

/**
 * The penalties imposed per type of wound.
 */
Tribe8.woundPenalties = {
	flesh: -1,
	deep: -2
}

/**
 * The basic movement formula. The multiplier is applied to the sum of
 * the Fitness attribute and Athletics skill, and then added to the base
 * to determine the sprinting rate.
 */
Tribe8.movementFormula = {
	base: 20,
	multiplier: 5
}

/**
 * The movement rate multipliers
 */
Tribe8.movementRates = {
	sprinting: 1,
	running: (2/3),
	jogging: (1/2),
	walking: (1/3),
	crawling: (1/5)
}

/**
 * Injury multipliers for movement
 */
Tribe8.movementInjuryMultipliers = {
	flesh: {
		1: {
			sprinting: 0,
			running: 0
		}
	},
	deep: {
		1: {
			sprinting: 0,
			running: 0,
			jogging: 0
		},
		2: {
			sprinting: 0,
			running: 0,
			jogging: 0,
			walking: 0
		}
	}
}

/**
 * How precise our rounding is for movement display.
 */
Tribe8.movementPrecision = 1;

/**
 * Uniform utility to convert a provided string into an alphanumeric-
 * only, lowercase string.
 *
 * @param  {string} string    The string to transform
 * @return {string}           The sanitized slug-style string
 */
Tribe8.slugify = function(string) {
	return string.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
};

/**
 * Identify array-style form elements in a submit package and return
 * their names.
 *
 * @param  {FormData} formData    A FormData object
 * @return {Array}                An array of form field names that have array notation
 */
Tribe8.checkFormArrayElements = function(formData) {
	const checkKeys = [];
	Object.keys(formData.object).forEach((f) => {
		if (f.match(/\[/)) {
			checkKeys.push(f);
		}
	});
	return checkKeys;
};

/**
 * Given a single-character identifier and an array of skill items,
 * find the one that matches the combat skill indicated by the
 * indentifier
 *
 * @param  {string}        key       The one-letter combat skill category designator
 * @param  {Array}         skills    The list of skills to be filtered
 * @return {Array|boolean}           The matching list of combat skill slug names, or false if none found
 */
Tribe8.findCombatSkill = function(key, skills) {
	if (Object.keys(Tribe8.COMBAT_SKILLS).indexOf(key) < 0)
		return false;
	if (!(skills instanceof Array) || !skills.length)
		return false;
	if (typeof key != 'string' || key.length != 1)
		return false;
	return skills.find((s) => {
		const skillNameOptions = ((key) => {
			if (key == 'H')
				return [Tribe8.COMBAT_SKILLS['H'], ...Tribe8.HAND_TO_HAND_VARIATIONS];
			if (key == 'R')
				return [...Tribe8.RANGED_COMBAT_SKILL_REFERENCE];
			return [Tribe8.COMBAT_SKILLS[key]];
		})(key);
		for (let opt of skillNameOptions) {
			if (Tribe8.slugify(s.name) == Tribe8.slugify(opt))
				return s;
		}
		return false;
	});
}

/**
 * Register sheets of the indicated type using the supplied sheet
 * collection.
 *
 * @param  {string}          sheetType    The type of sheet we're going to register (Actor or Item)
 * @param  {WorldCollection} docs         The existing document collection for the entity type
 * @throws {Error}                        If we don't have the expected global game namespace.
 */
Tribe8.registerSheets = function(sheetType, docs) {
	if (!game.tribe8 || !game.tribe8.applications) {
		throw new Error('Cannot register sheets without the Tribe 8 game namespace');
	}
	const { sheets } = foundry.applications;

	// Unregister core sheets
	for (let suffix of ['Sheet', 'SheetV2']) {
		const sheetName =`${sheetType}${suffix}`;
		if (sheets[sheetName]) {
			docs.unregisterSheet('core', sheets[sheetName]);
		}
	}

	// Register our sheets
	for (let modelType in CONFIG[sheetType].dataModels) {
		if (Tribe8.slugify(modelType) == 'specialization') // Doesn't have its own sheet
			continue;
		const sheetName = `Tribe8${modelType[0].toUpperCase() + modelType.slice(1)}Sheet`;
		const sheet = game.tribe8.applications[sheetName];
		if (!sheet) {
			console.warn(`No defined sheet found for ${modelType}`);
			continue;
		}
		const makeDefault = ((sheetType == 'Actor' && modelType == 'character') || (sheetType == 'Item' && modelType == 'item'));
		docs.registerSheet('tribe8', sheet, { types: [modelType], makeDefault: makeDefault });
	}
}