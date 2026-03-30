const fs = require("fs-extra");
const path = require("path");

let fonts;
try {
  fonts = require("../../func/font.js");
} catch (error) {}

const CONFIG = {
  PET_LIMIT: 7,
  BASE_BUNDLE_PRICE: 3000,
  QUEST: {
    COOLDOWN: 60 * 60 * 1000,
    REWARD_MULTIPLIER: 0.1,
    BASE_BONUS: 50,
    STREAK_INCREMENT: 10,
    MAX_STREAK: 10,
    DAILY_QUEST_LIMIT: 3,
    STREAK_RESET_THRESHOLD: 24 * 60 * 60 * 1000
  },
  PET_TYPES: ["dog", "cat", "deer", "tiger", "snake", "dragon", "unicorn", "griffin", "phoenix"],
  DEFAULT_PETS: [
    { key: "dog", name: "Dog", icon: "🐕", baseAtk: 30, baseDef: 25, baseMagic: 10, baseHp: 100, sellPrice: 250, petType: "dog" },
    { key: "cat", name: "Cat", icon: "🐱", baseAtk: 25, baseDef: 20, baseMagic: 20, baseHp: 90, sellPrice: 200, petType: "cat" },
    { key: "deer", name: "Deer", icon: "🦌", baseAtk: 20, baseDef: 30, baseMagic: 15, baseHp: 110, sellPrice: 350, petType: "deer" },
    { key: "tiger", name: "Tiger", icon: "🐅", baseAtk: 45, baseDef: 30, baseMagic: 10, baseHp: 130, sellPrice: 750, petType: "tiger" },
    { key: "snake", name: "Snake", icon: "🐍", baseAtk: 35, baseDef: 20, baseMagic: 25, baseHp: 80, sellPrice: 500, petType: "snake" },
    { key: "dragon", name: "Dragon", icon: "🐉", baseAtk: 60, baseDef: 40, baseMagic: 40, baseHp: 180, sellPrice: 2500, petType: "dragon" }
  ],
  FOODS: [
    { key: "dogTreats", name: "Dog Treats", icon: "🍖", type: "dog_food", saturation: 1 * 60 * 1000, price: 10, sellPrice: 5 },
    { key: "catFish", name: "Fishy Feast", icon: "🐟", type: "cat_food", saturation: 1.5 * 60 * 1000, price: 15, sellPrice: 7 },
    { key: "deerGreens", name: "Herbivore Delight", icon: "🌿", type: "deer_food", saturation: 10 * 60 * 1000, price: 100, sellPrice: 50 },
    { key: "tigerMeat", name: "Tiger Tenders", icon: "🍖", type: "tiger_food", saturation: 13 * 60 * 1000, price: 130, sellPrice: 65 },
    { key: "snakeEgg", name: "Slither and Savor", icon: "🥚", type: "snake_food", saturation: 2.5 * 60 * 1000, price: 25, sellPrice: 12 },
    { key: "dragonGem", name: "Gemstone Gourmet", icon: "💎", type: "dragon_food", saturation: 24 * 60 * 1000, price: 240, sellPrice: 120 }
  ],
  COUNTRY_ITEMS: [
    { key: "france_pack", name: "French Elegance", icon: "🇫🇷", desc: "Donne un bonus de charme à votre pet", price: 5000, effect: { charm: 5 } },
    { key: "japan_pack", name: "Japanese Spirit", icon: "🇯🇵", desc: "Augmente la vitesse d'expérience", price: 8000, effect: { expBonus: 0.1 } },
    { key: "usa_pack", name: "American Power", icon: "🇺🇸", desc: "Boost d'attaque permanent", price: 10000, effect: { atkBonus: 10 } },
    { key: "brazil_pack", name: "Brazilian Rhythm", icon: "🇧🇷", desc: "Réduction de la fatigue des quêtes", price: 7000, effect: { questCooldownReduction: 0.2 } },
    { key: "egypt_pack", name: "Pharaoh's Blessing", icon: "🇪🇬", desc: "Récupération de vie plus rapide", price: 12000, effect: { hpRegen: 2 } },
    { key: "australia_pack", name: "Outback Survival", icon: "🇦🇺", desc: "Résistance à la faim", price: 6000, effect: { hungerResist: 0.3 } },
    { key: "germany_pack", name: "German Engineering", icon: "🇩🇪", desc: "Augmente la défense", price: 9000, effect: { defBonus: 10 } },
    { key: "india_pack", name: "Indian Mystic", icon: "🇮🇳", desc: "Boost magique", price: 11000, effect: { magicBonus: 10 } },
    { key: "canada_pack", name: "Canadian Politeness", icon: "🇨🇦", desc: "Réduction du prix des soins", price: 4000, effect: { healDiscount: 0.15 } },
    { key: "uk_pack", name: "Royal Heritage", icon: "🇬🇧", desc: "Double chance de butin", price: 15000, effect: { lootBonus: 0.5 } }
  ]
};

