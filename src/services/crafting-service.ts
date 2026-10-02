import type mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import { CraftingError, RecipeNotFoundError } from '../errors/index.js';
import { log } from '../logger.js';
import { resolveBot } from './service-utils.js';
import type {
  BotOrGetter,
  CanCraftResult,
  CraftResult,
  RecipeIngredient,
  RecipeListResult,
  RecipeResult
} from './types.js';

interface InventoryItem {
  name: string;
  count: number;
}

type McDataItemsById = Record<string, { name?: unknown }>;

type RecipeEvaluation = {
  canCraft: boolean;
  missingTotal: number;
  missing: RecipeIngredient[];
};

type RecipeIngredientOptions = {
  options: string[];
  count: number;
};

type CandidateRecipe = {
  recipe: unknown;
  resultName: string;
  resultCount: number;
  exactMatch: boolean;
  craftingTable?: unknown;
};

function normalizeItemName(value: string): string {
  return value.trim().toLowerCase();
}

function classifyNameMatch(resultName: string, query: string): { exact: boolean; partial: boolean } {
  const resultNorm = normalizeItemName(resultName);
  const queryNorm = normalizeItemName(query);
  return {
    exact: resultNorm === queryNorm,
    partial: resultNorm.includes(queryNorm)
  };
}

function resolveItemNames(value: unknown, itemsById: McDataItemsById): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const v of value) {
      const name = resolveItemName(v, itemsById);
      if (name) out.push(name);
    }
    return Array.from(new Set(out));
  }

  const single = resolveItemName(value, itemsById);
  return single ? [single] : [];
}

function parseRecipeIngredientOptions(recipe: unknown, itemsById: McDataItemsById): RecipeIngredientOptions[] {
  if (!recipe) return [];

  const r = recipe as Record<string, unknown>;

  const addOptions = (counts: Map<string, { options: string[]; count: number }>, options: string[]) => {
    if (options.length === 0) return;
    const key = [...options].sort().join('|');
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { options: [...options], count: 1 });
  };

  if (Array.isArray(r.inShape)) {
    const counts = new Map<string, { options: string[]; count: number }>();
    for (const row of r.inShape as unknown[]) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        const options = resolveItemNames(cell, itemsById);
        addOptions(counts, options);
      }
    }
    return Array.from(counts.values());
  }

  if (Array.isArray(r.ingredients)) {
    const counts = new Map<string, { options: string[]; count: number }>();
    for (const ingredient of r.ingredients as unknown[]) {
      const options = resolveItemNames(ingredient, itemsById);
      addOptions(counts, options);
    }
    return Array.from(counts.values());
  }

  return [];
}

function formatOptionsLabel(options: string[]): string {
  if (options.length === 0) return 'unresolved ingredient (no options found)';
  if (options.length === 1) return options[0];

  const shown = options.slice(0, 3).join(', ');
  const suffix = options.length > 3 ? ', …' : '';
  return `one of: ${shown}${suffix}`;
}

function evaluateRecipeMissing(recipe: unknown, inventory: InventoryItem[], itemsById: McDataItemsById): RecipeEvaluation {
  const ingredients = parseRecipeIngredientOptions(recipe, itemsById);
  const missing: RecipeIngredient[] = [];
  let missingTotal = 0;

  for (const { options, count } of ingredients) {
    const have = inventory
      .filter((i) => options.includes(i.name))
      .reduce((sum, i) => sum + i.count, 0);

    if (have < count) {
      const deficit = count - have;
      missingTotal += deficit;
      missing.push({ name: formatOptionsLabel(options), count: deficit });
    }
  }

  return { canCraft: missingTotal === 0, missingTotal, missing };
}

function collectCandidateRecipes(recipes: unknown[], query: string, itemsById: McDataItemsById): CandidateRecipe[] {
  const exact: CandidateRecipe[] = [];
  const partial: CandidateRecipe[] = [];

  for (const recipe of recipes) {
    const result = getRecipeResult(recipe, itemsById);
    if (!result) continue;

    const match = classifyNameMatch(result.name, query);
    if (!match.partial) continue;

    const candidate: CandidateRecipe = {
      recipe,
      resultName: result.name,
      resultCount: result.count,
      exactMatch: match.exact
    };

    if (match.exact) exact.push(candidate);
    else partial.push(candidate);
  }

  return exact.length > 0 ? exact : partial;
}

