const { Combatant } = foundry.documents;

export class Tribe8Combatant extends Combatant {
	/**
	 * Get a Roll object which represents the initiative roll for this
	 * Combatant.
	 *
	 * @param  {string} formula    An override formula for what to roll.
	 * @return {Roll}              The unevaluated Roll instance to use for the combatant.
	 * @access public
	 */
	getInitiativeRoll(formula) {
		formula = formula || this._getInitiativeFormula();
		const rollData = this.actor?.getRollData() || {};
		rollData.combatSense = rollData.items.filter((i) => i.type == 'skill' && CONFIG.Tribe8.slugify(i.system?.name) == 'combatsense')[0]?.system?.level || 0;
		return foundry.dice.Roll.create(formula, rollData);
	}
}