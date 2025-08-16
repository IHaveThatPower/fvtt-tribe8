const { DialogV2 } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;
import { Tribe8Sheet } from './sheet.js';

export class Tribe8ItemSheet extends Tribe8Sheet(ItemSheetV2) {
	static DEFAULT_OPTIONS = {
		form: {
			closeOnSubmit: false,
			submitOnChange: true
		},
		position: {
			width: "auto",
			height: "auto"
		},
		window: {
			resizable: true,
		},
		actions: {
			deleteItem: Tribe8ItemSheet.deleteItem
		}
	}

	/**
	 * Title of the sheet
	 */
	get title() {
		return this.document.name;
	}

	/**
	 * Enrich descriptions and make them editable
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