function resolveItemName(value: unknown, itemsById: McDataItemsById): string | null {
  if (!value) return null;

  if (typeof value === 'string') return value;

  if (typeof value === 'number') {
    if (value === 0) return null;
    const item = itemsById[String(value)];
    return typeof item?.name === 'string' ? item.name : null;
  }

  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;

    if (typeof v.name === 'string') return v.name;
    if (typeof v.id === 'number') {
      if (v.id === 0) return null;
      const item = itemsById[String(v.id)];
      return typeof item?.name === 'string' ? item.name : null;
    }
  }

  return null;
}

function parseRecipeIngredients(recipe: unknown, itemsById: McDataItemsById): RecipeIngredient[] {
  const ingredients: RecipeIngredient[] = [];

  if (!recipe) return ingredients;

  const r = recipe as Record<string, unknown>;

  if (Array.isArray(r.inShape)) {
    const countMap: Record<string, number> = {};
    for (const row of r.inShape as unknown[]) {
      if (Array.isArray(row)) {
        for (const item of row) {
          const options = resolveItemNames(item, itemsById);
          if (options.length === 0) continue;
          const label = formatOptionsLabel(options);
          countMap[label] = (countMap[label] || 0) + 1;
        }
      }
    }
    for (const [name, count] of Object.entries(countMap)) {
      ingredients.push({ name, count });
    }

    if (ingredients.length > 0) return ingredients;
  }

  if (Array.isArray(r.ingredients)) {
    const countMap: Record<string, number> = {};
    for (const ingredient of r.ingredients as unknown[]) {
      const options = resolveItemNames(ingredient, itemsById);
      if (options.length === 0) continue;
      const label = formatOptionsLabel(options);
      countMap[label] = (countMap[label] || 0) + 1;
    }
    for (const [name, count] of Object.entries(countMap)) {
      ingredients.push({ name, count });
    }
  }

  return ingredients;
}

function getRecipeResult(recipe: unknown, itemsById: McDataItemsById): { name: string; count: number } | null {
  if (!recipe) return null;

  const r = recipe as Record<string, unknown>;
  const result = r.result;

  if (!result) return null;

  if (typeof result === 'string') {
    return { name: result, count: 1 };
  }

  if (typeof result === 'number') {
    const name = resolveItemName(result, itemsById);
    return name ? { name, count: 1 } : null;
  }

  if (result && typeof result === 'object') {
    const resultObj = result as Record<string, unknown>;
    const name = resolveItemName(resultObj, itemsById);
    const count = typeof resultObj.count === 'number' && Number.isFinite(resultObj.count) ? resultObj.count : 1;
    return name ? { name, count } : null;
  }

  return null;
}

function canCraftRecipe(recipe: unknown, inventory: InventoryItem[], itemsById: McDataItemsById): boolean {
  return evaluateRecipeMissing(recipe, inventory, itemsById).canCraft;
}

function collectCandidateRecipesFromBot(
  bot: mineflayer.Bot,
  mcData: unknown,
  query: string,
  itemsById: McDataItemsById,
  craftingTable: unknown | null
): CandidateRecipe[] {
  const data = mcData as Record<string, unknown>;
  const itemsByName = data.itemsByName as Record<string, { id?: unknown }> | undefined;
  if (!itemsByName) return [];

  const q = normalizeItemName(query);
  const exact: CandidateRecipe[] = [];
  const partial: CandidateRecipe[] = [];

  const pushRecipesFor = (name: string, id: number, exactMatch: boolean) => {
    const recipesFor = (bot as unknown as { recipesFor?: (...args: unknown[]) => unknown[] }).recipesFor;
    if (typeof recipesFor !== 'function') return;
    const recipes = recipesFor(id, null, 1, craftingTable) as unknown[];
    for (const recipe of recipes) {
      const result = getRecipeResult(recipe, itemsById);
      const resultName = result?.name ?? name;
      const resultCount = result?.count ?? 1;
      const candidate: CandidateRecipe = {
        recipe,
        resultName,
        resultCount,
        exactMatch,
        craftingTable: craftingTable ?? undefined
      };
      if (exactMatch) exact.push(candidate);
      else partial.push(candidate);
    }
  };

  const exactEntry = itemsByName[q];
  if (exactEntry && typeof exactEntry.id === 'number') {
    pushRecipesFor(q, exactEntry.id, true);
    return exact;
  }

  for (const [name, meta] of Object.entries(itemsByName)) {
    const match = classifyNameMatch(name, q);
    if (!match.partial) continue;
    if (typeof meta?.id === 'number') pushRecipesFor(name, meta.id, false);
  }

  return partial;
}

