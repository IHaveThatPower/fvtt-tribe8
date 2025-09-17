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
			name: new fields.StringField({hint: "tribe8.item.pf.name.hint", nullable: false, required: true}),
			specific: new fields.StringField({hint: "tribe8.item.pf.specific.hint"}),
			specify: new fields.BooleanField({hint: "tribe8.item.pf.specify.hint", initial: false}),
			baseCost: new fields.NumberField({
				hint: "tribe8.item.pf.baseCost.hint",
				initial: 0,
				required: true,
				nullable: false,
			}),
			perRank: new fields.NumberField({
				hint: "tribe8.item.pf.perRank.hint",
				initial: 0,
				required: false,
				nullable: false,
			}),
			ranked: new fields.BooleanField({hint: "tribe8.item.pf.ranked.hint", initial: false, required: true, nullable: false}),
			granted: new fields.BooleanField({hint: "tribe8.item.pf.granted.hint", initial: false, required: true, nullable: false}),
			points: new fields.ArrayField(
				new fields.StringField({
					hint: "tribe8.item.pf.points-rank.hint",
					choices: ["CP", "XP"],
					initial: "CP",
					required: true, nullable: false
				}), {
					hint: "tribe8.item.pf.points.hint",
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
