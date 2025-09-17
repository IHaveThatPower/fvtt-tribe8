const fields = foundry.data.fields;
import { Tribe8 } from '../config.js';
import { Tribe8ItemModel } from './item.js';

export class Tribe8SkillModel extends Tribe8ItemModel {
	/**
	 * Defines the schema for a Skill.
	 *
	 * @return {object} The schema definition for a Skill
	 * @access public
	 */
	static defineSchema() {
		return {
			...super.defineSchema(),
			name: new fields.StringField({hint: "tribe8.item.skill.name.hint", nullable: false, required: true}),
			specific: new fields.StringField({hint: "tribe8.item.skill.specific.hint"}),
			specify: new fields.BooleanField({hint: "tribe8.item.skill.specify.hint", initial: false}),
			specializations: new fields.ArrayField(
				new fields.ForeignDocumentField(CONFIG.Item.documentClass, {hint: "tribe8.item.skill.specialization.hint", idOnly: true})
			),
			combatCategory: new fields.StringField({
				hint: "tribe8.item.skill.combatCategory.hint",
				required: false,
				nullable: true,
				choices: Object.keys(Tribe8.COMBAT_SKILLS)
			}),
			// level: new fields.NumberField({hint: "The current Level of this Skill", initial: 0, required: true, nullable: false, min: 0}),
			// cpx: new fields.NumberField({hint: "The current Complexity of this Skill", initial: 1, required: true, nullable: false, min: 1}),
			points: new fields.SchemaField({
				level: new fields.SchemaField({
					cp: new fields.NumberField({hint: "tribe8.item.skill.points.level.cp.hint", initial: 0, nullable: false, validate: (value) => (value >= 0)}),
					xp: new fields.NumberField({hint: "tribe8.item.skill.points.level.xp.hint", initial: 0, nullable: false, validate: (value) => (value >= 0)})
				}),
				cpx: new fields.SchemaField({
					cp: new fields.NumberField({hint: "tribe8.item.skill.points.cpx.cp.hint", initial: 0, nullable: false, validate: (value) => (value >= 0)}),
					xp: new fields.NumberField({hint: "tribe8.item.skill.points.cpx.xp.hint", initial: 0, nullable: false, validate: (value) => (value >= 0)})
				}),
				edie: new fields.SchemaField({
					fromBonus: new fields.NumberField({hint: "tribe8.item.skill.points.edie.fromBonus.hint", initial: 0, nullable: false, validate: (value) => (value >= 0)}),
					fromXP: new fields.NumberField({hint: "tribe8.item.skill.points.edie.fromXP.hint", initial: 0, nullable: false, validate: (value) => (value >= 0)})
				})
			})
		};
	}

	/**
	 * Get the Skill's computed Level.
	 *
	 * @return {int} The Skill's Level based on CP and XP spent
	 * @access public
	 */
	get level() {
		// Start with CP
		let level = Math.floor(Math.sqrt(this.points.level.cp));

		// Next, XP, using the level obtained from CP as a baseline
		const cpLevel = level;
		let xpAvailable = this.points.level.xp;
		for (let nextLevel = cpLevel + 1; nextLevel < 11; nextLevel++)
		{
			const xpForNextLevel = nextLevel * nextLevel;
			if (xpForNextLevel > xpAvailable) break; // We're done
			xpAvailable -= xpForNextLevel;
			level++;
		}
		return level;
	}

	/**
	 * Get the Skill's computed Complexity
	 *
	 * @return {int} The Skill's Complexity based on CP and XP spent
	 * @access public
	 */
	get cpx() {
		let cpx = 1; // Cpx 1 is free
		cpx += Math.floor(Math.sqrt(this.points.cpx.cp)) - (this.points.cpx.cp > 0 ? 1 : 0);

		// With that as a baseline, compute the per-rank costs
		const cpCpx = cpx;
		let xpAvailable = this.points.cpx.xp;
		for (let nextCpx = cpCpx + 1; nextCpx <= CONFIG.Tribe8.maxComplexity; nextCpx++)
		{
			const xpForNextCpx = nextCpx * nextCpx;
			if (xpForNextCpx > xpAvailable) break;
			xpAvailable -= xpForNextCpx;
			cpx++;
		}
		return cpx;
	}

	/**
	 * Get an object of empty "slots" that can be filled by bonus Combat
	 * Maneuvers due to this Skill's Cpx.
	 *
	 * @return {object} The keyed-by-Complexity-rank slot object
	 * @access public
	 */
	get bonusManeuvers() {
		if (!this.combatCategory) return {};
		const slots = {};
		for (let c = this.cpx; c > 0; c--) {
			slots[c] = [...Array(c)];
		}
		return slots;
	}

	/**
	 * Determine the total amount of CP spent on this Skill.
	 *
	 * @return {int} The total CP spent on the Skill
	 * @access public
	 */
	get totalCP() {
		return (this.points.level.cp + this.points.cpx.cp);
	}

