const { DialogV2 }      = foundry.applications.api;
const { renderTemplate} = foundry.applications.handlebars;
const { CombatTracker } = foundry.applications.sidebar.tabs;
const { OperatorTerm }  = foundry.dice.terms;
import { SilhouetteDie } from '../dice/die.js';
import { Tribe8Roll } from '../dice/roll.js';

export class Tribe8CombatTracker extends CombatTracker {
	static INITIATIVE_DIALOG_TEMPLATE = "systems/tribe8/templates/apps/initiative-dialog.hbs";

	/**
	 * Handle rolling initiative for a single combatant.
	 * We interject with a roll dialog to the user, which allows them
	 * to input a manual roll result, if desired.
	 *
	 * @param  {Combatant}       combatant    The combatant for which to roll initiative
	 * @return {Promise<Combat>}              The resolved updated Combat
	 * @access protected
	 */
	_onRollInitiative(combatant) {
		return this._initiativeRollDialog(combatant);
	}

	/**
	 * Present an Initiative-rolling Dialog to the user where they can
	 * input a manual roll.
	 *
	 * @param  {Combatant}            combatant    The combatant for which to roll initiative
	 * @return {Promise<Combat>|void}              The resolved updated Combat, or void if the dialog was canceled
	 * @access protected
	 */
	async _initiativeRollDialog(combatant) {
		combatant.clearInitiativeOverride();
		const context = {
			combatant: combatant,
			formula: combatant.getInitiativeRoll().formula,
			rollModes: CONFIG.Dice.rollModes,
			currentRollMode: game.settings.get("core", "rollMode")
		};
		const content = await renderTemplate(this.constructor.INITIATIVE_DIALOG_TEMPLATE, context);
		const self = this;
		const response = await DialogV2.wait({
			window: { title: "Roll Initiative" },
			classes: ["tribe8", "initiative-dialog"],
			content: content,
			modal: true,
			buttons: [
				{
					label: "Roll Initiative!",
					action: "initiative",
					callback: self.constructor._processInitiativeDialog,
					default: true
				},
				{
					label: "Cancel",
				}
			]
		});

		if (!response) return;
		const useOverride = response.bonus !== null || response.manual !== null;

		// Set the override, roll it and capture the result, clear the
		// override, then return the result
		if (useOverride)
			this.overrideInitiativeRoll(combatant, response);
		const rollInitiativeResult = await this.viewed.rollInitiative(
			[combatant.id],
			{
				formula: null,
				updateTurn: true,
				messageOptions: {
					rollMode: response.rollMode
				}
			}
		);
		if (useOverride)
			combatant.clearInitiativeOverride();
		return rollInitiativeResult;
	}

	/**
	 * Process the results of the Initiative Dialog.
	 *
	 * The third argument supplied to the callback, dialog, is not used.
	 *
	 * @param  {PointerEvent}      event     The event that triggered the callback
	 * @param  {HTMLButtonElement} button    The button pressed to trigger the callback
	 * @return {object}                      Our assembled response
	 * @access protected
	 */
	static _processInitiativeDialog(event, button) {
		const {elements} = button.form;
		const response = {};
		response.bonus = elements.bonus?.value || null;
		response.manual = elements.manual?.value || null;
		response.mode = elements.rollMode?.value || null;
		return response;
	}

	/**
	 * Given a Combatant's Initiative Roll, and a response object from
	 * the Initiative Dialog, update the Roll with the supplied data
	 *
	 * @param  {Tribe8Combatant} combatant    The combatant being overridden
	 * @param  {object}          response     The response data from the submitted form
	 * @return {void}
	 * @access public
	 */
	overrideInitiativeRoll(combatant, response) {
		const roll = combatant.getInitiativeRoll();
		// Don't do anything if we didn't have any changes to make
		if (!response.bonus && !response.manual) return roll;

		// Bolt on the situational bonus
		if (response.bonus) {
			this._applySituationalBonus(roll, response.bonus);
		}

		// Override the die result
		if (response.manual) {
			this._applyManualResult(roll, response.manual);
		}
		combatant.setInitiativeOverride(roll);
	}

	/**
	 * Parse the entire bonus string as a Roll unto itself, the terms
	 * of which we'll merge
	 *
	 * @param  {Tribe8Roll} roll     The roll to be modified
	 * @param  {string}     bonus    The roll bonus string
	 * @return {void}
	 * @access protected
	 */
	_applySituationalBonus(roll, bonus) {
		const bonusRoll = new Tribe8Roll(bonus);
		if (bonusRoll.terms.length) {
			let operator = "+";
			if (bonusRoll.terms[0].number < 0) {
				operator = "-";
				bonusRoll.terms[0].number = Math.abs(bonusRoll.terms[0].number);
			}
			roll.terms.push(new OperatorTerm({operator: operator}));
			for (let b = 0; b < bonusRoll.terms.length; b++) {
				roll.terms.push(bonusRoll.terms[b]);
			}
		}
		roll.resetFormula();
	}

	/**
	 * Override the normal Foundry random roll result with a manually-
	 * rolled result, then reprocess the roll to derive any additional
	 * information we can about it.
	 *
	 * @param  {Tribe8Roll} roll      The roll to be modified
	 * @param  {int}        manual    The manually-rolled result.
	 *                                This *should* be a number, but
	 *                                it's coming from a form, so we do
	 *                                a little gut-checking to be sure
	 * @return {void}
	 * @access protected
	 */
	_applyManualResult(roll, manual) {
		const manualRoll = Number(manual);
		if (isNaN(manualRoll)) return;

		// Find the SilhouetteDie term in the roll, which we'll replace.
		const dieIdx = roll.terms.findIndex((t) => t.constructor.name == 'SilhouetteDie');

		// Define a single result with our manual roll value.
		// For certain results, we can then back-fill dice
		const overrideResults = [{active: true, result: manualRoll}];

		// Multiple 6s rolled on multiple dice
		if (manualRoll > 6 && ((manualRoll - 5) == roll.terms[dieIdx].number)) {
			// We treat the first result as a six
			overrideResults[0].result = 6;

			// Next, figure out how many more sixes we need to make
			// this result happen, up to the limit of the dice we rolled
			let remainder = manualRoll - 6; // 5, to account for the first 6 rolled
			for (let r = 1; r < roll.terms[dieIdx].number; r++) {
				overrideResults.push({active: true, result: 6});
				remainder--;
				if (remainder == 0) break;
			}
		}

		// Multiple ones rolled on multiple dice
		if (manualRoll == 1 && roll.terms[dieIdx].number > 1) {
			for (let r = 1; r < roll.terms[dieIdx].number; r++) {
				overrideResults.push({active: false, result: 1});
			}
		}

		// Assemble parameters to initialize a SilhouetteDie that
		// matches everything we just determined.
		const overrideDie = {
			number: roll.terms[dieIdx].number,
			modifiers: [...roll.terms[dieIdx].modifiers],
			results: overrideResults,
			options: {...roll.terms[dieIdx].options}
		};

		// Replace the existing SilhouetteDie with a new one,
		// initialized from our updated parameters
		roll.terms[dieIdx] = new SilhouetteDie(overrideDie);

		// Reset the Roll formula to ensure it accounts for the new term
		roll.resetFormula();
	}
}