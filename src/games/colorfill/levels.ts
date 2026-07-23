// ============================================================
// 溢彩画 —— 预设关卡
// 来自 references/wuwa-colorfilling/presets.md 的分享码
// ============================================================

import type { FillLevel } from './types';
import { decodeFillLevel } from './shareCode';

const PRESET_CODES = [
  'WCF1_eyJ2IjoxLCJuIjoi6LWe5oK85Zyj6L-5IDAxIiwiciI6OCwiYyI6MTAsInQiOiJncmVlbiIsInMiOjMsImciOiJycmd5Z3liYmdycnJyeXJ5YmJncnl5eXlieWJ5Z3JyeWJiYmJiYmdyeXl5YnlieWJncnl5YmJ5YnliZ3JyZ2diZ2J5YnJycnJyYnlieWJyciJ9',
  'WCF1_eyJ2IjoxLCJuIjoi6LWe5oK85Zyj6L-5IDAyIiwiciI6OCwiYyI6MTAsInQiOiJibHVlIiwicyI6MywiZyI6ImJnZ2JiYnl5cnJyYmdnYmJ5eXJycnJiZ2dieXlnZ3JycmdnZ3l5YmJiYnl5eXl5eXJyYmJ5Z2diYmJycmJ5eWdiYmJnZ2JieWdnZ2dnZ2JiIn0',
  'WCF1_eyJ2IjoxLCJuIjoi6LWe5oK85Zyj6L-5IDAzIiwiciI6OCwiYyI6MTAsInQiOiJibHVlIiwicyI6NCwiZyI6Inl5eXl5cnJycnJ5eXl5eXJycnJyeXliYmJiYmJycnl5cnJyeXl5cnJiYnJycnl5eWJiYmJ5eXlycnJiYmJieXl5cnJyYmJiYnl5eXJycmJiIn0',
  'WCF1_eyJ2IjoxLCJuIjoi5ouC6aOO5rC055WUIDAxIiwiciI6OCwiYyI6MTAsInQiOiJibHVlIiwicyI6MywiZyI6InJycnJyYmJiYmJyYmJicmJnZ2dncmJiYnJiZ2JiZ3JieXl5eXl5eWdycnJycmJnZ2dnYmJ5YmJiYmJ5YmJieWJiYmJieWJiYnl5eXl5eXliIn0',
  'WCF1_eyJ2IjoxLCJuIjoi5ouC6aOO5rC055WUIDAyIiwiciI6OCwiYyI6MTAsInQiOiJibHVlIiwicyI6NCwiZyI6InlyYmJ5eXl5eXl5cnJ5eXl5eXl5eWJ5eWJnZ2JieXlieXlneXl5Z3l5cnl5Ynl5eWd5eWdiYmd5cnJieXl5eXl5eXJ5eXl5eWdnZ3JieXl5In0',
  'WCF1_eyJ2IjoxLCJuIjoi5ouC6aOO5rC055WUIDAzIiwiciI6OCwiYyI6MTAsInQiOiJibHVlIiwicyI6MywiZyI6InlycmJ5eXl5Ynl5cnJieXl5eWJ5Z2dnZ2dnZ2dnZ3lycmJnZ2dnYnl5cnJieWdnZ2J5eXJyYnl5Z2dieXlycmJ5eXlnYnl5cnJieXl5eWJ5In0',
  'WCF1_eyJ2IjoxLCJuIjoi5ouC6aOO5rC055WUIDA0IiwiciI6OCwiYyI6MTAsInQiOiJ5ZWxsb3ciLCJzIjozLCJnIjoieXJ5eXliZ3lieWJiYmJiYmd5Ynl5cmJycnJncmJ5eXJicnl5Z3JieXlyYnJ5Z2dyYnl5eWJ5eWd5cmJ5eXliYmJnYmJieWdnZ2dnZ3lycnIifQ',
];

export const BUILTIN_LEVELS: FillLevel[] = PRESET_CODES.map(decodeFillLevel);
