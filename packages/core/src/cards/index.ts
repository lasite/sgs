/**
 * Default card registry — instantiates one with every Phase 3 behaviour
 * registered.  Tests/demos can build their own registries, or extend
 * this one.
 */

import { CardRegistry } from './registry.js';
import { shaBehaviour } from './basic/sha.js';
import { shanBehaviour } from './basic/shan.js';
import { taoBehaviour } from './basic/tao.js';
import { jiuBehaviour } from './basic/jiu.js';
import { wuZhongShengYouBehaviour } from './trick/wu-zhong-sheng-you.js';
import { guoHeChaiQiaoBehaviour } from './trick/guo-he-chai-qiao.js';
import { shunShouQianYangBehaviour } from './trick/shun-shou-qian-yang.js';
import { taoYuanJieYiBehaviour } from './trick/tao-yuan-jie-yi.js';
import { jueDouBehaviour } from './trick/jue-dou.js';
import { nanManRuQinBehaviour, wanJianQiFaBehaviour } from './trick/aoe.js';
import { wuGuFengDengBehaviour } from './trick/wu-gu-feng-deng.js';
import { wuXieKeJiBehaviour } from './trick/wu-xie-ke-ji.js';
import {
  jieDaoShaRenStub,
  leBuSiShuStub,
  bingLiangCunDuanStub,
  shanDianStub,
} from './trick/stubs.js';
import { equipmentBehaviours } from './equipment/passive.js';

export * from './registry.js';
export * from './helpers.js';

export const buildDefaultCardRegistry = (): CardRegistry => {
  const r = new CardRegistry();
  r.register(shaBehaviour);
  r.register(shanBehaviour);
  r.register(taoBehaviour);
  r.register(jiuBehaviour);
  r.register(wuZhongShengYouBehaviour);
  r.register(guoHeChaiQiaoBehaviour);
  r.register(shunShouQianYangBehaviour);
  r.register(taoYuanJieYiBehaviour);
  r.register(jueDouBehaviour);
  r.register(nanManRuQinBehaviour);
  r.register(wanJianQiFaBehaviour);
  r.register(wuGuFengDengBehaviour);
  r.register(wuXieKeJiBehaviour);
  r.register(jieDaoShaRenStub);
  r.register(leBuSiShuStub);
  r.register(bingLiangCunDuanStub);
  r.register(shanDianStub);
  for (const eq of equipmentBehaviours) r.register(eq);
  return r;
};
