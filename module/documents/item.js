import { Tribe8Actor } from './actor.js';

export class Tribe8Item extends Item {
	/**
	 * Create Specialization Items and add them to the Item's parent
	 * Actor, if applicable, if they were originally created in the
	 * basic object format.
	 *
	 * This should not be called until after the game setup completes
	 */
	async createSpecializationsFromLegacy() {
		const source = this.getFlag('tribe8', 'legacy-specializations');
		// Probably nothing to do
		if (!source || !Object.keys(source).length)
			return;

		try {
			if (this.parent && this.parent instanceof Tribe8Actor) {
				// What specializations do we already have for this current item?
				const currSpecs = Array.from(this.parent.getEmbeddedCollection("Item")).filter((i) => i.type == 'specialization');
				const specsToCreate = [];
				for (let key of Object.keys(source)) {
					const oldSpec = source[key];
					const oldSpecNameSlug = CONFIG.Tribe8.slugify(oldSpec.name);
					// Do we have any specializations that match?
					if (currSpecs.map((s) => CONFIG.Tribe8.slugify(s.name)).indexOf(oldSpecNameSlug) > -1) {
						// console.log(`A '${oldSpec.name}' Specialization already exists for the ${this.name} Skill`);
						continue;
					}
					// Are we already creating this?
					if (specsToCreate.map((s) => CONFIG.Tribe8.slugify(s.name)).indexOf(oldSpecNameSlug) > -1) {
						// console.log(`A '${oldSpec.name}' Specialization is already going to be created for the ${this.name} Skill`);
						continue;
					}
					specsToCreate.push({type: 'specialization', name: oldSpec.name, system: {points: oldSpec.points.toUpperCase(), skill: this.id}});
				}
				if (specsToCreate.length) {
					const newSpecs = await this.parent.createEmbeddedDocuments("Item", specsToCreate);
					await this.update({'system.specializations': newSpecs.map((n) => n.id)});
				}
			}
		}
		catch (error) {
			console.error(error);
			return;
		}

		// Clear the flag
		await this.setFlag('tribe8', 'legacy-specializations', 1); // Override the object first
		await this.unsetFlag('tribe8', 'legacy-specializations'); // Now clear it out
	}

	/**
	 * Get the actor owner of this item, if there is one.
	 */
	getActorOwner() {
		if (this.isOwned) {
			return this.parent;
		}
		return false;
	}

	/**
	 * Handle any document-level migration hacks we need to do
	 */
	static migrateData(data) {
		if (data.type == 'skill') {
			/**
			 * If the specializations property has an Object constructor
			 * (as opposed to an Array constructor, as is the case with
			 * ArrayField), good bet it's the old-style.
			 */
			if (data?.system?.specializations && data.system.specializations.constructor?.name === 'Object' && Object.keys(data.system.specializations).length) {
				if (!data.flags) data.flags = {};
				if (!data.flags['tribe8']) data.flags['tribe8'] = {};
				try {
					// Stash the data on a flag.
					// deepClone can't handle advanced data fields, hence the try/catch, just incase
					data.flags['tribe8']['legacy-specializations'] = foundry.utils.deepClone(data.system.specializations, {strict: true});

					// Having safely stashed it, nuke it from the migration data
					delete data.system.specializations;

					// If it didn't work for some reason, raise a ruckus
					if (!Object.keys(data.flags['tribe8']['legacy-specializations']).length)
						throw new Error("Failed to migrate specialization data");
				}
				catch (error) {} // No need to report anything
			}
		}
		return super.migrateData(data);
	}

	/**
	 * Return the default artwork for the given item type
	 */
	static getDefaultArtwork(itemData) {
		switch (itemData.type) {
			case 'skill':
				return {img: "systems/tribe8/icons/skill.svg"};
				break;
			case 'perk':
				return {img: "systems/tribe8/icons/perk.svg"};
				break;
			case 'flaw':
				return {img: "systems/tribe8/icons/flaw.svg"};
				break;
			case 'maneuver':
				return {img: "systems/tribe8/icons/maneuver.svg"};
				break;
			default:
				return super.getDefaultArtwork(itemData);
				break;
		}
	}

