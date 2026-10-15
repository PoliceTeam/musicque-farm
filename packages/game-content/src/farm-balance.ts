import { FARM_CROPS } from './farm-catalog.js';

export const FARM_STARTING_COINS = 30_000;
export const FARM_GROW_MS = FARM_CROPS.strawberry.growMs;
export const FARM_FOOD_MS = 12 * 3_600_000;
export const FARM_UNIT_LIMITS = { livestock: 20, poultry: 24, pond: 10 } as const;
// Read-only save compatibility: preserve already purchased capacity.
export const FARM_UNIT_SAVE_LIMITS = { livestock: 24, poultry: 24, pond: 20 } as const;
export const FARM_UNIT_START = { livestock: 10, poultry: 6, pond: 2 } as const;
export const FARM_ANIMAL_PRICES = {
  hen: 500,
  duck: 600,
  pig: 1000,
  sheep: 2,
  cow: 5,
  fish: 5000,
  buffalo: 1000,
  turtle: 2000,
  dog: 1,
} as const;
export const FARM_PRODUCTS = {
  tomato: {
    price: 1,
    icon: '🍅',
    label: 'tomato',
  },
  carrot: {
    price: 1,
    icon: '🥕',
    label: 'carrot',
  },
  pineapple: {
    price: 1,
    icon: '🍍',
    label: 'pineapple',
  },
  watermelon: {
    price: 1,
    icon: '🍉',
    label: 'watermelon',
  },
  grape: {
    price: 1,
    icon: '🍇',
    label: 'grape',
  },
  rose: {
    price: 2,
    icon: '🌹',
    label: 'rose',
  },
  rice: {
    price: 1,
    icon: '🌾',
    label: 'rice',
  },
  mango: {
    price: 1,
    icon: '🥭',
    label: 'mango',
  },
  dragonFruit: {
    price: 1,
    icon: '🍈',
    label: 'dragonFruit',
  },
  sunflower: {
    price: 2,
    icon: '🌻',
    label: 'sunflower',
  },
  tulip: {
    price: 2,
    icon: '🌷',
    label: 'tulip',
  },
  corn: {
    price: 1,
    icon: '🌽',
    label: 'corn',
  },
  aloe: {
    price: null,
    icon: '🌿',
    label: 'aloe',
  },
  cosmos: {
    price: 2,
    icon: '🌼',
    label: 'cosmos',
  },
  lotus: {
    price: 2,
    icon: '🪷',
    label: 'lotus',
  },
  pumpkin: {
    price: 1,
    icon: '🎃',
    label: 'pumpkin',
  },
  potato: {
    price: 1,
    icon: '🥔',
    label: 'potato',
  },
  chili: {
    price: 1,
    icon: '🌶️',
    label: 'chili',
  },
  strawberry: {
    price: FARM_CROPS.strawberry.sellPrice,
    icon: '🍓',
    label: 'strawberry',
  },
  egg: {
    price: 10,
    icon: '🥚',
    label: 'egg',
  },
  duckEgg: {
    price: 10,
    icon: '🥚',
    label: 'duckEgg',
  },
  milk: {
    price: 20,
    icon: '🥛',
    label: 'milk',
  },
  wool: {
    price: 30,
    icon: '🧶',
    label: 'wool',
  },
  pork: {
    price: 2000,
    icon: '🥩',
    label: 'pork',
  },
  beef: {
    price: 2000,
    icon: '🥩',
    label: 'beef',
  },
  fish: {
    price: 10000,
    icon: '🐟',
    label: 'fish',
  },
  buffalo: {
    price: 3000,
    icon: '🐃',
    label: 'buffalo',
  },
  turtle: {
    price: 5000,
    icon: '🐢',
    label: 'turtle',
  },
  starfruit: {
    price: 1,
    icon: '⭐',
    label: 'starfruit',
  },
  lychee: {
    price: null,
    icon: '🍒',
    label: 'lychee',
  },
  peach: {
    price: null,
    icon: '🍑',
    label: 'peach',
  },
  cream: {
    price: null,
    icon: '🍨',
    label: 'cream',
  },
  fruitPlate: {
    price: null,
    icon: '🍇',
    label: 'fruitPlate',
  },
  eggCake: {
    price: 5880,
    icon: '🍽️',
    label: 'eggCake',
  },
  milkCake: {
    price: 6160,
    icon: '🍽️',
    label: 'milkCake',
  },
  riceMeal: {
    price: 6211,
    icon: '🍽️',
    label: 'riceMeal',
  },
  eggRice: {
    price: 8040,
    icon: '🍽️',
    label: 'eggRice',
  },
  carrotRice: {
    price: 8244,
    icon: '🍽️',
    label: 'carrotRice',
  },
  mangoSalad: {
    price: 7920,
    icon: '🍽️',
    label: 'mangoSalad',
  },
  fries: {
    price: 20000,
    icon: '🍽️',
    label: 'fries',
  },
  butterCorn: {
    price: 19000,
    icon: '🍽️',
    label: 'butterCorn',
  },
  pancake: {
    price: 30000,
    icon: '🍽️',
    label: 'pancake',
  },
  pizza: {
    price: 72000,
    icon: '🍽️',
    label: 'pizza',
  },
  fruitJuice: {
    price: 6030,
    icon: '🍽️',
    label: 'fruitJuice',
  },
  starfruitYogurt: {
    price: 12096,
    icon: '🍽️',
    label: 'starfruitYogurt',
  },
  fruitMilkTea: {
    price: 17000,
    icon: '🍽️',
    label: 'fruitMilkTea',
  },
  sweetSoup: {
    price: 25000,
    icon: '🍽️',
    label: 'sweetSoup',
  },
  peachTea: {
    price: 7000,
    icon: '🍽️',
    label: 'peachTea',
  },
  friedIceCream: {
    price: 12500,
    icon: '🍽️',
    label: 'friedIceCream',
  },
  watermelonJuice: {
    price: 10000,
    icon: '🍽️',
    label: 'watermelonJuice',
  },
  beefBalls: {
    price: 20000,
    icon: '🍽️',
    label: 'beefBalls',
  },
  fishBalls: {
    price: 25000,
    icon: '🍽️',
    label: 'fishBalls',
  },
  cheese: {
    price: 32000,
    icon: '🍽️',
    label: 'cheese',
  },
  ketchup: {
    price: 20000,
    icon: '🍽️',
    label: 'ketchup',
  },
  chiliSauce: {
    price: 3000,
    icon: '🍽️',
    label: 'chiliSauce',
  },
} as const;
