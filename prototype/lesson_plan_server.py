import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from prototype.openrouter_chat import SUPPORTED_MODELS, generate_lesson_plan

BASE_DIR = Path(__file__).resolve().parent


class LessonPlanHandler(SimpleHTTPRequestHandler):
    def send_json(self, status: int, payload: dict) -> None:
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/models':
            self.send_json(200, {'models': SUPPORTED_MODELS})
            return

        if self.path == '/api/references':
            reference_dir = BASE_DIR / 'reference'
            files = []
            if reference_dir.exists() and reference_dir.is_dir():
                files = sorted([path.name for path in reference_dir.iterdir() if path.suffix.lower() in {'.pdf', '.docx'}])
            self.send_json(200, {'references': files})
            return

        return super().do_GET()

    def do_POST(self):
        if self.path != '/api/generate':
            self.send_json(404, {'error': 'Not found'})
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json(400, {'error': 'Invalid JSON body'})
            return

        model = data.get('model')
        references = data.get('references')
        if isinstance(references, list) and len(references) == 0:
            references = None
        lesson_data = data.get('lesson_data')

        if not isinstance(lesson_data, dict):
            self.send_json(400, {'error': 'lesson_data must be an object'})
            return

        try:
            output = generate_lesson_plan(lesson_data, model=model, selected_refs=references)
            self.send_json(200, {'success': True, 'output': output})
        except Exception as exc:
            self.send_json(500, {'success': False, 'error': str(exc)})


def run(host: str = '0.0.0.0', port: int = 8000) -> None:
    server_address = (host, port)
    handler_class = LessonPlanHandler
    httpd = ThreadingHTTPServer(server_address, handler_class)
    print(f'Serving on http://{host}:{port} (open prototype.html in the browser)')
    httpd.serve_forever()


if __name__ == '__main__':
    run()
