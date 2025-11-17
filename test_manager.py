class TestManager:
    def __init__(self):
        self.active_test = False
        self.current_variant = None
        self.finalized = True

    def start_test(self, variant):
        if not self.finalized or variant not in ['powers', 'squares']:
            return False
        self.active_test = True
        self.current_variant = variant
        self.finalized = False
        return True

    def stop_test(self):
        if not self.active_test:
            return False
        self.active_test = False
        return True

    def finalize_test(self):
        self.active_test = False
        self.current_variant = None
        self.finalized = True

    def is_test_active(self):
        return self.active_test

    def is_finalized(self):
        return self.finalized

    def get_current_variant(self):
        return self.current_variant