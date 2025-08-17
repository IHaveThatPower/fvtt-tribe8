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
			accuracy: new fields.StringField({hint: "The effect this Maneuver has on Accuracy for the round.", required: true, nullable: true}),
			initiative: new fields.StringField({hint: "The effect this Maneuver has on Initiative for the round.", required: true, nullable: true}),
			defense: new fields.StringField({hint: "The effect this Maneuver has on Defense rolls for the round.", required: true, nullable: true}),
			parry: new fields.StringField({hint: "The effect this Maneuver has on Parry rolls for the round.", required: true, nullable: true}),
			damage: new fields.StringField({hint: "The effect this Maneuver has on Damage rolls for the round.", required: true, nullable: true}),
			complexity: new fields.NumberField({hint: "The Complexity requirement to use this Maneuver", required: true, nullable: false, initial: 0}),
			allowedTypes: new fields.ObjectField({hint: "The Skills that can be used with this Maneuver", gmOnly: true, required: true, nullable: true}),
			forSkill: new fields.StringField({hint: "The Skill to which this Maneuver applies", required: true, nullable: true, choices: Object.keys(CONFIG.Tribe8.COMBAT_SKILLS)}),
			fromCpx: new fields.BooleanField({hint: "Whether this Maneuver is granted due to a Skill's Complexity.", initial: false, required: true, nullable: false}),
			granted: new fields.BooleanField({hint: "Whether or not this Maneuver was granted for free by the Weaver", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "The type of points used to pay for the Maneuver.", choices: ["CP", "XP"], initial: "CP", required: true, nullable: false})
		};
	}
}