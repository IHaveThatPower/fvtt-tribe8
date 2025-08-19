import { Tribe8ItemSheet } from './item.js';

export class Tribe8TotemSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "totem", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/totem.html' }
	}

	/**
	 * Prepend 'Totem' to the sheet title, and include the totem type,
	 * if specified
	 *
	 * @return {string} The assembled sheet title
	 * @access public
	 */
	get title() {
		return `Totem: ${this.document.name}` + (this.document.system.totemType ? ` (${this.document.system.totemType})` : '');
	}
}