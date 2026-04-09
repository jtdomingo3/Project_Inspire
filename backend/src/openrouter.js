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
    `Difficulty subcategories: ${lessonData.subcategories || 'N/A'}`,
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
    'Also include these optional metadata keys if available: subject, grade, quarter, title, difficulty, subcategories, indicators, support_types, delivery_mode.',
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
    subcategories: lessonData.subcategories || '',
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

function formatLessonPlanOutput(data) {
  const lines = [];
  
  // Header
  lines.push('DAILY LESSON PLAN');
  lines.push('');
  lines.push('School: ___________________________     Grade Level: ' + (data.grade || '____') + '     Quarter: ' + (data.quarter || '____'));
  lines.push('Teacher: _____________________________________________________');
  lines.push('Learning Area: ' + (data.subject || 'Mathematics'));
  lines.push('Teaching Date and Time: ________________________');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  // Section I: Curriculum Content, Standards and Lesson Competencies
  lines.push('I. CURRICULUM CONTENT, STANDARDS AND LESSON COMPETENCIES');
  lines.push('');
  
  if (data.content_standards) {
    lines.push('A. Content Standards');
    lines.push(data.content_standards);
    lines.push('');
  }
  
  if (data.performance_standards) {
    lines.push('B. Performance Standards');
    lines.push(data.performance_standards);
    lines.push('');
  }
  
  if (data.competencies) {
    lines.push('C. Learning Competencies and Objectives');
    lines.push(data.competencies);
    lines.push('');
  }
  
  if (data.content) {
    lines.push('D. Content');
    lines.push('Topic: ' + (data.title || 'Lesson Topic'));
    lines.push(data.content);
    lines.push('');
  }
  
  if (data.integration) {
    lines.push('E. Integration');
    lines.push('Inclusive Education Focus: ' + (data.difficulty || 'Differentiated supports for diverse learners'));
    lines.push(data.integration);
    lines.push('');
  }
  
  if (data.custom_support) {
    lines.push('F. Observed Manifestations & Accommodations');
    lines.push(data.custom_support);
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  // Section II: Learning Resources
  lines.push('II. LEARNING RESOURCES');
  if (data.resources) {
    lines.push(data.resources);
  }
  lines.push('');
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  // Section III: Teaching and Learning Procedure
  lines.push('III. TEACHING AND LEARNING PROCEDURE');
  lines.push('');
  
  if (data.prior_knowledge) {
    lines.push('A. Activating Prior Knowledge');
    lines.push('Duration: 5 minutes');
    lines.push(data.prior_knowledge);
    lines.push('');
  }
  
  if (data.lesson_purpose) {
    lines.push('B. Establishing Lesson Purpose');
    lines.push('Duration: 5 minutes');
    lines.push(data.lesson_purpose);
    lines.push('');
  }
  
  if (data.developing) {
    lines.push('C. Developing and Deepening Understanding');
    lines.push('Duration: 25 minutes');
    lines.push('Teacher\'s Activity:');
    lines.push(data.developing);
    lines.push('');
  }
  
  if (data.generalization) {
    lines.push('D. Making Generalization');
    lines.push('Duration: 5 minutes');
    lines.push(data.generalization);
    lines.push('');
  }
  
  if (data.evaluation) {
    lines.push('E. Evaluating Learning');
    lines.push('Duration: 10 minutes');
    lines.push('Adaptive Assessment Methods:');
    lines.push(data.evaluation);
    lines.push('');
  }
  
  if (data.remarks) {
    lines.push('F. Teacher\'s Remarks');
    lines.push(data.remarks);
    lines.push('');
  }
  
  if (data.reflection) {
    lines.push('G. Reflection');
    lines.push(data.reflection);
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  lines.push('PREPARED BY: ___________________________');
  lines.push('');
  lines.push('REVIEWED BY: ___________________________');
  lines.push('');
  lines.push('NOTED BY: ___________________________');
  
  return lines.join('\n');
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
    const formatted = formatLessonPlanOutput(fallbackPlan);
    return {
      success: true,
      source: 'fallback',
      output: formatted,
      parsed: fallbackPlan,
      selected_refs: selectedRefs,
      model
    };
  }

  try {
    const content = await callOpenRouter(messages, apiKey, model);
    const parsed = extractJsonObject(content) || createFallbackPlan(lessonData, selectedRefs, 'openrouter-parse-fallback');
    const formatted = formatLessonPlanOutput(parsed);
    return {
      success: true,
      source: 'openrouter',
      output: formatted,
      parsed,
      selected_refs: selectedRefs,
      model
    };
  } catch (error) {
    const fallbackPlan = createFallbackPlan(lessonData, selectedRefs, 'openrouter-error');
    const formatted = formatLessonPlanOutput(fallbackPlan);
    return {
      success: true,
      source: 'fallback',
      warning: String(error?.message || error),
      output: formatted,
      parsed: fallbackPlan,
      selected_refs: selectedRefs,
      model
    };
  }
}