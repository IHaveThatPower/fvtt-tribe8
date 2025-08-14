const fields = foundry.data.fields;
import { Tribe8 } from '../config.js';
import { Tribe8ItemModel } from './item.js';

export class Tribe8AspectModel extends Tribe8ItemModel {
	static defineSchema() {
		const that = Tribe8AspectModel;
		return {
			...super.defineSchema(),
			tribe: new fields.StringField({hint: "The Tribe to which this Aspect belongs", blank: true, required: true}),
			complexity: new fields.NumberField({hint: "Synthesis Complexity required to use this Aspect", required: true, initial: 2, nullable: true}),
			attribute: new fields.StringField({
				hint: "Attribute used when rolling Synthesis for use of thisAspect",
				required: true,
				initial: "CRE",
				choices: Object.keys(Tribe8.attributes.primary).map((a) => a.toUpperCase()),
			}),
			opposedBy: new fields.StringField({
				hint: "Attribute used to oppose this Aspect",
				blank: true,
				choices: Object.keys(Tribe8.attributes.primary).map((a) => a.toUpperCase())
			}),
			threshold: new fields.NumberField({hint: "Threshold to roll Synthesis against", nullable: true}),
			granted: new fields.BooleanField({hint: "Whether or not this Aspect was granted for free by the Weaver", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "The type of points used to pay for the Aspect.", choices: ["cp", "xp"], initial: "cp", required: true, nullable: false})
		};
	}
}