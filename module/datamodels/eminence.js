const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8EminenceModel extends Tribe8ItemModel {
	static defineSchema() {
		return {
			...super.defineSchema(),
			tribe: new fields.StringField({hint: "The Tribe to which this Eminence belongs", blank: true, required: true}),
			used: new fields.BooleanField({hint: "Whether or not the Eminence has been used for the current day", initial: false, required: true}),
		};
	}
}