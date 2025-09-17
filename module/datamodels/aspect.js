const fields = foundry.data.fields;
import { Tribe8 } from '../config.js';
import { Tribe8ItemModel } from './item.js';

export class Tribe8AspectModel extends Tribe8ItemModel {
	/**
	 * Defines the schema for an Aspect.
	 *
	 * @return {object} The schema definition for an Aspect
	 * @access public
	 */
	static defineSchema() {
		return {
			...super.defineSchema(),
			tribe: new fields.StringField({hint: "tribe8.item.aspect.tribe.hint", blank: true, required: true}),
			complexity: new fields.NumberField({hint: "tribe8.item.aspect.complexity.hint", required: true, initial: 2, nullable: true}),
			attribute: new fields.StringField({
				hint: "tribe8.item.aspect.attribute.hint",
				required: true,
				initial: "CRE",
				choices: Object.keys(Tribe8.attributes.primary).map((a) => a.toUpperCase()),
			}),
			opposedBy: new fields.StringField({
				hint: "tribe8.item.aspect.opposedBy.hint",
				blank: true,
				choices: Object.keys(Tribe8.attributes.primary).map((a) => a.toUpperCase())
			}),
			threshold: new fields.NumberField({hint: "tribe8.item.aspect.threshold.hint", nullable: true}),
			granted: new fields.BooleanField({hint: "tribe8.item.aspect.granted.hint", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "tribe8.item.aspect.points.hint", choices: ["CP", "XP"], initial: "CP", required: true, nullable: false}),
			ritual: new fields.BooleanField({hint: "tribe8.item.aspect.ritual.hint", required: true, initial: false})
		};
	}

	/**
	 * Return the configured "intrinsic" cost of this Aspect, in CP or XP.
	 *
	 * @return {int} The intrinsic cost of the Aspect
	 * @access private
	 */
	get intrinsicCost() {
		if (this.granted) return 0;
		return super.intrinsicCost();
	}
}
