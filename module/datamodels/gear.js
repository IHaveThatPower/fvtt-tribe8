const fields = foundry.data.fields;
import { Tribe8 } from '../config.js';
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
			value: new fields.StringField({ hint: "tribe8.item.gear.value.hint", required: false, choices: Tribe8.gearValueOptions, initial: "avg" }),
			valueThreshold: new fields.NumberField({ hint: "tribe8.item.gear.valueThreshold.hint", required: false, validate: (t) => t > 0 && t <= 10 }),
			complexity: new fields.NumberField({ hint: "tribe8.item.gear.complexity.hint", required: true, nullable: false, initial: 1 }),
			storage: new fields.ForeignDocumentField(
				CONFIG.Item.documentClass,
				{
					hint: "tribe8.item.gear.storage.hint",
					blank: true,
					nullable: false,
					required: true,
					idOnly: true
				}
			),
			carried: new fields.BooleanField({ hint: "tribe8.item.gear.carried.hint", required: true, initial: true }),
			equipped: new fields.BooleanField({ hint: "tribe8.item.gear.equipped.hint", required: true, initial: false })
		};
	}

	/**
	 * Getter that returns a bool if any other Gear in the parent
	 * Actor's Item list lists this Item
	 *
	 * @return {bool}           Whether or not this item is a container
	 * @throws {ReferenceError}
	 * @access public
	 */
	get isContainer() {
		if (!this.parent) throw new ReferenceError(game.i18n.localize("tribe8.errors.model-item-not-initialized"));
		if (!this.parent?.parent)
			return false;
		const parent = this.parent.parent;
		return parent.getGear().some(g => g.system.storage == this.parent.id);
	}

	/**
	 * Gear doesn't have an intrinsic cost, in terms of CP/XP.
	 *
	 * @return {int} Gear has no intrinsic cost, so returns 0
	 * @access public
	 */
	get intrinsicCost() {
		return 0;
	}

	/**
	 * If the Gear has a value property that's a number, move it to
	 * valueThreshold instead.
	 *
	 * @param  {object} data    The incoming migration data
	 * @return {object}         The transformed data
	 * @access public
	 */
	static migrateData(data) {
		if (Object.hasOwn(data, "value") && !isNaN(Number(data.value))) {
			data.valueThreshold = Math.max(Number(data.value) + 0, 1);
			data.value = null;
		}
		if (Object.hasOwn(data, "valueThreshold") && isNaN(data.valueThreshold))
			data.valueThreshold = 1;
		return super.migrateData(data);
	}

}
