import psycopg

conn = psycopg.connect('postgresql://postgres:postgres@localhost:5434/postgres', autocommit=True)
cur = conn.cursor()
cur.execute('DROP DATABASE IF EXISTS nutricion')
cur.execute('CREATE DATABASE nutricion')
print('Base de datos nutricion reiniciada en Postgres (puerto 5434).')
cur.close()
conn.close()
