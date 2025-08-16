import { Tribe8ItemSheet } from './item.js';
const { DialogV2 } = foundry.applications.api;

class Tribe8PerkFlawSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: {
			contentClasses: ["tribe8", "pf", "sheet", "item"]
		},
		position: {
			width: 300
		},
		actions: {
			removeRank: Tribe8PerkFlawSheet.removeRank
		}

	}

	static PARTS = {
		form: {
			template: 'systems/tribe8/templates/perkflaw-sheet.html'
		}
	}

	/**
	 * Prepare the context object supplied to the application
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// Ensure there's at least one rank value, for looping
		context.ranks = Array.from(context.document.system.points);
		if (context.document.system.points.length == 0) {
			context.ranks.push("");
		}
		// If ranked, ensure there's one more points value than existing choices
		else if (context.document.system.ranked) {
			context.ranks.push("");
		}
		return context;
	}

	/**
	 * Handle the submit data
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// Identify array-based form elements
		const checkKeys = CONFIG.Tribe8.checkFormArrayElements(formData);

		// Extract identified array-based elements
		const rankPoints = {}; // Object so we can use explicit keys
		for (const key of checkKeys) {
			const propertyPath = key.split(/[[.]/);
			if (propertyPath[0] == 'system' && propertyPath[1] == 'points') {
				// Found a valid value, so store it and then delete it from the formData
				if (formData.object[key])
					rankPoints[parseInt(propertyPath[2])] = formData.object[key];
				delete formData.object[key];
			}
		}
		// Sort the found, valid ranks in ascending order
		const sortedValidRanks = Object.keys(rankPoints).sort();
		// Bolt them back onto the formData as a proper array
		for (let r of sortedValidRanks) {
			if (!formData.object['system.points'])
				formData.object['system.points'] = [];
			formData.object['system.points'].push(rankPoints[r]);
		}

		return super._prepareSubmitData(event, form, formData, updateData);
	}

	/**
	 * Remove a rank from a Perk/Flaw
	 */
	static removeRank(event, target) {
		event.stopPropagation();
		event.preventDefault();
		console.log(event);
		console.log(target);
		const rankIdx = Number(target?.parentNode?.dataset?.rank);
		if (!rankIdx || !this.document.system.points[rankIdx])
			return;
		const that = this;
		DialogV2.confirm({
			content: `Are you sure you want to delete Rank ${rankIdx + 1} from ${this.document.name}? Any other ranks will re-shuffle around it.`,
			modal: true
		}).then((result) => {
			if (result) {
				const points = that.document.system.points;
				points.splice(rankIdx, 1);
				this.document.update({'system.==points': points}).then(() => {
					that.render();
				});
			}
		});
	}
}

export class Tribe8PerkSheet extends Tribe8PerkFlawSheet {
	static DEFAULT_ICON = "systems/tribe8/icons/perk.svg";

	/**
	 * Title of the sheet
	 */
	get title() {
		return `Perk: ${this.document.name}`;
	}
}
export class Tribe8FlawSheet extends Tribe8PerkFlawSheet {
	static DEFAULT_ICON = "systems/tribe8/icons/flaw.svg";

	/**
	 * Title of the sheet
	 */
	get title() {
		return `Flaw: ${this.document.name}`;
	}
}