import { Tribe8GearSheet } from './gear.js';
import { Tribe8 } from '../config.js';

export class Tribe8ArmorSheet extends Tribe8GearSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "gear", "sheet", "item", "armor"] },
		actions: {
			addCoverage: Tribe8ArmorSheet.action_addCoverage,
			removeCoverage: Tribe8ArmorSheet.action_removeCoverage
		}
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/armor.hbs' }
	}

	/**
	 * Prepend the owner to the sheet title, if the Weapon is owned.
	 *
	 * @return {string} The assembled sheet title
	 * @access public
	 */
	get title() {
		let key = 'title';
		key += (this.document.parent ? '.owned' : '.unowned');
		return game.i18n.format(`tribe8.item.gear.${key}`, {item: this.document.name, owner: this.document.parent?.name});
	}

	/**
	 * Prepare the context to inform what the Weapon sheet renders.
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		// Furnish concealment level
		context.conceal = Object.fromEntries(Tribe8.armorConcealable.map((c) => [c, `tribe8.item.armor.conceal.${c}`]));
		// Furnish coverage options
		context.coverage = [...Tribe8.armorCoverage];
		return context;
	}

	/**
	 * Handle the submit data. In particular, parse out the single ROF
	 * field into the rate and the rounds.
	 *
	 * @param  {Event}            event              The triggering event
	 * @param  {HTMLFormElement}  form               The top-level form element
	 * @param  {FormDataExtended} formData           The actual data payload
	 * @param  {object}           [updateData={}]    Any supplemental data
	 * @return {object}                              Prepared submission data as an object
	 * @access protected
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		return super._prepareSubmitData(event, form, formData, updateData);
	}

	/**
	 * Process the submitted data, or rather don't if the instigator
	 * of the submission was a form input the name of which starts with
	 * `addCoverage`.
	 *
	 * @param {Event}           event           The event that triggered submission
	 * @param {HTMLFormElement} form            The form element doing the submitting
	 * @param {object}          submitData      The processed submit data
	 * @param {object}          [options={}]    Any extra options that need to be passed along
	 * @access protected
	 */
	async _processSubmitData(event, form, submitData, options={}) {
		// Stop the process if the event was emitted by one of the newSpecialization inputs
		const submittingElement = event.submitter ?? event.target;
		if (submittingElement.nodeName == 'SELECT' && submittingElement.name == 'coverage-select')
			return;
		await super._processSubmitData(event, form, submitData, options);
	}

	/**
	 * Add Coverage to a piece of Armor.
	 * Once done, re-render the form.
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_addCoverage(event, target) {
		event.stopPropagation();
		event.preventDefault();

		// What kind of coverage are we adding?
		const newCoverage = target.parentNode?.querySelector('select[name="coverage-select"]')?.value;
		if (typeof newCoverage == 'undefined') return;

		// Get the current coverage list
		const currentCoverage = [...this.document.system.coverage];

		// If coverage already in the list, present a warning message
		if (currentCoverage.includes(newCoverage)) {
			foundry.ui.notifications.warn(game.i18n.localize("tribe8.errors.armor-double-coverage"));
			return;
		}

		// Push it onto the list
		currentCoverage.push(newCoverage);

		// Sort the list
		currentCoverage.sort();

		// Update the Item, then re-render
		const that = this;
		this.document.update({'system.==coverage': currentCoverage}, {diff: false}).then(() => that.render());
	}

	/**
	 * Remove existing Coverage
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_removeCoverage(event, target) {
		event.stopPropagation();
		event.preventDefault();

		// Which index are we removing from the coverage list?
		const removeCoverage = target.parentNode?.dataset?.editId;
		if (typeof removeCoverage == 'undefined') return;

		// Get the current coverage list
		const currentCoverage = [...this.document.system.coverage];

		// Remove it
		currentCoverage.splice(removeCoverage, 1);

		// Update the Item, then re-render
		const that = this;
		this.document.update({'system.==coverage': currentCoverage}, {diff: false}).then(() => that.render());
	}
}
