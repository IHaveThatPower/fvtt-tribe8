const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8EminenceModel extends Tribe8ItemModel {
	/**
	 * Defines the schema for an Eminence.
	 *
	 * @return {object} The schema definition for an Eminence
	 * @access public
	 */
	static defineSchema() {
		return {
			...super.defineSchema(),
			tribe: new fields.StringField({hint: "tribe8.item.eminence.tribe.hint", blank: true, required: true}),
			used: new fields.BooleanField({hint: "tribe8.item.eminence.used.hint", initial: false, required: true}),
		};
	}
}
