// Templates: a named set of items to add to a list in one go. Ready-made ones are built
// in (below); the user's own are stored per list (lists/{id}/templates).
// Pure functions, unit tested.
import { normalizeText, safeCategoryKey } from './category.js';

const clean = (name) => normalizeText(name).replace(/\s+/g, ' ').trim();
export const TEMPLATE_NAME_MAX = 100;
export const TEMPLATE_ITEMS_MAX = 200;

// [name, category] — twelve things most households buy every week.
const BASICS = {
  he: [['חלב', 'dairy'], ['ביצים', 'dairy'], ['לחם', 'bakery'], ['גבינה', 'dairy'], ['חמאה', 'dairy'], ['עגבניות', 'veg'], ['מלפפונים', 'veg'], ['בצל', 'veg'], ['תפוחי אדמה', 'veg'], ['בננות', 'fruit'], ['עוף', 'meat'], ['מים', 'drinks']],
  en: [['Milk', 'dairy'], ['Eggs', 'dairy'], ['Bread', 'bakery'], ['Cheese', 'dairy'], ['Butter', 'dairy'], ['Tomatoes', 'veg'], ['Cucumbers', 'veg'], ['Onions', 'veg'], ['Potatoes', 'veg'], ['Bananas', 'fruit'], ['Chicken', 'meat'], ['Water', 'drinks']],
  ar: [['حليب', 'dairy'], ['بيض', 'dairy'], ['خبز', 'bakery'], ['جبن', 'dairy'], ['زبدة', 'dairy'], ['طماطم', 'veg'], ['خيار', 'veg'], ['بصل', 'veg'], ['بطاطا', 'veg'], ['موز', 'fruit'], ['دجاج', 'meat'], ['ماء', 'drinks']],
  es: [['Leche', 'dairy'], ['Huevos', 'dairy'], ['Pan', 'bakery'], ['Queso', 'dairy'], ['Mantequilla', 'dairy'], ['Tomates', 'veg'], ['Pepinos', 'veg'], ['Cebollas', 'veg'], ['Patatas', 'veg'], ['Plátanos', 'fruit'], ['Pollo', 'meat'], ['Agua', 'drinks']],
  fr: [['Lait', 'dairy'], ['Œufs', 'dairy'], ['Pain', 'bakery'], ['Fromage', 'dairy'], ['Beurre', 'dairy'], ['Tomates', 'veg'], ['Concombres', 'veg'], ['Oignons', 'veg'], ['Pommes de terre', 'veg'], ['Bananes', 'fruit'], ['Poulet', 'meat'], ['Eau', 'drinks']],
  de: [['Milch', 'dairy'], ['Eier', 'dairy'], ['Brot', 'bakery'], ['Käse', 'dairy'], ['Butter', 'dairy'], ['Tomaten', 'veg'], ['Gurken', 'veg'], ['Zwiebeln', 'veg'], ['Kartoffeln', 'veg'], ['Bananen', 'fruit'], ['Hähnchen', 'meat'], ['Wasser', 'drinks']],
  ru: [['Молоко', 'dairy'], ['Яйца', 'dairy'], ['Хлеб', 'bakery'], ['Сыр', 'dairy'], ['Масло', 'dairy'], ['Помидоры', 'veg'], ['Огурцы', 'veg'], ['Лук', 'veg'], ['Картофель', 'veg'], ['Бананы', 'fruit'], ['Курица', 'meat'], ['Вода', 'drinks']],
  pt: [['Leite', 'dairy'], ['Ovos', 'dairy'], ['Pão', 'bakery'], ['Queijo', 'dairy'], ['Manteiga', 'dairy'], ['Tomates', 'veg'], ['Pepinos', 'veg'], ['Cebolas', 'veg'], ['Batatas', 'veg'], ['Bananas', 'fruit'], ['Frango', 'meat'], ['Água', 'drinks']],
  zh: [['牛奶', 'dairy'], ['鸡蛋', 'dairy'], ['面包', 'bakery'], ['奶酪', 'dairy'], ['黄油', 'dairy'], ['番茄', 'veg'], ['黄瓜', 'veg'], ['洋葱', 'veg'], ['土豆', 'veg'], ['香蕉', 'fruit'], ['鸡肉', 'meat'], ['水', 'drinks']],
  hi: [['दूध', 'dairy'], ['अंडे', 'dairy'], ['ब्रेड', 'bakery'], ['पनीर', 'dairy'], ['मक्खन', 'dairy'], ['टमाटर', 'veg'], ['खीरा', 'veg'], ['प्याज', 'veg'], ['आलू', 'veg'], ['केला', 'fruit'], ['चिकन', 'meat'], ['पानी', 'drinks']],
};

