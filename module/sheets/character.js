const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class Tribe8CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		form: {
			closeOnSubmit: false,
			submitOnChange: true
		},
		position: {
			width: 1024,
			height: 768
		},
		dragDrop: [{
			dragSelector: '.item-list .item',
			dropSelector: null
		}],
		window: {
			resizable: true,
			contentClasses: ["tribe8", "character", "sheet", "actor"]
		},
		actions: {
			incrementEdie: Tribe8CharacterSheet.incrementEdie,
			decrementEdie: Tribe8CharacterSheet.decrementEdie,
			editItem: Tribe8CharacterSheet.editItem,
			addNewItem: Tribe8CharacterSheet.addNewItem
		}
	}

	static PARTS = {
		form: {
			template: 'systems/tribe8/templates/character-sheet.html' // TODO: Limited sheet support
		}
	}
	
	/**
	 * Need to override the default constructor so that we setup 
	 * drag-drop
	 */
	constructor(options = {}) {
		super(options);
		this.#dragDrop = this.#createDragDropHandlers();
	}
	
	/**
	 * Title of the sheet
	 */
	get title() {
		return this.document.name;
	}

	/**
	 * Prepare the context with which the Application renders. 
	 * This used to be getData() in Application V1
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		
		// Differentiate items
		for (let item of this.document.items) {
			switch (item.type) {
				case 'skill':
					if (!context.skills)
						context.skills = [];
					/*
					item.specializations = Object.keys(item.system.specializations).map((s) => { return `${item.system.specializations[s].name} (${item.system.specializations[s].points.toUpperCase()})`; }).join(', ');
					*/
					item.specializations = Object.keys(item.system.specializations).map((s) => { return item.system.specializations[s].name; }).join(', ');
					context.skills.push(item);
					break;
				case 'perk':
				case 'flaw':
					if (!context.perksAndFlaws)
						context.perksAndFlaws = [];
					context.perksAndFlaws.push(item);
					break;
				case 'maneuver':
					if (!context.sortedManeuvers)
						context.sortedManeuvers = [];
					context.sortedManeuvers.push(item);
					break;
				default:
					console.log(`Unsupported character item type '${item.type}', will not display`);
					break;
			}
		}
		
		// Sort various items for display
		if (context.skills && context.skills.length) {
			context.skills.sort(context.skills[0].system.constructor.cmp);
		}
		if (context.perksAndFlaws && context.perksAndFlaws.length) {
			context.perksAndFlaws.sort(context.perksAndFlaws[0].system.constructor.cmp);
		}
		if (context.sortedManeuvers && context.sortedManeuvers.length) {
			context.sortedManeuvers.sort(context.sortedManeuvers[0].system.constructor.cmp);
		}
		return context;
	}

	/**
	 * Handle any special _onRender events.
	 */
	async _onRender(context, options) {
		this.#dragDrop.forEach((d) => d.bind(this.element));
		
		/**
		 * Setup inline skill edit
		 */
		const skillContainer = this.element.querySelector('div.skills');
		skillContainer.addEventListener('change', (e) => {
			if (e.target.nodeName == 'INPUT' || e.target.nodeName == 'TEXTAREA') {
				e.preventDefault();
				e.stopImmediatePropagation();
				Tribe8CharacterSheet.inlineEditSkill(e, e.target);
			}
		});
		super._onRender(context, options);
	}

	/**
	 * Increment edie "other" amount
	 */
	static incrementEdie(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			// Wasn't the skill row; probably the general parent
			let currentAmount = this.document.system.edie.other;
			currentAmount++;
			this.document.update({'system.edie.other': currentAmount});
			return;
		}
		foundry.utils.fromUuid(skillRow.dataset?.uuid).then((skillItem) => {
			if (!skillItem) {
				foundry.ui.notifications.error("Could not find the Skill's UUID");
				return;
			}
			skillItem.system.spendEdie();
		});
	}
	
	/**
	 * Decrement edie "other" amount
	 */
	static decrementEdie(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			// Wasn't the skill row; probably the general parent
			let currentAmount = parseInt(this.document?.system?.edie?.other) || 0;
			currentAmount--;
			this.document.update({'system.edie.other': currentAmount});
			return;
		}
		foundry.utils.fromUuid(skillRow.dataset?.uuid).then((skillItem) => {
			if (!skillItem) {
				foundry.ui.notifications.error("Could not find the Skill's UUID");
				return;
			}
			skillItem.system.refundEdie();
		});
	}
	
	/**
	 * Add a new Item
	 */
	static addNewItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const addItemType = target.name?.split('-')[1];
		if (!addItemType || (Object.keys(CONFIG.Item.dataModels).indexOf(addItemType) < 0 && addItemType != 'pf')) {
			foundry.ui.notifications.warn("Requested creation of unrecognized item type");
			return;
		}
		// Present special dialog for Perks/Flaws
		if (addItemType == 'pf') {
			const that = this;
			DialogV2.wait({
				window: {title: "Choose Perk or Flaw"},
				content: "Do you wish to create a Perk or a Flaw?",
				buttons: [
					{label: "Perk", action: "perk"},
					{label: "Flaw", action: "flaw"},
					{label: "Cancel", action: "cancel"}
				],
				modal: true
			}).then((result) => {
				if (result) {
					switch (result) {
						case 'perk':
						case 'flaw':
							that._addNewItem(result);
							break;
						default:
							break;
					}
				}
			});
		}
		else {
			this._addNewItem(addItemType);
		}
	}
	
	/**
	 * Actually create a new item
	 * 
	 * @param	String itemType
	 */
	_addNewItem(itemType) {
		const newItemName = `New ${itemType[0].toUpperCase()}${itemType.slice(1)}`;
		this.document.createEmbeddedDocuments('Item', [{type: itemType, name: newItemName}]).then((resolve) => {
			const newItem = resolve[0];
			// Open the editing window for it
			newItem.sheet.render(true);
		});
	}
	
	/**
	 * Open the editing dialog for an existing item
	 */
	static editItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const item = this._getItemFromTarget(target, 'edit');
		if (!item)
			return;
		item.sheet.render(true);
	}

	/**
	 * Get an embedded item by way of the button used to edit it.
	 * 
	 * @param	HTMLElement
	 * @return	Tribe8Item
	 */
	_getItemFromTarget(target, action) {
		const targetParts = (target.dataset?.actionSlug ?? "").split('-');
		if (targetParts[0] != action) {
			console.log("Invalid action");
			return false;
		}
		const id = targetParts.slice(2).join('-');
		const item = this.document.getEmbeddedDocument('Item', id);
		if (!item) {
			console.log("Item not found");
			return false;
		}
		// Make sure the edit request is of the proper type
		const legalTypes = Object.keys(CONFIG.Item.dataModels).reduce((obj, m) => {
				if (m == 'perk' || m == 'flaw') {
					if (!obj['pf']) obj['pf'] = [];
					obj['pf'].push(m);
				}
				else obj[m] = [m];
				return obj;
			}, {});
		if (!legalTypes[targetParts[1]] || legalTypes[targetParts[1]].indexOf(item.type) < 0) {
			console.log("Item type mismatch");
			return false;
		}
		return item;
	}
	
	/**
	 * Inline editing of skills directly on the character sheet
	 */
	static async inlineEditSkill(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			console.log("No skill row found relative to event target");
			return;
		}
		const uuid = skillRow.dataset?.uuid;
		const skillItem = await foundry.utils.fromUuid(uuid);
		if (!skillItem) {
			console.log("No skill item found with the indicated UUID");
			return;
		}
		// What did we edit?
		const editField = target.name.split(`${skillItem.id}.`)[1];
		
		// Specializations needs special pre-processing
		if (editField == 'specializations') {
			// We need to convert the supplied value into tokenized chunks
			let delim = ',';
			if (target.value.split(';').length > 1) // Using semicolon delimiters
				delim = ';';
			const fieldData = target.value.split(delim);
			const specializationPayload = [];

			for (let spec of fieldData) {
				spec = spec.trim();
				let matches = spec.match(/^(.*?)( ?\(([CX])P\))?$/);
				const specName = matches[1].trim();
				const pointsType = (matches[3] ?? "X").toLowerCase() + "p";
				specializationPayload.push({name: specName, points: pointsType});
			}
			await skillItem.system.updateSpecializations(specializationPayload);
		}
		else {
			// We expect every other field to be prefixed with system.
			// EDie are a special case, because we need to figure out
			// which "bucket" they'll go in.
			if (editField == 'system.points.level.edie') {
				console.log(skillItem);
			}
			else {
				await skillItem.update({[editField]: target.value});
			}
		}
	}

	/*******************************************************************
	 * Drag & Drop Stuff
	 ******************************************************************/

	#dragDrop;

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
			case 'Item':
				this.document.addItem(data.uuid);
				break;
			default:
				foundry.ui.notifications.error("Unsupported drag-and-drop type");
				break;
		}
	}
}
