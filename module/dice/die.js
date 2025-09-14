const { Die, DiceTerm } = foundry.dice.terms;

export class SilhouetteDie extends Die {
	static DENOMINATION = "sd";
	static DENOMINATION_VARIATIONS = ["sd", "ds", "s"];

	static MODIFIERS = {
		kl: "unskilled",
		u:  "unskilled",
		us: "unskilled"
	};

	static REGEXP = new RegExp(`^([0-9]+)?(?:[sS][dD]|[dD][sS]|[sS](?![dD]))${this.MODIFIERS_REGEXP_STRING}?${this.FLAVOR_REGEXP_STRING}?$`);
	static SERIALIZE_ATTRIBUTES = ["number", "modifiers", "results", "method"];

	/**
	 * Override the base DieTerm constructor, because we *always* have
	 * 6 faces.
	 *
	 * @param  {object}           termData                   Data used to create the Dice Term
	 * @param  {int|Roll}         [termData.number=1]        The number of dice of this term to roll, before modifiers are applied, or a Roll instance that will be evaluated to a number.
	 * @param  {int|Roll}         [termData.faces=6]         Unused; we override this with our default 6-sided face count
	 * @param  {string}           termData.method            The resolution method used to resolve the term.
	 * @param  {string[]}         [termData.modifiers=[]]    Array of modifiers applied to the results
	 * @param  {DiceTermResult[]} [termData.results=[]]      An optional array of pre-cast results for the term
	 * @param  {object}           [termData.options={}]      Additional options that modify the term
	 * @return {void}
	 * @access public
	 */
	constructor({number=1, faces=6, method, modifiers=[], results=[], options={}}) {
		// Override, we always have 6 faces
		faces = 6;

		// It's possible we get invoked with modifiers in the wrong format
		if (typeof modifiers == 'string') modifiers = SilhouetteDie.modifiersFromString(modifiers);

		// If we were asked to roll "0", this signifies we want to roll 2sdus
		if (number == 0) {
			number = 2;
			if (!modifiers.includes('us') && !modifiers.includes('u') && !modifiers.includes('kl'))
				modifiers.push('us');
		}
		super({number, faces, method, modifiers, results, options});
	}

	/**
	 * Get the total for the roll. This is the value of the maximum (or
	 * minimum, in the case of unskiled rolls) die in the pool, +1 for
	 * each additional six beyond the first if there are multiple sixes.
	 *
	 * @return {int|undefined} The total for this SilhouetteDie term
	 * @access public
	 */
	get total() {
		if (!this._evaluated) return undefined;
		let total = this.results.reduce((t, r) => {
			if (!r.active) return t;
			return (r.result > t ? r.result : t);
		}, 0);
		// If we hit a 6, were there other dice that did so, giving us
		// a bonus?
		if (total == 6) {
			total += this.results.reduce((t, r) => {
				return r.result === 6 ? t+1 : t;
			}, 0) - 1; // Account for the first six
		}
		// A fumble of any sort always counts as a 1
		if (this.fumble) {
			return 1;
		}
		return total;
	}

	/**
	 * Get the denomination for this die type.
	 *
	 * @return {string} The canonical denomination for SilhouetteDie
	 * @access public
	 */
	get denomination() {
		return this.constructor.DENOMINATION;
	}

	/**
	 * Return the formulaic expression of this roll
	 *
	 * @return {string} The string expression that represents this SilhouetteDie
	 * @access public
	 */
	get expression() {
		// Special case for unskilled rolls
		const unskilledModifiers = ['us', 'u', 'kl'];
		if (this._number == 2 && this.isUnskilled) {
			const displayModifiers = [...this.modifiers];
			const hideIndices = displayModifiers.map((m, i) => unskilledModifiers.includes(m) ? i : null).filter(i => i === 0 || i);
			for (let i of hideIndices) {
				displayModifiers.splice(i, 1);
			}
			return `0sd${displayModifiers.join("")}`;
		}
		return `${this._number}sd${this.modifiers.join("")}`;
	}

	/**
	 * Return whether or not the roll was performed unskilled
	 *
	 * @return {bool} Whether or not the roll was performed unskilled
	 * @access public
	 */
	get isUnskilled() {
		const unskilledModifiers = ['us', 'u', 'kl'];
		return this.modifiers.some(m => unskilledModifiers.includes(m));
	}

	/**
	 * Return the fumble state of this roll
	 *
	 * @return {bool} Whether or not the roll was fumbled
	 * @access public
	 */
	get fumble() {
		if (!this._evaluated) return undefined;
		if (this.results.every(r => r.result == 1)) return true;
		if (this.isUnskilled && this.results.some(r => r.result == 1)) return true;
		return false;
	}

	/**
	 * Roll two dice and keep the lower of them. If both are sixes, then
	 * the second six adds a +1 bonus, as normal
	 *
	 * @param  {string}    modifier    The matched modifier query
	 * @return {void|bool}             Returns false if the modifier doesn't match, otherwise void
	 * @access public
	 */
	unskilled(modifier) {
		const rgx = /(kl|us?)/i;
		const match = modifier.match(rgx);
		if (!match) return false;
		DiceTerm._keepOrDrop(this.results, 1, {keep: true, highest: false});
	}

	/**
	 * Render the tooltip HTML for a Roll instance
	 *
	 * @return {object} The data object used to render the default tooltip template for this DiceTerm
	 * @access public
	 */
	getTooltipData() {
		const data = super.getTooltipData();

		// We need to modify "rolls" to account for situations where
		// the number of dice we rolls mismatches the number we "should"
		// have (i.e. when a manual result is used to override, as for
		// initiative)
		if (data.rolls.length < this.number) {
			for (let r = data.rolls.length; r < this.number; r++) {
				data.rolls.push({result: "?", classes: "unused-die"})
			}
		}
		return data;
	}

	/**
	 * Parse a given formula string into constituent components. We need
	 * this because Peggy doesn't understand our two-character
	 * denomination.
	 *
	 * @param  {string} formula    The formula for the term
	 * @return {object}            The parsed properties for the term
	 * @access public
	 */
	static parse(formula) {
		const matches = formula.match(this.REGEXP);
		if (!matches) return {};
		return {number: matches[1], modifiers: matches[2], flavor: matches[3]};
	}

	/**
	 * Convert a modifier string into an array
	 *
	 * @param  {string}        modifierString    A string representation of the rolls given to this Die
	 * @return {Array<string>}                   The parsed array version of the given string
	 * @access public
	 */
	static modifiersFromString(modifierString) {
		return Array.from((modifierString || "").matchAll(this.MODIFIER_REGEXP)).map(m => m[0]);
	}
}