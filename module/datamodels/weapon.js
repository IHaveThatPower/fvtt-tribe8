const fields = foundry.data.fields;
import { Tribe8GearModel } from './gear.js';

export class Tribe8WeaponModel extends Tribe8GearModel {
	/**
	 * Defines the schema for a Weapon
	 *
	 * @return {object} The schema definition for a Weapon
	 * @access public
	 */
	static defineSchema() {
		const categories = Object.keys(CONFIG.Tribe8.weaponCategories);
		const subcategories = Object.entries(CONFIG.Tribe8.weaponCategories).map(([ , subcats]) => subcats).reduce((acc, cur) => acc.concat(cur), []);
		return {
			...super.defineSchema(),
			category: new fields.StringField({
				required: true,
				choices: categories,
				initial: categories[0],
				hint: "tribe8.item.weapon.category.hint"
			}),
			subcategory: new fields.StringField({
				required: true,
				choices: subcategories,
				initial: subcategories[0],
				hint: "tribe8.item.weapon.subcategory.hint"
			}),
			/**
			 * Shields do not impose an ACC penalty (or rather, are
			 * considered ACC 0) when using paired weapons Fighting
			 * rules.
			 */
			accuracy: new fields.NumberField({
				required: true,
				initial: 0,
				hint: "tribe8.item.weapon.accuracy.hint"
			}),
			parry: new fields.NumberField({
				required: true,
				initial: 0,
				hint: "tribe8.item.weapon.parry.hint"
			}),
			fumble: new fields.StringField({
				required: true,
				choices: CONFIG.Tribe8.fumble,
				initial: CONFIG.Tribe8.fumble[0],
				hint: "tribe8.item.weapon.fumble.hint"
			}),
			/**
			 * DM for melee weapons is usually an AD+X value, but
			 * sometimes it's just 0 (net).
			 *
			 * DM for melee weapons may have different values for 1- or
			 * 2-handed.
			 *
			 * DM for ranged weapons is a flat value. Some items (e.g
			 * Pitch Smoke Bomb) may have other effects listed, but
			 * those don't seem to need modeling.
			 */
			// dm: new fields.StringField({hint: "The effect this Maneuver has on Damage rolls for the round.", required: true, nullable: true}),
			ranges: new fields.ArrayField(
				new fields.StringField({
					required: true,
					blank: false,
					nullable: false,
					validate: (value) => CONFIG.Tribe8.weaponRanges.includes(value),
					hint: "tribe8.item.weapon.ranges.hint"
				}), {
					required: true,
					initial: ["close"],
					hint: "tribe8.item.weapon.ranges.hint",
					validate: Tribe8WeaponModel.validateRanges
				}
			),
			baseRange: new fields.NumberField({
				required: false,
				initial: 0,
				hint: "tribe8.item.weapon.baseRange.hint"
			}),
			complexity: new fields.NumberField({required: true, initial: 1, hint: "tribe8.item.weapon.complexity.hint"}),
			rof: new fields.NumberField({required: false, initial: 0, hint: "tribe8.item.weapon.rof.hint"}),
			rofRounds: new fields.NumberField({required: false, initial: 1, hint: "tribe8.item.weapon.rofRounds.hint"}),
			ammo: new fields.SchemaField({
				current: new fields.NumberField({required: false, initial: 0, hint: "tribe8.item.weapon.ammo.current.hint"}),
				capacity: new fields.NumberField({required: false, initial: 0, hint: "tribe8.item.weapon.ammo.capacity.hint"})
			}),
			/**
			 * Some weapons have a minimum STR requirement. Each point
			 * below imposes a -1 penalty to all rolls using the
			 * weapon.
			 */
			// requires: // e.g. STR(+1),
			/**
			 * Some weapons have to be wielded 2H. Which ones these are
			 * is not enumerated in the weapon list.
			 *
			 * These might be sourceable from SilCORE
			 */
			/**
			 * Some weapons can Entangle (ENT). This depends on the MoS being
			 * greater than or equal to "the value in parentheses"...
			 * but there is no such value listed.
			 *
			 * These might be sourceable from SilCORE
			 */
			/**
			 * Some weapons require Maintenance (MTN). This reduces its
			 * Fumble level by one when the weapon is maintained by a
			 * person with either: one Skill level in the Craft skill
			 * appropriate for the weapon, or Cpx 2 in the combat skill
			 * required to use the weapon.
			 *
			 * This pertains only to Ranged weapons
			 */
			traits: new fields.StringField({require: false, blank: true, hint: "tribe8.item.weapon.traits"})
		};
	}

	/**
	 * Perform any data transformations we might need
	 *
	 * @param  {object} data    The source data
	 * @return {object}         The transformed data
	 * @access public
	 */
	static migrateData(data) {
		if (data.ranges?.length > 1 && data.ranges?.includes("ranged"))
			data.ranges = ["ranged"];
		if (data.ranges?.includes("ranged") && data.category == "melee")
			data.category = "ranged";
		if (data.ranges?.includes("close") && data.category == "ranged")
			data.category = "melee";
		return data;
	}

	/**
	 * Validate that the selected range values are legal
	 *
	 * @param  {object} data    The list of ranges under evaluation
	 * @return {void}
	 * @throws {Error}          An error if a validation failure is detected
	 * @access public
	 */
	static validateRanges(data) {
		// This is purely an internal error, and shouldn't happen
		if (data.constructor.name !== 'Array') throw new Error("Cannot submit non-array data for Weapon ranges");
		if (!data.length) throw new Error(game.i18n.localize("tribe8.errors.weapon-no-range"));
		// This should also not actually get hit, since we have logic elsewhere to prevent it
		if (data.includes("ranged") && data.length > 1) throw new Error("Cannot mix ranged with other Weapon ranges");
	}

	/**
	 * Validate that we didn't select "Melee" for a Category and
	 * "Ranged" for a Range type
	 *
	 * @param  {object} data    The list of ranges under evaluation
	 * @return {void}
	 * @throws {Error}          An error if a validation failure is detected
	 * @access public
	 */
	static validateJoint(data) {
		if (data.ranges?.includes("ranged") && data.category == "melee")
			throw new Error("Melee weapons cannot be marked ranged");
		if (data.ranges?.includes("close") && data.category == "ranged")
			throw new Error("Ranged weapons cannot be marked close");
	}
}