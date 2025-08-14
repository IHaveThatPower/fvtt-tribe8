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
			template: 'systems/tribe8/templates/character-sheet.html'
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
		
		// Who's the player for this?
		const playerOwner = this.document.getPlayerOwner();
		if (playerOwner)
			context.playerName = playerOwner.name;
		
		// Differentiate items
		for (let item of this.document.items) {
			switch (item.type) {
				case 'skill':
					if (!context.skills) context.skills = [];
					item.specializations = Object.keys(item.system.specializations).map((s) => { return item.system.specializations[s].name; }).join(', ');
					context.skills.push(item);
					if (game.tribe8.slugify(item.system.name) == 'synthesis') {
						if (!context.magic) context.magic = {};
						context.magic.synthesisSkill = item;
					}
					break;
				case 'perk':
				case 'flaw':
					if (!context.perksAndFlaws)
						context.perksAndFlaws = [];
					context.perksAndFlaws.push(item);
					if (game.tribe8.slugify(item.name) == 'dreamer') {
						if (!context.magic) context.magic = {};
						context.magic.hasDreamerPerk = true;
					}
					if (game.tribe8.slugify(item.name) == 'awakeneddreamer') {
						if (!context.magic) context.magic = {};
						context.magic.hasAwakenedDreamerPerk = true;
					}
					break;
				case 'maneuver':
					if (!context.sortedManeuvers) context.sortedManeuvers = [];
					context.sortedManeuvers.push(item);
					break;
				case 'eminence':
				case 'aspect':
				case 'totems':
					if (!context.magic) context.magic = {};
					const collectionName = `${item.type}s`;
					if (!context.magic[collectionName]) context.magic[collectionName] = [];
					context.magic[collectionName].push(item);
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
		
		// Rig up manual input on eDie fields
		this.element.querySelectorAll('div.edie-block div.value input[type=number]').forEach((i) => {
			i.addEventListener('keyup', (e) => {
				if (!e.target) {
					return;
				}
				// Find the skill
				const skillId = (e.target.closest('div.skill') || {}).dataset?.id;
				if (!skillId) {
					return;
				}
				const skill = this.document.getEmbeddedDocument("Item", skillId);
				if (!skill) {
					return;
				}
				skill.system.eDieKeyInputEventHandler(e);
			});
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
			this.document.update({'system.edie.other': ++currentAmount});
			return;
		}
		const skillItem = this.document.getEmbeddedDocument("Item", skillRow.dataset?.id);
		if (!skillItem) {
			foundry.ui.notifications.error(`Could not find a Skill with the id ${skillRow.dataset?.id}`);
			return;
		}
		skillItem.system.alterEdie();
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
			this.document.update({'system.edie.other': --currentAmount});
			return;
		}
		const skillItem = this.document.getEmbeddedDocument("Item", skillRow.dataset?.id);
		if (!skillItem) {
			foundry.ui.notifications.error(`Could not find a Skill with the id ${skillRow.dataset?.id}`);
			return;
		}
		skillItem.system.alterEdie(-1);
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
			return new foundry.applications.ux.DragDrop.implementation(d);
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
