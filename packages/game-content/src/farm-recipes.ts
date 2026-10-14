export const FARM_RECIPES = {
  eggCake: {
    cookMs: 3600000,
    sellPrice: 5880,
    ingredients: {
      egg: 12,
      rice: 720,
    },
  },
  milkCake: {
    cookMs: 3600000,
    sellPrice: 6160,
    ingredients: {
      milk: 20,
      rice: 720,
    },
  },
  riceMeal: {
    cookMs: 1800000,
    sellPrice: 6211,
    ingredients: {
      rice: 1440,
    },
  },
  eggRice: {
    cookMs: 3600000,
    sellPrice: 8040,
    ingredients: {
      rice: 1440,
      egg: 12,
    },
  },
  carrotRice: {
    cookMs: 3600000,
    sellPrice: 8244,
    ingredients: {
      rice: 1440,
      carrot: 108,
    },
  },
  mangoSalad: {
    cookMs: 3600000,
    sellPrice: 7920,
    ingredients: {
      mango: 1440,
    },
  },
  fries: {
    cookMs: 3600000,
    sellPrice: 20000,
    ingredients: {
      potato: 500,
      egg: 100,
    },
  },
  butterCorn: {
    cookMs: 3600000,
    sellPrice: 19000,
    ingredients: {
      corn: 1500,
      egg: 300,
    },
  },
  pancake: {
    cookMs: 14400000,
    sellPrice: 30000,
    ingredients: {
      rice: 2000,
      egg: 100,
      pork: 5,
    },
  },
  pizza: {
    cookMs: 86400000,
    sellPrice: 72000,
    ingredients: {
      rice: 5000,
      pork: 5,
      beef: 1,
      fish: 1,
      egg: 200,
    },
  },
  fruitJuice: {
    cookMs: 3600000,
    sellPrice: 6030,
    ingredients: {
      pineapple: 338,
      grape: 480,
    },
  },
  starfruitYogurt: {
    cookMs: 3600000,
    sellPrice: 12096,
    ingredients: {
      milk: 72,
      starfruit: 96,
    },
  },
  fruitMilkTea: {
    cookMs: 3600000,
    sellPrice: 17000,
    ingredients: {
      fruitPlate: 1,
      milk: 50,
    },
  },
  sweetSoup: {
    cookMs: 7200000,
    sellPrice: 25000,
    ingredients: {
      lychee: 500,
      milk: 50,
      cream: 1,
    },
  },
  peachTea: {
    cookMs: 7200000,
    sellPrice: 7000,
    ingredients: {
      peach: 1000,
    },
  },
  friedIceCream: {
    cookMs: 1800000,
    sellPrice: 12500,
    ingredients: {
      cream: 1,
    },
  },
  watermelonJuice: {
    cookMs: 7200000,
    sellPrice: 10000,
    ingredients: {
      watermelon: 1000,
    },
  },
  beefBalls: {
    cookMs: 1800000,
    sellPrice: 20000,
    ingredients: {
      beef: 2,
    },
  },
  fishBalls: {
    cookMs: 1800000,
    sellPrice: 10000,
    ingredients: {
      fish: 2,
    },
  },
  cheese: {
    cookMs: 14400000,
    sellPrice: 32000,
    ingredients: {
      milk: 100,
      egg: 400,
    },
  },
  ketchup: {
    cookMs: 21600000,
    sellPrice: 20000,
    ingredients: {
      tomato: 1000,
    },
  },
  chiliSauce: {
    cookMs: 1800000,
    sellPrice: 3000,
    ingredients: {
      chili: 500,
    },
  },
} as const;
export type RecipeId = keyof typeof FARM_RECIPES;