function formatMoney(amount) {
  if (isNaN(amount)) return "0";
  const absAmount = Math.abs(amount);
  if (absAmount >= 1e6) return (amount / 1e6).toFixed(1) + "M";
  if (absAmount >= 1e3) return (amount / 1e3).toFixed(1) + "k";
  return amount.toString();
}

function calcNextExp(level) {
  if (level < 2) return 10;
  return 10 * Math.pow(2, level - 1);
}

function updatePetLevel(pet) {
  const lastExp = pet.lastExp || 0;
  let level = 1;
  let required = 10;
  while (lastExp >= required) {
    level++;
    required = 10 * Math.pow(2, level - 1);
  }
  pet.level = level;
  return pet;
}

function calculatePetWorth(pet, inflationRate = 0) {
  const base = (pet.sellPrice || 500) * 2 + (pet.lastExp || 0) * 9 * Math.pow(2, (pet.level || 1) - 1);
  return Math.floor(base * (1 + inflationRate));
}

function isPetHungry(pet) {
  const now = Date.now();
  const lastFeed = pet.lastFeed || now;
  const lastSaturation = pet.lastSaturation || 0;
  return (now - lastFeed) > lastSaturation;
}

function petHungerRemaining(pet) {
  const now = Date.now();
  const lastFeed = pet.lastFeed || now;
  const lastSaturation = pet.lastSaturation || 0;
  const remaining = lastSaturation - (now - lastFeed);
  return remaining;
}

function feedPet(pet, food) {
  const now = Date.now();
  pet.lastFeed = now;
  pet.lastSaturation = food.saturation;
  pet.lastFoodEaten = food.key;
  const expGain = Math.floor(food.saturation / 60000);
  pet.lastExp = (pet.lastExp || 0) + expGain;
  updatePetLevel(pet);
  return expGain;
}

