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


def load_settings(what=None):
    try:
        with open('settings.json', 'r', encoding='utf-8') as f: 
            settings = json.load(f)
            if not isinstance(settings, dict):
                raise ValueError('settings.json must contain a JSON object')
            
        if what is not None:
            if what == "Graduations":
                return [
                    settings.get('Graduations5'),
                    settings.get('Graduations4'),
                    settings.get('Graduations3')
                ]
            return settings.get(what)
        
        return settings
    
    except (FileNotFoundError, json.JSONDecodeError, ValueError) as e:
        print(f"Error loading settings: {e}")
        return None
 

def update_students(data):
    try:
        with open('student.json', 'w') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error updating students: {e}")


def clear_for_new_test():
    try:
        with open('student.json', 'w') as f:
            json.dump(DEFAULT_STORE, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error clearing students: {e}")


def delete_student(ip):
    try:
        data = load_students()
        students = data.get('students', {})
        to_remove = [sid for sid, info in students.items() if info.get('ip') == ip]
        for sid in to_remove:
            del students[sid]
        if to_remove:
            save_students(data)
    except Exception as e:
        print(f"Error deleting student: {e}")



def update_settings(new_settings):
    try:
        settings = load_settings()
        if not isinstance(settings, dict):
            settings = {}
        settings.update(new_settings)
        with open('settings.json', 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error updating settings: {e}")


def is_active():
    data = load_students()
    return data.get('test_state', {}).get('active', False)