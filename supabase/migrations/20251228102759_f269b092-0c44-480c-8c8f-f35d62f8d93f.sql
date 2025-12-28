-- Replace old generic categories with academic focus
TRUNCATE public.interest_categories CASCADE;

INSERT INTO public.interest_categories (name, emoji) VALUES
  ('Discussions', '🗣️'),
  ('Calls', '📞'),
  ('Texters', '✍️'),
  ('Bookreaders', '📖'),
  ('Class Dodgers', '🏃‍♂️'),
  ('Morning Readers', '☀️'),
  ('Group Studies', '👥'),
  ('Research', '🔍'),
  ('Note Taking', '📝'),
  ('Exam Prep', '📑'),
  ('Peer Tutoring', '🎓'),
  ('Project Work', '🏗️'),
  ('Music', '🎵'),
  ('Gaming', '🎮'),
  ('Sports', '⚽'),
  ('Travel', '✈️'),
  ('Food', '🍕'),
  ('Tech', '💻'),
  ('Art', '🎨'),
  ('Anime', '🎌');