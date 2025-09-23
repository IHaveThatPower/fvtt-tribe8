import { Tribe8 } from '../config.js';
import { Tribe8WeaponModel } from '../datamodels/weapon.js'; // For #addCombatModifier

export class CombatData {
	/**
	 * The actor we're preparing this CombatData for
	 * @type {Tribe8Actor}
	 */
	actor;

	/**
	 * The attribute key for the attribute chosen
	 * @type {string}
	 */
	useAttribute;

	/**
	 * The skill ID for the skill chosen
	 * @type {string}
	 */
	useCombatSkill;

	/**
	 * The weapon ID for the weapon chosen
	 * @type {string}
	 */
	useWeapon;

	/**
	 * The specialization ID for a chosen specialization
	 * @type {string}
	 */
	useSpecialization;

	/**
	 * The maneuver IDs for any chosen maneuvers
	 * @type {Array<string>}
	 */
	useManeuver;

	/**
	 * About by which we should multiply (often, halve) damage
	 * multipliers
	 * @type {number}
	 */
	multiplyDamage = 1;

	/**
	 * A set of user-supplied modifiers
	 * @type {object}
	 */
	modifier = {};

	/**
	 * The resulting set of modifiers, accounting for all of the
	 * supplied data
	 * @type {object}
	 */
	summary = {};

	/**
	 * Initialize our object
	 *
	 * @param  {Tribe8Actor} actor        Actor for which we're preparing this data
	 * @param  {object}      [data={}]    Initialize from an existing set of data
	 * @return {void}
	 * @access public
	 */
	constructor(actor, data={}) {
		this.actor = actor;
		this.summary = {
			accuracy: [0],
			parry: [0],
			fumble: '',
			damage: [0],
			traits: [],
			initiative: 0,
			defense: 0
		};
		if (data && Object.keys(data).length) this.#initializeFromObject(data);
		this.#generateSummary();
	}

	/**
	 * Get the actual Skill item belonging to our Actor that matches
	 * the ID we have set.
	 *
	 * @return {Tribe8Item|void} The Skill Item, if found
	 * @access public
	 */
	get skill() {
		if (this.actor && this.useCombatSkill) {
			return this.#getItem(this.useCombatSkill);
		}
		return undefined;
	}

	/**
	 * Get the actual Specialization item belonging to our Actor that
	 * matches the ID we have set.
	 *
	 * @return {Tribe8Item|void} The Specialization Item, if found
	 * @access public
	 */
	get spec() {
		if (this.actor && this.useSpecialization) {
			return this.#getItem(this.useSpecialization);
		}
		return undefined;
	}

	/**
	 * Get the actual Weapon item belonging to our Actor that matches
	 * the ID we have set.
	 *
	 * @return {Tribe8Item|void} The Weapon Item, if found
	 * @access public
	 */
	get weapon() {
		if (this.actor && this.useWeapon) {
			const item = this.#getItem(this.useWeapon);
			if (item) return item;
			console.warn(game.i18n.format("tribe8.errors.weapon-not-found", {'weapon': this.useWeapon}));
		}
		return undefined;
	}

	/**
	 * Determine a base range for a weapon, potentially derived from
	 * an attribute.
	 *
	 * @return {int|void} The calculated base range of the weapon
	 * @access public
	 */
	get weaponBaseRange() {
		const weapon = this.weapon;
		if (weapon) {
			if (isNaN(weapon.system.baseRange)) {
				// Extract the relevant stat
				const matchParts = weapon.system.baseRange.match(/([A-Za-z]{3})\+?(-?\d+)/);
				const attName = matchParts[1].toLowerCase();
				const attr = this.actor.system?.attributes?.primary[attName] ?? this.actor.system?.attributes?.secondary?.physical[attName] ?? {};
				return attr?.value + Number(matchParts[2]);
			}
			return weapon.system.baseRange;
		}
		return undefined;
	}

