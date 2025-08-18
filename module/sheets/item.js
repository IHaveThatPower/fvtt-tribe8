const { DialogV2 } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;
import { Tribe8Application } from '../apps/base-app.js';

export class Tribe8ItemSheet extends Tribe8Application(ItemSheetV2) {
	static DEFAULT_OPTIONS = {
		form: {
			closeOnSubmit: false,
			submitOnChange: true
		},
		position: {
			width: "auto",
			height: "auto"
		},
		window: { resizable: true },
		actions: {
			deleteItem: Tribe8ItemSheet.deleteItem
		}
	}

	/**
	 * Basic item name, no prefix. Subclasses will likely want to
	 * override this.
	 *
	 * @return {string} The name of the item
	 * @access public
	 */
	get title() {
		return this.document.name;
	}

	/**
	 * Enrich descriptions and make them editable
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);
	    context.enrichedDescription = await TextEditor.enrichHTML(
			this.document.system.description, {
				secrets: this.document.isOwner,
				relativeTo: this.item
			}
		);
		return context;
	}

	/**
	 * Delete existing item
	 *
	 * @param {Event} event    The event triggered by interaction with the form element
	 * @access public
	 */
	static deleteItem(event) {
		event.preventDefault();
		event.stopPropagation();
		const item = this.document;
		if (!item) {
			console.log("No item associated with delete?");
			return;
		}
		const actor = item.parent;
		if (!actor) {
			foundry.ui.notifications.warn("Only items belonging to actors can be deleted in this way.");
			return;
		}

		const deleteString = `Are you sure you want to ENTIRELY delete the ${item.type[0].toUpperCase()}${item.type.slice(1)} '${item.name}', including any associated points?`;
		DialogV2.confirm({
			content: deleteString,
			modal: true
		}).then((result) => {
			if (result) {
				actor.deleteEmbeddedDocuments('Item', [item.id]);
			}
		});
	}
}