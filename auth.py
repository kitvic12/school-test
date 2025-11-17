TEACHER_CREDENTIALS = {
    'username': 'teacherEaVi',
    'password': 'CheckingTest'
}

def login_teacher(username, password):
    return (username == TEACHER_CREDENTIALS['username'] and 
            password == TEACHER_CREDENTIALS['password'])