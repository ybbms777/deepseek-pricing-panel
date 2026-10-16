#!/usr/bin/env node
// 定时核对 DeepSeek 官方定价页，发现漂移就报警。
//
// 面板的价格、时段规则与节假日数据都是"抄下来"的，官方一改就会静默过期。
// 这个脚本把官方页当作唯一事实来源，逐项比对仓库里的 index.html：
//   1. 价格与并发（按官方表的出现顺序逐个数比对）
//   2. 高峰时段规则原句（北京时间周一至周五 9:00-12:00、14:00-18:00，不含法定节假日）
//   3. 节假日覆盖年份（当年未录入即报警——2027 年通知发布后需要有人补 DATA_METADATA）
//
//   node tools/check-upstream.mjs          人类可读报告；漂移 exit 1，网络错误 exit 2
//   node tools/check-upstream.mjs --json   机器可读
//
// 只读：不写入任何文件，不联网除官方定价页外的地方，不需要 API key。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PANEL = path.join(HERE, '..', 'index.html');
const SOURCE = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/';
const RULE_SENTENCE = '北京时间周一至周五（不含中国法定节假日）9:00 - 12:00、14:00 - 18:00 为高峰时段';

const json = process.argv.includes('--json');
const problems = [];
const notes = [];

function fail(kind, detail) {
  problems.push({ kind, detail });
}

function panelFacts() {
  const html = readFileSync(PANEL, 'utf8');
  const core = html.split('/*CORE-START*/')[1].split('/*CORE-END*/')[0];
  const { PRICES, DATA_METADATA, HOLIDAYS } = new Function(
    core + '\nreturn {PRICES, DATA_METADATA, HOLIDAYS};'
  )();
  const models = Object.keys(PRICES);
  // 期望顺序与官方表一致：逐指标「空闲(模型1, 模型2) → 高峰(模型1, 模型2)」
  const expected = [];
  for (const metric of ['hit', 'miss', 'out']) {
    expected.push(PRICES[models[0]][metric][0], PRICES[models[1]][metric][0],
                  PRICES[models[0]][metric][1], PRICES[models[1]][metric][1]);
  }
  expected.push(PRICES[models[0]].conc, PRICES[models[1]].conc);
  return { models, expected, DATA_METADATA, holidayCount: HOLIDAYS.size };
}

function plainText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageFacts(text) {
  // 价格区：从第一次出现「空闲时段」到「并发限制」之间，正好是官方表里那 12 个价格，
  // 顺序为「命中/未命中/输出」各自的 空闲-模型1、空闲-模型2、高峰-模型1、高峰-模型2。
  const priceStart = text.indexOf('空闲时段');
  const concAt = text.indexOf('并发限制');
  const priceRegion = (priceStart >= 0 && concAt > priceStart) ? text.slice(priceStart, concAt) : '';
  const prices = (priceRegion.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  // 并发区：紧接着「并发限制」的两个大数字
  const concRegion = concAt >= 0 ? text.slice(concAt, concAt + 160) : '';
  const conc = (concRegion.match(/\d+/g) ?? []).map(Number).filter(n => n > 100);
  return {
    rulePresent: text.includes(RULE_SENTENCE),
    modelNamesPresent: ['deepseek-flash', 'deepseek-v4-pro'].filter(n => text.includes(n)),
    prices,
    conc,
  };
}

function beijingYear() {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()));
}

async function main() {
  const facts = panelFacts();
  const year = beijingYear();

  // 3) 节假日覆盖：当年未录入就必须有人去补，这是"会静默过期"的主要来源
  if (!facts.DATA_METADATA.holiday_years.includes(year)) {
    fail('holiday-coverage',
      `${year} 年节假日未录入（DATA_METADATA.holiday_years = ${JSON.stringify(facts.DATA_METADATA.holiday_years)}）；`
      + '该年份的时段、切换与汇总目前只是按周规则的估算，需按国务院办公厅通知补 HOLIDAYS 与 holiday_years。');
  }
  if (facts.DATA_METADATA.holiday_years.length && facts.holidayCount === 0) {
    fail('holiday-data', 'holiday_years 非空但 HOLIDAYS 集合为空，数据自相矛盾。');
  }

  let res;
  try {
    res = await fetch(SOURCE, { headers: { 'user-agent': 'deepseek-pricing-panel drift check' } });
  } catch (e) {
    console.error(`无法访问官方定价页（${SOURCE}）：${e.message}`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(`官方定价页返回 HTTP ${res.status}；无法判定是否漂移。`);
    process.exit(2);
  }

  const page = pageFacts(plainText(await res.text()));

  // 2) 规则原句
  if (!page.rulePresent) {
    fail('peak-rule', '官方页未见原句「' + RULE_SENTENCE + '」；时段规则可能已改写，需人工核对。');
  }
  // 表头模型名
  for (const m of facts.models) {
    if (!page.modelNamesPresent.includes(m)) fail('model-name', `官方页未出现模型名 ${m}。`);
  }
  // 1) 价格与并发逐个比对
  const wantPrices = facts.expected.slice(0, 12);
  const wantConc = facts.expected.slice(12);
  const got = page.prices;
  if (got.length < wantPrices.length) {
    fail('price-parse', `官方页价格区只解析出 ${got.length} 个数字，期望 ${wantPrices.length} 个；页面结构可能已变。`);
  } else {
    wantPrices.forEach((want, i) => {
      if (Number(got[i]) !== Number(want)) {
        fail('price', `第 ${i + 1} 个价格不同：官方 ${got[i]} vs 面板 ${want}`
          + '（顺序：命中/未命中/输出 各自的 空闲-模型1、空闲-模型2、高峰-模型1、高峰-模型2）。');
      }
    });
  }
  if (page.conc.length < wantConc.length) {
    fail('conc-parse', `官方页并发区只解析出 ${page.conc.length} 个数字，期望 ${wantConc.length} 个。`);
  } else {
    wantConc.forEach((want, i) => {
      if (page.conc[i] !== Number(want)) {
        fail('concurrency', `并发上限不同：官方 ${page.conc[i]} vs 面板 ${want}。`);
      }
    });
  }

  const report = {
    checked_at: new Date().toISOString(),
    source: SOURCE,
    panel_pricing_checked_on: facts.DATA_METADATA.pricing_checked_on,
    holiday_years: facts.DATA_METADATA.holiday_years,
    beijing_year: year,
    expected_numbers: facts.expected,
    scraped_numbers: got,
    scraped_concurrency: page.conc,
    problems,
  };

  if (json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');

  if (problems.length === 0) {
    if (!json) {
      console.log('官方定价页与面板一致，且当年节假日已录入。');
      console.log(`  价格核对：面板记录为 ${facts.DATA_METADATA.pricing_checked_on}，本次实测 ${got.join(', ')}`);
      console.log(`  节假日覆盖：${facts.DATA_METADATA.holiday_years.join('、')}（共 ${facts.holidayCount} 天）`);
    }
    process.exit(0);
  }

  if (!json) {
    console.error(`发现 ${problems.length} 项漂移：`);
    for (const p of problems) console.error(`  [${p.kind}] ${p.detail}`);
    console.error('\n处理方式：核对官方页后更新 index.html（PRICES / DATA_METADATA / HOLIDAYS），');
    console.error('同步 desktop/dist：node desktop/tools/sync-panel.mjs，然后重跑面板测试。');
  }
  process.exit(1);
}

await main();