	/**
	 * Determine the total amount of XP spent on this Skill.
	 *
	 * @return {int} The total XP spent on the Skill
	 * @access public
	 */
	get totalXP() {
		return (this.points.level.xp + this.points.cpx.xp + this.points.edie.fromXP);
	}

	/**
	 * Get the total e-die spent on this skill
	 *
	 * @return {int} The total eDie spent on the skill
	 * @access public
	 */
	get eDieSpent() {
		return this.points.edie.fromBonus + this.points.edie.fromXP;
	}

	/**
	 * Correct any source data using legacy points not-objects and then
	 * initialize the edie fields within the points object.
	 *
	 * @param  {object} data    The source data
	 * @return {object}         The transformed data
	 * @access public
	 */
	static migrateData(data) {
		// Fix points object
		if (Object.hasOwn(data, "points") && typeof data.points != 'object') data.points = {};
		// Fix edie object
		if (Object.hasOwn(data, "points") && Object.hasOwn(data.points, "edie")) {
			if (data.points?.edie && typeof data.points.edie != 'object') data.points.edie = {};
			// Initialize edie values
			if (data.points?.edie && !Object.hasOwn(data.points.edie, "fromBonus")) data.points.edie.fromBonus = 0;
			if (data.points?.edie && !Object.hasOwn(data.points.edie, "fromXP")) data.points.edie.fromXP = 0;
		}

		return super.migrateData(data);
	}

	/**
	 * Spend (or refund) e-die into (or out of) this skill
	 *
	 * @param  {int}  [amount=1]    Amount by which we want to alter the current eDie total.
	 * @return {bool}               Whether we succeeded or not
	 * @access public
	 */
	async alterEdie(amount = 1) {
		const data = this.#computeAlterEdie(amount);
		if (!data) return false;

		// Don't do anything if we'd go negative
		if (this.eDieSpent + (data.spendFromBonus + data.spendFromXP) < 0) {
			const msg = game.i18n.localize("tribe8.errors.edie-below-0");
			if (foundry.ui?.notifications) foundry.ui.notifications.warn(msg);
			else console.warn(msg);
			return false;
		}

		// Update the item
		const newFromBonus = this.points.edie.fromBonus + data.spendFromBonus;
		const newFromXP = this.points.edie.fromXP + data.spendFromXP;
		const update = {
			'system.points.edie.fromBonus': newFromBonus,
			'system.points.edie.fromXP': newFromXP
		};
		const skill = await this.parent.update(update);

		// Don't mess with the actor if our values didn't change
		if (skill.system.points.edie.fromBonus != newFromBonus || skill.system.points.edie.fromXP != newFromXP) {
			const msg = game.i18n.format("tribe8.errors.edie-unchanged", {skillId: skill.id});
			if (foundry.ui?.notifications) foundry.ui.notifications.warn(msg);
			else console.warn(msg);
		}

		// Update the actor
		if (data.owner && this.parent.isEmbedded) {
			if (this.parent.parent) {
				await this.parent.parent.update({'system.edie': data.owner.edie});
			}
		}
		return true;
	}

	/**
	 * Compute an e-die refund amount
	 *
	 * @param  {int}    [amount=1]    Amount by which we want to alter the current eDie total.
	 * @return {object}               The computed set of updated data values to be applied to this Skill model
	 * @access private
	 * @see    alterEdie
	 */
	#computeAlterEdie(amount = 1) {
		// Bail out if value is just 0
		amount = Number(amount);
		if (!amount) return false;

		// Initialize return data
		const data = {
			'spendFromBonus': amount,
			'spendFromXP': 0
		}

		// There's an edge case for decrementing spent edie where we
		// need to determine if we _can_ decrement the requested amount
		// from bonus, or if we have to flip over.
		if (amount < 0) {
			if ((this.points.edie.fromBonus + amount) < 0) {
				data.spendFromBonus = this.points.edie.fromBonus;
				data.spendFromXP = (this.points.edie.fromBonus + amount); // This should now be whatever we actually had in spendFromBonus
			}
		}

		// Update the Actor, if applicable
		if (this.parent.isEmbedded) {
			const owner = this.parent.parent;

			// Does the owner have enough eDie at all?
			if (owner.system.edieTotal < amount) {
				const msg = game.i18n.localize("tribe8.errors.edie-insufficient");
				if (foundry.ui?.notifications) foundry.ui.notifications.error(msg);
				else console.error(msg);
				return false;
			}
			// Add an owner entry to the return data
			data.owner = {'edie': owner.system.edie};

			// Spend from/refund to bonus first
			data.owner.edie = data.owner.edie - amount;

			// Leftover goes to XP (no need to update the owner; that'll self-account)
			if (data.owner.edie < 0) {
				data.spendFromBonus = amount + data.owner.edie;
				amount = Math.abs(data.owner.edie);
				data.owner.edie = 0;
				data.spendFromXP = amount;
			}
		}
		return data;
	}
}
