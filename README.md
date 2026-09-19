# Boty Mineflayer bot

A Mineflayer bot that accepts commands **only from `Atos_GGamer` via `/tell` (or `/msg`)**.

## Setup

1. Install Node.js 18 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and set the server and bot account values.
4. Start the bot:

   ```bash
   npm start
   ```

For an online-mode server, set `MC_AUTH=microsoft`; the first run will show the Microsoft device-login instructions. For an offline/test server, leave it as `offline`.

## Private-message commands

Send these commands from `Atos_GGamer` with `/tell BotName command`:

- `help` — show available commands
- `mine <block> [count]` — mine nearby blocks, for example `mine iron_ore 8` or `mine oak_log 16`
- `craft tools [material]` — craft available pickaxe, axe, shovel, sword, and hoe
- `craft armor [material]` — craft available helmet, chestplate, leggings, and boots
- `craft all [material]` — craft tools and armor
- `stop` — stop the current operation as soon as possible

The bot returns to `Atos_GGamer` after mining and drops newly collected items nearby. Commands from anyone else, public chat, and unsolicited actions are ignored.

Supported materials are `wood`, `stone`, `iron`, `gold`, and `diamond` (the bot only crafts items for which the required ingredients are available).
