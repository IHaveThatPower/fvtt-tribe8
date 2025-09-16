const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8ManeuverModel extends Tribe8ItemModel {
	/**
	 * Defines the schema for a Combat Maneuver.
	 *
	 * @return {object} The schema definition for a Combat Maneuver
	 * @access public
	 */
	static defineSchema() {
		return {
			...super.defineSchema(),
			accuracy: new fields.StringField({hint: "tribe8.item.maneuver.accuracy.hint", required: true, nullable: true}),
			initiative: new fields.StringField({hint: "tribe8.item.maneuver.initiative.hint", required: true, nullable: true}),
			defense: new fields.StringField({hint: "tribe8.item.maneuver.defense.hint", required: true, nullable: true}),
			parry: new fields.StringField({hint: "tribe8.item.maneuver.parry.hint", required: true, nullable: true}),
			damage: new fields.StringField({hint: "tribe8.item.maneuver.damage.hint", required: true, nullable: true}),
			complexity: new fields.NumberField({hint: "tribe8.item.maneuver.complexity.hint", required: true, nullable: false, initial: 1}),
			allowedTypes: new fields.ArrayField(
				new fields.StringField({
					required: true,
					choices: Object.keys(CONFIG.Tribe8.COMBAT_SKILLS)
				}), {
					hint: "tribe8.item.maneuver.allowedTypes.hint",
					require: false,
					gmOnly: true
				}
			),
			skill: new fields.ForeignDocumentField(
				CONFIG.Item.documentClass,
				{
					hint: "tribe8.item.maneuver.skill.hint",
					required: false,
					idOnly: true
				}
			),
			fromCpx: new fields.BooleanField({hint: "tribe8.item.maneuver.fromCpx.hint", initial: false, required: true, nullable: false}),
			granted: new fields.BooleanField({hint: "tribe8.item.maneuver.granted.hint", initial: false, required: true, nullable: false}),
			free: new fields.BooleanField({hint: "tribe8.item.maneuver.free.hint", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "tribe8.item.maneuver.points.hint", choices: ["CP", "XP"], initial: "CP", required: true, nullable: false})
		};
	}

	/**
	 * Return the configured "intrinsic" cost of the Maneuver, CP or XP.
	 *
	 * @return {int} The intrinsic cost of the Maneuver, its Complexity
	 * @access private
	 */
	get intrinsicCost() {
		return (this.free ? 0 : this.complexity);
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
		// Very old skill storage
		if (data.forSkill && !data.skill && !data.category)
			data.skill = data.forSkill;
		// Old category style
		else if (data.category && !data.skill)
			data.skill = undefined;
		if (data.skill && data.skill.length === 1) {
			data.skill = undefined;
		}
		// Old key-style allowedTypes storage
		if (data.allowedTypes && data.allowedTypes.constructor.name === 'Object') {
			data.allowedTypes = Object.keys(data.allowedTypes);
		}
		// Old "Complexity 0" free maneuver pattern
		if (Object.hasOwn(data, "complexity") && data.complexity == 0) {
			data.complexity = 1;
			data.free = true;
		}
		// Clean up values for free maneuvers
		if (Object.hasOwn(data, "free") && data.free) {
			data.skill = undefined;
			data.granted = false;
			data.fromCpx = false;
		}
		return super.migrateData(data);
	}
}