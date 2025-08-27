export const Tribe8 = {};

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

Tribe8.attributes = {
	primary: {
		'agi': 'tribe8.actor.character.attributes.primary.agi.full',
		'app': 'tribe8.actor.character.attributes.primary.app.full',
		'bld': 'tribe8.actor.character.attributes.primary.bld.full',
		'cre': 'tribe8.actor.character.attributes.primary.cre.full',
		'fit': 'tribe8.actor.character.attributes.primary.fit.full',
		'inf': 'tribe8.actor.character.attributes.primary.inf.full',
		'kno': 'tribe8.actor.character.attributes.primary.kno.full',
		'per': 'tribe8.actor.character.attributes.primary.per.full',
		'psy': 'tribe8.actor.character.attributes.primary.psy.full',
		'wil': 'tribe8.actor.character.attributes.primary.wil.full'
	}
};
Tribe8.attributeBasis = -1; // Where attributes starts;
Tribe8.maxComplexity = 5;

/**
 * The combat meta-skills used to categorize valid uses of Combat
 * Maneuvers. Note that these do not necessarily correspond to actual
 * Skill names (e.g. "Ranged")
 */
Tribe8.COMBAT_SKILLS = {
	"C": "cavalry", // aka riding
	"D": "defense",
	"H": "handtohand",
	"M": "melee",
	"R": "ranged"
};

/**
 * The localized Skill names that might be used for magic Skills. These
 * will be put through slugify() before being compared.
 */
Tribe8.MAGIC_SKILLS = [
	"tribe8.item.skill.names.synthesis",
	"tribe8.item.skill.names.ritual",
	"tribe8.item.skill.names.technosmithing",
	"tribe8.item.skill.names.sundering"
];

/**
 * The item types that collectively represent physical items
 */
Tribe8.PHYSICAL_ITEMS = [
	"gear",
	"weapon",
	"armor"
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
 * Possible value options for Gear
 */
Tribe8.gearValueOptions = [
	"vlow",
	"low",
	"avg",
	"hi",
	"vhi"
];

/**
 * Valid weapon subcategories
 */
Tribe8.weaponCategories = {
	"melee": [
		"bludgeoning",
		"bladed",
		"axe",
		"polearm",
		"misc", // Whips & Flails
		"shield"
	],
	"ranged": [
		"tribal",
		"keeper"
	]
};

/**
 * Range choices for weapons
 */
Tribe8.weaponRanges = [
	"close",
	"throw",
	"ranged"
];

/**
 * Fumble types for ranged weapons
 */
Tribe8.fumble = [
	"low",
	"medium",
	"high"
];