const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8ManeuverModel extends Tribe8ItemModel {
	static COMBAT_SKILLS = {
		"C": "Cavalry",
		"D": "Defense",
		"H": "Hand-to-Hand",
		"M": "Melee",
		"R": "Ranged"
	};
	static RANGED_COMBAT_SKILL_REFERENCE = [
		'archery',
		'gunnery',
		'heavyweapons',
		'smallarms',
		'throwing'
	];
	static HAND_TO_HAND_VARIATIONS = [
		'h2h',
		'hth',
		'htoh'
	];

	static defineSchema() {
		return {
			...super.defineSchema(),
			accuracy: new fields.StringField({hint: "The effect this Maneuver has on Accuracy for the round.", required: true, nullable: true}),
			initiative: new fields.StringField({hint: "The effect this Maneuver has on Initiative for the round.", required: true, nullable: true}),
			defense: new fields.StringField({hint: "The effect this Maneuver has on Defense rolls for the round.", required: true, nullable: true}),
			parry: new fields.StringField({hint: "The effect this Maneuver has on Parry rolls for the round.", required: true, nullable: true}),
			damage: new fields.StringField({hint: "The effect this Maneuver has on Damage rolls for the round.", required: true, nullable: true}),
			complexity: new fields.NumberField({hint: "The Complexity requirement to use this Maneuver", required: true, nullable: false, initial: 0}),
			allowedTypes: new fields.ObjectField({hint: "The Skills that can be used with this Maneuver", gmOnly: true, required: true, nullable: true}),
			forSkill: new fields.StringField({hint: "The Skill to which this Maneuver applies", required: true, nullable: true, choices: Object.keys(this.COMBAT_SKILLS)}),
			fromCpx: new fields.BooleanField({hint: "Whether this Maneuver is granted due to a Skill's Complexity.", initial: false, required: true, nullable: false}),
			granted: new fields.BooleanField({hint: "Whether or not this Maneuver was granted for free by the Weaver", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "The type of points used to pay for the Maneuver.", choices: ["cp", "xp"], initial: "cp", required: true, nullable: false})
		};
	}
	
	/**
	 * Migrate data
	 */
	static migrateData(data) {
		return super.migrateData(data);
	}
	
	/**
	 * Prepare base data
	 */
	prepareBaseData(...args) {
		super.prepareBaseData(...args)
	}
	
	/**
	 * Prepare derived data
	 */
	prepareDerivedData(...args) {
		super.prepareDerivedData(...args);
	}
	
	/**
	 * Maneuver sorting function.
	 * Expects to be handed a Tribe8Item, *NOT* a Tribe8ManeuverModel
	 */
	static cmp(a, b) {
		// If the skills don't match, we need to first consult their sorting algorithm
		if (a.system.forSkill != b.system.forSkill)
		{
			// We need some knowledge about Skills to sort Maneuvers
			const schema = Tribe8ManeuverModel.defineSchema();

			// We need to know some things about the Skills of the character
			const combatSkillNames = Object.values(Tribe8ManeuverModel.COMBAT_SKILLS).map((s) => game.tribe8.slugify(s));
			const skills = Array.from(a.parent.getEmbeddedCollection("Item")).filter((i) => {
				if (i.type != 'skill')
					return false;
				let lookupName = game.tribe8.slugify(i.system.name);
				// Special case Hand to Hand checks
				if (Tribe8ManeuverModel.HAND_TO_HAND_VARIATIONS.indexOf(lookupName) >= 0)
					lookupName = 'handtohand';
				// Special case Ranged checks
				if (Tribe8ManeuverModel.RANGED_COMBAT_SKILL_REFERENCE.indexOf(lookupName) >= 0)
					lookupName = 'ranged';
				if (combatSkillNames.indexOf(lookupName) < 0) {
					return false;
				}
				return true;
			});
			const combatSkills = skills.reduce((obj, s) => {
				let referenceName = game.tribe8.slugify(s.system.name);
				if (Tribe8ManeuverModel.RANGED_COMBAT_SKILL_REFERENCE.indexOf(referenceName) >= 0)
					referenceName = 'ranged';
				const refKey = referenceName[0].toUpperCase();
				if (obj[refKey])
					obj[refKey].push(s);
				else
					obj[refKey] = [s];
				return obj;
			}, {});
			// If we had multiple valid skills for the reference key, sort them
			for (let k of Object.keys(combatSkills)) {
				if (combatSkills[k].length > 1) {
					combatSkills[k] = combatSkills[k].sort(combatSkills[k][0].system.constructor.cmp);
				}
			}
			
			// Finally, lets identify the relevant skills to our a and b
			const aSkill = (combatSkills[a.system.forSkill] || [])[0];
			const bSkill = (combatSkills[b.system.forSkill] || [])[0];
			if (aSkill && !bSkill)
				return -1;
			if (!aSkill && bSkill)
				return 1;
			
			if (aSkill && bSkill) {
				let skillCmp = aSkill.system.constructor.cmp(aSkill, bSkill);
				if (skillCmp != 0)
					return skillCmp;
			}
		}
		
		// If the skills match, *now* we can sort our maneuvers
		if (a.system.granted && !b.system.granted)
			return -1;
		if (!a.system.granted && b.system.granted)
			return 1;
		if (a.system.fromCpx || b.system.fromCpx) {
			let aFromCpx = a.system.fromCpx;
			let bFromCpx = b.system.fromCpx;
			if (aFromCpx && a.usesPoints)
				aFromCpx = false;
			if (bFromCpx && b.usesPoints)
				bFromCpx = false;
			if (aFromCpx && !bFromCpx)
				return -1;
			if (!aFromCpx && bFromCpx)
				return 1;
		}
		if (a.system.complexity > b.system.complexity)
			return -1;
		if (a.system.complexity < b.system.complexity)
			return 1;
		if (a.name < b.name)
			return -1;
		if (a.name > b.name)
			return 1;
		if (a._stats.createdTime < b._stats.createdTime)
			return -1;
		if (a._stats.createdTime > b._stats.createdTime)
			return 1;
		return 0;
	}
}