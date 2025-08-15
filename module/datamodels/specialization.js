const fields = foundry.data.fields;

export class Tribe8SpecializationModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			granted: new fields.BooleanField({hint: "Whether or not this Specialization was granted for free by the Weaver", initial: false, required: true, nullable: false}),
			points: new fields.StringField({hint: "The type of points used to pay for the Specialization.", choices: ["CP", "XP"], initial: "CP", required: true, nullable: false}),
			skill: new fields.ForeignDocumentField(
				CONFIG.Item.documentClass,
				{
					hint: "The Skill to which this Specialization belongs",
					required: true,
					blank: false,
					nullable: false,
					idOnly: true
				}
			)
		}
	}
}