function findNearbyCraftingTable(bot: mineflayer.Bot, mcData: unknown): unknown | null {
  const data = mcData as Record<string, unknown>;
  const blocksByName = data.blocksByName as Record<string, { id?: unknown }> | undefined;
  const craftingTableId = blocksByName?.crafting_table?.id;
  if (typeof craftingTableId !== 'number') return null;

  const findBlock = (bot as unknown as { findBlock?: (opts: unknown) => unknown }).findBlock;
  if (typeof findBlock !== 'function') return null;

  try {
    return findBlock({ matching: craftingTableId, maxDistance: 16, count: 1 });
  } catch {
    return null;
  }
}

function getAllRecipes(mcData: unknown): unknown[] {
  const data = mcData as Record<string, unknown>;
  const recipes = data.recipes;

  if (Array.isArray(recipes)) {
    return recipes;
  }

  if (typeof recipes === 'object' && recipes !== null) {
    const recipeObj = recipes as Record<string, unknown>;
    const allRecipes: unknown[] = [];
    for (const recipeList of Object.values(recipeObj)) {
      if (Array.isArray(recipeList)) {
        allRecipes.push(...recipeList);
      }
    }
    return allRecipes;
  }

  return [];
}

export class CraftingService {
  constructor(private botOrGetter: BotOrGetter) {}

  protected getBot(): mineflayer.Bot {
    return resolveBot(this.botOrGetter);
  }

  listRecipes(name?: string): RecipeListResult {
    const bot = this.getBot();
    const mcData = minecraftData(bot.version);
    if (!mcData || !(mcData as unknown as { items: unknown })?.items) {
      return {
        success: false,
        recipes: [],
        message: 'No recipes available for this Minecraft version'
      };
    }
    const itemsById = (mcData as unknown as { items: McDataItemsById }).items;
    const recipes = getAllRecipes(mcData);
    const inventory = bot.inventory.items().map((item) => ({ name: item.name, count: item.count }));

    if (!recipes || recipes.length === 0) {
      return {
        success: false,
        recipes: [],
        message: 'No recipes available for this Minecraft version'
      };
    }

    const availableRecipes: Array<{
      name: string;
      count: number;
      ingredients: RecipeIngredient[];
      exactMatch?: boolean;
    }> = [];

    for (const recipe of recipes) {
      const result = getRecipeResult(recipe, itemsById);
      if (!result) continue;

      const match = name ? classifyNameMatch(result.name, name) : { exact: false, partial: true };
      if (name && !match.partial) continue;

      if (canCraftRecipe(recipe, inventory, itemsById)) {
        const ingredients = parseRecipeIngredients(recipe, itemsById);
        availableRecipes.push({
          name: result.name,
          count: result.count,
          ingredients,
          exactMatch: name ? match.exact : undefined
        });
      }
    }

    if (name) {
      const hasExact = availableRecipes.some((r) => r.exactMatch);
      if (hasExact) {
        for (let i = availableRecipes.length - 1; i >= 0; i--) {
          if (!availableRecipes[i].exactMatch) availableRecipes.splice(i, 1);
        }
      }
    }

    if (availableRecipes.length === 0) {
      return {
        success: false,
        recipes: [],
        message: `No craftable recipes found${name ? ` for ${name}` : ''} with current inventory`
      };
    }

    let output = `Found ${availableRecipes.length} craftable recipe(s):\n\n`;
    availableRecipes.forEach((recipe, index) => {
      output += `${index + 1}. ${recipe.name} (x${recipe.count})\n`;
      output += `   Ingredients: ${recipe.ingredients.map((i) => `${i.name} x${i.count}`).join(', ')}\n\n`;
    });

    return {
      success: true,
      recipes: availableRecipes.map((r) => ({
        name: r.name,
        count: r.count,
        ingredients: r.ingredients,
        canCraft: true
      })),
      message: output
    };
  }

