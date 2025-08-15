const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

export class Tribe8ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
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
	 * Handle any special _onRender events.
	 */
	async _onRender(context, options) {
		// When rendering, always re-render the title
		if (this.window.title.textContent != this.title) {
			this._updateFrame({window: { title: this.title }});
		}

		// Setup input resizers
		const inputSizers = this.element.querySelectorAll('span.input-sizer input');
		inputSizers.forEach((s) => {
			s.addEventListener('input', (e) => {
				if (e.target?.parentNode?.dataset)
					e.target.parentNode.dataset.value = e.target.value;
			});
		});

		return await super._onRender(context, options);
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
	static deleteItem(event, target) {
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