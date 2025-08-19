const { DocumentSheetV2 } = foundry.applications.api;
import { Tribe8Application } from '../apps/base-app.js';

export class Tribe8AttributeEditor extends Tribe8Application(DocumentSheetV2) {
	static DEFAULT_OPTIONS = {
		form: {
			closeOnSubmit: false,
			submitOnChange: true
		},
		window: {
			resizable: true,
			contentClasses: ["tribe8", "attributes", "tribe8app"]
		},
		position: {
			width: 360,
			height: "auto"
		}
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/apps/attributes-editor.html' }
	}

	/**
	 * Title of the application, plus the character's name
	 *
	 * @return {string} The name for the editor
	 * @access public
	 */
	get title() {
		return `${game.i18n.localize("Attribute Editor")}: ${this.document.name}`;
	}
}