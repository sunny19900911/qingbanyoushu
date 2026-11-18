// 本地原型精选动作库。来源信息仅用于内部素材管理，不在动作卡片中展示。
// 正式发布前需按 assets/exercises/NOTICE.md 完成媒体授权核验。
const SOURCE_REPOSITORY = 'wangmuerxiao/exercises-dataset-zh';

const EXERCISES = [
  {
    id: '2133', name: '农夫行走', bodyPart: '全身', muscle: '核心 · 握力 · 臀腿', level: '入门', equipment: '哑铃或壶铃',
    image: '/assets/exercises/farmers-walk.gif',
    steps: ['两侧提起相同重量，站直并收稳躯干。', '目视前方，用自然小步稳定行走。', '到达距离后屈髋屈膝，安全放下。'],
    cue: '像提着两只购物袋稳稳走路。', caution: '重量以身体不歪斜、不憋气为准。'
  },
  {
    id: '0534', name: '壶铃杯式深蹲', bodyPart: '下肢', muscle: '臀腿 · 股四头肌', level: '熟悉动作', equipment: '壶铃',
    image: '/assets/exercises/kettlebell-goblet-squat.gif',
    steps: ['双手把壶铃托在胸前，双脚约与肩同宽。', '臀部向后下方坐，膝盖跟随脚尖方向。', '脚掌踩稳，站回起点。'],
    cue: '胸口打开，脚掌始终踩实。', caution: '膝、髋或腰部疼痛时停止，并让教练检查动作。'
  },
  {
    id: '1459', name: '哑铃罗马尼亚硬拉', bodyPart: '下肢', muscle: '臀肌 · 大腿后侧', level: '需教练确认', equipment: '哑铃',
    image: '/assets/exercises/dumbbell-romanian-deadlift.gif',
    steps: ['哑铃放在大腿前侧，膝盖保持微屈。', '臀部向后推，哑铃贴近腿部下降。', '感到大腿后侧拉伸后，收紧臀部站起。'],
    cue: '这是向后推屁股，不是弯腰够地。', caution: '背部无法保持稳定或出现腰痛时立即停止。'
  },
  {
    id: '0431', name: '哑铃踏台阶', bodyPart: '下肢', muscle: '臀腿 · 单腿稳定', level: '需教练确认', equipment: '哑铃与踏台',
    image: '/assets/exercises/dumbbell-step-up.gif',
    steps: ['一只脚完整踩在稳固踏台上。', '以前脚脚跟发力，将身体带到台面。', '控制速度退回地面，再换边。'],
    cue: '台阶宁低一点，身体不要左右晃。', caution: '先确认踏台稳固；平衡不足时不负重。'
  },
  {
    id: '0381', name: '哑铃后撤弓步', bodyPart: '下肢', muscle: '臀肌 · 股四头肌', level: '需教练确认', equipment: '哑铃',
    image: '/assets/exercises/dumbbell-rear-lunge.gif',
    steps: ['站稳后，一只脚向后迈出。', '前脚掌踩稳，身体垂直下降。', '前脚发力站回，再换另一侧。'],
    cue: '先求站稳，再增加下蹲幅度。', caution: '平衡不稳时扶住固定物并取消负重。'
  },
  {
    id: '3013', name: '臀桥', bodyPart: '下肢', muscle: '臀肌 · 核心', level: '入门', equipment: '自重',
    image: '/assets/exercises/glute-bridge.gif',
    steps: ['仰卧屈膝，双脚平放在地面。', '收紧腹部和臀部，将髋部抬起。', '身体接近一条直线后停顿，再慢慢落下。'],
    cue: '用臀部抬起，不要用腰向上顶。', caution: '腰部不适时缩小幅度或暂停。'
  },
  {
    id: '1373', name: '站姿提踵', bodyPart: '下肢', muscle: '小腿', level: '入门', equipment: '自重',
    image: '/assets/exercises/standing-calf-raise.gif',
    steps: ['站直并轻扶稳固物体。', '缓慢抬起脚跟，把重量移到前脚掌。', '顶部停顿，再控制脚跟落下。'],
    cue: '慢慢升、慢慢落，不要弹跳。', caution: '平衡不足时必须扶稳。'
  },
  {
    id: '0710', name: '站姿髋外展', bodyPart: '下肢', muscle: '臀中肌 · 髋外展肌', level: '入门', equipment: '自重',
    image: '/assets/exercises/side-hip-abduction.gif',
    steps: ['站直并扶住稳固物体。', '一条腿保持伸直，缓慢向侧面抬起。', '骨盆保持稳定，控制落回后换边。'],
    cue: '身体别歪，腿不用抬得很高。', caution: '髋部疼痛时停止。'
  },
  {
    id: '0493', name: '上斜俯卧撑', bodyPart: '胸部', muscle: '胸肌 · 肱三头肌', level: '入门', equipment: '长凳或高台',
    image: '/assets/exercises/incline-push-up.gif',
    steps: ['双手撑在稳固高台上，身体保持直线。', '弯曲手肘，让胸部靠近高台。', '推回起点，全程保持躯干稳定。'],
    cue: '台面越高越容易，先选能稳定完成的高度。', caution: '确认台面不会滑动；肩腕疼痛时停止。'
  },
  {
    id: '0289', name: '哑铃卧推', bodyPart: '胸部', muscle: '胸肌 · 肱三头肌', level: '需教练确认', equipment: '哑铃与训练凳',
    image: '/assets/exercises/dumbbell-bench-press.gif',
    steps: ['躺稳，双脚踩地，哑铃位于胸部两侧。', '向上推起哑铃，不让肩膀耸起。', '控制哑铃回到胸侧。'],
    cue: '肩胛骨收稳，重量宁轻勿重。', caution: '第一次练习需要教练保护和确认重量。'
  },
  {
    id: '0180', name: '坐姿绳索划船', bodyPart: '背部', muscle: '中背 · 背阔肌', level: '入门', equipment: '绳索器械',
    image: '/assets/exercises/seated-cable-row.gif',
    steps: ['坐稳并保持脊柱自然，双手握住把手。', '肩胛骨先向后收，再让手肘向后拉。', '控制手臂前伸，不含胸、不猛放。'],
    cue: '先动肩胛骨，再让手肘向后走。', caution: '腰背无法保持稳定时降低重量。'
  },
  {
    id: '2330', name: '高位下拉', bodyPart: '背部', muscle: '背阔肌 · 上背', level: '入门', equipment: '绳索器械',
    image: '/assets/exercises/lat-pulldown.gif',
    steps: ['坐稳并握住横杆，胸口自然打开。', '把横杆拉向上胸，同时肩胛骨向下收。', '控制横杆回升，不借身体后仰。'],
    cue: '想象把手肘放进身体两侧的口袋。', caution: '不要把横杆拉到颈后。'
  },
  {
    id: '0541', name: '壶铃单臂划船', bodyPart: '背部', muscle: '上背 · 背阔肌', level: '需教练确认', equipment: '壶铃',
    image: '/assets/exercises/kettlebell-one-arm-row.gif',
    steps: ['屈髋并保持背部自然，一只手握壶铃。', '手肘贴近身体，把壶铃拉向躯干。', '控制放下，完成后换边。'],
    cue: '身体保持不转，手肘沿身体向后走。', caution: '腰背不适或躯干无法稳定时暂停。'
  },
  {
    id: '0405', name: '坐姿哑铃肩推', bodyPart: '肩部', muscle: '三角肌 · 肱三头肌', level: '需教练确认', equipment: '哑铃',
    image: '/assets/exercises/dumbbell-shoulder-press.gif',
    steps: ['坐稳，哑铃停在肩膀两侧。', '保持躯干稳定，把哑铃向上推起。', '缓慢回到肩侧，不让手臂突然下落。'],
    cue: '肋骨别向前顶，重量宁轻勿重。', caution: '肩颈不适时停止。'
  },
  {
    id: '0334', name: '哑铃侧平举', bodyPart: '肩部', muscle: '三角肌中束', level: '入门', equipment: '哑铃',
    image: '/assets/exercises/dumbbell-lateral-raise.gif',
    steps: ['站稳，手肘微屈，哑铃放在身体两侧。', '手臂向侧面抬到接近肩高。', '慢慢放下，不借身体摆动。'],
    cue: '小重量、慢速度，不需要抬过肩膀。', caution: '肩部疼痛时停止。'
  },
  {
    id: '0285', name: '交替哑铃弯举', bodyPart: '手臂', muscle: '肱二头肌', level: '入门', equipment: '哑铃',
    image: '/assets/exercises/dumbbell-biceps-curl.gif',
    steps: ['站稳，双臂自然放在身体两侧。', '保持上臂不动，交替弯曲手肘。', '在最高点停顿，再缓慢放下。'],
    cue: '手肘别向前跑，身体不要晃。', caution: '肘腕不适时减轻重量或停止。'
  },
  {
    id: '2188', name: '坐姿哑铃臂屈伸', bodyPart: '手臂', muscle: '肱三头肌', level: '需教练确认', equipment: '哑铃',
    image: '/assets/exercises/dumbbell-triceps-extension.gif',
    steps: ['坐稳，双手把哑铃举过头顶。', '上臂靠近耳侧，弯曲手肘让哑铃下降。', '伸直手臂回到起点。'],
    cue: '肋骨收住，上臂不要向两侧散开。', caution: '肩、肘不适时不要勉强。'
  },
  {
    id: '0276', name: '死虫式', bodyPart: '核心', muscle: '腹部 · 躯干稳定', level: '入门', equipment: '自重',
    image: '/assets/exercises/dead-bug.gif',
    steps: ['仰卧，髋膝约成直角，双臂指向上方。', '收紧腹部，让对侧手臂和腿缓慢远离身体。', '腰部保持稳定，回到起点后换边。'],
    cue: '动作可以小，但腰不要离开地面。', caution: '腰部拱起时缩小动作幅度。'
  },
  {
    id: '3239', name: '平板支撑拍肩', bodyPart: '核心', muscle: '核心 · 肩部稳定', level: '熟悉动作', equipment: '自重',
    image: '/assets/exercises/plank-shoulder-tap.gif',
    steps: ['进入高位平板支撑，双手位于肩下。', '保持髋部稳定，一只手轻拍对侧肩膀。', '手掌落回后换边，避免身体左右摇晃。'],
    cue: '双脚分开一点，会更容易保持稳定。', caution: '腕、肩或腰部疼痛时停止；可改为跪姿。'
  },
  {
    id: '0549', name: '壶铃摆动', bodyPart: '全身', muscle: '臀腿 · 核心', level: '需教练确认', equipment: '壶铃',
    image: '/assets/exercises/kettlebell-swing.gif',
    steps: ['双脚站稳，屈髋把壶铃带到两腿之间。', '臀部快速向前伸展，让壶铃自然摆起。', '壶铃回落时再次屈髋承接。'],
    cue: '力量来自臀部，不是用手臂把壶铃抬起来。', caution: '这是技术动作，未经教练确认不要自行加重量。'
  }
].map(item => ({
  ...item,
  sourceId: `EXERCISES-DATASET-ZH-${item.id}`,
  sourceUrl: `https://github.com/${SOURCE_REPOSITORY}`,
  license: 'Prototype evaluation only; media rights require release review'
}));

const CATEGORIES = ['全部', '全身', '下肢', '胸部', '背部', '肩部', '手臂', '核心'];

const LEGACY_ID_MAP = {
  Farmers_Walk: '2133',
  Seated_Cable_Rows: '0180',
  Dumbbell_Shoulder_Press: '0405',
  Seated_Side_Lateral_Raise: '0334'
};

function getExercise(id) {
  const resolvedId = LEGACY_ID_MAP[id] || id;
  return EXERCISES.find(item => item.id === resolvedId) || null;
}
function listExercises(category = '全部') { return category === '全部' ? EXERCISES : EXERCISES.filter(item => item.bodyPart === category); }

module.exports = { EXERCISES, CATEGORIES, getExercise, listExercises };
