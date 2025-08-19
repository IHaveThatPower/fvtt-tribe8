const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8GearModel extends Tribe8ItemModel {
	/**
	 * Defines the schema for a piece of Gear
	 *
	 * @return {object} The schema definition for a piece of Gear
	 * @access public
	 */
	static defineSchema() {
		return {
			...super.defineSchema(),
			qty: new fields.NumberField({ hint: "tribe8.item.gear.weight.qty", required: false }),
			weight: new fields.NumberField({ hint: "tribe8.item.gear.weight.hint", required: false }),
			value: new fields.NumberField({ hint: "tribe8.item.gear.value.hint", required: false }),
			complexity: new fields.NumberField({ hint: "tribe8.item.gear.complexity.hint", required: true, nullable: false, initial: 1 }),
			storage: new fields.ForeignDocumentField(
				CONFIG.Item.documentClass,
				{
					hint: "tribe8.item.gear.storage.hint",
					blank: true,
					nullable: true,
					idOnly: true
				}
			),
			carried: new fields.BooleanField({ hint: "tribe8.item.gear.carried.hint", required: true, initial: false })
		};
	}
}