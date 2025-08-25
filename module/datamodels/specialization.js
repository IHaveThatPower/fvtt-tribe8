const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8SpecializationModel extends Tribe8ItemModel {
	/**
	 * Defines the schema for a Skill Specialization.
	 *
	 * @return {object} The schema definition for a Specialization
	 * @access public
	 */
	static defineSchema() {
		return {
			granted: new fields.BooleanField({hint: "Whether or not this Specialization was granted for free by the Weaver", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "The type of points used to pay for the Specialization.", choices: ["CP", "XP"], initial: "CP", required: true, nullable: false}),
			skill: new fields.ForeignDocumentField(
				CONFIG.Item.documentClass,
				{
					hint: "The Skill to which this Specialization belongs",
					required: true,
					blank: false,
					nullable: false,
					idOnly: true
				}
			)
		}
	}
}