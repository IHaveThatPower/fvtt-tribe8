const fields = foundry.data.fields;

export class Tribe8CharacterModel extends foundry.abstract.TypeDataModel {
	/**
	 * Defines the schema for a Character. Several fields, notably the
	 * attributes, call out to other global-to-this-file functions, but
	 * which are not exported from it.
	 *
	 * @return {object} The schema definition for a character
	 * @access public
	 */
	static defineSchema() {
		return {
			tribe: new fields.StringField({hint: "Tribe into which the character was born or most directly identifies", blank: true, trim: true}),
			role: new fields.StringField({hint: "Role this character plays in their Cell", blank: true, trim: true}),
			attributes: new fields.SchemaField({
				primary: new fields.SchemaField(
					Object.fromEntries(
						Object.keys(CONFIG.Tribe8.attributes.primary).map((a) => {
							return [
								a,
								new fields.SchemaField(Tribe8PrimaryAttribute(CONFIG.Tribe8.attributes.primary[a], a))
							];
						})
					)
				),
				secondary: new fields.SchemaField({
					physical: new fields.SchemaField({
						str: new fields.SchemaField(Tribe8SecondaryAttribute('Strength', 'str')),
						hea: new fields.SchemaField(Tribe8SecondaryAttribute('Health', 'hea')),
						sta: new fields.SchemaField(Tribe8SecondaryAttribute('Stamina', 'sta')),
						/*
						ud: new fields.SchemaField(Tribe8SecondaryAttribute('Unarmed Damage', 'ud')),
						ad: new fields.SchemaField(Tribe8SecondaryAttribute('Armed Damage', 'ad')),
						*/
						thresholds: new fields.SchemaField({
							flesh: new fields.SchemaField(Tribe8SecondaryAttribute('Flesh Wound', 'FW')),
							deep: new fields.SchemaField(Tribe8SecondaryAttribute('Deep Wound', 'DW')),
							death: new fields.SchemaField(Tribe8SecondaryAttribute('Instant Death', 'ID'))
						}),
						shock: new fields.SchemaField({
							...Tribe8SecondaryAttribute('System Shock', 'SS')
						})
					})
				})
			}),
			wounds: new fields.SchemaField({
				flesh: new fields.NumberField({hint: "Number of Flesh Wounds sustained", initial: 0, required: true}),
				deep: new fields.NumberField({hint: "Number of Deep Wounds sustained", initial: 0, required: true})
			}),
			points: new fields.SchemaField({
				cp: new fields.SchemaField({
					attributes: new fields.NumberField({hint: "Number of initial character points that can be spent on attributes", initial: 30, required: true}),
					general: new fields.NumberField({hint: "Number of additional character points that can be spent on character features other than attributes", initial: 50, required: true}),
				}),
				xp: new fields.SchemaField({
					total: new fields.NumberField({hint: "Number of total XP accumulated by the character", initial: 0, required: true})
				}),
			}),
			edie: new fields.NumberField({hint: "Number of bonus EDie available, beyond unspent XP", initial: 0, required: true})
		};
	}

	/**
	 * Get the number of eDie available from unspent XP
	 *
	 * @return {int} The total XP-derived EDie
	 * @access public
	 */
	get edieFromXP() {
		return Math.max(this.points.xp.total - this.points.xp.spent, 0);
	}

	/**
	 * Get the total number of EDie available.
	 *
	 * @return {int} The total available EDie
	 * @access public
	 */
	get edieTotal() {
		return (this.edieFromXP + this.edie);
	}

	/**
	 * Get the total number of CP spent on attributes
	 *
	 * @return {int} The attribute CP expenditure
	 * @access public
	 */
	get cpSpentAttributes() {
		return Object.keys(this.attributes.primary).reduce((acc, att) => {
			return acc + this.attributes.primary[att].cp;
		}, 0);
	}

	/**
	 * Get the total number of CP spent on everything else
	 *
	 * @return {int} The general CP expenditure
	 * @access public
	 */
	get cpSpentGeneral() {
		if (!this.parent) throw new ReferenceError("Cannot determine CP spent before data model knows what Actor it belongs to");
		return this.points.cp.generalSpent;
	}

	/**
	 * Get the total number of XP spent on attributes
	 *
	 * @return {int} The attribute XP expenditure
	 * @access public
	 */
	get xpSpentAttributes() {
		return Object.keys(this.attributes.primary).reduce((acc, att) => {
			return acc + this.attributes.primary[att].xp;
		}, 0);
	}

