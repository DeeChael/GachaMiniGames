// ============================================================
// 黄金替罪羊 —— 预设关卡
// 来自 references/starrail-platjump/presets.md 的分享码
// ============================================================

import type { PlatLevel } from './types';
import { decodePlatLevel } from './shareCode';

const PRESET_CODES = [
  'SPJ2_eyJ2IjoyLCJuIjoi5rC45oGS5Zyj5Z-OLeWlpei1q-eOmyAwMSIsImMiOjEwLCJyIjo3LCJzIjo0LCJzcCI6IjAsMSIsImFsIjoiNiwxIiwicCI6IjAsMjsxLDI7MiwyOzMsMjs0LDI7NCwzOzMsNTs2LDM7Niw1OzYsMiIsInR5IjoiNSwyLDAiLCJ0YiI6IiIsImJ5IjoiMiwxIiwiYmIiOiIiLCJsIjoiIn0',
  'SPJ2_eyJ2IjoyLCJuIjoi5rC45oGS5Zyj5Z-OLeWlpei1q-eOmyAwMiIsImMiOjYsInIiOjcsInMiOjIsInNwIjoiMSwxIiwiYWwiOiI0LDEiLCJwIjoiNCw1OzMsNTsxLDQ7MiwzOzMsMzsxLDI7NCwyIiwidHkiOiIzLDIsMCIsInRiIjoiIiwiYnkiOiIzLDIiLCJiYiI6IiIsImwiOiIyLDIifQ',
  'SPJ2_eyJ2IjoyLCJuIjoi5rC45oGS5Zyj5Z-OLeWlpei1q-eOmyAwMyIsImMiOjgsInIiOjcsInMiOjUsInNwIjoiMCwxIiwiYWwiOiI3LDEiLCJwIjoiMSwyOzUsNTs0LDU7Myw1OzcsMjs1LDI7NCwyOzIsMjswLDI7MSwzIiwidHkiOiI2LDIsMDszLDIsMSIsImJ5IjoiMSwxIiwiYmIiOiIiLCJsIjoiIn0',
  'SPJ2_eyJ2IjoyLCJuIjoi5rC45oGS5Zyj5Z-OLeWlpei1q-eOmyAwNCIsImMiOjcsInIiOjcsInMiOjIsInNwIjoiMSwxIiwiYWwiOiI1LDIiLCJwIjoiMSw1OzEsMzs0LDM7NSwzOzUsMjszLDI7MiwyOzEsMiIsInR5IjoiNCwyLDEiLCJ0YiI6IiIsImJ5IjoiMywxIiwiYmIiOiIiLCJsIjoiIn0',
  'SPJ2_eyJ2IjoyLCJuIjoi5rW06KGA5oiY56uvLeaCrOmUi-WfjiAwMSIsImMiOjcsInIiOjcsInMiOjUsInNwIjoiMSwyIiwiYWwiOiIwLDAiLCJwIjoiNSw1OzQsNTszLDU7Niw1OzIsNDsxLDM7MiwxOzEsMTswLDEiLCJ0eSI6IjQsMSwwIiwidGIiOiI1LDEsMDszLDEsMCIsImJ5IjoiNCw0IiwiYmIiOiI1LDQ7Myw0IiwibCI6IjIsMzszLDQ7Niw0OzYsMzs2LDI7NiwxIn0',
  'SPJ2_eyJ2IjoyLCJuIjoi5rW06KGA5oiY56uvLeaCrOmUi-WfjiAwMiIsImMiOjEwLCJyIjo4LCJzIjo1LCJzcCI6IjQsMiIsImFsIjoiMyw1IiwicCI6IjcsNjs2LDY7NSw2OzMsNjswLDY7MSwxOzEsMjs0LDU7Niw1OzUsNDs0LDM7NiwzOzcsNTs5LDU7OSw0OzEsMyIsInR5IjoiMywzLDEiLCJ0YiI6IjMsNSwxIiwiYnkiOiI3LDQiLCJiYiI6IjYsNSIsImwiOiI1LDU7Niw0OzQsNDs1LDMifQ',
  'SPJ2_eyJ2IjoyLCJuIjoi5rW06KGA5oiY56uvLeaCrOmUi-WfjiAwMyIsImMiOjcsInIiOjcsInMiOjYsInNwIjoiMiwxIiwiYWwiOiI2LDQiLCJwIjoiNiw1OzQsNTsyLDU7MCw1OzYsMzs1LDI7MiwyOzEsMjszLDUiLCJ0eSI6IjEsNSwwOzUsNSwwOzYsMiwxIiwidGIiOiIiLCJieSI6IjAsNDs2LDIiLCJiYiI6IiIsImwiOiI0LDQ7NCwzOzMsNDszLDM7MywyOzQsMiJ9',
];

export const BUILTIN_LEVELS: PlatLevel[] = PRESET_CODES.map(decodePlatLevel);
