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
					attributes: new fields.NumberField({initial: 30, required: true, hint: "Number of initial character points that can be spent on attributes"}),
					general: new fields.NumberField({initial: 50, required: true, hint: "Number of additional character points that can be spent on character features other than attributes"}),
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
		return this.points.cp.generalSpent ?? 0; // This is a transient property computed by #preparePoints
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
		return this.points.xp.spent ?? 0; // This is a transient property computed by #preparePoints
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
	 * Get a character's deadlift capability, based on their Str
	 *
	 * @return {Array<int>} An array of lower and upper bounds on the deadlift in kg
	 * @access              public
	 */
	get deadlift() {
		const str = this.attributes.secondary.physical.str.value;
		return [this.constructor.#bldToMass(str), this.constructor.#bldToMass(str+1)];
	}

	/**
	 * Get the current weight of all Gear a character has on them.
	 *
	 * @return {number} The total of all Gear weights
	 * @access          public
	 */
	get carriedWeight() {
		if (!this.parent) return 0;

		const allItems = this.parent.getGear();
		if (allItems.length == 0) return 0;

		let carried = 0;
		for (let item of allItems) {
			if (item.isCarried) {
				// If weight is null, we can safely cast it to 0
				let weight = Number(item.system.weight);
				if (isNaN(weight)) weight = 0;
				// If quantity is null, we need to ensure we make it at least 1
				let qty = (typeof item.system.qty === 'number' ? Number(item.system.qty) : 1);
				if (isNaN(qty)) qty = 1;
				carried += weight * qty;
			}
		}
		return Math.round(carried * 100) / 100;
	}

	/**
	 * Given a BLD (or STR) value, convert it into the lower limit of
	 * the corresponding mass range.
	 *
	 * TODO: This really seems like it should be some kind of library function
	 *
	 * @param  {int}       value    The value to be converted
	 * @return {number}             The resulting lower-limit bound
	 * @throws {TypeError}          When the value supplied is not (or cannot be converted into) a number
	 * @access                      private
	 */
	static #bldToMass(value) {
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

	/**
	 * Get total encumbrance of the current actor, based on their
	 * equipped armor
	 *
	 * @return {int} The character's encumbrance penalty
	 * @access       public
	 */
	get encumbrance() {
		if (!this.parent) return 0; // Need an Actor document parent

		// Gather up all the items
		const allArmor = this.parent.getGear({type: 'armor'});
		if (allArmor.length == 0) return 0;

		let encumbrance = 0;

		// Separate out any equipped armor specifically
		const armorWorn = allArmor.filter((i) => i.system.equipped);
		for (let armor of armorWorn) {
			encumbrance += armor.system.encumbrance; // Partial will return 1/3
		}
		// Round down
		return Math.floor(encumbrance);
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
		if (isNaN(data.points?.xp?.total) || data.points.xp.total === null) {
			if (!Object.hasOwn(data, 'points')) data.points = {};
			if (!Object.hasOwn(data.points, 'xp')) data.points.xp = {};
			data.points.xp.total = 0;
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

		// Make sure we're finding the "best" skill we can for these values
		const skillH2H = skills['H']?.length ? skills['H'].sort(skills['H'][0].constructor.cmp)[0] : null;
		const skillMelee = skills['M']?.length ? skills['M'].sort(skills['M'][0].constructor.cmp)[0] : null;
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
		// (Re-)initialize the point expenditures
		this.points.cp.attributesSpent = 0;
		this.points.cp.generalSpent = 0;
		this.points.xp.spent = 0;

		// Compute amount spent on Attributes
		this.points.cp.attributesSpent = this.cpSpentAttributes;
		this.points.xp.spent = this.xpSpentAttributes;

		const items = this.parent.getItems();
		this.maneuverSlots = {};
		this.#prepareFreeTotemSlots();
		// Compute amount spent on various items
		for (let item of items) {
			if (item.type == 'totem' && item.inFreeSlot) // inFreeSlot comes from #prepareFreeTotemSlots
				continue;
			// Add the points
			this.points.cp.generalSpent += item.system.totalCP;
			this.points.xp.spent += item.system.totalXP;
			// Add the points to the ledger
			this.#updatePointsLedger(item.type, 'CP', item.system.totalCP)
			this.#updatePointsLedger(item.type, 'XP', item.system.totalXP)
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
		if (isNaN(amount)) {
			console.warn(`Not adding ${amount} to points ledger in ${category} as ${type} because it's not a number`);
			return;
		}

		// Initialize the fields
		this.pointsLedger = this.pointsLedger ?? {};
		this.pointsLedger[category] = this.pointsLedger[category] ?? {};
		this.pointsLedger[category][type] = this.pointsLedger[category][type] ?? 0;

		// Add it
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

		// On the actor, store any penalties to movement we might have
		if (this.parent) {
			this.parent.movementReduction = {
				'load': false,
				'injury': false
			}
		}

		// TODO: Probably should break these out
		// Apply penalties from carried load
		const deadlift = this.deadlift[0];
		const loadThresholds = CONFIG.Tribe8.loadThresholds;
		for (let threshold in loadThresholds) {
			const loadThreshold = Number(threshold) / 100;
			if (isNaN(loadThreshold)) {
				console.error("Load threshold could not be converted to a percentage");
				continue;
			}
			if (this.carriedWeight >= (deadlift * loadThreshold)) {
				const multipliers = loadThresholds[threshold];
				for (let speed in multipliers) {
					if (speed === 'descriptor') continue;
					const multiplier = Number(multipliers[speed]);
					if (isNaN(multiplier)) {
						console.error("Load threshold speed multiplier was not a number");
						continue;
					}
					this.movement[speed] *= Number(multipliers[speed]);
					this.parent.movementReduction.load = true;
				}
			}
		}

		// TODO: Probably should break these out
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
								if (this.parent) {
									this.parent.movementReduction.injury = true;
								}
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

		// Initialize a slot category for it, if we don't have one
		if (!this.maneuverSlots[item.id])
			this.maneuverSlots[item.id] = {};

		const itemSlots = item.system.bonusManeuvers;
		for (let c in itemSlots) {
			// Initialize slots of this complexity, if we don't yet have them
			if (!this.maneuverSlots[item.id][c])
				this.maneuverSlots[item.id][c] = [];
			this.maneuverSlots[item.id][c] = itemSlots[c];
		}
	}

	/**
	 * Prepare slots for Totems that the Ritual Skill's Complexity
	 * grants for free.
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
		const skillCache = {};
		for (let m = 0; m < maneuvers.length; m++) {
			const maneuver = maneuvers[m];

			// Cache the skill lookups
			let skill;
			if (Object.keys(skillCache).includes(maneuver.system.skill))
				skill = skillCache[maneuver.system.skill];
			else {
				skill = this.parent?.getEmbeddedDocument("Item", maneuver.system.skill);
				skillCache[maneuver.system.skill] = skill;
			}

			// No slots for this Skill? Move along.
			if (!Object.keys(this.maneuverSlots).includes(skill?.id)) {
				continue;
			}
			// Figure out the maximum Complexity slot available for this category
			maneuver.usesPoints = ((maneuver, skillSlots) => {
				const maxSlot = Object.keys(skillSlots).reduce((max, cat) => Number(cat) > max ? Number(cat) : max, 0);
				// Loop *down* the list
				for (let c = maxSlot; c > 0; c--) {
					if (c < maneuver.system.complexity) continue; // Too complex for this slot
					for (let s = 0; s < skillSlots[c].length; s++) {
						if (!skillSlots[c][s]) { // Found an empty slot!
							skillSlots[c][s] = maneuver;
							return false;
						}
					}
				}
				return true;
			})(maneuver, this.maneuverSlots[skill.id]); // We'll compare this with fromCpx values later

			// Refund the points!
			if (!maneuver.usesPoints) {
				this.points.cp.generalSpent -= maneuver.system.totalCP
				this.points.xp.spent -= maneuver.system.totalXP
				this.#updatePointsLedger('maneuver', 'CP', -1 * maneuver.system.totalCP);
				this.#updatePointsLedger('maneuver', 'XP', -1 * maneuver.system.totalXP);

				// If we found a slot for this Maneuver, but it's
				// not marked to use a slot, put a warning in the
				// console.
				if (!maneuver.system.fromCpx) {
					if (game.user.id == maneuver.parent.playerOwner) {
						const msg = `${maneuver.parent.name}'s '${maneuver.name} (${skill.name})' Maneuver is free due to bonus Maneuver slots, but is not marked as "from Complexity".`;
						if (foundry.ui?.notifications) foundry.ui.notifications.warn(msg);
						else console.warn(msg);
					}
				}
			}
			// If we marked the Maneuver as using points, but the
			// user marked it as from Complexity, alert them.
			if (maneuver.usesPoints && maneuver.system.fromCpx) {
				if (game.user.id == maneuver.parent.playerOwner) {
					const msg = `${maneuver.parent.name}'s '${maneuver.name} (${skill.name})' Maneuver is marked as from Complexity, but no bonus Maneuver slot was available for it.`;
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