  getRecipe(name: string): RecipeResult {
    const bot = this.getBot();
    const mcData = minecraftData(bot.version);
    if (!mcData || !(mcData as unknown as { items: unknown })?.items) {
      throw new RecipeNotFoundError('No recipes available');
    }
    const itemsById = (mcData as unknown as { items: McDataItemsById }).items;
    const recipes = getAllRecipes(mcData);
    const inventory = bot.inventory.items().map((item) => ({ name: item.name, count: item.count }));

    if (!recipes || recipes.length === 0) {
      throw new RecipeNotFoundError('No recipes available');
    }

    const table = findNearbyCraftingTable(bot, mcData);
    const candidatesFromBotNoTable = collectCandidateRecipesFromBot(bot, mcData, name, itemsById, null);
    const candidatesFromBotWithTable = table ? collectCandidateRecipesFromBot(bot, mcData, name, itemsById, table) : [];
    const candidatesFromBot = candidatesFromBotNoTable.length > 0 ? candidatesFromBotNoTable : candidatesFromBotWithTable;
    const candidates = candidatesFromBot.length > 0 ? candidatesFromBot : collectCandidateRecipes(recipes, name, itemsById);

    const matchingRecipes = candidates
      .map((c) => {
        const ingredients = parseRecipeIngredients(c.recipe, itemsById);
        const evaluation = evaluateRecipeMissing(c.recipe, inventory, itemsById);
        return {
          name: c.resultName,
          count: c.resultCount,
          ingredients,
          canCraft: evaluation.canCraft,
          missingTotal: evaluation.missingTotal
        };
      })
      .sort((a, b) => {
        if (a.canCraft !== b.canCraft) return a.canCraft ? -1 : 1;
        return a.missingTotal - b.missingTotal;
      });

    if (matchingRecipes.length === 0) {
      return {
        success: false,
        recipes: [],
        message: `No recipes found for ${name}`
      };
    }

    let output = `Recipe(s) for ${name}:\n\n`;
    matchingRecipes.forEach((recipe, index) => {
      output += `${index + 1}. Output: ${recipe.name} (x${recipe.count})`;
      output += recipe.canCraft ? ' [craftable]\n' : ` [missing: ${recipe.missingTotal}]\n`;
      output += '   Ingredients:\n';

      for (const ingredient of recipe.ingredients) {
        output += `   - ${ingredient.name} x${ingredient.count}\n`;
      }
      output += '\n';
    });

    return {
      success: true,
      recipes: matchingRecipes,
      message: output
    };
  }

  canCraft(name: string, _count = 1): CanCraftResult {
    const bot = this.getBot();
    const mcData = minecraftData(bot.version);
    if (!mcData || !(mcData as unknown as { items?: unknown }).items) {
      throw new RecipeNotFoundError('No recipes available');
    }
    const itemsById = (mcData as unknown as { items: McDataItemsById }).items;
    const recipes = getAllRecipes(mcData);
    const inventory = bot.inventory.items().map((item) => ({ name: item.name, count: item.count }));

    if (!recipes || recipes.length === 0) {
      throw new RecipeNotFoundError('No recipes available');
    }

    const table = findNearbyCraftingTable(bot, mcData);
    const candidatesFromBotNoTable = collectCandidateRecipesFromBot(bot, mcData, name, itemsById, null);
    const candidatesFromBotWithTable = table ? collectCandidateRecipesFromBot(bot, mcData, name, itemsById, table) : [];
    const candidatesFromBot = candidatesFromBotNoTable.length > 0 ? candidatesFromBotNoTable : candidatesFromBotWithTable;
    const candidates = candidatesFromBot.length > 0 ? candidatesFromBot : collectCandidateRecipes(recipes, name, itemsById);

    if (candidates.length === 0) {
      return {
        success: false,
        canCraft: false,
        itemName: name,
        message: `No recipe found for ${name}`
      };
    }

    let bestCannotCraft: { missingTotal: number; missing: RecipeIngredient[]; message: string } | null = null;

    for (const candidate of candidates) {
      const evaluation = evaluateRecipeMissing(candidate.recipe, inventory, itemsById);

      if (evaluation.canCraft) {
        return {
          success: true,
          canCraft: true,
          itemName: candidate.resultName,
          message: `Yes, can craft ${candidate.resultName}. Have all required ingredients.`
        };
      }

      let output = `Cannot craft ${candidate.resultName}. Missing:\n`;
      for (const { name: ingName, count: ingCount } of evaluation.missing) {
        output += `- ${ingName} x${ingCount}\n`;
      }

      if (!bestCannotCraft || evaluation.missingTotal < bestCannotCraft.missingTotal) {
        bestCannotCraft = {
          missingTotal: evaluation.missingTotal,
          missing: evaluation.missing,
          message: output
        };
      }
    }

    return {
      success: true,
      canCraft: false,
      itemName: name,
      missing: bestCannotCraft?.missing,
      message: bestCannotCraft?.message ?? `No recipe found for ${name}`
    };
  }

