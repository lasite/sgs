/**
 * Default skill registry — installs every Phase 4 skill setup.
 * Skills not yet implemented are absent from the registry; calling
 * `install` for an absent skill is a no-op (see `SkillRegistry.install`).
 */

import { SkillRegistry } from './registry.js';
import type { SkillId } from '../model/general.js';
import { jianXiongSetup } from './wei/cao-cao.js';
import { fanKuiSetup } from './wei/sima-yi.js';
import { gangLieSetup } from './wei/xiahou-dun.js';
import { paoXiaoSetup } from './shu/zhang-fei.js';
import { zhiHengSetup } from './wu/sun-quan.js';
import { jiJiuSetup } from './qun/hua-tuo.js';

export * from './registry.js';

export const buildDefaultSkillRegistry = (): SkillRegistry => {
  const r = new SkillRegistry();
  r.register('wei-caocao-jianxiong' as SkillId, jianXiongSetup);
  r.register('wei-simayi-fankui' as SkillId, fanKuiSetup);
  r.register('wei-xiahoudun-ganglie' as SkillId, gangLieSetup);
  r.register('shu-zhangfei-paoxiao' as SkillId, paoXiaoSetup);
  r.register('wu-sunquan-zhiheng' as SkillId, zhiHengSetup);
  r.register('qun-huatuo-jijiu' as SkillId, jiJiuSetup);
  return r;
};
