import { Tribe8ItemSheet } from './item.js';

export class Tribe8AspectSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "aspect", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/aspect.html' }
	}

	/**
	 * Prepend 'Aspect' to the sheet title, and include the tribe, if
	 * specified
	 *
	 * @return {string} The assembled sheet title
	 * @access public
	 */
	get title() {
		return `Aspect: ${this.document.name}` + (this.document.system.tribe ? ` (${this.document.system.tribe})` : '');
	}
}