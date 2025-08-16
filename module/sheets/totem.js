import { Tribe8ItemSheet } from './item.js';

export class Tribe8TotemSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: {
			contentClasses: ["tribe8", "totem", "sheet", "item"]
		},
		position: {
			width: 360
		}
	}

	static PARTS = {
		form: {
			template: 'systems/tribe8/templates/totem-sheet.html'
		}
	}

	/**
	 * Title of the sheet
	 */
	get title() {
		return `Totem: ${this.document.name}` + (this.document.system.totemType ? ` (${this.document.system.totemType})` : '');
	}
}