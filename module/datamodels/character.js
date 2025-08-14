const fields = foundry.data.fields;
import { Tribe8ManeuverModel } from './maneuver.js';

export class Tribe8CharacterModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			tribe: new fields.StringField({hint: "Tribe into which the character was born or most directly identifies", blank: true, trim: true}),
			role: new fields.StringField({hint: "Role this character plays in their Cell", blank: true, trim: true}),
			attributes: new fields.SchemaField({
				primary: new fields.SchemaField({
					agi: new fields.SchemaField(Tribe8PrimaryAttribute('Agility', 'agi')),
					app: new fields.SchemaField(Tribe8PrimaryAttribute('Appearance', 'app')),
					bld: new fields.SchemaField(Tribe8PrimaryAttribute('Build', 'bld')),
					cre: new fields.SchemaField(Tribe8PrimaryAttribute('Creativity', 'cre')),
					fit: new fields.SchemaField(Tribe8PrimaryAttribute('Fitness', 'fit')),
					inf: new fields.SchemaField(Tribe8PrimaryAttribute('Influence', 'inf')),
					kno: new fields.SchemaField(Tribe8PrimaryAttribute('Knowledge', 'kno')),
					per: new fields.SchemaField(Tribe8PrimaryAttribute('Perception', 'per')),
					psy: new fields.SchemaField(Tribe8PrimaryAttribute('Psyche', 'psy')),
					wil: new fields.SchemaField(Tribe8PrimaryAttribute('Willpower', 'wil'))
                }),
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
	 * Migrate data
	 */
	static migrateData(data) {
		// Use the "general" property instead of the "character" property
		foundry.abstract.Document._addDataFieldMigration(data, "system.points.cp.character", "system.points.cp.general");
		
		const schemaData = ((typeof this.constructor.defineSchema == 'function') ? this.constructor : this).defineSchema();
		data = ((typeof this.constructor.recursivelyFixLabelsAndNames == 'function') ? this.constructor : this).recursivelyFixLabelsAndNames(data, schemaData);
		
		return super.migrateData(data);
	}
	
	/**
	 * Recursive function that fixes invalid labels and names
	 */
	static recursivelyFixLabelsAndNames(data, schemaData) {
		const that = this;
		// console.log("Working with data", data, "and schema", schemaData);
		for (let key of Object.keys(schemaData)) {
			// console.log("Checking key", typeof data[key], key, ":", data[key]);
			if (data[key]) {
				if (typeof data[key] == 'object') {
					data[key] = ((typeof that.constructor.recursivelyFixLabelsAndNames == 'function') ? that.constructor : that).recursivelyFixLabelsAndNames(data[key], schemaData[key].fields);
					continue;
				}
				if (typeof data[key] == 'array') {
					// console.log("Not recurisvely migrating array data");
					continue;
				}
				// Only change these
				if (key == 'hint' || key == 'label' || key == 'name') {
					data[key] = schemaData[key].initial;
				}
			}
		}
		return data;
	}

	/**
	 * Prepare derived data
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
			let attValue = -1;
			
			// Add CP. Negative CP have the same value at the same rate
			// as positive, just negative.
			attValue += (attData.cp < 0 ? -1 : 1)*Math.floor(Math.sqrt(Math.abs(attData.cp)));
			
			// Add XP. Negative XP not a thing.
			attValue += Math.floor(Math.max(attData.xp, 0) / 50);
			
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
		const skills = Array.from(this.parent.getEmbeddedCollection("Item")).filter((i) => i.type == "skill");
		
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
		const skillH2H = skills.find((s) => s.name.match(/(Hand\b.*?\bto\b.*?Hand|H\b.*?\b(2|t)\b.*?\bH)/i));
		const skillMelee = skills.find((s) => s.name.match(/Melee/i));
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

		// Compute amount spent on various items
		this._computeManeuverComplexityCapacity();
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
	 */
	_applySkillPoints(item) {
		this.points.cp.generalSpent += item.system.points.level.cp;
		this.points.cp.generalSpent += item.system.points.cpx.cp;
		this.points.xp.spent += item.system.points.level.xp;
		this.points.xp.spent += item.system.points.cpx.xp;
		this.points.xp.spent += item.system.points.edie.fromXP;
		
		// Compute amount spent on specializations
		if (Object.keys(item.system.specializations).length > 0) {
			for (let specID of Object.keys(item.system.specializations)) {
				const spec = item.system.specializations[specID];
				if (spec.points == 'cp') {
					this.points.cp.generalSpent += 5; // TODO: Make a setting?
				}
				else {
					this.points.xp.spent += 5;
				}
			}
		}
	}

	/**
	 * Add a given perk or flaw's points to the current tally. Called
	 * by _preparePoints()
	 */
	_applyPerkFlawPoints(item) {
		if (item.system.granted)
			return; // No cost applied
		const baseCost = item.system.baseCost;
		const perRankCost = item.system.perRank;
		for (let r = 0; r < item.system.points.length; r++) {
			const rank = item.system.points[r];
			switch (rank) {
				case 'cp':
					if (r == 0)
						this.points.cp.generalSpent += baseCost;
					else
						this.points.cp.generalSpent += perRankCost;
					break;
				case 'xp':
					if (r == 0)
						this.points.xp.spent += baseCost;
					else
						this.points.xp.spent += perRankCost;
					break;
				default:
					break;
			}
		}
	}
	
	/**
	 * Iterate through all of the character's skills and figure out
	 * what the "capacity" for bonus maneuvers is.
	 */
	_computeManeuverComplexityCapacity() {
		// Initialize the combat skill reference list
		const combatSkillReference = {...Tribe8ManeuverModel.COMBAT_SKILLS};
		for (let key of Object.keys(combatSkillReference)) {
			if (typeof combatSkillReference[key] != 'array') {
				combatSkillReference[key] = [combatSkillReference[key].toLowerCase().replace(/[^a-zA-Z0-9]/g, '')];
			}
		}
		combatSkillReference['R'] = combatSkillReference['R'].concat(Tribe8ManeuverModel.RANGED_COMBAT_SKILL_REFERENCE);
		combatSkillReference['H'] = combatSkillReference['H'].concat(Tribe8ManeuverModel.HAND_TO_HAND_VARIATIONS);
		
		// Initialize the object that stores our complexity caps
		this.maneuverCpxCaps = {};
		
		// Gather up all the character's skill and initialize maneuver capacity objects for them
		const allSkills = Array.from(this.parent.getEmbeddedCollection("Item")).filter((i) => i.type == 'skill');
		for (let skill of allSkills) {
			const skillNameSlug = skill.system.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
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
	 * Add a given combat maneuver's points to the current tally. Called
	 * by _preparePoints()
	 */
	_applyManeuverPoints(item) {
		if (item.system.granted)
			return;
		if (item.system.fromCpx) {
			// See _fillManeuverSlots()
			if (!this.maneuversToFillSlots)
				this.maneuversToFillSlots = [];
			this.maneuversToFillSlots.push(item);
			return;
		}
		if (item.system.points == 'cp')
			this.points.cp.generalSpent += item.system.complexity;
		else
			this.points.xp.spent += item.system.complexity;
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
							for (let i = 0; i < skill.slots[c].length; i++) {
								if (!skill.slots[c][i]) { // Found an empty slot!
									skill.slots[c][i] = maneuver;
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
			for (let maneuver of this.maneuversToFillSlots) {
				if (maneuver.system.points == 'cp')
					this.points.cp.generalSpent += maneuver.system.complexity;
				else
					this.points.xp.spent += maneuver.system.complexity;
			}
		}
	}
	
	/**
	 * Add a given aspect's points to the current tally. Called by
	 * _preparePoints()
	 */
	_applyAspectPoints(item) {
		// TODO: _applyAspectPoints
	}
}

function Tribe8PrimaryAttribute(name, label) {
	return {
		label: new fields.StringField({hint: "The short name used to identify this attribute on a character sheet", blank: false, initial: label, required: true}),
		name: new fields.StringField({hint: "The full name of this attribute", blank: false, initial: name, required: true}),
		value: new fields.NumberField({hint: "The current calculated value of this attribute", initial: -1, positive: false, required: true}),
		cp: new fields.NumberField({hint: "The number of CP invested in this attribute", initial: 0, positive: false, required: true}),
		xp: new fields.NumberField({hint: "The number of XP invested in this attribute", initial: 0, required: true})
	};	
}

function Tribe8SecondaryAttribute(name, label) {
	return {
		label: new fields.StringField({hint: "The short name used to identify this attribute on a character sheet", blank: false, initial: label, required: true}),
		name: new fields.StringField({hint: "The full name of this attribute", blank: false, initial: name, required: true}),
		value: new fields.NumberField({hint: "The current calculated value of this attribute", initial: 0, required: true})
	};
}