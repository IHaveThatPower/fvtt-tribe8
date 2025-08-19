const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * This class mixin provides a common set of base behaviors to any
 * application that uses the HandlebarsApplicationMixin (namely,
 * ActorSheetV2 and ItemSheetV2, as well as the ApplicationV2 base).
 *
 * This is mainly for utility behaviors, like setting up common
 * listeners or recording data about sheets.
 *
 * @param  {Constructor<ApplicationV2>} BaseApplication    The constructor reference to an ApplicationV2 or child class
 * @return {Tribe8Application}                             The resulting mixin class
 */
export function Tribe8Application(BaseApplication) {
	class Tribe8Application extends HandlebarsApplicationMixin(BaseApplication) {
		static MIN_WIDTH = 32;
		static MIN_HEIGHT = 32;
		static MIN_TOP = 0;
		static MIN_LEFT = 0;

		/**
		 * Directly inherit from parent
		 *
		 * @class
		 * @param {...*} args    Typical arguments supplied to the ApplicationV2 constructor
		 */
		constructor(...args) {
		  super(...args);
		}

		/**
		 * Handle any special _onRender events.
		 *
		 * @param {object} context    The rendering context
		 * @param {object} options    Supplemental rendering options
		 * @access protected
		 */
		async _onRender(context, options) {
			// When rendering, always re-render the title
			if (this.window.title.textContent != this.title) {
				this._updateFrame({window: { title: this.title }});
			}

			// Setup input resizers
			const inputSizers = this.element.querySelectorAll('span.input-sizer input');
			inputSizers.forEach((s) => {
				s.addEventListener('input', (e) => {
					if (e.target?.parentNode?.dataset)
						e.target.parentNode.dataset.value = e.target.value;
				});
			});

			// Track position when mouseup fires while over this window
			this.element.addEventListener('mouseup', () => {
				this._storePosition();
			});

			await super._onRender(context, options);
		}

		/**
		 * If the user has stored position preferences for this type of
		 * sheet, override the defaults with them. However, we only
		 * want to do this when they first open the sheet, not every
		 * time it re-renders!
		 *
		 * This is called by _onRender() (via several layers of parent)
		 *
		 * @param {object} context    The rendering context
		 * @param {object} options    Supplemental rendering options
		 * @access protected
		 */
		async _onFirstRender(context, options) {
			const {width, height, top, left} = game.user.getFlag("tribe8", `appDimensions.${this.windowKey}`) ?? {};
			if (!options.position) options.position = {};
			if (width) options.position.width = Math.min(Math.max(width, this.constructor.MIN_WIDTH), window.innerWidth);
			if (height) options.position.height = Math.min(Math.max(height, this.constructor.MIN_HEIGHT), window.innerHeight);
			if (left) options.position.left = Math.min(Math.max(left, this.constructor.MIN_LEFT), window.innerWidth - this.constructor.MIN_WIDTH);
			if (top) options.position.top = Math.min(Math.max(top, this.constructor.MIN_TOP), window.innerHeight - this.constructor.MIN_HEIGHT);
			await super._onFirstRender(context, options);
		}

		/**
		 * Record the sheet's window position for the user just before
		 * it closes.
		 *
		 * @param {object} options    Options pertinent to what happens when this sheet closes
		 * @access protected
		 */
		async _preClose(options) {
			await super._preClose(options);
			await this._storePosition();
		}

		/**
		 * Record the sheet's window position for the user.
		 *
		 * @access protected
		 */
		async _storePosition() {
			// Are we minimized? Don't store that.
			if (this.minimized) return;
			const { width, height, top, left } = this.position;
			if (this.windowKey.length)
				await game.user.setFlag("tribe8", `appDimensions.${this.windowKey}`, {width, height, top, left});
		}

		/**
		 * Utility for generating a key for the current window
		 *
		 * @return {string} A consistent key used to identify the type of sheet this is
		 * @access public
		 */
		get windowKey() {
			let key = `${this.id.split('-').shift()}`;
			if (this.document?.limited)
				key = `${key}:limited`;
			return key;
		}
	}
	return Tribe8Application;
}