	/**
	 * Internal lookup for an item on our actor.
	 *
	 * @param  {string}          itemID    The item ID to retrieve
	 * @return {Tribe8Item|void}           The retrieve item, if found
	 * @access private
	 */
	#getItem(itemID) {
		return this.actor.getEmbeddedDocument("Item", itemID);
	}

	/**
	 * If we were given an existing data object, process it
	 *
	 * @param  {object} data    The existing data object we're initializing from
	 * @return {void}
	 * @access private
	 */
	#initializeFromObject(data) {
		Object.keys(data).forEach((p) => {
			if (Object.hasOwn(this, p)) {
				if (p == 'actor') return; // This is assigned as a constructor argument only
				// For summary, we check value-by-value
				if (p == 'summary') return; // This is computed; we don't accept assigns to it

				// For modifier, we just spread-merge
				if (p == 'modifier') {
					this.modifier = {...this.modifier, ...data.modifier};
					return;
				}
				// Anything else is just an assign
				this[p] = data[p];
			}
		});
	}

	/**
	 * Generate our full summary, and set any other properties we need
	 * to.
	 *
	 * @return {void}
	 * @access private
	 */
	#generateSummary() {
		this.#applyAttribute();
		this.#applyWeapon();
		this.#applySpecialization();
		this.#applyManeuvers();
		this.#applyInjuries();
		this.#applySituational();
		this.#applyEncumbrance();
		this.#applyMultiplyDamage();
		this.#formatSummary();
	}

	/**
	 * Given an existing calculated value for a given aspect of combat
	 * data, add the supplied modifier to it.
	 *
	 * @param  {Array|int} summaryValue     The running total so far
	 * @param  {Array|int} modifierValue    The modifier to be added
	 * @param  {string}    modifierName     The name of the modifier being added
	 * @return {Array|int}                  The mutated total
	 * @access private
	 */
	#addCombatModifier(summaryValue, modifierValue, modifierName) {
		if (!modifierValue) return summaryValue;

		// Detect whether we need to handle multiple values or not
		const summaryIsArray = summaryValue instanceof Array;
		// If the summary is an array, but the modifier is not (yet) an
		// array, see if we have the forward slash delimiter
		if (summaryIsArray && !(modifierValue instanceof Array)) {
			if (String(modifierValue).match('/') && !String(modifierValue).match(/x\d+\/\d+/))
				modifierValue = modifierValue.split('/');
		}
		const modifierIsArray = modifierValue instanceof Array;

		switch (modifierName) {
			case 'accuracy':
			case 'parry':
			case 'damage':
				// All of these modifiers should use array handling,
				// even if there are only single values within the
				// array.
				if (summaryIsArray || modifierIsArray)
					return this.#applyArrayCombatModifier(summaryValue, modifierValue, modifierName);
				console.warn(game.i18n.format("tribe8.errors.array-modifier-not-array", {'modifier': modifierName}));
				break;
			case 'initiative':
			case 'defense':
				if (modifierValue == 'N/A' || modifierValue === null || typeof modifierValue == 'undefined')
					return summaryValue;
				// Simple numeric?
				if (!isNaN(modifierValue) && !isNaN(summaryValue)) {
					summaryValue += Number(modifierValue);
					return summaryValue;
				}
				break;
			case 'fumble':
				return modifierValue ? modifierValue : summaryValue;
			default:
				console.log(`No handler for ${modifierName}`);
				break;
		}
		return summaryValue;
	}

	/**
	 * Given an existing calculated value for a given aspect of combat
	 * data, add the supplied modifier to it, assuming both the
	 * summary and modifier terms are arrays
	 *
	 * @param  {Array|int} summaryValue     The running total so far
	 * @param  {Array|int} modifierValue    The modifier to be added
	 * @param  {string}    modifierName     The name of the modifier being added
	 * @return {Array|int}                  The mutated total
	 * @access private
	 */
	#applyArrayCombatModifier(summaryValue, modifierValue, modifierName) {
		// Ensure our arrays match
		const arrayLength = Math.max(
			(modifierValue instanceof Array ? modifierValue.length : 0),
			(summaryValue instanceof Array ? summaryValue.length : 0)
		);
		summaryValue = this.#expandArrayValue(summaryValue, arrayLength);
		modifierValue = this.#expandArrayValue(modifierValue, arrayLength);

		// Now apply the modifier to the existing summary
		for (let i = 0; i < arrayLength; i++) {
			if (modifierValue[i] == 'N/A') continue;
			if (modifierValue[i] === null || typeof modifierValue[i] == 'undefined')
				continue;
			// Simple numeric?
			if (!isNaN(modifierValue[i]) && !isNaN(summaryValue[i])) {
				summaryValue[i] += Number(modifierValue[i]);
				continue;
			}
			// Riposte adds +CPLX to Acc
			if (modifierValue[i] == '+CPLX') {
				if (!this.skill) {
					console.warn(game.i18n.format("tribe8.errors.no-skill-for-modifier", {'skillId': `Skill.${this.useCombatSkill}`, 'actorId': `Actor.${this.actor.id}`, value: `${modifierValue[i]}`}));
					continue;
				}
				summaryValue[i] += Number(this.skill.system.cpx);
				continue;
			}
			// Special cases for damage
			if (modifierName == 'damage') {
				this.#applyDamageModifier(summaryValue, modifierValue, modifierName, i);
			}
			// All other formats (currently) unhandled:
			// Case 8: "as best/as worst/special" -- unhandled
			// "# of rounds"
			// console.log(game.i18n.format("tribe8.errors.unhandled-modifier", {'modifier': modifierValue[i]}));
		}
		return summaryValue;
	}

	/**
	 * Given a should-be-an-array value and a target length, do our
	 * best to expand the value to an array
	 *
	 * @param  {mixed} value     The value we're aiming to expand into an array
	 * @param  {int}   length    The target length for the resulting array
	 * @return {Array}           The expanded array, or the original value if it wasn't changed
	 * @access private
	 */
	#expandArrayValue(value, length) {
		if (!(value instanceof Array)) value = [value];
		if (value.length < length) {
			if (value.length > 1)
				console.warn(game.i18n.localize("tribe8.errors.array-combat-modifier-differing-lengths"));
			for (let i = 1; i < length; i++) {
				value[i] = value[0];
			}
		}
		return value;
	}

	/**
	 * Handle modifiers affecting damage specifically. This method
	 * presupposes its values have already been correctly transformed
	 * by #expandArrayValue calls in #applyArrayCombatModifier, and
	 * this method itself is intended to be called by the latter.
	 *
	 * @param  {Array|int} summaryValue     The running total so far
	 * @param  {Array|int} modifierValue    The modifier to be added
	 * @param  {string}    modifierName     The name of the modifier being added
	 * @param  {int}       i                The specific index in each of the arrays being examined
	 * @return {void}
	 * @access private
	 */
	#applyDamageModifier(summaryValue, modifierValue, modifierName, i) {
		// Several of the cases below will need the following
		const prefix = Tribe8WeaponModel.extractWeaponDamagePrefix(modifierValue[i]);
		let attValue = 0;
		if (prefix.match(/UD/))
			attValue = Number(this.actor.system.attributes.secondary.physical.ud.value);
		else if (prefix.match(/AD/))
			attValue = Number(this.actor.system.attributes.secondary.physical.ad.value);

		if (this.#splitCompoundDamage(modifierValue, i)) return;
		if (this.#bldBasedDamage(modifierValue, summaryValue, i)) return;
		if (this.#handleMultiplyDamage(modifierValue, i)) return;
		if (this.#handleMultiplyDamageStat(modifierValue, summaryValue, i, attValue)) return;
		if (this.#handleStandardDamage(modifierValue, summaryValue, i, prefix, attValue)) return;
		if (this.#handleFlatBoost(modifierValue, summaryValue, i)) return;
		if (this.#handleAsOther(modifierValue, i)) return;
	}

	/**
	 * If we had a compound damage field that included a special effect
	 * (e.g. an "ENT" value for the Grapple Maneuver), pre-split that
	 * from the modifier
	 *
	 * @param  {Array<mixed>} modifierValue    The modifier that may contain a compound damage term
	 * @param  {int}          i                The specific index being examined
	 * @return {bool}                          Indicates whether or not this method handled the request, which stops further checks
	 * @access private
	 */
	 #splitCompoundDamage(modifierValue, i) {
		if (modifierValue[i].match(',')) { // e.g. the "Grapple" Maneuver
			modifierValue[i] = modifierValue[i].split(',').filter((m) => !m.match(/ENT/));
			if (modifierValue[i].length > 1) {
				console.log(game.i18n.localize("tribe8.errors.long-damage-modifier"));
			}
			if (modifierValue[i].length < 1) { // e.g. "Weapon Catch", deals no damage
				return true;
			}
			modifierValue[i] = modifierValue[i][0];
		}
		return false;
	}

	/**
	 * BLD-based maneuvers replace existing damage
	 *
	 * @param  {Array<mixed>} modifierValue    The modifier that may contain a BLD damage term
	 * @param  {Array<mixed>} summaryValue     The value in the summary that should be affected
	 * @param  {int}          i                The specific index being examined
	 * @return {bool}                          Indicates whether or not this method handled the request, which stops further checks
	 * @access private
	 */
	#bldBasedDamage(modifierValue, summaryValue, i) {
		if (modifierValue[i].match(/^BLD/)) {
			// Case 2: BLD+1 (e.g. Charge)
			// Case 9: BLDx3 (e.g. Trample)
			const ourBuild = Number(this.actor.system.attributes.primary.bld.value);
			const matchParts = modifierValue[i].match(/^BLD([+-x/])(\d+)(\/\d+)?/);
			let operation = matchParts[1];
			let operand = Number(matchParts[2]);
			// If we had a third match, we need to divided the second match by it
			if (matchParts[3]) operand /= Number(matchParts[3]);
			switch (operation) {
				case '+': summaryValue[i] = ourBuild + operand; break;
				case '-': summaryValue[i] = ourBuild - operand; break;
				case 'x': summaryValue[i] = ourBuild * operand; break;
				case '/': summaryValue[i] = ourBuild / operand; break;
				default:
					console.warn(game.i18n.format("tribe8.errors.unhandled-damage-operation", {'operation': operation}));
					return false;
			}
			return true;
		}
		return false;
	}

	/**
	 * If we're globally halving or doubling damage, we simply track
	 * that for later multiplication.
	 *
	 * @param  {Array<mixed>} modifierValue    The modifier that may contain a damage multiplier term
	 * @param  {int}          i                The specific index being examined
	 * @return {bool}                          Indicates whether or not this method handled the request, which stops further checks
	 * @access private
	 */
	#handleMultiplyDamage(modifierValue, i) {
		if (modifierValue[i].match(/^\s*x\d(\/\d)?/)) {
			// Case 4: x1/2 (global halving)
			// Case 5: x2 (global doubling)
			let matchParts = modifierValue[i].trim().match(/x(\d)(\/(\d))?$/);
			let multiplier = Number(matchParts[1]);
			if (matchParts[2])
				multiplier /= Number(matchParts[3]);
			this.multiplyDamage = multiplier;
			return true;
		}
		return false;
	}

	/**
	 * Multiply a specific damage stat (e.g. AD, UD)
	 *
	 * @param  {Array<mixed>} modifierValue    The modifier that may contain a damage multiplier term
	 * @param  {Array<mixed>} summaryValue     The value in the summary that should be affected
	 * @param  {int}          i                The specific index being examined
	 * @param  {int}          attValue         The current value to be multiplied;
	 * @return {bool}                          Indicates whether or not this method handled the request, which stops further checks
	 * @access private
	 */
	#handleMultiplyDamageStat(modifierValue, summaryValue, i, attValue) {
		if (modifierValue[i].match(/^\s*(A|U)Dx\d(\/\d)?/)) {
			// Case 6: UDx1/2 (normal UD, halved)
			const matchParts = modifierValue[i].match(/x(\d)(\/(\d))?/);
			let multiplier = Number(matchParts[1]);
			if (matchParts[2])
				multiplier /= Number(matchParts[3]);
			summaryValue[i] = attValue * multiplier;
			return true;
		}
		return false;
	}

	/**
	 * The general case for weapon damage, as well as Maneuvers that
	 * replace the existing damage formula with a different value.
	 *
	 * @param  {Array<mixed>} modifierValue    The modifier that may contain the damage term
	 * @param  {Array<mixed>} summaryValue     The value in the summary that should be affected
	 * @param  {int}          i                The specific index being examined
	 * @param  {string}       prefix           The modifier's pre-extracted damage prefix
	 * @param  {int}          attValue         The current value to be multiplied;
	 * @return {bool}                          Indicates whether or not this method handled the request, which stops further checks
	 * @access private
	 */
	#handleStandardDamage(modifierValue, summaryValue, i, prefix, attValue) {
		if (prefix.length) {
			// Case 3: AD|UD+N (replaces standard; Crush, Head-Butt, Hilt-strike)
			const damageNoPrefix = Number(modifierValue[i].replace(prefix, ''));
			summaryValue[i] = attValue + damageNoPrefix;
			return true;
		}
		return false;
	}

	/**
	 * Some maneuvers provide a flat boost to the existing value
	 *
	 * @param  {Array<mixed>} modifierValue    The modifier that may contain the damage term
	 * @param  {Array<mixed>} summaryValue     The value in the summary that should be affected
	 * @param  {int}          i                The specific index being examined
	 * @return {bool}                          Indicates whether or not this method handled the request, which stops further checks
	 * @access private
	 */
	#handleFlatBoost(modifierValue, summaryValue, i) {
		if (modifierValue[i].match(/[+-]?\d+\s*$/)) {
			// Case 7: "as attack"+N
			let matchParts = modifierValue[i].trim().match(/\+?(-?\d+)$/);
			let damageBoost = Number(matchParts[1]);
			summaryValue[i] += damageBoost;
			return true;
		}
		return false;
	}

	/**
	 * If the string matches the "as X" style, and we don't have to
	 * make a determination of that (i.e. best/worst), we just take
	 * what we already have.
	 *
	 * @param  {Array<mixed>} modifierValue    The modifier that may contain the damage term
	 * @param  {int}          i                The specific index being examined
	 * @return {bool}                          Indicates whether or not this method handled the request, which stops further checks
	 * @access private
	 */
	#handleAsOther(modifierValue, i) {
		if (modifierValue[i].match(/as (attack|weapon)/i)) {
			// TODO: (Future) Can we localize this? Or maybe make the strings a config option?
			// Case 1: "as attack/weapon" -- no change; default
			return true;
		}
		return false;
	}

	/**
	 * Apply a chosen attribute as a modifier to relevant combat
	 * properties.
	 *
	 * @return {void}
	 * @access private
	 */
	#applyAttribute() {
		if (!this.useAttribute) return;
		for (let prop of ['initiative', 'accuracy', 'parry', 'defense']) {
			this.summary[prop] = this.#addCombatModifier(this.summary[prop], this.actor.system.attributes.primary[this.useAttribute]?.value, prop);
		}
	}

	/**
	 * Apply a chosen weapon as a modifier to relevant combat
	 * properties.
	 *
	 * @return {void}
	 * @access private
	 */
	#applyWeapon() {
		if (!this.weapon) return;
		this.summary.accuracy = this.#addCombatModifier(this.summary.accuracy, this.weapon.system.accuracy, 'accuracy');
		this.summary.parry = this.#addCombatModifier(this.summary.parry, this.weapon.system.parry, 'parry');
		this.summary.damage = this.#addCombatModifier(this.summary.damage, this.weapon.system.damage, 'damage');
		// Weapon Traits just get bolted onto the list.
		const weaponTraits = this.weapon.system.traits.split(',');
		this.summary.traits = this.summary.traits.concat(weaponTraits);
		this.summary.fumble = this.weapon.system.fumble;
		// Account for Complexity penalty to Acc (p. 148)
		this.summary.accuracy = this.#addCombatModifier(
									this.summary.accuracy,
									Math.min(((this.skill?.system?.cpx ?? 1) - (this.weapon.system?.complexity ?? 1)), 0),
									'accuracy'
								);
		// Account for Str penalty to all rolls (p. 148-149)
		const strTraits = weaponTraits.filter((t) => t.trim().match(/^STR.*\d/));
		if (strTraits.length) {
			for (let trait of strTraits) {
				const matchParts = trait.trim().match(/^STR[^\d]*\+?(-?\d+)/);
				const strRequired = Number(matchParts[1]);
				const strPenalty = Math.min(this.actor.system.attributes.secondary.physical.str.value - strRequired, 0);
				for (let prop of ['accuracy', 'parry']) {
					this.summary[prop] = this.#addCombatModifier(this.summary[prop], strPenalty, prop);
				}
			}
		}
	}

	/**
	 * Apply a chosen Specialization as a modifier to relevant combat
	 * properties.
	 *
	 * @return {void}
	 * @access private
	 */
	#applySpecialization() {
		if (this.spec && this.spec.system?.skill == this.skill.id) {
			this.summary.accuracy = this.#addCombatModifier(this.summary.accuracy, 1, 'accuracy');
			this.summary.parry = this.#addCombatModifier(this.summary.parry, 1, 'parry');
		}
	}

	/**
	 * Apply chosen Maneuvers as modifiers to relevant combat
	 * properties.
	 *
	 * @return {void}
	 * @access private
	 */
	#applyManeuvers() {
		if (!this.useManeuver) return
		for (let maneuverId of Object.keys(this.useManeuver)) {
			const maneuver = this.#getItem(maneuverId); // (this.actor.getItems({'type': 'maneuver'}).filter((m) => m.id == maneuverId) ?? [])[0];
			if (!maneuver || maneuver.type != 'maneuver') {
				console.warn(game.i18n.format("tribe8.errors.maneuver-not-found", {'maneuver': `Maneuver.${maneuverId}`, 'actorId': `Actor.${this.actor.id}`}));
				continue;
			}
			/**
			 * A Maneuver is applicable either when its associated
			 * Skill is selected, or its a Free (Cpx 0) Maneuver and
			 * the chosen Skill belongs to any of its allowed types.
			 */
			let maneuverApplies = false;
			maneuverApplies |= (maneuver.system?.skill == this.skill.id);
			maneuverApplies |= (maneuver.system?.complexity == 0 && maneuver.system?.allowedTypes?.includes(this.skill.system.combatCategory));
			if (!maneuverApplies) continue;
			for (let maneuverProperty in maneuver.system) {
				if (Object.hasOwn(this.summary, maneuverProperty)) {
					this.summary[maneuverProperty] = this.#addCombatModifier(this.summary[maneuverProperty], maneuver.system[maneuverProperty], maneuverProperty);
				}
			}
		}
	}

	/**
	 * Apply penalties from injuries to relevant combat properties.
	 *
	 * @return {void}
	 * @access private
	 */
	#applyInjuries() {
		if (!this.actor?.system?.actionPenalty) return;
		for (let prop of ['accuracy', 'parry', 'initiative', 'defense']) {
			this.summary[prop] = this.#addCombatModifier(this.summary[prop], this.actor.system.actionPenalty, prop);
		}
	}

	/**
	 * Apply any user-supplied situational modifiers
	 *
	 * @return {void}
	 * @access private
	 */
	#applySituational() {
		if (!this.modifier) return;
		for (let modifierName in this.modifier) {
			if (modifierName === 'range') {
				this.summary.accuracy = this.#addCombatModifier(this.summary.accuracy, Tribe8.rangeBands[this.modifier.range], 'accuracy');
				continue;
			}
			if (Object.hasOwn(this.summary, modifierName)) {
				this.summary[modifierName] = this.#addCombatModifier(this.summary[modifierName], this.modifier[modifierName], modifierName);
			}
		}
	}

	/**
	 * Apply penalties from armor encumbrance
	 *
	 * @return {void}
	 * @access private
	 */
	#applyEncumbrance() {
		if (!this.actor) return;
		if (this.actor.system?.encumbrance < 0) {
			for (let prop of ['accuracy', 'parry', 'defense']) {
				this.summary[prop] = this.#addCombatModifier(this.summary[prop], this.actor.system.encumbrance, prop);
			}
		}
	}

	/**
	 * If a previous modifier indicated that we should multiply our
	 * final damage amount by a certain amount, we do that here
	 *
	 * @return {void}
	 * @access private
	 */
	#applyMultiplyDamage() {
		if (this.multiplyDamage == 1 || (!this.multiplyDamage && this.multiplyDamage !== 0)) return;
		if (this.summary.damage instanceof Array) {
			for (let d = 0; d < this.summary.damage.length; d++) {
				this.summary.damage[d] = Math.round(this.summary.damage[d] * Number(this.multiplyDamage));
			}
		}
		else {
			this.summary.damage = Math.round(this.summary.damage * Number(this.multiplyDamage));
		}
	}

	/**
	 * Format the computed summary for display (namely, converting
	 * arrays into x/y display format)
	 *
	 * @return {void}
	 * @access private
	 */
	#formatSummary() {
		for (let prop in this.summary) {
			if (this.summary[prop] instanceof Array) {
				if (prop == 'traits')
					this.summary[prop] = this.summary[prop].join(', ');
				else
					this.summary[prop] = this.summary[prop].map((p) => (p > 0 && prop != 'damage' ? `+${p}` : p)).join('/');
			}
			else {
				this.summary[prop] = (!isNaN(this.summary[prop]) && Number(this.summary[prop]) > 0 && prop != 'damage' ? `+${this.summary[prop]}` : this.summary[prop]);
			}
		}
	}
}