	/**
	 * Item sort comparison meta-function
	 *
	 * @param	Tribe8Item a
	 * @param	Tribe8Item b
	 */
	static cmp(a, b) {
		switch (a.type) {
			case 'skill':
				return Tribe8Item.cmpSkill(a, b);
				break;
			case 'perk':
			case 'flaw':
				return Tribe8Item.cmpPerkFlaw(a, b);
				break;
			case 'maneuver':
				return Tribe8Item.cmpManeuver(a, b);
				break;
			case 'aspect':
				return Tribe8Item.cmpAspect(a, b);
				break;
			case 'eminence':
				return Tribe8Item.cmpEminence(a, b);
				break;
			/*
			case 'totem':
				return Tribe8Item.cmpTotem(a, b);
				break;
			*/
		}
		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Fallback sort, if other sorting attempts have resulted equal
	 *
	 * @param	Tribe8Item a
	 * @param	Tribe8Item b
	 * @return	int
	 */
	static cmpFallback(a, b) {
		if (a.type != b.type)
			throw new Error("Cannot compare items of different types");
		if (a.name < b.name) return -1;
		if (a.name > b.name) return 1;
		if (a._stats.createdTime < b._stats.createdTime) return -1;
		if (a._stats.createdTime > b._stats.createdTime) return 1;
		return 0;
	}

	/**
	 * Sort for Skills
	 *
	 * @param	Tribe8Item a
	 * @param	Tribe8Item	b
	 * @return	int
	 */
	static cmpSkill(a, b) {
		if (a.type != 'skill' || b.type != 'skill')
			throw new Error("Cannot use Skill comparison function to sort non-Skill items");

		if (a.system.level > b.system.level) return -1;
		if (a.system.level < b.system.level) return 1;

		if (a.system.cpx > b.system.cpx) return -1;
		if (a.system.cpx < b.system.cpx) return 1;

		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Perks and Flaws
	 *
	 * @param	Tribe8Item a
	 * @param	Tribe8Item b
	 * @return	int
	 */
	static cmpPerkFlaw(a, b) {
		if ((a.type != 'perk' && a.type != 'flaw') || (b.type != 'perk' && b.type != 'flaw'))
			throw new Error("Cannot use Perk/Flaw comparison function to sort non-Perk/Flaw items");

		if (a.type == 'perk' && b.type == 'flaw') return -1;
		if (a.type == 'flaw' && b.type == 'perk') return 1;

		if (a.system.granted && !b.system.granted) return -1;
		if (!a.system.granted && b.system.granted)return 1;

		// Fallback does this too, but we want it to come before Ranks
		if (a.name < b.name) return -1;
		if (a.name > b.name) return 1;

		if (a.system.points.length > b.system.points.length) return -1;
		if (a.system.points.length < b.system.points.length) return 1;

		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Maneuvers
	 *
	 * @param	Tribe8Item a
	 * @param	Tribe8Item b
	 * @return	int
	 */
	static cmpManeuver(a, b) {
		if (a.type != 'maneuver' || b.type != 'maneuver')
			throw new Error("Cannot use Maneuver comparison function to sort non-Maneuver items");

		// If the skills don't match, we need to first consult their sorting algorithm
		if (a.system.forSkill != b.system.forSkill)
		{
			const combatSkills = a.parent?.getCombatSkills() || {};

			// Identify the relevant skills to our a and b
			const aSkill = (combatSkills[a.system.forSkill] || [])[0];
			const bSkill = (combatSkills[b.system.forSkill] || [])[0];
			if (aSkill && !bSkill) return -1;
			if (!aSkill && bSkill) return 1;
			if (aSkill && bSkill) {
				let skillCmp;
				if ((skillCmp = Tribe8Item.cmp(aSkill, bSkill)) != 0)
					return skillCmp;
			}
		}

		// If the skills match, *now* we can sort our maneuvers
		if (a.system.granted && !b.system.granted) return -1;
		if (!a.system.granted && b.system.granted) return 1;
		if (a.system.fromCpx || b.system.fromCpx) {
			let aFromCpx = a.system.fromCpx;
			let bFromCpx = b.system.fromCpx;
			if (aFromCpx && a.usesPoints)
				aFromCpx = false;
			if (bFromCpx && b.usesPoints)
				bFromCpx = false;
			if (aFromCpx && !bFromCpx) return -1;
			if (!aFromCpx && bFromCpx) return 1;
		}
		if (a.system.complexity > b.system.complexity) return -1;
		if (a.system.complexity < b.system.complexity) return 1;
		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Eminences
	 *
	 * @param	Tribe8Item a
	 * @param	Tribe8Item b
	 * @return	int
	 */
	static cmpEminence(a, b) {
		if (a.type != 'eminence' || b.type != 'eminence')
			throw new Error("Cannot use Eminence comparison function to sort non-Eminence items");
		if (!a.system.used && b.system.used) return -1;
		if (a.system.used && !b.system.used) return 1;
		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Aspects
	 *
	 * @param	Tribe8Item a
	 * @param	Tribe8Item b
	 * @return	int
	 */
	static cmpAspect(a, b) {
		if (a.type != 'aspect' || b.type != 'aspect')
			throw new Error("Cannot use Aspect comparison function to sort non-Aspect items");
		// TBD if we want to change this up at all
		return Tribe8Item.cmpFallback(a, b);
	}
}