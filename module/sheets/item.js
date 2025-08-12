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
		// this.#dragDrop.forEach((d) => d.bind(this.element));
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

	/**
	 * Identify array-style form elements in a submit package and return
	 * their names.
	 */
	_checkFormArrayElements(formData) {
		const checkKeys = [];
		Object.keys(formData.object).forEach((f) => {
			if (f.match(/\[/)) {
				checkKeys.push(f);
			}
		});
		return checkKeys;
	}
	
	/*******************************************************************
	 * Drag & Drop Stuff
	 ******************************************************************/
	
	/**
	 * Re-implement drag-drop handlers in ApplicationV2
	 */
	#createDragDropHandlers() {
		return this.options.dragDrop.map((d) => {
			d.permissions = {
				dragstart: this._canDragStart.bind(this),
				drop: this._canDragDrop.bind(this)
			};
			d.callbacks = {
				dragstart: this._onDragStart.bind(this),
				dragover: this._onDragOver.bind(this),
				drop: this._onDrop.bind(this)
			};
			return new DragDrop(d);
		});
	}
	
	#dragDrop;
	
	/**
	 * Getter for the dragdrop object, if we need it
	 */
	get dragDrop() {
		return this.#dragDrop;
	}

	/**
	 * Define whether a user is able to begin a dragstart workflow for a given drag selector
	 * @param {string} selector       The candidate HTML selector for dragging
	 * @returns {boolean}             Can the current user drag this selector?
	 * @protected
	 */
	_canDragStart(selector) {
		// game.user fetches the current user
		return this.isEditable;
	}

	/**
	 * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
	 * @param {string} selector       The candidate HTML selector for the drop target
	 * @returns {boolean}             Can the current user drop on this selector?
	 * @protected
	 */
	_canDragDrop(selector) {
		// game.user fetches the current user
		return this.isEditable;
	}

	/**
	 * Callback actions which occur at the beginning of a drag start workflow.
	 * @param {DragEvent} event       The originating DragEvent
	 * @protected
	 */
	_onDragStart(event) {
		const el = event.currentTarget;
		if ('link' in event.target.dataset) return;

		// Extract the data you need
		let dragData = null;

		if (!dragData) return;

		// Set data transfer
		event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
	}

	/**
	 * Callback actions which occur when a dragged element is over a drop target.
	 * @param {DragEvent} event       The originating DragEvent
	 * @protected
	 */
	_onDragOver(event) {}

	/**
	 * Callback actions which occur when a dragged element is dropped on a target.
	 * @param {DragEvent} event       The originating DragEvent
	 * @protected
	 */
	async _onDrop(event) {
		const data = TextEditor.getDragEventData(event);

		// Handle different data types
		switch (data.type) {
				// write your cases
		}
	}
}