const fields = foundry.data.fields;
import { Tribe8ItemModel } from './item.js';

export class Tribe8SkillModel extends Tribe8ItemModel {
	static defineSchema() {
		return {
			...super.defineSchema(),
			name: new fields.StringField({hint: "The top-level name of the Skill, without specifiers", nullable: false, required: true}),
			specific: new fields.StringField({hint: "The specific area of expertise to which this Skill pertains, if appropriate"}),
			specify: new fields.BooleanField({hint: "Whether this Skill require an area of expertise to be specified", initial: false}),
			specializations: new fields.ArrayField(
				new fields.ForeignDocumentField(CONFIG.Item.documentClass, {hint: "A Specialization that pertains to this Skill", idOnly: true})
			),
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
		// Fix points object
		if (typeof data.points != 'object')
			data.points = {};
		// Fix edie object
		if (typeof data.points.edie != 'object')
			data.points.edie = {};
		// Initialize edie values
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
	 * Add a Specialization to this Skill
	 */
	async addSpecialization(data) {
		const skill = this.parent;
		const actor = skill.parent;

		// Ensure data is complete
		if (!data.type) data.type = 'specialization';

		// Does this Specialization already exist?
		if (
			this.specializations
			.map((s) => actor.getEmbeddedDocument("Item", s))
			.filter((s) => s.type == 'specialization')
			.some((s) => s.name == data.name)
		) {
			foundry.ui.notifications.error("A Specialization with that name already exists for this Skill");
			return;
		}

		try {
			const [spec] = await actor.createEmbeddedDocuments("Item", [data]);
			await skill.update({'system.specializations': [...skill.system.specializations, spec]});
		}
		catch (error) {
			foundry.ui.notifications.error(error);
		}
		await actor.alignSkillsAndSpecializations();
	}

	/**
	 * Spend (or refund) e-die into (or out of) this skill
	 */
	async alterEdie(amount = 1) {
		const data = this.computeAlterEdie(amount);
		if (!data) return false;

		// Don't do anything if we'd go negative
		if (this.points.edie.fromBonus + data.spendBonus < 0 || this.points.edie.fromXP + data.spendXP < 0) {
			foundry.ui.notifications.warn("Can't decrease spent EDie below 0");
			return false;
		}

		// Update the item
		await this.parent.update({
			'system.points.edie.fromBonus': (this.points.edie.fromBonus + data.spendBonus),
			'system.points.edie.fromXP': (this.points.edie.fromXP + data.spendXP)
		});

		// Update the actor
		if (data.owner) {
			let owner;
			if (owner = this.parent.getActorOwner()) {
				await owner.update({'system.edie.other': data.owner.other});
			}
		}
		return true;
	}

	/**
	 * Compute an e-die refund amount
	 */
	computeAlterEdie(amount = 1) {
		// Bail out if value is just 0
		amount = Number(amount);
		if (!amount) return false;

		// Return data
		const data = {
			'spendBonus': amount,
			'spendXP': 0
		}
		let owner;
		if (owner = this.parent.getActorOwner()) {
			// Does the owner have enough eDie at all?
			if (owner.system.edie.total < amount) {
				foundry.ui.notifications.error("You do not have enough EDie!");
				return false;
			}
			// Add an owner entry
			data.owner = {'other': owner.system.edie.other};

			// Spend from/refund to bonus first
			data.owner.other = owner.system.edie.other - amount;

			// Leftover goes to XP (no need to update the owner; that'll self-account)
			if (data.owner.other < 0) {
				data.spendBonus = amount + data.owner.other;
				amount = Math.abs(data.data.owner.other);
				data.owner.other = 0;
				data.spendXP = amount;
			}
		}
		return data;
	}

	/**
	 * Handle manual interaction with an EDie field for this skill.
	 *
	 * TODO: Should this be somewhere else? Weird to put a UI handle on a DataModel...
	 */
	eDieKeyInputEventHandler(e) {
		// Get the current and previous value
		const newValue = e.target.value;
		const oldValue = this.eDieSpent;
		let delta = newValue - oldValue;
		if (!delta || (delta < 0 && oldValue == 0)) { // Might be NaN, or 0, in which case we don't want to muck anything up
			e.target.value = oldValue;
			return;
		}

		// Stop default handling
		e.preventDefault();
		e.stopPropagation();
		e.target.readonly = true; // Block further editing until we're done

		// Act based on the direction of the change
		(async (skill, delta) => {
			await skill.system.alterEdie(delta);
		})(this.parent, delta).then((resolve) => {
			if (!resolve) {
				e.target.value = oldValue;
			}
			e.target.readonly = false;
		});
	}
}