import argparse
import os
import json
import re
import requests
from pathlib import Path

SUPPORTED_MODELS = [
    'openai/gpt-oss-20b:free',
    'qwen/qwen3.6-plus',
    'stepfun/step-3.5-flash',
    'qwen/qwen3.6-plus-preview',
    'nvidia/nemotron-3-super-120b-a12b:free',
]


def load_env(env_path: Path = Path('.env')) -> None:
    if not env_path.exists():
        return

    with env_path.open('r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and value and key not in os.environ:
                os.environ[key] = value


def get_openrouter_api_key() -> str:
    load_env()
    api_key = os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        raise EnvironmentError(
            'OPENROUTER_API_KEY is not set.\n'
            'Add it to your environment or .env file like:\n'
            'OPENROUTER_API_KEY=sk-...'
        )
    return api_key


def select_model(provided_model: str | None) -> str:
    if provided_model:
        if provided_model in SUPPORTED_MODELS:
            return provided_model
        raise ValueError(
            f'Unsupported model: {provided_model}. Supported models: {", ".join(SUPPORTED_MODELS)}'
        )

    print('Select a model:')
    for index, model_name in enumerate(SUPPORTED_MODELS, start=1):
        print(f' {index}. {model_name}')
    choice = input('Choose model number or enter model name [1]: ').strip() or '1'
    if choice.isdigit():
        index = int(choice) - 1
        if 0 <= index < len(SUPPORTED_MODELS):
            return SUPPORTED_MODELS[index]
    if choice in SUPPORTED_MODELS:
        return choice
    print('Invalid selection, using default:', SUPPORTED_MODELS[0])
    return SUPPORTED_MODELS[0]


def select_reference_files(available_files: list[str], provided_selection: str | None) -> list[str]:
    if provided_selection and provided_selection.lower() != 'all':
        selected = [name.strip() for name in provided_selection.split(',') if name.strip()]
        normalized = {name.lower(): name for name in available_files}
        chosen = []
        for value in selected:
            if value.isdigit():
                index = int(value) - 1
                if 0 <= index < len(available_files):
                    chosen.append(available_files[index])
            elif value.lower() in normalized:
                chosen.append(normalized[value.lower()])
            else:
                print(f'Warning: unknown reference file selection: {value}')
        return [name for name in available_files if name in chosen]

    if provided_selection and provided_selection.lower() == 'all':
        return available_files

    print('Available reference files:')
    for idx, name in enumerate(available_files, start=1):
        print(f' {idx}. {name}')
    choice = input('Select files to load by number or name, or type all [all]: ').strip() or 'all'
    if choice.lower() == 'all':
        return available_files
    return select_reference_files(available_files, choice)


def extract_pdf_text(pdf_path: Path) -> str:
    try:
        from PyPDF2 import PdfReader
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            'PyPDF2 is required to read PDF reference files. Install with `pip install PyPDF2`.'
        ) from exc

    text = []
    try:
        with pdf_path.open('rb') as handle:
            reader = PdfReader(handle)
            for page in reader.pages:
                text.append(page.extract_text() or '')
    except Exception as exc:
        exc_name = exc.__class__.__name__
        if exc_name == 'DependencyError':
            raise RuntimeError(
                'PyPDF2 requires pycryptodome for encrypted PDF support. '
                'Install it with `pip install pycryptodome` or remove encrypted PDFs from reference/.'
            ) from exc
        if exc_name in {'PdfReadError', 'PdfReadWarning'} or 'encrypted' in str(exc).lower():
            print(f'Warning: skipped unreadable or encrypted PDF {pdf_path.name}: {exc}')
            return ''
        raise

    return '\n'.join(text)


def extract_docx_text(docx_path: Path) -> str:
    try:
        from docx import Document
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            'python-docx is required to read DOCX reference files. Install with `pip install python-docx`.'
        ) from exc

    try:
        document = Document(docx_path)
        return '\n'.join(paragraph.text for paragraph in document.paragraphs)
    except Exception as exc:
        print(f'Warning: skipped unreadable DOCX {docx_path.name}: {exc}')
        return ''


