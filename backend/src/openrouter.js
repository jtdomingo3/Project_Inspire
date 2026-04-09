import { supportedModels } from './config.js';
import { buildReferenceContext, findRelevantChunks, loadReferenceChunks } from './reference-loader.js';

function extractJsonObject(text) {
  let start = null;
  let stack = 0;
  let inString = false;
  let escape = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (character === '\\') {
        escape = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      if (start === null) {
        start = index;
      }
      stack += 1;
    } else if (character === '}') {
      if (start !== null) {
        stack -= 1;
        if (stack === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            start = null;
            stack = 0;
          }
        }
      }
    }
  }

  return null;
}

function buildLessonPlanPrompt(lessonData, selectedRefs) {
  const referenceNote = selectedRefs && selectedRefs.length > 0 ? selectedRefs.join(', ') : 'all loaded reference documents';
  const dataLines = [
    `Subject: ${lessonData.subject || 'N/A'}`,
    `Grade: ${lessonData.grade || 'N/A'}`,
    `Quarter: ${lessonData.quarter || 'N/A'}`,
    `Lesson title: ${lessonData.title || 'N/A'}`,
    `Learning objectives: ${lessonData.objectives || 'N/A'}`,
    `Learner difficulty: ${lessonData.difficulty || 'N/A'}`,
    `Learner indicators: ${lessonData.indicators || 'N/A'}`,
    `Support types: ${lessonData.support_types || 'N/A'}`,
    `Custom support notes: ${lessonData.custom_support || 'N/A'}`,
    `Delivery mode: ${lessonData.delivery_mode || 'N/A'}`
  ];

  return [
    'You are an expert inclusive education planner. Generate a complete Daily Lesson Plan that is aligned with the provided learner profile, objectives, supports, and selected references.',
    'Use only the loaded reference documents if they are relevant, and do not invent policies or references that are not present.',
    'Return ONLY a single valid JSON object with the exact keys below. Do not add any text before or after the JSON object.',
    'If any field has no content, use an empty string.',
    '',
    'Required JSON keys: content_standards, performance_standards, competencies, content, integration, resources, prior_knowledge, lesson_purpose, developing, generalization, evaluation, remarks, reflection, custom_support, observations.',
    'Also include these optional metadata keys if available: subject, grade, quarter, title, difficulty, indicators, support_types, delivery_mode.',
    '',
    'Example output format:',
    '{',
    '  "content_standards": "...",',
    '  "performance_standards": "...",',
    '  "competencies": "...",',
    '  "content": "...",',
    '  "integration": "...",',
    '  "resources": "...",',
    '  "prior_knowledge": "...",',
    '  "lesson_purpose": "...",',
    '  "developing": "...",',
    '  "generalization": "...",',
    '  "evaluation": "...",',
    '  "remarks": "...",',
    '  "reflection": "...",',
    '  "custom_support": "...",',
    '  "observations": "..."',
    '}',
    '',
    `Loaded references: ${referenceNote}`,
    '',
    'Lesson input:',
    ...dataLines
  ].join('\n');
}

function createFallbackPlan(lessonData, selectedRefs, source) {
  return {
    content_standards: `Aligned content standards for ${lessonData.subject || 'the subject area'}.`,
    performance_standards: `Learners demonstrate understanding through a supported performance task in ${lessonData.grade || 'the target grade'}.`,
    competencies: lessonData.objectives || 'Core competency aligned to the selected learning goal.',
    content: lessonData.title || 'Inclusive lesson content',
    integration: 'Literacy, collaboration, and inclusive support strategies are embedded throughout the lesson.',
    resources: selectedRefs && selectedRefs.length > 0 ? selectedRefs.join(', ') : 'Loaded reference documents',
    prior_knowledge: 'Activate prior knowledge through review questions and visual prompts.',
    lesson_purpose: `This lesson helps learners engage with ${lessonData.title || 'the topic'} using differentiated supports.`,
    developing: 'Use model, guided practice, and partner support to scaffold the core task.',
    generalization: 'Invite learners to explain how the concept connects to everyday examples.',
    evaluation: 'Use observation, exit tickets, and a quick oral check for understanding.',
    remarks: `Generated locally because the OpenRouter fallback path was used (${source}).`,
    reflection: 'Note which supports produced the strongest learner engagement.',
    custom_support: lessonData.custom_support || '',
    observations: 'Track participation, response quality, and support effectiveness.',
    subject: lessonData.subject || '',
    grade: lessonData.grade || '',
    quarter: lessonData.quarter || '',
    title: lessonData.title || '',
    difficulty: lessonData.difficulty || '',
    indicators: lessonData.indicators || '',
    support_types: lessonData.support_types || '',
    delivery_mode: lessonData.delivery_mode || ''
  };
}

function buildOpenRouterMessages(lessonData, selectedRefs, referenceChunks) {
  const systemMessages = [
    {
      role: 'system',
      content: 'You are an expert inclusive education planner. Generate a Daily Lesson Plan that aligns with the learner difficulty profile, observed indicators, supports, and curriculum guidance. Use the loaded reference excerpts only when they directly support the plan.'
    }
  ];

  if (referenceChunks.length > 0) {
    const relevant = findRelevantChunks(JSON.stringify(lessonData), referenceChunks);
    if (relevant.length > 0) {
      systemMessages.push({
        role: 'system',
        content: 'Use the following reference excerpts to inform the response only when relevant. Do not invent details from them.'
      });
      systemMessages.push({
        role: 'user',
        content: buildReferenceContext(relevant)
      });
    }
  }

  systemMessages.push({
    role: 'user',
    content: buildLessonPlanPrompt(lessonData, selectedRefs)
  });

  return systemMessages;
}

async function callOpenRouter(messages, apiKey, model) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      reasoning: { enabled: true },
      max_tokens: 1200,
      temperature: 0.2
    })
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    throw new Error(`OpenRouter error: ${message}`);
  }

  const text = typeof body === 'string'
    ? body
    : body?.choices?.[0]?.message?.content || body?.choices?.[0]?.message?.reasoning_details || '';

  return text;
}

export async function generateLessonPlan(lessonData, options = {}) {
  const model = options.model && supportedModels.includes(options.model)
    ? options.model
    : supportedModels[0];

  const selectedRefs = Array.isArray(options.selectedRefs) ? options.selectedRefs.filter(Boolean) : [];
  const referenceChunks = await loadReferenceChunks(selectedRefs);
  const messages = buildOpenRouterMessages(lessonData, selectedRefs, referenceChunks);
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const fallbackPlan = createFallbackPlan(lessonData, selectedRefs, 'no-api-key');
    return {
      success: true,
      source: 'fallback',
      output: JSON.stringify(fallbackPlan),
      parsed: fallbackPlan,
      selected_refs: selectedRefs,
      model
    };
  }

  try {
    const content = await callOpenRouter(messages, apiKey, model);
    const parsed = extractJsonObject(content) || createFallbackPlan(lessonData, selectedRefs, 'openrouter-parse-fallback');
    return {
      success: true,
      source: 'openrouter',
      output: JSON.stringify(parsed),
      parsed,
      selected_refs: selectedRefs,
      model
    };
  } catch (error) {
    const fallbackPlan = createFallbackPlan(lessonData, selectedRefs, 'openrouter-error');
    return {
      success: true,
      source: 'fallback',
      warning: String(error?.message || error),
      output: JSON.stringify(fallbackPlan),
      parsed: fallbackPlan,
      selected_refs: selectedRefs,
      model
    };
  }
}