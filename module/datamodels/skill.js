const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8SkillModel extends Tribe8ItemModel {
	static defineSchema() {
		return {
			...super.defineSchema(),
			name: new fields.StringField({hint: "The top-level name of the Skill, without specifiers", nullable: false, required: true}),
			specific: new fields.StringField({hint: "The specific area of expertise to which this Skill pertains, if appropriate"}),
			specify: new fields.BooleanField({hint: "Whether this Skill require an area of expertise to be specified", initial: false}),
			specializations: new fields.ObjectField({hint: "Specializations a character has taken in this Skill"}),
			level: new fields.NumberField({hint: "The current Level of this Skill", initial: 0, required: true, nullable: false, min: 0}),
			cpx: new fields.NumberField({hint: "The current Complexity of this Skill", initial: 1, required: true, nullable: false, min: 1}),
			points: new fields.SchemaField({
				level: new fields.SchemaField({
					cp: new fields.NumberField({hint: "The number of CP invested into increasing this Skill's starting Level", initial: 0, nullable: false, min: 0}),
					xp: new fields.NumberField({hint: "The number of XP invested into increasing this Skill's Level", initial: 0, nullable: false, min: 0})
				}),
				cpx: new fields.SchemaField({
					cp: new fields.NumberField({hint: "The number of CP invested into increasing this Skill's starting Complexity", initial: 0, nullable: false, min: 0}),
					xp: new fields.NumberField({hint: "The number of XP invested into increasing this Skill's Complexity", initial: 0, nullable: false, min: 0})
				}),
				edie: new fields.SchemaField({
					fromBonus: new fields.NumberField({hint: "Number of non-XP e-die spent into this Skill's rolls", initial: 0, nullable: false, min: 0}),
					fromXP: new fields.NumberField({hint: "Number of XP converted to e-die for this Skill's rolls", initial: 0, nullable: false, min: 0})
				}),
				totalXP: new fields.NumberField({hint: "Total XP spent on this Skill", initial: 0, nullable: false})
			})
		};
	}
	
	/**
	 * Migrate data
	 */
	static migrateData(data) {
		if (!data.points.edie.fromBonus)
			data.points.edie.fromBonus = 0;
		if (!data.points.edie.fromXP)
			data.points.edie.fromXP = 0;
		return super.migrateData(data);
	}
	
	/**
	 * Prepare base data for a skill
	 */
	prepareBaseData(...args) {
		super.prepareBaseData(...args)
		const {name: canonName, system: {name: canonSystemName, specific: canonSpecificName}} = Tribe8ItemModel.canonizeName(this.parent.name, this.name, this.specific, this.specify);
		this.parent.name = canonName;
		this.name = canonSystemName;
		this.specific = canonSpecificName;
	}
	
	/**
	 * Prepare derived data for a skill
	 */
	prepareDerivedData(...args) {
		super.prepareDerivedData(...args);

		// First, CP
		let level = 0; let cpx = 1;
		level += Math.floor(Math.sqrt(this.points.level.cp));
		
		// Next, XP, using the CP level as a baseline
		const cpLevel = level;
		let xpAvailable = this.points.level.xp;
		for (let nextLevel = cpLevel + 1; nextLevel < 11; nextLevel++)
		{
			const xpForNextLevel = nextLevel * nextLevel;
			if (xpForNextLevel > xpAvailable)
				break; // We're done
			xpAvailable -= xpForNextLevel;
			level++;
		}
		this.level = level;

		// Repeat for cpx -- but remember Cpx 1 is free
		cpx += Math.floor(Math.sqrt(this.points.cpx.cp)) - (this.points.cpx.cp > 0 ? 1 : 0);
		const cpCpx = cpx;
		xpAvailable = this.points.cpx.xp;
		for (let nextCpx = cpCpx + 1; nextCpx < 6; nextCpx++)
		{
			const xpForNextCpx = nextCpx * nextCpx;
			if (xpForNextCpx > xpAvailable)
				break;
			xpAvailable -= xpForNextCpx;
			cpx++;
		}
		this.cpx = cpx;
		
		// Total up XP spent, for comparison with edie
		const totalXP = this.points.level.xp + this.points.cpx.xp + this.points.edie.fromXP;
		this.points.totalXP = totalXP;
	}
	
	/**
	 * Get the total e-die spent on this skill
	 */
	get eDieSpent() {
		return this.points.edie.fromBonus + this.points.edie.fromXP;
	}
	
	/**
	 * Rectify specializations from a list of objects
	 */
	async updateSpecializations(specList) {
		const existingSpecializationIDs = Object.keys(this.specializations);
		const newSpecializations = {};
		
		for (let spec of specList) {
			// Do we already have this specialization?
			let specFound = false;
			for (let specID of existingSpecializationIDs) {
				const checkSpec = this.specializations[specID];
				if (checkSpec.name == spec.name && checkSpec.points == spec.points) {
					specFound = true;
					newSpecializations[specID] = {...checkSpec};
					break;
				}
			}

			if (specFound) // Nothing else to do
				continue;
			
			// New specialization!
			newSpecializations[Tribe8SkillModel.generateSpecializationKey(spec.name)] = spec;
		}
		await this.parent.update({'system.==specializations': newSpecializations}, {diff: false});
	}

	/**
	 * Spend an e-die into this skill
	 */
	async spendEdie() {
		let spendFrom = "bonus";
		if (this.parent.isOwned) {
			// Does the owner have bonus eDie?
			const owner = this.parent.parent;
			if (owner.system.edie.total <= 0) {
				foundry.ui.notifications.error("You do not have enough EDie!");
				return;
			}
			// Spend from bonus first
			if (owner.system.edie.other <= 0) {
				spendFrom = "xp";
			}
			
			// We only debit from the bonus pool; spending XP should sort itself out
			if (spendFrom == 'bonus') {
				console.log("Spending from bonus");
				await owner.update({'system.edie.other': (owner.system.edie.other - 1)})
			}
		}
		
		// Update the item's records
		let newValue = 0;
		let updatePath = '';
		if (spendFrom == 'bonus') {
			newValue = this.points.edie.fromBonus + 1;
			updatePath = 'system.points.edie.fromBonus';
		}
		else {
			newValue = this.points.edie.fromXP + 1;
			updatePath = 'system.points.edie.fromXP';
		}
		await this.parent.update({[`${updatePath}`]: newValue});
	}
	
	/**
	 * Refund an e-die from this skill
	 */
	async refundEdie() {
		if (this.parent.isOwned) {
			// Always refund to bonus, not XP
			const owner = this.parent.parent;
			await owner.update({'system.edie.other': (owner.system.edie.other + 1)});
		}
		
		// Now decrement our total
		let currentValue = this.points.edie.fromBonus;
		await this.parent.update({'system.points.edie.fromBonus': --currentValue});
	}

	/**
	 * Generate a clean specialization key from the provided name.
	 */
	static generateSpecializationKey(key) {
		// Supplied an already-good key?
		if (key.match(/^[a-f0-9A-F]{8}-[a-f0-9A-F]{4}-[a-f0-9A-F]{4}-[a-f0-9A-F]{4}-[a-f0-9A-F]{12}$/))
			return key;
		
		// Have crypto?
		if (crypto.randomUUID)
			return crypto.randomUUID();

		// Do it manually
		const randomDigit = () => {
			return Math.floor(Math.random() * 16);
		}
		const randomHex = () => {
			return randomDigit().toString(16);
		}
		const randomSegment = () => {
			return randomHex() + randomHex() + randomHex() + randomHex();
		}
		const uuid = [
			randomSegment() + randomSegment(), // 8
			randomSegment(), // 4
			'4' + randomSegment().substring(1, 4), // 4 starting with 4
			randomHex() + randomSegment().substring(1, 4), // 4
			randomSegment() + randomSegment() + randomSegment() // 12
		].join('-');
		return uuid;
	}
	
	/**
	 * Skill sorting function.
	 * Expects to be handed a Tribe8Item, *NOT* a Tribe8SkillModel
	 */
	static cmp(a, b) {
		if (a.system.level > b.system.level)
			return -1;
		if (a.system.level < b.system.level)
			return 1;
		if (a.system.cpx > b.system.cpx)
			return -1;
		if (a.system.cpx < b.system.cpx)
			return 1;
		if (a.name < b.name)
			return -1;
		if (a.name > b.name)
			return 1;
		if (a._stats.createdTime < b._stats.createdTime)
			return -1;
		if (a._stats.createdTime > b._stats.createdTime)
			return 1;
		return 0;
	}
}