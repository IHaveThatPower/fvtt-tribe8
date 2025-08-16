const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8TotemModel extends Tribe8ItemModel {
	static defineSchema() {
		return {
			...super.defineSchema(),
			totemType: new fields.StringField({hint: "The type of Totem this is", blank: true, required: true}),
			fromCpx: new fields.BooleanField({hint: "Whether this Totem is granted due to the Ritual Skill's Complexity.", initial: false, required: true, nullable: false}),
			granted: new fields.BooleanField({hint: "Whether or not this Totem was granted for free by the Weaver", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "The type of points used to pay for the Totem.", choices: ["CP", "XP"], initial: "CP", required: true, nullable: false})
		};
	}
}