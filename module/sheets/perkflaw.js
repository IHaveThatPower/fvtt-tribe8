import { Tribe8ItemSheet } from './item.js';
const { DialogV2 } = foundry.applications.api;

class Tribe8PerkFlawSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "pf", "sheet", "item"] },
		position: { width: 300 },
		actions: {
			removeRank: Tribe8PerkFlawSheet.action_removeRank
		}

	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/perkflaw.hbs' }
	}

	static DEFAULT_ICON = () => `systems/tribe8/icons/${this.document.type}.svg`;

	/**
	 * Unified Item sheet title getter that chooses with localization
	 * string to use based on Item type.
	 *
	 * @return {string} The formatted, localized title string
	 * @access public
	 */
	get title() {
		return game.i18n.format(`tribe8.item.${this.document.type}.title`, {pfName: this.document.name});
	}

	/**
	 * Prepare the context object supplied to the application
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// Ensure there's at least one rank value, for looping
		context.ranks = Array.from(context.document.system.points);
		if (context.document.system.points.length == 0) {
			context.ranks.push("");
		}
		// If ranked, ensure there's one more points value than existing choices
		else if (context.document.system.ranked) {
			context.ranks.push("");
		}
		return context;
	}

	/**
	 * Handle the submit data
	 *
	 * @param  {Event}            event              The triggering event
	 * @param  {HTMLFormElement}  form               The top-level form element
	 * @param  {FormDataExtended} formData           The actual data payload
	 * @param  {object}           [updateData={}]    Any supplemental data
	 * @return {object}                              Prepared submission data as an object
	 * @access protected
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// Identify array-based form elements
		const checkKeys = CONFIG.Tribe8.checkFormArrayElements(formData);

		// Extract identified array-based elements
		const rankPoints = {}; // Object so we can use explicit keys
		for (const key of checkKeys) {
			const propertyPath = key.split(/[[.]/);
			if (propertyPath[0] == 'system' && propertyPath[1] == 'points') {
				// Found a valid value, so store it and then delete it from the formData
				if (formData.object[key])
					rankPoints[parseInt(propertyPath[2])] = formData.object[key];
				delete formData.object[key];
			}
		}
		// Sort the found, valid ranks in ascending order
		const sortedValidRanks = Object.keys(rankPoints).sort();
		// Bolt them back onto the formData as a proper array
		for (let r of sortedValidRanks) {
			if (!formData.object['system.points'])
				formData.object['system.points'] = [];
			formData.object['system.points'].push(rankPoints[r]);
		}

		return super._prepareSubmitData(event, form, formData, updateData);
	}

	/**
	 * Remove a rank from a Perk/Flaw
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_removeRank(event, target) {
		event.stopPropagation();
		event.preventDefault();
		const rankIdx = Number(target?.parentNode?.dataset?.rank);
		if (!rankIdx || !this.document.system.points[rankIdx])
			return;
		const that = this;
		DialogV2.confirm({
			content: `Are you sure you want to delete Rank ${rankIdx + 1} from ${this.document.name}? Any other ranks will re-shuffle around it.`,
			modal: true
		}).then((result) => {
			if (result) {
				const points = that.document.system.points;
				points.splice(rankIdx, 1);
				this.document.update({'system.==points': points}).then(() => {
					that.render();
				});
			}
		});
	}
}

/**
 * These are the actual stub classes the game uses, extending from the
 * parent class above. They're separated out, rather than just using
 * a single one, in the event that type-specific logic becomes
 * necessary.
 */
export class Tribe8PerkSheet extends Tribe8PerkFlawSheet {}
export class Tribe8FlawSheet extends Tribe8PerkFlawSheet {}