  async craftItem(name: string, count = 1): Promise<CraftResult> {
    const outputQuery = normalizeItemName(name);

    const bot = this.getBot();
    const mcData = minecraftData(bot.version);
    if (!mcData || !(mcData as unknown as { items?: unknown }).items) {
      throw new RecipeNotFoundError('No recipes available');
    }
    const itemsById = (mcData as unknown as { items: McDataItemsById }).items;
    const recipes = getAllRecipes(mcData);

    if (!recipes || recipes.length === 0) {
      throw new RecipeNotFoundError('No recipes available');
    }

    let craftedCount = 0;
    let lastError = '';

    const table = findNearbyCraftingTable(bot, mcData);
    const candidatesFromBotNoTable = collectCandidateRecipesFromBot(bot, mcData, outputQuery, itemsById, null);
    const candidatesFromBotWithTable = table ? collectCandidateRecipesFromBot(bot, mcData, outputQuery, itemsById, table) : [];
    const candidatesFromBot = candidatesFromBotNoTable.length > 0 ? candidatesFromBotNoTable : candidatesFromBotWithTable;
    const candidates = candidatesFromBot.length > 0 ? candidatesFromBot : collectCandidateRecipes(recipes, outputQuery, itemsById);

    for (let attempt = 0; attempt < count; attempt++) {
      const currentInventory = bot.inventory.items().map((item) => ({ name: item.name, count: item.count }));
      let craftedThisAttempt = false;
      let bestCannotCraft: { missingTotal: number; message: string } | null = null;

      for (const candidate of candidates) {
        const evaluation = evaluateRecipeMissing(candidate.recipe, currentInventory, itemsById);

        if (!evaluation.canCraft) {
          let msg = `Cannot craft ${candidate.resultName}. Missing:\n`;
          for (const { name: ingName, count: ingCount } of evaluation.missing) {
            msg += `- ${ingName} x${ingCount}\n`;
          }
          if (!bestCannotCraft || evaluation.missingTotal < bestCannotCraft.missingTotal) {
            bestCannotCraft = { missingTotal: evaluation.missingTotal, message: msg };
          }
          continue;
        }

        try {
          if (candidate.craftingTable) {
            await bot.craft(candidate.recipe as Parameters<typeof bot.craft>[0], 1, candidate.craftingTable as Parameters<typeof bot.craft>[2]);
          } else {
            await bot.craft(candidate.recipe as Parameters<typeof bot.craft>[0], 1);
          }
          craftedCount++;
          craftedThisAttempt = true;
          log('info', `Crafted ${candidate.resultName}`);
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          log('warn', `Failed to craft ${name}: ${lastError}`);
        }
      }

      if (!craftedThisAttempt && attempt === 0) {
        if (bestCannotCraft) {
          throw new CraftingError(bestCannotCraft.message);
        }
        throw new CraftingError(`Failed to craft ${name}: ${lastError || 'Recipe not found or missing ingredients'}`);
      }

      if (!craftedThisAttempt) {
        break;
      }
    }

    if (craftedCount === 0) {
      throw new CraftingError(`Failed to craft ${name}: ${lastError || 'Missing ingredients or recipe not found'}`);
    }

    return {
      success: true,
      itemName: name,
      craftedCount,
      message: `Successfully crafted ${name} ${craftedCount} time(s)`
    };
  }
}
