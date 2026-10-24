// Guesses a grocery category from an item name.
//
// The original matcher used String.includes on the raw text, so short keywords
// matched inside unrelated words ("ei" in "Seife", "date" in "update", "sal" in
// "salsa"). This one matches whole words, with a few per-language rules for
// plurals and word forms, and picks the most specific match when several
// categories apply.

export const CATEGORY_KEYWORDS = {
  he: {
    dairy: ['חלב', 'ביצים', 'ביצה', 'גבינה', 'יוגורט', 'קוטג', 'חמאה', 'שמנת', 'לבן', 'מעדן', 'גבינת שמנת', 'קרם'],
    bakery: ['לחם', 'פיתה', 'לחמניה', 'בגט', 'עוגה', 'חלה', 'קרואסון', 'טורטיה', 'לחמניות'],
    veg: ['עגבניה', 'עגבניות', 'מלפפון', 'מלפפונים', 'חסה', 'גזר', 'בצל', 'פלפל', 'תפוח אדמה', 'תפוחי אדמה', 'ירק', 'שום', 'כרוב', 'קישוא', 'חציל', 'תרד', 'פטריות', 'תירס', 'סלק', 'צנונית'],
    fruit: ['תפוח', 'בננה', 'תות', 'ענבים', 'אבטיח', 'מלון', 'פרי', 'תפוז', 'לימון', 'אבוקדו', 'קיווי', 'אפרסק', 'שזיף', 'אגס', 'מנגו', 'רימון', 'תמר'],
    meat: ['עוף', 'בשר', 'הודו', 'נקניק', 'סטייק', 'קציצות', 'שניצל', 'כבד', 'המבורגר', 'פרגית', 'כנפיים', 'טחון'],
    clean: ['נייר טואלט', 'סבון', 'שמפו', 'מגבון', 'אקונומיקה', 'ניקוי', 'מרכך', 'אבקת כביסה', 'ספוג', 'שקיות זבל', 'נוזל כלים', 'מטהר אוויר'],
    frozen: ['גלידה', 'פיצה קפואה', 'ירקות קפואים', 'שניצל קפוא', 'מלאווח', 'בורקס', 'קפוא', 'ארטיק', 'שרימפס קפוא'],
    snacks: ['חטיף', 'צ׳יפס', 'ביסלי', 'במבה', 'שוקולד', 'עוגיות', 'ממתק', 'סוכריות', 'גומי', 'פופקורן', 'קרקר', 'וופל', 'חטיפי אנרגיה'],
    drinks: ['מים', 'קולה', 'מיץ', 'סודה', 'בירה', 'יין', 'משקה אנרגיה', 'תה', 'קפה', 'שוקו', 'לימונדה', 'משקה קל'],
    baking: ['קמח', 'סוכר', 'שמרים', 'תבלין', 'מלח', 'שמן', 'שמן זית', 'אבקת אפייה', 'וניל', 'קקאו', 'דבש', 'רסק עגבניות', 'חומץ', 'ציר', 'פלפל שחור'],
  },
  en: {
    dairy: ['milk', 'egg', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'cottage', 'sour cream', 'cream cheese'],
    bakery: ['bread', 'pita', 'bun', 'baguette', 'cake', 'challah', 'croissant', 'tortilla', 'roll', 'bagel'],
    veg: ['tomato', 'cucumber', 'lettuce', 'carrot', 'onion', 'pepper', 'potato', 'vegetable', 'garlic', 'cabbage', 'zucchini', 'eggplant', 'spinach', 'mushroom', 'corn', 'beet', 'radish', 'broccoli'],
    fruit: ['apple', 'banana', 'strawberry', 'strawberries', 'grape', 'watermelon', 'melon', 'fruit', 'orange', 'lemon', 'avocado', 'kiwi', 'peach', 'plum', 'pear', 'mango', 'pomegranate', 'date'],
    meat: ['chicken', 'beef', 'turkey', 'sausage', 'steak', 'meatball', 'meat', 'schnitzel', 'liver', 'burger', 'wings', 'ground beef', 'mince', 'pepperoni', 'salami'],
    clean: ['toilet paper', 'soap', 'shampoo', 'wipes', 'bleach', 'cleaning', 'detergent', 'softener', 'sponge', 'trash bag', 'dish soap', 'air freshener'],
    frozen: ['ice cream', 'frozen pizza', 'frozen vegetable', 'frozen schnitzel', 'burekas', 'frozen', 'popsicle', 'frozen shrimp'],
    snacks: ['snack', 'chips', 'chocolate', 'cookie', 'candy', 'candies', 'sweets', 'gummy', 'popcorn', 'cracker', 'wafer', 'energy bar'],
    drinks: ['water', 'cola', 'juice', 'soda', 'beer', 'wine', 'energy drink', 'tea', 'coffee', 'chocolate milk', 'lemonade', 'soft drink'],
    baking: ['flour', 'sugar', 'yeast', 'spice', 'salt', 'oil', 'baking powder', 'vanilla', 'cocoa', 'honey', 'tomato paste', 'vinegar', 'broth'],
  },
  es: {
    dairy: ['leche', 'huevo', 'queso', 'yogur', 'mantequilla', 'crema', 'requesón', 'nata'],
    bakery: ['pan', 'pita', 'bollo', 'baguette', 'pastel', 'croissant', 'tortilla', 'bagel'],
    veg: ['tomate', 'pepino', 'lechuga', 'zanahoria', 'cebolla', 'pimiento', 'papa', 'patata', 'verdura', 'ajo', 'repollo', 'calabacín', 'berenjena', 'espinaca', 'champiñón', 'maíz', 'remolacha', 'rábano'],
    fruit: ['manzana', 'plátano', 'banana', 'fresa', 'uva', 'sandía', 'melón', 'fruta', 'naranja', 'limón', 'aguacate', 'kiwi', 'durazno', 'ciruela', 'pera', 'mango', 'granada', 'dátil'],
    meat: ['pollo', 'res', 'carne', 'pavo', 'salchicha', 'bistec', 'albóndiga', 'hígado', 'hamburguesa', 'alitas'],
    clean: ['papel higiénico', 'jabón', 'champú', 'toallitas', 'lejía', 'limpieza', 'suavizante', 'esponja', 'bolsa de basura', 'lavavajillas'],
    frozen: ['helado', 'pizza congelada', 'verdura congelada', 'congelado', 'paleta', 'camarón congelado'],
    snacks: ['snack', 'papas fritas', 'chocolate', 'galleta', 'dulce', 'caramelo', 'palomitas', 'galletas saladas'],
    drinks: ['agua', 'refresco', 'jugo', 'zumo', 'cerveza', 'vino', 'bebida energética', 'té', 'café', 'limonada'],
    baking: ['harina', 'azúcar', 'levadura', 'especia', 'sal', 'aceite', 'polvo de hornear', 'vainilla', 'cacao', 'miel', 'vinagre'],
  },
  fr: {
    dairy: ['lait', 'œuf', 'oeuf', 'fromage', 'yaourt', 'beurre', 'crème', 'fromage blanc'],
    bakery: ['pain', 'pita', 'petit pain', 'baguette', 'gâteau', 'croissant', 'tortilla', 'bagel'],
    veg: ['tomate', 'concombre', 'laitue', 'carotte', 'oignon', 'poivron', 'pomme de terre', 'légume', 'ail', 'chou', 'courgette', 'aubergine', 'épinard', 'champignon', 'maïs', 'betterave', 'radis'],
    fruit: ['pomme', 'banane', 'fraise', 'raisin', 'pastèque', 'melon', 'fruit', 'orange', 'citron', 'avocat', 'kiwi', 'pêche', 'prune', 'poire', 'mangue', 'grenade', 'datte'],
    meat: ['poulet', 'bœuf', 'boeuf', 'dinde', 'saucisse', 'steak', 'boulette', 'viande', 'foie', 'burger', 'ailes'],
    clean: ['papier toilette', 'savon', 'shampooing', 'lingette', 'javel', 'nettoyage', 'adoucissant', 'éponge', 'sac poubelle', 'liquide vaisselle'],
    frozen: ['glace', 'pizza surgelée', 'légume surgelé', 'surgelé', 'esquimau', 'crevette surgelée'],
    snacks: ['snack', 'chips', 'chocolat', 'biscuit', 'bonbon', 'confiserie', 'pop-corn', 'cracker'],
    drinks: ['eau', 'cola', 'jus', 'soda', 'bière', 'vin', 'boisson énergisante', 'thé', 'café', 'limonade'],
    baking: ['farine', 'sucre', 'levure', 'épice', 'sel', 'huile', 'levure chimique', 'vanille', 'cacao', 'miel', 'vinaigre'],
  },
  de: {
    dairy: ['milch', 'ei', 'eier', 'käse', 'joghurt', 'butter', 'sahne', 'quark', 'schmand'],
    bakery: ['brot', 'pita', 'brötchen', 'baguette', 'kuchen', 'croissant', 'tortilla', 'bagel'],
    veg: ['tomate', 'gurke', 'salat', 'karotte', 'zwiebel', 'paprika', 'kartoffel', 'gemüse', 'knoblauch', 'kohl', 'zucchini', 'aubergine', 'spinat', 'pilz', 'mais', 'rote bete', 'radieschen'],
    fruit: ['apfel', 'banane', 'erdbeere', 'traube', 'wassermelone', 'melone', 'obst', 'orange', 'zitrone', 'avocado', 'kiwi', 'pfirsich', 'pflaume', 'birne', 'mango', 'granatapfel', 'dattel'],
    meat: ['huhn', 'hähnchen', 'rind', 'rindfleisch', 'schwein', 'pute', 'wurst', 'steak', 'frikadelle', 'fleisch', 'leber', 'burger', 'flügel'],
    clean: ['toilettenpapier', 'seife', 'shampoo', 'feuchttücher', 'bleiche', 'reinigung', 'weichspüler', 'schwamm', 'müllbeutel', 'spülmittel'],
    frozen: ['eis', 'tiefkühlpizza', 'tiefkühlgemüse', 'gefroren', 'wassereis', 'tiefkühlgarnelen'],
    snacks: ['snack', 'chips', 'schokolade', 'keks', 'süßigkeit', 'bonbon', 'popcorn', 'cracker'],
    drinks: ['wasser', 'cola', 'saft', 'limonade', 'bier', 'wein', 'energydrink', 'tee', 'kaffee'],
    baking: ['mehl', 'zucker', 'hefe', 'gewürz', 'salz', 'öl', 'backpulver', 'vanille', 'kakao', 'honig', 'essig'],
  },
  ru: {
    dairy: ['молоко', 'молока', 'яйцо', 'яйца', 'сыр', 'йогурт', 'масло', 'сметана', 'творог', 'сливки'],
    bakery: ['хлеб', 'хлеба', 'пита', 'булка', 'багет', 'торт', 'круассан', 'лаваш', 'бублик'],
    veg: ['помидор', 'огурец', 'салат', 'морковь', 'лук', 'перец', 'картофель', 'овощ', 'чеснок', 'капуста', 'кабачок', 'баклажан', 'шпинат', 'гриб', 'кукуруза', 'свекла', 'редис'],
    fruit: ['яблоко', 'банан', 'клубника', 'виноград', 'арбуз', 'дыня', 'фрукт', 'апельсин', 'лимон', 'авокадо', 'киви', 'персик', 'слива', 'груша', 'манго', 'гранат', 'финик'],
    meat: ['курица', 'говядина', 'индейка', 'колбаса', 'стейк', 'котлета', 'мясо', 'мяса', 'печень', 'бургер', 'крылья'],
    clean: ['туалетная бумага', 'мыло', 'шампунь', 'салфетки', 'отбеливатель', 'уборка', 'кондиционер для белья', 'губка', 'мешок для мусора', 'средство для посуды'],
    frozen: ['мороженое', 'замороженная пицца', 'замороженные овощи', 'замороженный', 'фруктовый лед', 'замороженные креветки'],
    snacks: ['снек', 'чипсы', 'шоколад', 'печенье', 'конфета', 'сладости', 'попкорн', 'крекер'],
    drinks: ['вода', 'воды', 'кола', 'сок', 'газировка', 'пиво', 'вино', 'энергетик', 'чай', 'кофе', 'лимонад'],
    baking: ['мука', 'муки', 'сахар', 'дрожжи', 'специя', 'соль', 'соли', 'подсолнечное масло', 'растительное масло', 'оливковое масло', 'разрыхлитель', 'ваниль', 'какао', 'мёд', 'уксус'],
  },
  pt: {
    dairy: ['leite', 'ovo', 'queijo', 'iogurte', 'manteiga', 'creme', 'requeijão', 'nata'],
    bakery: ['pão', 'pita', 'pãozinho', 'baguete', 'bolo', 'croissant', 'tortilla', 'bagel'],
    veg: ['tomate', 'pepino', 'alface', 'cenoura', 'cebola', 'pimentão', 'batata', 'legume', 'alho', 'repolho', 'abobrinha', 'berinjela', 'espinafre', 'cogumelo', 'milho', 'beterraba', 'rabanete'],
    fruit: ['maçã', 'banana', 'morango', 'uva', 'melancia', 'melão', 'fruta', 'laranja', 'limão', 'abacate', 'kiwi', 'pêssego', 'ameixa', 'pera', 'manga', 'romã', 'tâmara'],
    meat: ['frango', 'carne bovina', 'peru', 'salsicha', 'bife', 'almôndega', 'carne', 'fígado', 'hambúrguer', 'asinha'],
    clean: ['papel higiênico', 'sabão', 'shampoo', 'lenço umedecido', 'água sanitária', 'limpeza', 'amaciante', 'esponja', 'saco de lixo', 'detergente'],
    frozen: ['sorvete', 'pizza congelada', 'vegetal congelado', 'congelado', 'picolé', 'camarão congelado'],
    snacks: ['salgadinho', 'batata frita', 'chocolate', 'biscoito', 'doce', 'bala', 'pipoca', 'bolacha'],
    drinks: ['água', 'refrigerante', 'suco', 'cerveja', 'vinho', 'energético', 'chá', 'café', 'limonada'],
    baking: ['farinha', 'açúcar', 'fermento', 'tempero', 'sal', 'óleo', 'fermento em pó', 'baunilha', 'cacau', 'mel', 'vinagre'],
  },
  zh: {
    dairy: ['牛奶', '鸡蛋', '奶酪', '酸奶', '黄油', '奶油', '芝士'],
    bakery: ['面包', '皮塔饼', '小圆面包', '法棍', '蛋糕', '牛角包', '百吉饼'],
    veg: ['西红柿', '番茄', '黄瓜', '生菜', '胡萝卜', '洋葱', '辣椒', '土豆', '蔬菜', '大蒜', '卷心菜', '西葫芦', '茄子', '菠菜', '蘑菇', '玉米', '甜菜', '萝卜'],
    fruit: ['苹果', '香蕉', '草莓', '葡萄', '西瓜', '甜瓜', '水果', '橙子', '柠檬', '牛油果', '猕猴桃', '桃子', '李子', '梨', '芒果', '石榴', '枣'],
    meat: ['鸡肉', '牛肉', '火鸡', '香肠', '牛排', '肉丸', '肉', '肝', '汉堡', '鸡翅'],
    clean: ['卫生纸', '肥皂', '洗发水', '湿巾', '漂白剂', '清洁', '柔顺剂', '海绵', '垃圾袋', '洗洁精'],
    frozen: ['冰淇淋', '冷冻披萨', '冷冻蔬菜', '冷冻', '冰棍', '冷冻虾'],
    snacks: ['零食', '薯片', '巧克力', '饼干', '糖果', '爆米花'],
    drinks: ['水', '可乐', '果汁', '汽水', '啤酒', '葡萄酒', '功能饮料', '茶', '咖啡', '柠檬水'],
    baking: ['面粉', '糖', '酵母', '香料', '盐', '油', '泡打粉', '香草', '可可', '蜂蜜', '醋'],
  },
  hi: {
    dairy: ['दूध', 'अंडा', 'पनीर', 'दही', 'मक्खन', 'क्रीम'],
    bakery: ['ब्रेड', 'पिटा', 'बन', 'बैगेट', 'केक', 'क्रोइसैंट'],
    veg: ['टमाटर', 'खीरा', 'सलाद पत्ता', 'गाजर', 'प्याज', 'शिमला मिर्च', 'आलू', 'सब्जी', 'लहसुन', 'पत्ता गोभी', 'बैंगन', 'पालक', 'मशरूम', 'मक्का', 'चुकंदर', 'मूली'],
    fruit: ['सेब', 'केला', 'स्ट्रॉबेरी', 'अंगूर', 'तरबूज', 'खरबूजा', 'फल', 'संतरा', 'नींबू', 'एवोकाडो', 'कीवी', 'आड़ू', 'आलूबुखारा', 'नाशपाती', 'आम', 'अनार', 'खजूर'],
    meat: ['चिकन', 'बीफ', 'टर्की', 'सॉसेज', 'स्टेक', 'मीटबॉल', 'मांस', 'लिवर', 'बर्गर'],
    clean: ['टॉयलेट पेपर', 'साबुन', 'शैम्पू', 'वाइप्स', 'ब्लीच', 'सफाई', 'सॉफ्टनर', 'स्पंज', 'कचरा बैग', 'डिश सोप'],
    frozen: ['आइसक्रीम', 'फ्रोज़न पिज़्ज़ा', 'फ्रोज़न सब्ज़ी', 'फ्रोज़न', 'फ्रोज़न झींगा'],
    snacks: ['नाश्ता', 'चिप्स', 'चॉकलेट', 'कुकी', 'मिठाई', 'कैंडी', 'पॉपकॉर्न'],
    drinks: ['पानी', 'कोला', 'जूस', 'सोडा', 'बीयर', 'वाइन', 'एनर्जी ड्रिंक', 'चाय', 'कॉफी', 'नींबू पानी'],
    baking: ['आटा', 'चीनी', 'खमीर', 'मसाला', 'नमक', 'तेल', 'बेकिंग पाउडर', 'वेनिला', 'कोको', 'शहद', 'सिरका'],
  },
  ar: {
    dairy: ['حليب', 'بيض', 'جبن', 'زبادي', 'زبدة', 'قشطة', 'لبنة'],
    bakery: ['خبز', 'بيتا', 'كعك', 'باغيت', 'كيك', 'كرواسون', 'تورتيلا'],
    veg: ['طماطم', 'خيار', 'خس', 'جزر', 'بصل', 'فلفل', 'بطاطا', 'بطاطس', 'خضار', 'ثوم', 'ملفوف', 'كوسة', 'باذنجان', 'سبانخ', 'فطر', 'ذرة', 'شمندر', 'فجل'],
    fruit: ['تفاح', 'موز', 'فراولة', 'عنب', 'بطيخ', 'شمام', 'فاكهة', 'برتقال', 'ليمون', 'أفوكادو', 'كيوي', 'خوخ', 'برقوق', 'كمثرى', 'مانجو', 'رمان', 'تمر'],
    meat: ['دجاج', 'لحم بقري', 'ديك رومي', 'نقانق', 'ستيك', 'كرات لحم', 'لحم', 'كبد', 'برغر', 'أجنحة'],
    clean: ['ورق تواليت', 'صابون', 'شامبو', 'مناديل مبللة', 'مبيض', 'تنظيف', 'منعم', 'إسفنجة', 'كيس قمامة', 'سائل جلي'],
    frozen: ['آيس كريم', 'بيتزا مجمدة', 'خضار مجمد', 'مجمد', 'بوظة على عصا', 'روبيان مجمد'],
    snacks: ['وجبة خفيفة', 'شيبس', 'شوكولاتة', 'بسكويت', 'حلوى', 'سكاكر', 'فشار', 'كراكر'],
    drinks: ['ماء', 'كولا', 'عصير', 'صودا', 'بيرة', 'نبيذ', 'مشروب طاقة', 'شاي', 'قهوة', 'ليموناضة', 'ليمونادة'],
    baking: ['طحين', 'سكر', 'خميرة', 'بهار', 'ملح', 'زيت', 'بيكنج باودر', 'فانيليا', 'كاكاو', 'عسل', 'خل'],
  },
};

