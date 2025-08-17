import { Tribe8ItemSheet } from './item.js';

export class Tribe8EminenceSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "eminence", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/eminence-sheet.html' }
	}

	/**
	 * Title of the sheet, prefixed with "Eminence" and any supplied
	 * tribe
	 *
	 * @return {string} The assembled title
	 * @access public
	 */
	get title() {
		return `Eminence: ${this.document.name}` + (this.document.system.tribe ? ` (${this.document.system.tribe})` : '');
	}
}