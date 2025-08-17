const fields = foundry.data.fields;

export class Tribe8ItemModel extends foundry.abstract.TypeDataModel {
	/**
	 * Defines the schema common to all Items.
	 *
	 * @return {object} The schema definition for a base Item
	 * @access public
	 */
	static defineSchema() {
		return {
			description: new fields.StringField({hint: "Description of the Item", initial: "", blank: true, nullable: false, required: true})
		};
	}

	/**
	 * If the Item has a points property that contains a string, ensure
	 * that string is uppercase (i.e. "CP", not "cp")
	 *
	 * @param  {object} data    The incoming migration data
	 * @return {object}         The transformed data
	 * @access public
	 */
	static migrateData(data) {
		if (data.points && data.points.constructor.name == 'String')
			data.points = data.points.toUpperCase();
		return super.migrateData(data);
	}
}