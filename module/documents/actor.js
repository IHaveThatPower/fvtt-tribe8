import { Tribe8Item } from './item.js'; // For sorting

export class Tribe8Actor extends Actor {
	/**
	 * Converts legacy specializations backed up on Item flags into
	 * actual Specialization documents associated with the proper
	 * Skill
	 */
	async createSpecializationsFromLegacy() {
		const skills = Array.from(this.getEmbeddedCollection("Item")).filter((i) => (i.type == 'skill' && i.getFlag('tribe8', 'legacy-specializations')));
		for (let skill of skills) {
			await skill.createSpecializationsFromLegacy();
		}
	}
	
	/**
	 * Align Specialization and Skill items
	 */
	async alignSkillsAndSpecializations() {
		const items = Array.from(this.getEmbeddedCollection("Item"));
		const skills = items.filter((s) => s.type == 'skill');
		const specializations = items.filter((s) => s.type == 'specialization');

		// Specializations first
		const removeSpecs = [];
		for (let spec of specializations) {
			// Make sure the Specialization's Skill exists on the Actor
			const skillItems = skills.filter((s) => s.id == spec.system.skill);
			if (!skillItems.length) {
				console.warn(`Actor.${this.id}.Specialization.${spec.id} lists Skill.${spec.system.skill}, but no matching Skill was found on the Actor`);
				removeSpecs.push(specialization.id);
				continue;
			}
			// Make sure the Skill lists the Specialization
			const specSkill = skillItems[0];
			if (specSkill.system.specializations.indexOf(spec.id) < 0) {
				console.warn(`Actor.${this.id}.Skill.${specSkill.id} does not list Specialization.${spec.id}, but the Specialization lists Skill.${spec.system.skill}. Updating.`);
				await specSkill.update({'system.specializations': [...specSkill.system.specializations, spec.id]});
			}
		}

		// Skills second
		for (let skill of skills) {
			if (skill.system.specializations.length) {
				for (let specId of skill.system.specializations) {
					// Make sure the listed Specialization exists on the Actor
					const specItems = specializations.filter((s) => s.id == specId);
					if (!specItems.length) {
						console.warn(`Specialization.${specId} not found on Actor.${actor.id}.Skill${skill.id}. Removing from list.`);
						const removeIndex = skill.system.specializations.indexOf(specId);
						if (removeIndex >= 0) {
							await skill.update({'system.specializations': skill.system.specializations.splice(removeIndex, 1)});
						}
						continue;
					}
					
					// Make sure the Specialization's Skill matches the currently-evaluated Skill
					const expectedSkill = specItems[0].system['skill'];
					if (expectedSkill != skill.id) {
						console.warn(`Actor.${this.id}.Skill.${skill.id} lists Specialization.${specId}, but the Specialization lists Skill.${expectedSkill}. Updating the Specialization.`);
						await specItems[0].update({'system.skill': skill.id});
					}
				}
			}
		}

		// Nuke the errant Specializations
		if (removeSpecs.length) {
			// console.log(`Should remove the following specs from Actor ${this.id}'s ${skill.name} skill`, removeSpecs);
			await this.deleteEmbeddedDocuments("Item", removeSpecs);
		}
	}

	/**
	 * Utility function to determine which player (if any) owns this
	 * actor.
	 */
	getPlayerOwner() {
		if (!this.hasPlayerOwner)
			return false;

		const possibleOwners = Object.entries(this.ownership) // Get all ownership entries
								.filter(([id, level]) => (level == foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && id != 'default')) // Get only true, non-default owners
								.map(([id, level]) => id) // Drop the level, now that we're dealing only with owners
								.sort((a, b) => { // We assume the "older" owner is the primary one
									const aUser = game.users.get(a);
									const bUser = game.users.get(b);
									if (aUser?._stats?.createdTime < bUser?._stats?.createdTime)
										return -1;
									if (aUser?._stats?.createdTime > bUser?._stats?.createdTime)
										return 1;
									return 0;
								});
		// If we don't have any owners after all that
		if (!possibleOwners.length)
			return false;

		// Return the top-sorted owner found
		return game.users.get(possibleOwners[0]);
	}

	/**
	 * Get a list of this character's Skills that can be used to make
	 * attacks in combat.
	 *
	 * @return	Object
	 */
	getCombatSkills() {
		// Define the default names of the combat Skills, based on config
		const combatSkillNames = Object.values(CONFIG.Tribe8.COMBAT_SKILLS).map((s) => CONFIG.Tribe8.slugify(s));

		// Gather all Skills from this character that might qualify
		const skills = Array.from(this.getEmbeddedCollection("Item")).filter((i) => {
			if (i.type != 'skill') return false;
			let lookupName = CONFIG.Tribe8.slugify(i.system.name);
			// Special case Hand to Hand checks
			if (CONFIG.Tribe8.HAND_TO_HAND_VARIATIONS.indexOf(lookupName) >= 0)
				lookupName = 'handtohand';
			// Special case Ranged checks
			if (CONFIG.Tribe8.RANGED_COMBAT_SKILL_REFERENCE.indexOf(lookupName) >= 0)
				lookupName = 'ranged';
			if (combatSkillNames.indexOf(lookupName) < 0) return false;
			return true;
		});

		/**
		 * Reduce that list down to an object that's keyed with the
		 * single-letter skill group as the property key, and the
		 * list of skills as the property value.
		 */
		const combatSkills = skills.reduce((obj, s) => {
			let referenceName = CONFIG.Tribe8.slugify(s.system.name);
			if (CONFIG.Tribe8.RANGED_COMBAT_SKILL_REFERENCE.indexOf(referenceName) >= 0)
				referenceName = 'ranged';
			const refKey = referenceName[0].toUpperCase();
			if (obj[refKey])
				obj[refKey].push(s);
			else
				obj[refKey] = [s];
			return obj;
		}, {});

		// If we had multiple valid skills for the reference key, sort them
		for (let k of Object.keys(combatSkills)) {
			if (combatSkills[k].length > 1) {
				combatSkills[k] = combatSkills[k].sort(Tribe8Item.cmp);
			}
		}
		return combatSkills;
	}
}