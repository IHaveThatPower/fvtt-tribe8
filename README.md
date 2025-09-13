# Unofficial _Tribe 8 2nd Edition_ (Silhouette CORE) System for Foundry VTT

_System written by **IHaveThatPower**_

This is a fan-created sytem for running games of Dream Pod 9's *Tribe 8 2nd Edition* (*T8.2e*), based on their Silhouette CORE system, in [Foundry VTT](https://foundryvtt.com).

It is written lean, with primary focus on informative, easy-to-use-in-play character sheets over automating gameplay itself.

## Installation

For now, just clone this repository to your Foundry `Data/systems` folder, with the folder name `tribe8`.

In the future, I may look at trying to get it registered with Foundry properly, but that's still a long way off.

### Font Installation

This system uses the font **Chainprinter Regular**, which is a close (identical?) match for the one used in the *T8.2e* handbook for headers. For licensing reasons, I do not include it in the repository. The system should work fine without it, but if you'd like to add that extra visual spice, read on.

1. Download the font from [FontsGeek](https://fontsgeek.com/fonts/Chainprinter-Regular) (with whom I am in no way affiliated, other than as an appreciative user).
2. Place the `.ttf` file in the `Data/systems/tribe8/assets` folder. This folder will not yet exist (unless I forgot to update this README after adding more stuff to it), so you will need to create it first.

#### Additional Steps

The following additional stays _may_ be necessary, or you may be entirely fine without them.

* Make sure the `.ttf` file can be _read and executed_ by users other than you (Linux users, that's `u=rwx,g=rx,o=rx`, or `0755`).
* If your Foundry server is not already using SSL (i.e. your players are connecting with `http://` instead of `https://`), follow [the official Foundry guide](https://foundryvtt.com/article/ssl/) on creating a basic self-signed certificate and configuring Foundry to use it.

## Setup

Right now, there's not really much to setup. That will probably change in the future.

All characters are created with 30 attribute points and 50 additional character points, the default for *T8.2e*. In the future, that will be configurable per world, as well as adjustable (by the GM) per character.

At present, no stock Items (i.e. Skills, Perks, Flaws, Combat Maneuvers, Aspects, Weapons, etc.) are included. I plan to make packs for those in the future.

## Roadmap (Todo List)

This is a rough, ever-changing list that depicts in approximate priority order what's on the list of yet-to-be-implemented features.

### Short Term
- Character artwork editing support
- Item artwork editing support
- Player-side initiative editing / manual roll input support
- Equipment tab
  - User-driven sorting
- Finalize character sheet layout
- Deal with various TODO items

### Longer Term
- Fully localize!
- Convert flat config values to system settings
  - e.g. Make starting CP a system setting for the GM
- Allow GMs to edit a character's initial CP
- Some way to trade attribute points (i.e. PSY for other attributes)
- Sundering?
- Technosmithig?
- Item Compendium packs
- Vehicle system...?
