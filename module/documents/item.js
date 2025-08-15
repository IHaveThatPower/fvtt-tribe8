export class Tribe8Item extends Item {
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