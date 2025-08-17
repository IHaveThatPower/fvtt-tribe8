const fields = foundry.data.fields;

export class Tribe8CharacterModel extends foundry.abstract.TypeDataModel {
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
						ud: new fields.SchemaField(Tribe8SecondaryAttribute('Unarmed Damage', 'ud')),
						ad: new fields.SchemaField(Tribe8SecondaryAttribute('Armed Damage', 'ad')),
						thresholds: new fields.SchemaField({
							flesh: new fields.SchemaField(Tribe8SecondaryAttribute('Flesh Wound', 'FW')),
							deep: new fields.SchemaField(Tribe8SecondaryAttribute('Deep Wound', 'DW')),
							death: new fields.SchemaField(Tribe8SecondaryAttribute('Instant Death', 'ID'))
						}),
						shock: new fields.SchemaField({
							...Tribe8SecondaryAttribute('System Shock', 'SS'),
							current: new fields.NumberField({hint: "The current value of this attribute", initial: 0, required: true})
						})
					})
				})
			}),
			points: new fields.SchemaField({
				cp: new fields.SchemaField({
					attributes: new fields.NumberField({hint: "Number of initial character points that can be spent on attributes", initial: 30, required: true}),
					general: new fields.NumberField({hint: "Number of additional character points that can be spent on character features other than attributes", initial: 50, required: true}),
					attributesSpent: new fields.NumberField({hint: "Number of character points that have been spent on attributes", initial: 0, required: true}),
					generalSpent: new fields.NumberField({hint: "Number of additional character points that have been spent on character features other than attributes", initial: 0, required: true}),
				}),
				xp: new fields.SchemaField({
					total: new fields.NumberField({hint: "Number of total XP accumulated by the character", initial: 0, required: true}),
					spent: new fields.NumberField({hint: "Number of total XP spent by the character", initial: 0, required: true})
				}),
			}),
			edie: new fields.SchemaField({
				total: new fields.NumberField({hint: "Total number of EDie available", initial: 0, required: true}),
				fromXP: new fields.NumberField({hint: "Number of EDie available from unspent XP", initial: 0, required: true}),
				other: new fields.NumberField({hint: "Number of bonus EDie available, beyond unspent XP", initial: 0, required: true})
			})
		};
	}

	/**
	 * Remap any legacy data to the new model format, prior to
	 * attempting to load it.
	 *
	 * @param  {object} data    The source data
	 * @return {object}         The transformed source data
	 */
	static migrateData(data) {
		// Ensure we get a proper static reference
		const that = ((this.name ?? '').toLowerCase() !== 'function' ? this : this.constructor);

		// Use the "general" property instead of the "character" property
		foundry.abstract.Document._addDataFieldMigration(data, "system.points.cp.character", "system.points.cp.general");

		const schemaData = that.defineSchema();
		data = that.recursivelyFixLabelsAndNames(data, schemaData);

		return super.migrateData(data);
	}

	/**
	 * Loop through the source data to fix certain schema properties
	 * that may have drifted, but aren't meant to be user-changeable.
	 * If an object is encountered, recursively evaluate it.
	 *
	 * @param  {object} data      The source data
	 * @param  {object} schema    The schema or subset thereof specific to this key "depth"
	 * @return {object}           The transformed data
	 */
	static recursivelyFixLabelsAndNames(data, schema) {
		const that = ((this.name ?? '').toLowerCase() !== 'function' ? this : this.constructor);
		for (let key of Object.keys(schema)) {
			if (data[key]) {
				if (data[key].constructor.name === 'Object' || schema[key].fields) {
					data[key] = that.recursivelyFixLabelsAndNames(data[key], schema[key].fields);
					continue;
				}
				if (data[key].constructor.name === 'Array') {
					continue;
				}
				// Only change these
				if (key == 'hint' || key == 'label' || key == 'name') {
					if (schema[key].initial && data[key] != schema[key].initial) {
						data[key] = schema[key].initial;
					}
				}
			}
		}
		return data;
	}

	/**
	 * Call out to internal methods that ensure the model has all the
	 * derived information it needs to properly represent the character.
	 *
	 * @param {...Parameters} args    Standard invocation arguments, which this method doesn't use
	 */
	prepareDerivedData(...args) {
		super.prepareDerivedData(...args)
		this.preparePrimaryAttributes();
		this.prepareSecondaryAttributes();
		this.preparePoints();
	}

	/**
	 * Compute the value of each attribute, based on its CP and XP
	 */
	preparePrimaryAttributes() {
		for (let a in this.attributes.primary) {
			const attData = this.attributes.primary[a];

			// All atts start at -1
			let attValue = CONFIG.Tribe8.attributeBasis;

			// Add CP. Negative CP have the same value at the same rate
			// as positive, just negative.
			attValue += (attData.cp < 0 ? -1 : 1)*Math.floor(Math.sqrt(Math.abs(attData.cp)));

			// Add XP. Negative XP not a thing.
			attValue += Math.floor(Math.max(attData.xp, 0) / CONFIG.Tribe8.costs.attribute);

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
	 * TODO: This currently only deals with physical secondaries. TBD
	 * if we end up using the others.
	 */
	prepareSecondaryAttributes() {
		const priAtts = this.attributes.primary;
		const secAtts = this.attributes.secondary.physical;
		const skills = this.parent.getCombatSkills();

		// We need to do STR, HEA, and STA first
		secAtts.str.value = (
			function(bld, fit) {
				if ((bld + fit) > 0) {
					return Math.floor((bld + fit) / 2);
				}
				return Math.ceil((bld + fit) / 2);
			})(priAtts.bld.value, priAtts.fit.value);
		secAtts.hea.value = Math.round((priAtts.fit.value + priAtts.psy.value + priAtts.wil.value) / 3);
		secAtts.sta.value = Math.max((5 * (priAtts.bld.value + secAtts.hea.value)) + 25, 10);

		// Next, armed/unarmed
		const skillH2H = CONFIG.Tribe8.findCombatSkill('H', skills['H']);
		const skillMelee = CONFIG.Tribe8.findCombatSkill('M', skills['M']);
		secAtts.ud.value = Math.max(3 + secAtts.str.value + priAtts.bld.value + (skillH2H?.system?.level ?? 0), 1);
		secAtts.ad.value = Math.max(3 + secAtts.str.value + priAtts.bld.value + (skillMelee?.system?.level ?? 0), 1);

		// Next, wound thresholds
		secAtts.thresholds.flesh.value = Math.ceil(secAtts.sta.value / 2);
		secAtts.thresholds.deep.value = secAtts.sta.value;
		secAtts.thresholds.death.value = secAtts.sta.value * 2;

		// Finally, system shock
		secAtts.shock.value = Math.max(secAtts.hea.value + 5, 1);
	}

	/**
	 * Compute the total number of CP and XP spent
	 */
	preparePoints() {
		const priAtts = this.attributes.primary;

		// Compute amount spent on Attributes
		this.points.cp.attributesSpent = Object.keys(priAtts).reduce((accumulator, attName) => {
			return accumulator + priAtts[attName].cp;
		}, 0);
		this.points.xp.spent = Object.keys(priAtts).reduce((accumulator, attName) => {
			return accumulator + priAtts[attName].xp;
		}, 0);

		// Record where we're spending points, for diagnostic and display
		this.pointsLedger = {};

		// Compute amount spent on various items
		this._prepareBonusManeuverSlots();
		this._prepareFreeTotemSlots();
		for (let item of this.parent.getEmbeddedCollection("Item")) {
			switch (item.type) {
				case 'skill':
					this._applySkillPoints(item);
					break;
				case 'perk':
				case 'flaw':
					this._applyPerkFlawPoints(item);
					break;
				case 'maneuver':
					this._applyManeuverPoints(item);
					break;
				case 'aspect':
					this._applyAspectPoints(item);
					break;
				case 'totem':
					this._applyTotemPoints(item);
					break;
				default:
					// Other items, like actual equipment, don't affect points
					break;
			}
		}
		this._fillManeuverSlots();

		// Compute e-dice
		if (this.points.xp.spent < this.points.xp.total)
			this.edie.fromXP = this.points.xp.total - this.points.xp.spent;
		this.edie.total = this.edie.fromXP + this.edie.other;
	}

	/**
	 * Add a given skill's points to the current tally. Called by
	 * _preparePoints()
	 *
	 * @param  {Tribe8Item} item    The item from which we're applying points
	 * @throws {Error}              If we encounter a specialization that somehow doesn't belong to this model's document
	 */
	_applySkillPoints(item) {
		if (!this.pointsLedger['skills']) this.pointsLedger['skills'] = {'CP': 0, 'XP': 0, 'EDice': {'XP': 0, 'Bonus': 0}};
		this.points.cp.generalSpent += item.system.points.level.cp;
		this.points.cp.generalSpent += item.system.points.cpx.cp;
		this.points.xp.spent += item.system.points.level.xp;
		this.points.xp.spent += item.system.points.cpx.xp;
		this.points.xp.spent += item.system.points.edie.fromXP;
		this.pointsLedger['skills']['CP'] += item.system.points.level.cp + item.system.points.cpx.cp;
		this.pointsLedger['skills']['XP'] += item.system.points.level.xp + item.system.points.cpx.xp;
		this.pointsLedger['skills']['EDice']['XP'] += item.system.points.edie.fromXP;
		this.pointsLedger['skills']['EDice']['Bonus'] += item.system.points.edie.fromBonus;

		// Compute amount spent on specializations
		if (item.system.specializations.length > 0) {
			if (!this.pointsLedger['skills']['specializations']) this.pointsLedger['skills']['specializations'] = {'CP': 0, 'XP': 0};
			for (let specID of item.system.specializations) {
				const spec = item.parent.getEmbeddedDocument("Item", specID);
				if (spec?.system?.points == 'CP') {
					this.points.cp.generalSpent += CONFIG.Tribe8.costs.specialization;
					this.pointsLedger['skills']['specializations']['CP'] += CONFIG.Tribe8.costs.specialization;
				}
				else if (spec?.system?.points == 'XP') {
					this.points.xp.spent += CONFIG.Tribe8.costs.specialization;;
					this.pointsLedger['skills']['specializations']['XP'] += CONFIG.Tribe8.costs.specialization;
				}
				else {
					throw new Error(`Specialization ${specID} from Skill ${item.id} not found on Actor ${item.parent.id}`);
				}
			}
		}
	}

	/**
	 * Add a given perk or flaw's points to the current tally. Called
	 * by _preparePoints()
	 *
	 * @param {Tribe8Item} item    The item from which we're applying points
	 */
	_applyPerkFlawPoints(item) {
		if (item.system.granted) return; // No cost applied
		let bucket = `${item.type}s`;
		if (!this.pointsLedger[bucket]) this.pointsLedger[bucket] = {'CP': 0, 'XP': 0};
		const baseCost = item.system.baseCost;
		const perRankCost = item.system.perRank;
		for (let r = 0; r < item.system.points.length; r++) {
			const rank = item.system.points[r];
			const cost = (r == 0 ? baseCost : perRankCost);
			if (rank === 'CP')
				this.points.cp.generalSpent += cost;
			else
				this.points.xp.spent += cost;
			this.pointsLedger[bucket][rank] += cost;
		}
	}

	/**
	 * Iterate through all of the character's skills and figure out
	 * what the "capacity" for bonus maneuvers is.
	 */
	_prepareBonusManeuverSlots() {
		// Initialize the combat skill reference list
		const combatSkillReference = {...CONFIG.Tribe8.COMBAT_SKILLS};
		for (let key of Object.keys(combatSkillReference)) {
			if (combatSkillReference[key].constructor.name !== 'Array') {
				combatSkillReference[key] = [CONFIG.Tribe8.slugify(combatSkillReference[key])];
			}
		}
		combatSkillReference['R'] = combatSkillReference['R'].concat(CONFIG.Tribe8.RANGED_COMBAT_SKILL_REFERENCE);
		combatSkillReference['H'] = combatSkillReference['H'].concat(CONFIG.Tribe8.HAND_TO_HAND_VARIATIONS);

		// Initialize the object that stores our complexity caps
		this.maneuverCpxCaps = {};

		// Gather up all the character's skill and initialize maneuver capacity objects for them
		const allSkills = Array.from(this.parent.getEmbeddedCollection("Item")).filter((i) => i.type == 'skill');
		for (let skill of allSkills) {
			const skillNameSlug = CONFIG.Tribe8.slugify(skill.system.name);
			for (let skillGroup of Object.keys(combatSkillReference)) {
				if (combatSkillReference[skillGroup].indexOf(skillNameSlug) >= 0) {
					if (!this.maneuverCpxCaps[skillGroup])
						this.maneuverCpxCaps[skillGroup] = [];
					this.maneuverCpxCaps[skillGroup].push({'id': skill.id, 'nameSlug': skillNameSlug, cpx: skill.system.cpx, slots: {}});
				}
			}
		}
		// Run through each of the capacity objects and populate slots
		for (let group of Object.keys(this.maneuverCpxCaps)) {
			for (let skillObj of this.maneuverCpxCaps[group]) {
				for (let c = skillObj.cpx; c > 0; c--) {
					skillObj.slots[c] = [...Array(c)];
				}
			}
		}
	}

	/**
	 * Similar to _prepareBonusManeuverSlots(), prepare slots for Totems
	 * that the Ritual Skill's Complexity grants for free.
	 */
	_prepareFreeTotemSlots() {
		// Create a tracking property for free Totems
		this.totemSlots = [];
		const ritual = (Array.from(this.parent.getEmbeddedCollection("Item")).filter(i => i.type == 'skill').filter(s => (CONFIG.Tribe8.slugify(s.system?.name || '') == 'ritual')) ?? [])[0];
		if (ritual)
			this.totemSlots = [...Array(ritual.cpx)];

		const totems = Array.from(this.parent.getEmbeddedCollection("Item")).filter(i => i.type == 'totem' && !i.system.granted);
		if (!totems.length) return;

		// Do an initial sort, before we mark any of the totems as requiring points
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
						if (game.user.id == totem.parent.getPlayerOwner()) {
							foundry.ui.notifications.warn(`${totem.parent.name}'s '${totem.name}' Totem is free based on their Ritual Skill's Complexity, but it is not marked as such.`);
						}
					}
				}
			}
			if (!foundSlot && totem.system.fromCpx) {
				totem.fromPoints = true; // This will tell _applyTotemPoints() to count this
			}
		}
	}

	/**
	 * Add a given combat maneuver's cost to the current tally. Called
	 * by _preparePoints()
	 *
	 * @param {Tribe8Item} item    The item from which we're applying points
	 */
	_applyManeuverPoints(item) {
		if (item.system.granted) return;
		if (item.system.fromCpx) {
			// See _fillManeuverSlots()
			if (!this.maneuversToFillSlots) this.maneuversToFillSlots = [];
			this.maneuversToFillSlots.push(item);
			return;
		}
		if (!this.pointsLedger['maneuvers']) this.pointsLedger['maneuvers'] = {'CP': 0, 'XP': 0};
		if (item.system.points == 'CP') {
			this.points.cp.generalSpent += item.system.complexity;
			this.pointsLedger['maneuvers']['CP'] += item.system.complexity;
		}
		else {
			this.points.xp.spent += item.system.complexity;
			this.pointsLedger['maneuvers']['XP'] += item.system.complexity;
		}
	}

	/**
	 * Fill maneuvers marked as complexity bonus maneuvers into
	 * available slots. Any leftover at the end will be applied to
	 * regular CP or XP, as appropriate.
	 */
	_fillManeuverSlots() {
		if (!this.maneuversToFillSlots || !this.maneuversToFillSlots.length)
			return;

		// Sort the maneuvers by skill, then complexity
		this.maneuversToFillSlots.sort((a, b) => {
			if (a.system.forSkill < b.system.forSkill)
				return -1;
			if (a.system.forSkill > b.system.forSkill)
				return 1;
			if (a.system.complexity > b.system.complexity)
				return -1;
			if (a.system.complexity < b.system.complexity)
				return 1;
			if (a._stats.createdTime < b._stats.createdTime)
				return -1;
			if (a._stats.createdTime > b._stats.createdTime)
				return 1;
			return 0;
		});

		// Fill the slots!
		if (Object.keys(this.maneuverCpxCaps).length) {
			// See if we can find a slot for it
			for (let m = 0; m < this.maneuversToFillSlots.length; m++) {
				const maneuver = this.maneuversToFillSlots[m];
				const fs = maneuver.system.forSkill;
				// Did we have any capacity for this maneuver's skill?
				thisManeuver:
				if (this.maneuverCpxCaps[fs]) {
					for (let skill of this.maneuverCpxCaps[fs]) {
						for (let c = skill.cpx; c > 0; c--) {
							if (c < maneuver.system.complexity) continue;
							for (let i = 0; i < skill.slots[c].length; i++) {
								if (!skill.slots[c][i]) { // Found an empty slot!
									skill.slots[c][i] = maneuver;
									maneuver.usesPoints = false;
									this.maneuversToFillSlots[m] = null;
									break thisManeuver; // TODO: Yikes...
								}
							}
						}
					}
				}
			}
		}

		// Filter out any null where we dealt with the maneuver with complexity slots
		this.maneuversToFillSlots = this.maneuversToFillSlots.filter((m) => !!m);

		// If we have any left over, pay for them normally.
		if (this.maneuversToFillSlots.length) {
			if (!this.pointsLedger['maneuvers']) this.pointsLedger['maneuvers'] = {'CP': 0, 'XP': 0};
			for (let maneuver of this.maneuversToFillSlots) {
				maneuver.usesPoints = true;
				if (maneuver.system.points == 'CP') {
					this.points.cp.generalSpent += maneuver.system.complexity;
				}
				else {
					this.points.xp.spent += maneuver.system.complexity;
				}
				this.pointsLedger['maneuvers'][maneuver.system.points] += maneuver.system.complexity;
			}
		}
	}

	/**
	 * Add a given aspect's points to the current tally. Called by
	 * _preparePoints()
	 *
	 * @param {Tribe8Item} item    The item from which we're applying points
	 */
	_applyAspectPoints(item) {
		if (item.system.granted) return; // No cost applied
		if (!this.pointsLedger['aspects']) this.pointsLedger['aspects'] = {};
		const magicType = item.system.ritual ? 'ritual' : 'synthesis';
		if (!this.pointsLedger.aspects[magicType]) this.pointsLedger.aspects[magicType] = {'CP': 0, 'XP': 0};
		if (item.system.points == 'CP') {
			this.points.cp.generalSpent += CONFIG.Tribe8.costs.aspect;
			this.pointsLedger.aspects[magicType]['CP'] += CONFIG.Tribe8.costs.aspect;
			return;
		}
		this.points.xp.spent += CONFIG.Tribe8.costs.aspect;
		this.pointsLedger.aspects[magicType]['XP'] += CONFIG.Tribe8.costs.aspect;
	}

	/**
	 * Add a given totem's cost to the current tally. Called by
	 * _preparePoints()
	 *
	 * @param {Tribe8Item} item    The item from which we're applying points
	 */
	_applyTotemPoints(item) {
		if (item.inFreeSlot) return;

		// Okay, we didn't exit early, so we have to pay for it.
		if (!this.pointsLedger['totems']) this.pointsLedger['totems'] = {'CP': 0, 'XP': 0};
		if (item.system.points === 'CP')
			this.points.cp.generalSpent += CONFIG.Tribe8.costs.totem;
		else
			this.points.xp.spent += CONFIG.Tribe8.costs.totem;
		this.pointsLedger['totems'][item.system.points] += CONFIG.Tribe8.costs.totem;
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
		'xp': new fields.NumberField({hint: "The number of XP invested in this attribute", initial: 0, required: true})
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