const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8TotemModel extends Tribe8ItemModel {
	/**
	 * Defines the schema for a Ritual Totem.
	 *
	 * @return {object} The schema definition for a Totem
	 * @access public
	 */
	static defineSchema() {
		return {
			...super.defineSchema(),
			totemType: new fields.StringField({hint: "tribe8.item.totem.type.hint", blank: true, required: true}),
			fromCpx: new fields.BooleanField({hint: "tribe8.item.totem.fromCpx.hint", initial: false, required: true, nullable: false}),
			granted: new fields.BooleanField({hint: "tribe8.item.totem.granted.hint", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "tribe8.item.totem.points.hint", choices: ["CP", "XP"], initial: "CP", required: true, nullable: false})
		};
	}
}
