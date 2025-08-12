const fields = foundry.data.fields;

export class Tribe8CharacterModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			tribe: new fields.StringField({hint: "Tribe into which the character was born or most directly identifies", blank: true, trim: true}),
			role: new fields.StringField({hint: "Role this character plays in their Cell", blank: true, trim: true}),
			attributes: new fields.SchemaField({
				primary: new fields.SchemaField({
					agi: new fields.SchemaField(Tribe8PrimaryAttribute()),
					app: new fields.SchemaField(Tribe8PrimaryAttribute()),
					bld: new fields.SchemaField(Tribe8PrimaryAttribute()),
					cre: new fields.SchemaField(Tribe8PrimaryAttribute()),
					fit: new fields.SchemaField(Tribe8PrimaryAttribute()),
					inf: new fields.SchemaField(Tribe8PrimaryAttribute()),
					kno: new fields.SchemaField(Tribe8PrimaryAttribute()),
					per: new fields.SchemaField(Tribe8PrimaryAttribute()),
					psy: new fields.SchemaField(Tribe8PrimaryAttribute()),
					wil: new fields.SchemaField(Tribe8PrimaryAttribute())
                }),
                secondary: new fields.SchemaField({
					physical: new fields.SchemaField({
						str: new fields.SchemaField(Tribe8SecondaryAttribute()),
						hea: new fields.SchemaField(Tribe8SecondaryAttribute()),
						sta: new fields.SchemaField(Tribe8SecondaryAttribute()),
						ud: new fields.SchemaField(Tribe8SecondaryAttribute()),
						ad: new fields.SchemaField(Tribe8SecondaryAttribute()),
						thresholds: new fields.SchemaField({
							flesh: new fields.SchemaField(Tribe8SecondaryAttribute()),
							deep: new fields.SchemaField(Tribe8SecondaryAttribute()),
							death: new fields.SchemaField(Tribe8SecondaryAttribute())
						}),
						shock: new fields.SchemaField({
							...Tribe8SecondaryAttribute(),
							current: new fields.NumberField({hint: "The current value of this attribute", initial: 0, required: true})
						})
					})
				})
			}),
			points: new fields.SchemaField({
				cp: new fields.SchemaField({
					attributes: new fields.NumberField({hint: "Number of initial character points that can be spent on attributes", initial: 30, required: true}),
					general: new fields.NumberField({hint: "Number of additional character points that can be spent on character features other than attributes", initial: 50, required: true}),
					attributesSpent: new fields.NumberField({hint: "Number of character points that have been spent on attributes", initial: 0, required: true}),
					generalSpent: new fields.NumberField({hint: "Number of additional character points that have been spent on character features other than attributes", initial: 0, required: true}),
				}),
				xp: new fields.SchemaField({
					total: new fields.NumberField({hint: "Number of total XP accumulated by the character", initial: 0, required: true}),
					spent: new fields.NumberField({hint: "Number of total XP spent by the character", initial: 0, required: true})
				}),
			}),
			edie: new fields.SchemaField({
				total: new fields.NumberField({hint: "Total number of EDie available", initial: 0, required: true}),
				fromXP: new fields.NumberField({hint: "Number of EDie available from unspent XP", initial: 0, required: true}),
				other: new fields.NumberField({hint: "Number of bonus EDie available, beyond unspent XP", initial: 0, required: true})
			})
		};
	}
	
	/**
	 * Migrate data
	 */
	static migrateData(data) {
		foundry.abstract.Document._addDataFieldMigration(source, "system.points.cp.character", "system.points.cp.general");
		return super.migrateData(data);
	}

	/**
	 * Prepare derived data
	 */
	prepareDerivedData(...args) {
		super.prepareDerivedData(...args)
		this.preparePrimaryAttributes();
		this.prepareSecondaryAttributes();
		this.preparePoints();
	}
	
	/**
	 * Compute the value of each attribute, based on its CP and XP
	 */
	preparePrimaryAttributes() {
		for (let a in this.attributes.primary) {
			const attData = this.attributes.primary[a];

			// All atts start at -1
			let attValue = -1;
			
			// Add CP. Negative CP have the same value at the same rate
			// as positive, just negative.
			attValue += (attData.cp < 0 ? -1 : 1)*Math.floor(Math.sqrt(Math.abs(attData.cp)));
			
			// Add XP. Negative XP not a thing.
			attValue += Math.floor(Math.max(attData.xp, 0) / 50);
			
			// Account for weird edge case bonuses
			attValue += attData.bonus ?? 0;
			
			// Set the value
			attData.value = attValue;
		}
	}
	
	/**
	 * Compute the value of each derived/secondary attribute, based on
	 * the primary attributes.
	 * 
	 * TODO: This currently only deals with physical secondaries. TBD
	 * if we end up using the others.
	 */
	prepareSecondaryAttributes() {
		const priAtts = this.attributes.primary;
		const secAtts = this.attributes.secondary.physical;
		const skills = Array.from(this.parent.getEmbeddedCollection("Item")).filter((i) => i.type == "skill");
		
		// We need to do STR, HEA, and STA first
		secAtts.str.value = (
			function(bld, fit) {
				if ((bld + fit) > 0) { 
					return Math.floor((bld + fit) / 2);
				}
				return Math.ceil((bld + fit) / 2);
			})(priAtts.bld.value, priAtts.fit.value);
		secAtts.hea.value = Math.round((priAtts.fit.value + priAtts.psy.value + priAtts.wil.value) / 3);
		secAtts.sta.value = Math.max((5 * (priAtts.bld.value + secAtts.hea.value)) + 25, 10);
		
		// Next, armed/unarmed
		const skillH2H = skills.find((s) => s.name.match(/(Hand\b.*?\bto\b.*?Hand|H\b.*?\b(2|t)\b.*?\bH)/i));
		const skillMelee = skills.find((s) => s.name.match(/Melee/i));
		secAtts.ud.value = Math.max(3 + secAtts.str.value + priAtts.bld.value + (skillH2H?.system?.level ?? 0), 1);
		secAtts.ad.value = Math.max(3 + secAtts.str.value + priAtts.bld.value + (skillMelee?.system?.level ?? 0), 1);
	
		// Next, wound thresholds
		secAtts.thresholds.flesh.value = Math.ceil(secAtts.sta.value / 2);
		secAtts.thresholds.deep.value = secAtts.sta.value;
		secAtts.thresholds.death.value = secAtts.sta.value * 2;
		
		// Finally, system shock
		secAtts.shock.value = Math.max(secAtts.hea.value + 5, 1);
	}

	/**
	 * Compute the total number of CP and XP spent
	 */
	preparePoints() {
		const priAtts = this.attributes.primary;

		// Compute amount spent on Attributes
		this.points.cp.attributesSpent = Object.keys(priAtts).reduce((accumulator, attName) => {
			return accumulator + priAtts[attName].cp;
		}, 0);
		this.points.xp.spent = Object.keys(priAtts).reduce((accumulator, attName) => {
			return accumulator + priAtts[attName].xp;
		}, 0);

		// Compute amount spent on skills
		for (let item of this.parent.getEmbeddedCollection("Item")) {
			switch (item.type) {
				case 'skill':
					// Compute amount spent on Skills
					this.points.cp.generalSpent += item.system.points.level.cp;
					this.points.cp.generalSpent += item.system.points.cpx.cp;
					this.points.xp.spent += item.system.points.level.xp;
					this.points.xp.spent += item.system.points.cpx.xp;
					this.points.xp.spent += item.system.points.edie.fromXP;
					// Compute amount spent on specializations
					if (Object.keys(item.system.specializations).length > 0) {
						for (let specID of Object.keys(item.system.specializations)) {
							const spec = item.system.specializations[specID];
							if (spec.points == 'cp') {
								this.points.cp.generalSpent += 5; // TODO: Make a setting?
							}
							else {
								this.points.xp.spent += 5;
							}
						}
					}
					break;
				case 'perk':
				case 'flaw':
					// Compute amount spent on Perks & Flaws
					if (item.system.granted)
						continue; // No cost applied
					const baseCost = item.system.baseCost;
					const perRankCost = item.system.perRank;
					for (let r = 0; r < item.system.points.length; r++) {
						const rank = item.system.points[r];
						switch (rank) {
							case 'cp':
								if (r == 0)
									this.points.cp.generalSpent += baseCost;
								else
									this.points.cp.generalSpent += perRankCost;
								break;
							case 'xp':
								if (r == 0)
									this.points.xp.spent += baseCost;
								else
									this.points.xp.spent += perRankCost;
								break;
							default:
								break;
						}
					}
					break;
				case 'maneuver':
					// Compute amount spent on Maneuvers
					break;
				case 'aspect':
					// Compute amount spent on Aspects
					break;
				default:
					// Other items, like actual equipment, don't affect points
					break;
			}
		}
		
		// Compute e-dice
		if (this.points.xp.spent < this.points.xp.total)
			this.edie.fromXP = this.points.xp.total - this.points.xp.spent;
		this.edie.total = this.edie.fromXP + this.edie.other;
	}
}

function Tribe8PrimaryAttribute() {
	return {
		label: new fields.StringField({hint: "The short name used to identify this attribute on a character sheet", blank: false, required: true}),
		name: new fields.StringField({hint: "The full name of this attribute", blank: false, required: true}),
		value: new fields.NumberField({hint: "The current calculated value of this attribute", initial: -1, positive: false, required: true}),
		cp: new fields.NumberField({hint: "The number of CP invested in this attribute", initial: 0, positive: false, required: true}),
		xp: new fields.NumberField({hint: "The number of XP invested in this attribute", initial: 0, required: true})
	};	
}

function Tribe8SecondaryAttribute() {
	return {
		label: new fields.StringField({hint: "The short name used to identify this attribute on a character sheet", blank: false, required: true}),
		name: new fields.StringField({hint: "The full name of this attribute", blank: false, required: true}),
		value: new fields.NumberField({hint: "The current calculated value of this attribute", initial: 0, required: true})
	};
}