// Colours per category (what used to be inlined in guessCategory).
export const CATEGORY_COLORS = {
  dairy: 'var(--teal)', bakery: 'var(--yellow)', veg: '#4ade80', fruit: '#fb923c',
  meat: 'var(--coral)', clean: 'var(--purple)',
  frozen: '#60a5fa', snacks: '#f472b6', drinks: '#38bdf8', baking: '#d97706',
  other: 'var(--pink)',
};

// The order categories appear in on the list.
export const CATEGORY_ORDER = ['dairy', 'bakery', 'veg', 'fruit', 'meat', 'frozen', 'snacks', 'drinks', 'baking', 'clean', 'other'];

// A category key read from Firestore is only trusted if it is one of ours
// ("constructor", "__proto__" or injected markup become "other").
export function safeCategoryKey(key) {
  return typeof key === 'string' && Object.hasOwn(CATEGORY_COLORS, key) ? key : 'other';
}

// The colour always comes from the key, never from a colour stored in the document.
export function categoryColor(key) {
  return CATEGORY_COLORS[safeCategoryKey(key)];
}

// Languages where the main noun comes first ("jugo de naranja", "מיץ תפוזים"), so an
// earlier match wins; elsewhere ("orange juice", "Orangensaft") the later one does.
const HEAD_FIRST = new Set(['he', 'ar', 'es', 'fr', 'pt']);
// Endings that still count as the same word (plurals).
const SUFFIXES = {
  en: ['s', 'es'], es: ['s', 'es'], pt: ['s', 'es'], fr: ['s', 'x', 'es'],
  de: ['e', 'en', 'n', 'er', 's'], he: ['ים', 'ות'], ar: ['ات', 'ين', 'ون'],
};
const HEBREW_PREFIXES = 'הבלוכמש'; // the, in, to, and, like, from, that
const MIN_SUFFIX_LEN = 3;          // shorter keywords must match exactly
const MIN_COMPOUND_LEN = 4;        // German: keyword at the end of a compound word

