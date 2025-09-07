const fields = foundry.data.fields;
import { Tribe8GearModel } from './gear.js';

export class Tribe8ArmorModel extends Tribe8GearModel {
	/**
	 * Defines the schema for Armor
	 *
	 * @return {object} The schema definition for Armor
	 * @access public
	 */
	static defineSchema() {
		return {
			...super.defineSchema(),
			ar: new fields.NumberField({
				required: true,
				initial: 0,
				hint: "tribe8.item.armor.ar.hint"
			}),
			coverage: new fields.ArrayField(
				new fields.StringField({
					required: true,
					blank: false,
					choices: [...CONFIG.Tribe8.armorCoverage],
					initial: CONFIG.Tribe8.armorCoverage[0],
					hint: "tribe8.item.armor.coverage.hint"
				}),
				{
				}
			),
			enc: new fields.NumberField({
				required: true,
				initial: 0,
				hint: "tribe8.item.armor.enc.hint"
			}),
			partial: new fields.BooleanField({
				required: true,
				initial: false,
				hint: "tribe8.item.armor.partial.hint"
			}), // TODO: Partial armor might have an * value, which counts as 1/3 of an Enc, rounded down
			conceal: new fields.StringField({
				required: true,
				initial: CONFIG.Tribe8.armorConcealable[0],
				choices: [...CONFIG.Tribe8.armorConcealable],
				blank: false,
				hint: "tribe8.item.armor.conceal.hint"
			}),
			notes: new fields.StringField({
				required: false,
				blank: true,
				hint: "tribe8.item.armor.notes.hint"
			})
		};
	}
}