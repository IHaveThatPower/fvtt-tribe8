export class Tribe8 {
	/**
	 * *****************************************************************
	 * Static properties that don't need to be configurable
	 * *****************************************************************
	 */
	static attributes = {
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

	/**
	 * The combat meta-skills used to categorize valid uses of Combat
	 * Maneuvers. Note that these do not necessarily correspond to actual
	 * Skill names (e.g. "Ranged")
	 */
	static COMBAT_SKILLS = {
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
	static MAGIC_SKILLS = [
		"tribe8.item.skill.names.synthesis",
		"tribe8.item.skill.names.ritual",
		"tribe8.item.skill.names.technosmithing",
		"tribe8.item.skill.names.sundering"
	];

	/**
	 * The item types that collectively represent physical items
	 */
	static PHYSICAL_ITEMS = [
		"gear",
		"weapon",
		"armor"
	];

	/**
	 * The penalties imposed per type of wound.
	 */
	static woundPenalties = {
		flesh: -1,
		deep: -2
	}

	/**
	 * The basic movement formula. The multiplier is applied to the sum of
	 * the Fitness attribute and Athletics skill, and then added to the base
	 * to determine the sprinting rate.
	 */
	static movementFormula = {
		base: 20,
		multiplier: 5
	}

	/**
	 * The movement rate multipliers
	 */
	static movementRates = {
		sprinting: 1,
		running: (2/3),
		jogging: (1/2),
		walking: (1/3),
		crawling: (1/5)
	}

	/**
	 * Injury multipliers for movement
	 */
	static movementInjuryMultipliers = {
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
	static movementPrecision = 1;

	/**
	 * Possible value options for Gear
	 */
	static gearValueOptions = [
		"vlow",
		"low",
		"avg",
		"hi",
		"vhi"
	];

	/**
	 * Valid weapon subcategories
	 */
	static weaponCategories = {
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
	static weaponRanges = [
		"close",
		"throw",
		"ranged"
	];

	/**
	 * Range bands and their accuracy modifiers
	 */
	static rangeBands = {
		"pointblank": 1,
		"short": 0,
		"medium": -1,
		"long": -2,
		"extreme": -3
	};

	/**
	 * Fumble types for ranged weapons
	 */
	static fumble = [
		"low",
		"medium",
		"high"
	];

	/**
	 * Valid choices for armor coverage
	 */
	static armorCoverage = [
		"chest", // Index 0 is treated as default by the Armor Model
		"face",
		"forearms",
		"full",
		"hands",
		"head",
		"hips",
		"lower legs",
		"neck",
		"shoulders"
	];

	/**
	 * Valid choices for armor concealability
	 */
	static armorConcealable = [
		"no", // Index 0 is treated as default by the Armor Model
		"somewhat",
		"yes"
	];

	/**
	 * Load thresholds (percentages) that cause carried gear to impede
	 * movement. These are cumulative.
	 */
	static loadThresholds = {
		0: {
			descriptor: 'unladen',
		},
		50: {
			sprinting: 0,
			running: 0,
			descriptor: 'laden'
		},
		75: {
			jogging: 0,
			descriptor: 'burdened'
		},
		100: {
			walking: 0,
			descriptor: 'overload'
		}
	};

	/**
	 * *****************************************************************
	 * Static properties to expose to configuration.
	 * *****************************************************************
	 */
	static attributeBasis = -1; // Where attributes starts;
	static maxComplexity = 5;

	/**
	 * What various things cost, when their cost is CP vs. XP invariant
	 */
	static costs = {
		aspect: 5,
		specialization: 5,
		totem: 7, // Additional beyond a number equal to Ritual Cpx
		attribute: 50, // Specifically for XP
	}

	/**
	 * *****************************************************************
	 * Static utility methods
	 * *****************************************************************
	 */

	/**
	 * Uniform utility to convert a provided string into an alphanumeric-
	 * only, lowercase string.
	 *
	 * @param  {string} string    The string to transform
	 * @return {string}           The sanitized slug-style string
	 * @access public
	 */
	static slugify(string) {
		return string.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
	}

	/**
	 * Identify array-style form elements in a submit package and return
	 * their names.
	 *
	 * @param  {FormData}      formData    A FormData object
	 * @return {Array<string>}             An array of form field names that have array notation
	 * @access public
	 */
	static checkFormArrayElements(formData) {
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
	 * @access public
	 */
	static registerSheets(sheetType, docs) {
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

	/**
	 * Given a BLD (or STR) value, convert it into the lower limit of
	 * the corresponding mass range.
	 *
	 * @param  {int}       value    The value to be converted
	 * @return {number}             The resulting lower-limit bound
	 * @throws {TypeError}          When the value supplied is not (or cannot be converted into) a number
	 * @access                      private
	 */
	static bldToMass(value) {
		value = Number(value);
		if (isNaN(value)) throw new TypeError("Value to be converted to Mass must be a number");

		// Below -6, we're logarithmic
		if (value < -6) return Math.pow(10, 6 + value);

		// From -7 to -5, we're quadratic
		if (value < -4) return Math.pow(value, 2) * 0.5 + 10.5 * value + 50;

		// From -5 to -3, we're linear
		if (value < -3) return 15 * value + 85;

		// From -3 to +1, we're linear with a shallower slope
		if (value < 1) return 10 * value + 70;

		// We now enter into the realm of approximation
		// From +1 to +6, we pretty exactly follow a 4th-order polynomial
		if (value < 7) {
			const a = 5/48;
			const b = -(35/72);
			const c = 35/16;
			const d = 670/63;
			const e = 67.5;
			return Math.round(a * Math.pow(value, 4) + b * Math.pow(value, 3) + c * Math.pow(value, 2) + d * value + e, 0);
		}

		// From +7 to +9, a 3rd-order polynomial
		if (value < 10) {
			const a = 80/3;
			const b = -540;
			const c = 3793 + 1/3;
			const d = -8840;
			return Math.round(a * Math.pow(value, 3) + b * Math.pow(value, 2) + c * value + d, 0);
		}

		// From +9 to +11, we suddenly go linear
		if (value < 12) return 2000 * value - 17000;

		// And finally, we're quadratic for the final stretch up to +15.
		// Beyond this, we don't have anything else, so this holds beyond +15.
		return Math.round(2500 * Math.pow(value, 2) - 52500 * value + 280000, 0);
	}
}