	/**
	 * Get the total number of XP spent on everything else
	 *
	 * @return {int} The general XP expenditure
	 * @access public
	 */
	get xpSpentGeneral() {
		if (!this.parent) throw new ReferenceError("Cannot determine XP spent before data model knows what Actor it belongs to");
		return this.points.xp.spent;
	}

	/**
	 * Get the current action penalty
	 *
	 * @return {int} Current penalty imposed due to wounds
	 * @access public
	 */
	get actionPenalty() {
		return (this.wounds.flesh * CONFIG.Tribe8.woundPenalties.flesh) + (this.wounds.deep * CONFIG.Tribe8.woundPenalties.deep);
	}

	/**
	 * Get the current System Shock value
	 *
	 * @return {int} How much Shock capacity we've got left
	 * @access       public
	 */
	get shock() {
		return this.actionPenalty * -1;
	}

	/**
	 * Remap any legacy data to the new model format, prior to
	 * attempting to load it.
	 *
	 * @param  {object} data    The source data
	 * @return {object}         The transformed source data
	 * @access public
	 */
	static migrateData(data) {
		if (typeof data.edie !== 'number') {
			if (data.edie?.fromBonus) data.edie = data.edie.fromBonus;
			else data.edie = 0;
		}
		return super.migrateData(data);
	}

	/**
	 * Call out to internal methods that need to initialize data before
	 * anything else does.
	 *
	 * @access public
	 */
	prepareBaseData() {
		super.prepareBaseData();
		this.#preparePrimaryAttributes();
		this.#prepareSecondaryAttributes();
	}

	/**
	 * Call out to internal methods that ensure the model has all the
	 * derived information it needs to properly represent the character.
	 *
	 * @access public
	 */
	prepareDerivedData() {
		super.prepareDerivedData();
		this.#prepareDamageMultipliers(); // Depends on embedded documents
		this.#preparePoints(); // Depends on embedded documents
		this.#prepareMovement(); // Depends on secondary attributes, embedded documents, and wounds
	}

