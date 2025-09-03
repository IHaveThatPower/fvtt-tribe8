const { DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
import { Tribe8Application } from '../apps/base-app.js';
import { Tribe8AttributeEditor } from '../apps/attribute-editor.js';
import { Tribe8WeaponModel } from '../datamodels/weapon.js'; // For #addCombatModifier

export class Tribe8CharacterSheet extends Tribe8Application(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		form: { closeOnSubmit: false, submitOnChange: true },
		position: { width: 1200, height: 900 },
		window: {
			resizable: true,
			contentClasses: ["tribe8", "character", "sheet", "actor"]
		},
		actions: {
			incrementEdie:    Tribe8CharacterSheet.action_incrementEdie,
			decrementEdie:    Tribe8CharacterSheet.action_decrementEdie,
			editItem:         Tribe8CharacterSheet.action_editItem,
			addNewItem:       Tribe8CharacterSheet.action_addNewItem,
			useEminence:      Tribe8CharacterSheet.action_useEminence,
			combatCalculator: Tribe8CharacterSheet.action_combatCalculator,
		}
	}

	static PARTS = {
		tabs: { template: 'templates/generic/tab-navigation.hbs' },
		main: { template: 'systems/tribe8/templates/sheets/actors/character_main.html' },
		equipment: { template: 'systems/tribe8/templates/sheets/actors/character_equipment.html' },
		combat: { template: 'systems/tribe8/templates/sheets/actors/character_combat.html' }
	}

	static TABS = {
		character: {
			tabs: [
				{ id: "main", },
				{ id: "equipment", },
				{ id: "combat", }
			],
			labelPrefix: "tribe8.actor.character.tabs",
			initial: "main"
		}
	};

	/**
	 * Basic character name, no prefix.
	 *
	 * @return {string} The name of the character
	 * @access public
	 */
	get title() {
		return this.document.name;
	}

	/**
	 * Prepare the context with which the Application renders.
	 * This used to be getData() in Application V1
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// Define a little helper function on our context to handle all
		// the various things we need to ensure exist along the way
		context.ensureHas = function(name, empty) {
			if (typeof this != 'object' || this?.constructor?.name !== 'Object')
				throw new Error("Invalid state for context object; continuing would be unsafe");
			if (!this[name])
				this[name] = empty;
		}
		context.ensureHas('magic', {});
		context.magic.ensureHas = context.ensureHas;

		// Who's the player for this?
		if (this.document.playerOwner)
			context.playerName = game.users.get(this.document.playerOwner)?.name;

		// Prepare specific Skill categories
		context.hasCombatSkills = this.document.getSkills({categories: ['combat'], count: true})
		context.hasMagicSkills = this.document.getSkills({categories: ['magic'], count: true});

		context.COMBAT_SKILLS = CONFIG.Tribe8.COMBAT_SKILLS;
		this.#prepareContext_collectItems(context);
		this.#prepareContext_sortCollections(context);

		context.fumble = CONFIG.Tribe8.fumble;
		context.rangeBands = Object.keys(CONFIG.Tribe8.rangeBands);
		this.#prepareContext_combatData();
		context.combatData = this.combatData;

		// Add the tabs
		const contextWithTabs = {...context, tabs: this._prepareTabs("character")};
		return contextWithTabs;
	}

	/**
	 * Prepare collections of Items for the render context
	 *
	 * @param  {object} context    The render context as thus far assembled
	 * @return {void}
	 * @access private
	 */
	#prepareContext_collectItems(context) {
		for (let item of this.document.items) {
			let collectionName = `${item.type}s`; // Default context collection name we add items of this type to
			switch (item.type) {
				case 'skill':
					context.ensureHas(collectionName, {});
					item.specializations = ""; // Transient property for display
					if (item.system.specializations.length)
						item.specializations = item.system.specializations.map((s) => { return item.parent.getEmbeddedDocument("Item", s)?.name; }).filter((s) => s == s).join(', ');
					context[collectionName][item.id] = item;

					// Track Synthesis and Ritual, specifically
					if (CONFIG.Tribe8.slugify(item.system.name) == 'synthesis') { // TODO: (Localization) Use localized slug
						context.magic.synthesisSkill = item;
					}
					if (CONFIG.Tribe8.slugify(item.system.name) == 'ritual') { // TODO: (Localization) Use localized slug
						context.magic.ritualSkill = item;
					}
					break;
				case 'perk':
				case 'flaw':
					context.ensureHas(collectionName = 'perksAndFlaws', {});
					context[collectionName][item.id] = item;

					// Track Dreamer and Awakened Dreamer Perks
					if (CONFIG.Tribe8.slugify(item.name) == 'dreamer') { // TODO: (Localization) Use localized slug
						context.magic.hasDreamerPerk = true;
					}
					if (CONFIG.Tribe8.slugify(item.name) == 'awakeneddreamer') { // TODO: (Localization) Use localized slug
						context.magic.hasAwakenedDreamerPerk = true;
					}
					break;
				case 'maneuver':
					context.ensureHas(collectionName = 'sortedManeuvers', {});
					context[collectionName][item.id] = item;
					break;
				case 'eminence':
				case 'totem':
				case 'aspect':
					if (item.type == 'aspect') {
						collectionName = `${collectionName[0].toUpperCase()}${collectionName.slice(1)}`;
						collectionName = item.system.ritual ? `ritual${collectionName}` : `synthesis${collectionName}`;
					}
					context.magic.ensureHas(collectionName, {});
					item.cost = CONFIG.Tribe8.costs[item.type];
					context.magic[collectionName][item.id] = item;
					break
				case 'gear':
				case 'armor':
					collectionName = item.type; // Already plural
					context.ensureHas(collectionName, {});
					context[collectionName][item.id] = item;
					// Also append armor to the Gear list
					if (item.type == 'armor') {
						context.ensureHas('gear', {});
						context['gear'][item.id] = item;
					}
					break;
				default:
					context.ensureHas(collectionName, {});
					context[collectionName][item.id] = item;
					// Also append weapons to the Gear list
					if (item.type == 'weapon') {
						context.ensureHas('gear', {});
						context['gear'][item.id] = item;
					}
					break;
			}
		}
	}

	/**
	 * Sort the Item collections added to the context
	 *
	 * @param  {object} context    The render context as thus far assembled
	 * @return {void}
	 * @access private
	 */
	#prepareContext_sortCollections(context) {
		const itemSortGroups = [
			'skills', 'perksAndFlaws', 'sortedManeuvers',
			'magic.eminences', 'magic.totems',
			'magic.synthesisAspects', 'magic.ritualAspects',
			'weapons', 'armor', 'gear', 'specializations'
		];
		for (let itemGroup of itemSortGroups) {
			let contextTarget = context[itemGroup];
			const itemGroupParts = itemGroup.split('.');
			if (itemGroupParts.length > 1) {
				contextTarget = context;
				for (let c = 0; c < itemGroupParts.length; c++) {
					const contextProp = itemGroupParts[c];
					if (!contextTarget[contextProp]) {
						break;
					}
					contextTarget = contextTarget[contextProp];
				}
			}
			if (contextTarget && Object.keys(contextTarget).length) {
				const firstElement = Object.values(contextTarget)[0];
				if (firstElement?.constructor?.cmp) {
					contextTarget.sortedIDs = Object.values(contextTarget).sort(firstElement.constructor.cmp).map((i) => i.id);
				}
			}
		}
		// TODO: (UI) Support different user-driven sort methods for gear
	}

	/**
	 * We don't need to do anything fancy here, just tell the context
	 * that the current tab is the defined by the given part ID
	 *
	 * @param  {string} partId     The name of the tab/part that's active
	 * @param  {object} context    The supplied context, which we could potentially augment per-part if we needed to
	 * @return {object}            The part's prepared context
	 * @access public
	 */
	async _preparePartContext(partId, context) {
		context.tab = context.tabs[partId];
		return context;
	}

	/**
	 * Prepare all of the data necessary to display and interact with
	 * the Combat tab.
	 *
	 * @return {void}
	 * @access private
	 */
	#prepareContext_combatData() {
		// TODO: Should this whole thing (incl. #addCombatModifier) just be its own support class?
		// Initialize the return values
		if (!this.combatData) this.combatData = {};
		if (!this.combatData.summary) this.combatData.summary = {};
		this.combatData.summary.accuracy = [0];
		this.combatData.summary.parry = [0];
		this.combatData.summary.fumble = '';
		this.combatData.summary.damage = [0];
		this.combatData.summary.traits = [];
		this.combatData.summary.initiative = 0;
		this.combatData.summary.defense = 0;

		const useSkill = (this.combatData.useCombatSkill ? this.document.getEmbeddedDocument("Item", this.combatData.useCombatSkill) : {});
		if (this.combatData.useWeapon) {
			const weapon = this.document.getEmbeddedDocument("Item", this.combatData.useWeapon);
			if (weapon) {
				this.combatData.summary.accuracy = this.#addCombatModifier(this.combatData.summary.accuracy, weapon.system.accuracy, 'accuracy');
				this.combatData.summary.parry = this.#addCombatModifier(this.combatData.summary.parry, weapon.system.parry, 'parry');
				this.combatData.summary.damage = this.#addCombatModifier(this.combatData.summary.damage, weapon.system.damage, 'damage');
				// Weapon Traits just get bolted onto the list.
				const weaponTraits = weapon.system.traits.split(',');
				this.combatData.summary.traits = this.combatData.summary.traits.concat(weaponTraits);
				this.combatData.summary.fumble = weapon.system.fumble;
				// Account for Complexity penalty to Acc (p. 148)
				this.combatData.summary.accuracy = this.#addCombatModifier(
														this.combatData.summary.accuracy,
														Math.min(((useSkill?.system?.cpx ?? 1) - weapon.system.complexity), 0),
														'accuracy'
													);
				// Account for Str penalty to all rolls (p. 148-149)
				const strTraits = weaponTraits.filter((t) => t.trim().match(/^STR.*\d/));
				if (strTraits.length) {
					for (let trait of strTraits) {
						const matchParts = trait.trim().match(/^STR[^\d]*\+?(-?\d+)/);
						const strRequired = Number(matchParts[1]);
						const strPenalty = Math.min(this.document.system.attributes.secondary.physical.str.value - strRequired, 0);
						for (let prop of ['accuracy', 'parry']) {
							this.combatData.summary[prop] = this.#addCombatModifier(this.combatData.summary[prop], strPenalty, prop);
						}
					}
				}
				// Pre-process base range, if needed
				if (weapon.system.ranges.length > 1 || !weapon.system.ranges.includes('close')) {
					this.combatData.weaponBaseRange = weapon.system.baseRange;
					if (isNaN(this.combatData.weaponBaseRange)) {
						// Extract the relevant stat
						const matchParts = this.combatData.weaponBaseRange.match(/([A-Za-z]{3})\+?(-?\d+)/);
						const attName = matchParts[1].toLowerCase();
						const attr = this.document.system?.attributes?.primary[attName] ?? this.document.system?.attributes?.secondary?.physical[attName] ?? {};
						this.combatData.weaponBaseRange = attr?.value + Number(matchParts[2]);
					}
				}
			}
			else
				console.warn(`Chosen weapon ${this.combatData.useWeapon} not found`);
		}

		// Factor in Specialization use
		if (this.combatData.useSpecialization) {
			const spec = this.document.getEmbeddedDocument("Item", this.combatData.useSpecialization);
			if (spec && spec.system?.skill == useSkill.id) {
				this.combatData.summary.accuracy = this.#addCombatModifier(this.combatData.summary.accuracy, 1, 'accuracy');
				this.combatData.summary.parry = this.#addCombatModifier(this.combatData.summary.parry, 1, 'accuracy');
			}
		}

		// Factor in Maneuvers
		if (this.combatData.useManeuver) {
			for (let maneuverId of Object.keys(this.combatData.useManeuver)) {
				const maneuver = (this.document.getItems({'type': 'maneuver'}).filter((m) => m.id == maneuverId) ?? [])[0];
				if (!maneuver) {
					console.warn(`Selected Maneuver.${maneuverId} not found in Actor.${this.document.id} Maneuver list`);
					continue;
				}
				/**
				 * A Maneuver is applicable either when its associated
				 * Skill is selected, or its a Free (Cpx 0) Maneuver and
				 * the chosen Skill belongs to any of its allowed types.
				 */
				let maneuverApplies = false;
				maneuverApplies |= (maneuver.system?.skill == useSkill.id);
				maneuverApplies |= (maneuver.system?.complexity == 0 && maneuver.system?.allowedTypes?.includes(useSkill.system.combatCategory));
				if (maneuverApplies) {
					for (let maneuverProperty in maneuver.system) {
						if (Object.hasOwn(this.combatData.summary, maneuverProperty)) {
							this.combatData.summary[maneuverProperty] = this.#addCombatModifier(this.combatData.summary[maneuverProperty], maneuver.system[maneuverProperty], maneuverProperty);
						}
					}
				}
			}
		}

		// Factor in injuries
		if (this.document.system.actionPenalty) {
			for (let prop of ['accuracy', 'parry', 'initiative', 'defense']) {
				this.combatData.summary[prop] = this.#addCombatModifier(this.combatData.summary[prop], this.document.system.actionPenalty, prop);
			}
		}

		// Factor in situational
		if (this.combatData.modifier) {
			for (let modifierName in this.combatData.modifier) {
				if (modifierName === 'range') {
					this.combatData.summary.accuracy = this.#addCombatModifier(this.combatData.summary.accuracy, CONFIG.Tribe8.rangeBands[this.combatData.modifier.range], 'accuracy');
					continue;
				}
				if (Object.hasOwn(this.combatData.summary, modifierName)) {
					this.combatData.summary[modifierName] = this.#addCombatModifier(this.combatData.summary[modifierName], this.combatData.modifier[modifierName], modifierName);
				}
			}
		}

		// If we indicated an overall damage multiplier, include that
		if (Object.hasOwn(this.combatData.summary, 'multiplyDamage')) {
			if (this.combatData.summary.damage instanceof Array) {
				for (let d = 0; d < this.combatData.summary.damage.length; d++) {
					this.combatData.summary.damage[d] = Math.round(this.combatData.summary.damage[d] * Number(this.combatData.summary.multiplyDamage));
				}
			}
			else {
				this.combatData.summary.damage = Math.round(this.combatData.summary.damage * Number(this.combatData.summary.multiplyDamage));
			}
		}

		// Convert arrays into x/y display format
		for (let prop in this.combatData.summary) {
			if (this.combatData.summary[prop] instanceof Array) {
				if (prop == 'traits')
					this.combatData.summary[prop] = this.combatData.summary[prop].join(', ');
				else
					this.combatData.summary[prop] = this.combatData.summary[prop].map((p) => (p > 0 && prop != 'damage' ? `+${p}` : p)).join('/');
			}
			else {
				this.combatData.summary[prop] = (!isNaN(this.combatData.summary[prop]) && Number(this.combatData.summary[prop]) > 0 && prop != 'damage' ? `+${this.combatData.summary[prop]}` : this.combatData.summary[prop]);
			}
		}
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
		const arrayHandling = summaryIsArray || modifierIsArray;
		const arrayLength = Math.max((modifierIsArray ? modifierValue.length : 0), (summaryIsArray ? summaryValue.length : 0));

		// TODO: This is obviously too long and convoluted.
		switch (modifierName) {
			case 'accuracy':
			case 'parry':
			case 'damage':
				// All of these modifiers should use array handling,
				// even if there are only single values within the
				// array.
				if (arrayHandling) {
					// If the receiving (summary) value isn't yet of the
					// correct length, we need to clone what's currently
					// there.
					if (!summaryIsArray) summaryValue = [summaryValue];
					if (summaryValue.length < arrayLength) {
						if (summaryValue.length > 1)
							console.warn(`Adding an array combat modifier to an existing combat modifier array set of differing length. Results unpredictable`);
						for (let i = 1; i < arrayLength; i++) {
							summaryValue[i] = summaryValue[0];
						}
					}
					// If the applying modifier value isn't yet of the
					// correct length, we need to clone what's currently
					// there.
					if (!modifierIsArray) modifierValue = [modifierValue];
					if (modifierValue.length < arrayLength) {
						if (modifierValue.length > 1)
							console.warn(`Adding an array combat modifier to an existing combat modifier array set of differing length. Results unpredictable`);
						for (let i = 1; i < arrayLength; i++) {
							modifierValue[i] = modifierValue[0];
						}
					}
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
							const skill = this.document.getEmbeddedDocument("Item", this.combatData.useCombatSkill);
							if (!skill) {
								console.warn(`Couldn't locate Skill.${this.combatData.useCombatSkill} for Actor.${this.document.id}; cannot add modifier '${modifierValue[i]}'`);
								continue;
							}
							summaryValue[i] += Number(skill.system.cpx);
							continue;
						}
						// Special cases for damage
						if (modifierName == 'damage') {
							// Several of the cases below will need the following
							const prefix = Tribe8WeaponModel.extractWeaponDamagePrefix(modifierValue[i]);
							let attValue = 0;
							if (prefix.match(/UD/))
								attValue = Number(this.document.system.attributes.secondary.physical.ud.value);
							else if (prefix.match(/AD/))
								attValue = Number(this.document.system.attributes.secondary.physical.ad.value);

							/**
							 * If we had a compound damage field that
							 * included a special effect (e.g. an "ENT"
							 * value for the Grapple Maneuver), pre-
							 * split that.
							 */
							if (modifierValue[i].match(',')) { // e.g. "Grapple"
								modifierValue[i] = modifierValue[i].split(',').filter((m) => !m.match(/ENT/));
								if (modifierValue[i].length > 1) {
									console.log(`Comma-delimited damage modifier longer than expected after removing condition component; results may be unexpected`);
								}
								if (modifierValue[i].length < 1) { // e.g. "Weapon Catch", deals no damage
									continue;
								}
								modifierValue[i] = modifierValue[i][0];
							}

							// BLD-based maneuvers replace any existing damage
							if (modifierValue[i].match(/^BLD/)) {
								// Case 2: BLD+1 (e.g. Charge)
								// Case 9: BLDx3 (e.g. Trample)
								const ourBuild = Number(this.document.system.attributes.primary.bld.value);
								const matchParts = modifierValue[i].match(/^BLD([+-x/])(\d+)(\/\d+)?/);
								let operation = matchParts[1];
								let operand = Number(matchParts[2]);
								// If we had a third match, we need to divided the second match by it
								if (matchParts[3]) operand /= Number(matchParts[3]);
								switch (operation) {
									case '+':
										summaryValue[i] = ourBuild + operand;
										break;
									case '-':
										summaryValue[i] = ourBuild - operand;
										break;
									case 'x':
										summaryValue[i] = ourBuild * operand;
										break;
									case '/':
										summaryValue[i] = ourBuild / operand;
										break;
									default:
										console.warn(`Unhandled arithmetic operation ${operation} for damage modifier`);
									break;
								}
								continue;
							}

							/**
							 * If we're globally halving or doubling
							 * damage, we simply track that for later
							 * multiplication.
							 */
							if (modifierValue[i].match(/^\s*x\d(\/\d)?/)) {
								// Case 4: x1/2 (global halving)
								// Case 5: x2 (global doubling)
								let matchParts = modifierValue[i].trim().match(/x(\d)(\/(\d))?$/);
								let multiplier = Number(matchParts[1]);
								if (matchParts[2])
									multiplier /= Number(matchParts[3]);
								this.combatData.summary.multiplyDamage = multiplier;
								continue;
							}

							// Multiplying a specific damage stat
							if (modifierValue[i].match(/^\s*(A|U)Dx\d(\/\d)?/)) {
								// Case 6: UDx1/2 (normal UD, halved)
								const matchParts = modifierValue[i].match(/x(\d)(\/(\d))?/);
								let multiplier = Number(matchParts[1]);
								if (matchParts[2])
									multiplier /= Number(matchParts[3]);
								summaryValue[i] = attValue * multiplier;
								continue;
							}

							/**
							 * The general case for weapon damage, as
							 * well as Maneuvers that replace the
							 * existing damage formula with a different
							 * value.
							 */
							if (prefix.length) {
								// Case 3: AD|UD+N (replaces standard; Crush, Head-Butt, Hilt-strike)
								const damageNoPrefix = Number(modifierValue[i].replace(prefix, ''));
								summaryValue[i] = attValue + damageNoPrefix;
								continue;
							}

							/**
							 * Some maneuvers provide a flat boost to
							 * the existing value
							 */
							if (modifierValue[i].match(/[+-]?\d+\s*$/)) {
								// Case 7: "as attack"+N
								let matchParts = modifierValue[i].trim().match(/\+?(-?\d+)$/);
								let damageBoost = Number(matchParts[1]);
								summaryValue[i] += damageBoost;
								continue;
							}
						}
						// All other formats (currently) unhandled:
						// Case 1: "as attack/weapon" -- no change; default
						// Case 8: "as best/as worst/special" -- unhandled
						// "# of rounds"
						console.log(`Modifier '${modifierValue[i]}' not currently handled for Combat summary`);
					}
					return summaryValue;
				}
				else
					console.warn(`${modifierName} should always be an array operation, but non-array values detected`);
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
				console.log(`Need handler for ${modifierName}`);
				break;
		}
		return summaryValue;
	}

	/**
	 * Pre-process data for form submission. In particular:
	 *
	 * - Remove any tab name prefixes to form element names, which are
	 *   only present to prevent form field name collision.
	 * - Extract combat data modifiers and move them to the transient
	 *   combatData property for storage, while also flagging the need
	 *   to re-render after submit.
	 *
	 * @param  {Event}            event              The triggering event
	 * @param  {HTMLFormElement}  form               The top-level form element
	 * @param  {FormDataExtended} formData           The actual data payload
	 * @param  {object}           [updateData={}]    Any supplemental data
	 * @return {object}                              Prepared submission data as an object
	 * @access protected
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// If we had any tab-specific fields, remap them to their
		// proper names, or drop them, depending on which tab was active
		// at time of submit.
		const currentTab = this.tabGroups.character;
		for (let field in formData.object) {
			if (!Object.hasOwn(formData.object, field))
				continue;
			const re = new RegExp(`^${currentTab}\\.`);
			if (field.match(re)) {
				formData.object[field.replace(re, '')] = foundry.utils.deepClone(formData.object[field]);
				delete formData.object[field];
			}
		}
		// Extract combat modifiers
		const combatModifiers = Object.fromEntries(Object.entries(formData.object).filter(([key, ]) => key.match(/^combatData\.modifier\./)).map(([key, value]) => [key.replace(/^combatData\.modifier\./, ''), value]));
		if (!this.combatData) this.combatData = {};
		// If modifiers changed, flag re-render
		if (this.combatData.modifier != combatModifiers) {
			this.rerenderAfterSubmit = true;
			this.combatData.modifier = combatModifiers;
		}
		return super._prepareSubmitData(event, form, formData, updateData);
	}

	/**
	 * If we indicated in _prepareSubmitData() that we wanted to re-
	 * render after submission, we call that here.
	 *
	 * @param  {ApplicationFormConfiguration} formConfig    The form configuration for which this handler is bound
	 * @param  {Event|SubmitEvent}            event         The form submission event
	 * @return {Promise<void>}
	 * @access protected
	 */
	async _onSubmitForm(formConfig, event) {
		await super._onSubmitForm(formConfig, event);
		if (this.rerenderAfterSubmit) {
			this.rerenderAfterSubmit = false;
			this.render(); // This is async, but we don't need to await it
		}
	}

	/**
	 * Handle any special _onRender events, including event listeners
	 * that we need to ensure re-register with their elements on each
	 * re-render.
	 *
	 * @param {object} context    The rendering context
	 * @param {object} options    Supplemental rendering options
	 * @access protected
	 */
	async _onRender(context, options) {
		this.#listeners_artwork();
		this.#listeners_edie();
		this.#listeners_attEditor();

		// Scale System Shock icon font size based on container
		const shockScaler = new ResizeObserver((icons) => {
			for (const icon of icons) {
				const baseIconHeight = icon.target.parentNode?.offsetHeight;
				if (baseIconHeight) {
					const height = baseIconHeight * 0.75;
					icon.target.style.fontSize = `${height}px`;
				}
			}
		});
		this.element.querySelectorAll('div.shock-state i').forEach((i) => { shockScaler.observe(i); });

		super._onRender(context, options);
	}


	/**
	 * Setup event listeners related to the display and editing of
	 * character artwork.
	 *
	 * @return {void}
	 * @access private
	 */
	#listeners_artwork() {
		this.element.querySelector('div.portrait')?.addEventListener('click', () => {
			new foundry.applications.apps.ImagePopout({
				src: this.document.img,
				uuid: this.document.uuid,
				window: { title: this.document.name }
			}).render({ force: true });
		});
	}

	/**
	 * Setup event listeners related to handling interaction with EDie
	 * fields.
	 *
	 * @return {void}
	 * @access private
	 */
	#listeners_edie() {
		this.element.querySelectorAll('div.edie-block div.value input[type=number]').forEach((i) => {
			i.addEventListener('keyup', (e) => {
				if (!e.target) return;

				// Find the skill
				const skillId = (e.target.closest('div.skill') || {}).dataset?.itemId;
				if (!skillId) return;
				const skill = this.document.getEmbeddedDocument("Item", skillId);
				if (!skill) return;

				// Get the current and previous value
				const newValue = e.target.value;
				const oldValue = this.eDieSpent;
				let delta = newValue - oldValue;
				if (!delta || (delta < 0 && oldValue == 0)) { // Might be NaN, or 0, in which case we don't want to muck anything up
					e.target.value = oldValue;
					return;
				}

				// Stop default handling
				e.preventDefault();
				e.stopPropagation();
				e.target.readonly = true; // Block further editing until we're done

				// Act based on the direction of the change
				(async (skill, delta) => {
					await skill.system.alterEdie(delta);
				})(skill, delta).then((resolve) => {
					if (!resolve) {
						e.target.value = oldValue;
					}
					e.target.readonly = false;
				});
			});
		});
	}

	/**
	 * Spawn the Attribute Editor when any primary Attribute is clicked
	 *
	 * @return {void}
	 * @access private
	 */
	#listeners_attEditor() {
		this.element.querySelector('div.primary-attributes').addEventListener('click', (e) => {
			if (e.target.nodeName == 'H2') return;
			// Do we already have an open attribute editor for this character? If so, just focus it
			const attEditorId = `Tribe8AttributeEditor-Actor-${this.document.id}`;
			const attEditor = foundry.applications.instances[attEditorId];
			if (attEditor) {
				attEditor.render({force: true});
				return;
			}
			// Okay, make one!
			new Tribe8AttributeEditor({id: attEditorId, document: this.document}).render({force: true});
		});
	}

	/**
	 * When we first render, create context menus.
	 *
	 * @param {object} context    The rendering context
	 * @param {object} options    Supplemental rendering options
	 * @access protected
	 */
	async _onFirstRender(context, options) {
		// TODO: Create context menus
		// Invocation of createContextMenu.
		// First arg is the handler that should hand back an array of
		// objects that have all the data needed for a menu item
		// this._createContextMenu(() => ['Option 1', 'Option 2', 'Option 3'], 'div.portrait');

		// Structure for a handler's response
		/*
		return [{
			name: "SIDEBAR.CharArt",
			icon: '<i class="fa-solid fa-image"></i>',
			condition: li => {
				const actor = this.collection.get(li.dataset.entryId);
				const { img } = actor.constructor.getDefaultArtwork(actor._source);
				return actor.img !== img;
			},
			callback: li => {
				const actor = this.collection.get(li.dataset.entryId);
				new foundry.applications.apps.ImagePopout({
					src: actor.img,
					uuid: actor.uuid,
					window: { title: actor.name }
				}).render({ force: true });
			}
		},
		...
		*/
		super._onFirstRender(context, options);
	}

	/**
	 * Increment edie "other" amount
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_incrementEdie(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			// Wasn't the skill row; probably the general parent
			let currentAmount = this.document.system.edie;
			this.document.update({'system.edie': ++currentAmount});
			return;
		}
		const skillItem = this.document.getEmbeddedDocument("Item", skillRow.dataset?.itemId);
		if (!skillItem) {
			foundry.ui.notifications.error(`Could not find a Skill with the id ${skillRow.dataset?.itemId}`);
			return;
		}
		skillItem.system.alterEdie();
	}

	/**
	 * Decrement edie "other" amount
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_decrementEdie(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			// Wasn't the skill row; probably the general parent
			let currentAmount = parseInt(this.document?.system?.edie) || 0;
			this.document.update({'system.edie': --currentAmount});
			return;
		}
		const skillItem = this.document.getEmbeddedDocument("Item", skillRow.dataset?.itemId);
		if (!skillItem) {
			foundry.ui.notifications.error(`Could not find a Skill with the id ${skillRow.dataset?.itemId}`);
			return;
		}
		skillItem.system.alterEdie(-1);
	}

	/**
	 * Add a new Item to this character
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_addNewItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const actionParts = (target.name?.split('-') || []).slice(1);
		const addItemType = actionParts.shift();
		if (!addItemType || ([...Object.keys(CONFIG.Item.dataModels), 'pf'].indexOf(addItemType) < 0)) {
			foundry.ui.notifications.warn("Requested creation of unrecognized item type");
			return;
		}
		// Present special dialog for Perks/Flaws
		if (addItemType == 'pf')
			this.#presentPerkFlawPrompt(actionParts);
		else
			this.#addNewItem(addItemType, actionParts);
	}

	/**
	 * If the User requested creation of a Perk or Flaw, we need to ask
	 * them which type they want.
	 *
	 * @param {Array<string>} actionParts    The component strings that made up the form request
	 * @access private
	 */
	#presentPerkFlawPrompt(actionParts) {
		const that = this;
		DialogV2.wait({
			window: {title: "Choose Perk or Flaw"},
			content: "Do you wish to create a Perk or a Flaw?",
			buttons: [
				{label: "Perk", action: "perk"},
				{label: "Flaw", action: "flaw"},
				{label: "Cancel", action: "cancel"}
			],
			modal: true
		}).then((result) => {
			if (result == 'perk' || result == 'flaw') {
				that.#addNewItem(result, actionParts);
			}
		});
	}

	/**
	 * Open the editing dialog for an existing item
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_editItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const item = this.#getItemFromTarget(target);
		if (!item) return;
		item.sheet.render(true);
	}

	/**
	 * Mark an Eminence as used or not
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_useEminence(event, target) {
		event.stopPropagation();
		const item = this.#getItemFromTarget(target);
		if (!item) return;
		item.update({'system.used': target.checked});
	}

	/**
	 * Gather up all of the combat data inputs and store them in a
	 * transient combatData property.
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_combatCalculator(event, target) {
		// Gather all the data
		const combatData = {};
		const combatInputs = target.closest('div.character-sheet.combat').querySelectorAll('input[name^="combatData."]');
		for (let input of combatInputs) {
			if ((input.type == 'radio' || input.type == 'checkbox') && !input.checked) {
				continue; // Don't bother with unchecked radio and checkbox inputs
			}
			let inputName = input.name.replace(/^combatData\./, '');
			let inputValue = input.value;
			let propertyPath = inputName.split(/[[\].]/).filter(p => p);
			if (propertyPath.length > 1) {
				let subObject = combatData;
				for (let p = 0; p < (propertyPath.length - 1); p++) {
					if (!Object.hasOwn(subObject, propertyPath[p]))
						subObject[propertyPath[p]] = {};
					subObject = subObject[propertyPath[p]];
				}
				subObject[propertyPath.pop()] = inputValue;
			}
			else
				combatData[inputName] = inputValue;
		}
		this.combatData = combatData;
		this.render();
	}

	/**
	 * Actually create a new item
	 *
	 * @param {string}        itemType            The item type derived from inspecting the 'action' data
	 * @param {Array<string>} [actionParts=[]]    List of strings previously obtained by splitting apart the 'action' data on a form element
	 * @access private
	 */
	#addNewItem(itemType, actionParts = []) {
		const newItemName = `New ${itemType[0].toUpperCase()}${itemType.slice(1)}`;
		const newItemPayload = {type: itemType, name: newItemName};
		if (itemType == 'aspect' && actionParts.length)
			newItemPayload.ritual = (actionParts[0] == 'ritual');
		this.document.createEmbeddedDocuments('Item', [newItemPayload]).then((resolve) => {
			const newItem = resolve[0];
			// Open the editing window for it
			newItem.sheet.render(true);
		});
	}

	/**
	 * Get an embedded item by way of the button used to edit it.
	 *
	 * @param  {HTMLFormElement} target    The form element interacted with
	 * @return {Tribe8Item|bool}           Either the matching Item, or false if it couldn't be found
	 * @access private
	 */
	#getItemFromTarget(target) {
		// Check the provided item, its parent, and any .identity div child
		const id =
			target.dataset?.itemId ??
			target.parentNode?.dataset?.itemId ??
			false;
		if (!id) {
			foundry.ui.notifications.warn("Item ID could not be determined");
			return false;
		}
		const item = this.document.getEmbeddedDocument('Item', id);
		if (!item) {
			foundry.ui.notifications.warn("Item not found");
			return false;
		}
		return item;
	}
}
