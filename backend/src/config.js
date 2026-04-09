import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
export const backendRoot = path.resolve(__dirname, '..');
export const projectRoot = path.resolve(backendRoot, '..');
export const dataFilePath = path.join(backendRoot, 'data', 'store.json');
export const referencesDir = path.join(projectRoot, 'reference');

export const supportedModels = [
  'openai/gpt-oss-20b:free',
  'qwen/qwen3.6-plus',
  'stepfun/step-3.5-flash',
  'qwen/qwen3.6-plus-preview',
  'nvidia/nemotron-3-super-120b-a12b:free'
];

export const surveyQuestions = {
  pre: [
    'I can plan lessons that accommodate learners with diverse needs.',
    'I can modify lesson objectives appropriately for learners with SEN.',
    'I feel confident selecting inclusive support strategies.',
    'I can contextualize lessons to meet the needs of my diverse learners.',
    'I know how to document reflections after teaching an inclusive lesson.'
  ],
  post: [
    'I can plan lessons that accommodate learners with diverse needs.',
    'I can modify lesson objectives appropriately for learners with SEN.',
    'I feel confident selecting inclusive support strategies.',
    'I can contextualize lessons to meet the needs of my diverse learners.',
    'I know how to document reflections after teaching an inclusive lesson.'
  ]
};