	/**
	 * Compute the value of each attribute, based on its CP and XP
	 *
	 * @access private
	 */
	#preparePrimaryAttributes() {
		for (let a in this.attributes.primary) {
			const attData = this.attributes.primary[a];

			// All atts start at -1
			let attValue = CONFIG.Tribe8.attributeBasis;

			// Add CP. Negative CP have the same value at the same rate
			// as positive, just negative.
			attValue += (attData.cp < 0 ? -1 : 1)*Math.floor(Math.sqrt(Math.abs(attData.cp)));
			this.#updatePointsLedger('attributes', 'CP', attData.cp);

			// Add XP. Negative XP not a thing.
			attValue += Math.floor(Math.max(attData.xp, 0) / CONFIG.Tribe8.costs.attribute);
			this.#updatePointsLedger('attributes', 'XP', attData.xp);

			// Account for weird edge case bonuses
			attValue += attData.bonus ?? 0;

			// Set the value
			attData.value = attValue;
		}
	}

	/**
	 * Compute the value of each derived/secondary attribute, based on
	 * the primary attributes.
	 *
	 * TODO: (Future) This currently only deals with physical secondaries.
	 *
	 * @access private
	 */
	#prepareSecondaryAttributes() {
		const priAtts = this.attributes.primary;
		const secAtts = this.attributes.secondary.physical;

		// We need to do STR, HEA, and STA first
		secAtts.str.value = ((bld, fit) => {
			if ((bld + fit) > 0) return Math.floor((bld + fit) / 2);
			return Math.ceil((bld + fit) / 2);
		})(priAtts.bld.value, priAtts.fit.value);

		// STA depends on HEA, so HEA first
		secAtts.hea.value = Math.round((priAtts.fit.value + priAtts.psy.value + priAtts.wil.value) / 3);
		secAtts.sta.value = Math.max((5 * (priAtts.bld.value + secAtts.hea.value)) + 25, 10);

		// Next, wound thresholds
		secAtts.thresholds.flesh.value = Math.ceil(secAtts.sta.value / 2);
		secAtts.thresholds.deep.value = secAtts.sta.value;
		secAtts.thresholds.death.value = secAtts.sta.value * 2;

		// Finally, system shock
		secAtts.shock.value = Math.max(secAtts.hea.value + 5, 1);
	}

	/**
	 * Prepare damage multipliers. These depend on Skills, and so have
	 * to be called after embedded documents are loaded.
	 *
	 * @access private
	 */
	#prepareDamageMultipliers() {
		const { primary: priAtts, secondary: { physical: secAtts } } = this.attributes;
		const skills = this.parent.getSkills({categories: ['combat']});

		const skillH2H = CONFIG.Tribe8.findCombatSkill('H', skills['H']);
		const skillMelee = CONFIG.Tribe8.findCombatSkill('M', skills['M']);
		secAtts.ud = Tribe8SecondaryAttribute("Unarmed Damage", "UD");
		secAtts.ad = Tribe8SecondaryAttribute("Armed Damage", "AD");
		secAtts.ud.value = Math.max(3 + secAtts.str.value + priAtts.bld.value + (skillH2H?.system?.level ?? 0), 1);
		secAtts.ad.value = Math.max(3 + secAtts.str.value + priAtts.bld.value + (skillMelee?.system?.level ?? 0), 1);
	}

	/**
	 * Compute the total number of CP and XP spent
	 *
	 * @access private
	 */
	#preparePoints() {
		// Compute amount spent on Attributes
		this.points.cp.attributesSpent = this.cpSpentAttributes;
		this.points.xp.spent = this.xpSpentAttributes;

		// Record where we're spending points, for diagnostic and display
		this.pointsLedger = {};

		const items = this.parent.getItems();
		this.maneuverSlots = {};
		this.#prepareFreeTotemSlots();
		// Compute amount spent on various items
		for (let item of items) {
			// Add the points
			this.points.cp.generalSpent += item.totalCP;
			this.points.xp.spent += item.totalXP;
			// Add the points to the ledger
			this.#updatePointsLedger(item.type, 'CP', item.totalCP)
			this.#updatePointsLedger(item.type, 'XP', item.totalXP)
			// If this Item is a Skill, see if it grants bonus Maneuvers
			this.#grantManeuverSlots(item);
		}
		// Now check to see if any Maneuvers can have their points
		// refunded, due to occupying a bonus slot.
		this.#fillManeuverSlots();
	}

	/**
	 * Update the points ledger for this character with the supplied
	 * values.
	 *
	 * @param  {string} category    Category points are being adjusted for
	 * @param  {string} type        Type of points (CP, XP) to track
	 * @param  {int}    amount      Amount by which to increase or decrease the current value
	 * @return {void}
	 * @access private
	 */
	#updatePointsLedger(category, type, amount) {
		if (!this.pointLedger) this.pointsLedger = {};
		if (!this.pointsLedger[category]) this.pointsLedger[category] = {};
		if (!this.pointsLedger[category][type]) this.pointsLedger[category][type] = 0;
		this.pointsLedger[category][type] += amount;
	}

	/**
	 * Determine the character's various movement rates, accounting for
	 * their wounds.
	 *
	 * @access private
	 */
	#prepareMovement() {
		const fitness = this.attributes.primary.fit;
		const athletics = (this.parent.getSkills({search: ['athletics']}) ?? [])[0];

		// Calculate our basis (Sprinting) rate
		let movementBasis = fitness.value + (athletics ? athletics.system.level : 0);
		movementBasis *= CONFIG.Tribe8.movementFormula.multiplier;
		movementBasis += CONFIG.Tribe8.movementFormula.base;

		// Calculate our actual rates
		this.movement = {...CONFIG.Tribe8.movementRates};
		for (let rate of Object.keys(this.movement))
			this.movement[rate] *= movementBasis;

		// Apply any penalties from wounds.
		if (this.wounds.deep > 0 || this.wounds.flesh > 0) {
			((currentWounds, movementRates) => {
				const injuryMult = CONFIG.Tribe8.movementInjuryMultipliers;
				// sort() works here simply because "d" comes before "f", putting the more-severe wound category first.
				for (let type of Object.keys(this.wounds).sort()) {
					// Each key corresponds to a number of wounds of that type at and above which the penalty applies.
					// Sorting it in reverse means we go through in descending order, seeing which one applies.
					const sortedWoundThresholds = Object.keys(injuryMult[type]).map(t => Number(t)).sort().reverse();
					for (let woundThreshold of sortedWoundThresholds) {
						// As soon as we find a threshold that matches our current wound count of this type, we're done
						if (currentWounds[type] >= woundThreshold) {
							const injuredRates = injuryMult[type][woundThreshold];
							// Apply any multipliers we find in the reference table to our existing rates
							for (let rate of Object.keys(injuredRates)) {
								movementRates[rate] *= injuredRates[rate];
							}
							return;
						}
					}
				}
			})(this.wounds, this.movement);
		}

		// Round the numbers a bit, if needed
		const roundScale = 10 ** Math.min(Math.max(CONFIG.Tribe8.movementPrecision, 0), 4); // Enforce a hard limit of millimeter precision
		for (let rate in this.movement) {
			this.movement[rate] = Math.round(this.movement[rate] * roundScale) / roundScale;
		}
	}

	/**
	 * Add bonus Maneuver capacity for the character for a given Skill.
	 *
	 * @param  {Tribe8Item} item    The Skill that's granting capacity
	 * @return {void}
	 * @access private
	 */
	#grantManeuverSlots(item) {
		if (item.type !== 'skill') return;
		// What combat category does this Skill belong to?
		let combatCat = item.system.isCombat;
		if (!combatCat) return;

		// Initialize a slot category for it, if we don't have one
		if (!this.maneuverSlots[combatCat])
			this.maneuverSlots[combatCat] = {};

		// Join this Skill's slots with existing ones.
		const itemSlots = item.system.bonusManeuvers;
		for (let c in itemSlots) {
			// Initialize slots of this complexity, if we don't yet have them
			if (!this.maneuverSlots[combatCat][c])
				this.maneuverSlots[combatCat][c] = [];
			this.maneuverSlots[combatCat][c] = this.maneuverSlots[combatCat][c].concat(itemSlots[c]);
		}
	}

	/**
	 * Similar to _prepareBonusManeuverSlots(), prepare slots for Totems
	 * that the Ritual Skill's Complexity grants for free.
	 *
	 * @return {void}
	 * @access private
	 */
	#prepareFreeTotemSlots() {
		// Create a tracking property for free Totems
		this.totemSlots = [];

		// Find the Ritual Skill and use it to initialize our Totem slots
		const ritual = (this.parent.getSkills({search: ['ritual']}) ?? [])[0];
		if (!ritual) return;
		this.totemSlots = [...Array(ritual.system.cpx)];

		// Do we have any totems to put in those slots?
		const totems = this.parent.getItems({type: 'totem'}).filter((t) => !t.system.granted);
		if (!totems.length) return;

		// Do an initial sort, before we mark any of the totems as
		// requiring points. This will put any that have been
		// explicitly marked as "fromCpx" at the top, and thus fill the
		// slot the owner likely expects it to fill.
		totems.sort(totems[0].cmp);
		for (let totem of totems) {
			let foundSlot = false;
			for (let s = 0; s < this.totemSlots.length; s++) {
				if (typeof this.totemSlots[s] === 'undefined') {
					// We found a slot!
					foundSlot = true;
					this.totemSlots[s] = totem;
					totem.inFreeSlot = true;
					// If this totem wasn't already marked as fromCpx
					// and the viewing user is an owner, let them know
					if (!totem.system.fromCpx) {
						if (game.user.id == totem.parent.playerOwner) {
							const msg = `${totem.parent.name}'s '${totem.name}' Totem is free based on their Ritual Skill's Complexity, but it is not marked as such.`;
							if (foundry.ui?.notifications) foundry.ui.notifications.warn(msg);
							else console.warn(msg);
						}
					}
				}
			}
			// If the Totem was marked "fromCpx", but we didn't find a
			// slot for it, add a property to it that flags it as still
			// counting.
			if (!foundSlot && totem.system.fromCpx) {
				totem.fromPoints = true;
			}
		}
	}

	/**
	 * Fill maneuvers marked as complexity bonus maneuvers into
	 * available slots, refunding CP or XP in the process.  Any
	 * leftover at the end will be applied to regular CP or XP, as
	 * appropriate.
	 *
	 * @access private
	 */
	#fillManeuverSlots() {
		// If we didn't identify slots, bail out
		if (!Object.keys(this.maneuverSlots).length) return;

		// Get the character's Maneuvers
		const maneuvers = this.parent.getItems({type: 'maneuver'}).filter(m => !m.granted);
		// If we don't have any, bail out
		if (!maneuvers.length) return;

		// Sort, which should order first by Skill sort, then by
		// those marked as fromCpx, then by the Maneuver complexity.
		maneuvers.sort(maneuvers.constructor.cmp);

		// Fill the slots!
		for (let m = 0; m < maneuvers.length; m++) {
			const maneuver = maneuvers[m];
			const category = maneuver.system.category;
			// No slots for this category? Move along.
			if (!Object.keys(this.maneuverSlots).includes(category))
				continue;
			// Figure out the maximum Complexity slot available for this category
			maneuver.usesPoints = ((maneuver, catSlots) => {
				const maxCatSlot = Object.keys(catSlots).reduce((max, cat) => Number(cat) > max ? Number(cat) : max, 0);
				// Loop *down* the list
				for (let c = maxCatSlot; c > 0; c--) {
					if (c < maneuver.system.complexity) continue; // Too complex for this slot
					for (let s = 0; s < catSlots[c].length; s++) {
						if (!catSlots[c][s]) { // Found an empty slot!
							catSlots[c][s] = maneuver;
							return false;
						}
					}
				}
				return true;
			})(maneuver, this.maneuverSlots[category]); // We'll compare this with fromCpx values later

			// Refund the points!
			if (!maneuver.usesPoints) {
				this.points.cpGeneralSpent -= maneuver.system.totalCP
				this.points.xp -= maneuver.system.totalXP
				this.#updatePointsLedger('maneuver', 'CP', -1 * maneuver.system.totalCP);
				this.#updatePointsLedger('maneuver', 'XP', -1 * maneuver.system.totalXP);

				// If we found a slot for this Maneuver, but it's
				// not marked to use a slot, put a warning in the
				// console.
				if (!maneuver.system.fromCpx) {
					if (game.user.id == maneuver.parent.playerOwner) {
						const msg = `${maneuver.parent.name}'s '${maneuver.name} (${category})' Maneuver is free due to bonus Maneuver slots, but is not marked as "from Complexity".`;
						if (foundry.ui?.notifications) foundry.ui.notifications.warn(msg);
						else console.warn(msg);
					}
				}
			}
			// If we marked the Maneuver as using points, but the
			// user marked it as from Complexity, alert them.
			if (maneuver.usesPoints && maneuver.system.fromCpx) {
				if (game.user.id == maneuver.parent.playerOwner) {
					const msg = `${maneuver.parent.name}'s '${maneuver.name} (${category})' Maneuver is marked as from Complexity, but no bonus Maneuver slot was available for it.`;
					if (foundry.ui?.notifications) foundry.ui.notifications.warn(msg);
					else console.warn(msg);
				}
			}
		}
	}
}

