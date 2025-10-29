import sys
import psycopg

try:
    with psycopg.connect('postgresql://postgres:postgres@localhost:5432/postgres', autocommit=True) as conn:
        conn.execute('CREATE DATABASE nutricion');
        print('Base de datos creada o ya existia.')
except Exception as exc:
    print('Error conectando a PostgreSQL:', exc)
    sys.exit(1)
