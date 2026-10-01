# Weapon choices and run growth

Ranged weapons are available at the live Engine Armory from the start. A player no longer needs to spend 30 Scrap on Knife and Axe before purchasing a 12-Scrap Handgun. Six full-reward Boarders or four Saboteurs fund a first gun. Scrap stays separate from cargo money and Bank.

The Armory supports direct choices. Buying equips the weapon and keeps every prior purchase for free re-equipping at the Armory. Movement, cargo carrying, death, pause and a closed Armory still prevent purchases or switches. Enemy pressure continues while using the Armory. Ordinary death and continuing to another round retain inventory; cashout or run failure reset run equipment.

| Weapon | Scrap | Play behavior |
| --- | ---: | --- |
| Wrench | 0 | Balanced swing; armored Bruisers resist its damage. |
| Knife | 10 | Short, fast swings with rapid recovery. |
| Axe | 20 | Slow wide swing, strong knockback, interrupts armored windup. |
| Handgun | 12 | Steady single-target ranged shots. |
| SMG | 24 | Rapid single-target suppression. |
| Piercing Rifle | 40 | Up to three enemies per shot, ordered nearest first; damage 80, 64, 51.2. Slow recovery. |
| Shotgun | 14 | Five individually simulated pellets, 16 damage each at close range. Short 8m range; damage falls from 4m to 30% at maximum range. Can finish one light target then spill remaining pellets into a close group. |

Shotgun pellets form visible trajectories; combat remains on the game's existing horizontal combat lane. Other-layer, boarding and layer-transition enemies retain immunity. Each rifle projectile tracks target IDs so knockback cannot cause repeated hits. Projectiles preserve their firing weapon, facing and stats when the player moves or switches guns.

## APIs

`game.weaponChoices(slot)` returns choices for `melee` or `ranged`, including `id`, `name`, `role`, `description`, `tier`, `cost`, `owned`, `selected` and `locked`. All choices are immediately unlocked; affordability remains enforced.

`game.buyWeapon(slot, id)` purchases and equips a choice, or equips it without charging when already owned. Omitting `id` preserves the old integration by selecting the first unowned weapon. `game.equipWeapon(slot, id)` only equips owned weapons. Both return a success boolean and require a valid live Armory interaction.

`game.weaponInventory` returns copies of owned ID arrays. `game.combatProgress` returns kills, Scrap, owned count, equipped names and next offers with remaining Scrap. `meleeTier` and `rangedTier` remain active equipment indices for existing presentation code; they are not ownership counts. Inventory initializes lazily and synchronizes equipped starting-kit weapons after pre-run HUD rendering.

## Verification

`node --test tests/weapon_choices.test.mjs tests/projectile_launch.test.mjs tests/contracts.test.mjs tests/audio.test.mjs` passed 51 tests when implemented. `npm run build` and `node --test tests/weapon_models.test.mjs` passed, including all four ranged muzzle transforms in both facings. `npm test` now builds first so model tests exercise current production artifacts.

These are diagnostic simulation and model tests. Fixtures create controlled enemies and equipment; they do not constitute normal browser play, a blind human playtest, mobile gesture verification or subjective sound-quality acceptance. Normal-entry candidate play and independent QA remain part of the parent task.