/**
 * Helper function that returns a populated object with fields common to
 * all primary Attributes
 *
 * @param  {string} name     The name of this Attribute
 * @param  {string} label    The 3-letter label for the Attribute
 * @return {object}          The pre-populated primary Attribute fields
 */
function Tribe8PrimaryAttribute(name, label) {
	return {
		'label': new fields.StringField({hint: "The short name used to identify this attribute on a character sheet", blank: false, initial: `${label}`, required: true}),
		'name': new fields.StringField({hint: "The full name of this attribute", blank: false, initial: `${name}`, required: true}),
		'value': new fields.NumberField({hint: "The current calculated value of this attribute", initial: -1, positive: false, required: true}),
		'cp': new fields.NumberField({hint: "The number of CP invested in this attribute", initial: 0, positive: false, required: true}),
		'xp': new fields.NumberField({hint: "The number of XP invested in this attribute", initial: 0, required: true, validate: (value) => (value >= 0) })
	};
}

/**
 * Helper function that returns a populated object with fields common to
 * all secondary Attributes
 *
 * @param  {string} name     The name of this Attribute
 * @param  {string} label    The short label for the Attribute
 * @return {object}          The pre-populated secondary Attribute fields
 */
function Tribe8SecondaryAttribute(name, label) {
	return {
		'label': new fields.StringField({hint: "The short name used to identify this attribute on a character sheet", blank: false, initial: `${label}`, required: true}),
		'name': new fields.StringField({hint: "The full name of this attribute", blank: false, initial: `${name}`, required: true}),
		'value': new fields.NumberField({hint: "The current calculated value of this attribute", initial: 0, required: true})
	};
}