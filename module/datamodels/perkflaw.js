const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8PerkFlawModel extends Tribe8ItemModel {
	/**
	 * Defines the schema for a Perk or Flaw.
	 *
	 * @return {object} The schema definition for a Perk or Flaw
	 * @access public
	 */
	static defineSchema() {
		return {
			...super.defineSchema(),
			name: new fields.StringField({hint: "The top-level name of the Perk or Flaw, without specifiers", nullable: false, required: true}),
			specific: new fields.StringField({hint: "A unique specifier for this Perk or Flaw (e.g. the name of a Nemesis), if appropriate."}),
			specify: new fields.BooleanField({hint: "Whether this Perk or Flaw requires a unique specifier.", initial: false}),
			baseCost: new fields.NumberField({
				hint: "The cost, in CP or XP, of the first rank of the Perk or Flaw. For Flaws, this is a negative value.",
				initial: 0,
				required: true,
				nullable: false,
			}),
			perRank: new fields.NumberField({
				hint: "The cost, in CP or XP, of additional ranks of the Perk or Flaw. For Flaws, this is a negative value.",
				initial: 0,
				required: false,
				nullable: false,
			}),
			ranked: new fields.BooleanField({hint: "Whether or not this Perk or Flaw can be acquired at different intensity levels", initial: false, required: true, nullable: false}),
			granted: new fields.BooleanField({hint: "Whether the cost of this Perk or Flaw is ignored, as may be the case with those granted by the Weaver.", initial: false, required: true, nullable: false}),
			points: new fields.ArrayField(
				new fields.StringField({
					hint: "The type of points used to pay for this rank of the Perk, or refunded for this rank of the Flaw.",
					choices: ["CP", "XP"],
					initial: "CP",
					required: true, nullable: false
				}), {
					hint: "The type of points used to pay for the Perk, or to refund for the Flaw. Each rank is stored separately.",
					initial: [],
					required: true,
					nullable: false
				})
		};
	}

	/**
	 * Determine the total amount of CP spent on this Perk or Flaw.
	 *
	 * @return {int} The total CP spent on the Perk or Flaw
	 * @access public
	 */
	get totalCP() {
		if (this.granted) return 0;
		if (!this.points.length) return 0;
		return this.points.reduce((cp, pointTypeForRank, rank) => {
			if (pointTypeForRank !== "CP") return cp;
			if (rank === 0) return cp + this.baseCost;
			return cp + this.perRank;
		}, 0);
	}

	/**
	 * Determine the total amount of XP spent on this Perk or Flaw.
	 *
	 * @return {int} The total XP spent on the Perk or Flaw
	 * @access public
	 */
	get totalXP() {
		if (this.granted) return 0;
		if (!this.points.length) return 0;
		return this.points.reduce((xp, pointTypeForRank, rank) => {
			if (pointTypeForRank !== "XP") return xp;
			if (rank === 0) return xp + this.baseCost;
			return xp + this.perRank;
		}, 0);
	}

	/**
	 * Ensure any source data using the legacy "cost" field switches to
	 * "baseCost", and ensure any source data with lowercase points
	 * values is switched to uppercase
	 *
	 * @param  {object} data    The stored source data
	 * @return {object}         The transformed data
	 * @access public
	 */
	static migrateData(data) {
		foundry.abstract.Document._addDataFieldMigration(data, "system.cost", "system.baseCost");
		if (Object.hasOwn(data, "points") && data.points.length) {
			for (let r = 0; r < data.points.length; r++) {
				data.points[r] = data.points[r].toUpperCase();
			}
		}
		return super.migrateData(data);
	}

	/**
	 * Prepare base data for a Perk/Flaw. For Flaws, make sure any
	 * positive costs are flipped negative.
	 *
	 * @access public
	 */
	prepareBaseData() {
		super.prepareBaseData();
		if (this.parent.type == 'flaw') {
			if (this.baseCost > 0) this.baseCost *= -1;
			if (this.perRank > 0) this.perRank *= -1;
		}
	}
}