import { generateProviderText, resolveLlmRuntimeConfig } from './llm-provider.js';
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
          // Free LLMs often output literal newlines inside JSON strings despite instructions.
          // We can naively escape all unescaped newlines as a last-resort fallback.
          // Note: This replaces all \n with \\n, which might break valid JSON formatting outside strings,
          // but for simple flat JSON objects, it usually saves the parse.
          let sanitized = candidate;
          try {
            return JSON.parse(candidate);
          } catch {
            try {
              // Failsafe: escape literal newlines
              sanitized = candidate.replace(/\n/g, '\\n').replace(/\r/g, '');
              return JSON.parse(sanitized);
            } catch {
              start = null;
              stack = 0;
            }
          }
        }
      }
    }
  }

  return null;
}

function normalizeGeneratedText(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeGeneratedText(item))
      .filter(Boolean)
      .join('\n');
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    // Convert literal \n sequences (from LLM JSON escaping) to real newlines
    return value.replace(/\\n/g, '\n').trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function readGeneratedField(source, keys) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return '';
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = normalizeGeneratedText(source[key]);
      if (value) {
        return value;
      }
    }
  }

  return '';
}

function splitSupportTypes(raw) {
  return String(raw || '')
    .split(/[|,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSupportRecommendations(lessonData) {
  const supportTypes = splitSupportTypes(lessonData.support_types ?? lessonData.supportTypes);
  // Always provide both if nothing specific is selected, or if any inclusive support is mentioned
  const wantsAccommodations = supportTypes.length === 0 || supportTypes.some((item) => /accommod|time|cue|visual|format|pause/i.test(item));
  const wantsModifications = supportTypes.length === 0 || supportTypes.some((item) => /modif|reduce|break|segment|scaffold|level/i.test(item));

  const accommodations = wantsAccommodations
    ? [
      'Provide concise step-by-step directions with visual cues and teacher modeling before independent work.',
      'Allow extended processing and completion time, with short pauses between activity chunks.',
      'Offer flexible response formats such as oral answers, pointing, matching cards, or guided writing.',
      'Use frequent check-ins and positive verbal prompts to maintain engagement and task persistence.'
    ].join('\n')
    : '';

  const modifications = wantsModifications
    ? [
      'Reduce the number of written items while preserving the same target competency and success criteria.',
      'Break independent tasks into shorter segments with one clear objective per segment.',
      'Provide scaffolded worksheets with larger spacing, word banks, and partially completed examples.',
      'Use performance-based or checklist evidence in place of lengthy written output when appropriate.'
    ].join('\n')
    : '';

  const notes = [
    accommodations ? `Accommodations:\n${accommodations}` : '',
    modifications ? `Modifications:\n${modifications}` : ''
  ].filter(Boolean).join('\n\n');

  return {
    accommodations,
    modifications,
    notes
  };
}

function buildBasePromptLines(lessonData, selectedRefs) {
  const referenceNote = selectedRefs && selectedRefs.length > 0 ? selectedRefs.join(', ') : 'all loaded reference documents';
  return [
    'You are an expert Philippine DepEd-aligned inclusive education planner. You write professional, publication-ready Daily Lesson Plans (DLPs) for K-12 teachers who serve learners with special educational needs.',
    'Use only the loaded reference documents if they are relevant, and do not invent policies or references that are not present.',
    'Return ONLY a single valid JSON object with the exact keys requested. Do not add any text before or after the JSON object.',
    'CRITICAL JSON RULE: You must escape all newlines inside strings as \\\\n. DO NOT use literal line breaks inside your JSON strings.',
    'LANGUAGE REQUIREMENT: Match the language of the provided "Subject" and "Lesson title". If they are in Tagalog/Filipino, the entire output must be in Tagalog/Filipino.',
    '',
    'QUALITY RULES (MANDATORY):',
    '- Every field value must be SUBSTANTIVE. A single sentence is NEVER acceptable.',
    '- Each field must contain at least 3-5 well-developed sentences or a structured list with 4+ detailed items.',
    '- Write as if this will be reviewed by a School Principal and DepEd supervisor.',
    '- Include specific, actionable details — not vague generalities.',
    '- Reference the actual subject matter, grade level, and learner difficulty in your content.',
    '',
    `Loaded references: ${referenceNote}`,
    '',
    'Lesson context:',
    `Subject: ${lessonData.subject || 'N/A'}`,
    `Grade Level: ${lessonData.grade || 'N/A'}`,
    `Quarter: ${lessonData.quarter || 'N/A'}`,
    `Lesson title/Topic: ${lessonData.title || 'N/A'}`,
    `Learning objectives: ${lessonData.objectives || 'N/A'}`,
    `Learner difficulty categories: ${lessonData.difficulty || 'N/A'}`,
    `Observable indicators: ${lessonData.indicators || 'N/A'}`,
    `Support types requested: ${lessonData.support_types || lessonData.supportTypes || 'N/A'}`,
    `Difficulty subcategories: ${lessonData.subcategories || 'N/A'}`,
    `Custom support notes from teacher: ${lessonData.custom_support || lessonData.customSupport || 'N/A'}`,
    `Delivery mode: ${lessonData.delivery_mode || lessonData.deliveryMode || 'N/A'}`
  ];
}

function buildPhase1Prompt(lessonData, selectedRefs) {
  const subject = lessonData.subject || 'the subject';
  const grade = lessonData.grade || 'the grade level';
  const title = lessonData.title || 'the lesson topic';
  const difficulty = lessonData.difficulty || 'diverse learners';

  return [
    ...buildBasePromptLines(lessonData, selectedRefs),
    '',
    'PHASE 1 TASK: Generate Section I — Curriculum Content, Standards, and Lesson Competencies.',
    '',
    'DETAILED INSTRUCTIONS FOR EACH KEY:',
    '',
    '1. "content_standards" — Write a full paragraph (3-5 sentences) describing what learners should know. Reference the subject domain, key concepts, and how standards connect to the broader curriculum. Example quality:',
    `   "The learner demonstrates understanding of the fundamental concepts and principles of ${subject}, including the interrelationships among key variables and their real-world applications. This encompasses knowledge of core terminology, classification systems, and the scientific/mathematical processes that underpin the topic. The learner is expected to connect these concepts to prior learning from previous quarters and recognize how they apply to everyday phenomena and community contexts. Standards are aligned with the DepEd K-12 ${subject} curriculum framework for ${grade}."`,
    '',
    '2. "performance_standards" — Write a full paragraph (3-5 sentences) describing what learners should be able to do. Example quality:',
    `   "The learner is able to apply the concepts of ${title} through hands-on activities, collaborative problem-solving, and performance tasks that demonstrate both conceptual understanding and practical skill. Learners with ${difficulty} are supported through differentiated performance criteria that maintain the same core competency while adjusting the mode of expression, complexity level, or scaffolding provided. The learner can communicate findings and solutions through oral presentation, visual representation, or written output, depending on their learning profile and support plan."`,
    '',
    '3. "competencies" — Write 3-5 numbered specific learning competencies/objectives. Each must be measurable and start with an action verb (identify, explain, demonstrate, analyze, create). Example:',
    '   "1. Identify and describe the key components and their functions within the topic.\\n2. Explain the relationships between variables using appropriate terminology and examples.\\n3. Demonstrate understanding through a guided performance task with differentiated support.\\n4. Apply concepts to solve real-world problems relevant to the learner\'s community context.\\n5. Reflect on the learning process and articulate personal connections to the material."',
    '',
    '4. "content" — Write 2-3 sentences describing the specific topic, sub-topics, and key vocabulary. Include what will be covered.',
    '',
    '5. "integration" — Write 2-3 sentences explaining how inclusive education and cross-curricular themes are woven in. Reference the specific learner difficulties and how the lesson design addresses equity.',
    '',
    'Required JSON keys: content_standards, performance_standards, competencies, content, integration.',
    'Return ONLY the JSON object:'
  ].join('\n');
}

function buildPhase2Prompt(lessonData, selectedRefs, phase1Json) {
  const subject = lessonData.subject || 'the subject';
  const title = lessonData.title || 'the topic';
  const difficulty = lessonData.difficulty || 'diverse learners';

  return [
    ...buildBasePromptLines(lessonData, selectedRefs),
    '',
    'CONTEXT — Phase 1 output (curriculum standards already generated):',
    JSON.stringify(phase1Json, null, 2),
    '',
    'PHASE 2 TASK: Generate Section III — Teaching and Learning Procedure.',
    'THIS IS THE MOST IMPORTANT SECTION. It must read like a real teacher\'s detailed lesson script.',
    '',
    'MANDATORY STRUCTURE FOR EACH KEY (follow this pattern):',
    '',
    '1. "prior_knowledge" (5 min) — Write a detailed paragraph (100+ words) describing:',
    '   - Opening routine and how the teacher greets and settles the class',
    '   - Specific review questions or recall activity (write actual example questions)',
    '   - Visual aids or manipulatives used',
    '   - How learners with difficulties are engaged (e.g., picture cues, partner support)',
    '   Example quality:',
    `   "The teacher begins by greeting the class and conducting a brief review of the previous lesson on [prior topic]. The teacher displays a visual chart on the board showing [relevant concept] and asks: 'Who can tell me what we learned about [topic] last time?' For learners with ${difficulty}, the teacher provides picture cards and word banks as visual prompts. The teacher calls on 3-4 students, including those with support needs, using a think-pair-share strategy to reduce anxiety. A quick 5-item oral recall quiz is conducted using raised hands or thumbs-up/thumbs-down signals to allow non-verbal participation. The teacher provides verbal praise and corrective feedback, ensuring all learners feel included in the review."`,
    '',
    '2. "lesson_purpose" (5 min) — Write a detailed paragraph (100+ words) describing:',
    '   - How the teacher introduces today\'s lesson objective',
    '   - A motivational hook (story, question, real-life scenario, video, image)',
    '   - How the purpose connects to learners\' daily lives',
    '   - Differentiated presentation for learners with special needs',
    '',
    '3. "developing" (25 min) — THIS MUST BE THE LONGEST SECTION (200+ words). Write a detailed step-by-step teaching procedure:',
    '   - Step 1: Teacher modeling/demonstration (I Do)',
    '   - Step 2: Guided practice with the class (We Do)',
    '   - Step 3: Collaborative/group activity (You Do Together)',
    '   - Step 4: Independent practice with differentiated tasks (You Do Alone)',
    '   - Include specific activities, worksheets, manipulatives, grouping strategies',
    '   - Describe how each step is adapted for the identified learner difficulties',
    '   - Include actual example questions or task descriptions',
    '',
    '4. "generalization" (5 min) — Write a detailed paragraph (80+ words) describing:',
    '   - Key questions the teacher asks to check for conceptual understanding',
    '   - How learners summarize or articulate the main idea',
    '   - Real-world connections and application prompts',
    '   - Accessible generalization methods for learners with difficulties',
    '',
    '5. "evaluation" (10 min) — Write a detailed paragraph (100+ words) describing:',
    '   - Specific assessment method (quiz, exit ticket, performance task, oral check)',
    '   - Number and type of items (e.g., "5-item short quiz" or "3-question exit ticket")',
    '   - Adaptive assessment options for learners with difficulties (oral, matching, drawing)',
    '   - Success criteria and how the teacher determines mastery vs. need for re-teaching',
    '',
    'Required JSON keys: prior_knowledge, lesson_purpose, developing, generalization, evaluation.',
    'Return ONLY the JSON object:'
  ].join('\n');
}

function buildPhase3Prompt(lessonData, selectedRefs, previousContext) {
  const difficulty = lessonData.difficulty || 'diverse learners';
  const supportTypes = lessonData.support_types || lessonData.supportTypes || 'accommodations and modifications';

  return [
    ...buildBasePromptLines(lessonData, selectedRefs),
    '',
    'CONTEXT — Phase 1 & 2 output (standards and procedure already generated):',
    JSON.stringify(previousContext, null, 2),
    '',
    'PHASE 3 TASK: Generate inclusive support details, teacher remarks, and reflections.',
    '',
    'DETAILED INSTRUCTIONS:',
    '',
    `1. "accommodations" — Write 5-6 specific accommodations tailored to "${difficulty}". Each must be a concrete, actionable classroom strategy. Format as numbered items separated by \\\\n. Example quality:`,
    '   "1. Provide step-by-step visual instruction cards with pictorial cues placed on the learner\'s desk for reference during independent work.\\n2. Allow extended time (additional 5-10 minutes) for written tasks, with periodic teacher check-ins every 3 minutes to maintain focus.\\n3. Seat the learner near the teacher and away from distracting stimuli; use a visual schedule board to preview lesson transitions.\\n4. Offer flexible response formats: the learner may answer orally, point to correct answers, use matching cards, or dictate responses to a peer buddy.\\n5. Use frequent positive verbal reinforcement and non-verbal encouragement (thumbs up, stickers) to sustain engagement and task persistence.\\n6. Provide audio recordings of instructions and allow the use of assistive tools such as magnifiers, FM systems, or text-to-speech devices as needed."',
    '',
    `2. "modifications" — Write 5-6 specific modifications tailored to "${difficulty}". These change WHAT is expected, not just HOW. Format as numbered items. Example quality:`,
    '   "1. Reduce the number of required written responses from 10 to 5 items while maintaining the same target competency and success criteria.\\n2. Simplify task complexity by providing partially completed graphic organizers, sentence starters, or cloze-type worksheets.\\n3. Break multi-step problems into single-step segments, each with its own clear instruction and visual model.\\n4. Replace extended written output with alternative evidence of learning: oral demonstration, drawing, physical modeling, or checklist completion.\\n5. Adjust grading rubric to emphasize effort, participation, and process over accuracy of final output.\\n6. Provide leveled reading materials at the learner\'s instructional level while covering the same core concepts as the general class."',
    '',
    '3. "remarks" — Write 3-4 sentences of professional teacher remarks about the lesson delivery, noting what went well and any adjustments made during instruction.',
    '',
    '4. "reflection" — Write 3-4 sentences of reflective practice: what inclusive strategies were most effective, which learners showed growth, and what the teacher would adjust for next time.',
    '',
    '5. "custom_support" — Write 2-3 sentences describing observed manifestations of the learner difficulty during the lesson and any additional support notes.',
    '',
    '6. "observations" — Write 2-3 sentences about classroom monitoring: participation levels, behavioral notes, and support effectiveness.',
    '',
    '7. "reviewed_by" — Use "Department Head" as default.',
    '8. "noted_by" — Use "School Principal" as default.',
    '',
    'Required JSON keys: accommodations, modifications, remarks, reflection, custom_support, observations, reviewed_by, noted_by.',
    'Return ONLY the JSON object:'
  ].join('\n');
}

function createFallbackPlan(lessonData, selectedRefs, source) {
  const supports = buildSupportRecommendations(lessonData);
  const subject = lessonData.subject || 'the subject area';
  const grade = lessonData.grade || 'the target grade';
  const title = lessonData.title || 'the lesson topic';
  const difficulty = lessonData.difficulty || 'diverse learners';

  return {
    content_standards: `The learner demonstrates understanding of the fundamental concepts and principles of ${subject}, including the interrelationships among key variables and their real-world applications. This encompasses knowledge of core terminology, processes, and classification systems relevant to the topic. Standards are aligned with the DepEd K-12 curriculum framework for ${grade}.`,
    performance_standards: `The learner is able to apply the concepts of ${title} through hands-on activities, collaborative problem-solving, and performance tasks that demonstrate both conceptual understanding and practical skill. Learners with ${difficulty} are supported through differentiated performance criteria that maintain the same core competency while adjusting the mode of expression, complexity level, or scaffolding provided.`,
    competencies: lessonData.objectives || `1. Identify and describe the key components and their functions within ${title}.\n2. Explain the relationships between variables using appropriate terminology and examples.\n3. Demonstrate understanding through a guided performance task with differentiated support.\n4. Apply concepts to solve real-world problems relevant to the learner's community context.`,
    content: `Topic: ${title}\nThis lesson covers the foundational concepts, key vocabulary, and essential skills related to ${title} in ${subject}. Learners will explore the topic through structured activities designed for inclusive participation.`,
    integration: `Inclusive Education Focus: ${difficulty}\nLiteracy, collaboration, and inclusive support strategies are embedded throughout the lesson. Cross-curricular connections to values education, community engagement, and real-life application are integrated to ensure meaningful and equitable learning for all students, including those with special educational needs.`,
    resources: selectedRefs && selectedRefs.length > 0 ? selectedRefs.join(', ') : 'Loaded reference documents',
    prior_knowledge: `The teacher begins by greeting the class and conducting a brief review of the previous lesson. A visual chart or graphic organizer is displayed on the board showing key concepts from the prior session. The teacher asks 3-4 targeted review questions, calling on students using a variety of response methods including raised hands, thumbs-up/thumbs-down, and think-pair-share. For learners with ${difficulty}, the teacher provides picture cards and word banks as visual prompts to support recall. Verbal praise and corrective feedback are given to ensure all learners feel included in the review activity.`,
    lesson_purpose: `The teacher introduces today's lesson on ${title} by presenting a motivational hook — a real-life scenario, image, or short story that connects the topic to learners' daily experiences. The teacher states the lesson objective clearly and writes it on the board. For learners with ${difficulty}, the objective is also presented using simplified language and visual icons. The teacher explains why this topic matters and how it connects to the broader unit of study, engaging students through questions like: "Have you ever noticed this in your daily life?" and "Why do you think this is important to learn?"`,
    developing: `Step 1 — Teacher Modeling (I Do): The teacher demonstrates the core concept using concrete examples, visual aids, and step-by-step explanation on the board. Key vocabulary is highlighted and defined with picture support.\\nStep 2 — Guided Practice (We Do): The teacher works through 2-3 practice problems or examples with the whole class, inviting student participation. Learners with ${difficulty} are seated near the teacher and given simplified task cards.\\nStep 3 — Collaborative Activity (You Do Together): Students work in mixed-ability pairs or small groups on a structured activity. The teacher circulates, provides scaffolding, and checks for understanding. Differentiated task cards are provided for learners needing additional support.\\nStep 4 — Independent Practice (You Do Alone): Students complete a short individual task. Modified worksheets with sentence starters, word banks, and reduced items are provided for learners with ${difficulty}. The teacher monitors progress and offers one-on-one support as needed.`,
    generalization: `The teacher facilitates a whole-class discussion to synthesize learning. Key questions include: "What is the most important thing you learned today about ${title}?" and "How can you apply this in your daily life?" Learners are encouraged to share their understanding through oral responses, drawings, or written statements. For learners with ${difficulty}, the teacher uses graphic organizers and sentence frames to support their articulation of the main concepts.`,
    evaluation: `The teacher administers a 5-item formative assessment to check for understanding. Items include a mix of multiple choice, short answer, and matching-type questions aligned to the lesson competencies. For learners with ${difficulty}, adaptive assessment options are provided: oral responses, picture-based matching, or guided completion with teacher support. The teacher uses the results to determine mastery (80% accuracy) and identifies learners who may need re-teaching or additional practice in the next session.`,
    accommodations: supports.accommodations,
    modifications: supports.modifications,
    remarks: `Generated locally because the OpenRouter fallback path was used (${source}). The teacher should review and customize this lesson plan to reflect actual classroom conditions, learner profiles, and available resources before implementation.`,
    reflection: `After delivering this lesson, the teacher should reflect on the following: Which inclusive strategies were most effective in engaging learners with ${difficulty}? Were the accommodations and modifications sufficient, or do they need adjustment? What evidence of learning was observed, and which students may need additional support in future sessions?`,
    custom_support: normalizeGeneratedText(lessonData.custom_support) || supports.notes,
    observations: `Monitor participation levels across all learner groups, noting which students actively engage and which require additional prompting. Track the effectiveness of accommodations and modifications by observing task completion rates and quality of responses. Document any behavioral observations relevant to the learner difficulty profile for future planning.`,
    subject: lessonData.subject || '',
    grade: lessonData.grade || '',
    quarter: lessonData.quarter || '',
    title: lessonData.title || '',
    difficulty: lessonData.difficulty || '',
    indicators: lessonData.indicators || '',
    support_types: lessonData.support_types || lessonData.supportTypes || '',
    subcategories: lessonData.subcategories || '',
    delivery_mode: lessonData.delivery_mode || lessonData.deliveryMode || '',
    reviewed_by: lessonData.reviewed_by || lessonData.reviewedBy || 'Department Head',
    noted_by: lessonData.noted_by || lessonData.notedBy || 'School Principal'
  };
}


function normalizeGeneratedPlan(rawPlan, lessonData, selectedRefs, selectedRefTitles) {
  const fallbackPlan = createFallbackPlan(lessonData, selectedRefs, 'openrouter-normalization-fallback');
  const supports = buildSupportRecommendations(lessonData);

  const parsed = (rawPlan && typeof rawPlan === 'object' && !Array.isArray(rawPlan)) ? rawPlan : {};

  const accommodations = readGeneratedField(parsed, ['accommodations', 'accommodation', 'accommodation_plan', 'accommodation_strategies'])
    || fallbackPlan.accommodations;
  const modifications = readGeneratedField(parsed, ['modifications', 'modification', 'modification_plan', 'modification_strategies'])
    || fallbackPlan.modifications;
  
  const rawCustom = readGeneratedField(parsed, ['custom_support', 'customSupport', 'support_plan', 'support_notes', 'observed_manifestations']);
  
  // If we have distinct accommodations/modifications, and rawCustom is empty or just repeats them, 
  // we should use a clean version of custom_support.
  const supportNotes = rawCustom || normalizeGeneratedText(lessonData.custom_support) || '';

  const displayResources = (selectedRefTitles && selectedRefTitles.length > 0) 
    ? selectedRefTitles.join('\n') 
    : (selectedRefs && selectedRefs.length > 0 ? selectedRefs.join('\n') : 'No reference documents selected');

  return {
    content_standards: readGeneratedField(parsed, ['content_standards', 'contentStandards']) || fallbackPlan.content_standards,
    performance_standards: readGeneratedField(parsed, ['performance_standards', 'performanceStandards']) || fallbackPlan.performance_standards,
    competencies: readGeneratedField(parsed, ['competencies', 'learning_competencies', 'learningCompetencies']) || fallbackPlan.competencies,
    content: readGeneratedField(parsed, ['content', 'lesson_content', 'lessonContent']) || fallbackPlan.content,
    integration: readGeneratedField(parsed, ['integration', 'inclusive_focus', 'inclusiveFocus']) || fallbackPlan.integration,
    resources: displayResources,
    prior_knowledge: readGeneratedField(parsed, ['prior_knowledge', 'priorKnowledge']) || fallbackPlan.prior_knowledge,
    lesson_purpose: readGeneratedField(parsed, ['lesson_purpose', 'lessonPurpose']) || fallbackPlan.lesson_purpose,
    developing: readGeneratedField(parsed, ['developing', 'procedure', 'activities']) || fallbackPlan.developing,
    generalization: readGeneratedField(parsed, ['generalization']) || fallbackPlan.generalization,
    evaluation: readGeneratedField(parsed, ['evaluation', 'assessment']) || fallbackPlan.evaluation,
    accommodations,
    modifications,
    remarks: readGeneratedField(parsed, ['remarks', 'teacher_remarks', 'teachers_remarks']) || fallbackPlan.remarks,
    reflection: readGeneratedField(parsed, ['reflection']) || fallbackPlan.reflection,
    custom_support: supportNotes,
    observations: readGeneratedField(parsed, ['observations', 'monitoring_notes', 'monitoringNotes']) || fallbackPlan.observations,
    subject: readGeneratedField(parsed, ['subject']) || normalizeGeneratedText(lessonData.subject) || fallbackPlan.subject,
    grade: readGeneratedField(parsed, ['grade']) || normalizeGeneratedText(lessonData.grade) || fallbackPlan.grade,
    quarter: readGeneratedField(parsed, ['quarter']) || normalizeGeneratedText(lessonData.quarter) || fallbackPlan.quarter,
    title: readGeneratedField(parsed, ['title', 'lesson_title', 'lessonTitle']) || normalizeGeneratedText(lessonData.title) || fallbackPlan.title,
    difficulty: readGeneratedField(parsed, ['difficulty']) || normalizeGeneratedText(lessonData.difficulty) || fallbackPlan.difficulty,
    indicators: readGeneratedField(parsed, ['indicators']) || normalizeGeneratedText(lessonData.indicators) || fallbackPlan.indicators,
    support_types: readGeneratedField(parsed, ['support_types', 'supportTypes']) || normalizeGeneratedText(lessonData.support_types) || fallbackPlan.support_types,
    subcategories: readGeneratedField(parsed, ['subcategories']) || normalizeGeneratedText(lessonData.subcategories) || fallbackPlan.subcategories,
    delivery_mode: readGeneratedField(parsed, ['delivery_mode', 'deliveryMode']) || normalizeGeneratedText(lessonData.delivery_mode) || fallbackPlan.delivery_mode,
    reviewed_by: readGeneratedField(parsed, ['reviewed_by', 'reviewedBy']) || normalizeGeneratedText(lessonData.reviewedBy) || fallbackPlan.reviewed_by,
    noted_by: readGeneratedField(parsed, ['noted_by', 'notedBy']) || normalizeGeneratedText(lessonData.notedBy) || fallbackPlan.noted_by
  };
}

function buildOpenRouterMessages(lessonData, promptContent, referenceChunks) {
  const configuredReferenceChunks = Number(process.env.OPENROUTER_REFERENCE_CHUNKS ?? 3);
  const maxReferenceChunks = Number.isFinite(configuredReferenceChunks)
    ? Math.min(4, Math.max(1, Math.trunc(configuredReferenceChunks)))
    : 3;

  let systemInstruction = 'You are an expert inclusive education planner. Generate a Daily Lesson Plan that aligns with the learner difficulty profile, observed indicators, supports, and curriculum guidance. Use the loaded reference excerpts only when they directly support the plan.';
  const messages = [];

  if (referenceChunks.length > 0) {
    const relevant = findRelevantChunks(JSON.stringify(lessonData), referenceChunks, maxReferenceChunks);
    if (relevant.length > 0) {
      systemInstruction += '\n\nUse the following reference excerpts to inform the response only when relevant. Do not invent details from them.';
      messages.push({
        role: 'user',
        content: buildReferenceContext(relevant)
      });
    }
  }

  messages.push({
    role: 'user',
    content: promptContent
  });

  return [
    { role: 'system', content: systemInstruction },
    ...messages
  ];
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
  
  if (data.accommodations || data.modifications || data.custom_support) {
    lines.push('F. Support Plan (Accommodations and Modifications)');
    if (data.accommodations) {
      lines.push('Accommodations:');
      lines.push(data.accommodations);
      lines.push('');
    }
    if (data.modifications) {
      lines.push('Modifications:');
      lines.push(data.modifications);
      lines.push('');
    }
    if (data.custom_support) {
      lines.push('Observed Manifestations & Additional Notes:');
      lines.push(data.custom_support);
    }
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

async function callLlmModel(messages, runtimeConfig, maxTokens = 3000) {
  const provider = runtimeConfig?.provider || 'openrouter';
  const model = runtimeConfig?.model || '';
  const apiKey = runtimeConfig?.apiKey || '';

  // Log the final prompt sent (the last message in the conversation)
  if (messages.length > 0) {
    const lastContent = messages[messages.length - 1].content;
    console.log('--- PROMPT START ---');
    console.log(lastContent.length > 500 ? lastContent.substring(0, 500) + '... [truncated]' : lastContent);
    console.log('--- PROMPT END ---\n');
  }

  const text = await generateProviderText({
    provider,
    model,
    apiKey,
    messages,
    maxTokens,
    temperature: 0.4
  });

  console.log(`--- RESPONSE (${text.length} chars) ---`);
  console.log(text.length > 500 ? text.substring(0, 500) + '... [truncated]' : text);
  console.log('--- RESPONSE END ---\n');

  return text;
}

function isPhaseContentTooShort(extracted, requiredKeys, minCharsPerField = 80) {
  if (!extracted || typeof extracted !== 'object') return true;
  for (const key of requiredKeys) {
    const value = extracted[key];
    if (!value || (typeof value === 'string' && value.trim().length < minCharsPerField)) {
      return true;
    }
  }
  return false;
}

async function callPhaseWithRetry(buildPromptFn, lessonData, selectedRefs, referenceChunks, runtimeConfig, maxTokens, phaseLabel, requiredKeys, prevContext) {
  const prompt = buildPromptFn(lessonData, selectedRefs, prevContext);
  const messages = buildOpenRouterMessages(lessonData, prompt, referenceChunks);
  const content = await callLlmModel(messages, runtimeConfig, maxTokens);
  let extracted = extractJsonObject(content);

  if (!extracted) {
    console.warn(`[${phaseLabel}] Failed to extract JSON, retrying...`);
  } else if (isPhaseContentTooShort(extracted, requiredKeys)) {
    console.warn(`[${phaseLabel}] Response too short, retrying with stronger prompt...`);
    extracted = null;
  }

  // Retry once with a nudge if content was missing or too short
  if (!extracted) {
    const retryNudge = `\n\nIMPORTANT: Your previous response was too short or could not be parsed. You MUST write detailed, substantive content for EVERY field. Each field needs at least 3-5 full sentences. Do NOT use brief one-liners. Return ONLY a valid JSON object.`;
    const retryPrompt = buildPromptFn(lessonData, selectedRefs, prevContext) + retryNudge;
    const retryMessages = buildOpenRouterMessages(lessonData, retryPrompt, referenceChunks);
    const retryContent = await callLlmModel(retryMessages, runtimeConfig, maxTokens);
    extracted = extractJsonObject(retryContent);
    if (!extracted) {
      console.warn(`[${phaseLabel}] Retry also failed to extract JSON`);
      extracted = {};
    }
  }

  return extracted;
}

function buildAppKnowledgeContext() {
  return [
    'Project INSPIRE app scope:',
    '- Dashboard: platform overview and shortcuts.',
    '- New Lesson Plan: AI-assisted inclusive DepEd-aligned lesson plan generation.',
    '- My Lessons: review and manage saved generated lessons.',
    '- Learner Difficulty Library: category definitions, indicators, and support references.',
    '- Reflection Logs: teacher reflection records after lesson delivery.',
    '- Observations: classroom observation logging and tracking.',
    '- Resource Library: uploaded PDF/DOCX references used by AI outputs.',
    '- Pre/Post Survey: baseline and outcome surveys for inclusive teaching confidence and practice.',
    '- Reminders: to-do and due-date reminders for users.',
    '- Profile: account details and user profile context.',
    '- Admin Analytics (admin/researcher): usage and effectiveness insights.',
    '- Account Management (admin): user account administration.',
    '- Authentication: token-based login, refresh, and role-based access control.',
    '- Inclusive education focus: support accommodations, modifications, differentiated instruction, and adaptive assessment.',
    'Answer user inquiries about workflows and app capabilities using this context and supplied references. If unsure, say what is known and suggest checking the relevant page in the app.'
  ].join('\n');
}

function buildChatMessages(question, referenceContext, userContext) {
  const userLabel = userContext?.username ? `Current user: ${userContext.username}` : 'Current user: authenticated user';
  const roleLabel = userContext?.role ? `User role: ${userContext.role}` : 'User role: unknown';

  const systemInstruction = [
    'You are the universal assistant for Project INSPIRE. Provide accurate, concise, actionable answers for app help and inclusive teaching support. Use only provided context and reference excerpts when making claims. If references are missing for a factual claim, clearly say so.',
    `${buildAppKnowledgeContext()}\n${userLabel}\n${roleLabel}`,
    referenceContext
      ? `Reference excerpts that may be relevant:\n\n${referenceContext}`
      : 'No reference excerpts were matched for this question.'
  ].join('\n\n');

  return [
    {
      role: 'system',
      content: systemInstruction
    },
    {
      role: 'user',
      content: question
    }
  ];
}

export async function generateChatResponse(question, options = {}) {
  const normalizedQuestion = String(question || '').trim();
  if (!normalizedQuestion) {
    throw new Error('Question is required.');
  }

  const runtimeConfig = resolveLlmRuntimeConfig({
    settings: options.llmSettings,
    requestedModel: options.model
  });
  const model = runtimeConfig.model;
  const selectedRefs = Array.isArray(options.selectedRefs) ? options.selectedRefs.filter(Boolean) : options.selectedRefs;
  const selectedRefTitles = Array.isArray(options.selectedRefTitles) ? options.selectedRefTitles.filter(Boolean) : [];
  const referenceChunks = await loadReferenceChunks(selectedRefs);
  const relevant = referenceChunks.length > 0
    ? findRelevantChunks(normalizedQuestion, referenceChunks, 6)
    : [];
  const referenceContext = relevant.length > 0 ? buildReferenceContext(relevant) : '';

  if (!runtimeConfig.hasApiKey) {
    return {
      success: true,
      model,
      selected_refs: selectedRefs,
      selected_ref_titles: selectedRefTitles,
      answer: runtimeConfig.missingKeyMessage,
      sources: relevant.map((chunk) => ({ source: chunk.source, index: chunk.index })),
      source: 'fallback'
    };
  }

  const configuredMaxTokens = Number(options.maxTokens ?? process.env.OPENROUTER_CHAT_MAX_TOKENS ?? 900);
  const maxTokens = Number.isFinite(configuredMaxTokens)
    ? Math.min(2048, Math.max(300, Math.trunc(configuredMaxTokens)))
    : 900;

  const messages = buildChatMessages(normalizedQuestion, referenceContext, {
    username: options.username,
    role: options.role
  });

  try {
    const raw = await callLlmModel(messages, runtimeConfig, maxTokens);
    const answer = String(raw || '').trim();
    return {
      success: true,
      model,
      selected_refs: selectedRefs,
      selected_ref_titles: selectedRefTitles,
      answer: answer || 'No response was generated. Please try asking again with more detail.',
      sources: relevant.map((chunk) => ({ source: chunk.source, index: chunk.index })),
      source: runtimeConfig.provider
    };
  } catch (error) {
    return {
      success: true,
      model,
      selected_refs: selectedRefs,
      selected_ref_titles: selectedRefTitles,
      answer: `I could not complete the request from ${runtimeConfig.provider_label} right now. Please try again in a moment or change model/provider settings.`,
      sources: relevant.map((chunk) => ({ source: chunk.source, index: chunk.index })),
      source: 'fallback',
      warning: String(error?.message || error)
    };
  }
}

export async function generateLessonPlan(lessonData, options = {}) {
  const runtimeConfig = resolveLlmRuntimeConfig({
    settings: options.llmSettings,
    requestedModel: options.model
  });
  const model = runtimeConfig.model;

  const selectedRefs = Array.isArray(options.selectedRefs) ? options.selectedRefs.filter(Boolean) : [];
  const referenceChunks = await loadReferenceChunks(selectedRefs);
  const configuredMaxTokens = Number(options.maxTokens ?? process.env.LLM_MAX_TOKENS ?? process.env.OPENROUTER_MAX_TOKENS ?? 3000);
  const maxTokens = Number.isFinite(configuredMaxTokens)
    ? Math.min(4096, Math.max(1500, Math.trunc(configuredMaxTokens)))
    : 3000;

  // Per-phase token allocation: Phase 2 (procedure) gets the most tokens
  const phase1Tokens = maxTokens;
  const phase2Tokens = Math.min(4096, Math.trunc(maxTokens * 1.5));
  const phase3Tokens = maxTokens;

  console.log(`[Generation] Token allocation: P1=${phase1Tokens}, P2=${phase2Tokens}, P3=${phase3Tokens}`);

  if (!runtimeConfig.hasApiKey) {
    const fallbackPlan = createFallbackPlan(lessonData, selectedRefs, 'no-api-key');
    const formatted = formatLessonPlanOutput(fallbackPlan);
    return {
      success: true,
      source: 'fallback',
      warning: runtimeConfig.missingKeyMessage,
      output: formatted,
      parsed: fallbackPlan,
      selected_refs: selectedRefs,
      model
    };
  }

  let combinedParsed = {};
  try {
    // PHASE 1: Curriculum & Content
    const extracted1 = await callPhaseWithRetry(
      buildPhase1Prompt, lessonData, selectedRefs, referenceChunks,
      runtimeConfig, phase1Tokens, 'Phase 1',
      ['content_standards', 'performance_standards', 'competencies']
    );
    Object.assign(combinedParsed, extracted1);

    // PHASE 2: Procedure (most important — gets extra tokens)
    const extracted2 = await callPhaseWithRetry(
      buildPhase2Prompt, lessonData, selectedRefs, referenceChunks,
      runtimeConfig, phase2Tokens, 'Phase 2',
      ['prior_knowledge', 'lesson_purpose', 'developing', 'generalization', 'evaluation'],
      combinedParsed
    );
    Object.assign(combinedParsed, extracted2);

    // PHASE 3: Supports & Reflection
    const extracted3 = await callPhaseWithRetry(
      buildPhase3Prompt, lessonData, selectedRefs, referenceChunks,
      runtimeConfig, phase3Tokens, 'Phase 3',
      ['accommodations', 'modifications', 'remarks', 'reflection'],
      combinedParsed
    );
    Object.assign(combinedParsed, extracted3);

    const selectedRefTitles = Array.isArray(options.selectedRefTitles) ? options.selectedRefTitles.filter(Boolean) : [];

    const parsed = normalizeGeneratedPlan(combinedParsed, lessonData, selectedRefs, selectedRefTitles);
    const formatted = formatLessonPlanOutput(parsed);
    
    return {
      success: true,
      source: runtimeConfig.provider,
      output: formatted,
      parsed,
      selected_refs: selectedRefs,
      model
    };
  } catch (error) {
    // Merge whatever we got successfully and fallback the rest
    const selectedRefTitles = Array.isArray(options.selectedRefTitles) ? options.selectedRefTitles.filter(Boolean) : [];
    const parsed = normalizeGeneratedPlan(combinedParsed, lessonData, selectedRefs, selectedRefTitles);
    
    // Append warning to remarks
    parsed.remarks = parsed.remarks 
      ? parsed.remarks + `\n\n[System Note: Partial generation completed. The AI generation stopped early due to an error: ${error.message}]`
      : `[System Note: Fallback used. The AI generation failed due to an error: ${error.message}]`;
      
    const formatted = formatLessonPlanOutput(parsed);
    return {
      success: true,
      source: 'fallback',
      warning: String(error?.message || error),
      output: formatted,
      parsed,
      selected_refs: selectedRefs,
      model
    };
  }
}
