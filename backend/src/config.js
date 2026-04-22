import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
export const backendRoot = path.resolve(__dirname, '..');
export const projectRoot = path.resolve(backendRoot, '..');
export const runtimeRoot = process.env.INSPIRE_RUNTIME_ROOT
  ? path.resolve(process.env.INSPIRE_RUNTIME_ROOT)
  : projectRoot;
export const dataRootDir = process.env.INSPIRE_DATA_DIR
  ? path.resolve(process.env.INSPIRE_DATA_DIR)
  : path.join(backendRoot, 'data');
export const dataFilePath = path.join(dataRootDir, 'store.json');
export const referencesDir = process.env.INSPIRE_REFERENCE_DIR
  ? path.resolve(process.env.INSPIRE_REFERENCE_DIR)
  : path.join(runtimeRoot, 'reference');

export const supportedModels = [
  'openai/gpt-oss-20b:free',
  'qwen/qwen3.6-plus',
  'stepfun/step-3.5-flash',
  'qwen/qwen3.6-plus-preview',
  'nvidia/nemotron-3-super-120b-a12b:free'
];

export const surveyQuestions = {
  pre: [
    'I find it difficult to accommodate learners with special needs in my class.',
    'I struggle to modify lesson content for learners with different ability levels.',
    'I lack confidence in selecting appropriate strategies for diverse learners.',
    'I have limited training in Special Needs Education.',
    'I find it challenging to create differentiated learning activities.',
    'I am unsure how to adapt my assessment methods for learners with SEN.',
    'I have difficulty managing behavior of learners with special needs.',
    'I lack access to resources and materials for inclusive teaching.',
    'I feel overwhelmed when planning for multiple types of learners.',
    'I am unsure how to contextualize instruction for learners with SEN.',
    'I can contextualize lessons to meet the needs of my diverse learners.',
    'I can apply differentiated instruction effectively in my classroom.',
    'I am confident in identifying learners who need special education support.',
    'I can modify lesson objectives appropriately for learners with SEN.',
    'I am able to accommodate learners with physical or sensory difficulties.',
    'I can design activities that promote participation for all learners.',
    'I use evidence-based strategies when teaching learners with SEN.',
    'I regularly reflect on my inclusive teaching practices.',
    'I collaborate with school staff to support learners with special needs.',
    'I feel equipped to use technology tools to support inclusive instruction.'
  ],
  post: [
    'I now find it easier to accommodate learners with special needs in my class.',
    'I can now modify lesson content for learners with different ability levels.',
    'I feel more confident selecting strategies for diverse learners.',
    'My training and practice in Special Needs Education has improved.',
    'I can now create differentiated learning activities more effectively.',
    'I can now adapt assessment methods for learners with SEN.',
    'I can better manage behavior of learners with special needs.',
    'I can identify and maximize available resources for inclusive teaching.',
    'I feel more organized when planning for multiple types of learners.',
    'I can contextualize instruction for learners with SEN with confidence.',
    'I can contextualize lessons to meet the needs of my diverse learners.',
    'I can apply differentiated instruction effectively in my classroom.',
    'I am confident in identifying learners who need special education support.',
    'I can modify lesson objectives appropriately for learners with SEN.',
    'I am able to accommodate learners with physical or sensory difficulties.',
    'I can design activities that promote participation for all learners.',
    'I use evidence-based strategies when teaching learners with SEN.',
    'I regularly reflect on my inclusive teaching practices.',
    'I collaborate with school staff to support learners with special needs.',
    'I feel equipped to use technology tools to support inclusive instruction.'
  ]
};
