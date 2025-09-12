import { Tribe8ItemSheet } from './item.js';

export class Tribe8EminenceSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "eminence", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/eminence.hbs' }
	}

	/**
	 * Title of the sheet, prefixed with "Eminence" and any supplied
	 * tribe
	 *
	 * @return {string} The assembled title
	 * @access public
	 */
	get title() {
		let localizationKey = 'eminence.title';
		localizationKey += (this.document.system.tribe ? '-tribe' : '');
		return game.i18n.format(`tribe8.item.${localizationKey}`, {eminence: this.document.name, tribe: this.document.system?.tribe});
	}
}