def chunk_text(text: str, max_chars: int = 1800, overlap: int = 300) -> list:
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_chars)
        chunks.append(text[start:end].strip())
        start += max_chars - overlap
    return [chunk for chunk in chunks if chunk]


def load_reference_documents(reference_dir: Path = Path('reference'), selected_sources: list[str] | None = None) -> list:
    chunks = []
    if not reference_dir.exists() or not reference_dir.is_dir():
        return chunks

    available_files = sorted([path.name for path in reference_dir.iterdir() if path.suffix.lower() in {'.pdf', '.docx'}])
    if not selected_sources:
        selected_sources = available_files
    else:
        selected_sources = [name for name in selected_sources if name in available_files]

    for path in sorted(reference_dir.iterdir()):
        if path.name not in selected_sources:
            continue
        if path.suffix.lower() == '.pdf':
            text = extract_pdf_text(path)
        elif path.suffix.lower() == '.docx':
            try:
                text = extract_docx_text(path)
            except RuntimeError as exc:
                print(exc)
                continue
        else:
            continue

        if not text.strip():
            continue

        for index, chunk in enumerate(chunk_text(text), start=1):
            chunks.append({
                'source': path.name,
                'index': index,
                'content': chunk,
            })
    return chunks


def score_chunk(chunk: dict, query: str) -> int:
    query_terms = set(re.findall(r"\w+", query.lower()))
    if not query_terms:
        return 0
    chunk_text_lower = chunk['content'].lower()
    return sum(1 for term in query_terms if term in chunk_text_lower)


def find_relevant_chunks(query: str, reference_chunks: list, top_n: int = 3) -> list:
    query_lower = query.lower()
    source_names = sorted({chunk['source'] for chunk in reference_chunks})

    def source_mentioned(source: str) -> bool:
        stem = Path(source).stem.lower()
        normalized = re.sub(r'[^a-z0-9]+', ' ', stem)
        tokens = [token for token in normalized.split() if token]
        if stem in query_lower:
            return True
        return any(token in query_lower for token in tokens)

    direct_sources = [source for source in source_names if source_mentioned(source)]
    if direct_sources:
        filtered = [chunk for chunk in reference_chunks if chunk['source'] in direct_sources]
        scored = [(score_chunk(chunk, query), chunk) for chunk in filtered]
        scored.sort(key=lambda item: item[0], reverse=True)
        direct_result = [chunk for score, chunk in scored if score > 0][:top_n]
        if direct_result:
            return direct_result

    scored = [
        (score_chunk(chunk, query), chunk)
        for chunk in reference_chunks
    ]
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for score, chunk in scored if score > 0][:top_n]


def build_reference_context(chunks: list) -> str:
    return '\n\n'.join(
        f"[{chunk['source']} - part {chunk['index']}]:\n{chunk['content']}"
        for chunk in chunks
    )


def build_openrouter_messages(base_messages: list, user_prompt: str, reference_chunks: list) -> tuple:
    messages = [*base_messages]
    selected_sources = []
    if reference_chunks:
        relevant = find_relevant_chunks(user_prompt, reference_chunks, top_n=4)
        if relevant:
            selected_sources = sorted({chunk['source'] for chunk in relevant})
            context = build_reference_context(relevant)
            messages.append({
                'role': 'system',
                'content': (
                    'Use the following reference excerpts to answer the user question when relevant. '
                    'If the excerpts are not needed, do not invent or hallucinate details from them.'
                )
            })
            messages.append({
                'role': 'user',
                'content': context
            })
    messages.append({'role': 'user', 'content': user_prompt})
    return messages, selected_sources


def extract_json_object(text: str) -> dict | None:
    start = None
    stack = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text):
        if in_string:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == '{':
            if start is None:
                start = i
            stack += 1
        elif ch == '}':
            if start is not None:
                stack -= 1
                if stack == 0:
                    candidate = text[start:i+1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        start = None
                        stack = 0
    return None


def call_openrouter(prompt: str, messages: list, api_key: str, model: str) -> dict:
    url = 'https://openrouter.ai/api/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    payload = {
        'model': model,
        'messages': messages,
        'reasoning': {'enabled': True},
        'max_tokens': 1200,
        'temperature': 0.2,
    }

    response = requests.post(url, headers=headers, json=payload, timeout=60)
    content_type = response.headers.get('Content-Type', '')
    if 'application/json' not in content_type:
        raise ValueError(
            f'Expected JSON response but got {content_type}.\n{response.text}'
        )

    data = response.json()
    if response.status_code != 200:
        raise RuntimeError('OpenRouter error:\n' + json.dumps(data, indent=2))

    choice = data.get('choices', [])[0] if data.get('choices') else None
    if not choice or 'message' not in choice:
        raise ValueError('Unexpected response format:\n' + json.dumps(data, indent=2))

    return choice['message']


