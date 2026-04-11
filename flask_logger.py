import logging
from flask import request

class FlaskLogger:
    def __init__(self, app):
        self.app = app
        self.setup_logging()
    
    def setup_logging(self):
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        self.app.logger.handlers.clear()
        
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        
        self.app.logger.setLevel(logging.INFO)
        self.app.logger.addHandler(console_handler)
        
        log = logging.getLogger('werkzeug')
        log.setLevel(logging.ERROR)
    
    def get_client_type(self, path):
        """Определяем тип клиента по пути"""
        if path.startswith('/teacher'):
            return 'TEACHER'
        elif path in ['/', '/script.js', '/style.css', '/student/*']:
            return 'STUDENT'
        elif path.startswith('/api'):
            # Определяем по IP или сессии
            client_ip = request.remote_addr
            if client_ip in ['127.0.0.1', 'localhost']:
                return 'TEACHER_API'
            else:
                return 'STUDENT_API'
        elif path.startswith('/socket.io'):
            # Для сокетов — проверяем namespace
            transport = request.args.get('transport', '')
            if transport:
                # Пытаемся определить по сессии или IP
                client_ip = request.remote_addr
                if client_ip in ['127.0.0.1', 'localhost']:
                    return 'TEACHER_SOCKET'
                else:
                    return 'STUDENT_SOCKET'
        return 'UNKNOWN'
    
    def log_request(self, response):
        """Логирование HTTP-запросов"""
        client_type = self.get_client_type(request.path)
        
        try:
            if hasattr(response, 'content_length') and response.content_length is not None:
                size = response.content_length
            else:
                content = response.get_data(as_text=True)
                size = len(content.encode('utf-8'))
        except:
            size = 0
        
        self.app.logger.info(
            f'REQ | {client_type} | {request.remote_addr} | '
            f'{request.method} {request.path} | '
            f'{response.status_code} | '
            f'{size} bytes'
        )
        
        if request.args:
            self.app.logger.info(
                f'    | QUERY: {dict(request.args)}'
            )
        
        if request.method == 'POST' and request.is_json:
            try:
                json_data = request.get_json()
                if json_data:
                    self.app.logger.info(
                        f'    | DATA: {str(json_data)[:200]}'
                    )
            except:
                pass
    
    def log_custom(self, level, message):
        self.app.logger.log(level, message)