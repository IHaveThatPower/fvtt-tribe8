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
			deleteItem: Tribe8ItemSheet.action_deleteItem
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
	 * When we first render, create context menus.
	 *
	 * @param {object} context    The rendering context
	 * @param {object} options    Supplemental rendering options
	 * @access protected
	 */
	async _onFirstRender(context, options) {
		// Artwork context menu
		this._createContextMenu(() => {
				return [
					{
						name: "tribe8.item.contextMenu.show-artwork",
						icon: '<i class="fa-solid fa-image"></i>',
						callback: () => {
							const item = this.document;
							new foundry.applications.apps.ImagePopout({
								src: item.img,
								uuid: item.uuid,
								window: { title: item.name }
							}).render({ force: true });
						}
					},
					{
						name: "tribe8.item.contextMenu.edit-artwork",
						icon: '<i class="fa-solid fa-file-pen"></i>',
						condition: this.document.isOwner,
						callback: el => {
							this.options.actions['editImage']?.call(this, undefined, el);
						}
					}
				];
			},
			'div.artwork'
		);
		super._onFirstRender(context, options);
	}

	/**
	 * Delete existing item
	 *
	 * @param {Event} event    The event triggered by interaction with the form element
	 * @access public
	 */
	static action_deleteItem(event) {
		event.preventDefault();
		event.stopPropagation();
		const item = this.document;
		if (!item) {
			console.log("No item associated with delete?");
			return;
		}
		const actor = item.parent;
		if (!actor) {
			foundry.ui.notifications.warn(game.i18n.localize("tribe8.errors.only-delete-owned-items"));
			return;
		}

		const deleteString = game.i18n.format("tribe8.item.delete-confirm", {'type': game.i18n.localize(`TYPES.item.${item.type}`), 'name': item.name});
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
