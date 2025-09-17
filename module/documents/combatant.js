const { Combatant } = foundry.documents;
import { Tribe8 } from '../config.js';

export class Tribe8Combatant extends Combatant {
	/**
	 * We may need to override the default Initiative rolling mechanism,
	 * if the user wants to supply their own die roll.
	 * @type {Tribe8Roll}
	 */
	_overrideInitiativeRoll;

	/**
	 * Get a Roll object which represents the initiative roll for this
	 * Combatant.
	 *
	 * @param  {string} formula    An override formula for what to roll.
	 * @return {Roll}              The unevaluated Roll instance to use for the combatant.
	 * @access public
	 */
	getInitiativeRoll(formula) {
		if (this._overrideInitiativeRoll) {
			return this._overrideInitiativeRoll;
		}
		formula = formula || this._getInitiativeFormula();
		const rollData = this.actor?.getRollData() || {};
		rollData.combatSense = rollData.items.filter((i) => i.type == 'skill' && Tribe8.slugify(i.system?.name) === Tribe8.slugify(game.i18n.localize("tribe8.item.skill.names.combatsense")))[0]?.system?.level || 0;
		return foundry.dice.Roll.create(formula, rollData);
	}

	/**
	 * Set an override property on the combatant that gets returned
	 * instead of the default getInitiativeRoll() result
	 *
	 * @param  {Tribe8Roll} roll    The override result
	 * @return {void}
	 * @access public
	 */
	setInitiativeOverride(roll) {
		this._overrideInitiativeRoll = roll;
	}

	/**
	 * Clear any already-set override property on the combatant
	 *
	 * @return {void}
	 * @access public
	 */
	clearInitiativeOverride() {
		this._overrideInitiativeRoll = null;
	}
}
