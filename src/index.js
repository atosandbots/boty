const mineflayer = require('mineflayer')
const minecraftData = require('minecraft-data')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const toolPlugin = require('mineflayer-tool').plugin
require('dotenv').config()

const OWNER = 'Atos_GGamer'
const bot = mineflayer.createBot({
  host: process.env.MC_HOST || 'localhost',
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.MC_USERNAME || 'Boty',
  auth: process.env.MC_AUTH || 'offline',
  version: process.env.MC_VERSION || false
})

bot.loadPlugin(pathfinder)
bot.loadPlugin(toolPlugin)

let mcData
let movements
let busy = false
let stopRequested = false

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const say = text => bot.whisper(OWNER, String(text).slice(0, 240))

bot.once('spawn', () => {
  mcData = minecraftData(bot.version)
  movements = new Movements(bot, mcData)
  movements.canDig = true
  bot.pathfinder.setMovements(movements)
  console.log(`Logged in as ${bot.username} on ${bot.version}`)
})

bot.on('chat', (username) => {
  // Deliberately do not parse public chat. Commands must arrive as whispers.
  if (username !== bot.username) console.log(`${username} spoke publicly; ignored`)
})

bot.on('whisper', (username, message) => {
  if (username !== OWNER) return
  handleCommand(String(message).trim()).catch(error => {
    console.error(error)
    say(`Error: ${error.message}`)
    busy = false
  })
})

async function handleCommand(input) {
  if (!input) return say('Use: help')
  const parts = input.toLowerCase().split(/\s+/)
  const command = parts.shift()

  if (command === 'help') {
    return say('mine <block> [count] | craft tools [material] | craft armor [material] | craft all [material] | stop')
  }
  if (command === 'stop') {
    stopRequested = true
    bot.pathfinder.setGoal(null)
    return say('Stopping after the current action.')
  }
  if (busy) return say('I am already working. Send stop first.')

  busy = true
  stopRequested = false
  try {
    if (command === 'mine') await mine(parts[0], parts[1])
    else if (command === 'craft') await craft(parts[0] || 'all', parts[1])
    else say('Unknown command. Send help for the command list.')
  } catch (error) {
    say(`Could not finish: ${error.message}`)
  } finally {
    busy = false
    stopRequested = false
  }
}

async function goNear(position, distance = 2) {
  if (!position) throw new Error('I cannot find that location.')
  bot.pathfinder.setGoal(new goals.GoalNear(position.x, position.y, position.z, distance))
  while (bot.pathfinder.isMoving()) {
    if (stopRequested) throw new Error('Stopped.')
    await sleep(100)
  }
}

function inventorySnapshot() {
  const counts = new Map()
  for (const item of bot.inventory.items()) counts.set(item.type, (counts.get(item.type) || 0) + item.count)
  return counts
}

async function mine(blockName, requestedCount = '1') {
  if (!blockName || !mcData.blocksByName[blockName]) throw new Error('Unknown block name.')
  const count = Math.max(1, Math.min(64, Number.parseInt(requestedCount, 10) || 1))
  const blockId = mcData.blocksByName[blockName].id
  const before = inventorySnapshot()
  let mined = 0
  say(`Mining ${count} ${blockName} block(s).`)

  while (mined < count && !stopRequested) {
    const blocks = bot.findBlocks({ matching: blockId, maxDistance: 32, count: count - mined })
    if (!blocks.length) break
    blocks.sort((a, b) => bot.entity.position.distanceTo(a) - bot.entity.position.distanceTo(b))
    const block = bot.blockAt(blocks[0])
    if (!block) continue
    await goNear(block.position, 3)
    const current = bot.blockAt(block.position)
    if (!current || current.type !== blockId) continue
    await bot.tool.equipForBlock(current, 'hand')
    await bot.dig(current)
    mined++
  }

  if (!mined) return say(`I could not find ${blockName} nearby.`)
  await returnAndDrop(before)
  say(`Mined ${mined}/${count} ${blockName} block(s).`)
}

async function returnAndDrop(before) {
  const owner = bot.players[OWNER]
  if (!owner || !owner.entity) return
  await goNear(owner.entity.position, 3)
  for (const item of bot.inventory.items()) {
    const oldCount = before.get(item.type) || 0
    const newCount = item.count - oldCount
    if (newCount > 0 && !/_(pickaxe|axe|shovel|sword|hoe|helmet|chestplate|leggings|boots)$/.test(item.name)) {
      await bot.toss(item.type, null, newCount)
    }
  }
}

const materialOrder = ['diamond', 'iron', 'stone', 'gold', 'wood']
const materialNames = { wood: 'wooden', oak: 'wooden', stone: 'stone', iron: 'iron', gold: 'golden', diamond: 'diamond' }
const toolKinds = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']
const armorKinds = ['helmet', 'chestplate', 'leggings', 'boots']

function chooseMaterial(requested, kind) {
  const names = requested ? [materialNames[requested] || requested] : materialOrder.map(m => materialNames[m])
  return names.find(material => mcData.itemsByName[`${material}_${kind}`])
}

async function craft(type, requestedMaterial) {
  const groups = type === 'tools' ? [toolKinds] : type === 'armor' ? [armorKinds] : type === 'all' ? [toolKinds, armorKinds] : null
  if (!groups) throw new Error('Use tools, armor, or all.')
  for (const group of groups) {
    for (const kind of group) {
      if (stopRequested) throw new Error('Stopped.')
      const material = chooseMaterial(requestedMaterial, kind)
      if (!material) continue
      const itemName = `${material}_${kind}`
      const item = mcData.itemsByName[itemName]
      const made = await craftOne(item.id, itemName)
      if (made) say(`Crafted ${itemName}.`)
    }
  }
}

async function craftOne(itemId, itemName) {
  let table = bot.findBlock({ matching: mcData.blocksByName.crafting_table && mcData.blocksByName.crafting_table.id, maxDistance: 16 })
  const recipes = bot.recipesFor(itemId, null, 1, table)
  if (!recipes.length) return false
  await bot.craft(recipes[0], 1, table)
  return true
}

bot.on('error', error => console.error('Mineflayer error:', error))
bot.on('kicked', reason => console.error('Kicked:', reason))
bot.on('end', () => console.log('Disconnected.'))
