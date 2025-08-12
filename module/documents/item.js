export class Tribe8Item extends Item {
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
}