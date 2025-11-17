def calculate_grade(score):
    if score is None:
        return None
    if score >= 90: return '5'
    elif score >= 75: return '4'
    elif score >= 50: return '3'
    else: return '2'