// Lowercase, drop accents/niqqud/harakat so "azucar" matches "azúcar".
// (The breve, U+0306, is kept so Russian й survives.)
export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-̅̇-֑ͯ-ׇً-ٰٟ]/g, '')
    .normalize('NFKC');
}

function tokenize(text) {
  return normalizeText(text).split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
}

const compiled = new Map();
function compile(lang) {
  if (compiled.has(lang)) return compiled.get(lang);
  const sets = CATEGORY_KEYWORDS[lang] || CATEGORY_KEYWORDS.en;
  const entries = [];
  Object.keys(sets).forEach((cat, catIndex) => {
    for (const word of sets[cat]) {
      const tokens = lang === 'zh' ? null : tokenize(word);
      entries.push({ cat, catIndex, text: normalizeText(word), tokens });
    }
  });
  compiled.set(lang, entries);
  return entries;
}

// Spellings of a token we should also try: Hebrew with leading prefix letters
// removed ("והחלב" -> "החלב" -> "חלב"), Arabic without "ال".
function variants(token, lang) {
  const out = [token];
  if (lang === 'he') {
    let t = token;
    for (let i = 0; i < 2; i++) {
      if (t.length > 2 && HEBREW_PREFIXES.includes(t[0])) { t = t.slice(1); out.push(t); } else break;
    }
  } else if (lang === 'ar' && token.startsWith('ال') && token.length > 4) {
    out.push(token.slice(2));
  }
  return out;
}

