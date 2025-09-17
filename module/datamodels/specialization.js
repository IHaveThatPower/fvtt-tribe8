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
			granted: new fields.BooleanField({hint: "tribe8.item.specialization.granted.hint", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "tribe8.item.specialization.points.hint", choices: ["CP", "XP"], initial: "CP", required: true, nullable: false}),
			skill: new fields.ForeignDocumentField(
				CONFIG.Item.documentClass,
				{
					hint: "tribe8.item.specialization.skill.hint",
					required: true,
					blank: false,
					nullable: false,
					idOnly: true
				}
			)
		}
	}
}
