-- Run separately before 0003: PostgreSQL must commit a new enum value first.
alter type public.character_status add value if not exists 'SEVERELY_ILL';