const BASICS_NAME = {
  he: 'בסיס', en: 'Basics', ar: 'الأساسيات', es: 'Básicos', fr: 'Essentiels', de: 'Basics',
  ru: 'Базовый набор', pt: 'Básicos', zh: '基础款', hi: 'बुनियादी',
};

const SHABBAT_HE = [['חלה', 'bakery'], ['יין', 'drinks'], ['מיץ ענבים', 'drinks'], ['נרות שבת', 'other'], ['עוף', 'meat'], ['תפוחי אדמה', 'veg'], ['ירקות לסלט', 'veg'], ['פירות', 'fruit'], ['עוגה', 'bakery'], ['חומוס', 'other']];

const toItems = (pairs) => pairs.map(([name, catKey]) => ({ name, catKey }));

// The ready-made templates for a language (Hebrew also has "Shabbat shopping").
export function builtinTemplates(lang) {
  const key = Object.hasOwn(BASICS, lang) ? lang : 'en';
  const list = [{ id: 'builtin:basics', name: BASICS_NAME[key], items: toItems(BASICS[key]), builtin: true }];
  if (lang === 'he') list.push({ id: 'builtin:shabbat', name: 'קניות שבת', items: toItems(SHABBAT_HE), builtin: true });
  return list;
}

// The items of a list, ready to be stored as a template.
export function templateFromItems(name, items) {
  const out = [];
  for (const item of items) {
    const itemName = typeof item.name === 'string' ? item.name.trim() : '';
    if (!itemName) continue;
    const entry = { name: itemName.slice(0, 200), catKey: safeCategoryKey(item.catKey) };
    if (typeof item.quantity === 'string' && item.quantity.trim()) entry.quantity = item.quantity.trim().slice(0, 40);
    if (typeof item.note === 'string' && item.note.trim()) entry.note = item.note.trim().slice(0, 200);
    out.push(entry);
    if (out.length === TEMPLATE_ITEMS_MAX) break;
  }
  return { name: String(name ?? '').trim().slice(0, TEMPLATE_NAME_MAX), items: out };
}

// What really has to be added: not what is already waiting on the list, and each name once.
export function itemsToAdd(template, currentItems) {
  const waiting = new Set(currentItems.filter((i) => i && i.bought === false && typeof i.name === 'string').map((i) => clean(i.name)));
  const added = [];
  for (const item of template.items) {
    const key = clean(item.name);
    if (!key || waiting.has(key)) continue;
    waiting.add(key);
    added.push(item);
  }
  return added;
}

// A template document from the database, made safe to use.
export function readTemplate(id, data) {
  const items = [];
  for (const raw of Array.isArray(data?.items) ? data.items : []) {
    if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) continue;
    const item = { name: raw.name.trim().slice(0, 200), catKey: safeCategoryKey(raw.catKey) };
    if (typeof raw.quantity === 'string' && raw.quantity.trim()) item.quantity = raw.quantity.trim().slice(0, 40);
    if (typeof raw.note === 'string' && raw.note.trim()) item.note = raw.note.trim().slice(0, 200);
    items.push(item);
  }
  return { id, name: typeof data?.name === 'string' ? data.name.slice(0, TEMPLATE_NAME_MAX) : '', items, createdBy: data?.createdBy, builtin: false };
}