function generatePetKey(petType, name) {
  return `${petType}_${name}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function findQuestEligiblePets(pets) {
  const todayStart = new Date().setUTCHours(0, 0, 0, 0);
  return pets.filter(pet => {
    if (pet.lastQuestDay !== todayStart) return true;
    return (pet.questCount || 0) < CONFIG.QUEST.DAILY_QUEST_LIMIT;
  });
}

function formatDuration(ms) {
  if (ms <= 0) return "maintenant";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

module.exports = {
  config: {
    name: "pet",
    aliases: ["p", "petn"],
    version: "1.0.0",
    author: "Christus",
    countDown: 3,
    role: 0,
    description: "🐕 Gestion complète de vos animaux de compagnie",
    category: "game",
    guide: {
      fr: "{pn} – Afficher l'aide\nSous-commandes :\n• {pn} list – Lister vos pets\n• {pn} shop – Boutique (bundles, nourriture, pays)\n• {pn} uncage – Libérer un pet\n• {pn} feed nom – Nourrir\n• {pn} quest nom – Quête\n• {pn} sell nom – Vendre (niv.5+)\n• {pn} rename nom – Renommer (Dog Tag)\n• {pn} gear nom – Statistiques\n• {pn} top – Classement"
    }
  },

  onStart: async function ({ message, event, args, usersData, api, commandName }) {
    const { senderID } = event;
    const subCmd = (args[0] || "").toLowerCase();
    let userData = await usersData.get(senderID);
    if (!userData.pets) userData.pets = [];
    if (!userData.inventory) userData.inventory = [];
    if (!userData.petSells) userData.petSells = 0;
    if (!userData.lastDaily) userData.lastDaily = 0;
    if (!userData.petBonuses) userData.petBonuses = {};

    async function saveUser(newData) {
      await usersData.set(senderID, { ...userData, ...newData });
    }

    if (!subCmd || subCmd === "help") {
      const helpMsg = `
🐕 Commandes Pet
━━━━━━━━━━━━━━━━━

📋 ${commandName} list – Voir vos pets
🛒 ${commandName} shop – Boutique
📦 ${commandName} uncage – Libérer un pet
🍖 ${commandName} feed <nom> – Nourrir
⚔️ ${commandName} quest <nom> – Quête
💰 ${commandName} sell <nom> – Vendre
🏷️ ${commandName} rename <nom> – Renommer
🔧 ${commandName} gear <nom> – Équipement
🏆 ${commandName} top – Classement

💡 Utilisez ${commandName} help pour revoir cette aide.
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(helpMsg) : helpMsg);
    }

    if (subCmd === "list" || subCmd === "l") {
      const pets = userData.pets || [];
      if (pets.length === 0) {
        const msg = "🐾 Vous n'avez aucun pet. Achetez un bundle dans la boutique et utilisez uncage.";
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
      let text = `🐕 ${userData.name || "Vous"} possède ${pets.length}/${CONFIG.PET_LIMIT} pets :\n\n`;
      for (let i = 0; i < pets.length; i++) {
        const pet = pets[i];
        const hungry = isPetHungry(pet);
        const hungerRem = petHungerRemaining(pet);
        text += `${pet.icon} ${pet.name} (${pet.petType})\n`;
        text += `   Niv.${pet.level} | ❤️ ${pet.HP}/${pet.maxHP} | Exp: ${pet.lastExp || 0}/${calcNextExp(pet.level)}\n`;
        text += `   🍽️ ${hungry ? "Affamé !" : `Rassasié pour ${formatDuration(hungerRem)}`}\n`;
        if (i < pets.length - 1) text += `\n`;
      }
      text += `\n💡 Utilisez ${commandName} feed <nom> pour nourrir.`;
      return message.reply(fonts?.bold ? fonts.bold(text) : text);
    }

    if (subCmd === "shop" || subCmd === "store") {
      const shopItems = [
        { icon: "🐾", name: "Pet Bundle (Basic)", key: "petBundle", price: CONFIG.BASE_BUNDLE_PRICE, desc: "Contient un pet aléatoire", type: "bundle" },
        ...CONFIG.FOODS.map(f => ({ icon: f.icon, name: f.name, key: f.key, price: f.price, desc: `Nourriture pour ${f.type.replace('_food', '')}`, type: "food" })),
        ...CONFIG.COUNTRY_ITEMS.map(c => ({ icon: c.icon, name: c.name, key: c.key, price: c.price, desc: c.desc, type: "country", effect: c.effect }))
      ];
      let shopText = `🛒 Boutique des pets\n━━━━━━━━━━━━━━━━━━\n`;
      shopItems.forEach((item, idx) => {
        shopText += `${idx+1}. ${item.icon} ${item.name} – ${formatMoney(item.price)} coins\n   ${item.desc}\n`;
      });
      shopText += `\n💬 Répondez avec le numéro de l'article pour l'acheter.`;
      const replyMsg = await message.reply(fonts?.bold ? fonts.bold(shopText) : shopText);
      
      global.GoatBot.onReply.set(replyMsg.messageID, {
        commandName: this.config.name,
        author: senderID,
        callback: async ({ message: replyMessage, event: replyEvent }) => {
          const choice = parseInt(replyEvent.body);
          if (isNaN(choice) || choice < 1 || choice > shopItems.length) {
            return replyMessage.reply("❌ Numéro invalide.");
          }
          const selected = shopItems[choice-1];
          const currentMoney = userData.money || 0;
          if (currentMoney < selected.price) {
            return replyMessage.reply(`❌ Vous n'avez pas assez d'argent. Il vous manque ${formatMoney(selected.price - currentMoney)} coins.`);
          }
          if (selected.type === "bundle") {
            const bundleItem = {
              key: `bundle_${Date.now()}`,
              name: "Pet Bundle (Basic)",
              icon: "🐾",
              type: "bundle",
              petType: "bundle",
              flavorText: "Contient un pet aléatoire"
            };
            userData.inventory.push(bundleItem);
            userData.money -= selected.price;
            await saveUser({ inventory: userData.inventory, money: userData.money });
            replyMessage.reply(`✅ Vous avez acheté un Pet Bundle ! Utilisez ${commandName} uncage pour l'ouvrir.`);
          } else if (selected.type === "food") {
            const food = CONFIG.FOODS.find(f => f.key === selected.key);
            const foodItem = {
              key: food.key,
              name: food.name,
              icon: food.icon,
              type: food.type,
              saturation: food.saturation,
              sellPrice: food.sellPrice
            };
            userData.inventory.push(foodItem);
            userData.money -= selected.price;
            await saveUser({ inventory: userData.inventory, money: userData.money });
            replyMessage.reply(`✅ Vous avez acheté ${food.name} ! Utilisez ${commandName} feed pour nourrir un pet.`);
          } else if (selected.type === "country") {
            const countryItem = {
              key: selected.key,
              name: selected.name,
              icon: selected.icon,
              type: "country_bonus",
              effect: selected.effect,
              price: selected.price
            };
            userData.inventory.push(countryItem);
            userData.money -= selected.price;
            await saveUser({ inventory: userData.inventory, money: userData.money });
            replyMessage.reply(`✅ Vous avez acheté ${selected.icon} ${selected.name} ! Appliquez-le à un pet avec ${commandName} apply <pet> <item>.`);
          }
        }
      });
      return;
    }

    if (subCmd === "uncage" || subCmd === "u") {
      const bundles = userData.inventory.filter(i => i.type === "bundle");
      if (bundles.length === 0) {
        return message.reply("📦 Vous n'avez aucun bundle à ouvrir. Achetez-en un dans la boutique.");
      }
      if ((userData.pets || []).length >= CONFIG.PET_LIMIT) {
        return message.reply(`❌ Vous avez déjà ${CONFIG.PET_LIMIT} pets. Vendez-en un ou libérez de la place.`);
      }
      let bundleList = "";
      bundles.forEach((b, idx) => {
        bundleList += `${idx+1}. ${b.icon} ${b.name}\n`;
      });
      const prompt = `📦 Choisissez le bundle à ouvrir :\n${bundleList}\nRépondez avec le numéro.`;
      const replyMsg = await message.reply(prompt);
      global.GoatBot.onReply.set(replyMsg.messageID, {
        commandName: this.config.name,
        author: senderID,
        callback: async ({ message: replyMessage, event: replyEvent }) => {
          const choice = parseInt(replyEvent.body);
          if (isNaN(choice) || choice < 1 || choice > bundles.length) {
            return replyMessage.reply("❌ Numéro invalide.");
          }
          const selectedBundle = bundles[choice-1];
          const randomPetType = CONFIG.DEFAULT_PETS[Math.floor(Math.random() * CONFIG.DEFAULT_PETS.length)];
          const newPet = {
            key: generatePetKey(randomPetType.key, randomPetType.name),
            name: randomPetType.name,
            icon: randomPetType.icon,
            petType: randomPetType.petType,
            level: 1,
            lastExp: 0,
            HP: randomPetType.baseHp,
            maxHP: randomPetType.baseHp,
            ATK: randomPetType.baseAtk,
            DEF: randomPetType.baseDef,
            MAGIC: randomPetType.baseMagic,
            sellPrice: randomPetType.sellPrice,
            lastFeed: Date.now(),
            lastSaturation: 0,
            lastFoodEaten: null,
            lastQuest: 0,
            questCount: 0,
            lastQuestDay: 0,
            questStreak: 0,
            bonuses: []
          };
          userData.inventory = userData.inventory.filter(i => i.key !== selectedBundle.key);
          userData.pets.push(newPet);
          await saveUser({ inventory: userData.inventory, pets: userData.pets });
          replyMessage.reply(`🎉 Félicitations ! Vous avez débloqué ${newPet.icon} ${newPet.name} (${newPet.petType}). Utilisez ${commandName} list pour le voir.`);
        }
      });
      return;
    }

    if (subCmd === "feed" || subCmd === "f") {
      const petName = args[1];
      if (!petName) {
        return message.reply("❌ Spécifiez le nom du pet à nourrir. Ex: pet feed Rex");
      }
      const pet = userData.pets.find(p => p.name.toLowerCase() === petName.toLowerCase());
      if (!pet) {
        return message.reply(`❌ Pet "${petName}" introuvable. Utilisez ${commandName} list pour voir vos pets.`);
      }
      if (!isPetHungry(pet)) {
        return message.reply(`🍖 ${pet.name} n'a pas faim pour le moment. Revenez plus tard.`);
      }
      const compatibleFoods = userData.inventory.filter(item => item.type === `${pet.petType}_food`);
      if (compatibleFoods.length === 0) {
        return message.reply(`❌ Vous n'avez aucune nourriture pour ${pet.petType}. Achetez-en dans la boutique.`);
      }
      let foodList = "";
      compatibleFoods.forEach((f, idx) => {
        foodList += `${idx+1}. ${f.icon} ${f.name} (saturation: ${Math.floor(f.saturation/60000)} min)\n`;
      });
      const prompt = `🍽️ Choisissez la nourriture pour ${pet.name} :\n${foodList}\nRépondez avec le numéro.`;
      const replyMsg = await message.reply(prompt);
      global.GoatBot.onReply.set(replyMsg.messageID, {
        commandName: this.config.name,
        author: senderID,
        petKey: pet.key,
        callback: async ({ message: replyMessage, event: replyEvent }) => {
          const choice = parseInt(replyEvent.body);
          if (isNaN(choice) || choice < 1 || choice > compatibleFoods.length) {
            return replyMessage.reply("❌ Choix invalide.");
          }
          const selectedFood = compatibleFoods[choice-1];
          const expGain = feedPet(pet, selectedFood);
          userData.inventory = userData.inventory.filter(i => i.key !== selectedFood.key);
          const petIndex = userData.pets.findIndex(p => p.key === pet.key);
          if (petIndex !== -1) userData.pets[petIndex] = pet;
          await saveUser({ inventory: userData.inventory, pets: userData.pets });
          replyMessage.reply(`✅ ${pet.name} a été nourri avec ${selectedFood.icon} ${selectedFood.name} ! +${expGain} XP. Il est maintenant niveau ${pet.level}.`);
        }
      });
      return;
    }

    if (subCmd === "quest" || subCmd === "q") {
      const petName = args[1];
      let targetPet = null;
      if (petName) {
        targetPet = userData.pets.find(p => p.name.toLowerCase() === petName.toLowerCase());
        if (!targetPet) return message.reply(`❌ Pet "${petName}" introuvable.`);
      } else {
        const eligible = findQuestEligiblePets(userData.pets);
        if (eligible.length === 0) return message.reply("❌ Aucun pet n'est disponible pour une quête actuellement (limite quotidienne atteinte ou tous en voyage).");
        targetPet = eligible[0];
      }
      const now = Date.now();
      const todayStart = new Date().setUTCHours(0, 0, 0, 0);
      if (targetPet.lastQuestDay !== todayStart) {
        targetPet.questCount = 0;
        targetPet.lastQuestDay = todayStart;
      }
      if (targetPet.questCount >= CONFIG.QUEST.DAILY_QUEST_LIMIT) {
        return message.reply(`⏳ ${targetPet.name} a déjà effectué ${CONFIG.QUEST.DAILY_QUEST_LIMIT} quêtes aujourd'hui. Revenez demain.`);
      }
      const timeSinceLastQuest = now - (targetPet.lastQuest || 0);
      if (timeSinceLastQuest < CONFIG.QUEST.COOLDOWN) {
        const remaining = CONFIG.QUEST.COOLDOWN - timeSinceLastQuest;
        return message.reply(`⏳ ${targetPet.name} est fatigué. Revenez dans ${formatDuration(remaining)}.`);
      }
      const worth = calculatePetWorth(targetPet);
      const timeFactor = Math.min(timeSinceLastQuest / CONFIG.QUEST.COOLDOWN, 1);
      let baseReward = Math.floor(worth * CONFIG.QUEST.REWARD_MULTIPLIER * timeFactor);
      if (timeSinceLastQuest > CONFIG.QUEST.STREAK_RESET_THRESHOLD) targetPet.questStreak = 0;
      targetPet.questStreak = Math.min((targetPet.questStreak || 0) + 1, CONFIG.QUEST.MAX_STREAK);
      let bonus = CONFIG.QUEST.BASE_BONUS + (targetPet.questStreak * CONFIG.QUEST.STREAK_INCREMENT);
      let reward = Math.round((baseReward + bonus) ** 1.005);
      targetPet.lastQuest = now;
      targetPet.questCount += 1;
      const petIndex = userData.pets.findIndex(p => p.key === targetPet.key);
      if (petIndex !== -1) userData.pets[petIndex] = targetPet;
      userData.money = (userData.money || 0) + reward;
      await saveUser({ pets: userData.pets, money: userData.money });
      const questMsg = `
⚔️ Quête accomplie par ${targetPet.icon} ${targetPet.name} !
💰 Récompense : ${formatMoney(reward)} coins
🔥 Bonus de streak : +${formatMoney(bonus)} (x${targetPet.questStreak})
📅 Quêtes restantes aujourd'hui : ${CONFIG.QUEST.DAILY_QUEST_LIMIT - targetPet.questCount}
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(questMsg) : questMsg);
    }

    if (subCmd === "sell" || subCmd === "s") {
      const petName = args[1];
      if (!petName) return message.reply("❌ Spécifiez le nom du pet à vendre.");
      const petIndex = userData.pets.findIndex(p => p.name.toLowerCase() === petName.toLowerCase());
      if (petIndex === -1) return message.reply(`❌ Pet "${petName}" introuvable.`);
      const pet = userData.pets[petIndex];
      if (pet.level < 5) {
        return message.reply(`❌ ${pet.name} est niveau ${pet.level}. Il doit être au moins niveau 5 pour être vendu.`);
      }
      const price = calculatePetWorth(pet);
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const confirmMsg = await message.reply(`🛑 Vente de ${pet.icon} ${pet.name} pour ${formatMoney(price)} coins.\n🔐 Confirmez en tapant exactement : ${code}`);
      global.GoatBot.onReply.set(confirmMsg.messageID, {
        commandName: this.config.name,
        author: senderID,
        petKey: pet.key,
        code: code,
        price: price,
        callback: async ({ message: replyMessage, event: replyEvent }) => {
          if (replyEvent.body.trim() !== code) {
            return replyMessage.reply("❌ Code incorrect. Vente annulée.");
          }
          userData.pets = userData.pets.filter(p => p.key !== pet.key);
          userData.money = (userData.money || 0) + price;
          userData.petSells = (userData.petSells || 0) + price;
          await saveUser({ pets: userData.pets, money: userData.money, petSells: userData.petSells });
          replyMessage.reply(`✅ ${pet.name} a été vendu pour ${formatMoney(price)} coins.`);
        }
      });
      return;
    }

    if (subCmd === "rename" || subCmd === "r") {
      const petName = args[1];
      if (!petName) return message.reply("❌ Spécifiez le nom du pet à renommer.");
      const pet = userData.pets.find(p => p.name.toLowerCase() === petName.toLowerCase());
      if (!pet) return message.reply(`❌ Pet "${petName}" introuvable.`);
      const hasDogTag = userData.inventory.some(i => i.key === "dogTag");
      if (!hasDogTag) {
        return message.reply("🏷️ Vous avez besoin d'un Dog Tag pour renommer un pet. Achetez-en un à la boutique.");
      }
      const promptMsg = await message.reply(`✏️ Quel nouveau nom pour ${pet.icon} ${pet.name} ? (pas d'espaces, max 20 caractères)`);
      global.GoatBot.onReply.set(promptMsg.messageID, {
        commandName: this.config.name,
        author: senderID,
        petKey: pet.key,
        callback: async ({ message: replyMessage, event: replyEvent }) => {
          let newName = replyEvent.body.trim().split(/\s+/)[0];
          if (newName.length > 20) newName = newName.slice(0,20);
          if (!newName) return replyMessage.reply("❌ Nom invalide.");
          const oldName = pet.name;
          pet.name = newName;
          userData.inventory = userData.inventory.filter(i => i.key !== "dogTag");
          const petIndex = userData.pets.findIndex(p => p.key === pet.key);
          if (petIndex !== -1) userData.pets[petIndex] = pet;
          await saveUser({ inventory: userData.inventory, pets: userData.pets });
          replyMessage.reply(`✅ ${oldName} s'appelle désormais ${newName} !`);
        }
      });
      return;
    }

    if (subCmd === "gear" || subCmd === "g") {
      const petName = args[1];
      if (!petName) {
        if (userData.pets.length === 0) return message.reply("Aucun pet.");
        let text = `🔧 Statistiques de vos pets\n\n`;
        for (const pet of userData.pets) {
          text += `${pet.icon} ${pet.name} (${pet.petType}) – Niv.${pet.level}\n`;
          text += `   ❤️ HP: ${pet.HP}/${pet.maxHP} | ⚔️ ATK: ${pet.ATK} | 🛡️ DEF: ${pet.DEF} | ✨ MAG: ${pet.MAGIC}\n`;
        }
        return message.reply(fonts?.bold ? fonts.bold(text) : text);
      }
      const pet = userData.pets.find(p => p.name.toLowerCase() === petName.toLowerCase());
      if (!pet) return message.reply(`❌ Pet "${petName}" introuvable.`);
      const stats = `
🔧 ${pet.icon} ${pet.name} (${pet.petType})
━━━━━━━━━━━━━━━━━━━━
❤️ PV : ${pet.HP}/${pet.maxHP}
⚔️ ATK : ${pet.ATK}
🛡️ DEF : ${pet.DEF}
✨ MAG : ${pet.MAGIC}
📈 Niveau : ${pet.level}
⭐ Expérience : ${pet.lastExp || 0}/${calcNextExp(pet.level)}
💰 Valeur : ${formatMoney(calculatePetWorth(pet))}
🍽️ Faim : ${isPetHungry(pet) ? "Affamé" : "Rassasié"}
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(stats) : stats);
    }

    if (subCmd === "top" || subCmd === "t") {
      const allUsers = await usersData.getAll();
      let allPets = [];
      for (const uid in allUsers) {
        const user = allUsers[uid];
        if (user.pets && Array.isArray(user.pets)) {
          for (const pet of user.pets) {
            allPets.push({
              owner: user.name || uid,
              pet: pet,
              worth: calculatePetWorth(pet)
            });
          }
        }
      }
      allPets.sort((a,b) => b.worth - a.worth);
      const page = parseInt(args[1]) || 1;
      const perPage = 10;
      const start = (page-1)*perPage;
      const end = start+perPage;
      const topPets = allPets.slice(start, end);
      if (topPets.length === 0) return message.reply("Aucun pet classé.");
      let leaderboard = `🏆 Top des pets (page ${page})\n━━━━━━━━━━━━━━━━━━━━\n`;
      topPets.forEach((entry, idx) => {
        const rank = start+idx+1;
        const pet = entry.pet;
        leaderboard += `${rank}. ${pet.icon} ${pet.name} (niv.${pet.level}) – ${formatMoney(entry.worth)} coins\n   👤 ${entry.owner}\n`;
      });
      return message.reply(fonts?.bold ? fonts.bold(leaderboard) : leaderboard);
    }

    if (subCmd === "apply") {
      const petName = args[1];
      const itemKey = args[2];
      if (!petName || !itemKey) return message.reply("❌ Utilisation : pet apply <nom du pet> <key de l'item>");
      const pet = userData.pets.find(p => p.name.toLowerCase() === petName.toLowerCase());
      if (!pet) return message.reply(`❌ Pet "${petName}" introuvable.`);
      const bonusItem = userData.inventory.find(i => i.key === itemKey && i.type === "country_bonus");
      if (!bonusItem) return message.reply(`❌ Vous ne possédez pas l'item ${itemKey} dans votre inventaire.`);
      if (!pet.bonuses) pet.bonuses = [];
      pet.bonuses.push(bonusItem);
      userData.inventory = userData.inventory.filter(i => i.key !== itemKey);
      const petIndex = userData.pets.findIndex(p => p.key === pet.key);
      if (petIndex !== -1) userData.pets[petIndex] = pet;
      await saveUser({ inventory: userData.inventory, pets: userData.pets });
      message.reply(`✅ ${bonusItem.icon} ${bonusItem.name} a été appliqué à ${pet.icon} ${pet.name} ! Effet : ${bonusItem.desc}`);
      return;
    }

    const unknownMsg = `❌ Sous-commande inconnue. Tapez ${commandName} help pour la liste.`;
    return message.reply(fonts?.bold ? fonts.bold(unknownMsg) : unknownMsg);
  }
};