def build_lesson_plan_prompt(lesson_data: dict, selected_refs: list[str] | None) -> str:
    reference_note = 'all loaded reference documents' if not selected_refs else ', '.join(selected_refs)
    data_lines = [
        f"Subject: {lesson_data.get('subject', 'N/A')}",
        f"Grade: {lesson_data.get('grade', 'N/A')}",
        f"Quarter: {lesson_data.get('quarter', 'N/A')}",
        f"Lesson title: {lesson_data.get('title', 'N/A')}",
        f"Learning objectives: {lesson_data.get('objectives', 'N/A')}",
        f"Learner difficulty: {lesson_data.get('difficulty', 'N/A')}",
        f"Learner indicators: {lesson_data.get('indicators', 'N/A')}",
        f"Support types: {lesson_data.get('support_types', 'N/A')}",
        f"Custom support notes: {lesson_data.get('custom_support', 'N/A')}",
        f"Delivery mode: {lesson_data.get('delivery_mode', 'N/A')}",
    ]
    prompt = (
        'You are an expert inclusive education planner. Generate a complete Daily Lesson Plan that is aligned with the provided learner profile, objectives, supports, and selected references. '
        'Use only the loaded reference documents if they are relevant, and do not invent policies or references that are not present. '
        'Return ONLY a single valid JSON object with the exact keys below. Do not add any text before or after the JSON object. '
        'If any field has no content, use an empty string. '
        '\n\n'
        'Required JSON keys: content_standards, performance_standards, competencies, content, integration, resources, prior_knowledge, lesson_purpose, developing, generalization, evaluation, remarks, reflection, custom_support, observations. '
        'Also include these optional metadata keys if available: subject, grade, quarter, title, difficulty, indicators, support_types, delivery_mode. '
        '\n\n'
        'Example output format:\n'
        '{\n'
        '  "content_standards": "...",\n'
        '  "performance_standards": "...",\n'
        '  "competencies": "...",\n'
        '  "content": "...",\n'
        '  "integration": "...",\n'
        '  "resources": "...",\n'
        '  "prior_knowledge": "...",\n'
        '  "lesson_purpose": "...",\n'
        '  "developing": "...",\n'
        '  "generalization": "...",\n'
        '  "evaluation": "...",\n'
        '  "remarks": "...",\n'
        '  "reflection": "...",\n'
        '  "custom_support": "...",\n'
        '  "observations": "..."\n'
        '}\n\n'
        'Loaded references: ' + reference_note + '\n\n'
        'Lesson input:\n' + '\n'.join(data_lines)
    )
    return prompt


def generate_lesson_plan(lesson_data: dict, model: str | None = None, selected_refs: list[str] | None = None) -> str:
    model = model or SUPPORTED_MODELS[0]
    if model not in SUPPORTED_MODELS:
        raise ValueError(f'Unsupported model: {model}')

    reference_chunks = load_reference_documents(Path('reference'), selected_refs)
    base_messages = [
        {
            'role': 'system',
            'content': (
                'You are an expert inclusive education planner. Generate a Daily Lesson Plan that aligns with the learner difficulty profile, '
                'observed indicators, supports, and curriculum guidance. Use the loaded reference excerpts only when they directly support the plan.'
            )
        }
    ]
    user_prompt = build_lesson_plan_prompt(lesson_data, selected_refs)
    messages, _ = build_openrouter_messages(base_messages, user_prompt, reference_chunks)
    response = call_openrouter(user_prompt, messages, get_openrouter_api_key(), model)
    content = response.get('content', '')
    parsed = extract_json_object(content)
    if parsed:
        return json.dumps(parsed)
    return content


