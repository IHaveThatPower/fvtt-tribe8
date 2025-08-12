const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8PerkFlawModel extends Tribe8ItemModel {
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
				validate: this.validateCost // TODO: Make this work
			}),
			perRank: new fields.NumberField({
				hint: "The cost, in CP or XP, of additional ranks of the Perk or Flaw. For Flaws, this is a negative value.",
				initial: 0,
				required: false,
				nullable: false,
				validate: this.validateCost // TODO: Make this work
			}),
			ranked: new fields.BooleanField({hint: "Whether or not this Perk or Flaw can be acquired at different intensity levels", initial: false, required: true, nullable: false}),
			granted: new fields.BooleanField({hint: "Whether the cost of this Perk or Flaw is ignored, as may be the case with those granted by the Weaver.", initial: false, required: true, nullable: false}),
			points: new fields.ArrayField(new fields.StringField({hint: "The type of points used to pay for this rank of the Perk, or refunded for this rank of the Flaw.", initial: 0, required: true, nullable: false}), {hint: "The type of points used to pay for the Perk, or to refund for the Flaw. Each rank is stored separately.", initial: [], required: true, nullable: false})
		};
	}
	
	/**
	 * Migrate data
	 */
	static migrateData(data) {
		foundry.abstract.Document._addDataFieldMigration(source, "system.cost", "system.baseCost");
		return super.migrateData(data);
	}
	
	/**
	 * Prepare base data for a Perk/Flaw
	 */
	prepareBaseData(...args) {
		super.prepareBaseData(...args)
		const {name: canonName, system: {name: canonSystemName, specific: canonSpecificName}} = Tribe8ItemModel.canonizeName(this.parent.name, this.name, this.specific, this.specify);
		this.parent.name = canonName;
		this.name = canonSystemName;
		this.specific = canonSpecificName;
		
		if (this.parent.type == 'flaw') {
			if (this.baseCost > 0)
				this.baseCost *= -1;
			if (this.perRank > 0)
				this.perRank *= -1;
		}
	}
	
	/**
	 * Prepare derived data for a Perk/Flaw
	 */
	prepareDerivedData(...args) {
		super.prepareDerivedData(...args);
	}
	
	/**
	 * Validate cost is correct for Item type
	 */
	validateCost(...args) {
		console.log(...args);
	}
	
	/**
	 * Comparison function for sorting perks and flaws.
	 * Expects to be handed a Tribe8Item, *NOT* a Tribe8PerkFlawModel
	 */
	static cmp(a, b) {
		// Perks before Flaws
		if (a.type == 'perk' && b.type == 'flaw')
			return -1;
		if (a.type == 'flaw' && b.type == 'perk')
			return 1;
		// Free before paid
		if (a.system.granted && !b.system.granted)
			return -1;
		if (!a.system.granted && b.system.granted)
			return 1;
		// By Name
		if (a.name < b.name)
			return -1;
		if (a.name > b.name)
			return 1;
		// By Ranks
		if (a.system.points.length > b.system.points.length)
			return -1;
		if (a.system.points.length < b.system.points.length)
			return 1;
		// Tiebreaker is created time
		if (a._stats.createdTime < b._stats.createdTime)
			return -1;
		if (a._stats.createdTime > b._stats.createdTime)
			return 1;
		return 0;
	}
}