import { Tribe8ItemSheet } from './item.js';

export class Tribe8TotemSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "totem", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/totem.hbs' }
	}

	/**
	 * Prepend 'Totem' to the sheet title, and include the totem type,
	 * if specified
	 *
	 * @return {string} The assembled sheet title
	 * @access public
	 */
	get title() {
		if (this.document.system.totemType)
			return game.i18n.format("tribe8.item.totem.title-with-type", {name: this.document.name, type: this.document.system.totemType});
		return game.i18n.format("tribe8.item.totem.title", {name: this.document.name});
	}
}