const EXACT = 2;
const INFLECTED = 1;

// How does one typed word match one keyword word? 0 = no match.
function wordMatch(word, kw, lang) {
  for (const v of variants(word, lang)) {
    if (v === kw) return EXACT;
    if (kw.length >= MIN_SUFFIX_LEN && v.startsWith(kw) && (SUFFIXES[lang] || []).includes(v.slice(kw.length))) return INFLECTED;
    if (lang === 'de' && kw.length >= MIN_COMPOUND_LEN && v.length - kw.length >= 4 && v.endsWith(kw)) return INFLECTED;
    if (lang === 'ru' && kw.length >= 4) {
      const stem = kw.length >= 5 && /[аяоеуюы]$/.test(kw) ? kw.slice(0, -1) : kw;
      if (v.startsWith(stem) && v.length - stem.length <= 3) return INFLECTED;
    }
  }
  return 0;
}

// Every keyword found in the text: { cat, words, kind, start, end, len }.
function findMatches(text, lang) {
  const entries = compile(lang);
  const found = [];
  if (lang === 'zh') {
    const hay = normalizeText(text);
    for (const e of entries) {
      let from = 0;
      for (;;) {
        const at = hay.indexOf(e.text, from);
        if (at === -1) break;
        found.push({ cat: e.cat, catIndex: e.catIndex, words: e.text.length, kind: EXACT, start: at, end: at + e.text.length, len: e.text.length });
        from = at + 1;
      }
    }
    return found;
  }
  const words = tokenize(text);
  for (const e of entries) {
    const m = e.tokens.length;
    for (let i = 0; i + m <= words.length; i++) {
      let kind = EXACT;
      let ok = true;
      for (let j = 0; j < m; j++) {
        const k = wordMatch(words[i + j], e.tokens[j], lang);
        if (!k) { ok = false; break; }
        kind = Math.min(kind, k);
      }
      if (ok) found.push({ cat: e.cat, catIndex: e.catIndex, words: m, kind, start: i, end: i + m, len: e.text.length });
    }
  }
  return found;
}

// Most specific match wins: more words, then exact over inflected, then the
// position that holds the main noun, then the longer keyword.
function better(a, b, headFirst) {
  if (a.words !== b.words) return a.words > b.words;
  if (a.kind !== b.kind) return a.kind > b.kind;
  if (a.start !== b.start && headFirst) return a.start < b.start;
  if (a.end !== b.end && !headFirst) return a.end > b.end;
  if (a.len !== b.len) return a.len > b.len;
  return a.catIndex < b.catIndex;
}

export function guessCategoryKey(name, lang = 'en') {
  const matches = findMatches(name, lang);
  if (matches.length === 0) return 'other';
  const headFirst = HEAD_FIRST.has(lang);
  let best = matches[0];
  for (const m of matches) if (better(m, best, headFirst)) best = m;
  return best.cat;
}
