const VEGETABLE_WORDS = ['青菜','蔬菜','生菜','菠菜','卷心菜','卷芯菜','黄瓜','番茄','莴笋','蘑菇','豆角','刀豆','茄子','西兰花','花菜','白菜','芹菜','萝卜','沙拉'];
const CARB_WORDS = ['米饭','白米','紫米','面包','面条','米线','泡面','粥','玉米','紫薯','红薯','地瓜','土豆','蒸饺','饺子','馒头','包子','手抓饼','葱油饼','月饼','燕麦'];
const PROTEIN_WORDS = ['鸡蛋','蛋羹','牛肉','鸡肉','猪肉','红烧肉','鱼','虾','蛤蜊','豆浆','牛奶','豆腐','百叶','花生','坚果','肉'];
const ANAEROBIC = /力量|无氧|壶铃|哑铃|卧推|胸推|高位下拉|深蹲|硬拉|农夫行走|抗扭转|肌肉|撸铁|训练|平板支撑/;

function countWords(text, words) {
  return words.reduce((total, word) => total + (text.split(word).length - 1), 0);
}

function rawScore(value) {
  const match = String(value || '').match(/(?:^|[^\d])(10|[0-9](?:\.\d)?)(?:[^\d]|$)/);
  if (!match) return null;
  const score = Number(match[1]);
  return score >= 0 && score <= 10 ? score : null;
}

function fallbackSplit(score) {
  if (score >= 8.5) return { vegetables: 48, carbs: 27, protein: 25 };
  if (score >= 7) return { vegetables: 38, carbs: 37, protein: 25 };
  return { vegetables: 30, carbs: 45, protein: 25 };
}

function nutrition(entry) {
  const text = `${entry.dietText || ''} ${entry.dietScoreRaw || ''}`.trim();
  if (!text) return null;
  const vegetablesCount = countWords(text, VEGETABLE_WORDS);
  const carbsCount = countWords(text, CARB_WORDS);
  const proteinCount = countWords(text, PROTEIN_WORDS);
  const total = vegetablesCount + carbsCount + proteinCount;
  const recordedScore = rawScore(entry.dietScoreRaw);
  if (!total) {
    const score = recordedScore === null ? 6 : recordedScore;
    return Object.assign({ score }, fallbackSplit(score));
  }
  const vegetables = Math.round(vegetablesCount / total * 100);
  const carbs = Math.round(carbsCount / total * 100);
  const protein = Math.max(0, 100 - vegetables - carbs);
  const deviation = Math.abs(vegetables - 50) + Math.abs(carbs - 25) + Math.abs(protein - 25);
  const score = recordedScore === null ? Math.max(0, Math.min(10, Number((10 - deviation / 12).toFixed(1)))) : recordedScore;
  return { score, vegetables, carbs, protein };
}

function exercise(text) {
  if (!text) return { aerobicMinutes: 0, anaerobicMinutes: 0, totalMinutes: 0, score: null };
  let aerobicMinutes = 0;
  let anaerobicMinutes = 0;
  const regex = /([^，,；;。]{0,24}?)(\d+(?:\.\d+)?)\s*分钟/g;
  let match;
  while ((match = regex.exec(text))) {
    const minutes = Number(match[2]);
    if (ANAEROBIC.test(match[1])) anaerobicMinutes += minutes;
    else aerobicMinutes += minutes;
  }
  const totalMinutes = aerobicMinutes + anaerobicMinutes;
  return { aerobicMinutes, anaerobicMinutes, totalMinutes, score: totalMinutes ? Number(Math.min(10, totalMinutes / 6).toFixed(1)) : null };
}

function parseText(rawText, inputMode, localDate) {
  const text = rawText.trim();
  const weightMatch = text.match(/(?:体重|早上|今早|今天)?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:公斤|千克|kg|KG)/);
  const weightKg = weightMatch ? Number(weightMatch[1]) : null;
  const activityMatches = [...text.matchAll(/([^，,；;。]{0,30}(?:运动|走|跑|游泳|爬坡|椭圆机|力量|壶铃|哑铃|训练|平板支撑)[^，,；;。]{0,30})/g)];
  const dietMatches = [...text.matchAll(/([^，,；;。]{0,36}(?:吃|喝|早餐|早饭|午餐|午饭|晚餐|晚饭|蔬菜|鸡蛋|米饭|面|肉|鱼|虾)[^，,；;。]{0,36})/g)];
  const activityText = activityMatches.map(item => item[1].trim()).join('；') || null;
  const dietText = dietMatches.map(item => item[1].trim()).join('；') || null;
  const missing = [];
  if (weightKg === null) missing.push('体重');
  if (!dietText) missing.push('饮食');
  if (!activityText) missing.push('运动');
  return {
    rawText: text,
    localDate,
    inputMode,
    weightKg,
    weightRaw: weightMatch ? weightMatch[0] : null,
    dietText,
    dietScoreRaw: null,
    activityText,
    contextTags: [],
    uncertainties: missing,
    followupQuestion: missing.length === 1 ? `今天的${missing[0]}要不要再补一句？` : null,
    parserMode: 'local'
  };
}

module.exports = { nutrition, exercise, parseText };
