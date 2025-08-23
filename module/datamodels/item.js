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

	/**
	 * Return the configured "intrinsic" cost of this Item, in CP or XP.
	 * For some Items (e.g. Skills), this is no intrinsic value.
	 *
	 * @return {int} The intrinsic cost of this Item
	 * @access private
	 */
	get intrinsicCost() {
		const costs = CONFIG.Tribe8.costs;
		if (costs[this.parent?.type])
			return costs[this.parent.type];
		console.warn(`No intrinsic cost configured for Item type '${this.parent.type}'.`);
		return 0;
	}

	/**
	 * Determine the total amount of CP spent on this Item. Child
	 * methods override this with their own logic, as needed.
	 *
	 * @return {int} The total CP spent on the Item
	 * @access public
	 */
	get totalCP() {
		if (!this.points) return 0;
		if (this.points !== "CP") return 0;
		return this.intrinsicCost;
	}

	/**
	 * Determine the total amount of XP spent on this Item. Child
	 * methods override this with their own logic, as needed.
	 *
	 * @return {int} The total XP spent on the Item
	 * @access public
	 */
	get totalXP() {
		if (!this.points) return 0;
		if (this.points !== "XP") return 0;
		return this.intrinsicCost;
	}
}