def test_openrouter_connection(api_key: str, model: str) -> None:
    messages = [
        {'role': 'system', 'content': 'You are a helpful assistant.'},
        {'role': 'user', 'content': 'Hello, please reply with a short greeting.'}
    ]
    message = call_openrouter(messages[-1]['content'], messages, api_key, model)
    print('Connection successful.')
    print('Assistant content:', message.get('content'))
    if message.get('reasoning_details') is not None:
        print('Reasoning details received.')


def chat_openrouter(api_key: str, reference_chunks: list, model: str) -> None:
    print('OpenRouter reasoning chat ready. Type QUIT or EXIT to stop.')
    print('Type LIST to show loaded reference documents.')

    sources = sorted({chunk['source'] for chunk in reference_chunks})
    loaded_docs_text = 'No reference documents loaded.'
    if sources:
        loaded_docs_text = 'Loaded reference documents: ' + ', '.join(sources)

    messages = [
        {'role': 'system', 'content': 'You are a helpful assistant.'},
        {'role': 'system', 'content': (
            'The user has loaded the following reference documents: ' +
            (', '.join(sources) if sources else 'none') +
            '. Use only the provided reference excerpts when answering. If the user asks about a specific file, prefer relevant excerpts from that file.'
        )}
    ]

    while True:
        prompt = input('> ').strip()
        if not prompt:
            continue
        if prompt.upper() in {'QUIT', 'EXIT'}:
            print('Goodbye.')
            break
        if prompt.upper() in {'LIST', 'REFS', 'DOCUMENTS'}:
            if not sources:
                print('No reference documents loaded.')
            else:
                print('Loaded reference documents:')
                for source in sources:
                    print('-', source)
            continue

        call_messages, selected_sources = build_openrouter_messages(messages, prompt, reference_chunks)
        if selected_sources:
            print('Using reference docs:', ', '.join(selected_sources))
        else:
            print('No reference excerpts matched this query.')

        try:
            assistant_message = call_openrouter(prompt, call_messages, api_key, model)
            messages.append({
                'role': 'assistant',
                'content': assistant_message.get('content'),
                'reasoning_details': assistant_message.get('reasoning_details')
            })
            print('AI:', assistant_message.get('content').strip())
            if assistant_message.get('reasoning_details') is not None:
                print('Reasoning details included.')
        except Exception as exc:
            print('Error:', exc)


def main() -> None:
    try:
        api_key = get_openrouter_api_key()
    except EnvironmentError as exc:
        print(exc)
        return

    parser = argparse.ArgumentParser(description='OpenRouter chat with selectable model and reference loading.')
    parser.add_argument('--model', type=str, help='Model to use')
    parser.add_argument('--refs', type=str, help='Comma-separated reference filenames to load, or all')
    args = parser.parse_args()

    model = select_model(args.model)
    print('Selected model:', model)

    reference_dir = Path('reference')
    available_files = sorted([path.name for path in reference_dir.iterdir() if path.suffix.lower() in {'.pdf', '.docx'}])
    selected_sources = None
    if available_files:
        selected_sources = select_reference_files(available_files, args.refs)
    else:
        selected_sources = []

    print('Loading reference documents from reference/ ...')
    if selected_sources:
        print('References selected to load:', ', '.join(selected_sources))
    else:
        print('No reference files selected to load.')

    reference_chunks = load_reference_documents(reference_dir, selected_sources)
    if reference_chunks:
        sources = sorted({chunk['source'] for chunk in reference_chunks})
        print(f'Loaded {len(reference_chunks)} reference chunks from {len(sources)} files:')
        for source in sources:
            count = sum(1 for chunk in reference_chunks if chunk['source'] == source)
            print(f' - {source}: {count} chunks')
    else:
        print('No reference documents loaded. Place PDFs or DOCX files in reference/ to enable document review.')

    try:
        print('Testing OpenRouter connection...')
        test_openrouter_connection(api_key, model)
    except Exception as exc:
        print(exc)
        return

    chat_openrouter(api_key, reference_chunks, model)


if __name__ == '__main__':
    main()
