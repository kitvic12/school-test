import random
import math

def generate_question_advanced(mode: str, asked_questions: list, question_type: str = 'random'):
    print(mode, asked_questions, question_type)
    if mode == 'sqrt':
        all_bases = list(range(10, 31)) 
    elif mode == 'powers':
        all_bases = list(range(0, 15)) 
    else:
        raise ValueError("mode must be 'sqrt' or 'powers'")

    possible_combinations = [
        (base, qtype)
        for base in all_bases
        for qtype in ['find_result', 'find_base']
        if (base, qtype) not in asked_questions
    ]

    if not possible_combinations:
        raise ValueError("Все возможные вопросы уже заданы!")


    selected_base, selected_qtype = random.choice(possible_combinations)
    updated_asked = asked_questions + [(selected_base, selected_qtype)]


    if mode == 'sqrt':
        result_value = selected_base ** 2
    elif mode == 'powers':
        result_value = 2 ** selected_base

    if selected_qtype == 'find_result':
        question = selected_base
        returned_type = 'base'  
    elif selected_qtype == 'find_base':
        question = result_value
        returned_type = 'result'  

    return question, updated_asked, returned_type



def check_answer(mode: str, question: int, question_type: str, student_answer: int) -> bool:
    if question_type == 'base':
        if mode == 'sqrt':
            correct_answer = question ** 2
        elif mode == 'powers':
            correct_answer = 2 ** question
        else:
            raise ValueError("mode must be 'sqrt' or 'powers'")
        return student_answer == correct_answer

    elif question_type == 'result':
        if mode == 'sqrt':
            base = int(math.sqrt(question))
            correct_answer = base if base ** 2 == question else None
        elif mode == 'powers':
            if question <= 0:
                correct_answer = None  
            else:
                log_val = math.log2(question)
                correct_answer = int(log_val) if log_val.is_integer() else None
        else:
            raise ValueError("mode must be 'sqrt' or 'powers'")

        return student_answer == correct_answer

    else:
        raise ValueError("question_type must be 'base' or 'result'")