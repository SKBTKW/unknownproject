import assert from 'node:assert/strict';
import { AdvisorContentController } from '../game/src/ui/advisor/advisor_content_controller.js';
class El {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.textContent='';this.className='';this.dataset={};this.attributes={};}
  appendChild(x){this.children.push(x);return x;}
  replaceChildren(){this.children=[];}
  setAttribute(k,v){this.attributes[k]=v;}
  findAll(cls){return [...(this.className.split(' ').includes(cls)?[this]:[]),...this.children.flatMap(x=>x.findAll(cls))];}
}
globalThis.document={createElement:tag=>new El(tag)};
const data={knownEnemyState:{reports:[{id:'r8',observedAtVerse:8,observations:[{facet:'DIRECTION',tag:'NORTH_ACTIVITY'}]}]}};
const i18n={t:key=>({UI_ADVISOR_TOPIC_ENEMY:'亜人情報',UI_ADVISOR_TOPIC_LAND:'土地開拓',UI_ADVISOR_TOPIC_STATUS:'状況',UI_ADVISOR_TOPIC_NO_EVIDENCE:'情報なし',INVESTIGATION_TAG_NORTH_ACTIVITY:'北方で活動の痕跡',INVESTIGATION_STATUS_NEW:'新たに判明',UI_ADVISOR_REPORT_PLACEHOLDER:'報告なし'})[key]||key};
const ctrl=new AdvisorContentController({stateProvider:()=>data,i18n});
const root=new El('div');ctrl.renderTopicReport(root);
assert.equal(root.children.length,3);
assert.deepEqual(root.findAll('advisor-report-topic-title').map(x=>x.textContent),['亜人情報','土地開拓','状況']);
assert.deepEqual(root.findAll('advisor-topic-known-fact').map(x=>x.textContent),['北方で活動の痕跡']);
assert.deepEqual(root.findAll('advisor-topic-verse').map(x=>x.textContent),['Verse 8']);
assert.equal(root.findAll('advisor-content-note').length,1);
assert.equal(root.findAll('advisor-report-topic')[0].tagName,'DETAILS');
assert.equal(root.findAll('advisor-report-topic-title')[0].tagName,'SUMMARY');
console.log('PASS advisor topic report DOM');
