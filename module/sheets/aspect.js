import { Tribe8ItemSheet } from './item.js';

export class Tribe8AspectSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: {
			contentClasses: ["tribe8", "aspect", "sheet", "item"]
		},
		position: {
			width: 360
		}
	}

	static PARTS = {
		form: {
			template: 'systems/tribe8/templates/aspect-sheet.html'
		}
	}

	/**
	 * Title of the sheet
	 */
	get title() {
		return `Aspect: ${this.document.name}` + (this.document.system.tribe ? ` (${this.document.system.tribe})` : '');
	}
}