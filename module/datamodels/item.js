const fields = foundry.data.fields;

export class Tribe8ItemModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			description: new fields.StringField({hint: "Description of the Item", initial: "", blank: true, nullable: false, required: true})
		};
	}

	static migrateData(data) {
		if (data.points && data.points.constructor.name == 'String')
			data.points = data.points.toUpperCase();
		return super.migrateData(data);
	}
}