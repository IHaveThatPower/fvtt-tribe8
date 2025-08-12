const fields = foundry.data.fields;

export class Tribe8ItemModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			description: new fields.StringField({hint: "Description of the Item", initial: "", blank: true, nullable: false, required: true})
		};
	}

	/**
	 * Handle proper Skill and Perk/Flaw naming, accounting for special
	 * sub-identifiers
	 * 
	 * @returns	Object{name, system{name, specific}}
	 */
	static canonizeName(name = '', sysName = '', specific = '', specify = false) {
		const canonName = {name: '', system: { name: '', specific: ''}};
		if ((!sysName || sysName.length == 0) && (name && name.length > 0)) {
			canonName.system.name = name.split('(')[0].trim();
		}
		else if (sysName && sysName.trim().length > 0) {
			canonName.system.name = sysName;
		}
		else {
			throw new Error("Cannot determine system base name for skill");
		}
		if (specify) {
			if (!specific || specific.length == 0) {
				canonName.system.specific = name.split('(')[1];
				// If we found something...
				if (canonName.system.specific) {
					canonName.system.specific.replace(/\)([^\)]*)$/, '$1').trim();
				}
				else {
					canonName.system.specific = 'Unspecified';
				}
			}
			else {
				canonName.system.specific = specific;
			}
			
			// Compose the name from the now-defined parts
			canonName.name = `${canonName.system.name} (${canonName.system.specific})`;
		}
		else {
			canonName.name = `${canonName.system.name}`;
		}
		if (!canonName.name || canonName.length == 0)
			throw new Error("Should never generate a name of no value");
		return canonName;
	}
}