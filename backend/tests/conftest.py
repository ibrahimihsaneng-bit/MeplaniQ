import os
import tempfile
import pytest
from backend.database import set_db_path, init_db, DEFAULT_DB_PATH


@pytest.fixture(autouse=True)
def isolate_test_database():
    """
    Autouse fixture that points the SQLite database to a temporary isolated test database
    so pytest never writes dummy test data to the production projects.db.
    """
    temp_dir = tempfile.mkdtemp()
    temp_db_file = os.path.join(temp_dir, "test_isolated_projects.db")
    
    set_db_path(temp_db_file)
    init_db()

    yield temp_db_file

    set_db_path(None)
    try:
        if os.path.exists(temp_db_file):
            os.remove(temp_db_file)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
    except Exception:
        pass
