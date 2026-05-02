/**
 * 国战标准版 武将名册 (~50 generals across 4 kingdoms).
 *
 * Skill IDs follow `<kingdom>-<general>-<skill-name-pinyin>` convention.
 * Skill *behaviours* are wired up in `skills/<kingdom>/*.ts` and are
 * optional — generals listed here without skill implementations are
 * data-only stubs that Phase 4+ commits will fill in.
 *
 * Companions seed 珠联璧合 (Phase 5).  The list is symmetric — only one
 * side needs to declare; the engine handles bidirectional lookup.
 */

import type { General, GeneralId, SkillId, Kingdom } from '../model/general.js';

const g = (s: string): GeneralId => s as GeneralId;
const sk = (s: string): SkillId => s as SkillId;

interface Spec {
  id: string;
  name: string;
  kingdoms: readonly [Kingdom] | readonly [Kingdom, Kingdom];
  hp: number;
  gender: General['gender'];
  skills: readonly string[];
  companion?: readonly string[];
}

const SPECS: readonly Spec[] = [
  // ── 魏 ─────────────────────────────────────────────
  { id: 'cao-cao', name: '曹操', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-caocao-jianxiong', 'wei-caocao-hujia'] },
  { id: 'sima-yi', name: '司马懿', kingdoms: ['wei'], hp: 3, gender: 'male',
    skills: ['wei-simayi-guicai', 'wei-simayi-fankui'] },
  { id: 'xiahou-dun', name: '夏侯惇', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-xiahoudun-ganglie'] },
  { id: 'zhang-liao', name: '张辽', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-zhangliao-tuxi'] },
  { id: 'xu-chu', name: '许褚', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-xuchu-luoyi'] },
  { id: 'guo-jia', name: '郭嘉', kingdoms: ['wei'], hp: 3, gender: 'male',
    skills: ['wei-guojia-tiandu', 'wei-guojia-yiji'] },
  { id: 'zhen-ji', name: '甄姬', kingdoms: ['wei'], hp: 3, gender: 'female',
    skills: ['wei-zhenji-luoshen', 'wei-zhenji-qingguo'],
    companion: ['cao-pi'] },
  { id: 'cao-pi', name: '曹丕', kingdoms: ['wei'], hp: 3, gender: 'male',
    skills: ['wei-caopi-xingshang', 'wei-caopi-fangzhu'],
    companion: ['zhen-ji'] },
  { id: 'xiahou-yuan', name: '夏侯渊', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-xiahouyuan-shensu'] },
  { id: 'cao-ren', name: '曹仁', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-caoren-jushou'] },
  { id: 'zhang-he', name: '张郃', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-zhanghe-qiaobian'] },
  { id: 'xu-huang', name: '徐晃', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-xuhuang-duanliang'] },
  { id: 'yu-jin', name: '于禁', kingdoms: ['wei'], hp: 4, gender: 'male',
    skills: ['wei-yujin-yizhong'] },

  // ── 蜀 ─────────────────────────────────────────────
  { id: 'liu-bei', name: '刘备', kingdoms: ['shu'], hp: 4, gender: 'male',
    skills: ['shu-liubei-rende', 'shu-liubei-jijiang'],
    companion: ['guan-yu', 'zhang-fei'] },
  { id: 'guan-yu', name: '关羽', kingdoms: ['shu'], hp: 4, gender: 'male',
    skills: ['shu-guanyu-wusheng'],
    companion: ['liu-bei', 'zhang-fei'] },
  { id: 'zhang-fei', name: '张飞', kingdoms: ['shu'], hp: 4, gender: 'male',
    skills: ['shu-zhangfei-paoxiao'],
    companion: ['liu-bei', 'guan-yu'] },
  { id: 'zhu-ge-liang', name: '诸葛亮', kingdoms: ['shu'], hp: 3, gender: 'male',
    skills: ['shu-zhugeliang-guanxing', 'shu-zhugeliang-kongcheng'] },
  { id: 'zhao-yun', name: '赵云', kingdoms: ['shu'], hp: 4, gender: 'male',
    skills: ['shu-zhaoyun-longdan'] },
  { id: 'ma-chao', name: '马超', kingdoms: ['shu'], hp: 4, gender: 'male',
    skills: ['shu-machao-tieji', 'shu-machao-mashu'] },
  { id: 'huang-zhong', name: '黄忠', kingdoms: ['shu'], hp: 4, gender: 'male',
    skills: ['shu-huangzhong-liegong'] },
  { id: 'wei-yan', name: '魏延', kingdoms: ['shu'], hp: 4, gender: 'male',
    skills: ['shu-weiyan-kuanggu'] },
  { id: 'pang-tong', name: '庞统', kingdoms: ['shu', 'qun'], hp: 3, gender: 'male',
    skills: ['shu-pangtong-lianhuan', 'shu-pangtong-niepan'] },
  { id: 'jiang-wei', name: '姜维', kingdoms: ['shu'], hp: 4, gender: 'male',
    skills: ['shu-jiangwei-tiaoxin', 'shu-jiangwei-zhiji'] },
  { id: 'liu-shan', name: '刘禅', kingdoms: ['shu'], hp: 3, gender: 'male',
    skills: ['shu-liushan-xiangle', 'shu-liushan-fangquan'] },
  { id: 'ma-liang', name: '马良', kingdoms: ['shu'], hp: 3, gender: 'male',
    skills: ['shu-maliang-yingyuan'] },

  // ── 吴 ─────────────────────────────────────────────
  { id: 'sun-quan', name: '孙权', kingdoms: ['wu'], hp: 4, gender: 'male',
    skills: ['wu-sunquan-zhiheng', 'wu-sunquan-jiuyuan'] },
  { id: 'gan-ning', name: '甘宁', kingdoms: ['wu'], hp: 4, gender: 'male',
    skills: ['wu-ganning-qixi'] },
  { id: 'lu-meng', name: '吕蒙', kingdoms: ['wu'], hp: 4, gender: 'male',
    skills: ['wu-lumeng-keji'] },
  { id: 'huang-gai', name: '黄盖', kingdoms: ['wu'], hp: 4, gender: 'male',
    skills: ['wu-huanggai-kurou'] },
  { id: 'zhou-yu', name: '周瑜', kingdoms: ['wu'], hp: 3, gender: 'male',
    skills: ['wu-zhouyu-yingzi', 'wu-zhouyu-fanjian'],
    companion: ['xiao-qiao'] },
  { id: 'lu-xun', name: '陆逊', kingdoms: ['wu'], hp: 3, gender: 'male',
    skills: ['wu-luxun-qianxun', 'wu-luxun-lianying'] },
  { id: 'sun-shang-xiang', name: '孙尚香', kingdoms: ['wu'], hp: 3, gender: 'female',
    skills: ['wu-sunshangxiang-jieyin', 'wu-sunshangxiang-xiaoji'] },
  { id: 'sun-jian', name: '孙坚', kingdoms: ['wu'], hp: 4, gender: 'male',
    skills: ['wu-sunjian-yinghun'],
    companion: ['sun-ce'] },
  { id: 'sun-ce', name: '孙策', kingdoms: ['wu'], hp: 4, gender: 'male',
    skills: ['wu-sunce-jiang', 'wu-sunce-hunzi'],
    companion: ['sun-jian', 'da-qiao'] },
  { id: 'tai-shi-ci', name: '太史慈', kingdoms: ['wu'], hp: 4, gender: 'male',
    skills: ['wu-taishici-tianyi'] },
  { id: 'da-qiao', name: '大乔', kingdoms: ['wu'], hp: 3, gender: 'female',
    skills: ['wu-daqiao-guose', 'wu-daqiao-liuli'],
    companion: ['xiao-qiao', 'sun-ce'] },
  { id: 'xiao-qiao', name: '小乔', kingdoms: ['wu', 'qun'], hp: 3, gender: 'female',
    skills: ['wu-xiaoqiao-tianxiang', 'wu-xiaoqiao-hongyan'],
    companion: ['da-qiao', 'zhou-yu'] },

  // ── 群 ─────────────────────────────────────────────
  { id: 'hua-tuo', name: '华佗', kingdoms: ['qun'], hp: 3, gender: 'male',
    skills: ['qun-huatuo-jijiu', 'qun-huatuo-qingnang'] },
  { id: 'lu-bu', name: '吕布', kingdoms: ['qun'], hp: 5, gender: 'male',
    skills: ['qun-lubu-wushuang'],
    companion: ['diao-chan'] },
  { id: 'diao-chan', name: '貂蝉', kingdoms: ['qun'], hp: 3, gender: 'female',
    skills: ['qun-diaochan-lijian', 'qun-diaochan-biyue'],
    companion: ['lu-bu'] },
  { id: 'yuan-shao', name: '袁绍', kingdoms: ['qun'], hp: 4, gender: 'male',
    skills: ['qun-yuanshao-luanji'] },
  { id: 'jia-xu', name: '贾诩', kingdoms: ['qun'], hp: 3, gender: 'male',
    skills: ['qun-jiaxu-wansha', 'qun-jiaxu-luanwu', 'qun-jiaxu-weimu'] },
  { id: 'zhang-jiao', name: '张角', kingdoms: ['qun'], hp: 3, gender: 'male',
    skills: ['qun-zhangjiao-leiji', 'qun-zhangjiao-guidao'] },
  { id: 'dong-zhuo', name: '董卓', kingdoms: ['qun'], hp: 4, gender: 'male',
    skills: ['qun-dongzhuo-jiuchi', 'qun-dongzhuo-baonue'] },
  { id: 'zuo-ci', name: '左慈', kingdoms: ['qun'], hp: 3, gender: 'male',
    skills: ['qun-zuoci-huashen'] },
  { id: 'yu-ji', name: '于吉', kingdoms: ['qun'], hp: 3, gender: 'male',
    skills: ['qun-yuji-guhuo'] },
  { id: 'cai-wen-ji', name: '蔡文姬', kingdoms: ['qun'], hp: 3, gender: 'female',
    skills: ['qun-caiwenji-beige', 'qun-caiwenji-duanchang'] },
  { id: 'yan-liang-wen-chou', name: '颜良文丑', kingdoms: ['qun'], hp: 4, gender: 'male',
    skills: ['qun-yanliangwenchou-shuangxiong'] },
];

export const ALL_GENERALS: readonly General[] = SPECS.map((s) => ({
  id: g(s.id),
  name: s.name,
  kingdoms: s.kingdoms,
  hp: s.hp,
  gender: s.gender,
  skills: s.skills.map(sk),
  ...(s.companion ? { companion: s.companion.map(g) } : {}),
}));

export const generalById = (id: GeneralId): General => {
  const found = ALL_GENERALS.find((x) => x.id === id);
  if (!found) throw new Error(`unknown general ${id}`);
  return found;
};

export const generalsByKingdom = (k: Kingdom): readonly General[] =>
  ALL_GENERALS.filter((g) => g.kingdoms.includes(k));
