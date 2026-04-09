import os
import json
import requests
from pathlib import Path


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


def call_openrouter(prompt: str, api_key: str) -> str:
    url = 'https://api.openrouter.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    payload = {
        'model': 'openai/gpt-oss-20b:free',
        'messages': [
            {'role': 'system', 'content': 'You are a helpful assistant.'},
            {'role': 'user', 'content': prompt}
        ],
        'max_tokens': 250,
        'temperature': 0.7,
    }

    response = requests.post(url, headers=headers, json=payload, timeout=60)
    content_type = response.headers.get('Content-Type', '')

    if 'application/json' not in content_type:
        raise ValueError(
            f'Expected JSON response but got {content_type}.\n' + response.text
        )

    data = response.json()
    if response.status_code != 200:
        raise RuntimeError('OpenRouter error: ' + json.dumps(data, indent=2))

    choice = data.get('choices', [])[0] if data.get('choices') else None
    if not choice or 'message' not in choice:
        raise ValueError('Unexpected OpenRouter response format: ' + json.dumps(data, indent=2))

    return choice['message']['content'].strip()


def main() -> None:
    try:
        api_key = get_openrouter_api_key()
    except EnvironmentError as exc:
        print(exc)
        return

    print('Testing OpenRouter endpoint...')
    try:
        greeting = call_openrouter('Hello, please reply with a short greeting.', api_key)
        print('Connection successful. Sample response:')
        print(greeting)
    except Exception as exc:
        print('Connection test failed:')
        print(exc)
        return

    print('\nChat ready. Type QUIT or EXIT to stop.')
    while True:
        prompt = input('> ').strip()
        if not prompt:
            continue
        if prompt.upper() in {'QUIT', 'EXIT'}:
            print('Goodbye.')
            break

        try:
            response_text = call_openrouter(prompt, api_key)
            print('AI:', response_text)
        except Exception as exc:
            print('Error:', exc)


if __name__ == '__main__':
    main()
