import json

DEFAULT_STORE = {
    'students': {},
    'test_state': {
        'active': False,
        'variant': None,
        'finalized': True
    }
}


def load_students():
    try:
        with open('student.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError('student.json must contain a JSON object')
            if 'students' not in data:
                data['students'] = {}
            if 'test_state' not in data:
                data['test_state'] = DEFAULT_STORE['test_state'].copy()
            return data
    except (FileNotFoundError, json.JSONDecodeError, ValueError):
        save_students(DEFAULT_STORE)
        return DEFAULT_STORE.copy()


def save_students(students):
    with open('student.json', 'w', encoding='utf-8') as f:
        json.dump(students, f, indent=4, ensure_ascii=False)


